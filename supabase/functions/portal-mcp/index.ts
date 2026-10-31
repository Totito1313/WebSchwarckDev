// Conector de Claude (MCP) para el calendario de contenido de un portal.
//
// Cada portal tiene su propia dirección secreta, que se crea (y se cambia o se revoca) en
// Negocio › Portal de clientes › Clientes:
//   https://<proyecto>.supabase.co/functions/v1/portal-mcp/<secreto>
// En Claude: Ajustes › Conectores › Añadir conector personalizado, con esa dirección. Así, desde
// el proyecto de un cliente, Claude ve su calendario y carga de una vez lo que se ideó.
//
// La dirección completa queda en los registros de Supabase, que solo ve quien administra el
// proyecto; si se filtra, se cambia en Negocio y la anterior deja de valer al momento.
//
// MCP por HTTP («Streamable HTTP») sin sesión: cada POST trae un mensaje JSON-RPC y la respuesta
// va en JSON. Solo toca el calendario de ESE portal. Lo que crea entra como «Idea» o «En
// producción» y sin avisar al cliente: el estudio lo revisa y lo pasa a «Para revisar» desde la
// app. Nunca aprueba, programa, publica ni borra lo que no creó él.
// Se despliega con verify_jwt = false: la dirección secreta es la llave.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const named = (env: string, legacy: string) => {
  try {
    return JSON.parse(Deno.env.get(env) ?? '')['default'] as string;
  } catch {
    return Deno.env.get(legacy) ?? '';
  }
};
const SECRET_KEY = named('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

type Row = Record<string, any>;

class Fail extends Error {}

const keyHeaders = (key: string) => (key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` });
async function sb(path: string, { method = 'GET', body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...keyHeaders(SECRET_KEY), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Supabase respondió ${res.status}.`);
  return data;
}
const rest = (table: string, query = '', opts = {}) => sb(`/rest/v1/${table}${query}`, opts);
const rpc = (name: string, args: Record<string, unknown>) => sb(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });

// ── El calendario ──

const CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'web', 'email', 'otro'];
const FORMATS = ['post', 'carrusel', 'reel', 'historia', 'video', 'articulo', 'otro'];
const FUNNELS = ['atraccion', 'autoridad', 'conversion', 'comunidad'];
const STATUS: Record<string, string> = { idea: 'Idea', production: 'En producción', review: 'Para revisar', approved: 'Aprobado', scheduled: 'Programado', published: 'Publicado' };
const VERDICT: Record<string, string> = { approved: 'aprobada por el cliente', changes: 'el cliente pidió cambios', rejected: 'rechazada por el cliente' };
const EDITABLE = ['idea', 'production'];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

const PIECE_PROPS: Row = {
  titulo: { type: 'string', description: 'Título interno de la publicación (máx. 200).' },
  fecha: { type: 'string', description: 'Día de publicación, AAAA-MM-DD.' },
  hora: { type: 'string', description: 'Hora de publicación, HH:MM (24 h).' },
  redes: { type: 'array', items: { type: 'string', enum: CHANNELS }, description: 'Una o varias redes donde sale la misma pieza.' },
  formato: { type: 'string', enum: FORMATS, description: 'post = estático de una imagen.' },
  estado: { type: 'string', enum: ['idea', 'production'], description: 'idea (por defecto) o production. Nunca se crea en revisión ni aprobada.' },
  embudo: { type: 'string', enum: FUNNELS, description: 'Etapa del embudo: atraccion, autoridad, conversion o comunidad.' },
  pilar: { type: 'string', description: 'Pilar de contenido (p. ej. Educación, Proceso, Testimonios).' },
  objetivo: { type: 'string', description: 'Para qué sirve esta pieza.' },
  cta: { type: 'string', description: 'Llamada a la acción.' },
  campana: { type: 'string', description: 'Campaña a la que pertenece.' },
  copy: { type: 'string', description: 'El texto que acompaña la publicación (caption).' },
  hashtags: { type: 'string', description: 'Hashtags separados por espacios.' },
  texto_en_pieza: { type: 'string', description: 'post / carrusel / historia: el texto que va sobre la imagen (titular).' },
  indicaciones_diseno: { type: 'string', description: 'post / carrusel / historia: indicaciones para el diseño (fondo, foto, colores, composición).' },
  diapositivas: { type: 'array', items: { type: 'string' }, description: 'carrusel: el texto de cada diapositiva, en orden.' },
  historias: { type: 'array', items: { type: 'string' }, description: 'historia: lo que va en cada pantalla, en orden (texto, sticker, encuesta…).' },
  guion: { type: 'string', description: 'reel / video: el guion por tiempos (0–3 s: …).' },
  duracion: { type: 'string', description: 'reel / video: duración aproximada (p. ej. «30 s»).' },
  notas: { type: 'string', description: 'reel / video: notas de grabación (lugar, música, tono).' },
  esquema: { type: 'string', description: 'articulo: la estructura o esquema del texto.' },
  palabra_clave: { type: 'string', description: 'articulo: la palabra clave principal.' },
  referencias: { type: 'array', items: { type: 'string' }, description: 'Enlaces de referencia o inspiración (https://…).' },
};

const TOOLS = [
  {
    name: 'ver_portal',
    description: 'Resumen del portal del cliente: nombre, fecha de hoy, cómo está su calendario, pilares y campañas que ya se usan y lo próximo que sale. Úsala antes de planificar.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'ver_calendario',
    description: 'Las publicaciones del calendario entre dos fechas (por defecto, de hoy a 60 días), con su estado y su respuesta del cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'AAAA-MM-DD' },
        hasta: { type: 'string', description: 'AAAA-MM-DD' },
        estado: { type: 'string', enum: Object.keys(STATUS) },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'ver_publicacion',
    description: 'Todo lo de una publicación: estrategia, copy, guion o diseño, referencias y la respuesta del cliente.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'El id de la publicación.' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'crear_publicaciones',
    description: 'Carga varias publicaciones de una vez en el calendario del cliente (hasta 60). Cada una puede ir a varias redes. Usa los campos según el formato: post/carrusel/historia → texto_en_pieza, indicaciones_diseno, diapositivas o historias; reel/video → guion, duracion, notas; articulo → esquema, palabra_clave. Entran como «Idea» (o «En producción») y el cliente no recibe aviso hasta que el estudio las mande a revisar.',
    inputSchema: {
      type: 'object',
      properties: { publicaciones: { type: 'array', minItems: 1, maxItems: 60, items: { type: 'object', properties: PIECE_PROPS, required: ['titulo', 'fecha', 'redes', 'formato'], additionalProperties: false } } },
      required: ['publicaciones'],
      additionalProperties: false,
    },
  },
  {
    name: 'editar_publicacion',
    description: 'Cambia una publicación que todavía está en «Idea» o «En producción». Solo los campos que mandes; el resto queda igual. Lo que ya está para revisar, aprobado, programado o publicado se cambia desde la app.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'El id de la publicación.' }, cambios: { type: 'object', properties: PIECE_PROPS, additionalProperties: false } },
      required: ['id', 'cambios'],
      additionalProperties: false,
    },
  },
  {
    name: 'borrar_publicacion',
    description: 'Quita una publicación que creó este conector y sigue en «Idea». No borra nada del estudio ni del cliente.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    annotations: { destructiveHint: true },
  },
];

const INSTRUCTIONS = 'Calendario de contenido del cliente en el portal de Schwarck. Antes de cargar, mira ver_portal y ver_calendario para no repetir fechas ni ideas. crear_publicaciones carga de una vez todo lo planificado (una pieza puede ir a varias redes). Lo creado entra como Idea y el cliente no se entera hasta que el estudio lo manda a revisar. Fechas en AAAA-MM-DD, hora de Venezuela.';

// ── De lo que manda Claude a una fila ──

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const list = (v: unknown, max: number, each: number) => (Array.isArray(v) ? v.map((x) => text(x, each)).filter(Boolean).slice(0, max) : []);
const validDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

/** Valida y traduce; `prev` es la fila de antes cuando se edita (solo cambia lo que viene). */
function toRow(p: Row, prev?: Row): Row {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
  const row: Row = {};
  if (!prev || has('titulo')) {
    const t = text(p.titulo, 200);
    if (!t) throw new Fail('Falta el título.');
    row.title = t;
  }
  if (!prev || has('fecha')) {
    if (typeof p.fecha !== 'string' || !validDate(p.fecha)) throw new Fail(p.fecha ? `«${p.fecha}» no es una fecha AAAA-MM-DD.` : 'Le falta la fecha (AAAA-MM-DD).');
    row.date = p.fecha;
  }
  if (has('hora')) {
    if (p.hora && !TIME.test(String(p.hora))) throw new Fail(`«${p.hora}» no es una hora HH:MM.`);
    row.time = p.hora ? String(p.hora).padStart(5, '0') : null;
  }
  if (!prev || has('redes')) {
    const redes = [...new Set((Array.isArray(p.redes) ? p.redes : [p.redes]).map((x: unknown) => String(x ?? '').toLowerCase()).filter((x: string) => CHANNELS.includes(x)))];
    if (!redes.length) throw new Fail(`Elige al menos una red: ${CHANNELS.join(', ')}.`);
    row.channels = redes;
  }
  if (!prev || has('formato')) {
    if (!FORMATS.includes(p.formato)) throw new Fail(`El formato tiene que ser uno de: ${FORMATS.join(', ')}.`);
    row.format = p.formato;
  }
  if (!prev || has('estado')) row.status = p.estado === 'production' ? 'production' : 'idea';
  if (has('embudo')) row.funnel = FUNNELS.includes(p.embudo) ? p.embudo : null;
  const fields: [string, string, number][] = [
    ['pilar', 'pillar', 80], ['objetivo', 'objective', 500], ['cta', 'cta', 200], ['campana', 'campaign', 120], ['copy', 'caption', 5000],
    ['hashtags', 'hashtags', 1000], ['guion', 'script', 8000], ['duracion', 'duration', 40], ['notas', 'notes', 5000],
  ];
  for (const [from, to, max] of fields) if (has(from)) row[to] = text(p[from], max);
  if (has('referencias')) row.refs = list(p.referencias, 10, 500).filter((u) => /^https?:\/\//.test(u!)).map((u) => ({ url: u, label: host(u!) }));
  const prod: Row = { ...(prev?.production ?? {}) };
  let touched = false;
  const setProd = (k: string, v: unknown) => {
    touched = true;
    if (v == null || (Array.isArray(v) && !v.length)) delete prod[k];
    else prod[k] = v;
  };
  if (has('texto_en_pieza')) setProd('headline', text(p.texto_en_pieza, 500));
  if (has('indicaciones_diseno')) setProd('design_notes', text(p.indicaciones_diseno, 3000));
  if (has('diapositivas')) setProd('slides', list(p.diapositivas, 20, 1000));
  if (has('historias')) setProd('frames', list(p.historias, 20, 500));
  if (has('esquema')) setProd('outline', text(p.esquema, 5000));
  if (has('palabra_clave')) setProd('keyword', text(p.palabra_clave, 100));
  if (touched || !prev) row.production = prod;
  return row;
}

function summary(c: Row) {
  const when = `${c.date}${c.time ? ` ${String(c.time).slice(0, 5)}` : ''}`;
  const verdict = c.client_verdict ? ` · ${VERDICT[c.client_verdict]}` : '';
  return `${when} · ${c.title} · ${(c.channels?.length ? c.channels : [c.channel]).join('+')} · ${c.format} · ${STATUS[c.status] ?? c.status}${verdict} · id ${c.id}`;
}

function detail(c: Row) {
  const p = c.production ?? {};
  return {
    id: c.id, titulo: c.title, fecha: c.date, hora: c.time ? String(c.time).slice(0, 5) : null, redes: c.channels?.length ? c.channels : [c.channel],
    formato: c.format, estado: STATUS[c.status] ?? c.status, embudo: c.funnel, pilar: c.pillar, objetivo: c.objective, cta: c.cta, campana: c.campaign,
    copy: c.caption, hashtags: c.hashtags, texto_en_pieza: p.headline ?? null, indicaciones_diseno: p.design_notes ?? null, diapositivas: p.slides ?? [],
    historias: p.frames ?? [], guion: c.script, duracion: c.duration, notas: c.notes, esquema: p.outline ?? null, palabra_clave: p.keyword ?? null,
    referencias: (c.refs ?? []).map((r: Row) => r.url), respuesta_cliente: c.client_verdict ? { veredicto: VERDICT[c.client_verdict], nota: c.client_note, quien: c.client_verdict_name } : null,
    origen: c.origin,
  };
}

// ── Las herramientas ──

const LIST_FIELDS = 'id,title,date,time,channel,channels,format,status,funnel,pillar,campaign,client_verdict,origin';
const EMPTY: Row = { refs: [], production: {} };

async function callTool(cid: string, name: string, args: Row): Promise<Row> {
  const reply = (body: string) => ({ content: [{ type: 'text', text: body }] });
  switch (name) {
    case 'ver_portal': {
      const from = today();
      const [[portal], all, next] = await Promise.all([
        rest('portal_clients', `?id=eq.${cid}&select=name,industry,description,instagram,tiktok,website`),
        rest('portal_content', `?client_id=eq.${cid}&select=status,pillar,campaign,date`),
        rest('portal_content', `?client_id=eq.${cid}&date=gte.${from}&order=date.asc,time.asc&limit=15&select=${LIST_FIELDS}`),
      ]);
      const count: Row = {};
      for (const c of all) count[STATUS[c.status]] = (count[STATUS[c.status]] ?? 0) + 1;
      const uniq = (k: string) => [...new Set(all.map((c: Row) => c[k]).filter(Boolean))];
      return reply(JSON.stringify({
        cliente: portal?.name, sector: portal?.industry, descripcion: portal?.description, redes_del_negocio: { instagram: portal?.instagram, tiktok: portal?.tiktok, web: portal?.website },
        hoy: from, publicaciones_por_estado: count, pilares_usados: uniq('pillar'), campanas_usadas: uniq('campaign'),
        proximas: next.map(summary), redes_posibles: CHANNELS, formatos_posibles: FORMATS, embudo: FUNNELS,
      }, null, 2));
    }
    case 'ver_calendario': {
      const from = args.desde && validDate(args.desde) ? args.desde : today();
      const to = args.hasta && validDate(args.hasta) ? args.hasta : new Date(Date.parse(`${from}T12:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10);
      const status = args.estado && STATUS[args.estado] ? `&status=eq.${args.estado}` : '';
      const rows = await rest('portal_content', `?client_id=eq.${cid}&date=gte.${from}&date=lte.${to}${status}&order=date.asc,time.asc&limit=300&select=${LIST_FIELDS}`);
      return reply(rows.length ? `${rows.length} publicaciones del ${from} al ${to}:\n${rows.map(summary).join('\n')}` : `No hay publicaciones del ${from} al ${to}.`);
    }
    case 'ver_publicacion': {
      if (!UUID.test(String(args.id))) throw new Fail('Ese id no es válido.');
      const [c] = await rest('portal_content', `?id=eq.${args.id}&client_id=eq.${cid}&select=*`);
      if (!c) throw new Fail('No hay ninguna publicación con ese id en este portal.');
      return reply(JSON.stringify(detail(c), null, 2));
    }
    case 'crear_publicaciones': {
      const items = Array.isArray(args.publicaciones) ? args.publicaciones : [];
      if (!items.length) throw new Fail('Manda al menos una publicación.');
      if (items.length > 60) throw new Fail('Como mucho 60 por vez: divide la carga.');
      const rows: Row[] = [];
      const errors: string[] = [];
      items.forEach((p: Row, i: number) => {
        try {
          rows.push({ ...toRow(p), client_id: cid, origin: 'claude', notify: false });
        } catch (err) {
          errors.push(`#${i + 1} «${String(p?.titulo ?? '').slice(0, 60)}»: ${(err as Error).message}`);
        }
      });
      if (errors.length) throw new Fail(`No se cargó nada. Corrige esto y vuelve a intentarlo:\n${errors.join('\n')}`);
      // Para cargar varias de una vez, todas tienen que traer los mismos campos.
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const uniform = rows.map((r) => Object.fromEntries(keys.map((k) => [k, k in r ? r[k] : (EMPTY[k] ?? null)])));
      const saved = await rest('portal_content', '', { method: 'POST', body: uniform, headers: { prefer: 'return=representation' } });
      return reply(`Cargadas ${saved.length} publicaciones (como ${saved.every((c: Row) => c.status === 'idea') ? 'Idea' : 'Idea / En producción'}, sin avisar al cliente):\n${saved.map(summary).join('\n')}`);
    }
    case 'editar_publicacion': {
      if (!UUID.test(String(args.id))) throw new Fail('Ese id no es válido.');
      const [prev] = await rest('portal_content', `?id=eq.${args.id}&client_id=eq.${cid}&select=*`);
      if (!prev) throw new Fail('No hay ninguna publicación con ese id en este portal.');
      if (!EDITABLE.includes(prev.status)) throw new Fail(`Está en «${STATUS[prev.status]}»: cámbiala desde la app del portal.`);
      const patch = toRow(args.cambios ?? {}, prev);
      if (!Object.keys(patch).length) throw new Fail('No mandaste ningún cambio.');
      const [saved] = await rest('portal_content', `?id=eq.${args.id}&client_id=eq.${cid}`, { method: 'PATCH', body: patch, headers: { prefer: 'return=representation' } });
      return reply(`Actualizada: ${summary(saved)}`);
    }
    case 'borrar_publicacion': {
      if (!UUID.test(String(args.id))) throw new Fail('Ese id no es válido.');
      const [prev] = await rest('portal_content', `?id=eq.${args.id}&client_id=eq.${cid}&select=id,title,origin,status`);
      if (!prev) throw new Fail('No hay ninguna publicación con ese id en este portal.');
      if (prev.origin !== 'claude' || prev.status !== 'idea') throw new Fail('Solo se quitan las ideas que cargó este conector y siguen sin tocar.');
      await rest('portal_content', `?id=eq.${args.id}&client_id=eq.${cid}`, { method: 'DELETE' });
      return reply(`Quitada «${prev.title}».`);
    }
  }
  throw new Fail(`No existe la herramienta «${name}».`);
}

// ── MCP (JSON-RPC por HTTP) ──

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const ok = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg: Row, cid: string) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id ?? null, -32600, 'Invalid Request');
  const notification = msg.id === undefined;
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return ok(msg.id, {
        protocolVersion: VERSIONS.includes(asked) || /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'schwarck-portal', title: 'Portal de Schwarck', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      try {
        return ok(msg.id, await callTool(cid, String(msg.params?.name ?? ''), msg.params?.arguments ?? {}));
      } catch (e) {
        if (!(e instanceof Fail)) console.error(e);
        return ok(msg.id, { content: [{ type: 'text', text: e instanceof Fail ? e.message : 'Algo falló en el servidor; vuelve a intentarlo.' }], isError: true });
      }
    }
  }
  return notification ? null : err(msg.id, -32601, `Method not found: ${msg.method}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const send = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json' } });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { ...CORS, allow: 'POST, OPTIONS' } });

  // La llave va al final de la dirección (lo que admiten los conectores de Claude) o, si el
  // cliente MCP deja poner cabeceras, como «Authorization: Bearer …».
  const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  const token = bearer ?? new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return send(err(null, -32001, 'Falta la dirección secreta del portal.'), 404);
  let cid: string | null = null;
  try {
    cid = await rpc('portal_mcp_client', { token });
  } catch (e) {
    console.error(e);
    return send(err(null, -32603, 'No se pudo comprobar la dirección.'), 500);
  }
  if (!cid) return send(err(null, -32001, 'Esta dirección no vale o se revocó: crea otra en Negocio.'), 404);

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return send(err(null, -32700, 'Parse error'), 400);
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map((m: Row) => handle(m, cid!)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return send(batch ? replies : replies[0]);
});
