// Modo estudio de la app nueva (cuando entra la cuenta de Schwarck): su Inicio con lo
// que hay que revisar del cliente abierto, «Hoy en todos tus clientes», los atajos para
// crear y el trabajo de hoy; la bandeja «Para revisar» (#/revisar) y el resumen de todos
// los portales (#/todos), que se abren como hojas; y el botón «+» para crear cualquier cosa.
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRightFromSquare,
  Box,
  Calendar,
  ChartColumn,
  Check,
  CircleCheck,
  Copy,
  Folder,
  Funnel,
  ListCheck,
  Megaphone,
  Plus,
  Sparkles,
  Sun,
  Thunderbolt,
  Tray,
} from '@gravity-ui/icons';
import { Button, Card, Chip, Dropdown, Label, Link, Skeleton, toast } from '@heroui/react';
import { Empty, Panel, Stat } from '../../kit/parts.jsx';
import { addDays, ago, cap, fDay, fMonth, dayDate, minutesText, plural, safeUrl, todayKey } from '../../../portal/kit.js';
import { CONTENT_STATUS, SENT_KIND, VERDICT, app, attention, currentProject, pendingTasks, targetTitle, toReview, urlOf, workToday } from '../../../portal/state.js';
import { openPortal, refresh, usePortal } from '../store.js';
import { Bubble, Hoja, openFile } from '../ui.jsx';
import { MeetingCard } from '../screens/Reuniones.jsx';
import { Stars } from '../screens/Valoracion.jsx';
import { StatusDot, approveTask, cycleWork, edit, pasteNexus } from './Editores.jsx';

/** Lo que se puede crear en el portal abierto (los atajos de Inicio y el botón «+»). */
export const CREATE = [
  ['report', 'Reporte', 'Lo que hiciste hoy, en una lista', ListCheck, 'var(--cf-income)', () => edit('report')],
  ['nexus', 'Pegar de Nexus', 'Se publica tarea por tarea', Copy, 'var(--cf-income)', () => pasteNexus()],
  ['post', 'Anuncio o avance', 'En su cronología, con aviso', Megaphone, 'var(--cf-orange)', () => edit('post')],
  ['task', 'Petición', 'Pedirle algo, con fecha', Tray, 'var(--cf-expense)', () => edit('task')],
  ['content', 'Publicación', 'En su calendario', Calendar, 'var(--cf-primary)', () => edit('content')],
  ['import', 'Importar de Claude', 'Varias publicaciones de una vez', Sparkles, 'var(--cf-primary)', () => edit('import')],
  ['meeting', 'Reunión', 'Queda confirmada y le avisa', Calendar, 'var(--cf-blue)', () => edit('meeting')],
  ['resource', 'Recurso', 'Un enlace o un archivo', Folder, 'var(--cf-blue)', () => edit('resource')],
  ['lead', 'Lead', 'Alguien interesado', Funnel, 'var(--cf-purple)', () => edit('lead')],
  ['metrics', 'Resultados', 'Las cifras del mes', ChartColumn, '#22c9a6', () => edit('metrics')],
  ['work', 'Trabajo', 'Una sola tarea del estudio', Thunderbolt, 'var(--cf-fg-faint)', () => edit('work')],
];
const QUICK = ['report', 'post', 'task', 'content', 'resource', 'lead', 'metrics', 'meeting'];

const SENT_A = { message: 'un mensaje', link: 'un enlace', file: 'un archivo', video: 'un vídeo' };

/** Una línea de lo que pide atención, en palabras. */
const ATT_TEXT = {
  submission: (r) => `${r.author || 'El cliente'} envió ${SENT_A[r.kind] || 'algo'}`,
  task: (r) => `Petición entregada: ${r.title}`,
  changes: (r) => `Pide cambios: ${r.title}`,
  rejected: (r) => `Rechazó: ${r.title}`,
  idea: (r) => `Propone: ${r.title}`,
  meeting: (r) => `Pide reunión: ${r.topic}`,
  comment: (r) => `Comentario: ${r.body}`,
};

export function InicioEstudio() {
  const [, v] = usePortal();
  const att = attention();
  const today = workToday();
  const done = today.filter((w) => w.status === 'done');
  const minutes = done.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const asks = pendingTasks();
  const review = toReview();
  const week = app.data.content.filter((c) => c.date >= todayKey() && c.date < addDays(todayKey(), 7)).length;
  const leadsMonth = app.data.leads.filter((l) => l.date?.slice(0, 7) === todayKey().slice(0, 7)).length;
  const project = currentProject();
  const ratings = app.data.ratings || [];
  const lastMonth = ratings.map((r) => r.month).sort().at(-1);
  const rated = ratings.filter((r) => r.month === lastMonth);
  const avg = rated.length ? rated.reduce((s, r) => s + r.score, 0) / rated.length : 0;

  return (
    <div className="flex flex-col gap-5" data-v={v}>
      <header className="flex flex-col gap-1">
        <p className="sw-eyebrow">Estudio · {cap(fDay.format(new Date()))}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{app.client.name}</h1>
        <p className="text-sm text-muted">{app.client.industry || 'Portal del cliente'} · lo que crees aquí le llega al momento.</p>
      </header>

      <a href="#/revisar" className="group outline-none">
        <Card className={`flex-row items-center gap-4 transition-colors group-hover:bg-surface-hover group-focus-visible:ring-2 group-focus-visible:ring-focus ${att.length ? 'ring-1 ring-warning/40' : ''}`}>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${att.length ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{att.length ? <Tray className="size-5" /> : <CircleCheck className="size-5" />}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">{att.length ? `${plural(att.length, 'cosa', 'cosas')} para revisar` : 'Todo revisado'}</span>
            <span className="truncate text-xs text-muted">{att.length ? att.slice(0, 2).map((a) => ATT_TEXT[a.kind]?.(a.row)).join(' · ') : `Nada pendiente de ${app.client.name}.`}</span>
          </span>
          {att.length > 0 && <span className="flex min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold leading-6 text-danger-foreground">{att.length}</span>}
          <ArrowRight className="size-4 shrink-0 text-muted" />
        </Card>
      </a>

      {app.portals.length > 1 && (
        <a href="#/todos" className="group outline-none">
          <Card className="flex-row items-center gap-4 transition-colors group-hover:bg-surface-hover group-focus-visible:ring-2 group-focus-visible:ring-focus">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning/10 text-[var(--cf-orange)]">
              <Sun className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">Hoy en todos tus clientes</span>
              <span className="truncate text-xs text-muted">{app.portals.length} portales: lo que sale hoy, lo que te respondieron y lo que espera</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted" />
          </Card>
        </a>
      )}

      <section className="flex flex-col gap-2" aria-label="Crear">
        <div className="flex items-end justify-between px-1">
          <h2 className="sw-eyebrow">Crear</h2>
          <span className="text-xs text-muted">Le llega al cliente al momento</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((id) => {
            const [, label, , Icon, tone, run] = CREATE.find((x) => x[0] === id);
            return (
              <button
                key={id}
                type="button"
                onClick={run}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface px-1 py-3 text-xs font-medium shadow-[var(--surface-shadow)] outline-none transition-transform hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus active:scale-95"
              >
                <span className="flex size-9 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}>
                  <Icon className="size-4" />
                </span>
                <span className="max-w-full truncate">{label.split(' o ')[0]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Panel
        title="Trabajo de hoy"
        description={today.length ? `${done.length} de ${today.length} hechas${minutes ? ` · ${minutesText(minutes)}` : ''}` : 'Lo que hagas hoy forma su reporte diario'}
        action={
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onPress={pasteNexus}>
              <Copy />
              Nexus
            </Button>
            <Button size="sm" variant="secondary" onPress={() => edit('report')}>
              <Plus />
              Reporte
            </Button>
          </span>
        }
      >
        {today.length ? (
          <ul className="flex flex-col gap-1">
            {today.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-2xl px-1 py-1 hover:bg-surface-secondary">
                <StatusDot status={w.status} onPress={() => cycleWork(w)} />
                <button type="button" onClick={() => edit('work', { work: w })} className="min-w-0 flex-1 truncate text-start text-sm outline-none focus-visible:underline">
                  {w.title}
                </button>
                {w.minutes ? <span className="shrink-0 text-xs text-muted">{minutesText(w.minutes)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin trabajo hoy. Añade lo que vas haciendo: el cliente lo ve en su cronología.</p>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Peticiones esperando" value={String(asks.length)} href="#/peticiones" tone={asks.length ? 'var(--cf-orange)' : undefined} />
        <Stat label="Piezas en revisión" value={String(review.length)} href="#/marketing" />
        <Stat label="Salen esta semana" value={String(week)} href="#/marketing/calendario" />
        <Stat label="Leads este mes" value={String(leadsMonth)} href="#/marketing/leads" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MeetingCard />
        {rated.length > 0 && (
          <Panel title={`Su valoración de ${fMonth.format(dayDate(lastMonth)).split(' ')[0]}`} description={plural(rated.length, 'respuesta', 'respuestas')}>
            <div className="flex items-center gap-3">
              <span className="sw-figure text-3xl">{avg.toFixed(1).replace('.', ',')}</span>
              <Stars value={avg} />
            </div>
            {rated
              .filter((r) => r.comment)
              .slice(0, 2)
              .map((r) => (
                <p key={r.user_id} className="mt-2 text-sm">
                  «{r.comment}» <span className="text-xs text-muted">— {r.author || 'Su equipo'}</span>
                </p>
              ))}
          </Panel>
        )}
        {project && (
          <Panel
            title={project.name}
            description={`${project.tasks_done} de ${project.tasks_total} tareas · lo lleva Negocio`}
            action={
              <Link href="#/proyecto" className="text-sm">
                Ver
                <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <ol className="flex flex-wrap gap-1.5">
              {(project.stages || []).map((s) => (
                <li key={s.name}>
                  <Chip size="sm" variant={s.done ? 'soft' : 'tertiary'} color={s.done ? 'success' : 'default'}>
                    {s.done && <CircleCheck className="size-3" />}
                    <Chip.Label>{s.name}</Chip.Label>
                  </Chip>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>

      <nav aria-label="Más del portal" className="flex flex-wrap gap-2">
        {[
          ['#/proyecto', 'Proyecto', Box],
          ['#/recursos', 'Recursos y documentos', Folder],
          ['#/reuniones', 'Reuniones', Calendar],
          ['#/informe', 'Informe del mes', ChartColumn],
        ].map(([href, label, Icon]) => (
          <a key={href} href={href} className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1.5 text-sm font-medium outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
            <Icon className="size-4 text-muted" />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ── Para revisar (#/revisar) ───────────────────────────────────────────── */

async function markSeen(ids) {
  await app.backend.markSubmissionsSeen(ids);
  const now = new Date().toISOString();
  for (const s of app.data.submissions) if (ids.includes(s.id)) s.seen_at = now;
  refresh();
}

function Row({ icon, color, title, text, note, meta, children, href, onGo }) {
  const main = (
    <>
      <Bubble name={icon} color={color} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        {text && <span className="line-clamp-2 text-sm text-muted">{text}</span>}
        {note && <span className="mt-1 rounded-xl bg-surface-secondary px-2 py-1 text-xs">{note}</span>}
        {meta && <span className="text-xs text-muted">{meta}</span>}
      </span>
    </>
  );
  return (
    <li className="flex items-start gap-2 py-2.5">
      {href ? (
        <button type="button" onClick={() => onGo(href)} className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl text-start outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus">
          {main}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{main}</div>
      )}
      {children && <span className="flex shrink-0 items-center gap-1">{children}</span>}
    </li>
  );
}

function Item({ it, close }) {
  const r = it.row;
  const when = ago(it.at);
  if (it.kind === 'submission') {
    const url = safeUrl(r.url);
    return (
      <Row icon={SENT_KIND[r.kind]?.[1] || 'send'} color="var(--cf-income)" title={ATT_TEXT.submission(r)} text={r.file_name || url || r.body} note={r.body && (r.file_name || url) ? r.body : null} meta={[r.task_id && `Para «${targetTitle('task', r.task_id)}»`, when].filter(Boolean).join(' · ')}>
        {r.storage_path && (
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Descargar" onPress={() => openFile(r.storage_path)}>
            <ArrowDownToLine />
          </Button>
        )}
        {url && (
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Abrir el enlace" onPress={() => window.open(url, '_blank', 'noopener')}>
            <ArrowUpRightFromSquare />
          </Button>
        )}
        {!r.storage_path && !url && r.body && (
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            aria-label="Copiar el mensaje"
            onPress={() =>
              navigator.clipboard.writeText(r.body).then(
                () => toast.success('Copiado'),
                () => toast.danger('No se pudo copiar'),
              )
            }
          >
            <Copy />
          </Button>
        )}
        <Button isIconOnly size="sm" variant="secondary" aria-label="Marcar como visto" onPress={() => markSeen([r.id]).catch((err) => toast.danger(err.message))}>
          <Check />
        </Button>
      </Row>
    );
  }
  if (it.kind === 'task') {
    return (
      <Row icon="inbox" color="var(--cf-expense)" title="Petición entregada" text={r.title} note={r.client_note ? `«${r.client_note}»` : null} meta={when} href="#/peticiones/enviadas" onGo={close}>
        <Button size="sm" onPress={() => approveTask(r)}>
          <Check />
          Dar por buena
        </Button>
      </Row>
    );
  }
  if (it.kind === 'meeting') {
    return (
      <Row icon="calendar" color="var(--cf-blue)" title={`${r.author || 'El cliente'} pide una reunión`} text={r.topic} note={r.notes} meta={`${plural(r.options?.length || 0, 'horario propuesto', 'horarios propuestos')} · ${when}`}>
        <Button size="sm" onPress={() => edit('confirmMeeting', { meeting: r })}>
          <Check />
          Responder
        </Button>
      </Row>
    );
  }
  if (it.kind === 'changes' || it.kind === 'rejected' || it.kind === 'idea') {
    const title = it.kind === 'idea' ? 'Propone una publicación' : `${r.client_verdict_name || 'El cliente'} ${VERDICT[it.kind === 'rejected' ? 'rejected' : 'changes'][2]}`;
    return <Row icon={it.kind === 'idea' ? 'sparkles' : it.kind === 'rejected' ? 'x' : 'edit'} color={it.kind === 'idea' ? 'var(--cf-purple)' : it.kind === 'rejected' ? 'var(--cf-expense)' : 'var(--cf-orange)'} title={title} text={r.title} note={r.client_note ? `«${r.client_note}»` : null} meta={when} href={`#/marketing/pieza/${r.id}`} onGo={close} />;
  }
  return <Row icon="chat" color="var(--cf-primary)" title={`${r.author || 'El cliente'} comentó`} text={r.body} meta={`En «${targetTitle(r.target, r.target_id)}» · ${when}`} href={`#/hilo/${r.target}/${r.target_id}`} onGo={close} />;
}

export function RevisarHoja({ onClose }) {
  const [, v] = usePortal();
  const items = attention();
  const unseen = items.filter((x) => x.kind === 'submission').map((x) => x.row.id);
  return (
    <Hoja
      eyebrow="Para revisar"
      title={app.client.name}
      subtitle={items.length ? plural(items.length, 'cosa', 'cosas') : 'Nada pendiente'}
      onClose={onClose}
      footer={
        unseen.length > 1 && (
          <Button variant="secondary" onPress={() => markSeen(unseen).then(() => toast.success('Envíos marcados como vistos'), (err) => toast.danger(err.message))}>
            <Check />
            Marcar los {unseen.length} envíos como vistos
          </Button>
        )
      }
    >
      {(close) =>
        items.length ? (
          <ul className="flex flex-col divide-y divide-border" data-v={v}>
            {items.map((it) => (
              <Item key={it.id} it={it} close={close} />
            ))}
          </ul>
        ) : (
          <Empty icon={CircleCheck} title="Todo revisado" text={`Nada pendiente de ${app.client.name}.`} />
        )
      }
    </Hoja>
  );
}

/* ── Hoy en todos tus clientes (#/todos) ────────────────────────────────── */

function groupsOf(data, client) {
  const mine = (rows) => (rows || []).filter((r) => r.client_id === client.id);
  const content = mine(data.content);
  const piece = (c) => `#/marketing/pieza/${c.id}`;
  return [
    ['Te respondieron', 'edit', 'var(--cf-orange)', content.filter((c) => ['changes', 'rejected'].includes(c.client_verdict) && !['scheduled', 'published'].includes(c.status)).map((c) => [c.id, `${VERDICT[c.client_verdict][0]}: ${c.title}`, piece(c)])],
    ['Ideas del cliente', 'sparkles', 'var(--cf-purple)', content.filter((c) => c.origin === 'client' && c.status === 'idea').map((c) => [c.id, c.title, piece(c)])],
    ['Sale hoy', 'calendar', 'var(--cf-blue)', content.filter((c) => c.date === data.today && c.status !== 'published').map((c) => [c.id, `${c.time ? `${c.time.slice(0, 5)} · ` : ''}${c.title} · ${CONTENT_STATUS[c.status]?.[0] || ''}`, piece(c)])],
    ['Esperando su aprobación', 'clock', 'var(--cf-primary)', content.filter((c) => c.status === 'review' && !c.client_verdict).map((c) => [c.id, c.title, piece(c)])],
    ['Reuniones', 'calendar', 'var(--cf-blue)', mine(data.meetings).map((m) => [m.id, m.status === 'requested' ? `Pide: ${m.topic}` : `Hoy: ${m.topic}`, m.status === 'requested' ? '#/revisar' : '#/reuniones'])],
    ['Peticiones', 'inbox', 'var(--cf-expense)', mine(data.tasks).map((t) => [t.id, `${t.status === 'submitted' ? 'Entregada' : 'Vencida'}: ${t.title}`, t.status === 'submitted' ? '#/peticiones/enviadas' : '#/peticiones'])],
    ['Te enviaron', 'send', 'var(--cf-income)', mine(data.submissions).map((s) => [s.id, `${s.author || 'El cliente'} envió ${SENT_A[s.kind] || 'algo'}`, '#/revisar'])],
  ].filter(([, , , items]) => items.length);
}

function Logo({ client }) {
  const src = urlOf(client.logo_url);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white" style={{ background: client.accent || 'var(--accent)' }}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : (client.name || '?').slice(0, 1)}
    </span>
  );
}

export function TodosHoja({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    app.backend
      .overview()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);
  const sections = data ? data.clients.map((client) => ({ client, groups: groupsOf(data, client) })).map((s) => ({ ...s, total: s.groups.reduce((n, g) => n + g[3].length, 0) })).sort((a, b) => b.total - a.total) : [];
  const busyOnes = sections.filter((s) => s.total);
  const calm = sections.filter((s) => !s.total);
  const open = async (client, route, close) => {
    const p = app.portals.find((x) => x.client.id === client.id);
    if (!p) return toast.danger('Ese portal no está en tu lista');
    setBusy(client.id);
    try {
      if (p.client.id !== app.client.id) await openPortal(p);
      close(route);
    } catch (err) {
      toast.danger('No se abrió', { description: err.message });
    } finally {
      setBusy('');
    }
  };
  return (
    <Hoja eyebrow="Hoy en todos tus clientes" title={cap(fDay.format(new Date()))} subtitle={data ? (busyOnes.length ? `${plural(busyOnes.length, 'cliente con algo', 'clientes con algo')} pendiente` : 'Todo en orden') : 'Mirando cada portal…'} onClose={onClose} wide>
      {(close) => (
        <>
          {error && <p className="text-sm text-danger">{error}</p>}
          {!data && !error && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
          )}
          {data && !busyOnes.length && <Empty icon={CircleCheck} title="Todo en orden" text="Nada pendiente hoy en ningún cliente." />}
          {busyOnes.map(({ client, groups, total }) => (
            <section key={client.id} className="flex flex-col gap-2 rounded-3xl bg-surface-secondary p-3" aria-label={client.name}>
              <button type="button" onClick={() => open(client, '#/', close)} disabled={busy === client.id} className="flex items-center gap-3 rounded-2xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <Logo client={client} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{client.name}</span>
                  <span className="truncate text-xs text-muted">{groups.map(([label, , , items]) => `${label.toLowerCase()} ${items.length}`).join(' · ')}</span>
                </span>
                <span className="flex min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold leading-6 text-danger-foreground">{total}</span>
              </button>
              {groups.map(([label, ico, color, items]) => (
                <div key={label} className="flex flex-col gap-1 rounded-2xl bg-surface p-2">
                  <span className="flex items-center gap-1.5 px-1 text-xs font-medium" style={{ color }}>
                    <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
                    {label}
                  </span>
                  {items.slice(0, 4).map(([id, text, route]) => (
                    <button key={id} type="button" onClick={() => open(client, route, close)} className="flex items-center gap-2 rounded-xl px-1 py-1 text-start text-sm outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus">
                      <span className="min-w-0 flex-1 truncate">{text}</span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted" />
                    </button>
                  ))}
                  {items.length > 4 && <span className="px-1 text-xs text-muted">y {items.length - 4} más</span>}
                </div>
              ))}
            </section>
          ))}
          {calm.length > 0 && <p className="text-xs text-muted">Sin pendientes: {calm.map((s) => s.client.name).join(', ')}.</p>}
        </>
      )}
    </Hoja>
  );
}

/* ── El botón «+» ───────────────────────────────────────────────────────── */

export function CrearBoton() {
  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={`Crear en el portal de ${app.client.name}`}
        className="fixed end-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-[var(--overlay-shadow)] print:hidden sm:end-[max(1rem,calc(50%-24rem))]"
      >
        <Plus className="size-6" />
      </Button>
      <Dropdown.Popover placement="top end" className="min-w-72">
        <Dropdown.Menu aria-label="Crear" onAction={(k) => CREATE.find((x) => x[0] === k)?.[5]()}>
          {CREATE.map(([id, label, note, Icon, tone]) => (
            <Dropdown.Item key={id} id={id} textValue={label}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}>
                <Icon className="size-3.5" />
              </span>
              <div className="flex flex-col">
                <Label>{label}</Label>
                <span className="text-xs text-muted">{note}</span>
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

