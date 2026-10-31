// Modo estudio: lo que Schwarck hace desde la misma app (en el teléfono o en el ordenador).
// Crear y editar todo lo del portal, el reporte diario, las cifras del mes, los leads,
// los accesos de cada cliente y lo que llega de ellos.

import {
  el, fill, icon, toast, sheet, actionSheet, confirmSheet, field, input, textarea, seg, chips, switchRow, stepper, datePicker, colorSwatches, group, rowLink, filePicker, copyText, burst, todayKey, addDays, ago, plural, safeUrl, hostOf, sizeText, avatar, initials, fMonth, dayDate, dayLabel, cap, fDay,
} from './kit.js';
import { react } from './feel.js';
import { safeName } from './data.js';
import {
  app, redraw, upsertLocal, removeLocal, POST_KIND, CONTENT_STATUS, STATUS_ORDER, CHANNEL, FORMAT, FUNNEL, RESOURCE_KIND, EXPECTS, PRIORITY, WORK_STATUS, LEAD_STAGE, LEAD_SOURCE, SENT_KIND, VERDICT, attention, urlOf, signPaths, targetTitle, channelsOf,
} from './state.js';
import { PERMS, ROLES, SECTION_PERM, memberCan, portalAllows, roleAllows } from './brand.js';
import { isNexusReport, parseNexusReport, nexusSource, parseCalendar, claudeInstructions } from './importers.js';

// ── Formulario en hoja: guardar con su estado y su respuesta ──

function formSheet(title, body, onSave, { save = 'Guardar', danger, subtitle } = {}) {
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('check'), save);
  const actions = [
    danger && el('button', { type: 'button', class: 'cl-btn ghost is-danger is-icon', 'aria-label': danger.label, onclick: async () => {
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
    { label: 'Pegar reporte de Nexus', icon: 'copy', note: 'Se publica tarea por tarea', run: () => pasteReport() },
    { label: 'Importar calendario de Claude', icon: 'sparkles', note: 'Varias publicaciones de una vez', run: () => importCalendar() },
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
export function dailyReport(prefill = [], meta = null) {
  const rows = [];
  const list = el('div', { class: 'cl-report-lines' });
  let day = meta?.day || todayKey();
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
  for (const p of prefill) addLine(p.title, p.status || 'done', p.minutes || null, p.source || null);
  if (!prefill.length) addLine();
  let notify = true;
  const prevMeta = (app.data.reports || []).find((r) => r.day === day);
  const author = input({ value: meta?.author || prevMeta?.author || '', maxLength: 120, placeholder: 'Quién lo manda (opcional)' });
  const blockers = textarea({ value: meta?.blockers || prevMeta?.blockers || '', maxLength: 4000, rows: 2, placeholder: 'Lo que frenó el trabajo (opcional)' });
  const notes = textarea({ value: meta?.notes || prevMeta?.notes || '', maxLength: 4000, rows: 2, placeholder: 'Observaciones o sugerencias (opcional)' });
  const today = app.data.work.filter((w) => w.day === day);
  const existing = today.length ? el('div', { class: 'cl-report-today' },
    el('small', { class: 'cl-eyebrow', text: day === todayKey() ? 'Ya en el reporte de hoy' : `Ya en el reporte del ${dayLabel(day).toLowerCase()}` }),
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
  const ui = formSheet(meta ? 'Reporte de Nexus' : 'Reporte de hoy', [
    meta
      ? el('p', { class: 'cl-form-hint' }, icon('check'), `${plural(prefill.length, 'tarea leída', 'tareas leídas')} del reporte${meta.author ? ` de ${meta.author}` : ''}. Revisa y publica: cada una queda como una línea del reporte.`)
      : el('p', { class: 'cl-form-hint', text: 'Cada línea es algo que hiciste. Toca el círculo para marcarla como hecha, en curso o planificada.' }),
    field('Día', datePicker(day, (v) => { day = v || todayKey(); }, { allowEmpty: false, quick: [['Hoy', 0], ['Ayer', -1]] })),
    existing,
    list,
    el('div', { class: 'cl-row-actions' },
      el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => addLine() }, icon('plus'), 'Otra línea'),
      hasImport && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => { ui?.close(); importFromNegocio(); } }, icon('download'), 'Traer de Negocio'),
      !meta && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => { ui?.close(); pasteReport(); } }, icon('copy'), 'Pegar de Nexus'),
    ),
    el('details', { class: 'cl-report-notes', open: Boolean(meta?.blockers || meta?.notes || meta?.author) },
      el('summary', { text: 'Notas del día' }),
      el('div', { class: 'cl-form' }, field('Quién lo manda', author), field('Dificultades o bloqueos', blockers), field('Observaciones o sugerencias', notes), el('p', { class: 'cl-form-hint', text: 'El cliente las ve debajo del reporte de ese día.' })),
    ),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Un solo aviso con lo hecho ese día' }),
  ], async () => {
    const items = rows.filter((r) => val(r.title)).map((r) => ({ ...r, source: r.source || (meta ? nexusSource(day, val(r.title)) : null) }));
    const fresh = items.filter((r) => !r.source || !app.data.work.some((w) => w.source === r.source));
    const notesText = { author: val(author) || null, blockers: val(areaOf(blockers)) || null, notes: val(areaOf(notes)) || null };
    const hasNotes = Object.values(notesText).some(Boolean);
    if (!items.length && !hasNotes) return need(rows[0]?.title || list, 'Escribe al menos una línea.');
    const saved = fresh.length ? await app.backend.saveMany('work', fresh.map((r) => ({ client_id: cid(), title: val(r.title), status: r.status, minutes: r.minutes || null, day, notify, source: r.source || null }))) : [];
    for (const w of saved) upsertLocal('work', w);
    if (hasNotes || meta) {
      const report = await app.backend.saveReport({ client_id: cid(), day, ...notesText, sent_at: meta?.sentAt || prevMeta?.sent_at || new Date().toTimeString().slice(0, 5), source: meta ? 'nexus' : prevMeta?.source || 'app' });
      app.data.reports = [report, ...(app.data.reports || []).filter((r) => r.day !== day)];
    }
    const repeated = items.length - fresh.length;
    return { message: `${plural(saved.length, 'línea', 'líneas')} en el reporte${repeated ? ` (${plural(repeated, 'ya estaba', 'ya estaban')})` : ''}.`, burst: saved.length > 0 };
  }, { save: 'Publicar' });
}

/**
 * Pegar el reporte diario que copia Nexus: lo lee del portapapeles (o de lo que se pegue a
 * mano) y abre el reporte con cada tarea en su línea, listo para publicar.
 */
export async function pasteReport(text = null) {
  let raw = text;
  if (raw == null) {
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      raw = '';
    }
  }
  if (isNexusReport(raw)) return openNexus(raw);
  const area = textarea({ rows: 10, maxLength: 20000, placeholder: '📋 REPORTE DIARIO DE ACTIVIDADES…' });
  const ui = formSheet('Pegar reporte de Nexus', [
    el('p', { class: 'cl-form-hint', text: 'Copia el reporte en Nexus y pégalo aquí. Cada tarea realizada queda como una línea hecha, los pendientes como «en curso» y las dificultades y observaciones como notas del día.' }),
    area,
  ], async () => {
    const value = val(areaOf(area));
    if (!isNexusReport(value)) return need(areaOf(area), 'No parece el reporte diario: tiene que traer «Tareas realizadas».');
    setTimeout(() => openNexus(value), 320);
    return true;
  }, { save: 'Leer' });
  return ui;
}

function openNexus(raw) {
  const r = parseNexusReport(raw);
  if (!r.done.length && !r.doing.length && !r.blockers && !r.notes) return toast('El reporte no trae tareas.', 'error');
  try {
    localStorage.setItem('portal:nexus-last', String(raw.length) + raw.slice(0, 60));
  } catch {
    // sin almacenamiento
  }
  const day = r.day || todayKey();
  dailyReport([
    ...r.done.map((title) => ({ title, status: 'done', source: nexusSource(day, title) })),
    ...r.doing.map((title) => ({ title, status: 'doing', source: nexusSource(day, title) })),
  ], { ...r, day });
}

// ── Peticiones al cliente ──

export function editTask(t = null, { template } = {}) {
  const base = t || template || {};
  let due = t?.due_date || addDays(todayKey(), 3);
  let expects = base.expects || 'file';
  let priority = base.priority || 'normal';
  let status = t?.status || 'pending';
  let notify = !t;
  const title = input({ value: base.title || '', maxLength: 200, placeholder: 'Mándanos el logo en vectorial' });
  const description = textarea({ value: base.description || '', maxLength: 5000, rows: 3, placeholder: 'Qué necesitas exactamente, formato, ejemplos…' });
  const tpl = !t && !template ? templatePicker('task', (data) => { ui.close(); setTimeout(() => editTask(null, { template: data }), 320); }) : null;
  const ui = formSheet(t ? 'Editar petición' : 'Pedirle algo al cliente', [
    tpl,
    field('Qué necesitas', title),
    field('Detalles', description),
    field('Para cuándo', datePicker(due, (v) => { due = v; })),
    field('Cómo te lo manda', chips(Object.entries(EXPECTS).map(([k, [l, ico]]) => [k, l, null, ico]), expects, (v) => { expects = v; }, { scroll: true })),
    field('Prioridad', seg(Object.entries(PRIORITY).map(([k, [l]]) => [k, l]), priority, (v) => { priority = v; })),
    t && field('Estado', seg([['pending', 'Pendiente'], ['submitted', 'Enviada'], ['done', 'Revisada']], status, (v) => { status = v; })),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Y un recordatorio la mañana en que vence' }),
    el('div', { class: 'cl-row-actions' },
      saveTemplateButton('task', () => ({ title: val(title), description: val(areaOf(description)) || null, expects, priority }), () => val(title)),
      t && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => { ui.close(); setTimeout(() => editTask(null, { template: { ...t, title: `${t.title} (copia)`.slice(0, 200) } }), 320); } }, icon('copy'), 'Duplicar'),
    ),
  ], async () => {
    if (!val(title)) return need(title, '¿Qué necesitas?');
    const row = { title: val(title), description: val(areaOf(description)) || null, due_date: due || null, expects, priority, notify };
    if (t) Object.assign(row, { status, done_at: status === 'done' ? t.done_at || new Date().toISOString() : null, submitted_at: status === 'pending' ? null : t.submitted_at });
    await persist('tasks', row, t);
    return { message: t ? 'Guardado.' : notify ? 'Pedido y avisado.' : 'Pedido.' };
  }, { save: t ? 'Guardar' : 'Pedir', danger: t && { label: 'Borrar', confirm: '¿Borrar esta petición?', run: async () => { await app.backend.remove('tasks', t.id); removeLocal('tasks', t.id); } } });
}

// ── Plantillas (publicaciones y peticiones, para todos los portales) ──

/** Una tira «Desde plantilla» que se llena sola si hay plantillas de ese tipo. */
function templatePicker(kind, onPick) {
  const box = el('div');
  app.backend.templates().then((all) => {
    const list = all.filter((x) => x.kind === kind);
    if (!list.length) return;
    // Dos botones hermanos en una píldora: usarla y borrarla (un botón dentro de otro no vale).
    fill(box, field('Desde plantilla', el('div', { class: 'cl-chips is-scroll' }, list.map((x) => {
      const chip = el('span', { class: 'cl-fchip cl-tpl' },
        el('button', { type: 'button', class: 'cl-tpl-use', onclick: () => { react('tick'); onPick(x.data); } }, icon('layers'), x.name),
        el('button', { type: 'button', class: 'cl-tpl-x', 'aria-label': `Borrar la plantilla ${x.name}`, onclick: async () => {
          if (!(await confirmSheet(`¿Borrar la plantilla «${x.name}»?`, { yes: 'Borrar', danger: true }))) return;
          try {
            await app.backend.removeTemplate(x.id);
            chip.remove();
          } catch (err) {
            toast(err.message, 'error');
          }
        } }, icon('x')),
      );
      return chip;
    }))));
  }).catch(() => {});
  return box;
}

function saveTemplateButton(kind, collect, nameOf) {
  return el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: async (e) => {
    const name = (nameOf() || '').replace(/^(reel|post|carrusel|historia|v[ií]deo)\s*:\s*/i, '').trim();
    if (!name) return toast('Ponle un título primero: será el nombre de la plantilla.', 'error');
    const btn = e.currentTarget;
    btn.classList.add('is-busy');
    try {
      await app.backend.saveTemplate({ kind, name: name.slice(0, 120), data: collect() });
      react('success');
      toast(`Plantilla «${name.slice(0, 40)}» guardada para todos los clientes.`, 'ok');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.classList.remove('is-busy');
    }
  } }, icon('layers'), 'Guardar como plantilla');
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

// Qué se prepara en cada formato: un estático no tiene guion ni duración.
const PRODUCTION = {
  post: ['design', 'Diseño', 'Arte final e inspiración'],
  carrusel: ['slides', 'Diapositivas', 'Arte final e inspiración'],
  historia: ['frames', 'Pantallas', 'Arte final e inspiración'],
  reel: ['video', 'Grabación', 'Material y referencias'],
  video: ['video', 'Grabación', 'Material y referencias'],
  articulo: ['article', 'El texto', 'Imágenes y fuentes'],
  otro: ['notes', 'Producción', 'Material y referencias'],
};

/** Una lista que crece: el texto de cada diapositiva o de cada pantalla. */
function listEditor(items, label, placeholder) {
  const box = el('div', { class: 'cl-list-edit' });
  const draw = () => fill(box,
    items.map((txt, i) => {
      const area = textarea({ value: txt, maxLength: 1000, rows: 2, placeholder: `${placeholder} ${i + 1}` });
      areaOf(area).addEventListener('input', (e) => { items[i] = e.target.value; });
      return el('div', { class: 'cl-list-edit-row' },
        el('span', { class: 'cl-list-edit-n', text: String(i + 1) }),
        area,
        el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': `Quitar ${label.toLowerCase()} ${i + 1}`, onclick: () => { items.splice(i, 1); react('off'); draw(); } }, icon('x')),
      );
    }),
    items.length < 20 && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => {
      items.push('');
      react('pop');
      draw();
      requestAnimationFrame(() => [...box.querySelectorAll('textarea')].at(-1)?.focus());
    } }, icon('plus'), `Añadir ${label.toLowerCase()}`),
  );
  draw();
  return box;
}

export function editContent(c = null, { date: preDate, template } = {}) {
  const base = c || template || {};
  let channels = c || template?.channels?.length || template?.channel ? [...channelsOf(base)] : ['instagram'];
  let format = base.format || 'reel';
  let status = c?.status || 'review';
  let funnel = base.funnel || '';
  let notify = !c;
  let assets = [...(c?.assets || [])];
  let refs = [...(base.refs || [])];
  const prod = { ...(base.production || {}) };
  const slides = [...(prod.slides || [])];
  const frames = [...(prod.frames || [])];
  const title = input({ value: base.title || '', maxLength: 200, placeholder: 'Reel: así tostamos el café' });
  const date = el('input', { type: 'date', class: 'cl-input', value: c?.date || preDate || addDays(todayKey(), 1) });
  const time = el('input', { type: 'time', class: 'cl-input', value: c?.time?.slice(0, 5) || base.time?.slice?.(0, 5) || '18:00' });
  const pillar = input({ value: base.pillar || '', maxLength: 80, placeholder: 'Proceso, Educación, Promociones…', list: 'cl-pillars' });
  const pillars = el('datalist', { id: 'cl-pillars' }, [...new Set(app.data.content.map((x) => x.pillar).filter(Boolean))].map((p) => el('option', { value: p })));
  const objective = textarea({ value: base.objective || '', maxLength: 500, rows: 2, placeholder: 'Para qué sirve esta pieza' });
  const cta = input({ value: base.cta || '', maxLength: 200, placeholder: 'Escríbenos por WhatsApp' });
  const campaign = input({ value: base.campaign || '', maxLength: 120, placeholder: 'Noviembre, Lanzamiento…' });
  const caption = textarea({ value: base.caption || '', maxLength: 2200, rows: 4, placeholder: 'El texto que acompaña la publicación' }, { counter: true });
  const hashtags = input({ value: base.hashtags || '', maxLength: 1000, placeholder: '#cafedeespecialidad #caracas' });
  const script = textarea({ value: base.script || '', maxLength: 8000, rows: 4, placeholder: '0–3 s: …\n3–8 s: …' });
  const duration = input({ value: base.duration || '', maxLength: 40, placeholder: '20 s' });
  const notes = textarea({ value: base.notes || '', maxLength: 5000, rows: 2, placeholder: 'Lugar, música, tono, lo que deba saber el cliente…' });
  const headline = input({ value: prod.headline || '', maxLength: 500, placeholder: 'El texto grande de la pieza' });
  const designNotes = textarea({ value: prod.design_notes || '', maxLength: 3000, rows: 3, placeholder: 'Foto o fondo, colores, composición, logo…' });
  const outline = textarea({ value: prod.outline || '', maxLength: 5000, rows: 4, placeholder: 'Introducción, puntos, cierre…' });
  const keyword = input({ value: prod.keyword || '', maxLength: 100, placeholder: 'café de especialidad en Caracas' });
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

  // La producción cambia con el formato.
  const prodSec = el('section', { class: 'cl-form-sec' });
  const matTitle = el('h4');
  const drawProduction = () => {
    const [kind, heading, material] = PRODUCTION[format] || PRODUCTION.otro;
    matTitle.textContent = material;
    fill(prodSec, el('h4', { text: heading }),
      kind === 'design' && [field('Texto en la pieza', headline), field('Indicaciones de diseño', designNotes)],
      kind === 'slides' && [field('Texto de cada diapositiva', listEditor(slides, 'Diapositiva', 'Diapositiva')), field('Indicaciones de diseño', designNotes)],
      kind === 'frames' && [field('Lo que va en cada pantalla', listEditor(frames, 'Pantalla', 'Pantalla')), field('Indicaciones de diseño', designNotes)],
      kind === 'video' && [field('Guion', script), el('div', { class: 'cl-grid2' }, field('Duración', duration), el('span')), field('Notas de grabación', notes)],
      kind === 'article' && [field('Esquema', outline), field('Palabra clave', keyword)],
      kind === 'notes' && field('Notas', notes),
    );
  };
  drawProduction();

  // Lo que se guarda (y lo que va a una plantilla: todo menos el día, el estado y los archivos).
  const production = () => {
    const out = {};
    const put = (k, v) => {
      if (v && !(Array.isArray(v) && !v.length)) out[k] = v;
    };
    put('headline', val(headline));
    put('design_notes', val(areaOf(designNotes)));
    put('slides', slides.map((x) => x.trim()).filter(Boolean));
    put('frames', frames.map((x) => x.trim()).filter(Boolean));
    put('outline', val(areaOf(outline)));
    put('keyword', val(keyword));
    return out;
  };
  const collect = () => ({
    title: val(title), channels, channel: channels[0], format, funnel: funnel || null,
    pillar: val(pillar) || null, objective: val(areaOf(objective)) || null, cta: val(cta) || null, campaign: val(campaign) || null,
    caption: val(areaOf(caption)) || null, hashtags: val(hashtags) || null, script: val(areaOf(script)) || null, duration: val(duration) || null,
    notes: val(areaOf(notes)) || null, refs, production: production(),
  });

  const tpl = !c && !template ? templatePicker('content', (data) => { ui.close(); setTimeout(() => editContent(null, { date: date.value, template: data }), 320); }) : null;
  const ui = formSheet(c ? 'Editar publicación' : 'Nueva publicación', [
    tpl,
    c?.origin === 'client' && el('p', { class: 'cl-form-hint' }, icon('sparkles'), 'La propuso el cliente. Pásala a «En producción» o «Para revisar» cuando la tomes.'),
    el('section', { class: 'cl-form-sec' }, el('h4', { text: 'Lo básico' }),
      field('Título', title),
      el('div', { class: 'cl-grid2' }, field('Día', date), field('Hora', time)),
      field('Redes', chips(Object.entries(CHANNEL).filter(([k]) => k !== 'google').map(([k, [l, color, ico]]) => [k, l, color, ico]), channels, (v) => { channels = v; }, { multi: true, scroll: true }), 'Elige todas las redes donde sale la misma pieza.'),
      field('Formato', chips(Object.entries(FORMAT).map(([k, l]) => [k, l]), format, (v) => { format = v; drawProduction(); }, { scroll: true })),
      field('Estado', chips(STATUS_ORDER.map((k) => [k, CONTENT_STATUS[k][0], CONTENT_STATUS[k][1]]), status, (v) => { status = v; }, { scroll: true }), 'En «Para revisar» el cliente puede aprobarla, pedir cambios o rechazarla.'),
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
    prodSec,
    el('section', { class: 'cl-form-sec' }, matTitle,
      current, picker.node,
      field('Referencias', refsBox),
      field('Enlace a la pieza', link),
    ),
    switchRow('Avisar a su teléfono', notify, (v) => { notify = v; }, { ico: 'bell', tone: 'var(--cf-expense)', sub: 'Si está «Para revisar», le pide que la apruebe' }),
    el('div', { class: 'cl-row-actions' }, saveTemplateButton('content', () => { const { channel, ...data } = collect(); return data; }, () => val(title))),
  ], async () => {
    if (!val(title)) return need(title, 'Ponle un título.');
    if (!date.value) return need(date, 'Elige el día.');
    if (!channels.length) {
      toast('Elige al menos una red.', 'error');
      return false;
    }
    const files = picker.files();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = await uploadTo('contenido', f, (p) => picker.progress((i + p) / files.length));
      assets.push({ path, kind: f.type.startsWith('video/') ? 'video' : 'image', name: f.name });
    }
    picker.progress(null);
    await signPaths(assets.map((a) => a.path).filter(Boolean));
    const row = {
      ...collect(), date: date.value, time: time.value || null, status, link: safeUrl(val(link)), assets,
      image_url: assets.find((a) => a.kind === 'image')?.path || c?.image_url || null, notify,
    };
    // Volver a pedir revisión borra la respuesta anterior del cliente.
    if (c && status === 'review' && c.status !== 'review') Object.assign(row, { client_verdict: null, client_note: null, client_verdict_at: null });
    await persist('content', row, c);
    return { message: c ? 'Guardado.' : 'Añadida al calendario.', burst: !c };
  }, { danger: c && { label: 'Borrar', confirm: '¿Borrar esta publicación del calendario?', run: async () => { await app.backend.remove('content', c.id); removeLocal('content', c.id); } } });
}

/** Una copia como idea, para repetir una pieza que funcionó. */
export async function duplicateContent(c) {
  const { id, created_at, updated_at, client_verdict, client_note, client_verdict_at, client_verdict_by, client_verdict_name, created_by, origin, image_url, assets, ...rest } = c;
  try {
    const saved = await persist('content', { ...rest, title: `${c.title} (copia)`.slice(0, 200), status: 'idea', notify: false, assets: [], image_url: null });
    react('success');
    toast('Duplicada como idea, sin los archivos.', 'ok');
    redraw();
    setTimeout(() => editContent(app.data.content.find((x) => x.id === saved.id) || saved), 320);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/** Cambiar el día de una publicación (en el teléfono, en vez de arrastrarla). */
export function moveContent(c) {
  let day = c.date;
  formSheet('Mover de día', [
    el('p', { class: 'cl-form-hint', text: `«${c.title}» sale ${dayLabel(c.date).toLowerCase()}.` }),
    field('Nuevo día', datePicker(day, (v) => { day = v; }, { allowEmpty: false, quick: [['Mañana', 1], ['En 3 días', 3], ['1 semana', 7], ['2 semanas', 14]] })),
  ], async () => {
    if (!day || day === c.date) return true;
    await persist('content', { date: day }, c);
    return { message: `Movida al ${fDay.format(dayDate(day))}.` };
  }, { save: 'Mover' });
}

/** Lo que el estudio puede hacer con una publicación, sin abrir el formulario entero. */
export function contentActions(c) {
  return actionSheet(c.title, [
    { label: 'Editar', icon: 'edit', run: () => editContent(c) },
    { label: 'Duplicar', icon: 'copy', note: 'Una copia como idea', run: () => duplicateContent(c) },
    { label: 'Mover de día', icon: 'calendar', run: () => moveContent(c) },
    { label: 'Borrar', icon: 'trash', danger: true, run: async () => {
      if (!(await confirmSheet(`¿Borrar «${c.title}» del calendario?`, { yes: 'Borrar', danger: true }))) return;
      try {
        await app.backend.remove('content', c.id);
        removeLocal('content', c.id);
        react('off');
        redraw();
      } catch (err) {
        toast(err.message, 'error');
      }
    } },
  ], { message: `${cap(fDay.format(dayDate(c.date)))} · ${CONTENT_STATUS[c.status]?.[0] || ''}` });
}

/** Varias publicaciones a la vez: el mismo estado o fuera del calendario. */
export async function bulkContent(items, done) {
  const picked = await actionSheet(plural(items.length, 'publicación', 'publicaciones'), [
    ...STATUS_ORDER.map((k) => ({ label: `Mover a «${CONTENT_STATUS[k][0]}»`, icon: k === 'published' ? 'check' : 'swap', value: k })),
    { label: 'Borrar', icon: 'trash', danger: true, value: 'delete' },
  ]);
  const choice = picked?.value;
  if (!choice) return;
  if (choice === 'delete' && !(await confirmSheet(`¿Borrar ${plural(items.length, 'publicación', 'publicaciones')}?`, { yes: 'Borrar', danger: true }))) return;
  let ok = 0;
  for (const c of items) {
    try {
      if (choice === 'delete') {
        await app.backend.remove('content', c.id);
        removeLocal('content', c.id);
      } else {
        const patch = { id: c.id, status: choice };
        if (choice === 'review') Object.assign(patch, { client_verdict: null, client_note: null, client_verdict_at: null, notify: true });
        if (choice === 'published') patch.notify = true;
        upsertLocal('content', await app.backend.save('content', patch));
      }
      ok++;
    } catch (err) {
      toast(err.message, 'error');
      break;
    }
  }
  react('success');
  toast(choice === 'delete' ? `${plural(ok, 'borrada', 'borradas')}.` : `${plural(ok, 'publicación', 'publicaciones')} en «${CONTENT_STATUS[choice][0]}».`, 'ok');
  done?.();
  redraw();
}

export async function setContentStatus(c, status) {
  try {
    // Al mandarla a revisar o publicarla se avisa aunque se creara en silencio (lo de Claude entra así).
    const patch = { id: c.id, status, ...(status === 'review' || status === 'published' ? { notify: true } : {}) };
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
  }, { danger: l && app.studio && { label: 'Borrar', confirm: '¿Borrar este lead?', run: async () => { await app.backend.remove('leads', l.id); removeLocal('leads', l.id); } } });
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
  if (it.kind === 'changes' || it.kind === 'rejected' || it.kind === 'idea') {
    const [label, ico] = it.kind === 'idea' ? ['Propone una publicación', 'sparkles'] : it.kind === 'rejected' ? [`${r.client_verdict_name || 'El cliente'} la rechazó`, 'x'] : [`${r.client_verdict_name || 'El cliente'} pide cambios`, 'edit'];
    return el('a', { ...base, href: `#/marketing/pieza/${r.id}` },
      el('span', { class: `cl-inbox-ico is-${it.kind}` }, icon(ico)),
      el('div', { class: 'cl-inbox-main' }, el('b', { text: label }), el('p', { text: r.title }), r.client_note && el('small', { class: 'cl-inbox-note', text: `«${r.client_note}»` }), el('small', { text: ago(it.at) })),
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
    actions: app.studio ? [
      el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => { ui.close(); setTimeout(overviewSheet, 320); } }, icon('sun'), 'Hoy en todos'),
      el('button', { type: 'button', class: 'cl-btn', onclick: () => { ui.close(); editPortal(null, onPick); } }, icon('plus'), 'Nuevo portal'),
    ] : null,
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
    c && group(null, rowLink('Permisos del cliente', { ico: 'key', tone: 'var(--cf-purple)', sub: 'Qué ve y qué puede hacer su gente', onClick: () => portalPermsSheet() })),
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
      el('span', { class: 'cl-set-main' }, el('b', { text: m.name || m.email }), el('small', { text: `${ROLES[m.role]?.[0] || 'Equipo'}${Object.keys(m.perms || {}).length ? ' con excepciones' : ''} · ${m.last_seen_at ? `entró ${ago(m.last_seen_at)}` : 'aún no ha entrado'}` })),
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
      { label: 'Rol y permisos', icon: 'lock', note: 'Qué ve y qué puede hacer', run: () => memberPermsSheet(m, draw) },
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
  sheet('Accesos', box, {
    subtitle: app.client.name,
    actions: [el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => portalPermsSheet() }, icon('key'), 'Permisos del cliente')],
  });
}

// ── Permisos (la misma regla que la base) ──

const hiddenAsPerms = (hidden = []) => Object.fromEntries(Object.entries(SECTION_PERM).filter(([s]) => hidden.includes(s)).map(([, k]) => [k, false]));

/** Lo que permite el portal entero: lo que su gente puede ver y hacer. */
export function portalPermsSheet() {
  const c = app.client;
  const draft = { ...hiddenAsPerms(c.hidden), ...(c.perms || {}) };
  const box = el('div', { class: 'cl-perms' });
  const draw = () => fill(box,
    el('p', { class: 'cl-form-hint', text: `Lo que la gente de ${c.name} puede ver y hacer. «Solo lectura» nunca hace más que ver, y a cada persona le puedes poner excepciones en Accesos.` }),
    PERMS.map(([title, list]) => group(title, ...list.map(([k, label, sub]) => switchRow(label, portalAllows({ perms: draft }, k), (on) => { draft[k] = on; }, { sub })))),
  );
  draw();
  formSheet('Permisos del cliente', [box], async () => {
    Object.assign(app.client, await app.backend.updateClient(c.id, { perms: draft, hidden: [] }));
    return { message: 'Permisos guardados.' };
  }, { subtitle: c.name });
}

/** El rol de una persona y sus excepciones (lo que no sigue a su portal). */
function memberPermsSheet(m, after) {
  const portal = app.client;
  let role = m.role || 'member';
  const draft = { ...hiddenAsPerms(m.hidden), ...(m.perms || {}) };
  const box = el('div', { class: 'cl-perms' });
  const draw = () => fill(box,
    field('Rol', seg(Object.entries(ROLES).map(([k, [l]]) => [k, l]), role, (v) => { role = v; draw(); }), ROLES[role]?.[1]),
    el('p', { class: 'cl-form-hint', text: 'Lo marcado con un punto es una excepción para esta persona; lo demás sigue a su rol y a lo que permite el portal.' }),
    PERMS.map(([title, list]) => group(title, ...list.map(([k, label]) => {
      const own = k in draft;
      const row = switchRow(label, memberCan({ role, perms: draft }, portal, k), (on) => { draft[k] = on; draw(); }, { sub: own ? 'Excepción para esta persona' : !roleAllows(role, k) ? `${ROLES[role]?.[0] || 'Su rol'}: no lo incluye` : portalAllows(portal, k) ? 'Como su rol y su portal' : 'El portal no lo permite' });
      row.classList.toggle('is-override', own);
      return row;
    }))),
    Object.keys(draft).length > 0 && el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => { for (const k of Object.keys(draft)) delete draft[k]; react('off'); draw(); } }, icon('refresh'), 'Quitar las excepciones'),
  );
  draw();
  formSheet(m.name || m.email, [box], async () => {
    const saved = await app.backend.updateMember(app.client.id, m.user_id, { role, perms: draft, hidden: [] });
    upsertMember({ ...m, ...saved });
    after?.();
    return { message: 'Guardado.' };
  }, { subtitle: 'Rol y permisos' });
}

// ── Hoy en todos los clientes ──

/** Al estudio: lo que pide atención hoy en cada portal, en una sola lista. */
export async function overviewSheet() {
  const box = el('div', { class: 'cl-overview' }, el('div', { class: 'cl-skel' }, el('i'), el('i')));
  const ui = sheet('Hoy en todos', box, { subtitle: cap(fDay.format(new Date())), className: 'is-tall' });
  let data;
  try {
    data = await app.backend.overview();
  } catch (err) {
    fill(box, el('p', { class: 'cl-form-hint', text: err.message }));
    return;
  }
  const go = (clientId, route) => {
    ui.close();
    document.dispatchEvent(new CustomEvent('portal:open', { detail: { id: clientId, route } }));
  };
  const sections = data.clients.map((client) => {
    const mine = (rows) => rows.filter((r) => r.client_id === client.id);
    const content = mine(data.content);
    const groups = [
      ['Te respondieron', 'edit', 'var(--cf-orange)', content.filter((c) => ['changes', 'rejected'].includes(c.client_verdict) && !['scheduled', 'published'].includes(c.status)).map((c) => [`${VERDICT[c.client_verdict][0]}: ${c.title}`, `#/marketing/pieza/${c.id}`]), ['respuesta', 'respuestas']],
      ['Ideas del cliente', 'sparkles', 'var(--cf-purple)', content.filter((c) => c.origin === 'client' && c.status === 'idea').map((c) => [c.title, `#/marketing/pieza/${c.id}`]), ['idea', 'ideas']],
      ['Sale hoy', 'calendar', 'var(--cf-blue)', content.filter((c) => c.date === data.today && c.status !== 'published').map((c) => [`${c.time ? `${c.time.slice(0, 5)} · ` : ''}${c.title} · ${CONTENT_STATUS[c.status]?.[0] || ''}`, `#/marketing/pieza/${c.id}`]), ['sale hoy', 'salen hoy']],
      ['Esperando su aprobación', 'clock', 'var(--cf-primary)', content.filter((c) => c.status === 'review' && !c.client_verdict).map((c) => [c.title, `#/marketing/pieza/${c.id}`]), ['por aprobar', 'por aprobar']],
      ['Peticiones', 'inbox', 'var(--cf-expense)', mine(data.tasks).map((t) => [`${t.status === 'submitted' ? 'Enviada' : 'Vencida'}: ${t.title}`, t.status === 'submitted' ? '#/peticiones/enviadas' : '#/peticiones']), ['petición', 'peticiones']],
      ['Te enviaron', 'send', 'var(--cf-income)', mine(data.submissions).map((s) => [`${s.author || 'El cliente'}: ${SENT_KIND[s.kind]?.[0].toLowerCase() || 'algo'}`, '#/']), ['envío', 'envíos']],
    ].filter(([, , , items]) => items.length);
    const total = groups.reduce((n, [, , , items]) => n + items.length, 0);
    return { client, groups, total };
  }).sort((a, b) => b.total - a.total);
  const busy = sections.filter((x) => x.total);
  fill(box,
    busy.length ? null : el('div', { class: 'cl-empty' }, el('span', { class: 'cl-empty-ico' }, icon('checkCircle')), el('b', { text: 'Todo en orden' }), el('p', { text: 'Nada pendiente hoy en ningún cliente.' })),
    busy.map(({ client, groups, total }, i) => el('section', { class: 'cl-ov-client', style: { '--accent': client.accent, '--i': Math.min(i, 8) } },
      el('button', { type: 'button', class: 'cl-ov-head', onclick: () => go(client.id, '#/') },
        el('span', { class: 'cl-logo' }, urlOf(client.logo_url) ? el('img', { src: urlOf(client.logo_url), alt: '' }) : initials(client.name)),
        el('span', { class: 'cl-set-main' }, el('b', { text: client.name }), el('small', { text: groups.map(([, , , items, [one, many]]) => plural(items.length, one, many)).join(' · ') })),
        el('i', { class: 'cl-badge', text: String(total) }),
      ),
      groups.map(([label, ico, color, items]) => el('div', { class: 'cl-ov-group', style: { '--c': color } },
        el('small', { class: 'cl-eyebrow' }, icon(ico), label),
        items.slice(0, 4).map(([text, route]) => el('button', { type: 'button', class: 'cl-ov-item', onclick: () => go(client.id, route) }, el('span', { text }), icon('right'))),
        items.length > 4 && el('small', { class: 'cl-ov-more', text: `y ${items.length - 4} más` }),
      )),
    )),
    sections.length > busy.length && el('p', { class: 'cl-form-hint', text: `Sin pendientes: ${sections.filter((x) => !x.total).map((x) => x.client.name).join(', ')}.` }),
  );
}

// ── Importar el calendario que preparó Claude ──

export function importCalendar() {
  const area = textarea({ rows: 8, maxLength: 400000, placeholder: 'Pega aquí el bloque que te dio Claude ([ { "titulo": … } ])' });
  const preview = el('div', { class: 'cl-import-preview' });
  let parsed = null;
  let timer = 0;
  const read = () => {
    const raw = val(areaOf(area));
    if (!raw) {
      parsed = null;
      fill(preview);
      return;
    }
    try {
      parsed = parseCalendar(raw);
    } catch (err) {
      parsed = null;
      fill(preview, el('p', { class: 'cl-form-hint is-error' }, icon('alert'), err.message));
      return;
    }
    const { rows, errors } = parsed;
    const byChannel = {};
    for (const r of rows) for (const ch of r.channels) byChannel[ch] = (byChannel[ch] || 0) + 1;
    const dates = rows.map((r) => r.date).sort();
    fill(preview,
      el('p', { class: 'cl-import-sum' }, icon('checkCircle'), el('b', { text: plural(rows.length, 'publicación', 'publicaciones') }), rows.length > 0 && ` · del ${fDay.format(dayDate(dates[0]))} al ${fDay.format(dayDate(dates.at(-1)))}`),
      el('div', { class: 'cl-chips is-wrap' }, Object.entries(byChannel).map(([ch, n]) => el('span', { class: 'cl-chip', style: { '--c': CHANNEL[ch]?.[1] } }, icon(CHANNEL[ch]?.[2] || 'globe'), `${CHANNEL[ch]?.[0] || ch} ${n}`))),
      el('div', { class: 'cl-import-list' }, rows.slice(0, 40).map((r) => el('div', { class: 'cl-import-row' },
        el('small', { text: `${r.date.slice(8)}/${r.date.slice(5, 7)}` }),
        el('span', { text: r.title }),
        el('small', { text: `${FORMAT[r.format]} · ${r.channels.map((x) => CHANNEL[x]?.[0] || x).join(', ')}` }),
      ))),
      rows.length > 40 && el('small', { class: 'cl-form-hint', text: `y ${rows.length - 40} más` }),
      errors.length > 0 && el('div', { class: 'cl-import-errors' }, el('b', { text: `${plural(errors.length, 'no se puede cargar', 'no se pueden cargar')}:` }), errors.map((e) => el('small', { text: e }))),
    );
  };
  areaOf(area).addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(read, 250);
  });
  formSheet('Importar calendario', [
    el('p', { class: 'cl-form-hint', text: `Pega el bloque que te dio Claude. Entran como «Idea» en el calendario de ${app.client.name} y el cliente no se entera hasta que las mandes a revisar.` }),
    el('div', { class: 'cl-row-actions' },
      el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => copyText(claudeInstructions(app.client.name), 'Instrucciones copiadas: pégalas en Claude.') }, icon('copy'), 'Copiar instrucciones para Claude'),
      el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: async () => {
        try {
          areaOf(area).value = await navigator.clipboard.readText();
          read();
        } catch {
          toast('No pude leer el portapapeles: pégalo a mano.', 'error');
        }
      } }, icon('download'), 'Pegar'),
    ),
    area,
    preview,
  ], async () => {
    if (!parsed?.rows.length) {
      toast('Pega primero el bloque de Claude.', 'error');
      return false;
    }
    if (parsed.errors.length && !(await confirmSheet(`¿Cargar las ${parsed.rows.length} que están bien?`, { message: `${plural(parsed.errors.length, 'no se carga', 'no se cargan')}.`, yes: 'Cargar' }))) return false;
    const saved = await app.backend.saveMany('content', parsed.rows.map((r) => ({ ...r, client_id: cid() })));
    for (const x of saved) upsertLocal('content', x);
    app.data.content.sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
    return { message: `${plural(saved.length, 'publicación', 'publicaciones')} en el calendario, como idea.`, burst: true };
  }, { save: 'Importar' });
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

