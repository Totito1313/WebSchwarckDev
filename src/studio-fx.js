// Efectos compartidos por las páginas del estudio (portada, Lion Fitness y 404):
// la luz que sigue al cursor, los botones con imán y el nombre gigante del pie.
import { reducedMotion } from './motion.js';

/** Hay ratón de verdad y la persona no pidió menos movimiento. */
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion;

export function initPointerFx(fine) {
  if (!fine) return;

  // El foco de la retícula del fondo.
  const bg = document.querySelector('.grid-bg');
  let raf = 0;
  let mx = 0;
  let my = 0;
  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      bg?.style.setProperty('--mx', `${mx}px`);
      bg?.style.setProperty('--my', `${my}px`);
    });
  }, { passive: true });

  // La luz y el borde de cada tarjeta.
  for (const el of document.querySelectorAll('[data-spot]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sx', `${e.clientX - r.left}px`);
      el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    });
  }

  // Botones que se dejan atraer un poco por el cursor.
  for (const el of document.querySelectorAll('[data-magnet]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--tx', `${(e.clientX - r.left - r.width / 2) * 0.18}px`);
      el.style.setProperty('--ty', `${(e.clientY - r.top - r.height / 2) * 0.28}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.removeProperty('--tx');
      el.style.removeProperty('--ty');
    });
  }
}

/**
 * El nombre del pie ocupa justo el ancho. Con ratón se ilumina bajo el cursor;
 * en el teléfono se llena de color de izquierda a derecha al aparecer.
 */
export function initWordmark(motion, fine) {
  const wordmark = document.querySelector('[data-wordmark]');
  if (!wordmark) return;
  const line = wordmark.querySelector('.wm-line');
  const fill = wordmark.querySelector('.wm-fill');
  const fit = () => {
    wordmark.style.fontSize = '';
    const size = parseFloat(getComputedStyle(wordmark).fontSize);
    const width = line.getBoundingClientRect().width;
    if (width > 0) wordmark.style.fontSize = `${Math.min(size * (wordmark.clientWidth / width) * 0.985, 340)}px`;
  };
  fit();
  document.fonts?.ready.then(fit);
  let wide = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === wide) return;
    wide = innerWidth;
    fit();
  });

  if (!motion) return;
  if (fine) {
    const foot = wordmark.closest('footer') || wordmark;
    foot.addEventListener('pointermove', (e) => {
      const r = fill.getBoundingClientRect();
      wordmark.style.setProperty('--fx', `${e.clientX - r.left}px`);
      wordmark.style.setProperty('--fy', `${e.clientY - r.top}px`);
      wordmark.style.setProperty('--fo', '1');
    });
    foot.addEventListener('pointerleave', () => wordmark.style.setProperty('--fo', '0'));
    return;
  }
  wordmark.classList.add('is-sweep');
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    wordmark.classList.add('lit');
  }, { threshold: 0.6 });
  io.observe(wordmark);
}
