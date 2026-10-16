// Negocio: datos, cálculos y piezas de interfaz que comparten todas las vistas.
//
// Los datos se cargan enteros al abrir (es una herramienta para una persona) y
// cada cambio se aplica aquí al momento y se manda al Worker en segundo plano,
// en lotes y de uno en uno: KV admite una escritura por segundo en cada clave.

import { encode } from 'uqr';

// ── Servidor ──

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'No se pudo completar.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Estado ──

export const COLS = ['customers', 'catalog', 'paytemplates', 'docs', 'projects', 'tasks', 'time', 'expenses', 'vendors', 'categories', 'brands', 'posts', 'pages', 'leads', 'campaigns'];

export const DEFAULT_STYLE = { layout: 'bold', font: 'inter', accent: 'ink', cover: 'none', logoSize: 44 };
const DEFAULT_SETTINGS = {
  name: 'Schwarck Developer',
  taxId: '',
  email: '',
  phone: '',
  address: '',
  website: 'schwarckdev.com',
  logo: '/favicon.svg',
  signature: '',
  currency: 'USD',
  dueDays: 15,
  quoteDays: 15,
  notes: 'Gracias por tu confianza.',
  terms: '',
  hourlyRate: 0,
};

export const state = { settings: { ...DEFAULT_SETTINGS, style: { ...DEFAULT_STYLE } }, customers: [], catalog: [], paytemplates: [], docs: [], projects: [], tasks: [], time: [] };
export const bus = new EventTarget();
const emit = (type, detail = {}) => bus.dispatchEvent(new CustomEvent(type, { detail }));

function apply(data) {
  state.settings = { ...DEFAULT_SETTINGS, ...data.settings, style: { ...DEFAULT_STYLE, ...data.settings?.style } };
  for (const col of COLS) state[col] = Array.isArray(data[col]) ? data[col] : [];
  // Sin `pub` (el servidor no pudo listar los enlaces hoy) se queda lo que había.
  if (data.pub && typeof data.pub === 'object') state.pub = data.pub;
  else state.pub ||= {};
}

export async function loadAll() {
  apply(await api('/crm'));
}

/** Huella barata de los datos: cuántos hay y cuándo cambió el último de cada lista. */
function fingerprint() {
  const cols = COLS.map((col) => `${state[col].length}:${state[col].reduce((top, x) => (x.updatedAt > top ? x.updatedAt : top), '')}`);
  return `${cols.join('|')}|${state.settings.updatedAt || ''}|${JSON.stringify(state.pub || {})}`;
}

/**
 * Vuelve a leer todo del servidor, por ejemplo al volver a la pestaña tras un rato:
 * lo cambiado desde el teléfono aparece aquí y una pestaña vieja no lo pisa.
 * Si hay algo sin guardar, no se toca nada. Devuelve true si cambió algo.
 */
export async function reloadAll() {
  if (hasUnsaved()) return false;
  const data = await api('/crm');
  if (hasUnsaved()) return false;
  const before = fingerprint();
  apply(data);
  if (fingerprint() === before) return false;
  emit('pub');
  emit('change', { col: '*' });
  return true;
}

/** Lo que pasó en el enlace público de un documento: aperturas, firma o rechazo. */
export const pubOf = (doc) => state.pub?.[doc.id] || null;
export const isSignable = (doc) => doc.type === 'quote' || doc.type === 'proposal';
/** Firmado por el cliente: su contenido ya no cambia. */
export const isLocked = (doc) => isSignable(doc) && Boolean(pubOf(doc)?.acceptedAt);

/** Vuelve a leer las respuestas de los enlaces (al volver a la pestaña, por ejemplo). */
export async function refreshPub() {
  const { pub } = await api('/crm/pub');
  if (!pub) return;
  const before = JSON.stringify(state.pub || {});
  state.pub = pub;
  if (JSON.stringify(state.pub) !== before) {
    emit('pub');
    emit('change', { col: 'pub' });
  }
}

export const find = (col, id) => state[col].find((x) => x.id === id);
export const uid = () => crypto.randomUUID();

// Fila de guardado: un cambio por elemento (el último gana) y un lote cada vez.
// Si el servidor rechaza un lote (un elemento que pesa demasiado, por ejemplo), los
// lotes siguientes se parten por la mitad hasta dar con el culpable, que se aparta
// con un aviso: un solo cambio malo no deja sin guardar todo lo demás.
const BATCH = 50;
const pending = new Map();
const waiters = [];
let timer = 0;
let busy = false;
let lastSent = 0;
let failures = 0;
let batchSize = BATCH;
export const saving = { status: 'saved', message: '' };

function setStatus(status, message = '') {
  saving.status = status;
  saving.message = message;
  emit('status', { status, message });
}

function settle(error) {
  for (const w of waiters.splice(0)) error ? w.reject(error) : w.resolve();
}

function schedule(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(flush, delay);
  if (!busy) setStatus('pending');
}

/** Guarda (o crea) un elemento. Con `now` devuelve una promesa que se cumple al guardarse. */
export function put(col, item, { now = false } = {}) {
  if (col === 'settings') state.settings = item;
  else {
    const list = state[col];
    const at = list.findIndex((x) => x.id === item.id);
    if (at >= 0) list[at] = item;
    else list.push(item);
  }
  pending.set(`${col}:${item.id || ''}`, { op: 'put', col, id: item.id, item });
  emit('change', { col, id: item.id });
  if (now) return flushNow();
  schedule();
  return undefined;
}

export function remove(col, id) {
  state[col] = state[col].filter((x) => x.id !== id);
  pending.set(`${col}:${id}`, { op: 'delete', col, id });
  emit('change', { col, id });
  schedule(300);
}

export function flushNow() {
  const done = new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  clearTimeout(timer);
  flush();
  return done;
}

/** Lo que devuelve el servidor (número, fechas) se copia sin pisar lo editado mientras tanto. */
function merge({ col, item, locked }) {
  if (col === 'settings') {
    state.settings.updatedAt = item.updatedAt;
    return;
  }
  // El cliente firmó mientras tanto: el servidor guardó solo el estado; manda su versión.
  if (locked) return adopt(col, item, 'signed');
  const local = find(col, item.id);
  if (!local) return;
  if (item.number) local.number = item.number;
  local.createdAt = item.createdAt;
  local.updatedAt = item.updatedAt;
}

/** El servidor tiene una versión más nueva (de otro dispositivo, o firmada): esa queda, en el mismo objeto. */
function adopt(col, item, reason) {
  const local = find(col, item.id);
  if (local) {
    for (const key of Object.keys(local)) if (!(key in item)) delete local[key];
    Object.assign(local, item);
  } else {
    state[col].push(item);
  }
  pending.delete(`${col}:${item.id}`);
  emit('conflict', { col, id: item.id, reason });
  emit('change', { col, id: item.id });
}

async function flush() {
  clearTimeout(timer);
  if (busy) return;
  if (!pending.size) {
    setStatus('saved');
    settle();
    return;
  }
  const wait = 1100 - (Date.now() - lastSent);
  if (wait > 0) {
    timer = setTimeout(flush, wait);
    return;
  }
  busy = true;
  const ops = [...pending.values()].slice(0, batchSize);
  for (const op of ops) pending.delete(`${op.col}:${op.id || ''}`);
  setStatus('saving');
  lastSent = Date.now();
  // Cada documento va con la versión del servidor de la que partió: si otro
  // dispositivo lo cambió después, el servidor no lo pisa.
  const body = ops.map((op) => (op.op === 'put' && op.col === 'docs' && op.item?.updatedAt ? { ...op, base: op.item.updatedAt } : op));
  try {
    const { saved, conflicts = [] } = await api('/crm/batch', { method: 'POST', body: { ops: body } });
    failures = 0;
    batchSize = Math.min(BATCH, batchSize * 2);
    for (const entry of saved) merge(entry);
    for (const { col, item } of conflicts) adopt(col, item, 'conflict');
    busy = false;
    emit('saved', { saved });
  } catch (err) {
    busy = false;
    const refused = err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
    if (refused && ops.length === 1) {
      // Este cambio el servidor no lo acepta nunca: se aparta y sigue lo demás.
      const [op] = ops;
      setStatus('error', err.message);
      emit('rejected', { op, message: err.message });
      settle(err);
      if (pending.size) timer = setTimeout(flush, 0);
      return;
    }
    // Lo que no llegó vuelve a la fila, salvo que ya haya una versión más nueva.
    for (const op of ops) {
      const key = `${op.col}:${op.id || ''}`;
      if (!pending.has(key)) pending.set(key, op);
    }
    if (refused) {
      batchSize = Math.max(1, Math.floor(ops.length / 2));
      timer = setTimeout(flush, 0);
      return;
    }
    if (err.status === 401) {
      setStatus('error', 'La sesión caducó.');
      settle(err);
      emit('auth');
      return;
    }
    failures += 1;
    const retry = err.status === 429 || err.status >= 500 || !err.status;
    if (retry && failures < 6) {
      timer = setTimeout(flush, 1200 * failures);
      return;
    }
    setStatus('error', err.message);
    settle(err);
    return;
  }
  flush();
}

export const hasUnsaved = () => busy || pending.size > 0;

// ── Números, monedas y fechas ──

export const CURRENCIES = {
  USD: { label: 'Dólares', sign: '$' },
  EUR: { label: 'Euros', sign: '€' },
  USDT: { label: 'USDT', sign: 'USDT', after: true },
  VES: { label: 'Bolívares', sign: 'Bs' },
};
export const CURRENCY_CODES = Object.keys(CURRENCIES);
// Para las tasas: "1 USD = 36,50 Bs" se escribe siempre desde la moneda más fuerte.
const STRENGTH = { EUR: 4, USD: 3, USDT: 2, VES: 1 };
export const strongest = (a, b) => ((STRENGTH[a] || 0) >= (STRENGTH[b] || 0) ? a : b);
/** Cómo se nombra la moneda junto a una tasa: "1 USD = 36,50 Bs". */
export const unitName = (code) => (code === 'VES' ? 'Bs' : code);

const nf2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const nfFree = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, useGrouping: 'always' });
export const amountText = (v) => nf2.format(v || 0);
export const numText = (v) => nfFree.format(v || 0);

export function money(value, code = 'USD') {
  const c = CURRENCIES[code] || { sign: code, after: true };
  const n = nf2.format(Math.abs(value) || 0);
  const text = c.after ? `${n} ${c.sign}` : c.sign.length > 1 ? `${c.sign} ${n}` : `${c.sign}${n}`;
  return value < -0.004 ? `−${text}` : text;
}

/** Lee "1.234,56", "1234.56" o "1.234" (mil, como se escribe en Venezuela). */
export function parseNum(text) {
  let s = String(text ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!s || s === '-') return 0;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma > dot) s = s.replace(/\./g, '').replace(',', '.');
  else if (comma >= 0) s = s.replace(/,/g, '');
  else if ((s.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const todayISO = () => new Date().toLocaleDateString('en-CA');
export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}
const dfDay = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const dfMonth = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const dfShortMonth = new Intl.DateTimeFormat('es', { month: 'short' });
export const dateText = (iso) => (iso ? dfDay.format(new Date(`${iso}T12:00:00`)) : '');
export const monthText = (key) => {
  const t = dfMonth.format(new Date(`${key}-15T12:00:00`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const shortMonth = (key) => dfShortMonth.format(new Date(`${key}-15T12:00:00`)).replace('.', '');
const dfShortDay = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
/** "21 mar", para tarjetas y filas. */
export const shortDate = (iso) => (iso ? dfShortDay.format(new Date(`${iso}T12:00:00`)).replace('.', '') : '');
export const nowISO = () => new Date().toISOString();
/** La hora local de un instante guardado en ISO: "09:12". */
export const timeText = (iso) => (iso ? new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

// ── Horas ──

/** "2 h 30 min", "45 min". */
export function durationText(minutes) {
  const total = Math.round(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Cronómetro: "04:09" o "1:02:03". */
export function clockText(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Lee una duración como se escribe: "1:30", "1,5" (horas), "90 min", "2 h", "1 h 15 min". En minutos. */
export function parseDuration(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+(?:[.,]\d+)?) ?h(?:oras?|rs?)?)? ?(?:(\d+) ?m(?:in(?:utos?)?)?)?$/.exec(s);
  if (m && (m[1] || m[2])) return Math.round(parseNum(m[1] || '0') * 60) + Number(m[2] || 0);
  return /^\d+(?:[.,]\d+)?$/.test(s) ? Math.round(parseNum(s) * 60) : null;
}

// ── Documentos ──

export const DOC_WORD = { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo', proposal: 'Propuesta' };

export function totals(doc) {
  const items = doc.items || [];
  const subtotal = round2(items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0));
  const discount = doc.discount ? round2(doc.discount.type === 'amount' ? doc.discount.value || 0 : (subtotal * (doc.discount.value || 0)) / 100) : 0;
  const base = round2(subtotal - discount);
  const tax = doc.tax ? round2((base * (doc.tax.rate || 0)) / 100) : 0;
  const withholding = doc.withholding ? round2((((doc.withholding.on === 'tax' ? tax : base) * (doc.withholding.rate || 0)) / 100)) : 0;
  const shipping = doc.shipping ? round2(doc.shipping.amount || 0) : 0;
  const total = round2(base + tax - withholding + shipping);
  const paid = round2((doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  return { subtotal, discount, base, tax, withholding, shipping, total, paid, due: round2(Math.max(0, total - paid)) };
}

/** Estado que se ve: el guardado (borrador, enviada, anulada…) más lo que dicen pagos y fechas. */
export function docStatus(doc, today = todayISO()) {
  if (doc.type === 'receipt') return 'issued';
  if (isSignable(doc)) {
    // Lo que respondió el cliente en el enlace manda sobre lo marcado a mano.
    const pub = pubOf(doc);
    if (pub?.acceptedAt) return 'accepted';
    if (pub?.declinedAt) return 'declined';
    if (doc.status === 'draft' || doc.status === 'void' || doc.status === 'accepted' || doc.status === 'declined') return doc.status;
    if (doc.validUntil && doc.validUntil < today) return 'expired';
    return pub?.viewedAt ? 'viewed' : 'sent';
  }
  if (doc.status === 'draft' || doc.status === 'void') return doc.status;
  const t = totals(doc);
  if (t.total > 0 && t.paid >= t.total - 0.005) return 'paid';
  if (doc.dueDate && doc.dueDate < today) return 'overdue';
  return t.paid > 0 ? 'partial' : 'pending';
}

export const STATUS = {
  draft: ['Borrador', 'var(--body)'],
  pending: ['Pendiente', 'var(--usdt)'],
  partial: ['Pago parcial', 'var(--blue)'],
  overdue: ['Vencida', 'var(--expense)'],
  paid: ['Pagada', 'var(--income)'],
  void: ['Anulada', 'var(--body)'],
  sent: ['Enviada', 'var(--blue)'],
  viewed: ['Vista', 'var(--violet)'],
  accepted: ['Aceptada', 'var(--income)'],
  declined: ['Rechazada', 'var(--expense)'],
  expired: ['Vencida', 'var(--bs)'],
  issued: ['Emitido', 'var(--cyan)'],
};

/** Convierte con una tasa escrita como "1 [más fuerte] = tasa [más débil]". */
export function convert(amount, from, to, rate) {
  if (from === to) return amount;
  if (!(rate > 0)) return null;
  return strongest(from, to) === from ? amount * rate : amount / rate;
}

/** Un importe del documento en la moneda base del negocio, si se puede saber. */
export function inBase(doc, amount) {
  const base = state.settings.currency;
  if (doc.currency === base) return amount;
  if (doc.equiv?.currency === base) return convert(amount, doc.currency, base, doc.equiv.rate);
  return null;
}

export const counts = (doc) => doc.type !== 'receipt' && doc.status !== 'draft' && doc.status !== 'void';

export function snapshotCustomer(c) {
  if (!c) return { name: '', company: '', email: '', phone: '', address: '', taxId: '', website: '' };
  return { name: c.name || '', company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', taxId: c.taxId || '', website: c.website || '' };
}

export function snapshotBusiness(s = state.settings) {
  return { name: s.name || '', taxId: s.taxId || '', email: s.email || '', phone: s.phone || '', address: s.address || '', website: s.website || '', signature: s.signature || '' };
}

export function snapshotPayment(t) {
  if (!t) return null;
  return { templateId: t.id, method: t.method, name: t.name || methodLabel(t.method), fields: (t.fields || []).map((f) => ({ ...f })), link: t.link || '' };
}

export function newDoc(type, customer = null) {
  const s = state.settings;
  const today = todayISO();
  const template = state.paytemplates.find((t) => t.isDefault) || state.paytemplates[0];
  return {
    id: uid(),
    type,
    status: 'draft',
    number: '',
    issueDate: today,
    dueDate: type === 'invoice' ? addDays(today, Number(s.dueDays) || 15) : '',
    validUntil: type === 'quote' || type === 'proposal' ? addDays(today, Number(s.quoteDays) || 15) : '',
    currency: customer?.currency || s.currency || 'USD',
    equiv: null,
    customerId: customer?.id || '',
    customer: snapshotCustomer(customer),
    from: snapshotBusiness(s),
    items: [{ id: uid(), name: '', description: '', qty: 1, price: 0 }],
    discount: null,
    tax: null,
    withholding: null,
    shipping: null,
    payment: snapshotPayment(template),
    notes: s.notes || '',
    sections: s.terms ? [{ id: uid(), title: 'Términos y condiciones', body: s.terms }] : [],
    payments: [],
    signature: true,
    style: { ...DEFAULT_STYLE, ...s.style, ...(type === 'proposal' ? { cover: 'sky' } : {}) },
  };
}

// ── Formas de cobro ──

export const METHODS = {
  pagomovil: { label: 'Pago Móvil', fields: ['Banco', 'Cédula o RIF', 'Teléfono'] },
  transfer: { label: 'Transferencia en Bs', fields: ['Banco', 'Titular', 'Cédula o RIF', 'Cuenta'] },
  zelle: { label: 'Zelle', fields: ['Titular', 'Correo o teléfono'] },
  binance: { label: 'Binance Pay', fields: ['Pay ID', 'Usuario o correo'] },
  usdt: { label: 'USDT en red', fields: ['Red', 'Dirección'] },
  wise: { label: 'Wise', fields: ['Titular', 'Correo', 'IBAN o cuenta'] },
  paypal: { label: 'PayPal', fields: ['Correo'] },
  cash: { label: 'Efectivo', fields: [] },
  other: { label: 'Otro', fields: ['Detalle'] },
};
export const methodLabel = (m) => METHODS[m]?.label || 'Otro';

/** Solo enlaces web: un `javascript:` no llega nunca a un href. */
export function safeLink(text) {
  try {
    const url = new URL(String(text || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

// ── Piezas de interfaz ──

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'data') Object.assign(node.dataset, value);
    else if (key === 'style') for (const [p, v] of Object.entries(value)) node.style.setProperty(p, v);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key.includes('-') || !(key in node)) node.setAttribute(key, value === true ? '' : value);
    else node[key] = value;
  }
  node.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return node;
}

const ICONS = {
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  quote: '<path d="M11 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v2.5"/><path d="M14 3v5h5"/><path d="M17.6 13.4a1.9 1.9 0 0 1 2.7 2.7L15 21.4l-3.4.7.7-3.4z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.5 3 5.2"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  dollar: '<path d="M12 2.5v19M16.5 6.8C15.7 5.4 14 4.5 12 4.5c-2.7 0-4.5 1.5-4.5 3.4 0 4.8 9.3 2.4 9.3 7.6 0 2.2-1.9 3.9-4.8 3.9-2.4 0-4.2-1-5-2.6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.7L16 9.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.6-1-2.7 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 9h-5a3 3 0 0 0 0 6h5z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  hash: '<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2.2 2.2h7.2A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  tasks: '<path d="M12 6h9M12 12h9M12 18h9"/><path d="m3 6 1.6 1.6L7.8 4.4M3 12l1.6 1.6 3.2-3.2M3 18l1.6 1.6 3.2-3.2"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.6M9.5 2.5h5M18.6 6.4l1.4-1.4"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.6" fill="currentColor"/>',
  flag: '<path d="M5 21V4.5M5 4.5h11.5l-2.2 4.2 2.2 4.3H5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1"/><circle cx="4.5" cy="12" r="1.1"/><circle cx="4.5" cy="18" r="1.1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  board: '<rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10.5" y="4" width="5" height="11" rx="1.6"/><rect x="17.5" y="4" width="3" height="7" rx="1.4"/>',
  message: '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="4.5"/>',
  squareCheck: '<rect x="4.5" y="4.5" width="15" height="15" rx="4.5"/><path d="m8.6 12.2 2.4 2.4 4.4-4.8"/>',
};

/** Cada módulo puede sumar sus iconos sin tocar esta lista. */
export function addIcons(map) {
  Object.assign(ICONS, map);
}

export function icon(name) {
  const span = el('span', { class: 'ic', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
  return span;
}

export function iconButton(name, label, onclick, extra = '') {
  return el('button', { type: 'button', class: `ng-ibtn ${extra}`.trim(), 'aria-label': label, title: label, onclick }, icon(name));
}

/** Iniciales y un color fijo por nombre, para los clientes sin foto. */
export function avatar(name, size = '') {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] || '?') + (words[1]?.[0] || '')).toUpperCase();
  const hues = ['--cyan', '--blue', '--violet', '--bs', '--income', '--usdt'];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return el('span', { class: `ng-avatar ${size}`.trim(), style: { '--c': `var(${hues[h % hues.length]})` }, 'aria-hidden': 'true', text: initials });
}

export function tag(status) {
  const [label, color] = STATUS[status] || [status, 'var(--body)'];
  return chip(label, color);
}

/** Etiqueta con punto de color: estados, prioridades… */
export function chip(label, color = 'var(--body)') {
  return el('span', { class: 'ng-tag', style: { '--c': color }, text: label });
}

export function kpi({ label, value, sub, ico, bar, tone }) {
  return el('article', { class: 'ng-kpi' },
    el('div', { class: 'ng-kpi-top' }, el('span', { class: 'ng-kpi-label', text: label }), ico && el('span', { class: 'ng-kpi-ico' }, icon(ico))),
    el('b', { class: 'ng-kpi-value', style: tone ? { color: tone } : null, text: value }),
    bar != null
      ? el('div', { class: 'ng-kpi-bar' }, el('span', { class: 'ng-bar' }, el('i', { style: { width: `${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%` } })), el('small', { text: `${Math.round(bar * 100)}%` }))
      : el('small', { class: 'ng-kpi-sub', text: sub || '' }),
  );
}

export function empty({ ico, title, text, action }) {
  return el('div', { class: 'ng-empty' },
    el('span', { class: 'ng-empty-ico' }, icon(ico)),
    el('b', { text: title }),
    text && el('p', { text }),
    action,
  );
}

/** Control segmentado de CeroFiao: la pieza clara se desliza hasta la opción elegida. */
export function seg(options, value, onChange, label) {
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  const thumb = el('span', { class: 'seg-thumb', 'aria-hidden': 'true' });
  const buttons = options.map(([val, text]) => el('button', {
    type: 'button',
    text,
    'aria-pressed': String(val === value),
    onclick: () => {
      set(val);
      onChange(val);
    },
  }));
  const place = () => {
    const on = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!on || !on.offsetWidth) return;
    box.style.setProperty('--tx', `${on.offsetLeft}px`);
    box.style.setProperty('--tw', `${on.offsetWidth}px`);
    box.classList.add('is-live');
  };
  function set(val) {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === val)));
    place();
  }
  box.append(thumb, ...buttons);
  new ResizeObserver(place).observe(box);
  return box;
}

export function field(label, input, hint) {
  return el('label', { class: 'ng-field' }, el('span', { text: label }), input, hint && el('small', { text: hint }));
}

export function input(props = {}) {
  return el('input', { type: 'text', autocomplete: 'off', ...props });
}

export function select(options, value, props = {}) {
  return el('select', { class: 'ng-select', ...props }, options.map(([v, text]) => el('option', { value: v, text, selected: v === value })));
}

/** Interruptor accesible: un checkbox con aspecto de palanca. */
export function toggle(label, checked, onChange) {
  const box = el('input', { type: 'checkbox', role: 'switch', checked, onchange: () => onChange(box.checked) });
  return el('label', { class: 'ng-toggle' }, el('span', { text: label }), box);
}

// Menús emergentes: van en la capa superior (popover) y se cierran solos al tocar fuera.
export function popover(anchor, content, { align = 'start', side = 'below', className = '' } = {}) {
  const pop = el('div', { class: `ng-pop ${className}`.trim() });
  pop.popover = 'auto';
  pop.append(content);
  // Dentro de una ventana modal el menú va dentro de ella: fuera no se podría tocar.
  (anchor.closest('dialog[open]') || document.body).append(pop);
  pop.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') pop.remove();
  });
  pop.showPopover();
  const a = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  // Junto al riel el menú sale hacia la derecha; en el resto, debajo del botón.
  let left = side === 'right' ? a.right + 12 : align === 'end' ? a.right - w : a.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = side === 'right' ? a.top : a.bottom + 6;
  if (side !== 'right' && top + h > innerHeight - 8 && a.top - h - 6 > 8) top = a.top - h - 6;
  if (side === 'right' && top + h > innerHeight - 8) top = innerHeight - h - 8;
  pop.style.left = `${left}px`;
  pop.style.top = `${Math.max(8, top)}px`;
  return pop;
}

export function menu(anchor, items, options) {
  const list = el('div', { class: 'ng-menu', role: 'menu' });
  let pop;
  for (const item of items) {
    if (!item) continue;
    if (item === '-') {
      list.append(el('hr'));
      continue;
    }
    list.append(el('button', {
      type: 'button',
      role: 'menuitem',
      class: item.danger ? 'is-danger' : '',
      disabled: item.disabled,
      onclick: () => {
        pop.hidePopover();
        item.run();
      },
    }, item.icon && icon(item.icon), el('span', { text: item.label }), item.note && el('small', { text: item.note })));
  }
  pop = popover(anchor, list, options);
  list.querySelector('button:not(:disabled)')?.focus();
  return pop;
}

/** Lista con buscador: clientes, servicios del catálogo… */
export function picker(anchor, { placeholder, items, label, sub, onPick, extra }) {
  const search = input({ placeholder, 'aria-label': placeholder, class: 'ng-pick-search' });
  const list = el('div', { class: 'ng-pick-list', role: 'listbox' });
  const box = el('div', { class: 'ng-menu ng-pick' }, el('div', { class: 'ng-pick-head' }, icon('search'), search), list, extra && el('div', { class: 'ng-pick-foot' }, extra));
  let pop;
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = items().filter((it) => !q || `${label(it)} ${sub?.(it) || ''}`.toLowerCase().includes(q)).slice(0, 60);
    list.replaceChildren(...(shown.length
      ? shown.map((it) => el('button', {
        type: 'button',
        role: 'option',
        onclick: () => {
          pop.hidePopover();
          onPick(it);
        },
      }, el('span', { text: label(it) }), sub && el('small', { text: sub(it) })))
      : [el('p', { class: 'ng-pick-none', text: q ? 'Nada coincide.' : 'Todavía no hay nada aquí.' })]));
  };
  search.addEventListener('input', draw);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') list.querySelector('button')?.click();
  });
  draw();
  pop = popover(anchor, box, { className: 'is-wide' });
  search.focus();
  if (extra) extra.addEventListener('click', () => pop.hidePopover());
  return pop;
}

/** Ventana modal con formulario. `onSubmit` recibe el formulario; si devuelve false, no se cierra. */
export function dialog({ title, body, submit = 'Guardar', onSubmit, danger, wide }) {
  const form = el('form', { class: 'ng-dialog-form', method: 'dialog' });
  const dlg = el('dialog', { class: `ng-dialog${wide ? ' is-wide' : ''}` }, form);
  const close = () => dlg.close();
  form.append(
    el('header', { class: 'ng-dialog-head' }, el('h2', { text: title }), iconButton('x', 'Cerrar', close)),
    el('div', { class: 'ng-dialog-body' }, body),
    el('footer', { class: 'ng-dialog-foot' },
      danger && el('button', { type: 'button', class: 'pill ghost danger', text: danger.label, onclick: () => { if (danger.run() !== false) close(); } }),
      el('span', { class: 'ng-grow' }),
      el('button', { type: 'button', class: 'pill ghost', text: 'Cancelar', onclick: close }),
      el('button', { type: 'submit', class: 'pill', text: submit }),
    ),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (onSubmit(form) !== false) close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  form.querySelector('input, textarea, select')?.focus();
  return dlg;
}

export function confirmBox(text, yes = 'Eliminar') {
  return new Promise((resolve) => {
    let answer = false;
    const dlg = dialog({ title: text, body: null, submit: yes, onSubmit: () => { answer = true; } });
    dlg.classList.add('is-confirm');
    dlg.addEventListener('close', () => resolve(answer));
  });
}

let toastTimer = 0;
export function toast(text, kind = '') {
  const box = document.querySelector('[data-toast]');
  box.textContent = text;
  box.dataset.kind = kind;
  box.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-on'), 3200);
}

/** Código QR como SVG, dibujado aquí mismo: el enlace no sale a ningún servicio. */
export function qr(text) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  let d = '';
  data.forEach((row, y) => row.forEach((on, x) => {
    if (on) d += `M${x} ${y}h1v1h-1z`;
  }));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Código QR del enlace de pago');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/** Ajusta un textarea a su contenido (donde el navegador no sabe hacerlo con CSS). */
export function autosize(area) {
  const fit = () => {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };
  area.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return area;
}
