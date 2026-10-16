// Negocio: listados (facturas, cotizaciones, clientes, catálogo) y ajustes.
// Cada página devuelve { node, refresh }: refresh repinta los datos sin tocar filtros ni foco.

import {
  state, find, put, remove, uid, newDoc, totals, docStatus, inBase, paymentBase, counts, money, dateText, monthText, shortMonth,
  todayISO, el, icon, iconButton, avatar, tag, kpi, empty, seg, field, input, select, dialog, confirmBox, toast,
  parseNum, amountText, round2, CURRENCIES, CURRENCY_CODES, METHODS, methodLabel, safeLink, autosize, toggle, menu,
} from './negocio-core.js';
import { projectForm, projectRow } from './negocio-projects.js';
import { applyTemplate, PROPOSAL_TEMPLATES } from './negocio-propuesta.js';
import { pagesCard } from './negocio-paginas.js';
import { uploadFile, fileUrl, periodRange, within } from './negocio-gastos.js';

export const go = (hash) => {
  location.hash = hash;
};

/** Crea el documento, lo manda a guardar (para que reciba número) y abre el editor. */
export function createDoc(type, customer = null, extra = {}) {
  if (type === 'proposal' && !extra.blocks) return chooseProposal(customer, extra);
  const doc = Object.assign(newDoc(type, customer), extra);
  put('docs', doc, { now: true })?.catch(() => {});
  go(`#/doc/${doc.id}`);
  return doc;
}

/** Una propuesta empieza desde una plantilla: luego se cambia lo que haga falta. */
function chooseProposal(customer, extra) {
  let chosen = 'app';
  const options = Object.entries(PROPOSAL_TEMPLATES).map(([k, t]) => el('button', {
    type: 'button',
    class: 'ng-tpl',
    'aria-pressed': String(k === chosen),
    onclick: (e) => {
      chosen = k;
      for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
    },
  }, el('b', { text: t.label }), el('small', { text: t.title || 'Solo introducción y precio' })));
  dialog({
    title: 'Nueva propuesta',
    submit: 'Crear propuesta',
    body: el('div', { class: 'ng-form' },
      el('p', { class: 'ng-card-text', text: 'Empieza desde una plantilla con objetivos, alcance y calendario. Todo se puede cambiar.' }),
      el('div', { class: 'ng-tpls' }, options),
    ),
    onSubmit: () => {
      const doc = newDoc('proposal', customer);
      applyTemplate(doc, chosen);
      Object.assign(doc, extra);
      put('docs', doc, { now: true })?.catch(() => {});
      go(`#/doc/${doc.id}`);
      return true;
    },
  });
  return null;
}

/** Cómo se nombra cada tipo en sus listados. */
const WORDS = {
  quote: { title: 'Cotizaciones', desc: 'Presupuestos enviados, aceptados y por responder.', one: 'cotización', many: 'cotizaciones', total: 'Cotizado', all: 'Todas las cotizaciones', make: 'Nueva cotización', ico: 'quote', empty: 'Prepara un presupuesto y conviértelo en factura cuando lo acepten.' },
  proposal: { title: 'Propuestas', desc: 'Propuestas con objetivos, alcance y precio, que el cliente firma desde un enlace.', one: 'propuesta', many: 'propuestas', total: 'Propuesto', all: 'Todas las propuestas', make: 'Nueva propuesta', ico: 'send', empty: 'Cuenta qué vas a hacer, cuánto cuesta y deja que el cliente la firme desde su teléfono.' },
};

const PERIODS = [['30d', '30 días'], ['month', 'Este mes'], ['year', 'Este año'], ['all', 'Todo']];
const ui = { period: 'year' };

// Los mismos tramos que Inicio y Gastos: «30 días» son 30 (hoy incluido) y nada pasa de hoy.
const inPeriod = (iso, period) => (period === 'all' ? true : within(iso, periodRange(period)));

const base = () => state.settings.currency || 'USD';
const owedText = (pending, overdue) => `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'} · ${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}`;
/**
 * Suma en la moneda principal pares [documento, importe], o [factura, pago] con
 * `paymentBase`. `left` son los documentos que se quedaron fuera por la moneda.
 */
const sumBase = (pairs, toBase = inBase) => {
  let sum = 0;
  const left = new Set();
  for (const [doc, x] of pairs) {
    const v = toBase(doc, x);
    if (v == null) left.add(doc);
    else sum += v;
  }
  return { sum, skipped: left.size, left };
};

export function head(title, text, ...actions) {
  return el('header', { class: 'ng-head' },
    el('div', {}, el('h1', { text: title }), text && el('p', { text })),
    el('div', { class: 'ng-head-actions' }, actions),
  );
}

function docRow(doc) {
  const status = docStatus(doc);
  const t = totals(doc);
  const who = doc.customer?.name || doc.customer?.company || 'Sin cliente';
  const second = doc.type === 'invoice' ? doc.dueDate : doc.type === 'quote' || doc.type === 'proposal' ? doc.validUntil : '';
  return el('a', { class: 'ng-row', href: `#/doc/${doc.id}` },
    avatar(who),
    el('span', { class: 'ng-row-main' }, el('b', { text: who }), el('small', { text: [doc.number || 'Sin número todavía', doc.type === 'proposal' && doc.title].filter(Boolean).join(' · ') })),
    el('span', { class: 'ng-row-date', text: dateText(doc.issueDate) }),
    el('span', { class: 'ng-row-date is-soft', text: second ? dateText(second) : '' }),
    el('span', { class: 'ng-row-tag' }, tag(status)),
    el('b', { class: 'ng-row-amount', text: money(t.total, doc.currency) }),
    icon('right'),
  );
}

const billable = (d) => d.type === 'invoice' && counts(d);

/** Documentos agrupados por mes, el más reciente arriba. Cada mes suma lo que cuenta (`adds`). */
export function groupedDocs(docs, adds = billable) {
  const groups = new Map();
  for (const doc of [...docs].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.number || '').localeCompare(a.number || ''))) {
    const key = (doc.issueDate || todayISO()).slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return [...groups].map(([key, list]) => {
    const { sum, skipped } = sumBase(list.filter(adds).map((d) => [d, totals(d).total]));
    return el('section', { class: 'ng-group' },
      el('header', {},
        el('h3', {}, monthText(key), el('span', { text: String(list.length) })),
        el('span', { class: 'ng-group-sum', text: money(sum, base()) + (skipped ? ' + otras monedas' : '') }),
      ),
      el('div', { class: 'ng-rows' }, list.map(docRow)),
    );
  });
}

export function searchBox(onInput, placeholder = 'Buscar…') {
  const box = input({ type: 'search', placeholder, 'aria-label': placeholder, oninput: () => onInput(box.value.trim().toLowerCase()) });
  return el('label', { class: 'ng-search' }, icon('search'), box);
}

const matches = (doc, q) => !q || `${doc.number} ${doc.customer?.name} ${doc.customer?.company} ${(doc.items || []).map((i) => i.name).join(' ')}`.toLowerCase().includes(q);

// ── Facturas y cotizaciones ──

export function docsPage(type) {
  const isInvoice = type === 'invoice';
  const W = WORDS[type] || WORDS.quote;
  let kind = type;
  let status = 'all';
  let q = '';
  const kpis = el('div', { class: 'ng-kpis' });
  const note = el('p', { class: 'ng-kpi-note', hidden: true });
  const chart = isInvoice ? el('section', { class: 'ng-card ng-chart-card' }) : null;
  const list = el('div', { class: 'ng-list-body' });
  const countText = el('small');

  const statusOptions = isInvoice
    ? [['all', 'Todos los estados'], ['draft', 'Borradores'], ['pending', 'Pendientes'], ['partial', 'Pago parcial'], ['overdue', 'Vencidas'], ['paid', 'Pagadas'], ['void', 'Anuladas']]
    : [['all', 'Todos los estados'], ['draft', 'Borradores'], ['sent', 'Enviadas'], ['viewed', 'Vistas'], ['accepted', 'Aceptadas'], ['declined', 'Rechazadas'], ['expired', 'Vencidas']];
  const filters = el('div', { class: 'ng-filters' },
    isInvoice && select([['invoice', 'Facturas'], ['receipt', 'Recibos'], ['all', 'Facturas y recibos']], kind, { 'aria-label': 'Tipo', onchange: (e) => { kind = e.target.value; drawList(); } }),
    select(statusOptions, status, { 'aria-label': 'Estado', onchange: (e) => { status = e.target.value; drawList(); } }),
    searchBox((v) => { q = v; drawList(); }, isInvoice ? 'Buscar facturas…' : `Buscar ${W.many}…`),
  );

  function drawKpis() {
    const docs = state.docs.filter((d) => d.type === type && counts(d));
    const inRange = docs.filter((d) => inPeriod(d.issueDate, ui.period));
    const cur = base();
    if (isInvoice) {
      const billed = sumBase(inRange.map((d) => [d, totals(d).total]));
      const settled = sumBase(inRange.map((d) => { const t = totals(d); return [d, Math.min(t.paid, t.total)]; }));
      const payments = [];
      for (const d of docs) for (const p of d.payments || []) if (inPeriod(p.date, ui.period)) payments.push([d, p]);
      const collected = sumBase(payments, paymentBase);
      const open = docs.filter((d) => totals(d).due > 0);
      const owed = sumBase(open.map((d) => [d, totals(d).due]));
      const overdue = open.filter((d) => docStatus(d) === 'overdue').length;
      const paidCount = inRange.filter((d) => docStatus(d) === 'paid').length;
      kpis.replaceChildren(
        kpi({ label: 'Facturado', value: money(billed.sum, cur), ico: 'file', bar: billed.sum ? settled.sum / billed.sum : 0 }),
        kpi({ label: 'Cobrado', value: money(collected.sum, cur), ico: 'checkCircle', sub: `${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}` }),
        kpi({ label: 'Por cobrar', value: money(owed.sum, cur), ico: 'clock', sub: owedText(open.length - overdue, overdue), tone: overdue ? 'var(--expense)' : null }),
        kpi({ label: 'Facturas pagadas', value: `${paidCount} / ${inRange.length}`, ico: 'wallet', bar: inRange.length ? paidCount / inRange.length : 0 }),
      );
      // Una factura que falta en varias cifras se cuenta una sola vez.
      const skipped = new Set([...billed.left, ...collected.left, ...owed.left]).size;
      note.hidden = !skipped;
      note.textContent = `${skipped} ${skipped === 1 ? 'documento en otra moneda no entra' : 'documentos en otras monedas no entran'} en estas cifras: ponles una equivalencia en ${CURRENCIES[cur]?.label.toLowerCase() || cur}.`;
    } else {
      const quoted = sumBase(inRange.map((d) => [d, totals(d).total]));
      const accepted = inRange.filter((d) => docStatus(d) === 'accepted');
      const acceptedSum = sumBase(accepted.map((d) => [d, totals(d).total]));
      const waiting = docs.filter((d) => docStatus(d) === 'sent' || docStatus(d) === 'viewed');
      const decided = inRange.filter((d) => docStatus(d) === 'accepted' || docStatus(d) === 'declined').length;
      const seen = waiting.filter((d) => docStatus(d) === 'viewed').length;
      kpis.replaceChildren(
        kpi({ label: W.total, value: money(quoted.sum, cur), ico: W.ico, sub: `${inRange.length} ${inRange.length === 1 ? W.one : W.many}` }),
        kpi({ label: 'Aceptado', value: money(acceptedSum.sum, cur), ico: 'checkCircle', sub: `${accepted.length} ${accepted.length === 1 ? 'aceptada' : 'aceptadas'}` }),
        kpi({ label: 'Por responder', value: String(waiting.length), ico: 'clock', sub: seen ? `${seen} ya ${seen === 1 ? 'la vio' : 'las vieron'}` : 'Enviadas y vigentes' }),
        kpi({ label: 'Tasa de aceptación', value: decided ? `${Math.round((accepted.length / decided) * 100)}%` : '—', ico: 'send', bar: decided ? accepted.length / decided : 0 }),
      );
      note.hidden = !quoted.skipped;
      note.textContent = `${quoted.skipped} en otras monedas no entran en estas cifras.`;
    }
  }

  function drawChart() {
    if (!chart) return;
    const today = todayISO();
    const months = [];
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00`);
    d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      months.push(d.toLocaleDateString('en-CA').slice(0, 7));
      d.setMonth(d.getMonth() + 1);
    }
    const billed = Object.fromEntries(months.map((m) => [m, 0]));
    const paid = Object.fromEntries(months.map((m) => [m, 0]));
    for (const doc of state.docs) {
      if (doc.type !== 'invoice' || !counts(doc)) continue;
      const m = (doc.issueDate || '').slice(0, 7);
      if (m in billed) billed[m] += inBase(doc, totals(doc).total) || 0;
      for (const p of doc.payments || []) {
        const pm = (p.date || '').slice(0, 7);
        if (pm in paid) paid[pm] += paymentBase(doc, p) || 0;
      }
    }
    const top = Math.max(1, ...months.map((m) => Math.max(billed[m], paid[m])));
    chart.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Últimos 12 meses' }), el('p', { text: 'Lo facturado cada mes y lo que entró.' })),
        el('div', { class: 'ng-legend' }, el('span', { style: { '--c': 'var(--ink)' }, text: 'Facturado' }), el('span', { style: { '--c': 'var(--income)' }, text: 'Cobrado' })),
      ),
      el('div', { class: 'ng-chart', role: 'img', 'aria-label': 'Facturado y cobrado por mes' }, months.map((m) => el('div', { class: `ng-chart-col${m === today.slice(0, 7) ? ' is-now' : ''}` },
        el('div', { class: 'ng-chart-bars' },
          el('i', { class: billed[m] ? '' : 'is-zero', style: { '--v': billed[m] / top }, title: `${monthText(m)} · facturado ${money(billed[m], base())}` }),
          el('i', { class: paid[m] ? 'is-paid' : 'is-zero', style: { '--v': paid[m] / top }, title: `${monthText(m)} · cobrado ${money(paid[m], base())}` }),
        ),
        el('span', { text: shortMonth(m) }),
      ))),
    );
  }

  function drawList() {
    const docs = state.docs.filter((d) => (kind === 'all' ? d.type === 'invoice' || d.type === 'receipt' : d.type === kind) && (status === 'all' || docStatus(d) === status) && matches(d, q));
    const all = state.docs.filter((d) => (kind === 'all' ? d.type === 'invoice' || d.type === 'receipt' : d.type === kind)).length;
    countText.textContent = docs.length === all ? `${all} en total` : `${docs.length} de ${all}`;
    if (!all) {
      list.replaceChildren(empty({
        ico: isInvoice ? 'file' : W.ico,
        title: kind === 'receipt' ? 'Todavía no hay recibos' : isInvoice ? 'Todavía no hay facturas' : `Todavía no hay ${W.many}`,
        text: kind === 'receipt' ? 'Se crean solos al registrar un pago en una factura.' : isInvoice ? 'Crea la primera y cóbrala desde aquí.' : W.empty,
        action: kind !== 'receipt' && el('button', { type: 'button', class: 'pill', onclick: () => createDoc(type) }, icon('plus'), isInvoice ? 'Nueva factura' : W.make),
      }));
      return;
    }
    const adds = kind === 'receipt' ? (d) => d.type === 'receipt' : kind === 'quote' || kind === 'proposal' ? (d) => d.type === kind && counts(d) : billable;
    list.replaceChildren(...(docs.length ? groupedDocs(docs, adds) : [el('p', { class: 'ng-none', text: 'Nada coincide con esos filtros.' })]));
  }

  const refresh = () => {
    drawKpis();
    drawChart();
    drawList();
  };

  const node = el('div', { class: 'ng-page' },
    head(isInvoice ? 'Facturas' : W.title,
      isInvoice ? 'Lo facturado, lo cobrado y lo que falta por cobrar.' : W.desc,
      seg(PERIODS, ui.period, (v) => { ui.period = v; drawKpis(); }, 'Periodo'),
      el('button', { type: 'button', class: 'pill', onclick: () => createDoc(type) }, icon('plus'), isInvoice ? 'Nueva factura' : W.make),
    ),
    kpis,
    note,
    chart,
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: isInvoice ? 'Documentos' : W.all }), countText), filters),
      list,
    ),
  );
  refresh();
  return { node, refresh };
}

// ── Clientes ──

export function customerStats(id) {
  const docs = state.docs.filter((d) => d.customerId === id);
  const invoices = docs.filter((d) => d.type === 'invoice' && counts(d));
  const billed = sumBase(invoices.map((d) => [d, totals(d).total])).sum;
  // «Cobrado» suma cada pago con su tasa del día; la barra mide lo pagado de cada
  // factura a su propia tasa, para que una factura pagada entera la llene.
  const collected = sumBase(invoices.flatMap((d) => (d.payments || []).map((p) => [d, p])), paymentBase).sum;
  const settled = sumBase(invoices.map((d) => [d, totals(d).paid])).sum;
  const open = invoices.filter((d) => totals(d).due > 0);
  const due = sumBase(open.map((d) => [d, totals(d).due])).sum;
  const overdue = open.filter((d) => docStatus(d) === 'overdue').length;
  return { docs, billed, collected, settled, due, pending: open.length - overdue, overdue, quotes: docs.filter((d) => d.type === 'quote').length };
}

export function customerForm(customer, onSaved) {
  const c = customer ? { ...customer } : { id: uid(), name: '', company: '', email: '', phone: '', website: '', taxId: '', address: '', currency: base(), notes: '' };
  const f = {
    name: input({ value: c.name, required: true, maxLength: 120, placeholder: 'María Pérez' }),
    company: input({ value: c.company, maxLength: 120, placeholder: 'Empresa C.A.' }),
    email: input({ type: 'email', value: c.email, maxLength: 160 }),
    phone: input({ type: 'tel', value: c.phone, maxLength: 60 }),
    website: input({ value: c.website, maxLength: 160, placeholder: 'empresa.com' }),
    taxId: input({ value: c.taxId, maxLength: 60, placeholder: 'J-12345678-9' }),
    address: autosize(el('textarea', { value: c.address, rows: 2, maxLength: 400 })),
    currency: select(CURRENCY_CODES.map((k) => [k, `${k} · ${CURRENCIES[k].label}`]), c.currency || base()),
    notes: autosize(el('textarea', { value: c.notes, rows: 2, maxLength: 4000 })),
  };
  dialog({
    title: customer ? 'Editar cliente' : 'Nuevo cliente',
    body: el('div', { class: 'ng-form' },
      el('div', { class: 'ng-grid2' }, field('Nombre', f.name), field('Empresa', f.company)),
      el('div', { class: 'ng-grid2' }, field('Correo', f.email), field('Teléfono', f.phone)),
      el('div', { class: 'ng-grid2' }, field('Web', f.website), field('RIF, cédula o NIF', f.taxId)),
      field('Dirección', f.address),
      field('Moneda en la que le facturas', f.currency),
      field('Notas', f.notes, 'Solo las ves tú.'),
    ),
    danger: customer && {
      label: 'Eliminar',
      run: () => {
        confirmBox(`¿Eliminar a ${customer.name}? Sus documentos se quedan como están.`).then((yes) => {
          if (!yes) return;
          remove('customers', customer.id);
          toast('Cliente eliminado.');
          go('#/clientes');
        });
      },
    },
    onSubmit: () => {
      for (const [k, node] of Object.entries(f)) c[k] = node.value.trim();
      if (!c.name) return false;
      put('customers', c);
      onSaved?.(c);
      return true;
    },
  });
}

export function customersPage() {
  let q = '';
  const kpis = el('div', { class: 'ng-kpis' });
  const list = el('div', { class: 'ng-list-body' });
  const countText = el('small');

  const draw = () => {
    const cur = base();
    const year = todayISO().slice(0, 4);
    const stats = new Map(state.customers.map((c) => [c.id, customerStats(c.id)]));
    const owing = state.customers.filter((c) => stats.get(c.id).due > 0);
    const owed = owing.reduce((s, c) => s + stats.get(c.id).due, 0);
    const yearDocs = state.docs.filter((d) => d.type === 'invoice' && counts(d) && (d.issueDate || '').startsWith(year));
    kpis.replaceChildren(
      kpi({ label: 'Clientes', value: String(state.customers.length), ico: 'users', sub: 'En tu lista' }),
      kpi({ label: 'Con saldo pendiente', value: String(owing.length), ico: 'clock', sub: 'Te deben algo' }),
      kpi({ label: 'Por cobrar', value: money(owed, cur), ico: 'wallet', sub: 'Entre todos' }),
      kpi({ label: `Facturado en ${year}`, value: money(sumBase(yearDocs.map((d) => [d, totals(d).total])).sum, cur), ico: 'file', sub: `${yearDocs.length} facturas` }),
    );
    const shown = state.customers
      .filter((c) => !q || `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q))
      .sort((a, b) => stats.get(b.id).billed - stats.get(a.id).billed || a.name.localeCompare(b.name));
    countText.textContent = shown.length === state.customers.length ? `${shown.length} en total` : `${shown.length} de ${state.customers.length}`;
    if (!state.customers.length) {
      list.replaceChildren(empty({
        ico: 'users',
        title: 'Todavía no hay clientes',
        text: 'Guarda sus datos una vez y aparecen solos en cada factura.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => customerForm(null, draw) }, icon('plus'), 'Nuevo cliente'),
      }));
      return;
    }
    list.replaceChildren(...(shown.length ? [el('div', { class: 'ng-rows' }, shown.map((c) => {
      const s = stats.get(c.id);
      return el('a', { class: 'ng-row is-customer', href: `#/clientes/${c.id}` },
        avatar(c.name),
        el('span', { class: 'ng-row-main' }, el('b', { text: c.name }), el('small', { text: c.company || c.email || 'Sin empresa' })),
        el('span', { class: 'ng-row-stat' }, el('small', { text: 'Facturado' }), el('b', { text: money(s.billed, cur) })),
        el('span', { class: 'ng-row-stat' }, el('small', { text: 'Por cobrar' }), el('b', { class: s.overdue ? 'is-bad' : '', text: money(s.due, cur) })),
        icon('right'),
      );
    }))] : [el('p', { class: 'ng-none', text: 'Nadie coincide con esa búsqueda.' })]));
  };

  const node = el('div', { class: 'ng-page' },
    head('Clientes', 'Sus datos, lo que te han pagado y lo que te deben.',
      el('button', { type: 'button', class: 'pill', onclick: () => customerForm(null, draw) }, icon('plus'), 'Nuevo cliente')),
    kpis,
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Todos los clientes' }), countText), el('div', { class: 'ng-filters' }, searchBox((v) => { q = v; draw(); }, 'Buscar clientes…'))),
      list,
    ),
  );
  draw();
  return { node, refresh: draw };
}

export function customerPage(id) {
  const box = el('div', { class: 'ng-page' });
  const draw = () => {
    const c = find('customers', id);
    if (!c) {
      box.replaceChildren(empty({ ico: 'users', title: 'Ese cliente ya no existe', action: el('a', { class: 'pill', href: '#/clientes', text: 'Ver clientes' }) }));
      return;
    }
    const s = customerStats(id);
    const cur = base();
    const contact = [
      c.email && ['mail', c.email, `mailto:${c.email}`],
      c.phone && ['phone', c.phone, `tel:${c.phone.replace(/[^\d+]/g, '')}`],
      c.website && ['globe', c.website, safeLink(/^https?:/i.test(c.website) ? c.website : `https://${c.website}`)],
      c.address && ['pin', c.address.split('\n').join(', ')],
      c.taxId && ['hash', c.taxId],
    ].filter(Boolean);
    const newMenu = el('button', { type: 'button', class: 'pill' }, icon('plus'), 'Nuevo', icon('down'));
    newMenu.addEventListener('click', () => menu(newMenu, [
      { label: 'Factura', icon: 'file', run: () => createDoc('invoice', c) },
      { label: 'Cotización', icon: 'quote', run: () => createDoc('quote', c) },
      { label: 'Propuesta', icon: 'send', run: () => createDoc('proposal', c) },
      { label: 'Proyecto', icon: 'folder', run: () => projectForm(null, (p) => go(`#/proyectos/${p.id}`), { customer: c }) },
    ], { align: 'end' }));
    const projects = state.projects.filter((p) => p.customerId === c.id);
    box.replaceChildren(...[
      el('header', { class: 'ng-profile' },
        el('a', { class: 'ng-ibtn', href: '#/clientes', 'aria-label': 'Volver a clientes', title: 'Volver' }, icon('back')),
        el('div', { class: 'ng-profile-id' },
          avatar(c.name, 'is-xl'),
          el('div', {}, el('h1', { text: c.name }), c.company && el('p', { text: c.company })),
        ),
        el('div', { class: 'ng-profile-row' },
          el('ul', { class: 'ng-contact' }, contact.map(([ic, text, href]) => el('li', {}, icon(ic), href ? el('a', { href, text, target: ic === 'globe' ? '_blank' : null, rel: ic === 'globe' ? 'noopener' : null }) : el('span', { text })))),
          el('div', { class: 'ng-head-actions' },
            el('button', { type: 'button', class: 'pill ghost', onclick: () => customerForm(c, draw) }, icon('edit'), 'Editar'),
            newMenu,
          ),
        ),
      ),
      el('div', { class: 'ng-kpis' },
        kpi({ label: 'Total facturado', value: money(s.billed, cur), ico: 'dollar', bar: s.billed ? s.settled / s.billed : 0 }),
        kpi({ label: 'Cobrado', value: money(s.collected, cur), ico: 'checkCircle', sub: 'De sus facturas' }),
        kpi({ label: 'Por cobrar', value: money(s.due, cur), ico: 'clock', sub: owedText(s.pending, s.overdue), tone: s.overdue ? 'var(--expense)' : null }),
        kpi({ label: 'Documentos', value: String(s.docs.length), ico: 'file', sub: `${s.quotes} ${s.quotes === 1 ? 'cotización' : 'cotizaciones'}` }),
      ),
      el('section', { class: 'ng-card ng-list' },
        el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Documentos' }), el('small', { text: s.docs.length ? `${s.docs.length} en total` : 'Ninguno todavía' }))),
        el('div', { class: 'ng-list-body' }, s.docs.length ? groupedDocs(s.docs) : empty({
          ico: 'file',
          title: `Nada con ${c.name.split(' ')[0]} todavía`,
          text: 'Sus datos ya salen solos en la factura.',
          action: el('button', { type: 'button', class: 'pill', onclick: () => createDoc('invoice', c) }, icon('plus'), 'Nueva factura'),
        })),
      ),
      projects.length > 0 && el('section', { class: 'ng-card ng-list' },
        el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Proyectos' }), el('small', { text: `${projects.length} en total` }))),
        el('div', { class: 'ng-rows' }, projects.map(projectRow)),
      ),
      pagesCard({ customerId: c.id }),
      c.notes && el('section', { class: 'ng-card ng-notes' }, el('h2', { text: 'Notas' }), el('p', { text: c.notes })),
    ].filter(Boolean));
  };
  draw();
  return { node: box, refresh: draw };
}

// ── Catálogo ──

/** Un servicio del catálogo. `prefill` rellena uno nuevo (por ejemplo, desde una línea de factura). */
export function catalogForm(item, onSaved, prefill = null) {
  const it = item ? { ...item } : { id: uid(), name: '', description: '', price: 0, currency: base(), image: '', ...prefill };
  const f = {
    name: input({ value: it.name, required: true, maxLength: 160, placeholder: 'Diseño de interfaz' }),
    description: autosize(el('textarea', { value: it.description, rows: 2, maxLength: 1000, placeholder: 'Lo que incluye, en una línea.' })),
    price: input({ value: it.price ? amountText(it.price) : '', inputmode: 'decimal', placeholder: '0,00' }),
    currency: select(CURRENCY_CODES.map((k) => [k, k]), it.currency || base(), { 'aria-label': 'Moneda' }),
  };
  const photo = el('div', { class: 'ng-logo-row' });
  const drawPhoto = () => {
    const pick = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    pick.addEventListener('change', async () => {
      const file = pick.files[0];
      if (!file) return;
      toast('Subiendo foto…');
      try {
        it.image = fileUrl((await uploadFile(file)).id);
        drawPhoto();
        toast('Foto lista.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    photo.replaceChildren(
      el('div', { class: `ng-logo-pick is-photo${it.image ? '' : ' is-empty'}` }, el('img', { src: it.image || '', alt: '' }), el('span', { text: 'Sin foto' })),
      el('div', { class: 'ng-logo-actions' },
        el('button', { type: 'button', class: 'pill ghost sm', onclick: () => pick.click() }, icon('upload'), it.image ? 'Cambiar foto' : 'Subir foto'),
        it.image && el('button', { type: 'button', class: 'pill ghost sm', text: 'Quitar', onclick: () => { it.image = ''; drawPhoto(); } }),
        el('small', { text: 'Sale junto a la línea en facturas, cotizaciones y propuestas.' }),
        pick,
      ),
    );
  };
  drawPhoto();
  dialog({
    title: item ? 'Editar servicio' : 'Nuevo servicio',
    body: el('div', { class: 'ng-form' },
      field('Nombre', f.name),
      field('Descripción', f.description),
      el('div', { class: 'ng-grid2 is-price' }, field('Precio', f.price), field('Moneda', f.currency)),
      el('div', { class: 'ng-field' }, el('span', { text: 'Foto' }), photo),
    ),
    danger: item && {
      label: 'Eliminar',
      run: () => {
        remove('catalog', item.id);
        toast('Servicio eliminado.');
        onSaved?.();
      },
    },
    onSubmit: () => {
      it.name = f.name.value.trim();
      if (!it.name) return false;
      it.description = f.description.value.trim();
      it.price = parseNum(f.price.value);
      it.currency = f.currency.value;
      put('catalog', it);
      onSaved?.(it);
      return true;
    },
  });
}

export function catalogPage() {
  let q = '';
  const list = el('div', { class: 'ng-list-body' });
  const countText = el('small');
  const draw = () => {
    const shown = state.catalog.filter((it) => !q || `${it.name} ${it.description}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    countText.textContent = `${state.catalog.length} ${state.catalog.length === 1 ? 'servicio' : 'servicios'}`;
    if (!state.catalog.length) {
      list.replaceChildren(empty({
        ico: 'box',
        title: 'El catálogo está vacío',
        text: 'Guarda lo que vendes con su precio y añádelo a una factura con un clic.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => catalogForm(null, draw) }, icon('plus'), 'Nuevo servicio'),
      }));
      return;
    }
    list.replaceChildren(shown.length ? el('div', { class: 'ng-rows' }, shown.map((it) => el('button', { type: 'button', class: 'ng-row is-item', onclick: () => catalogForm(it, draw) },
      it.image ? el('span', { class: 'ng-row-ico is-photo' }, el('img', { src: it.image, alt: '' })) : el('span', { class: 'ng-row-ico' }, icon('box')),
      el('span', { class: 'ng-row-main' }, el('b', { text: it.name }), el('small', { text: it.description || 'Sin descripción' })),
      el('b', { class: 'ng-row-amount', text: money(it.price, it.currency) }),
      icon('edit'),
    ))) : el('p', { class: 'ng-none', text: 'Nada coincide.' }));
  };
  const node = el('div', { class: 'ng-page' },
    head('Catálogo', 'Lo que vendes, con su precio, listo para las facturas.',
      el('button', { type: 'button', class: 'pill', onclick: () => catalogForm(null, draw) }, icon('plus'), 'Nuevo servicio')),
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Servicios' }), countText), el('div', { class: 'ng-filters' }, searchBox((v) => { q = v; draw(); }, 'Buscar en el catálogo…'))),
      list,
    ),
  );
  draw();
  return { node, refresh: draw };
}

// ── Formas de cobro ──

export function templateForm(template, onSaved) {
  const t = template ? { ...template, fields: template.fields.map((x) => ({ ...x })) } : { id: uid(), method: 'pagomovil', name: '', fields: [], link: '', isDefault: !state.paytemplates.length };
  if (!template) t.fields = METHODS[t.method].fields.map((label) => ({ label, value: '' }));
  const rows = el('div', { class: 'ng-kv' });
  const method = select(Object.entries(METHODS).map(([k, m]) => [k, m.label]), t.method);
  const name = input({ value: t.name, maxLength: 80, placeholder: METHODS[t.method].label });
  const link = input({ type: 'url', value: t.link, maxLength: 500, placeholder: 'https://…' });
  let isDefault = t.isDefault;

  const drawRows = () => {
    rows.replaceChildren(...t.fields.map((f, i) => el('div', { class: 'ng-kv-row' },
      input({ value: f.label, maxLength: 60, 'aria-label': 'Nombre del dato', placeholder: 'Dato', oninput: (e) => { f.label = e.target.value; } }),
      input({ value: f.value, maxLength: 200, 'aria-label': f.label || 'Valor', placeholder: 'Valor', oninput: (e) => { f.value = e.target.value; } }),
      iconButton('x', 'Quitar dato', () => { t.fields.splice(i, 1); drawRows(); }),
    )), el('button', { type: 'button', class: 'ng-add', onclick: () => { t.fields.push({ label: '', value: '' }); drawRows(); rows.querySelector('.ng-kv-row:last-of-type input')?.focus(); } }, icon('plus'), 'Añadir dato'));
  };
  method.addEventListener('change', () => {
    // Al cambiar de método se proponen sus datos, sin perder lo ya escrito.
    const filled = t.fields.filter((f) => f.value.trim());
    t.method = method.value;
    t.fields = [...filled, ...METHODS[t.method].fields.filter((l) => !filled.some((f) => f.label === l)).map((label) => ({ label, value: '' }))];
    name.placeholder = METHODS[t.method].label;
    drawRows();
  });
  drawRows();

  dialog({
    title: template ? 'Editar forma de cobro' : 'Nueva forma de cobro',
    wide: true,
    body: el('div', { class: 'ng-form' },
      el('div', { class: 'ng-grid2' }, field('Método', method), field('Nombre en la factura', name)),
      el('div', { class: 'ng-field' }, el('span', { text: 'Datos que verá el cliente' }), rows),
      field('Enlace de pago (opcional)', link, 'Sale en la factura como botón y como código QR.'),
      toggle('Usar por defecto en las facturas nuevas', isDefault, (v) => { isDefault = v; }),
    ),
    danger: template && {
      label: 'Eliminar',
      run: () => {
        remove('paytemplates', template.id);
        onSaved?.();
      },
    },
    onSubmit: () => {
      const url = link.value.trim();
      if (url && !safeLink(url)) {
        toast('El enlace tiene que empezar por https://', 'error');
        return false;
      }
      t.name = name.value.trim();
      t.link = url ? safeLink(url) : '';
      t.fields = t.fields.map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label || f.value);
      t.isDefault = isDefault;
      if (isDefault) {
        for (const other of state.paytemplates) {
          if (other.id !== t.id && other.isDefault) put('paytemplates', { ...other, isDefault: false });
        }
      }
      put('paytemplates', t);
      onSaved?.(t);
      return true;
    },
  });
}

// ── Ajustes ──

async function readLogo(file) {
  if (file.type === 'image/svg+xml' && file.size < 120_000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // Las fotos se reducen: el logo viaja dentro de los datos del negocio.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 360 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  return png.length < 250_000 ? png : canvas.toDataURL('image/webp', 0.86);
}

export function settingsPage() {
  const s = state.settings;
  const save = () => put('settings', s);
  const bind = (node, key, read = (v) => v) => {
    node.addEventListener('input', () => {
      s[key] = read(node.value);
      save();
    });
    return node;
  };
  const text = (key, props = {}) => bind(input({ value: s[key] ?? '', ...props }), key);
  const area = (key, props = {}) => bind(autosize(el('textarea', { value: s[key] ?? '', rows: 2, ...props })), key);

  const logoImg = el('img', { alt: '', src: s.logo || '' });
  const logoBox = el('div', { class: `ng-logo-pick${s.logo ? '' : ' is-empty'}` }, logoImg, el('span', { text: 'Sin logo' }));
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      s.logo = await readLogo(f);
      logoImg.src = s.logo;
      logoBox.classList.remove('is-empty');
      save();
    } catch {
      toast('No se pudo leer esa imagen.', 'error');
    }
  });

  const payList = el('div', { class: 'ng-rows' });
  const drawPay = () => {
    payList.replaceChildren(...state.paytemplates.map((t) => el('button', { type: 'button', class: 'ng-row is-item', onclick: () => templateForm(t, drawPay) },
      el('span', { class: 'ng-row-ico' }, icon('wallet')),
      el('span', { class: 'ng-row-main' }, el('b', { text: t.name || methodLabel(t.method) }), el('small', { text: [methodLabel(t.method), ...t.fields.map((f) => f.value).filter(Boolean)].join(' · ') })),
      t.isDefault && el('span', { class: 'ng-row-tag' }, el('span', { class: 'ng-tag', style: { '--c': 'var(--cyan)' }, text: 'Por defecto' })),
      icon('edit'),
    )), el('button', { type: 'button', class: 'ng-add', onclick: () => templateForm(null, drawPay) }, icon('plus'), 'Añadir forma de cobro'));
  };
  drawPay();

  const libList = el('div', { class: 'ng-rows' });
  const sectionForm = (entry) => {
    const title = input({ value: entry?.title || '', required: true, maxLength: 120, placeholder: 'Garantía' });
    const body = autosize(el('textarea', { value: entry?.body || '', rows: 6, maxLength: 8000 }));
    dialog({
      title: entry ? 'Editar sección guardada' : 'Nueva sección guardada',
      wide: true,
      body: el('div', { class: 'ng-form' }, field('Título', title), field('Texto', body, 'Se añade tal cual a cualquier factura, cotización o propuesta.')),
      danger: entry && {
        label: 'Quitar de la biblioteca',
        run: () => {
          put('settings', { ...state.settings, sections: (state.settings.sections || []).filter((x) => x.id !== entry.id) });
          drawLib();
        },
      },
      onSubmit: () => {
        if (!title.value.trim()) return false;
        const next = { id: entry?.id || uid(), title: title.value.trim(), body: body.value };
        const list = [...(state.settings.sections || [])];
        const at = list.findIndex((x) => x.id === next.id);
        if (at >= 0) list[at] = next;
        else list.push(next);
        put('settings', { ...state.settings, sections: list });
        drawLib();
        return true;
      },
    });
  };
  const drawLib = () => {
    const sections = state.settings.sections || [];
    const blocks = state.settings.savedBlocks || [];
    const move = (i, step) => {
      const list = [...sections];
      const [x] = list.splice(i, 1);
      list.splice(i + step, 0, x);
      put('settings', { ...state.settings, sections: list });
      drawLib();
    };
    libList.replaceChildren(
      ...sections.map((x, i) => el('div', { class: 'ng-row is-item is-lib' },
        el('span', { class: 'ng-row-ico' }, icon('bookmark')),
        el('button', { type: 'button', class: 'ng-row-main ng-lib-open', onclick: () => sectionForm(x) }, el('b', { text: x.title || 'Sin título' }), el('small', { text: (x.body || '').replace(/\s+/g, ' ').slice(0, 120) || 'Sin texto' })),
        iconButton('up', 'Subir', () => move(i, -1), `is-sm${i === 0 ? ' is-hidden' : ''}`),
        iconButton('down', 'Bajar', () => move(i, 1), `is-sm${i === sections.length - 1 ? ' is-hidden' : ''}`),
      )),
      ...blocks.map((x) => el('div', { class: 'ng-row is-item is-lib' },
        el('span', { class: 'ng-row-ico' }, icon('send')),
        el('span', { class: 'ng-row-main' }, el('b', { text: x.label }), el('small', { text: 'Bloque de propuesta' })),
        iconButton('trash', 'Quitar de la biblioteca', () => {
          put('settings', { ...state.settings, savedBlocks: (state.settings.savedBlocks || []).filter((y) => y.id !== x.id) });
          drawLib();
        }, 'is-sm'),
      )),
      el('button', { type: 'button', class: 'ng-add', onclick: () => sectionForm(null) }, icon('plus'), 'Nueva sección'),
    );
  };
  drawLib();

  const backup = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `negocio-${todayISO()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const node = el('div', { class: 'ng-page ng-settings' },
    head('Ajustes', 'Tus datos de facturación y cómo te pagan. Los documentos ya emitidos guardan su propia copia.'),
    el('section', { class: 'ng-card' },
      el('h2', { text: 'Tu negocio' }),
      el('div', { class: 'ng-logo-row' },
        logoBox,
        el('div', { class: 'ng-logo-actions' },
          el('button', { type: 'button', class: 'pill ghost sm', onclick: () => file.click() }, icon('upload'), 'Subir logo'),
          el('button', { type: 'button', class: 'pill ghost sm', onclick: () => { s.logo = ''; logoBox.classList.add('is-empty'); save(); } }, 'Quitar'),
          el('small', { text: 'PNG, JPG, WebP o SVG. Se reduce solo.' }),
        ),
        file,
      ),
      el('div', { class: 'ng-form' },
        el('div', { class: 'ng-grid2' }, field('Nombre o razón social', text('name', { maxLength: 120 })), field('RIF, cédula o NIF', text('taxId', { maxLength: 60 }))),
        el('div', { class: 'ng-grid2' }, field('Correo', text('email', { type: 'email', maxLength: 160 })), field('Teléfono', text('phone', { type: 'tel', maxLength: 60 }))),
        el('div', { class: 'ng-grid2' }, field('Web', text('website', { maxLength: 160 })), field('Firma', text('signature', { maxLength: 80, placeholder: s.name }), 'El nombre que sale firmado al pie.')),
        field('Dirección', area('address', { maxLength: 400 })),
      ),
    ),
    el('section', { class: 'ng-card' },
      el('h2', { text: 'Facturación' }),
      el('div', { class: 'ng-form' },
        el('div', { class: 'ng-grid3' },
          field('Moneda principal', bind(select(CURRENCY_CODES.map((k) => [k, `${k} · ${CURRENCIES[k].label}`]), s.currency), 'currency'), 'Las cifras de los listados van en esta moneda.'),
          field('Días para pagar una factura', text('dueDays', { inputmode: 'numeric', maxLength: 3 })),
          field('Días de validez de una cotización', text('quoteDays', { inputmode: 'numeric', maxLength: 3 })),
        ),
        el('div', { class: 'ng-grid3' },
          field('Tarifa por hora', bind(input({ value: s.hourlyRate ? amountText(s.hourlyRate) : '', inputmode: 'decimal', placeholder: '0,00' }), 'hourlyRate', (v) => round2(parseNum(v))), 'La de los proyectos nuevos y las horas sin proyecto.'),
        ),
        field('Nota al pie por defecto', area('notes', { maxLength: 2000 })),
        field('Términos y condiciones por defecto', area('terms', { maxLength: 8000, placeholder: 'Se añaden a cada documento nuevo. Déjalo vacío para no añadirlos.' })),
      ),
    ),
    el('section', { class: 'ng-card' },
      el('h2', { text: 'Formas de cobro' }),
      el('p', { class: 'ng-card-text', text: 'Pago Móvil, Zelle, Binance… La que marques por defecto sale sola en cada factura nueva, y en cada una se puede cambiar.' }),
      payList,
    ),
    el('section', { class: 'ng-card' },
      el('h2', { text: 'Biblioteca de secciones' }),
      el('p', { class: 'ng-card-text', text: 'Términos, garantías, condiciones de pago… Guárdalas una vez y añádelas a cualquier documento con «De la biblioteca». Los bloques de propuesta que guardes también salen aquí.' }),
      libList,
    ),
    el('section', { class: 'ng-card' },
      el('h2', { text: 'Copia de seguridad' }),
      el('p', { class: 'ng-card-text', text: 'Descarga todos tus clientes, servicios, documentos, proyectos, tareas y horas en un archivo JSON.' }),
      el('button', { type: 'button', class: 'pill ghost', onclick: backup }, icon('download'), 'Descargar copia'),
    ),
  );
  return { node, refresh: () => { drawPay(); drawLib(); } };
}

