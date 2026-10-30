// De dónde salen los datos del portal.
//
// Dos fuentes con la misma forma:
//   · live: Supabase con la sesión de quien entra. Si su cuenta es del estudio
//     (app_metadata.role = 'admin') ve y gestiona todos los portales; si es de un
//     cliente, las reglas (RLS) le dejan ver lo suyo, comentar, aprobar, enviar y
//     editar su perfil y el de su negocio.
//   · demo: datos de ejemplo en memoria (/cliente/?demo, o ?demo=estudio para el modo
//     estudio), para enseñarla sin cuenta.

import { SUPABASE_URL, SUPABASE_KEY, FUNCTION_URL, BUCKET } from './config.js';

const TABLES = ['posts', 'content', 'resources', 'tasks', 'submissions', 'work', 'metrics', 'leads', 'comments'];
const ORDER = { posts: ['occurred_at', false], content: ['date', true], resources: ['created_at', false], tasks: ['created_at', false], submissions: ['created_at', false], work: ['day', false], metrics: ['month', false], leads: ['date', false], comments: ['created_at', true] };

export async function createBackend() {
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo !== null) return demoBackend(demo === 'estudio');
  const { createClient } = await import('@supabase/supabase-js');
  return liveBackend(createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'portal:auth' },
  }));
}

export function friendly(message = '') {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/maximum allowed size|payload too large|exceeded/i.test(message)) return 'El archivo pesa más de 50 MB. Para vídeos grandes, pega un enlace (Drive, WeTransfer, YouTube…).';
  if (/password should be at least/i.test(message)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/same password|different from the old/i.test(message)) return 'La nueva contraseña tiene que ser distinta.';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) return 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.';
  if (/row-level security|violates|permission denied|no puedes cambiar/i.test(message)) return 'No tienes permiso para hacer esto.';
  if (/duplicate key/i.test(message)) return 'Eso ya existe.';
  return message || 'Algo salió mal.';
}

// ── Supabase ──

function liveBackend(sb) {
  const must = ({ data, error }) => {
    if (error) throw new Error(friendly(error.message));
    return data;
  };
  const session = async () => (await sb.auth.getSession()).data.session;
  const token = async () => (await session())?.access_token;

  async function call(action, body = {}) {
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(friendly(data.error || `Error ${res.status}`));
    return data;
  }

  return {
    mode: 'live',

    async user() {
      return (await session())?.user || null;
    },
    isAdmin: (user) => user?.app_metadata?.role === 'admin',
    onAuth(fn) {
      sb.auth.onAuthStateChange((event, s) => fn(event, s?.user || null));
    },
    async signIn(email, password) {
      must(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await sb.auth.signOut().catch(() => {});
    },
    async updatePassword(password) {
      must(await sb.auth.updateUser({ password }));
    },

    /** Los portales de quien entra. Al estudio, todos, con lo que tiene pendiente cada uno. */
    async portals(user) {
      if (this.isAdmin(user)) {
        const [clients, unseen, sent] = await Promise.all([
          sb.from('portal_clients').select('*').order('archived').order('name').then(must),
          sb.from('portal_submissions').select('client_id').is('seen_at', null).then(must),
          sb.from('portal_tasks').select('client_id').eq('status', 'submitted').then(must),
        ]);
        const count = (rows, id) => rows.filter((r) => r.client_id === id).length;
        return clients.map((c) => ({ client: c, member: { user_id: user.id, name: 'Schwarck', email: user.email, studio: true, prefs: {} }, alerts: count(unseen, c.id) + count(sent, c.id) }));
      }
      const rows = must(await sb.from('portal_members').select('*, portal_clients(*)').eq('user_id', user.id));
      return rows.filter((r) => r.portal_clients && !r.portal_clients.archived).map(({ portal_clients: client, ...member }) => ({ client, member }));
    },

    async load(clientId) {
      const q = (t) => {
        const [col, asc] = ORDER[t];
        return sb.from(`portal_${t}`).select('*').eq('client_id', clientId).order(col, { ascending: asc }).limit(800).then(must);
      };
      const [client, members, ...rest] = await Promise.all([
        sb.from('portal_clients').select('*').eq('id', clientId).single().then(must),
        sb.from('portal_members').select('*').eq('client_id', clientId).then(must),
        ...TABLES.map(q),
      ]);
      return { client, members, ...Object.fromEntries(TABLES.map((t, i) => [t, rest[i]])) };
    },

    /** Crea o actualiza una fila (con id: actualiza). Devuelve la fila guardada. */
    async save(table, row) {
      const { id, ...rest } = row;
      if (id) return must(await sb.from(`portal_${table}`).update(rest).eq('id', id).select().single());
      return must(await sb.from(`portal_${table}`).insert(rest).select().single());
    },
    async saveMany(table, rows) {
      return must(await sb.from(`portal_${table}`).insert(rows).select());
    },
    async upsertMetrics(row) {
      return must(await sb.from('portal_metrics').upsert(row, { onConflict: 'client_id,month,channel' }).select().single());
    },
    async remove(table, id) {
      must(await sb.from(`portal_${table}`).delete().eq('id', id));
    },
    async createPortal(row) {
      return must(await sb.from('portal_clients').insert(row).select().single());
    },
    async updateClient(clientId, patch) {
      return must(await sb.from('portal_clients').update(patch).eq('id', clientId).select().single());
    },
    async updateSelf(clientId, patch) {
      const user = await this.user();
      return must(await sb.from('portal_members').update(patch).eq('client_id', clientId).eq('user_id', user.id).select().single());
    },
    async removeMember(clientId, userId) {
      must(await sb.from('portal_members').delete().eq('client_id', clientId).eq('user_id', userId));
    },
    async markSeen(clientId) {
      const user = await this.user();
      if (!user || this.isAdmin(user)) return;
      await sb.from('portal_members').update({ last_seen_at: new Date().toISOString() }).eq('client_id', clientId).eq('user_id', user.id);
    },
    async markSubmissionsSeen(ids) {
      if (!ids.length) return;
      must(await sb.from('portal_submissions').update({ seen_at: new Date().toISOString() }).in('id', ids));
    },

    /** Sube a Storage con la sesión, contando el progreso (los vídeos tardan). */
    async upload(path, file, onProgress) {
      const t = await token();
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`);
        xhr.setRequestHeader('apikey', SUPABASE_KEY);
        xhr.setRequestHeader('authorization', `Bearer ${t}`);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          let msg = `No se pudo subir (${xhr.status}).`;
          try {
            msg = JSON.parse(xhr.responseText).message || msg;
          } catch {
            // respuesta sin JSON
          }
          reject(new Error(friendly(msg)));
        };
        xhr.onerror = () => reject(new Error('Sin conexión: no se pudo subir.'));
        xhr.send(file);
      });
      return path;
    },
    async removeFiles(paths) {
      if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
    },
    async fileUrls(paths, download = false) {
      if (!paths.length) return {};
      const data = must(await sb.storage.from(BUCKET).createSignedUrls(paths, 3600, download ? { download: true } : undefined));
      return Object.fromEntries(data.filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    },

    async comment(clientId, target, targetId, body, { studio, author }) {
      return must(await sb.from('portal_comments').insert({ client_id: clientId, target, target_id: targetId, body, from_studio: Boolean(studio), author }).select().single());
    },

    async submit({ clientId, taskId, kind, body, url, file, author, onProgress }) {
      const row = { client_id: clientId, task_id: taskId || null, kind, body: body || null, url: url || null, author: author || null };
      if (file) {
        const user = await this.user();
        const path = `${clientId}/entregas/${user.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
        await this.upload(path, file, onProgress);
        Object.assign(row, { storage_path: path, file_name: file.name, size: file.size, mime: file.type || null });
      }
      return must(await sb.from('portal_submissions').insert(row).select().single());
    },
    async removeSubmission(sub) {
      must(await sb.from('portal_submissions').delete().eq('id', sub.id));
      if (sub.storage_path) await this.removeFiles([sub.storage_path]);
    },

    /** Avisa de cualquier cambio en el portal abierto (y, al estudio, de lo nuevo en cualquiera). */
    watch(clientId, onChange, { studio } = {}) {
      const channel = sb.channel(`portal-${clientId}-${Date.now()}`);
      for (const t of ['clients', 'members', ...TABLES]) {
        const filter = t === 'clients' ? `id=eq.${clientId}` : `client_id=eq.${clientId}`;
        channel.on('postgres_changes', { event: '*', schema: 'public', table: `portal_${t}`, filter }, (p) => onChange(t, p));
      }
      if (studio) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_submissions' }, (p) => onChange('any', p));
      channel.subscribe();
      return () => sb.removeChannel(channel);
    },

    // ── Avisos push ──
    async vapidKey() {
      try {
        const cached = localStorage.getItem('portal:vapid');
        if (cached) return cached;
      } catch {
        // sin almacenamiento
      }
      const { key } = await fetch(`${FUNCTION_URL}?action=vapid`).then((r) => r.json());
      try {
        if (key) localStorage.setItem('portal:vapid', key);
      } catch {
        // sin almacenamiento
      }
      return key;
    },
    async savePush(clientId, sub, studio) {
      const user = await this.user();
      const j = sub.toJSON();
      await sb.from('portal_push').delete().eq('endpoint', j.endpoint);
      must(await sb.from('portal_push').insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: user.id, client_id: studio ? null : clientId, is_admin: Boolean(studio), ua: navigator.userAgent.slice(0, 200) }));
    },
    async dropPush(endpoint) {
      await sb.from('portal_push').delete().eq('endpoint', endpoint);
    },
    testPush: () => call('test'),

    // ── Solo el estudio ──
    invite: (clientId, email, name, reset = false) => call('invite', { client_id: clientId, email, name, reset }),
    resetPassword: (userId) => call('password', { user_id: userId }),
    accessLink: (email) => call('link', { email, redirect_to: `${location.origin}/cliente/` }),
  };
}

export const safeName = (name) => String(name || 'archivo').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'archivo';

// ── Demostración ──

function demoBackend(studio) {
  const now = new Date();
  const at = (days, hour = 10, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  };
  const date = (days) => new Date(at(days)).toLocaleDateString('en-CA');
  const month = (back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return d.toLocaleDateString('en-CA');
  };
  const id = () => crypto.randomUUID();
  const c1 = id();
  const c2 = id();
  const me = { user_id: 'demo-user', email: studio ? 'admin@schwarckdev.com' : 'laura@cafearoma.com' };
  const clients = [
    { id: c1, name: 'Café Aroma', accent: '#c26a3d', logo_url: null, welcome: 'Aquí verás cada avance, el calendario de publicaciones, cómo le va a tu marca y lo que necesitamos de ti.', industry: 'Cafetería de especialidad', website: 'https://cafearoma.com', instagram: '@cafearoma', phone: '+58 412 555 0101', address: 'Av. Principal de Las Mercedes, Caracas', hours: 'Lun–Sáb 7:00–21:00', description: 'Café de especialidad tostado en casa.' },
    { id: c2, name: 'Lion Gym', accent: '#7c4dff', logo_url: null, welcome: 'Tu portal de proyecto.', industry: 'Gimnasio', instagram: '@liongym' },
  ];
  const members = [
    { client_id: c1, user_id: 'demo-user', email: 'laura@cafearoma.com', name: 'Laura Méndez', position: 'Dueña', phone: '+58 414 555 0199', last_seen_at: at(-2, 9), prefs: {} },
    { client_id: c1, user_id: 'demo-2', email: 'carlos@cafearoma.com', name: 'Carlos Ruiz', position: 'Encargado', last_seen_at: at(-5), prefs: {} },
  ];
  const t1 = id();
  const t2 = id();
  const k1 = id();
  const k2 = id();
  const data = {
    posts: [
      { id: id(), client_id: c1, kind: 'announcement', pinned: true, title: 'Arrancamos la campaña de noviembre', body: 'Esta semana dejamos listo el calendario y las primeras piezas. Revísalas en Marketing y apruébalas cuando puedas.', occurred_at: at(-1, 9), notify: true },
      { id: id(), client_id: c1, kind: 'delivery', title: 'Entregado: kit de plantillas para historias', body: 'Lo tienes en Recursos, en Canva y en PNG.', occurred_at: at(-3, 16), notify: true },
      { id: id(), client_id: c1, kind: 'milestone', title: 'Etapa completada: identidad visual', body: 'Cerramos logotipo, colores y tipografía.', occurred_at: at(-8, 12), notify: true },
      { id: id(), client_id: c1, kind: 'report', title: 'Resultados de octubre', body: 'Alcance +38 % frente a septiembre. Los reels de proceso son lo que mejor funciona: seguiremos por ahí.', occurred_at: at(-12, 10), notify: true },
    ],
    work: [
      { id: id(), client_id: c1, title: 'Editar el reel de tostado', status: 'doing', day: date(0), minutes: 0, category: 'Vídeo', created_at: at(0, 9) },
      { id: id(), client_id: c1, title: 'Ajustar la paleta de color de la marca', status: 'done', day: date(0), minutes: 45, category: 'Diseño', done_at: at(0, 11), created_at: at(0, 8) },
      { id: id(), client_id: c1, title: 'Plantilla de historias destacadas', status: 'done', day: date(0), minutes: 90, category: 'Diseño', done_at: at(0, 13, 30), created_at: at(0, 8) },
      { id: id(), client_id: c1, title: 'Programar las 3 publicaciones de la semana', status: 'done', day: date(0), minutes: 30, category: 'Redes', done_at: at(0, 15), created_at: at(0, 8) },
      { id: id(), client_id: c1, title: 'Guion del carrusel «5 métodos»', status: 'planned', day: date(1), category: 'Contenido', created_at: at(0, 8) },
      { id: id(), client_id: c1, title: 'Sesión de fotos de producto', status: 'done', day: date(-1), minutes: 180, category: 'Fotografía', done_at: at(-1, 17), created_at: at(-1, 8) },
      { id: id(), client_id: c1, title: 'Responder comentarios y mensajes', status: 'done', day: date(-1), minutes: 40, category: 'Comunidad', done_at: at(-1, 18), created_at: at(-1, 8) },
      { id: id(), client_id: c1, title: 'Informe de resultados de octubre', status: 'done', day: date(-2), minutes: 60, category: 'Análisis', done_at: at(-2, 12), created_at: at(-2, 8) },
    ],
    content: [
      { id: k1, client_id: c1, title: 'Reel: así tostamos el café', date: date(1), time: '18:30', channel: 'instagram', format: 'reel', status: 'review', funnel: 'atraccion', pillar: 'Proceso', objective: 'Mostrar el cuidado artesanal y ganar alcance con un formato que ya nos funciona.', cta: 'Visítanos y pide un café del lote de la semana', caption: 'Del grano a tu taza ☕ Así tostamos cada lote, a mano y en pequeñas cantidades.\n\n¿Lo sabías? Cada tostado dura 12 minutos exactos.', hashtags: '#cafedeespecialidad #tostadoartesanal #caracas #coffeelover', script: '0–3 s: primer plano del grano verde cayendo al tambor.\n3–8 s: el tostador revisa el color.\n8–15 s: el café sale humeando.\n15–20 s: taza servida + logo.', duration: '20 s', campaign: 'Noviembre', notes: 'Música suave, sin voz.', refs: [{ url: 'https://www.instagram.com/', label: 'Referencia de ritmo' }], assets: [], client_verdict: null, created_at: at(-1) },
      { id: k2, client_id: c1, title: 'Carrusel: 5 métodos de preparación', date: date(3), time: '12:00', channel: 'instagram', format: 'carrusel', status: 'approved', funnel: 'autoridad', pillar: 'Educación', objective: 'Posicionarnos como expertos.', cta: 'Guárdalo para tu próximo café', caption: 'V60, prensa francesa, moka… ¿cuál es el tuyo?', hashtags: '#metodosdecafe #v60', client_verdict: 'approved', client_verdict_at: at(-1, 15), created_at: at(-2) },
      { id: id(), client_id: c1, title: 'Promo 2x1 los lunes', date: date(5), time: '09:00', channel: 'facebook', format: 'post', status: 'production', funnel: 'conversion', pillar: 'Promociones', caption: 'Los lunes son menos lunes con un 2x1 en capuchinos.', created_at: at(-2) },
      { id: id(), client_id: c1, title: 'Historia: encuesta de sabores', date: date(0), time: '20:00', channel: 'instagram', format: 'historia', status: 'scheduled', funnel: 'comunidad', created_at: at(-3) },
      { id: id(), client_id: c1, title: 'Post: nuestro equipo', date: date(-2), time: '11:00', channel: 'instagram', format: 'post', status: 'published', funnel: 'comunidad', caption: 'Ellos hacen tu café cada mañana.', client_verdict: 'approved', created_at: at(-6) },
      { id: id(), client_id: c1, title: 'Vídeo: cata guiada', date: date(9), time: '19:00', channel: 'tiktok', format: 'video', status: 'idea', funnel: 'atraccion', created_at: at(-1) },
      { id: id(), client_id: c1, title: 'Reel: un día en la barra', date: date(12), time: '18:00', channel: 'instagram', format: 'reel', status: 'idea', funnel: 'atraccion', created_at: at(-1) },
    ],
    resources: [
      { id: id(), client_id: c1, title: 'Kit de plantillas para historias', kind: 'link', category: 'Diseño', description: 'Editable en Canva.', url: 'https://www.canva.com/', created_at: at(-3, 16) },
      { id: id(), client_id: c1, title: 'Manual de marca', kind: 'doc', category: 'Marca', description: 'Logotipo, colores y tipografía.', url: 'https://example.com/manual.pdf', created_at: at(-8, 12) },
      { id: id(), client_id: c1, title: 'Guía para grabar reels con el móvil', kind: 'video', category: 'Guías', description: '4 minutos. Luz, encuadre y sonido.', url: 'https://www.youtube.com/', created_at: at(-10) },
      { id: id(), client_id: c1, title: 'Fotos de producto (sesión 1)', kind: 'image', category: 'Fotos', description: '24 fotos en alta.', url: 'https://example.com/fotos', created_at: at(-15) },
    ],
    tasks: [
      { id: t1, client_id: c1, title: 'Mándanos el logo en vectorial', description: 'En .ai, .svg o .pdf. Si no lo tienes, una foto bien nítida también sirve.', due_date: date(1), expects: 'file', priority: 'high', status: 'pending', created_at: at(-1, 10) },
      { id: t2, client_id: c1, title: 'Fotos del local por la mañana', description: 'Unas 10 fotos con luz natural, sin gente.', due_date: date(6), expects: 'file', priority: 'normal', status: 'pending', created_at: at(-1, 11) },
      { id: id(), client_id: c1, title: 'Horario de apertura de diciembre', due_date: date(-1), expects: 'text', status: 'submitted', submitted_at: at(-1, 15), client_note: 'Te lo mandé por mensaje.', priority: 'normal', created_at: at(-4) },
      { id: id(), client_id: c1, title: 'Acceso a la cuenta de Instagram', description: 'Como colaborador, desde Meta Business Suite.', due_date: date(-6), expects: 'none', status: 'done', done_at: at(-6, 17), priority: 'normal', created_at: at(-9) },
    ],
    submissions: [
      { id: id(), client_id: c1, kind: 'message', body: 'Diciembre: abrimos de 7:00 a 21:00, cerrado el 25.', author: 'Laura Méndez', created_at: at(-1, 15), task_id: null, user_id: 'demo-user', seen_at: null },
    ],
    metrics: [0, 1, 2, 3, 4, 5].map((back) => ({ id: id(), client_id: c1, month: month(back), channel: 'total', reach: [41200, 29800, 22400, 18100, 15300, 12900][back], impressions: [88000, 64000, 51000, 40500, 33000, 28800][back], engagement: [3900, 2700, 2050, 1600, 1350, 1100][back], followers: [4820, 4510, 4280, 4090, 3950, 3840][back], new_followers: [310, 230, 190, 140, 110, 95][back], clicks: [620, 480, 350, 300, 240, 210][back], leads: [38, 27, 21, 17, 12, 10][back], sales: [2900, 2100, 1650, 1300, 990, 820][back], spend: [180, 150, 150, 120, 100, 100][back], posts: [18, 16, 15, 14, 12, 12][back] })),
    leads: [
      { id: id(), client_id: c1, name: 'Andrea Paz', contact: '+58 414 555 1122', source: 'instagram', stage: 'ganado', value: 120, date: date(-2), campaign: 'Noviembre', notes: 'Pedido para oficina, 20 cafés semanales.' },
      { id: id(), client_id: c1, name: 'Oficinas Altamira', contact: 'compras@altamira.com', source: 'web', stage: 'propuesta', value: 450, date: date(-3), campaign: 'Corporativo' },
      { id: id(), client_id: c1, name: 'Jorge Rivas', source: 'whatsapp', stage: 'contactado', value: 40, date: date(-1) },
      { id: id(), client_id: c1, name: 'María Gómez', source: 'instagram', stage: 'nuevo', date: date(0) },
      { id: id(), client_id: c1, name: 'Evento Feria Gastronómica', source: 'referido', stage: 'calificado', value: 900, date: date(-6) },
      { id: id(), client_id: c1, name: 'Luis Ortega', source: 'tiktok', stage: 'perdido', date: date(-9), notes: 'Buscaba algo más barato.' },
    ],
    comments: [
      { id: id(), client_id: c1, target: 'content', target_id: k1, user_id: 'demo-user', author: 'Laura Méndez', from_studio: false, body: '¿Podemos poner el precio del lote al final?', created_at: at(-1, 16) },
      { id: id(), client_id: c1, target: 'content', target_id: k1, user_id: 'studio', author: 'Schwarck', from_studio: true, body: 'Claro, lo añadimos como texto en los últimos 3 segundos.', created_at: at(-1, 17) },
    ],
  };
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn('demo'));
  const of = (cid) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.filter((r) => r.client_id === cid)]));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
  return {
    mode: 'demo',
    studioDemo: studio,
    async user() { return { id: 'demo-user', email: me.email, app_metadata: studio ? { role: 'admin' } : {} }; },
    isAdmin: () => studio,
    onAuth() {},
    async signIn() {},
    async signOut() { location.href = '/admin/'; },
    async updatePassword() { await wait(); },
    async portals() {
      if (studio) return clients.map((c) => ({ client: c, member: { user_id: 'demo-user', name: 'Schwarck', email: me.email, studio: true, prefs: {} }, alerts: data.submissions.filter((s) => s.client_id === c.id && !s.seen_at).length + data.tasks.filter((t) => t.client_id === c.id && t.status === 'submitted').length }));
      return [{ client: clients[0], member: members[0] }];
    },
    async load(cid) {
      await wait(160);
      return clone({ client: clients.find((c) => c.id === cid), members: members.filter((m) => m.client_id === cid), ...of(cid) });
    },
    async save(table, row) {
      await wait();
      const list = data[table];
      if (row.id) {
        const hit = list.find((x) => x.id === row.id);
        Object.assign(hit, row, { updated_at: new Date().toISOString() });
        if (table === 'work') hit.done_at = hit.status === 'done' ? hit.done_at || new Date().toISOString() : null;
        if (table === 'tasks' && !studio && row.status) hit.submitted_at = row.status === 'submitted' ? new Date().toISOString() : null;
        if (table === 'content' && 'client_verdict' in row && !studio) hit.client_verdict_at = new Date().toISOString();
        notify();
        return clone(hit);
      }
      const created = { id: id(), created_at: new Date().toISOString(), ...row };
      if (table === 'work' && created.status === 'done') created.done_at = new Date().toISOString();
      list.unshift(created);
      notify();
      return clone(created);
    },
    async saveMany(table, rows) {
      const out = [];
      for (const r of rows) out.push(await this.save(table, r));
      return out;
    },
    async upsertMetrics(row) {
      const hit = data.metrics.find((m) => m.client_id === row.client_id && m.month === row.month && m.channel === row.channel);
      return this.save('metrics', hit ? { ...row, id: hit.id } : row);
    },
    async remove(table, rid) {
      await wait();
      data[table] = data[table].filter((x) => x.id !== rid);
      notify();
    },
    async createPortal(row) {
      const c = { id: id(), accent: '#00b8d4', ...row };
      clients.push(c);
      return clone(c);
    },
    async updateClient(cid, patch) {
      await wait();
      const c = clients.find((x) => x.id === cid);
      Object.assign(c, patch);
      return clone(c);
    },
    async updateSelf(cid, patch) {
      await wait();
      const m = members.find((x) => x.client_id === cid && x.user_id === 'demo-user');
      if (m) Object.assign(m, patch);
      return clone(m || patch);
    },
    async removeMember(cid, uid) {
      const i = members.findIndex((m) => m.client_id === cid && m.user_id === uid);
      if (i >= 0) members.splice(i, 1);
    },
    async markSeen(cid) {
      const m = members.find((x) => x.client_id === cid && x.user_id === 'demo-user');
      if (m && !studio) m.last_seen_at = new Date().toISOString();
    },
    async markSubmissionsSeen(ids) {
      for (const s of data.submissions) if (ids.includes(s.id)) s.seen_at = new Date().toISOString();
    },
    async upload(path, file, onProgress) {
      for (let p = 0; p <= 1.001; p += 0.2) {
        onProgress?.(p);
        await wait(110);
      }
      return path;
    },
    async removeFiles() {},
    async fileUrls() { return {}; },
    async comment(cid, target, targetId, body, { studio: fromStudio, author }) {
      return this.save('comments', { client_id: cid, target, target_id: targetId, body, from_studio: Boolean(fromStudio), author, user_id: fromStudio ? 'studio' : 'demo-user' });
    },
    async submit({ clientId, taskId, kind, body, url, file, author, onProgress }) {
      if (file) await this.upload('', file, onProgress);
      return this.save('submissions', { client_id: clientId, task_id: taskId || null, kind, body, url, author, file_name: file?.name || null, size: file?.size || null, storage_path: file ? `demo/${file.name}` : null, user_id: 'demo-user', seen_at: null });
    },
    async removeSubmission(sub) { await this.remove('submissions', sub.id); },
    watch(_, fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async vapidKey() { return null; },
    async savePush() {},
    async dropPush() {},
    async testPush() { return { sent: 0 }; },
    async invite(cid, email, name) {
      await wait(500);
      const m = { client_id: cid, user_id: id(), email, name, prefs: {} };
      members.push(m);
      return { member: m, password: 'demo-1234-abcd-ef', existed: false };
    },
    async resetPassword() { await wait(400); return { password: 'demo-5678-ghij-kl' }; },
    async accessLink() { await wait(400); return { link: `${location.origin}/cliente/?demo` }; },
  };
}
