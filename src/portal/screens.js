// Pantallas de la app del portal: Inicio, Cronología, Recursos y Peticiones (más la hoja
// «Enviar»). Marketing vive en marketing.js y el perfil en profile.js.
// Cada pantalla devuelve { node, title, large, sub } y la app la pinta bajo la barra.

import {
  el, fill, icon, toast, sheet, actionSheet, confirmSheet, field, input, textarea, seg, chips, countUp, burst, chip, emptyBox, sectionHead, more, filePicker, ago, dayLabel, dueText, todayKey, localDay, addDays, fDay, fTime, dayDate, cap, sizeText, safeUrl, hostOf, plural, minutesText, compact, still, fMonth,
} from './kit.js';
import { react, onLongPress } from './feel.js';
import {
  app, redraw, isStudio, isMine, myName, feed, attention, pendingTasks, toReview, workToday, doingNow, visibleContent, upsertLocal, removeLocal, can, POST_KIND, RESOURCE_KIND, EXPECTS, PRIORITY, SENT_KIND, WORK_STATUS, commentsOf,
} from './state.js';
import { safeName } from './data.js';
import { thread, commentCount, openThread } from './threads.js';
import * as studio from './studio.js';
import { contentRow } from './marketing.js';
import { notificationsCard, installCard } from './profile.js';

const stat = (value, label, href, tone, fmt) => el('a', { class: 'cl-stat', href, style: tone ? { '--c': tone } : null }, countUp(el('b'), value, fmt), el('span', { text: label }));

// ── Inicio ──

export function homePage() {
  return isStudio() ? studioHome() : clientHome();
}

function clientHome() {
  const name = (app.member?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const pending = pendingTasks();
  const review = toReview();
  const week = visibleContent().filter((c) => c.date >= todayKey() && c.date < addDays(todayKey(), 7)).length;
  const board = app.data.posts.filter((p) => p.kind === 'announcement' || p.pinned).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 3);
  const soon = visibleContent().filter((c) => c.date >= todayKey() && c.status !== 'published').slice(0, 4);
  const canPost = can('posts.create');
  const latest = feed().filter((x) => x.group !== 'anuncios').slice(0, 5);

  const node = el('div', { class: 'cl-stack' },
    el('section', { class: 'cl-hero' },
      el('div', { class: 'cl-hero-glow', 'aria-hidden': 'true' }),
      el('p', { class: 'cl-hero-kicker', text: app.client.brand?.app_name || app.client.name }),
      app.client.welcome && el('p', { class: 'cl-hero-text', text: app.client.welcome }),
      el('div', { class: 'cl-stats' },
        can('peticiones') && stat(pending.length, pending.length === 1 ? 'petición para ti' : 'peticiones para ti', '#/peticiones', pending.length ? 'var(--cf-orange)' : null),
        can('calendario') && stat(review.length, 'para revisar', '#/marketing', review.length ? 'var(--cf-primary)' : null),
        can('calendario') && stat(week, week === 1 ? 'publicación esta semana' : 'publicaciones esta semana', '#/marketing'),
      ),
    ),
    notificationsCard(),
    installCard(),
    can('reporte') && todayCard(),
    (board.length > 0 || canPost) && el('section', { class: 'cl-sec' },
      sectionHead('Tablón', canPost ? el('button', { type: 'button', class: 'cl-more', onclick: announceSheet }, 'Publicar', icon('plus')) : more('Todo', '#/cronologia?anuncios')),
      board.length ? el('div', { class: 'cl-list' }, board.map(postCard)) : el('p', { class: 'cl-none', text: 'Comparte un aviso con tu equipo y con el estudio.' }),
    ),
    review.length && el('section', { class: 'cl-sec' },
      sectionHead('Para revisar', more('Marketing', '#/marketing'), 'Apruébalas o pide cambios'),
      el('div', { class: 'cl-list' }, review.slice(0, 3).map((c) => contentRow(c))),
    ),
    pending.length && el('section', { class: 'cl-sec' },
      sectionHead('Lo que necesitamos de ti', more('Peticiones', '#/peticiones')),
      el('div', { class: 'cl-list' }, pending.slice(0, 3).map((t) => taskCard(t, { compact: true }))),
    ),
    can('rendimiento') && resultsTeaser(),
    soon.length && el('section', { class: 'cl-sec' },
      sectionHead('Próximo en el calendario', more('Ver mes', '#/marketing')),
      el('div', { class: 'cl-list' }, soon.map((c) => contentRow(c))),
    ),
    el('section', { class: 'cl-sec' },
      sectionHead('Lo último', more('Cronología', '#/cronologia')),
      latest.length ? el('div', { class: 'cl-card cl-mini-feed' }, latest.map((x) => feedItem(x, { compact: true }))) : emptyBox('timeline', 'Todavía no hay movimiento', 'Aquí irá apareciendo cada avance de tu proyecto.'),
    ),
  );
  return { node, title: 'Inicio', large: `${greet}${name ? `, ${name}` : ''}`, sub: cap(fDay.format(new Date())) };
}

/** Lo que el estudio hace hoy: una barra de progreso y lo que está en curso. */
function todayCard() {
  const today = workToday();
  const doing = doingNow();
  if (!today.length && !doing.length) return null;
  const done = today.filter((w) => w.status === 'done');
  const total = today.filter((w) => w.status !== 'planned').length || today.length;
  const minutes = done.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const ratio = total ? done.length / total : 0;
  const ring = el('span', { class: 'cl-ring', style: { '--p': String(ratio) } }, el('b', { text: String(done.length) }));
  return el('a', { class: 'cl-card cl-today', href: '#/cronologia/reportes' },
    el('div', { class: 'cl-today-head' },
      ring,
      el('div', {}, el('small', { class: 'cl-eyebrow', text: 'Hoy en tu proyecto' }), el('b', { text: done.length ? `${plural(done.length, 'tarea hecha', 'tareas hechas')}${minutes ? ` · ${minutesText(minutes)}` : ''}` : 'Empezamos el día' })),
      icon('right', 'cl-set-chev'),
    ),
    doing.length > 0 && el('ul', { class: 'cl-doing' }, doing.slice(0, 3).map((w) => el('li', {}, el('i', { class: 'cl-live' }), el('span', { text: w.title })))),
  );
}

function resultsTeaser() {
  const rows = app.data.metrics.filter((m) => m.channel === 'total').sort((a, b) => b.month.localeCompare(a.month));
  if (!rows.length) return null;
  const [now, prev] = rows;
  const delta = prev?.reach ? Math.round(((now.reach - prev.reach) / prev.reach) * 100) : null;
  return el('a', { class: 'cl-card cl-results-teaser', href: '#/marketing/rendimiento' },
    el('div', {}, el('small', { class: 'cl-eyebrow', text: `Resultados de ${fMonth.format(dayDate(now.month))}` }),
      el('div', { class: 'cl-teaser-nums' },
        el('span', {}, countUp(el('b'), now.reach || 0, compact), el('small', { text: 'alcance' })),
        el('span', {}, countUp(el('b'), now.leads || 0), el('small', { text: 'leads' })),
        el('span', {}, countUp(el('b'), now.new_followers || 0, (v) => `+${Math.round(v)}`), el('small', { text: 'seguidores' })),
      )),
    delta != null && el('span', { class: `cl-delta${delta < 0 ? ' is-down' : ''}` }, icon('trend'), `${delta > 0 ? '+' : ''}${delta}%`),
  );
}

function studioHome() {
  const att = attention();
  const today = workToday();
  const pending = pendingTasks();
  const leadsMonth = app.data.leads.filter((l) => l.date?.slice(0, 7) === todayKey().slice(0, 7)).length;
  const week = app.data.content.filter((c) => c.date >= todayKey() && c.date < addDays(todayKey(), 7)).length;
  const quick = [
    ['Reporte', 'tasks', 'var(--cf-income)', () => studio.dailyReport()],
    ['Anuncio', 'megaphone', 'var(--cf-orange)', () => studio.editPost()],
    ['Petición', 'inbox', 'var(--cf-expense)', () => studio.editTask()],
    ['Publicación', 'calendar', 'var(--cf-primary)', () => studio.editContent()],
    ['Recurso', 'folder', 'var(--cf-blue)', () => studio.editResource()],
    ['Lead', 'funnel', 'var(--cf-purple)', () => studio.editLead()],
    ['Resultados', 'chart', '#22c9a6', () => studio.editMetrics()],
    ['Accesos', 'key', 'var(--cf-fg-muted)', () => studio.accessSheet()],
  ];
  const node = el('div', { class: 'cl-stack' },
    el('button', { type: 'button', class: `cl-card cl-attention${att.length ? ' is-hot' : ''}`, onclick: studio.inboxSheet },
      el('span', { class: 'cl-attention-ico' }, icon(att.length ? 'inbox' : 'checkCircle')),
      el('span', { class: 'cl-set-main' }, el('b', { text: att.length ? `${plural(att.length, 'cosa', 'cosas')} para revisar` : 'Todo revisado' }), el('small', { text: att.length ? att.slice(0, 2).map((a) => a.kind === 'submission' ? `${a.row.author || 'El cliente'} envió algo` : a.kind === 'task' ? `Petición enviada: ${a.row.title}` : a.kind === 'changes' ? `Pide cambios: ${a.row.title}` : a.kind === 'rejected' ? `Rechazó: ${a.row.title}` : a.kind === 'idea' ? `Propone: ${a.row.title}` : `Comentario: ${a.row.body}`).join(' · ') : `Nada pendiente de ${app.client.name}.` })),
      att.length ? el('i', { class: 'cl-badge', text: String(att.length) }) : null,
      icon('right', 'cl-set-chev'),
    ),
    app.portals.length > 1 && el('button', { type: 'button', class: 'cl-card cl-row-set cl-overview-card', onclick: () => studio.overviewSheet() },
      el('span', { class: 'cl-set-ico', style: { '--c': 'var(--cf-orange)' } }, icon('sun')),
      el('span', { class: 'cl-set-main' }, el('b', { text: 'Hoy en todos tus clientes' }), el('small', { text: `${app.portals.length} portales: lo que sale hoy, lo que te respondieron y lo que espera` })),
      icon('right', 'cl-set-chev'),
    ),
    el('section', { class: 'cl-sec' },
      sectionHead('Crear', null, 'Le llega al cliente al momento'),
      el('div', { class: 'cl-quick' }, quick.map(([label, ico, tone, run], i) => el('button', { type: 'button', class: 'cl-quick-tile', style: { '--c': tone, '--i': i }, onclick: run }, el('span', { class: 'cl-quick-ico' }, icon(ico)), el('span', { text: label })))),
    ),
    el('section', { class: 'cl-sec' },
      sectionHead('Trabajo de hoy', el('span', { class: 'cl-head-actions' }, el('button', { type: 'button', class: 'cl-more', onclick: () => studio.pasteReport() }, 'Nexus', icon('copy')), el('button', { type: 'button', class: 'cl-more', onclick: () => studio.dailyReport() }, 'Reporte', icon('plus'))), today.length ? `${today.filter((w) => w.status === 'done').length} de ${today.length} hechas · toca para cambiar` : 'Lo que hagas hoy forma su reporte diario'),
      today.length ? el('div', { class: 'cl-card cl-work-list' }, today.map((w) => workLine(w, { editable: true }))) : emptyBox('tasks', 'Sin trabajo hoy', 'Añade lo que vas haciendo: el cliente lo ve en su cronología.', el('button', { type: 'button', class: 'cl-btn sm', onclick: () => studio.dailyReport() }, icon('plus'), 'Reporte de hoy')),
    ),
    el('div', { class: 'cl-stats is-flat' },
      stat(pending.length, 'peticiones esperando', '#/peticiones', pending.length ? 'var(--cf-orange)' : null),
      stat(toReview().length, 'piezas en revisión', '#/marketing', 'var(--cf-primary)'),
      stat(week, 'publicaciones esta semana', '#/marketing'),
      stat(leadsMonth, 'leads este mes', '#/marketing/leads', 'var(--cf-purple)'),
    ),
    notificationsCard(),
  );
  return { node, title: app.client.name, large: app.client.name, sub: `Estudio · ${app.client.industry || 'Portal del cliente'}` };
}

// ── Piezas comunes ──

export function postCard(p) {
  const [kindLabel, ico, color] = POST_KIND[p.kind] || POST_KIND.update;
  const fromClient = p.origin === 'client';
  const label = fromClient ? `${isMine(p) ? 'Tú' : p.author || 'Tu equipo'}` : kindLabel;
  const link = safeUrl(p.link);
  const card = el('article', { class: `cl-card cl-post${p.pinned ? ' is-pinned' : ''}${fromClient ? ' is-client' : ''}`, style: { '--c': fromClient ? 'var(--cf-purple)' : color } },
    el('header', {},
      el('span', { class: 'cl-post-ico' }, icon(fromClient ? 'user' : ico)),
      el('span', { class: 'cl-post-meta' }, el('b', { text: p.pinned ? `${label} · fijado` : label }), el('small', { text: ago(p.occurred_at) })),
      isStudio() && el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Editar', onclick: () => studio.editPost(p) }, icon('edit')),
      !isStudio() && fromClient && isMine(p) && el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Quitar mi anuncio', onclick: async () => {
        if (!(await confirmSheet('¿Quitar tu anuncio?', { yes: 'Quitar', danger: true }))) return;
        try {
          await app.backend.remove('posts', p.id);
          removeLocal('posts', p.id);
          react('off');
          redraw();
        } catch (err) {
          toast(err.message, 'error');
        }
      } }, icon('trash')),
    ),
    el('h3', { text: p.title }),
    p.body && el('p', { class: 'cl-prose', text: p.body }),
    el('footer', { class: 'cl-post-foot' },
      link && el('a', { class: 'cl-link', href: link, target: '_blank', rel: 'noopener' }, icon('external'), hostOf(link)),
      el('button', { type: 'button', class: 'cl-link', onclick: () => openThread('post', p.id) }, icon('chat'), commentsOf('post', p.id).length ? `${commentsOf('post', p.id).length}` : 'Comentar'),
    ),
  );
  return card;
}

/** El cliente publica un aviso en el tablón (si su portal se lo permite). */
function announceSheet() {
  const title = input({ maxLength: 200, placeholder: 'El sábado cerramos a las 15:00' });
  const body = textarea({ maxLength: 20000, rows: 4, placeholder: 'Lo que quieras contar a tu equipo y al estudio' });
  const link = input({ type: 'url', inputMode: 'url', placeholder: 'https://… (opcional)' });
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('send'), 'Publicar');
  const ui = sheet('Publicar en el tablón', el('div', { class: 'cl-form' },
    el('p', { class: 'cl-form-hint' }, icon('users'), 'Lo ve tu equipo y le llega al estudio.'),
    field('Título', title),
    field('Texto', body),
    field('Enlace', link),
  ), { actions: [btn] });
  btn.addEventListener('click', async () => {
    if (!title.value.trim()) return toast('Ponle un título.', 'error');
    const url = link.value.trim();
    if (url && !safeUrl(url)) return toast('El enlace tiene que empezar por https://', 'error');
    btn.classList.add('is-busy');
    try {
      const row = await app.backend.save('posts', { client_id: app.client.id, kind: 'announcement', title: title.value.trim(), body: (body.querySelector?.('textarea') || body).value.trim() || null, link: safeUrl(url), occurred_at: new Date().toISOString(), origin: 'client', created_by: app.user?.id, author: myName(), notify: true });
      upsertLocal('posts', row);
      react('success');
      burst(btn);
      ui.close();
      toast('Publicado en el tablón.', 'ok');
      redraw();
    } catch (err) {
      btn.classList.remove('is-busy');
      toast(err.message, 'error');
    }
  });
}

function workLine(w, { editable } = {}) {
  const [label, color, ico] = WORK_STATUS[w.status];
  const line = el('div', { class: `cl-work is-${w.status}`, style: { '--c': color } },
    el('button', { type: 'button', class: 'cl-work-dot', 'aria-label': editable ? `${label}: cambiar` : label, disabled: !editable, onclick: editable ? async (e) => {
      const next = w.status === 'done' ? 'planned' : w.status === 'doing' ? 'done' : 'doing';
      const btn = e.currentTarget;
      try {
        upsertLocal('work', await app.backend.save('work', { id: w.id, status: next }));
        if (next === 'done') {
          react('success');
          burst(btn);
        } else react('tick');
        redraw();
      } catch (err) {
        toast(err.message, 'error');
      }
    } : null }, icon(ico)),
    el('div', { class: 'cl-work-main' },
      el('b', { text: w.title }),
      el('small', {}, [w.category, w.minutes ? minutesText(w.minutes) : null, w.status === 'doing' ? 'en curso' : w.status === 'planned' ? 'planificado' : w.done_at ? fTime.format(new Date(w.done_at)) : null].filter(Boolean).join(' · ')),
      w.description && el('p', { class: 'cl-prose', text: w.description }),
    ),
    editable && el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Editar', onclick: () => studio.editWork(w) }, icon('more')),
  );
  return line;
}

const FEED_FILTERS = () => [['todo', 'Todo'], can('reporte') && ['reportes', 'Reportes'], ['anuncios', 'Anuncios'], ['avances', 'Avances'], (can('calendario') || can('rendimiento')) && ['marketing', 'Marketing'], can('peticiones') && ['peticiones', 'Peticiones'], ['tuyo', isStudio() ? 'Del cliente' : 'Lo tuyo']].filter(Boolean);

export function feedItem(x, { compact: small } = {}) {
  const seen = app.member?.last_seen_at ? new Date(app.member.last_seen_at) : new Date(0);
  const fresh = !isStudio() && !x.mine && new Date(x.at) > seen;
  if (x.report && !small) return reportCard(x, fresh);
  const link = !small && safeUrl(x.link);
  const inner = [
    el('span', { class: 'cl-tl-dot' }, icon(x.ico || 'spark')),
    el('div', { class: 'cl-tl-body' },
      el('div', { class: 'cl-tl-meta' }, el('b', { text: x.label || '' }), el('small', { text: small ? ago(x.at) : fTime.format(new Date(x.at)) }), fresh && el('i', { class: 'cl-new', text: 'nuevo' })),
      el('span', { class: 'cl-tl-title', text: x.title || '' }),
      !small && x.body && el('p', { class: 'cl-prose', text: x.body }),
      link && el('a', { class: 'cl-link', href: link, target: '_blank', rel: 'noopener' }, icon('link'), hostOf(link)),
    ),
  ];
  const props = { class: `cl-tl${x.mine ? ' is-mine' : ''}${fresh ? ' is-fresh' : ''}`, style: { '--c': x.color || 'var(--cf-primary)' } };
  const go = x.report ? '#/cronologia/reportes' : x.go;
  return go ? el('a', { ...props, href: go }, inner) : el('div', props, inner);
}

function reportCard(x, fresh) {
  const { day, items, done, minutes, meta } = x.report;
  const total = items.length;
  const who = [meta?.author, meta?.sent_at && `a las ${meta.sent_at.slice(0, 5)}`].filter(Boolean).join(' · ');
  const note = (cls, ico, title, text) => text && el('div', { class: `cl-report-note ${cls}` }, icon(ico), el('div', {}, el('b', { text: title }), el('p', { class: 'cl-prose', text })));
  return el('article', { class: `cl-card cl-report${fresh ? ' is-fresh' : ''}` },
    el('header', { class: 'cl-report-head' },
      el('span', { class: 'cl-ring sm', style: { '--p': String(total ? done.length / total : 0) } }, el('b', { text: String(done.length) })),
      el('div', {}, el('small', { class: 'cl-eyebrow', text: day === todayKey() ? 'Reporte de hoy' : `Reporte · ${dayLabel(day)}` }), el('b', { text: `${plural(done.length, 'tarea hecha', 'tareas hechas')}${minutes ? ` · ${minutesText(minutes)}` : ''}` }), who && el('small', { class: 'cl-report-who', text: who })),
      fresh && el('i', { class: 'cl-new', text: 'nuevo' }),
    ),
    el('div', { class: 'cl-work-list' }, [...items].sort((a, b) => ['doing', 'done', 'planned'].indexOf(a.status) - ['doing', 'done', 'planned'].indexOf(b.status)).map((w) => workLine(w, { editable: isStudio() }))),
    note('is-blocker', 'alert', 'Dificultades', meta?.blockers),
    note('is-note', 'message', 'Observaciones', meta?.notes),
  );
}

// ── Cronología ──

export function timelinePage(filter = 'todo') {
  const list = el('div', { class: 'cl-timeline' });
  let current = filter;
  const draw = () => {
    const items = feed().filter((x) => current === 'todo' || x.group === current);
    if (!items.length) {
      fill(list, emptyBox(current === 'reportes' ? 'tasks' : 'timeline', 'Nada por aquí', current === 'todo' ? 'Cada avance de tu proyecto aparecerá aquí.' : current === 'reportes' ? 'Aquí verás, día a día, lo que hacemos por tu marca.' : 'Prueba con otro filtro.'));
      return;
    }
    const days = new Map();
    for (const x of items) {
      const key = x.report ? x.report.day : localDay(x.at);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(x);
    }
    fill(list, [...days].map(([key, xs], i) => el('section', { class: 'cl-tl-day', style: { '--i': Math.min(i, 6) } },
      el('h3', { class: 'cl-tl-date' }, el('span', { text: dayLabel(key) }), el('small', { text: String(xs.length) })),
      xs.map((x) => feedItem(x)),
    )));
  };
  const filters = chips(FEED_FILTERS().map(([k, l]) => [k, l]), current, (v) => {
    current = v;
    history.replaceState(null, '', v === 'todo' ? '#/cronologia' : v === 'reportes' ? '#/cronologia/reportes' : `#/cronologia?${v}`);
    list.classList.remove('cl-swap');
    void list.offsetWidth;
    list.classList.add('cl-swap');
    draw();
  }, { scroll: true, label: 'Filtrar' });
  draw();
  return { node: el('div', { class: 'cl-stack' }, filters, list), title: 'Cronología', large: 'Cronología', sub: isStudio() ? 'Lo que ve el cliente, día a día' : 'Todo lo que hicimos por tu marca, día a día' };
}

// ── Recursos ──

export function resourcesPage() {
  let q = '';
  let cat = 'todo';
  const grid = el('div', { class: 'cl-res-grid' });
  const catsBox = el('div');
  const cats = [...new Set(app.data.resources.map((r) => r.category).filter(Boolean))];
  const draw = () => {
    const shown = app.data.resources.filter((r) => (cat === 'todo' || r.category === cat) && (!q || `${r.title} ${r.description || ''} ${r.category || ''}`.toLowerCase().includes(q)));
    fill(grid, shown.length ? shown.map((r, i) => resourceCard(r, i)) : emptyBox('folder', q || cat !== 'todo' ? 'Nada coincide' : 'Todavía no hay recursos', q || cat !== 'todo' ? 'Prueba con otra búsqueda.' : 'Aquí dejaremos guías, archivos y enlaces para ti.', isStudio() && el('button', { type: 'button', class: 'cl-btn sm', onclick: () => studio.editResource() }, icon('plus'), 'Añadir recurso')));
  };
  const upload = !isStudio() && can('resources.upload') && el('button', { type: 'button', class: 'cl-btn sm ghost cl-propose', onclick: uploadResource }, icon('upload'), 'Subir un recurso');
  if (cats.length) fill(catsBox, chips([['todo', 'Todo'], ...cats.map((c) => [c, c])], cat, (v) => { cat = v; draw(); }, { scroll: true }));
  const search = el('input', { type: 'search', class: 'cl-input', placeholder: 'Buscar recursos', 'aria-label': 'Buscar recursos', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
  draw();
  return { node: el('div', { class: 'cl-stack' }, el('label', { class: 'cl-search' }, icon('search'), search), upload, catsBox, grid), title: 'Recursos', large: 'Recursos', sub: 'Archivos, guías y enlaces de tu proyecto' };
}

/** El cliente comparte un archivo o un enlace en Recursos (en su carpeta). */
function uploadResource() {
  let mode = 'file';
  const title = input({ maxLength: 200, placeholder: 'Fotos del local, logo, menú…' });
  const url = input({ type: 'url', inputMode: 'url', placeholder: 'https://…' });
  const picker = filePicker({ label: 'Elige el archivo', hint: 'Hasta 50 MB' });
  const source = el('div');
  const draw = () => fill(source, mode === 'file' ? picker.node : field('Enlace', url));
  draw();
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('upload'), 'Subir');
  const ui = sheet('Subir un recurso', el('div', { class: 'cl-form' },
    seg([['file', 'Archivo'], ['link', 'Enlace']], mode, (v) => { mode = v; draw(); }),
    source,
    field('Título', title),
  ), { actions: [btn] });
  btn.addEventListener('click', async () => {
    btn.classList.add('is-busy');
    try {
      const row = { client_id: app.client.id, title: title.value.trim(), category: 'Del cliente', origin: 'client', created_by: app.user?.id, notify: false };
      if (mode === 'link') {
        row.url = safeUrl(url.value.trim());
        if (!row.url) throw new Error('Pega un enlace que empiece por https://');
        row.kind = /youtu|vimeo|loom/.test(row.url) ? 'video' : 'link';
        row.title ||= hostOf(row.url);
      } else {
        const f = picker.files()[0];
        if (!f) throw new Error('Elige un archivo.');
        const path = `${app.client.id}/recursos/${app.user.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name)}`;
        await app.backend.upload(path, f, (p) => picker.progress(p));
        picker.progress(null);
        Object.assign(row, { storage_path: path, file_name: f.name, size: f.size, mime: f.type || null, kind: f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'doc' : 'file' });
        row.title ||= f.name.replace(/\.[^.]+$/, '');
      }
      upsertLocal('resources', await app.backend.save('resources', row));
      react('success');
      ui.close();
      toast('Recurso compartido con el estudio.', 'ok');
      redraw();
    } catch (err) {
      btn.classList.remove('is-busy');
      toast(err.message, 'error');
    }
  });
}

function resourceCard(r, i) {
  const [kind, ico, color] = RESOURCE_KIND[r.kind] || RESOURCE_KIND.link;
  const card = el('button', { type: 'button', class: 'cl-res', style: { '--i': Math.min(i, 8), '--k': color }, onclick: () => openResource(r) },
    el('span', { class: 'cl-res-ico' }, icon(ico)),
    el('b', { text: r.title }),
    r.description && el('small', { text: r.description }),
    el('span', { class: 'cl-res-foot' }, el('span', { text: [kind, r.category, sizeText(r.size)].filter(Boolean).join(' · ') }), icon(r.storage_path ? 'download' : 'external')),
  );
  if (isStudio()) onLongPress(card, () => studio.editResource(r));
  return card;
}

async function openResource(r) {
  if (!isStudio() && r.origin === 'client' && isMine(r)) {
    const choice = await actionSheet(r.title, [{ label: r.storage_path ? 'Descargar' : 'Abrir', icon: r.storage_path ? 'download' : 'external' }, { label: 'Quitar', icon: 'trash', danger: true }]);
    if (!choice) return;
    if (choice.label === 'Quitar') {
      try {
        await app.backend.remove('resources', r.id);
        if (r.storage_path) await app.backend.removeFiles([r.storage_path]);
        removeLocal('resources', r.id);
        react('off');
        redraw();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
  } else if (isStudio()) {
    const choice = await actionSheet(r.title, [{ label: r.storage_path ? 'Descargar' : 'Abrir', icon: r.storage_path ? 'download' : 'external' }, { label: 'Editar', icon: 'edit', run: () => studio.editResource(r) }]);
    if (choice?.label === 'Editar' || !choice) return;
  }
  if (r.storage_path) return studio.openFile(r.storage_path);
  const url = safeUrl(r.url);
  if (url) window.open(url, '_blank', 'noopener');
}

// ── Peticiones ──

export function taskCard(t, { compact: small } = {}) {
  const [due, dueClass] = t.due_date ? dueText(t.due_date) : [null, ''];
  const [prio, prioColor] = PRIORITY[t.priority || 'normal'];
  const toggle = async (btn) => {
    if (t.status === 'done' || isStudio() || !can('tasks.submit')) return;
    const next = t.status === 'pending' ? 'submitted' : 'pending';
    btn.classList.add('is-busy');
    try {
      upsertLocal('tasks', await app.backend.save('tasks', { id: t.id, status: next }));
      if (next === 'submitted') {
        btn.closest('.cl-task')?.classList.add('is-ticked');
        burst(btn);
        react('success');
        toast('Marcada como enviada. ¡Gracias!', 'ok');
      } else react('off');
      setTimeout(redraw, next === 'submitted' && !still.matches ? 520 : 0);
    } catch (err) {
      btn.classList.remove('is-busy');
      toast(err.message, 'error');
    }
  };
  const card = el('article', { class: `cl-task is-${t.status}${t.priority === 'high' && t.status === 'pending' ? ' is-urgent' : ''}`, style: { '--c': prioColor } },
    el('button', {
      type: 'button',
      class: 'cl-check',
      'aria-label': t.status === 'pending' ? 'Marcar como enviada' : t.status === 'submitted' ? 'Volver a pendiente' : 'Revisada',
      'aria-pressed': String(t.status !== 'pending'),
      disabled: t.status === 'done' || isStudio() || !can('tasks.submit'),
      onclick: (e) => toggle(e.currentTarget),
    }, icon('check')),
    el('button', { type: 'button', class: 'cl-task-main', onclick: () => taskSheet(t) },
      el('b', { class: 'cl-task-title', text: t.title }),
      el('span', { class: 'cl-task-meta' },
        t.priority === 'high' && t.status === 'pending' && chip(prio, prioColor),
        due && t.status === 'pending' && el('span', { class: `cl-due ${dueClass}` }, icon('clock'), due),
        t.status === 'pending' && el('span', {}, icon(EXPECTS[t.expects]?.[1] || 'sparkles'), EXPECTS[t.expects]?.[0] || ''),
        t.status === 'submitted' && el('span', { class: 'cl-due is-info' }, icon('send'), `Enviada ${t.submitted_at ? ago(t.submitted_at) : ''}`),
        t.status === 'done' && el('span', { class: 'cl-due is-ok' }, icon('checkCircle'), `Revisada ${t.done_at ? ago(t.done_at) : ''}`),
        commentCount('task', t.id),
      ),
      !small && t.description && el('p', { class: 'cl-prose cl-clamp', text: t.description }),
    ),
    !isStudio() && can('tasks.submit') && t.status === 'pending' && t.expects !== 'none' && el('button', { type: 'button', class: `cl-btn sm${small ? ' is-icon' : ''}`, 'aria-label': 'Enviar', onclick: () => sendSheet({ task: t }) }, icon('upload'), !small && 'Enviar'),
    isStudio() && t.status === 'submitted' && el('button', { type: 'button', class: 'cl-btn sm', onclick: (e) => studio.approveTask(t, e.currentTarget) }, icon('check'), !small && 'Dar por buena'),
  );
  if (isStudio()) onLongPress(card, () => studio.editTask(t));
  return card;
}

export function taskSheet(t) {
  const subs = app.data.submissions.filter((s) => s.task_id === t.id);
  const [due, dueClass] = t.due_date ? dueText(t.due_date) : [null, ''];
  let ui;
  const actions = isStudio()
    ? [el('button', { type: 'button', class: 'cl-btn ghost is-icon', 'aria-label': 'Duplicar', onclick: () => { ui.close(); studio.editTask(null, { template: { ...t, title: `${t.title} (copia)`.slice(0, 200) } }); } }, icon('copy')), el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => { ui.close(); studio.editTask(t); } }, icon('edit'), 'Editar'), t.status !== 'done' && el('button', { type: 'button', class: 'cl-btn', onclick: (e) => { studio.approveTask(t, e.currentTarget); ui.close(); } }, icon('check'), 'Dar por buena')]
    : t.status === 'pending' && can('tasks.submit')
      ? [t.expects !== 'none' && el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => { ui.close(); sendSheet({ task: t }); } }, icon('upload'), 'Enviar'), el('button', { type: 'button', class: 'cl-btn', onclick: async (e) => {
        try {
          upsertLocal('tasks', await app.backend.save('tasks', { id: t.id, status: 'submitted' }));
          burst(e.currentTarget);
          react('success');
          ui.close();
          toast('Marcada como enviada.', 'ok');
          redraw();
        } catch (err) {
          toast(err.message, 'error');
        }
      } }, icon('check'), 'Ya lo envié')]
      : null;
  ui = sheet(t.title, el('div', { class: 'cl-detail' },
    el('div', { class: 'cl-chips is-wrap' },
      chip(PRIORITY[t.priority || 'normal'][0], PRIORITY[t.priority || 'normal'][1]),
      due && chip(due, dueClass === 'is-late' ? 'var(--cf-expense)' : dueClass === 'is-soon' ? 'var(--cf-orange)' : 'var(--cf-fg-muted)', 'clock'),
      chip(EXPECTS[t.expects]?.[0] || '', 'var(--cf-blue)', EXPECTS[t.expects]?.[1]),
    ),
    t.description && el('p', { class: 'cl-prose is-strong', text: t.description }),
    t.client_note && el('p', { class: 'cl-note-box' }, icon('message'), t.client_note),
    subs.length > 0 && el('section', { class: 'cl-sub-list' }, el('h4', { class: 'cl-eyebrow', text: isStudio() ? 'Lo que mandó' : 'Lo que enviaste' }), subs.map((s) => sentRow(s))),
    thread('task', t.id),
  ), { actions: actions?.filter(Boolean), subtitle: { pending: 'Pendiente', submitted: 'Enviada', done: 'Revisada' }[t.status] });
}

export function requestsPage(tab = 'pendientes') {
  const groups = { pendientes: 'pending', enviadas: 'submitted', hechas: 'done' };
  if (!groups[tab]) tab = 'pendientes';
  const body = el('div', { class: 'cl-stack' });
  const n = (s) => app.data.tasks.filter((t) => t.status === s).length;
  const draw = () => {
    const shown = app.data.tasks.filter((t) => t.status === groups[tab]).sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const subs = app.data.submissions;
    fill(body,
      shown.length ? el('div', { class: 'cl-list' }, shown.map((t) => taskCard(t))) : emptyBox(tab === 'pendientes' ? 'checkCircle' : 'inbox', tab === 'pendientes' ? (isStudio() ? 'No le has pedido nada' : '¡Al día!') : 'Nada por aquí', tab === 'pendientes' ? (isStudio() ? 'Logo, fotos, accesos, textos… Pídeselo con «+».' : 'No te falta nada por mandarnos. Si quieres compartir algo, usa «Enviar».') : null),
      tab !== 'hechas' && subs.length > 0 && el('section', { class: 'cl-sec' },
        sectionHead(isStudio() ? 'Lo que ha enviado' : 'Lo que nos has enviado'),
        el('div', { class: 'cl-card cl-sent-list' }, subs.slice(0, 40).map((s) => sentRow(s))),
      ),
    );
  };
  const tabs = seg([['pendientes', 'Pendientes', n('pending')], ['enviadas', 'Enviadas', n('submitted')], ['hechas', 'Hechas']], tab, (v) => {
    tab = v;
    history.replaceState(null, '', v === 'pendientes' ? '#/peticiones' : `#/peticiones/${v}`);
    body.classList.remove('cl-swap');
    void body.offsetWidth;
    body.classList.add('cl-swap');
    draw();
  }, { label: 'Estado' });
  draw();
  return { node: el('div', { class: 'cl-stack' }, tabs, body), title: 'Peticiones', large: 'Peticiones', sub: isStudio() ? 'Lo que le pides al cliente' : 'Lo que necesitamos de ti para avanzar' };
}

function sentRow(s) {
  const [kind, ico] = SENT_KIND[s.kind] || SENT_KIND.message;
  const task = s.task_id && app.data.tasks.find((t) => t.id === s.task_id);
  const url = safeUrl(s.url);
  return el('div', { class: 'cl-sent' },
    el('span', { class: 'cl-sent-ico' }, icon(ico)),
    el('span', { class: 'cl-set-main' },
      el('b', { text: s.file_name || (url ? hostOf(url) : '') || (s.body || '').slice(0, 90) || kind }),
      el('small', { text: [isStudio() && s.author, kind, task && `para «${task.title}»`, sizeText(s.size), ago(s.created_at)].filter(Boolean).join(' · ') }),
    ),
    s.storage_path && el('button', { type: 'button', class: 'cl-glass xs', 'aria-label': 'Descargar', onclick: () => studio.openFile(s.storage_path) }, icon('download')),
    url && el('a', { class: 'cl-glass xs', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir' }, icon('external')),
    s.seen_at ? el('span', { class: 'cl-seen' }, icon('check'), 'Visto') : !isStudio() ? el('button', {
      type: 'button',
      class: 'cl-glass xs',
      'aria-label': 'Borrar',
      onclick: async () => {
        if (!(await confirmSheet('¿Borrar este envío?', { yes: 'Borrar', danger: true }))) return;
        try {
          await app.backend.removeSubmission(s);
          removeLocal('submissions', s.id);
          redraw();
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    }, icon('trash')) : el('i', { class: 'cl-new', text: 'nuevo' }),
  );
}

// ── Enviar: mensaje, enlace, archivo o vídeo ──

export function sendSheet({ task = null } = {}) {
  let mode = task?.expects === 'link' ? 'link' : task?.expects === 'file' ? 'file' : 'message';
  let taskId = task?.id || '';
  const fields = el('div', { class: 'cl-form' });
  const text = textarea({ placeholder: 'Escribe tu mensaje…', maxLength: 10000, rows: 4 }, { counter: true });
  const link = input({ type: 'url', inputMode: 'url', placeholder: 'https://…' });
  const note = textarea({ placeholder: 'Un comentario (opcional)', maxLength: 2000, rows: 2 });
  const picker = filePicker({ label: 'Elige una foto, un archivo o un vídeo', hint: 'Hasta 50 MB. Para vídeos más grandes, envía un enlace de Drive o WeTransfer.' });
  const pending = pendingTasks();
  const draw = () => fill(fields,
    mode === 'message' && field('Mensaje', text),
    mode === 'link' && field('Enlace', link),
    mode === 'file' && picker.node,
    mode !== 'message' && field('Comentario', note),
    pending.length > 0 && field('Es para', chips([['', 'Nada en concreto'], ...pending.map((t) => [t.id, t.title])], taskId, (v) => { taskId = v; }, { scroll: true })),
  );
  draw();
  const submit = el('button', { type: 'button', class: 'cl-btn' }, icon('send'), 'Enviar');
  const ui = sheet(task ? 'Enviar para esta petición' : 'Enviar a Schwarck', el('div', { class: 'cl-stack is-tight' },
    task && el('p', { class: 'cl-form-hint' }, icon('inbox'), task.title),
    seg([['message', 'Mensaje'], ['link', 'Enlace'], ['file', 'Archivo']], mode, (v) => { mode = v; draw(); }, { label: 'Qué envías' }),
    fields,
  ), { actions: [submit] });

  submit.addEventListener('click', async () => {
    const payload = { clientId: app.client.id, taskId: taskId || null, kind: mode, author: myName() };
    const area = (n) => (n.querySelector?.('textarea') || n).value.trim();
    if (mode === 'message') {
      if (!area(text)) return toast('Escribe algo primero.', 'error');
      payload.body = area(text);
    } else if (mode === 'link') {
      const url = safeUrl(link.value.trim());
      if (!url) return toast('Ese enlace no parece válido: tiene que empezar por https://', 'error');
      payload.url = url;
      payload.body = area(note);
    } else {
      const f = picker.files()[0];
      if (!f) return toast('Elige un archivo.', 'error');
      payload.kind = f.type.startsWith('video/') ? 'video' : 'file';
      payload.file = f;
      payload.body = area(note);
      payload.onProgress = (p) => picker.progress(p);
    }
    submit.disabled = true;
    submit.classList.add('is-busy');
    try {
      const row = await app.backend.submit(payload);
      upsertLocal('submissions', row);
      // Mandar algo para una petición la marca como enviada.
      const t = taskId && app.data.tasks.find((x) => x.id === taskId);
      if (t && t.status === 'pending') upsertLocal('tasks', await app.backend.save('tasks', { id: t.id, status: 'submitted' }).catch(() => t));
      react('send');
      burst(submit);
      ui.close();
      toast('Enviado. ¡Gracias!', 'ok');
      redraw();
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.classList.remove('is-busy');
      picker.progress(null);
    }
  });
}
