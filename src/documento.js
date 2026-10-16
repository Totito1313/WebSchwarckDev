// Página pública de un documento: lo que abre el cliente con el enlace.
//
// El token va después de # en la dirección (/documento/#token): así no viaja
// en los registros de ningún servidor ni en la cabecera Referer. Desde aquí se
// lee el documento y, si es una cotización o una propuesta, se acepta y se firma.

import { initTheme } from './theme.js';
import { el, icon, toast, totals, dateText, safeLink, seg, todayISO } from './negocio-core.js';
import { renderSheet, DOC_TITLE } from './negocio-sheet.js';

initTheme();

const app = document.querySelector('[data-app]');
const token = location.hash.slice(1);
// Abierto por el dueño desde su panel («Abrir»): no cuenta como visita del cliente.
const own = new URLSearchParams(location.search).get('vista') === 'panel';
let password = '';

async function call(action = '', body = {}) {
  const res = await fetch(`/api/public/doc/${token}${action ? `/${action}` : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, password, ...(own && !action ? { own: true } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function card(...kids) {
  return el('section', { class: 'dc-gate' }, el('div', { class: 'ng-gate-card' }, kids));
}

function gone(text) {
  document.title = 'Documento no disponible';
  app.replaceChildren(card(
    el('span', { class: 'dc-gate-ico' }, icon('link')),
    el('h1', { text: 'Este enlace no está disponible' }),
    el('p', { text }),
  ));
}

function gate(error = '') {
  document.title = 'Documento protegido';
  const box = el('input', { type: 'password', autocomplete: 'off', required: true, 'aria-label': 'Contraseña' });
  const msg = el('p', { class: 'ng-msg', role: 'status', text: error, data: { kind: error ? 'error' : '' } });
  const form = el('form', { class: 'ng-form' },
    el('label', { class: 'ng-field' }, el('span', { text: 'Contraseña' }), box),
    el('button', { type: 'submit', class: 'pill lg', text: 'Ver el documento' }),
    msg,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    password = box.value;
    msg.textContent = 'Comprobando…';
    load();
  });
  app.replaceChildren(card(
    el('span', { class: 'dc-gate-ico' }, icon('lock')),
    el('h1', { text: 'Documento protegido' }),
    el('p', { text: 'Escribe la contraseña que te dieron junto con el enlace.' }),
    form,
  ));
  box.focus();
}

/** Estado en palabras para la barra: lo que el cliente necesita saber. */
function statusOf(doc, response) {
  if (response.acceptedAt) return ['Aceptada', 'var(--income)'];
  if (response.declinedAt) return ['Rechazada', 'var(--expense)'];
  if (doc.status === 'void') return ['Anulada', 'var(--body)'];
  if (doc.status === 'declined') return ['Ya no está vigente', 'var(--body)'];
  if (doc.type === 'invoice') {
    const t = totals(doc);
    if (t.total > 0 && t.paid >= t.total - 0.005) return ['Pagada', 'var(--income)'];
    if (doc.dueDate && doc.dueDate < todayISO()) return ['Vencida', 'var(--expense)'];
    return [t.paid > 0 ? 'Pago parcial' : 'Pendiente de pago', 'var(--usdt)'];
  }
  if (doc.type === 'receipt') return ['Pago recibido', 'var(--income)'];
  if (doc.validUntil && doc.validUntil < todayISO()) return ['Vencida', 'var(--bs)'];
  return ['Esperando tu respuesta', 'var(--blue)'];
}

// ── Firma ──

function signPad() {
  const canvas = el('canvas', { class: 'dc-pad', 'aria-label': 'Espacio para dibujar la firma' });
  let ink = false;
  let drawing = false;
  const ctx = canvas.getContext('2d');
  // Cambiar el tamaño del lienzo lo borra. En el móvil, abrir o cerrar el teclado
  // dispara `resize` sin cambiar el ancho: solo se rehace si cambia de verdad, y
  // lo dibujado se copia al lienzo nuevo.
  let width = 0;
  const pen = () => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#16181b';
  };
  const fit = (keep = true) => {
    const r = canvas.getBoundingClientRect();
    if (keep && Math.round(r.width) === width) return;
    width = Math.round(r.width);
    const ratio = Math.max(1, devicePixelRatio || 1);
    const old = keep && ink && canvas.width ? Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height }) : null;
    old?.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = Math.round(r.width * ratio);
    canvas.height = Math.round(r.height * ratio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (old) ctx.drawImage(old, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen();
    if (!old) ink = false;
  };
  const wipe = () => {
    width = 0;
    fit(false);
  };
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(...at(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    ctx.lineTo(...at(e));
    ctx.stroke();
    ink = true;
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  requestAnimationFrame(() => fit(false));
  addEventListener('resize', () => fit());
  return {
    canvas,
    clear: wipe,
    hasInk: () => ink,
    /** La firma se guarda a tamaño de pantalla, sin fondo: así pesa poco. */
    image() {
      const r = canvas.getBoundingClientRect();
      const out = Object.assign(document.createElement('canvas'), { width: Math.round(r.width), height: Math.round(r.height) });
      out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    },
  };
}

function signCard(doc) {
  const word = doc.type === 'proposal' ? 'propuesta' : 'cotización';
  let mode = 'typed';
  const name = el('input', { type: 'text', autocomplete: 'name', maxLength: 80, required: true, placeholder: 'Tu nombre y apellido', 'aria-label': 'Tu nombre completo' });
  const typed = el('div', { class: 'dc-typed', 'aria-hidden': 'true', text: 'Tu firma' });
  name.addEventListener('input', () => { typed.textContent = name.value.trim() || 'Tu firma'; });
  const pad = signPad();
  const padBox = el('div', { class: 'dc-padbox', hidden: true }, pad.canvas, el('button', { type: 'button', class: 'pill ghost sm', text: 'Borrar', onclick: () => pad.clear() }));
  const agree = el('input', { type: 'checkbox' });
  const msg = el('p', { class: 'ng-msg', role: 'status' });
  const say = (text, kind = '') => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };

  const accept = el('button', { type: 'submit', class: 'pill lg' }, icon('pen'), 'Aceptar y firmar');
  const form = el('form', { class: 'dc-sign-form' },
    el('div', { class: 'ng-field' }, el('span', { text: 'Cómo quieres firmar' }), seg([['typed', 'Escribir mi nombre'], ['drawn', 'Dibujar mi firma']], mode, (v) => {
      mode = v;
      typed.hidden = v !== 'typed';
      padBox.hidden = v !== 'drawn';
      if (v === 'drawn') requestAnimationFrame(() => pad.clear());
    }, 'Forma de firmar')),
    el('label', { class: 'ng-field' }, el('span', { text: 'Nombre completo' }), name),
    typed,
    padBox,
    el('label', { class: 'dc-agree' }, agree, el('span', { text: `He leído esta ${word} y la acepto con sus condiciones.` })),
    el('div', { class: 'dc-sign-actions' }, accept, el('button', { type: 'button', class: 'pill ghost', text: 'Rechazar', onclick: () => declineBox.hidden = !declineBox.hidden })),
    msg,
  );
  const reason = el('textarea', { rows: 3, maxLength: 160, placeholder: 'Si quieres, cuéntanos por qué (opcional).', 'aria-label': 'Motivo del rechazo' });
  const declineBox = el('div', { class: 'dc-decline', hidden: true },
    el('label', { class: 'ng-field' }, el('span', { text: 'Motivo' }), reason),
    el('button', {
      type: 'button',
      class: 'pill ghost danger',
      text: `Rechazar la ${word}`,
      onclick: async () => {
        say('Enviando…');
        const { ok, data } = await call('decline', { reason: reason.value });
        if (!ok) return say(data.error || 'No se pudo enviar.', 'error');
        toast('Gracias. Hemos avisado de tu respuesta.');
        load();
      },
    }),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (name.value.trim().length < 2) return say('Escribe tu nombre completo.', 'error');
    if (mode === 'drawn' && !pad.hasInk()) return say('Dibuja tu firma en el recuadro.', 'error');
    if (!agree.checked) return say('Marca la casilla para aceptar.', 'error');
    accept.disabled = true;
    say('Firmando…');
    const { ok, data } = await call('accept', { name: name.value, mode, agree: true, image: mode === 'drawn' ? pad.image() : undefined });
    accept.disabled = false;
    if (!ok) return say(data.error || 'No se pudo firmar. Inténtalo de nuevo.', 'error');
    toast('Firmado. ¡Gracias!');
    load();
  });

  return el('section', { class: 'dc-sign no-print' },
    el('header', {}, el('h2', { text: `¿Te parece bien? Acepta la ${word}` }), el('p', { text: `Firma aquí y quedará registrado con la fecha y la hora. Validez hasta el ${dateText(doc.validUntil) || 'cierre del acuerdo'}.` })),
    form,
    declineBox,
  );
}

// ── La página ──

function render({ doc, business, response, drawn }) {
  const title = `${DOC_TITLE[doc.type] || 'Documento'} ${doc.number || ''}`.trim();
  document.title = [doc.type === 'proposal' && doc.title ? doc.title : title, business.name].filter(Boolean).join(' · ');
  const [statusText, statusColor] = statusOf(doc, response);
  // Una factura anulada no se cobra, y lo anulado o rechazado ya no se firma.
  const closed = doc.status === 'void' || doc.status === 'declined';
  const link = doc.type === 'invoice' && !closed && totals(doc).due > 0.004 ? safeLink(doc.payment?.link) : '';
  const signable = (doc.type === 'quote' || doc.type === 'proposal') && !closed && !response.acceptedAt && !response.declinedAt && !(doc.validUntil && doc.validUntil < todayISO());

  const brand = el('span', { class: 'ng-gchip dc-brand' },
    business.logo && el('img', { src: business.logo, alt: '' }),
    el('span', { text: business.name || 'Documento' }),
  );
  const bar = el('header', { class: 'ng-ebar dc-bar' },
    el('div', { class: 'ng-ebar-side' }, brand, el('span', { class: 'ng-gchip', text: title }), el('span', { class: 'ng-tag', style: { '--c': statusColor }, text: statusText })),
    el('div', { class: 'ng-ebar-side is-end' },
      el('button', { type: 'button', class: 'ng-gbtn is-wide', onclick: () => print() }, icon('printer'), el('span', { text: 'Imprimir o PDF' })),
      link && el('a', { class: 'pill', href: link, target: '_blank', rel: 'noopener' }, icon('dollar'), 'Pagar en línea'),
    ),
  );

  app.replaceChildren(el('div', { class: 'ng-canvas dc-canvas' },
    el('div', { class: 'ng-sky', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    bar,
    el('div', { class: 'ng-stage' }, el('div', { class: 'ng-sheet-wrap' }, renderSheet(doc, { logo: business.logo, response, drawnSrc: drawn || '' }))),
    signable && signCard(doc),
    el('p', { class: 'dc-foot no-print', text: 'Documento enviado con el panel de Schwarck Developer.' }),
  ));
}

async function load() {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    gone('La dirección está incompleta. Copia el enlace entero desde el mensaje que recibiste.');
    return;
  }
  let res;
  try {
    res = await call();
  } catch {
    gone('No se pudo conectar. Revisa tu conexión y recarga la página.');
    return;
  }
  const { ok, status, data } = res;
  if (status === 401 && data.needsPassword) {
    gate(data.error || '');
    return;
  }
  if (!ok) {
    gone(data.error || 'Pide un enlace nuevo a quien te lo envió.');
    return;
  }
  render(data);
}

addEventListener('hashchange', () => location.reload());
load();
