// Dibuja los gráficos de la ficha de Google Play en un <canvas>.
//
// Todo se pinta a mano (fondo, texto, teléfono, captura) para que la imagen
// que se descarga mida exactamente lo que pide Play y sea idéntica a la vista
// previa. render() es síncrono: recibe las imágenes ya cargadas.

export const KINDS = {
  phone: { w: 1080, h: 1920, name: 'Capturas de teléfono', note: '1080 × 1920 px, 9:16' },
  feature: { w: 1024, h: 500, name: 'Gráfico de funciones', note: '1024 × 500 px' },
};

const SHOT_RATIO = 2992 / 1344; // alto entre ancho de una captura del teléfono
const FAMILY = { inter: "'Inter', sans-serif", anton: "'Anton', 'Arial Narrow', sans-serif", dm: "'DM Sans', sans-serif" };
const TITLE_WEIGHT = { inter: 600, anton: 400, dm: 600 };
export const FONT_NAMES = { inter: 'Inter', anton: 'Anton (la de la app)', dm: 'DM Sans' };

/** Fondos: dos colores y un ángulo como en CSS (180 es de arriba abajo). `ink` dice qué texto se lee encima. */
export const BACKGROUNDS = [
  { id: 'cielo', name: 'Cielo', stops: ['#cfe9f8', '#fff8ec'], angle: 180, ink: 'dark' },
  { id: 'nube', name: 'Nube', stops: ['#eef4f9', '#dbe8f0'], angle: 180, ink: 'dark' },
  { id: 'papel', name: 'Papel', stops: ['#ffffff', '#f1f3f5'], angle: 180, ink: 'dark' },
  { id: 'menta', name: 'Menta', stops: ['#d9f6e5', '#f6fbe9'], angle: 165, ink: 'dark' },
  { id: 'atardecer', name: 'Atardecer', stops: ['#ffdcc6', '#e9defe'], angle: 150, ink: 'dark' },
  { id: 'cian', name: 'Cian', stops: ['#7fe3f2', '#d8fbf4'], angle: 160, ink: 'dark' },
  { id: 'marca', name: 'Marca', stops: ['#0071bc', '#00c2e0'], angle: 135, ink: 'light' },
  { id: 'oceano', name: 'Océano', stops: ['#0b3a66', '#0a8fb0'], angle: 160, ink: 'light' },
  { id: 'noche', name: 'Noche', stops: ['#0a2638', '#0b0d10'], angle: 180, ink: 'light' },
  { id: 'aurora', name: 'Aurora', stops: ['#06131d', '#0b0d10'], angle: 180, ink: 'light', blobs: [['#0e7f9a', 0.12, 0.34, 0.62], ['#2a54c9', 0.92, 0.5, 0.58], ['#00d5f0', 0.5, 1.02, 0.42]] },
  { id: 'carbon', name: 'Carbón', stops: ['#262a31', '#131519'], angle: 180, ink: 'light' },
  { id: 'tinta', name: 'Tinta', stops: ['#0b0d10', '#0b0d10'], angle: 180, ink: 'light' },
];

/** Adornos que se pintan sobre el fondo, detrás de todo lo demás. */
export const DECOS = [
  { id: 'ninguno', name: 'Ninguno' },
  { id: 'disco', name: 'Disco' },
  { id: 'anillos', name: 'Anillos' },
  { id: 'resplandor', name: 'Resplandor' },
  { id: 'puntos', name: 'Puntos' },
  { id: 'rejilla', name: 'Rejilla' },
  { id: 'franjas', name: 'Franjas' },
];

const INK = {
  dark: { title: '#1d2126', sub: '#566069', card: 'rgba(255, 255, 255, 0.66)', chip: '#ffffff', chipText: '#1d2126', chipSub: '#66707a', badge: 'rgba(0, 113, 188, 0.12)', badgeText: '#005a96', sheet: '#ffffff' },
  light: { title: '#f5f8fb', sub: 'rgba(245, 248, 251, 0.74)', card: 'rgba(255, 255, 255, 0.07)', chip: '#1b2128', chipText: '#f5f8fb', chipSub: '#9aa5b0', badge: 'rgba(255, 255, 255, 0.16)', badgeText: '#ffffff', sheet: '#12161b' },
};

// ── Utilidades ──

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}
const rgba = (hex, alpha) => `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`;
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** El fondo que pide la configuración, con el "a medida" resuelto. */
export function resolveBackground(cfg) {
  if (cfg.bg === 'propio') {
    const stops = [cfg.bgA || '#cfe9f8', cfg.bgB || '#fff8ec'];
    const light = (luminance(stops[0]) + luminance(stops[1])) / 2;
    return { id: 'propio', name: 'A medida', stops, angle: Number(cfg.bgAngle ?? 180), ink: light > 0.4 ? 'dark' : 'light' };
  }
  return BACKGROUNDS.find((b) => b.id === cfg.bg) || BACKGROUNDS[0];
}

function inkFor(cfg, bg) {
  const base = INK[cfg.ink === 'light' || cfg.ink === 'dark' ? cfg.ink : bg.ink];
  return base;
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function paintBackground(ctx, W, H, bg) {
  const angle = ((bg.angle ?? 180) * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const len = Math.abs(W * dx) + Math.abs(H * dy);
  const g = ctx.createLinearGradient(W / 2 - (dx * len) / 2, H / 2 - (dy * len) / 2, W / 2 + (dx * len) / 2, H / 2 + (dy * len) / 2);
  g.addColorStop(0, bg.stops[0]);
  g.addColorStop(1, bg.stops[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [color, cx, cy, r] of bg.blobs || []) {
    const radius = r * Math.max(W, H);
    const blob = ctx.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, radius);
    blob.addColorStop(0, rgba(color, 0.55));
    blob.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, W, H);
  }
}

/** El adorno gira alrededor de (fx, fy), que es donde la plantilla pone el teléfono. */
function paintDeco(ctx, W, H, cfg, bg, fx, fy) {
  const onDark = bg.ink === 'light';
  const tone = onDark ? '#ffffff' : '#0071bc';
  const cx = fx * W;
  const cy = fy * H;
  const unit = Math.min(W, H);
  ctx.save();
  if (cfg.deco === 'disco') {
    const r = unit * (H > W ? 0.56 : 0.64);
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, onDark ? 'rgba(255, 255, 255, 0.17)' : 'rgba(255, 255, 255, 0.9)');
    g.addColorStop(1, onDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.3)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.deco === 'anillos') {
    ctx.lineWidth = Math.max(1.5, unit * 0.003);
    for (let i = 1; i <= 7; i++) {
      ctx.strokeStyle = rgba(tone, (onDark ? 0.22 : 0.3) * (1 - i / 8));
      ctx.beginPath();
      ctx.arc(cx, cy, unit * 0.19 * i, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cfg.deco === 'resplandor') {
    const r = unit * 0.9;
    // Sobre un fondo claro un halo blanco no se ve: va en el azul de la marca.
    const color = onDark ? '#00c2e0' : '#3fb6ea';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, onDark ? 0.5 : 0.48));
    g.addColorStop(0.55, rgba(color, onDark ? 0.16 : 0.14));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.deco === 'puntos') {
    const step = unit * 0.046;
    const r = step * 0.09;
    const reach = Math.max(W, H) * 0.75;
    ctx.fillStyle = rgba(tone, onDark ? 0.42 : 0.4);
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        ctx.globalAlpha = clamp(1 - Math.hypot(x - cx, y - cy) / reach, 0, 1) ** 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (cfg.deco === 'rejilla') {
    const step = unit * 0.09;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    g.addColorStop(0, rgba(tone, onDark ? 0.2 : 0.18));
    g.addColorStop(1, rgba(tone, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, unit * 0.0016);
    ctx.beginPath();
    for (let x = (cx % step) - step; x < W + step; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = (cy % step) - step; y < H + step; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  } else if (cfg.deco === 'franjas') {
    const far = Math.max(W, H) * 2;
    ctx.translate(cx, cy);
    ctx.rotate((-24 * Math.PI) / 180);
    [[-0.62, 0.2, 0.5], [-0.3, 0.34, 1], [0.16, 0.12, 0.7], [0.4, 0.26, 0.4]].forEach(([at, size, strength]) => {
      ctx.fillStyle = onDark ? `rgba(255, 255, 255, ${0.06 * strength})` : `rgba(0, 113, 188, ${0.06 * strength})`;
      ctx.fillRect(-far, at * unit, far * 2, size * unit);
    });
  }
  ctx.restore();
}

/** Como `object-fit: cover`: llena el rectángulo recortando lo que sobre. `focusY` va de 0 (arriba) a 1 (abajo). */
function drawCover(ctx, img, x, y, w, h, focusY = 0) {
  if (!img) {
    ctx.fillStyle = '#d7dde3';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) * clamp(focusY, 0, 1), sw, sh, x, y, w, h);
}

// ── Texto ──

function setFont(ctx, family, weight, size, tracking = 0) {
  ctx.font = `${weight} ${size}px ${FAMILY[family] || FAMILY.inter}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
}

function greedy(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = words[0];
    for (const word of words.slice(1)) {
      if (ctx.measureText(`${line} ${word}`).width <= maxWidth) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Parte en líneas parejas: el mismo número de líneas que haría falta, pero con el ancho más justo. */
function balanced(ctx, text, maxWidth) {
  const natural = greedy(ctx, text, maxWidth);
  if (natural.length < 2) return natural;
  let lo = maxWidth * 0.45;
  let hi = maxWidth;
  let best = natural;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const attempt = greedy(ctx, text, mid);
    if (attempt.length <= natural.length && attempt.every((l) => ctx.measureText(l).width <= maxWidth)) {
      best = attempt;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

/** Calcula un bloque de texto que quepa: baja el cuerpo hasta entrar en `maxLines`. */
function layoutText(ctx, { text, maxWidth, size, family = 'inter', weight = 600, lineHeight = 1.05, tracking = 0, maxLines = 3 }) {
  let px = size;
  let lines = [];
  for (let i = 0; i < 14; i++) {
    setFont(ctx, family, weight, px, tracking);
    lines = balanced(ctx, text, maxWidth);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxWidth) break;
    px = Math.max(size * 0.45, px * 0.93);
  }
  for (const factor of [0.92, 0.85]) {
    setFont(ctx, family, weight, px * factor, tracking);
    const tighter = balanced(ctx, text, maxWidth);
    if (tighter.length < lines.length && tighter.every((l) => ctx.measureText(l).width <= maxWidth)) {
      lines = tighter;
      px *= factor;
      break;
    }
  }
  return { lines, size: px, family, weight, lineHeight, tracking, height: lines.length * px * lineHeight };
}

function paintText(ctx, block, x, y, color, align = 'left') {
  setFont(ctx, block.family, block.weight, block.size, block.tracking);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  // La línea se asienta donde lo haría en CSS: la caja de la línea, con el texto sobre su línea base.
  const ascent = block.size * (block.family === 'anton' ? 0.92 : 0.82);
  block.lines.forEach((line, i) => {
    const top = y + i * block.size * block.lineHeight + (block.size * block.lineHeight - block.size) / 2;
    ctx.fillText(line, x, top + ascent);
  });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// ── Marca ──

function paintLogo(ctx, env, x, y, height, fill) {
  if (!env.logoPath) return 0;
  const scale = height / 468.36;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (fill) ctx.fillStyle = fill;
  else {
    const g = ctx.createLinearGradient(0, 0, 402.21, 0);
    g.addColorStop(0, '#0071bc');
    g.addColorStop(1, '#00e5ff');
    ctx.fillStyle = g;
  }
  ctx.fill(env.logoPath);
  ctx.restore();
  return 402.21 * scale;
}

/** Logo y nombre en una línea. Devuelve el ancho que ocupa. `measure` solo mide. */
function brand(ctx, env, x, y, height, ink, bg, { align = 'left', measure = false } = {}) {
  const size = height * 0.86;
  setFont(ctx, 'inter', 600, size, -0.02);
  const textW = ctx.measureText('CeroFiao').width;
  const logoW = env.logoPath ? (402.21 * height) / 468.36 : 0;
  const gap = height * 0.3;
  const total = logoW + gap + textW;
  if (measure) return total;
  const left = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  // Sobre fondos de color el degradado del logo se pierde: va en el color del texto.
  const flat = bg.ink === 'light' && (bg.id === 'marca' || bg.id === 'oceano');
  paintLogo(ctx, env, left, y, height, flat ? ink.title : null);
  setFont(ctx, 'inter', 600, size, -0.02);
  ctx.fillStyle = ink.title;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('CeroFiao', left + logoW + gap, y + height * 0.8);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return total;
}

// ── Teléfono ──

/** Dibuja un teléfono con su captura. `cx` es el centro horizontal y `top` el borde superior antes de girar. */
function phone(ctx, img, { cx, top, width, tilt = 0, frame = 'dark', shadow = true }) {
  const bezel = frame === 'none' ? 0 : width * 0.03;
  const sw = width - bezel * 2;
  const sh = sw * SHOT_RATIO;
  const height = sh + bezel * 2;
  const radius = width * (frame === 'none' ? 0.085 : 0.15);
  ctx.save();
  ctx.translate(cx, top + height / 2);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(6, 22, 38, 0.42)';
    ctx.shadowBlur = width * 0.16;
    ctx.shadowOffsetY = width * 0.07;
    rounded(ctx, 0, 0, width, height, radius);
    ctx.fillStyle = '#0c0d10';
    ctx.fill();
    ctx.restore();
  }
  if (frame !== 'none') {
    const body = ctx.createLinearGradient(0, 0, width, height);
    const stops = frame === 'light' ? ['#f4f6f8', '#c5cbd3', '#a9b0ba', '#e9ecef'] : ['#5b616b', '#1b1d21', '#0c0d10', '#363a42'];
    [0, 0.18, 0.55, 1].forEach((at, i) => body.addColorStop(at, stops[i]));
    rounded(ctx, 0, 0, width, height, radius);
    ctx.fillStyle = body;
    ctx.fill();
    const lip = width * 0.012;
    rounded(ctx, lip, lip, width - lip * 2, height - lip * 2, radius - lip);
    ctx.fillStyle = '#0b0c0e';
    ctx.fill();
  }
  ctx.save();
  rounded(ctx, bezel, bezel, sw, sh, width * (frame === 'none' ? 0.085 : 0.122));
  ctx.clip();
  drawCover(ctx, img, bezel, bezel, sw, sh, 0);
  ctx.restore();
  if (frame !== 'none') {
    ctx.beginPath();
    ctx.arc(width / 2, width * 0.075, width * 0.017, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0e11';
    ctx.fill();
  }
  ctx.restore();
  return height;
}

/** Lo que mide de alto un teléfono de ese ancho. */
function phoneHeight(width, frame = 'dark') {
  const bezel = frame === 'none' ? 0 : width * 0.03;
  return (width - bezel * 2) * SHOT_RATIO + bezel * 2;
}

// ── Etiqueta: una píldora corta encima del titular ──

function badgeBox(ctx, text, titleSize) {
  const size = clamp(titleSize * 0.32, 15, 38);
  setFont(ctx, 'inter', 600, size, 0);
  return { text, size, w: ctx.measureText(text).width + size * 1.9, h: size * 2.1 };
}

function paintBadge(ctx, box, x, y, ink, align) {
  const left = align === 'center' ? x - box.w / 2 : align === 'right' ? x - box.w : x;
  rounded(ctx, left, y, box.w, box.h, box.h / 2);
  ctx.fillStyle = ink.badge;
  ctx.fill();
  setFont(ctx, 'inter', 600, box.size, 0);
  ctx.fillStyle = ink.badgeText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(box.text, left + box.size * 0.95, y + box.h / 2 + box.size * 0.36);
}

// ── Titular y subtítulo, con la marca y la etiqueta encima si se piden ──

function headBlocks(ctx, cfg, { maxWidth, maxLines = 3, sizeMul = 1, font, maxHeight }) {
  let blocks = measureHead(ctx, cfg, { maxWidth, maxLines, sizeMul, font });
  for (let i = 0; maxHeight && blocks.height > maxHeight && i < 12; i++) {
    sizeMul *= 0.93;
    blocks = measureHead(ctx, cfg, { maxWidth, maxLines, sizeMul, font });
  }
  return blocks;
}

function measureHead(ctx, cfg, { maxWidth, maxLines, sizeMul, font }) {
  const family = font || cfg.font || 'inter';
  const anton = family === 'anton';
  const title = layoutText(ctx, {
    text: cfg.title,
    maxWidth,
    size: cfg.titleSize * sizeMul,
    family,
    weight: TITLE_WEIGHT[family] || 600,
    lineHeight: anton ? 1.1 : 1.04,
    tracking: anton ? 0.005 : -0.03,
    maxLines,
  });
  const sub = cfg.subtitle
    ? layoutText(ctx, { text: cfg.subtitle, maxWidth, size: Math.max(20, title.size * (anton ? 0.3 : 0.42)), family: anton ? 'inter' : family, weight: 400, lineHeight: 1.28, tracking: -0.01, maxLines: 3 })
    : null;
  const brandH = cfg.logo ? clamp(title.size * 0.5, 30, 64) : 0;
  const gapBrand = cfg.logo ? brandH * 0.75 : 0;
  const gapSub = sub ? title.size * 0.26 : 0;
  const label = String(cfg.badge || '').trim();
  const badge = label ? badgeBox(ctx, label, title.size) : null;
  const gapBadge = badge ? badge.size * 0.95 : 0;
  return { title, sub, brandH, gapBrand, gapSub, badge, gapBadge, height: brandH + gapBrand + (badge ? badge.h : 0) + gapBadge + title.height + gapSub + (sub ? sub.height : 0) };
}

/** Pinta el bloque de cabecera. Con `bottomAt` se apoya por abajo en vez de colgar de `y`. */
function head(ctx, cfg, env, ink, bg, { x, y = 0, bottomAt, maxWidth, align = 'center', maxLines, sizeMul, font, maxHeight }) {
  const b = headBlocks(ctx, cfg, { maxWidth, maxLines, sizeMul, font, maxHeight });
  let top = bottomAt != null ? bottomAt - b.height : y;
  if (cfg.logo) {
    brand(ctx, env, x, top, b.brandH, ink, bg, { align });
    top += b.brandH + b.gapBrand;
  }
  if (b.badge) {
    paintBadge(ctx, b.badge, x, top, ink, align);
    top += b.badge.h + b.gapBadge;
  }
  paintText(ctx, b.title, x, top, ink.title, align);
  top += b.title.height;
  if (b.sub) {
    top += b.gapSub;
    paintText(ctx, b.sub, x, top, ink.sub, align);
    top += b.sub.height;
  }
  return top;
}

const alignOf = (cfg, fallback) => (cfg.align === 'left' || cfg.align === 'center' ? cfg.align : fallback);
const xOf = (align, W, m) => (align === 'center' ? W / 2 : m);

// ── Fichas flotantes (gráfico de funciones) ──

function chip(ctx, x, y, label, value, valueColor, ink) {
  setFont(ctx, 'inter', 600, 21, -0.02);
  const vw = ctx.measureText(value).width;
  setFont(ctx, 'inter', 500, 13, 0);
  const lw = ctx.measureText(label).width;
  const w = Math.max(vw, lw) + 36;
  ctx.save();
  ctx.shadowColor = 'rgba(6, 22, 38, 0.28)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  rounded(ctx, x, y, w, 64, 18);
  ctx.fillStyle = ink.chip;
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 'inter', 500, 13, 0);
  ctx.fillStyle = ink.chipSub;
  ctx.fillText(label, x + 18, y + 25);
  setFont(ctx, 'inter', 600, 21, -0.02);
  ctx.fillStyle = valueColor || ink.chipText;
  ctx.fillText(value, x + 18, y + 49);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// ══ Plantillas ══
// Cada una recibe el contexto ya con el fondo pintado y dibuja el resto.
// `s(n)` devuelve la imagen de la captura n (0 es la principal).

const M = 84; // margen de las capturas de teléfono

const PHONE_TEMPLATES = [
  {
    id: 'clasico', name: 'Clásico', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      phone(ctx, s(0), { cx: W / 2, top: Math.max(bottom + 96, 520) + cfg.offsetY, width: W * 0.66 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'fundido', name: 'Fundido', shots: 1, focus: () => [0.5, 0.32],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      phone(ctx, s(0), { cx: W / 2, top: 120 + cfg.offsetY, width: W * 0.7 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
      // El teléfono se funde con el fondo donde va el texto.
      const end = bg.stops[1];
      const veil = ctx.createLinearGradient(0, H * 0.44, 0, H * 0.67);
      veil.addColorStop(0, rgba(end, 0));
      veil.addColorStop(1, rgba(end, 1));
      ctx.fillStyle = veil;
      ctx.fillRect(0, H * 0.44, W, H * 0.56);
      const align = alignOf(cfg, 'center');
      head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), bottomAt: H - 130, maxWidth: W - M * 2, align, maxHeight: H * 0.24 });
    },
  },
  {
    id: 'inclinado', name: 'Inclinado', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'left');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      phone(ctx, s(0), { cx: W * 0.57, top: Math.max(bottom + 120, 560) + cfg.offsetY, width: W * 0.82 * cfg.scale, tilt: -9 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'duo', name: 'Dúo', shots: 2,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      const top = Math.max(bottom + 110, 560) + cfg.offsetY;
      phone(ctx, s(1), { cx: W * 0.7, top: top - 10, width: W * 0.5 * cfg.scale, tilt: 5 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(0), { cx: W * 0.36, top: top + 120, width: W * 0.56 * cfg.scale, tilt: -4 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'completa', name: 'Pantalla completa', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      drawCover(ctx, s(0), 0, 0, W, H, clamp(-cfg.offsetY / 600, 0, 1));
      const end = bg.stops[1];
      const veil = ctx.createLinearGradient(0, H * 0.34, 0, H * 0.63);
      veil.addColorStop(0, rgba(end, 0));
      veil.addColorStop(1, rgba(end, 1));
      ctx.fillStyle = veil;
      ctx.fillRect(0, H * 0.34, W, H * 0.66);
      const align = alignOf(cfg, 'left');
      head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), bottomAt: H - 130, maxWidth: W - M * 2, align, maxHeight: H * 0.26 });
    },
  },
  {
    id: 'tarjeta', name: 'Tarjeta', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const inset = 48;
      const pad = 76;
      rounded(ctx, inset, inset, W - inset * 2, H - inset * 2, 84);
      ctx.fillStyle = ink.card;
      ctx.fill();
      const align = alignOf(cfg, 'left');
      const bottom = head(ctx, cfg, env, ink, bg, { x: align === 'center' ? W / 2 : inset + pad, y: inset + 104, maxWidth: W - (inset + pad) * 2, align });
      ctx.save();
      rounded(ctx, inset, inset, W - inset * 2, H - inset * 2, 84);
      ctx.clip();
      phone(ctx, s(0), { cx: W / 2, top: Math.max(bottom + 96, 600) + cfg.offsetY, width: W * 0.6 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
      ctx.restore();
    },
  },
  {
    id: 'plano', name: 'Sin marco', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      phone(ctx, s(0), { cx: W / 2, top: Math.max(bottom + 96, 520) + cfg.offsetY, width: W * 0.74 * cfg.scale, tilt: cfg.tilt, frame: 'none' });
    },
  },
  {
    id: 'detalle', name: 'Detalle', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      const x = 64;
      const y = Math.max(bottom + 96, 500);
      const w = W - x * 2;
      const h = H - y - 110;
      ctx.save();
      ctx.shadowColor = 'rgba(6, 22, 38, 0.32)';
      ctx.shadowBlur = 80;
      ctx.shadowOffsetY = 36;
      rounded(ctx, x, y, w, h, 68);
      ctx.fillStyle = '#0c0d10';
      ctx.fill();
      ctx.restore();
      ctx.save();
      rounded(ctx, x, y, w, h, 68);
      ctx.clip();
      // Una ventana a la captura, sin marco y más grande que en un teléfono: la posición
      // vertical elige qué parte se ve y el tamaño la amplía.
      const iw = w * Math.max(1, cfg.scale);
      const ih = iw * SHOT_RATIO;
      const focus = clamp(0.12 - cfg.offsetY / 700, 0, 1);
      const img = s(0);
      if (img) ctx.drawImage(img, x - (iw - w) / 2, y - (ih - h) * focus, iw, ih);
      else drawCover(ctx, null, x, y, w, h);
      ctx.restore();
    },
  },
  {
    id: 'corte', name: 'Asomado', shots: 1, focus: (cfg) => [cfg.side === 'left' ? 0.22 : 0.78, 0.7],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const left = cfg.side === 'left';
      const bottom = head(ctx, cfg, env, ink, bg, { x: left ? W - M : M, y: 150, maxWidth: W - M * 2, align: left ? 'right' : 'left' });
      phone(ctx, s(0), { cx: left ? W * 0.22 : W * 0.78, top: Math.max(bottom + 120, 560) + cfg.offsetY, width: W * 0.86 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'titular', name: 'Titular', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const bottom = head(ctx, cfg, env, ink, bg, { x: M, y: 140, maxWidth: W - M * 2, align: 'left', sizeMul: 1.7, maxLines: 4, font: 'anton' });
      phone(ctx, s(0), { cx: W * 0.62, top: Math.max(bottom + 90, H * 0.44) + cfg.offsetY, width: W * 0.62 * cfg.scale, tilt: 6 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'abanico', name: 'Abanico', shots: 3,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      const top = Math.max(bottom + 130, 600) + cfg.offsetY;
      const w = W * 0.5 * cfg.scale;
      phone(ctx, s(1), { cx: W * 0.23, top: top + 110, width: w * 0.9, tilt: -9 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(2), { cx: W * 0.77, top: top + 110, width: w * 0.9, tilt: 9 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(0), { cx: W / 2, top, width: w, tilt: cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'colgado', name: 'Desde arriba', shots: 1, focus: () => [0.5, 0.3],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      // El teléfono baja desde arriba y enseña el pie de la pantalla; el texto va debajo.
      const align = alignOf(cfg, 'center');
      const text = { x: xOf(align, W, M), bottomAt: H - 140, maxWidth: W - M * 2, align, maxHeight: H * 0.25 };
      const textTop = H - 140 - headBlocks(ctx, cfg, text).height;
      const width = W * 0.7 * cfg.scale;
      phone(ctx, s(0), { cx: W / 2, top: textTop - 120 - phoneHeight(width, cfg.frame) + cfg.offsetY, width, tilt: cfg.tilt, frame: cfg.frame });
      head(ctx, cfg, env, ink, bg, text);
    },
  },
  {
    id: 'cruzado', name: 'En diagonal', shots: 2, focus: () => [0.6, 0.7],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      const align = alignOf(cfg, 'left');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      const top = Math.max(bottom + 150, 620) + cfg.offsetY;
      const w = W * 0.58 * cfg.scale;
      phone(ctx, s(1), { cx: W * 0.9, top: top - 60, width: w, tilt: -14 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(0), { cx: W * 0.36, top: top + 150, width: w, tilt: -14 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'banda', name: 'Dos tonos', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      // Una hoja de otro tono sube desde abajo y el teléfono se apoya a caballo entre las dos.
      const align = alignOf(cfg, 'center');
      const bottom = head(ctx, cfg, env, ink, bg, { x: xOf(align, W, M), y: 150, maxWidth: W - M * 2, align });
      const top = Math.max(bottom + 96, 520) + cfg.offsetY;
      ctx.save();
      ctx.shadowColor = 'rgba(6, 22, 38, 0.18)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = -12;
      rounded(ctx, 0, Math.max(top + 380, H * 0.56), W, H, 110);
      ctx.fillStyle = ink.sheet;
      ctx.fill();
      ctx.restore();
      phone(ctx, s(0), { cx: W / 2, top, width: W * 0.64 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
    },
  },
];

const F = 56; // margen del gráfico de funciones

const FEATURE_TEMPLATES = [
  {
    id: 'f-marca', name: 'Marca y lema', shots: 2,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      brand(ctx, env, F, 70, 44, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 160, maxWidth: 520, align: 'left', maxHeight: H - 160 - 44 });
      phone(ctx, s(1), { cx: 915, top: 120 + cfg.offsetY, width: 205 * cfg.scale, tilt: 8 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(0), { cx: 760, top: 54 + cfg.offsetY, width: 240 * cfg.scale, tilt: -7 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'f-tres', name: 'Tres pantallas', shots: 3,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      brand(ctx, env, F, 70, 40, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 152, maxWidth: 400, align: 'left', sizeMul: 0.9, maxHeight: H - 152 - 44 });
      phone(ctx, s(1), { cx: 590, top: 124 + cfg.offsetY, width: 180 * cfg.scale, tilt: -7 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(2), { cx: 940, top: 124 + cfg.offsetY, width: 180 * cfg.scale, tilt: 7 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(0), { cx: 765, top: 60 + cfg.offsetY, width: 200 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'f-logo', name: 'Solo marca', shots: 0, focus: () => [0.5, 0.5],
    draw(ctx, W, H, cfg, env, ink, bg) {
      const height = 104;
      brand(ctx, env, W / 2, 132, height, ink, bg, { align: 'center' });
      const line = layoutText(ctx, { text: cfg.title, maxWidth: 820, size: cfg.titleSize * 0.62, family: cfg.font === 'anton' ? 'inter' : cfg.font, weight: 500, lineHeight: 1.25, tracking: -0.015, maxLines: 2 });
      paintText(ctx, line, W / 2, 290, ink.sub, 'center');
    },
  },
  {
    id: 'f-titular', name: 'Titular', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      brand(ctx, env, F, 54, 34, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 126, maxWidth: 600, align: 'left', sizeMul: 1.85, maxLines: 3, font: 'anton', maxHeight: H - 126 - 40 });
      phone(ctx, s(0), { cx: 850, top: 62 + cfg.offsetY, width: 250 * cfg.scale, tilt: 7 + cfg.tilt, frame: cfg.frame });
    },
  },
  {
    id: 'f-fichas', name: 'Con fichas', shots: 1,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      brand(ctx, env, F, 70, 40, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 152, maxWidth: 420, align: 'left', sizeMul: 0.92, maxHeight: H - 152 - 44 });
      phone(ctx, s(0), { cx: 760, top: 48 + cfg.offsetY, width: 232 * cfg.scale, tilt: cfg.tilt, frame: cfg.frame });
      chip(ctx, 512, 118, 'Dólar BCV', 'Bs 875,65', null, ink);
      chip(ctx, 862, 196, 'Te deben', '$310,32', bg.ink === 'light' ? '#37d67a' : '#1f9d46', ink);
      chip(ctx, 530, 342, 'Flujo neto del mes', '+$220,05', bg.ink === 'light' ? '#37d67a' : '#1f9d46', ink);
    },
  },
  {
    id: 'f-muro', name: 'Muro de pantallas', shots: 3,
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      ctx.save();
      ctx.translate(W * 0.7, H / 2);
      ctx.rotate((-13 * Math.PI) / 180);
      const w = 150 * cfg.scale;
      const gap = 22;
      const h = w * SHOT_RATIO;
      for (let col = -3; col <= 4; col++) {
        for (let row = -1; row <= 0; row++) {
          const n = ((col + 3) * 2 + row + 1) % 3;
          phone(ctx, s(n), { cx: col * (w + gap), top: row * (h + gap) + (col % 2 ? h * 0.32 : -h * 0.12) + cfg.offsetY, width: w, frame: 'none' });
        }
      }
      ctx.restore();
      const veil = ctx.createLinearGradient(0, 0, W, 0);
      veil.addColorStop(0, rgba(bg.stops[0], 1));
      veil.addColorStop(0.47, rgba(bg.stops[0], 0.97));
      veil.addColorStop(0.7, rgba(bg.stops[0], 0.18));
      veil.addColorStop(1, rgba(bg.stops[0], 0));
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);
      brand(ctx, env, F, 70, 44, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 160, maxWidth: 420, align: 'left', maxHeight: H - 160 - 44 });
    },
  },
  {
    id: 'f-centro', name: 'Centrado', shots: 2, focus: () => [0.5, 0.5],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      phone(ctx, s(0), { cx: 118, top: 96 + cfg.offsetY, width: 236 * cfg.scale, tilt: -10 + cfg.tilt, frame: cfg.frame });
      phone(ctx, s(1), { cx: W - 118, top: 96 + cfg.offsetY, width: 236 * cfg.scale, tilt: 10 + cfg.tilt, frame: cfg.frame });
      const text = { x: W / 2, maxWidth: 470, align: 'center', sizeMul: 0.92, maxHeight: H - 96 - 150 };
      const b = headBlocks(ctx, { ...cfg, logo: false }, text);
      const top = (H - (40 + 30 + b.height)) / 2;
      brand(ctx, env, W / 2, top, 40, ink, bg, { align: 'center' });
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { ...text, y: top + 70 });
    },
  },
  {
    id: 'f-fila', name: 'Fila de pantallas', shots: 5, focus: () => [0.5, 0.95],
    draw(ctx, W, H, cfg, env, ink, bg, s) {
      brand(ctx, env, F, 44, 34, ink, bg);
      head(ctx, { ...cfg, logo: false }, env, ink, bg, { x: F, y: 104, maxWidth: W - F * 2, align: 'left', sizeMul: 0.78, maxLines: 2, maxHeight: 132 });
      const w = 170 * cfg.scale;
      const gap = (W - F * 2 - w * 5) / 4;
      [1, 3, 0, 4, 2].forEach((n, i) => {
        const middle = Math.abs(i - 2);
        phone(ctx, s(n), { cx: F + w / 2 + i * (w + gap), top: 244 + middle * 18 + cfg.offsetY, width: w, tilt: cfg.tilt, frame: cfg.frame });
      });
    },
  },
];

export const TEMPLATES = { phone: PHONE_TEMPLATES, feature: FEATURE_TEMPLATES };

export function templateOf(cfg) {
  const list = TEMPLATES[cfg.kind] || PHONE_TEMPLATES;
  return list.find((t) => t.id === cfg.template) || list[0];
}

/** Configuración de partida de cada tipo de gráfico. */
export function defaults(kind) {
  const phone = kind !== 'feature';
  return {
    kind: phone ? 'phone' : 'feature',
    template: phone ? 'clasico' : 'f-marca',
    bg: 'cielo',
    bgA: '#cfe9f8',
    bgB: '#fff8ec',
    bgAngle: 180,
    ink: 'auto',
    title: 'Tus cuentas, en la moneda que sea',
    subtitle: phone ? 'Bolívares, dólares, euros y USDT' : 'Bolívares, dólares, euros y USDT con la tasa del día',
    font: 'inter',
    titleSize: phone ? 104 : 54,
    align: 'auto',
    shots: phone ? ['home', 'tasas', 'deudas'] : ['home', 'conversor', 'deudas', 'analiticas', 'ahorros'],
    deco: 'ninguno',
    badge: '',
    frame: 'dark',
    scale: 1,
    offsetY: 0,
    tilt: 0,
    side: 'right',
    logo: false,
  };
}

/** Las capturas que usa la plantilla elegida, con los huecos rellenos. */
export function shotsOf(cfg) {
  const fallback = defaults(cfg.kind).shots;
  return Array.from({ length: templateOf(cfg).shots }, (_, n) => cfg.shots?.[n] ?? fallback[n] ?? cfg.shots?.[0] ?? fallback[0]);
}

/**
 * Pinta `cfg` en `ctx`. El lienzo puede ser más pequeño que el tamaño real
 * (miniaturas): se escala solo. `env.image(id)` devuelve la imagen cargada o null.
 */
export function render(ctx, cfg, env) {
  const { w: W, h: H } = KINDS[cfg.kind] || KINDS.phone;
  const canvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const bg = resolveBackground(cfg);
  const ink = inkFor(cfg, bg);
  paintBackground(ctx, W, H, bg);
  const template = templateOf(cfg);
  if (cfg.deco && cfg.deco !== 'ninguno') {
    const [fx, fy] = template.focus?.(cfg) || (cfg.kind === 'feature' ? [0.76, 0.5] : [0.5, 0.66]);
    paintDeco(ctx, W, H, cfg, bg, fx, fy);
  }
  const ids = shotsOf(cfg);
  template.draw(ctx, W, H, cfg, env, ink, bg, (n) => env.image(ids[n] ?? ids[0]));
  ctx.restore();
}
