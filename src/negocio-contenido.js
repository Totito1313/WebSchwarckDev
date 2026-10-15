// Negocio · Marketing: marcas, publicaciones y plantillas de copy.
//
// Cada publicación pertenece a una marca y tiene fecha, formato, categoría, su
// papel en el embudo (atracción, autoridad, conversión, comunidad) y un estado
// editorial. Las marcas guardan su identidad (colores, tono, público, pilares)
// y sus recursos: capturas e imágenes por URL y logos en SVG.

import {
  state, find, put, remove, uid, el, icon, field, input, select, dialog, confirmBox, toast, autosize,
  addIcons, dateText, todayISO, menu,
} from './negocio-core.js';
import { uploadFile, fileUrl } from './negocio-gastos.js';

addIcons({
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  reel: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 8h18M8 3l3 5M14 3l3 5"/><path d="m10 12 5 3-5 3z"/>',
  carousel: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M3 7v10M21 7v10"/>',
  story: '<circle cx="12" cy="12" r="9" stroke-dasharray="3.5 2.5"/><circle cx="12" cy="12" r="5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.9"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  palette2: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="12" cy="15.5" r="3"/>',
});

const list = (col) => state[col] || [];

// ── Catálogos ──

export const POST_STATUS = {
  idea: ['Idea', 'var(--body)'],
  guion: ['Guion', 'var(--violet)'],
  diseno: ['Diseño', 'var(--blue)'],
  aprobado: ['Aprobado', 'var(--cyan)'],
  programado: ['Programado', 'var(--usdt)'],
  publicado: ['Publicado', 'var(--income)'],
};
export const STATUS_ORDER = Object.keys(POST_STATUS);

export const ROLES = {
  tof: ['Atracción', 'TOF', 'var(--cyan)', 'Llega a gente nueva: problemas comunes, tendencias, curiosidades.'],
  mof: ['Autoridad', 'MOF', 'var(--violet)', 'Enseña y genera confianza: tutoriales, comparativas, procesos.'],
  bof: ['Conversión', 'BOF', 'var(--income)', 'Lleva a la acción: lanzamientos, ofertas, testimonios, llamadas a descargar.'],
  com: ['Comunidad', 'COM', 'var(--bs)', 'Cuida a quien ya te sigue: preguntas, respuestas, detrás de cámaras.'],
};

export const FORMATS = {
  reel: ['Reel', 'reel'],
  carrusel: ['Carrusel', 'carousel'],
  imagen: ['Imagen', 'image'],
  historia: ['Historia', 'story'],
  video: ['Video largo', 'video'],
};

export const POST_CATEGORIES = ['Lanzamiento', 'Producto', 'Educativo', 'Testimonio', 'Detrás de cámaras', 'Promoción', 'Comunidad', 'Tendencia'];
export const COVER_COLORS = ['#1d2126', '#00b8d4', '#0071bc', '#1f9d46', '#8e5bd6', '#f97316', '#d9a406', '#e0352b'];

export const roleTag = (role) => {
  const r = ROLES[role];
  return r ? el('span', { class: 'ng-tag', style: { '--c': r[2] }, text: `${r[0]} · ${r[1]}` }) : null;
};
export const statusTag = (status) => {
  const [label, c] = POST_STATUS[status] || POST_STATUS.idea;
  return el('span', { class: 'ng-tag', style: { '--c': c }, text: label });
};

// ── Marcas ──

const CF = (name) => ({ id: uid(), title: name[1], url: `/img/cerofiao/${name[0]}-540.webp`, darkUrl: `/img/cerofiao/${name[0]}-dark-540.webp`, note: 'Captura real de la app' });

const DEFAULT_BRANDS = () => [
  {
    name: 'CeroFiao',
    handle: '@cerofiao',
    industry: 'App de finanzas personales para Venezuela',
    tone: 'Claro, práctico y cercano. Habla de tú y sin tecnicismos. Cuenta en bolívares, dólares, euros y USDT con la tasa del día.',
    fonts: 'Inter (titulares 600, texto 400) · Anton para las cifras',
    colors: { primary: '#1d2126', secondary: '#00b8d4', accent: '#1f9d46' },
    guidelines: 'Capturas reales de la app, en claro y en oscuro. Fondo de cielo (celeste a crema) y tarjetas azul nube. Cifras grandes y pocas palabras. Nada de fotos de banco ni promesas de dinero fácil.',
    audience: 'Venezolanos de 22 a 45 años que cobran o gastan en varias monedas y quieren saber cuánto tienen de verdad. Usan Android, viven pendientes de la tasa y desconfían de las apps que piden sus datos.',
    pillars: 'Tasas del día y conversión\nCuentas y presupuestos en varias monedas\nDeudas y metas de ahorro\nPrivacidad: tus datos se quedan en tu teléfono',
    hashtags: '#CeroFiao #FinanzasPersonales #Venezuela #DólarBCV #USDT',
    cta: 'Descárgala gratis desde el enlace del perfil',
    link: 'https://schwarckdev.com/cerofiao/',
    logo: '/img/cerofiao/icon.webp',
    assets: [['home', 'Inicio'], ['conversor', 'Conversor'], ['cuentas', 'Cuentas'], ['deudas', 'Deudas'], ['escaner', 'Escáner de precios'], ['ahorros', 'Ahorros'], ['analiticas', 'Analíticas'], ['historial', 'Historial']].map(CF),
    svgs: [],
  },
  {
    name: 'Schwarck Developer',
    handle: '@schwarckdev',
    industry: 'Estudio de apps nativas para Android',
    tone: 'Directo y artesanal: cuenta cómo se hacen las cosas, sin humo ni jerga.',
    fonts: 'DM Sans (texto) · Inter',
    colors: { primary: '#09090b', secondary: '#0284c7', accent: '#5eead4' },
    guidelines: 'Negro obsidiana y blanco, con el degradado cian del logo como único color. Mucho aire, capturas reales y el proceso de desarrollo.',
    audience: 'Personas y negocios que quieren una app propia bien hecha, y desarrolladores que siguen el proceso de un estudio pequeño.',
    pillars: 'Detrás de cámaras del desarrollo\nLas apps del estudio: CeroFiao y Lion Fitness\nDiseño y privacidad\nConsejos para quien quiere su app',
    hashtags: '#SchwarckDev #Android #DesarrolloDeApps #Kotlin #IndieDev',
    cta: 'Conoce el estudio en schwarckdev.com',
    link: 'https://schwarckdev.com/',
    logo: '/favicon.svg',
    assets: [
      { id: uid(), title: 'Isotipo S', url: '/favicon.svg', darkUrl: '', note: 'SVG del logo' },
      { id: uid(), title: 'Logotipo SD', url: '/img/schwarck-sd.svg', darkUrl: '', note: 'SVG del logo' },
      { id: uid(), title: 'Imagen para compartir', url: '/img/og-schwarck.jpg', darkUrl: '', note: '1200 × 630' },
    ],
    svgs: [],
  },
  {
    name: 'Lion Fitness',
    handle: '@lionfitness',
    industry: 'App de entrenamiento (en desarrollo)',
    tone: 'Enérgico y motivador, sin exagerar: progreso real, semana a semana.',
    fonts: 'Inter',
    colors: { primary: '#111111', secondary: '#f59e0b', accent: '#ef4444' },
    guidelines: 'Todavía en desarrollo: enseña los avances de la app y suma gente a la lista de espera. Ajusta los colores cuando la marca esté cerrada.',
    audience: 'Gente que entrena en casa o en el gimnasio y quiere registrar su progreso sin complicarse.',
    pillars: 'Avances de la app\nRutinas y consejos\nConstancia y progreso\nComunidad',
    hashtags: '#LionFitness #Entrenamiento #Gym #Fitness',
    cta: 'Apúntate para probarla antes que nadie',
    link: 'https://schwarckdev.com/lionfitness/',
    logo: '/img/lionfitness/logo.webp',
    assets: [{ id: uid(), title: 'Logo', url: '/img/lionfitness/logo.webp', darkUrl: '', note: '' }],
    svgs: [],
  },
];

/** La primera vez se crean las tres marcas del estudio, con sus capturas reales. */
export function ensureBrands() {
  if (list('brands').length) return;
  DEFAULT_BRANDS().forEach((b, order) => put('brands', { id: uid(), order, ...b }));
}

export const brands = () => [...list('brands')].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
export const brandOf = (post) => (post?.brandId ? find('brands', post.brandId) : null);
export const brandColor = (b) => b?.colors?.secondary || '#8a9096';

/** Logo de la marca o sus iniciales. */
export function brandMark(b, size = '') {
  const initials = (b?.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const box = el('span', { class: `ng-bmark ${size}`.trim(), style: { '--c': brandColor(b) }, 'aria-hidden': 'true' });
  if (b?.logo) {
    const img = el('img', { src: b.logo, alt: '' });
    img.addEventListener('error', () => img.replaceWith(initials));
    box.append(img);
  } else box.append(initials);
  return box;
}

// ── Publicaciones ──

export function newPost(over = {}) {
  const b = over.brandId ? find('brands', over.brandId) : brands()[0];
  return {
    id: uid(),
    brandId: b?.id || '',
    title: '',
    date: todayISO(),
    time: '12:00',
    format: 'reel',
    category: 'Producto',
    role: 'tof',
    status: 'idea',
    assignee: '',
    color: COVER_COLORS[1],
    assetUrl: '',
    visualScript: '',
    copyIg: '',
    copyFb: '',
    hashtags: b?.hashtags || '',
    notes: '',
    ...over,
  };
}

export const postsOf = (filter = {}) => list('posts').filter((p) => (!filter.brand || filter.brand === 'all' || p.brandId === filter.brand)
  && (!filter.role || filter.role === 'all' || p.role === filter.role)
  && (!filter.status || filter.status === 'all' || p.status === filter.status));

export const byDate = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

/** Texto completo para Instagram: el copy y, si no los lleva ya, los hashtags. */
export function igText(p) {
  const copy = (p.copyIg || '').trim();
  const tags = (p.hashtags || '').trim();
  return tags && !copy.includes(tags) ? `${copy}\n\n${tags}`.trim() : copy;
}

export async function copyText(text, what) {
  if (!text.trim()) {
    toast(`No hay ${what.toLowerCase()} que copiar.`, 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copiado.`);
  } catch {
    toast('No se pudo copiar. Selecciona el texto a mano.', 'error');
  }
}

// ── Plantillas de copy ──

export const TEMPLATES = {
  aida: ['AIDA', 'Atención, interés, deseo y acción'],
  pas: ['PAS', 'Problema, agitación y solución'],
  launch: ['Lanzamiento', 'Para anunciar algo nuevo'],
};

/** Esqueleto de copy: lo que va entre corchetes es para reescribir. */
export function template(kind, post, brand) {
  const title = post.title || '[tema]';
  const name = brand?.name || 'la marca';
  const cta = brand?.cta || '[llamada a la acción]';
  if (kind === 'pas') {
    return [
      `${title}`,
      '',
      '[El problema, dicho como lo diría tu cliente.]',
      '',
      '[Lo que cuesta no resolverlo: tiempo, dinero, tranquilidad.]',
      '',
      `La solución: ${name}. [Cómo lo resuelve, en una o dos frases.]`,
      '',
      `👉 ${cta}`,
    ].join('\n');
  }
  if (kind === 'launch') {
    return [
      `Nuevo en ${name}: ${title}`,
      '',
      '✅ [Lo primero que puedes hacer]',
      '✅ [Lo segundo]',
      '✅ [Lo tercero]',
      '',
      `Desde el ${dateText(post.date) || '[fecha]'}.`,
      `👉 ${cta}`,
    ].join('\n');
  }
  return [
    `${title}`,
    '',
    '¿Te ha pasado que [el problema o la duda de tu público]?',
    '',
    `Con ${name} [cómo lo resuelves, en una frase].`,
    '',
    'Imagina [el resultado que quiere].',
    '',
    `👉 ${cta}`,
  ].join('\n');
}

/** Pasa un copy de Instagram a Facebook: sin bloque de hashtags, con el enlace en vez de "link en la bio". */
export function toFacebook(ig, brand) {
  const tagLine = (line) => /^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(line);
  let text = ig.split('\n').filter((line) => !tagLine(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const link = brand?.link || '';
  text = text.replace(/(?:el |en el )?(?:link|enlace) (?:en|de|del) (?:(?:la|mi|nuestra|el|nuestro) )?(?:bio|perfil)/gi, link || 'el enlace');
  if (link && !text.includes(link)) text += `\n\n${link}`;
  const tags = [...new Set(ig.match(/#[\p{L}\p{N}_]+/gu) || [])].slice(0, 3).join(' ');
  return tags ? `${text}\n\n${tags}` : text;
}

const countTags = (text) => (String(text).match(/#[\p{L}\p{N}_]+/gu) || []).length;

// ── Formulario de publicación ──

/** Vista previa al estilo de Instagram: cabecera de la marca, imagen o color, y el copy. */
export function postPreview(p) {
  const b = brandOf(p);
  const media = p.assetUrl
    ? el('img', { src: p.assetUrl, alt: '' })
    : el('span', { class: 'ng-ig-cover', style: { '--c': p.color || COVER_COLORS[1] } }, el('b', { text: p.title || 'Sin título' }));
  return el('article', { class: 'ng-ig' },
    el('header', {}, brandMark(b, 'is-sm'), el('b', { text: (b?.handle || b?.name || 'marca').replace(/^@/, '') }), el('span', { class: 'ng-ig-format' }, icon(FORMATS[p.format]?.[1] || 'image'))),
    el('div', { class: `ng-ig-media${p.format === 'historia' || p.format === 'reel' ? ' is-tall' : ''}` }, media),
    el('p', {}, el('b', { text: `${(b?.handle || '').replace(/^@/, '')} ` }), igText(p) || 'El copy aparecerá aquí.'),
  );
}

export function postForm(post, onSaved) {
  ensureBrands();
  const isNew = !post || !find('posts', post.id);
  const p = structuredClone(post || newPost());
  const preview = el('div', { class: 'ng-postform-side' });
  const drawPreview = () => preview.replaceChildren(el('small', { class: 'ng-postform-label', text: 'Vista previa' }), postPreview(p));

  const bind = (node, key, read = (v) => v) => {
    const update = () => {
      p[key] = read(node.value);
      drawPreview();
    };
    node.addEventListener('input', update);
    if (node.tagName === 'SELECT') node.addEventListener('change', update);
    return node;
  };
  const title = bind(input({ value: p.title, required: true, maxLength: 160, placeholder: 'Usa el escáner en el supermercado' }), 'title');
  const brand = bind(select(brands().map((b) => [b.id, b.name]), p.brandId, { 'aria-label': 'Marca' }), 'brandId');
  brand.addEventListener('change', () => {
    const b = find('brands', brand.value);
    if (b && !hashtags.value.trim()) {
      hashtags.value = b.hashtags || '';
      p.hashtags = hashtags.value;
    }
    drawAssets();
    drawPreview();
  });
  const date = bind(input({ type: 'date', value: p.date, required: true }), 'date');
  const time = bind(input({ type: 'time', value: p.time }), 'time');
  const format = bind(select(Object.entries(FORMATS).map(([k, [label]]) => [k, label]), p.format, { 'aria-label': 'Formato' }), 'format');
  const category = bind(select(POST_CATEGORIES.map((c) => [c, c]), p.category, { 'aria-label': 'Categoría' }), 'category');
  const role = bind(select(Object.entries(ROLES).map(([k, [label, code]]) => [k, `${label} (${code})`]), p.role, { 'aria-label': 'Rol en el embudo' }), 'role');
  const roleHint = el('small', { text: ROLES[p.role]?.[3] || '' });
  role.addEventListener('change', () => { roleHint.textContent = ROLES[role.value]?.[3] || ''; });
  const status = bind(select(STATUS_ORDER.map((k) => [k, POST_STATUS[k][0]]), p.status, { 'aria-label': 'Estado' }), 'status');
  const assignee = bind(input({ value: p.assignee, maxLength: 60, placeholder: 'Quién lo prepara' }), 'assignee');
  const script = bind(autosize(el('textarea', { value: p.visualScript, rows: 3, maxLength: 6000, placeholder: 'Plano 1: … · Plano 2: … · Texto en pantalla: …' })), 'visualScript');
  const copyIg = bind(autosize(el('textarea', { value: p.copyIg, rows: 5, maxLength: 2200 })), 'copyIg');
  const copyFb = bind(autosize(el('textarea', { value: p.copyFb, rows: 4, maxLength: 6000 })), 'copyFb');
  const hashtags = bind(autosize(el('textarea', { value: p.hashtags, rows: 1, maxLength: 1500 })), 'hashtags');
  const notes = bind(autosize(el('textarea', { value: p.notes, rows: 2, maxLength: 4000 })), 'notes');

  const igCount = el('small');
  const tagCount = el('small');
  const counts = () => {
    igCount.textContent = `${copyIg.value.length} / 2200`;
    const n = countTags(hashtags.value);
    tagCount.textContent = `${n} ${n === 1 ? 'hashtag' : 'hashtags'}${n > 30 ? ' · Instagram admite 30' : ''}`;
    tagCount.classList.toggle('is-bad', n > 30);
  };
  copyIg.addEventListener('input', counts);
  hashtags.addEventListener('input', counts);
  counts();

  const setIg = (text) => {
    copyIg.value = text;
    p.copyIg = text;
    copyIg.dispatchEvent(new Event('input'));
  };
  const templatesBtn = el('button', { type: 'button', class: 'pill ghost sm' }, icon('edit'), 'Plantilla', icon('down'));
  templatesBtn.addEventListener('click', () => menu(templatesBtn, Object.entries(TEMPLATES).map(([k, [label, note]]) => ({
    label,
    note,
    run: async () => {
      if (copyIg.value.trim() && !(await confirmBox('¿Cambiar el copy de Instagram por la plantilla?', 'Cambiar'))) return;
      setIg(template(k, p, find('brands', p.brandId)));
    },
  }))));
  const adapt = el('button', {
    type: 'button',
    class: 'pill ghost sm',
    onclick: async () => {
      if (!copyIg.value.trim()) {
        toast('Escribe primero el copy de Instagram.', 'error');
        return;
      }
      if (copyFb.value.trim() && !(await confirmBox('¿Cambiar el copy de Facebook por la versión adaptada?', 'Cambiar'))) return;
      copyFb.value = toFacebook(igText(p), find('brands', p.brandId));
      p.copyFb = copyFb.value;
      copyFb.dispatchEvent(new Event('input'));
    },
  }, icon('facebook'), 'Adaptar desde Instagram');

  // Imagen: un recurso de la marca, una subida o solo un color de portada.
  const assetsBox = el('div', { class: 'ng-asset-pick' });
  const fileIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    toast('Subiendo imagen…');
    try {
      const meta = await uploadFile(f);
      p.assetUrl = fileUrl(meta.id);
      drawAssets();
      drawPreview();
      toast('Imagen lista.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  function drawAssets() {
    const b = find('brands', p.brandId);
    const options = (b?.assets || []).map((a) => el('button', {
      type: 'button',
      class: `ng-asset-thumb${p.assetUrl === a.url ? ' is-on' : ''}`,
      title: a.title,
      'aria-label': a.title,
      'aria-pressed': String(p.assetUrl === a.url),
      onclick: () => { p.assetUrl = p.assetUrl === a.url ? '' : a.url; drawAssets(); drawPreview(); },
    }, el('img', { src: a.url, alt: '', loading: 'lazy' })));
    const custom = p.assetUrl && !(b?.assets || []).some((a) => a.url === p.assetUrl);
    assetsBox.replaceChildren(...[
      ...options,
      custom && el('button', { type: 'button', class: 'ng-asset-thumb is-on', title: 'Imagen subida', onclick: () => { p.assetUrl = ''; drawAssets(); drawPreview(); } }, el('img', { src: p.assetUrl, alt: '' })),
      el('button', { type: 'button', class: 'ng-asset-thumb is-add', 'aria-label': 'Subir imagen', title: 'Subir imagen', onclick: () => fileIn.click() }, icon('upload')),
      fileIn,
    ].filter(Boolean));
  }
  drawAssets();
  const colors = el('div', { class: 'ng-swatches', role: 'group', 'aria-label': 'Color de portada' });
  const drawColors = () => colors.replaceChildren(...COVER_COLORS.map((c) => el('button', {
    type: 'button',
    class: 'ng-swatch',
    style: { '--c': c },
    'aria-label': `Color ${c}`,
    'aria-pressed': String(p.color === c),
    onclick: () => { p.color = c; drawColors(); drawPreview(); },
  })));
  drawColors();

  const copyRow = (label, extra, area, counter, copy) => el('div', { class: 'ng-field' },
    el('div', { class: 'ng-field-head' }, el('span', { text: label }), el('div', { class: 'ng-field-tools' }, extra, el('button', { type: 'button', class: 'pill ghost sm', onclick: copy }, icon('copy'), 'Copiar'))),
    area,
    counter,
  );

  drawPreview();
  const dlg = dialog({
    title: isNew ? 'Nueva publicación' : 'Editar publicación',
    wide: true,
    submit: isNew ? 'Crear publicación' : 'Guardar',
    body: el('div', { class: 'ng-postform' },
      el('div', { class: 'ng-form' },
        field('Título', title),
        el('div', { class: 'ng-grid3' }, field('Marca', brand), field('Fecha', date), field('Hora', time)),
        el('div', { class: 'ng-grid3' }, field('Formato', format), field('Categoría', category), field('Estado', status)),
        el('div', { class: 'ng-grid2' }, el('label', { class: 'ng-field' }, el('span', { text: 'Rol en el embudo' }), role, roleHint), field('Responsable', assignee)),
        el('div', { class: 'ng-field' }, el('span', { text: 'Imagen' }), assetsBox, el('small', { text: 'Elige una captura de la marca o sube una. Sin imagen, la portada es este color:' }), colors),
        field('Guion visual', script),
        copyRow('Copy para Instagram', templatesBtn, copyIg, igCount, () => copyText(igText(p), 'Copy de Instagram')),
        copyRow('Hashtags', null, hashtags, tagCount, () => copyText(p.hashtags || '', 'Hashtags')),
        copyRow('Copy para Facebook', adapt, copyFb, null, () => copyText(p.copyFb || '', 'Copy de Facebook')),
        field('Notas', notes),
      ),
      preview,
    ),
    danger: !isNew && {
      label: 'Eliminar',
      run: () => {
        confirmBox(`¿Eliminar «${p.title || 'esta publicación'}»?`).then((yes) => {
          if (!yes) return;
          remove('posts', p.id);
          toast('Publicación eliminada.');
          onSaved?.();
        });
      },
    },
    onSubmit: () => {
      p.title = title.value.trim();
      if (!p.title) return false;
      put('posts', p);
      toast(isNew ? 'Publicación creada.' : 'Publicación guardada.');
      onSaved?.(p);
      return true;
    },
  });
  dlg.classList.add('is-xwide');
  return dlg;
}

// ── Formularios de recursos de marca ──

export function assetForm(brand, onDone) {
  const title = input({ required: true, maxLength: 80, placeholder: 'Pantalla de inicio' });
  const url = input({ required: true, maxLength: 500, placeholder: '/img/… o https://…' });
  const darkUrl = input({ maxLength: 500, placeholder: 'Opcional' });
  dialog({
    title: 'Añadir imagen por dirección',
    body: el('div', { class: 'ng-form' },
      field('Nombre', title),
      field('Dirección de la imagen', url, 'Una ruta del sitio (/img/…) o una dirección https.'),
      field('Versión oscura', darkUrl, 'Si la tiene, se usa al ver los recursos en oscuro.'),
    ),
    onSubmit: () => {
      const clean = (v) => {
        const s = v.trim();
        return /^\/[\w./-]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
      };
      const u = clean(url.value);
      if (!title.value.trim() || !u) {
        toast('Pon un nombre y una dirección que empiece por / o por https://', 'error');
        return false;
      }
      brand.assets = [...(brand.assets || []), { id: uid(), title: title.value.trim(), url: u, darkUrl: clean(darkUrl.value), note: '' }];
      put('brands', brand);
      onDone?.();
      return true;
    },
  });
}

export function svgForm(brand, onDone) {
  const title = input({ required: true, maxLength: 80, placeholder: 'Logo en blanco' });
  const code = el('textarea', { required: true, rows: 8, maxLength: 60000, placeholder: '<svg …>…</svg>', class: 'is-code' });
  dialog({
    title: 'Añadir SVG',
    wide: true,
    body: el('div', { class: 'ng-form' }, field('Nombre', title), field('Código', code, 'Pega el código completo, desde <svg hasta </svg>.')),
    onSubmit: () => {
      const svg = code.value.trim();
      if (!title.value.trim() || !/^<svg[\s>][\s\S]*<\/svg>$/i.test(svg)) {
        toast('El código tiene que empezar por <svg y terminar en </svg>.', 'error');
        return false;
      }
      brand.svgs = [...(brand.svgs || []), { id: uid(), title: title.value.trim(), code: svg }];
      put('brands', brand);
      onDone?.();
      return true;
    },
  });
}

/** Un SVG se enseña como imagen: así su código no se ejecuta nunca en la página. */
export const svgUrl = (code) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(code)}`;

export function downloadSvg(s) {
  const a = el('a', { href: URL.createObjectURL(new Blob([s.code], { type: 'image/svg+xml' })), download: `${s.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'logo'}.svg` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

