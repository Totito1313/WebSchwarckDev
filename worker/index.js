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
//   crm:settings         datos del negocio para facturar (solo el panel)
//   crm:share:<token>    a qué documento lleva un enlace público, y su contraseña
//   crm:pub:<docId>      aperturas, firma o rechazo de ese enlace (en metadatos)
//   crm:sig:<docId>      la firma dibujada, como imagen PNG en texto
//   crm:<colección>      clientes, catálogo, formas de cobro, documentos, proyectos,
//                        tareas y horas, cada colección en una sola clave (ver CRM
//                        más abajo)
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
  if (pathname.startsWith('/api/public/doc/')) return publicDoc(request, env, url);
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

// ── Negocio: clientes, catálogo, formas de cobro, documentos y trabajo ──
//
// Es una herramienta para una sola persona: cada colección vive en una clave y el
// panel la carga entera al abrir. Las escrituras llegan en lotes (`ops`) que se
// aplican juntos, así un pago y su recibo se guardan a la vez. KV admite una
// escritura por segundo en cada clave; el panel pone las suyas en fila.
// Con miles de documentos esto pediría una base de datos (D1).

const CRM = {
  customers: { key: 'crm:customers', max: 3000 },
  catalog: { key: 'crm:catalog', max: 1000 },
  paytemplates: { key: 'crm:paytemplates', max: 100 },
  docs: { key: 'crm:docs', max: 10000 },
  projects: { key: 'crm:projects', max: 1000 },
  tasks: { key: 'crm:tasks', max: 10000 },
  time: { key: 'crm:time', max: 30000 },
  expenses: { key: 'crm:expenses', max: 20000 },
  vendors: { key: 'crm:vendors', max: 2000 },
  categories: { key: 'crm:categories', max: 200 },
  brands: { key: 'crm:brands', max: 50 },
  posts: { key: 'crm:posts', max: 10000 },
};
const CRM_ITEM_BYTES = 80_000;
const CRM_SETTINGS_BYTES = 400_000; // el logo va dentro, como imagen en texto
const DOC_PREFIX = { invoice: 'FAC', quote: 'COT', receipt: 'REC', proposal: 'PRO' };
const CRM_ID = /^[A-Za-z0-9_-]{6,64}$/;
const CRM_FIELD = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

async function readCrm(env) {
  const names = Object.keys(CRM);
  const [settings, ...lists] = await Promise.all([
    env.SITE.get('crm:settings', 'json'),
    ...names.map((name) => env.SITE.get(CRM[name].key, 'json')),
  ]);
  const data = { settings: settings && typeof settings === 'object' ? settings : {} };
  names.forEach((name, i) => {
    data[name] = Array.isArray(lists[i]) ? lists[i] : [];
  });
  return data;
}

/** Copia limpia de lo que manda el panel: solo datos simples y con tamaños acotados. */
function tidy(value, depth = 0) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 300_000);
  if (depth > 6) throw new HttpError(400, 'Datos demasiado anidados.');
  if (Array.isArray(value)) {
    if (value.length > 500) throw new HttpError(400, 'Una lista tiene demasiados elementos.');
    return value.map((v) => tidy(v, depth + 1));
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 120) throw new HttpError(400, 'Demasiados campos.');
    const out = {};
    for (const key of keys) {
      if (!CRM_FIELD.test(key)) throw new HttpError(400, 'Hay un campo con un nombre no válido.');
      out[key] = tidy(value[key], depth + 1);
    }
    return out;
  }
  throw new HttpError(400, 'Tipo de dato no válido.');
}

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Facturas, cotizaciones y recibos se numeran aquí, por tipo y por año: FAC-2026-0001. */
function numberDoc(doc, list, before) {
  if (!DOC_PREFIX[doc.type]) throw new HttpError(400, 'Tipo de documento no válido.');
  if (before?.number && before.type === doc.type) {
    doc.number = before.number;
    return;
  }
  const year = /^\d{4}-\d{2}-\d{2}$/.test(doc.issueDate || '') ? doc.issueDate.slice(0, 4) : new Date().toISOString().slice(0, 4);
  const prefix = `${DOC_PREFIX[doc.type]}-${year}-`;
  let top = 0;
  for (const other of list) {
    if (typeof other.number === 'string' && other.number.startsWith(prefix)) top = Math.max(top, Number(other.number.slice(prefix.length)) || 0);
  }
  doc.number = prefix + String(top + 1).padStart(4, '0');
}

async function writeCrm(env, ops) {
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > 50) throw new HttpError(400, 'Lote de cambios no válido.');
  const data = await readCrm(env);
  const now = new Date().toISOString();
  const touched = new Set();
  const cleanup = [];
  const saved = [];

  for (const op of ops) {
    if (op?.col === 'settings') {
      const settings = tidy(op.item);
      if (op.op !== 'put' || !isRecord(settings)) throw new HttpError(400, 'Datos del negocio no válidos.');
      if (enc.encode(JSON.stringify(settings)).length > CRM_SETTINGS_BYTES) throw new HttpError(413, 'Los datos del negocio pesan demasiado. Prueba con un logo más pequeño.');
      data.settings = { ...settings, updatedAt: now };
      touched.add('settings');
      saved.push({ col: 'settings', item: data.settings });
      continue;
    }

    const spec = CRM[op?.col];
    const id = String(op?.id ?? '');
    if (!spec || !CRM_ID.test(id)) throw new HttpError(400, 'Cambio no válido.');
    const list = data[op.col];
    const at = list.findIndex((x) => x.id === id);

    if (op.op === 'delete') {
      if (at >= 0) {
        // Con el documento se van su enlace público, sus respuestas y su firma.
        if (op.col === 'docs') {
          const token = list[at].share?.token;
          cleanup.push(`crm:pub:${id}`, `crm:sig:${id}`);
          if (token && SHARE_TOKEN.test(token)) cleanup.push(`crm:share:${token}`);
        }
        list.splice(at, 1);
        touched.add(op.col);
      }
      continue;
    }
    if (op.op !== 'put') throw new HttpError(400, 'Operación no válida.');

    let item = tidy(op.item);
    if (!isRecord(item)) throw new HttpError(400, 'Elemento no válido.');
    const before = at >= 0 ? list[at] : null;
    // Lo que el cliente firmó ya no cambia: solo su estado y a qué factura o proyecto llevó.
    if (op.col === 'docs' && before && SIGNABLE.includes(before.type) && (await pubMeta(env, id)).acceptedAt) {
      item = { ...before, status: item.status, invoiceId: item.invoiceId ?? before.invoiceId ?? '', projectId: item.projectId ?? before.projectId ?? '', share: item.share ?? null };
    }
    item.id = id;
    if (op.col === 'docs') numberDoc(item, list, before);
    item.createdAt = before?.createdAt || now;
    item.updatedAt = now;
    if (enc.encode(JSON.stringify(item)).length > CRM_ITEM_BYTES) throw new HttpError(413, 'Ese elemento pesa demasiado.');
    if (before) list[at] = item;
    else if (list.length >= spec.max) throw new HttpError(400, 'Llegaste al máximo de elementos de esa lista.');
    else list.push(item);
    touched.add(op.col);
    saved.push({ col: op.col, item });
  }

  try {
    await Promise.all([...touched].map((col) => env.SITE.put(col === 'settings' ? 'crm:settings' : CRM[col].key, JSON.stringify(data[col]))));
    await Promise.all(cleanup.map((key) => env.SITE.delete(key)));
  } catch (err) {
    if (/429|too many/i.test(String(err?.message))) throw new HttpError(429, 'Demasiados cambios seguidos.');
    throw err;
  }
  return { ok: true, saved };
}

// Recibos de los gastos: imágenes o PDF, cada uno en su clave (crm:file:<id>).
// Solo se sirven con su tipo de la lista: nada que el navegador pueda ejecutar.
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const FILE_BYTES = 3_000_000;

async function crmFile(request, env, method, id) {
  const key = `crm:file:${id}`;
  if (method === 'GET') {
    const { value, metadata } = await env.SITE.getWithMetadata(key, 'arrayBuffer');
    if (!value) throw new HttpError(404, 'Ese archivo ya no existe.');
    const type = FILE_TYPES.includes(metadata?.type) ? metadata.type : 'application/octet-stream';
    return new Response(value, { headers: { 'content-type': type, 'content-disposition': 'inline', 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=86400' } });
  }
  if (method === 'PUT') {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!FILE_TYPES.includes(type)) throw new HttpError(415, 'Solo imágenes PNG, JPG o WebP, o un PDF.');
    const declared = Number(request.headers.get('content-length'));
    if (!Number.isFinite(declared) || declared <= 0) throw new HttpError(411, 'Falta el tamaño del archivo.');
    if (declared > FILE_BYTES) throw new HttpError(413, 'El archivo pasa de 3 MB.');
    const body = await request.arrayBuffer();
    if (body.byteLength > FILE_BYTES) throw new HttpError(413, 'El archivo pasa de 3 MB.');
    await env.SITE.put(key, body, { metadata: { type, size: body.byteLength } });
    return json({ ok: true, id, type, size: body.byteLength }, 201);
  }
  if (method === 'DELETE') {
    await env.SITE.delete(key);
    return json({ ok: true });
  }
  throw new HttpError(405, 'Método no permitido.');
}

// ── Enlaces públicos de documentos ──
//
// Un enlace es un token largo y aleatorio: crm:share:<token> guarda a qué
// documento lleva, su contraseña (resumida con PBKDF2, nunca en claro) y cuándo
// caduca. Lo que pasa en el enlace (aperturas, firma, rechazo) va aparte, en los
// metadatos de crm:pub:<docId>, y la firma dibujada en crm:sig:<docId>: la
// página pública nunca reescribe la lista de documentos del panel.

const SHARE_TOKEN = /^[A-Za-z0-9_-]{32}$/;
const SIGNABLE = ['quote', 'proposal'];
const VIEW_GAP = 30 * 60 * 1000; // una apertura cada media hora como mucho
const SHARE_DAYS = [0, 7, 30, 90];
const PUBLIC_FIELDS = ['type', 'number', 'status', 'issueDate', 'dueDate', 'validUntil', 'currency', 'equiv', 'customer', 'from', 'items',
  'discount', 'tax', 'withholding', 'shipping', 'payment', 'notes', 'sections', 'signature', 'style', 'title', 'blocks', 'method',
  'balanceAfter', 'invoiceNumber'];

const pubMeta = async (env, docId) => (await env.SITE.getWithMetadata(`crm:pub:${docId}`)).metadata || {};

async function readPub(env) {
  const pub = {};
  let cursor;
  do {
    const page = await env.SITE.list({ prefix: 'crm:pub:', cursor });
    for (const key of page.keys) if (key.metadata) pub[key.name.slice('crm:pub:'.length)] = key.metadata;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return pub;
}

async function hashSharePassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}

/** Llave para que la página pública cargue las imágenes del documento sin volver a pedir la contraseña. */
async function fileKey(token, fileId, salt) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`${token}|${fileId}|${salt}`))).slice(0, 32);
}

async function createShare(env, body) {
  const docId = String(body.docId || '');
  if (!CRM_ID.test(docId)) throw new HttpError(400, 'Documento no válido.');
  const docs = (await env.SITE.get(CRM.docs.key, 'json')) || [];
  if (!docs.some((d) => d.id === docId)) throw new HttpError(404, 'Guarda el documento antes de compartirlo.');
  const password = String(body.password ?? '');
  if (password && (password.length < 4 || password.length > 100)) throw new HttpError(400, 'La contraseña debe tener entre 4 y 100 caracteres.');
  const days = Number(body.days) || 0;
  if (!SHARE_DAYS.includes(days)) throw new HttpError(400, 'Caducidad no válida.');
  const token = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const record = {
    docId,
    salt,
    hash: password ? await hashSharePassword(password, salt) : '',
    expiresAt: days ? Date.now() + days * 86400000 : 0,
    createdAt: new Date().toISOString(),
  };
  await env.SITE.put(`crm:share:${token}`, JSON.stringify(record), days ? { expirationTtl: (days + 1) * 86400 } : undefined);
  return { token, expiresAt: record.expiresAt, hasPassword: Boolean(password), createdAt: record.createdAt };
}

/** Solo lo que se ve en la hoja: nada de notas internas, enlaces a proyectos ni identificadores. */
function publicView(doc) {
  const out = {};
  for (const key of PUBLIC_FIELDS) if (doc[key] !== undefined) out[key] = doc[key];
  out.payments = (doc.payments || []).map((p) => ({ amount: p.amount, date: p.date }));
  return out;
}

/** Las imágenes subidas al panel se sirven por el enlace, con una llave por imagen. */
async function exposeFiles(data, token, salt) {
  let text = JSON.stringify(data);
  const ids = new Set([...text.matchAll(/\/api\/admin\/crm\/files\/([A-Za-z0-9_-]{6,64})/g)].map((m) => m[1]));
  for (const id of ids) text = text.replaceAll(`/api/admin/crm/files/${id}`, `/api/public/doc/${token}/file/${id}?k=${await fileKey(token, id, salt)}`);
  return JSON.parse(text);
}

const publicResponse = (pub) => ({ acceptedAt: pub.acceptedAt || '', name: pub.name || '', mode: pub.mode || '', declinedAt: pub.declinedAt || '' });

async function publicDoc(request, env, url) {
  if (!env.SITE) throw new HttpError(503, 'No disponible.');
  const m = /^\/api\/public\/doc\/([A-Za-z0-9_-]{32})(?:\/(accept|decline)|\/file\/([A-Za-z0-9_-]{6,64}))?$/.exec(url.pathname);
  if (!m) throw new HttpError(404, 'No existe.');
  const [, token, action, fileId] = m;
  const share = await env.SITE.get(`crm:share:${token}`, 'json');
  const gone = !share || (share.expiresAt && share.expiresAt < Date.now());

  if (fileId) {
    if (request.method !== 'GET' || gone) throw new HttpError(404, 'No existe.');
    if (url.searchParams.get('k') !== (await fileKey(token, fileId, share.salt))) throw new HttpError(403, 'Enlace no válido.');
    return crmFile(request, env, 'GET', fileId);
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
  sameOrigin(request, url);
  if (gone) throw new HttpError(410, 'Este enlace ya no está disponible. Pide uno nuevo a quien te lo envió.');
  const body = await readJson(request, 200_000);
  const who = await caller(request, env);

  if (share.hash) {
    const given = String(body.password ?? '');
    if (!given) return json({ needsPassword: true }, 401);
    if (!(await burstOk(env.LOGIN_LIMIT, `${who}|${token}`))) throw new HttpError(429, 'Demasiados intentos. Espera un minuto.');
    if (!(await samePassword(await hashSharePassword(given, share.salt), share.hash))) return json({ needsPassword: true, error: 'Contraseña incorrecta.' }, 401);
  }

  const docs = (await env.SITE.get(CRM.docs.key, 'json')) || [];
  const doc = docs.find((d) => d.id === share.docId);
  if (!doc) throw new HttpError(410, 'Este documento ya no existe.');
  const pubKey = `crm:pub:${doc.id}`;
  const pub = await pubMeta(env, doc.id);

  if (!action) {
    const now = Date.now();
    if (!pub.lastViewAt || now - pub.lastViewAt > VIEW_GAP) {
      const next = { ...pub, views: (pub.views || 0) + 1, viewedAt: pub.viewedAt || new Date(now).toISOString(), lastViewAt: now };
      try {
        await env.SITE.put(pubKey, '1', { metadata: next });
        Object.assign(pub, next);
      } catch (err) {
        console.error('apertura', err);
      }
    }
    const settings = (await env.SITE.get('crm:settings', 'json')) || {};
    const drawn = pub.acceptedAt && pub.mode === 'drawn' ? await env.SITE.get(`crm:sig:${doc.id}`) : null;
    const data = { doc: publicView(doc), business: { name: settings.name || '', logo: settings.logo || '' }, response: publicResponse(pub), drawn };
    return json(await exposeFiles(data, token, share.salt));
  }

  if (!SIGNABLE.includes(doc.type)) throw new HttpError(400, 'Este documento no se firma.');
  if (pub.acceptedAt || pub.declinedAt) throw new HttpError(409, 'Este documento ya tiene respuesta.');
  if (doc.validUntil && doc.validUntil < new Date().toISOString().slice(0, 10)) throw new HttpError(410, 'Este documento ya venció. Pide uno actualizado.');
  if (!(await burstOk(env.WRITE_LIMIT, who))) throw new HttpError(429, 'Demasiadas peticiones. Espera un minuto.');

  if (action === 'accept') {
    const name = clean(body.name).replace(/\s+/g, ' ').slice(0, 80);
    if (name.length < 2) throw new HttpError(400, 'Escribe tu nombre completo.');
    if (body.agree !== true) throw new HttpError(400, 'Marca la casilla para aceptar.');
    const mode = body.mode === 'drawn' ? 'drawn' : 'typed';
    if (mode === 'drawn') {
      const image = String(body.image || '');
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image) || image.length > 150_000) throw new HttpError(400, 'La firma dibujada no es válida. Prueba a escribirla.');
      await env.SITE.put(`crm:sig:${doc.id}`, image);
    }
    const next = { ...pub, acceptedAt: new Date().toISOString(), name, mode, by: who.slice(0, 12) };
    await env.SITE.put(pubKey, '1', { metadata: next });
    return json({ ok: true, response: publicResponse(next) });
  }

  const reason = clean(body.reason).replace(/\s+/g, ' ').slice(0, 160);
  const next = { ...pub, declinedAt: new Date().toISOString(), reason };
  await env.SITE.put(pubKey, '1', { metadata: next });
  return json({ ok: true, response: publicResponse(next) });
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

  if (path === '/crm' && method === 'GET') return json({ ...(await readCrm(env)), pub: await readPub(env) });
  if (path === '/crm/pub' && method === 'GET') return json({ pub: await readPub(env) });
  if (path === '/crm/share' && method === 'POST') return json(await createShare(env, await readJson(request, 2000)), 201);
  const shareKey = /^\/crm\/share\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (shareKey && method === 'DELETE') {
    await env.SITE.delete(`crm:share:${shareKey[1]}`);
    return json({ ok: true });
  }
  const sig = /^\/crm\/signature\/([A-Za-z0-9_-]{6,64})$/.exec(path);
  if (sig && method === 'GET') {
    const image = await env.SITE.get(`crm:sig:${sig[1]}`);
    if (!image) throw new HttpError(404, 'Sin firma dibujada.');
    const bytes = Uint8Array.from(atob(image.slice(image.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' } });
  }
  if (path === '/crm/batch' && method === 'POST') return json(await writeCrm(env, (await readJson(request, 2_000_000)).ops));
  const file = /^\/crm\/files\/([A-Za-z0-9_-]{6,64})$/.exec(path);
  if (file) return crmFile(request, env, method, file[1]);

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
