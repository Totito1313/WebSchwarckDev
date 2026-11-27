// Los widgets de Inicio. Cada uno dice cómo se llama, qué cuenta, sus tamaños
// posibles (s: un tercio, m: la mitad, l: dos tercios, xl: todo el ancho) y cómo se
// pinta. Inicio.jsx los ordena según la disposición guardada en los ajustes
// (settings.home), así que la misma disposición se ve en el ordenador y en el teléfono.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  ChartColumn,
  CircleCheck,
  CircleDollar,
  Clock,
  Eye,
  FileText,
  Folder,
  Funnel,
  LayoutHeaderCellsLarge,
  ListCheck,
  Megaphone,
  Pause,
  Person,
  Play,
  Square,
  SquareArticle,
  Thunderbolt,
  Wallet,
  Xmark,
} from '@gravity-ui/icons';
import { Button, ButtonGroup, Chip, Link, ProgressBar, TextArea, TextField, toast } from '@heroui/react';
import { addDays, clockText, durationText, find, money, put, shortMonth, state as crm, todayISO } from '../../../negocio-core.js';
import { expenseBase } from '../../../negocio-gastos.js';
import {
  PROJECT_STATUS,
  TASK_STATUS,
  elapsedMs,
  entryMinutes,
  pauseTimer,
  projectName,
  projectStats,
  resumeTimer,
  runningEntry,
  setTaskStatus,
  startTimer,
  stopTimer,
  taskKey,
} from '../../../negocio-work.js';
import { Empty, Person as PersonAvatar, StatusChip } from '../../kit/parts.jsx';
import { ComposedChart, DonutChart, KpiGroup, Timeline } from '../../pro/index.js';
import { CREATE, CREATE_HOME, sectionOf } from '../nav.js';
import {
  DOC_STATUS,
  LEAD_STAGES,
  OPEN_STAGES,
  base,
  customerName,
  docStatus,
  fmt,
  followText,
  leadName,
  leadValue,
  relDay,
  shortDate,
  totals,
  within,
} from '../domain.js';

const compactNum = new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 });
const KIND_ICON = { in: CircleDollar, doc: FileText, view: Eye, ok: CircleCheck, no: Xmark, out: Wallet, person: Person, lead: Funnel };
const KIND_COLOR = { in: 'var(--success)', ok: 'var(--success)', no: 'var(--danger)', out: 'var(--sw-chart-out)', lead: 'var(--accent)' };
const STATUS_COLOR = { request: 'accent', todo: 'default', doing: 'accent', review: 'warning', done: 'success' };
const dfDay = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' });
/** «Hoy», «Mañana» o «dom 29»: corto, para la columna de días. */
const dayLabel = (iso, today = todayISO()) => (iso === today ? 'Hoy' : iso === addDays(today, 1) ? 'Mañana' : dfDay.format(new Date(`${iso}T12:00:00`)));

/** Pide a la app que cree algo (lo mismo que el botón «Crear» de arriba). */
export const createThing = (key) => dispatchEvent(new CustomEvent('negocio:create', { detail: key }));

function More({ href, children }) {
  return (
    <Link href={href} className="text-xs">
      {children}
      <ArrowRight className="size-3" />
    </Link>
  );
}

function useTick(on) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
}

/* ── Los de siempre ─────────────────────────────────────────────────────── */

function Cifras({ data }) {
  return (
    <KpiGroup
      items={[
        { label: 'Cobrado', value: fmt(data.inNow.sum), delta: data.dIn, sub: `${data.inNow.count} ${data.inNow.count === 1 ? 'cobro' : 'cobros'}`, trend: data.months.map((m) => m.in), trendColor: 'var(--sw-chart-in)', href: '#/cobros' },
        {
          label: 'Gastado',
          value: fmt(data.outNow.sum),
          delta: data.dOut,
          upIsGood: false,
          sub: data.outNow.skipped ? `${data.outNow.skipped} sin tasa` : 'En gastos',
          trend: data.months.map((m) => m.out),
          trendColor: 'var(--sw-chart-out)',
          href: '#/gastos',
        },
        { label: 'Beneficio', value: fmt(data.profit), delta: data.profitDelta, sub: 'Cobrado menos gastado', tone: data.profit < 0 ? 'var(--danger)' : undefined, trend: data.months.map((m) => m.in - m.out) },
        {
          label: 'Por cobrar',
          value: fmt(data.rec.sum),
          sub: data.rec.overdue.length ? `${data.rec.overdue.length} vencidas de ${data.rec.open.length}` : `${data.rec.open.length} ${data.rec.open.length === 1 ? 'factura abierta' : 'facturas abiertas'}`,
          tone: data.rec.overdue.length ? 'var(--danger)' : undefined,
          href: '#/facturas',
        },
      ]}
    />
  );
}

function Flujo({ data }) {
  const cur = base();
  return (
    <ComposedChart
      title="Entradas, salidas y beneficio de los últimos 12 meses"
      xLabel="Mes"
      data={data.months.map((m) => ({ key: m.key, label: shortMonth(m.key), in: m.in, out: m.out, net: m.in - m.out }))}
      series={[
        { key: 'in', name: 'Entradas', type: 'bar', color: 'var(--sw-chart-in)' },
        { key: 'out', name: 'Salidas', type: 'bar', color: 'var(--sw-chart-out)' },
        { key: 'net', name: 'Beneficio', type: 'line', color: 'var(--foreground)' },
      ]}
      format={(x) => money(x, cur)}
      compact={(x) => compactNum.format(x)}
    />
  );
}

/** Gastos del periodo por categoría, en la moneda principal. */
function byCategory(state, r) {
  const names = new Map((state.categories || []).map((c) => [c.id, c.name]));
  const sums = new Map();
  for (const e of state.expenses || []) {
    if (!within(e.date, r)) continue;
    const v = expenseBase(e);
    if (v == null || v <= 0) continue;
    const key = e.categoryId || '__none';
    sums.set(key, (sums.get(key) || 0) + v);
  }
  return [...sums].map(([key, value]) => ({ key, label: names.get(key) || 'Sin categoría', value }));
}

function Categorias({ state, data, size }) {
  const cats = byCategory(state, data.r);
  return cats.length ? (
    <DonutChart title="Gastos por categoría" parts={cats} format={(x) => money(x, base())} totalLabel="Gastado" size={150} layout={size === 's' ? 'stack' : 'side'} />
  ) : (
    <Empty icon={Wallet} title="Sin gastos" text="Cuando anotes gastos, aquí verás en qué se va el dinero." />
  );
}

function ParaHoy({ data }) {
  return data.due.length ? (
    <ul className="flex flex-col">
      {data.due.slice(0, 6).map((l) => (
        <li key={l.id}>
          <a href={`#/leads/${l.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
            <PersonAvatar name={leadName(l)} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{leadName(l)}</span>
              <span className="truncate text-xs text-muted">{l.nextNote || 'Seguimiento'}</span>
            </span>
            <Chip size="sm" variant="soft" color={l.nextAt < todayISO() ? 'danger' : 'warning'}>
              {followText(l.nextAt)}
            </Chip>
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <Empty icon={Bell} title="Todo al día" text="Los seguimientos de leads que toquen hoy salen aquí." />
  );
}

function PorCobrar({ data }) {
  return data.rec.open.length ? (
    <ul className="flex flex-col">
      {[...data.rec.open]
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
        .slice(0, 6)
        .map((d) => {
          const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.pending;
          return (
            <li key={d.id}>
              <a href={`#/documentos/${d.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{customerName(d)}</span>
                  <span className="truncate text-xs text-muted">
                    {d.number} · vence {shortDate(d.dueDate) || '—'}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-sm tabular-nums">{money(totals(d).due, d.currency)}</span>
                  <StatusChip label={st[0]} color={st[1]} />
                </span>
              </a>
            </li>
          );
        })}
    </ul>
  ) : (
    <Empty icon={CircleDollar} title="Nada por cobrar" text="Las facturas con saldo pendiente salen aquí." />
  );
}

function Actividad({ data }) {
  return data.feed.length ? (
    <Timeline
      label="Lo último que pasó"
      items={data.feed.map((item, i) => ({
        id: `${item.href}-${i}`,
        marker: { icon: KIND_ICON[item.kind] || FileText, color: KIND_COLOR[item.kind] },
        title: (
          <a href={item.href} className="font-normal hover:underline">
            {item.text}
          </a>
        ),
        trailing: relDay(item.date),
      }))}
    />
  ) : (
    <Empty icon={FileText} title="Todavía no hay movimiento" text="Cobros, facturas, firmas, gastos y clientes nuevos salen aquí." />
  );
}

/* ── Nuevos ─────────────────────────────────────────────────────────────── */

// Todo lo que se puede crear, más algunas secciones a las que se va mucho.
const CREATABLE = Object.values(CREATE).flat();
const LINKS = [
  ['go:cobros', 'Cobros', '#/cobros'],
  ['go:facturas', 'Facturas', '#/facturas'],
  ['go:tareas', 'Tareas', '#/tareas'],
  ['go:horas', 'Horas', '#/horas'],
  ['go:leads', 'Leads', '#/leads'],
  ['go:marketing', 'Marketing', '#/marketing'],
  ['go:paginas', 'Páginas', '#/paginas'],
  ['go:portal', 'Portal', '#/portal'],
];
export const SHORTCUTS = [
  ...CREATABLE.map(([k, label]) => ({ id: k, label, icon: sectionOf(CREATE_HOME[k])?.icon || Thunderbolt, run: () => createThing(k) })),
  ...LINKS.map(([id, label, href]) => ({ id, label, icon: sectionOf(href.slice(2))?.icon || ArrowRight, run: () => (location.hash = href), link: true })),
];
export const DEFAULT_SHORTCUTS = ['factura', 'horas', 'tarea', 'gasto', 'lead', 'pagina'];

function Accesos({ cfg, size }) {
  const ids = cfg.shortcuts?.length ? cfg.shortcuts : DEFAULT_SHORTCUTS;
  const items = ids.map((id) => SHORTCUTS.find((s) => s.id === id)).filter(Boolean);
  const cols = size === 's' ? 'grid-cols-2' : size === 'm' ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6';
  return (
    <ul className={`grid gap-2 ${cols}`}>
      {items.map(({ id, label, icon: Icon, run, link }) => (
        <li key={id}>
          <button
            type="button"
            onClick={run}
            className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl bg-surface-secondary p-3 text-start outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className={`flex size-8 items-center justify-center rounded-xl ${link ? 'bg-surface text-foreground' : 'bg-accent text-accent-foreground'}`}>
              <Icon className="size-4" />
            </span>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MisTareas({ state }) {
  const today = todayISO();
  const soon = addDays(today, 7);
  const list = state.tasks
    .filter((t) => !t.parentId && t.status !== 'done' && (t.status === 'doing' || (t.dueDate && t.dueDate <= soon)))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, 7);
  if (!list.length) return <Empty icon={ListCheck} title="Nada urgente" text="Las tareas en curso y las que vencen esta semana salen aquí." />;
  return (
    <ul className="flex flex-col">
      {list.map((t) => (
        <li key={t.id} className="group flex items-center gap-2 rounded-2xl px-1.5 py-1.5 hover:bg-surface-secondary">
          <button
            type="button"
            aria-label={`Marcar «${t.title || 'Sin título'}» como hecha`}
            onClick={() => {
              setTaskStatus(t, 'done');
              put('tasks', t);
              toast.success(`${taskKey(t) || 'Tarea'} hecha`);
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-transparent outline-none transition-colors hover:border-success hover:text-success focus-visible:ring-2 focus-visible:ring-focus"
          >
            <CircleCheck className="size-4" />
          </button>
          <a href={`#/tareas/${t.id}`} className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{t.title || 'Sin título'}</span>
            <span className="truncate text-xs text-muted">{[taskKey(t), projectName(t.projectId)].filter(Boolean).join(' · ') || 'Sin proyecto'}</span>
          </a>
          {t.dueDate ? (
            <Chip size="sm" variant="soft" color={t.dueDate < today ? 'danger' : t.dueDate === today ? 'warning' : 'default'}>
              {t.dueDate === today ? 'Hoy' : shortDate(t.dueDate)}
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" color={STATUS_COLOR[t.status]}>
              {TASK_STATUS[t.status]?.[0]}
            </Chip>
          )}
        </li>
      ))}
    </ul>
  );
}

function Temporizador({ state }) {
  const e = runningEntry();
  useTick(Boolean(e?.resumedAt));
  const today = todayISO();
  const todayMin = state.time.filter((x) => x.date === today).reduce((s, x) => s + entryMinutes(x), 0);
  // Las tareas en curso, para arrancar con un toque.
  const doing = state.tasks.filter((t) => t.status === 'doing' && !t.parentId).slice(0, 3);
  if (e) {
    const task = e.taskId && find('tasks', e.taskId);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="sw-eyebrow">{e.resumedAt ? 'En marcha' : 'En pausa'}</span>
          <span className={`sw-figure text-4xl tabular-nums ${e.resumedAt ? '' : 'text-muted'}`}>{clockText(elapsedMs(e))}</span>
          <span className="truncate text-xs text-muted">{[task && `${taskKey(task)} ${task.title}`, projectName(e.projectId), e.note].filter(Boolean).join(' · ') || 'Sin tarea'}</span>
        </div>
        <ButtonGroup size="sm">
          <Button size="sm" variant="secondary" onPress={() => (e.resumedAt ? pauseTimer() : resumeTimer())}>
            {e.resumedAt ? <Pause /> : <Play />}
            {e.resumedAt ? 'Pausar' : 'Seguir'}
          </Button>
          <Button
            size="sm"
            onPress={() => {
              const saved = stopTimer({ quiet: true });
              toast(saved ? `Guardado: ${durationText(saved.minutes)}` : 'Menos de un minuto: no se guardó.');
            }}
          >
            <ButtonGroup.Separator />
            <Square />
            Parar
          </Button>
        </ButtonGroup>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="sw-eyebrow">Hoy</span>
        <span className="sw-figure text-4xl tabular-nums">{durationText(todayMin) || '0 min'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {doing.map((t) => (
          <Button key={t.id} size="sm" variant="secondary" onPress={() => startTimer({ projectId: t.projectId || '', taskId: t.id })} className="max-w-full">
            <Play className="size-3.5" />
            <span className="truncate">{t.title || taskKey(t)}</span>
          </Button>
        ))}
        <Button size="sm" variant={doing.length ? 'ghost' : 'primary'} onPress={() => startTimer({})}>
          <Play className="size-3.5" />
          {doing.length ? 'Otra cosa' : 'Empezar'}
        </Button>
      </div>
    </div>
  );
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function Semana({ state }) {
  const today = todayISO();
  const d = new Date(`${today}T12:00:00`);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  const days = WEEKDAYS.map((label, i) => ({ key: addDays(monday, i), label }));
  const rows = days.map(({ key, label }) => {
    const list = state.time.filter((e) => e.date === key);
    const billable = list.filter((e) => e.billable !== false).reduce((s, e) => s + entryMinutes(e), 0) / 60;
    const other = list.filter((e) => e.billable === false).reduce((s, e) => s + entryMinutes(e), 0) / 60;
    return { key, label, billable: Math.round(billable * 10) / 10, other: Math.round(other * 10) / 10 };
  });
  const total = rows.reduce((s, r) => s + r.billable + r.other, 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        <span className="sw-figure text-2xl text-foreground">{Math.round(total * 10) / 10} h</span> esta semana
      </p>
      <ComposedChart
        title="Horas de esta semana por día"
        xLabel="Día"
        height={180}
        data={rows}
        series={[
          { key: 'billable', name: 'Facturables', type: 'bar', color: 'var(--sw-chart-in)' },
          { key: 'other', name: 'No facturables', type: 'bar', color: 'var(--sw-cat-3)' },
        ]}
        format={(x) => `${x} h`}
      />
    </div>
  );
}

function Embudo({ state }) {
  const leads = state.leads || [];
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  if (!leads.length) return <Empty icon={Funnel} title="Sin leads" text="Cuando entren leads, aquí verás cuántos hay en cada paso." action={<Button size="sm" onPress={() => createThing('lead')}>Nuevo lead</Button>} />;
  const max = Math.max(1, ...OPEN_STAGES.map((s) => open.filter((l) => l.stage === s).length));
  const won = leads.filter((l) => l.stage === 'won').length;
  const lost = leads.filter((l) => l.stage === 'lost').length;
  const value = open.reduce((s, l) => s + (leadValue(l) || 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          <span className="sw-figure text-2xl text-foreground">{open.length}</span> abiertos
        </span>
        <span>
          <span className="sw-figure text-2xl text-foreground">{fmt(value)}</span> en juego
        </span>
        {won + lost > 0 && (
          <span>
            <span className="sw-figure text-2xl text-foreground">{Math.round((won / (won + lost)) * 100)}%</span> ganados
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {OPEN_STAGES.map((s) => {
          const n = open.filter((l) => l.stage === s).length;
          return (
            <li key={s}>
              <a href="#/leads" className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 rounded-xl px-1 py-0.5 text-sm hover:bg-surface-secondary">
                <span className="truncate text-muted">{LEAD_STAGES[s][0]}</span>
                <span className="h-2.5 rounded-full bg-default">
                  <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, minWidth: n ? 8 : 0, background: 'var(--accent)' }} />
                </span>
                <span className="text-end font-medium tabular-nums">{n}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Proyectos({ state }) {
  const list = state.projects.filter((p) => p.status === 'active' || p.status === 'pending').slice(0, 5);
  if (!list.length) return <Empty icon={Folder} title="Sin proyectos en curso" text="Los proyectos activos, con su avance y lo que falta por cobrar, salen aquí." />;
  return (
    <ul className="flex flex-col gap-1">
      {list.map((p) => {
        const s = projectStats(p);
        const tasksPct = s.tasks.length ? s.done.length / s.tasks.length : 0;
        const pct = Math.round((s.stagesTotal ? s.progress : tasksPct) * 100);
        return (
          <li key={p.id}>
            <a href={`#/proyectos/${p.id}`} className="flex flex-col gap-1.5 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name || 'Sin nombre'}</span>
                <span className="text-xs text-muted">{PROJECT_STATUS[p.status]?.[0]}</span>
              </span>
              <ProgressBar aria-label={`Avance de ${p.name}`} value={pct} size="sm">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="flex justify-between text-xs text-muted">
                <span>
                  {s.done.length}/{s.tasks.length} tareas · {durationText(s.minutes) || '0 min'}
                </span>
                {s.due > 0 && <span>{money(s.due, s.cur)} por cobrar</span>}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Notas({ cfg, setCfg }) {
  const [text, setText] = useState(cfg.notes || '');
  const timer = useRef(0);
  return (
    <TextField
      aria-label="Notas"
      value={text}
      onChange={(v) => {
        setText(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCfg({ notes: v }), 600);
      }}
      maxLength={4000}
      className="h-full"
    >
      <TextArea rows={7} placeholder="Lo que no quieres olvidar: ideas, llamadas pendientes, recordatorios…" className="min-h-40 resize-none border-0 bg-transparent shadow-none" />
    </TextField>
  );
}

/** Lo que viene en los próximos 14 días: facturas que vencen, tareas, seguimientos y publicaciones. */
function Proximo({ state }) {
  const today = todayISO();
  const end = addDays(today, 14);
  const inRange = (d) => d && d >= today && d <= end;
  const items = [
    ...state.docs
      .filter((d) => d.type === 'invoice' && inRange(d.dueDate) && totals(d).due > 0.004)
      .map((d) => ({ date: d.dueDate, icon: CircleDollar, text: `Vence ${d.number} de ${customerName(d)}`, href: `#/documentos/${d.id}`, color: 'var(--warning)' })),
    ...state.tasks.filter((t) => t.status !== 'done' && inRange(t.dueDate)).map((t) => ({ date: t.dueDate, icon: ListCheck, text: t.title || 'Tarea sin título', href: `#/tareas/${t.id}`, color: 'var(--accent)' })),
    ...(state.leads || []).filter((l) => OPEN_STAGES.includes(l.stage) && inRange(l.nextAt)).map((l) => ({ date: l.nextAt, icon: Funnel, text: `Seguimiento: ${leadName(l)}`, href: `#/leads/${l.id}`, color: 'var(--success)' })),
    ...(state.posts || []).filter((p) => inRange(p.date) && p.status !== 'published').map((p) => ({ date: p.date, icon: Megaphone, text: p.title || 'Publicación', href: `#/marketing/pieza/${p.id}`, color: 'var(--sw-cat-4)' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return <Empty icon={Calendar} title="Dos semanas tranquilas" text="Vencimientos, tareas, seguimientos y publicaciones de los próximos 14 días salen aquí." />;
  const days = [...new Set(items.map((i) => i.date))].slice(0, 6);
  return (
    <ol className="flex flex-col gap-3">
      {days.map((day) => (
        <li key={day} className="flex gap-3">
          <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-muted first-letter:uppercase">{dayLabel(day, today)}</span>
          <ul className="flex min-w-0 flex-1 flex-col gap-1">
            {items
              .filter((i) => i.date === day)
              .map((i, k) => (
                <li key={k}>
                  <a href={i.href} className="flex items-center gap-2 truncate rounded-lg text-sm hover:underline">
                    <i.icon className="size-3.5 shrink-0" style={{ color: i.color }} />
                    <span className="truncate">{i.text}</span>
                  </a>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Recientes({ state }) {
  const list = [...state.docs].sort((a, b) => (b.updatedAt || b.issueDate || '').localeCompare(a.updatedAt || a.issueDate || '')).slice(0, 6);
  if (!list.length) return <Empty icon={FileText} title="Sin documentos" text="Facturas, cotizaciones y propuestas recientes salen aquí." action={<Button size="sm" onPress={() => createThing('factura')}>Nueva factura</Button>} />;
  return (
    <ul className="flex flex-col">
      {list.map((d) => {
        const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.draft || ['Borrador', 'default'];
        return (
          <li key={d.id}>
            <a href={`#/documentos/${d.id}/editar`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
              <FileText className="size-4 shrink-0 text-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{customerName(d)}</span>
                <span className="truncate text-xs text-muted">{d.number || 'Borrador'} · {shortDate(d.issueDate)}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-sm tabular-nums">{money(totals(d).total, d.currency)}</span>
                <StatusChip label={st[0]} color={st[1]} />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/* ── El catálogo ────────────────────────────────────────────────────────── */

/**
 * id → { title, description, icon, sizes, size (por defecto), body (componente), flush?, action?(ctx) }.
 * Los componentes reciben { state, data, cfg, setCfg, size }.
 */
export const WIDGETS = {
  kpis: { title: 'Cifras', description: 'Cobrado, gastado, beneficio y por cobrar, con su tendencia.', icon: ChartColumn, sizes: ['l', 'xl'], size: 'xl', body: Cifras, action: (c) => <span>{c.periodLabel}{c.prevText ? ` · ${c.prevText}` : ''}</span> },
  cashflow: { title: 'Entradas y salidas', description: 'Los últimos 12 meses, con el beneficio encima.', icon: ChartColumn, sizes: ['m', 'l', 'xl'], size: 'l', body: Flujo },
  categories: { title: 'En qué se fue', description: 'Los gastos del periodo por categoría.', icon: Wallet, sizes: ['s', 'm'], size: 's', body: Categorias, action: () => <More href="#/gastos">Gastos</More> },
  shortcuts: { title: 'Accesos directos', description: 'Crear o ir a lo que más usas, con un toque.', icon: Thunderbolt, sizes: ['s', 'm', 'l', 'xl'], size: 's', body: Accesos },
  tasks: { title: 'Mis tareas', description: 'Las que están en curso y las que vencen esta semana.', icon: ListCheck, sizes: ['s', 'm'], size: 's', body: MisTareas, flush: true, action: () => <More href="#/tareas">Tareas</More> },
  timer: { title: 'Temporizador', description: 'Las horas de hoy y arrancar con una tarea en curso.', icon: Clock, sizes: ['s', 'm'], size: 's', body: Temporizador, action: () => <More href="#/horas">Horas</More> },
  week: { title: 'Horas de la semana', description: 'Cada día, facturables y no facturables.', icon: Clock, sizes: ['m', 'l'], size: 'm', body: Semana },
  followups: { title: 'Para hoy', description: 'Los seguimientos de leads que tocan.', icon: Bell, sizes: ['s', 'm'], size: 's', body: ParaHoy, flush: true, action: () => <More href="#/leads">Leads</More> },
  receivable: { title: 'Por cobrar', description: 'Las facturas con saldo, de la que vence antes.', icon: CircleDollar, sizes: ['s', 'm'], size: 's', body: PorCobrar, flush: true, action: () => <More href="#/cobros">Cobros</More> },
  pipeline: { title: 'Embudo', description: 'Cuántos leads hay en cada paso y cuánto hay en juego.', icon: Funnel, sizes: ['s', 'm', 'l'], size: 'm', body: Embudo, action: () => <More href="#/leads">Leads</More> },
  projects: { title: 'Proyectos en curso', description: 'Su avance, sus horas y lo que falta por cobrar.', icon: Folder, sizes: ['s', 'm', 'l'], size: 'm', body: Proyectos, flush: true, action: () => <More href="#/proyectos">Proyectos</More> },
  upcoming: { title: 'Próximos días', description: 'Vencimientos, tareas, seguimientos y publicaciones de las próximas dos semanas.', icon: Calendar, sizes: ['s', 'm', 'l'], size: 'm', body: Proximo },
  docs: { title: 'Documentos recientes', description: 'Lo último que tocaste en facturas, cotizaciones y propuestas.', icon: SquareArticle, sizes: ['s', 'm', 'l'], size: 'm', body: Recientes, flush: true, action: () => <More href="#/facturas">Facturas</More> },
  notes: { title: 'Notas', description: 'Una libreta rápida que se guarda sola.', icon: BookOpen, sizes: ['s', 'm', 'l'], size: 's', body: Notas },
  activity: { title: 'Lo último que pasó', description: 'Cobros, firmas, documentos, gastos y clientes nuevos.', icon: LayoutHeaderCellsLarge, sizes: ['s', 'm', 'l'], size: 's', body: Actividad },
};

export const DEFAULT_LAYOUT = [
  { id: 'kpis', size: 'xl' },
  { id: 'cashflow', size: 'l' },
  { id: 'shortcuts', size: 's' },
  { id: 'tasks', size: 's' },
  { id: 'receivable', size: 's' },
  { id: 'followups', size: 's' },
  { id: 'categories', size: 's' },
  { id: 'activity', size: 's' },
];

export const SIZE_CLASS = {
  s: 'col-span-12 md:col-span-6 xl:col-span-4',
  m: 'col-span-12 md:col-span-6',
  l: 'col-span-12 xl:col-span-8',
  xl: 'col-span-12',
};
export const SIZE_NAME = { s: 'Pequeño', m: 'Mediano', l: 'Grande', xl: 'Ancho completo' };

/** La disposición guardada, sin widgets que ya no existan ni tamaños que no admitan. */
export function readLayout(settings = crm.settings) {
  const saved = settings.home?.layout;
  if (!Array.isArray(saved) || !saved.length) return DEFAULT_LAYOUT;
  return saved
    .filter((w) => WIDGETS[w?.id])
    .map((w) => ({ id: w.id, size: WIDGETS[w.id].sizes.includes(w.size) ? w.size : WIDGETS[w.id].size }));
}
