// Negocio nuevo · las cuentas. Las reglas son las del panel de siempre (cada pago
// con su tasa del día, los documentos guardan su copia del cliente, los números
// los da el servidor…): se importan de negocio-core.js, negocio-gastos.js y
// negocio-work.js, que no pintan nada. Lo que en el panel viejo estaba mezclado
// con su interfaz (leads, clientes) se escribe aquí sin interfaz.
import {
  DOC_WORD,
  addDays,
  counts,
  dateText,
  docStatus,
  find,
  inBase,
  money,
  nowISO,
  paymentBase,
  put,
  round2,
  shortDate,
  state,
  todayISO,
  totals,
  uid,
} from '../../negocio-core.js';
import { change, expenseBase, periodRange, within } from '../../negocio-gastos.js';

export { DOC_WORD, change, dateText, docStatus, money, periodRange, shortDate, todayISO, totals, within };

export const base = () => state.settings.currency || 'USD';
export const list = (col) => state[col] || [];
export const fmt = (v) => money(v || 0, base());

/** Estados de documento con el color de HeroUI que les toca. */
export const DOC_STATUS = {
  draft: ['Borrador', 'default'],
  pending: ['Por cobrar', 'warning'],
  partial: ['Pago parcial', 'accent'],
  overdue: ['Vencida', 'danger'],
  paid: ['Pagada', 'success'],
  void: ['Anulada', 'default'],
  sent: ['Enviada', 'accent'],
  viewed: ['Vista', 'accent'],
  accepted: ['Aceptada', 'success'],
  declined: ['Rechazada', 'danger'],
  expired: ['Caducada', 'warning'],
  issued: ['Emitido', 'accent'],
};

/** Suma importes de documentos en la moneda principal; los que no se pueden pasar se cuentan aparte. */
export function sumBase(pairs, toBase = inBase) {
  let sum = 0;
  let skipped = 0;
  for (const [doc, x] of pairs) {
    const v = toBase(doc, x);
    if (v == null) skipped += 1;
    else sum += v;
  }
  return { sum: round2(sum), skipped };
}

export const invoices = () => list('docs').filter((d) => d.type === 'invoice' && counts(d));

/** Cobros de facturas dentro de un tramo, en la moneda principal. */
export function collected(r) {
  let sum = 0;
  let skipped = 0;
  let count = 0;
  for (const d of invoices()) {
    for (const p of d.payments || []) {
      if (!r || !within(p.date, r)) continue;
      const v = paymentBase(d, p);
      if (v == null) skipped += 1;
      else sum += v;
      count += 1;
    }
  }
  return { sum: round2(sum), skipped, count };
}

export function spent(r) {
  let sum = 0;
  let skipped = 0;
  for (const e of list('expenses')) {
    if (!r || !within(e.date, r)) continue;
    const v = expenseBase(e);
    if (v == null) skipped += 1;
    else sum += v;
  }
  return { sum: round2(sum), skipped };
}

/** Lo que falta por cobrar hoy (todas las facturas abiertas). */
export function receivable() {
  const open = invoices().filter((d) => totals(d).due > 0.004);
  const { sum, skipped } = sumBase(open.map((d) => [d, totals(d).due]));
  return { sum, skipped, open, overdue: open.filter((d) => docStatus(d) === 'overdue') };
}

/** Entradas y salidas de los últimos 12 meses, en la moneda principal. */
export function last12Months(today = todayISO()) {
  const months = [];
  const d = new Date(`${today.slice(0, 7)}-15T12:00:00`);
  for (let i = 11; i >= 0; i -= 1) {
    const m = new Date(d);
    m.setMonth(d.getMonth() - i);
    const key = m.toLocaleDateString('en-CA').slice(0, 7);
    const r = { from: `${key}-01`, to: `${key}-31` };
    months.push({ key, in: collected(r).sum, out: spent(r).sum });
  }
  return months;
}

export function customerStats(id) {
  const docs = list('docs').filter((d) => d.customerId === id);
  const inv = docs.filter((d) => d.type === 'invoice' && counts(d));
  const billed = sumBase(inv.map((d) => [d, totals(d).total])).sum;
  const got = sumBase(
    inv.flatMap((d) => (d.payments || []).map((p) => [d, p])),
    paymentBase,
  ).sum;
  const open = inv.filter((d) => totals(d).due > 0.004);
  const due = sumBase(open.map((d) => [d, totals(d).due])).sum;
  return {
    docs,
    billed,
    collected: got,
    due,
    overdue: open.filter((d) => docStatus(d) === 'overdue').length,
    projects: list('projects').filter((p) => p.customerId === id),
  };
}

export const customerName = (d) => d.customer?.name || d.customer?.company || find('customers', d.customerId)?.name || 'Sin cliente';

/** Saludo con el nombre de la firma de los ajustes. */
export function greeting() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const who = (state.settings.signature || '').trim().split(/\s+/)[0];
  return who ? `${hello}, ${who}` : hello;
}

export const relDay = (iso) => {
  const today = todayISO();
  if (!iso) return '';
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  if (iso === addDays(today, 1)) return 'Mañana';
  return dateText(iso);
};

const localDay = (stamp) => (stamp ? new Date(stamp).toLocaleDateString('en-CA') : '');

/** Lo último que pasó, sacado de los propios datos. */
export function activity(limit = 8) {
  const items = [];
  const WORD = { invoice: 'la factura', quote: 'la cotización', proposal: 'la propuesta', receipt: 'el recibo' };
  for (const d of list('docs')) {
    const who = customerName(d);
    if (d.type === 'invoice') {
      for (const p of d.payments || []) items.push({ date: p.date, kind: 'in', text: `Cobraste ${money(p.amount, d.currency)} de ${who}`, href: `#/documentos/${d.id}` });
      if (counts(d)) items.push({ date: d.issueDate, kind: 'doc', text: `Factura ${d.number} para ${who}`, href: `#/documentos/${d.id}` });
    }
    const pub = state.pub?.[d.id];
    if (pub?.viewedAt) items.push({ date: localDay(pub.lastViewAt || pub.viewedAt), kind: 'view', text: `${who} abrió ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/documentos/${d.id}` });
    if (pub?.acceptedAt) items.push({ date: localDay(pub.acceptedAt), kind: 'ok', text: `${pub.name || who} firmó ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/documentos/${d.id}` });
    if (pub?.declinedAt) items.push({ date: localDay(pub.declinedAt), kind: 'no', text: `${who} rechazó ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/documentos/${d.id}` });
  }
  for (const e of list('expenses')) items.push({ date: e.date, kind: 'out', text: `Gasto en ${e.vendor || e.title}: ${money(e.amount, e.currency)}`, href: '#/gastos' });
  for (const c of list('customers')) if (c.createdAt) items.push({ date: localDay(c.createdAt), kind: 'person', text: `Nuevo cliente: ${c.name}`, href: `#/clientes/${c.id}` });
  for (const l of list('leads')) {
    const who = leadName(l);
    if (l.createdOn) items.push({ date: l.createdOn, kind: 'lead', text: `Nuevo lead: ${who}`, href: `#/leads/${l.id}` });
    if (l.stage === 'won' && l.wonAt) items.push({ date: localDay(l.wonAt), kind: 'ok', text: `Ganaste a ${who}`, href: `#/leads/${l.id}` });
  }
  return items
    .filter((i) => i.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// ── Leads ──

/** Etapas del embudo: nombre, color de HeroUI y probabilidad de cierre por defecto. */
export const LEAD_STAGES = {
  new: ['Nuevo', 'default', 10],
  contacted: ['Contactado', 'accent', 20],
  qualified: ['Calificado', 'accent', 40],
  proposal: ['Propuesta', 'warning', 60],
  negotiation: ['Negociación', 'warning', 80],
  won: ['Ganado', 'success', 100],
  lost: ['Perdido', 'danger', 0],
};
export const STAGE_ORDER = Object.keys(LEAD_STAGES);
export const OPEN_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
export const SOURCES = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  web: 'Web',
  google: 'Google',
  referral: 'Recomendación',
  ads: 'Anuncios',
  event: 'Evento',
  email: 'Correo',
  other: 'Otro',
};
export const ACTIVITIES = { message: 'Mensaje', call: 'Llamada', email: 'Correo', meeting: 'Reunión', note: 'Nota' };
export const LOST_REASONS = ['Precio', 'No respondió', 'Eligió a otro', 'No era el momento', 'No encaja con lo que hacemos', 'Otro'];

export const leadName = (l) => l.name?.trim() || l.company?.trim() || 'Sin nombre';
export const stageOf = (l) => LEAD_STAGES[l.stage] || LEAD_STAGES.new;
export const probOf = (l) => (l.probability != null && l.probability !== '' ? Number(l.probability) : stageOf(l)[2]);
export const isOpenLead = (l) => OPEN_STAGES.includes(l.stage);
export const leadValue = (l) => (l.currency === base() || !l.currency ? Number(l.value) || 0 : null);

export function sumLeads(items, weighted = false) {
  let sum = 0;
  let other = 0;
  for (const l of items) {
    const v = leadValue(l);
    if (v == null) other += 1;
    else sum += weighted ? (v * probOf(l)) / 100 : v;
  }
  return { sum: round2(sum), other };
}

export const isDue = (l, today = todayISO()) => isOpenLead(l) && l.nextAt && l.nextAt <= today;
export const dueLeads = () =>
  list('leads')
    .filter((l) => isDue(l))
    .sort((a, b) => a.nextAt.localeCompare(b.nextAt));

export function followText(iso, today = todayISO()) {
  if (!iso) return '';
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, 1)) return 'Mañana';
  if (iso < today) return `Hace ${Math.round((new Date(`${today}T12:00`) - new Date(`${iso}T12:00`)) / 86400000)} d`;
  return shortDate(iso);
}

export function newLead(over = {}) {
  return {
    id: uid(),
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    source: 'instagram',
    brandId: '',
    campaignId: '',
    postId: '',
    interest: '',
    value: 0,
    currency: base(),
    stage: 'new',
    probability: null,
    nextAt: todayISO(),
    nextNote: 'Primer contacto',
    lostReason: '',
    lostFrom: '',
    customerId: '',
    notes: '',
    activities: [],
    createdOn: todayISO(),
    stageAt: nowISO(),
    wonAt: '',
    lostAt: '',
    ...over,
  };
}

export function logActivity(l, type, text) {
  l.activities = [{ id: uid(), type, text, at: nowISO() }, ...(l.activities || [])].slice(0, 300);
}

/** Cambia la etapa y lo anota (perder necesita el motivo). Igual que en el panel de siempre. */
export function setLeadStage(l, stage, reason = '') {
  if (l.stage === stage) return;
  const from = l.stage;
  l.stage = stage;
  l.stageAt = nowISO();
  l.probability = null;
  if (stage === 'won') {
    l.wonAt = nowISO();
    l.lostAt = '';
    l.nextAt = '';
  } else if (stage === 'lost') {
    l.lostAt = nowISO();
    l.lostFrom = OPEN_STAGES.includes(from) ? from : l.lostFrom || 'new';
    l.lostReason = reason;
    l.wonAt = '';
    l.nextAt = '';
  } else {
    l.wonAt = '';
    l.lostAt = '';
  }
  logActivity(l, 'stage', `${LEAD_STAGES[from]?.[0] || 'Sin etapa'} → ${LEAD_STAGES[stage][0]}${reason ? ` · ${reason}` : ''}`);
  put('leads', l);
}

/** Lo pasa a cliente (o lo enlaza con el que ya tiene ese correo). Devuelve [cliente, ¿nuevo?]. */
export function leadToCustomer(l) {
  const mail = (l.email || '').trim().toLowerCase();
  const existing = (l.customerId && find('customers', l.customerId)) || (mail && list('customers').find((c) => (c.email || '').trim().toLowerCase() === mail));
  if (existing) {
    if (l.customerId !== existing.id) {
      l.customerId = existing.id;
      logActivity(l, 'note', `Enlazado con el cliente ${existing.name}`);
      put('leads', l);
    }
    return [existing, false];
  }
  const c = {
    id: uid(),
    name: l.name?.trim() || l.company?.trim() || 'Cliente',
    company: l.company || '',
    email: l.email || '',
    phone: l.phone || '',
    website: l.website || '',
    taxId: '',
    address: '',
    currency: l.currency || base(),
    notes: [`Llegó como lead por ${SOURCES[l.source] || 'otra vía'} el ${dateText(l.createdOn || todayISO())}.`, l.notes].filter(Boolean).join('\n\n'),
    leadId: l.id,
  };
  put('customers', c);
  l.customerId = c.id;
  logActivity(l, 'note', `Ahora es cliente: ${c.name}`);
  put('leads', l);
  return [c, true];
}

/** Primeros pasos del inicio: lo que falta por configurar. */
export function firstSteps() {
  const s = state.settings;
  return [
    [Boolean(s.taxId || s.email || s.phone), 'Completa tus datos de facturación', '#/ajustes'],
    [list('paytemplates').length > 0, 'Añade cómo te pagan', '#/ajustes'],
    [list('customers').length > 0, 'Guarda tu primer cliente', '#/clientes'],
    [list('docs').some((d) => d.type === 'invoice'), 'Crea tu primera factura', '#/facturas'],
    [list('expenses').length > 0, 'Apunta tu primer gasto', '#/gastos'],
  ];
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '·';
