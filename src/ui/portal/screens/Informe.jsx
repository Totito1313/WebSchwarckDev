// El informe del mes (#/informe/2026-11): el trabajo del estudio (tareas y horas por
// área), lo publicado, los resultados frente al mes anterior, los leads, los hitos y
// las reuniones, y el proyecto. Con la marca del cliente; «PDF» lo imprime limpio (sin
// barras ni botones) y «Compartir» manda un resumen. Solo enseña lo que esa persona
// tiene permiso para ver.
import { ArrowShapeTurnUpRight, ChartColumn, Check, ChevronLeft, ChevronRight, Flag, Printer } from '@gravity-ui/icons';
import { Avatar, Button, Card, Link, toast } from '@heroui/react';
import { cap, compact, dayDate, fDay, fMonth, minutesText, money, num, shortDate, todayKey } from '../../../portal/kit.js';
import { CHANNEL, FORMAT, LEAD_STAGE, MEETING_STATUS, POST_KIND, app, can, channelsOf, currentProject, has, urlOf, visibleContent } from '../../../portal/state.js';
import { usePortal } from '../store.js';
import { KpiGroup, Widget } from '../../pro/index.js';
import { Empty } from '../../kit/parts.jsx';

const ym = (key) => key.slice(0, 7);
const shift = (month, n) => {
  const d = new Date(`${month}-15T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('en-CA').slice(0, 7);
};
/** El mes que se enseña por defecto: los primeros días, el que acaba de cerrar. */
export const defaultReportMonth = () => (new Date().getDate() <= 7 ? shift(ym(todayKey()), -1) : ym(todayKey()));
const label = (month) => fMonth.format(dayDate(`${month}-15`));
const first = (month) => cap(label(month).split(' ')[0]);
const localMonth = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA').slice(0, 7) : '');
const change = (a, b) => (b ? (a - b) / b : null);

/** Barras horizontales sencillas (horas por área, leads por etapa). */
function Bars({ rows }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-default">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: r.color || 'var(--accent)' }} />
          </span>
          <span className="tabular-nums font-medium">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Line({ icon: Icon, children, sub }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">{children}</span>
      {sub && <span className="shrink-0 text-xs text-muted">{sub}</span>}
    </li>
  );
}

/** En Inicio, la primera semana del mes: el informe del que acaba de cerrar. */
export function ReportCard() {
  usePortal();
  if (new Date().getDate() > 7) return null;
  const month = defaultReportMonth();
  const any = app.data.work.some((w) => w.status === 'done' && ym(w.day) === month) || app.data.content.some((c) => c.status === 'published' && ym(c.date) === month);
  if (!any) return null;
  return (
    <a href={`#/informe/${month}`} className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <ChartColumn className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="sw-eyebrow">Ya está listo</span>
        <span className="font-semibold">Tu informe de {label(month).split(' ')[0]}</span>
        <span className="text-xs text-muted">El trabajo, lo publicado y los resultados del mes, en PDF.</span>
      </span>
      <ChevronRight className="size-4 text-muted" />
    </a>
  );
}

export function Informe({ month: wanted }) {
  usePortal();
  const month = /^\d{4}-\d{2}$/.test(wanted || '') ? wanted : defaultReportMonth();
  const d = app.data;
  const prev = shift(month, -1);
  const now = ym(todayKey());

  const work = can('reporte') ? d.work.filter((w) => w.status === 'done' && ym(w.day) === month) : [];
  const minutes = work.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const byCat = new Map();
  for (const w of work) byCat.set(w.category || 'Otros', (byCat.get(w.category || 'Otros') || 0) + (Number(w.minutes) || 0));

  const content = can('calendario') ? visibleContent() : [];
  const published = content.filter((c) => c.status === 'published' && ym(c.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const byNet = new Map();
  for (const c of published) for (const ch of channelsOf(c)) byNet.set(ch, (byNet.get(ch) || 0) + 1);
  const nextMonth = content.filter((c) => ym(c.date) === shift(month, 1)).length;

  const metric = (m) => (can('rendimiento') ? d.metrics.find((x) => x.channel === 'total' && ym(x.month) === m) : null);
  const cur = metric(month);
  const before = metric(prev);

  const leads = can('leads') ? d.leads.filter((l) => ym(l.date || '') === month) : [];
  const won = leads.filter((l) => l.stage === 'ganado');
  const tasksDone = can('peticiones') ? d.tasks.filter((t) => t.status === 'done' && localMonth(t.done_at) === month) : [];
  const milestones = d.posts.filter((p) => ['milestone', 'delivery', 'report'].includes(p.kind) && localMonth(p.occurred_at) === month);
  const meetings = has('meetings') ? d.meetings.filter((m) => m.starts_at && localMonth(m.starts_at) === month && ['confirmed', 'done'].includes(m.status)) : [];
  const project = month === now ? currentProject() : null;

  const kpis = [
    can('reporte') && { label: 'Tareas hechas', value: num(work.length), sub: minutes ? `${minutesText(minutes)} de trabajo` : null },
    can('calendario') && { label: 'Publicaciones', value: num(published.length), sub: byNet.size ? [...byNet].map(([k, n]) => `${n} en ${CHANNEL[k]?.[0] || k}`).slice(0, 2).join(' · ') : null },
    cur && { label: 'Alcance', value: compact(cur.reach || 0), delta: before?.reach ? change(cur.reach || 0, before.reach) : null, deltaLabel: `frente a ${first(prev).toLowerCase()}` },
    (cur || can('leads')) && { label: 'Leads', value: num(cur ? cur.leads || 0 : leads.length), sub: won.length ? `${won.length} ${won.length === 1 ? 'ganado' : 'ganados'}` : null },
  ].filter(Boolean);
  const extra = [tasksDone.length > 0 && `${tasksDone.length} ${tasksDone.length === 1 ? 'petición resuelta' : 'peticiones resueltas'}`, meetings.length > 0 && `${meetings.length} ${meetings.length === 1 ? 'reunión' : 'reuniones'}`].filter(Boolean);

  const results = cur
    ? [
        ['Alcance', 'reach'],
        ['Impresiones', 'impressions'],
        ['Interacciones', 'engagement'],
        ['Seguidores nuevos', 'new_followers'],
        ['Clics', 'clicks'],
        ['Leads', 'leads'],
        ['Ventas', 'sales', true],
        ['Inversión', 'spend', true],
      ].filter(([, k]) => cur[k] != null && cur[k] !== 0)
    : [];

  const share = async () => {
    const lines = [
      `Informe de ${label(month)} · ${app.client.name}`,
      work.length && `✅ ${work.length} tareas hechas${minutes ? ` (${minutesText(minutes)})` : ''}`,
      published.length && `📣 ${published.length} publicaciones`,
      cur?.reach && `👀 ${num(cur.reach)} de alcance`,
      (cur?.leads || leads.length) && `🎯 ${cur?.leads || leads.length} leads${won.length ? `, ${won.length} ganados` : ''}`,
      `${location.origin}/cliente-nuevo/#/informe/${month}`,
    ]
      .filter(Boolean)
      .join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: `Informe de ${label(month)}`, text: lines });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Resumen copiado');
    } catch {
      toast.danger('No se pudo copiar');
    }
  };

  const logo = urlOf(app.client.logo_url);
  const empty = !work.length && !published.length && !cur && !leads.length && !milestones.length && !meetings.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Herramientas: cambiar de mes, compartir y PDF (no salen al imprimir). */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button isIconOnly size="sm" variant="secondary" aria-label="Mes anterior" onPress={() => (location.hash = `#/informe/${prev}`)}>
          <ChevronLeft />
        </Button>
        <span className="min-w-28 text-center text-sm font-semibold">{cap(label(month))}</span>
        <Button isIconOnly size="sm" variant="secondary" aria-label="Mes siguiente" isDisabled={month >= now} onPress={() => (location.hash = `#/informe/${shift(month, 1)}`)}>
          <ChevronRight />
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onPress={share}>
          <ArrowShapeTurnUpRight />
          Compartir
        </Button>
        <Button size="sm" onPress={() => window.print()}>
          <Printer />
          PDF
        </Button>
      </div>

      <header className="flex items-center gap-4">
        <Avatar size="lg" className="size-16 shrink-0">
          {logo && <Avatar.Image alt="" src={logo} />}
          <Avatar.Fallback style={{ background: app.client.accent || 'var(--accent)', color: '#fff' }}>{app.client.name.slice(0, 1)}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-muted">{app.client.name}</span>
          <h1 className="text-3xl font-semibold tracking-tight">Informe de {label(month)}</h1>
          <span className="text-xs text-muted">Preparado por Schwarck Developer · {fDay.format(new Date())}</span>
        </div>
      </header>

      {kpis.length > 0 && (
        <Widget title="El mes en cifras" description={extra.join(' · ') || null} className="break-inside-avoid">
          <KpiGroup items={kpis} />
        </Widget>
      )}

      {empty && <Empty icon={ChartColumn} title="Nada que contar todavía" text={`No hay trabajo, publicaciones ni resultados de ${label(month)}.`} />}

      {work.length > 0 && (
        <Widget title="El trabajo del mes" description={`${work.length} ${work.length === 1 ? 'tarea' : 'tareas'}${minutes ? ` · ${minutesText(minutes)}` : ''}`} className="break-inside-avoid">
          {byCat.size > 1 && minutes > 0 && (
            <div className="mb-4">
              <Bars rows={[...byCat].sort((a, b) => b[1] - a[1]).map(([cat, m]) => ({ label: cat, value: m, text: minutesText(m) || '—' }))} />
            </div>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {[...work]
              .sort((a, b) => b.day.localeCompare(a.day))
              .slice(0, 14)
              .map((w) => (
                <Line key={w.id} icon={Check} sub={[w.category, shortDate(w.day)].filter(Boolean).join(' · ')}>
                  {w.title}
                </Line>
              ))}
          </ul>
          {work.length > 14 && <p className="pt-2 text-xs text-muted">y {work.length - 14} más</p>}
        </Widget>
      )}

      {published.length > 0 && (
        <Widget title="Lo que se publicó" description={`${published.length} ${published.length === 1 ? 'publicación' : 'publicaciones'}`} className="break-inside-avoid">
          <ul className="flex flex-col divide-y divide-border">
            {published.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                <span className="flex shrink-0 gap-1">
                  {channelsOf(c).map((ch) => (
                    <span key={ch} className="size-2.5 rounded-full" style={{ background: CHANNEL[ch]?.[1] }} title={CHANNEL[ch]?.[0]} />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {FORMAT[c.format] || ''} · {shortDate(c.date)}
                </span>
              </li>
            ))}
          </ul>
        </Widget>
      )}

      {results.length > 0 && (
        <Widget title="Resultados" description={before ? `Frente a ${label(prev)}` : null} className="break-inside-avoid" flush>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-4 py-2 text-start font-normal" />
                <th className="px-2 py-2 text-end font-normal">{first(month)}</th>
                {before && <th className="px-2 py-2 text-end font-normal">{first(prev)}</th>}
                {before && <th className="px-4 py-2 text-end font-normal">Cambio</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map(([name, k, isMoney]) => {
                const fmt = (v) => (isMoney ? money(v) : num(v));
                const ch = before ? change(cur[k], before[k]) : null;
                return (
                  <tr key={k}>
                    <td className="px-4 py-2">{name}</td>
                    <td className="px-2 py-2 text-end font-medium tabular-nums">{fmt(cur[k])}</td>
                    {before && <td className="px-2 py-2 text-end tabular-nums text-muted">{before[k] != null ? fmt(before[k]) : '—'}</td>}
                    {before && (
                      <td className={`px-4 py-2 text-end tabular-nums ${ch == null ? 'text-muted' : ch >= 0 ? 'text-success' : 'text-danger'}`}>{ch == null ? '—' : `${ch >= 0 ? '+' : ''}${Math.round(ch * 100)}%`}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Widget>
      )}

      {leads.length > 0 && (
        <Widget title="Clientes nuevos" description={`${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}${won.length ? ` · ${money(won.reduce((s, l) => s + (Number(l.value) || 0), 0))} ganados` : ''}`} className="break-inside-avoid">
          <Bars
            rows={Object.keys(LEAD_STAGE)
              .map((k) => [k, leads.filter((l) => l.stage === k).length])
              .filter(([, n]) => n)
              .map(([k, n]) => ({ label: LEAD_STAGE[k][0], value: n, text: String(n), color: LEAD_STAGE[k][1] }))}
          />
        </Widget>
      )}

      {(milestones.length > 0 || meetings.length > 0) && (
        <Widget title="Hitos, entregas y reuniones" className="break-inside-avoid">
          <ul className="flex flex-col divide-y divide-border">
            {milestones.map((p) => (
              <Line key={p.id} icon={Flag} sub={`${POST_KIND[p.kind]?.[0]} · ${shortDate(new Date(p.occurred_at).toLocaleDateString('en-CA'))}`}>
                {p.title}
              </Line>
            ))}
            {meetings.map((m) => (
              <Line key={m.id} icon={Check} sub={`${MEETING_STATUS[m.status]?.[0]} · ${shortDate(new Date(m.starts_at).toLocaleDateString('en-CA'))}`}>
                {m.topic}
              </Line>
            ))}
          </ul>
        </Widget>
      )}

      {project && (
        <Card className="break-inside-avoid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="sw-eyebrow">El proyecto hoy</span>
            <Link href="#/proyecto" className="text-sm print:hidden">
              Ver
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <span className="font-semibold">{project.name}</span>
          <span className="text-xs text-muted">
            {(project.stages || []).filter((s) => s.done).length} de {(project.stages || []).length} etapas · {project.tasks_done} de {project.tasks_total} tareas
            {project.due_date ? ` · entrega el ${shortDate(project.due_date)}` : ''}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-default">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${project.tasks_total ? (project.tasks_done / project.tasks_total) * 100 : 0}%` }} />
          </span>
        </Card>
      )}

      {nextMonth > 0 && (
        <p className="text-sm text-muted">
          En {label(shift(month, 1)).split(' ')[0]} hay {nextMonth} {nextMonth === 1 ? 'publicación' : 'publicaciones'} en el calendario.
        </p>
      )}
    </div>
  );
}
