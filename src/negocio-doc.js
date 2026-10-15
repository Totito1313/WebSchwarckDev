// Negocio: el editor de facturas, cotizaciones y recibos.
//
// La hoja es siempre papel blanco (es lo que se imprime y lo que ve el cliente);
// alrededor manda el tema. Escribir solo actualiza el modelo y las cifras; los
// cambios de estructura (añadir una línea, quitar un impuesto…) repintan la hoja.

import {
  state, find, put, remove, uid, bus, saving, flushNow, totals, docStatus, money, amountText, numText, parseNum, round2,
  dateText, todayISO, addDays, strongest, unitName, snapshotCustomer, snapshotPayment, el, icon, iconButton, avatar, tag, empty, seg,
  toggle, menu, picker, confirmBox, toast, qr, autosize, safeLink, input, select, CURRENCIES, CURRENCY_CODES, METHODS,
  methodLabel, DOC_WORD, DEFAULT_STYLE, api, pubOf, isSignable, isLocked, field,
} from './negocio-core.js';
import { go, customerForm, templateForm, catalogForm } from './negocio-views.js';
import { ACCENTS, renderSheet, acceptance, stampText } from './negocio-sheet.js';
import { renderBlocks, applyTemplate, PROPOSAL_TEMPLATES, BLOCKS, block } from './negocio-propuesta.js';
import { uploadFile, fileUrl } from './negocio-gastos.js';
import { newProject } from './negocio-work.js';

const ACCENT_NAMES = { ink: 'Tinta', cyan: 'Cian', blue: 'Azul', green: 'Verde', violet: 'Violeta', orange: 'Naranja' };
const FONTS = [['inter', 'Inter'], ['dm', 'DM Sans'], ['mono', 'Mono']];
const SECTION_TITLES = ['Términos y condiciones', 'Garantía', 'Información legal', 'Política de devoluciones', 'Confidencialidad'];
const SOURCES = ['BCV', 'Paralelo', 'Binance P2P', 'Acordada'];
const TITLE = { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo', proposal: 'Propuesta' };
const LIST = { invoice: '#/facturas', receipt: '#/facturas', quote: '#/cotizaciones', proposal: '#/propuestas' };
const SHARE_DAYS = [[0, 'No caduca'], [7, '7 días'], [30, '30 días'], [90, '90 días']];

export function docEditor(id, { backTo } = {}) {
  const doc = find('docs', id);
  const node = el('div', { class: 'ng-editor' });
  if (!doc) {
    node.append(el('div', { class: 'ng-page' }, empty({ ico: 'file', title: 'Ese documento ya no existe', action: el('a', { class: 'pill', href: '#/facturas', text: 'Ver facturas' }) })));
    return { node };
  }
  doc.style = { ...DEFAULT_STYLE, ...doc.style };
  let drawer = null;
  let refs = {};

  const bar = el('div', { class: 'ng-ebar' });
  const sheet = el('article', { class: 'ng-sheet' });
  const aside = el('aside', { class: 'ng-drawer', hidden: true, 'aria-label': 'Panel lateral' });
  const savingNote = el('span', { class: 'ng-saving', role: 'status' });
  node.append(el('div', { class: 'ng-canvas' },
    el('div', { class: 'ng-sky', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    bar,
    el('div', { class: 'ng-stage' }, el('div', { class: 'ng-sheet-wrap' }, sheet), aside),
  ));

  const touch = () => put('docs', doc);
  const listRoute = () => backTo || LIST[doc.type];
  const setTitle = () => {
    document.title = `${doc.number || `${TITLE[doc.type]} nueva`} | Negocio`;
  };

  // ── Campos de la hoja ──

  const flat = (value, onValue, { cls = '', ...props } = {}) => el('input', {
    class: `sh-in ${cls}`.trim(),
    value: value ?? '',
    ...props,
    oninput: (e) => {
      onValue(e.target.value);
      touch();
    },
  });
  const flatArea = (value, onValue, { cls = '', ...props } = {}) => autosize(el('textarea', {
    class: `sh-in ${cls}`.trim(),
    rows: 1,
    value: value ?? '',
    ...props,
    oninput: (e) => {
      onValue(e.target.value);
      touch();
    },
  }));
  const numIn = (value, onValue, { whole = false, label, cls = '' } = {}) => {
    const show = (v) => (whole ? numText(v) : amountText(v));
    const box = el('input', { class: `sh-in is-num ${cls}`.trim(), inputmode: 'decimal', value: show(value), 'aria-label': label });
    box.addEventListener('focus', () => box.select());
    box.addEventListener('input', () => {
      onValue(parseNum(box.value));
      touch();
      updateNumbers();
    });
    box.addEventListener('blur', () => {
      box.value = show(parseNum(box.value));
    });
    return box;
  };
  const dateIn = (value, onValue, label) => {
    const printed = el('span', { class: 'print-only', text: dateText(value) });
    const box = el('input', {
      type: 'date',
      class: 'sh-in sh-date-in',
      value: value || '',
      'aria-label': label,
      onchange: (e) => {
        onValue(e.target.value);
        printed.textContent = dateText(e.target.value);
        touch();
        drawBar();
      },
    });
    return el('span', { class: 'sh-date' }, box, printed);
  };
  const label = (text) => el('span', { class: 'sh-label', text });

  // ── La hoja ──

  function drawSheet() {
    if (isLocked(doc)) {
      // Firmado por el cliente: se enseña tal cual quedó, sin campos.
      const pub = pubOf(doc);
      const ready = renderSheet(doc, { logo: state.settings.logo, response: pub, drawnSrc: pub.mode === 'drawn' ? `/api/admin/crm/signature/${doc.id}` : '' });
      sheet.className = ready.className;
      sheet.style.cssText = ready.style.cssText;
      Object.assign(sheet.dataset, ready.dataset);
      sheet.replaceChildren(...ready.childNodes);
      refs = {};
      return;
    }
    sheet.className = 'ng-sheet';
    const st = doc.style;
    sheet.dataset.layout = st.layout;
    sheet.dataset.font = st.font;
    sheet.dataset.cover = st.cover;
    sheet.dataset.type = doc.type;
    sheet.style.setProperty('--accent', ACCENTS[st.accent] || ACCENTS.ink);
    sheet.style.setProperty('--logo', `${Math.max(20, Math.min(120, Number(st.logoSize) || 44))}px`);
    refs = { amounts: new Map() };

    const logo = state.settings.logo ? el('img', { class: 'sh-logo', src: state.settings.logo, alt: state.settings.name || '' }) : null;
    refs.number = el('span', { text: doc.number || 'Se numera al guardar' });
    const top = el('header', { class: 'sh-top' },
      logo || el('span', { class: 'sh-logo is-empty' }),
      el('span', { class: 'sh-num' }, el('span', { class: 'sh-hash', text: '#' }), refs.number),
    );
    const title = el('h1', { class: 'sh-title', text: TITLE[doc.type] });

    sheet.replaceChildren(...[
      st.cover !== 'none' && el('div', { class: 'sh-cover', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
      el('div', { class: 'sh-body' },
        top,
        doc.type === 'proposal' ? flatArea(doc.title, (v) => { doc.title = v; }, { cls: 'sh-proposal-title', placeholder: 'Título de la propuesta', 'aria-label': 'Título de la propuesta' }) : title,
        parties(),
        doc.type === 'proposal'
          ? renderBlocks(doc, { edit: true, F: { text: flat, area: flatArea }, touch, redraw: drawSheet, pickImage, saveBlock, library: blockLibrary, pricing: () => [lines(), el('div', { class: 'sh-foot' }, payBlock(), totalsBlock())] })
          : [doc.type === 'receipt' ? receiptLines() : lines(), el('div', { class: 'sh-foot' }, doc.type === 'receipt' ? receiptPay() : payBlock(), totalsBlock())],
        flatArea(doc.notes, (v) => { doc.notes = v; }, { cls: 'sh-notes', placeholder: 'Nota para el cliente (opcional)', 'aria-label': 'Nota' }),
        doc.type !== 'receipt' && sectionsBlock(),
        isSignable(doc) && acceptance(pubOf(doc)),
      ),
    ].filter(Boolean));
    updateNumbers();
  }

  /** Imagen de un trabajo en la propuesta: se sube como los recibos de gastos. */
  function pickImage(item, done) {
    const fileIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      toast('Subiendo imagen…');
      try {
        item.image = fileUrl((await uploadFile(f)).id);
        done();
        toast('Imagen lista.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    fileIn.click();
  }

  function parties() {
    const f = doc.from;
    const c = doc.customer;
    const from = el('div', { class: 'sh-party' },
      label('De'),
      flat(f.name, (v) => { f.name = v; }, { cls: 'is-strong', placeholder: 'Tu nombre o empresa', 'aria-label': 'Tu nombre' }),
      flat(f.taxId, (v) => { f.taxId = v; }, { placeholder: 'RIF o cédula', 'aria-label': 'Tu RIF' }),
      flat(f.email, (v) => { f.email = v; }, { placeholder: 'Correo', 'aria-label': 'Tu correo' }),
      flat(f.phone, (v) => { f.phone = v; }, { placeholder: 'Teléfono', 'aria-label': 'Tu teléfono' }),
      flat(f.website, (v) => { f.website = v; }, { placeholder: 'Web', 'aria-label': 'Tu web' }),
      flatArea(f.address, (v) => { f.address = v; }, { placeholder: 'Dirección', 'aria-label': 'Tu dirección' }),
    );
    const to = el('div', { class: 'sh-party' },
      label(isSignable(doc) ? 'Preparada para' : doc.type === 'receipt' ? 'Recibido de' : 'Facturar a'),
      flat(c.name, (v) => { c.name = v; drawBar(); }, { cls: 'is-strong', placeholder: 'Nombre del cliente', 'aria-label': 'Nombre del cliente' }),
      flat(c.company, (v) => { c.company = v; }, { placeholder: 'Empresa', 'aria-label': 'Empresa del cliente' }),
      flat(c.taxId, (v) => { c.taxId = v; }, { placeholder: 'RIF, cédula o NIF', 'aria-label': 'RIF del cliente' }),
      flat(c.email, (v) => { c.email = v; }, { placeholder: 'Correo', 'aria-label': 'Correo del cliente' }),
      flat(c.phone, (v) => { c.phone = v; }, { placeholder: 'Teléfono', 'aria-label': 'Teléfono del cliente' }),
      flatArea(c.address, (v) => { c.address = v; }, { placeholder: 'Dirección', 'aria-label': 'Dirección del cliente' }),
    );
    const dates = el('div', { class: 'sh-dates' },
      label(doc.type === 'receipt' ? 'Fecha del pago' : 'Emisión'),
      dateIn(doc.issueDate, (v) => { doc.issueDate = v; }, 'Fecha de emisión'),
      doc.type === 'invoice' && [label('Vence'), dateIn(doc.dueDate, (v) => { doc.dueDate = v; }, 'Fecha de vencimiento')],
      isSignable(doc) && [label('Válida hasta'), dateIn(doc.validUntil, (v) => { doc.validUntil = v; }, 'Válida hasta')],
      doc.type === 'receipt' && doc.invoiceNumber && [label('Factura'), el('span', { class: 'sh-static', text: doc.invoiceNumber })],
    );
    return el('section', { class: 'sh-parties' }, from, to, dates);
  }

  /** Las líneas: cada una puede llevar su foto y se reordena arrastrando su asa. */
  function lines() {
    let dragId = null;
    const marker = el('div', { class: 'sh-drop no-print', 'aria-hidden': 'true' });
    const rows = doc.items.map((item, i) => {
      const amount = el('span', { class: 'sh-amount' });
      refs.amounts.set(item.id, amount);
      const handle = el('button', { type: 'button', class: 'sh-handle no-print', draggable: true, 'aria-label': 'Mover la línea u otras opciones', title: 'Arrastra para mover · toca para ver opciones' }, icon('drag'));
      handle.addEventListener('click', () => lineMenu(handle, item, i));
      handle.addEventListener('dragstart', (e) => {
        dragId = item.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
        const row = handle.closest('.sh-item');
        e.dataTransfer.setDragImage(row, 24, 20);
        setTimeout(() => row.classList.add('is-dragging'));
      });
      handle.addEventListener('dragend', () => {
        dragId = null;
        marker.remove();
        for (const r of sheet.querySelectorAll('.sh-item.is-dragging')) r.classList.remove('is-dragging');
      });
      const media = item.image && el('div', { class: 'sh-item-media' },
        el('img', { src: item.image, alt: '' }),
        el('button', { type: 'button', class: 'sh-media-x no-print', 'aria-label': 'Quitar la imagen', title: 'Quitar la imagen', onclick: () => { item.image = ''; touch(); drawSheet(); } }, icon('x')),
      );
      return el('div', { class: 'sh-item', data: { id: item.id } },
        handle,
        el('div', { class: `sh-item-desc${item.image ? ' has-media' : ''}` },
          media,
          el('div', { class: 'sh-item-fields' },
            flat(item.name, (v) => { item.name = v; }, { cls: 'is-strong', placeholder: 'Concepto', 'aria-label': 'Concepto' }),
            flatArea(item.description, (v) => { item.description = v; }, { cls: 'is-soft', placeholder: 'Detalle (opcional)', 'aria-label': 'Detalle' }),
          ),
        ),
        numIn(item.qty, (v) => { item.qty = v; }, { whole: true, label: 'Cantidad' }),
        numIn(item.price, (v) => { item.price = v; }, { label: 'Precio' }),
        amount,
        iconButton('x', 'Quitar línea', () => {
          doc.items = doc.items.filter((x) => x !== item);
          touch();
          drawSheet();
        }, 'sh-del no-print'),
      );
    });
    const add = el('div', { class: 'sh-adds no-print' },
      el('button', { type: 'button', class: 'sh-add', onclick: () => addItem() }, icon('plus'), 'Añadir línea'),
      el('button', { type: 'button', class: 'sh-add', onclick: (e) => pickFromCatalog(e.currentTarget) }, icon('box'), 'Del catálogo'),
    );
    const box = el('section', { class: 'sh-items' },
      el('div', { class: 'sh-items-head' }, el('span', { text: 'Descripción' }), el('span', { text: 'Cant.' }), el('span', { text: 'Precio' }), el('span', { text: 'Importe' })),
      rows,
      add,
    );
    box.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const next = [...box.querySelectorAll('.sh-item:not(.is-dragging)')].find((r) => {
        const rect = r.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
      box.insertBefore(marker, next || add);
    });
    box.addEventListener('dragleave', (e) => {
      if (!box.contains(e.relatedTarget)) marker.remove();
    });
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      const nextId = marker.nextElementSibling?.dataset?.id;
      marker.remove();
      const item = dragId && doc.items.find((x) => x.id === dragId);
      if (!item || item.id === nextId) return;
      doc.items = doc.items.filter((x) => x !== item);
      const to = nextId ? doc.items.findIndex((x) => x.id === nextId) : doc.items.length;
      doc.items.splice(to < 0 ? doc.items.length : to, 0, item);
      touch();
      drawSheet();
    });
    return box;
  }

  function lineMenu(anchor, item, i) {
    const move = (to) => {
      doc.items.splice(i, 1);
      doc.items.splice(to, 0, item);
      touch();
      drawSheet();
    };
    menu(anchor, [
      { label: item.image ? 'Cambiar la imagen' : 'Poner una imagen', icon: 'image', run: () => pickImage(item, () => { touch(); drawSheet(); }) },
      item.image && { label: 'Quitar la imagen', icon: 'x', run: () => { item.image = ''; touch(); drawSheet(); } },
      { label: 'Duplicar línea', icon: 'copy', run: () => { doc.items.splice(i + 1, 0, { ...structuredClone(item), id: uid() }); touch(); drawSheet(); } },
      { label: 'Subir', icon: 'up', disabled: i === 0, run: () => move(i - 1) },
      { label: 'Bajar', icon: 'down', disabled: i === doc.items.length - 1, run: () => move(i + 1) },
      { label: 'Guardar en el catálogo', icon: 'box', disabled: !item.name?.trim(), run: () => catalogForm(null, () => toast('Guardado en el catálogo.'), { name: item.name, description: item.description, price: item.price, currency: doc.currency, image: item.image || '' }) },
      '-',
      { label: 'Quitar línea', icon: 'trash', danger: true, run: () => { doc.items = doc.items.filter((x) => x !== item); touch(); drawSheet(); } },
    ]);
  }

  function addItem(from) {
    const item = { id: uid(), name: from?.name || '', description: from?.description || '', qty: 1, price: from?.price || 0, image: from?.image || '' };
    // Si la única línea está vacía, el servicio del catálogo ocupa su lugar.
    const blank = doc.items.length === 1 && !doc.items[0].name && !doc.items[0].price;
    if (from && blank) doc.items = [item];
    else doc.items.push(item);
    touch();
    drawSheet();
    if (from && from.currency && from.currency !== doc.currency) toast(`Ese precio está en ${from.currency} y el documento en ${doc.currency}. Revísalo.`);
    if (!from) [...sheet.querySelectorAll('.sh-item .is-strong')].at(-1)?.focus();
  }

  function pickFromCatalog(anchor) {
    picker(anchor, {
      placeholder: 'Buscar en el catálogo…',
      items: () => state.catalog,
      label: (it) => it.name,
      sub: (it) => [money(it.price, it.currency), it.description].filter(Boolean).join(' · '),
      onPick: (it) => addItem(it),
      extra: el('button', { type: 'button', class: 'ng-pick-new', onclick: () => catalogForm(null, (it) => it && addItem(it)) }, icon('plus'), 'Nuevo servicio'),
    });
  }

  function receiptLines() {
    return el('section', { class: 'sh-items' },
      el('div', { class: 'sh-items-head' }, el('span', { text: 'Concepto' }), el('span'), el('span'), el('span', { text: 'Importe' })),
      doc.items.map((item) => el('div', { class: 'sh-item' },
        el('div', { class: 'sh-item-desc' },
          flat(item.name, (v) => { item.name = v; }, { cls: 'is-strong', 'aria-label': 'Concepto' }),
          flatArea(item.description, (v) => { item.description = v; }, { cls: 'is-soft', placeholder: 'Referencia (opcional)', 'aria-label': 'Referencia' }),
        ),
        el('span'),
        el('span'),
        el('span', { class: 'sh-amount', text: money(item.price, doc.currency) }),
      )),
    );
  }

  function receiptPay() {
    return el('div', { class: 'sh-pay' },
      label('Forma de pago'),
      el('b', { class: 'sh-static', text: doc.method || 'Sin indicar' }),
      doc.balanceAfter != null && [label('Saldo pendiente de la factura'), el('span', { class: 'sh-static', text: money(doc.balanceAfter, doc.currency) })],
    );
  }

  function payBlock() {
    const box = el('div', { class: 'sh-pay' });
    const p = doc.payment;
    const chip = el('button', { type: 'button', class: 'sh-chip no-print' }, icon('wallet'), p ? 'Cambiar forma de cobro' : 'Elegir forma de cobro', icon('down'));
    chip.addEventListener('click', () => menu(chip, [
      ...state.paytemplates.map((t) => ({ label: t.name || methodLabel(t.method), note: methodLabel(t.method), icon: p?.templateId === t.id ? 'check' : 'wallet', run: () => { doc.payment = snapshotPayment(t); touch(); drawSheet(); } })),
      state.paytemplates.length && '-',
      { label: 'Nueva forma de cobro', icon: 'plus', run: () => templateForm(null, (t) => { if (t) { doc.payment = snapshotPayment(t); touch(); drawSheet(); } }) },
      p && { label: 'Sin datos de pago', icon: 'x', run: () => { doc.payment = null; touch(); drawSheet(); } },
    ]));
    box.append(label('Datos de pago'), chip);
    if (!p) return box;

    const qrBox = el('div', { class: 'sh-qr-box' });
    const drawQr = () => {
      const link = safeLink(p.link);
      qrBox.replaceChildren(...(link ? [el('div', { class: 'sh-qr' }, qr(link)), el('div', { class: 'sh-qr-text' },
        el('b', { text: 'Escanea para pagar' }),
        el('a', { class: 'sh-paybtn', href: link, target: '_blank', rel: 'noopener' }, 'Pagar en línea', icon('external')),
        el('small', { class: 'print-only', text: link }),
      )] : []));
    };
    let qrTimer = 0;
    box.append(
      flat(p.name, (v) => { p.name = v; }, { cls: 'is-strong', placeholder: methodLabel(p.method), 'aria-label': 'Forma de cobro' }),
      el('dl', { class: 'sh-kv' }, p.fields.map((f) => el('div', {},
        el('dt', {}, flat(f.label, (v) => { f.label = v; }, { 'aria-label': 'Dato' })),
        el('dd', {}, flat(f.value, (v) => { f.value = v; }, { 'aria-label': f.label || 'Valor' })),
      ))),
      flat(p.link, (v) => {
        p.link = v;
        clearTimeout(qrTimer);
        qrTimer = setTimeout(drawQr, 300);
      }, { cls: 'sh-link no-print', placeholder: 'Enlace de pago (opcional): https://…', 'aria-label': 'Enlace de pago', type: 'url' }),
      qrBox,
    );
    drawQr();
    return box;
  }

  function adjRow(labelNode, amountRef, onRemove) {
    return el('div', { class: 'sh-row sh-adj' },
      el('span', { class: 'sh-adj-label' }, labelNode, iconButton('x', 'Quitar', () => { onRemove(); touch(); drawSheet(); }, 'sh-del no-print')),
      amountRef,
    );
  }

  function totalsBlock() {
    const box = el('div', { class: 'sh-totals' });
    const sign = CURRENCIES[doc.currency]?.sign || doc.currency;
    if (doc.type !== 'receipt') {
      refs.subtotal = el('b');
      box.append(el('div', { class: 'sh-row' }, el('span', { text: 'Subtotal' }), refs.subtotal));
    }

    if (doc.discount) {
      const d = doc.discount;
      const unit = el('button', { type: 'button', class: 'sh-unit', title: 'Cambiar entre porcentaje e importe', text: d.type === 'amount' ? sign : '%', onclick: () => { d.type = d.type === 'amount' ? 'percent' : 'amount'; touch(); drawSheet(); } });
      refs.discount = el('b');
      box.append(adjRow([el('span', { text: 'Descuento' }), numIn(d.value, (v) => { d.value = v; }, { label: 'Descuento', cls: 'is-mini' }), unit], refs.discount, () => { doc.discount = null; }));
    }
    if (doc.tax) {
      const t = doc.tax;
      refs.tax = el('b');
      box.append(adjRow([flat(t.label, (v) => { t.label = v; }, { cls: 'is-mini is-label', 'aria-label': 'Nombre del impuesto' }), numIn(t.rate, (v) => { t.rate = v; }, { whole: true, label: 'Porcentaje del impuesto', cls: 'is-mini' }), el('span', { text: '%' })], refs.tax, () => { doc.tax = null; }));
    }
    if (doc.withholding) {
      const w = doc.withholding;
      const on = el('button', { type: 'button', class: 'sh-unit is-word', title: 'Calcular sobre la base o sobre el impuesto', text: w.on === 'tax' ? 'del impuesto' : 'de la base', onclick: () => { w.on = w.on === 'tax' ? 'base' : 'tax'; touch(); drawSheet(); } });
      refs.withholding = el('b');
      box.append(adjRow([el('span', { text: 'Retención' }), numIn(w.rate, (v) => { w.rate = v; }, { whole: true, label: 'Porcentaje de retención', cls: 'is-mini' }), el('span', { text: '%' }), on], refs.withholding, () => { doc.withholding = null; }));
    }
    if (doc.shipping) {
      const s = doc.shipping;
      refs.shipping = el('b');
      box.append(adjRow([flat(s.label, (v) => { s.label = v; }, { cls: 'is-mini is-label', 'aria-label': 'Concepto del cargo' }), numIn(s.amount, (v) => { s.amount = v; }, { label: 'Importe del cargo', cls: 'is-mini' })], refs.shipping, () => { doc.shipping = null; }));
    }

    const chips = [
      !doc.discount && ['Descuento', () => { doc.discount = { type: 'percent', value: 10 }; }],
      !doc.tax && ['Impuesto', () => { doc.tax = { label: 'IVA', rate: 16 }; }],
      !doc.withholding && ['Retención', () => { doc.withholding = { rate: 75, on: 'tax' }; }],
      !doc.shipping && ['Otro cargo', () => { doc.shipping = { label: 'Envío', amount: 0 }; }],
      !doc.equiv && ['Equivalencia', () => { doc.equiv = { currency: doc.currency === 'VES' ? 'USD' : 'VES', rate: 0, source: 'BCV' }; }],
    ].filter(Boolean);
    if (chips.length && doc.type !== 'receipt') {
      box.append(el('div', { class: 'sh-chips no-print' }, chips.map(([text, run]) => el('button', { type: 'button', class: 'sh-chip is-dashed', onclick: () => { run(); touch(); drawSheet(); } }, icon('plus'), text))));
    }

    refs.total = el('b');
    box.append(el('div', { class: 'sh-grand' }, el('span', { text: doc.type === 'receipt' ? 'Total recibido' : 'Total' }), refs.total));

    if (doc.equiv) box.append(equivBlock());
    if (doc.type === 'invoice' && doc.payments?.length) {
      refs.paid = el('b');
      refs.due = el('b');
      box.append(el('div', { class: 'sh-row is-soft' }, el('span', { text: 'Pagado' }), refs.paid), el('div', { class: 'sh-row sh-due' }, el('span', { text: 'Saldo pendiente' }), refs.due));
    }
    if (doc.signature) {
      box.append(el('div', { class: 'sh-sign' },
        el('span', { class: 'sh-sign-name', text: state.settings.signature || doc.from.name || '' }),
        el('small', { text: doc.from.name || '' }),
      ));
    }
    return box;
  }

  function equivBlock() {
    const e = doc.equiv;
    const strong = strongest(doc.currency, e.currency);
    const weak = strong === doc.currency ? e.currency : doc.currency;
    refs.equiv = el('b');
    const others = CURRENCY_CODES.filter((k) => k !== doc.currency);
    return el('div', { class: 'sh-equiv' },
      el('div', { class: 'sh-row' },
        el('span', { class: 'sh-adj-label' }, el('span', { text: 'Equivale a' }),
          select(others.map((k) => [k, k]), e.currency, { class: 'sh-pick no-print', 'aria-label': 'Moneda de la equivalencia', onchange: (ev) => { e.currency = ev.target.value; touch(); drawSheet(); } }),
          iconButton('x', 'Quitar equivalencia', () => { doc.equiv = null; touch(); drawSheet(); }, 'sh-del no-print')),
        refs.equiv,
      ),
      el('div', { class: 'sh-rate' },
        el('span', { text: `1 ${unitName(strong)} =` }),
        numIn(e.rate, (v) => { e.rate = v; }, { label: 'Tasa de cambio', cls: 'is-mini' }),
        el('span', { text: unitName(weak) }),
        select(SOURCES.map((s) => [s, s]), e.source, { class: 'sh-pick no-print', 'aria-label': 'Fuente de la tasa', onchange: (ev) => { e.source = ev.target.value; touch(); drawSheet(); } }),
        el('span', { class: 'print-only', text: `· ${e.source}, ${dateText(doc.issueDate)}` }),
      ),
    );
  }

  /** Secciones del pie (términos, garantía…). Se guardan en la biblioteca para usarlas en cualquier documento. */
  function sectionsBlock() {
    const library = state.settings.sections || [];
    const used = new Set(doc.sections.map((s) => s.title));
    const fromLibrary = library.length > 0 && el('button', { type: 'button', class: 'sh-chip' }, icon('bookmark'), 'De la biblioteca', icon('down'));
    if (fromLibrary) {
      fromLibrary.addEventListener('click', () => picker(fromLibrary, {
        placeholder: 'Buscar en la biblioteca…',
        items: () => state.settings.sections || [],
        label: (x) => x.title || 'Sin título',
        sub: (x) => (x.body || '').replace(/\s+/g, ' ').slice(0, 90),
        onPick: (x) => {
          doc.sections.push({ id: uid(), title: x.title, body: x.body, libId: x.id });
          touch();
          drawSheet();
        },
        extra: el('a', { class: 'ng-pick-new', href: '#/ajustes' }, icon('sliders'), 'Ordenar la biblioteca en Ajustes'),
      }));
    }
    return el('section', { class: 'sh-sections' },
      doc.sections.map((s, i) => {
        const move = (to) => {
          doc.sections.splice(i, 1);
          doc.sections.splice(to, 0, s);
          touch();
          drawSheet();
        };
        const more = iconButton('more', 'Opciones de la sección', () => menu(more, [
          { label: 'Subir', icon: 'up', disabled: i === 0, run: () => move(i - 1) },
          { label: 'Bajar', icon: 'down', disabled: i === doc.sections.length - 1, run: () => move(i + 1) },
          { label: 'Guardar en la biblioteca', icon: 'bookmark', disabled: !`${s.title || ''}${s.body || ''}`.trim(), run: () => saveSection(s) },
          '-',
          { label: 'Quitar sección', icon: 'trash', danger: true, run: () => { doc.sections = doc.sections.filter((x) => x !== s); touch(); drawSheet(); } },
        ], { align: 'end' }), 'sh-del no-print');
        return el('div', { class: 'sh-section' },
          el('div', { class: 'sh-section-head' },
            flat(s.title, (v) => { s.title = v; }, { cls: 'sh-section-title', 'aria-label': 'Título de la sección' }),
            more,
          ),
          flatArea(s.body, (v) => { s.body = v; }, { placeholder: 'Escribe aquí…', 'aria-label': s.title }),
        );
      }),
      el('div', { class: 'sh-chips no-print' },
        fromLibrary,
        [...SECTION_TITLES.filter((t) => !used.has(t)), 'Otra sección'].map((t) => el('button', {
          type: 'button',
          class: 'sh-chip is-dashed',
          onclick: () => {
            const saved = library.find((x) => x.title === t);
            const body = saved ? saved.body : t === 'Términos y condiciones' ? state.settings.terms || '' : '';
            doc.sections.push({ id: uid(), title: t === 'Otra sección' ? '' : t, body, libId: saved?.id || '' });
            touch();
            drawSheet();
            [...sheet.querySelectorAll('.sh-section textarea')].at(-1)?.focus();
          },
        }, icon('plus'), t)),
      ),
    );
  }

  /** Guarda una sección en la biblioteca (o la actualiza si ya estaba). */
  function saveSection(s) {
    const library = [...(state.settings.sections || [])];
    const at = library.findIndex((x) => (s.libId && x.id === s.libId) || (x.title && x.title === s.title));
    const entry = { id: at >= 0 ? library[at].id : uid(), title: (s.title || '').trim() || 'Sin título', body: s.body || '' };
    if (at >= 0) library[at] = entry;
    else library.push(entry);
    s.libId = entry.id;
    put('settings', { ...state.settings, sections: library });
    touch();
    drawSheet();
    toast(at >= 0 ? 'Actualizada en la biblioteca.' : 'Guardada en la biblioteca: ya la puedes añadir a cualquier documento.');
  }

  /** Un bloque de propuesta a la biblioteca: los de texto, como sección; el resto, enteros. */
  function saveBlock(b) {
    if (b.kind === 'intro' || b.kind === 'text') {
      saveSection({ title: b.title, body: b.body });
      return;
    }
    const { id, ...rest } = structuredClone(b);
    const saved = [...(state.settings.savedBlocks || []), { id: uid(), label: b.title || BLOCKS[b.kind]?.label || 'Bloque', block: rest }];
    put('settings', { ...state.settings, savedBlocks: saved });
    toast('Bloque guardado: lo verás en «Añadir bloque» de cualquier propuesta.');
  }

  /** Lo guardado que se puede añadir a una propuesta. */
  function blockLibrary() {
    return [
      ...(state.settings.savedBlocks || []).map((x) => ({ label: x.label, note: BLOCKS[x.block?.kind]?.label || '', make: () => ({ ...structuredClone(x.block), id: uid(), items: (x.block.items || []).map((it) => ({ ...it, id: uid() })) }) })),
      ...(state.settings.sections || []).map((x) => ({ label: x.title || 'Sin título', note: 'Sección', make: () => block('text', { title: x.title, body: x.body }) })),
    ];
  }

  /** Cifras que cambian al escribir: se actualizan en su sitio, sin repintar la hoja. */
  function updateNumbers() {
    const t = totals(doc);
    const cur = doc.currency;
    for (const item of doc.items) refs.amounts?.get(item.id)?.replaceChildren(money((Number(item.qty) || 0) * (Number(item.price) || 0), cur));
    refs.subtotal && (refs.subtotal.textContent = money(t.subtotal, cur));
    refs.discount && (refs.discount.textContent = money(-t.discount, cur));
    refs.tax && (refs.tax.textContent = money(t.tax, cur));
    refs.withholding && (refs.withholding.textContent = money(-t.withholding, cur));
    refs.shipping && (refs.shipping.textContent = money(t.shipping, cur));
    refs.total && (refs.total.textContent = money(t.total, cur));
    refs.paid && (refs.paid.textContent = money(-t.paid, cur));
    refs.due && (refs.due.textContent = money(t.due, cur));
    if (refs.equiv && doc.equiv) {
      const e = doc.equiv;
      const v = e.rate > 0 ? (strongest(cur, e.currency) === cur ? t.total * e.rate : t.total / e.rate) : null;
      refs.equiv.textContent = v == null ? 'Falta la tasa' : money(round2(v), e.currency);
    }
    if (drawer === 'pay') drawDrawer();
  }

  // ── Barra superior ──

  function setCustomer(c) {
    doc.customerId = c.id;
    doc.customer = snapshotCustomer(c);
    const untouched = doc.items.every((i) => !i.price);
    if (untouched && c.currency && c.currency !== doc.currency) changeCurrency(c.currency);
    touch();
    drawBar();
    drawSheet();
  }

  function changeCurrency(code) {
    doc.currency = code;
    if (doc.equiv?.currency === code) doc.equiv = null;
  }

  function changeType(type) {
    doc.type = type;
    const today = todayISO();
    if (type === 'invoice' && !doc.dueDate) doc.dueDate = addDays(doc.issueDate || today, Number(state.settings.dueDays) || 15);
    if (type === 'quote' && !doc.validUntil) doc.validUntil = addDays(doc.issueDate || today, Number(state.settings.quoteDays) || 15);
    if (!['draft', 'void', 'sent'].includes(doc.status)) doc.status = 'sent';
    if (type !== 'invoice' && drawer === 'pay') drawer = null;
    put('docs', doc, { now: true })?.catch(() => {});
    rebuild();
  }

  const setStatus = (status) => {
    doc.status = status;
    touch();
    drawBar();
    if (drawer) drawDrawer();
  };

  function duplicate() {
    const copy = structuredClone(doc);
    const today = todayISO();
    Object.assign(copy, { id: uid(), number: '', status: 'draft', issueDate: today, payments: [], invoiceId: '', fromQuoteId: '', fromQuote: '', share: null });
    delete copy.createdAt;
    delete copy.updatedAt;
    if (copy.type === 'invoice') copy.dueDate = addDays(today, Number(state.settings.dueDays) || 15);
    if (isSignable(copy)) copy.validUntil = addDays(today, Number(state.settings.quoteDays) || 15);
    copy.items = copy.items.map((i) => ({ ...i, id: uid() }));
    put('docs', copy, { now: true })?.catch(() => {});
    toast(`${TITLE[copy.type]} duplicada.`);
    go(`#/doc/${copy.id}`);
  }

  /** Cotización o propuesta aceptada → factura con las mismas líneas (y, si se pide, un proyecto). */
  function toInvoice({ project = false } = {}) {
    const today = todayISO();
    const inv = structuredClone(doc);
    Object.assign(inv, { id: uid(), type: 'invoice', status: 'draft', number: '', issueDate: today, dueDate: addDays(today, Number(state.settings.dueDays) || 15), validUntil: '', payments: [], fromQuoteId: doc.id, fromQuote: doc.number, share: null });
    delete inv.createdAt;
    delete inv.updatedAt;
    delete inv.blocks;
    delete inv.title;
    inv.style = { ...inv.style, cover: state.settings.style?.cover || 'none' };
    inv.items = inv.items.map((i) => ({ ...i, id: uid() }));
    if (!inv.payment) inv.payment = snapshotPayment(state.paytemplates.find((t) => t.isDefault));
    if (project) {
      const customer = doc.customerId ? find('customers', doc.customerId) : null;
      const p = {
        ...newProject(customer),
        name: doc.title || `${doc.customer?.company || doc.customer?.name || 'Cliente'} · ${doc.number}`,
        budget: totals(doc).total,
        currency: doc.currency,
        description: (doc.blocks || []).find((b) => b.kind === 'intro')?.body || '',
      };
      put('projects', p);
      inv.projectId = p.id;
      doc.projectId = p.id;
    }
    doc.status = 'accepted';
    doc.invoiceId = inv.id;
    put('docs', doc);
    put('docs', inv, { now: true })?.catch(() => {});
    toast(project ? 'Listo: ya tienes la factura y el proyecto.' : `${TITLE[doc.type]} aceptada. Ya tienes la factura.`);
    go(`#/doc/${inv.id}`);
  }

  async function destroy() {
    const receipts = doc.type === 'invoice' ? (doc.payments || []).map((p) => p.receiptId).filter((r) => r && find('docs', r)) : [];
    const what = `${TITLE[doc.type].toLowerCase()} ${doc.number}`.trim();
    const yes = await confirmBox(`¿Eliminar ${doc.type === 'receipt' ? 'el' : 'la'} ${what}?${receipts.length ? ` También se borran sus ${receipts.length === 1 ? 'recibo' : `${receipts.length} recibos`}.` : ''}`);
    if (!yes) return;
    for (const r of receipts) remove('docs', r);
    if (doc.type === 'receipt') {
      const inv = find('docs', doc.invoiceId);
      const p = inv?.payments?.find((x) => x.id === doc.paymentId);
      if (p) {
        p.receiptId = '';
        put('docs', inv);
      }
    }
    if (doc.fromQuoteId) {
      const q = find('docs', doc.fromQuoteId);
      if (q?.invoiceId === doc.id) {
        q.invoiceId = '';
        put('docs', q);
      }
    }
    remove('docs', doc.id);
    toast('Eliminado.');
    go(listRoute());
  }

  function printDoc() {
    const before = document.title;
    document.title = [doc.number || TITLE[doc.type], doc.customer?.name].filter(Boolean).join(' · ');
    addEventListener('afterprint', () => { document.title = before; }, { once: true });
    print();
  }

  function actions() {
    const status = docStatus(doc);
    const t = totals(doc);
    const dup = { label: 'Duplicar', icon: 'copy', run: duplicate };
    const del = { label: 'Eliminar', icon: 'trash', danger: true, run: destroy };
    const send = { label: 'Marcar como enviada', icon: 'send', run: () => { setStatus('sent'); toast('Marcada como enviada.'); } };
    if (doc.type === 'receipt') {
      const inv = find('docs', doc.invoiceId);
      return { primary: inv && { label: 'Ver factura', icon: 'file', run: () => go(`#/doc/${inv.id}`) }, more: [del] };
    }
    if (isSignable(doc)) {
      const linked = doc.invoiceId && find('docs', doc.invoiceId);
      const convert = { label: 'Convertir en factura', icon: 'file', run: () => toInvoice() };
      const withProject = !linked && { label: 'Factura y proyecto', icon: 'folder', run: () => toInvoice({ project: true }) };
      const answered = pubOf(doc)?.acceptedAt || pubOf(doc)?.declinedAt;
      if (status === 'draft') return { primary: send, more: [convert, withProject, dup, '-', del] };
      if (status === 'accepted') return { primary: linked ? { label: 'Ver factura', icon: 'file', run: () => go(`#/doc/${linked.id}`) } : convert, more: [withProject, !answered && { label: 'Reabrir', icon: 'undo', run: () => setStatus('sent') }, dup, '-', del] };
      if (status === 'declined') return { primary: answered ? null : { label: 'Reabrir', icon: 'undo', run: () => setStatus('sent') }, more: [dup, '-', del] };
      return {
        primary: convert,
        more: [
          withProject,
          { label: 'Marcar como aceptada', icon: 'check', run: () => setStatus('accepted') },
          { label: 'Marcar como rechazada', icon: 'x', run: () => setStatus('declined') },
          { label: 'Volver a borrador', icon: 'undo', run: () => setStatus('draft') },
          dup, '-', del,
        ],
      };
    }
    if (status === 'draft') return { primary: send, more: [dup, '-', del] };
    if (status === 'void') return { primary: { label: 'Reactivar', icon: 'undo', run: () => setStatus('sent') }, more: [dup, '-', del] };
    const hasPayments = doc.payments?.length > 0;
    return {
      primary: t.due > 0 ? { label: 'Registrar pago', icon: 'dollar', run: () => openDrawer('pay') } : { label: 'Ver pagos', icon: 'wallet', run: () => openDrawer('pay') },
      more: [
        { label: 'Volver a borrador', icon: 'undo', disabled: hasPayments, note: hasPayments ? 'Tiene pagos' : '', run: () => setStatus('draft') },
        { label: 'Anular', icon: 'ban', disabled: hasPayments, note: hasPayments ? 'Tiene pagos' : '', run: () => setStatus('void') },
        dup, '-', del,
      ],
    };
  }

  function drawBar() {
    const who = doc.customer?.name || doc.customer?.company;
    const glass = 'ng-gchip';
    const left = el('div', { class: 'ng-ebar-side' },
      el('button', { type: 'button', class: 'ng-gbtn', 'aria-label': 'Volver', title: 'Volver', onclick: () => go(listRoute()) }, icon('back')),
    );
    const locked = isLocked(doc);
    if (doc.type === 'receipt') {
      left.append(el('span', { class: glass }, icon('receipt'), 'Recibo'));
    } else if (doc.type === 'proposal') {
      left.append(el('span', { class: glass }, icon('send'), 'Propuesta'));
      if (!locked) {
        const tplBtn = el('button', { type: 'button', class: glass, 'aria-label': 'Plantilla' }, icon('edit'), 'Plantilla', icon('down'));
        tplBtn.addEventListener('click', () => menu(tplBtn, Object.entries(PROPOSAL_TEMPLATES).map(([k, t]) => ({
          label: t.label,
          icon: 'edit',
          run: async () => {
            if (!(await confirmBox(`¿Empezar desde «${t.label}»? Se cambian el título, los bloques y las líneas de precio.`, 'Usar plantilla'))) return;
            applyTemplate(doc, k);
            touch();
            drawSheet();
          },
        }))));
        left.append(tplBtn);
      }
    } else {
      const typeBtn = el('button', { type: 'button', class: glass, 'aria-label': 'Tipo de documento' }, icon(doc.type === 'quote' ? 'quote' : 'file'), TITLE[doc.type], icon('down'));
      const hasPayments = doc.payments?.length > 0;
      typeBtn.addEventListener('click', () => menu(typeBtn, [
        { label: 'Factura', icon: doc.type === 'invoice' ? 'check' : 'file', disabled: doc.type === 'invoice', run: () => changeType('invoice') },
        { label: 'Cotización', icon: doc.type === 'quote' ? 'check' : 'quote', disabled: doc.type === 'quote' || hasPayments, note: hasPayments ? 'Tiene pagos' : '', run: () => changeType('quote') },
      ]));
      left.append(typeBtn);
    }
    left.append(tag(docStatus(doc)));
    if (locked) {
      left.append(el('span', { class: `${glass} is-lock`, title: 'El cliente lo firmó: el contenido ya no cambia.' }, icon('lock'), 'Firmada'));
      if (who) left.append(el('span', { class: glass }, avatar(who, 'is-sm'), who));
    } else if (doc.type !== 'receipt') {
      const custBtn = el('button', { type: 'button', class: glass, 'aria-label': 'Cliente' }, who ? avatar(who, 'is-sm') : icon('users'), who || 'Elegir cliente', icon('down'));
      custBtn.addEventListener('click', () => picker(custBtn, {
        placeholder: 'Buscar cliente…',
        items: () => [...state.customers].sort((a, b) => a.name.localeCompare(b.name)),
        label: (c) => c.name,
        sub: (c) => c.company || c.email || '',
        onPick: setCustomer,
        extra: el('button', { type: 'button', class: 'ng-pick-new', onclick: () => customerForm(null, setCustomer) }, icon('plus'), 'Nuevo cliente'),
      }));
      const project = doc.projectId && find('projects', doc.projectId);
      const projBtn = state.projects.length > 0 || project ? el('button', { type: 'button', class: glass, 'aria-label': 'Proyecto' }, icon('folder'), project?.name || 'Sin proyecto', icon('down')) : null;
      projBtn?.addEventListener('click', () => picker(projBtn, {
        placeholder: 'Buscar proyecto…',
        // Con cliente elegido, solo sus proyectos.
        items: () => state.projects.filter((p) => !doc.customerId || p.customerId === doc.customerId || p.id === doc.projectId).sort((a, b) => a.name.localeCompare(b.name)),
        label: (p) => p.name || 'Sin nombre',
        sub: (p) => find('customers', p.customerId)?.name || 'Sin cliente',
        onPick: (p) => {
          doc.projectId = p.id;
          const c = !doc.customerId && p.customerId && find('customers', p.customerId);
          if (c) setCustomer(c);
          else {
            touch();
            drawBar();
          }
        },
        extra: doc.projectId ? el('button', { type: 'button', class: 'ng-pick-new', onclick: () => { doc.projectId = ''; touch(); drawBar(); } }, icon('x'), 'Sin proyecto') : null,
      }));
      const curBtn = el('button', { type: 'button', class: glass, 'aria-label': 'Moneda' }, doc.currency, icon('down'));
      curBtn.addEventListener('click', () => menu(curBtn, CURRENCY_CODES.map((k) => ({
        label: `${k} · ${CURRENCIES[k].label}`,
        icon: k === doc.currency ? 'check' : null,
        run: () => { changeCurrency(k); touch(); drawBar(); drawSheet(); },
      }))));
      left.append(...[custBtn, projBtn, curBtn].filter(Boolean));
    }
    left.append(savingNote);

    const { primary, more } = actions();
    const moreBtn = el('button', { type: 'button', class: 'ng-gbtn', 'aria-label': 'Más acciones', title: 'Más acciones' }, icon('more'));
    moreBtn.addEventListener('click', () => menu(moreBtn, more, { align: 'end' }));
    const right = el('div', { class: 'ng-ebar-side is-end' },
      doc.type !== 'receipt' && !locked && el('button', { type: 'button', class: `ng-gbtn${drawer === 'style' ? ' is-on' : ''}`, 'aria-label': 'Personalizar', title: 'Personalizar', 'aria-pressed': String(drawer === 'style'), onclick: () => openDrawer('style') }, icon('palette')),
      doc.type !== 'receipt' && el('button', { type: 'button', class: `ng-gbtn is-wide${drawer === 'share' ? ' is-on' : ''}`, 'aria-pressed': String(drawer === 'share'), onclick: () => openDrawer('share') }, icon('link'), el('span', { text: doc.share?.token ? 'Enlace' : 'Compartir' })),
      doc.type === 'invoice' && el('button', { type: 'button', class: `ng-gbtn${drawer === 'pay' ? ' is-on' : ''}`, 'aria-label': 'Pagos', title: 'Pagos', 'aria-pressed': String(drawer === 'pay'), onclick: () => openDrawer('pay') }, icon('wallet')),
      el('button', { type: 'button', class: 'ng-gbtn is-wide', onclick: printDoc }, icon('printer'), el('span', { text: 'Imprimir o PDF' })),
      moreBtn,
      primary && el('button', { type: 'button', class: 'pill', onclick: primary.run }, icon(primary.icon), primary.label),
    );
    bar.replaceChildren(left, right);
    drawSaving();
  }

  function drawSaving() {
    const { status, message } = saving;
    savingNote.dataset.kind = status;
    if (status === 'error') {
      savingNote.replaceChildren(el('span', { text: message || 'No se guardó.' }), el('button', { type: 'button', text: 'Reintentar', onclick: () => flushNow().catch(() => {}) }));
    } else {
      savingNote.textContent = status === 'saved' ? 'Guardado' : 'Guardando…';
    }
  }

  // ── Paneles laterales ──

  function openDrawer(kind) {
    drawer = drawer === kind ? null : kind;
    drawDrawer();
    drawBar();
  }

  function drawDrawer() {
    aside.hidden = !drawer;
    node.classList.toggle('has-drawer', Boolean(drawer));
    if (!drawer) return;
    const close = iconButton('x', 'Cerrar panel', () => openDrawer(drawer));
    if (drawer === 'style') aside.replaceChildren(el('header', {}, el('h2', {}, icon('palette'), 'Personalizar'), close), stylePanel());
    else if (drawer === 'share') aside.replaceChildren(el('header', {}, el('h2', {}, icon('link'), 'Enlace para el cliente'), close), sharePanel());
    else aside.replaceChildren(el('header', {}, el('h2', {}, icon('wallet'), 'Pagos'), close), payPanel());
  }

  /** El enlace público: crearlo (con contraseña y caducidad opcionales), copiarlo, ver quién lo abrió y desactivarlo. */
  function sharePanel() {
    const box = el('div', { class: 'ng-drawer-body' });
    const s = doc.share;
    const pub = pubOf(doc);
    const word = TITLE[doc.type].toLowerCase();
    if (!doc.number) {
      box.append(el('p', { class: 'ng-hint', text: 'Se puede compartir en cuanto se guarde y tenga número.' }));
      return box;
    }
    if (s?.token) {
      const url = `${location.origin}/documento/#${s.token}`;
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast('Enlace copiado.');
        } catch {
          toast('No se pudo copiar. Selecciónalo y cópialo a mano.', 'error');
        }
      };
      const views = pub?.views || 0;
      box.append(
        el('p', { class: 'ng-card-text', text: `Quien tenga este enlace puede ver la ${word}${isSignable(doc) ? ', aceptarla y firmarla' : ''}. No ve nada más de tu panel.` }),
        el('input', { class: 'ng-share-url', value: url, readOnly: true, 'aria-label': 'Enlace', onfocus: (e) => e.target.select() }),
        el('div', { class: 'ng-head-actions' },
          el('button', { type: 'button', class: 'pill', onclick: copy }, icon('copy'), 'Copiar enlace'),
          el('a', { class: 'pill ghost', href: url, target: '_blank', rel: 'noopener' }, icon('external'), 'Abrir'),
        ),
        el('ul', { class: 'ng-share-facts' },
          el('li', {}, icon('lock'), s.hasPassword ? 'Con contraseña' : 'Sin contraseña'),
          el('li', {}, icon('clock'), s.expiresAt ? `Caduca el ${dateText(new Date(s.expiresAt).toLocaleDateString('en-CA'))}` : 'No caduca'),
          el('li', {}, icon('eye'), views ? `Abierto ${views} ${views === 1 ? 'vez' : 'veces'}; la última, el ${stampText(new Date(pub.lastViewAt || pub.viewedAt).toISOString())}` : 'Todavía no lo ha abierto nadie'),
        ),
        isSignable(doc) && (acceptance(pub, pub?.mode === 'drawn' ? `/api/admin/crm/signature/${doc.id}` : '') || el('p', { class: 'ng-hint', text: 'Esperando respuesta del cliente.' })),
        el('button', {
          type: 'button',
          class: 'pill ghost danger',
          onclick: async () => {
            if (!(await confirmBox('¿Desactivar el enlace? Quien lo tenga ya no podrá abrirlo.', 'Desactivar'))) return;
            try {
              await api(`/crm/share/${s.token}`, { method: 'DELETE' });
              doc.share = null;
              touch();
              drawDrawer();
              drawBar();
              toast('Enlace desactivado.');
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        }, icon('ban'), 'Desactivar enlace'),
      );
      return box;
    }

    const password = input({ type: 'text', maxLength: 100, placeholder: 'Opcional', autocomplete: 'off' });
    let days = 0;
    const create = el('button', { type: 'submit', class: 'pill' }, icon('link'), 'Crear enlace');
    const form = el('form', { class: 'ng-form' },
      el('p', { class: 'ng-card-text', text: `Crea un enlace para que el cliente vea la ${word}${isSignable(doc) ? ', la acepte y la firme' : ' y la pague'} desde su teléfono. Sabrás cuándo la abre.` }),
      field('Contraseña', password, 'Si la pones, envíala aparte. Mínimo 4 caracteres.'),
      el('div', { class: 'ng-field' }, el('span', { text: 'Caducidad' }), seg(SHARE_DAYS, days, (v) => { days = v; }, 'Caducidad del enlace')),
      create,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = password.value.trim();
      if (pass && pass.length < 4) {
        toast('La contraseña necesita al menos 4 caracteres.', 'error');
        return;
      }
      create.disabled = true;
      try {
        await flushNow();
        const share = await api('/crm/share', { method: 'POST', body: { docId: doc.id, password: pass, days } });
        doc.share = share;
        if (doc.status === 'draft') doc.status = 'sent';
        put('docs', doc, { now: true })?.catch(() => {});
        try {
          await navigator.clipboard.writeText(`${location.origin}/documento/#${share.token}`);
          toast('Enlace creado y copiado.');
        } catch {
          toast('Enlace creado.');
        }
        drawDrawer();
        drawBar();
      } catch (err) {
        toast(err.message, 'error');
        create.disabled = false;
      }
    });
    box.append(form);
    return box;
  }

  function stylePanel() {
    const st = doc.style;
    const restyle = (key) => (v) => {
      st[key] = v;
      touch();
      drawSheet();
    };
    const size = el('input', { type: 'range', min: 24, max: 96, step: 2, value: st.logoSize, 'aria-label': 'Tamaño del logo' });
    const sizeOut = el('output', { text: `${st.logoSize} px` });
    size.addEventListener('input', () => {
      st.logoSize = Number(size.value);
      sizeOut.textContent = `${st.logoSize} px`;
      sheet.style.setProperty('--logo', `${st.logoSize}px`);
      touch();
    });
    return el('div', { class: 'ng-drawer-body' },
      el('div', { class: 'ng-field' }, el('span', { text: 'Diseño' }), seg([['bold', 'Titular grande'], ['classic', 'Clásico']], st.layout, restyle('layout'), 'Diseño')),
      el('div', { class: 'ng-field' }, el('span', { text: 'Letra' }), seg(FONTS, st.font, restyle('font'), 'Letra')),
      el('div', { class: 'ng-field' }, el('span', { text: 'Color' }), el('div', { class: 'ng-swatches', role: 'group', 'aria-label': 'Color de acento' },
        Object.entries(ACCENTS).map(([key, color]) => el('button', { type: 'button', class: 'ng-swatch', style: { '--c': color }, 'aria-label': ACCENT_NAMES[key], title: ACCENT_NAMES[key], 'aria-pressed': String(st.accent === key), onclick: () => { restyle('accent')(key); drawDrawer(); } })))),
      el('div', { class: 'ng-field' }, el('span', { text: 'Portada' }), seg([['none', 'Sin portada'], ['sky', 'Cielo'], ['deep', 'Oscura']], st.cover, restyle('cover'), 'Portada')),
      el('div', { class: 'ng-field' }, el('span', {}, 'Tamaño del logo ', sizeOut), size),
      toggle('Firma al pie', doc.signature !== false, (v) => { doc.signature = v; touch(); drawSheet(); }),
      el('button', {
        type: 'button',
        class: 'pill ghost',
        onclick: () => {
          put('settings', { ...state.settings, style: { ...st } });
          toast('Los documentos nuevos saldrán con este estilo.');
        },
      }, icon('check'), 'Usar en los documentos nuevos'),
    );
  }

  function payPanel() {
    const t = totals(doc);
    const cur = doc.currency;
    const box = el('div', { class: 'ng-drawer-body' });
    box.append(el('div', { class: 'ng-paysum' },
      el('div', {}, el('small', { text: 'Total' }), el('b', { text: money(t.total, cur) })),
      el('div', {}, el('small', { text: 'Cobrado' }), el('b', { text: money(t.paid, cur) })),
      el('span', { class: 'ng-bar is-wide' }, el('i', { style: { width: `${t.total ? Math.min(100, (t.paid / t.total) * 100) : 0}%` } })),
      el('div', { class: 'is-row' }, el('small', { text: 'Pendiente' }), el('b', { class: t.due > 0 ? '' : 'is-ok', text: money(t.due, cur) })),
    ));

    if (t.due > 0.004) {
      const amount = input({ value: amountText(t.due), inputmode: 'decimal', 'aria-label': 'Importe' });
      const date = input({ type: 'date', value: todayISO(), 'aria-label': 'Fecha' });
      const methods = [
        ...state.paytemplates.map((tp) => [`tpl:${tp.id}`, tp.name || methodLabel(tp.method)]),
        ...Object.entries(METHODS).map(([k, m]) => [k, m.label]),
      ];
      const method = select(methods, doc.payment?.templateId && state.paytemplates.some((x) => x.id === doc.payment.templateId) ? `tpl:${doc.payment.templateId}` : methods[0][0], { 'aria-label': 'Forma de pago' });
      const note = input({ placeholder: 'Referencia (opcional)', maxLength: 120, 'aria-label': 'Referencia' });
      let makeReceipt = true;
      const submit = el('button', { type: 'submit', class: 'pill' }, icon('dollar'), `Registrar ${money(t.due, cur)}`);
      amount.addEventListener('input', () => {
        submit.lastChild.textContent = `Registrar ${money(parseNum(amount.value), cur)}`;
      });
      const form = el('form', { class: 'ng-form ng-payform' },
        el('h3', { text: 'Nuevo pago' }),
        el('div', { class: 'ng-grid2' }, el('label', { class: 'ng-field' }, el('span', { text: 'Importe' }), amount), el('label', { class: 'ng-field' }, el('span', { text: 'Fecha' }), date)),
        el('label', { class: 'ng-field' }, el('span', { text: 'Forma de pago' }), method),
        el('label', { class: 'ng-field' }, el('span', { text: 'Referencia' }), note),
        toggle('Generar recibo', true, (v) => { makeReceipt = v; }),
        doc.status === 'draft' && el('small', { class: 'ng-hint', text: 'Al registrar un pago, la factura deja de ser borrador.' }),
        submit,
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = round2(parseNum(amount.value));
        if (!(value > 0)) {
          toast('Escribe un importe mayor que cero.', 'error');
          return;
        }
        const tplId = method.value.startsWith('tpl:') ? method.value.slice(4) : '';
        const tpl = tplId && find('paytemplates', tplId);
        const methodText = tpl ? tpl.name || methodLabel(tpl.method) : methodLabel(method.value);
        const payment = { id: uid(), date: date.value || todayISO(), amount: value, method: methodText, note: note.value.trim(), receiptId: '' };
        if (makeReceipt) {
          const receipt = receiptFor(payment, round2(Math.max(0, t.due - value)));
          payment.receiptId = receipt.id;
          put('docs', receipt);
        }
        doc.payments = [...(doc.payments || []), payment];
        if (doc.status === 'draft' || doc.status === 'void') doc.status = 'sent';
        put('docs', doc, { now: true })?.catch(() => {});
        toast(makeReceipt ? 'Pago registrado y recibo creado.' : 'Pago registrado.');
        drawSheet();
        drawBar();
        drawDrawer();
      });
      box.append(form);
    } else if (t.total > 0) {
      box.append(el('p', { class: 'ng-hint is-ok' }, icon('checkCircle'), 'Esta factura está pagada.'));
    }

    const history = [...(doc.payments || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    box.append(el('h3', { text: 'Historial' }), history.length ? el('ul', { class: 'ng-history' }, history.map((p) => {
      const receipt = p.receiptId && find('docs', p.receiptId);
      return el('li', {},
        el('div', {}, el('b', { text: money(p.amount, cur) }), el('small', { text: [dateText(p.date), p.method, p.note].filter(Boolean).join(' · ') })),
        receipt && el('a', { class: 'ng-history-link', href: `#/doc/${receipt.id}`, text: receipt.number || 'Recibo' }),
        iconButton('trash', 'Borrar este pago', async () => {
          const yes = await confirmBox(`¿Borrar el pago de ${money(p.amount, cur)}?${receipt ? ' Su recibo también se borra.' : ''}`, 'Borrar');
          if (!yes) return;
          if (receipt) remove('docs', receipt.id);
          doc.payments = doc.payments.filter((x) => x.id !== p.id);
          touch();
          drawSheet();
          drawBar();
          drawDrawer();
        }),
      );
    })) : el('p', { class: 'ng-hint', text: 'Todavía no hay pagos.' }));
    return box;
  }

  function receiptFor(payment, balanceAfter) {
    return {
      id: uid(),
      type: 'receipt',
      status: 'issued',
      number: '',
      issueDate: payment.date,
      currency: doc.currency,
      equiv: doc.equiv ? { ...doc.equiv } : null,
      customerId: doc.customerId,
      customer: { ...doc.customer },
      from: { ...doc.from },
      items: [{ id: uid(), name: `Pago de la factura ${doc.number || ''}`.trim(), description: payment.note || '', qty: 1, price: payment.amount }],
      invoiceId: doc.id,
      invoiceNumber: doc.number,
      paymentId: payment.id,
      method: payment.method,
      balanceAfter,
      notes: 'Gracias por tu pago.',
      sections: [],
      payments: [],
      signature: doc.signature !== false,
      style: { ...doc.style },
    };
  }

  // ── Arranque y avisos ──

  function rebuild() {
    drawBar();
    drawSheet();
    drawDrawer();
    setTitle();
  }

  const onStatus = () => drawSaving();
  const onSaved = () => {
    if (refs.number && doc.number && refs.number.textContent !== doc.number) {
      refs.number.textContent = doc.number;
      setTitle();
    }
    // Los recibos recién creados ya tienen número: el historial lo enseña, salvo que se esté escribiendo ahí.
    if (drawer === 'pay' && !aside.contains(document.activeElement)) drawDrawer();
  };
  // Si el cliente abre, firma o rechaza mientras esto está abierto, se ve al volver a la pestaña.
  const onPub = () => rebuild();
  bus.addEventListener('status', onStatus);
  bus.addEventListener('saved', onSaved);
  bus.addEventListener('pub', onPub);
  rebuild();

  return {
    node,
    destroy() {
      bus.removeEventListener('status', onStatus);
      bus.removeEventListener('saved', onSaved);
      bus.removeEventListener('pub', onPub);
    },
  };
}
