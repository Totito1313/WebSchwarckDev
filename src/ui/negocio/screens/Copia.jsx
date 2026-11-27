// Negocio › Copia de seguridad. Tres sitios donde guardar todo lo de Negocio:
//  · En el servidor, cada día y solo (el cron del Worker): se ven, se descargan y se
//    restauran desde aquí. Antes de restaurar se guarda siempre lo que había.
//  · En una carpeta de este ordenador, por ejemplo la de Google Drive, OneDrive o
//    Dropbox que se sincroniza sola: el navegador guarda allí una copia cada día que
//    abres Negocio (File System Access, en Chrome y Edge).
//  · Descargada, cuando quieras, en un archivo JSON.
// Los archivos (recibos, documentos de marca) no van dentro: siguen guardados aparte.
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRotateLeft,
  ArrowUpFromLine,
  ClockArrowRotateLeft,
  CloudArrowUpIn,
  Folder,
  FolderOpen,
  Server,
  ShieldCheck,
  ShieldExclamation,
  TrashBin,
} from '@gravity-ui/icons';
import { Alert, Button, Card, Chip, Skeleton, toast } from '@heroui/react';
import { COLS, api, flushNow, put, reloadAll, state as crm, todayISO } from '../../../negocio-core.js';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { NumberStepper } from '../../pro/index.js';
import { ConfirmDialog } from '../fields.jsx';
import { useCrm } from '../store.js';

/* ── Lo que va en una copia ─────────────────────────────────────────────── */

// [lista, singular, plural]
const WORDS = [
  ['customers', 'cliente', 'clientes'],
  ['docs', 'documento', 'documentos'],
  ['catalog', 'servicio', 'servicios'],
  ['projects', 'proyecto', 'proyectos'],
  ['tasks', 'tarea', 'tareas'],
  ['time', 'registro de horas', 'registros de horas'],
  ['expenses', 'gasto', 'gastos'],
  ['pages', 'página', 'páginas'],
  ['leads', 'lead', 'leads'],
  ['posts', 'publicación', 'publicaciones'],
];

/** Todo lo de Negocio, tal como lo restaura el servidor. */
export function backupJson() {
  const data = { settings: crm.settings };
  for (const col of COLS) data[col] = crm[col];
  return JSON.stringify({ version: 1, kind: 'export', at: new Date().toISOString(), data }, null, 2);
}

function download() {
  const blob = new Blob([backupJson()], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `negocio-${todayISO()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function ago(iso) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps = [
    [60, 'second'],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [Infinity, 'week', 604800],
  ];
  for (const [limit, unit, div = 1] of steps) if (Math.abs(s) < limit) return rtf.format(Math.round(s / div), unit);
  return '';
}
const dfLong = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const sizeText = (n) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
/** «1 cliente», «2 clientes». */
const n = (count, one, many) => `${count ?? 0} ${count === 1 ? one : many}`;
const KIND = { auto: ['Automática', 'default'], manual: ['A mano', 'accent'], restore: ['Antes de restaurar', 'warning'] };

/* ── La carpeta sincronizada (Drive, OneDrive…) ─────────────────────────── */

const FOLDER_OK = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const LAST_KEY = 'negocio-copia-carpeta';
const KEEP_FILES = 30;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('negocio', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('handles');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('handles', mode);
      const req = fn(tx.objectStore('handles'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}
const getFolder = () => (FOLDER_OK ? idb('readonly', (s) => s.get('copias')).catch(() => null) : Promise.resolve(null));
const setFolder = (handle) => idb('readwrite', (s) => (handle ? s.put(handle, 'copias') : s.delete('copias')));

function readLast() {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || 'null') || { auto: true, at: '' };
  } catch {
    return { auto: true, at: '' };
  }
}
const writeLast = (v) => {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    // Sin almacenamiento, la copia en carpeta solo se hace a mano.
  }
};

/** Escribe la copia de hoy en la carpeta y deja solo las últimas 30. */
async function writeToFolder(dir) {
  const file = await dir.getFileHandle(`negocio-${todayISO()}.json`, { create: true });
  const w = await file.createWritable();
  await w.write(new Blob([backupJson()], { type: 'application/json' }));
  await w.close();
  const names = [];
  for await (const [name, h] of dir.entries()) if (h.kind === 'file' && /^negocio-\d{4}-\d{2}-\d{2}\.json$/.test(name)) names.push(name);
  names.sort().reverse();
  await Promise.all(names.slice(KEEP_FILES).map((n) => dir.removeEntry(n).catch(() => {})));
  writeLast({ ...readLast(), at: new Date().toISOString() });
}

/**
 * Al abrir Negocio: si hay carpeta elegida, con permiso y sin copia de hoy, se guarda.
 * Sin permiso (el navegador lo pide de nuevo tras cerrarse) no se pregunta nada: se
 * avisa en esta pantalla.
 */
export async function autoFolderBackup() {
  if (!FOLDER_OK) return;
  const last = readLast();
  if (!last.auto || last.at?.slice(0, 10) === todayISO()) return;
  const dir = await getFolder();
  if (!dir || (await dir.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return;
  try {
    await writeToFolder(dir);
  } catch {
    // Si la carpeta ya no está, se verá en la pantalla de copias.
  }
}

function FolderCard() {
  const [dir, setDir] = useState(undefined);
  const [perm, setPerm] = useState('');
  const [last, setLast] = useState(readLast);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getFolder().then(async (h) => {
      setDir(h || null);
      if (h) setPerm(await h.queryPermission({ mode: 'readwrite' }));
    });
  }, []);
  const save = async (handle = dir) => {
    setBusy(true);
    try {
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        toast.warning('Sin permiso para escribir en esa carpeta.');
        return;
      }
      setPerm('granted');
      await writeToFolder(handle);
      setLast(readLast());
      toast.success(`Copia guardada en «${handle.name}»`);
    } catch (err) {
      toast.danger(err?.name === 'NotFoundError' ? 'Esa carpeta ya no existe. Elige otra.' : 'No se pudo guardar en la carpeta.');
    } finally {
      setBusy(false);
    }
  };
  const choose = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'negocio-copias', mode: 'readwrite', startIn: 'documents' });
      await setFolder(h);
      setDir(h);
      await save(h);
    } catch (err) {
      if (err?.name !== 'AbortError') toast.danger('No se pudo usar esa carpeta.');
    }
  };

  return (
    <Card className="h-full">
      <Card.Header>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
            <CloudArrowUpIn className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <Card.Title>En tu Drive</Card.Title>
            <Card.Description>En una carpeta de Google Drive, OneDrive o Dropbox de este ordenador.</Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-1 flex-col gap-4">
        {!FOLDER_OK ? (
          <>
            <p className="text-sm text-muted">Este navegador no deja guardar en carpetas. En Chrome o Edge (o en la app de escritorio) sí; aquí, descarga la copia y súbela a tu Drive.</p>
            <Button variant="secondary" className="w-fit" onPress={download}>
              <ArrowDownToLine />
              Descargar copia
            </Button>
          </>
        ) : dir === undefined ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : dir ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3">
              <FolderOpen className="size-5 shrink-0 text-muted" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{dir.name}</span>
                <span className="text-xs text-muted">{last.at ? `Última copia ${ago(last.at)}` : 'Todavía sin copias aquí'} · guarda las últimas {KEEP_FILES}</span>
              </div>
              <Button size="sm" variant="ghost" onPress={choose}>
                Cambiar
              </Button>
            </div>
            {perm !== 'granted' && (
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>El navegador pide permiso otra vez</Alert.Title>
                  <Alert.Description>Pulsa «Guardar ahora» y acepta: así vuelven las copias diarias.</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <SwitchField
              label="Una copia cada día que abras Negocio"
              description="Tu Drive la sube sola a la nube."
              isSelected={last.auto !== false}
              onChange={(v) => {
                const next = { ...readLast(), auto: v };
                writeLast(next);
                setLast(next);
              }}
            />
            <div className="mt-auto flex flex-wrap gap-2">
              <Button variant="secondary" isPending={busy} onPress={() => save()}>
                <ArrowUpFromLine />
                Guardar ahora
              </Button>
              <Button
                variant="ghost"
                onPress={async () => {
                  await setFolder(null);
                  setDir(null);
                }}
              >
                Dejar de usarla
              </Button>
            </div>
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-2 text-sm text-muted">
              <li className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-foreground">1</span>
                Elige una carpeta dentro de tu Google Drive (o OneDrive, Dropbox…).
              </li>
              <li className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-foreground">2</span>
                Negocio guarda allí una copia cada día que lo abras, y las 30 últimas.
              </li>
            </ol>
            <Button className="mt-auto w-fit" onPress={choose}>
              <Folder />
              Elegir carpeta
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

/* ── La pantalla ────────────────────────────────────────────────────────── */

export function Copia() {
  const [state] = useCrm();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [ask, setAsk] = useState(null); // { backup } | { file, data, counts }
  const cfg = state.settings.backup || {};
  const auto = cfg.auto !== false;
  const keep = Math.max(3, Math.min(60, Number(cfg.keep) || 14));
  const latest = list?.[0];

  const load = useCallback(async () => {
    try {
      const r = await api('/crm/backups');
      setList(r.backups || []);
      setError('');
    } catch (err) {
      setList([]);
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const setCfg = (patch) => put('settings', { ...crm.settings, backup: { ...(crm.settings.backup || {}), ...patch } });

  const makeNow = async () => {
    setBusy('make');
    try {
      await flushNow();
      await api('/crm/backups', { method: 'POST' });
      toast.success('Copia hecha en el servidor');
      await load();
    } catch (err) {
      toast.danger(err.message);
    } finally {
      setBusy('');
    }
  };

  const restore = async () => {
    const what = ask;
    setAsk(null);
    setBusy('restore');
    try {
      await flushNow();
      if (what.backup) await api(`/crm/backups/${what.backup.id}/restore`, { method: 'POST' });
      else await api('/crm/restore', { method: 'POST', body: what.data });
      await reloadAll();
      toast.success('Copia restaurada. Lo que había quedó guardado como copia.');
      await load();
    } catch (err) {
      toast.danger(err.message);
    } finally {
      setBusy('');
    }
  };

  const pickFile = () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const parsed = JSON.parse(await f.text());
        const src = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        if (!COLS.some((c) => Array.isArray(src?.[c]))) throw new Error('bad');
        setAsk({ file: f.name, data: parsed, counts: Object.fromEntries(COLS.map((c) => [c, Array.isArray(src[c]) ? src[c].length : 0])) });
      } catch {
        toast.danger('Ese archivo no es una copia de Negocio.');
      }
    };
    input.click();
  };

  const counts = Object.fromEntries(COLS.map((c) => [c, (state[c] || []).length]));
  const safe = Boolean(latest) && Date.now() - new Date(latest.at).getTime() < 3 * 86400_000;

  return (
    <div className="flex flex-col gap-4">
      {/* Cómo está todo */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className={`flex size-14 shrink-0 items-center justify-center rounded-3xl ${safe ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
              {safe ? <ShieldCheck className="size-7" /> : <ShieldExclamation className="size-7" />}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-lg font-semibold">{list === null ? 'Mirando tus copias…' : safe ? 'Tus datos están a salvo' : latest ? 'Hace días que no hay copia' : 'Todavía no hay copias en el servidor'}</h2>
              <p className="text-sm text-muted">
                {latest ? `Última copia ${ago(latest.at)} (${KIND[latest.kind]?.[0].toLowerCase() || 'copia'}) · ${list.length} guardadas` : 'Haz la primera ahora: luego se hacen solas cada día.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button isPending={busy === 'make'} onPress={makeNow} isDisabled={Boolean(error)}>
              <Server />
              Hacer copia ahora
            </Button>
            <Button variant="secondary" onPress={download}>
              <ArrowDownToLine />
              Descargar
            </Button>
            <Button variant="tertiary" onPress={pickFile} isPending={busy === 'restore'}>
              <ArrowRotateLeft />
              Restaurar desde archivo
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {WORDS.map(([col, one, more]) => (
            <Chip key={col} size="sm" variant="tertiary">
              <span className="font-semibold tabular-nums">{counts[col]}</span> {counts[col] === 1 ? one : more}
            </Chip>
          ))}
        </div>
      </Card>

      {error && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Las copias del servidor no responden</Alert.Title>
            <Alert.Description>{error} Puedes descargar la copia o guardarla en tu Drive igualmente.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <Card.Header>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-surface-secondary">
                <ClockArrowRotateLeft className="size-5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <Card.Title>Automáticas, en el servidor</Card.Title>
                <Card.Description>Cada día a las 3:00 (hora de Caracas), si cambió algo. Aparte de tus datos.</Card.Description>
              </div>
            </div>
          </Card.Header>
          <Card.Content className="flex flex-1 flex-col gap-5">
            <SwitchField label="Hacer una copia cada día" description="Apágalo solo si guardas tus copias en otro sitio." isSelected={auto} onChange={(v) => setCfg({ auto: v })} />
            <NumberStepper
              label="Copias automáticas que se guardan"
              value={keep}
              onChange={(n) => setCfg({ keep: Math.round(n) })}
              min={3}
              max={60}
              description={`Las de los últimos ${keep} días con cambios. Las hechas a mano se guardan aparte (hasta 20).`}
              isDisabled={!auto}
            />
          </Card.Content>
        </Card>
        <FolderCard />
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Historial</Card.Title>
          <Card.Description>Cada copia guarda todo lo de Negocio de ese momento. Restaurar una no borra las demás.</Card.Description>
        </Card.Header>
        <Card.Content>
          {list === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : list.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {list.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="first-letter:uppercase">{dfLong.format(new Date(b.at))}</span>
                      <Chip size="sm" variant="soft" color={KIND[b.kind]?.[1] || 'default'}>
                        {KIND[b.kind]?.[0] || b.kind}
                      </Chip>
                    </span>
                    <span className="truncate text-xs text-muted">
                      {ago(b.at)} · {sizeText(b.bytes || 0)} · {n(b.counts?.customers, 'cliente', 'clientes')} · {n(b.counts?.docs, 'documento', 'documentos')} · {n(b.counts?.tasks, 'tarea', 'tareas')}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onPress={() => Object.assign(document.createElement('a'), { href: `/api/admin/crm/backups/${b.id}`, download: '' }).click()}>
                      <ArrowDownToLine />
                      <span className="hidden sm:inline">Descargar</span>
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => setAsk({ backup: b })}>
                      <ArrowRotateLeft />
                      Restaurar
                    </Button>
                    {b.kind !== 'auto' && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label="Borrar esta copia"
                        onPress={async () => {
                          try {
                            await api(`/crm/backups/${b.id}`, { method: 'DELETE' });
                            setList((l) => l.filter((x) => x.id !== b.id));
                          } catch (err) {
                            toast.danger(err.message);
                          }
                        }}
                      >
                        <TrashBin />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{error ? 'Sin conexión con las copias del servidor.' : 'Aún no hay copias. La primera se hace esta noche, o ahora con «Hacer copia ahora».'}</p>
          )}
        </Card.Content>
      </Card>

      <ConfirmDialog
        open={Boolean(ask)}
        status="warning"
        title={ask?.backup ? `¿Volver a la copia del ${ask ? dfLong.format(new Date(ask.backup.at)) : ''}?` : `¿Restaurar «${ask?.file || ''}»?`}
        text={(() => {
          const c = ask?.backup ? ask.backup.counts || {} : ask?.counts || {};
          return `Negocio queda como en la copia: ${n(c.customers, 'cliente', 'clientes')}, ${n(c.docs, 'documento', 'documentos')}, ${n(c.projects, 'proyecto', 'proyectos')} y ${n(c.tasks, 'tarea', 'tareas')}. Lo que tienes ahora se guarda antes como copia, por si quieres volver.`;
        })()}
        confirm="Restaurar"
        onClose={() => setAsk(null)}
        onConfirm={restore}
      />
    </div>
  );
}
