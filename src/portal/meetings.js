// Reuniones: el cliente pide una (tema, modalidad y hasta tres horarios que le vienen bien) y
// el estudio la confirma con uno de ellos, propone otra hora o dice que no puede. El estudio
// también agenda directamente. La próxima sale en Inicio, con «Unirse» y «Añadir al calendario».

import { el, fill, icon, toast, sheet, actionSheet, confirmSheet, field, input, textarea, seg, chip, emptyBox, sectionHead, cap, fDay, fTime, ago, burst } from './kit.js';
import { react } from './feel.js';
import { app, redraw, upsertLocal, can, isStudio, isMine, myName, MEETING_MODE, MEETING_STATUS, nextMeeting, has } from './state.js';
import { formSheet, localInput } from './studio.js';
import { taskButton } from './negocio-link.js';

const DURATIONS = [[30, '30 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30']];
const whenText = (iso) => `${cap(fDay.format(new Date(iso)))} · ${fTime.format(new Date(iso))}`;
const endOf = (m) => new Date(new Date(m.starts_at).getTime() + (m.duration || 30) * 60_000);
const isPast = (m) => m.starts_at && endOf(m) < new Date();
const isLive = (m) => m.starts_at && new Date(m.starts_at) <= new Date() && !isPast(m);
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

export const canRequest = () => has('meetings') && !isStudio() && can('meetings.request');

// ── Inicio ──

/** La próxima reunión (o la pedida que espera respuesta). Al estudio también, con lo pedido. */
export function meetingCard() {
  if (!has('meetings')) return null;
  const next = nextMeeting();
  const asked = app.data.meetings.filter((m) => m.status === 'requested' && (isStudio() || isMine(m)));
  if (!next && !asked.length) return null;
  if (!next) {
    const m = asked[0];
    return el('a', { class: 'cl-card cl-meet-card is-asked', href: '#/reuniones' },
      el('span', { class: 'cl-meet-ico' }, icon('calendar')),
      el('span', { class: 'cl-set-main' },
        el('small', { class: 'cl-eyebrow', text: isStudio() ? `${m.author || 'El cliente'} pide una reunión` : 'Pediste una reunión' }),
        el('b', { text: m.topic }),
        el('small', { text: isStudio() ? `${m.options.length} ${m.options.length === 1 ? 'horario propuesto' : 'horarios propuestos'} · toca para confirmar` : 'Esperando que Schwarck confirme la hora' }),
      ),
      icon('right', 'cl-set-chev'),
    );
  }
  const live = isLive(next);
  const d = new Date(next.starts_at);
  return el('article', { class: `cl-card cl-meet-card${live ? ' is-live' : ''}` },
    el('a', { class: 'cl-meet-head', href: '#/reuniones' },
      el('span', { class: 'cl-meet-date' }, el('small', { text: d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '') }), el('b', { text: String(d.getDate()) })),
      el('span', { class: 'cl-set-main' },
        el('small', { class: 'cl-eyebrow', text: live ? 'Ahora' : 'Próxima reunión' }),
        el('b', { text: next.topic }),
        el('small', {}, icon(MEETING_MODE[next.mode]?.[1] || 'calendar'), `${fTime.format(d)} · ${MEETING_MODE[next.mode]?.[0] || ''} · ${next.duration} min`),
      ),
    ),
    el('div', { class: 'cl-meet-actions' },
      next.link && el('a', { class: 'cl-btn sm', href: next.link, target: '_blank', rel: 'noopener' }, icon(next.mode === 'call' ? 'call' : 'play'), live ? 'Unirse ahora' : 'Enlace'),
      el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => downloadIcs(next) }, icon('calendar'), 'Añadir al calendario'),
    ),
  );
}

// ── La pantalla ──

export function meetingsPage() {
  const all = has('meetings') ? [...app.data.meetings] : [];
  const upcoming = all.filter((m) => m.status === 'confirmed' && !isPast(m)).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const asked = all.filter((m) => m.status === 'requested').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const past = all.filter((m) => !upcoming.includes(m) && !asked.includes(m)).sort((a, b) => new Date(b.starts_at || b.created_at) - new Date(a.starts_at || a.created_at));
  const action = isStudio()
    ? el('button', { type: 'button', class: 'cl-btn', onclick: () => editMeeting() }, icon('plus'), 'Agendar reunión')
    : canRequest() && el('button', { type: 'button', class: 'cl-btn', onclick: requestMeeting }, icon('calendar'), 'Pedir una reunión');
  const node = el('div', { class: 'cl-stack' },
    action && el('div', { class: 'cl-row-actions' }, action),
    !has('meetings') && emptyBox('calendar', 'Todavía no disponible', 'Las reuniones llegan con la próxima actualización del portal.'),
    has('meetings') && !all.length && emptyBox('calendar', 'Sin reuniones', isStudio() ? 'Agenda una o espera a que el cliente pida la suya.' : 'Cuando quieras hablar con el equipo, pide una reunión con los horarios que te vienen bien.'),
    asked.length > 0 && el('section', { class: 'cl-sec' }, sectionHead(isStudio() ? 'Por confirmar' : 'Pedidas', null, isStudio() ? 'Elige uno de sus horarios o propón otro' : 'Te avisamos cuando confirmemos la hora'), el('div', { class: 'cl-list' }, asked.map(meetingRow))),
    upcoming.length > 0 && el('section', { class: 'cl-sec' }, sectionHead('Próximas'), el('div', { class: 'cl-list' }, upcoming.map(meetingRow))),
    past.length > 0 && el('section', { class: 'cl-sec' }, sectionHead('Anteriores'), el('div', { class: 'cl-list' }, past.slice(0, 20).map(meetingRow))),
  );
  return { node, title: 'Reuniones', sub: isStudio() ? `Con ${app.client.name}` : 'Para hablar con el equipo de Schwarck' };
}

function meetingRow(m) {
  const [state, color] = MEETING_STATUS[m.status] || MEETING_STATUS.requested;
  const when = m.starts_at ? `${new Date(m.starts_at).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${fTime.format(new Date(m.starts_at))}` : m.options?.length ? `Propone ${m.options.length === 1 ? 'un horario' : `${m.options.length} horarios`}` : '';
  const d = m.starts_at ? new Date(m.starts_at) : null;
  return el('button', { type: 'button', class: `cl-row cl-meet-row is-${m.status}`, style: { '--c': color }, onclick: () => (isStudio() ? studioMeeting(m) : meetingSheet(m)) },
    d ? el('span', { class: 'cl-date-tile' }, el('small', { text: d.toLocaleDateString('es', { month: 'short' }).replace('.', '') }), el('b', { text: String(d.getDate()) })) : el('span', { class: 'cl-meet-ico' }, icon('calendar')),
    el('span', { class: 'cl-set-main' },
      el('b', { text: m.topic }),
      el('small', {}, icon(MEETING_MODE[m.mode]?.[1] || 'calendar'), [when, m.origin === 'client' && isStudio() ? m.author : null].filter(Boolean).join(' · ')),
    ),
    chip(state, color),
  );
}

// ── El cliente ──

/** Ver una reunión: cuándo, cómo, el enlace; cancelar la suya. */
function meetingSheet(m) {
  let ui;
  const [state, color] = MEETING_STATUS[m.status] || MEETING_STATUS.requested;
  const mine = isMine(m) && ['requested', 'confirmed'].includes(m.status) && !isPast(m);
  ui = sheet(m.topic, el('div', { class: 'cl-detail' },
    el('div', { class: 'cl-chips is-wrap' }, chip(state, color), chip(MEETING_MODE[m.mode]?.[0] || 'Reunión', 'var(--cf-blue)', MEETING_MODE[m.mode]?.[1]), chip(`${m.duration} min`, 'var(--cf-fg-faint)', 'clock')),
    m.starts_at && el('div', { class: 'cl-when' }, icon('calendar'), el('b', { text: whenText(m.starts_at) })),
    !m.starts_at && m.options?.length > 0 && el('div', { class: 'cl-meet-options' }, el('small', { text: 'Los horarios que propusiste' }), m.options.map((o) => el('span', { class: 'cl-meet-option' }, icon('clock'), whenText(o)))),
    m.place && el('div', { class: 'cl-when' }, icon('pin'), el('b', { text: m.place })),
    m.notes && el('p', { class: 'cl-note-box' }, icon('doc'), m.notes),
    m.studio_note && el('p', { class: 'cl-note-box is-studio' }, icon('chat'), m.studio_note),
    el('small', { class: 'cl-fine', text: m.origin === 'client' ? `La pidió ${isMine(m) ? 'tú' : m.author || 'tu equipo'} ${ago(m.created_at)}` : `La agendó Schwarck ${ago(m.created_at)}` }),
  ), {
    actions: [
      mine && el('button', { type: 'button', class: 'cl-btn ghost is-danger', onclick: async () => {
        if (!(await confirmSheet('¿Cancelar la reunión?', { yes: 'Cancelar la reunión', danger: true, message: 'Avisaremos al equipo.' }))) return;
        try {
          upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'cancelled' }));
          ui.close();
          toast('Reunión cancelada.', 'ok');
          redraw();
        } catch (err) {
          toast(err.message, 'error');
        }
      } }, 'Cancelar'),
      m.status === 'confirmed' && !isPast(m) && el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => downloadIcs(m) }, icon('calendar'), 'Al calendario'),
      m.status === 'confirmed' && m.link && !isPast(m) && el('a', { class: 'cl-btn', href: m.link, target: '_blank', rel: 'noopener' }, icon('play'), 'Unirse'),
    ].filter(Boolean),
  });
}

/** Pedir una reunión: tema, modalidad, duración y hasta tres horarios. */
export function requestMeeting() {
  if (!canRequest()) return toast('Tu cuenta no puede pedir reuniones.', 'error');
  let mode = remember('portal:meet-mode') || 'video';
  let duration = 30;
  const topic = input({ maxLength: 200, placeholder: 'Ideas para la campaña de Navidad' });
  const notes = textarea({ maxLength: 2000, rows: 3, placeholder: 'Qué quieres tratar (opcional)' });
  // Por defecto: mañana a las 10 y pasado mañana a las 16, sin fines de semana.
  const workday = (n, hour) => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    let added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    return d.toISOString();
  };
  const slots = [workday(1, 10), workday(2, 16), ''];
  const slotBox = el('div', { class: 'cl-meet-slots' });
  const drawSlots = () => fill(slotBox, slots.map((v, i) => el('label', { class: 'cl-meet-slot' },
    el('span', { text: `Opción ${i + 1}` }),
    el('input', { type: 'datetime-local', class: 'cl-input', value: v ? localInput(v) : '', step: 900, oninput: (e) => { slots[i] = e.target.value ? new Date(e.target.value).toISOString() : ''; } }),
  )));
  drawSlots();
  formSheet('Pedir una reunión', [
    el('p', { class: 'cl-form-hint', text: 'Propón hasta tres horarios que te vengan bien: confirmamos uno y te avisamos.' }),
    field('Tema', topic),
    field('Cómo', seg(Object.entries(MEETING_MODE).map(([k, [l]]) => [k, l]), mode, (v) => { mode = v; }, { small: true })),
    field('Duración', seg(DURATIONS, duration, (v) => { duration = v; }, { small: true })),
    field('Horarios', slotBox),
    field('Notas', notes),
  ], async () => {
    if (!topic.value.trim()) {
      topic.focus();
      toast('Escribe de qué quieres hablar.', 'error');
      return false;
    }
    const options = [...new Set(slots.filter(Boolean))].filter((iso) => new Date(iso) > new Date()).sort();
    if (!options.length) {
      toast('Propón al menos un horario que no haya pasado.', 'error');
      return false;
    }
    remember('portal:meet-mode', mode);
    const row = await app.backend.save('meetings', { client_id: app.client.id, topic: topic.value.trim(), notes: notes.value.trim() || null, mode, duration, options, origin: 'client', status: 'requested', created_by: app.user?.id, author: myName() });
    upsertLocal('meetings', row);
    return { message: 'Listo: te avisamos cuando confirmemos la hora.', burst: true };
  }, { save: 'Pedir reunión' });
}

// ── El estudio ──

/** Abrir una reunión: al estudio, para confirmarla o editarla; al cliente, para verla. */
export const openMeeting = (m) => (isStudio() ? studioMeeting(m) : meetingSheet(m));

/** Una reunión pedida o agendada: confirmar uno de sus horarios, moverla, marcarla hecha… */
function studioMeeting(m) {
  if (m.status === 'requested') return confirmMeeting(m);
  actionSheet(m.topic, [
    { label: 'Editar', icon: 'edit', note: 'Hora, enlace, notas', run: () => editMeeting(m) },
    m.status === 'confirmed' && { label: 'Añadir a mi calendario', icon: 'calendar', run: () => downloadIcs(m) },
    m.status === 'confirmed' && { label: 'Marcar como hecha', icon: 'check', run: () => setStatus(m, 'done', 'Reunión hecha.') },
    m.status === 'confirmed' && { label: 'Cancelar', icon: 'x', danger: true, run: () => setStatus(m, 'cancelled', 'Reunión cancelada.') },
    { label: 'Borrar', icon: 'trash', danger: true, run: async () => {
      if (!(await confirmSheet('¿Borrar la reunión?', { yes: 'Borrar', danger: true }))) return;
      await app.backend.remove('meetings', m.id).catch((err) => toast(err.message, 'error'));
      app.data.meetings = app.data.meetings.filter((x) => x.id !== m.id);
      redraw();
    } },
  ], { message: m.starts_at ? whenText(m.starts_at) : null });
}

async function setStatus(m, status, message) {
  try {
    upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status }));
    toast(message, 'ok');
    redraw();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/** Lo pidió el cliente: elegir uno de sus horarios (u otro), poner el enlace y confirmar. */
function confirmMeeting(m) {
  let pick = m.options?.find((o) => new Date(o) > new Date()) || '';
  let other = '';
  let declining = false;
  const link = input({ type: 'url', inputMode: 'url', maxLength: 500, value: remember('portal:meet-link') || '', placeholder: 'https://meet.google.com/…' });
  const place = input({ maxLength: 300, value: m.place || '', placeholder: 'Dirección (si es en persona)' });
  const note = textarea({ maxLength: 2000, rows: 2, placeholder: 'Un mensaje para el cliente (opcional)' });
  const optionsBox = el('div', { class: 'cl-meet-options is-pick' });
  const drawOptions = () => fill(optionsBox,
    (m.options || []).map((o) => el('button', { type: 'button', class: `cl-meet-option${pick === o ? ' is-on' : ''}`, disabled: new Date(o) < new Date(), onclick: () => { pick = o; other = ''; drawOptions(); } }, icon(pick === o ? 'checkCircle' : 'clock'), whenText(o))),
    el('label', { class: `cl-meet-option is-other${other ? ' is-on' : ''}` }, icon('edit'), el('span', { text: 'Otra hora' }),
      el('input', { type: 'datetime-local', class: 'cl-input', step: 900, value: other ? localInput(other) : '', oninput: (e) => { other = e.target.value ? new Date(e.target.value).toISOString() : ''; if (other) pick = ''; optionsBox.querySelectorAll('.cl-meet-option').forEach((b) => b.classList.remove('is-on')); e.target.closest('label').classList.toggle('is-on', Boolean(other)); } })),
  );
  drawOptions();
  const decline = el('button', { type: 'button', class: 'cl-btn ghost is-danger', onclick: async () => {
    declining = true;
    if (!note.value.trim()) {
      note.focus();
      toast('Cuéntale por qué y qué le propones.', 'error');
      declining = false;
      return;
    }
    try {
      upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'declined', studio_note: note.value.trim() }));
      ui.close();
      toast('Le dijimos que buscamos otra hora.', 'ok');
      redraw();
    } catch (err) {
      toast(err.message, 'error');
    }
  } }, 'No puedo');
  const ok = el('button', { type: 'button', class: 'cl-btn', onclick: async () => {
    if (declining) return;
    const startsAt = other || pick;
    if (!startsAt) return toast('Elige un horario.', 'error');
    ok.disabled = true;
    try {
      const url = link.value.trim();
      if (url && !/^https?:\/\//.test(url)) throw new Error('El enlace tiene que empezar por https://');
      if (url) remember('portal:meet-link', url);
      upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'confirmed', starts_at: startsAt, link: url || null, place: place.value.trim() || null, studio_note: note.value.trim() || null }));
      react('success');
      burst(ok);
      ui.close();
      toast('Reunión confirmada: le llega el aviso.', 'ok');
      redraw();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      ok.disabled = false;
    }
  } }, icon('check'), 'Confirmar');
  const ui = sheet(m.topic, el('div', { class: 'cl-form' },
    el('div', { class: 'cl-chips is-wrap' }, chip(`${m.author || 'El cliente'} · ${ago(m.created_at)}`, 'var(--cf-orange)', 'user'), chip(MEETING_MODE[m.mode]?.[0] || 'Reunión', 'var(--cf-blue)', MEETING_MODE[m.mode]?.[1]), chip(`${m.duration} min`, 'var(--cf-fg-faint)', 'clock')),
    m.notes && el('p', { class: 'cl-note-box' }, icon('doc'), m.notes),
    field('Horario', optionsBox),
    m.mode === 'in_person' ? field('Dónde', place) : field('Enlace', link, 'Se recuerda para la próxima.'),
    field('Mensaje', note),
    el('div', { class: 'cl-row-actions' }, taskButton({ ref: `meeting:${m.id}`, kind: 'meeting', title: `Reunión: ${m.topic}`, description: m.notes || '', route: '#/reuniones' })),
  ), { actions: [decline, ok], subtitle: 'Pide una reunión' });
}

/** Agendar (o editar) una reunión desde el estudio: queda confirmada y le avisa. */
export function editMeeting(m = null) {
  let mode = m?.mode || 'video';
  let duration = m?.duration || 30;
  let startsAt = m?.starts_at || '';
  const topic = input({ value: m?.topic || '', maxLength: 200, placeholder: 'Revisión del calendario de diciembre' });
  const when = el('input', { type: 'datetime-local', class: 'cl-input', step: 900, value: startsAt ? localInput(startsAt) : '', oninput: (e) => { startsAt = e.target.value ? new Date(e.target.value).toISOString() : ''; } });
  const link = input({ type: 'url', inputMode: 'url', maxLength: 500, value: m?.link || remember('portal:meet-link') || '', placeholder: 'https://meet.google.com/…' });
  const place = input({ maxLength: 300, value: m?.place || '', placeholder: 'Dirección (si es en persona)' });
  const notes = textarea({ value: m?.notes || '', maxLength: 2000, rows: 3, placeholder: 'De qué vais a hablar (opcional)' });
  formSheet(m ? 'Editar reunión' : 'Agendar reunión', [
    field('Tema', topic),
    field('Cuándo', when),
    field('Duración', seg(DURATIONS, duration, (v) => { duration = v; }, { small: true })),
    field('Cómo', seg(Object.entries(MEETING_MODE).map(([k, [l]]) => [k, l]), mode, (v) => { mode = v; }, { small: true })),
    field('Enlace', link),
    field('Dónde', place),
    field('Notas', notes),
  ], async () => {
    if (!topic.value.trim()) {
      topic.focus();
      return false;
    }
    if (!startsAt) {
      toast('Elige el día y la hora.', 'error');
      return false;
    }
    const url = link.value.trim();
    if (url && !/^https?:\/\//.test(url)) throw new Error('El enlace tiene que empezar por https://');
    if (url) remember('portal:meet-link', url);
    const row = { client_id: app.client.id, topic: topic.value.trim(), starts_at: startsAt, duration, mode, link: url || null, place: place.value.trim() || null, notes: notes.value.trim() || null };
    if (m) row.id = m.id;
    else Object.assign(row, { status: 'confirmed', origin: 'studio' });
    upsertLocal('meetings', await app.backend.save('meetings', row));
    return { message: m ? 'Reunión guardada.' : 'Reunión agendada: le llega el aviso.' };
  }, {
    save: m ? 'Guardar' : 'Agendar',
    danger: m && { label: 'Borrar', confirm: '¿Borrar la reunión?', run: async () => {
      await app.backend.remove('meetings', m.id);
      app.data.meetings = app.data.meetings.filter((x) => x.id !== m.id);
    } },
  });
}

// ── Al calendario del teléfono ──

const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function downloadIcs(m) {
  const start = new Date(m.starts_at);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Schwarck//Portal//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${m.id}@schwarckdev.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(endOf(m))}`,
    `SUMMARY:${icsText(`${m.topic} · ${isStudio() ? app.client.name : 'Schwarck'}`)}`,
    m.notes && `DESCRIPTION:${icsText(m.notes)}`,
    (m.link || m.place) && `LOCATION:${icsText(m.link || m.place)}`,
    m.link && `URL:${m.link}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Reunión en 15 minutos', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'reunion.ics' });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  react('tick');
}
