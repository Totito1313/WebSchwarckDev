// Portal de clientes: accesos y avisos push.
//
//   GET  ?action=vapid                 la clave pública para suscribirse a los avisos
//   POST { action: 'event' }           lo manda la base en cada cambio que importa (cabecera x-portal-hook)
//   POST { action: 'reminders' }       cada mañana (pg_cron): las peticiones que vencen
//   POST { action: 'invite' | 'password' | 'link' }   solo el estudio (app_metadata.role = 'admin')
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

/** A los teléfonos del cliente, salvo a quien silenció esa categoría en su perfil. */
async function toClient(clientId: string, category: string, message: Message) {
  const [subs, members] = await Promise.all([
    rest('portal_push', `?client_id=eq.${clientId}&is_admin=is.false&select=id,endpoint,p256dh,auth,user_id`),
    rest('portal_members', `?client_id=eq.${clientId}&select=user_id,prefs`),
  ]);
  const muted = new Set(members.filter((m: { prefs?: { push?: boolean; mute?: string[] } }) => m.prefs?.push === false || m.prefs?.mute?.includes(category)).map((m: { user_id: string }) => m.user_id));
  return deliver(subs.filter((s: Sub) => !muted.has(s.user_id ?? '')), message);
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
      if (!r.notify) return null;
      return toClient(cid, 'avisos', { title: `${KIND[r.kind] ?? 'Novedad'}: ${clip(r.title, 80)}`, body: clip(r.body), url: appUrl(cid, 'cronologia'), tag: `post-${r.id}` });

    case 'portal_resources':
      if (!r.notify) return null;
      return toClient(cid, 'avisos', { title: 'Recurso nuevo', body: clip(r.title), url: appUrl(cid, 'recursos'), tag: `res-${r.id}` });

    case 'portal_tasks':
      if (op === 'INSERT') {
        if (!r.notify) return null;
        const due = r.due_date ? ` · para el ${new Date(`${r.due_date}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric' })}` : '';
        return toClient(cid, 'peticiones', { title: r.priority === 'high' ? 'Petición urgente' : 'Te necesitamos', body: `${clip(r.title, 100)}${due}`, url: appUrl(cid, 'peticiones'), tag: `task-${r.id}` });
      }
      if (!changed('status')) return null;
      if (byClient) {
        const name = await clientName(cid);
        return toStudio({ title: `${name} ${r.status === 'submitted' ? 'envió una petición' : 'reabrió una petición'}`, body: clip(r.client_note ? `«${r.title}» · ${r.client_note}` : r.title), url: appUrl(cid, 'peticiones/enviadas'), tag: `task-${r.id}` });
      }
      if (r.status === 'done' && r.notify) return toClient(cid, 'peticiones', { title: 'Recibido, ¡gracias!', body: `Revisamos «${clip(r.title, 100)}».`, url: appUrl(cid, 'peticiones/hechas'), tag: `task-${r.id}` });
      return null;

    case 'portal_content':
      if (byClient && changed('client_verdict') && r.client_verdict) {
        const name = await clientName(cid);
        return toStudio({ title: `${name} ${r.client_verdict === 'approved' ? 'aprobó' : 'pide cambios en'} «${clip(r.title, 60)}»`, body: clip(r.client_note), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      }
      if (byClient || !r.notify) return null;
      if ((op === 'INSERT' && r.status === 'review') || (changed('status') && r.status === 'review')) {
        return toClient(cid, 'marketing', { title: 'Para revisar', body: `«${clip(r.title, 90)}» espera tu aprobación.`, url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      }
      if (changed('status') && r.status === 'published') return toClient(cid, 'marketing', { title: 'Publicado', body: clip(r.title), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      if (op === 'INSERT') return toClient(cid, 'marketing', { title: 'Nuevo en tu calendario', body: clip(r.title), url: appUrl(cid, `marketing/pieza/${r.id}`), tag: `content-${r.id}` });
      return null;

    case 'portal_work': {
      if (byClient || !r.notify) return null;
      const nowDone = r.status === 'done' && (op === 'INSERT' || changed('status'));
      const nowDoing = r.status === 'doing' && (op === 'INSERT' || changed('status'));
      if (!nowDone && !nowDoing) return null;
      if (nowDoing) return toClient(cid, 'trabajo', { title: 'Estamos trabajando en…', body: clip(r.title), url: appUrl(cid, 'cronologia/reportes'), tag: `work-${cid}-${r.day}` });
      // Un solo aviso por día que se va actualizando: «Reporte de hoy: 4 tareas hechas».
      const done = await rest('portal_work', `?client_id=eq.${cid}&day=eq.${r.day}&status=eq.done&select=id`);
      const n = done.length;
      return toClient(cid, 'trabajo', { title: r.day === day() ? `Reporte de hoy: ${n} ${n === 1 ? 'tarea hecha' : 'tareas hechas'}` : `Reporte del ${r.day}`, body: `Lo último: ${clip(r.title, 100)}`, url: appUrl(cid, 'cronologia/reportes'), tag: `work-${cid}-${r.day}` });
    }

    case 'portal_submissions': {
      if (!byClient) return null;
      const name = await clientName(cid);
      return toStudio({ title: `${name} te envió ${SENT[r.kind] ?? 'algo'}`, body: clip(r.file_name || r.url || r.body), url: appUrl(cid, ''), tag: `sub-${r.id}` });
    }

    case 'portal_comments':
      if (r.from_studio) return toClient(cid, 'mensajes', { title: 'Schwarck te respondió', body: clip(r.body), url: appUrl(cid, `hilo/${r.target}/${r.target_id}`), tag: `comment-${r.target_id}` });
      return toStudio({ title: `${clip(r.author || (await clientName(cid)), 40)} comentó`, body: clip(r.body), url: appUrl(cid, `hilo/${r.target}/${r.target_id}`), tag: `comment-${r.target_id}` });

    case 'portal_metrics':
      if (byClient || r.channel !== 'total') return null;
      return toClient(cid, 'marketing', { title: `Resultados de ${MONTH(r.month)}`, body: 'Ya puedes ver cómo le fue a tu marca este mes.', url: appUrl(cid, 'marketing/rendimiento'), tag: `metrics-${cid}-${r.month}` });
  }
  return null;
}

/** Cada mañana: a cada cliente, lo que le falta enviar y vence hoy, mañana o ya venció. */
async function reminders() {
  const today = day();
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
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
    });
    sent += r.sent;
  }
  return { clients: byClient.size, sent };
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
    body: { client_id: clientId, user_id: user.id, email, name },
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return { member, password: pass, existed: !pass };
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

    const who = await caller(req);
    if (action === 'test') {
      const subs = await rest('portal_push', `?user_id=eq.${who.id}&select=id,endpoint,p256dh,auth,user_id`);
      return json(await deliver(subs, { title: 'Así te llegarán los avisos', body: 'Todo listo: te avisaremos de cada novedad.', url: '/cliente/', tag: 'test' }));
    }
    if (!who.admin) throw new Fail(403, 'Solo el estudio puede hacer esto.');
    if (action === 'invite') return json(await invite(body));
    if (action === 'password') {
      if (!UUID.test(String(body.user_id))) throw new Fail(400, 'Usuario no válido.');
      const pass = password();
      await sb(`/auth/v1/admin/users/${body.user_id}`, { method: 'PUT', body: { password: pass } });
      return json({ password: pass });
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
