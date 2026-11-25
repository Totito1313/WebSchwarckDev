// Negocio ↔ portal de clientes: lo que Negocio lleva a la app de cada cliente y lo que trae de ella.
//
//   · Proyectos: etapas, avance, horas y lo próximo con fecha (portal_projects); cada etapa
//     completada llega una sola vez a su cronología como hito (portal_posts.source).
//   · Documentos: una factura, cotización o propuesta se publica en su portal con su enlace
//     (/documento/#…) y su estado (portal_documents) se mantiene al día: pagos, aperturas, firmas.
//   · Datos del cliente: correo, teléfono, dirección y web, rellenando lo que falte en cada lado.
//   · El trabajo de hoy va directo a su reporte diario (portal_work), sin repetir nada.
//   · Lo que piden los clientes (envíos, ideas, cambios, reuniones) se convierte en tareas.
//
// Habla con Supabase con la cuenta del estudio (la misma sesión que la app: portal:auth, mismo
// sitio). Sin esa sesión, o sin la migración v5 aplicada, no hace nada y no molesta.

import { state, put, todayISO, find, docStatus, totals, isSignable, api, bus, flushNow } from './negocio-core.js';
import { SUPABASE_URL, SUPABASE_KEY } from './portal/config.js';

// ── Supabase con la cuenta del estudio (una sola instancia para todo Negocio) ──

let client = null;
export function sb() {
  client ||= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'portal:auth' } }));
  return client;
}
export function friendly(message = '') {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/failed to fetch|network/i.test(message)) return 'Sin conexión con Supabase.';
  if (/row-level security|permission denied/i.test(message)) return 'Esta cuenta no tiene permiso: ¿es del estudio?';
  if (/relation .* does not exist|could not find the table|schema cache/i.test(message)) return 'Falta aplicar la migración v5 del portal en Supabase.';
  return message || 'Algo salió mal.';
}
export const must = ({ data, error }) => {
  if (error) throw new Error(friendly(error.message));
  return data;
};
export async function studioSession() {
  const s = (await (await sb()).auth.getSession()).data.session;
  return s ? { user: s.user, admin: s.user?.app_metadata?.role === 'admin', token: s.access_token } : null;
}
/** Sin abrir Supabase: si este navegador guardó alguna vez una sesión del portal. */
const mightHaveSession = () => {
  try {
    return Boolean(localStorage.getItem('portal:auth'));
  } catch {
    return false;
  }
};
const isAdmin = async () => mightHaveSession() && Boolean((await studioSession())?.admin);

// ── Portales enlazados a clientes de Negocio ──

let portalsCache = null;
let portalsAt = 0;
export async function linkedPortals({ fresh = false } = {}) {
  if (!fresh && portalsCache && Date.now() - portalsAt < 60_000) return portalsCache;
  const c = await sb();
  portalsCache = must(await c.from('portal_clients').select('id,name,crm_customer_id,archived,email,phone,address,website').eq('archived', false));
  portalsAt = Date.now();
  return portalsCache;
}
export const portalOfCustomer = (portals, customerId) => (customerId ? portals.find((p) => p.crm_customer_id === customerId) || null : null);

// ── Documentos ──

/** El estado de la hoja, en los de portal_documents. */
function docState(doc) {
  const s = docStatus(doc);
  return { pending: 'open', overdue: 'open', sent: 'open', draft: 'open', partial: 'partial', paid: 'paid', issued: 'paid', void: 'void', viewed: 'viewed', accepted: 'accepted', declined: 'declined', expired: 'expired' }[s] || 'open';
}
const shareUrl = (doc) => (doc.share?.token ? `${location.origin}/documento/#${doc.share.token}` : null);

export function docRow(doc, clientId) {
  const t = totals(doc);
  const title = (doc.title || doc.items?.find((it) => it.name)?.name || '').slice(0, 200) || null;
  return {
    client_id: clientId,
    crm_doc_id: doc.id,
    type: doc.type,
    number: doc.number || null,
    title,
    issue_date: doc.issueDate || null,
    due_date: (doc.type === 'invoice' ? doc.dueDate : isSignable(doc) ? doc.validUntil : '') || null,
    currency: doc.currency || 'USD',
    total: t.total,
    paid: doc.type === 'receipt' ? t.total : t.paid,
    status: docState(doc),
    url: shareUrl(doc),
    locked: Boolean(doc.share?.hasPassword),
  };
}

/** Lo que ya está publicado de este documento (en qué portal). */
export async function docInPortal(doc) {
  const c = await sb();
  const rows = must(await c.from('portal_documents').select('id,client_id,status,updated_at').eq('crm_doc_id', doc.id));
  return rows[0] || null;
}

/** Publica (o pone al día) el documento en el portal de su cliente. Crea el enlace si no lo tiene. */
export async function publishDoc(doc) {
  if (!doc.number) throw new Error('Guárdalo primero: necesita número.');
  const portals = await linkedPortals();
  const portal = portalOfCustomer(portals, doc.customerId);
  if (!portal) throw new Error('Este cliente no tiene portal: créalo en Portal de clientes › Clientes.');
  if (!doc.share?.token) {
    await flushNow();
    doc.share = await api('/crm/share', { method: 'POST', body: { docId: doc.id, password: '', days: 0 } });
    if (doc.status === 'draft') doc.status = 'sent';
    await put('docs', doc, { now: true });
  }
  const c = await sb();
  return must(await c.from('portal_documents').upsert({ ...docRow(doc, portal.id), notify: true }, { onConflict: 'client_id,crm_doc_id' }).select().single());
}

export async function unpublishDoc(doc) {
  const c = await sb();
  must(await c.from('portal_documents').delete().eq('crm_doc_id', doc.id));
}

const SAME_DOC = ['number', 'title', 'issue_date', 'due_date', 'currency', 'total', 'paid', 'status', 'url', 'locked'];

/** Pone al día los documentos ya publicados: pagos, aperturas, firmas, importes. */
export async function syncDocs() {
  const c = await sb();
  const rows = must(await c.from('portal_documents').select('*'));
  let changed = 0;
  for (const row of rows) {
    const doc = find('docs', row.crm_doc_id);
    if (!doc) continue;
    const next = docRow(doc, row.client_id);
    const same = (k) => (k === 'total' || k === 'paid' ? Number(next[k]) === Number(row[k]) : String(next[k] ?? '') === String(row[k] ?? ''));
    if (SAME_DOC.every(same)) continue;
    must(await c.from('portal_documents').update(Object.fromEntries(SAME_DOC.map((k) => [k, next[k]]))).eq('id', row.id));
    changed++;
  }
  return changed;
}

// ── Proyectos ──

const monthOf = (iso) => String(iso || '').slice(0, 7);
const minutesOf = (entries) => entries.reduce((s, e) => s + (Number(e.minutes) || 0), 0);

export function projectRow(p, clientId) {
  const tasks = state.tasks.filter((t) => t.projectId === p.id);
  const time = (state.time || []).filter((e) => e.projectId === p.id && !e.running);
  const month = monthOf(todayISO());
  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)
    .map((t) => ({ title: String(t.title || '').slice(0, 200), due: t.dueDate, status: t.status }));
  return {
    client_id: clientId,
    crm_project_id: p.id,
    name: (p.name || 'Proyecto').slice(0, 200),
    code: p.code || null,
    status: ['pending', 'active', 'paused', 'completed'].includes(p.status) ? p.status : 'active',
    stages: (p.stages || []).map((s) => ({ name: s.name, done: Boolean(s.done), done_at: s.doneAt || null })),
    tasks_done: tasks.filter((t) => t.status === 'done').length,
    tasks_total: tasks.length,
    minutes_month: minutesOf(time.filter((e) => monthOf(e.date) === month)),
    minutes_total: minutesOf(time),
    start_date: p.startDate || null,
    due_date: p.dueDate || null,
    upcoming,
    description: (p.description || '').slice(0, 2000) || null,
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PROJECT_KEYS = ['name', 'code', 'status', 'stages', 'tasks_done', 'tasks_total', 'minutes_month', 'minutes_total', 'start_date', 'due_date', 'upcoming', 'description'];

/** Lleva los proyectos de cada cliente enlazado a su portal, y sus etapas completadas como hitos. */
export async function syncProjects() {
  const c = await sb();
  const portals = await linkedPortals();
  const linked = portals.filter((p) => p.crm_customer_id);
  if (!linked.length) return { projects: 0, milestones: 0 };
  const ids = linked.map((p) => p.id);
  const [rows, posts] = await Promise.all([
    c.from('portal_projects').select('*').in('client_id', ids).then(must),
    c.from('portal_posts').select('client_id,source').in('client_id', ids).like('source', 'negocio:stage:%').then(must),
  ]);
  const seen = new Set(posts.map((x) => `${x.client_id}|${x.source}`));
  let projects = 0;
  let milestones = 0;
  const twoDays = Date.now() - 2 * 86_400_000;
  for (const portal of linked) {
    for (const p of state.projects.filter((x) => x.customerId === portal.crm_customer_id)) {
      const next = projectRow(p, portal.id);
      const before = rows.find((r) => r.client_id === portal.id && r.crm_project_id === p.id);
      if (!before || !PROJECT_KEYS.every((k) => sameJson(next[k] ?? null, before[k] ?? null))) {
        must(await c.from('portal_projects').upsert(next, { onConflict: 'client_id,crm_project_id' }));
        projects++;
      }
      // Cada etapa completada, una vez. Solo avisa al teléfono la más reciente (completar la última
      // completa también las anteriores: un aviso, no cuatro) y si es de los últimos dos días.
      const fresh = (p.stages || []).filter((x) => x.done && x.id && !seen.has(`${portal.id}|negocio:stage:${x.id}`));
      const newest = fresh.reduce((top, x) => (!top || (x.doneAt || '') >= (top.doneAt || '') ? x : top), null);
      for (const s of fresh) {
        const source = `negocio:stage:${s.id}`;
        const at = s.doneAt || new Date().toISOString();
        const last = s === p.stages[p.stages.length - 1];
        const { error } = await c.from('portal_posts').insert({
          client_id: portal.id,
          kind: last ? 'delivery' : 'milestone',
          title: last ? `Proyecto entregado: ${p.name}`.slice(0, 200) : `Etapa completada: ${s.name}`.slice(0, 200),
          body: last ? null : p.name,
          occurred_at: at,
          source,
          notify: s === newest && new Date(at).getTime() > twoDays,
        });
        if (!error) milestones++;
        seen.add(`${portal.id}|${source}`);
      }
    }
  }
  return { projects, milestones };
}

// ── Datos del cliente ──

const FIELDS = [['email', 'email'], ['phone', 'phone'], ['address', 'address'], ['website', 'website']];

/** Rellena lo que falte a cada lado: Negocio ⇄ portal. Lo que está en los dos y difiere no se toca. */
export async function syncCustomers() {
  const c = await sb();
  const portals = await linkedPortals({ fresh: true });
  let toPortal = 0;
  let toNegocio = 0;
  const differ = [];
  for (const portal of portals.filter((p) => p.crm_customer_id)) {
    const customer = find('customers', portal.crm_customer_id);
    if (!customer) continue;
    const patch = {};
    let touched = false;
    for (const [ng, pt] of FIELDS) {
      const a = String(customer[ng] || '').trim();
      const b = String(portal[pt] || '').trim();
      if (a && !b) patch[pt] = a.slice(0, pt === 'address' ? 300 : pt === 'website' ? 300 : pt === 'email' ? 200 : 40);
      else if (b && !a) {
        customer[ng] = b;
        touched = true;
      } else if (a && b && a !== b) differ.push({ portal, customer, field: ng, negocio: a, app: b });
    }
    if (Object.keys(patch).length) {
      must(await c.from('portal_clients').update(patch).eq('id', portal.id));
      Object.assign(portal, patch);
      toPortal++;
    }
    if (touched) {
      put('customers', { ...customer, updatedAt: customer.updatedAt });
      toNegocio++;
    }
  }
  return { toPortal, toNegocio, differ };
}

/** Pone un dato igual en los dos lados: el de Negocio (`from = 'negocio'`) o el del portal. */
export async function settleField(item, from) {
  if (from === 'negocio') {
    const c = await sb();
    must(await c.from('portal_clients').update({ [item.field]: item.negocio }).eq('id', item.portal.id));
    item.portal[item.field] = item.negocio;
  } else {
    put('customers', { ...item.customer, [item.field]: item.app });
  }
}

// ── El trabajo de hoy, directo al reporte ──

/** Publica en el reporte de hoy de su portal lo que no esté ya. Devuelve cuántas líneas entraron. */
export async function sendWork(customerId, items) {
  const portals = await linkedPortals();
  const portal = portalOfCustomer(portals, customerId);
  if (!portal) throw new Error('Este cliente no tiene portal enlazado.');
  const c = await sb();
  const sources = items.map((it) => it.source).filter(Boolean);
  const have = sources.length ? must(await c.from('portal_work').select('source').eq('client_id', portal.id).in('source', sources)).map((r) => r.source) : [];
  const fresh = items.filter((it) => !have.includes(it.source));
  if (!fresh.length) return { portal, sent: 0 };
  const day = new Date().toLocaleDateString('en-CA');
  const now = new Date().toISOString();
  must(await c.from('portal_work').insert(fresh.map((it) => ({
    client_id: portal.id,
    title: String(it.title).slice(0, 200),
    status: 'done',
    day,
    minutes: it.minutes ? Math.min(1440, Math.round(it.minutes)) : null,
    category: it.category || null,
    source: it.source,
    done_at: now,
  }))));
  return { portal, sent: fresh.length };
}

// ── Lo que piden los clientes ──

/** Lo que espera al estudio en todos los portales: envíos sin ver, peticiones enviadas, cambios, ideas y reuniones. */
export async function clientAsks() {
  const c = await sb();
  const [portals, subs, tasks, content, meetings] = await Promise.all([
    linkedPortals({ fresh: true }),
    c.from('portal_submissions').select('id,client_id,kind,body,url,file_name,author,created_at').is('seen_at', null).order('created_at', { ascending: false }).limit(40).then(must),
    c.from('portal_tasks').select('id,client_id,title,client_note,submitted_at').eq('status', 'submitted').limit(40).then(must),
    c.from('portal_content').select('id,client_id,title,client_verdict,client_note,client_verdict_name,client_verdict_at,origin,status,created_at').or('client_verdict.in.(changes,rejected),and(origin.eq.client,status.eq.idea)').limit(40).then(must),
    c.from('portal_meetings').select('id,client_id,topic,notes,author,options,created_at').eq('status', 'requested').limit(40).then(must).catch(() => []),
  ]);
  const name = (id) => portals.find((p) => p.id === id)?.name || 'Cliente';
  const customer = (id) => portals.find((p) => p.id === id)?.crm_customer_id || '';
  const out = [
    ...subs.map((s) => ({ ref: `submission:${s.id}`, clientId: s.client_id, at: s.created_at, ico: 'inbox', what: `${s.author || name(s.client_id)} envió ${({ message: 'un mensaje', link: 'un enlace', file: 'un archivo', video: 'un vídeo' })[s.kind] || 'algo'}`, title: (s.body || s.file_name || s.url || 'Envío').split('\n')[0].slice(0, 120), detail: [s.body, s.url, s.file_name && `Archivo: ${s.file_name}`].filter(Boolean).join('\n'), route: '#/' })),
    ...tasks.map((t) => ({ ref: `task:${t.id}`, clientId: t.client_id, at: t.submitted_at, ico: 'check', what: 'Petición entregada', title: `Revisar: ${t.title}`, detail: t.client_note || '', route: '#/peticiones/enviadas' })),
    ...content.filter((x) => !(x.client_verdict === 'rejected' && ['scheduled', 'published'].includes(x.status))).map((x) => {
      const kind = x.origin === 'client' && x.status === 'idea' && !x.client_verdict ? 'idea' : x.client_verdict;
      const [what, verb] = kind === 'idea' ? ['Propone una publicación', 'Idea del cliente'] : kind === 'rejected' ? [`${x.client_verdict_name || name(x.client_id)} la rechazó`, 'Rehacer'] : [`${x.client_verdict_name || name(x.client_id)} pide cambios`, 'Cambios'];
      return { ref: `content:${x.id}:${kind}`, clientId: x.client_id, at: x.client_verdict_at || x.created_at, ico: kind === 'idea' ? 'spark' : 'edit', what, title: `${verb}: ${x.title}`, detail: x.client_note || '', route: `#/marketing/pieza/${x.id}` };
    }),
    ...meetings.map((m) => ({ ref: `meeting:${m.id}`, clientId: m.client_id, at: m.created_at, ico: 'calendar', what: `${m.author || name(m.client_id)} pide una reunión`, title: `Reunión: ${m.topic}`, detail: m.notes || '', route: '#/reuniones' })),
  ];
  return out
    .map((x) => ({ ...x, client: name(x.clientId), customerId: customer(x.clientId), task: state.tasks.find((t) => t.portal?.ref === x.ref) || null }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// ── Valoraciones ──

export async function ratingsByPortal() {
  const c = await sb();
  const rows = await c.from('portal_ratings').select('client_id,month,score').then(must).catch(() => []);
  const out = new Map();
  for (const r of rows) {
    const cur = out.get(r.client_id) || { months: new Map() };
    const m = cur.months.get(r.month) || [];
    m.push(r.score);
    cur.months.set(r.month, m);
    out.set(r.client_id, cur);
  }
  return [...out].map(([clientId, { months }]) => {
    const [last, scores] = [...months].sort((a, b) => b[0].localeCompare(a[0]))[0];
    return { clientId, month: last, avg: scores.reduce((s, n) => s + n, 0) / scores.length, count: scores.length };
  });
}

// ── Sincronizar solo ──
// Al cambiar proyectos, tareas, horas o documentos (o al llegar una firma), se ponen al día
// los portales unos segundos después. Una vez cada 20 s como mucho.

let timer = 0;
let running = false;
let lastRun = 0;
export const syncState = { at: 0, error: '', last: null };

export async function syncNow({ customers = false } = {}) {
  if (running) return syncState.last;
  running = true;
  try {
    if (!(await isAdmin())) return null;
    const [p, d, cu] = await Promise.all([
      syncProjects().catch((err) => ({ error: err.message })),
      syncDocs().catch((err) => ({ error: err.message })),
      customers ? syncCustomers().catch((err) => ({ error: err.message })) : null,
    ]);
    syncState.at = Date.now();
    syncState.error = p?.error || (typeof d === 'object' ? d?.error : '') || cu?.error || '';
    syncState.last = { projects: p, docs: d, customers: cu };
    bus.dispatchEvent(new CustomEvent('portal-sync', { detail: syncState.last }));
    return syncState.last;
  } finally {
    running = false;
    lastRun = Date.now();
  }
}

export function startAutoSync() {
  if (!mightHaveSession()) return;
  const schedule = (delay = 6000) => {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(() => {}), Math.max(delay, 20_000 - (Date.now() - lastRun)));
  };
  bus.addEventListener('change', (e) => {
    if (['projects', 'tasks', 'time', 'docs', '*', 'pub'].includes(e.detail?.col)) schedule();
  });
  bus.addEventListener('pub', () => schedule(2000));
  schedule(4000);
}
