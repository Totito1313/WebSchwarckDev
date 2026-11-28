// Modo estudio de la app nueva: los formularios con los que Schwarck crea y edita lo
// del portal de cada cliente (lo mismo que el modo estudio de /cliente/):
//   · post: anuncio, avance, hito, entrega o informe, con su fecha, fijado y aviso.
//   · work y report: una tarea del estudio, o el reporte del día entero (varias líneas,
//     también pegado de Nexus) con las notas del día.
//   · task: pedirle algo al cliente, con plantillas que valen para todos los portales.
//   · content: la ficha completa de una publicación (con plantillas); move la cambia de
//     día e importar trae de golpe el calendario que preparó Claude.
//   · resource, lead y metrics: recursos, leads y las cifras del mes.
//   · meeting y confirmMeeting: agendar o editar una reunión, o confirmar la que pidió.
// Cualquier pantalla abre uno con edit('tipo', props) y <Editores /> (en App.jsx) lo pinta.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Clock, Copy, File as FileIcon, Layers, Link as LinkIcon, Plus, Thunderbolt, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, Description, Disclosure, Input, Label, NumberField, ProgressBar, Tag, TagGroup, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { addDays, cap, dayDate, dayLabel, fDay, fMonth, fTime, hostOf, plural, safeUrl, todayKey } from '../../../portal/kit.js';
import { safeName } from '../../../portal/data.js';
import { claudeInstructions, isNexusReport, nexusSource, parseCalendar, parseNexusReport } from '../../../portal/importers.js';
import {
  CHANNEL,
  CONTENT_STATUS,
  EXPECTS,
  FORMAT,
  FUNNEL,
  MEETING_MODE,
  POST_KIND,
  PRIORITY,
  RESOURCE_KIND,
  STATUS_ORDER,
  WORK_STATUS,
  app,
  channelsOf,
  removeLocal,
  signPaths,
  upsertLocal,
  urlOf,
} from '../../../portal/state.js';
import { refresh } from '../store.js';
import { ConfirmDialog, DateInput, FormModal, SelectField } from '../../negocio/fields.jsx';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { FilePick } from '../screens/Enviar.jsx';
import { LeadModal } from '../screens/Crear.jsx';

/* ── Abrir un formulario desde cualquier pantalla ───────────────────────── */

let current = null;
let seq = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
/** edit('post', { post }), edit('content', { date }), edit('report')… */
export const edit = (kind, props = {}) => {
  current = { kind, props, key: ++seq };
  emit();
};
const shut = (key) => {
  if (current?.key !== key) return;
  current = null;
  emit();
};

/* ── Ayudas ─────────────────────────────────────────────────────────────── */

const txt = (v) => String(v ?? '').trim();
const orNull = (v) => txt(v) || null;
const cid = () => app.client.id;
const fail = (title, err) => {
  toast.danger(title, err?.message ? { description: err.message } : undefined);
  return false;
};
async function persist(table, row, prev) {
  const saved = await app.backend.save(table, prev?.id ? { ...row, id: prev.id } : { ...row, client_id: cid() });
  upsertLocal(table, saved);
  refresh();
  return saved;
}
async function uploadTo(folder, file, onProgress) {
  const path = `${cid()}/${folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
  await app.backend.upload(path, file, onProgress);
  return path;
}
async function drop(table, row, files = []) {
  await app.backend.remove(table, row.id);
  if (files.length) await app.backend.removeFiles(files).catch(() => {});
  removeLocal(table, row.id);
  refresh();
}
/** Fecha y hora para un <input type="datetime-local"> (en la hora de aquí). */
export const localInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

function Field({ label, value, onChange, placeholder, type, maxLength = 200, className = 'sm:col-span-2', autoFocus, description, inputMode }) {
  return (
    <TextField value={value} onChange={onChange} type={type} maxLength={maxLength} className={className} autoFocus={autoFocus}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} inputMode={inputMode} />
      {description && <Description>{description}</Description>}
    </TextField>
  );
}
function Area({ label, value, onChange, placeholder, rows = 3, maxLength = 5000, className = 'sm:col-span-2', description }) {
  return (
    <TextField value={value} onChange={onChange} maxLength={maxLength} className={className}>
      <Label>{label}</Label>
      <TextArea rows={rows} placeholder={placeholder} />
      {description && <Description>{description}</Description>}
    </TextField>
  );
}
/** Pocas opciones, una sola: botones pegados. */
function Seg({ label, value, onChange, options, className = 'sm:col-span-2' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <ToggleButtonGroup aria-label={label} selectionMode="single" disallowEmptySelection fullWidth size="sm" selectedKeys={new Set([String(value)])} onSelectionChange={(k) => onChange(String([...k][0]))}>
        {options.map(([k, text, color], i) => (
          <ToggleButton key={k} id={String(k)}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
            {text}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
/** Muchas opciones (una o varias): fichas que bajan de línea. */
function Chips({ label, value, onChange, options, multiple = false, allowEmpty = false, className = 'sm:col-span-2', description }) {
  const keys = new Set(multiple ? value : value ? [value] : []);
  return (
    <TagGroup
      aria-label={label}
      size="sm"
      selectionMode={multiple ? 'multiple' : 'single'}
      disallowEmptySelection={!multiple && !allowEmpty}
      selectedKeys={keys}
      onSelectionChange={(k) => onChange(multiple ? [...k].map(String) : String([...k][0] ?? ''))}
      className={className}
    >
      <Label>{label}</Label>
      <TagGroup.List className="flex-wrap">
        {options.map(([k, text, color]) => (
          <Tag key={k} id={k} textValue={text}>
            {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
            {text}
          </Tag>
        ))}
      </TagGroup.List>
      {description && <Description>{description}</Description>}
    </TagGroup>
  );
}
/** Un número que puede quedar vacío. */
function Num({ label, value, onChange, step = 1, min = 0, className = '', suffix }) {
  return (
    <NumberField className={className} value={Number.isFinite(value) ? value : NaN} onChange={(n) => onChange(Number.isFinite(n) ? n : null)} minValue={min} step={step} aria-label={label}>
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
      {suffix && <Description>{suffix}</Description>}
    </NumberField>
  );
}
function Notify({ value, onChange, description }) {
  return <SwitchField className="sm:col-span-2" isSelected={value} onChange={onChange} label="Avisar a su teléfono" description={description} />;
}
/** Borrar, con su confirmación, para el pie del formulario. */
function Borrar({ what, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger-soft" isIconOnly aria-label={`Borrar ${what}`} onPress={() => setOpen(true)}>
        <TrashBin />
      </Button>
      <ConfirmDialog
        open={open}
        title={`¿Borrar ${what}?`}
        text="Deja de verse en su portal. No se puede deshacer."
        confirm="Borrar"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          try {
            await onConfirm();
            toast('Borrado');
          } catch (err) {
            fail('No se borró', err);
          }
        }}
      />
    </>
  );
}
const Hint = ({ children }) => <p className="text-sm text-muted sm:col-span-2">{children}</p>;
const Section = ({ title }) => <h3 className="sw-eyebrow pt-2 sm:col-span-2">{title}</h3>;

/* ── Plantillas (peticiones y publicaciones, para todos los portales) ───── */

function useTemplates(kind) {
  const [list, setList] = useState([]);
  useEffect(() => {
    let live = true;
    app.backend
      .templates()
      .then((all) => live && setList(all.filter((x) => x.kind === kind)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kind]);
  return [list, setList];
}
function Templates({ kind, onPick }) {
  const [list, setList] = useTemplates(kind);
  const [dropping, setDropping] = useState(null);
  if (!list.length) return null;
  return (
    <>
      <TagGroup aria-label="Desde una plantilla" size="sm" selectionMode="single" selectedKeys={new Set()} onSelectionChange={(k) => onPick(list.find((x) => x.id === [...k][0])?.data)} onRemove={(k) => setDropping(list.find((x) => x.id === [...k][0]))} className="sm:col-span-2">
        <Label>Desde una plantilla</Label>
        <TagGroup.List className="flex-wrap">
          {list.map((x) => (
            <Tag key={x.id} id={x.id} textValue={x.name}>
              <Layers className="size-3.5" />
              {x.name}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
      <ConfirmDialog
        open={Boolean(dropping)}
        title={`¿Borrar la plantilla «${dropping?.name || ''}»?`}
        text="Deja de salir en todos los portales."
        confirm="Borrar"
        onClose={() => setDropping(null)}
        onConfirm={async () => {
          const x = dropping;
          try {
            await app.backend.removeTemplate(x.id);
            setList((l) => l.filter((y) => y.id !== x.id));
          } catch (err) {
            fail('No se borró', err);
          }
        }}
      />
    </>
  );
}
function SaveTemplate({ kind, name, collect }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      isPending={busy}
      onPress={async () => {
        const clean = txt(name).replace(/^(reel|post|carrusel|historia|v[ií]deo)\s*:\s*/i, '');
        if (!clean) return toast.danger('Ponle un título primero: será el nombre de la plantilla.');
        setBusy(true);
        try {
          await app.backend.saveTemplate({ kind, name: clean.slice(0, 120), data: collect() });
          toast.success(`Plantilla «${clean.slice(0, 40)}» guardada`, { description: 'Sale en todos los portales.' });
        } catch (err) {
          fail('No se guardó la plantilla', err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Layers />
      Guardar como plantilla
    </Button>
  );
}

/* ── Anuncios y avances ─────────────────────────────────────────────────── */

function PostModal({ post: p = null, onClose }) {
  const [kind, setKind] = useState(p?.kind || 'announcement');
  const [title, setTitle] = useState(p?.title || '');
  const [body, setBody] = useState(p?.body || '');
  const [link, setLink] = useState(p?.link || '');
  const [when, setWhen] = useState(localInput(p?.occurred_at));
  const [pinned, setPinned] = useState(Boolean(p?.pinned));
  const [notify, setNotify] = useState(!p);
  return (
    <FormModal
      title={p ? 'Editar publicación' : 'Publicar en su portal'}
      submit={p ? 'Guardar' : 'Publicar'}
      onClose={onClose}
      extra={p && <Borrar what="esta publicación" onConfirm={async () => (await drop('posts', p), onClose())} />}
      onSubmit={async () => {
        if (!txt(title)) return fail('Ponle un título.');
        if (txt(link) && !safeUrl(txt(link))) return fail('El enlace no vale', new Error('Tiene que empezar por https://'));
        try {
          await persist('posts', { kind, title: txt(title), body: orNull(body), link: safeUrl(txt(link)), pinned, notify, occurred_at: new Date(when || Date.now()).toISOString() }, p);
          toast.success(p ? 'Guardado' : notify ? 'Publicado y avisado' : 'Publicado');
          return true;
        } catch (err) {
          return fail('No se publicó', err);
        }
      }}
    >
      <Chips label="Tipo" value={kind} onChange={setKind} options={Object.entries(POST_KIND).map(([k, [l, , c]]) => [k, l, c])} />
      <Field label="Título" value={title} onChange={setTitle} placeholder="Arrancamos la campaña de noviembre" autoFocus />
      <Area label="Texto" value={body} onChange={setBody} rows={4} maxLength={20000} placeholder="Qué pasó, qué sigue, qué necesitas…" />
      <Field label="Enlace (opcional)" value={link} onChange={setLink} type="url" inputMode="url" maxLength={2000} placeholder="https://…" />
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Fecha</span>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Fecha" />
        <span className="text-xs text-muted">Su lugar en la cronología.</span>
      </label>
      <SwitchField className="sm:col-span-2" isSelected={pinned} onChange={setPinned} label="Fijar arriba de su Inicio" />
      <Notify value={notify} onChange={setNotify} />
    </FormModal>
  );
}

/* ── Trabajo del estudio y reporte del día ──────────────────────────────── */

const WORK_CATS = ['Diseño', 'Contenido', 'Vídeo', 'Redes', 'Fotografía', 'Comunidad', 'Análisis', 'Web', 'Publicidad', 'Reunión'];
const NEXT_STATUS = { done: 'doing', doing: 'planned', planned: 'done' };
const STATUS_ICON = { done: Check, doing: Thunderbolt, planned: Clock };

/** El círculo que cambia una tarea entre hecha, en curso y planificada. */
export function StatusDot({ status, onPress, label }) {
  const Icon = STATUS_ICON[status] || Check;
  const [word, color] = WORK_STATUS[status] || WORK_STATUS.done;
  return (
    <Button isIconOnly size="sm" variant="tertiary" aria-label={label || `${word}: toca para cambiar`} onPress={onPress} className="shrink-0 rounded-full" style={{ color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}>
      <Icon />
    </Button>
  );
}
/** Pasa una tarea al estado siguiente (hecha → en curso → planificada), al momento. */
export async function cycleWork(w) {
  try {
    await persist('work', { status: NEXT_STATUS[w.status] || 'done' }, w);
  } catch (err) {
    fail('No se cambió', err);
  }
}

function WorkModal({ work: w = null, onClose }) {
  const [title, setTitle] = useState(w?.title || '');
  const [status, setStatus] = useState(w?.status || 'done');
  const [day, setDay] = useState(w?.day || todayKey());
  const [minutes, setMinutes] = useState(w?.minutes ?? null);
  const [category, setCategory] = useState(w?.category || '');
  const [description, setDescription] = useState(w?.description || '');
  const [link, setLink] = useState(w?.link || '');
  const [notify, setNotify] = useState(!w);
  const cats = useMemo(() => [...new Set([...WORK_CATS, ...app.data.work.map((x) => x.category).filter(Boolean)])], []);
  return (
    <FormModal
      title={w ? 'Editar trabajo' : 'Nuevo trabajo'}
      onClose={onClose}
      extra={w && <Borrar what="este trabajo" onConfirm={async () => (await drop('work', w), onClose())} />}
      onSubmit={async () => {
        if (!txt(title)) return fail('¿Qué hiciste?');
        try {
          await persist('work', { title: txt(title), status, day: day || todayKey(), minutes: minutes || null, category: category || null, description: orNull(description), link: safeUrl(txt(link)), notify }, w);
          toast.success(w ? 'Guardado' : 'Añadido al reporte');
          return true;
        } catch (err) {
          return fail('No se guardó', err);
        }
      }}
    >
      <Field label="Qué" value={title} onChange={setTitle} placeholder="Diseñar la plantilla de historias" autoFocus />
      <Seg label="Estado" value={status} onChange={setStatus} options={['done', 'doing', 'planned'].map((k) => [k, WORK_STATUS[k][0], WORK_STATUS[k][1]])} />
      <DateInput label="Día" value={day} onChange={setDay} />
      <Num label="Tiempo (min)" value={minutes} onChange={setMinutes} step={15} />
      <Chips label="Categoría" value={category} onChange={setCategory} allowEmpty options={cats.map((c) => [c, c])} />
      <Area label="Detalles (opcional)" value={description} onChange={setDescription} rows={2} />
      <Field label="Enlace (opcional)" value={link} onChange={setLink} type="url" inputMode="url" maxLength={2000} placeholder="https://…" />
      <Notify value={notify} onChange={setNotify} description="Un solo aviso por día, que se va actualizando." />
    </FormModal>
  );
}

let lineSeq = 0;
const newLine = (title = '', status = 'done', minutes = null, source = null) => ({ id: ++lineSeq, title, status, minutes, source });

/** Leer el reporte diario de Nexus (copiado al portapapeles o pegado). */
function fromNexus(raw) {
  const r = parseNexusReport(raw);
  if (!r.done.length && !r.doing.length && !r.blockers && !r.notes) return null;
  const day = r.day || todayKey();
  return {
    day,
    lines: [...r.done.map((t) => newLine(t, 'done', null, nexusSource(day, t))), ...r.doing.map((t) => newLine(t, 'doing', null, nexusSource(day, t)))],
    meta: r,
  };
}

/** El reporte del día: varias líneas de golpe, cada una con su estado y su tiempo, y las notas. */
function ReportModal({ nexus = null, onClose }) {
  const [day, setDay] = useState(nexus?.day || todayKey());
  const [lines, setLines] = useState(() => (nexus?.lines?.length ? nexus.lines : [newLine()]));
  const [meta, setMeta] = useState(nexus?.meta || null);
  const prev = (app.data.reports || []).find((r) => r.day === day);
  const [author, setAuthor] = useState(nexus?.meta?.author || prev?.author || '');
  const [blockers, setBlockers] = useState(nexus?.meta?.blockers || prev?.blockers || '');
  const [notes, setNotes] = useState(nexus?.meta?.notes || prev?.notes || '');
  const [notify, setNotify] = useState(true);
  const [pasting, setPasting] = useState(false);
  const [raw, setRaw] = useState('');
  const [, bump] = useState(0);
  const existing = app.data.work.filter((w) => w.day === day);
  const set = (id, patch) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const take = (text) => {
    const r = isNexusReport(text) ? fromNexus(text) : null;
    if (!r) return toast.danger('No parece el reporte de Nexus', { description: 'Tiene que traer «Tareas realizadas».' });
    setDay(r.day);
    setLines(r.lines.length ? r.lines : [newLine()]);
    setMeta(r.meta);
    if (r.meta.author) setAuthor(r.meta.author);
    if (r.meta.blockers) setBlockers(r.meta.blockers);
    if (r.meta.notes) setNotes(r.meta.notes);
    setPasting(false);
    toast.success(`${plural(r.lines.length, 'tarea leída', 'tareas leídas')} del reporte`, { description: 'Revísalas y publica.' });
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (isNexusReport(text)) return take(text);
    } catch {
      // sin permiso: se pega a mano
    }
    setPasting(true);
  };

  return (
    <FormModal
      title={meta ? 'Reporte de Nexus' : 'Reporte del día'}
      submit="Publicar"
      size="sm:max-w-[640px]"
      onClose={onClose}
      onSubmit={async () => {
        const items = lines.filter((l) => txt(l.title)).map((l) => ({ ...l, source: l.source || (meta ? nexusSource(day, txt(l.title)) : null) }));
        const fresh = items.filter((l) => !l.source || !app.data.work.some((w) => w.source === l.source));
        const notesText = { author: orNull(author), blockers: orNull(blockers), notes: orNull(notes) };
        const hasNotes = Object.values(notesText).some(Boolean);
        if (!items.length && !hasNotes) return fail('Escribe al menos una línea.');
        try {
          const saved = fresh.length ? await app.backend.saveMany('work', fresh.map((l) => ({ client_id: cid(), title: txt(l.title), status: l.status, minutes: l.minutes || null, day, notify, source: l.source || null }))) : [];
          for (const w of saved) upsertLocal('work', w);
          if (hasNotes || meta) {
            const report = await app.backend.saveReport({ client_id: cid(), day, ...notesText, sent_at: meta?.sentAt || prev?.sent_at || new Date().toTimeString().slice(0, 5), source: meta ? 'nexus' : prev?.source || 'app' });
            app.data.reports = [report, ...(app.data.reports || []).filter((r) => r.day !== day)];
          }
          refresh();
          const repeated = items.length - fresh.length;
          toast.success(`${plural(saved.length, 'línea', 'líneas')} en el reporte`, repeated ? { description: `${plural(repeated, 'ya estaba', 'ya estaban')}.` } : undefined);
          return true;
        } catch (err) {
          return fail('No se publicó', err);
        }
      }}
    >
      <Hint>{meta ? `Leído del reporte${meta.author ? ` de ${meta.author}` : ''}. Revisa y publica: cada tarea queda como una línea.` : 'Cada línea es algo que hiciste. Toca el círculo para marcarla como hecha, en curso o planificada.'}</Hint>
      <DateInput label="Día" value={day} onChange={(d) => setDay(d || todayKey())} className="sm:col-span-2" />
      {existing.length > 0 && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="sw-eyebrow">{day === todayKey() ? 'Ya en el reporte de hoy' : `Ya en el reporte del ${dayLabel(day).toLowerCase()}`}</span>
          <ul className="flex flex-col gap-1">
            {existing.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-2 py-1.5 text-sm">
                <StatusDot status={w.status} onPress={() => cycleWork(w).then(() => bump((n) => n + 1))} />
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-2 sm:col-span-2" aria-label="Líneas nuevas">
        {lines.map((l, i) => (
          <li key={l.id} className="flex items-end gap-2">
            <span className="pb-1">
              <StatusDot status={l.status} onPress={() => set(l.id, { status: NEXT_STATUS[l.status] })} label={`Línea ${i + 1}: ${WORK_STATUS[l.status][0]}`} />
            </span>
            <TextField aria-label={`Línea ${i + 1}`} value={l.title} onChange={(v) => set(l.id, { title: v })} maxLength={200} className="min-w-0 flex-1" autoFocus={i === lines.length - 1 && !l.title && i > 0}>
              <Input placeholder="Qué hiciste" />
            </TextField>
            <NumberField aria-label={`Minutos de la línea ${i + 1}`} value={Number.isFinite(l.minutes) ? l.minutes : NaN} onChange={(n) => set(l.id, { minutes: Number.isFinite(n) ? n : null })} minValue={0} step={15} className="w-24 shrink-0">
              <NumberField.Group>
                <NumberField.Input placeholder="min" />
              </NumberField.Group>
            </NumberField>
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar la línea ${i + 1}`} onPress={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.id !== l.id) : [newLine()]))}>
              <Xmark />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" variant="secondary" onPress={() => setLines((ls) => [...ls, newLine()])}>
          <Plus />
          Otra línea
        </Button>
        <Button size="sm" variant="ghost" onPress={paste}>
          <Copy />
          Pegar de Nexus
        </Button>
      </div>
      {pasting && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3 sm:col-span-2">
          <TextField value={raw} onChange={setRaw} maxLength={20000} autoFocus>
            <Label>Pega aquí el reporte de Nexus</Label>
            <TextArea rows={6} placeholder="📋 REPORTE DIARIO DE ACTIVIDADES…" />
          </TextField>
          <div className="flex gap-2">
            <Button size="sm" onPress={() => take(raw)}>
              Leer
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => setPasting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <Disclosure className="sm:col-span-2" defaultExpanded={Boolean(author || blockers || notes)}>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex items-center gap-1 text-sm font-medium">
            Notas del día
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="flex flex-col gap-3 pt-3">
            <Field label="Quién lo manda" value={author} onChange={setAuthor} maxLength={120} placeholder="Opcional" className="" />
            <Area label="Dificultades o bloqueos" value={blockers} onChange={setBlockers} rows={2} maxLength={4000} className="" />
            <Area label="Observaciones o sugerencias" value={notes} onChange={setNotes} rows={2} maxLength={4000} className="" description="El cliente las ve debajo del reporte de ese día." />
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      <Notify value={notify} onChange={setNotify} description="Un solo aviso con lo hecho ese día." />
    </FormModal>
  );
}

/** Pegar el reporte de Nexus: si está en el portapapeles se lee solo; si no, se pega a mano. */
export async function pasteNexus() {
  try {
    const text = await navigator.clipboard.readText();
    if (isNexusReport(text)) {
      const r = fromNexus(text);
      if (r) return edit('report', { nexus: r });
    }
  } catch {
    // sin permiso para leer: el formulario lo deja pegar
  }
  edit('report');
}

/* ── Peticiones al cliente ──────────────────────────────────────────────── */

function TaskModal({ task: t = null, template = null, onClose }) {
  const base = t || template || {};
  const [title, setTitle] = useState(base.title || '');
  const [description, setDescription] = useState(base.description || '');
  const [due, setDue] = useState(t ? t.due_date || '' : addDays(todayKey(), 3));
  const [expects, setExpects] = useState(base.expects || 'file');
  const [priority, setPriority] = useState(base.priority || 'normal');
  const [status, setStatus] = useState(t?.status || 'pending');
  const [notify, setNotify] = useState(!t);
  const collect = () => ({ title: txt(title), description: orNull(description), expects, priority });
  return (
    <FormModal
      title={t ? 'Editar petición' : 'Pedirle algo al cliente'}
      submit={t ? 'Guardar' : 'Pedir'}
      onClose={onClose}
      extra={
        <>
          {t && <Borrar what="esta petición" onConfirm={async () => (await drop('tasks', t), onClose())} />}
          {t && (
            <Button variant="ghost" onPress={() => edit('task', { template: { ...collect(), title: `${txt(title)} (copia)`.slice(0, 200) } })}>
              <Copy />
              Duplicar
            </Button>
          )}
          <SaveTemplate kind="task" name={title} collect={collect} />
        </>
      }
      onSubmit={async () => {
        if (!txt(title)) return fail('¿Qué necesitas?');
        const row = { ...collect(), due_date: due || null, notify };
        if (!t) row.status = 'pending';
        if (t) Object.assign(row, { status, done_at: status === 'done' ? t.done_at || new Date().toISOString() : null, submitted_at: status === 'pending' ? null : t.submitted_at || new Date().toISOString() });
        try {
          await persist('tasks', row, t);
          toast.success(t ? 'Guardado' : notify ? 'Pedido y avisado' : 'Pedido');
          return true;
        } catch (err) {
          return fail('No se guardó', err);
        }
      }}
    >
      {!t && !template && <Templates kind="task" onPick={(data) => data && edit('task', { template: data })} />}
      <Field label="Qué necesitas" value={title} onChange={setTitle} placeholder="Mándanos el logo en vectorial" autoFocus />
      <Area label="Detalles" value={description} onChange={setDescription} placeholder="Qué necesitas exactamente, formato, ejemplos…" />
      <DateInput label="Para cuándo" value={due} onChange={setDue} />
      <SelectField label="Cómo te lo manda" value={expects} onChange={(v) => setExpects(v || 'any')} options={Object.entries(EXPECTS).map(([k, [l]]) => [k, l])} />
      <Seg label="Prioridad" value={priority} onChange={setPriority} options={Object.entries(PRIORITY).map(([k, [l, c]]) => [k, l, c])} />
      {t && (
        <Seg
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            ['pending', 'Por hacer'],
            ['submitted', 'Enviada'],
            ['done', 'Revisada'],
          ]}
        />
      )}
      <Notify value={notify} onChange={setNotify} description="Y un recordatorio la mañana en que vence." />
    </FormModal>
  );
}

/** «Dar por buena» una petición que el cliente ya entregó. */
export async function approveTask(t) {
  try {
    await persist('tasks', { status: 'done', done_at: new Date().toISOString() }, t);
    toast.success('Revisada', { description: 'Le avisamos.' });
  } catch (err) {
    fail('No se guardó', err);
  }
}

/* ── Calendario de contenido: la ficha completa ─────────────────────────── */

// Qué se prepara en cada formato: un estático no tiene guion ni duración.
const PRODUCTION = {
  post: ['design', 'Diseño', 'Arte final e inspiración'],
  carrusel: ['slides', 'Diapositivas', 'Arte final e inspiración'],
  historia: ['frames', 'Pantallas', 'Arte final e inspiración'],
  reel: ['video', 'Grabación', 'Material y referencias'],
  video: ['video', 'Grabación', 'Material y referencias'],
  articulo: ['article', 'El texto', 'Imágenes y fuentes'],
  otro: ['notes', 'Producción', 'Material y referencias'],
};

/** Una lista que crece: el texto de cada diapositiva o de cada pantalla. */
function ListEditor({ label, items, onChange }) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-sm font-medium">{label}</span>
      {items.map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs tabular-nums">{i + 1}</span>
          <TextField aria-label={`${label} ${i + 1}`} value={v} onChange={(x) => onChange(items.map((y, j) => (j === i ? x : y)))} maxLength={1000} className="min-w-0 flex-1">
            <TextArea rows={2} />
          </TextField>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${i + 1}`} onPress={() => onChange(items.filter((_, j) => j !== i))}>
            <Xmark />
          </Button>
        </div>
      ))}
      {items.length < 20 && (
        <Button size="sm" variant="secondary" className="self-start" onPress={() => onChange([...items, ''])}>
          <Plus />
          Añadir
        </Button>
      )}
    </div>
  );
}

function Assets({ assets, setAssets, files, setFiles, progress }) {
  const input = useRef(null);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-sm font-medium">Imágenes y vídeos</span>
      {(assets.length > 0 || files.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {assets.map((a, i) => (
            <div key={a.path || a.url || i} className="relative size-20 overflow-hidden rounded-2xl bg-surface-secondary">
              {a.kind !== 'video' && urlOf(a.path || a.url) ? <img src={urlOf(a.path || a.url)} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-xs text-muted">{a.kind === 'video' ? 'Vídeo' : 'Imagen'}</span>}
              <Button isIconOnly size="sm" variant="secondary" aria-label="Quitar" className="absolute end-1 top-1 size-6 min-w-6 rounded-full" onPress={() => setAssets(assets.filter((_, j) => j !== i))}>
                <Xmark className="size-3" />
              </Button>
            </div>
          ))}
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative flex size-20 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl bg-accent/10 p-1 text-center">
              <FileIcon className="size-4 text-accent" />
              <span className="line-clamp-2 text-[10px]">{f.name}</span>
              <Button isIconOnly size="sm" variant="secondary" aria-label={`Quitar ${f.name}`} className="absolute end-1 top-1 size-6 min-w-6 rounded-full" onPress={() => setFiles(files.filter((_, j) => j !== i))}>
                <Xmark className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const picked = [...(e.target.files || [])].filter((f) => {
            if (f.size <= 50 * 1048576) return true;
            toast.danger(`«${f.name}» pesa más de 50 MB`);
            return false;
          });
          setFiles([...files, ...picked]);
          e.target.value = '';
        }}
      />
      <Button size="sm" variant="secondary" className="self-start" onPress={() => input.current?.click()}>
        <Plus />
        Añadir imágenes o vídeos
      </Button>
      {progress != null && (
        <ProgressBar aria-label="Subiendo" value={Math.round(progress * 100)} size="sm">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}
    </div>
  );
}

function ContentModal({ content: c = null, date: preDate, template = null, onClose }) {
  const base = c || template || {};
  const prod0 = base.production || {};
  const [title, setTitle] = useState(base.title || '');
  const [date, setDate] = useState(c?.date || preDate || addDays(todayKey(), 1));
  const [time, setTime] = useState(c?.time?.slice(0, 5) || base.time?.slice?.(0, 5) || '18:00');
  const [channels, setChannels] = useState(c || template?.channels?.length || template?.channel ? [...channelsOf(base)] : ['instagram']);
  const [format, setFormat] = useState(base.format || 'reel');
  const [status, setStatus] = useState(c?.status || 'review');
  const [funnel, setFunnel] = useState(base.funnel || '');
  const [pillar, setPillar] = useState(base.pillar || '');
  const [objective, setObjective] = useState(base.objective || '');
  const [cta, setCta] = useState(base.cta || '');
  const [campaign, setCampaign] = useState(base.campaign || '');
  const [caption, setCaption] = useState(base.caption || '');
  const [hashtags, setHashtags] = useState(base.hashtags || '');
  const [script, setScript] = useState(base.script || '');
  const [duration, setDuration] = useState(base.duration || '');
  const [notes, setNotes] = useState(base.notes || '');
  const [headline, setHeadline] = useState(prod0.headline || '');
  const [designNotes, setDesignNotes] = useState(prod0.design_notes || '');
  const [slides, setSlides] = useState(prod0.slides || []);
  const [frames, setFrames] = useState(prod0.frames || []);
  const [outline, setOutline] = useState(prod0.outline || '');
  const [keyword, setKeyword] = useState(prod0.keyword || '');
  const [refs, setRefs] = useState(base.refs || []);
  const [refUrl, setRefUrl] = useState('');
  const [link, setLink] = useState(c?.link || '');
  const [assets, setAssets] = useState(c?.assets || []);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [notify, setNotify] = useState(!c);
  const [kind, heading, material] = PRODUCTION[format] || PRODUCTION.otro;
  const pillars = useMemo(() => [...new Set(app.data.content.map((x) => x.pillar).filter(Boolean))], []);

  const production = () => {
    const out = {};
    const put = (k, v) => {
      if (v && !(Array.isArray(v) && !v.length)) out[k] = v;
    };
    put('headline', txt(headline));
    put('design_notes', txt(designNotes));
    put('slides', slides.map(txt).filter(Boolean));
    put('frames', frames.map(txt).filter(Boolean));
    put('outline', txt(outline));
    put('keyword', txt(keyword));
    return out;
  };
  const collect = () => ({
    title: txt(title),
    channels,
    channel: channels[0],
    format,
    funnel: funnel || null,
    pillar: orNull(pillar),
    objective: orNull(objective),
    cta: orNull(cta),
    campaign: orNull(campaign),
    caption: orNull(caption),
    hashtags: orNull(hashtags),
    script: orNull(script),
    duration: orNull(duration),
    notes: orNull(notes),
    refs,
    production: production(),
  });

  return (
    <FormModal
      title={c ? 'Editar publicación' : 'Nueva publicación'}
      size="sm:max-w-[720px]"
      onClose={onClose}
      extra={
        <>
          {c && <Borrar what="esta publicación del calendario" onConfirm={async () => (await drop('content', c), onClose(), location.hash.includes(c.id) && location.replace('#/marketing'))} />}
          <SaveTemplate
            kind="content"
            name={title}
            collect={() => {
              const { channel, ...data } = collect();
              return data;
            }}
          />
        </>
      }
      onSubmit={async () => {
        if (!txt(title)) return fail('Ponle un título.');
        if (!date) return fail('Elige el día.');
        if (!channels.length) return fail('Elige al menos una red.');
        try {
          const all = [...assets];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            setProgress(i / files.length);
            const path = await uploadTo('contenido', f, (p) => setProgress((i + p) / files.length));
            all.push({ path, kind: f.type.startsWith('video/') ? 'video' : 'image', name: f.name });
          }
          setProgress(null);
          await signPaths(all.map((a) => a.path).filter(Boolean));
          const row = { ...collect(), date, time: time || null, status, link: safeUrl(txt(link)), assets: all, image_url: all.find((a) => a.kind === 'image')?.path || c?.image_url || null, notify };
          // Volver a pedir revisión borra la respuesta anterior del cliente.
          if (c && status === 'review' && c.status !== 'review') Object.assign(row, { client_verdict: null, client_note: null, client_verdict_at: null });
          await persist('content', row, c);
          app.data.content.sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
          toast.success(c ? 'Guardado' : 'Añadida al calendario');
          return true;
        } catch (err) {
          setProgress(null);
          return fail('No se guardó', err);
        }
      }}
    >
      {!c && !template && <Templates kind="content" onPick={(data) => data && edit('content', { template: data, date })} />}
      {c?.origin === 'client' && <Hint>La propuso el cliente. Pásala a «En producción» o «Para revisar» cuando la tomes.</Hint>}
      <Section title="Lo básico" />
      <Field label="Título" value={title} onChange={setTitle} placeholder="Reel: así tostamos el café" autoFocus />
      <DateInput label="Día" value={date} onChange={setDate} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Hora</span>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora" />
      </label>
      <Chips label="Redes" value={channels} onChange={setChannels} multiple options={Object.entries(CHANNEL).filter(([k]) => k !== 'google').map(([k, [l, color]]) => [k, l, color])} description="Todas las redes donde sale la misma pieza." />
      <Chips label="Formato" value={format} onChange={setFormat} options={Object.entries(FORMAT)} />
      <Chips label="Estado" value={status} onChange={setStatus} options={STATUS_ORDER.map((k) => [k, CONTENT_STATUS[k][0], CONTENT_STATUS[k][1]])} description="En «Para revisar» el cliente puede aprobarla, pedir cambios o rechazarla." />

      <Section title="Estrategia" />
      <Chips label="Embudo" value={funnel} onChange={setFunnel} allowEmpty options={Object.entries(FUNNEL).map(([k, [l, color]]) => [k, l, color])} />
      <Field label="Pilar" value={pillar} onChange={setPillar} maxLength={80} placeholder={pillars.slice(0, 3).join(', ') || 'Proceso, Educación, Promociones…'} className="" />
      <Field label="Campaña" value={campaign} onChange={setCampaign} maxLength={120} placeholder="Noviembre, Lanzamiento…" className="" />
      <Area label="Objetivo" value={objective} onChange={setObjective} rows={2} maxLength={500} placeholder="Para qué sirve esta pieza" />
      <Field label="Llamada a la acción" value={cta} onChange={setCta} placeholder="Escríbenos por WhatsApp" />

      <Section title="Texto" />
      <Area label="Copy" value={caption} onChange={setCaption} rows={4} maxLength={2200} placeholder="El texto que acompaña la publicación" description={`${caption.length}/2200`} />
      <Field label="Hashtags" value={hashtags} onChange={setHashtags} maxLength={1000} placeholder="#cafedeespecialidad #caracas" />

      <Section title={heading} />
      {kind === 'design' && <Field label="Texto en la pieza" value={headline} onChange={setHeadline} maxLength={500} placeholder="El texto grande de la pieza" />}
      {kind === 'slides' && <ListEditor label="Diapositiva" items={slides} onChange={setSlides} />}
      {kind === 'frames' && <ListEditor label="Pantalla" items={frames} onChange={setFrames} />}
      {['design', 'slides', 'frames'].includes(kind) && <Area label="Indicaciones de diseño" value={designNotes} onChange={setDesignNotes} maxLength={3000} placeholder="Foto o fondo, colores, composición, logo…" />}
      {kind === 'video' && (
        <>
          <Area label="Guion" value={script} onChange={setScript} rows={4} maxLength={8000} placeholder={'0–3 s: …\n3–8 s: …'} />
          <Field label="Duración" value={duration} onChange={setDuration} maxLength={40} placeholder="20 s" className="" />
        </>
      )}
      {kind === 'article' && (
        <>
          <Area label="Esquema" value={outline} onChange={setOutline} rows={4} placeholder="Introducción, puntos, cierre…" />
          <Field label="Palabra clave" value={keyword} onChange={setKeyword} maxLength={100} placeholder="café de especialidad en Caracas" />
        </>
      )}
      {['video', 'notes'].includes(kind) && <Area label={kind === 'video' ? 'Notas de grabación' : 'Notas'} value={notes} onChange={setNotes} rows={2} placeholder="Lugar, música, tono, lo que deba saber el cliente…" />}

      <Section title={material} />
      <Assets assets={assets} setAssets={setAssets} files={files} setFiles={setFiles} progress={progress} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium">Referencias</span>
        {refs.map((r, i) => (
          <span key={`${r.url}-${i}`} className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-1.5 text-sm">
            <LinkIcon className="size-3.5 text-muted" />
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
              {r.label || hostOf(r.url)}
            </a>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar la referencia" onPress={() => setRefs(refs.filter((_, j) => j !== i))}>
              <Xmark />
            </Button>
          </span>
        ))}
        <div className="flex gap-2">
          <TextField aria-label="Una referencia" value={refUrl} onChange={setRefUrl} type="url" className="min-w-0 flex-1">
            <Input inputMode="url" placeholder="https://… una referencia" />
          </TextField>
          <Button
            variant="secondary"
            onPress={() => {
              const u = safeUrl(txt(refUrl));
              if (!u) return toast.danger('Pega un enlace que empiece por https://');
              setRefs([...refs, { url: u, label: hostOf(u) }]);
              setRefUrl('');
            }}
          >
            <Plus />
            Añadir
          </Button>
        </div>
      </div>
      <Field label="Enlace a la pieza" value={link} onChange={setLink} type="url" inputMode="url" maxLength={2000} placeholder="https://… (en Drive o Canva)" />
      <Notify value={notify} onChange={setNotify} description="Si está «Para revisar», le pide que la apruebe." />
    </FormModal>
  );
}

/** Cambiar el estado de una publicación al momento (al mandarla a revisar o publicarla, avisa). */
export async function setContentStatus(c, status) {
  const patch = { status, ...(status === 'review' || status === 'published' ? { notify: true } : {}) };
  if (status === 'review') Object.assign(patch, { client_verdict: null, client_note: null, client_verdict_at: null });
  try {
    await persist('content', patch, c);
    toast.success(`Ahora: ${CONTENT_STATUS[status][0].toLowerCase()}`);
  } catch (err) {
    fail('No se cambió', err);
  }
}

/** Una copia como idea, sin los archivos, para repetir una pieza que funcionó. */
export async function duplicateContent(c) {
  const { id, created_at, updated_at, client_verdict, client_note, client_verdict_at, client_verdict_by, client_verdict_name, created_by, origin, image_url, assets, ...rest } = c;
  try {
    const saved = await persist('content', { ...rest, title: `${c.title} (copia)`.slice(0, 200), status: 'idea', notify: false, assets: [], image_url: null });
    toast.success('Duplicada como idea', { description: 'Sin los archivos.' });
    edit('content', { content: saved });
  } catch (err) {
    fail('No se duplicó', err);
  }
}

function MoveModal({ content: c, onClose }) {
  const [day, setDay] = useState(c.date);
  const quick = [
    ['Mañana', 1],
    ['En 3 días', 3],
    ['1 semana', 7],
    ['2 semanas', 14],
  ];
  return (
    <FormModal
      title="Mover de día"
      submit="Mover"
      onClose={onClose}
      onSubmit={async () => {
        if (!day || day === c.date) return true;
        try {
          await persist('content', { date: day }, c);
          toast.success(`Movida al ${fDay.format(dayDate(day))}`);
          return true;
        } catch (err) {
          return fail('No se movió', err);
        }
      }}
    >
      <Hint>
        «{c.title}» sale {dayLabel(c.date).toLowerCase()}.
      </Hint>
      <DateInput label="Nuevo día" value={day} onChange={setDay} className="sm:col-span-2" />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {quick.map(([label, n]) => (
          <Button key={n} size="sm" variant="secondary" onPress={() => setDay(addDays(todayKey(), n))}>
            {label}
          </Button>
        ))}
      </div>
    </FormModal>
  );
}

/** Pegar el calendario que preparó Claude: entran como «Idea» y el cliente no los ve aún. */
function ImportModal({ onClose }) {
  const [raw, setRaw] = useState('');
  const parsed = useMemo(() => {
    if (!txt(raw)) return null;
    try {
      return parseCalendar(raw);
    } catch (err) {
      return { error: err.message };
    }
  }, [raw]);
  const rows = parsed?.rows || [];
  const dates = rows.map((r) => r.date).sort();
  return (
    <FormModal
      title="Importar calendario de Claude"
      submit={rows.length ? `Importar ${plural(rows.length, 'publicación', 'publicaciones')}` : 'Importar'}
      size="sm:max-w-[640px]"
      onClose={onClose}
      extra={
        <Button
          variant="ghost"
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(claudeInstructions(app.client.name));
              toast.success('Instrucciones copiadas', { description: 'Pégalas en Claude.' });
            } catch {
              toast.danger('No se pudo copiar');
            }
          }}
        >
          <Copy />
          Instrucciones para Claude
        </Button>
      }
      onSubmit={async () => {
        if (!rows.length) return fail('Pega primero el bloque de Claude.');
        try {
          const saved = await app.backend.saveMany('content', rows.map((r) => ({ ...r, client_id: cid() })));
          for (const x of saved) upsertLocal('content', x);
          app.data.content.sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
          refresh();
          toast.success(`${plural(saved.length, 'publicación', 'publicaciones')} en el calendario`, { description: 'Como idea: el cliente no las ve hasta que las mandes a revisar.' });
          return true;
        } catch (err) {
          return fail('No se importó', err);
        }
      }}
    >
      <Hint>Pega el bloque que te dio Claude. Entran como «Idea» en el calendario de {app.client.name} y el cliente no se entera hasta que las mandes a revisar.</Hint>
      <TextField value={raw} onChange={setRaw} maxLength={400000} className="sm:col-span-2" autoFocus>
        <Label>El bloque de Claude</Label>
        <TextArea rows={7} placeholder='[ { "titulo": … } ]' className="font-mono text-xs" />
      </TextField>
      {parsed?.error && <p className="text-sm text-danger sm:col-span-2">{parsed.error}</p>}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3 sm:col-span-2">
          <span className="text-sm font-medium">
            {plural(rows.length, 'publicación', 'publicaciones')} · del {fDay.format(dayDate(dates[0]))} al {fDay.format(dayDate(dates.at(-1)))}
          </span>
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
            {rows.slice(0, 60).map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
                  {r.date.slice(8)}/{r.date.slice(5, 7)}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 text-xs text-muted">{FORMAT[r.format]}</span>
              </li>
            ))}
          </ul>
          {parsed.errors?.length > 0 && <p className="text-xs text-danger">{plural(parsed.errors.length, 'no se puede cargar', 'no se pueden cargar')}: {parsed.errors.slice(0, 3).join(' · ')}</p>}
        </div>
      )}
    </FormModal>
  );
}

/* ── Recursos ───────────────────────────────────────────────────────────── */

function ResourceModal({ resource: r = null, onClose }) {
  const [mode, setMode] = useState(r?.storage_path ? 'file' : 'link');
  const [url, setUrl] = useState(r?.url || '');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [title, setTitle] = useState(r?.title || '');
  const [kind, setKind] = useState(r?.kind || 'link');
  const [category, setCategory] = useState(r?.category || '');
  const [description, setDescription] = useState(r?.description || '');
  const [notify, setNotify] = useState(!r);
  const cats = useMemo(() => [...new Set(['Marca', 'Guías', 'Diseño', 'Fotos', 'Vídeos', 'Accesos', ...app.data.resources.map((x) => x.category).filter(Boolean)])], []);
  return (
    <FormModal
      title={r ? 'Editar recurso' : 'Nuevo recurso'}
      onClose={onClose}
      extra={r && <Borrar what={`«${r.title}»`} onConfirm={async () => (await drop('resources', r, r.storage_path ? [r.storage_path] : []), onClose())} />}
      onSubmit={async () => {
        const row = { title: txt(title), kind, category: category || null, description: orNull(description), notify };
        try {
          if (mode === 'link') {
            row.url = safeUrl(txt(url));
            if (!row.url) throw new Error('Pega un enlace que empiece por https://');
            row.title ||= hostOf(row.url);
          } else if (!r) {
            if (!file) throw new Error('Elige un archivo.');
            setProgress(0);
            const path = await uploadTo('recursos', file, setProgress);
            Object.assign(row, { storage_path: path, file_name: file.name, size: file.size, mime: file.type || null });
            row.title ||= file.name.replace(/\.[^.]+$/, '');
            if (kind === 'link') row.kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'doc' : 'file';
          }
          if (!row.title) throw new Error('Ponle un título.');
          await persist('resources', row, r);
          toast.success(r ? 'Guardado' : 'Recurso añadido');
          return true;
        } catch (err) {
          setProgress(null);
          return fail('No se guardó', err);
        }
      }}
    >
      {!r && (
        <Seg
          label="Qué añades"
          value={mode}
          onChange={setMode}
          options={[
            ['link', 'Enlace'],
            ['file', 'Archivo'],
          ]}
        />
      )}
      {mode === 'link' ? (
        <Field
          label="Enlace"
          value={url}
          onChange={(v) => {
            setUrl(v);
            if (/youtu|vimeo|loom/.test(v)) setKind('video');
            else if (/\.pdf($|\?)|docs\.google/.test(v)) setKind('doc');
          }}
          type="url"
          inputMode="url"
          maxLength={2000}
          placeholder="https://…"
        />
      ) : r?.storage_path ? (
        <Hint>Archivo: {r.file_name || 'subido'}</Hint>
      ) : (
        <div className="sm:col-span-2">
          <FilePick file={file} onFile={setFile} progress={progress} hint="Hasta 50 MB" />
        </div>
      )}
      <Field label="Título" value={title} onChange={setTitle} placeholder="Manual de marca" />
      <Chips label="Tipo" value={kind} onChange={setKind} options={Object.entries(RESOURCE_KIND).map(([k, [l, , color]]) => [k, l, color])} />
      <Chips label="Categoría" value={category} onChange={setCategory} allowEmpty options={cats.map((x) => [x, x])} />
      <Field label="Descripción" value={description} onChange={setDescription} maxLength={2000} placeholder="Una línea que diga qué es" />
      <Notify value={notify} onChange={setNotify} />
    </FormModal>
  );
}

/* ── Cifras del mes ─────────────────────────────────────────────────────── */

const METRIC_FIELDS = [
  ['reach', 'Alcance', 100],
  ['impressions', 'Impresiones', 100],
  ['engagement', 'Interacciones', 10],
  ['followers', 'Seguidores (total)', 10],
  ['new_followers', 'Seguidores nuevos', 1],
  ['clicks', 'Clics', 1],
  ['leads', 'Leads', 1],
  ['posts', 'Publicaciones', 1],
  ['sales', 'Ventas (USD)', 10],
  ['spend', 'Inversión (USD)', 10],
];
const metricsOf = (month, channel) => app.data.metrics.find((m) => m.month.slice(0, 7) === month && m.channel === channel) || {};

function MetricsModal({ month: m0 = null, channel: ch0 = 'total', onClose }) {
  const [month, setMonth] = useState((m0 || todayKey()).slice(0, 7));
  const [channel, setChannel] = useState(ch0);
  const load = (mo, ch) => {
    const row = metricsOf(mo, ch);
    return [Object.fromEntries(METRIC_FIELDS.map(([k]) => [k, row[k] ?? null])), row.notes || ''];
  };
  const [values, setValues] = useState(() => load(month, channel)[0]);
  const [notes, setNotes] = useState(() => load(month, channel)[1]);
  const pick = (mo, ch) => {
    const [v, n] = load(mo, ch);
    setMonth(mo);
    setChannel(ch);
    setValues(v);
    setNotes(n);
  };
  return (
    <FormModal
      title="Resultados del mes"
      size="sm:max-w-[640px]"
      onClose={onClose}
      onSubmit={async () => {
        try {
          const row = { client_id: cid(), month: `${month}-01`, channel, notes: orNull(notes), ...values };
          upsertLocal('metrics', await app.backend.upsertMetrics(row));
          app.data.metrics.sort((a, b) => b.month.localeCompare(a.month));
          refresh();
          toast.success(`Resultados de ${fMonth.format(dayDate(`${month}-15`))} guardados`);
          return true;
        } catch (err) {
          return fail('No se guardó', err);
        }
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Mes</span>
        <Input type="month" value={month} onChange={(e) => e.target.value && pick(e.target.value, channel)} aria-label="Mes" />
      </label>
      <SelectField label="De" value={channel} onChange={(v) => pick(month, v || 'total')} options={[['total', 'Total (lo que ve primero)'], ...Object.entries(CHANNEL).map(([k, [l]]) => [k, l])]} />
      {METRIC_FIELDS.map(([k, label, step]) => (
        <Num key={`${month}-${channel}-${k}`} label={label} value={values[k]} step={step} min={k === 'new_followers' ? -1e6 : 0} onChange={(n) => setValues((v) => ({ ...v, [k]: n }))} />
      ))}
      <Area label="Notas" value={notes} onChange={setNotes} rows={2} maxLength={2000} placeholder="Lo más destacado del mes" />
    </FormModal>
  );
}

/* ── Reuniones ──────────────────────────────────────────────────────────── */

const DURATIONS = [30, 45, 60, 90];
const durText = (n) => (n < 60 ? `${n} min` : n === 60 ? '1 h' : `1 h ${n - 60}`);
const whenText = (iso) => `${cap(fDay.format(new Date(iso)))} · ${fTime.format(new Date(iso))}`;

/** Agendar (o editar) una reunión: queda confirmada y le avisa. */
function MeetingModal({ meeting: m = null, onClose }) {
  const [topic, setTopic] = useState(m?.topic || '');
  const [when, setWhen] = useState(m?.starts_at ? localInput(m.starts_at) : '');
  const [duration, setDuration] = useState(String(m?.duration || 30));
  const [mode, setMode] = useState(m?.mode || 'video');
  const [link, setLink] = useState(m?.link || remember('portal:meet-link') || '');
  const [place, setPlace] = useState(m?.place || '');
  const [notes, setNotes] = useState(m?.notes || '');
  return (
    <FormModal
      title={m ? 'Editar reunión' : 'Agendar una reunión'}
      submit={m ? 'Guardar' : 'Agendar'}
      onClose={onClose}
      extra={
        m && (
          <Borrar
            what="la reunión"
            onConfirm={async () => {
              await app.backend.remove('meetings', m.id);
              app.data.meetings = app.data.meetings.filter((x) => x.id !== m.id);
              refresh();
              onClose();
            }}
          />
        )
      }
      onSubmit={async () => {
        if (!txt(topic)) return fail('¿De qué vais a hablar?');
        if (!when) return fail('Elige el día y la hora.');
        const url = txt(link);
        if (url && !/^https?:\/\//.test(url)) return fail('El enlace no vale', new Error('Tiene que empezar por https://'));
        if (url) remember('portal:meet-link', url);
        const row = { client_id: cid(), topic: txt(topic), starts_at: new Date(when).toISOString(), duration: Number(duration), mode, link: url || null, place: orNull(place), notes: orNull(notes) };
        if (m) row.id = m.id;
        else Object.assign(row, { status: 'confirmed', origin: 'studio' });
        try {
          upsertLocal('meetings', await app.backend.save('meetings', row));
          refresh();
          toast.success(m ? 'Reunión guardada' : 'Reunión agendada', m ? undefined : { description: 'Le llega el aviso.' });
          return true;
        } catch (err) {
          return fail('No se guardó', err);
        }
      }}
    >
      <Field label="Tema" value={topic} onChange={setTopic} placeholder="Revisión del calendario de diciembre" autoFocus />
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Cuándo</span>
        <Input type="datetime-local" step={900} value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Cuándo" />
      </label>
      <Seg label="Duración" value={duration} onChange={setDuration} options={DURATIONS.map((n) => [String(n), durText(n)])} />
      <Seg label="Cómo" value={mode} onChange={setMode} options={Object.entries(MEETING_MODE).map(([k, [l]]) => [k, l])} />
      {mode === 'in_person' ? (
        <Field label="Dónde" value={place} onChange={setPlace} maxLength={300} placeholder="Dirección" />
      ) : (
        <Field label="Enlace" value={link} onChange={setLink} type="url" inputMode="url" maxLength={500} placeholder="https://meet.google.com/…" description="Se recuerda para la próxima." />
      )}
      <Area label="Notas (opcional)" value={notes} onChange={setNotes} rows={3} maxLength={2000} placeholder="De qué vais a hablar" />
    </FormModal>
  );
}

/** La pidió el cliente: elegir uno de sus horarios (u otro), poner el enlace y confirmar, o decir que no se puede. */
function ConfirmMeetingModal({ meeting: m, onClose }) {
  const future = (m.options || []).filter((o) => new Date(o) > new Date());
  const [pick, setPick] = useState(future[0] || 'otra');
  const [other, setOther] = useState('');
  const [link, setLink] = useState(remember('portal:meet-link') || '');
  const [place, setPlace] = useState(m.place || '');
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const decline = async () => {
    if (!txt(note)) return toast.danger('Escribe en el mensaje por qué y qué le propones.');
    setDeclining(true);
    try {
      upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'declined', studio_note: txt(note) }));
      refresh();
      toast.success('Le dijimos que buscamos otra hora');
      onClose();
    } catch (err) {
      fail('No se guardó', err);
    } finally {
      setDeclining(false);
    }
  };
  return (
    <FormModal
      title={m.topic}
      submit="Confirmar"
      onClose={onClose}
      extra={
        <Button variant="danger-soft" isPending={declining} onPress={decline}>
          No puedo
        </Button>
      }
      onSubmit={async () => {
        const startsAt = pick === 'otra' ? (other ? new Date(other).toISOString() : '') : pick;
        if (!startsAt) return fail('Elige un horario.');
        const url = txt(link);
        if (url && !/^https?:\/\//.test(url)) return fail('El enlace no vale', new Error('Tiene que empezar por https://'));
        if (url) remember('portal:meet-link', url);
        try {
          upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'confirmed', starts_at: startsAt, link: url || null, place: orNull(place), studio_note: orNull(note) }));
          refresh();
          toast.success('Reunión confirmada', { description: 'Le llega el aviso.' });
          return true;
        } catch (err) {
          return fail('No se confirmó', err);
        }
      }}
    >
      <Hint>{[`La pidió ${m.author || 'el cliente'}`, MEETING_MODE[m.mode]?.[0] || 'Reunión', durText(m.duration || 30)].join(' · ')}</Hint>
      {m.notes && <p className="rounded-2xl bg-surface-secondary px-3 py-2 text-sm sm:col-span-2">{m.notes}</p>}
      <div className="flex flex-col gap-1.5 sm:col-span-2" role="radiogroup" aria-label="Horario">
        <span className="text-sm font-medium">Horario</span>
        {(m.options || []).map((o) => {
          const past = new Date(o) < new Date();
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={pick === o}
              disabled={past}
              onClick={() => setPick(o)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 ${pick === o ? 'border-accent bg-accent/10 font-medium' : 'border-border hover:bg-surface-secondary'}`}
            >
              <Clock className="size-4 text-muted" />
              {whenText(o)}
              {past && <span className="text-xs text-muted">(ya pasó)</span>}
            </button>
          );
        })}
        <div className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${pick === 'otra' ? 'border-accent bg-accent/10' : 'border-border'}`}>
          <button type="button" role="radio" aria-checked={pick === 'otra'} onClick={() => setPick('otra')} className="font-medium outline-none focus-visible:underline">
            Otra hora
          </button>
          <Input
            type="datetime-local"
            step={900}
            value={other}
            aria-label="Otra hora"
            className="min-w-0 flex-1"
            onChange={(e) => {
              setOther(e.target.value);
              if (e.target.value) setPick('otra');
            }}
          />
        </div>
      </div>
      {m.mode === 'in_person' ? (
        <Field label="Dónde" value={place} onChange={setPlace} maxLength={300} placeholder="Dirección" />
      ) : (
        <Field label="Enlace" value={link} onChange={setLink} type="url" inputMode="url" maxLength={500} placeholder="https://meet.google.com/…" description="Se recuerda para la próxima." />
      )}
      <Area label="Mensaje para el cliente" value={note} onChange={setNote} rows={2} maxLength={2000} placeholder="Opcional al confirmar; obligatorio si no puedes" />
    </FormModal>
  );
}

/** Lo que el estudio hace con una reunión ya agendada. */
export async function setMeetingStatus(m, status, message) {
  try {
    upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status }));
    refresh();
    toast.success(message);
  } catch (err) {
    fail('No se guardó', err);
  }
}

/* ── Leads: el mismo formulario del cliente, y el estudio además puede borrar ── */

function LeadEditor({ lead = null, onClose }) {
  return <LeadModal lead={lead} onClose={onClose} extra={lead && <Borrar what={`el lead «${lead.name}»`} onConfirm={async () => (await drop('leads', lead), onClose())} />} />;
}

/* ── El que pinta el formulario abierto ─────────────────────────────────── */

const EDITORS = {
  post: PostModal,
  work: WorkModal,
  report: ReportModal,
  task: TaskModal,
  content: ContentModal,
  move: MoveModal,
  import: ImportModal,
  resource: ResourceModal,
  lead: LeadEditor,
  metrics: MetricsModal,
  meeting: MeetingModal,
  confirmMeeting: ConfirmMeetingModal,
};

export function Editores() {
  const cur = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
  );
  if (!cur || !app.studio) return null;
  const C = EDITORS[cur.kind];
  return C ? <C key={cur.key} {...cur.props} onClose={() => shut(cur.key)} /> : null;
}
