// Estudio de gráficos para Google Play: los controles, la vista previa y las descargas.
// El dibujo está en store-render.js y los formatos de archivo en store-export.js.

import { initTheme } from './theme.js';
import { KINDS, TEMPLATES, BACKGROUNDS, DECOS, FONT_NAMES, defaults, render, templateOf, shotsOf } from './store-render.js';
import { encode, zip, saveBlob } from './store-export.js';

initTheme();

// ── Capturas disponibles ──
const LIBRARY = [
  { id: 'home', name: 'Inicio', dark: true },
  { id: 'cuentas', name: 'Cuentas', dark: true },
  { id: 'historial', name: 'Historial', dark: true },
  { id: 'tasas', name: 'Tasas', dark: true },
  { id: 'conversor', name: 'Conversor', dark: true },
  { id: 'deudas', name: 'Deudas', dark: true },
  { id: 'analiticas', name: 'Analíticas', dark: true },
  { id: 'ahorros', name: 'Ahorros', dark: true },
  { id: 'carrito', name: 'Carrito', dark: true },
  { id: 'escaner', name: 'Escáner', dark: true },
  { id: 'escaner-lista', name: 'Escáner: productos', dark: false },
  { id: 'datos', name: 'Respaldo', dark: true },
];
const SUGGESTED = [
  { shot: 'home', title: 'Tus cuentas, en la moneda que sea', subtitle: 'Bolívares, dólares, euros y USDT' },
  { shot: 'conversor', title: 'La tasa del día, sin buscarla', subtitle: 'Dólar y euro BCV, USDT y EURI' },
  { shot: 'deudas', title: 'Quién te debe y a quién le debes', subtitle: 'Con cuotas, vencimientos y mora' },
  { shot: 'escaner', title: 'Escanea la factura', subtitle: 'Se lee en tu teléfono, sin Internet' },
  { shot: 'carrito', title: 'Suma la compra antes de pagar', subtitle: 'Precios en dólares o en bolívares' },
  { shot: 'ahorros', title: 'Ahorra con metas y Baúl', subtitle: 'Aparta y mira cuánto falta' },
  { shot: 'analiticas', title: 'Tu mes, de un vistazo', subtitle: 'Ingresos, gastos y cierre proyectado' },
  { shot: 'datos', title: 'Tus datos se quedan contigo', subtitle: 'Sin cuenta, sin anuncios y con respaldo' },
];
// Cada idea es un estilo completo: plantilla, fondo, adorno y, si hace falta, marco y letra.
const idea = (template, bg, deco = 'ninguno', more = {}) => ({ template, bg, deco, frame: 'dark', ...more });
const IDEAS = {
  phone: [
    idea('clasico', 'cielo'), idea('inclinado', 'marca', 'franjas'), idea('fundido', 'noche', 'resplandor'), idea('titular', 'papel'),
    idea('tarjeta', 'atardecer'), idea('duo', 'aurora'), idea('banda', 'marca'), idea('abanico', 'nube', 'disco'),
    idea('completa', 'tinta'), idea('plano', 'menta', 'anillos'), idea('colgado', 'cian'), idea('cruzado', 'oceano', 'rejilla'),
    idea('clasico', 'carbon', 'puntos', { frame: 'light' }), idea('corte', 'atardecer', 'disco'), idea('detalle', 'nube'), idea('titular', 'marca', 'franjas'),
    idea('banda', 'noche'), idea('abanico', 'tinta', 'resplandor'),
  ],
  feature: [
    idea('f-marca', 'cielo'), idea('f-tres', 'noche', 'resplandor'), idea('f-centro', 'marca', 'franjas'), idea('f-titular', 'papel'),
    idea('f-fichas', 'aurora'), idea('f-fila', 'nube'), idea('f-muro', 'carbon'), idea('f-logo', 'marca', 'anillos'),
    idea('f-marca', 'oceano', 'rejilla'), idea('f-titular', 'atardecer', 'disco'), idea('f-centro', 'tinta', 'puntos'), idea('f-fila', 'noche'),
  ],
};
const STYLE_KEYS = ['template', 'bg', 'bgA', 'bgB', 'bgAngle', 'deco', 'ink', 'font', 'titleSize', 'align', 'frame', 'scale', 'offsetY', 'tilt', 'side', 'logo'];
const SLOT_NAMES = ['Principal', 'Segunda', 'Tercera', 'Cuarta', 'Quinta'];
const MAX_SERIES = 8;

// ── Estado ──
const KEY = 'store-studio-v1';
const uploads = new Map(); // id -> URL de objeto (solo en esta pestaña)
const state = load();
const cfg = () => state.cfg[state.kind];
let slot = 0; // qué captura de la plantilla se está eligiendo

function load() {
  const fresh = { kind: 'phone', shotTheme: 'light', cfg: { phone: defaults('phone'), feature: defaults('feature') }, series: [], editing: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved) return fresh;
    const clean = (c, kind) => {
      const merged = { ...defaults(kind), ...(c || {}), kind };
      // Las imágenes subidas no sobreviven a la recarga.
      const base = defaults(kind).shots;
      const kept = Array.isArray(merged.shots) ? merged.shots : [];
      merged.shots = Array.from({ length: Math.max(kept.length, base.length) }, (_, i) => (kept[i] == null || String(kept[i]).startsWith('upload:') ? base[i] ?? base[0] : kept[i]));
      return merged;
    };
    return {
      kind: saved.kind === 'feature' ? 'feature' : 'phone',
      shotTheme: saved.shotTheme === 'dark' ? 'dark' : 'light',
      cfg: { phone: clean(saved.cfg?.phone, 'phone'), feature: clean(saved.cfg?.feature, 'feature') },
      series: (Array.isArray(saved.series) ? saved.series : []).slice(0, MAX_SERIES).map((c) => clean(c, 'phone')),
      editing: null,
    };
  } catch {
    return fresh;
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ kind: state.kind, shotTheme: state.shotTheme, cfg: state.cfg, series: state.series }));
  } catch {
    // Sin almacenamiento el trabajo dura lo que dure la pestaña.
  }
}

// ── Imágenes ──
const loaded = new Map();
const loading = new Set();
const urlOf = (id) => (String(id).startsWith('upload:') ? uploads.get(id) : `/img/cerofiao/store/${id}.webp`);
function image(id) {
  if (!id) return null;
  if (loaded.has(id)) return loaded.get(id);
  const url = urlOf(id);
  if (url && !loading.has(id)) {
    loading.add(id);
    const img = new Image();
    img.onload = () => {
      loaded.set(id, img);
      loading.delete(id);
      redraw();
    };
    img.onerror = () => loading.delete(id);
    img.src = url;
  }
  return null;
}
const env = { image, logoPath: null };
fetch('/img/cerofiao/logo.svg')
  .then((res) => res.text())
  .then((svg) => {
    const d = /\sd="([^"]+)"/.exec(svg)?.[1];
    if (d) env.logoPath = new Path2D(d);
    redraw();
  })
  .catch(() => {});

/** Promesa que termina cuando están cargadas todas las capturas que usan esas configuraciones. */
function ready(configs) {
  const ids = new Set(configs.flatMap(shotsOf));
  return Promise.all([...ids].map((id) => new Promise((resolve) => {
    if (loaded.has(id)) return resolve();
    const url = urlOf(id);
    if (!url) return resolve();
    const img = new Image();
    img.onload = () => {
      loaded.set(id, img);
      resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
}

// ── Piezas de la página ──
const $ = (selector) => document.querySelector(selector);
const form = $('[data-controls]');
const main = $('[data-main]');
const canvasBox = $('[data-canvas-box]');
const templatesBox = $('[data-templates]');
const backgroundsBox = $('[data-backgrounds]');
const decosBox = $('[data-decos]');
const slotTabs = $('[data-slot-tabs]');
const slotsBox = $('[data-slots]');
const ideasBox = $('[data-ideas]');
const seriesBox = $('[data-series]');
const statusNote = $('[data-status]');
const fileInput = $('[data-file]');
const addButton = $('[data-add]');
const cancelEdit = $('[data-cancel-edit]');
const say = (text, kind = '') => {
  statusNote.textContent = text;
  statusNote.dataset.kind = kind;
};
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
function miniCanvas(kind, width) {
  const { w, h } = KINDS[kind];
  const dpr = Math.min(2, devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round((width * h * dpr) / w);
  return canvas;
}

for (const [id, name] of Object.entries(FONT_NAMES)) form.elements.font.append(el('option', { value: id, textContent: name }));
decosBox.replaceChildren(...DECOS.map((deco) => {
  const button = el('button', { type: 'button', textContent: deco.name, onclick: () => update({ deco: deco.id }) });
  button.dataset.deco = deco.id;
  return button;
}));

// ── Dibujo ──
let queued = false;
let slow = 0;
function redraw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const { w, h } = KINDS[state.kind];
    if (main.width !== w || main.height !== h) {
      main.width = w;
      main.height = h;
    }
    render(main.getContext('2d'), cfg(), env);
    // Las miniaturas van detrás: esperan a que se deje de mover el control.
    clearTimeout(slow);
    slow = setTimeout(drawSmall, 140);
  });
}
function drawSmall() {
  for (const canvas of templatesBox.querySelectorAll('canvas')) render(canvas.getContext('2d'), { ...cfg(), template: canvas.dataset.template }, env);
  for (const canvas of ideasBox.querySelectorAll('canvas')) render(canvas.getContext('2d'), { ...cfg(), ...IDEAS[state.kind][Number(canvas.dataset.idea)] }, env);
  for (const canvas of seriesBox.querySelectorAll('canvas')) render(canvas.getContext('2d'), state.series[Number(canvas.dataset.index)], env);
}

// ── Controles ──
function buildPickers() {
  templatesBox.replaceChildren(...TEMPLATES[state.kind].map((template) => {
    const canvas = miniCanvas(state.kind, state.kind === 'phone' ? 72 : 150);
    canvas.dataset.template = template.id;
    return el('button', { type: 'button', className: 'st-template', title: template.name, onclick: () => update({ template: template.id }) }, canvas, el('span', { textContent: template.name }));
  }));
  templatesBox.dataset.for = state.kind;

  backgroundsBox.replaceChildren(
    ...BACKGROUNDS.map((bg) => el('button', {
      type: 'button',
      className: 'st-swatch',
      title: bg.name,
      ariaLabel: `Fondo ${bg.name}`,
      style: `background: linear-gradient(${bg.angle}deg, ${bg.stops[0]}, ${bg.stops[1]})`,
      onclick: () => update({ bg: bg.id }),
    })),
    el('button', { type: 'button', className: 'st-swatch own', title: 'A medida', ariaLabel: 'Fondo a medida', textContent: '+', onclick: () => update({ bg: 'propio' }) }),
  );
  [...backgroundsBox.children].forEach((button, i) => { button.dataset.bg = BACKGROUNDS[i]?.id || 'propio'; });

  ideasBox.replaceChildren(...IDEAS[state.kind].map((style, i) => {
    const canvas = miniCanvas(state.kind, state.kind === 'phone' ? 180 : 330);
    canvas.dataset.idea = i;
    const deco = style.deco === 'ninguno' ? '' : `, con ${DECOS.find((d) => d.id === style.deco).name.toLowerCase()}`;
    const name = `${TEMPLATES[state.kind].find((t) => t.id === style.template).name} sobre ${BACKGROUNDS.find((b) => b.id === style.bg).name.toLowerCase()}${deco}`;
    return el('button', { type: 'button', className: 'st-idea', title: name, ariaLabel: name, onclick: () => { update({ ...style }); scrollTo({ top: 0, behavior: 'smooth' }); } }, canvas);
  }));
  ideasBox.dataset.for = state.kind;

  const size = form.elements.titleSize;
  [size.min, size.max] = state.kind === 'phone' ? [64, 150] : [34, 84];
}

const themed = (id) => {
  const base = String(id).replace(/-dark$/, '');
  const item = LIBRARY.find((entry) => entry.id === base);
  if (!item) return id; // una imagen subida
  return state.shotTheme === 'dark' && item.dark ? `${base}-dark` : base;
};

/** Pone una captura en el hueco que se está eligiendo, sin dejar vacíos los anteriores. */
function place(id) {
  const shots = shotsOf(cfg());
  for (const [i, kept] of cfg().shots.entries()) if (i >= shots.length && kept != null) shots[i] = kept;
  shots[slot] = id;
  update({ shots });
}

function buildSlots() {
  const count = templateOf(cfg()).shots;
  slot = Math.min(slot, Math.max(0, count - 1));
  $('[data-shots-set]').hidden = count === 0;
  // Con varias capturas, unas pestañas dicen cuál se está cambiando.
  slotTabs.hidden = count < 2;
  slotTabs.replaceChildren(...Array.from({ length: count }, (_, i) => el('button', { type: 'button', textContent: SLOT_NAMES[i], ariaPressed: String(i === slot), onclick: () => { slot = i; buildSlots(); } })));
  if (count === 0) return slotsBox.replaceChildren();
  const current = shotsOf(cfg())[slot];
  const options = LIBRARY.map((item) => {
    const id = themed(item.id);
    return el('button', { type: 'button', className: 'st-shot', title: item.name, ariaLabel: item.name, ariaPressed: String(id === current), onclick: () => place(id) },
      el('img', { src: `/img/cerofiao/store/${id}-thumb.webp`, alt: '', width: 216, height: 481, loading: 'lazy' }));
  });
  const mine = [...uploads.keys()].map((id) => el('button', { type: 'button', className: 'st-shot', title: 'Tu imagen', ariaLabel: 'Tu imagen', ariaPressed: String(id === current), onclick: () => place(id) },
    el('img', { src: uploads.get(id), alt: '' })));
  const add = el('button', { type: 'button', className: 'st-shot add', title: 'Subir una captura', ariaLabel: 'Subir una captura', textContent: '+', onclick: () => fileInput.click() });
  slotsBox.replaceChildren(el('div', { className: 'st-shots' }, ...options, ...mine, add));
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const id = `upload:${uploads.size + 1}`;
  uploads.set(id, URL.createObjectURL(file));
  fileInput.value = '';
  place(id);
});

/** Lleva la configuración a los controles. */
function sync() {
  const c = cfg();
  for (const name of ['badge', 'title', 'subtitle', 'font', 'align', 'ink', 'titleSize', 'frame', 'side', 'scale', 'offsetY', 'tilt', 'bgA', 'bgB', 'bgAngle']) {
    const input = form.elements[name];
    if (input && document.activeElement !== input) input.value = c[name];
  }
  form.elements.logo.checked = Boolean(c.logo);
  const outputs = { titleSize: `${Math.round(c.titleSize)} px`, scale: `${Math.round(c.scale * 100)} %`, offsetY: `${c.offsetY > 0 ? '+' : ''}${c.offsetY}`, tilt: `${c.tilt > 0 ? '+' : ''}${c.tilt}°`, bgAngle: `${c.bgAngle}°` };
  for (const [name, text] of Object.entries(outputs)) $(`[data-out="${name}"]`).textContent = text;

  for (const button of document.querySelectorAll('button[data-kind]')) button.setAttribute('aria-pressed', String(button.dataset.kind === state.kind));
  for (const button of templatesBox.children) button.setAttribute('aria-pressed', String(button.firstElementChild.dataset.template === c.template));
  for (const button of backgroundsBox.children) button.setAttribute('aria-pressed', String(button.dataset.bg === c.bg));
  for (const button of decosBox.children) button.setAttribute('aria-pressed', String(button.dataset.deco === (c.deco || 'ninguno')));
  for (const button of document.querySelectorAll('[data-shot-theme]')) button.setAttribute('aria-pressed', String(button.dataset.shotTheme === state.shotTheme));
  $('[data-custom]').hidden = c.bg !== 'propio';
  $('[data-side]').hidden = c.template !== 'corte';
  $('[data-phone-set]').hidden = templateOf(c).shots === 0;
  form.elements.frame.disabled = ['plano', 'completa', 'detalle', 'f-muro'].includes(c.template);
  form.elements.align.disabled = state.kind === 'feature' || ['corte', 'titular'].includes(c.template);
  canvasBox.dataset.for = state.kind;
  $('[data-series-section]').hidden = state.kind !== 'phone';
  addButton.hidden = state.kind !== 'phone';
  addButton.textContent = state.editing == null ? 'Añadir a la serie' : `Guardar la captura ${state.editing + 1}`;
  cancelEdit.hidden = state.editing == null;
}

function update(patch) {
  const slotsBefore = templateOf(cfg()).shots;
  Object.assign(cfg(), patch);
  if ('shots' in patch || templateOf(cfg()).shots !== slotsBefore) buildSlots();
  sync();
  save();
  redraw();
}

form.addEventListener('input', (event) => {
  const { name, type, value, checked } = event.target;
  if (!name) return;
  const numeric = ['titleSize', 'scale', 'offsetY', 'tilt', 'bgAngle'].includes(name);
  update({ [name]: type === 'checkbox' ? checked : numeric ? Number(value) : value });
});
form.addEventListener('submit', (event) => event.preventDefault());

for (const button of document.querySelectorAll('button[data-kind]')) {
  button.addEventListener('click', () => {
    if (state.kind === button.dataset.kind) return;
    state.kind = button.dataset.kind;
    state.editing = null;
    buildPickers();
    buildSlots();
    sync();
    save();
    redraw();
  });
}
for (const button of document.querySelectorAll('[data-shot-theme]')) {
  button.addEventListener('click', () => {
    state.shotTheme = button.dataset.shotTheme;
    // El tema vale para los dos gráficos; las capturas ya guardadas en la serie no se tocan.
    for (const config of Object.values(state.cfg)) config.shots = config.shots.map((id) => (id == null ? id : themed(id)));
    update({ shots: cfg().shots });
  });
}
$('[data-reset-phone]').addEventListener('click', () => update({ scale: 1, offsetY: 0, tilt: 0 }));
$('[data-shuffle]').addEventListener('click', () => {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  let template;
  let bg;
  do {
    template = pick(TEMPLATES[state.kind]).id;
    bg = pick(BACKGROUNDS).id;
  } while (template === cfg().template && bg === cfg().bg);
  // La mitad de las veces sin adorno: tanto dibujo de fondo cansa.
  update({ template, bg, deco: Math.random() < 0.5 ? 'ninguno' : pick(DECOS.slice(1)).id });
});

// ── Descargas ──
async function draft(config) {
  await ready([config]);
  const { w, h } = KINDS[config.kind];
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  render(canvas.getContext('2d'), config, env);
  return canvas;
}
const format = () => $('[data-format]').value;

$('[data-download]').addEventListener('click', async () => {
  say('Preparando la imagen…');
  try {
    const { blob, ext } = await encode(await draft(cfg()), format());
    saveBlob(blob, state.kind === 'phone' ? `cerofiao-captura.${ext}` : `cerofiao-grafico-de-funciones.${ext}`);
    const { w, h } = KINDS[state.kind];
    say(`Descargada: ${w} × ${h} px, ${(blob.size / 1e6).toFixed(1).replace('.', ',')} MB${ext === 'jpg' && format() !== 'jpeg' ? ' (en JPEG: este navegador no escribe PNG de 24 bits)' : ''}.`, 'ok');
  } catch (err) {
    say(`No se pudo crear la imagen: ${err.message}`, 'error');
  }
});

$('[data-zip]').addEventListener('click', async () => {
  if (!state.series.length) return say('La serie está vacía. Añade capturas o pide una serie propuesta.', 'error');
  const button = $('[data-zip]');
  button.disabled = true;
  try {
    const files = [];
    for (const [i, config] of state.series.entries()) {
      say(`Preparando la captura ${i + 1} de ${state.series.length}…`);
      const { blob, ext } = await encode(await draft(config), format());
      files.push({ name: `captura-${String(i + 1).padStart(2, '0')}.${ext}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    say('Preparando el gráfico de funciones…');
    const feature = await encode(await draft(state.cfg.feature), format());
    files.push({ name: `grafico-de-funciones.${feature.ext}`, bytes: new Uint8Array(await feature.blob.arrayBuffer()) });
    saveBlob(zip(files), 'cerofiao-google-play.zip');
    say(`Listo: ${state.series.length} capturas y el gráfico de funciones en un .zip.`, 'ok');
  } catch (err) {
    say(`No se pudo crear el .zip: ${err.message}`, 'error');
  } finally {
    button.disabled = false;
  }
});

// ── Serie ──
const copy = (config) => JSON.parse(JSON.stringify(config));

function drawSeries() {
  $('[data-series-count]').textContent = `${state.series.length} de ${MAX_SERIES}`;
  if (!state.series.length) {
    seriesBox.replaceChildren(el('p', { className: 'adm-empty', textContent: 'Todavía no hay capturas en la serie. Diseña una y pulsa «Añadir a la serie», o pide una serie propuesta.' }));
    return;
  }
  seriesBox.replaceChildren(...state.series.map((config, i) => {
    const canvas = miniCanvas('phone', 150);
    canvas.dataset.index = i;
    const move = (step) => {
      state.series.splice(i + step, 0, state.series.splice(i, 1)[0]);
      state.editing = null;
      afterSeries();
    };
    return el('article', { className: `st-item${state.editing === i ? ' is-editing' : ''}` },
      canvas,
      el('div', { className: 'adm-tools' },
        el('button', { type: 'button', textContent: 'Editar', onclick: () => { state.cfg.phone = copy(config); state.editing = i; buildSlots(); afterSeries(); scrollTo({ top: 0, behavior: 'smooth' }); } }),
        el('button', { type: 'button', textContent: '←', ariaLabel: 'Mover antes', disabled: i === 0, onclick: () => move(-1) }),
        el('button', { type: 'button', textContent: '→', ariaLabel: 'Mover después', disabled: i === state.series.length - 1, onclick: () => move(1) }),
        el('button', { type: 'button', className: 'danger', textContent: 'Quitar', onclick: () => { state.series.splice(i, 1); state.editing = null; afterSeries(); } }),
      ),
    );
  }));
}
function afterSeries() {
  drawSeries();
  sync();
  save();
  redraw();
}

addButton.addEventListener('click', () => {
  if (state.editing != null) {
    state.series[state.editing] = copy(cfg());
    say(`Captura ${state.editing + 1} actualizada.`, 'ok');
    state.editing = null;
  } else {
    if (state.series.length >= MAX_SERIES) return say(`Play admite hasta ${MAX_SERIES} capturas. Quita una para añadir otra.`, 'error');
    state.series.push(copy(cfg()));
    say(`Añadida. Tu serie tiene ${state.series.length}.`, 'ok');
  }
  afterSeries();
});
cancelEdit.addEventListener('click', () => {
  state.editing = null;
  afterSeries();
});
$('[data-suggest]').addEventListener('click', () => {
  if (state.series.length && !confirm('Esto sustituye la serie actual por ocho capturas propuestas con el estilo que tienes ahora. ¿Seguir?')) return;
  // Cada captura enseña una pantalla distinta; las que acompañan (en las plantillas de varias) son las siguientes de la lista.
  state.series = SUGGESTED.map((item, i) => ({
    ...copy(state.cfg.phone),
    title: item.title,
    subtitle: item.subtitle,
    badge: '',
    shots: [item.shot, SUGGESTED[(i + 1) % SUGGESTED.length].shot, SUGGESTED[(i + 2) % SUGGESTED.length].shot].map(themed),
  }));
  state.editing = null;
  say('Serie propuesta con tu estilo actual. Edita la que quieras.', 'ok');
  afterSeries();
});
$('[data-restyle]').addEventListener('click', () => {
  if (!state.series.length) return say('La serie está vacía.', 'error');
  const style = Object.fromEntries(STYLE_KEYS.map((key) => [key, state.cfg.phone[key]]));
  state.series = state.series.map((config) => ({ ...config, ...copy(style) }));
  say('Estilo aplicado a toda la serie.', 'ok');
  afterSeries();
});

// ── Arranque ──
buildPickers();
buildSlots();
drawSeries();
sync();
redraw();
// El lienzo usa las letras de la página: hay que esperar a que estén.
Promise.all(['600 64px Inter', '500 64px Inter', '400 64px Inter', '400 64px Anton', "600 64px 'DM Sans'", "400 64px 'DM Sans'"].map((font) => document.fonts.load(font)))
  .then(redraw)
  .catch(redraw);
