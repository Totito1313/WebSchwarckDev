// Recursos (con facturas y documentos, y subir los tuyos si tu portal lo deja) y
// Peticiones (con filtros por tipo, plazo y prioridad, «Entregar», lo que ya
// mandaste para cada una y su conversación).
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRightFromSquare, Check, Comments, Eye, Folder, PaperPlane, Sliders, TrashBin, Tray } from '@gravity-ui/icons';
import { Button, Card, Chip, Disclosure, Label, SearchField, Slider, Tabs, Tag, TagGroup, toast } from '@heroui/react';
import { Empty } from '../../kit/parts.jsx';
import { KpiGroup, Widget } from '../../pro/index.js';
import { ago, dueText, hostOf, money, safeUrl, shortDate } from '../../../portal/kit.js';
import { DOC_TYPE, EXPECTS, PRIORITY, RESOURCE_KIND, SENT_KIND, app, can, commentsOf, docState, has, isMine, removeLocal, signPaths, urlOf } from '../../../portal/state.js';
import { go, refresh, save, usePortal } from '../store.js';
import { ConfirmDialog } from '../../negocio/fields.jsx';
import { Bubble, Ico, Tone, openFile, sizeOf } from '../ui.jsx';
import { RecursoModal } from './Crear.jsx';

const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Las fotos subidas como recurso necesitan su dirección firmada para verse. */
const signed = new Set();
function useResourcePreviews(list, v) {
  useEffect(() => {
    const missing = list.filter((r) => r.kind === 'image' && r.storage_path && !app.urls[r.storage_path] && !signed.has(r.storage_path)).map((r) => r.storage_path);
    if (!missing.length) return;
    missing.forEach((p) => signed.add(p));
    signPaths(missing).then(refresh);
  }, [v]);
}

export function Recursos() {
  const [, v] = usePortal();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(new Set(['todas']));
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(null);
  const canUpload = !app.studio && can('resources.upload');
  const all = app.data.resources || [];
  const cats = useMemo(() => [...new Set(all.map((r) => r.category).filter(Boolean))], [all, v]);
  const chosen = [...cat][0] || 'todas';
  const list = all.filter((r) => (chosen === 'todas' || r.category === chosen) && (!q.trim() || plain(`${r.title} ${r.description} ${r.category}`).includes(plain(q.trim()))));
  const docs = has('documents') && can('docs.view') ? [...app.data.documents].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')) : [];
  const owed = docs.filter((d) => d.type === 'invoice' && ['open', 'partial', 'viewed'].includes(d.status)).reduce((s, d) => s + Math.max(0, (d.total || 0) - (d.paid || 0)), 0);
  useResourcePreviews(all, v);
  const remove = async (r) => {
    try {
      await app.backend.remove('resources', r.id);
      if (r.storage_path) await app.backend.removeFiles([r.storage_path]);
      removeLocal('resources', r.id);
      refresh();
      toast.success('Recurso quitado');
    } catch (err) {
      toast.danger('No se quitó', { description: err.message });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recursos</h1>
          <p className="text-sm text-muted">Guías, manuales, fotos, vídeos, enlaces y tus documentos.</p>
        </div>
        {canUpload && (
          <Button variant="secondary" onPress={() => setUploading(true)}>
            <ArrowUpFromLine />
            Subir un recurso
          </Button>
        )}
      </header>

      {docs.length > 0 && (
        <Widget title="Facturas y documentos" description={owed ? `Falta por pagar ${money(owed)}` : 'Todo al día'} bodyClassName="p-2">
          <ul className="flex flex-col">
            {docs.map((d) => {
              const [word, ico, color] = DOC_TYPE[d.type] || DOC_TYPE.invoice;
              const [label, tone] = docState(d);
              const href = d.url && safeUrl(d.url);
              const row = (
                <>
                  <Bubble name={ico} color={color} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{d.title || `${word} ${d.number}`}</span>
                    <span className="truncate text-xs text-muted">
                      {word} {d.number} · {shortDate(d.issue_date)} · {money(d.total || 0)}
                    </span>
                  </span>
                  <Tone label={label} color={tone} />
                </>
              );
              return (
                <li key={d.id}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                      {row}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Widget>
      )}

      <div className="flex flex-col gap-3">
        <SearchField aria-label="Buscar recursos" value={q} onChange={setQ}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar un recurso…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {cats.length > 1 && (
          <TagGroup aria-label="Categoría" selectionMode="single" disallowEmptySelection selectedKeys={cat} onSelectionChange={setCat} size="sm">
            <TagGroup.List>
              <Tag id="todas">Todas · {all.length}</Tag>
              {cats.map((c) => (
                <Tag key={c} id={c}>
                  {c} · {all.filter((r) => r.category === c).length}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon={Folder} title={all.length ? 'Nada coincide' : 'Todavía no hay recursos'} text={all.length ? 'Prueba con otra palabra o categoría.' : 'Lo que el estudio te deje aquí aparecerá en esta lista.'} />
      ) : (
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          {list.map((r) => {
            const [kind, ico, color] = RESOURCE_KIND[r.kind] || RESOURCE_KIND.file;
            // Un enlace se abre tal cual; un archivo subido, con una dirección firmada al tocarlo.
            const url = safeUrl(r.url);
            const file = r.storage_path;
            const preview = r.kind === 'image' ? urlOf(file) || url : null;
            const own = !app.studio && r.origin === 'client' && isMine(r);
            const open = url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : file ? { href: '#', onClick: (e) => (e.preventDefault(), openFile(file)) } : {};
            const Wrap = url || file ? 'a' : 'div';
            return (
              <div key={r.id} className="relative">
              <Wrap
                {...open}
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)] outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
              >
                {/* Arriba, la cara del recurso: la imagen o su tipo, en su color. */}
                <div className="relative flex h-28 items-center justify-center overflow-hidden" style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
                  {preview ? <img src={preview} alt="" loading="lazy" className="size-full object-cover" /> : <Bubble name={ico} color={color} />}
                  <span className="absolute start-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium backdrop-blur">{kind}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-muted">
                    {[r.category, sizeOf(r.size), ago(r.created_at)].filter(Boolean).join(' · ')}
                  </span>
                  {r.description && <p className="line-clamp-2 text-sm text-muted">{r.description}</p>}
                  {(url || file) && (
                    <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-accent">
                      {file ? 'Descargar' : `Abrir${hostOf(url) ? ` en ${hostOf(url)}` : ''}`}
                      {file ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpRightFromSquare className="size-3.5" />}
                    </span>
                  )}
                </div>
              </Wrap>
              {own && (
                <Button isIconOnly size="sm" variant="secondary" aria-label={`Quitar «${r.title}»`} onPress={() => setRemoving(r)} className="absolute end-2 top-2 rounded-full">
                  <TrashBin />
                </Button>
              )}
              </div>
            );
          })}
        </div>
      )}
      {uploading && <RecursoModal onClose={() => setUploading(false)} />}
      <ConfirmDialog open={Boolean(removing)} title={`¿Quitar «${removing?.title || ''}»?`} text="El estudio dejará de verlo en tus recursos." confirm="Quitar" onConfirm={() => remove(removing)} onClose={() => setRemoving(null)} />
    </div>
  );
}

/** Lo que se mandó (para una petición o suelto): abrirlo, si ya lo vio el estudio y, si no, borrarlo. */
function SentRow({ s, onRemove }) {
  const [kind] = SENT_KIND[s.kind] || SENT_KIND.message;
  const url = safeUrl(s.url);
  return (
    <li className="flex items-center gap-3 py-2">
      <Bubble name={SENT_KIND[s.kind]?.[1] || 'send'} color="var(--accent)" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{s.file_name || (url ? hostOf(url) : '') || (s.body || '').slice(0, 90) || kind}</span>
        <span className="truncate text-xs text-muted">{[kind, sizeOf(s.size), ago(s.created_at)].filter(Boolean).join(' · ')}</span>
      </span>
      {s.storage_path && (
        <Button isIconOnly size="sm" variant="ghost" aria-label="Descargar" onPress={() => openFile(s.storage_path)}>
          <ArrowDownToLine />
        </Button>
      )}
      {url && (
        <Button isIconOnly size="sm" variant="ghost" aria-label="Abrir" onPress={() => window.open(url, '_blank', 'noopener')}>
          <ArrowUpRightFromSquare />
        </Button>
      )}
      {s.seen_at ? (
        <Chip size="sm" variant="soft" color="success">
          <Eye className="size-3" />
          Visto
        </Chip>
      ) : (
        onRemove && (
          <Button isIconOnly size="sm" variant="ghost" aria-label="Borrar el envío" onPress={() => onRemove(s)}>
            <TrashBin />
          </Button>
        )
      )}
    </li>
  );
}

const PRIO_LEVEL = { low: 0, normal: 1, high: 2 };
const PRIO_NAMES = ['Todas', 'Normal o más', 'Solo urgentes'];
const DUE = [
  ['todas', 'Cualquier fecha'],
  ['tarde', 'Atrasadas'],
  ['semana', 'Esta semana'],
  ['sinfecha', 'Sin fecha'],
];
/** En qué está cada petición, más fino que su estado guardado. */
function phaseOf(t) {
  if (t.status === 'done') return ['Revisada', 'success'];
  if (t.status === 'submitted') return ['En revisión', 'accent'];
  if (!t.due_date) return ['Por hacer', 'default'];
  const [, late] = dueText(t.due_date);
  return late === 'is-late' ? ['Atrasada', 'danger'] : late === 'is-soon' ? ['Vence pronto', 'warning'] : ['A tiempo', 'default'];
}

/** Los filtros: tipo, plazo y prioridad (a la derecha en pantallas anchas). */
function TaskFilters({ all, kinds, setKinds, due, setDue, prio, setPrio }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Qué piden</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EXPECTS).map(([k, [label, ico]]) => {
            const on = kinds.has(k);
            const n = all.filter((t) => (t.expects || 'any') === k).length;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setKinds((cur) => {
                    const next = new Set(cur);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-foreground text-background' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
              >
                <Ico name={ico} className="size-3.5" />
                {label}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Plazo</Label>
        <div className="flex flex-wrap gap-1.5">
          {DUE.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={due === k}
              onClick={() => setDue(k)}
              className={`rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${due === k ? 'bg-foreground text-background' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Slider value={prio} minValue={0} maxValue={2} step={1} onChange={(n) => setPrio(Number(n))}>
        <Label>Prioridad</Label>
        <Slider.Output>{({ state }) => PRIO_NAMES[state.values[0]]}</Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}

export function Peticiones({ tab }) {
  const [, v] = usePortal();
  const [busy, setBusy] = useState('');
  const [kinds, setKinds] = useState(() => new Set());
  const [due, setDue] = useState('todas');
  const [prio, setPrio] = useState(0);
  const [dropping, setDropping] = useState(null);
  const current = ['pendientes', 'enviadas', 'hechas'].includes(tab) ? tab : 'pendientes';
  const status = { pendientes: 'pending', enviadas: 'submitted', hechas: 'done' }[current];
  const all = app.data.tasks || [];
  const today = new Date().toLocaleDateString('en-CA');
  const week = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('en-CA');
  const list = all
    .filter((t) => t.status === status)
    .filter((t) => !kinds.size || kinds.has(t.expects || 'any'))
    .filter((t) => (PRIO_LEVEL[t.priority] ?? 1) >= prio)
    .filter((t) => (due === 'tarde' ? t.due_date && t.due_date < today : due === 'semana' ? t.due_date && t.due_date >= today && t.due_date <= week : due === 'sinfecha' ? !t.due_date : true))
    .sort((a, b) => (PRIO_LEVEL[b.priority] ?? 1) - (PRIO_LEVEL[a.priority] ?? 1) || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const count = (st) => all.filter((t) => t.status === st).length;
  const filtered = kinds.size || due !== 'todas' || prio > 0;
  const late = all.filter((t) => t.status === 'pending' && t.due_date && t.due_date < today).length;

  const submit = async (t) => {
    setBusy(t.id);
    try {
      await save('tasks', { id: t.id, status: 'submitted' });
      toast.success('Marcada como enviada', { description: 'El estudio la revisa y te avisa.' });
    } catch (err) {
      toast.danger('No se guardó', { description: err.message });
    } finally {
      setBusy('');
    }
  };
  const filters = <TaskFilters all={all} kinds={kinds} setKinds={setKinds} due={due} setDue={setDue} prio={prio} setPrio={setPrio} />;
  const subs = app.data.submissions || [];
  const loose = subs.filter((x) => !x.task_id);
  const dropSub = async (x) => {
    try {
      await app.backend.removeSubmission(x);
      removeLocal('submissions', x.id);
      refresh();
      toast.success('Envío borrado');
    } catch (err) {
      toast.danger('No se borró', { description: err.message });
    }
  };

  return (
    <div className="flex flex-col gap-5" data-v={v}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Peticiones</h1>
        <p className="text-sm text-muted">Lo que el estudio necesita de ti para avanzar.</p>
      </header>
      <Widget title="En resumen">
        <KpiGroup
          items={[
            { label: 'Por hacer', value: String(count('pending')), sub: late ? `${late} atrasadas` : 'Nada atrasado', tone: late ? 'var(--danger)' : undefined },
            { label: 'En revisión', value: String(count('submitted')), sub: 'El estudio las está mirando' },
            { label: 'Revisadas', value: String(count('done')), sub: 'Listas' },
            { label: 'Urgentes', value: String(all.filter((t) => t.status === 'pending' && t.priority === 'high').length), sub: 'Por hacer y con prisa' },
          ]}
        />
      </Widget>
      <Tabs selectedKey={current} onSelectionChange={(k) => go(`#/peticiones/${k}`)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Peticiones">
            {[
              ['pendientes', 'Por hacer', 'pending'],
              ['enviadas', 'En revisión', 'submitted'],
              ['hechas', 'Revisadas', 'done'],
            ].map(([k, label, st]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <span className="ms-1 text-xs text-muted">{count(st)}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
        {/* En el teléfono, los filtros se despliegan arriba; en pantallas anchas, a la derecha. */}
        <Disclosure className="rounded-2xl bg-surface-secondary p-3 md:hidden">
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center gap-2 text-sm font-medium">
              <Sliders className="size-4" />
              Filtros{filtered ? ' (activos)' : ''}
              <span className="flex-1" />
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-4">{filters}</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
        <div className="flex min-w-0 flex-col gap-3">
          {list.length === 0 ? (
            <Empty
              icon={Tray}
              title={filtered ? 'Nada con esos filtros' : current === 'pendientes' ? 'Nada pendiente' : 'Nada por aquí'}
              text={filtered ? 'Quita algún filtro para ver más.' : current === 'pendientes' ? 'Cuando necesitemos algo de ti, aparecerá aquí con su fecha.' : undefined}
            />
          ) : (
            list.map((t) => {
              const [when, lateCls] = t.due_date ? dueText(t.due_date) : ['Sin fecha', ''];
              const [phase, tone] = phaseOf(t);
              const sent = subs.filter((x) => x.task_id === t.id);
              const talk = commentsOf('task', t.id).length;
              return (
                <Card key={t.id} className="gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <Bubble name={EXPECTS[t.expects]?.[1] || 'inbox'} color={PRIORITY[t.priority]?.[1]} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* Por hacer y con fecha, la fecha ya lo dice; si no, su fase. */}
                        {(t.status !== 'pending' || !t.due_date) && (
                          <Chip size="sm" variant="soft" color={tone}>
                            {phase}
                          </Chip>
                        )}
                        <Chip size="sm" variant="soft" color={lateCls === 'is-late' ? 'danger' : lateCls === 'is-soon' ? 'warning' : 'default'}>
                          {when}
                        </Chip>
                        {t.priority === 'high' && (
                          <Chip size="sm" variant="soft" color="danger">
                            Urgente
                          </Chip>
                        )}
                        <Chip size="sm" variant="tertiary">
                          {EXPECTS[t.expects]?.[0] || 'Lo que tengas'}
                        </Chip>
                      </span>
                    </div>
                  </div>
                  {t.description && <p className="whitespace-pre-line text-sm text-muted">{t.description}</p>}
                  {t.client_note && <p className="rounded-2xl bg-surface-secondary px-3 py-2 text-sm">«{t.client_note}»</p>}
                  {sent.length > 0 && (
                    <div className="flex flex-col rounded-2xl bg-surface-secondary px-3 py-1">
                      <span className="pt-2 text-xs font-medium text-muted">Lo que enviaste</span>
                      <ul className="flex flex-col divide-y divide-border">
                        {sent.map((x) => (
                          <SentRow key={x.id} s={x} onRemove={!app.studio ? setDropping : null} />
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {t.status === 'pending' && can('tasks.submit') && t.expects !== 'none' && can('send') && (
                      <Button onPress={() => go(`#/enviar/${t.id}`)}>
                        <PaperPlane />
                        Entregar
                      </Button>
                    )}
                    {t.status === 'pending' && can('tasks.submit') && (
                      <Button variant={t.expects === 'none' ? 'primary' : 'secondary'} isPending={busy === t.id} onPress={() => submit(t)}>
                        <Check />
                        {t.expects === 'none' ? 'Hecho' : 'Ya lo envié'}
                      </Button>
                    )}
                    <Button variant="ghost" onPress={() => go(`#/hilo/task/${t.id}`)}>
                      <Comments />
                      {talk ? `Conversación · ${talk}` : 'Comentar'}
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
          {current !== 'hechas' && loose.length > 0 && (
            <Widget title="Lo que nos has enviado" description="Mensajes, enlaces y archivos sin petición">
              <ul className="flex flex-col divide-y divide-border">
                {loose.slice(0, 30).map((x) => (
                  <SentRow key={x.id} s={x} onRemove={!app.studio ? setDropping : null} />
                ))}
              </ul>
            </Widget>
          )}
        </div>
        <aside className="sticky top-24 hidden flex-col gap-4 rounded-3xl bg-surface-secondary p-4 md:flex" aria-label="Filtros">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sliders className="size-4" />
            Filtros
          </span>
          {filters}
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setKinds(new Set());
                setDue('todas');
                setPrio(0);
              }}
            >
              Quitar filtros
            </Button>
          )}
        </aside>
      </div>
      <ConfirmDialog open={Boolean(dropping)} title="¿Borrar este envío?" text="El estudio todavía no lo ha visto." confirm="Borrar" onConfirm={() => dropSub(dropping)} onClose={() => setDropping(null)} />
    </div>
  );
}
