// Base de movimiento compartida por todas las páginas.
//
// Regla: sin este módulo la página se ve completa y quieta. Nada se oculta
// hasta que initMotion() pone la clase `motion` en <html>, y eso no ocurre si
// la persona pidió menos movimiento.
//
// Revelado al hacer scroll: marca un elemento con `data-reveal` y define en el
// CSS de la página
//     html.motion [data-reveal]      { opacity: 0; transform: … }
//     html.motion [data-reveal].in   { opacity: 1; transform: none; }
// El retraso escalonado va en la propiedad `--i` (0, 1, 2…) del elemento.
//
// Ojo: un `transform` en un ancestro rompe `position: fixed` de sus hijos. No
// pongas `data-reveal` en contenedores que tengan dentro algo fijo.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 0 antes de `from`, 1 después de `to`, lineal en medio. */
export const range = (v, from, to) => clamp((v - from) / (to - from));

/** Activa los revelados. Devuelve false si la página se queda quieta. */
export function initMotion() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion || !('IntersectionObserver' in window)) return false;

  // Lo que ya está en pantalla (o por encima) al cargar no se oculta nunca.
  for (const el of els) {
    if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('in');
  }
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  for (const el of els) if (!el.classList.contains('in')) io.observe(el);
  return true;
}

// Un solo bucle para todo lo que depende del scroll: se llama como mucho una
// vez por cuadro, y una vez al registrarse.
const listeners = new Set();
let queued = false;
function flush() {
  queued = false;
  const vh = innerHeight;
  for (const fn of listeners) fn(vh);
}
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(flush);
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
addEventListener('load', schedule);

/** fn(alturaDelViewport) en cada cuadro en que hubo scroll o cambio de tamaño. */
export function onScroll(fn) {
  listeners.add(fn);
  schedule();
  return () => listeners.delete(fn);
}

/** 0 cuando el borde superior del elemento entra por abajo; 1 cuando su borde inferior sale por arriba. */
export function through(el, vh = innerHeight) {
  const r = el.getBoundingClientRect();
  return clamp((vh - r.top) / (vh + r.height));
}

/** Para secciones más altas que la pantalla con algo `sticky` dentro: 0 al fijarse, 1 al soltarse. */
export function pinned(el, vh = innerHeight) {
  const r = el.getBoundingClientRect();
  const span = r.height - vh;
  return span <= 0 ? 0 : clamp(-r.top / span);
}

/** Escribe una propiedad CSS solo si cambió lo suficiente para notarse. */
export function setVar(el, name, value, digits = 4) {
  const v = Number(value).toFixed(digits);
  if (el.__vars?.[name] === v) return;
  (el.__vars ||= {})[name] = v;
  el.style.setProperty(name, v);
}
