// Negocio: inicio. Lo que entró, lo que salió y lo que falta por cobrar,
// con lo último que pasó. Todo se calcula con los datos ya cargados.

import {
  state, find, totals, docStatus, counts, inBase, money, dateText, monthText, shortMonth, todayISO, addDays,
  el, icon, avatar, tag, seg,
} from './negocio-core.js';
import { createDoc } from './negocio-views.js';
import { leadsHomeCard } from './negocio-leads.js';
import {
  PERIODS, PREV_TEXT, period, periodRange, within, change, stat, expenseBase, sumExpenses, expenseForm, vendorMark,
} from './negocio-gastos.js';

const base = () => state.settings.currency || 'USD';
const list = (col) => state[col] || [];
const STEPS_KEY = 'negocio-primeros-pasos';
const PERIOD_NAME = { '30d': 'los últimos 30 días', month: 'este mes', year: 'este año', all: 'siempre' };

const invoices = () => list('docs').filter((d) => d.type === 'invoice' && counts(d));

/** Cobros (pagos de facturas) dentro de un tramo, en la moneda principal. */
function collected(r) {
  let sum = 0;
  let count = 0;
  for (const d of invoices()) {
    for (const p of d.payments || []) {
      if (!within(p.date, r)) continue;
      sum += inBase(d, Number(p.amount) || 0) || 0;
      count += 1;
    }
  }
  return { sum, count };
}

function greeting() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const who = (state.settings.signature || '').trim().split(/\s+/)[0];
  return who ? `${hello}, ${who}` : hello;
}

/** Las marcas de tiempo vienen en UTC; el día que importa es el de aquí. */
const localDay = (stamp) => (stamp ? new Date(stamp).toLocaleDateString('en-CA') : '');

const relDay = (iso) => {
  const today = todayISO();
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  return dateText(iso);
};

/** Lo último que pasó, sacado de los propios datos: cobros, facturas, cotizaciones, gastos y clientes. */
function activity() {
  const items = [];
  for (const d of list('docs')) {
    const who = d.customer?.name || d.customer?.company || 'un cliente';
    if (d.type === 'invoice') {
      for (const p of d.payments || []) items.push({ date: p.date, ico: 'dollar', c: 'var(--income)', text: `Cobraste ${money(p.amount, d.currency)} de ${who}`, href: `#/doc/${d.id}` });
      if (counts(d)) items.push({ date: d.issueDate, ico: 'file', c: 'var(--ink)', text: `Factura ${d.number} para ${who}`, href: `#/doc/${d.id}` });
    }
    if (d.type === 'quote' && d.status === 'accepted') items.push({ date: d.updatedAt ? localDay(d.updatedAt) : d.issueDate, ico: 'check', c: 'var(--income)', text: `${who} aceptó la ${d.number}`, href: `#/doc/${d.id}` });
    if (d.type === 'quote' && d.status === 'sent') items.push({ date: d.issueDate, ico: 'send', c: 'var(--blue)', text: `Cotización ${d.number} para ${who}`, href: `#/doc/${d.id}` });
  }
  const WORD = { invoice: 'la factura', quote: 'la cotización', proposal: 'la propuesta', receipt: 'el recibo' };
  for (const d of list('docs')) {
    const pub = state.pub?.[d.id];
    if (!pub) continue;
    const who = d.customer?.name || d.customer?.company || 'El cliente';
    if (pub.viewedAt) items.push({ date: localDay(pub.lastViewAt || pub.viewedAt), ico: 'eye', c: 'var(--violet)', text: `${who} abrió ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/doc/${d.id}` });
    if (pub.acceptedAt) items.push({ date: localDay(pub.acceptedAt), ico: 'check', c: 'var(--income)', text: `${pub.name || who} firmó ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/doc/${d.id}` });
    if (pub.declinedAt) items.push({ date: localDay(pub.declinedAt), ico: 'x', c: 'var(--expense)', text: `${who} rechazó ${WORD[d.type] || 'el documento'} ${d.number}`, href: `#/doc/${d.id}` });
  }
  for (const e of list('expenses')) items.push({ date: e.date, ico: 'wallet', c: 'var(--expense)', text: `Gasto en ${e.vendor || e.title}: ${money(e.amount, e.currency)}`, href: '#/gastos' });
  for (const c of list('customers')) if (c.createdAt) items.push({ date: localDay(c.createdAt), ico: 'users', c: 'var(--violet)', text: `Nuevo cliente: ${c.name}`, href: `#/clientes/${c.id}` });
  for (const l of list('leads')) {
    const who = l.name || l.company || 'Un lead';
    if (l.createdOn) items.push({ date: l.createdOn, ico: 'funnel', c: 'var(--violet)', text: `Nuevo lead: ${who}`, href: '#/leads' });
    if (l.stage === 'won' && l.wonAt) items.push({ date: localDay(l.wonAt), ico: 'check', c: 'var(--income)', text: `Ganaste a ${who}`, href: '#/leads' });
  }
  return items.filter((i) => i.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

/** Primeros pasos: desaparece cuando todo está hecho o si se cierra. */
function firstSteps(onClose) {
  let closed = false;
  try {
    closed = localStorage.getItem(STEPS_KEY) === 'cerrado';
  } catch {
    // Sin almacenamiento se enseña siempre que falte algo.
  }
  const s = state.settings;
  const steps = [
    [Boolean(s.taxId || s.email || s.phone), 'Completa tus datos de facturación', '#/ajustes'],
    [list('paytemplates').length > 0, 'Añade cómo te pagan', '#/ajustes'],
    [list('customers').length > 0, 'Guarda tu primer cliente', '#/clientes'],
    [list('docs').some((d) => d.type === 'invoice'), 'Crea tu primera factura', '#/facturas'],
    [list('expenses').length > 0, 'Apunta tu primer gasto', '#/gastos'],
  ];
  const done = steps.filter(([ok]) => ok).length;
  if (closed || done === steps.length) return null;
  const card = el('section', { class: 'ng-card ng-steps' },
    el('header', { class: 'ng-card-head' },
      el('div', {}, el('h2', { text: 'Primeros pasos' }), el('p', { text: `${done} de ${steps.length} hechos` })),
      el('button', {
        type: 'button',
        class: 'pill ghost sm',
        text: 'Ocultar',
        onclick: () => {
          try {
            localStorage.setItem(STEPS_KEY, 'cerrado');
          } catch {
            // Se oculta solo en esta visita.
          }
          card.remove();
          onClose?.();
        },
      }),
    ),
    el('span', { class: 'ng-bar is-wide' }, el('i', { style: { width: `${(done / steps.length) * 100}%` } })),
    el('ol', {}, steps.map(([ok, text, href]) => el('li', { class: ok ? 'is-done' : '' }, el('a', { href }, el('span', { class: 'ng-step-mark' }, ok && icon('check')), el('span', { text }), !ok && icon('right'))))),
  );
  return card;
}

export function homePage() {
  const box = el('div', { class: 'ng-page ng-home' });
  const draw = () => {
    const r = periodRange();
    const cur = base();
    const inc = collected(r);
    const incBefore = r.prev ? collected(r.prev).sum : 0;
    const spentList = list('expenses').filter((e) => within(e.date, r));
    const spent = sumExpenses(spentList);
    const spentBefore = r.prev ? sumExpenses(list('expenses').filter((e) => within(e.date, r.prev))).sum : 0;
    const profit = inc.sum - spent.sum;
    const profitBefore = incBefore - spentBefore;
    const billed = invoices().filter((d) => within(d.issueDate, r)).reduce((s, d) => s + (inBase(d, totals(d).total) || 0), 0);
    const open = invoices().filter((d) => totals(d).due > 0.004);
    const owed = open.reduce((s, d) => s + (inBase(d, totals(d).due) || 0), 0);
    const overdue = open.filter((d) => docStatus(d) === 'overdue');

    // Ingresos y gastos de los últimos 12 meses.
    const today = todayISO();
    const months = [];
    const m0 = new Date(`${today.slice(0, 7)}-15T12:00:00`);
    m0.setMonth(m0.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      months.push(m0.toLocaleDateString('en-CA').slice(0, 7));
      m0.setMonth(m0.getMonth() + 1);
    }
    const inM = Object.fromEntries(months.map((m) => [m, 0]));
    const outM = Object.fromEntries(months.map((m) => [m, 0]));
    for (const d of invoices()) for (const p of d.payments || []) {
      const m = (p.date || '').slice(0, 7);
      if (m in inM) inM[m] += inBase(d, Number(p.amount) || 0) || 0;
    }
    for (const e of list('expenses')) {
      const m = (e.date || '').slice(0, 7);
      if (m in outM) outM[m] += expenseBase(e) || 0;
    }
    const top = Math.max(1, ...months.map((m) => Math.max(inM[m], outM[m])));

    const feed = activity();
    const dueList = [...open].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 5);
    const lastSpent = [...list('expenses')].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    const prevText = r.prev ? PREV_TEXT[period.value] : '';

    box.replaceChildren(...[
      el('header', { class: 'ng-head' },
        el('div', {}, el('h1', { text: greeting() }), el('p', { text: 'Así va tu negocio.' })),
        el('div', { class: 'ng-head-actions' }, seg(PERIODS, period.value, (v) => { period.value = v; draw(); }, 'Periodo')),
      ),
      firstSteps(draw),
      el('div', { class: 'ng-dash-top' },
        stat({ label: 'Cobrado', value: money(inc.sum, cur), delta: change(inc.sum, incBefore), sub: `${inc.count} ${inc.count === 1 ? 'pago' : 'pagos'} · ${money(billed, cur)} facturado` }),
        stat({ label: 'Gastado', value: money(spent.sum, cur), delta: change(spent.sum, spentBefore), upIsGood: false, sub: `${spentList.length} ${spentList.length === 1 ? 'gasto' : 'gastos'}${spent.skipped ? ` · ${spent.skipped} sin tasa` : ''}` }),
        stat({ label: 'Por cobrar', value: money(owed, cur), ico: 'clock', tone: overdue.length ? 'var(--expense)' : null, sub: overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'factura vencida' : 'facturas vencidas'}` : `${open.length} ${open.length === 1 ? 'factura abierta' : 'facturas abiertas'}` }),
        el('article', { class: 'ng-hero' },
          el('div', { class: 'ng-hero-sky', 'aria-hidden': 'true' }, el('i'), el('i')),
          el('span', { class: 'ng-hero-label', text: `Beneficio de ${PERIOD_NAME[period.value]}` }),
          el('b', { class: `ng-hero-num${profit < 0 ? ' is-neg' : ''}`, text: money(profit, cur) }),
          el('span', { class: 'ng-hero-sub', text: inc.sum > 0 ? `Margen del ${Math.round((profit / inc.sum) * 100)}%${prevText && change(profit, profitBefore) != null ? ` · ${change(profit, profitBefore) >= 0 ? '+' : ''}${Math.round(change(profit, profitBefore) * 100)}% ${prevText}` : ''}` : 'Cobrado menos gastado' }),
          el('div', { class: 'ng-hero-actions' },
            el('button', { type: 'button', class: 'pill light sm', onclick: () => createDoc('invoice') }, icon('file'), 'Nueva factura'),
            el('button', { type: 'button', class: 'pill glass sm', onclick: () => expenseForm(null, draw) }, icon('wallet'), 'Nuevo gasto'),
          ),
        ),
      ),
      el('div', { class: 'ng-dash-mid' },
        el('section', { class: 'ng-card ng-chart-card' },
          el('header', { class: 'ng-card-head' },
            el('div', {}, el('h2', { text: 'Entradas y salidas' }), el('p', { text: `Últimos 12 meses, en ${cur}.` })),
            el('div', { class: 'ng-legend' }, el('span', { style: { '--c': 'var(--income)' }, text: 'Cobrado' }), el('span', { style: { '--c': 'var(--expense)' }, text: 'Gastado' })),
          ),
          el('div', { class: 'ng-chart', role: 'img', 'aria-label': 'Cobrado y gastado por mes' }, months.map((m) => el('div', { class: `ng-chart-col${m === today.slice(0, 7) ? ' is-now' : ''}` },
            el('div', { class: 'ng-chart-bars' },
              el('i', { class: inM[m] ? 'is-paid' : 'is-zero', style: { '--v': inM[m] / top }, title: `${monthText(m)} · cobrado ${money(inM[m], cur)}` }),
              el('i', { class: outM[m] ? 'is-spent' : 'is-zero', style: { '--v': outM[m] / top }, title: `${monthText(m)} · gastado ${money(outM[m], cur)}` }),
            ),
            el('span', { text: shortMonth(m) }),
          ))),
        ),
        el('section', { class: 'ng-card ng-feed' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Actividad' }), el('p', { text: 'Lo último que pasó.' }))),
          feed.length ? el('ul', {}, feed.map((i) => el('li', {},
            el('a', { href: i.href },
              el('span', { class: 'ng-feed-ico', style: { '--c': i.c } }, icon(i.ico)),
              el('span', { class: 'ng-feed-text' }, el('b', { text: i.text }), el('small', { text: relDay(i.date) })),
            ),
          ))) : el('p', { class: 'ng-none', text: 'Aquí aparecerán tus cobros, facturas y gastos.' }),
        ),
      ),
      leadsHomeCard(),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por cobrar' }), el('p', { text: open.length ? 'Las que vencen antes, arriba.' : 'Nadie te debe nada.' })), el('a', { class: 'pill ghost sm', href: '#/facturas', text: 'Ver facturas' })),
          dueList.length ? el('div', { class: 'ng-rows' }, dueList.map((d) => {
            const who = d.customer?.name || d.customer?.company || 'Sin cliente';
            return el('a', { class: 'ng-row is-mini', href: `#/doc/${d.id}` },
              avatar(who),
              el('span', { class: 'ng-row-main' }, el('b', { text: who }), el('small', { text: `${d.number} · vence ${dateText(d.dueDate)}` })),
              el('span', { class: 'ng-row-tag' }, tag(docStatus(d))),
              el('b', { class: 'ng-row-amount', text: money(totals(d).due, d.currency) }),
            );
          })) : el('p', { class: 'ng-none', text: 'Todo cobrado.' }),
        ),
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Últimos gastos' }), el('p', { text: lastSpent.length ? 'Los cinco más recientes.' : 'Todavía no hay gastos.' })), el('a', { class: 'pill ghost sm', href: '#/gastos', text: 'Ver gastos' })),
          lastSpent.length ? el('div', { class: 'ng-rows' }, lastSpent.map((e) => {
            const v = e.vendorId && find('vendors', e.vendorId);
            return el('a', { class: 'ng-row is-mini', href: '#/gastos' },
              vendorMark(v?.name || e.vendor || e.title, v?.domain),
              el('span', { class: 'ng-row-main' }, el('b', { text: e.title }), el('small', { text: [v?.name || e.vendor, dateText(e.date)].filter(Boolean).join(' · ') })),
              el('span'),
              el('b', { class: 'ng-row-amount', text: money(-e.amount, e.currency) }),
            );
          })) : el('p', { class: 'ng-none' }, el('button', { type: 'button', class: 'pill', onclick: () => expenseForm(null, draw) }, icon('plus'), 'Apuntar un gasto')),
        ),
      ),
    ].filter(Boolean));
  };
  draw();
  return { node: box, refresh: draw };
}
