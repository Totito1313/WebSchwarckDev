// Negocio · Marketing: el calendario de publicaciones y el tablero editorial.
//
// El calendario se ve por mes, por semana o como agenda. En todos se arrastra
// una publicación a otro día para cambiarla de fecha; en el tablero, a otra
// columna para cambiar su estado. Junto a las publicaciones pueden verse las
// tareas que vencen, los cobros pendientes, los seguimientos de leads y las
// campañas en marcha (como una franja de su color).

import { state, find, put, el, icon, iconButton, seg, todayISO, addDays, monthText, dateText, shortDate, totals, counts } from './negocio-core.js';
import {
  POST_STATUS, STATUS_ORDER, ROLES, FORMATS, brandOf, brandColor, brandMark, brands, postsOf, byDate, postForm, newPost, roleTag,
  campaigns, campaignOn, statusTag, engagement, pctText, leadsOf,
} from './negocio-contenido.js';
import { taskKey } from './negocio-work.js';
import { openTask } from './negocio-enlaces.js';
import { openLead } from './negocio-leads.js';

const list = (col) => state[col] || [];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const dfDay = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const dfWeekday = new Intl.DateTimeFormat('es', { weekday: 'short' });
const longDay = (iso) => {
  const t = dfDay.format(new Date(`${iso}T12:00:00`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const weekdayOf = (iso) => dfWeekday.format(new Date(`${iso}T12:00:00`)).replace('.', '');

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

const mondayOf = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7));
};

export const cal = {
  month: todayISO().slice(0, 7),
  week: mondayOf(todayISO()),
  view: readPref('ng-cal-view', 'month'),
  tasks: true,
  invoices: true,
  leads: true,
};

function shiftMonth(key, step) {
  const d = new Date(`${key}-15T12:00:00`);
  d.setMonth(d.getMonth() + step);
  return d.toLocaleDateString('en-CA').slice(0, 7);
}

/** Los días que se ven en la cuadrícula: semanas completas, de lunes a domingo. */
function monthDays(key) {
  const first = new Date(`${key}-01T12:00:00`);
  const lead = (first.getDay() + 6) % 7;
  const last = new Date(first);
  last.setMonth(last.getMonth() + 1);
  last.setDate(0);
  const weeks = Math.ceil((lead + last.getDate()) / 7);
  const start = addDays(`${key}-01`, -lead);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** Datos para empezar una publicación nueva con lo que ya está filtrado. */
const startWith = (filter, extra = {}) => ({ ...(filter.brand && filter.brand !== 'all' ? { brandId: filter.brand } : {}), ...extra });

// ── Calendario ──

export function calendarView(filter) {
  const box = el('section', { class: 'ng-card ng-cal' });
  let dragId = null;

  function chip(p, { rich = false } = {}) {
    const b = brandOf(p);
    const leads = leadsOf(p).length;
    const node = el('button', {
      type: 'button',
      class: `ng-pchip${p.status === 'publicado' ? ' is-done' : ''}${rich ? ' is-rich' : ''}`,
      draggable: true,
      style: { '--c': brandColor(b), '--s': POST_STATUS[p.status]?.[1] || 'var(--body)' },
      title: `${p.time || ''} ${p.title} · ${b?.name || 'Sin marca'} · ${POST_STATUS[p.status]?.[0] || ''}`.trim(),
      onclick: () => postForm(p),
    },
      rich && el('span', { class: 'ng-pchip-media' }, p.assetUrl ? el('img', { src: p.assetUrl, alt: '', loading: 'lazy' }) : el('i', { style: { '--c': p.color || brandColor(b) } })),
      icon(FORMATS[p.format]?.[1] || 'image'),
      p.time && el('span', { class: 'ng-pchip-time', text: p.time }),
      el('span', { class: 'ng-pchip-title', text: p.title || 'Sin título' }),
      rich && leads > 0 && el('span', { class: 'ng-pchip-leads', title: `${leads} leads` }, icon('funnel'), String(leads)),
      el('i', { class: 'ng-pchip-dot', 'aria-hidden': 'true' }),
    );
    node.addEventListener('dragstart', (e) => {
      dragId = p.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.id);
      setTimeout(() => node.classList.add('is-dragging'));
    });
    node.addEventListener('dragend', () => {
      dragId = null;
      node.classList.remove('is-dragging');
      for (const d of box.querySelectorAll('.is-over')) d.classList.remove('is-over');
    });
    return node;
  }

  /** Lo que no es una publicación pero conviene ver ese día. */
  function extras(day) {
    const out = [];
    if (cal.tasks) {
      for (const t of list('tasks')) {
        if (t.dueDate === day && t.status !== 'done') out.push(el('button', { type: 'button', class: 'ng-xchip', title: `Tarea ${taskKey(t)}: ${t.title}`, onclick: () => openTask(t.id) }, icon('tasks'), el('span', { text: t.title || 'Tarea' })));
      }
    }
    if (cal.invoices) {
      for (const d of list('docs')) {
        if (d.type === 'invoice' && counts(d) && d.dueDate === day && totals(d).due > 0.004) {
          out.push(el('a', { class: 'ng-xchip is-money', href: `#/doc/${d.id}`, title: `Vence ${d.number}` }, icon('file'), el('span', { text: `Vence ${d.number}` })));
        }
      }
    }
    if (cal.leads) {
      for (const l of list('leads')) {
        if (l.nextAt === day && !['won', 'lost'].includes(l.stage)) out.push(el('button', { type: 'button', class: 'ng-xchip is-lead', title: `Seguimiento: ${l.nextNote || ''}`, onclick: () => openLead(l.id) }, icon('funnel'), el('span', { text: l.name || l.company || 'Lead' })));
      }
    }
    return out;
  }

  const activeOn = (day, camps) => camps.filter((c) => campaignOn(c, day));

  function dropTarget(cell, day) {
    cell.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cell.classList.add('is-over');
    });
    cell.addEventListener('dragleave', (e) => {
      if (!cell.contains(e.relatedTarget)) cell.classList.remove('is-over');
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('is-over');
      const p = dragId && find('posts', dragId);
      if (!p || p.date === day) return;
      p.date = day;
      put('posts', p);
    });
  }

  /** Publicaciones por día dentro de un tramo. */
  function byDay(from, to) {
    const map = new Map();
    for (const p of postsOf(filter).filter((x) => x.date >= from && x.date <= to).sort(byDate)) {
      if (!map.has(p.date)) map.set(p.date, []);
      map.get(p.date).push(p);
    }
    return map;
  }

  /** Cuántas publicaciones lleva cada marca frente a su objetivo semanal. */
  function cadence(from, to, weeks) {
    const shown = brands().filter((b) => Number(b.cadence) > 0 && (filter.brand === 'all' || filter.brand === b.id));
    return shown.map((b) => {
      const n = list('posts').filter((p) => p.brandId === b.id && p.date >= from && p.date <= to && p.status !== 'idea').length;
      const goal = Math.round(Number(b.cadence) * weeks);
      return el('span', { class: `ng-cadence${n >= goal ? ' is-ok' : ''}`, style: { '--c': brandColor(b) }, title: `Objetivo: ${b.cadence} por semana` }, brandMark(b, 'is-xs'), `${n}/${goal}`);
    });
  }

  function toolbar(title, onPrev, onNext, onToday, showToday) {
    const toggle = (key, text) => el('label', { class: 'ng-chk' }, el('input', { type: 'checkbox', checked: cal[key], onchange: (e) => { cal[key] = e.target.checked; draw(); } }), el('span', { text }));
    return el('header', { class: 'ng-cal-head' },
      el('div', { class: 'ng-cal-nav' },
        iconButton('back', 'Anterior', onPrev),
        el('h2', { text: title }),
        iconButton('right', 'Siguiente', onNext),
        showToday && el('button', { type: 'button', class: 'pill ghost sm', text: 'Hoy', onclick: onToday }),
      ),
      el('div', { class: 'ng-cal-tools' },
        seg([['month', 'Mes'], ['week', 'Semana'], ['agenda', 'Agenda']], cal.view, (v) => { cal.view = v; savePref('ng-cal-view', v); draw(); }, 'Vista del calendario'),
        el('span', { class: 'ng-cal-label', text: 'Ver también' }),
        toggle('tasks', 'Tareas'),
        toggle('invoices', 'Cobros'),
        toggle('leads', 'Seguimientos'),
      ),
    );
  }

  function summary(inRange, camps, from, to, weeks) {
    const mix = Object.entries(ROLES).map(([k, r]) => [r, inRange.filter((p) => p.role === k).length]);
    const live = camps.filter((c) => c.start <= to && (!c.end || c.end >= from) && c.status !== 'done');
    return el('div', { class: 'ng-cal-sum' },
      el('b', { text: `${inRange.length} ${inRange.length === 1 ? 'publicación' : 'publicaciones'}` }),
      mix.map(([r, n]) => el('span', { class: 'ng-cal-mix', style: { '--c': r[2] }, title: r[3] }, `${r[0]} ${n}`)),
      cadence(from, to, weeks),
      live.map((c) => el('a', { class: 'ng-cal-camp', href: `#/marketing/campanas/${c.id}`, style: { '--c': c.color }, title: `Campaña: ${c.name}` }, icon('rocket'), c.name)),
    );
  }

  function drawMonth() {
    const days = monthDays(cal.month);
    const today = todayISO();
    const map = byDay(days[0], days.at(-1));
    const inMonth = postsOf(filter).filter((p) => p.date.startsWith(cal.month));
    const camps = campaigns().filter((c) => filter.brand === 'all' || !c.brandId || c.brandId === filter.brand);
    const first = `${cal.month}-01`;
    const last = days.filter((d) => d.startsWith(cal.month)).at(-1);
    box.replaceChildren(...[
      toolbar(monthText(cal.month), () => { cal.month = shiftMonth(cal.month, -1); draw(); }, () => { cal.month = shiftMonth(cal.month, 1); draw(); }, () => { cal.month = today.slice(0, 7); draw(); }, cal.month !== today.slice(0, 7)),
      summary(inMonth, camps, first, last, (days.filter((d) => d.startsWith(cal.month)).length) / 7),
      el('div', { class: 'ng-cal-grid', role: 'grid', 'aria-label': `Publicaciones de ${monthText(cal.month)}` },
        WEEKDAYS.map((d) => el('span', { class: 'ng-cal-wd', role: 'columnheader', text: d })),
        days.map((d) => {
          const items = map.get(d) || [];
          const more = extras(d);
          const live = activeOn(d, camps);
          const cell = el('div', {
            class: `ng-day${d.startsWith(cal.month) ? '' : ' is-out'}${d === today ? ' is-today' : ''}${items.length || more.length ? ' has-items' : ''}${d < today ? ' is-past' : ''}`,
            role: 'gridcell',
            data: { date: d },
          },
            live.length > 0 && el('div', { class: 'ng-day-camps', 'aria-hidden': 'true' }, live.map((c) => el('i', { style: { '--c': c.color }, title: c.name }))),
            el('header', {},
              el('span', { class: 'ng-day-num', text: String(Number(d.slice(8))) }),
              el('span', { class: 'ng-day-full', text: longDay(d) }),
              iconButton('plus', `Nueva publicación el ${dateText(d)}`, () => postForm(newPost(startWith(filter, { date: d }))), 'ng-day-add'),
            ),
            el('div', { class: 'ng-day-items' }, items.map((p) => chip(p)), more),
          );
          dropTarget(cell, d);
          return cell;
        }),
      ),
      !inMonth.length && el('p', { class: 'ng-cal-empty' }, 'No hay publicaciones este mes. Toca el + de un día o ', el('button', { type: 'button', class: 'ng-link', text: 'crea una', onclick: () => postForm(newPost(startWith(filter, { date: cal.month === today.slice(0, 7) ? today : `${cal.month}-01` }))) }), '.'),
    ].filter(Boolean));
  }

  function drawWeek() {
    const today = todayISO();
    const days = Array.from({ length: 7 }, (_, i) => addDays(cal.week, i));
    const map = byDay(days[0], days[6]);
    const inWeek = [...map.values()].flat();
    const camps = campaigns().filter((c) => filter.brand === 'all' || !c.brandId || c.brandId === filter.brand);
    const title = `Semana del ${shortDate(days[0])} al ${dateText(days[6])}`;
    box.replaceChildren(
      toolbar(title, () => { cal.week = addDays(cal.week, -7); draw(); }, () => { cal.week = addDays(cal.week, 7); draw(); }, () => { cal.week = mondayOf(today); draw(); }, cal.week !== mondayOf(today)),
      summary(inWeek, camps, days[0], days[6], 1),
      el('div', { class: 'ng-week' }, days.map((d) => {
        const items = map.get(d) || [];
        const live = activeOn(d, camps);
        const col = el('section', { class: `ng-week-day${d === today ? ' is-today' : ''}${d < today ? ' is-past' : ''}`, data: { date: d } },
          live.length > 0 && el('div', { class: 'ng-day-camps', 'aria-hidden': 'true' }, live.map((c) => el('i', { style: { '--c': c.color }, title: c.name }))),
          el('header', {},
            el('span', { class: 'ng-week-wd', text: weekdayOf(d) }),
            el('b', { class: 'ng-week-num', text: String(Number(d.slice(8))) }),
            iconButton('plus', `Nueva publicación el ${dateText(d)}`, () => postForm(newPost(startWith(filter, { date: d }))), 'ng-day-add'),
          ),
          el('div', { class: 'ng-day-items' }, items.map((p) => chip(p, { rich: true })), extras(d)),
        );
        dropTarget(col, d);
        return col;
      })),
    );
  }

  function drawAgenda() {
    const today = todayISO();
    const from = today;
    const to = addDays(today, 30);
    const map = byDay(from, to);
    const camps = campaigns();
    const days = Array.from({ length: 31 }, (_, i) => addDays(from, i)).filter((d) => (map.get(d) || []).length || extras(d).length);
    box.replaceChildren(
      toolbar('Los próximos 30 días', () => {}, () => {}, () => {}, false),
      summary([...map.values()].flat(), camps, from, to, 30 / 7),
      days.length ? el('ol', { class: 'ng-agenda' }, days.map((d) => el('li', { class: d === today ? 'is-today' : '' },
        el('div', { class: 'ng-agenda-day' }, el('b', { text: String(Number(d.slice(8))) }), el('span', { text: d === today ? 'Hoy' : weekdayOf(d) })),
        el('div', { class: 'ng-agenda-items' },
          (map.get(d) || []).map((p) => {
            const b = brandOf(p);
            const e = engagement(p);
            return el('button', { type: 'button', class: 'ng-agenda-post', style: { '--c': brandColor(b) }, onclick: () => postForm(p) },
              el('span', { class: 'ng-agenda-time', text: p.time || '—' }),
              brandMark(b, 'is-sm'),
              el('span', { class: 'ng-agenda-main' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: [b?.name, FORMATS[p.format]?.[0], ROLES[p.role]?.[0], e != null && `Interacción ${pctText(e)}`].filter(Boolean).join(' · ') })),
              statusTag(p.status),
            );
          }),
          el('div', { class: 'ng-agenda-extras' }, extras(d)),
        ),
      ))) : el('p', { class: 'ng-cal-empty', text: 'Nada en los próximos 30 días.' }),
    );
    box.querySelectorAll('.ng-cal-nav .ng-ibtn').forEach((b) => { b.hidden = true; });
  }

  function draw() {
    if (cal.view === 'week') drawWeek();
    else if (cal.view === 'agenda') drawAgenda();
    else drawMonth();
  }

  draw();
  return { node: box, refresh: draw };
}

// ── Tablero editorial ──

export function boardView(filter) {
  const box = el('section', { class: 'ng-card ng-pboard-card' });
  let dragId = null;

  function card(p) {
    const b = brandOf(p);
    const leads = leadsOf(p).length;
    const e = engagement(p);
    const media = p.assetUrl
      ? el('img', { src: p.assetUrl, alt: '', loading: 'lazy' })
      : el('span', { class: 'ng-postcard-cover', style: { '--c': p.color || '#00b8d4' } }, icon(FORMATS[p.format]?.[1] || 'image'));
    const node = el('article', {
      class: 'ng-postcard',
      draggable: true,
      tabindex: 0,
      role: 'button',
      'aria-label': `${p.title}, ${POST_STATUS[p.status]?.[0] || ''}`,
      onclick: () => postForm(p),
      onkeydown: (ev) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === node) {
          ev.preventDefault();
          postForm(p);
        }
      },
    },
      el('div', { class: 'ng-postcard-media' }, media),
      el('b', { class: 'ng-postcard-title', text: p.title || 'Sin título' }),
      el('div', { class: 'ng-postcard-meta' },
        brandMark(b, 'is-xs'),
        el('span', { text: b?.name || 'Sin marca' }),
        el('span', { class: 'ng-postcard-date' }, icon('calendar'), dateText(p.date)),
      ),
      el('div', { class: 'ng-postcard-tags' },
        roleTag(p.role),
        el('span', { class: 'ng-postcard-format' }, icon(FORMATS[p.format]?.[1] || 'image'), FORMATS[p.format]?.[0] || ''),
        e != null && el('span', { class: 'ng-postcard-format', title: 'Interacción' }, icon('heart'), pctText(e)),
        leads > 0 && el('span', { class: 'ng-postcard-format', title: 'Leads' }, icon('funnel'), String(leads)),
      ),
    );
    node.addEventListener('dragstart', (ev) => {
      dragId = p.id;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', p.id);
      setTimeout(() => node.classList.add('is-dragging'));
    });
    node.addEventListener('dragend', () => {
      dragId = null;
      node.classList.remove('is-dragging');
      for (const c of box.querySelectorAll('.is-over')) c.classList.remove('is-over');
    });
    return node;
  }

  function draw() {
    const posts = postsOf({ ...filter, status: 'all' }).sort(byDate);
    box.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Flujo editorial' }), el('p', { text: 'Arrastra cada publicación a su estado. Dentro de cada columna van por fecha.' })),
      ),
      el('div', { class: 'ng-board ng-pboard' }, STATUS_ORDER.map((status) => {
        const [label, color] = POST_STATUS[status];
        const items = posts.filter((p) => p.status === status);
        const col = el('section', { class: 'ng-col', style: { '--c': color }, 'aria-label': label },
          el('header', { class: 'ng-col-head' },
            el('i', { class: 'ng-dot', style: { '--c': color } }),
            el('h3', { text: label }),
            el('span', { class: 'ng-col-count', text: String(items.length) }),
            iconButton('plus', `Nueva publicación en ${label}`, () => postForm(newPost(startWith(filter, { status })))),
          ),
          el('div', { class: 'ng-col-list' }, items.length ? items.map(card) : el('p', { class: 'ng-col-empty', text: 'Suelta aquí' })),
        );
        col.addEventListener('dragover', (ev) => {
          if (!dragId) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = 'move';
          col.classList.add('is-over');
        });
        col.addEventListener('dragleave', (ev) => {
          if (!col.contains(ev.relatedTarget)) col.classList.remove('is-over');
        });
        col.addEventListener('drop', (ev) => {
          ev.preventDefault();
          col.classList.remove('is-over');
          const p = dragId && find('posts', dragId);
          if (!p || p.status === status) return;
          p.status = status;
          put('posts', p);
        });
        return col;
      })),
    );
  }

  draw();
  return { node: box, refresh: draw };
}
