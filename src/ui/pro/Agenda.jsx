// Agenda con vistas de día, semana y mes, inspirada en la «Agenda» de HeroUI Pro y
// hecha desde cero: rejilla por horas, fila de «todo el día», eventos con un velo de
// su color y un filo a la izquierda, la línea roja de «ahora» y los que se pisan
// repartidos en columnas. Clic en un evento para abrirlo; clic en un hueco para
// crear uno a esa hora (si se pasa onCreate).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@gravity-ui/icons';
import { Button, ButtonGroup, ScrollShadow, Tabs } from '@heroui/react';

const HOUR = 48; // alto de una hora, en px
const DAY_MS = 86400000;

const toDate = (v) => (v instanceof Date ? v : new Date(v));
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfWeek = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // lunes

const fmt = (opts) => new Intl.DateTimeFormat('es-VE', opts);
const fTime = fmt({ hour: 'numeric', minute: '2-digit' });
const fMonth = fmt({ month: 'long', year: 'numeric' });
const fWeekday = fmt({ weekday: 'short' });
const fDayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });

/** Reparte en columnas los eventos que se pisan dentro de un mismo día. */
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = [];
    for (const ev of cluster) {
      let c = cols.findIndex((end) => end <= ev.s);
      if (c === -1) {
        c = cols.length;
        cols.push(ev.e);
      } else cols[c] = ev.e;
      ev.col = c;
    }
    for (const ev of cluster) out.push({ ...ev, cols: cols.length });
    cluster = [];
  };
  for (const ev of sorted) {
    if (ev.s >= clusterEnd && cluster.length) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  if (cluster.length) flush();
  return out;
}

function tint(color, pct) {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

/**
 * events: [{ id, title, start, end?, allDay?, color?, description? }]
 * onOpen(event), onCreate?(date), view/onViewChange opcionales.
 */
export function Agenda({ events, onOpen, onCreate, defaultView = 'week', view: viewProp, onViewChange, defaultDate, startHour = 0, endHour = 24, scrollToHour = 8, height = 560 }) {
  const [viewState, setViewState] = useState(defaultView);
  const view = viewProp || viewState;
  const setView = (v) => (onViewChange ? onViewChange(v) : setViewState(v));
  const [anchor, setAnchor] = useState(() => startOfDay(defaultDate ? toDate(defaultDate) : new Date()));
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const evs = useMemo(
    () =>
      events
        .map((e) => {
          const start = toDate(e.start);
          const end = e.end ? toDate(e.end) : new Date(start.getTime() + 3600000);
          return { ...e, start, end: end > start ? end : new Date(start.getTime() + 1800000), color: e.color || 'var(--accent)' };
        })
        .filter((e) => !Number.isNaN(e.start.getTime())),
    [events],
  );

  const days = view === 'day' ? [anchor] : view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [];

  useEffect(() => {
    if (view === 'month' || !scroller.current) return;
    const h = days.some((d) => sameDay(d, now)) ? Math.max(startHour, now.getHours() - 1) : scrollToHour;
    scroller.current.scrollTop = Math.max(0, (h - startHour) * HOUR);
    // Solo al cambiar de vista o de tramo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor.getTime()]);

  const step = (dir) => {
    if (view === 'day') setAnchor((a) => addDays(a, dir));
    else if (view === 'week') setAnchor((a) => addDays(a, 7 * dir));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const title = view === 'day' ? fDayLong.format(anchor) : fMonth.format(view === 'week' ? addDays(startOfWeek(anchor), 3) : anchor);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold first-letter:uppercase">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs selectedKey={view} onSelectionChange={(k) => setView(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Vista">
                {[
                  ['day', 'Día'],
                  ['week', 'Semana'],
                  ['month', 'Mes'],
                ].map(([k, t]) => (
                  <Tabs.Tab key={k} id={k}>
                    {t}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <ButtonGroup size="sm" variant="tertiary">
            <Button isIconOnly aria-label="Anterior" onPress={() => step(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button onPress={() => setAnchor(startOfDay(new Date()))}>
              <ButtonGroup.Separator />
              Hoy
            </Button>
            <Button isIconOnly aria-label="Siguiente" onPress={() => step(1)}>
              <ButtonGroup.Separator />
              <ChevronRight className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid anchor={anchor} events={evs} now={now} onOpen={onOpen} onPickDay={(d) => { setAnchor(d); setView('day'); }} />
      ) : (
        <TimeGrid days={days} events={evs} now={now} onOpen={onOpen} onCreate={onCreate} scroller={scroller} startHour={startHour} endHour={endHour} height={height} />
      )}
    </div>
  );
}

function TimeGrid({ days, events, now, onOpen, onCreate, scroller, startHour, endHour, height }) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const cols = `3.5rem repeat(${days.length}, minmax(${days.length > 1 ? '6.5rem' : '0'}, 1fr))`;
  const allDay = days.map((d) => events.filter((e) => (e.allDay || e.end - e.start >= DAY_MS) && e.start < addDays(d, 1) && e.end > d));
  const hasAllDay = allDay.some((l) => l.length);

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)]">
      <ScrollShadow orientation="horizontal" hideScrollBar>
        <div style={{ minWidth: days.length > 1 ? 56 + days.length * 104 : undefined }}>
          {/* Cabecera de días */}
          <div className="grid border-b border-separator" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d) => {
              const today = sameDay(d, now);
              return (
                <div key={d.toISOString()} className="flex items-center justify-center gap-1.5 px-1 py-2.5 text-xs text-muted">
                  <span className="capitalize">{fWeekday.format(d).replace('.', '')}</span>
                  <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-semibold tabular-nums ${today ? 'bg-danger text-danger-foreground' : 'text-foreground'}`}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Todo el día */}
          {hasAllDay && (
            <div className="grid border-b border-separator" style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-1.5 text-end text-[10px] text-muted">todo el día</div>
              {allDay.map((list, i) => (
                <div key={i} className="flex flex-col gap-1 border-s border-separator p-1">
                  {list.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpen?.(e)}
                      className="truncate rounded-lg px-2 py-0.5 text-start text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      style={{ background: tint(e.color, 85), color: 'white' }}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {/* Horas */}
          <div ref={scroller} className="relative overflow-y-auto" style={{ maxHeight: height }}>
            <div className="relative grid" style={{ gridTemplateColumns: cols, height: hours.length * HOUR }}>
              <div className="relative">
                {hours.map((h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted tabular-nums" style={{ top: (h - startHour) * HOUR }}>
                    {h === startHour ? '' : `${String(h).padStart(2, '0')}:00`}
                  </span>
                ))}
              </div>
              {days.map((d) => {
                const dayStart = d.getTime() + startHour * 3600000;
                const dayEnd = d.getTime() + endHour * 3600000;
                const list = layoutDay(
                  events
                    .filter((e) => !e.allDay && e.end - e.start < DAY_MS && e.start.getTime() < dayEnd && e.end.getTime() > dayStart)
                    .map((e) => ({ ...e, s: Math.max(e.start.getTime(), dayStart), e: Math.min(e.end.getTime(), dayEnd) })),
                );
                const today = sameDay(d, now);
                return (
                  <div
                    key={d.toISOString()}
                    className={`relative border-s border-separator ${today ? 'bg-accent/[0.03]' : ''}`}
                    onClick={(ev) => {
                      if (!onCreate || ev.target !== ev.currentTarget) return;
                      const y = ev.nativeEvent.offsetY;
                      const mins = Math.floor(((y / HOUR) * 60) / 30) * 30;
                      onCreate(new Date(dayStart + mins * 60000));
                    }}
                  >
                    {hours.map((h) => (
                      <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-separator" style={{ top: (h - startHour) * HOUR }} />
                    ))}
                    {list.map((e) => {
                      const top = ((e.s - dayStart) / 3600000) * HOUR;
                      const h = Math.max(22, ((e.e - e.s) / 3600000) * HOUR - 2);
                      const w = 100 / e.cols;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onOpen?.(e)}
                          title={`${e.title} · ${fTime.format(e.start)}`}
                          className="absolute overflow-hidden rounded-lg border-s-[3px] px-1.5 py-1 text-start outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-focus"
                          style={{
                            top: top + 1,
                            height: h,
                            left: `calc(${e.col * w}% + 2px)`,
                            width: `calc(${w}% - 4px)`,
                            background: tint(e.color, 16),
                            borderColor: e.color,
                          }}
                        >
                          <span className="block truncate text-xs font-semibold leading-tight">{e.title}</span>
                          {h > 34 && (
                            <span className="block truncate text-[10px] text-muted tabular-nums">
                              {fTime.format(e.start)} – {fTime.format(e.end)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {/* Ahora */}
              {days.some((d) => sameDay(d, now)) && now.getHours() >= startHour && now.getHours() < endHour && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (now.getHours() - startHour + now.getMinutes() / 60) * HOUR }}>
                  <div className="relative ms-14 border-t-2 border-danger">
                    <span className="absolute -top-2.5 -left-14 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-danger-foreground tabular-nums">
                      {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollShadow>
    </div>
  );
}

function MonthGrid({ anchor, events, now, onOpen, onPickDay }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = cells.slice(0, 7).map((d) => fWeekday.format(d).replace('.', ''));
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)]">
      <div className="grid grid-cols-7 border-b border-separator">
        {weekdays.map((w) => (
          <div key={w} className="py-2 text-center text-xs text-muted capitalize">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const list = events.filter((e) => e.start < addDays(d, 1) && e.end > d).sort((a, b) => a.start - b.start);
          const out = d.getMonth() !== anchor.getMonth();
          const today = sameDay(d, now);
          return (
            <div key={i} className={`flex min-h-24 min-w-0 flex-col gap-0.5 border-separator p-1 ${i % 7 ? 'border-s' : ''} ${i >= 7 ? 'border-t' : ''} ${out ? 'bg-surface-secondary/60' : ''}`}>
              <button
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={`Ver el ${fDayLong.format(d)}`}
                className={`mb-0.5 flex h-6 min-w-6 items-center justify-center self-end rounded-full px-1 text-xs tabular-nums outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus ${
                  today ? 'bg-danger font-semibold text-danger-foreground hover:bg-danger' : out ? 'text-muted' : ''
                }`}
              >
                {d.getDate()}
              </button>
              {list.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen?.(e)}
                  className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-start text-[11px] outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
                  <span className="truncate">{e.title}</span>
                </button>
              ))}
              {list.length > 3 && (
                <button type="button" onClick={() => onPickDay(d)} className="px-1 text-start text-[11px] text-muted hover:text-foreground">
                  +{list.length - 3} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
