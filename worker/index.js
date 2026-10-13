// API del sitio: novedades de CeroFiao, reseñas y el panel de administración.
//
// Solo atiende /api/*; el resto del sitio son archivos estáticos que Cloudflare
// sirve sin pasar por aquí (ver `run_worker_first` en wrangler.jsonc).
//
// Almacén: un espacio KV enlazado como SITE.
//   changelog            lista de novedades (JSON). Si falta, vale data/changelog.json
//   review:<id>          una reseña; todo su contenido va en los metadatos de la
//                        clave, así listar las reseñas es una sola lectura
//   reviews:public       las aprobadas, ya ordenadas, para servirlas de una lectura
//   rl:<cubo>            contadores con caducidad para limitar abusos
//
// Limitadores (opcionales, ver `ratelimits` en wrangler.jsonc): LOGIN_LIMIT y
// WRITE_LIMIT frenan ráfagas por visitante sin escribir nada en el almacén.
//
// Secretos: ADMIN_PASSWORD (lo define el dueño en Cloudflare; sin él no hay panel) y,
// si se quiere, SESSION_SECRET (cambiarlo cierra todas las sesiones abiertas).

import seed from '../data/changelog.json';

const enc = new TextEncoder();
const SESSION_HOURS = 12;
const DAILY_REVIEWS = 120; // tope de reseñas aceptadas al día en todo el sitio
const PENDING_DAYS = 60; // una reseña sin revisar caduca sola
const REJECTED_DAYS = 30; // una rechazada, también
const COOKIE = 'sd_admin';
const MIN_PASSWORD = 10;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...headers },
  });
const fail = (status, error) => json({ error }, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error(err);
      return fail(500, 'Algo falló en el servidor.');
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function route(request, env, url) {
  const { pathname } = url;
  const { method } = request;

  if (pathname === '/api/changelog' && method === 'GET') {
    const entries = (await readChangelog(env)).filter((e) => e.published !== false);
    return json({ entries }, 200, { 'cache-control': 'public, max-age=120' });
  }
  if (pathname === '/api/reviews' && method === 'GET') return publicReviews(env);
  if (pathname === '/api/reviews' && method === 'POST') return submitReview(request, env, url);
  if (pathname.startsWith('/api/admin/')) return admin(request, env, url);
  return fail(404, 'No existe.');
}

// ── Utilidades ──

/** Las peticiones que cambian algo tienen que venir de esta misma web. */
function sameOrigin(request, url) {
  if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origen no permitido.');
}

async function readJson(request, maxBytes) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new HttpError(415, 'Se esperaba JSON.');
  // El tamaño se comprueba antes de leer: un cuerpo enorme no llega a cargarse.
  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0) throw new HttpError(411, 'Falta el tamaño del cuerpo.');
  if (declared > maxBytes) throw new HttpError(413, 'Demasiado grande.');
  const raw = await request.text();
  if (raw.length > maxBytes) throw new HttpError(413, 'Demasiado grande.');
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'JSON no válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Se esperaba un objeto JSON.');
  return body;
}

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromB64url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Una conexión IPv6 de casa es dueña de todo su /64: se cuenta la red, no cada dirección. */
function network(ip) {
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':');
}

/** Huella de quien llama, sin guardar su IP: cambia cada día y no se puede invertir. */
async function caller(request, env) {
  const ip = network(request.headers.get('CF-Connecting-IP') || 'local');
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${ip}|${day}|${env.ADMIN_PASSWORD || 'sin-secreto'}`));
  return hex(digest).slice(0, 20);
}

/** Usos anotados en un cubo. KV no da un contador exacto: es un tope aproximado, no una barrera. */
const used = async (env, bucket) => Number(await env.SITE.get(`rl:${bucket}`)) || 0;

/** Anota un uso. Si el almacén no admite más escrituras hoy, no se rompe nada por eso. */
async function count(env, bucket, current, ttlSeconds) {
  try {
    await env.SITE.put(`rl:${bucket}`, String(current + 1), { expirationTtl: ttlSeconds });
  } catch (err) {
    console.error('contador', err);
  }
}

/** Cuenta un uso en un cubo; false si ya se pasó del límite. */
async function allow(env, bucket, limit, ttlSeconds) {
  const current = await used(env, bucket);
  if (current >= limit) return false;
  await count(env, bucket, current, ttlSeconds);
  return true;
}

/** Freno de ráfagas con el limitador de Cloudflare; si no está enlazado, deja pasar. */
async function burstOk(limiter, key) {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}

const clean = (text) => String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

// ── Novedades ──

async function readChangelog(env) {
  if (!env.SITE) return seed;
  const saved = await env.SITE.get('changelog', 'json');
  return Array.isArray(saved) ? saved : seed;
}

function validateChangelog(list) {
  if (!Array.isArray(list) || list.length > 100) throw new HttpError(400, 'La lista de novedades no es válida.');
  const seen = new Set();
  return list.map((raw, i) => {
    const title = clean(raw?.title);
    if (title.length < 1 || title.length > 80) throw new HttpError(400, `Entrada ${i + 1}: el título debe tener entre 1 y 80 caracteres.`);
    const date = clean(raw?.date);
    if (date && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) throw new HttpError(400, `«${title}»: la fecha no es válida.`);
    const tag = clean(raw?.tag);
    if (tag.length > 40) throw new HttpError(400, `«${title}»: la etiqueta es demasiado larga.`);
    const items = (Array.isArray(raw?.items) ? raw.items : []).map(clean).filter(Boolean);
    if (items.length < 1 || items.length > 40) throw new HttpError(400, `«${title}»: necesita entre 1 y 40 cambios.`);
    if (items.some((item) => item.length > 500)) throw new HttpError(400, `«${title}»: un cambio pasa de 500 caracteres.`);
    let id = clean(raw?.id).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
    if (!id || seen.has(id)) id = `e-${Date.now().toString(36)}-${i}`;
    seen.add(id);
    return { id, title, date, tag, published: raw?.published !== false, items };
  });
}

// ── Reseñas ──

async function publicReviews(env) {
  if (!env.SITE) return json({ enabled: false, reviews: [], count: 0, average: 0 });
  const reviews = (await env.SITE.get('reviews:public', 'json')) || [];
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  return json({ enabled: true, reviews, count: reviews.length, average: Math.round(average * 10) / 10 }, 200, { 'cache-control': 'public, max-age=120' });
}

async function submitReview(request, env, url) {
  if (!env.SITE) throw new HttpError(503, 'Las reseñas todavía no están abiertas.');
  sameOrigin(request, url);
  const body = await readJson(request, 4000);

  // Campo trampa relleno o envío instantáneo: un robot. Se le dice que sí y no se guarda nada.
  if (clean(body.website) || !(Number(body.elapsed) >= 3000)) return json({ ok: true });

  const name = clean(body.name).replace(/\s+/g, ' ');
  const text = clean(body.text).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  const rating = Number(body.rating);
  if (name.length < 2 || name.length > 40) throw new HttpError(400, 'Escribe un nombre de entre 2 y 40 caracteres.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Elige una calificación de 1 a 5.');
  if (text.length < 10 || text.length > 500) throw new HttpError(400, 'La reseña debe tener entre 10 y 500 caracteres.');
  if (/https?:\/\/|www\./i.test(`${name} ${text}`)) throw new HttpError(400, 'Sin enlaces, por favor.');

  const review = { name, rating, text, createdAt: new Date().toISOString(), status: 'pending' };
  // Los metadatos de una clave admiten 1024 bytes; emojis y acentos pesan más que una letra.
  if (enc.encode(JSON.stringify(review)).length > 1000) throw new HttpError(400, 'La reseña es demasiado larga. Prueba con menos texto o menos emojis.');

  // De aquí en adelante se escribe en el almacén. Primero el freno de ráfagas (no escribe) y
  // los dos topes, leídos antes de anotar nada: pasado el tope del día no se gasta ni una escritura.
  const who = await caller(request, env);
  if (!(await burstOk(env.WRITE_LIMIT, who))) throw new HttpError(429, 'Demasiadas peticiones. Espera un minuto.');
  const dayBucket = `reviews-day:${new Date().toISOString().slice(0, 10)}`;
  const [mine, today] = await Promise.all([used(env, `review:${who}`), used(env, dayBucket)]);
  if (mine >= 3) throw new HttpError(429, 'Ya enviaste varias reseñas hoy. Vuelve a intentarlo mañana.');
  if (today >= DAILY_REVIEWS) throw new HttpError(429, 'Hoy ya recibimos muchas reseñas. Vuelve a intentarlo mañana.');

  try {
    await env.SITE.put(`review:${newReviewId()}`, '1', { metadata: review, expirationTtl: PENDING_DAYS * 86400 });
  } catch (err) {
    console.error('reseña', err);
    throw new HttpError(503, 'No pudimos guardar tu reseña ahora. Inténtalo más tarde.');
  }
  await Promise.all([count(env, `review:${who}`, mine, 86400), count(env, dayBucket, today, 172800)]);
  return json({ ok: true }, 201);
}

/** El id empieza por una cuenta atrás: KV lista por orden alfabético y así salen primero las nuevas. */
function newReviewId() {
  const countdown = (9e15 - Date.now()).toString(36).padStart(11, '0');
  return `${countdown}-${hex(crypto.getRandomValues(new Uint8Array(4)))}`;
}

async function listReviewKeys(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.SITE.list({ prefix: 'review:', cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < 5000);
  return keys;
}

/** Todas las reseñas, la más nueva primero. `patch` corrige lo que el listado aún no refleja. */
async function allReviews(env, patch = {}) {
  const reviews = new Map();
  for (const key of await listReviewKeys(env)) {
    if (key.metadata) reviews.set(key.name.slice('review:'.length), key.metadata);
  }
  for (const [id, review] of Object.entries(patch)) {
    if (review) reviews.set(id, review);
    else reviews.delete(id);
  }
  return [...reviews].map(([id, review]) => ({ id, ...review })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Rehace la lista pública: solo lo aprobado y solo lo que se muestra. */
async function rebuildPublic(env, patch) {
  const reviews = (await allReviews(env, patch))
    .filter((r) => r.status === 'approved')
    .slice(0, 60)
    .map(({ id, name, rating, text, createdAt }) => ({ id, name, rating, text, createdAt }));
  await env.SITE.put('reviews:public', JSON.stringify(reviews));
}

// ── Panel ──

const passwordOk = (env) => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= MIN_PASSWORD;

async function sessionKey(env) {
  // SESSION_SECRET es opcional: cambiarlo cierra todas las sesiones sin tocar la contraseña.
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`sd-admin-session|${env.ADMIN_PASSWORD}|${env.SESSION_SECRET || ''}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function issueCookie(env) {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), enc.encode(`admin|${expires}`));
  return `${COOKIE}=${expires}.${b64url(signature)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

async function isAdmin(request, env) {
  if (!passwordOk(env)) return false;
  const match = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`).exec(request.headers.get('Cookie') || '');
  if (!match || Number(match[1]) < Date.now()) return false;
  try {
    return await crypto.subtle.verify('HMAC', await sessionKey(env), fromB64url(match[2]), enc.encode(`admin|${match[1]}`));
  } catch {
    return false;
  }
}

/** Compara sin filtrar por el tiempo cuántos caracteres coinciden. */
async function samePassword(given, real) {
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [a, b] = (await Promise.all([given, real].map((v) => crypto.subtle.sign('HMAC', key, enc.encode(v))))).map((v) => new Uint8Array(v));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function admin(request, env, url) {
  const path = url.pathname.slice('/api/admin'.length);
  const { method } = request;
  if (method !== 'GET') sameOrigin(request, url);

  if (path === '/session' && method === 'GET') {
    return json({ configured: passwordOk(env), storage: Boolean(env.SITE), authed: await isAdmin(request, env) });
  }

  if (path === '/login' && method === 'POST') {
    if (!passwordOk(env)) throw new HttpError(503, 'Falta definir la contraseña del panel.');
    if (!env.SITE) throw new HttpError(503, 'Falta el almacén de datos.');
    // Con el limitador enlazado no hace falta gastar escrituras del almacén en contar intentos.
    const who = await caller(request, env);
    const calm = env.LOGIN_LIMIT ? await burstOk(env.LOGIN_LIMIT, who) : await allow(env, `login:${who}`, 8, 900);
    if (!calm) throw new HttpError(429, 'Demasiados intentos. Espera un minuto.');
    const body = await readJson(request, 1000);
    if (!(await samePassword(String(body.password ?? ''), env.ADMIN_PASSWORD))) throw new HttpError(401, 'Contraseña incorrecta.');
    return json({ ok: true }, 200, { 'set-cookie': await issueCookie(env) });
  }

  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }

  if (!(await isAdmin(request, env))) throw new HttpError(401, 'Inicia sesión.');
  if (!env.SITE) throw new HttpError(503, 'Falta el almacén de datos.');

  if (path === '/changelog' && method === 'GET') return json({ entries: await readChangelog(env) });
  if (path === '/changelog' && method === 'PUT') {
    const entries = validateChangelog((await readJson(request, 400000)).entries);
    await env.SITE.put('changelog', JSON.stringify(entries));
    return json({ ok: true, entries });
  }

  if (path === '/reviews' && method === 'GET') return json({ reviews: await allReviews(env) });

  const one = /^\/reviews\/([a-z0-9-]{6,40})$/.exec(path);
  if (one) {
    const key = `review:${one[1]}`;
    if (method === 'DELETE') {
      await env.SITE.delete(key);
      await rebuildPublic(env, { [one[1]]: null });
      return json({ ok: true });
    }
    if (method === 'POST') {
      const { status } = await readJson(request, 200);
      if (!['approved', 'rejected', 'pending'].includes(status)) throw new HttpError(400, 'Estado no válido.');
      const found = await env.SITE.getWithMetadata(key);
      if (!found.metadata) throw new HttpError(404, 'Esa reseña ya no existe.');
      const review = { ...found.metadata, status };
      const days = { approved: 0, pending: PENDING_DAYS, rejected: REJECTED_DAYS }[status];
      await env.SITE.put(key, '1', days ? { metadata: review, expirationTtl: days * 86400 } : { metadata: review });
      await rebuildPublic(env, { [one[1]]: review });
      return json({ ok: true, review: { id: one[1], ...review } });
    }
  }

  return fail(404, 'No existe.');
}
