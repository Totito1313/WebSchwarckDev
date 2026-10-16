// Negocio: leads. Quienes todavía no son clientes: de dónde llegaron (la red,
// la marca, la campaña y la publicación), en qué etapa del embudo están, cuánto
// valen y cuándo toca volver a escribirles. Al ganarlos pasan a clientes con
// un clic, y desde su ficha se les prepara la propuesta.
//
// Las cuentas (conversión, coste por lead, motivos de pérdida…) salen de los
// propios leads: cada cambio de etapa queda anotado en su historial.

import {
  state, find, put, remove, uid, bus, el, icon, iconButton, avatar, chip, empty, seg, field, input, select, menu,
  confirmBox, dialog, toast, autosize, money, amountText, parseNum, round2, todayISO, addDays, nowISO, dateText, shortDate,
  monthText, shortMonth, timeText, addIcons, CURRENCIES, CURRENCY_CODES, DOC_WORD, tag, docStatus, totals,
} from './negocio-core.js';
import { createDoc, searchBox } from './negocio-views.js';
import { brands, brandMark, brandColor } from './negocio-contenido.js';
import { PERIODS, periodRange, within, change, stat } from './negocio-gastos.js';

addIcons({
  funnel: '<path d="M3.5 5h17l-6.5 8v5.5l-4 2V13z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
});

// ── Catálogos ──

/** Etapas del embudo: nombre, color y probabilidad de cierre por defecto. */
export const LEAD_STAGES = {
  new: ['Nuevo', 'var(--violet)', 10],
  contacted: ['Contactado', 'var(--blue)', 20],
  qualified: ['Calificado', 'var(--cyan)', 40],
  proposal: ['Propuesta', 'var(--usdt)', 60],
  negotiation: ['Negociación', 'var(--bs)', 80],
  won: ['Ganado', 'var(--income)', 100],
  lost: ['Perdido', 'var(--expense)', 0],
};
export const STAGE_ORDER = Object.keys(LEAD_STAGES);
export const OPEN_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];

export const SOURCES = {
  instagram: ['Instagram', 'instagram'],
  facebook: ['Facebook', 'facebook'],
  tiktok: ['TikTok', 'video'],
  whatsapp: ['WhatsApp', 'message'],
  web: ['Web', 'globe'],
  google: ['Google', 'search'],
  referral: ['Recomendación', 'users'],
  ads: ['Anuncios', 'megaphone'],
  event: ['Evento', 'calendar'],
  email: ['Correo', 'mail'],
  other: ['Otro', 'more'],
};

const ACTIVITIES = {
  message: ['Mensaje', 'message'],
  call: ['Llamada', 'phone'],
  email: ['Correo', 'mail'],
  meeting: ['Reunión', 'users'],
  note: ['Nota', 'edit'],
};

export const LOST_REASONS = ['Precio', 'No respondió', 'Eligió a otro', 'No era el momento', 'No encaja con lo que hacemos', 'Otro'];

const leads = () => state.leads || [];
const base = () => state.settings.currency || 'USD';
const go = (hash) => { location.hash = hash; };
const nameOf = (l) => l.name?.trim() || l.company?.trim() || 'Sin nombre';
const stageOf = (l) => LEAD_STAGES[l.stage] || LEAD_STAGES.new;
export const probOf = (l) => (l.probability != null && l.probability !== '' ? Number(l.probability) : stageOf(l)[2]);
const isOpen = (l) => OPEN_STAGES.includes(l.stage);
const localDay = (stamp) => (stamp ? new Date(stamp).toLocaleDateString('en-CA') : '');
const createdDay = (l) => l.createdOn || localDay(l.createdAt) || todayISO();
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Valor del lead en la moneda principal; los de otras monedas no se suman. */
const valueIn = (l) => (l.currency === base() || !l.currency ? Number(l.value) || 0 : null);

function sumValues(list, weighted = false) {
  let sum = 0;
  let other = 0;
  for (const l of list) {
    const v = valueIn(l);
    if (v == null) other += 1;
    else sum += weighted ? (v * probOf(l)) / 100 : v;
  }
  return { sum: round2(sum), other };
}

const followText = (iso, today = todayISO()) => {
  if (!iso) return '';
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, 1)) return 'Mañana';
  if (iso < today) return `Hace ${daysBetween(iso, today)} d`;
  return shortDate(iso);
};
const isDue = (l, today = todayISO()) => isOpen(l) && l.nextAt && l.nextAt <= today;

/** Qué tan lejos llegó en el embudo: los ganados, hasta el final; los perdidos, hasta donde se perdieron. */
function reached(l) {
  if (l.stage === 'won') return OPEN_STAGES.length;
  if (l.stage === 'lost') return Math.max(0, OPEN_STAGES.indexOf(l.lostFrom || 'new'));
  return Math.max(0, OPEN_STAGES.indexOf(l.stage));
}

// ── Datos ──

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

function logActivity(l, type, text) {
  l.activities = [{ id: uid(), type, text, at: nowISO() }, ...(l.activities || [])].slice(0, 300);
}

/** Cambia la etapa y lo anota. Perder pide el motivo; ganar propone pasarlo a cliente. */
export function setStage(l, stage, { reason = '', after } = {}) {
  if (l.stage === stage) return;
  if (stage === 'lost' && !reason) {
    lostDialog(l, (why) => setStage(l, 'lost', { reason: why, after }));
    return;
  }
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
  if (stage === 'won' && !l.customerId) toast(`¡Ganado! Pásalo a cliente desde su ficha.`);
  after?.();
}

function lostDialog(l, done) {
  let reason = LOST_REASONS[0];
  const other = input({ maxLength: 120, placeholder: 'Cuéntalo en pocas palabras' });
  dialog({
    title: `¿Por qué se perdió ${nameOf(l)}?`,
    submit: 'Marcar como perdido',
    body: el('div', { class: 'ng-form' },
      el('div', { class: 'ld-reasons', role: 'group', 'aria-label': 'Motivo' }, LOST_REASONS.map((r) => el('button', {
        type: 'button',
        class: 'ng-fchip is-soft',
        'aria-pressed': String(r === reason),
        text: r,
        onclick: (e) => {
          reason = r;
          for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          other.closest('.ng-field').hidden = r !== 'Otro';
        },
      }))),
      Object.assign(field('Otro motivo', other), { hidden: true }),
    ),
    onSubmit: () => {
      done(reason === 'Otro' && other.value.trim() ? other.value.trim() : reason);
      return true;
    },
  });
}

/** Lo pasa a cliente (o devuelve el que ya tiene). */
export function toCustomer(l) {
  // Ya era cliente (por su ficha o por su correo): se enlaza con ese en vez de crear otro igual.
  const mail = (l.email || '').trim().toLowerCase();
  const existing = (l.customerId && find('customers', l.customerId)) || (mail && state.customers.find((c) => (c.email || '').trim().toLowerCase() === mail));
  if (existing) {
    if (l.customerId !== existing.id) {
      l.customerId = existing.id;
      logActivity(l, 'note', `Enlazado con el cliente ${existing.name}`);
      put('leads', l);
      toast(`${existing.name} ya estaba en tus clientes: quedó enlazado.`);
    }
    return existing;
  }
  const brand = l.brandId && find('brands', l.brandId);
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
    notes: [`Llegó como lead por ${SOURCES[l.source]?.[0] || 'otra vía'}${brand ? ` (${brand.name})` : ''} el ${dateText(createdDay(l))}.`, l.notes].filter(Boolean).join('\n\n'),
    leadId: l.id,
  };
  put('customers', c);
  l.customerId = c.id;
  logActivity(l, 'note', `Ahora es cliente: ${c.name}`);
  put('leads', l);
  toast(`${c.name} ya está en tus clientes.`);
  return c;
}

/** Abre la ficha de un lead nuevo. Solo se guarda si se escribe algo. */
export function createLead(over = {}) {
  const l = newLead(over);
  state.leads = [...leads(), l];
  openLead(l.id, { isNew: true });
  return l;
}

// Desde marketing (una publicación) se crean leads con su origen ya puesto.
bus.addEventListener('new-lead', (e) => createLead(e.detail || {}));

export const leadsOfPost = (postId) => leads().filter((l) => l.postId === postId);
export const leadsOfCampaign = (id) => leads().filter((l) => l.campaignId === id);

// ── Piezas ──

function sourceChip(l) {
  const [label, ico] = SOURCES[l.source] || SOURCES.other;
  return el('span', { class: 'ld-source' }, icon(ico), label);
}

function stageMenu(anchor, l, after) {
  menu(anchor, STAGE_ORDER.map((s) => ({
    label: LEAD_STAGES[s][0],
    note: `${LEAD_STAGES[s][2]} %`,
    icon: s === l.stage ? 'check' : null,
    run: () => setStage(l, s, { after }),
  })));
}

function followChip(l) {
  if (!isOpen(l) || !l.nextAt) return null;
  const today = todayISO();
  return el('span', { class: `ld-follow${l.nextAt < today ? ' is-late' : l.nextAt === today ? ' is-today' : ''}`, title: l.nextNote || 'Siguiente paso' }, icon('clock'), followText(l.nextAt, today));
}

// ── Ficha ──

export function openLead(id, { isNew = false } = {}) {
  const l = find('leads', id);
  if (!l) return null;
  l.activities ||= [];
  const save = () => put('leads', l);
  const top = el('header', { class: 'ng-sheet-head' });
  const body = el('div', { class: 'ng-sheet-body ld-sheet' });
  const nextBox = el('section', { class: 'ld-next' });
  const logBox = el('section', { class: 'ng-sheet-sec' });
  const docsBox = el('section', { class: 'ng-sheet-sec' });
  const historyBox = el('section', { class: 'ng-sheet-sec' });
  const dlg = el('dialog', { class: 'ng-dialog is-sheet', 'aria-label': 'Lead' }, top, body);

  function drawTop() {
    const [label, color] = stageOf(l);
    const stageBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg', style: { '--c': color }, 'aria-label': `Etapa: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label, icon('down'));
    stageBtn.addEventListener('click', () => stageMenu(stageBtn, l, () => { drawTop(); drawNext(); drawHistory(); }));
    const customer = l.customerId && find('customers', l.customerId);
    const more = iconButton('more', 'Más acciones', () => menu(more, [
      isOpen(l) && { label: 'Marcar como ganado', icon: 'trophy', run: () => setStage(l, 'won', { after: refresh }) },
      isOpen(l) && { label: 'Marcar como perdido', icon: 'x', run: () => setStage(l, 'lost', { after: refresh }) },
      !isOpen(l) && { label: 'Reabrir', icon: 'undo', run: () => setStage(l, 'contacted', { after: refresh }) },
      '-',
      { label: 'Eliminar lead', icon: 'trash', danger: true, run: destroy },
    ], { align: 'end' }));
    top.replaceChildren(...[
      stageBtn,
      el('span', { class: 'ld-prob', title: 'Probabilidad de cerrarlo' }, `${probOf(l)} %`),
      el('span', { class: 'ng-grow' }),
      customer
        ? el('a', { class: 'pill ghost sm', href: `#/clientes/${customer.id}`, onclick: () => dlg.close() }, icon('users'), 'Ver cliente')
        : el('button', { type: 'button', class: 'pill sm', onclick: () => { toCustomer(l); refresh(); } }, icon('users'), 'Pasar a cliente'),
      more,
      iconButton('x', 'Cerrar', () => dlg.close()),
    ].filter(Boolean));
  }

  function drawNext() {
    if (!isOpen(l)) {
      const won = l.stage === 'won';
      nextBox.className = `ld-next is-${l.stage}`;
      nextBox.replaceChildren(
        el('span', { class: 'ld-next-ico' }, icon(won ? 'trophy' : 'x')),
        el('div', {}, el('b', { text: won ? `Ganado el ${dateText(localDay(l.wonAt))}` : `Perdido el ${dateText(localDay(l.lostAt))}` }), el('small', { text: won ? (l.customerId ? 'Ya es cliente.' : 'Pásalo a cliente para facturarle.') : l.lostReason || 'Sin motivo' })),
      );
      return;
    }
    const today = todayISO();
    const date = input({ type: 'date', value: l.nextAt || '', 'aria-label': 'Fecha del siguiente paso' });
    date.addEventListener('change', () => { l.nextAt = date.value; save(); drawNext(); });
    const note = input({ value: l.nextNote || '', maxLength: 160, placeholder: 'Qué hay que hacer: escribirle, llamar, mandar la propuesta…', 'aria-label': 'Siguiente paso' });
    note.addEventListener('input', () => { l.nextNote = note.value; save(); });
    const quick = (label, days) => el('button', { type: 'button', class: 'ng-fchip is-soft', text: label, onclick: () => { l.nextAt = addDays(today, days); save(); drawNext(); } });
    nextBox.className = `ld-next${l.nextAt && l.nextAt < today ? ' is-late' : l.nextAt === today ? ' is-today' : ''}`;
    nextBox.replaceChildren(
      el('div', { class: 'ld-next-head' },
        el('span', { class: 'ld-next-ico' }, icon('clock')),
        el('b', { text: l.nextAt ? `Siguiente paso: ${followText(l.nextAt, today).toLowerCase()}` : 'Sin siguiente paso' }),
        el('span', { class: 'ng-grow' }),
        l.nextAt && el('button', {
          type: 'button',
          class: 'pill sm',
          onclick: () => {
            logActivity(l, 'note', `Hecho: ${l.nextNote || 'seguimiento'}`);
            l.nextAt = addDays(today, 3);
            l.nextNote = 'Volver a escribirle';
            if (l.stage === 'new') {
              setStage(l, 'contacted');
            } else save();
            drawNext();
            drawHistory();
            drawTop();
          },
        }, icon('check'), 'Hecho'),
      ),
      el('div', { class: 'ld-next-row' }, date, note),
      el('div', { class: 'ld-next-quick' }, quick('Hoy', 0), quick('Mañana', 1), quick('En 3 días', 3), quick('En una semana', 7), l.nextAt && el('button', { type: 'button', class: 'ng-fchip is-soft', text: 'Sin fecha', onclick: () => { l.nextAt = ''; save(); drawNext(); } })),
    );
  }

  function drawBody() {
    const name = autosize(el('textarea', { class: 'ng-ttitle', rows: 1, value: l.name, placeholder: 'Nombre del lead', maxLength: 120, 'aria-label': 'Nombre' }));
    name.addEventListener('input', () => { l.name = name.value.replace(/\n/g, ' '); save(); });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    const text = (key, props = {}) => input({ value: l[key] || '', ...props, oninput: (e) => { l[key] = e.target.value; save(); } });
    const brandSel = select([['', 'Sin marca'], ...brands().map((b) => [b.id, b.name])], l.brandId || '', { 'aria-label': 'Marca' });
    const campaignSel = select([], '', { 'aria-label': 'Campaña' });
    const postSel = select([], '', { 'aria-label': 'Publicación' });
    const fillCampaigns = () => {
      const list = (state.campaigns || []).filter((c) => !l.brandId || !c.brandId || c.brandId === l.brandId);
      campaignSel.replaceChildren(...[['', 'Sin campaña'], ...list.map((c) => [c.id, c.name])].map(([v, t]) => el('option', { value: v, text: t, selected: v === (l.campaignId || '') })));
    };
    const fillPosts = () => {
      const list = (state.posts || []).filter((p) => (!l.brandId || p.brandId === l.brandId) && (p.status === 'publicado' || p.id === l.postId)).sort((a, b) => `${b.date}`.localeCompare(`${a.date}`)).slice(0, 80);
      postSel.replaceChildren(...[['', 'Ninguna en concreto'], ...list.map((p) => [p.id, `${shortDate(p.date)} · ${p.title || 'Sin título'}`])].map(([v, t]) => el('option', { value: v, text: t, selected: v === (l.postId || '') })));
    };
    fillCampaigns();
    fillPosts();
    brandSel.addEventListener('change', () => { l.brandId = brandSel.value; save(); fillCampaigns(); fillPosts(); });
    campaignSel.addEventListener('change', () => { l.campaignId = campaignSel.value; save(); });
    postSel.addEventListener('change', () => {
      l.postId = postSel.value;
      const p = l.postId && find('posts', l.postId);
      if (p?.campaignId && !l.campaignId) {
        l.campaignId = p.campaignId;
        fillCampaigns();
      }
      save();
    });
    const source = select(Object.entries(SOURCES).map(([k, [label]]) => [k, label]), l.source || 'other', { 'aria-label': 'Fuente', onchange: (e) => { l.source = e.target.value; save(); } });
    const value = input({ value: l.value ? amountText(l.value) : '', inputmode: 'decimal', placeholder: '0,00', 'aria-label': 'Valor estimado' });
    value.addEventListener('input', () => { l.value = round2(parseNum(value.value)); save(); drawTop(); });
    const currency = select(CURRENCY_CODES.map((k) => [k, k]), l.currency || base(), { 'aria-label': 'Moneda', onchange: (e) => { l.currency = e.target.value; save(); } });
    const prob = input({ value: l.probability != null && l.probability !== '' ? String(l.probability) : '', inputmode: 'numeric', maxLength: 3, placeholder: `${stageOf(l)[2]}`, 'aria-label': 'Probabilidad' });
    prob.addEventListener('input', () => {
      const v = prob.value.trim();
      l.probability = v ? Math.max(0, Math.min(100, Math.round(parseNum(v)))) : null;
      save();
      drawTop();
    });
    const notes = autosize(el('textarea', { rows: 3, value: l.notes || '', maxLength: 6000, placeholder: 'Lo que necesita, presupuesto, cómo prefiere que le escriban…' }));
    notes.addEventListener('input', () => { l.notes = notes.value; save(); });

    body.replaceChildren(
      name,
      el('div', { class: 'ng-form' },
        field('Empresa', text('company', { maxLength: 120, placeholder: 'Opcional' })),
        el('div', { class: 'ng-grid2' }, field('Teléfono o WhatsApp', text('phone', { type: 'tel', maxLength: 60 })), field('Correo', text('email', { type: 'email', maxLength: 160 }))),
        field('Qué le interesa', text('interest', { maxLength: 200, placeholder: 'Una app para su negocio, una web…' })),
      ),
      nextBox,
      logBox,
      el('section', { class: 'ng-sheet-sec' },
        el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text: 'De dónde vino' })),
        el('div', { class: 'ng-form' },
          el('div', { class: 'ng-grid2' }, field('Fuente', source), field('Marca', brandSel)),
          el('div', { class: 'ng-grid2' }, field('Campaña', campaignSel), field('Publicación', postSel)),
        ),
      ),
      el('section', { class: 'ng-sheet-sec' },
        el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text: 'Valor' })),
        el('div', { class: 'ng-form' },
          el('div', { class: 'ng-grid3 ld-value' }, field('Valor estimado', value), field('Moneda', currency), field('Probabilidad (%)', prob, 'Vacía, la de su etapa.')),
          field('Notas', notes),
        ),
      ),
      docsBox,
      historyBox,
    );
    drawNext();
    drawLog();
    drawDocs();
    drawHistory();
  }

  function drawLog() {
    let type = 'message';
    const text = autosize(el('textarea', { rows: 2, maxLength: 2000, placeholder: 'Qué hablaron, qué quedó pendiente…', 'aria-label': 'Detalle' }));
    const send = () => {
      const v = text.value.trim();
      logActivity(l, type, v || `${ACTIVITIES[type][0]} sin detalle`);
      l.lastContactAt = nowISO();
      if (l.stage === 'new' && type !== 'note') setStage(l, 'contacted');
      else save();
      text.value = '';
      drawHistory();
      drawTop();
      toast('Anotado en el historial.');
    };
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        send();
      }
    });
    logBox.replaceChildren(
      el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text: 'Registrar contacto' })),
      seg(Object.entries(ACTIVITIES).map(([k, [label]]) => [k, label]), type, (v) => { type = v; }, 'Tipo de contacto'),
      el('div', { class: 'ng-comment-new' }, text, el('button', { type: 'button', class: 'pill sm', onclick: send }, 'Registrar')),
    );
  }

  function drawDocs() {
    const docs = state.docs.filter((d) => d.leadId === l.id || (l.customerId && d.customerId === l.customerId && d.type !== 'receipt'));
    const make = (type) => {
      const c = toCustomer(l);
      if (OPEN_STAGES.indexOf(l.stage) < OPEN_STAGES.indexOf('proposal') && isOpen(l)) setStage(l, 'proposal');
      dlg.close();
      createDoc(type, c, { leadId: l.id });
    };
    docsBox.replaceChildren(
      el('div', { class: 'ng-sheet-sec-head' },
        el('h3', { text: 'Propuestas y documentos' }),
        el('span', { class: 'ng-grow' }),
        el('button', { type: 'button', class: 'pill ghost sm', onclick: () => make('proposal') }, icon('send'), 'Propuesta'),
        el('button', { type: 'button', class: 'pill ghost sm', onclick: () => make('quote') }, icon('quote'), 'Cotización'),
      ),
      docs.length ? el('ul', { class: 'ng-history' }, docs.map((d) => el('li', {},
        el('div', {}, el('b', { text: `${DOC_WORD[d.type]} ${d.number || ''}`.trim() }), el('small', { text: [d.type === 'proposal' && d.title, dateText(d.issueDate), money(totals(d).total, d.currency)].filter(Boolean).join(' · ') })),
        tag(docStatus(d)),
        el('a', { class: 'ng-history-link', href: `#/doc/${d.id}`, text: 'Abrir', onclick: () => dlg.close() }),
      ))) : el('p', { class: 'ng-hint', text: 'Prepárale una propuesta o una cotización: se crea a su nombre y el lead pasa a «Propuesta».' }),
    );
  }

  function drawHistory() {
    const list = l.activities || [];
    historyBox.replaceChildren(
      el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text: 'Historial' }), el('small', { text: `Lead desde el ${dateText(createdDay(l))}` })),
      list.length ? el('ol', { class: 'ld-timeline' }, list.map((a) => {
        const [label, ico] = a.type === 'stage' ? ['Etapa', 'funnel'] : ACTIVITIES[a.type] || ACTIVITIES.note;
        return el('li', { class: `is-${a.type}` },
          el('span', { class: 'ld-tl-ico' }, icon(ico)),
          el('div', {},
            el('p', { text: a.text }),
            el('small', { text: `${label} · ${dateText(localDay(a.at))}, ${timeText(a.at)}` }),
          ),
          a.type !== 'stage' && iconButton('x', 'Borrar del historial', () => { l.activities = list.filter((x) => x !== a); save(); drawHistory(); }, 'is-sm'),
        );
      })) : el('p', { class: 'ng-hint', text: 'Aquí quedan los mensajes, llamadas y cambios de etapa.' }),
    );
  }

  const refresh = () => {
    drawTop();
    drawBody();
  };

  async function destroy() {
    if (!(await confirmBox(`¿Eliminar a ${nameOf(l)} de tus leads?${l.customerId ? ' El cliente se queda.' : ''}`))) return;
    remove('leads', l.id);
    dlg.close();
    toast('Lead eliminado.');
  }

  dlg.addEventListener('close', () => {
    const blank = !l.name.trim() && !l.company?.trim() && !l.phone?.trim() && !l.email?.trim() && !(l.activities || []).length;
    if (isNew && blank && find('leads', l.id)) state.leads = leads().filter((x) => x.id !== l.id);
    dlg.remove();
    // Con la ficha abierta la página no se repinta; al cerrarla, sí.
    bus.dispatchEvent(new CustomEvent('change', { detail: { col: 'leads' } }));
  });
  drawTop();
  drawBody();
  document.body.append(dlg);
  dlg.showModal();
  if (!l.name.trim()) body.querySelector('.ng-ttitle').focus();
  return dlg;
}

// ── Embudo (tablero) ──

function board(filter) {
  const box = el('section', { class: 'ng-card ld-board-card' });
  let dragId = null;
  let showClosed = false;

  function card(l) {
    const b = l.brandId && find('brands', l.brandId);
    const v = Number(l.value) || 0;
    const days = daysBetween(localDay(l.stageAt) || createdDay(l), todayISO());
    const node = el('article', {
      class: `ld-card${isDue(l) ? ' is-due' : ''}`,
      draggable: true,
      tabindex: 0,
      role: 'button',
      'aria-label': `${nameOf(l)}, ${stageOf(l)[0]}`,
      data: { id: l.id },
      onclick: () => openLead(l.id),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === node) {
          e.preventDefault();
          openLead(l.id);
        }
      },
    },
      el('div', { class: 'ld-card-top' },
        avatar(nameOf(l)),
        el('div', { class: 'ld-card-name' }, el('b', { text: nameOf(l) }), el('small', { text: l.interest || l.company || 'Sin detalle' })),
      ),
      el('div', { class: 'ld-card-meta' },
        sourceChip(l),
        b && el('span', { class: 'ld-brand', title: b.name }, brandMark(b, 'is-xs')),
        followChip(l),
        v > 0 && el('b', { class: 'ld-card-value', text: money(v, l.currency || base()) }),
      ),
      isOpen(l) && days > 0 && el('small', { class: 'ld-card-age', text: `${days} ${days === 1 ? 'día' : 'días'} en esta etapa` }),
    );
    node.addEventListener('dragstart', (e) => {
      dragId = l.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', l.id);
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
    const list = filtered(filter);
    const stages = showClosed ? STAGE_ORDER : [...OPEN_STAGES, 'won'];
    const closedLost = list.filter((l) => l.stage === 'lost').length;
    box.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Embudo' }), el('p', { text: 'Arrastra cada lead a su etapa. Arriba de cada columna, lo que suma.' })),
        el('button', {
          type: 'button',
          class: 'ng-fchip',
          'aria-pressed': String(showClosed),
          onclick: () => { showClosed = !showClosed; draw(); },
        }, icon('x'), `Perdidos (${closedLost})`),
      ),
      el('div', { class: 'ng-board ld-board' }, stages.map((stage) => {
        const [label, color, prob] = LEAD_STAGES[stage];
        const items = list.filter((l) => l.stage === stage).sort((a, b) => (a.nextAt || '9999').localeCompare(b.nextAt || '9999') || (b.stageAt || '').localeCompare(a.stageAt || ''));
        const shown = stage === 'won' || stage === 'lost' ? items.slice(0, 20) : items;
        const { sum } = sumValues(items);
        const col = el('section', { class: 'ng-col', style: { '--c': color }, 'aria-label': label },
          el('header', { class: 'ng-col-head ld-col-head' },
            el('i', { class: 'ng-col-dot', 'aria-hidden': 'true' }),
            el('h3', { text: label }),
            el('span', { class: 'ng-col-count', text: String(items.length) }),
            OPEN_STAGES.includes(stage) && iconButton('plus', `Nuevo lead en ${label}`, () => createLead({ stage, ...startWith(filter) }), 'is-sm'),
          ),
          el('div', { class: 'ld-col-sum' }, el('b', { text: money(sum, base()) }), OPEN_STAGES.includes(stage) && el('small', { text: `${prob} %` })),
          el('div', { class: 'ng-col-list' }, shown.length ? shown.map(card) : el('p', { class: 'ng-col-empty', text: 'Suelta aquí' }), items.length > shown.length && el('small', { class: 'ld-col-more', text: `Y ${items.length - shown.length} más en «Lista»` })),
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
          const l = dragId && find('leads', dragId);
          if (l) setStage(l, stage);
        });
        return col;
      })),
    );
  }
  draw();
  return { node: box, refresh: draw };
}

// ── Lista ──

function listView(filter) {
  const box = el('section', { class: 'ng-card ng-list' });
  let q = '';
  let stage = 'all';
  let sort = 'next';
  const body = el('div', { class: 'ng-list-body' });
  const count = el('small');
  const draw = () => {
    const today = todayISO();
    const all = filtered(filter);
    const shown = all
      .filter((l) => (stage === 'all' || (stage === 'open' ? isOpen(l) : l.stage === stage)) && (!q || `${l.name} ${l.company} ${l.email} ${l.phone} ${l.interest}`.toLowerCase().includes(q)))
      .sort(sort === 'value' ? (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
        : sort === 'new' ? (a, b) => createdDay(b).localeCompare(createdDay(a))
          : (a, b) => (isOpen(b) - isOpen(a)) || (a.nextAt || '9999').localeCompare(b.nextAt || '9999'));
    count.textContent = shown.length === all.length ? `${all.length} en total` : `${shown.length} de ${all.length}`;
    body.replaceChildren(shown.length ? el('div', { class: 'ng-rows' }, shown.map((l) => {
      const b = l.brandId && find('brands', l.brandId);
      return el('button', { type: 'button', class: 'ng-row is-lead', onclick: () => openLead(l.id) },
        avatar(nameOf(l)),
        el('span', { class: 'ng-row-main' }, el('b', { text: nameOf(l) }), el('small', { text: [l.company && l.name ? l.company : '', l.interest].filter(Boolean).join(' · ') || 'Sin detalle' })),
        el('span', { class: 'ng-row-tag' }, chip(...stageOf(l).slice(0, 2))),
        el('span', { class: 'ld-row-source' }, sourceChip(l), b && brandMark(b, 'is-xs')),
        el('span', { class: `ng-row-date${isDue(l, today) ? ' is-late' : ''}`, text: isOpen(l) ? followText(l.nextAt, today) || '—' : '' }),
        el('b', { class: 'ng-row-amount', text: Number(l.value) > 0 ? money(l.value, l.currency || base()) : '' }),
      );
    })) : (all.length ? el('p', { class: 'ng-none', text: 'Ningún lead coincide.' }) : empty({
      ico: 'funnel',
      title: 'Todavía no hay leads',
      text: 'Apunta aquí a cada persona que te escriba por Instagram, WhatsApp o la web, y no se te escapará ninguna.',
      action: el('button', { type: 'button', class: 'pill', onclick: () => createLead(startWith(filter)) }, icon('plus'), 'Nuevo lead'),
    })));
  };
  box.append(
    el('header', { class: 'ng-card-head' },
      el('div', {}, el('h2', { text: 'Todos los leads' }), count),
      el('div', { class: 'ng-filters' },
        select([['all', 'Todas las etapas'], ['open', 'Abiertos'], ...STAGE_ORDER.map((k) => [k, LEAD_STAGES[k][0]])], stage, { 'aria-label': 'Etapa', onchange: (e) => { stage = e.target.value; draw(); } }),
        select([['next', 'Por siguiente paso'], ['new', 'Los más nuevos'], ['value', 'Por valor']], sort, { 'aria-label': 'Orden', onchange: (e) => { sort = e.target.value; draw(); } }),
        searchBox((v) => { q = v; draw(); }, 'Buscar leads…'),
      ),
    ),
    body,
  );
  draw();
  return { node: box, refresh: draw };
}

// ── Análisis ──

function bars(rows, { money: asMoney = false } = {}) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return el('ul', { class: 'ng-bars ld-bars' }, rows.map((r) => el('li', { style: { '--c': r.color || 'var(--ink)' } },
    el('div', { class: 'ng-bars-name' }, r.mark || el('i', { class: 'ng-dot' }), el('span', { text: r.label })),
    el('span', { class: 'ng-bars-track' }, el('i', { style: { width: `${r.value ? Math.max(3, (r.value / top) * 100) : 0}%` } })),
    el('b', { text: asMoney ? money(r.value, base()) : String(r.value) }),
    el('small', { text: r.note || '' }),
  )));
}

function analysis(filter) {
  const box = el('div', { class: 'ld-analysis' });
  const draw = () => {
    const r = periodRange(ui.period);
    const all = filtered(filter);
    const born = all.filter((l) => within(createdDay(l), r));
    const won = all.filter((l) => l.stage === 'won' && within(localDay(l.wonAt), r));
    const lost = all.filter((l) => l.stage === 'lost' && within(localDay(l.lostAt), r));
    const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');

    // Embudo: cuántos de los que llegaron en el periodo alcanzaron cada etapa.
    const funnel = [...OPEN_STAGES, 'won'].map((s, i) => ({ label: LEAD_STAGES[s][0], color: LEAD_STAGES[s][1], value: born.filter((l) => reached(l) >= i).length }));
    funnel.forEach((f) => { f.note = pct(f.value, funnel[0].value); });

    const group = (key, labelOf, colorOf, markOf) => {
      const map = new Map();
      for (const l of born) {
        const k = l[key] || '';
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(l);
      }
      return [...map].map(([k, list]) => {
        const w = list.filter((l) => l.stage === 'won');
        const closed = list.filter((l) => l.stage === 'won' || l.stage === 'lost').length;
        return { label: labelOf(k), color: colorOf?.(k), mark: markOf?.(k), value: list.length, note: closed ? `${pct(w.length, closed)} ganados` : 'Sin cerrar', won: sumValues(w).sum };
      }).sort((a, b) => b.value - a.value);
    };
    const bySource = group('source', (k) => SOURCES[k]?.[0] || 'Sin fuente');
    const byBrand = group('brandId', (k) => find('brands', k)?.name || 'Sin marca', (k) => brandColor(find('brands', k)), (k) => (find('brands', k) ? brandMark(find('brands', k), 'is-xs') : null));
    const reasons = new Map();
    for (const l of lost) reasons.set(l.lostReason || 'Sin motivo', (reasons.get(l.lostReason || 'Sin motivo') || 0) + 1);
    const winDays = won.map((l) => daysBetween(createdDay(l), localDay(l.wonAt))).filter((d) => d >= 0);
    const avgDays = winDays.length ? Math.round(winDays.reduce((s, d) => s + d, 0) / winDays.length) : null;

    // Campañas: leads, ganados y lo que costó cada lead.
    const campaigns = (state.campaigns || []).map((c) => {
      const list = all.filter((l) => l.campaignId === c.id);
      const w = list.filter((l) => l.stage === 'won');
      const spent = Number(c.spent) || Number(c.budget) || 0;
      return { c, leads: list.length, won: w.length, wonValue: sumValues(w).sum, cpl: list.length && spent ? spent / list.length : null, spent };
    }).filter((x) => x.leads || x.spent);

    // Leads por mes, últimos 12.
    const today = todayISO();
    const months = [];
    const m0 = new Date(`${today.slice(0, 7)}-15T12:00:00`);
    m0.setMonth(m0.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      months.push(m0.toLocaleDateString('en-CA').slice(0, 7));
      m0.setMonth(m0.getMonth() + 1);
    }
    const perMonth = Object.fromEntries(months.map((m) => [m, [0, 0]]));
    for (const l of all) {
      const m = createdDay(l).slice(0, 7);
      if (m in perMonth) perMonth[m][0] += 1;
      const wm = l.stage === 'won' ? localDay(l.wonAt).slice(0, 7) : '';
      if (wm in perMonth) perMonth[wm][1] += 1;
    }
    const topM = Math.max(1, ...months.map((m) => Math.max(...perMonth[m])));

    box.replaceChildren(
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Embudo de conversión' }), el('p', { text: `De los ${born.length} que llegaron, cuántos alcanzaron cada etapa.` }))),
          born.length ? bars(funnel) : el('p', { class: 'ng-none', text: 'Sin leads en este periodo.' }),
        ),
        el('section', { class: 'ng-card ng-chart-card' },
          el('header', { class: 'ng-card-head' },
            el('div', {}, el('h2', { text: 'Leads por mes' }), el('p', { text: avgDays != null ? `Se tarda ${avgDays} ${avgDays === 1 ? 'día' : 'días'} de media en ganar uno.` : 'Los que llegaron y los que se ganaron.' })),
            el('div', { class: 'ng-legend' }, el('span', { style: { '--c': 'var(--ink)' }, text: 'Nuevos' }), el('span', { style: { '--c': 'var(--income)' }, text: 'Ganados' })),
          ),
          el('div', { class: 'ng-chart', role: 'img', 'aria-label': 'Leads nuevos y ganados por mes' }, months.map((m) => el('div', { class: `ng-chart-col${m === today.slice(0, 7) ? ' is-now' : ''}` },
            el('div', { class: 'ng-chart-bars' },
              el('i', { class: perMonth[m][0] ? '' : 'is-zero', style: { '--v': perMonth[m][0] / topM }, title: `${monthText(m)} · ${perMonth[m][0]} nuevos` }),
              el('i', { class: perMonth[m][1] ? 'is-paid' : 'is-zero', style: { '--v': perMonth[m][1] / topM }, title: `${monthText(m)} · ${perMonth[m][1]} ganados` }),
            ),
            el('span', { text: shortMonth(m) }),
          ))),
        ),
      ),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por fuente' }), el('p', { text: 'Por dónde llegan y cuántos se cierran.' }))),
          bySource.length ? bars(bySource) : el('p', { class: 'ng-none', text: 'Sin datos todavía.' }),
        ),
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por marca' }), el('p', { text: 'Qué marca trae más interesados.' }))),
          byBrand.length ? bars(byBrand) : el('p', { class: 'ng-none', text: 'Sin datos todavía.' }),
        ),
      ),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Campañas' }), el('p', { text: 'Leads, ventas y coste por lead (con lo gastado o, si falta, el presupuesto).' }))),
          campaigns.length ? el('div', { class: 'ng-rows' }, campaigns.map((x) => el('a', { class: 'ng-row is-mini ld-camp-row', href: `#/marketing/campanas/${x.c.id}` },
            el('span', { class: 'ld-camp-dot', style: { '--c': x.c.color || 'var(--ink)' } }),
            el('span', { class: 'ng-row-main' }, el('b', { text: x.c.name }), el('small', { text: `${x.leads} leads · ${x.won} ganados` })),
            el('span', { class: 'ng-row-stat' }, el('small', { text: 'Coste por lead' }), el('b', { text: x.cpl != null ? money(x.cpl, x.c.currency || base()) : '—' })),
            el('span', { class: 'ng-row-stat' }, el('small', { text: 'Ganado' }), el('b', { text: money(x.wonValue, base()) })),
          ))) : el('p', { class: 'ng-none', text: 'Crea campañas en Marketing y asígnalas a tus leads.' }),
        ),
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por qué se pierden' }), el('p', { text: `${lost.length} ${lost.length === 1 ? 'perdido' : 'perdidos'} en este periodo.` }))),
          reasons.size ? bars([...reasons].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: 'var(--expense)', note: pct(value, lost.length) }))) : el('p', { class: 'ng-none', text: 'Ninguno perdido. ¡Bien!' }),
        ),
      ),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

// ── La página ──

const TABS = [['embudo', 'Embudo', 'funnel'], ['lista', 'Lista', 'list'], ['analisis', 'Análisis', 'trendUp']];
const ui = { period: 'month', source: 'all', brand: 'all' };

function filtered(filter = ui) {
  return leads().filter((l) => (filter.source === 'all' || l.source === filter.source) && (filter.brand === 'all' || l.brandId === filter.brand));
}
const startWith = (filter = ui) => ({
  ...(filter.source !== 'all' ? { source: filter.source } : {}),
  ...(filter.brand !== 'all' ? { brandId: filter.brand } : {}),
});

/** Seguimientos de hoy y atrasados, para el inicio y la cabecera de leads. */
export function dueLeads() {
  const today = todayISO();
  return leads().filter((l) => isDue(l, today)).sort((a, b) => a.nextAt.localeCompare(b.nextAt));
}

export function dueList(list, { limit = 6 } = {}) {
  const today = todayISO();
  return el('div', { class: 'ng-rows' }, list.slice(0, limit).map((l) => el('button', { type: 'button', class: 'ng-row is-mini ld-due-row', onclick: () => openLead(l.id) },
    avatar(nameOf(l)),
    el('span', { class: 'ng-row-main' }, el('b', { text: nameOf(l) }), el('small', { text: l.nextNote || 'Seguimiento' })),
    el('span', { class: 'ng-row-tag' }, chip(...stageOf(l).slice(0, 2))),
    el('span', { class: `ld-follow${l.nextAt < today ? ' is-late' : ' is-today'}` }, icon('clock'), followText(l.nextAt, today)),
  )));
}

export function leadsPage(sub = 'embudo') {
  const tab = TABS.some(([k]) => k === sub) ? sub : 'embudo';
  const kpis = el('div', { class: 'ng-kpis' });
  const dueBox = el('div', { class: 'ng-slot' });
  const filters = el('div', { class: 'ng-mkt-filters' });
  const content = el('div');
  let view = null;

  const build = () => {
    const f = { ...ui };
    view = tab === 'lista' ? listView(f) : tab === 'analisis' ? analysis(f) : board(f);
    content.replaceChildren(view.node);
  };

  function drawKpis() {
    const r = periodRange(ui.period);
    const all = filtered();
    const born = all.filter((l) => within(createdDay(l), r));
    const bornBefore = r.prev ? all.filter((l) => within(createdDay(l), r.prev)).length : 0;
    const won = all.filter((l) => l.stage === 'won' && within(localDay(l.wonAt), r));
    const wonBefore = r.prev ? all.filter((l) => l.stage === 'won' && within(localDay(l.wonAt), r.prev)).length : 0;
    const lost = all.filter((l) => l.stage === 'lost' && within(localDay(l.lostAt), r));
    const open = all.filter(isOpen);
    const pipeline = sumValues(open, true);
    const raw = sumValues(open);
    const closed = won.length + lost.length;
    const due = all.filter((l) => isDue(l));
    const late = due.filter((l) => l.nextAt < todayISO()).length;
    kpis.replaceChildren(
      stat({ label: 'Leads nuevos', value: String(born.length), delta: change(born.length, bornBefore), sub: `${open.length} ${open.length === 1 ? 'abierto' : 'abiertos'} en total` }),
      stat({ label: 'Ganados', value: String(won.length), delta: change(won.length, wonBefore), sub: `${money(sumValues(won).sum, base())} en ventas` }),
      stat({ label: 'Conversión', value: closed ? `${Math.round((won.length / closed) * 100)} %` : '—', ico: 'target', sub: closed ? `${won.length} de ${closed} cerrados` : 'Ninguno cerrado todavía' }),
      stat({ label: 'Valor del embudo', value: money(pipeline.sum, base()), ico: 'funnel', sub: `${money(raw.sum, base())} sin ponderar${pipeline.other ? ` · ${pipeline.other} en otra moneda` : ''}` }),
    );
    dueBox.replaceChildren(...(due.length ? [el('section', { class: 'ng-card ld-due' },
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Para hoy' }), el('p', { text: late ? `${due.length} seguimientos; ${late} ${late === 1 ? 'va' : 'van'} con retraso.` : `${due.length} ${due.length === 1 ? 'seguimiento' : 'seguimientos'} para hoy.` })),
      ),
      dueList(due, { limit: 8 }),
    )] : []));
  }

  function drawFilters() {
    const used = new Set(leads().map((l) => l.source));
    filters.replaceChildren(
      el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Marca' },
        el('button', { type: 'button', class: 'ng-fchip', 'aria-pressed': String(ui.brand === 'all'), text: 'Todas las marcas', onclick: () => { ui.brand = 'all'; refresh(); } }),
        brands().map((b) => el('button', { type: 'button', class: 'ng-fchip has-mark', 'aria-pressed': String(ui.brand === b.id), onclick: () => { ui.brand = b.id; refresh(); } }, brandMark(b, 'is-xs'), b.name)),
      ),
      el('div', { class: 'ng-filters' },
        select([['all', 'Todas las fuentes'], ...Object.entries(SOURCES).filter(([k]) => used.has(k) || k === ui.source).map(([k, [label]]) => [k, label])], ui.source, { 'aria-label': 'Fuente', onchange: (e) => { ui.source = e.target.value; refresh(); } }),
      ),
    );
  }

  const refresh = () => {
    if (document.querySelector('dialog[open]')) return;
    drawKpis();
    drawFilters();
    build();
  };

  const node = el('div', { class: 'ng-page ld-page' },
    el('header', { class: 'ng-head' },
      el('div', {}, el('h1', { text: 'Leads' }), el('p', { text: 'Quién te escribió, de dónde vino y en qué punto está. Los ganados pasan a clientes con un clic.' })),
      el('div', { class: 'ng-head-actions' },
        seg(PERIODS, ui.period, (v) => { ui.period = v; drawKpis(); if (tab === 'analisis') build(); }, 'Periodo'),
        el('button', { type: 'button', class: 'pill', onclick: () => createLead(startWith()) }, icon('plus'), 'Nuevo lead'),
      ),
    ),
    kpis,
    dueBox,
    el('nav', { class: 'ng-tabs', 'aria-label': 'Vistas de leads' }, TABS.map(([k, label, ico]) => el('a', { href: k === 'embudo' ? '#/leads' : `#/leads/${k}`, 'aria-current': k === tab ? 'page' : null }, icon(ico), label))),
    filters,
    content,
  );
  drawKpis();
  drawFilters();
  build();
  return { node, refresh };
}

/** Tarjeta de inicio: seguimientos de hoy y valor del embudo. */
export function leadsHomeCard() {
  const all = leads();
  if (!all.length) return null;
  const due = dueLeads();
  const open = all.filter(isOpen);
  const pipeline = sumValues(open, true);
  return el('section', { class: 'ng-card' },
    el('header', { class: 'ng-card-head' },
      el('div', {}, el('h2', { text: 'Leads' }), el('p', { text: `${open.length} abiertos · ${money(pipeline.sum, base())} en el embudo` })),
      el('a', { class: 'pill ghost sm', href: '#/leads', text: 'Ver embudo' }),
    ),
    due.length ? dueList(due, { limit: 5 }) : el('p', { class: 'ng-none', text: 'Ningún seguimiento pendiente para hoy.' }),
  );
}
