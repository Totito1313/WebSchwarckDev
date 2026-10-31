// Lo que se pega en la app desde fuera: el reporte diario de Nexus y el calendario que
// prepara Claude. Solo lee el texto y lo convierte en filas; quien las guarda es studio.js.

const clean = (s) => String(s ?? '').replace(/\r/g, '').replace(/[​️]/g, '');
// «Ninguna», «Ninguno», «N/A», «-»…: nada que guardar.
const NOTHING = /^(ning[uú]n[oa]?|nada|n\/?a|no|sin (novedad(es)?|pendientes?|bloqueos?)|-+|—)\.?$/i;
const bullet = (line) => line.replace(/^\s*(?:[-–—•*·▪●◦]|\d+[.)]|[✔✅☑️🔹🔸▫️]+)\s*/u, '').trim();
const isoDate = (text) => {
  const t = String(text || '').trim();
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(t);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${iso}T12:00:00`)) ? null : iso;
};
const isoTime = (text) => {
  const m = /(\d{1,2})[:.h](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i.exec(String(text || ''));
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] && /p/i.test(m[3]) && h < 12) h += 12;
  if (m[3] && /a/i.test(m[3]) && h === 12) h = 0;
  return h < 24 && Number(m[2]) < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null;
};

// ── El reporte diario de Nexus ──

const SECTIONS = [
  ['done', /tareas?\s+realizadas?|lo\s+que\s+hice|completad[ao]s/i],
  ['doing', /pendientes?|en\s+proceso|en\s+curso/i],
  ['blockers', /dificultades|bloqueos?|problemas/i],
  ['notes', /observaciones|sugerencias|comentarios|notas/i],
];

/** ¿Es el reporte diario que copia Nexus? */
export const isNexusReport = (text) => /reporte\s+diario/i.test(text || '') && /tareas?\s+realizadas?/i.test(text || '');

/**
 * Lee el reporte: { day, author, sentAt, done: [títulos], doing: [títulos], blockers, notes }.
 * Las listas aceptan guiones, viñetas o números; «Ninguna» deja la sección vacía.
 */
export function parseNexusReport(text) {
  const out = { day: null, author: null, sentAt: null, done: [], doing: [], blockers: null, notes: null };
  const free = { blockers: [], notes: [] };
  let section = null;
  for (const raw of clean(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Quita el emoji del principio para leer la etiqueta.
    const label = line.replace(/^[^\p{L}\p{N}]+/u, '');
    const [, key = '', value = ''] = /^([^:]{2,60}):\s*(.*)$/.exec(label) || [];
    if (/^fecha$/i.test(key.trim())) {
      out.day = isoDate(value) || out.day;
      section = null;
      continue;
    }
    if (/asistente|nombre|responsable|enviado por/i.test(key)) {
      out.author = value.trim().slice(0, 120) || out.author;
      section = null;
      continue;
    }
    if (/hora/i.test(key)) {
      out.sentAt = isoTime(value) || out.sentAt;
      section = null;
      continue;
    }
    const header = SECTIONS.find(([, re]) => re.test(key || label) && (key || /:\s*$/.test(label) || label.length < 60));
    if (header && (key || /:\s*$/.test(line))) {
      section = header[0];
      // «Pendientes: Ninguna» en la misma línea.
      const rest = value.trim();
      if (rest && !NOTHING.test(rest)) (section === 'done' || section === 'doing' ? out[section] : free[section]).push(bullet(rest));
      continue;
    }
    if (/reporte\s+diario/i.test(label)) continue;
    if (!section) continue;
    const item = bullet(line);
    if (!item || NOTHING.test(item)) continue;
    if (section === 'done' || section === 'doing') out[section].push(item.slice(0, 200));
    else free[section].push(item);
  }
  out.blockers = free.blockers.join('\n').slice(0, 4000) || null;
  out.notes = free.notes.join('\n').slice(0, 4000) || null;
  return out;
}

/** Una clave estable por tarea y día, para que pegar dos veces el mismo reporte no la repita. */
export const nexusSource = (day, title) => `nexus:${day}:${String(title).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}`;

// ── El calendario que prepara Claude ──

const CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'web', 'email', 'otro'];
const FORMATS = ['post', 'carrusel', 'reel', 'historia', 'video', 'articulo', 'otro'];
const FUNNELS = ['atraccion', 'autoridad', 'conversion', 'comunidad'];
const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const list = (v, max, each) => (Array.isArray(v) ? v.map((x) => text(x, each)).filter(Boolean).slice(0, max) : []);
const plain = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

/** Una publicación de Claude (las mismas claves que el conector) a una fila del calendario. */
export function pieceToRow(p) {
  const title = text(p?.titulo, 200);
  if (!title) throw new Error('falta el título');
  const date = isoDate(p.fecha);
  if (!date) throw new Error(p.fecha ? `«${p.fecha}» no es una fecha` : 'le falta la fecha');
  const redes = [...new Set((Array.isArray(p.redes) ? p.redes : [p.redes ?? p.red]).map(plain).filter((x) => CHANNELS.includes(x)))];
  if (!redes.length) throw new Error('falta la red (instagram, tiktok…)');
  const format = plain(p.formato);
  if (!FORMATS.includes(format)) throw new Error(`«${p.formato ?? ''}» no es un formato`);
  const production = {};
  const put = (k, v) => {
    if (v != null && !(Array.isArray(v) && !v.length)) production[k] = v;
  };
  put('headline', text(p.texto_en_pieza, 500));
  put('design_notes', text(p.indicaciones_diseno, 3000));
  put('slides', list(p.diapositivas, 20, 1000));
  put('frames', list(p.historias, 20, 500));
  put('outline', text(p.esquema, 5000));
  put('keyword', text(p.palabra_clave, 100));
  return {
    title, date, time: isoTime(p.hora), channels: redes, channel: redes[0], format,
    status: plain(p.estado) === 'production' || plain(p.estado) === 'produccion' ? 'production' : 'idea',
    funnel: FUNNELS.includes(plain(p.embudo)) ? plain(p.embudo) : null,
    pillar: text(p.pilar, 80), objective: text(p.objetivo, 500), cta: text(p.cta, 200), campaign: text(p.campana ?? p['campaña'], 120),
    caption: text(p.copy, 5000), hashtags: text(p.hashtags, 1000), script: text(p.guion, 8000), duration: text(p.duracion, 40), notes: text(p.notas, 5000),
    refs: list(p.referencias, 10, 500).filter((u) => /^https?:\/\//.test(u)).map((u) => ({ url: u, label: host(u) })),
    production, origin: 'claude', notify: false,
  };
}

/** Lee lo que se pegó (con o sin ```json, como lista o como { publicaciones: [...] }). */
export function parseCalendar(raw) {
  const body = clean(raw).replace(/^[\s\S]*?```(?:json)?\s*/i, (m) => (m.includes('```') ? '' : m)).replace(/```[\s\S]*$/, '').trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error('No encuentro el bloque: pega lo que te dio Claude, empezando por [ o {.');
  let data;
  try {
    data = JSON.parse(body.slice(start));
  } catch {
    throw new Error('El bloque está incompleto o mal copiado: vuelve a copiarlo entero.');
  }
  const items = Array.isArray(data) ? data : Array.isArray(data?.publicaciones) ? data.publicaciones : null;
  if (!items?.length) throw new Error('No hay publicaciones en el bloque.');
  const rows = [];
  const errors = [];
  items.slice(0, 120).forEach((p, i) => {
    try {
      rows.push(pieceToRow(p));
    } catch (err) {
      errors.push(`#${i + 1} ${p?.titulo ? `«${String(p.titulo).slice(0, 50)}»` : ''}: ${err.message}`);
    }
  });
  return { rows, errors, skipped: Math.max(0, items.length - 120) };
}

/** Lo que se le pega a Claude para que entregue el calendario en el formato de la app. */
export const claudeInstructions = (clientName) => `Cuando terminemos de idear el calendario de ${clientName}, entrégamelo como UN solo bloque JSON (una lista), sin texto antes ni después, para pegarlo en la app del portal. Cada publicación:

{
  "titulo": "Reel: …",              // obligatorio, máx. 200
  "fecha": "AAAA-MM-DD",            // obligatorio
  "hora": "HH:MM",
  "redes": ["instagram", "tiktok"], // obligatorio: instagram, facebook, tiktok, youtube, linkedin, web, email, otro
  "formato": "reel",                // obligatorio: post (estático), carrusel, reel, historia, video, articulo, otro
  "estado": "idea",                 // idea o production
  "embudo": "atraccion",            // atraccion, autoridad, conversion, comunidad
  "pilar": "", "objetivo": "", "cta": "", "campana": "",
  "copy": "", "hashtags": "",
  "texto_en_pieza": "", "indicaciones_diseno": "",   // post, carrusel, historia
  "diapositivas": ["…", "…"],                        // carrusel
  "historias": ["…", "…"],                           // historia
  "guion": "0–3 s: …", "duracion": "30 s", "notas": "", // reel, video
  "esquema": "", "palabra_clave": "",                // articulo
  "referencias": ["https://…"]
}

Usa solo los campos que apliquen a cada formato.`;
