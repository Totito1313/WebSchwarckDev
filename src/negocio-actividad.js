// Negocio: la actividad de un proyecto, como el panel de proyecto de Runey.
//
// Todo lo que pasó (proyecto creado, etapas completadas, tareas nuevas, hechas
// o borradas, horas registradas, documentos, cobros, firmas, páginas…) sale de
// los propios datos; lo que no se puede deducir (cambios de estado, tareas
// borradas) lo anota el proyecto en su `log`. Se ve en un calendario (línea de
// tiempo, semana o mes) y en una lista con lo último.

import {
  state, find, el, icon, iconButton, seg, popover, todayISO, addDays, dateText, shortDate, monthText, timeText, money,
  durationText, DOC_WORD,
} from './negocio-core.js';
import { taskKey } from './negocio-work.js';
import { openTask, pageTitle } from './negocio-enlaces.js';

const DOC_ICON = { invoice: 'file', quote: 'quote', proposal: 'send', receipt: 'receipt' };
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const dfShortWeekday = new Intl.DateTimeFormat('es', { weekday: 'short' });
const weekday = (iso) => dfShortWeekday.format(new Date(`${iso}T12:00:00`)).replace('.', '');
const dfMonthShort = new Intl.DateTimeFormat('es', { month: 'short' });
const monthShort = (iso) => dfMonthShort.format(new Date(`${iso}T12:00:00`)).replace('.', '');

const readPref = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento, la vista vale para esta visita.
  }
};

const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));

/** «hace 7 horas», «ayer», «12 oct 2026». */
export function ago(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Ahora mismo';
  if (diff < 3_600_000) return `Hace ${Math.round(diff / 60_000)} min`;
  const day = new Date(ts).toLocaleDateString('en-CA');
  const today = todayISO();
  if (day === today) return `Hace ${Math.round(diff / 3_600_000)} h`;
  if (day === addDays(today, -1)) return `Ayer, ${timeText(new Date(ts).toISOString())}`;
  const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${day}T12:00:00`)) / 86_400_000);
  if (days > 0 && days < 7) return `Hace ${days} días`;
  return dateText(day);
}

// ── Los eventos ──

/** Todo lo que pasó en un proyecto, lo más reciente primero. */
export function projectEvents(p) {
  const out = [];
  const push = (at, ico, color, text, extra = {}) => {
    if (!at) return;
    const ts = Date.parse(at);
    if (!Number.isFinite(ts)) return;
    out.push({ ts, day: new Date(ts).toLocaleDateString('en-CA'), icon: ico, color, text, ...extra });
  };
  const atDay = (iso, time = '12:00') => (iso ? `${iso}T${time}:00` : '');

  push(p.createdAt, 'folder', 'var(--cyan)', 'Proyecto creado');
  for (const l of p.log || []) push(l.at, l.kind === 'task-deleted' ? 'trash' : 'flag', l.kind === 'task-deleted' ? 'var(--expense)' : 'var(--blue)', l.text);
  for (const st of p.stages || []) if (st.done && st.doneAt) push(st.doneAt, 'check', 'var(--income)', `Etapa «${st.name}» completada`);

  for (const t of state.tasks.filter((x) => x.projectId === p.id)) {
    const name = t.title?.trim() || 'Sin título';
    const open = () => openTask(t.id);
    push(t.createdAt, 'tasks', 'var(--blue)', `Nueva tarea ${taskKey(t)}: ${name}`, { open });
    if (t.status === 'done' && t.doneAt) push(t.doneAt, 'checkCircle', 'var(--income)', `${taskKey(t)} hecha: ${name}`, { open });
  }
  for (const e of state.time.filter((x) => x.projectId === p.id && !x.running && Number(x.minutes) > 0)) {
    const task = e.taskId && find('tasks', e.taskId);
    push(e.end || e.start || atDay(e.date, '18:00'), 'clock', 'var(--cyan)', `${durationText(e.minutes)} de trabajo${task ? ` en ${task.title || 'una tarea'}` : e.note ? `: ${e.note}` : ''}`);
  }
  for (const d of state.docs.filter((x) => x.projectId === p.id)) {
    const href = `#/doc/${d.id}`;
    const what = `${DOC_WORD[d.type] || 'Documento'} ${d.number || ''}`.trim();
    push(d.createdAt || atDay(d.issueDate), DOC_ICON[d.type] || 'file', 'var(--ink)', `${what} ${d.type === 'receipt' ? 'emitido' : 'creada'}`, { href });
    for (const pay of d.payments || []) push(atDay(pay.date, '13:00'), 'dollar', 'var(--income)', `Cobro de ${money(pay.amount, d.currency)} · ${d.number}`, { href });
    const pub = state.pub?.[d.id];
    if (pub?.viewedAt) push(pub.viewedAt, 'eye', 'var(--violet)', `El cliente abrió ${what}`, { href });
    if (pub?.acceptedAt) push(pub.acceptedAt, 'pen', 'var(--income)', `${pub.name || 'El cliente'} firmó ${what}`, { href });
    if (pub?.declinedAt) push(pub.declinedAt, 'x', 'var(--expense)', `El cliente rechazó ${what}`, { href });
  }
  for (const pg of (state.pages || []).filter((x) => x.projectId === p.id)) {
    push(pg.createdAt, 'page', 'var(--violet)', `Página «${pageTitle(pg)}» creada`, { href: `#/paginas/${pg.id}` });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

// ── Piezas ──

function bubble(e, size = '') {
  return el('span', { class: `ac-bubble ${size}`.trim(), style: { '--c': e.color } }, icon(e.icon));
}

/** Abre lo que el evento nombra (una tarea, un documento, una página). */
function go(e) {
  if (e.open) e.open();
  else if (e.href) location.hash = e.href;
}

function eventRow(e, { withTime = true } = {}) {
  const clickable = Boolean(e.open || e.href);
  return el(clickable ? 'button' : 'div', { type: clickable ? 'button' : null, class: `ac-row${clickable ? ' is-link' : ''}`, onclick: clickable ? () => go(e) : null },
    bubble(e),
    el('span', { class: 'ac-row-text' }, el('b', { text: e.text }), withTime && el('small', { text: ago(e.ts) })),
  );
}

/** La lista de un día, en un menú flotante. */
function dayPopover(anchor, day, events) {
  const box = el('div', { class: 'ng-menu ac-pop' },
    el('div', { class: 'ac-pop-head' }, el('b', { text: dateText(day) }), el('small', { text: `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}` })),
    el('div', { class: 'ac-pop-list' }, events.map((e) => eventRow({ ...e }, { withTime: false }))),
  );
  const pop = popover(anchor, box, { className: 'is-wide' });
  box.addEventListener('click', (ev) => {
    if (ev.target.closest('.ac-row.is-link')) pop.hidePopover();
  });
}

// ── Calendario de actividad ──

const VIEWS = [['timeline', 'Línea'], ['week', 'Semana'], ['month', 'Mes']];

export function activityCalendar(getEvents) {
  const box = el('section', { class: 'ng-card ac-card' });
  let view = readPref('ng-ac-view', 'timeline');
  let anchor = todayISO();

  const shift = (step) => {
    if (view === 'month') {
      const d = new Date(`${anchor.slice(0, 7)}-15T12:00:00`);
      d.setMonth(d.getMonth() + step);
      anchor = d.toLocaleDateString('en-CA');
    } else anchor = addDays(anchor, step * 7);
    draw();
  };

  function timeline(byDay, today) {
    const days = Array.from({ length: 22 }, (_, i) => addDays(anchor, i - 7));
    let shown = 0;
    return el('div', { class: 'ac-scroll' }, el('div', { class: 'ac-line', style: { '--n': days.length } },
      days.map((d, i) => {
        const list = byDay.get(d) || [];
        const lane = list.length ? shown++ % 2 : 0;
        // La etiqueta del día: el alta del proyecto si fue ese día; si no, lo más reciente.
        const first = list.find((e) => e.text === 'Proyecto creado') || list[list.length - 1];
        const showMonth = i === 0 || d.endsWith('-01');
        return el('div', { class: `ac-day${d === today ? ' is-today' : ''}${list.length ? ' has-ev' : ''}${d > today ? ' is-future' : ''}` },
          el('span', { class: 'ac-month', text: showMonth ? monthShort(d) : '' }),
          el('span', { class: 'ac-num', text: String(Number(d.slice(8))) }),
          el('span', { class: 'ac-dot', 'aria-hidden': 'true' }),
          first && el('button', {
            type: 'button',
            class: `ac-pill is-lane-${lane}`,
            title: list.map((e) => e.text).join('\n'),
            onclick: (ev) => dayPopover(ev.currentTarget, d, list),
          }, bubble(first, 'is-sm'), el('span', { text: first.text }), list.length > 1 && el('small', { text: `+${list.length - 1}` })),
        );
      }),
    ));
  }

  function week(byDay, today) {
    const start = mondayOf(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return el('div', { class: 'ac-week' }, days.map((d) => {
      const list = byDay.get(d) || [];
      return el('div', { class: `ac-wday${d === today ? ' is-today' : ''}` },
        el('header', {}, el('span', { text: weekday(d) }), el('b', { text: String(Number(d.slice(8))) })),
        list.length ? el('div', { class: 'ac-wlist' }, list.slice(0, 6).map((e) => eventRow(e, { withTime: false })), list.length > 6 && el('button', { type: 'button', class: 'ac-more', text: `Ver ${list.length - 6} más`, onclick: (ev) => dayPopover(ev.currentTarget, d, list) }))
          : el('p', { class: 'ac-none', text: 'Sin actividad' }),
      );
    }));
  }

  function month(byDay, today) {
    const key = anchor.slice(0, 7);
    const first = `${key}-01`;
    const last = new Date(`${first}T12:00:00`);
    last.setMonth(last.getMonth() + 1);
    last.setDate(0);
    const end = last.toLocaleDateString('en-CA');
    // Semanas completas, de lunes a domingo.
    const days = [];
    for (let d = mondayOf(first); d <= end || days.length % 7; d = addDays(d, 1)) days.push(d);
    return el('div', { class: 'ac-month-grid' },
      WEEKDAYS.map((w) => el('span', { class: 'ac-mwd', text: w })),
      days.map((d) => {
        const list = byDay.get(d) || [];
        return el('button', {
          type: 'button',
          class: `ac-mday${d.startsWith(key) ? '' : ' is-out'}${d === today ? ' is-today' : ''}${list.length ? ' has-ev' : ''}`,
          disabled: !list.length,
          'aria-label': `${dateText(d)}: ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}`,
          onclick: (ev) => dayPopover(ev.currentTarget, d, list),
        },
          el('span', { class: 'ac-mnum', text: String(Number(d.slice(8))) }),
          list.length > 0 && el('span', { class: 'ac-mdots' }, list.slice(0, 4).map((e) => el('i', { style: { '--c': e.color } }))),
          list.length > 0 && el('small', { text: list[0].text }),
        );
      }),
    );
  }

  // La cabecera se monta una vez: el segmento de la vista se desliza al cambiar.
  const subtitle = el('small');
  const body = el('div', { class: 'ac-body' });
  const todayBtn = el('button', { type: 'button', class: 'pill ghost sm', text: 'Hoy', onclick: () => { anchor = todayISO(); draw(); } });
  box.append(
    el('header', { class: 'ng-card-head ac-head' },
      el('div', {}, el('h2', { text: 'Calendario de actividad' }), subtitle),
      el('div', { class: 'ac-tools' },
        seg(VIEWS, view, (v) => { view = v; savePref('ng-ac-view', v); draw(); }, 'Vista del calendario'),
        todayBtn,
        iconButton('back', 'Anterior', () => shift(-1), 'is-sm'),
        iconButton('right', 'Siguiente', () => shift(1), 'is-sm'),
      ),
    ),
    body,
  );

  function draw() {
    const events = getEvents();
    const today = todayISO();
    const byDay = new Map();
    for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
      if (!byDay.has(e.day)) byDay.set(e.day, []);
      byDay.get(e.day).push(e);
    }
    const label = view === 'month' ? monthText(anchor.slice(0, 7))
      : view === 'week' ? `Semana del ${shortDate(mondayOf(anchor))}`
        : `${shortDate(addDays(anchor, -7))} – ${dateText(addDays(anchor, 14))}`;
    subtitle.textContent = events.length ? `${events.length} ${events.length === 1 ? 'evento registrado' : 'eventos registrados'} · ${label}` : `Todavía no hay actividad · ${label}`;
    todayBtn.disabled = anchor === today;
    body.replaceChildren(view === 'week' ? week(byDay, today) : view === 'month' ? month(byDay, today) : timeline(byDay, today));
    // La línea de tiempo empieza mostrando hoy.
    const scroller = body.querySelector('.ac-scroll');
    const todayCol = body.querySelector('.ac-day.is-today');
    if (scroller && todayCol && scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = Math.max(0, todayCol.offsetLeft - scroller.clientWidth / 3);
  }

  draw();
  return { node: box, refresh: draw };
}

/** Lo último que pasó en el proyecto. */
export function activityFeed(events, { limit = 8 } = {}) {
  const shown = events.slice(0, limit);
  return el('section', { class: 'ng-card ac-feed' },
    el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Actividad' }), el('small', { text: 'Lo último que pasó' }))),
    shown.length ? el('div', { class: 'ac-feed-list' }, shown.map((e) => eventRow(e))) : el('p', { class: 'ng-none', text: 'Aquí saldrá lo que vaya pasando.' }),
  );
}
