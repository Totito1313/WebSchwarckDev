// Marketing del cliente: el calendario del mes (con el equilibrio entre atracción,
// autoridad, conversión y comunidad), el rendimiento frente al mes anterior y los
// leads. Cada publicación se abre en una hoja con todo lo que lleva, y lo que está
// para revisar se aprueba o se piden cambios desde ahí.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleCheck, Copy, Pencil, Xmark } from '@gravity-ui/icons';
import { Button, Card, Chip, Form, Label, Meter, Sheet, Tabs, TextArea, TextField, toast } from '@heroui/react';
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

function Calendario({ month }) {
  const [, v] = usePortal();
  const ym = month || monthOf(todayKey());
  const items = useMemo(
    () =>
      visibleContent()
        .filter((c) => monthOf(c.date) === ym)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [v, ym],
  );
  const byDay = useMemo(() => {
    const m = new Map();
    for (const c of items) {
      if (!m.has(c.date)) m.set(c.date, []);
      m.get(c.date).push(c);
    }
    return [...m];
  }, [items]);
  const balance = Object.keys(FUNNEL).map((k) => [k, items.filter((c) => c.funnel === k).length]);
  const total = Math.max(1, items.filter((c) => c.funnel).length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button isIconOnly variant="tertiary" aria-label="Mes anterior" onPress={() => go(`#/marketing/calendario/${shiftMonth(ym, -1)}`)}>
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-semibold">{cap(fMonth.format(new Date(`${ym}-15T12:00:00`)))}</h2>
        <Button isIconOnly variant="tertiary" aria-label="Mes siguiente" onPress={() => go(`#/marketing/calendario/${shiftMonth(ym, 1)}`)}>
          <ChevronRight />
        </Button>
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
      {byDay.length === 0 ? (
        <Empty title="Nada programado este mes" text="Cuando el estudio prepare publicaciones, aparecerán aquí con su fecha." />
      ) : (
        byDay.map(([day, list]) => (
          <section key={day} className="flex flex-col gap-1.5">
            <h3 className={`sw-eyebrow ${day === todayKey() ? 'text-accent' : ''}`}>{cap(fDay.format(dayDate(day)))}</h3>
            {list.map((c) => (
              <a key={c.id} href={`#/marketing/pieza/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 shadow-[var(--surface-shadow)] hover:bg-surface-hover">
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: CHANNEL[channelsOf(c)[0]]?.[1] }} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.title}</span>
                  <span className="truncate text-xs text-muted">
                    {(c.time || '').slice(0, 5)} · {FORMAT[c.format] || 'Post'} · {channelsOf(c).map((n) => CHANNEL[n]?.[0] || n).join(', ')}
                  </span>
                </span>
                <Tone label={CONTENT_STATUS[c.status]?.[0]} color={CONTENT_STATUS[c.status]?.[1]} />
              </a>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Rendimiento() {
  const [, v] = usePortal();
  const rows = useMemo(() => (app.data.metrics || []).filter((m) => m.channel === 'total').sort((a, b) => b.month.localeCompare(a.month)), [v]);
  if (!rows.length) return <Empty title="Todavía no hay resultados" text="El estudio sube los del mes al cerrarlo." />;
  const [now, prev] = rows;
  const stat = (key, label, fmt = num) => <Stat label={label} value={fmt(now[key] || 0)} delta={prev ? change(now[key] || 0, prev[key] || 0) : null} sub={prev ? 'frente al mes anterior' : undefined} />;
  const six = rows.slice(0, 6).reverse();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{cap(fMonth.format(dayDate(now.month)))}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('reach', 'Alcance', compact)}
        {stat('followers', 'Seguidores', compact)}
        {stat('leads', 'Leads')}
        {stat('sales', 'Ventas', money)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('engagement', 'Interacciones', compact)}
        {stat('clicks', 'Clics', compact)}
        {stat('posts', 'Publicaciones')}
        <Stat label="Coste por lead" value={now.leads ? money((now.spend || 0) / now.leads) : '—'} sub={`Inversión: ${money(now.spend || 0)}`} />
      </div>
      <Panel title="Alcance" description="Últimos 6 meses">
        <BarsChart
          title="Alcance de los últimos 6 meses"
          groups={six.map((m) => ({ key: m.month, label: fMonthShort.format(dayDate(m.month)).replace('.', ''), values: [m.reach || 0] }))}
          series={[{ name: 'Alcance', color: 'var(--sw-chart-in)' }]}
          format={num}
          compact={compact}
        />
      </Panel>
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
              <ol className="flex gap-1" aria-label="Etapas">
                {STATUS_ORDER.map((k, i) => (
                  <li key={k} className="flex flex-1 flex-col gap-1">
                    <span className="h-1.5 rounded-full" style={{ background: i <= at ? CONTENT_STATUS[k][1] : 'var(--default)' }} />
                    <span className={`truncate text-[10px] ${i === at ? 'font-medium' : 'text-muted'}`}>{CONTENT_STATUS[k][0]}</span>
                  </li>
                ))}
              </ol>
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
            {(canDecide || canReject) && !asking && (
              <Sheet.Footer className="flex flex-wrap gap-2">
                {canDecide && (
                  <>
                    <Button isPending={busy} onPress={() => decide('approved')} className="flex-1">
                      <CircleCheck />
                      Aprobar
                    </Button>
                    <Button variant="secondary" onPress={() => setAsking('changes')} className="flex-1">
                      <Pencil />
                      Pedir cambios
                    </Button>
                  </>
                )}
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
