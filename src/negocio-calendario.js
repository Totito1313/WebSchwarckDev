// Negocio · Marketing: el calendario de publicaciones y el tablero editorial.
// En los dos se arrastra: en el calendario cambia la fecha; en el tablero, el estado.

import { state, find, put, el, icon, iconButton, todayISO, addDays, monthText, dateText, totals, counts } from './negocio-core.js';
import { POST_STATUS, STATUS_ORDER, ROLES, FORMATS, brandOf, brandColor, brandMark, postsOf, byDate, postForm, newPost, roleTag } from './negocio-contenido.js';

const list = (col) => state[col] || [];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const dfDay = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const longDay = (iso) => {
  const t = dfDay.format(new Date(`${iso}T12:00:00`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const cal = { month: todayISO().slice(0, 7), tasks: true, invoices: true };

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

  function chip(p) {
    const b = brandOf(p);
    const node = el('button', {
      type: 'button',
      class: `ng-pchip${p.status === 'publicado' ? ' is-done' : ''}`,
      draggable: true,
      style: { '--c': brandColor(b), '--s': POST_STATUS[p.status]?.[1] || 'var(--body)' },
      title: `${p.time || ''} ${p.title} · ${b?.name || 'Sin marca'} · ${POST_STATUS[p.status]?.[0] || ''}`.trim(),
      onclick: () => postForm(p),
    },
      icon(FORMATS[p.format]?.[1] || 'image'),
      p.time && el('span', { class: 'ng-pchip-time', text: p.time }),
      el('span', { class: 'ng-pchip-title', text: p.title || 'Sin título' }),
      el('i', { class: 'ng-pchip-dot', 'aria-hidden': 'true' }),
    );
    node.addEventListener('dragstart', (e) => {
      dragId = p.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.id);
      requestAnimationFrame(() => node.classList.add('is-dragging'));
    });
    node.addEventListener('dragend', () => {
      dragId = null;
      node.classList.remove('is-dragging');
      for (const d of box.querySelectorAll('.is-over')) d.classList.remove('is-over');
    });
    return node;
  }

  function extras(day) {
    const out = [];
    if (cal.tasks) {
      for (const t of list('tasks')) {
        if (t.dueDate === day && t.status !== 'done') out.push(el('a', { class: 'ng-xchip', href: '#/tareas', title: `Tarea: ${t.title}` }, icon('tasks'), el('span', { text: t.title || 'Tarea' })));
      }
    }
    if (cal.invoices) {
      for (const d of list('docs')) {
        if (d.type === 'invoice' && counts(d) && d.dueDate === day && totals(d).due > 0.004) {
          out.push(el('a', { class: 'ng-xchip is-money', href: `#/doc/${d.id}`, title: `Vence ${d.number}` }, icon('file'), el('span', { text: `Vence ${d.number}` })));
        }
      }
    }
    return out;
  }

  function draw() {
    const days = monthDays(cal.month);
    const today = todayISO();
    const posts = postsOf(filter).filter((p) => p.date >= days[0] && p.date <= days[days.length - 1]).sort(byDate);
    const inMonth = posts.filter((p) => p.date.startsWith(cal.month));
    const byDay = new Map();
    for (const p of posts) {
      if (!byDay.has(p.date)) byDay.set(p.date, []);
      byDay.get(p.date).push(p);
    }
    const mix = Object.entries(ROLES).map(([k, r]) => [r, inMonth.filter((p) => p.role === k).length]);
    const toggle = (key, text) => el('label', { class: 'ng-chk' }, el('input', { type: 'checkbox', checked: cal[key], onchange: (e) => { cal[key] = e.target.checked; draw(); } }), el('span', { text }));

    box.replaceChildren(...[
      el('header', { class: 'ng-cal-head' },
        el('div', { class: 'ng-cal-nav' },
          iconButton('back', 'Mes anterior', () => { cal.month = shiftMonth(cal.month, -1); draw(); }),
          el('h2', { text: monthText(cal.month) }),
          iconButton('right', 'Mes siguiente', () => { cal.month = shiftMonth(cal.month, 1); draw(); }),
          cal.month !== today.slice(0, 7) && el('button', { type: 'button', class: 'pill ghost sm', text: 'Hoy', onclick: () => { cal.month = today.slice(0, 7); draw(); } }),
        ),
        el('div', { class: 'ng-cal-tools' }, el('span', { class: 'ng-cal-label', text: 'Mostrar también' }), toggle('tasks', 'Tareas'), toggle('invoices', 'Cobros que vencen')),
      ),
      el('div', { class: 'ng-cal-sum' },
        el('b', { text: `${inMonth.length} ${inMonth.length === 1 ? 'publicación' : 'publicaciones'}` }),
        mix.map(([r, n]) => el('span', { class: 'ng-cal-mix', style: { '--c': r[2] }, title: r[3] }, `${r[0]} ${n}`)),
      ),
      el('div', { class: 'ng-cal-grid', role: 'grid', 'aria-label': `Publicaciones de ${monthText(cal.month)}` },
        WEEKDAYS.map((d) => el('span', { class: 'ng-cal-wd', role: 'columnheader', text: d })),
        days.map((d) => {
          const items = byDay.get(d) || [];
          const more = extras(d);
          const cell = el('div', {
            class: `ng-day${d.startsWith(cal.month) ? '' : ' is-out'}${d === today ? ' is-today' : ''}${items.length || more.length ? ' has-items' : ''}${d < today ? ' is-past' : ''}`,
            role: 'gridcell',
            data: { date: d },
          },
            el('header', {},
              el('span', { class: 'ng-day-num', text: String(Number(d.slice(8))) }),
              el('span', { class: 'ng-day-full', text: longDay(d) }),
              iconButton('plus', `Nueva publicación el ${dateText(d)}`, () => postForm(newPost(startWith(filter, { date: d }))), 'ng-day-add'),
            ),
            el('div', { class: 'ng-day-items' }, items.map(chip), more),
          );
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
            if (!p || p.date === d) return;
            p.date = d;
            put('posts', p);
          });
          return cell;
        }),
      ),
      !inMonth.length && el('p', { class: 'ng-cal-empty' }, 'No hay publicaciones este mes. Toca el + de un día o ', el('button', { type: 'button', class: 'ng-link', text: 'crea una', onclick: () => postForm(newPost(startWith(filter, { date: cal.month === today.slice(0, 7) ? today : `${cal.month}-01` }))) }), '.'),
    ].filter(Boolean));
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
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === node) {
          e.preventDefault();
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
      el('div', { class: 'ng-postcard-tags' }, roleTag(p.role), el('span', { class: 'ng-postcard-format' }, icon(FORMATS[p.format]?.[1] || 'image'), FORMATS[p.format]?.[0] || '')),
    );
    node.addEventListener('dragstart', (e) => {
      dragId = p.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.id);
      requestAnimationFrame(() => node.classList.add('is-dragging'));
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
        col.addEventListener('dragover', (e) => {
          if (!dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          col.classList.add('is-over');
        });
        col.addEventListener('dragleave', (e) => {
          if (!col.contains(e.relatedTarget)) col.classList.remove('is-over');
        });
        col.addEventListener('drop', (e) => {
          e.preventDefault();
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
