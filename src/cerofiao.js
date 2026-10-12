import { initMotion, onScroll, pinned, through, range, easeOut, setVar, reducedMotion } from './motion.js';

// Enlace de CeroFiao en Google Play. Mientras esté vacío, los botones dicen
// "Próximamente" y llevan a la sección de descarga; al publicar la app, pega
// aquí la URL de la ficha y todos los botones pasan a "Descargar".
const PLAY_URL = '';

if (PLAY_URL) {
  document.documentElement.classList.add('play-live');
  for (const a of document.querySelectorAll('[data-play]')) {
    a.href = PLAY_URL;
    a.rel = 'noopener';
    const label = a.querySelector('[data-play-label]');
    if (label) label.textContent = a.dataset.play || 'Descargar en Google Play';
  }
}

const motion = initMotion();

// ── Navegación: gana cuerpo al dejar el borde superior ──
const nav = document.querySelector('.nav');
if (nav) onScroll(() => nav.classList.toggle('is-stuck', scrollY > 24));

// ── Hero: el teléfono sube, el texto se va y las pantallas pasan dentro ──
const hero = document.querySelector('[data-hero]');
if (hero && motion) {
  const stage = hero.querySelector('.hero-stage');
  const copy = hero.querySelector('.hero-copy');
  const phone = hero.querySelector('.hero-phone');
  const reel = hero.querySelector('.reel');
  const steps = [...hero.querySelectorAll('.hero-steps li')];
  const count = reel.children.length;
  let shown = -1;

  // Cuánto baja el teléfono al inicio para asomar justo debajo del texto.
  const measure = () => {
    const drop = Math.max(0, copy.offsetTop + copy.offsetHeight + 28 - phone.offsetTop);
    stage.style.setProperty('--drop', `${drop}px`);
  };
  // En pantallas muy bajas (un teléfono acostado) el hero se queda como página normal.
  const tall = matchMedia('(min-height: 480px)');
  const pin = () => { hero.classList.toggle('is-pinned', tall.matches); measure(); };
  pin();
  tall.addEventListener('change', pin);
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);

  onScroll((vh) => {
    const p = pinned(hero, vh);
    const e = easeOut(range(p, 0, 0.22));
    setVar(stage, '--p', p);
    setVar(stage, '--e', e);
    copy.classList.toggle('is-gone', p > 0.2);

    const i = Math.min(count - 1, Math.floor(range(p, 0.22, 0.98) * count));
    if (i === shown) return;
    shown = i;
    stage.style.setProperty('--i', i);
    steps.forEach((step, k) => step.classList.toggle('on', k === i));
  });
}

// ── Tarjetas apiladas: cada una sabe por dónde va en la pantalla ──
if (motion) {
  const panels = [...document.querySelectorAll('[data-panel]')];
  if (panels.length) onScroll((vh) => { for (const panel of panels) setVar(panel, '--p', through(panel, vh)); });
}

// ── Balance: el mismo dinero en otra moneda ──
const bal = document.querySelector('[data-balance]');
if (bal) {
  const seg = bal.querySelector('.seg');
  const thumb = bal.querySelector('.seg-thumb');
  const sym = bal.querySelector('.bal-sym');
  const val = bal.querySelector('.bal-val');
  const buttons = [...seg.querySelectorAll('button')];
  // Miles con espacio fino y coma decimal, como en la app.
  const format = (n) => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let current = Number(buttons.find((b) => b.getAttribute('aria-pressed') === 'true').dataset.value);
  let frame = 0;

  const placeThumb = (btn) => {
    thumb.style.setProperty('--tx', `${btn.offsetLeft}px`);
    thumb.style.setProperty('--tw', `${btn.offsetWidth}px`);
  };
  const active = () => buttons.find((b) => b.getAttribute('aria-pressed') === 'true');

  const select = (btn) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
    placeThumb(btn);
    sym.textContent = btn.dataset.sym;
    sym.classList.toggle('is-word', btn.dataset.sym.length > 1);
    const from = current;
    const to = Number(btn.dataset.value);
    current = to;
    cancelAnimationFrame(frame);
    if (reducedMotion) { val.textContent = format(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 650);
      val.textContent = format(from + (to - from) * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  for (const btn of buttons) btn.addEventListener('click', () => { if (btn.getAttribute('aria-pressed') !== 'true') select(btn); });
  placeThumb(active());
  seg.classList.add('is-live');
  addEventListener('resize', () => placeThumb(active()));
  document.fonts?.ready.then(() => placeThumb(active()));
}

// ── Carrusel de pantallas: flechas, barra de avance y arrastre con el ratón ──
for (const strip of document.querySelectorAll('[data-strip]')) {
  const track = strip.querySelector('[data-track]');
  const prev = strip.querySelector('[data-dir="-1"]');
  const next = strip.querySelector('[data-dir="1"]');
  const bar = strip.querySelector('.strip-bar i');
  const items = [...track.children];
  const smooth = reducedMotion ? 'auto' : 'smooth';
  const stepSize = () => items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '24');

  const sync = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    if (bar) {
      const visible = Math.min(1, track.clientWidth / track.scrollWidth);
      const at = max > 0 ? track.scrollLeft / max : 0;
      bar.style.setProperty('--v', (visible + (1 - visible) * at).toFixed(3));
    }
  };
  track.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  addEventListener('load', sync);
  sync();

  for (const btn of [prev, next]) {
    btn.addEventListener('click', () => track.scrollBy({ left: stepSize() * Number(btn.dataset.dir), behavior: smooth }));
  }

  // Arrastrar con el ratón; con el dedo ya lo hace el navegador.
  let down = false;
  let dragged = false;
  let startX = 0;
  let startLeft = 0;
  let settle = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true;
    dragged = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    clearTimeout(settle);
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) > 5) { dragged = true; track.classList.add('is-drag'); }
    if (dragged) track.scrollLeft = startLeft - dx;
  });
  const release = () => {
    if (!down) return;
    down = false;
    if (!dragged) return;
    // Termina en la pantalla más cercana antes de devolverle el imán al carril.
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = items[0];
    for (const item of items) {
      const c = item.offsetLeft + item.offsetWidth / 2;
      if (Math.abs(c - mid) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - mid)) best = item;
    }
    const target = best.offsetLeft + best.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left: target, behavior: smooth });
    settle = setTimeout(() => track.classList.remove('is-drag'), 500);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  track.addEventListener('dragstart', (e) => e.preventDefault());
}
