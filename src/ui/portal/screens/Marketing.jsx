// Marketing del cliente: el calendario (por día, por semana o el mes entero, con el
// equilibrio entre atracción, autoridad, conversión y comunidad), el rendimiento
// frente al mes anterior en cifras y gráficos, y los leads. Cada publicación se abre en una hoja con todo lo que lleva, y lo que está
// para revisar se aprueba o se piden cambios desde ahí.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleCheck, Copy, Pencil, Xmark } from '@gravity-ui/icons';
import { Button, Card, Chip, Form, Label, Meter, ScrollShadow, Sheet, Tabs, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { BarsChart } from '../../kit/BarsChart.jsx';
import { Empty, Panel, Stat } from '../../kit/parts.jsx';
import { cap, compact, dayDate, fDay, fMonth, fMonthShort, money, num, todayKey } from '../../../portal/kit.js';
import {
  CHANNEL,
  CONTENT_STATUS,
  FORMAT,
  FUNNEL,
  LEAD_SOURCE,
  LEAD_STAGE,
  STATUS_ORDER,
  VERDICT,
  app,
  can,
  channelsOf,
  isMine,
  visibleContent,
} from '../../../portal/state.js';
import { go, save, usePortal } from '../store.js';
import { Tone } from '../ui.jsx';
import { useOpenAfterGesture } from '../../kit/hooks.js';
import { ApprovalCard, ComposedChart, DonutChart, KpiGroup, Stepper, Widget } from '../../pro/index.js';

const TABS = [
  ['calendario', 'Calendario', 'calendario'],
  ['rendimiento', 'Rendimiento', 'rendimiento'],
  ['leads', 'Leads', 'leads'],
];
const monthOf = (key) => key.slice(0, 7);
const shiftMonth = (ym, n) => {
  const d = new Date(`${ym}-15T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('en-CA').slice(0, 7);
};
const change = (a, b) => (b > 0 ? (a - b) / b : null);

const VIEWS = [
  ['dia', 'Día'],
  ['semana', 'Semana'],
  ['mes', 'Mes'],
];
const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const addDay = (key, n) => {
  const d = dayDate(key);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
const mondayOf = (key) => addDay(key, -((dayDate(key).getDay() + 6) % 7));
const fWeekDay = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' });

/** Una publicación en el calendario: su canal, título, hora y estado. */
function Item({ c, compact: small = false }) {
  return (
    <a href={`#/marketing/pieza/${c.id}`} className={`flex items-center gap-3 rounded-2xl bg-surface shadow-[var(--surface-shadow)] hover:bg-surface-hover ${small ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>
      <span className={`w-1 shrink-0 rounded-full ${small ? 'h-6' : 'h-9'}`} style={{ background: CHANNEL[channelsOf(c)[0]]?.[1] }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-medium ${small ? 'text-xs' : 'text-sm'}`}>{c.title}</span>
        {!small && (
          <span className="truncate text-xs text-muted">
            {(c.time || '').slice(0, 5)} · {FORMAT[c.format] || 'Post'} · {channelsOf(c).map((n) => CHANNEL[n]?.[0] || n).join(', ')}
          </span>
        )}
      </span>
      {!small && <Tone label={CONTENT_STATUS[c.status]?.[0]} color={CONTENT_STATUS[c.status]?.[1]} />}
    </a>
  );
}

function Calendario({ month }) {
  const [, v] = usePortal();
  const [view, setView] = useState(() => localStorage.getItem('portal-cal-vista') || 'mes');
  const [anchor, setAnchor] = useState(() => (month ? `${month}-01` : todayKey()));
  const ym = view === 'mes' ? month || monthOf(anchor) : monthOf(anchor);
  const all = useMemo(() => visibleContent().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [v]);
  const on = (day) => all.filter((c) => c.date === day);
  const items = all.filter((c) => monthOf(c.date) === ym);
  const balance = Object.keys(FUNNEL).map((k) => [k, items.filter((c) => c.funnel === k).length]);
  const total = Math.max(1, items.filter((c) => c.funnel).length);
  const pickView = (k) => {
    setView(k);
    localStorage.setItem('portal-cal-vista', k);
  };
  const step = (n) => {
    if (view === 'mes') return go(`#/marketing/calendario/${shiftMonth(ym, n)}`);
    return setAnchor((a) => addDay(a, n * (view === 'semana' ? 7 : 1)));
  };
  const monday = mondayOf(anchor);
  const title =
    view === 'mes'
      ? cap(fMonth.format(new Date(`${ym}-15T12:00:00`)))
      : view === 'semana'
        ? `Semana del ${fWeekDay.format(dayDate(monday))}`
        : cap(fDay.format(dayDate(anchor)));

  // El mes en cuadrícula, de lunes a domingo.
  const first = `${ym}-01`;
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDay(gridStart, i)).filter((d, i) => i < 35 || monthOf(d) === ym);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Anterior" onPress={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <h2 className="min-w-0 px-1 text-base font-semibold sm:text-lg">{title}</h2>
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Siguiente" onPress={() => step(1)}>
            <ChevronRight />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setAnchor(todayKey());
              if (view === 'mes') go('#/marketing/calendario');
            }}
          >
            Hoy
          </Button>
        </div>
        <ToggleButtonGroup aria-label="Vista" selectionMode="single" disallowEmptySelection size="sm" selectedKeys={new Set([view])} onSelectionChange={(k) => pickView(String([...k][0]))}>
          {VIEWS.map(([k, label], i) => (
            <ToggleButton key={k} id={k}>
              {i > 0 && <ToggleButtonGroup.Separator />}
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {view === 'mes' && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={title}>
            {WEEK.map((d) => (
              <span key={d} className="pb-1 text-[11px] font-medium text-muted">
                {d}
              </span>
            ))}
            {cells.map((day) => {
              const list = on(day);
              const out = monthOf(day) !== ym;
              const today = day === todayKey();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    pickView('dia');
                  }}
                  className={`flex min-h-14 flex-col items-center gap-1 rounded-xl p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus sm:min-h-20 ${out ? 'opacity-40' : 'bg-surface-secondary hover:bg-default'}`}
                  aria-label={`${cap(fDay.format(dayDate(day)))}: ${list.length ? `${list.length} publicaciones` : 'nada'}`}
                >
                  <span className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${today ? 'bg-accent font-semibold text-accent-foreground' : ''}`}>{Number(day.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {list.slice(0, 4).map((c) => (
                      <span key={c.id} className="size-1.5 rounded-full" style={{ background: CHANNEL[channelsOf(c)[0]]?.[1] || 'var(--accent)' }} />
                    ))}
                  </span>
                  {list[0] && <span className="hidden w-full truncate text-[10px] text-muted sm:block">{list[0].title}</span>}
                </button>
              );
            })}
          </div>
          {items.some((c) => c.funnel) && (
            <Card variant="secondary" className="gap-3 p-4">
              <span className="sw-eyebrow">Equilibrio del mes</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {balance.map(([k, n]) => (
                  <Meter key={k} value={(n / total) * 100} size="sm" aria-label={FUNNEL[k][0]} color="accent">
                    <Label className="text-xs">{FUNNEL[k][0]}</Label>
                    <Meter.Output className="text-xs">{n}</Meter.Output>
                    <Meter.Track>
                      <Meter.Fill style={{ background: FUNNEL[k][1] }} />
                    </Meter.Track>
                  </Meter>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {view === 'semana' && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => addDay(monday, i)).map((day) => {
            const list = on(day);
            return (
              <section key={day} className={`flex flex-col gap-1.5 rounded-2xl p-2 sm:flex-row sm:items-start sm:gap-3 ${day === todayKey() ? 'bg-accent-soft' : 'bg-surface-secondary'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    pickView('dia');
                  }}
                  className="shrink-0 px-1 pt-1 text-start text-xs font-semibold capitalize outline-none focus-visible:underline sm:w-16"
                >
                  {fWeekDay.format(dayDate(day))}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">{list.length ? list.map((c) => <Item key={c.id} c={c} />) : <span className="px-1 pt-1 text-xs text-muted">Nada</span>}</div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'dia' &&
        (on(anchor).length ? (
          <div className="flex flex-col gap-1.5">
            {on(anchor).map((c) => (
              <Item key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <Empty title="Nada este día" text="Prueba con otro día o mira la semana." />
        ))}

      {view === 'mes' && items.length === 0 && <Empty title="Nada programado este mes" text="Cuando el estudio prepare publicaciones, aparecerán aquí con su fecha." />}
    </div>
  );
}

function Rendimiento() {
  const [, v] = usePortal();
  const rows = useMemo(() => (app.data.metrics || []).filter((m) => m.channel === 'total').sort((a, b) => b.month.localeCompare(a.month)), [v]);
  if (!rows.length) return <Empty title="Todavía no hay resultados" text="El estudio sube los del mes al cerrarlo." />;
  const [now, prev] = rows;
  const six = rows.slice(0, 6).reverse();
  const kpi = (key, label, fmt = num) => ({ label, value: fmt(now[key] || 0), delta: prev ? change(now[key] || 0, prev[key] || 0) : null, trend: six.map((m) => m[key] || 0) });
  const months = six.map((m) => ({ key: m.month, label: fMonthShort.format(dayDate(m.month)).replace('.', ''), reach: m.reach || 0, engagement: m.engagement || 0, leads: m.leads || 0, sales: m.sales || 0 }));
  // Este mes, por red (si el estudio subió el detalle).
  const byChannel = (app.data.metrics || []).filter((m) => m.month === now.month && m.channel !== 'total' && (m.reach || 0) > 0);
  return (
    <div className="flex flex-col gap-4">
      <Widget title={cap(fMonth.format(dayDate(now.month)))} action={prev ? <span>vs. el mes anterior</span> : null}>
        <KpiGroup items={[kpi('reach', 'Alcance', compact), kpi('followers', 'Seguidores', compact), kpi('leads', 'Leads'), kpi('sales', 'Ventas', money)]} />
      </Widget>
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Alcance e interacciones" description="Últimos 6 meses">
          <ComposedChart
            title="Alcance e interacciones de los últimos 6 meses"
            xLabel="Mes"
            height={200}
            data={months}
            series={[
              { key: 'reach', name: 'Alcance', type: 'bar', color: 'var(--sw-chart-in)' },
              { key: 'engagement', name: 'Interacciones', type: 'bar', color: 'var(--sw-cat-other)' },
            ]}
            format={num}
            compact={compact}
          />
        </Widget>
        <Widget title="Leads por mes" description="Últimos 6 meses">
          <ComposedChart
            title="Leads de los últimos 6 meses"
            xLabel="Mes"
            height={200}
            data={months}
            series={[{ key: 'leads', name: 'Leads', type: 'bar', color: 'var(--success)' }]}
            format={num}
            compact={(x) => (Number.isInteger(x) ? String(x) : '')}
            showLegend={false}
          />
        </Widget>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Este mes, en detalle">
          <KpiGroup
            items={[
              kpi('engagement', 'Interacciones', compact),
              kpi('clicks', 'Clics', compact),
              kpi('posts', 'Publicaciones'),
              { label: 'Coste por lead', value: now.leads ? money((now.spend || 0) / now.leads) : '—', sub: `Inversión: ${money(now.spend || 0)}` },
            ]}
          />
        </Widget>
        {byChannel.length > 0 && (
          <Widget title="Alcance por red" description="Este mes">
            <DonutChart
              title="Alcance de este mes por red"
              parts={byChannel.map((m) => ({ key: m.channel, label: CHANNEL[m.channel]?.[0] || m.channel, value: m.reach || 0, color: CHANNEL[m.channel]?.[1] }))}
              format={num}
              totalLabel="Alcance"
              size={140}
              layout="stack"
            />
          </Widget>
        )}
      </div>
    </div>
  );
}

function Leads() {
  const [, v] = usePortal();
  const leads = useMemo(() => [...(app.data.leads || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [v]);
  if (!leads.length) return <Empty title="Todavía no hay leads" text="Las personas interesadas que lleguen por tus redes saldrán aquí." />;
  const won = leads.filter((l) => l.stage === 'ganado');
  const closed = leads.filter((l) => l.stage === 'ganado' || l.stage === 'perdido');
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Leads" value={String(leads.length)} />
        <Stat label="Ganados" value={String(won.length)} />
        <Stat label="Conversión" value={closed.length ? `${Math.round((won.length / closed.length) * 100)} %` : '—'} />
      </div>
      <ul className="flex flex-col gap-1.5">
        {leads.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 shadow-[var(--surface-shadow)]">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{l.name}</span>
              <span className="truncate text-xs text-muted">
                {LEAD_SOURCE[l.source] || 'Otro'}
                {l.campaign ? ` · ${l.campaign}` : ''}
                {l.value ? ` · ${money(l.value)}` : ''}
              </span>
            </span>
            <Tone label={LEAD_STAGE[l.stage]?.[0] || l.stage} color={LEAD_STAGE[l.stage]?.[1]} />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.danger('No se pudo copiar');
  }
}

/** La ficha de una publicación, en una hoja que sube desde abajo. */
function Pieza({ id }) {
  const [, v] = usePortal();
  const c = (app.data.content || []).find((x) => x.id === id);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const ready = useOpenAfterGesture();
  if (!c) return null;
  const client = !app.studio;
  const ownIdea = c.origin === 'client' && isMine(c);
  const canDecide = client && c.status === 'review' && !c.client_verdict && can('content.approve');
  const canReject = client && !ownIdea && can('content.reject') && !['scheduled', 'published'].includes(c.status) && c.client_verdict !== 'rejected';
  const at = STATUS_ORDER.indexOf(c.status);
  const verdict = VERDICT[c.client_verdict];
  const tags = String(c.hashtags || '')
    .split(/\s+/)
    .filter(Boolean);

  const decide = async (kind, note = '') => {
    setBusy(true);
    try {
      await save('content', { id: c.id, client_verdict: kind, client_note: note || null });
      toast.success(kind === 'approved' ? '¡Aprobada! El estudio ya lo sabe.' : kind === 'changes' ? 'Le pediste cambios al estudio.' : 'Rechazada.');
      setAsking(null);
    } catch (err) {
      toast.danger('No se guardó', { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet isOpen={ready} onOpenChange={(open) => ready && !open && go('#/marketing')}>
      <Sheet.Backdrop>
        <Sheet.Content className="mx-auto max-h-[92vh] w-full max-w-[640px]">
          <Sheet.Dialog data-v={v}>
            <Sheet.Handle />
            <Sheet.CloseTrigger />
            <Sheet.Header className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap gap-1.5">
                {channelsOf(c).map((n) => (
                  <Tone key={n} label={CHANNEL[n]?.[0] || n} color={CHANNEL[n]?.[1]} />
                ))}
                <Chip size="sm" variant="tertiary">
                  {FORMAT[c.format] || 'Post'}
                </Chip>
                {c.funnel && <Tone label={FUNNEL[c.funnel]?.[0]} color={FUNNEL[c.funnel]?.[1]} />}
              </div>
              <Sheet.Heading className="text-xl font-semibold">{c.title}</Sheet.Heading>
              <span className="text-sm text-muted">
                {cap(fDay.format(dayDate(c.date)))}
                {c.time ? `, ${c.time.slice(0, 5)}` : ''}
              </span>
            </Sheet.Header>
            <Sheet.Body className="flex flex-col gap-4 overflow-y-auto pb-2">
              <ScrollShadow orientation="horizontal" hideScrollBar className="-mx-1 px-1">
                <Stepper
                  orientation="horizontal"
                  numbered={false}
                  label="Etapas de la pieza"
                  className="min-w-[30rem]"
                  current={c.status === STATUS_ORDER[STATUS_ORDER.length - 1] ? STATUS_ORDER.length : Math.max(0, at)}
                  steps={STATUS_ORDER.map((k) => ({ id: k, title: CONTENT_STATUS[k][0] }))}
                />
              </ScrollShadow>
              {canDecide && !asking && (
                <ApprovalCard
                  title="¿Apruebas esta pieza?"
                  subtitle="El estudio la publica tal cual cuando la apruebes."
                  details={[
                    ['Fecha', `${cap(fDay.format(dayDate(c.date)))}${c.time ? `, ${c.time.slice(0, 5)}` : ''}`],
                    ['Formato', FORMAT[c.format] || 'Post'],
                    ['Dónde', channelsOf(c).map((n) => CHANNEL[n]?.[0] || n).join(', ') || '—'],
                    ...(c.funnel ? [['Para', FUNNEL[c.funnel]?.[0]]] : []),
                  ]}
                  approveLabel="Aprobar"
                  onApprove={() => decide('approved')}
                  middle={{ label: 'Pedir cambios', onPress: () => setAsking('changes') }}
                  rejectLabel="Rechazar"
                  onReject={canReject ? () => setAsking('rejected') : undefined}
                  isBusy={busy}
                />
              )}
              {verdict && (
                <p className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
                  <span className="size-2 rounded-full" style={{ background: verdict[3] }} />
                  {client && c.client_verdict_by === app.user?.id ? verdict[1] : `${c.client_verdict_name || 'Tu equipo'} ${verdict[2]}`}
                  {c.client_note && <span className="text-muted">«{c.client_note}»</span>}
                </p>
              )}
              {[
                ['Objetivo', c.objective],
                ['Llamada a la acción', c.cta],
              ]
                .filter(([, t]) => t)
                .map(([label, t]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="sw-eyebrow">{label}</span>
                    <p className="text-sm">{t}</p>
                  </div>
                ))}
              {c.caption && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="sw-eyebrow">Texto de la publicación</span>
                    <Button size="sm" variant="ghost" onPress={() => copy(`${c.caption}${c.hashtags ? `\n\n${c.hashtags}` : ''}`, 'Texto copiado')}>
                      <Copy />
                      Copiar
                    </Button>
                  </div>
                  <p className="whitespace-pre-line rounded-2xl bg-surface-secondary p-3 text-sm">{c.caption}</p>
                </div>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Chip key={t} size="sm" variant="soft" color="accent">
                      {t}
                    </Chip>
                  ))}
                </div>
              )}
              {c.script && (
                <div className="flex flex-col gap-1">
                  <span className="sw-eyebrow">Guion{c.duration ? ` · ${c.duration}` : ''}</span>
                  <ol className="flex flex-col gap-1 text-sm">
                    {c.script
                      .split('\n')
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="rounded-xl bg-surface-secondary px-3 py-1.5">
                          {line}
                        </li>
                      ))}
                  </ol>
                </div>
              )}
              {c.production?.headline && (
                <div className="flex flex-col gap-1">
                  <span className="sw-eyebrow">Texto en la pieza</span>
                  <p className="text-lg font-semibold">{c.production.headline}</p>
                </div>
              )}
              {asking && (
                <Form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    decide(asking, String(new FormData(e.currentTarget).get('note') || '').trim());
                  }}
                >
                  <TextField name="note" isRequired={asking === 'changes'} autoFocus maxLength={1000}>
                    <Label>{asking === 'changes' ? '¿Qué cambiarías?' : '¿Por qué la rechazas? (opcional)'}</Label>
                    <TextArea rows={3} />
                  </TextField>
                  <div className="flex gap-2">
                    <Button type="submit" isPending={busy} variant={asking === 'rejected' ? 'danger' : 'primary'}>
                      {asking === 'changes' ? 'Pedir cambios' : 'Rechazar'}
                    </Button>
                    <Button variant="tertiary" onPress={() => setAsking(null)}>
                      Cancelar
                    </Button>
                  </div>
                </Form>
              )}
            </Sheet.Body>
            {!canDecide && canReject && !asking && (
              <Sheet.Footer className="flex flex-wrap gap-2">
                {canReject && (
                  <Button variant="danger-soft" onPress={() => setAsking('rejected')}>
                    <Xmark />
                    Rechazar
                  </Button>
                )}
              </Sheet.Footer>
            )}
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

export function Marketing({ tab, arg }) {
  usePortal();
  const tabs = TABS.filter(([, , perm]) => can(perm));
  const pieceId = tab === 'pieza' ? arg : null;
  const current = tabs.find(([k]) => k === tab)?.[0] || tabs[0]?.[0];
  if (!tabs.length) return <Empty title="Esta sección no está activada" text="Pídele a Schwarck que la active en tu portal." />;
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted">Tu calendario de contenido y cómo le va a tu marca.</p>
      </header>
      <Tabs selectedKey={pieceId ? 'calendario' : current} onSelectionChange={(k) => go(`#/marketing/${k}`)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Marketing">
            {tabs.map(([k, label]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {(pieceId || current === 'calendario') && <Calendario month={tab === 'calendario' ? arg : null} />}
      {!pieceId && current === 'rendimiento' && <Rendimiento />}
      {!pieceId && current === 'leads' && <Leads />}
      {pieceId && <Pieza id={pieceId} />}
    </div>
  );
}
