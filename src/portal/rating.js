// La valoración del mes: del día 20 al 7 del mes siguiente, Inicio le pregunta a cada persona
// «¿Cómo lo hicimos en noviembre?» (1 a 5 y un comentario). Se puede cambiar mientras dure ese
// plazo. El estudio ve la media de cada mes, quién votó y qué dijo.

import { el, fill, icon, toast, sheet, textarea, field, sectionHead, burst, fMonth, dayDate, ago, emptyBox } from './kit.js';
import { react } from './feel.js';
import { app, redraw, can, isStudio, has, monthKey } from './state.js';

const WORDS = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', '¡Genial!'];
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

/** El mes que toca valorar hoy: del 20 en adelante, este; hasta el 7, el anterior. */
export function ratingMonth(today = new Date()) {
  const day = today.getDate();
  if (day >= 20) return monthKey(today.toLocaleDateString('en-CA'));
  if (day <= 7) return monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 15).toLocaleDateString('en-CA'));
  return null;
}
export const canRate = () => has('ratings') && !isStudio() && can('rating.send');
const mine = (month) => app.data.ratings.find((r) => r.month === month && r.user_id === app.user?.id) || null;
const monthName = (m) => fMonth.format(dayDate(m)).split(' ')[0];

/** Las estrellas: con `onPick`, se eligen. */
function stars(value, onPick, { size = '' } = {}) {
  const box = el('div', { class: `cl-stars${size ? ` is-${size}` : ''}`, role: onPick ? 'radiogroup' : 'img', 'aria-label': onPick ? 'Tu valoración' : `${value} de 5` });
  const draw = (v) => fill(box, [1, 2, 3, 4, 5].map((n) => (onPick
    ? el('button', { type: 'button', role: 'radio', 'aria-checked': String(n === v), 'aria-label': `${n}: ${WORDS[n]}`, class: n <= v ? 'is-on' : '', style: { '--i': n }, onclick: () => { react('tick'); draw(n); onPick(n); } }, icon('star'))
    : el('i', { class: n <= Math.round(v) ? 'is-on' : '' }, icon('star')))));
  draw(value);
  return box;
}

/** En Inicio del cliente, cuando toca. */
export function ratingCard() {
  if (!canRate()) return null;
  const month = ratingMonth();
  if (!month || mine(month)) return null;
  const later = Number(remember(`portal:rate-later:${month}`) || 0);
  if (later && Date.now() - later < 3 * 86_400_000) return null;
  const card = el('article', { class: 'cl-card cl-rate-card' },
    el('div', { class: 'cl-set-main' },
      el('small', { class: 'cl-eyebrow', text: 'Tu opinión' }),
      el('b', { text: `¿Cómo lo hicimos en ${monthName(month)}?` }),
      el('small', { text: 'Un toque: nos ayuda a mejorar cada mes.' }),
    ),
    stars(0, (n) => rateSheet(month, n), { size: 'lg' }),
    el('button', { type: 'button', class: 'cl-link cl-rate-later', onclick: () => { remember(`portal:rate-later:${month}`, String(Date.now())); card.classList.add('is-gone'); setTimeout(() => card.remove(), 300); } }, 'Ahora no'),
  );
  return card;
}

/** Valorar (o cambiar la valoración de) un mes. */
export function rateSheet(month = ratingMonth(), preset = 0) {
  if (!month) return toast('Se valora del día 20 al 7 del mes siguiente.', 'error');
  const before = mine(month);
  let score = preset || before?.score || 0;
  const word = el('b', { class: 'cl-rate-word', text: WORDS[score] || 'Elige de 1 a 5' });
  const comment = textarea({ value: before?.comment || '', maxLength: 2000, rows: 3, placeholder: score && score <= 3 ? '¿Qué podemos hacer mejor?' : 'Lo que más te gustó, lo que cambiarías… (opcional)' });
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('send'), before ? 'Guardar' : 'Enviar');
  const ui = sheet(`${before ? 'Tu valoración de' : 'Valora'} ${monthName(month)}`, el('div', { class: 'cl-form cl-rate' },
    stars(score, (n) => { score = n; word.textContent = WORDS[n]; }, { size: 'xl' }),
    word,
    field('Comentario', comment),
    el('p', { class: 'cl-form-hint', text: 'Solo la ve el equipo de Schwarck.' }),
  ), { actions: [btn] });
  btn.addEventListener('click', async () => {
    if (!score) return toast('Elige de 1 a 5 estrellas.', 'error');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const row = await app.backend.saveRating({ client_id: app.client.id, month, score, comment: comment.value.trim() || null });
      const i = app.data.ratings.findIndex((r) => r.month === month && r.user_id === app.user?.id);
      if (i >= 0) app.data.ratings[i] = row;
      else app.data.ratings.unshift(row);
      react('success');
      burst(btn);
      ui.close();
      toast(score >= 4 ? '¡Gracias! Nos alegra mucho.' : 'Gracias: lo tendremos en cuenta.', 'ok');
      redraw();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  });
}

// ── El estudio ──

function byMonth() {
  const months = new Map();
  for (const r of app.data.ratings) {
    if (!months.has(r.month)) months.set(r.month, []);
    months.get(r.month).push(r);
  }
  return [...months].sort((a, b) => b[0].localeCompare(a[0]));
}
const average = (list) => list.reduce((s, r) => s + r.score, 0) / (list.length || 1);
const avgText = (n) => n.toFixed(1).replace('.', ',');

/** En Inicio del estudio: la última media y su comentario. */
export function ratingSummary() {
  if (!has('ratings') || !isStudio()) return null;
  const months = byMonth();
  if (!months.length) return null;
  const [month, list] = months[0];
  const avg = average(list);
  const prev = months[1] ? average(months[1][1]) : null;
  const last = list.find((r) => r.comment);
  return el('button', { type: 'button', class: 'cl-card cl-rate-sum', onclick: ratingsSheet },
    el('div', { class: 'cl-rate-big' }, el('b', { text: avgText(avg) }), stars(avg, null, { size: 'sm' })),
    el('span', { class: 'cl-set-main' },
      el('small', { class: 'cl-eyebrow', text: `Valoración de ${monthName(month)}` }),
      el('b', { text: `${list.length} ${list.length === 1 ? 'persona' : 'personas'}${prev != null ? ` · ${avg >= prev ? '+' : ''}${avgText(avg - prev)} frente al mes anterior` : ''}` }),
      last && el('small', { text: `«${last.comment}» — ${last.author || 'Cliente'}` }),
    ),
    icon('right', 'cl-set-chev'),
  );
}

export function ratingsSheet() {
  const months = byMonth();
  sheet(`Valoraciones · ${app.client.name}`, months.length
    ? el('div', { class: 'cl-stack' }, months.map(([month, list]) => el('section', { class: 'cl-sec' },
      sectionHead(`${fMonth.format(dayDate(month))}`, el('span', { class: 'cl-rate-avg' }, avgText(average(list)), icon('star'))),
      el('div', { class: 'cl-list' }, list.map((r) => el('div', { class: 'cl-row cl-rate-row' },
        stars(r.score, null, { size: 'sm' }),
        el('span', { class: 'cl-set-main' }, el('b', { text: r.author || 'Cliente' }), r.comment && el('small', { class: 'is-wrap', text: r.comment }), el('small', { text: ago(r.updated_at || r.created_at) })),
      ))),
    )))
    : emptyBox('heart', 'Sin valoraciones', 'Del día 20 al 7 del mes siguiente, la app le pregunta al cliente cómo lo hicimos.'));
}
