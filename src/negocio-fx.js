// Negocio: el movimiento fino.
//
// · Las cifras de las tarjetas (KPI y el beneficio de Inicio) cuentan hasta su
//   valor la primera vez que aparece cada página; al repintar por un cambio de
//   datos ya no, para no distraer.
// · Filas, tarjetas y columnas entran escalonadas al cambiar de página.
// · Una pieza se desliza por el riel hasta la sección activa (como las pestañas).
// · En el teléfono el riel se desplaza de lado: la sección activa se centra sola.
// Con «reducir movimiento» no se anima nada.

const still = matchMedia('(prefers-reduced-motion: reduce)');
const seen = new WeakSet();

// ── Cifras que cuentan ──

const NUM = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/;

function format(value, decimals, grouped) {
  const [int, dec] = Math.abs(value).toFixed(decimals).split('.');
  const body = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : int;
  return `${value < 0 ? '-' : ''}${body}${dec ? `,${dec}` : ''}`;
}

function countUp(node) {
  if (seen.has(node)) return;
  seen.add(node);
  const text = node.textContent;
  const m = NUM.exec(text);
  if (!m) return;
  const raw = m[0];
  const decimals = raw.includes(',') ? raw.split(',')[1].length : 0;
  const target = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(target) || target === 0) return;
  const grouped = raw.includes('.') || Math.abs(target) >= 1000;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + raw.length);
  const t0 = performance.now();
  const dur = 650 + Math.min(450, Math.log10(Math.abs(target) + 1) * 90);
  node.classList.add('fx-counting');
  const step = (t) => {
    // Si la página ya cambió el texto (datos nuevos), se deja estar.
    if (!node.isConnected) return;
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - (1 - k) ** 4;
    node.textContent = k < 1 ? `${before}${format(target * eased, decimals, grouped)}${after}` : text;
    if (k < 1) requestAnimationFrame(step);
    else node.classList.remove('fx-counting');
  };
  requestAnimationFrame(step);
}

// ── Entrada escalonada ──

const STAGGER = '.ng-kpis > *, .ng-rows > *, .ng-col, .pt-grid > *, .ng-tcard, .ng-hero, .ng-card';

function stagger(page) {
  let i = 0;
  for (const node of page.querySelectorAll(STAGGER)) {
    if (seen.has(node)) continue;
    seen.add(node);
    // Solo lo que se ve al llegar: lo de más abajo aparece sin esperar.
    if (i > 14) break;
    node.style.setProperty('--fx-i', String(i++));
    node.classList.add('fx-in');
    node.addEventListener('animationend', () => node.classList.remove('fx-in'), { once: true });
  }
}

/** Se llama al pintar una página nueva (no al repintar sus datos). */
export function enterPage(page) {
  if (still.matches || !page) return;
  stagger(page);
  for (const v of page.querySelectorAll('.ng-kpi-value, .ng-hero-num')) countUp(v);
}

// ── Riel ──

export function mountRail(rail) {
  if (!rail) return;
  const glow = document.createElement('span');
  glow.className = 'fx-rail-glow';
  glow.setAttribute('aria-hidden', 'true');
  rail.prepend(glow);
  rail.classList.add('has-glow');
  const mobile = matchMedia('(max-width: 760px)');
  let first = true;
  const place = () => {
    const on = rail.querySelector('a[aria-current]');
    if (!on || !on.offsetWidth) {
      glow.style.opacity = '0';
      return;
    }
    if (first || still.matches) glow.style.transition = 'none';
    glow.style.opacity = '1';
    glow.style.width = `${on.offsetWidth}px`;
    glow.style.height = `${on.offsetHeight}px`;
    glow.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    if (glow.style.transition === 'none') {
      glow.getBoundingClientRect();
      glow.style.transition = '';
    }
    first = false;
    // En el teléfono el riel es una fila que se desplaza: la sección activa, a la vista.
    if (mobile.matches) {
      const left = on.offsetLeft - rail.clientWidth / 2 + on.offsetWidth / 2;
      rail.scrollTo({ left, behavior: still.matches ? 'auto' : 'smooth' });
    }
  };
  new MutationObserver(place).observe(rail, { subtree: true, attributes: true, attributeFilter: ['aria-current', 'hidden'] });
  new ResizeObserver(place).observe(rail);
  mobile.addEventListener('change', () => {
    first = true;
    place();
  });
  // Bordes que se desvanecen solo cuando queda algo por ver a ese lado.
  const edges = () => {
    rail.classList.toggle('fx-more-left', rail.scrollLeft > 4);
    rail.classList.toggle('fx-more-right', rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  };
  rail.addEventListener('scroll', edges, { passive: true });
  new ResizeObserver(edges).observe(rail);
  place();
}
