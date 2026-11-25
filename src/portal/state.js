// Estado compartido de la app del portal y lo que se deriva de él: la cronología,
// lo nuevo desde la última visita y lo que el estudio tiene que revisar.

import { localDay, todayKey, safeUrl, cap, fDay, dayDate, fMonth } from './kit.js';
import { memberCan, SECTION_PERM } from './brand.js';

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

/**
 * Si quien entra puede hacer algo: un permiso ('content.approve') o, como antes, el nombre de
 * una sección ('calendario'). El estudio, todo. La base aplica la misma regla.
 */
export const can = (key) => app.studio || memberCan(app.member, app.client, SECTION_PERM[key] || key);
/** Comentar (lo que «Solo lectura» no hace). */
export const canAct = () => can('comment');
/** Editar los datos del negocio. */
export const isOwner = () => can('business.edit');
/** Lo que creó esta persona (sus ideas, sus anuncios, sus recursos). */
export const isMine = (row) => Boolean(row?.created_by && row.created_by === app.user?.id);
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
/** Las redes de una publicación (antes había una sola, en channel). */
export const channelsOf = (c) => (c?.channels?.length ? c.channels : [c?.channel || 'otro']);
export const VERDICT = {
  approved: ['Aprobada', 'Aprobaste', 'aprobó', 'var(--cf-income)', 'checkCircle'],
  changes: ['Pide cambios', 'Pediste cambios', 'pide cambios', 'var(--cf-orange)', 'edit'],
  rejected: ['Rechazada', 'La rechazaste', 'rechazó', 'var(--cf-expense)', 'x'],
};
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

// ── Lo de la v5: proyecto, documentos, reuniones y valoraciones ──

/** Si la base ya tiene esa tabla (la migración v5 puede no estar aplicada). */
export const has = (table) => Boolean(app.data?.features?.[table]);
export const DOC_TYPE = { invoice: ['Factura', 'file', 'var(--cf-blue)'], quote: ['Cotización', 'doc', 'var(--cf-purple)'], proposal: ['Propuesta', 'send', 'var(--cf-primary)'], receipt: ['Recibo', 'checkCircle', 'var(--cf-income)'] };
export const DOC_STATUS = {
  open: ['Por pagar', 'var(--cf-orange)'],
  partial: ['Pago parcial', 'var(--cf-blue)'],
  paid: ['Pagada', 'var(--cf-income)'],
  viewed: ['Por responder', 'var(--cf-orange)'],
  accepted: ['Firmada', 'var(--cf-income)'],
  declined: ['Rechazada', 'var(--cf-expense)'],
  expired: ['Vencida', 'var(--cf-fg-faint)'],
  void: ['Anulada', 'var(--cf-fg-faint)'],
};
/** El estado de un documento en palabras: una cotización «abierta» está por responder, no por pagar. */
export function docState(d) {
  if (d.type === 'receipt') return ['Recibido', 'var(--cf-income)'];
  if (d.type !== 'invoice' && (d.status === 'open' || d.status === 'viewed')) return ['Por responder', 'var(--cf-orange)'];
  if (d.type === 'invoice' && d.status === 'viewed') return DOC_STATUS.open;
  if (d.type === 'invoice' && ['open', 'partial'].includes(d.status) && d.due_date && d.due_date < todayKey()) return ['Vencida', 'var(--cf-expense)'];
  return DOC_STATUS[d.status] || DOC_STATUS.open;
}
/** Lo que espera algo del cliente: facturas por pagar y propuestas o cotizaciones por responder. */
export const docWaiting = (d) => (d.type === 'invoice' ? ['open', 'partial', 'viewed'].includes(d.status) : ['quote', 'proposal'].includes(d.type) && ['open', 'viewed'].includes(d.status));
export const pendingDocs = () => (has('documents') && can('docs.view') ? app.data.documents.filter(docWaiting) : []);
export const MEETING_MODE = { video: ['Videollamada', 'play'], call: ['Llamada', 'call'], in_person: ['En persona', 'pin'] };
export const MEETING_STATUS = {
  requested: ['Pedida', 'var(--cf-orange)'],
  confirmed: ['Confirmada', 'var(--cf-income)'],
  declined: ['Sin hora', 'var(--cf-expense)'],
  cancelled: ['Cancelada', 'var(--cf-fg-faint)'],
  done: ['Hecha', 'var(--cf-purple)'],
};
/** La próxima reunión confirmada (o la que está en curso: hasta que acabe). */
export function nextMeeting() {
  if (!has('meetings')) return null;
  const now = Date.now();
  return app.data.meetings
    .filter((m) => m.status === 'confirmed' && m.starts_at && new Date(m.starts_at).getTime() + (m.duration || 30) * 60_000 > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] || null;
}
export const requestedMeetings = () => (has('meetings') ? app.data.meetings.filter((m) => m.status === 'requested') : []);
/** El proyecto que se enseña: el que está en curso y, si no, el último que cambió. */
export function currentProject() {
  if (!has('projects') || !can('project.view')) return null;
  const list = app.data.projects.filter((p) => !p.hidden);
  return list.find((p) => p.status === 'active') || list.find((p) => p.status !== 'completed') || list[0] || null;
}
/** El primer día del mes de una fecha (o de hoy), como en portal_ratings.month. */
export const monthKey = (key = todayKey()) => `${key.slice(0, 7)}-01`;

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
  for (const p of d.posts) {
    const fromClient = p.origin === 'client';
    out.push({ id: `p${p.id}`, at: p.occurred_at, group: p.kind === 'announcement' ? 'anuncios' : 'avances', kind: p.kind, label: fromClient ? `Anuncio de ${p.author || 'tu equipo'}` : POST_KIND[p.kind]?.[0], ico: POST_KIND[p.kind]?.[1], color: POST_KIND[p.kind]?.[2], title: p.title, body: p.body, link: p.link, pinned: p.pinned, mine: fromClient ? isMine(p) : studio, ref: { type: 'post', row: p } });
  }

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
    // Quién lo mandó, a qué hora, bloqueos y observaciones (el reporte pegado de Nexus).
    const meta = (d.reports || []).find((r) => r.day === day) || null;
    const sent = meta?.sent_at ? `${day}T${meta.sent_at.slice(0, 5)}:00` : null;
    const at = sent || (day === todayKey() ? (last > nowIso ? nowIso : last) : `${day}T23:00:00`);
    out.push({ id: `r${day}`, at: at > nowIso ? nowIso : at, group: 'reportes', label: day === todayKey() ? 'Reporte de hoy' : 'Reporte del día', ico: 'tasks', color: 'var(--cf-income)', title: done.length ? `${done.length} ${done.length === 1 ? 'tarea hecha' : 'tareas hechas'}` : 'Trabajando en ello', report: { day, items, done, minutes, meta }, mine: studio });
  }

  for (const t of see('peticiones') ? d.tasks : []) {
    out.push({ id: `tn${t.id}`, at: t.created_at, group: 'peticiones', label: 'Te pedimos', ico: 'inbox', color: 'var(--cf-orange)', title: t.title, body: t.description, go: '#/peticiones', mine: studio });
    if (t.status === 'done' && t.done_at) out.push({ id: `td${t.id}`, at: t.done_at, group: 'peticiones', label: 'Revisado', ico: 'checkCircle', color: 'var(--cf-income)', title: t.title, go: '#/peticiones/hechas', mine: studio });
    if (t.status === 'submitted' && t.submitted_at) out.push({ id: `ts${t.id}`, at: t.submitted_at, group: 'tuyo', label: studio ? 'El cliente lo envió' : 'Marcaste como enviada', ico: 'send', color: studio ? 'var(--cf-primary)' : 'var(--cf-fg-muted)', title: t.title, go: '#/peticiones/enviadas', mine: !studio });
  }
  for (const c of see('calendario') ? visibleContent() : []) {
    const ideaOfClient = c.origin === 'client';
    // Lo que el estudio carga como idea (también desde Claude) no sale hasta que pasa a producción.
    if (c.created_at && (studio || !isDraft(c))) {
      out.push({ id: `cn${c.id}`, at: c.created_at, group: ideaOfClient ? 'tuyo' : 'marketing', label: ideaOfClient ? (studio ? 'El cliente propone' : isMine(c) ? 'Propusiste' : 'Tu equipo propone') : 'Al calendario', ico: ideaOfClient ? 'sparkles' : 'calendar', color: CHANNEL[c.channel]?.[1], title: c.title, body: `${FORMAT[c.format] || ''} · ${cap(fDay.format(dayDate(c.date)))}`, go: `#/marketing/pieza/${c.id}`, mine: ideaOfClient ? !studio : studio });
    }
    if (c.status === 'published' && c.date <= todayKey()) out.push({ id: `cp${c.id}`, at: `${c.date}T${(c.time || '12:00').slice(0, 5)}:00`, group: 'marketing', label: 'Publicado', ico: 'megaphone', color: 'var(--cf-purple)', title: c.title, go: `#/marketing/pieza/${c.id}`, mine: studio });
    if (c.client_verdict && c.client_verdict_at) {
      const [, mineLabel, verb, color, ico] = VERDICT[c.client_verdict] || VERDICT.changes;
      out.push({ id: `cv${c.id}`, at: c.client_verdict_at, group: 'tuyo', label: studio ? `${c.client_verdict_name || 'El cliente'} ${verb}` : mineLabel, ico, color: studio ? color : 'var(--cf-fg-muted)', title: c.title, body: c.client_note, go: `#/marketing/pieza/${c.id}`, mine: !studio });
    }
  }
  for (const r of see('recursos') ? d.resources : []) out.push({ id: `res${r.id}`, at: r.created_at, group: 'avances', label: 'Recurso nuevo', ico: RESOURCE_KIND[r.kind]?.[1] || 'folder', color: 'var(--cf-blue)', title: r.title, body: r.description, go: '#/recursos', mine: studio });
  for (const m of see('rendimiento') ? d.metrics : []) if (m.channel === 'total') out.push({ id: `m${m.id}`, at: m.updated_at || m.created_at || `${m.month}T12:00:00`, group: 'marketing', label: 'Resultados', ico: 'chart', color: 'var(--cf-blue)', title: cap(fMonth.format(dayDate(m.month))), body: `${(m.reach || 0).toLocaleString('es')} de alcance · ${m.leads || 0} leads`, go: '#/marketing/rendimiento', mine: studio });
  for (const s of d.submissions) out.push({ id: `s${s.id}`, at: s.created_at, group: 'tuyo', label: studio ? `${s.author || 'El cliente'} envió ${SENT_KIND[s.kind]?.[0].toLowerCase() || 'algo'}` : `Enviaste: ${SENT_KIND[s.kind]?.[0].toLowerCase() || 'algo'}`, ico: SENT_KIND[s.kind]?.[1] || 'send', color: studio ? 'var(--cf-primary)' : 'var(--cf-fg-muted)', title: s.file_name || s.url || (s.body || '').slice(0, 90), body: s.file_name || s.url ? s.body : null, mine: !studio, ref: { type: 'submission', row: s } });
  for (const c of d.comments) {
    if (c.from_studio === studio) continue;
    out.push({ id: `cm${c.id}`, at: c.created_at, group: studio ? 'tuyo' : 'avances', label: `${c.from_studio ? 'Schwarck' : c.author || 'El cliente'} comentó`, ico: 'chat', color: 'var(--cf-primary)', title: targetTitle(c.target, c.target_id), body: c.body, go: `#/hilo/${c.target}/${c.target_id}`, mine: false });
  }
  if (has('documents') && see('docs.view')) {
    for (const doc of d.documents) {
      const [word, ico, color] = DOC_TYPE[doc.type] || DOC_TYPE.invoice;
      const name = `${word}${doc.number ? ` ${doc.number}` : ''}`;
      out.push({ id: `dn${doc.id}`, at: doc.created_at, group: 'avances', label: doc.type === 'receipt' ? 'Recibo de pago' : `${word} nueva`, ico, color, title: doc.title || name, body: doc.title ? name : null, go: '#/documentos', mine: studio });
      if (doc.updated_at && doc.updated_at !== doc.created_at && doc.type !== 'receipt') {
        if (doc.status === 'paid') out.push({ id: `dp${doc.id}`, at: doc.updated_at, group: 'avances', label: studio ? 'Cobrada' : 'Pago recibido', ico: 'checkCircle', color: 'var(--cf-income)', title: name, go: '#/documentos', mine: studio });
        if (doc.status === 'accepted' || doc.status === 'declined') out.push({ id: `dv${doc.id}`, at: doc.updated_at, group: 'tuyo', label: studio ? `El cliente ${doc.status === 'accepted' ? 'firmó' : 'rechazó'}` : doc.status === 'accepted' ? 'Firmaste' : 'Rechazaste', ico: doc.status === 'accepted' ? 'edit' : 'x', color: doc.status === 'accepted' ? 'var(--cf-income)' : 'var(--cf-expense)', title: name, go: '#/documentos', mine: !studio });
      }
    }
  }
  if (has('meetings')) {
    for (const m of d.meetings) {
      const fromClient = m.origin === 'client';
      if (fromClient) out.push({ id: `mq${m.id}`, at: m.created_at, group: 'tuyo', label: studio ? `${m.author || 'El cliente'} pide una reunión` : isMine(m) ? 'Pediste una reunión' : `${m.author || 'Tu equipo'} pidió una reunión`, ico: 'calendar', color: studio ? 'var(--cf-orange)' : 'var(--cf-fg-muted)', title: m.topic, go: '#/reuniones', mine: !studio });
      if (m.status === 'confirmed' && m.starts_at) out.push({ id: `mc${m.id}`, at: fromClient ? m.updated_at || m.created_at : m.created_at, group: 'avances', label: 'Reunión confirmada', ico: 'calendar', color: 'var(--cf-income)', title: m.topic, body: cap(fDay.format(new Date(m.starts_at))), go: '#/reuniones', mine: studio });
      if (m.status === 'declined') out.push({ id: `md${m.id}`, at: m.updated_at || m.created_at, group: 'avances', label: 'Buscamos otra hora', ico: 'clock', color: 'var(--cf-expense)', title: m.topic, body: m.studio_note, go: '#/reuniones', mine: studio });
    }
  }
  if (has('ratings') && studio) {
    for (const r of d.ratings) out.push({ id: `rt${r.client_id}${r.month}${r.user_id}`, at: r.updated_at || r.created_at, group: 'tuyo', label: `${r.author || 'El cliente'} valoró ${fMonth.format(dayDate(r.month))}`, ico: 'heart', color: r.score >= 4 ? 'var(--cf-income)' : r.score === 3 ? 'var(--cf-orange)' : 'var(--cf-expense)', title: `${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}`, body: r.comment, go: '#/', mine: false });
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
    ...d.content.filter((c) => c.client_verdict === 'rejected' && !['scheduled', 'published'].includes(c.status)).map((c) => ({ id: `x${c.id}`, kind: 'rejected', at: c.client_verdict_at, row: c })),
    ...d.content.filter((c) => c.origin === 'client' && c.status === 'idea').map((c) => ({ id: `i${c.id}`, kind: 'idea', at: c.created_at, row: c })),
    ...d.comments.filter((c) => !c.from_studio && (!lastStudio.get(c.target_id) || lastStudio.get(c.target_id) < c.created_at)).map((c) => ({ id: `m${c.id}`, kind: 'comment', at: c.created_at, row: c })),
    ...requestedMeetings().map((m) => ({ id: `q${m.id}`, kind: 'meeting', at: m.created_at, row: m })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
}

/** Las ideas que cargó Claude son borradores del estudio: el cliente no las ve hasta que pasan de «Idea». */
const isDraft = (c) => c.origin === 'claude' && c.status === 'idea';
/** El calendario que ve quien entra (al estudio, todo). */
export const visibleContent = () => (app.studio ? app.data?.content || [] : (app.data?.content || []).filter((c) => !isDraft(c)));
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
