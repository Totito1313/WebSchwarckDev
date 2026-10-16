// Negocio: la hoja de un documento, solo para leer.
//
// La usan la página pública (lo que abre el cliente con el enlace) y el editor
// cuando el documento ya está firmado y no se puede cambiar. Es la misma hoja
// que se edita en el panel, con texto en vez de campos.

import { totals, money, amountText, numText, dateText, round2, strongest, unitName, safeLink, qr, el, icon, DEFAULT_STYLE } from './negocio-core.js';
import { renderBlocks } from './negocio-propuesta.js';

export const ACCENTS = { ink: '#16181b', cyan: '#0096b0', blue: '#0071bc', green: '#1f9d46', violet: '#7c4dc9', orange: '#e0620c' };
export const DOC_TITLE = { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo', proposal: 'Propuesta' };

const dfStamp = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const stampText = (iso) => (iso ? dfStamp.format(new Date(iso)) : '');

const lines = (...values) => values.filter(Boolean).flatMap((v) => String(v).split('\n')).map((text) => el('span', { class: 'sh-line', text }));
const label = (text) => el('span', { class: 'sh-label', text });

/** Firma o rechazo del cliente, con fecha y hora. */
export function acceptance(response, drawnSrc) {
  if (response?.acceptedAt) {
    return el('section', { class: 'sh-accept is-ok' },
      el('span', { class: 'sh-label', text: 'Aceptado y firmado' }),
      drawnSrc ? el('img', { class: 'sh-accept-drawn', src: drawnSrc, alt: `Firma de ${response.name}` }) : el('span', { class: 'sh-accept-typed', text: response.name }),
      el('small', { text: `${response.name} · ${stampText(response.acceptedAt)}` }),
    );
  }
  if (response?.declinedAt) {
    return el('section', { class: 'sh-accept is-no' },
      el('span', { class: 'sh-label', text: 'Rechazado' }),
      el('small', { text: `El ${stampText(response.declinedAt)}` }),
    );
  }
  return null;
}

export function renderSheet(doc, { logo = '', response = null, drawnSrc = '' } = {}) {
  const st = { ...DEFAULT_STYLE, ...doc.style };
  const sheet = el('article', { class: 'ng-sheet is-static', data: { layout: st.layout, font: st.font, cover: st.cover, type: doc.type } });
  sheet.style.setProperty('--accent', ACCENTS[st.accent] || ACCENTS.ink);
  sheet.style.setProperty('--logo', `${Math.max(20, Math.min(120, Number(st.logoSize) || 44))}px`);
  const cur = doc.currency;
  const t = totals(doc);
  const f = doc.from || {};
  const c = doc.customer || {};

  const itemsTable = () => el('section', { class: 'sh-items' },
    el('div', { class: 'sh-items-head' }, el('span', { text: doc.type === 'receipt' ? 'Concepto' : 'Descripción' }), el('span', { text: doc.type === 'receipt' ? '' : 'Cant.' }), el('span', { text: doc.type === 'receipt' ? '' : 'Precio' }), el('span', { text: 'Importe' })),
    (doc.items || []).filter((it) => it.name || it.price).map((it) => el('div', { class: 'sh-item' },
      el('div', { class: `sh-item-desc${it.image ? ' has-media' : ''}` },
        it.image && el('div', { class: 'sh-item-media' }, el('img', { src: it.image, alt: '' })),
        el('div', { class: 'sh-item-fields' }, el('span', { class: 'sh-line is-strong', text: it.name }), it.description && el('span', { class: 'sh-line is-soft', text: it.description })),
      ),
      el('span', { class: 'sh-num', text: doc.type === 'receipt' ? '' : numText(it.qty) }),
      el('span', { class: 'sh-num', text: doc.type === 'receipt' ? '' : amountText(it.price) }),
      el('span', { class: 'sh-amount', text: money((Number(it.qty) || 0) * (Number(it.price) || 0), cur) }),
    )),
  );

  const row = (text, value, cls = '') => el('div', { class: `sh-row ${cls}`.trim() }, el('span', { text }), el('b', { text: value }));
  const totalsBox = () => {
    const box = el('div', { class: 'sh-totals' });
    if (doc.type !== 'receipt') box.append(row('Subtotal', money(t.subtotal, cur)));
    if (doc.discount) box.append(row(doc.discount.type === 'amount' ? 'Descuento' : `Descuento ${numText(doc.discount.value)}%`, money(-t.discount, cur)));
    if (doc.tax) box.append(row(`${doc.tax.label || 'Impuesto'} ${numText(doc.tax.rate)}%`, money(t.tax, cur)));
    if (doc.withholding) box.append(row(`Retención ${numText(doc.withholding.rate)}% ${doc.withholding.on === 'tax' ? 'del impuesto' : 'de la base'}`, money(-t.withholding, cur)));
    if (doc.shipping) box.append(row(doc.shipping.label || 'Otro cargo', money(t.shipping, cur)));
    box.append(el('div', { class: 'sh-grand' }, el('span', { text: doc.type === 'receipt' ? 'Total recibido' : 'Total' }), el('b', { text: money(t.total, cur) })));
    const e = doc.equiv;
    if (e?.rate > 0) {
      const strong = strongest(cur, e.currency);
      const v = strong === cur ? t.total * e.rate : t.total / e.rate;
      box.append(el('div', { class: 'sh-equiv' },
        row('Equivale a', money(round2(v), e.currency)),
        el('div', { class: 'sh-rate', text: `1 ${unitName(strong)} = ${numText(e.rate)} ${unitName(strong === cur ? e.currency : cur)} · ${e.source || ''}, ${dateText(e.date || doc.issueDate)}` }),
      ));
    }
    if (doc.type === 'invoice' && t.paid > 0) box.append(row('Pagado', money(-t.paid, cur), 'is-soft'), row('Saldo pendiente', money(t.due, cur), 'sh-due'));
    if (doc.signature !== false && (f.signature || f.name)) {
      box.append(el('div', { class: 'sh-sign' }, el('span', { class: 'sh-sign-name', text: f.signature || f.name }), el('small', { text: f.name || '' })));
    }
    return box;
  };

  const payBox = () => {
    if (doc.type === 'receipt') {
      return el('div', { class: 'sh-pay' },
        label('Forma de pago'), el('b', { class: 'sh-static', text: doc.method || 'Sin indicar' }),
        doc.balanceAfter != null && [label('Saldo pendiente de la factura'), el('span', { class: 'sh-static', text: money(doc.balanceAfter, cur) })],
      );
    }
    const p = doc.payment;
    if (!p) return el('div', { class: 'sh-pay' });
    // Anulada o ya pagada: sin QR ni botón para pagar.
    const link = doc.status === 'void' || (doc.type === 'invoice' && totals(doc).due <= 0.004) ? '' : safeLink(p.link);
    return el('div', { class: 'sh-pay' },
      label('Datos de pago'),
      p.name && el('b', { class: 'sh-static', text: p.name }),
      (p.fields || []).length > 0 && el('dl', { class: 'sh-kv is-static' }, p.fields.filter((x) => x.value).map((x) => el('div', {}, el('dt', { text: x.label }), el('dd', { text: x.value })))),
      link && el('div', { class: 'sh-qr-box' },
        el('div', { class: 'sh-qr' }, qr(link)),
        el('div', { class: 'sh-qr-text' }, el('b', { text: 'Escanea para pagar' }), el('a', { class: 'sh-paybtn', href: link, target: '_blank', rel: 'noopener' }, 'Pagar en línea', icon('external')), el('small', { class: 'print-only', text: link })),
      ),
    );
  };

  const parties = el('section', { class: 'sh-parties' },
    el('div', { class: 'sh-party' }, label('De'), lines(f.name).map((n) => (n.classList.add('is-strong'), n)), lines(f.taxId, f.email, f.phone, f.website, f.address)),
    el('div', { class: 'sh-party' }, label(doc.type === 'invoice' ? 'Facturar a' : doc.type === 'receipt' ? 'Recibido de' : 'Preparada para'), lines(c.name).map((n) => (n.classList.add('is-strong'), n)), lines(c.company, c.taxId, c.email, c.phone, c.address)),
    el('div', { class: 'sh-dates' },
      label(doc.type === 'receipt' ? 'Fecha del pago' : 'Emisión'), el('span', { class: 'sh-line', text: dateText(doc.issueDate) }),
      doc.type === 'invoice' && doc.dueDate && [label('Vence'), el('span', { class: 'sh-line', text: dateText(doc.dueDate) })],
      (doc.type === 'quote' || doc.type === 'proposal') && doc.validUntil && [label('Válida hasta'), el('span', { class: 'sh-line', text: dateText(doc.validUntil) })],
      doc.type === 'receipt' && doc.invoiceNumber && [label('Factura'), el('span', { class: 'sh-line', text: doc.invoiceNumber })],
    ),
  );

  const isProposal = doc.type === 'proposal';
  const content = isProposal
    ? renderBlocks(doc, { pricing: () => [itemsTable(), el('div', { class: 'sh-foot' }, payBox(), totalsBox())] })
    : [itemsTable(), el('div', { class: 'sh-foot' }, payBox(), totalsBox())];

  sheet.append(...[
    st.cover !== 'none' && el('div', { class: 'sh-cover', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    el('div', { class: 'sh-body' },
      el('header', { class: 'sh-top' },
        logo ? el('img', { class: 'sh-logo', src: logo, alt: f.name || '' }) : el('span', { class: 'sh-logo is-empty' }),
        el('span', { class: 'sh-num' }, el('span', { class: 'sh-hash', text: '#' }), el('span', { text: doc.number || '' })),
      ),
      el('h1', { class: `sh-title${isProposal ? ' is-proposal' : ''}`, text: isProposal ? doc.title || 'Propuesta' : DOC_TITLE[doc.type] || '' }),
      parties,
      content,
      doc.notes && el('p', { class: 'sh-notes sh-static-p', text: doc.notes }),
      (doc.sections || []).filter((s) => s.title || s.body).length > 0 && el('section', { class: 'sh-sections' }, doc.sections.filter((s) => s.title || s.body).map((s) => el('div', { class: 'sh-section' },
        s.title && el('span', { class: 'sh-section-title', text: s.title }),
        s.body && el('p', { class: 'sh-static-p', text: s.body }),
      ))),
      acceptance(response, drawnSrc),
    ),
  ].filter(Boolean));
  return sheet;
}
