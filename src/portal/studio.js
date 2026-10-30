// Modo estudio: lo que Schwarck hace desde la misma app (en el teléfono o en el ordenador).
// Crear y editar todo lo del portal, el reporte diario, las cifras del mes, los leads,
// los accesos de cada cliente y lo que llega de ellos.

import {
  el, fill, icon, toast, sheet, actionSheet, confirmSheet, field, input, textarea, seg, chips, switchRow, stepper, datePicker, colorSwatches, group, filePicker, copyText, burst, todayKey, addDays, ago, plural, safeUrl, hostOf, sizeText, avatar, initials, fMonth, dayDate,
} from './kit.js';
import { react } from './feel.js';
import { safeName } from './data.js';
import {
  app, redraw, upsertLocal, removeLocal, POST_KIND, CONTENT_STATUS, STATUS_ORDER, CHANNEL, FORMAT, FUNNEL, RESOURCE_KIND, EXPECTS, PRIORITY, WORK_STATUS, LEAD_STAGE, LEAD_SOURCE, SENT_KIND, attention, urlOf, signPaths, targetTitle,
} from './state.js';

// ── Formulario en hoja: guardar con su estado y su respuesta ──

function formSheet(title, body, onSave, { save = 'Guardar', danger, subtitle } = {}) {
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('check'), save);
  const actions = [
    danger && el('button', { type: 'button', class: 'cl-btn ghost is-danger', 'aria-label': danger.label, onclick: async () => {
      if (!(await confirmSheet(danger.confirm || '¿Borrar?', { yes: danger.label, danger: true }))) return;
      try {
        await danger.run();
        ui.close();
        toast('Borrado.', 'ok');
        redraw();
      } catch (err) {
        toast(err.message, 'error');
      }
    } }, icon('trash')),
    btn,
  ];
  const ui = sheet(title, el('div', { class: 'cl-form' }, body), { actions, subtitle });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const done = await onSave();
      if (done === false) return;
      ui.close();
      react('success');
      if (done?.message) toast(done.message, 'ok');
      if (done?.burst) burst(btn);
      redraw();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  });
  return ui;
}

const need = (node, text) => {
  node.classList.remove('is-invalid');
  void node.offsetWidth;
  node.classList.add('is-invalid');
  node.focus();
  toast(text, 'error');
  return false;
};
const val = (node) => node.value.trim();
const cid = () => app.client.id;

async function persist(table, row, prev) {
  const saved = await app.backend.save(table, prev?.id ? { ...row, id: prev.id } : { ...row, client_id: cid() });
  upsertLocal(table, saved);
  return saved;
}

async function uploadTo(folder, file, onProgress) {
  const path = `${cid()}/${folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
  await app.backend.upload(path, file, onProgress);
  return path;
}

// ── El botón «+» del estudio ──

export function createMenu() {
  return actionSheet('Crear', [
    { label: 'Reporte de hoy', icon: 'tasks', note: 'Lo que hiciste hoy, en una lista', run: () => dailyReport() },
    { label: 'Trabajo', icon: 'bolt', note: 'Una tarea del estudio', run: () => editWork() },
    { label: 'Anuncio o avance', icon: 'megaphone', run: () => editPost() },
    { label: 'Petición al cliente', icon: 'inbox', run: () => editTask() },
    { label: 'Publicación del calendario', icon: 'calendar', run: () => editContent() },
    { label: 'Recurso', icon: 'folder', run: () => editResource() },
    { label: 'Lead', icon: 'funnel', run: () => editLead() },
    { label: 'Resultados del mes', icon: 'chart', run: () => editMetrics() },
  ]);
}

// ── Anuncios y avances ──

export function editPost(p = null) {
  let kind = p?.kind || 'announcement';
  let pinned = Boolean(p?.pinned);
  let notify = !p;
  const title = input({ value: p?.title || '', maxLength: 200, placeholder: 'Arrancamos la campaña de noviembre' });
  const body = textarea({ value: p?.body || '', maxLength: 20000, rows: 4, placeholder: 'Qué pasó, qué sigue, qué necesitas…' }, { counter: true });
  const link = input({ type: 'url', inputMode: 'url', value: p?.link || '', placeholder: 'https://… (opcional)' });
  const when = el('input', { type: 'datetime-local', class: 'cl-input', value: localInput(p?.occurred_at) });
  formSheet(p ? 'Editar publicación' : 'Publicar en el tablón', [
    field('Tipo', chips(Object.entries(POST_KIND).map(([k, [l, ico, c]]) => [k, l, c, ico]), kind, (v) => { kind = v; }, { scroll: true })),
    field('Título', title),
    field('Texto', body),
    field('Enlace', link),
    field('Fecha', when, 'Su lugar en la cronología.'),
    group(null,
      switchRow('Fijar arriba del tablón', pinned, (v) => { pinned = v; }, { ico: 'pin', tone: 'var(--cf-orange)' }),
      switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)' }),
    ),
  ], async () => {
    if (!val(title)) return need(title, 'Ponle un título.');
    if (val(link) && !safeUrl(val(link))) return need(link, 'El enlace tiene que empezar por https://');
    await persist('posts', { kind, title: val(title), body: val(body.querySelector?.('textarea') || body) || null, link: safeUrl(val(link)), pinned, notify, occurred_at: new Date(when.value || Date.now()).toISOString() }, p);
    return { message: p ? 'Guardado.' : notify ? 'Publicado y avisado.' : 'Publicado.', burst: !p };
  }, { save: p ? 'Guardar' : 'Publicar', danger: p && { label: 'Borrar', confirm: '¿Borrar esta publicación?', run: async () => { await app.backend.remove('posts', p.id); removeLocal('posts', p.id); } } });
}

function localInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const areaOf = (node) => node.querySelector?.('textarea') || node;

// ── Trabajo del estudio y reporte diario ──

const WORK_CATS = ['Diseño', 'Contenido', 'Vídeo', 'Redes', 'Fotografía', 'Comunidad', 'Análisis', 'Web', 'Publicidad', 'Reunión'];
const catsInUse = () => [...new Set([...WORK_CATS, ...app.data.work.map((w) => w.category).filter(Boolean)])];

export function editWork(w = null) {
  let status = w?.status || 'done';
  let day = w?.day || todayKey();
  let minutes = w?.minutes ?? null;
  let category = w?.category || '';
  let notify = !w;
  const title = input({ value: w?.title || '', maxLength: 200, placeholder: 'Diseñar la plantilla de historias' });
  const description = textarea({ value: w?.description || '', maxLength: 5000, rows: 2, placeholder: 'Detalles (opcional)' });
  const link = input({ type: 'url', inputMode: 'url', value: w?.link || '', placeholder: 'https://… (opcional)' });
  formSheet(w ? 'Editar trabajo' : 'Nuevo trabajo', [
    field('Qué', title),
    field('Estado', seg(Object.entries(WORK_STATUS).map(([k, [l]]) => [k, l]), status, (v) => { status = v; })),
    field('Día', datePicker(day, (v) => { day = v || todayKey(); }, { allowEmpty: false, quick: [['Ayer', -1], ['Hoy', 0], ['Mañana', 1]] })),
    field('Tiempo', stepper(minutes, { min: 0, max: 1440, step: 15, suffix: 'min', onChange: (v) => { minutes = v; } })),
    field('Categoría', chips(catsInUse().map((c) => [c, c]), category, (v) => { category = v; }, { scroll: true })),
    field('Detalles', description),
    field('Enlace', link),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Un solo aviso por día que se actualiza' }),
  ], async () => {
    if (!val(title)) return need(title, '¿Qué hiciste?');
    await persist('work', { title: val(title), status, day, minutes: minutes || null, category: category || null, description: val(areaOf(description)) || null, link: safeUrl(val(link)), notify }, w);
    return { message: w ? 'Guardado.' : 'Añadido al reporte.' };
  }, { danger: w && { label: 'Borrar', confirm: '¿Borrar este trabajo?', run: async () => { await app.backend.remove('work', w.id); removeLocal('work', w.id); } } });
}

/** El reporte de hoy: varias líneas de golpe, cada una con su estado y su tiempo. */
export function dailyReport(prefill = []) {
  const rows = [];
  const list = el('div', { class: 'cl-report-lines' });
  const today = app.data.work.filter((w) => w.day === todayKey());
  const addLine = (title = '', status = 'done', minutes = null, source = null) => {
    const line = { title: input({ value: title, maxLength: 200, placeholder: 'Qué hiciste' }), status, minutes, source };
    const toggle = el('button', { type: 'button', class: `cl-status-dot is-${status}`, 'aria-label': 'Cambiar estado' }, icon(WORK_STATUS[status][2]));
    toggle.addEventListener('click', () => {
      const order = ['done', 'doing', 'planned'];
      line.status = order[(order.indexOf(line.status) + 1) % order.length];
      toggle.className = `cl-status-dot is-${line.status}`;
      fill(toggle, icon(WORK_STATUS[line.status][2]));
      react('tick');
    });
    const mins = stepper(minutes, { min: 0, max: 1440, step: 15, suffix: 'min', onChange: (v) => { line.minutes = v; } });
    const row = el('div', { class: 'cl-report-line' }, toggle, line.title, mins, el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Quitar', onclick: () => { rows.splice(rows.indexOf(line), 1); row.classList.add('is-gone'); setTimeout(() => row.remove(), 220); react('off'); } }, icon('x')));
    rows.push(line);
    list.append(row);
    if (!title) requestAnimationFrame(() => line.title.focus());
  };
  for (const p of prefill) addLine(p.title, 'done', p.minutes || null, p.source || null);
  if (!prefill.length) addLine();
  let notify = true;
  const existing = today.length ? el('div', { class: 'cl-report-today' },
    el('small', { class: 'cl-eyebrow', text: 'Ya en el reporte de hoy' }),
    today.map((w) => el('button', { type: 'button', class: `cl-report-chip is-${w.status}`, onclick: async (e) => {
      const next = w.status === 'done' ? 'doing' : w.status === 'doing' ? 'planned' : 'done';
      try {
        upsertLocal('work', await app.backend.save('work', { id: w.id, status: next }));
        w.status = next;
        e.currentTarget.className = `cl-report-chip is-${next}`;
        fill(e.currentTarget, icon(WORK_STATUS[next][2]), w.title);
        react(next === 'done' ? 'success' : 'tick');
        redraw();
      } catch (err) {
        toast(err.message, 'error');
      }
    } }, icon(WORK_STATUS[w.status][2]), w.title)),
  ) : null;
  const hasImport = Boolean(readImport()?.items?.length);
  const ui = formSheet('Reporte de hoy', [
    el('p', { class: 'cl-form-hint', text: 'Cada línea es algo que hiciste. Toca el círculo para marcarla como hecha, en curso o planificada.' }),
    existing,
    list,
    el('div', { class: 'cl-row-actions' },
      el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => addLine() }, icon('plus'), 'Otra línea'),
      hasImport && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => { ui?.close(); importFromNegocio(); } }, icon('download'), 'Traer de Negocio'),
    ),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Le llega «Reporte de hoy: N tareas hechas»' }),
  ], async () => {
    const items = rows.filter((r) => val(r.title));
    if (!items.length) return need(rows[0]?.title || list, 'Escribe al menos una línea.');
    const saved = await app.backend.saveMany('work', items.map((r) => ({ client_id: cid(), title: val(r.title), status: r.status, minutes: r.minutes || null, day: todayKey(), notify, source: r.source || null })));
    for (const s of saved) upsertLocal('work', s);
    return { message: `${plural(saved.length, 'línea', 'líneas')} en el reporte.`, burst: true };
  }, { save: 'Publicar' });
}

// ── Peticiones al cliente ──

export function editTask(t = null) {
  let due = t?.due_date || addDays(todayKey(), 3);
  let expects = t?.expects || 'file';
  let priority = t?.priority || 'normal';
  let status = t?.status || 'pending';
  let notify = !t;
  const title = input({ value: t?.title || '', maxLength: 200, placeholder: 'Mándanos el logo en vectorial' });
  const description = textarea({ value: t?.description || '', maxLength: 5000, rows: 3, placeholder: 'Qué necesitas exactamente, formato, ejemplos…' });
  formSheet(t ? 'Editar petición' : 'Pedirle algo al cliente', [
    field('Qué necesitas', title),
    field('Detalles', description),
    field('Para cuándo', datePicker(due, (v) => { due = v; })),
    field('Cómo te lo manda', chips(Object.entries(EXPECTS).map(([k, [l, ico]]) => [k, l, null, ico]), expects, (v) => { expects = v; }, { scroll: true })),
    field('Prioridad', seg(Object.entries(PRIORITY).map(([k, [l]]) => [k, l]), priority, (v) => { priority = v; })),
    t && field('Estado', seg([['pending', 'Pendiente'], ['submitted', 'Enviada'], ['done', 'Revisada']], status, (v) => { status = v; })),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Y un recordatorio la mañana en que vence' }),
  ], async () => {
    if (!val(title)) return need(title, '¿Qué necesitas?');
    const row = { title: val(title), description: val(areaOf(description)) || null, due_date: due || null, expects, priority, notify };
    if (t) Object.assign(row, { status, done_at: status === 'done' ? t.done_at || new Date().toISOString() : null, submitted_at: status === 'pending' ? null : t.submitted_at });
    await persist('tasks', row, t);
    return { message: t ? 'Guardado.' : notify ? 'Pedido y avisado.' : 'Pedido.' };
  }, { save: t ? 'Guardar' : 'Pedir', danger: t && { label: 'Borrar', confirm: '¿Borrar esta petición?', run: async () => { await app.backend.remove('tasks', t.id); removeLocal('tasks', t.id); } } });
}

export async function approveTask(t, from) {
  try {
    upsertLocal('tasks', await app.backend.save('tasks', { id: t.id, status: 'done', done_at: new Date().toISOString() }));
    react('success');
    burst(from);
    toast('Revisada. Le avisamos.', 'ok');
    redraw();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Calendario de contenido (la ficha completa) ──

export function editContent(c = null, { date: preDate } = {}) {
  let channel = c?.channel || 'instagram';
  let format = c?.format || 'reel';
  let status = c?.status || 'review';
  let funnel = c?.funnel || '';
  let notify = !c;
  let assets = [...(c?.assets || [])];
  let refs = [...(c?.refs || [])];
  const title = input({ value: c?.title || '', maxLength: 200, placeholder: 'Reel: así tostamos el café' });
  const date = el('input', { type: 'date', class: 'cl-input', value: c?.date || preDate || addDays(todayKey(), 1) });
  const time = el('input', { type: 'time', class: 'cl-input', value: c?.time?.slice(0, 5) || '18:00' });
  const pillar = input({ value: c?.pillar || '', maxLength: 80, placeholder: 'Proceso, Educación, Promociones…', list: 'cl-pillars' });
  const pillars = el('datalist', { id: 'cl-pillars' }, [...new Set(app.data.content.map((x) => x.pillar).filter(Boolean))].map((p) => el('option', { value: p })));
  const objective = textarea({ value: c?.objective || '', maxLength: 500, rows: 2, placeholder: 'Para qué sirve esta pieza' });
  const cta = input({ value: c?.cta || '', maxLength: 200, placeholder: 'Escríbenos por WhatsApp' });
  const campaign = input({ value: c?.campaign || '', maxLength: 120, placeholder: 'Noviembre, Lanzamiento…' });
  const caption = textarea({ value: c?.caption || '', maxLength: 2200, rows: 4, placeholder: 'El texto que acompaña la publicación' }, { counter: true });
  const hashtags = input({ value: c?.hashtags || '', maxLength: 1000, placeholder: '#cafedeespecialidad #caracas' });
  const script = textarea({ value: c?.script || '', maxLength: 8000, rows: 4, placeholder: '0–3 s: …\n3–8 s: …' });
  const duration = input({ value: c?.duration || '', maxLength: 40, placeholder: '20 s' });
  const notes = textarea({ value: c?.notes || '', maxLength: 5000, rows: 2, placeholder: 'Música, tono, lo que deba saber el cliente…' });
  const link = input({ type: 'url', inputMode: 'url', value: c?.link || '', placeholder: 'https://… (la pieza en Drive o Canva)' });
  const picker = filePicker({ accept: 'image/*,video/*', multiple: true, label: 'Añadir imágenes o vídeos', hint: 'Portada, borradores, la pieza final… (hasta 50 MB cada uno)' });
  const current = el('div', { class: 'cl-assets-edit' });
  const drawAssets = () => fill(current, assets.map((a, i) => el('div', { class: 'cl-asset-thumb' },
    a.kind === 'video' ? el('span', { class: 'cl-file-ico' }, icon('film')) : urlOf(a.path || a.url) ? el('img', { src: urlOf(a.path || a.url), alt: '' }) : el('span', { class: 'cl-file-ico' }, icon('image')),
    el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Quitar', onclick: () => { assets.splice(i, 1); react('off'); drawAssets(); } }, icon('x')),
  )));
  drawAssets();
  const refsBox = el('div', { class: 'cl-refs-edit' });
  const refUrl = input({ type: 'url', inputMode: 'url', placeholder: 'https://… una referencia' });
  const drawRefs = () => fill(refsBox, refs.map((r, i) => el('div', { class: 'cl-ref-row' }, icon('link'), el('span', { text: r.label || hostOf(r.url) }), el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Quitar', onclick: () => { refs.splice(i, 1); drawRefs(); } }, icon('x')))),
    el('div', { class: 'cl-ref-add' }, refUrl, el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => {
      const u = safeUrl(val(refUrl));
      if (!u) return need(refUrl, 'Pega un enlace que empiece por https://');
      refs.push({ url: u, label: hostOf(u) });
      refUrl.value = '';
      react('pop');
      drawRefs();
    } }, icon('plus'), 'Añadir')));
  drawRefs();

  formSheet(c ? 'Editar publicación' : 'Nueva publicación', [
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Lo básico' }),
      field('Título', title),
      el('div', { class: 'cl-grid2' }, field('Día', date), field('Hora', time)),
      field('Red', chips(Object.entries(CHANNEL).filter(([k]) => k !== 'google').map(([k, [l, color, ico]]) => [k, l, color, ico]), channel, (v) => { channel = v; }, { scroll: true })),
      field('Formato', chips(Object.entries(FORMAT).map(([k, l]) => [k, l]), format, (v) => { format = v; }, { scroll: true })),
      field('Estado', chips(STATUS_ORDER.map((k) => [k, CONTENT_STATUS[k][0], CONTENT_STATUS[k][1]]), status, (v) => { status = v; }, { scroll: true }), 'En «Para revisar» el cliente puede aprobarla o pedir cambios.'),
    ),
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Estrategia' }),
      field('Embudo', chips(Object.entries(FUNNEL).map(([k, [l, color]]) => [k, l, color]), funnel, (v) => { funnel = v; }, { scroll: true })),
      field('Pilar', pillar), pillars,
      field('Objetivo', objective),
      el('div', { class: 'cl-grid2' }, field('Llamada a la acción', cta), field('Campaña', campaign)),
    ),
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Texto' }),
      field('Copy', caption),
      field('Hashtags', hashtags),
    ),
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Producción' }),
      field('Guion', script),
      el('div', { class: 'cl-grid2' }, field('Duración', duration), el('span')),
      field('Notas', notes),
    ),
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Material y referencias' }),
      current, picker.node,
      field('Referencias', refsBox),
      field('Enlace a la pieza', link),
    ),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Si está «Para revisar», le pide que la apruebe' }),
  ], async () => {
    if (!val(title)) return need(title, 'Ponle un título.');
    if (!date.value) return need(date, 'Elige el día.');
    const files = picker.files();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = await uploadTo('contenido', f, (p) => picker.progress((i + p) / files.length));
      assets.push({ path, kind: f.type.startsWith('video/') ? 'video' : 'image', name: f.name });
    }
    picker.progress(null);
    await signPaths(assets.map((a) => a.path).filter(Boolean));
    const row = {
      title: val(title), date: date.value, time: time.value || null, channel, format, status, funnel: funnel || null,
      pillar: val(pillar) || null, objective: val(areaOf(objective)) || null, cta: val(cta) || null, campaign: val(campaign) || null,
      caption: val(areaOf(caption)) || null, hashtags: val(hashtags) || null, script: val(areaOf(script)) || null, duration: val(duration) || null,
      notes: val(areaOf(notes)) || null, link: safeUrl(val(link)), assets, refs, image_url: assets.find((a) => a.kind === 'image')?.path || c?.image_url || null, notify,
    };
    // Volver a pedir revisión borra la respuesta anterior del cliente.
    if (c && status === 'review' && c.status !== 'review') Object.assign(row, { client_verdict: null, client_note: null, client_verdict_at: null });
    await persist('content', row, c);
    return { message: c ? 'Guardado.' : 'Añadida al calendario.', burst: !c };
  }, { danger: c && { label: 'Borrar', confirm: '¿Borrar esta publicación del calendario?', run: async () => { await app.backend.remove('content', c.id); removeLocal('content', c.id); } } });
}

export async function setContentStatus(c, status) {
  try {
    const patch = { id: c.id, status };
    if (status === 'review') Object.assign(patch, { client_verdict: null, client_note: null, client_verdict_at: null });
    upsertLocal('content', await app.backend.save('content', patch));
    react(status === 'published' ? 'success' : 'tick');
    toast(`Ahora: ${CONTENT_STATUS[status][0].toLowerCase()}.`, 'ok');
    redraw();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Recursos ──

export function editResource(r = null) {
  let mode = r?.storage_path ? 'file' : 'link';
  let kind = r?.kind || 'link';
  let category = r?.category || '';
  let notify = !r;
  const title = input({ value: r?.title || '', maxLength: 200, placeholder: 'Manual de marca' });
  const url = input({ type: 'url', inputMode: 'url', value: r?.url || '', placeholder: 'https://…' });
  const description = input({ value: r?.description || '', maxLength: 2000, placeholder: 'Una línea que diga qué es' });
  const picker = filePicker({ label: 'Elige el archivo', hint: 'Hasta 50 MB' });
  const source = el('div');
  const draw = () => fill(source, mode === 'link' ? field('Enlace', url) : r?.storage_path ? el('p', { class: 'cl-form-hint', text: `Archivo: ${r.file_name || 'subido'} (${sizeText(r.size)})` }) : picker.node);
  url.addEventListener('change', () => {
    if (/youtu|vimeo|loom/.test(url.value)) kind = 'video';
    else if (/\.pdf($|\?)|docs\.google/.test(url.value)) kind = 'doc';
    if (!val(title) && safeUrl(url.value)) title.value = hostOf(url.value);
  });
  draw();
  const cats = [...new Set(['Marca', 'Guías', 'Diseño', 'Fotos', 'Vídeos', 'Accesos', ...app.data.resources.map((x) => x.category).filter(Boolean)])];
  formSheet(r ? 'Editar recurso' : 'Nuevo recurso', [
    !r && seg([['link', 'Enlace'], ['file', 'Archivo']], mode, (v) => { mode = v; draw(); }),
    source,
    field('Título', title),
    field('Tipo', chips(Object.entries(RESOURCE_KIND).map(([k, [l, ico, color]]) => [k, l, color, ico]), kind, (v) => { kind = v; }, { scroll: true })),
    field('Categoría', chips(cats.map((x) => [x, x]), category, (v) => { category = v; }, { scroll: true })),
    field('Descripción', description),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)' }),
  ], async () => {
    const row = { title: val(title), kind, category: category || null, description: val(description) || null, notify };
    if (mode === 'link') {
      if (!safeUrl(val(url))) return need(url, 'Pega un enlace que empiece por https://');
      row.url = safeUrl(val(url));
      if (!row.title) row.title = hostOf(row.url);
    } else if (!r) {
      const f = picker.files()[0];
      if (!f) {
        toast('Elige un archivo.', 'error');
        return false;
      }
      const path = await uploadTo('recursos', f, (p) => picker.progress(p));
      picker.progress(null);
      Object.assign(row, { storage_path: path, file_name: f.name, size: f.size, mime: f.type || null, title: row.title || f.name.replace(/\.[^.]+$/, '') });
      if (!r && kind === 'link') row.kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'doc' : 'file';
    }
    if (!row.title) return need(title, 'Ponle un título.');
    await persist('resources', row, r);
    return { message: r ? 'Guardado.' : 'Recurso añadido.' };
  }, { danger: r && { label: 'Borrar', confirm: `¿Borrar «${r.title}»?`, run: async () => { await app.backend.remove('resources', r.id); if (r.storage_path) await app.backend.removeFiles([r.storage_path]); removeLocal('resources', r.id); } } });
}

// ── Leads ──

export function editLead(l = null) {
  let source = l?.source || 'instagram';
  let stage = l?.stage || 'nuevo';
  let value = l?.value ?? null;
  const name = input({ value: l?.name || '', maxLength: 120, placeholder: 'Nombre o empresa' });
  const contact = input({ value: l?.contact || '', maxLength: 200, placeholder: 'Teléfono, correo o @usuario' });
  const date = el('input', { type: 'date', class: 'cl-input', value: l?.date || todayKey() });
  const campaign = input({ value: l?.campaign || '', maxLength: 120, placeholder: 'Opcional' });
  const notes = textarea({ value: l?.notes || '', maxLength: 2000, rows: 2, placeholder: 'Qué busca, cómo llegó…' });
  formSheet(l ? 'Editar lead' : 'Nuevo lead', [
    field('Quién', name),
    field('Contacto', contact),
    field('Llegó por', chips(Object.entries(LEAD_SOURCE).map(([k, l2]) => [k, l2]), source, (v) => { source = v; }, { scroll: true })),
    field('Etapa', chips(Object.entries(LEAD_STAGE).map(([k, [l2, color]]) => [k, l2, color]), stage, (v) => { stage = v; }, { scroll: true })),
    el('div', { class: 'cl-grid2' }, field('Valor (USD)', stepper(value, { min: 0, step: 10, onChange: (v) => { value = v; } })), field('Fecha', date)),
    field('Campaña', campaign),
    field('Notas', notes),
  ], async () => {
    if (!val(name)) return need(name, '¿Quién es?');
    await persist('leads', { name: val(name), contact: val(contact) || null, source, stage, value: value || null, date: date.value || todayKey(), campaign: val(campaign) || null, notes: val(areaOf(notes)) || null }, l);
    return { message: l ? 'Guardado.' : 'Lead registrado.', burst: !l && stage === 'ganado' };
  }, { danger: l && { label: 'Borrar', confirm: '¿Borrar este lead?', run: async () => { await app.backend.remove('leads', l.id); removeLocal('leads', l.id); } } });
}

// ── Resultados del mes ──

const METRIC_FIELDS = [
  ['reach', 'Alcance', 'eye', 100], ['impressions', 'Impresiones', 'layers', 100], ['engagement', 'Interacciones', 'heart', 10],
  ['followers', 'Seguidores (total)', 'users', 10], ['new_followers', 'Seguidores nuevos', 'trend', 1], ['clicks', 'Clics', 'bolt', 1],
  ['leads', 'Leads', 'funnel', 1], ['posts', 'Publicaciones', 'calendar', 1], ['sales', 'Ventas (USD)', 'dollar', 10], ['spend', 'Inversión (USD)', 'target', 10],
];

export function editMetrics(monthKey = null, channelKey = 'total') {
  let month = (monthKey || todayKey()).slice(0, 7);
  let channel = channelKey;
  const values = {};
  const notes = textarea({ maxLength: 2000, rows: 2, placeholder: 'Lo más destacado del mes' });
  const grid = el('div', { class: 'cl-metric-grid' });
  const monthInput = el('input', { type: 'month', class: 'cl-input', value: month });
  const load = () => {
    const row = app.data.metrics.find((m) => m.month.slice(0, 7) === month && m.channel === channel) || {};
    areaOf(notes).value = row.notes || '';
    fill(grid, METRIC_FIELDS.map(([k, label, ico, step]) => {
      values[k] = row[k] ?? null;
      return el('div', { class: 'cl-metric-field' }, el('span', { class: 'cl-metric-label' }, icon(ico), label), stepper(values[k], { min: k === 'new_followers' ? -1e6 : 0, step, onChange: (v) => { values[k] = v; } }));
    }));
  };
  monthInput.addEventListener('change', () => { month = monthInput.value || month; load(); });
  load();
  formSheet('Resultados del mes', [
    el('div', { class: 'cl-grid2' }, field('Mes', monthInput), el('span')),
    field('De', chips([['total', 'Total'], ...Object.entries(CHANNEL).map(([k, [l, color, ico]]) => [k, l, color, ico])], channel, (v) => { channel = v; load(); }, { scroll: true }), 'El total es lo que ve primero el cliente.'),
    grid,
    field('Notas', notes),
  ], async () => {
    const row = { client_id: cid(), month: `${month}-01`, channel, notes: val(areaOf(notes)) || null };
    for (const [k] of METRIC_FIELDS) row[k] = values[k] === '' ? null : values[k];
    upsertLocal('metrics', await app.backend.upsertMetrics(row));
    app.data.metrics.sort((a, b) => b.month.localeCompare(a.month));
    return { message: `Resultados de ${fMonth.format(dayDate(`${month}-15`))} guardados.` };
  });
}

// ── Lo recibido y lo que pide atención ──

export function inboxSheet() {
  const box = el('div', { class: 'cl-inbox' });
  const draw = () => {
    const items = attention();
    if (!items.length) {
      fill(box, el('div', { class: 'cl-empty' }, el('span', { class: 'cl-empty-ico' }, icon('checkCircle')), el('b', { text: 'Todo revisado' }), el('p', { text: `Nada pendiente de ${app.client.name}.` })));
      return;
    }
    fill(box, items.map((it, i) => inboxRow(it, i, draw)));
  };
  draw();
  const unseen = () => attention().filter((x) => x.kind === 'submission').map((x) => x.row.id);
  sheet(`Para revisar · ${app.client.name}`, box, {
    actions: [el('button', { type: 'button', class: 'cl-btn ghost', onclick: async () => {
      const ids = unseen();
      if (!ids.length) return toast('No hay envíos sin ver.');
      await app.backend.markSubmissionsSeen(ids);
      for (const s of app.data.submissions) if (ids.includes(s.id)) s.seen_at = new Date().toISOString();
      react('success');
      draw();
      redraw();
    } }, icon('check'), 'Marcar envíos como vistos')],
  });
}

function inboxRow(it, i, redrawList) {
  const r = it.row;
  const base = { class: 'cl-inbox-row', style: { '--i': Math.min(i, 8) } };
  if (it.kind === 'submission') {
    const url = safeUrl(r.url);
    return el('div', base,
      el('span', { class: 'cl-inbox-ico is-sub' }, icon(SENT_KIND[r.kind]?.[1] || 'send')),
      el('div', { class: 'cl-inbox-main' },
        el('b', { text: `${r.author || 'El cliente'} envió ${SENT_KIND[r.kind]?.[0].toLowerCase() || 'algo'}` }),
        el('p', { text: r.file_name || url || r.body || '' }),
        r.body && (r.file_name || url) && el('small', { class: 'cl-inbox-note', text: r.body }),
        el('small', { text: [r.task_id && `Para «${targetTitle('task', r.task_id)}»`, sizeText(r.size), ago(r.created_at)].filter(Boolean).join(' · ') }),
      ),
      el('div', { class: 'cl-inbox-actions' },
        r.storage_path && el('button', { type: 'button', class: 'cl-glass sm', 'aria-label': 'Descargar', onclick: () => openFile(r.storage_path) }, icon('download')),
        url && el('a', { class: 'cl-glass sm', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir' }, icon('external')),
        !r.storage_path && !url && r.body && el('button', { type: 'button', class: 'cl-glass sm', 'aria-label': 'Copiar', onclick: () => copyText(r.body) }, icon('copy')),
        el('button', { type: 'button', class: 'cl-glass sm is-ok', 'aria-label': 'Visto', onclick: async () => {
          await app.backend.markSubmissionsSeen([r.id]);
          r.seen_at = new Date().toISOString();
          react('tick');
          redrawList();
          redraw();
        } }, icon('check')),
      ),
    );
  }
  if (it.kind === 'task') {
    return el('div', base,
      el('span', { class: 'cl-inbox-ico is-task' }, icon('inbox')),
      el('div', { class: 'cl-inbox-main' }, el('b', { text: 'Petición enviada' }), el('p', { text: r.title }), r.client_note && el('small', { class: 'cl-inbox-note', text: r.client_note }), el('small', { text: ago(it.at) })),
      el('div', { class: 'cl-inbox-actions' }, el('button', { type: 'button', class: 'cl-btn sm', onclick: async (e) => { await approveTask(r, e.currentTarget); redrawList(); } }, icon('check'), 'Dar por buena')),
    );
  }
  if (it.kind === 'changes') {
    return el('a', { ...base, href: `#/marketing/pieza/${r.id}` },
      el('span', { class: 'cl-inbox-ico is-changes' }, icon('edit')),
      el('div', { class: 'cl-inbox-main' }, el('b', { text: 'Pide cambios' }), el('p', { text: r.title }), r.client_note && el('small', { class: 'cl-inbox-note', text: `«${r.client_note}»` }), el('small', { text: ago(it.at) })),
      icon('right', 'cl-set-chev'),
    );
  }
  return el('a', { ...base, href: `#/hilo/${r.target}/${r.target_id}` },
    el('span', { class: 'cl-inbox-ico is-comment' }, icon('chat')),
    el('div', { class: 'cl-inbox-main' }, el('b', { text: `${r.author || 'El cliente'} comentó` }), el('p', { text: r.body }), el('small', { text: `En «${targetTitle(r.target, r.target_id)}» · ${ago(it.at)}` })),
    icon('right', 'cl-set-chev'),
  );
}

export async function openFile(path) {
  const win = window.open('', '_blank');
  try {
    const urls = await app.backend.fileUrls([path], true);
    if (!urls[path]) throw new Error('No se encontró el archivo.');
    if (win) win.location = urls[path];
    else location.href = urls[path];
  } catch (err) {
    win?.close();
    toast(err.message, 'error');
  }
}

// ── Portales: cambiar, crear y editar ──

export function portalSwitcher(onPick) {
  let ui;
  const list = el('div', { class: 'cl-portal-list' }, app.portals.map((p, i) => el('button', {
    type: 'button',
    class: `cl-portal-row${p.client.id === app.client?.id ? ' is-current' : ''}${p.client.archived ? ' is-archived' : ''}`,
    style: { '--accent': p.client.accent, '--i': Math.min(i, 10) },
    onclick: () => {
      ui.close();
      if (p.client.id !== app.client?.id) onPick(p);
    },
  },
  el('span', { class: 'cl-logo' }, urlOf(p.client.logo_url) ? el('img', { src: urlOf(p.client.logo_url), alt: '' }) : initials(p.client.name)),
  el('span', { class: 'cl-set-main' }, el('b', { text: p.client.name }), el('small', { text: p.client.archived ? 'Archivado' : p.client.industry || 'Portal de cliente' })),
  p.alerts ? el('i', { class: 'cl-badge', text: String(p.alerts) }) : null,
  p.client.id === app.client?.id ? icon('check', 'cl-set-chev is-on') : icon('right', 'cl-set-chev'),
  )));
  ui = sheet(app.studio ? 'Tus clientes' : 'Tus proyectos', el('div', {}, list), {
    actions: app.studio ? [el('button', { type: 'button', class: 'cl-btn', onclick: () => { ui.close(); editPortal(null, onPick); } }, icon('plus'), 'Nuevo portal')] : null,
  });
}

export function editPortal(c = null, onCreated) {
  let accent = c?.accent || '#00b8d4';
  const name = input({ value: c?.name || '', maxLength: 120, placeholder: 'Café Aroma' });
  const industry = input({ value: c?.industry || '', maxLength: 80, placeholder: 'Cafetería, gimnasio, tienda…' });
  const welcome = textarea({ value: c?.welcome || '', maxLength: 2000, rows: 3, placeholder: 'Aquí verás cada avance de tu proyecto… (sale arriba en su inicio)' });
  formSheet(c ? 'Ajustes del portal' : 'Nuevo portal', [
    field('Nombre que ve el cliente', name),
    field('Sector', industry),
    field('Color', colorSwatches(accent, (v) => { accent = v; })),
    field('Bienvenida', welcome),
    c && group(null, switchRow('Archivado', Boolean(c.archived), async (v) => {
      try {
        Object.assign(c, await app.backend.updateClient(c.id, { archived: v }));
        toast(v ? 'Archivado: el cliente ya no lo ve.' : 'Activo otra vez.', 'ok');
      } catch (err) {
        toast(err.message, 'error');
      }
    }, { ico: 'box', sub: 'El cliente deja de verlo; tú lo sigues teniendo' })),
  ], async () => {
    if (!val(name)) return need(name, 'Ponle nombre.');
    const row = { name: val(name), industry: val(industry) || null, accent, welcome: val(areaOf(welcome)) || null };
    if (c) {
      Object.assign(app.client, await app.backend.updateClient(c.id, row));
      return { message: 'Guardado.' };
    }
    const created = await app.backend.createPortal(row);
    app.portals.push({ client: created, member: { user_id: app.user.id, name: 'Schwarck', studio: true, prefs: {} }, alerts: 0 });
    setTimeout(() => onCreated?.(app.portals.at(-1)), 50);
    return { message: 'Portal creado. Dale acceso al cliente desde el perfil.', burst: true };
  }, { save: c ? 'Guardar' : 'Crear portal' });
}

// ── Accesos ──

export function accessSheet() {
  const box = el('div', { class: 'cl-form' });
  const email = input({ type: 'email', inputMode: 'email', placeholder: 'correo@cliente.com', autocomplete: 'off' });
  const name = input({ placeholder: 'Nombre (opcional)' });
  const draw = () => fill(box,
    el('p', { class: 'cl-form-hint', text: 'Cada persona entra con su correo y una contraseña que se crea aquí. No se manda ningún correo: tú le pasas los datos.' }),
    group('Dar acceso',
      el('div', { class: 'cl-invite' }, email, name, el('button', { type: 'button', class: 'cl-btn', onclick: invite }, icon('plus'), 'Dar acceso')),
    ),
    group(`Con acceso a ${app.client.name}`, ...(app.data.members.length ? app.data.members.map((m) => el('button', { type: 'button', class: 'cl-row-set', onclick: () => memberMenu(m) },
      avatar(m.name || m.email, urlOf(m.avatar_path), 'sm'),
      el('span', { class: 'cl-set-main' }, el('b', { text: m.name || m.email }), el('small', { text: `${m.email}${m.position ? ` · ${m.position}` : ''} · ${m.last_seen_at ? `entró ${ago(m.last_seen_at)}` : 'aún no ha entrado'}` })),
      icon('more', 'cl-set-chev'),
    )) : [el('p', { class: 'cl-group-empty', text: 'Todavía nadie.' })])),
  );
  async function invite(e) {
    const btn = e.currentTarget;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(email))) return need(email, 'Escribe un correo válido.');
    btn.classList.add('is-busy');
    try {
      const r = await app.backend.invite(app.client.id, val(email), val(name));
      upsertMember(r.member);
      email.value = '';
      name.value = '';
      draw();
      if (r.password) credentials(r.member, r.password);
      else toast(`${r.member.email} ya tenía cuenta: ahora también entra aquí.`, 'ok');
      react('success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.classList.remove('is-busy');
    }
  }
  async function memberMenu(m) {
    await actionSheet(m.name || m.email, [
      { label: 'Nueva contraseña', icon: 'key', run: async () => {
        if (!(await confirmSheet(`¿Contraseña nueva para ${m.email}?`, { message: 'La anterior deja de valer.', yes: 'Crear' }))) return;
        try {
          const r = await app.backend.resetPassword(m.user_id);
          credentials(m, r.password);
        } catch (err) {
          toast(err.message, 'error');
        }
      } },
      { label: 'Copiar enlace de acceso', icon: 'link', note: 'Entra sin contraseña una vez; caduca en 1 hora', run: async () => {
        try {
          copyText((await app.backend.accessLink(m.email)).link, 'Enlace copiado.');
        } catch (err) {
          toast(err.message, 'error');
        }
      } },
      { label: 'Quitar acceso', icon: 'trash', danger: true, run: async () => {
        if (!(await confirmSheet(`¿Quitar el acceso de ${m.email}?`, { yes: 'Quitar', danger: true }))) return;
        try {
          await app.backend.removeMember(app.client.id, m.user_id);
          app.data.members = app.data.members.filter((x) => x.user_id !== m.user_id);
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      } },
    ], { message: m.email });
  }
  draw();
  sheet('Accesos', box, { subtitle: app.client.name });
}

function upsertMember(m) {
  const i = app.data.members.findIndex((x) => x.user_id === m.user_id);
  if (i >= 0) app.data.members[i] = { ...app.data.members[i], ...m };
  else app.data.members.push(m);
}

function credentials(m, password) {
  const url = `${location.origin}/cliente/`;
  const text = `Hola${m.name ? ` ${m.name.split(' ')[0]}` : ''}: ya tienes tu app del proyecto ${app.client.name} con Schwarck.\n\n${url}\nCorreo: ${m.email}\nContraseña: ${password}\n\nÁbrela en el teléfono, toca «Instalar» y activa las notificaciones: ahí verás los avances, el calendario de contenido y lo que necesitamos de ti.`;
  sheet('Datos de acceso', el('div', { class: 'cl-form' },
    el('p', { class: 'cl-form-hint', text: 'La contraseña solo se ve ahora. Mándasela por WhatsApp o como prefieras; luego puede cambiarla desde su perfil.' }),
    el('div', { class: 'cl-cred' }, el('small', { text: 'Correo' }), el('b', { text: m.email }), el('small', { text: 'Contraseña' }), el('code', { text: password })),
    el('pre', { class: 'cl-cred-text', text }),
  ), { actions: [el('button', { type: 'button', class: 'cl-btn', onclick: () => copyText(text, 'Mensaje copiado.') }, icon('copy'), 'Copiar mensaje')] });
}

// ── Traer el trabajo de hoy desde Negocio ──
// Negocio deja aquí (mismo sitio, mismo almacenamiento) las tareas hechas y las horas del día.

export function readImport() {
  try {
    const data = JSON.parse(localStorage.getItem('portal:import') || 'null');
    if (!data || Date.now() - data.at > 12 * 3600_000) return null;
    return data;
  } catch {
    return null;
  }
}

export function importFromNegocio() {
  const data = readImport();
  if (!data?.items?.length) return toast('No hay nada de Negocio para traer. Ábrelo desde Negocio › Portal de clientes.', 'error');
  const mine = data.items.filter((it) => !app.client.crm_customer_id || it.customerId === app.client.crm_customer_id);
  const items = (mine.length ? mine : data.items).filter((it) => !app.data.work.some((w) => w.source === it.source));
  if (!items.length) return toast('Ese trabajo ya está en el reporte.', 'ok');
  dailyReport(items);
}

