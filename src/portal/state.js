// Estado compartido de la app del portal y lo que se deriva de él: la cronología,
// lo nuevo desde la última visita y lo que el estudio tiene que revisar.

import { localDay, todayKey, safeUrl, cap, fDay, dayDate, fMonth } from './kit.js';

export const app = {
  backend: null,
  user: null,
  studio: false,
  portals: [],
  client: null,
  member: null,
  data: null,
  urls: {},
  unwatch: null,
};

let redrawFn = () => {};
export const setRedraw = (fn) => {
  redrawFn = fn;
};
/** Vuelve a pintar la pantalla abierta (sin perder el desplazamiento). */
export const redraw = () => redrawFn();

export const isStudio = () => app.studio;

/** Secciones ocultas para quien entra: las del portal y las suyas (al estudio, ninguna). */
export function hiddenSet() {
  if (app.studio) return new Set();
  return new Set([...(app.client?.hidden || []), ...(app.member?.hidden || [])]);
}
export const can = (section) => !hiddenSet().has(section);
/** Solo lectura no aprueba, no comenta, no marca ni envía. */
export const canAct = () => app.studio || app.member?.role !== 'viewer';
/** El dueño (y el estudio) edita los datos del negocio. */
export const isOwner = () => app.studio || app.member?.role === 'owner';
export const myName = () => (app.studio ? 'Schwarck' : app.member?.name || app.user?.email || 'Cliente');

// ── Textos ──

export const POST_KIND = {
  announcement: ['Anuncio', 'megaphone', 'var(--cf-orange)'],
  update: ['Avance', 'sparkles', 'var(--cf-primary)'],
  milestone: ['Hito', 'flag', 'var(--cf-purple)'],
  delivery: ['Entrega', 'box', 'var(--cf-income)'],
  report: ['Informe', 'chart', 'var(--cf-blue)'],
};
export const CONTENT_STATUS = {
  idea: ['Idea', 'var(--cf-fg-faint)'],
  production: ['En producción', 'var(--cf-orange)'],
  review: ['Para revisar', 'var(--cf-primary)'],
  approved: ['Aprobado', 'var(--cf-income)'],
  scheduled: ['Programado', 'var(--cf-blue)'],
  published: ['Publicado', 'var(--cf-purple)'],
};
export const STATUS_ORDER = ['idea', 'production', 'review', 'approved', 'scheduled', 'published'];
export const CHANNEL = {
  instagram: ['Instagram', '#e1306c', 'instagram'],
  facebook: ['Facebook', '#1877f2', 'facebook'],
  tiktok: ['TikTok', '#25c2d9', 'tiktok'],
  youtube: ['YouTube', '#ff2d2d', 'play'],
  linkedin: ['LinkedIn', '#0a66c2', 'users'],
  web: ['Web', 'var(--cf-primary)', 'globe'],
  email: ['Correo', 'var(--cf-orange)', 'mail'],
  google: ['Google', '#34a853', 'search'],
  otro: ['Otro', 'var(--cf-fg-faint)', 'more'],
};
export const FORMAT = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia', video: 'Vídeo', articulo: 'Artículo', otro: 'Otro' };
export const FUNNEL = {
  atraccion: ['Atracción', '#22c9a6', 'Llegar a gente nueva'],
  autoridad: ['Autoridad', 'var(--cf-blue)', 'Que confíen en ti'],
  conversion: ['Conversión', 'var(--cf-orange)', 'Que compren'],
  comunidad: ['Comunidad', 'var(--cf-purple)', 'Que vuelvan'],
};
export const RESOURCE_KIND = { file: ['Archivo', 'file', 'var(--cf-income)'], link: ['Enlace', 'link', 'var(--cf-blue)'], video: ['Vídeo', 'play', 'var(--cf-expense)'], doc: ['Documento', 'doc', 'var(--cf-orange)'], image: ['Imágenes', 'image', 'var(--cf-purple)'] };
export const EXPECTS = { any: ['Lo que tengas', 'sparkles'], file: ['Un archivo', 'upload'], link: ['Un enlace', 'link'], text: ['Un mensaje', 'message'], none: ['Solo márcala', 'check'] };
export const PRIORITY = { low: ['Sin prisa', 'var(--cf-fg-faint)'], normal: ['Normal', 'var(--cf-blue)'], high: ['Urgente', 'var(--cf-expense)'] };
export const SENT_KIND = { message: ['Mensaje', 'message'], link: ['Enlace', 'link'], file: ['Archivo', 'file'], video: ['Vídeo', 'film'] };
export const WORK_STATUS = { planned: ['Planificado', 'var(--cf-fg-faint)', 'clock'], doing: ['En curso', 'var(--cf-orange)', 'bolt'], done: ['Hecho', 'var(--cf-income)', 'check'] };
export const LEAD_STAGE = {
  nuevo: ['Nuevo', 'var(--cf-blue)'],
  contactado: ['Contactado', '#22c9a6'],
  calificado: ['Calificado', 'var(--cf-purple)'],
  propuesta: ['Propuesta', 'var(--cf-orange)'],
  ganado: ['Ganado', 'var(--cf-income)'],
  perdido: ['Perdido', 'var(--cf-expense)'],
};
export const LEAD_SOURCE = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp', web: 'Web', google: 'Google', referido: 'Referido', otro: 'Otro' };

// ── Archivos: direcciones firmadas (una hora), guardadas aquí ──

export const isPath = (v) => v && !safeUrl(v);
export const urlOf = (v) => (v ? safeUrl(v) || app.urls[v] || null : null);

/** Pide las direcciones de los archivos que aún no tienen. */
export async function signPaths(paths) {
  const missing = [...new Set(paths.filter((p) => isPath(p) && !app.urls[p]))];
  if (!missing.length) return;
  Object.assign(app.urls, await app.backend.fileUrls(missing).catch(() => ({})));
}

export function collectPaths(data) {
  const paths = [];
  for (const c of data.content) {
    if (c.image_url) paths.push(c.image_url);
    for (const a of c.assets || []) if (a.path) paths.push(a.path);
  }
  for (const m of data.members) if (m.avatar_path) paths.push(m.avatar_path);
  if (data.client?.logo_url) paths.push(data.client.logo_url);
  if (data.client?.brand?.cover) paths.push(data.client.brand.cover);
  return paths;
}

// ── Lo que pasó ──

/** Todo, en orden: tablón, reportes diarios, peticiones, contenido, recursos, resultados y lo enviado. */
export function feed() {
  const d = app.data;
  if (!d) return [];
  const out = [];
  const studio = app.studio;
  const see = (s) => studio || can(s);
  for (const p of d.posts) out.push({ id: `p${p.id}`, at: p.occurred_at, group: p.kind === 'announcement' ? 'anuncios' : 'avances', kind: p.kind, label: POST_KIND[p.kind]?.[0], ico: POST_KIND[p.kind]?.[1], color: POST_KIND[p.kind]?.[2], title: p.title, body: p.body, link: p.link, pinned: p.pinned, mine: studio, ref: { type: 'post', row: p } });

  // El trabajo de cada día se agrupa en un reporte.
  const days = new Map();
  for (const w of see('reporte') ? d.work : []) {
    if (w.status === 'planned') continue;
    if (!days.has(w.day)) days.set(w.day, []);
    days.get(w.day).push(w);
  }
  for (const [day, items] of days) {
    const done = items.filter((w) => w.status === 'done');
    const last = items.map((w) => w.done_at || w.created_at).filter(Boolean).sort().pop() || `${day}T18:00:00`;
    const minutes = done.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
    const nowIso = new Date().toISOString();
    out.push({ id: `r${day}`, at: day === todayKey() ? (last > nowIso ? nowIso : last) : `${day}T23:00:00`, group: 'reportes', label: day === todayKey() ? 'Reporte de hoy' : 'Reporte del día', ico: 'tasks', color: 'var(--cf-income)', title: done.length ? `${done.length} ${done.length === 1 ? 'tarea hecha' : 'tareas hechas'}` : 'Trabajando en ello', report: { day, items, done, minutes }, mine: studio });
  }

  for (const t of see('peticiones') ? d.tasks : []) {
    out.push({ id: `tn${t.id}`, at: t.created_at, group: 'peticiones', label: 'Te pedimos', ico: 'inbox', color: 'var(--cf-orange)', title: t.title, body: t.description, go: '#/peticiones', mine: studio });
    if (t.status === 'done' && t.done_at) out.push({ id: `td${t.id}`, at: t.done_at, group: 'peticiones', label: 'Revisado', ico: 'checkCircle', color: 'var(--cf-income)', title: t.title, go: '#/peticiones/hechas', mine: studio });
    if (t.status === 'submitted' && t.submitted_at) out.push({ id: `ts${t.id}`, at: t.submitted_at, group: 'tuyo', label: studio ? 'El cliente lo envió' : 'Marcaste como enviada', ico: 'send', color: studio ? 'var(--cf-primary)' : 'var(--cf-fg-muted)', title: t.title, go: '#/peticiones/enviadas', mine: !studio });
  }
  for (const c of see('calendario') ? d.content : []) {
    if (c.created_at) out.push({ id: `cn${c.id}`, at: c.created_at, group: 'marketing', label: 'Al calendario', ico: 'calendar', color: CHANNEL[c.channel]?.[1], title: c.title, body: `${FORMAT[c.format] || ''} · ${cap(fDay.format(dayDate(c.date)))}`, go: `#/marketing/pieza/${c.id}`, mine: studio });
    if (c.status === 'published' && c.date <= todayKey()) out.push({ id: `cp${c.id}`, at: `${c.date}T${(c.time || '12:00').slice(0, 5)}:00`, group: 'marketing', label: 'Publicado', ico: 'megaphone', color: 'var(--cf-purple)', title: c.title, go: `#/marketing/pieza/${c.id}`, mine: studio });
    if (c.client_verdict && c.client_verdict_at) out.push({ id: `cv${c.id}`, at: c.client_verdict_at, group: 'tuyo', label: c.client_verdict === 'approved' ? (studio ? 'El cliente aprobó' : 'Aprobaste') : studio ? 'El cliente pide cambios' : 'Pediste cambios', ico: c.client_verdict === 'approved' ? 'check' : 'edit', color: studio ? (c.client_verdict === 'approved' ? 'var(--cf-income)' : 'var(--cf-orange)') : 'var(--cf-fg-muted)', title: c.title, body: c.client_note, go: `#/marketing/pieza/${c.id}`, mine: !studio });
  }
  for (const r of see('recursos') ? d.resources : []) out.push({ id: `res${r.id}`, at: r.created_at, group: 'avances', label: 'Recurso nuevo', ico: RESOURCE_KIND[r.kind]?.[1] || 'folder', color: 'var(--cf-blue)', title: r.title, body: r.description, go: '#/recursos', mine: studio });
  for (const m of see('rendimiento') ? d.metrics : []) if (m.channel === 'total') out.push({ id: `m${m.id}`, at: m.updated_at || m.created_at || `${m.month}T12:00:00`, group: 'marketing', label: 'Resultados', ico: 'chart', color: 'var(--cf-blue)', title: cap(fMonth.format(dayDate(m.month))), body: `${(m.reach || 0).toLocaleString('es')} de alcance · ${m.leads || 0} leads`, go: '#/marketing/rendimiento', mine: studio });
  for (const s of d.submissions) out.push({ id: `s${s.id}`, at: s.created_at, group: 'tuyo', label: studio ? `${s.author || 'El cliente'} envió ${SENT_KIND[s.kind]?.[0].toLowerCase() || 'algo'}` : `Enviaste: ${SENT_KIND[s.kind]?.[0].toLowerCase() || 'algo'}`, ico: SENT_KIND[s.kind]?.[1] || 'send', color: studio ? 'var(--cf-primary)' : 'var(--cf-fg-muted)', title: s.file_name || s.url || (s.body || '').slice(0, 90), body: s.file_name || s.url ? s.body : null, mine: !studio, ref: { type: 'submission', row: s } });
  for (const c of d.comments) {
    if (c.from_studio === studio) continue;
    out.push({ id: `cm${c.id}`, at: c.created_at, group: studio ? 'tuyo' : 'avances', label: `${c.from_studio ? 'Schwarck' : c.author || 'El cliente'} comentó`, ico: 'chat', color: 'var(--cf-primary)', title: targetTitle(c.target, c.target_id), body: c.body, go: `#/hilo/${c.target}/${c.target_id}`, mine: false });
  }
  const soon = Date.now() + 60_000;
  return out.filter((x) => x.at && new Date(x.at) <= soon).sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function targetTitle(target, id) {
  const list = { content: app.data.content, task: app.data.tasks, post: app.data.posts, work: app.data.work }[target] || [];
  return list.find((x) => x.id === id)?.title || 'Conversación';
}

/** Lo nuevo desde la última vez que el cliente marcó «visto» (al estudio: lo que pide atención). */
export function unread() {
  if (!app.data) return [];
  if (app.studio) return attention();
  const seen = app.member?.last_seen_at ? new Date(app.member.last_seen_at) : new Date(0);
  return feed().filter((x) => !x.mine && new Date(x.at) > seen);
}

/** Lo que el estudio tiene que mirar: envíos sin ver, peticiones enviadas, cambios pedidos y comentarios. */
export function attention() {
  const d = app.data;
  if (!d) return [];
  const lastStudio = new Map();
  for (const c of d.comments) if (c.from_studio) lastStudio.set(c.target_id, c.created_at);
  return [
    ...d.submissions.filter((s) => !s.seen_at).map((s) => ({ id: `s${s.id}`, kind: 'submission', at: s.created_at, row: s })),
    ...d.tasks.filter((t) => t.status === 'submitted').map((t) => ({ id: `t${t.id}`, kind: 'task', at: t.submitted_at || t.updated_at, row: t })),
    ...d.content.filter((c) => c.client_verdict === 'changes' && c.status === 'review').map((c) => ({ id: `c${c.id}`, kind: 'changes', at: c.client_verdict_at, row: c })),
    ...d.comments.filter((c) => !c.from_studio && (!lastStudio.get(c.target_id) || lastStudio.get(c.target_id) < c.created_at)).map((c) => ({ id: `m${c.id}`, kind: 'comment', at: c.created_at, row: c })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
}

export const pendingTasks = () => (app.data?.tasks || []).filter((t) => t.status === 'pending');
export const toReview = () => (app.data?.content || []).filter((c) => c.status === 'review' && !c.client_verdict);
export const workToday = () => (app.data?.work || []).filter((w) => w.day === todayKey());
export const doingNow = () => (app.data?.work || []).filter((w) => w.status === 'doing');
export const commentsOf = (target, id) => (app.data?.comments || []).filter((c) => c.target === target && c.target_id === id);
export const memberOf = (userId) => app.data?.members.find((m) => m.user_id === userId);

/** Guarda una fila en los datos locales (alta o cambio) sin esperar al tiempo real. */
export function upsertLocal(table, row) {
  const list = app.data[table];
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = { ...list[i], ...row };
  else list.unshift(row);
}
export function removeLocal(table, id) {
  app.data[table] = app.data[table].filter((x) => x.id !== id);
}
export const lastDay = (iso) => localDay(iso);
