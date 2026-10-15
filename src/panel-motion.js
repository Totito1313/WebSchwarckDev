// Panel: la pieza que se desliza en pestañas y segmentos.
//
// Como el control segmentado de CeroFiao: al cambiar de opción, la pieza
// activa viaja de una a otra en vez de aparecer de golpe. Vale para cualquier
// grupo de la lista, también los que se pintan después (se vigila la página).
// Cada grupo recuerda dónde estaba su pieza: si la página se repinta al
// cambiar de pestaña (como en Marketing o Leads), la pieza sale de la opción
// anterior y se desliza hasta la nueva.

const GROUPS = ['.ng-tabs', '.adm-tabs', '.adm-filter', '.st-kind', '.st-pair', '.adm-switch', '.top-nav'].join(', ');
const ACTIVE = "[aria-pressed='true'], [aria-selected='true'], [aria-current]:not([aria-current='false'])";
const memory = new Map();
const still = matchMedia('(prefers-reduced-motion: reduce)');

function enhance(group) {
  // Los segmentos de Negocio ya traen su propia pieza deslizante.
  if (group.dataset.slide != null || group.querySelector('.seg')) return;
  group.dataset.slide = '';
  group.classList.add('has-slide');
  const thumb = document.createElement('span');
  thumb.className = 'slide-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  group.prepend(thumb);
  const key = `${location.pathname}|${group.getAttribute('aria-label') || group.className}`;

  const measure = () => {
    const on = [...group.children].find((c) => c !== thumb && c.matches(ACTIVE));
    if (!on || !on.offsetWidth) return null;
    return { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
  };
  const apply = (r, animate) => {
    if (!r) {
      thumb.style.opacity = '0';
      return;
    }
    if (!animate || still.matches) thumb.style.transition = 'none';
    thumb.style.opacity = '1';
    thumb.style.width = `${r.w}px`;
    thumb.style.height = `${r.h}px`;
    thumb.style.transform = `translate(${r.x}px, ${r.y}px)`;
    memory.set(key, r);
    if (thumb.style.transition === 'none') {
      thumb.getBoundingClientRect();
      thumb.style.transition = '';
    }
  };

  // Desde donde estaba antes (si se repintó) hasta la opción de ahora.
  const before = memory.get(key);
  const now = measure();
  if (before && now && (before.x !== now.x || before.w !== now.w)) {
    apply(before, false);
    setTimeout(() => apply(measure(), true), 30);
  } else apply(now, false);

  group.addEventListener('slide-measure', () => apply(measure(), false));
  new MutationObserver(() => apply(measure(), true)).observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current'] });
  let first = true;
  new ResizeObserver(() => {
    if (first) {
      first = false;
      return;
    }
    apply(measure(), false);
  }).observe(group);
}

function scan(root = document) {
  if (root.matches?.(GROUPS)) enhance(root);
  for (const g of root.querySelectorAll?.(GROUPS) || []) enhance(g);
}

scan();
new MutationObserver((records) => {
  for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
}).observe(document.body, { childList: true, subtree: true });
// Cuando llegan las letras, los anchos cambian: se vuelve a medir.
document.fonts?.ready.then(() => {
  for (const g of document.querySelectorAll('.has-slide')) g.dispatchEvent(new Event('slide-measure'));
});
