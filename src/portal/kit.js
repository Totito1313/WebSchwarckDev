// Piezas de la app del portal: nodos, iconos, formatos, hojas, menús y controles.
// Todo lleva su respuesta (vibración y sonido, ver feel.js) y su movimiento (cliente.css).

import { react, haptic } from './feel.js';

// ── Nodos ──

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') for (const [p, v] of Object.entries(value)) node.style.setProperty(p, v);
    else if (key === 'data') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key.includes('-') || key === 'list' || key === 'form' || !(key in node)) node.setAttribute(key, value === true ? '' : value);
    else node[key] = value;
  }
  node.append(...clean(kids));
  return node;
}
// Lo que no se pinta: los `cond && el(…)` que dan false, 0 o ''.
export const clean = (kids) => kids.flat(Infinity).filter((k) => k != null && k !== false && k !== 0 && k !== '');
export const fill = (node, ...kids) => {
  node.replaceChildren(...clean(kids));
  return node;
};

const ICONS = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
  timeline: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M11 6h9M11 18h9M11 12h6"/><circle cx="6" cy="12" r="1.2"/>',
  megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2.2 2.2h7.2A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  inbox: '<path d="M3 13.5 5.6 5.7A2 2 0 0 1 7.5 4.3h9a2 2 0 0 1 1.9 1.4L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.5 3 5.2"/>',
  store: '<path d="M4 9.5 5.2 4.8A1 1 0 0 1 6.2 4h11.6a1 1 0 0 1 1 .8L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v7.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12M10 20.5v-5h4v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.7L16 9.6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  sparkles: '<path d="M10 3.5 11.6 8a3 3 0 0 0 1.9 1.9L18 11.5l-4.5 1.6a3 3 0 0 0-1.9 1.9L10 19.5 8.4 15a3 3 0 0 0-1.9-1.9L2 11.5l4.5-1.6A3 3 0 0 0 8.4 8z"/><path d="M18.5 3v3M17 4.5h3M19 17v3M17.5 18.5h3"/>',
  flag: '<path d="M5 21V4.5M5 4.5h11.5l-2.2 4.2 2.2 4.3H5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
  bars: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  funnel: '<path d="M3.5 5h17l-6.5 8v5.5l-4 2V13z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4.5 3.5"/>',
  play: '<rect x="3.5" y="5" width="17" height="14" rx="3.5"/><path d="M10.5 9.3v5.4l4.5-2.7z" fill="currentColor"/>',
  message: '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z"/>',
  chat: '<path d="M4 12a8 8 0 1 1 3.4 6.6L4 20l1.3-3.6A7.9 7.9 0 0 1 4 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/>',
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.5-2h4.6l1.5 2h1.7A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  vibrate: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8v8M2 10v4M19.5 8v8M22 10v4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  hash: '<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1"/><circle cx="4.5" cy="12" r="1.1"/><circle cx="4.5" cy="18" r="1.1"/>',
  eye: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  dollar: '<path d="M12 2.5v19M16.5 6.8C15.7 5.4 14 4.5 12 4.5c-2.7 0-4.5 1.5-4.5 3.4 0 4.8 9.3 2.4 9.3 7.6 0 2.2-1.9 3.9-4.8 3.9-2.4 0-4.2-1-5-2.6"/>',
  heart: '<path d="M12 20s-7.5-4.6-9-9.2C2 7.6 4.2 5 7 5c2 0 3.3 1.2 5 3 1.7-1.8 3-3 5-3 2.8 0 5 2.6 4 5.8-1.5 4.6-9 9.2-9 9.2z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.8-3.5M4 4v4h4M4 13a8 8 0 0 0 14.8 3.5M20 20v-4h-4"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>',
  facebook: '<path d="M14 21v-7.5h2.6l.4-3H14V8.7c0-.9.3-1.5 1.6-1.5H17V4.5a19 19 0 0 0-2.4-.1C12.2 4.4 11 5.8 11 8.3v2.2H8.5v3H11V21"/>',
  tiktok: '<path d="M14.5 3.5c.4 2.4 1.9 3.9 4.5 4.1v3a7.4 7.4 0 0 1-4.5-1.5v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .7 0 1 .1v3.1a2.6 2.6 0 1 0 1.6 2.4V3.5z"/>',
  studio: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
};
export function icon(name, cls = '') {
  const span = el('span', { class: `ic ${cls}`.trim(), 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
  return span;
}
export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export function avatar(name, src, size = '') {
  return el('span', { class: `cl-avatar ${size}`.trim() }, src ? el('img', { src, alt: '', loading: 'lazy' }) : initials(name));
}

// ── Formatos ──

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
export const localDay = (d) => new Date(d).toLocaleDateString('en-CA');
export const todayKey = () => localDay(new Date());
export const dayDate = (key) => new Date(`${key}T12:00:00`);
export const addDays = (key, n) => localDay(dayDate(key).getTime() + n * 86_400_000);
const fmt = (opts) => new Intl.DateTimeFormat('es', opts);
export const fDay = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
export const fShort = fmt({ day: 'numeric', month: 'short' });
export const fMonth = fmt({ month: 'long', year: 'numeric' });
export const fMonthShort = fmt({ month: 'short' });
export const fTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
export const fWeekday = fmt({ weekday: 'short' });
const nf = new Intl.NumberFormat('es-VE');
const nfCompact = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });
const nfMoney = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const num = (n) => nf.format(Number(n) || 0);
export const compact = (n) => nfCompact.format(Number(n) || 0);
export const money = (n) => nfMoney.format(Number(n) || 0);
export const shortDate = (key) => fShort.format(dayDate(key)).replace('.', '');

export function dayLabel(key) {
  const diff = Math.round((dayDate(key) - dayDate(todayKey())) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  return cap(fDay.format(dayDate(key)));
}
export function ago(when) {
  const s = (Date.now() - new Date(when)) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172_800) return 'ayer';
  if (s < 604_800) return `hace ${Math.floor(s / 86_400)} días`;
  return shortDate(localDay(when));
}
export function dueText(key) {
  const diff = Math.round((dayDate(key) - dayDate(todayKey())) / 86_400_000);
  if (diff < 0) return [`Venció ${diff === -1 ? 'ayer' : `hace ${-diff} días`}`, 'is-late'];
  if (diff === 0) return ['Vence hoy', 'is-soon'];
  if (diff === 1) return ['Vence mañana', 'is-soon'];
  if (diff < 7) return [`En ${diff} días`, ''];
  return [`Para el ${shortDate(key)}`, ''];
}
export const minutesText = (m) => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
export const sizeText = (b) => (!b ? '' : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
export function safeUrl(u) {
  try {
    const url = new URL(String(u || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
export const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const still = matchMedia('(prefers-reduced-motion: reduce)');

// ── Avisos cortos ──

let toastTimer = 0;
export function toast(text, kind = '') {
  const box = document.querySelector('[data-toast]');
  fill(box, kind && icon(kind === 'error' ? 'alert' : 'checkCircle'), el('span', { text }));
  box.dataset.kind = kind;
  box.classList.remove('is-on');
  void box.offsetWidth;
  box.classList.add('is-on');
  if (kind === 'error') react('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-on'), kind === 'error' ? 4200 : 3000);
}

// ── Hojas (en el teléfono suben desde abajo; en escritorio, ventana centrada) ──

let openSheets = 0;
export function sheet(title, body, { actions, wide, onClose, className = '', subtitle } = {}) {
  let closing = false;
  const close = () => {
    if (!dlg.open || closing) return;
    closing = true;
    react('close');
    if (still.matches) return dlg.close();
    dlg.classList.add('is-closing');
    dlg.addEventListener('animationend', () => dlg.close(), { once: true });
    setTimeout(() => dlg.open && dlg.close(), 420);
  };
  const head = el('header', { class: 'cl-sheet-head' },
    el('div', { class: 'cl-sheet-titles' }, el('h2', { text: title }), subtitle && el('small', { text: subtitle })),
    el('button', { type: 'button', class: 'cl-glass sm', 'aria-label': 'Cerrar', onclick: close }, icon('x')),
  );
  const dlg = el('dialog', { class: `cl-sheet${wide ? ' is-wide' : ''} ${className}`.trim(), autofocus: true },
    el('span', { class: 'cl-sheet-grab', 'aria-hidden': 'true' }),
    head,
    el('div', { class: 'cl-sheet-body' }, body),
    actions && el('footer', { class: 'cl-sheet-foot' }, actions),
  );
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    openSheets = Math.max(0, openSheets - 1);
    document.documentElement.classList.toggle('has-sheet', openSheets > 0);
    onClose?.();
  });
  // Arrastrar hacia abajo desde el asa o la cabecera la cierra, con resistencia como en iOS.
  let startY = null;
  let lastY = 0;
  let lastT = 0;
  let speed = 0;
  dlg.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.cl-sheet-grab, .cl-sheet-head') || e.target.closest('button')) return;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = performance.now();
    dlg.style.transition = 'none';
    dlg.setPointerCapture?.(e.pointerId);
  });
  dlg.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    const now = performance.now();
    speed = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY;
    lastT = now;
    dlg.style.translate = `0 ${dy > 0 ? dy : dy / 6}px`;
  });
  const release = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    dlg.style.transition = '';
    dlg.style.translate = '';
    if (dy > 110 || speed > 0.8) close();
  };
  dlg.addEventListener('pointerup', release);
  dlg.addEventListener('pointercancel', release);
  document.body.append(dlg);
  dlg.showModal();
  openSheets++;
  document.documentElement.classList.add('has-sheet');
  react('open');
  return { dlg, close, body: dlg.querySelector('.cl-sheet-body') };
}

/** Menú de acciones al estilo iOS: lista de opciones y «Cancelar» aparte. */
export function actionSheet(title, items, { message } = {}) {
  return new Promise((resolve) => {
    let chosen = null;
    const list = el('div', { class: 'cl-actions' },
      (title || message) && el('div', { class: 'cl-actions-head' }, title && el('b', { text: title }), message && el('small', { text: message })),
      clean(items).map((it) => el('button', {
        type: 'button',
        class: `cl-action${it.danger ? ' is-danger' : ''}`,
        disabled: it.disabled,
        onclick: () => {
          chosen = it;
          ui.close();
        },
      }, it.icon && icon(it.icon), el('span', { text: it.label }), it.note && el('small', { text: it.note }))),
    );
    const cancel = el('button', { type: 'button', class: 'cl-action is-cancel', text: 'Cancelar', onclick: () => ui.close() });
    const ui = sheet(title || 'Opciones', el('div', { class: 'cl-actions-wrap' }, list, cancel), {
      className: 'is-actions',
      onClose: () => {
        resolve(chosen);
        chosen?.run?.();
      },
    });
  });
}

export function confirmSheet(title, { message, yes = 'Confirmar', danger = false } = {}) {
  return actionSheet(title, [{ label: yes, danger, icon: danger ? 'trash' : 'check' }], { message }).then(Boolean);
}

// ── Controles ──

export function field(label, control, hint) {
  return el('label', { class: 'cl-field' }, el('span', { class: 'cl-field-label', text: label }), control, hint && el('small', { class: 'cl-field-hint', text: hint }));
}

export function input(props = {}) {
  return el('input', { type: 'text', class: 'cl-input', autocomplete: 'off', ...props });
}

/** Texto largo que crece con lo escrito y, si tiene tope, cuenta los caracteres. */
export function textarea(props = {}, { counter } = {}) {
  const area = el('textarea', { class: 'cl-input', rows: 3, ...props });
  const fit = () => {
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight + 2, 420)}px`;
  };
  area.addEventListener('input', fit);
  requestAnimationFrame(fit);
  if (!counter || !props.maxLength) return area;
  const count = el('small', { class: 'cl-count-chars' });
  const sync = () => {
    const left = props.maxLength - area.value.length;
    count.textContent = `${area.value.length} / ${props.maxLength}`;
    count.classList.toggle('is-near', left < props.maxLength * 0.1);
  };
  area.addEventListener('input', sync);
  sync();
  return el('span', { class: 'cl-area-wrap' }, area, count);
}

/** Control segmentado: la pieza se desliza a la opción elegida con un muelle. */
export function seg(options, value, onChange, { label, small } = {}) {
  const box = el('div', { class: `cl-seg${small ? ' is-small' : ''}`, role: 'tablist', 'aria-label': label || 'Opciones' });
  const thumb = el('span', { class: 'cl-seg-thumb', 'aria-hidden': 'true' });
  let current = value;
  const buttons = options.map(([val, text, badge]) => el('button', {
    type: 'button',
    role: 'tab',
    'aria-selected': String(val === value),
    onclick: () => {
      if (current === val) return;
      current = val;
      set();
      react('tab');
      onChange(val);
    },
  }, el('span', { text }), badge ? el('i', { class: 'cl-seg-badge', text: String(badge) }) : null));
  const place = (animate = true) => {
    const on = buttons.find((b) => b.getAttribute('aria-selected') === 'true');
    if (!on || !on.offsetWidth) return;
    if (!animate) thumb.style.transition = 'none';
    box.style.setProperty('--tx', `${on.offsetLeft}px`);
    box.style.setProperty('--tw', `${on.offsetWidth}px`);
    box.classList.add('is-live');
    if (!animate) {
      thumb.getBoundingClientRect();
      thumb.style.transition = '';
    }
  };
  function set() {
    buttons.forEach((b, i) => b.setAttribute('aria-selected', String(options[i][0] === current)));
    place();
  }
  box.append(thumb, ...buttons);
  new ResizeObserver(() => place(false)).observe(box);
  return box;
}

/** Fichas para elegir una (o varias, con multi). */
export function chips(options, value, onChange, { multi = false, label, scroll = false } = {}) {
  let picked = multi ? new Set(value || []) : value;
  const box = el('div', { class: `cl-chips${scroll ? ' is-scroll' : ''}`, role: 'group', 'aria-label': label || 'Opciones' });
  const draw = () => fill(box, options.map(([val, text, color, ico]) => el('button', {
    type: 'button',
    class: 'cl-fchip',
    style: color ? { '--c': color } : null,
    'aria-pressed': String(multi ? picked.has(val) : picked === val),
    onclick: () => {
      if (multi) {
        picked.has(val) ? picked.delete(val) : picked.add(val);
        onChange([...picked]);
      } else {
        if (picked === val) return;
        picked = val;
        onChange(val);
      }
      react('tick');
      draw();
    },
  }, ico && icon(ico), color && !ico && el('i', { class: 'cl-dotc' }), text)));
  draw();
  return box;
}

/** Interruptor con el control nativo: en el iPhone suena y vibra como los de Ajustes. */
export function switchRow(label, checked, onChange, { sub, ico, tone } = {}) {
  const box = el('input', { type: 'checkbox', switch: true, checked, class: 'cl-switch-input' });
  box.addEventListener('change', () => {
    react(box.checked ? 'on' : 'off');
    onChange(box.checked);
  });
  return el('label', { class: 'cl-row-set cl-switch' },
    ico && el('span', { class: 'cl-set-ico', style: tone ? { '--c': tone } : null }, icon(ico)),
    el('span', { class: 'cl-set-main' }, el('b', { text: label }), sub && el('small', { text: sub })),
    box,
  );
}

/** Número con − y +, y el valor editable en medio. */
export function stepper(value, { min = 0, max = 1e9, step = 1, suffix = '', onChange } = {}) {
  const box = el('input', { type: 'number', inputMode: 'numeric', class: 'cl-step-input', value: value ?? '', min, max, step });
  const bump = (d) => {
    const next = Math.min(max, Math.max(min, (Number(box.value) || 0) + d));
    box.value = String(next);
    haptic('tick');
    box.closest('.cl-stepper')?.classList.remove('is-bump');
    void box.offsetWidth;
    box.closest('.cl-stepper')?.classList.add('is-bump');
    onChange?.(next);
  };
  box.addEventListener('input', () => onChange?.(box.value === '' ? null : Number(box.value)));
  const wrap = el('span', { class: 'cl-stepper' },
    el('button', { type: 'button', 'aria-label': 'Menos', onclick: () => bump(-step) }, el('span', { text: '−' })),
    box,
    suffix && el('small', { text: suffix }),
    el('button', { type: 'button', 'aria-label': 'Más', onclick: () => bump(step) }, el('span', { text: '+' })),
  );
  wrap.input = box;
  return wrap;
}

/** Fecha con atajos (Hoy, Mañana, En 3 días, En una semana) y el calendario del sistema. */
export function datePicker(value, onChange, { allowEmpty = true, quick = [['Hoy', 0], ['Mañana', 1], ['En 3 días', 3], ['1 semana', 7]] } = {}) {
  let current = value || '';
  const native = el('input', { type: 'date', class: 'cl-date-native', value: current, 'aria-label': 'Elegir fecha' });
  const box = el('div', { class: 'cl-datepick' });
  const draw = () => {
    const today = todayKey();
    fill(box,
      el('div', { class: 'cl-chips is-scroll' },
        allowEmpty && el('button', { type: 'button', class: 'cl-fchip', 'aria-pressed': String(!current), text: 'Sin fecha', onclick: () => set('') }),
        quick.map(([label, n]) => {
          const key = addDays(today, n);
          return el('button', { type: 'button', class: 'cl-fchip', 'aria-pressed': String(current === key), text: label, onclick: () => set(key) });
        }),
        el('label', { class: `cl-fchip cl-date-other${current && !quick.some(([, n]) => addDays(today, n) === current) ? ' is-on' : ''}` }, icon('calendar'), el('span', { text: current && !quick.some(([, n]) => addDays(today, n) === current) ? shortDate(current) : 'Otra' }), native),
      ),
    );
  };
  const set = (key) => {
    current = key;
    native.value = key;
    react('tick');
    onChange(key);
    draw();
  };
  native.addEventListener('change', () => set(native.value));
  draw();
  return box;
}

export function colorSwatches(value, onChange, colors = ['#00b8d4', '#387aff', '#7c4dff', '#e1306c', '#ff5a36', '#ff9800', '#f5b800', '#34c759', '#14b8a6', '#111111']) {
  let current = value;
  const box = el('div', { class: 'cl-swatches', role: 'radiogroup' });
  const draw = () => fill(box, colors.map((c) => el('button', { type: 'button', class: 'cl-swatch', style: { '--c': c }, 'aria-label': c, 'aria-pressed': String(c.toLowerCase() === String(current).toLowerCase()), onclick: () => { current = c; react('tick'); onChange(c); draw(); } })));
  draw();
  return box;
}

/** Lista agrupada como en Ajustes de iOS. */
export const group = (title, ...rows) => el('section', { class: 'cl-group' }, title && el('h3', { class: 'cl-group-title', text: title }), el('div', { class: 'cl-group-box' }, ...rows));
export function rowLink(label, { ico, tone, value, sub, onClick, danger, href } = {}) {
  const tag = href ? 'a' : 'button';
  return el(tag, { type: href ? null : 'button', href, class: `cl-row-set${danger ? ' is-danger' : ''}`, onclick: onClick },
    ico && el('span', { class: 'cl-set-ico', style: tone ? { '--c': tone } : null }, icon(ico)),
    el('span', { class: 'cl-set-main' }, el('b', { text: label }), sub && el('small', { text: sub })),
    value && el('span', { class: 'cl-set-value', text: value }),
    !danger && icon('right', 'cl-set-chev'),
  );
}

// ── Detalles que dan vida ──

/** Números que cuentan hasta su valor al aparecer. */
export function countUp(node, value, format = (v) => String(Math.round(v))) {
  if (still.matches || !value) {
    node.textContent = format(value || 0);
    return node;
  }
  const t0 = performance.now();
  const dur = 650 + Math.min(500, Math.log10(Math.abs(value) + 1) * 110);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = format(value * (1 - (1 - k) ** 4));
    if (k < 1) requestAnimationFrame(step);
  };
  node.textContent = format(0);
  requestAnimationFrame(step);
  return node;
}

/** Confeti de colores: al aprobar, enviar o terminar algo. */
export function burst(from, colors = ['var(--accent)', 'var(--cf-primary)', 'var(--cf-income)', 'var(--cf-orange)', 'var(--cf-purple)']) {
  if (still.matches) return;
  const r = from?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight * 0.62, width: 0, height: 0 };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.35;
    const d = 46 + Math.random() * 64;
    const p = el('i', { class: `cl-burst${i % 3 === 0 ? ' is-round' : ''}`, style: { left: `${x}px`, top: `${y}px`, background: colors[i % colors.length], '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 20}px`, '--r': `${Math.random() * 540 - 270}deg` } });
    document.body.append(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

export const chip = (label, color, ico) => el('span', { class: 'cl-chip', style: color ? { '--c': color } : null }, ico ? icon(ico) : el('i'), label);
export const emptyBox = (ico, title, text, action) => el('div', { class: 'cl-empty' }, el('span', { class: 'cl-empty-ico' }, icon(ico)), el('b', { text: title }), text && el('p', { text }), action);
export const sectionHead = (title, action, sub) => el('div', { class: 'cl-sec-head' }, el('div', {}, el('h2', { text: title }), sub && el('small', { text: sub })), action);
export const more = (text, href) => el('a', { class: 'cl-more', href }, text, icon('right'));
export const skeleton = (n = 3, h = 72) => el('div', { class: 'cl-skel' }, Array.from({ length: n }, (_, i) => el('i', { style: { '--i': i, height: `${h}px` } })));

export async function copyText(text, done = 'Copiado.') {
  try {
    await navigator.clipboard.writeText(text);
    react('success');
    toast(done, 'ok');
  } catch {
    toast('No se pudo copiar.', 'error');
  }
}

/** Un selector de archivos con vista previa y barra de progreso. Devuelve { node, files() }. */
export function filePicker({ accept = '', multiple = false, label = 'Elige un archivo', hint, max = 50 * 1048576 } = {}) {
  let files = [];
  const picker = el('input', { type: 'file', accept, multiple, hidden: true });
  const list = el('div', { class: 'cl-files' });
  const drop = el('button', { type: 'button', class: 'cl-drop', onclick: () => picker.click() },
    el('span', { class: 'cl-drop-ico' }, icon('upload')),
    el('b', { text: label }),
    hint && el('small', { text: hint }),
  );
  const add = (incoming) => {
    for (const f of incoming) {
      if (f.size > max) {
        toast(`«${f.name}» pesa más de ${Math.round(max / 1048576)} MB. Usa un enlace (Drive, WeTransfer…).`, 'error');
        continue;
      }
      files = multiple ? [...files, f] : [f];
    }
    react('pop');
    draw();
  };
  const draw = () => fill(list, files.map((f, i) => {
    const isImg = f.type.startsWith('image/');
    const url = isImg ? URL.createObjectURL(f) : null;
    return el('div', { class: 'cl-file', style: { '--i': i } },
      isImg ? el('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }) : el('span', { class: 'cl-file-ico' }, icon(f.type.startsWith('video/') ? 'film' : 'file')),
      el('span', { class: 'cl-file-main' }, el('b', { text: f.name }), el('small', { text: sizeText(f.size) })),
      el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Quitar', onclick: () => { files = files.filter((x) => x !== f); react('off'); draw(); } }, icon('x')),
    );
  }));
  picker.addEventListener('change', () => add([...picker.files]));
  for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); });
  drop.addEventListener('drop', (e) => add([...e.dataTransfer.files]));
  const progress = el('div', { class: 'cl-progress', hidden: true }, el('i'));
  return {
    node: el('div', { class: 'cl-picker' }, drop, list, progress, picker),
    files: () => files,
    progress(p) {
      progress.hidden = p == null;
      progress.style.setProperty('--p', `${Math.round((p || 0) * 100)}%`);
    },
  };
}
