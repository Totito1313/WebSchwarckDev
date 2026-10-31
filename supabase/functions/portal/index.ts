// Portal de clientes: accesos y avisos push.
//
//   GET  ?action=vapid                 la clave pública para suscribirse a los avisos
//   POST { action: 'event' }           lo manda la base en cada cambio que importa (cabecera x-portal-hook)
//   POST { action: 'reminders' }       cada mañana (pg_cron): lo que vence, lo que espera aprobación
//                                      y, los lunes, el resumen de la semana
//   POST { action: 'claim' }           crea o recupera la cuenta del estudio con un pase de un solo uso
//                                      que da el panel de schwarckdev.com (prueba que tiene la sesión abierta)
//   POST { action: 'invite' | 'password' | 'link' | 'users' | 'create_user' | 'set_studio' | 'delete_user'
//          | 'mcp_key' | 'mcp_status' | 'mcp_revoke' }
//                                      solo el estudio (app_metadata.role = 'admin'); los tres últimos,
//                                      la dirección secreta del conector de Claude de cada portal
//   POST { action: 'test' }            cualquiera con sesión: un aviso de prueba a sus dispositivos
//
// Las claves VAPID se crean aquí la primera vez y se guardan en Vault (portal_store_setting);
// el secreto del gancho lo crea la base. Ningún secreto vive en el código ni en Cloudflare.
// Se despliega con verify_jwt = false: cada acción comprueba quién llama.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const named = (env: string, legacy: string) => {
  try {
    return JSON.parse(Deno.env.get(env) ?? '')['default'] as string;
  } catch {
    return Deno.env.get(legacy) ?? '';
  }
};
const SECRET_KEY = named('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const PUBLISHABLE_KEY = named('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const enc = new TextEncoder();

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json' } });

class Fail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Supabase con la clave secreta ──

const keyHeaders = (key: string) => (key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` });

async function sb(path: string, { method = 'GET', body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...keyHeaders(SECRET_KEY), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Fail(res.status >= 500 ? 502 : res.status, data?.message || data?.msg || data?.error_description || `Supabase respondió ${res.status}.`);
  return data;
}
const rest = (table: string, query = '', opts = {}) => sb(`/rest/v1/${table}${query}`, opts);
const rpc = (name: string, args: Record<string, unknown> = {}) => sb(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });

// ── Ajustes (Vault) ──

type Settings = { portal_hook_secret?: string; portal_vapid_public?: string; portal_vapid_private?: string };
let settings: Settings | null = null;

async function loadSettings(): Promise<Settings> {
  if (settings?.portal_vapid_private) return settings;
  settings = await rpc('portal_settings');
  if (!settings!.portal_vapid_private) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
    const priv = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;
    await rpc('portal_store_setting', { setting: 'portal_vapid_public', value: pub });
    await rpc('portal_store_setting', { setting: 'portal_vapid_private', value: priv });
    settings = await rpc('portal_settings');
  }
  return settings!;
}

function sameText(a = '', b = '') {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Quién llama ──

async function caller(req: Request) {
  const token = /^Bearer\s+(.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new Fail(401, 'Inicia sesión.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Fail(401, 'Inicia sesión.');
  const user = await res.json();
  return { id: user.id as string, email: user.email as string, admin: user.app_metadata?.role === 'admin' };
}

// ── Avisos ──

type Message = { title: string; body?: string; url?: string; tag?: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string | null };

const day = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
const appUrl = (clientId: string, route = '') => `/cliente/?p=${clientId}#/${route}`;

async function deliver(subs: Sub[], message: Message) {
  const s = await loadSettings();
  if (!subs.length || !s.portal_vapid_private) return { sent: 0, failed: 0 };
  const payload = JSON.stringify(message);
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      const status = await sendPush(s, sub, payload);
      if (status === 404 || status === 410) gone.push(sub.id);
      else if (status >= 200 && status < 300) sent++;
      else failed++;
    } catch (err) {
      console.error('push', err);
      failed++;
    }
  }));
  if (gone.length) await rest('portal_push', `?id=in.(${gone.join(',')})`, { method: 'DELETE' }).catch(() => {});
  return { sent, failed, removed: gone.length };
}

// ── Permisos: la misma regla que private.perm() en la base ──

const PERM_SECTION: Record<string, string> = {
  'timeline.view': 'cronologia', 'report.view': 'reporte', 'content.view': 'calendario', 'metrics.view': 'rendimiento',
  'leads.view': 'leads', 'resources.view': 'recursos', 'tasks.view': 'peticiones', send: 'enviar',
};
const PERM_KEYS = [
  'timeline.view', 'report.view', 'content.view', 'metrics.view', 'leads.view', 'resources.view', 'tasks.view',
  'content.approve', 'content.reject', 'content.propose', 'posts.create', 'tasks.submit', 'resources.upload',
  'leads.add', 'leads.edit', 'comment', 'send', 'business.edit',
];
const roleAllows = (role: string, k: string) => (role === 'owner' ? true : role === 'member' ? k !== 'business.edit' : k.endsWith('.view'));
const permDefault = (k: string) => k.endsWith('.view') || ['content.approve', 'content.reject', 'comment', 'tasks.submit', 'send', 'business.edit'].includes(k);
function memberCan(m: Row, portal: Row, k: string) {
  const section = PERM_SECTION[k];
  if (section && (portal?.hidden?.includes(section) || m.hidden?.includes(section))) return false;
  if (m.perms && k in m.perms) return m.perms[k] === true;
  return roleAllows(m.role, k) && (portal?.perms?.[k] ?? permDefault(k));
}

/**
 * A los teléfonos del cliente, salvo a quien silenció esa categoría en su perfil, a quien no
 * tiene ese permiso (por ejemplo, no ve el calendario) y a quien lo hizo (`except`).
 */
async function toClient(clientId: string, category: string, message: Message, perm?: string, except?: string | null) {
  const [subs, members, [portal]] = await Promise.all([
    rest('portal_push', `?client_id=eq.${clientId}&is_admin=is.false&select=id,endpoint,p256dh,auth,user_id`),
    rest('portal_members', `?client_id=eq.${clientId}&select=user_id,role,prefs,hidden,perms`),
    rest('portal_clients', `?id=eq.${clientId}&select=hidden,perms,archived`),
  ]);
  if (!portal || portal.archived) return { sent: 0, failed: 0 };
  const allowed = new Set(members.filter((m: Row) => m.prefs?.push !== false && !m.prefs?.mute?.includes(category) && (!perm || memberCan(m, portal, perm)) && m.user_id !== except).map((m: Row) => m.user_id));
  return deliver(subs.filter((s: Sub) => allowed.has(s.user_id ?? '')), message);
}
const toStudio = async (message: Message) => deliver(await rest('portal_push', '?is_admin=is.true&select=id,endpoint,p256dh,auth,user_id'), message);

const clip = (text: unknown, n = 140) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const KIND: Record<string, string> = { announcement: 'Anuncio', update: 'Avance', milestone: 'Hito', delivery: 'Entrega', report: 'Informe' };
const SENT: Record<string, string> = { message: 'un mensaje', link: 'un enlace', file: 'un archivo', video: 'un vídeo' };
const MONTH = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es', { month: 'long', year: 'numeric' });

async function clientName(id: string) {
  const [c] = await rest('portal_clients', `?id=eq.${id}&select=name`);
  return c?.name ?? 'Un cliente';
}

type Row = Record<string, any>;

async function onEvent({ table, op, record: r, old, actor }: { table: string; op: string; record: Row; old: Row | null; actor: string }) {
  const cid = r.client_id as string;
  const byClient = actor === 'client';
  const changed = (k: string) => op === 'UPDATE' && old?.[k] !== r[k];

  switch (table) {
    case 'portal_posts':
      if (byClient) {
        // Un anuncio del cliente: al estudio y al resto de su equipo.
        const who = clip(r.author || (await clientName(cid)), 40);
        await toClient(cid, 'avisos', { title: `${who} publicó un anuncio`, body: clip(r.title), url: appUrl(cid, ''), tag: `post-${r.id}` }, undefined, r.created_by);
        return toStudio({ title: `${who} publicó un anuncio`, body: clip(r.title), url: appUrl(cid, ''), tag: `post-${r.id}` });
      }
      if (!r.notify) return null;
      return toClient(cid, 'avisos', { title: `${KIND[r.kind] ?? 'Novedad'}: ${clip(r.title, 80)}`, body: clip(r.body), url: appUrl(cid, 'cronologia'), tag: `post-${r.id}` });

    case 'portal_resources':
      if (byClient) return toStudio({ title: `${await clientName(cid)} subió un recurso`, body: clip(r.title), url: appUrl(cid, 'recursos'), tag: `res-${r.id}` });
      if (!r.notify) return null;
      return toClient(cid, 'avisos', { title: 'Recurso nuevo', body: clip(r.title), url: appUrl(cid, 'recursos'), tag: `res-${r.id}` }, 'resources.view');

    case 'portal_tasks':
      if (op === 'INSERT') {
        if (!r.notify) return null;
        const due = r.due_date ? ` · para el ${new Date(`${r.due_date}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric' })}` : '';
        return toClient(cid, 'peticiones', { title: r.priority === 'high' ? 'Petición urgente' : 'Te necesitamos', body: `${clip(r.title, 100)}${due}`, url: appUrl(cid, 'peticiones'), tag: `task-${r.id}` }, 'tasks.view');
      }
      if (!changed('status')) return null;
      if (byClient) {
        const name = await clientName(cid);
        return toStudio({ title: `${name} ${r.status === 'submitted' ? 'envió una petición' : 'reabrió una petición'}`, body: clip(r.client_note ? `«${r.title}» · ${r.client_note}` : r.title), url: appUrl(cid, 'peticiones/enviadas'), tag: `task-${r.id}` });
      }
      if (r.status === 'done' && r.notify) return toClient(cid, 'peticiones', { title: 'Recibido, ¡gracias!', body: `Revisamos «${clip(r.title, 100)}».`, url: appUrl(cid, 'peticiones/hechas'), tag: `task-${r.id}` }, 'tasks.view');
      return null;

    case 'portal_content':
      if (byClient && op === 'INSERT') {
        return toStudio({ title: `${await clientName(cid)} propone una publicación`, body: clip(r.title), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      }
      if (byClient && changed('client_verdict') && r.client_verdict) {
        const name = clip(r.client_verdict_name || (await clientName(cid)), 40);
        const verb = r.client_verdict === 'approved' ? 'aprobó' : r.client_verdict === 'rejected' ? 'rechazó' : 'pide cambios en';
        return toStudio({ title: `${name} ${verb} «${clip(r.title, 60)}»`, body: clip(r.client_note), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      }
      if (byClient || !r.notify) return null;
      if ((op === 'INSERT' && r.status === 'review') || (changed('status') && r.status === 'review')) {
        return toClient(cid, 'marketing', { title: 'Para revisar', body: `«${clip(r.title, 90)}» espera tu aprobación.`, url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` }, 'content.view');
      }
      if (changed('status') && r.status === 'published') return toClient(cid, 'marketing', { title: 'Publicado', body: clip(r.title), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` }, 'content.view');
      if (op === 'INSERT') return toClient(cid, 'marketing', { title: 'Nuevo en tu calendario', body: clip(r.title), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` }, 'content.view');
      return null;

    case 'portal_work': {
      if (byClient || !r.notify) return null;
      const nowDone = r.status === 'done' && (op === 'INSERT' || changed('status'));
      const nowDoing = r.status === 'doing' && (op === 'INSERT' || changed('status'));
      if (!nowDone && !nowDoing) return null;
      if (nowDoing) return toClient(cid, 'trabajo', { title: 'Estamos trabajando en…', body: clip(r.title), url: appUrl(cid, 'cronologia/reportes'), tag: `work-${cid}-${r.day}` }, 'report.view');
      // Un solo aviso por día que se va actualizando: «Reporte de hoy: 4 tareas hechas».
      const done = await rest('portal_work', `?client_id=eq.${cid}&day=eq.${r.day}&status=eq.done&select=id`);
      const n = done.length;
      return toClient(cid, 'trabajo', { title: r.day === day() ? `Reporte de hoy: ${n} ${n === 1 ? 'tarea hecha' : 'tareas hechas'}` : `Reporte del ${r.day}`, body: `Lo último: ${clip(r.title, 100)}`, url: appUrl(cid, 'cronologia/reportes'), tag: `work-${cid}-${r.day}` }, 'report.view');
    }

    case 'portal_submissions': {
      if (!byClient) return null;
      const name = await clientName(cid);
      return toStudio({ title: `${name} te envió ${SENT[r.kind] ?? 'algo'}`, body: clip(r.file_name || r.url || r.body), url: appUrl(cid, ''), tag: `sub-${r.id}` });
    }

    case 'portal_comments':
      if (r.from_studio) return toClient(cid, 'mensajes', { title: 'Schwarck te respondió', body: clip(r.body), url: appUrl(cid, `hilo/${r.target}/${r.target_id}`), tag: `comment-${r.target_id}` });
      return toStudio({ title: `${clip(r.author || (await clientName(cid)), 40)} comentó`, body: clip(r.body), url: appUrl(cid, `hilo/${r.target}/${r.target_id}`), tag: `comment-${r.target_id}` });

    case 'portal_leads':
      if (!byClient) return null;
      return toStudio({ title: `${await clientName(cid)} añadió un lead`, body: clip(r.name), url: appUrl(cid, 'marketing/leads'), tag: `lead-${r.id}` });

    case 'portal_metrics':
      if (byClient || r.channel !== 'total') return null;
      return toClient(cid, 'marketing', { title: `Resultados de ${MONTH(r.month)}`, body: 'Ya puedes ver cómo le fue a tu marca este mes.', url: appUrl(cid, 'marketing/rendimiento'), tag: `metrics-${cid}-${r.month}` }, 'metrics.view');
  }
  return null;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Cada mañana: a cada cliente, lo que le falta enviar y vence hoy, mañana o ya venció; lo que
 * lleva más de un día esperando su aprobación; y los lunes, cómo viene su semana.
 */
async function reminders() {
  const today = day();
  const tomorrow = addDays(today, 1);
  const tasks = await rest('portal_tasks', `?status=eq.pending&due_date=lte.${tomorrow}&select=client_id,title,due_date&order=due_date.asc`);
  const byClient = new Map<string, Row[]>();
  for (const t of tasks) byClient.set(t.client_id, [...(byClient.get(t.client_id) ?? []), t]);
  let sent = 0;
  for (const [cid, list] of byClient) {
    const first = list[0];
    const when = first.due_date < today ? 'ya venció' : first.due_date === today ? 'vence hoy' : 'vence mañana';
    const r = await toClient(cid, 'peticiones', {
      title: list.length === 1 ? 'Te falta enviarnos algo' : `Te faltan ${list.length} cosas por enviarnos`,
      body: `«${clip(first.title, 80)}» ${when}.`,
      url: appUrl(cid, 'peticiones'),
      tag: `reminder-${cid}`,
    }, 'tasks.view');
    sent += r.sent;
  }

  // Publicaciones para revisar sin respuesta desde ayer.
  const since = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const waiting = await rest('portal_content', `?status=eq.review&client_verdict=is.null&updated_at=lt.${since}&select=client_id,title&order=date.asc`);
  const toApprove = new Map<string, Row[]>();
  for (const c of waiting) toApprove.set(c.client_id, [...(toApprove.get(c.client_id) ?? []), c]);
  for (const [cid, list] of toApprove) {
    const r = await toClient(cid, 'marketing', {
      title: list.length === 1 ? 'Una publicación espera tu aprobación' : `${list.length} publicaciones esperan tu aprobación`,
      body: list.length === 1 ? `«${clip(list[0].title, 90)}»` : `Empezando por «${clip(list[0].title, 70)}».`,
      url: appUrl(cid, 'marketing'),
      tag: `approve-${cid}`,
    }, 'content.approve');
    sent += r.sent;
  }

  // Los lunes, la semana de cada cliente.
  let weekly = 0;
  if (new Date(`${today}T12:00:00Z`).getUTCDay() === 1) {
    const sunday = addDays(today, 6);
    const [portals, week, review, pending] = await Promise.all([
      rest('portal_clients', '?archived=is.false&select=id'),
      rest('portal_content', `?date=gte.${today}&date=lte.${sunday}&select=client_id`),
      rest('portal_content', '?status=eq.review&client_verdict=is.null&select=client_id'),
      rest('portal_tasks', '?status=eq.pending&select=client_id'),
    ]);
    const count = (rows: Row[], id: string) => rows.filter((x) => x.client_id === id).length;
    for (const p of portals) {
      const [w, a, t] = [count(week, p.id), count(review, p.id), count(pending, p.id)];
      if (!w && !a && !t) continue;
      const parts = [w && plural(w, 'publicación', 'publicaciones'), a && `${a} para aprobar`, t && plural(t, 'petición pendiente', 'peticiones pendientes')].filter(Boolean);
      const r = await toClient(p.id, 'marketing', { title: 'Tu semana', body: parts.join(' · '), url: appUrl(p.id, ''), tag: `week-${p.id}` });
      sent += r.sent;
      weekly++;
    }
  }
  return { clients: byClient.size, approvals: toApprove.size, weekly, sent };
}

// ── Accesos (solo el estudio) ──

const password = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(14))].map((b) => abc[b % abc.length]).join('').replace(/(.{4})(?=.)/g, '$1-');
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

async function findUser(email: string) {
  for (let page = 1; page <= 20; page++) {
    const data = await sb(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    const hit = users.find((u: Row) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function invite(body: Row) {
  const clientId = String(body.client_id ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim().slice(0, 120) || null;
  if (!UUID.test(clientId)) throw new Fail(400, 'Portal no válido.');
  if (!EMAIL.test(email)) throw new Fail(400, 'Ese correo no parece válido.');
  let user = await findUser(email);
  let pass: string | null = null;
  if (!user) {
    pass = password();
    user = await sb('/auth/v1/admin/users', { method: 'POST', body: { email, password: pass, email_confirm: true, user_metadata: { name } } });
  } else if (body.reset) {
    pass = password();
    await sb(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: { password: pass } });
  }
  const [member] = await rest('portal_members', '?on_conflict=client_id,user_id', {
    method: 'POST',
    body: { client_id: clientId, user_id: user.id, email, name, ...memberAccess(body) },
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return { member, password: pass, existed: !pass };
}

const ROLES = ['owner', 'member', 'viewer'];
const SECTIONS = ['cronologia', 'reporte', 'calendario', 'rendimiento', 'leads', 'recursos', 'peticiones', 'enviar'];
function memberAccess(body: Row) {
  const out: Row = {};
  if (ROLES.includes(body.role)) out.role = body.role;
  if (Array.isArray(body.hidden)) out.hidden = body.hidden.filter((x: unknown) => SECTIONS.includes(String(x)));
  if (body.perms && typeof body.perms === 'object') {
    out.perms = Object.fromEntries(Object.entries(body.perms).filter(([k, v]) => PERM_KEYS.includes(k) && typeof v === 'boolean'));
  }
  return out;
}
const isStudio = (u: Row) => u?.app_metadata?.role === 'admin';

/** Todas las cuentas, con su rol (los portales de cada una los lee la app en portal_members). */
async function listUsers() {
  const all: Row[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await sb(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < 200) break;
  }
  return all.map((u) => ({ id: u.id, email: u.email, name: u.user_metadata?.name ?? null, studio: isStudio(u), created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null }));
}

/** Crea una cuenta (o usa la que ya existe con ese correo), con su rol y sus portales. */
async function createUser(body: Row) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim().slice(0, 120) || null;
  if (!EMAIL.test(email)) throw new Fail(400, 'Ese correo no parece válido.');
  const chosen = typeof body.password === 'string' && body.password.length ? body.password : null;
  if (chosen && chosen.length < 8) throw new Fail(400, 'La contraseña tiene que tener al menos 8 caracteres.');
  const studio = Boolean(body.studio);
  let user = await findUser(email);
  let pass: string | null = null;
  const app_metadata = studio ? { ...(user?.app_metadata ?? {}), role: 'admin' } : undefined;
  if (!user) {
    pass = chosen ?? password();
    user = await sb('/auth/v1/admin/users', { method: 'POST', body: { email, password: pass, email_confirm: true, user_metadata: { name }, ...(app_metadata ? { app_metadata } : {}) } });
  } else {
    const patch: Row = {};
    if (chosen || body.reset) patch.password = pass = chosen ?? password();
    if (app_metadata) patch.app_metadata = app_metadata;
    if (name) patch.user_metadata = { ...(user.user_metadata ?? {}), name };
    if (Object.keys(patch).length) user = await sb(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: patch });
  }
  const portals = Array.isArray(body.portals) ? body.portals.filter((p: Row) => UUID.test(String(p.client_id))) : [];
  const members = portals.length
    ? await rest('portal_members', '?on_conflict=client_id,user_id', {
      method: 'POST',
      body: portals.map((p: Row) => ({ client_id: p.client_id, user_id: user.id, email, name, ...memberAccess(p) })),
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    })
    : [];
  return { user: { id: user.id, email, name, studio: isStudio(user) }, members, password: pass };
}

/** Canjea el pase del panel (lo comprueba el Worker de schwarckdev.com) y deja lista la cuenta del estudio. */
async function claim(body: Row) {
  const ticket = String(body.ticket ?? '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(ticket)) throw new Fail(400, 'Pase no válido.');
  if (typeof body.password !== 'string' || body.password.length < 8) throw new Fail(400, 'La contraseña tiene que tener al menos 8 caracteres.');
  const check = await fetch('https://schwarckdev.com/api/portal-ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) });
  if (!check.ok) throw new Fail(401, 'El pase no vale: vuelve a intentarlo desde el panel.');
  const r = await createUser({ email: body.email, name: body.name || 'Schwarck', password: body.password, studio: true });
  return { ok: true, email: r.user.email };
}

// ── Entrada ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('action') === 'vapid') {
      const s = await loadSettings();
      return json({ key: s.portal_vapid_public ?? null });
    }
    if (req.method !== 'POST') throw new Fail(405, 'Método no permitido.');
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    if (action === 'event' || action === 'reminders') {
      const s = await loadSettings();
      if (!sameText(req.headers.get('x-portal-hook') ?? '', s.portal_hook_secret)) throw new Fail(401, 'No.');
      return json(action === 'event' ? (await onEvent(body)) ?? { skipped: true } : await reminders());
    }

    if (action === 'claim') return json(await claim(body));

    const who = await caller(req);
    if (action === 'test') {
      const subs = await rest('portal_push', `?user_id=eq.${who.id}&select=id,endpoint,p256dh,auth,user_id`);
      return json(await deliver(subs, { title: 'Así te llegarán los avisos', body: 'Todo listo: te avisaremos de cada novedad.', url: '/cliente/', tag: 'test' }));
    }
    if (!who.admin) throw new Fail(403, 'Solo el estudio puede hacer esto.');
    if (action === 'invite') return json(await invite(body));
    if (action === 'users') return json({ users: await listUsers() });
    if (action === 'create_user') return json(await createUser(body));
    if (action === 'set_studio') {
      if (!UUID.test(String(body.user_id))) throw new Fail(400, 'Usuario no válido.');
      if (body.user_id === who.id && !body.studio) throw new Fail(400, 'No puedes quitarte a ti mismo el acceso del estudio.');
      const data = await sb(`/auth/v1/admin/users/${body.user_id}`);
      const meta = { ...(data?.app_metadata ?? {}) };
      if (body.studio) meta.role = 'admin';
      else delete meta.role;
      await sb(`/auth/v1/admin/users/${body.user_id}`, { method: 'PUT', body: { app_metadata: meta } });
      return json({ ok: true });
    }
    if (action === 'delete_user') {
      if (!UUID.test(String(body.user_id))) throw new Fail(400, 'Usuario no válido.');
      if (body.user_id === who.id) throw new Fail(400, 'No puedes borrar tu propia cuenta desde aquí.');
      await sb(`/auth/v1/admin/users/${body.user_id}`, { method: 'DELETE' });
      return json({ ok: true });
    }
    if (action === 'password') {
      if (!UUID.test(String(body.user_id))) throw new Fail(400, 'Usuario no válido.');
      const pass = password();
      await sb(`/auth/v1/admin/users/${body.user_id}`, { method: 'PUT', body: { password: pass } });
      return json({ password: pass });
    }
    if (action === 'mcp_key' || action === 'mcp_status' || action === 'mcp_revoke') {
      if (!UUID.test(String(body.client_id))) throw new Fail(400, 'Portal no válido.');
      if (action === 'mcp_revoke') {
        await rpc('portal_mcp_revoke', { c: body.client_id });
        return json({ ok: true });
      }
      if (action === 'mcp_status') return json({ status: await rpc('portal_mcp_status', { c: body.client_id }) });
      const token = await rpc('portal_mcp_issue', { c: body.client_id });
      return json({ url: `${SUPABASE_URL}/functions/v1/portal-mcp/${token}` });
    }
    if (action === 'link') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Fail(400, 'Ese correo no parece válido.');
      const redirect = String(body.redirect_to ?? '');
      const data = await sb('/auth/v1/admin/generate_link', { method: 'POST', body: { type: 'magiclink', email, ...(redirect.startsWith('https://') ? { redirect_to: redirect } : {}) } });
      const link = data?.action_link ?? data?.properties?.action_link;
      if (!link) throw new Fail(502, 'Supabase no devolvió el enlace.');
      return json({ link });
    }
    throw new Fail(400, 'Acción desconocida.');
  } catch (err) {
    if (err instanceof Fail) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Algo falló en el servidor.' }, 500);
  }
});

// ── Web Push (RFC 8291 y RFC 8292) con WebCrypto ──

function b64url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(text: string) {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let signer: { pub: string; key: CryptoKey } | null = null;
async function vapidKey(s: Settings) {
  if (signer?.pub === s.portal_vapid_public) return signer.key;
  const pub = unb64url(s.portal_vapid_public!);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: s.portal_vapid_private, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  signer = { pub: s.portal_vapid_public!, key };
  return key;
}

async function vapidHeader(s: Settings, endpoint: string) {
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:soporte@schwarckdev.com' })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(s), enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64url(sig)}, k=${s.portal_vapid_public}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bits: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bits));
}

async function encryptPush(sub: Sub, payload: string) {
  const uaPub = unb64url(sub.p256dh);
  const secret = unb64url(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const head = new Uint8Array(16 + 4 + 1 + 65);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = 65;
  head.set(asPub, 21);
  return concat(head, cipher);
}

async function sendPush(s: Settings, sub: Sub, payload: string) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidHeader(s, sub.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '86400',
      urgency: 'normal',
    },
    body: await encryptPush(sub, payload),
  });
  await res.body?.cancel();
  return res.status;
}
