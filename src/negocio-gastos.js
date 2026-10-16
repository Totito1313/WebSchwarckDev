// Negocio: gastos, proveedores, categorías y los recibos que se adjuntan.
//
// Cada gasto guarda su moneda y, si no es la principal, la tasa con la que se
// pagó ("1 USD = 36,50 Bs"): así los informes viejos no cambian cuando cambia
// la tasa. Los recibos se suben aparte (/api/admin/crm/files) y el gasto solo
// guarda su referencia.

import {
  state, find, put, remove, uid, money, amountText, parseNum, dateText, monthText, shortMonth, todayISO, addDays,
  convert, strongest, unitName, el, icon, iconButton, avatar, empty, seg, field, input, select, dialog, confirmBox,
  toast, autosize, addIcons, CURRENCY_CODES, numText,
} from './negocio-core.js';

addIcons({
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  tag: '<path d="M3 12.6V5a2 2 0 0 1 2-2h7.6l8.4 8.4a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0z"/><circle cx="8" cy="8" r="1.5"/>',
  clip: '<path d="m20.4 11.6-8.3 8.3a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
});

const base = () => state.settings.currency || 'USD';
const list = (col) => state[col] || [];

// ── Periodos (los comparten gastos e inicio) ──

export const PERIODS = [['30d', '30 días'], ['month', 'Este mes'], ['year', 'Este año'], ['all', 'Todo']];
export const period = { value: 'year' };
export const PREV_TEXT = { '30d': 'frente a los 30 días anteriores', month: 'frente al mismo tramo del mes pasado', year: 'frente al mismo tramo del año pasado' };

/** Desde y hasta del periodo, y el tramo anterior del mismo largo para comparar. */
export function periodRange(p = period.value, today = todayISO()) {
  if (p === 'all') return { from: '0000-01-01', to: '9999-12-31', prev: null };
  if (p === 'year') {
    const y = Number(today.slice(0, 4));
    return { from: `${y}-01-01`, to: today, prev: { from: `${y - 1}-01-01`, to: `${y - 1}${today.slice(4)}` } };
  }
  if (p === 'month') {
    const from = `${today.slice(0, 7)}-01`;
    const lastPrev = addDays(from, -1);
    const sameDay = `${lastPrev.slice(0, 7)}${today.slice(7)}`;
    return { from, to: today, prev: { from: `${lastPrev.slice(0, 7)}-01`, to: sameDay < lastPrev ? sameDay : lastPrev } };
  }
  return { from: addDays(today, -29), to: today, prev: { from: addDays(today, -59), to: addDays(today, -30) } };
}
export const within = (iso, r) => Boolean(iso) && iso >= r.from && iso <= r.to;

/** Variación entre dos cifras; null si antes no había nada con qué comparar. */
export const change = (now, before) => (before > 0 ? (now - before) / before : null);

/** Tarjeta de cifra con la variación frente al tramo anterior. */
export function stat({ label, value, sub, delta, upIsGood = true, tone, ico, word = false }) {
  let chip = null;
  if (delta != null && Number.isFinite(delta)) {
    const up = delta >= 0;
    chip = el('span', { class: `ng-delta ${up === upIsGood ? 'is-good' : 'is-bad'}` }, icon(up ? 'trendUp' : 'trendDown'), `${Math.abs(Math.round(delta * 100))}%`);
  }
  return el('article', { class: 'ng-kpi' },
    el('div', { class: 'ng-kpi-top' }, el('span', { class: 'ng-kpi-label', text: label }), chip || (ico && el('span', { class: 'ng-kpi-ico' }, icon(ico)))),
    el('b', { class: `ng-kpi-value${word ? ' is-word' : ''}`, style: tone ? { color: tone } : null, text: value }),
    el('small', { class: 'ng-kpi-sub', text: sub || '' }),
  );
}

// ── Gastos en la moneda principal ──

/** El gasto en la moneda principal, o null si está en otra moneda y no tiene tasa. */
export function expenseBase(e) {
  const amount = Number(e.amount) || 0;
  if (e.currency === base()) return amount;
  // La tasa se escribió frente a la moneda principal de entonces (`rateBase`). Si
  // la principal cambió, esa tasa ya no vale y el gasto cuenta como «sin tasa».
  if (e.rateBase && e.rateBase !== base()) return null;
  return convert(amount, e.currency, base(), e.rate);
}

export function sumExpenses(expenses) {
  let sum = 0;
  let skipped = 0;
  for (const e of expenses) {
    const v = expenseBase(e);
    if (v == null) skipped += 1;
    else sum += v;
  }
  return { sum, skipped };
}

// ── Categorías ──

const COLORS = ['cyan', 'blue', 'violet', 'bs', 'income', 'usdt', 'expense', 'body'];
const DEFAULT_CATEGORIES = [
  ['Software y suscripciones', 'cyan'],
  ['Nube y servidores', 'blue'],
  ['Equipos', 'violet'],
  ['Publicidad', 'bs'],
  ['Servicios profesionales', 'income'],
  ['Oficina e internet', 'usdt'],
  ['Impuestos y comisiones', 'expense'],
  ['Otros', 'body'],
];
export const catColor = (c) => `var(--${COLORS.includes(c?.color) ? c.color : 'body'})`;

/** La primera vez que se abren los gastos se proponen unas categorías; luego son tuyas. */
export function ensureCategories() {
  if (list('categories').length) return;
  DEFAULT_CATEGORIES.forEach(([name, color], order) => put('categories', { id: uid(), name, color, order, archived: false }));
}

export const sortedCategories = (withArchived = false) => list('categories')
  .filter((c) => withArchived || !c.archived)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

// ── Proveedores ──

const DOMAIN = /^(?=.{3,120}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export function cleanDomain(text) {
  const d = String(text || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return DOMAIN.test(d) ? d : '';
}

/** Logo del proveedor a partir de su dominio (lo sirve DuckDuckGo); si no hay, sus iniciales. */
export function vendorMark(name, domain) {
  const fallback = avatar(name || '?');
  if (!domain) return fallback;
  const img = el('img', { src: `https://icons.duckduckgo.com/ip3/${domain}.ico`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  const box = el('span', { class: 'ng-vendor', 'aria-hidden': 'true' }, img);
  img.addEventListener('error', () => box.replaceWith(fallback));
  return box;
}

function upsertVendor(name, domain, categoryId) {
  const clean = name.trim();
  if (!clean) return '';
  const found = list('vendors').find((v) => v.name.toLowerCase() === clean.toLowerCase());
  if (!found) {
    const vendor = { id: uid(), name: clean, domain, categoryId };
    put('vendors', vendor);
    return vendor.id;
  }
  if ((domain && domain !== found.domain) || (categoryId && categoryId !== found.categoryId)) {
    put('vendors', { ...found, domain: domain || found.domain || '', categoryId: categoryId || found.categoryId || '' });
  }
  return found.id;
}

// ── Recibos ──

export const fileUrl = (id) => `/api/admin/crm/files/${id}`;

/** Las fotos se reducen antes de subir; los PDF van tal cual. */
async function shrink(file) {
  if (file.type === 'application/pdf') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo leer la imagen.'))), 'image/webp', 0.82));
}

export async function uploadFile(file) {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') throw new Error('El recibo tiene que ser una imagen o un PDF.');
  let blob;
  try {
    blob = await shrink(file);
  } catch {
    throw new Error('No se pudo leer esa imagen. Prueba con JPG, PNG o PDF.');
  }
  if (blob.size > 3_000_000) throw new Error('El recibo pasa de 3 MB.');
  const id = uid();
  const res = await fetch(fileUrl(id), { method: 'PUT', headers: { 'content-type': blob.type || 'image/png' }, body: blob, credentials: 'same-origin' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo subir el recibo.');
  }
  return { id, type: blob.type || 'image/png', name: file.name, size: blob.size };
}

export const deleteFile = (id) => fetch(fileUrl(id), { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});

export function showReceipt(receipt) {
  if (receipt.type === 'application/pdf') {
    open(fileUrl(receipt.id), '_blank', 'noopener');
    return;
  }
  const dlg = el('dialog', { class: 'ng-viewer' },
    el('img', { src: fileUrl(receipt.id), alt: 'Recibo del gasto' }),
    iconButton('x', 'Cerrar', () => dlg.close()),
  );
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.tagName === 'IMG') dlg.close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// ── Formulario de gasto ──

export const SOURCES = ['BCV', 'Paralelo', 'Binance P2P', 'Banco', 'Acordada'];
const METHODS = ['Tarjeta', 'Zelle', 'Pago Móvil', 'Transferencia', 'Binance', 'Efectivo', 'PayPal'];
let lastCategory = '';

function datalist(id, values) {
  return el('datalist', { id }, [...new Set(values.filter(Boolean))].map((v) => el('option', { value: v })));
}

export function expenseForm(expense, onSaved) {
  ensureCategories();
  const x = expense ? structuredClone(expense) : {
    id: uid(), title: '', amount: 0, currency: base(), rate: 0, rateSource: 'BCV', vendorId: '', vendor: '',
    categoryId: lastCategory || sortedCategories()[0]?.id || '', date: todayISO(), method: '', notes: '', receipt: null,
  };
  const vendor = x.vendorId ? find('vendors', x.vendorId) : null;
  let pendingFile = null;
  let dropReceipt = false;

  const title = input({ value: x.title, required: true, maxLength: 120, placeholder: 'Suscripción de Figma' });
  const amount = input({ value: x.amount ? amountText(x.amount) : '', inputmode: 'decimal', required: true, placeholder: '0,00', 'aria-label': 'Importe' });
  const currency = select(CURRENCY_CODES.map((k) => [k, k]), x.currency, { 'aria-label': 'Moneda' });
  const rate = input({ value: x.rate ? numText(x.rate) : '', inputmode: 'decimal', placeholder: '0,00', 'aria-label': 'Tasa' });
  const source = select(SOURCES.map((s) => [s, s]), x.rateSource || 'BCV', { 'aria-label': 'Fuente de la tasa' });
  const rateFrom = el('span');
  const rateTo = el('span');
  const rateRow = el('div', { class: 'ng-field' },
    el('span', { text: 'Tasa del día del pago' }),
    el('div', { class: 'ng-rate' }, rateFrom, rate, rateTo, source),
    el('small', { text: 'Con ella se pasa a tu moneda principal; no cambia aunque cambie la tasa.' }),
  );
  const drawRate = () => {
    const cur = currency.value;
    rateRow.hidden = cur === base();
    const strong = strongest(cur, base());
    rateFrom.textContent = `1 ${unitName(strong)} =`;
    rateTo.textContent = unitName(strong === cur ? base() : cur);
  };
  currency.addEventListener('change', drawRate);
  drawRate();

  const date = input({ type: 'date', value: x.date, required: true });
  // Un gasto con una categoría archivada la conserva: no se cambia sola por la primera de la lista.
  const current = x.categoryId && find('categories', x.categoryId);
  const choices = sortedCategories().map((c) => [c.id, c.name]);
  if (current?.archived) choices.push([current.id, `${current.name} (archivada)`]);
  const category = select([...choices, ['new', 'Nueva categoría…']], x.categoryId, { 'aria-label': 'Categoría' });
  category.addEventListener('change', () => {
    if (category.value !== 'new') return;
    category.value = x.categoryId || sortedCategories()[0]?.id || '';
    newCategory((c) => {
      category.insertBefore(el('option', { value: c.id, text: c.name }), category.lastElementChild);
      category.value = c.id;
    });
  });

  const vendorName = input({ value: vendor?.name || x.vendor || '', maxLength: 80, placeholder: 'Figma' });
  vendorName.setAttribute('list', 'ng-vendor-list');
  const domain = input({ value: vendor?.domain || '', maxLength: 120, placeholder: 'figma.com' });
  vendorName.addEventListener('change', () => {
    const v = list('vendors').find((y) => y.name.toLowerCase() === vendorName.value.trim().toLowerCase());
    if (!v) return;
    if (!domain.value) domain.value = v.domain || '';
    if (!expense && v.categoryId && find('categories', v.categoryId)) category.value = v.categoryId;
  });
  const method = input({ value: x.method, maxLength: 60, placeholder: 'Tarjeta' });
  method.setAttribute('list', 'ng-method-list');
  const notes = autosize(el('textarea', { value: x.notes, rows: 2, maxLength: 2000 }));

  // Recibo: arrastrar y soltar o elegir archivo.
  const fileIn = el('input', { type: 'file', accept: 'image/*,application/pdf', hidden: true });
  const zone = el('div', { class: 'ng-drop', tabindex: '0', role: 'button', 'aria-label': 'Adjuntar recibo' });
  const pick = (file) => {
    if (!file) return;
    pendingFile = file;
    drawZone();
  };
  fileIn.addEventListener('change', () => pick(fileIn.files[0]));
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('button')) fileIn.click();
  });
  zone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) {
      e.preventDefault();
      fileIn.click();
    }
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    pick(e.dataTransfer.files[0]);
  });
  function drawZone() {
    const quitar = el('button', { type: 'button', class: 'pill ghost sm', text: 'Quitar', onclick: () => { if (pendingFile) pendingFile = null; else dropReceipt = true; drawZone(); } });
    if (pendingFile) {
      const preview = pendingFile.type.startsWith('image/') ? el('img', { src: URL.createObjectURL(pendingFile), alt: '' }) : el('span', { class: 'ng-drop-ico' }, icon('file'));
      zone.replaceChildren(preview, el('div', {}, el('b', { text: pendingFile.name }), el('small', { text: 'Se sube al guardar.' })), quitar);
    } else if (x.receipt && !dropReceipt) {
      const r = x.receipt;
      const preview = r.type === 'application/pdf' ? el('span', { class: 'ng-drop-ico' }, icon('file')) : el('img', { src: fileUrl(r.id), alt: '' });
      zone.replaceChildren(preview, el('div', {}, el('b', { text: r.name || 'Recibo' }), el('small', { text: `${Math.max(1, Math.round(r.size / 1024))} KB` })),
        el('button', { type: 'button', class: 'pill ghost sm', text: 'Ver', onclick: () => showReceipt(r) }), quitar);
    } else {
      zone.replaceChildren(el('span', { class: 'ng-drop-ico' }, icon('upload')), el('div', {}, el('b', { text: 'Arrastra el recibo aquí' }), el('small', { text: 'o haz clic para elegirlo. Foto o PDF.' })));
    }
  }
  drawZone();

  const dlg = dialog({
    title: expense ? 'Editar gasto' : 'Nuevo gasto',
    wide: true,
    submit: 'Guardar gasto',
    body: el('div', { class: 'ng-form' },
      field('Concepto', title),
      el('div', { class: 'ng-grid2 is-price' }, field('Importe', amount), field('Moneda', currency)),
      rateRow,
      el('div', { class: 'ng-grid2' }, field('Fecha', date), field('Categoría', category)),
      el('div', { class: 'ng-grid2' }, field('Proveedor', vendorName), field('Web del proveedor', domain, 'Para mostrar su logo.')),
      field('Forma de pago', method),
      el('div', { class: 'ng-field' }, el('span', { text: 'Recibo' }), zone, fileIn),
      field('Notas', notes),
      datalist('ng-vendor-list', list('vendors').map((v) => v.name)),
      datalist('ng-method-list', [...METHODS, ...list('expenses').map((e) => e.method)]),
    ),
    danger: expense && {
      label: 'Eliminar',
      run: () => {
        confirmBox(`¿Eliminar el gasto «${expense.title}»?${expense.receipt ? ' Su recibo también se borra.' : ''}`).then((yes) => {
          if (!yes) return;
          if (expense.receipt) deleteFile(expense.receipt.id);
          remove('expenses', expense.id);
          toast('Gasto eliminado.');
          onSaved?.();
        });
      },
    },
    onSubmit: () => {
      save();
      return false;
    },
  });
  const submit = dlg.querySelector('button[type="submit"]');

  async function save() {
    const value = parseNum(amount.value);
    if (!title.value.trim() || !(value > 0)) {
      toast('Escribe el concepto y un importe mayor que cero.', 'error');
      return;
    }
    const cur = currency.value;
    const r = parseNum(rate.value);
    if (cur !== base() && !(r > 0)) {
      toast(`Falta la tasa para pasarlo a ${base()}.`, 'error');
      rate.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = pendingFile ? 'Subiendo recibo…' : 'Guardando…';
    try {
      if (pendingFile) {
        const meta = await uploadFile(pendingFile);
        if (x.receipt) deleteFile(x.receipt.id);
        x.receipt = meta;
      } else if (dropReceipt && x.receipt) {
        deleteFile(x.receipt.id);
        x.receipt = null;
      }
      const cleanCat = find('categories', category.value) ? category.value : '';
      Object.assign(x, {
        title: title.value.trim(),
        amount: value,
        currency: cur,
        rate: cur === base() ? 0 : r,
        rateBase: cur === base() ? '' : base(),
        rateSource: cur === base() ? '' : source.value,
        date: date.value || todayISO(),
        categoryId: cleanCat,
        method: method.value.trim(),
        notes: notes.value.trim(),
        vendor: vendorName.value.trim(),
        vendorId: upsertVendor(vendorName.value, cleanDomain(domain.value), cleanCat),
      });
      put('expenses', x);
      lastCategory = cleanCat;
      toast(expense ? 'Gasto guardado.' : 'Gasto añadido.');
      dlg.close();
      onSaved?.(x);
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.textContent = 'Guardar gasto';
    }
  }
}

function newCategory(onDone) {
  const name = input({ required: true, maxLength: 60, placeholder: 'Viajes' });
  dialog({
    title: 'Nueva categoría',
    submit: 'Crear',
    body: el('div', { class: 'ng-form' }, field('Nombre', name)),
    onSubmit: () => {
      const text = name.value.trim();
      if (!text) return false;
      const cats = list('categories');
      const c = { id: uid(), name: text, color: COLORS[cats.length % COLORS.length], order: Math.max(-1, ...cats.map((x) => x.order ?? 0)) + 1, archived: false };
      put('categories', c);
      onDone?.(c);
      return true;
    },
  });
}

/** Ordenar, renombrar, recolorear, archivar y borrar categorías. Los cambios se guardan al momento. */
export function categoriesForm(onDone) {
  ensureCategories();
  const rows = el('div', { class: 'ng-catlist' });
  const uses = (id) => list('expenses').filter((e) => e.categoryId === id).length;
  const draw = () => {
    const cats = sortedCategories(true);
    rows.replaceChildren(...cats.map((c, i) => {
      const n = uses(c.id);
      const move = (step) => {
        const other = cats[i + step];
        if (!other) return;
        // Se renumeran todas y se guardan las que cambiaron: así no quedan órdenes repetidos.
        const before = new Map(cats.map((cat) => [cat.id, cat.order]));
        cats.forEach((cat, k) => { cat.order = k; });
        [c.order, other.order] = [other.order, c.order];
        for (const cat of cats) if (before.get(cat.id) !== cat.order) put('categories', cat);
        draw();
      };
      return el('div', { class: `ng-cat${c.archived ? ' is-off' : ''}` },
        el('button', {
          type: 'button',
          class: 'ng-cat-dot',
          style: { '--c': catColor(c) },
          'aria-label': 'Cambiar color',
          title: 'Cambiar color',
          onclick: () => { c.color = COLORS[(COLORS.indexOf(c.color) + 1) % COLORS.length]; put('categories', c); draw(); },
        }),
        input({ value: c.name, maxLength: 60, 'aria-label': 'Nombre de la categoría', oninput: (e) => { c.name = e.target.value; put('categories', c); } }),
        el('small', { text: n ? `${n} ${n === 1 ? 'gasto' : 'gastos'}` : 'Sin gastos' }),
        iconButton('up', 'Subir', () => move(-1), i === 0 ? 'is-hidden' : ''),
        iconButton('down', 'Bajar', () => move(1), i === cats.length - 1 ? 'is-hidden' : ''),
        el('button', { type: 'button', class: 'pill ghost sm', text: c.archived ? 'Activar' : 'Archivar', onclick: () => { c.archived = !c.archived; put('categories', c); draw(); } }),
        n ? null : iconButton('trash', 'Borrar categoría', () => { remove('categories', c.id); draw(); }),
      );
    }), el('button', { type: 'button', class: 'ng-add', onclick: () => newCategory(draw) }, icon('plus'), 'Nueva categoría'));
  };
  draw();
  const dlg = dialog({
    title: 'Categorías',
    wide: true,
    submit: 'Listo',
    body: el('div', { class: 'ng-form' }, el('p', { class: 'ng-card-text', text: 'Archivar una categoría la quita del formulario sin tocar los gastos que ya la usan.' }), rows),
    onSubmit: () => {
      onDone?.();
      return true;
    },
  });
  dlg.querySelector('.ng-dialog-foot .pill.ghost:not(.danger)')?.remove();
  dlg.addEventListener('close', () => onDone?.());
}

// ── Página de gastos ──

function expenseRow(e, onSaved) {
  const c = e.categoryId && find('categories', e.categoryId);
  const v = e.vendorId && find('vendors', e.vendorId);
  const inBase = expenseBase(e);
  return el('button', { type: 'button', class: 'ng-row is-expense', onclick: () => expenseForm(e, onSaved) },
    vendorMark(v?.name || e.vendor || e.title, v?.domain),
    el('span', { class: 'ng-row-main' }, el('b', { text: e.title }), el('small', { text: [v?.name || e.vendor, e.method].filter(Boolean).join(' · ') || 'Sin proveedor' })),
    el('span', { class: 'ng-row-date', text: dateText(e.date) }),
    el('span', { class: 'ng-row-tag' }, c && el('span', { class: 'ng-tag', style: { '--c': catColor(c) }, text: c.name })),
    e.receipt ? el('span', { class: 'ng-row-clip', title: 'Tiene recibo' }, icon('clip')) : el('span'),
    el('span', { class: 'ng-row-amount' },
      el('b', { text: money(-e.amount, e.currency) }),
      e.currency !== base() && el('small', { text: inBase == null ? 'Sin tasa' : `≈ ${money(-inBase, base())}` }),
    ),
  );
}

export function expensesPage() {
  ensureCategories();
  let cat = 'all';
  let sort = 'new';
  let q = '';
  let split = 'cat';
  const kpis = el('div', { class: 'ng-kpis' });
  const note = el('p', { class: 'ng-kpi-note', hidden: true });
  const chart = el('section', { class: 'ng-card ng-chart-card' });
  const where = el('section', { class: 'ng-card ng-where' });
  const listBox = el('div', { class: 'ng-list-body' });
  const countText = el('small');
  const catSelect = select([], 'all', { 'aria-label': 'Categoría' });
  catSelect.addEventListener('change', () => { cat = catSelect.value; drawList(); });

  const inRange = () => {
    const r = periodRange();
    return list('expenses').filter((e) => within(e.date, r));
  };

  function drawKpis() {
    const r = periodRange();
    const now = inRange();
    const total = sumExpenses(now);
    const before = r.prev ? sumExpenses(list('expenses').filter((e) => within(e.date, r.prev))).sum : 0;
    const first = list('expenses').reduce((min, e) => (e.date && e.date < min ? e.date : min), todayISO());
    const from = period.value === 'all' ? first : r.from;
    const days = Math.max(1, Math.round((new Date(`${r.to > todayISO() ? todayISO() : r.to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000) + 1);
    const byCat = new Map();
    for (const e of now) {
      const v = expenseBase(e);
      if (v != null) byCat.set(e.categoryId, (byCat.get(e.categoryId) || 0) + v);
    }
    const [topId, topSum] = [...byCat].sort((a, b) => b[1] - a[1])[0] || [];
    const top = topId && find('categories', topId);
    const withReceipt = now.filter((e) => e.receipt).length;
    const delta = change(total.sum, before);
    kpis.replaceChildren(
      stat({ label: 'Gastos', value: String(now.length), ico: 'wallet', sub: `${withReceipt} con recibo` }),
      stat({ label: 'Total gastado', value: money(total.sum, base()), ico: 'dollar', delta, upIsGood: false, sub: delta != null ? PREV_TEXT[period.value] : 'En el periodo elegido' }),
      stat({ label: 'Media diaria', value: money(total.sum / days, base()), ico: 'calendar', sub: `En ${days} ${days === 1 ? 'día' : 'días'}` }),
      stat({ label: 'Donde más gastas', value: top ? top.name : '—', word: true, ico: 'tag', sub: top ? money(topSum, base()) : 'Sin gastos en el periodo' }),
    );
    note.hidden = !total.skipped;
    note.textContent = `${total.skipped} ${total.skipped === 1 ? 'gasto en otra moneda no tiene' : 'gastos en otras monedas no tienen'} tasa y no entra${total.skipped === 1 ? '' : 'n'} en las cifras.`;
  }

  function drawChart() {
    const today = todayISO();
    const months = [];
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00`);
    d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      months.push(d.toLocaleDateString('en-CA').slice(0, 7));
      d.setMonth(d.getMonth() + 1);
    }
    const spent = Object.fromEntries(months.map((m) => [m, 0]));
    for (const e of list('expenses')) {
      const m = (e.date || '').slice(0, 7);
      if (m in spent) spent[m] += expenseBase(e) || 0;
    }
    const top = Math.max(1, ...Object.values(spent));
    chart.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Últimos 12 meses' }), el('p', { text: `Lo gastado cada mes, en ${base()}.` })),
        el('div', { class: 'ng-legend' }, el('span', { style: { '--c': 'var(--expense)' }, text: 'Gastado' })),
      ),
      el('div', { class: 'ng-chart', role: 'img', 'aria-label': 'Gastos por mes' }, months.map((m) => el('div', { class: `ng-chart-col${m === today.slice(0, 7) ? ' is-now' : ''}` },
        el('div', { class: 'ng-chart-bars' }, el('i', { class: spent[m] ? 'is-spent' : 'is-zero', style: { '--v': spent[m] / top }, title: `${monthText(m)} · ${money(spent[m], base())}` })),
        el('span', { text: shortMonth(m) }),
      ))),
    );
  }

  function drawWhere() {
    const now = inRange();
    const groups = new Map();
    for (const e of now) {
      const v = expenseBase(e);
      if (v == null) continue;
      const key = split === 'cat' ? e.categoryId || '' : e.vendorId || `name:${(e.vendor || '').toLowerCase()}`;
      groups.set(key, (groups.get(key) || 0) + v);
    }
    const total = [...groups.values()].reduce((s, v) => s + v, 0);
    const rows = [...groups].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const top = rows[0]?.[1] || 1;
    where.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'A dónde va el dinero' }), el('p', { text: 'En el periodo elegido.' })),
        seg([['cat', 'Categorías'], ['vendor', 'Proveedores']], split, (v) => { split = v; drawWhere(); }, 'Agrupar por'),
      ),
      rows.length ? el('ul', { class: 'ng-bars' }, rows.map(([key, sum]) => {
        let name = 'Sin categoría';
        let color = 'var(--body)';
        let mark = null;
        if (split === 'cat') {
          const c = find('categories', key);
          if (c) {
            name = c.name;
            color = catColor(c);
          }
        } else {
          const v = key.startsWith('name:') ? null : find('vendors', key);
          name = v?.name || key.slice(5) || 'Sin proveedor';
          color = 'var(--expense)';
          mark = vendorMark(name, v?.domain);
        }
        return el('li', { style: { '--c': color } },
          el('div', { class: 'ng-bars-name' }, mark || el('i', { class: 'ng-dot' }), el('span', { text: name })),
          el('span', { class: 'ng-bars-track' }, el('i', { style: { width: `${Math.max(2, (sum / top) * 100)}%` } })),
          el('b', { text: money(sum, base()) }),
          el('small', { text: `${Math.round((sum / total) * 100)}%` }),
        );
      })) : el('p', { class: 'ng-none', text: 'Sin gastos en este periodo.' }),
    );
  }

  function drawList() {
    const cats = sortedCategories(true);
    catSelect.replaceChildren(...[['all', 'Todas las categorías'], ...cats.map((c) => [c.id, c.name])].map(([v, t]) => el('option', { value: v, text: t, selected: v === cat })));
    const all = list('expenses');
    const shown = all
      .filter((e) => (cat === 'all' || e.categoryId === cat) && (!q || `${e.title} ${e.vendor} ${e.notes} ${e.method}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === 'big' || sort === 'small') {
          const d = (expenseBase(b) ?? 0) - (expenseBase(a) ?? 0);
          return sort === 'big' ? d : -d;
        }
        const d = (b.date || '').localeCompare(a.date || '');
        return sort === 'old' ? -d : d;
      });
    countText.textContent = shown.length === all.length ? `${all.length} en total` : `${shown.length} de ${all.length}`;
    if (!all.length) {
      listBox.replaceChildren(empty({
        ico: 'wallet',
        title: 'Todavía no hay gastos',
        text: 'Apunta cada pago en menos de 30 segundos, con su recibo, y mira a dónde se va el dinero.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => expenseForm(null, refresh) }, icon('plus'), 'Nuevo gasto'),
      }));
      return;
    }
    if (!shown.length) {
      listBox.replaceChildren(el('p', { class: 'ng-none', text: 'Nada coincide con esos filtros.' }));
      return;
    }
    if (sort === 'big' || sort === 'small') {
      listBox.replaceChildren(el('div', { class: 'ng-rows' }, shown.map((e) => expenseRow(e, refresh))));
      return;
    }
    const groups = new Map();
    for (const e of shown) {
      const key = (e.date || todayISO()).slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    listBox.replaceChildren(...[...groups].map(([key, items]) => {
      const { sum, skipped } = sumExpenses(items);
      return el('section', { class: 'ng-group' },
        el('header', {}, el('h3', {}, monthText(key), el('span', { text: String(items.length) })), el('span', { class: 'ng-group-sum', text: money(-sum, base()) + (skipped ? ' + otras monedas' : '') })),
        el('div', { class: 'ng-rows' }, items.map((e) => expenseRow(e, refresh))),
      );
    }));
  }

  const refresh = () => {
    drawKpis();
    drawChart();
    drawWhere();
    drawList();
  };

  const search = input({ type: 'search', placeholder: 'Buscar gastos…', 'aria-label': 'Buscar gastos', oninput: (e) => { q = e.target.value.trim().toLowerCase(); drawList(); } });
  const node = el('div', { class: 'ng-page' },
    el('header', { class: 'ng-head' },
      el('div', {}, el('h1', { text: 'Gastos' }), el('p', { text: 'Lo que pagas, a quién y en qué, siempre en tu moneda principal.' })),
      el('div', { class: 'ng-head-actions' },
        seg(PERIODS, period.value, (v) => { period.value = v; drawKpis(); drawWhere(); }, 'Periodo'),
        el('button', { type: 'button', class: 'pill ghost', onclick: () => categoriesForm(refresh) }, icon('tag'), 'Categorías'),
        el('button', { type: 'button', class: 'pill', onclick: () => expenseForm(null, refresh) }, icon('plus'), 'Nuevo gasto'),
      ),
    ),
    kpis,
    note,
    el('div', { class: 'ng-split' }, chart, where),
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Todos los gastos' }), countText),
        el('div', { class: 'ng-filters' },
          catSelect,
          select([['new', 'Más recientes'], ['old', 'Más antiguos'], ['big', 'Más caros'], ['small', 'Más baratos']], sort, { 'aria-label': 'Orden', onchange: (e) => { sort = e.target.value; drawList(); } }),
          el('label', { class: 'ng-search' }, icon('search'), search),
        ),
      ),
      listBox,
    ),
  );
  refresh();
  return { node, refresh };
}
