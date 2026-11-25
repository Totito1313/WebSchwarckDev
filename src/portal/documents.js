// Facturas, cotizaciones, propuestas y recibos que el estudio publica desde Negocio en el
// portal del cliente. Cada uno abre su hoja (/documento/#…) para pagarla o firmarla; el estado
// lo mantiene Negocio. En Inicio sale lo que espera algo del cliente.

import { el, icon, toast, sheet, chip, emptyBox, sectionHead, seg, cap, fDay, dayDate, dueText, ago, confirmSheet } from './kit.js';
import { app, redraw, can, isStudio, has, DOC_TYPE, docState, docWaiting, pendingDocs } from './state.js';

const money = (n, cur = 'USD') => {
  try {
    // Como el resto de la app (es-VE: «USD 450»), con céntimos solo si los hay.
    const v = Number(n) || 0;
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: cur, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${cur} ${(Number(n) || 0).toLocaleString('es', { maximumFractionDigits: 2 })}`;
  }
};
const due = (d) => Math.max(0, (Number(d.total) || 0) - (Number(d.paid) || 0));
const nameOf = (d) => `${DOC_TYPE[d.type]?.[0] || 'Documento'}${d.number ? ` ${d.number}` : ''}`;

export const canSeeDocs = () => has('documents') && can('docs.view');

/** Lo que espera algo del cliente, en Inicio. */
export function docsCard() {
  const list = pendingDocs().sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  if (!list.length) return null;
  const byCur = new Map();
  for (const d of list.filter((x) => x.type === 'invoice')) byCur.set(d.currency, (byCur.get(d.currency) || 0) + due(d));
  const toPay = [...byCur].map(([cur, n]) => money(n, cur)).join(' + ');
  const toSign = list.filter((d) => d.type !== 'invoice').length;
  return el('section', { class: 'cl-sec' },
    sectionHead(isStudio() ? 'Esperando al cliente' : 'Por pagar y por firmar', el('a', { class: 'cl-more', href: '#/documentos' }, 'Documentos', icon('right')),
      [toPay && `${toPay} por pagar`, toSign && `${toSign} ${toSign === 1 ? 'por firmar' : 'por firmar'}`].filter(Boolean).join(' · ')),
    el('div', { class: 'cl-list' }, list.slice(0, 3).map(docRow)),
  );
}

export function documentsPage(tab = 'pendientes') {
  const all = canSeeDocs() ? [...app.data.documents] : [];
  const waiting = all.filter(docWaiting);
  if (!waiting.length && tab === 'pendientes') tab = 'todos';
  const list = (tab === 'pendientes' ? waiting : all).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''));
  const year = String(new Date().getFullYear());
  const paidYear = new Map();
  for (const d of all.filter((x) => x.type === 'invoice' && (x.issue_date || '').startsWith(year))) paidYear.set(d.currency, (paidYear.get(d.currency) || 0) + (Number(d.paid) || 0));
  const node = el('div', { class: 'cl-stack' },
    !has('documents') && emptyBox('file', 'Todavía no disponible', 'Las facturas y propuestas llegan con la próxima actualización del portal.'),
    has('documents') && !all.length && emptyBox('file', 'Sin documentos', isStudio() ? 'Publícalos desde Negocio: en la factura o propuesta, «Compartir» › «Publicar en su portal».' : 'Aquí verás tus facturas, cotizaciones y propuestas, para pagarlas o firmarlas.'),
    all.length > 0 && el('div', { class: 'cl-doc-sum' },
      el('div', {}, el('small', { text: 'Por pagar' }), el('b', { text: summary(waiting.filter((d) => d.type === 'invoice'), due) || '—' })),
      el('div', {}, el('small', { text: `Pagado en ${year}` }), el('b', { text: [...paidYear].map(([c, n]) => money(n, c)).join(' + ') || '—' })),
    ),
    all.length > 0 && seg([['pendientes', 'Pendientes', waiting.length], ['todos', 'Todos', all.length]], tab, (v) => { location.hash = `#/documentos/${v}`; }, { label: 'Qué documentos' }),
    list.length > 0 && el('div', { class: 'cl-list' }, list.map(docRow)),
    tab === 'pendientes' && all.length > 0 && !waiting.length && emptyBox('checkCircle', 'Todo al día', 'No tienes nada por pagar ni por firmar.'),
    isStudio() && all.length > 0 && el('p', { class: 'cl-fine', text: 'El estado se actualiza solo desde Negocio: pagos, aperturas y firmas.' }),
  );
  return { node, title: 'Documentos', sub: 'Facturas, cotizaciones y propuestas' };
}

function summary(list, pick) {
  const byCur = new Map();
  for (const d of list) byCur.set(d.currency, (byCur.get(d.currency) || 0) + pick(d));
  return [...byCur].filter(([, n]) => n > 0).map(([c, n]) => money(n, c)).join(' + ');
}

function docRow(d) {
  const [word, ico, color] = DOC_TYPE[d.type] || DOC_TYPE.invoice;
  const [state, stateColor] = docState(d);
  const when = d.type === 'invoice' && docWaiting(d) && d.due_date ? dueText(d.due_date)[0] : d.issue_date ? cap(fDay.format(dayDate(d.issue_date))) : '';
  const amount = d.type === 'invoice' && d.status === 'partial' ? `${money(due(d), d.currency)} de ${money(d.total, d.currency)}` : money(d.total, d.currency);
  return el('button', { type: 'button', class: 'cl-row cl-doc-row', style: { '--c': color }, onclick: () => openDoc(d) },
    el('span', { class: 'cl-doc-ico' }, icon(ico)),
    el('span', { class: 'cl-set-main' }, el('b', { text: d.title || nameOf(d) }), el('small', { text: [d.title ? d.number || word : word, when].filter(Boolean).join(' · ') })),
    el('span', { class: 'cl-lead-end' }, chip(state, stateColor), el('b', { class: 'cl-lead-value', text: amount })),
  );
}

/** Abre la hoja del documento (para pagar o firmar). */
function openDoc(d) {
  const [word] = DOC_TYPE[d.type] || DOC_TYPE.invoice;
  const [state, color] = docState(d);
  const waiting = docWaiting(d);
  const go = () => {
    if (!d.url) return toast(app.backend.mode === 'demo' ? 'En la demostración no se abre el documento.' : 'Este documento ya no tiene enlace.', 'error');
    window.open(d.url, '_blank', 'noopener');
  };
  let ui;
  ui = sheet(d.title || nameOf(d), el('div', { class: 'cl-detail' },
    el('div', { class: 'cl-chips is-wrap' }, chip(state, color), chip(nameOf(d), DOC_TYPE[d.type]?.[2], DOC_TYPE[d.type]?.[1])),
    el('div', { class: 'cl-doc-total' }, el('small', { text: d.type === 'invoice' && waiting ? 'Por pagar' : 'Total' }), el('b', { text: money(d.type === 'invoice' && waiting ? due(d) : d.total, d.currency) }), d.status === 'partial' && el('small', { text: `Pagado: ${money(d.paid, d.currency)} de ${money(d.total, d.currency)}` })),
    d.issue_date && el('div', { class: 'cl-when' }, icon('calendar'), el('b', { text: `Emitida el ${fDay.format(dayDate(d.issue_date))}` })),
    d.due_date && d.type !== 'receipt' && el('div', { class: 'cl-when' }, icon('clock'), el('b', { text: d.type === 'invoice' ? (docWaiting(d) ? dueText(d.due_date)[0] : `Vencía el ${fDay.format(dayDate(d.due_date))}`) : `Válida hasta el ${fDay.format(dayDate(d.due_date))}` })),
    d.locked && el('p', { class: 'cl-note-box' }, icon('lock'), 'Tiene contraseña: te la dimos aparte.'),
    el('small', { class: 'cl-fine', text: `Publicada ${ago(d.created_at)}${d.updated_at && d.updated_at !== d.created_at ? ` · actualizada ${ago(d.updated_at)}` : ''}` }),
  ), {
    actions: [
      isStudio() && el('button', { type: 'button', class: 'cl-btn ghost is-danger', onclick: async () => {
        if (!(await confirmSheet('¿Quitarlo del portal?', { yes: 'Quitar', danger: true, message: 'El documento sigue en Negocio y su enlace sigue valiendo.' }))) return;
        try {
          await app.backend.remove('documents', d.id);
          app.data.documents = app.data.documents.filter((x) => x.id !== d.id);
          ui.close();
          toast('Quitado del portal.', 'ok');
          redraw();
        } catch (err) {
          toast(err.message, 'error');
        }
      } }, 'Quitar'),
      el('button', { type: 'button', class: 'cl-btn', onclick: go }, icon(waiting ? (d.type === 'invoice' ? 'dollar' : 'edit') : 'external'), waiting && !isStudio() ? (d.type === 'invoice' ? 'Ver y pagar' : `Ver y firmar la ${word.toLowerCase()}`) : 'Abrir'),
    ].filter(Boolean),
  });
}
