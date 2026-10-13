// Tema claro u oscuro.
//
// Sin elección guardada manda el sistema, y eso lo resuelve el CSS solo
// (`prefers-color-scheme`). Una elección explícita vive en localStorage y se
// refleja en <html data-theme="light|dark">; el fragmento en línea del <head>
// la aplica antes del primer pintado para que no haya destello.
//
// Marcado que entiende:
//   [data-theme-toggle]              alterna entre claro y oscuro
//   [data-theme-set="light|dark|system"]  elige uno (aria-pressed lo marca)
//   <source data-dark media="(prefers-color-scheme: dark)">  capturas oscuras
//   <meta name="theme-color" data-light="#…" data-dark="#…">

const KEY = 'theme';
const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: dark)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** El tema que se ve ahora mismo. */
export function currentTheme() {
  return root.dataset.theme || (system.matches ? 'dark' : 'light');
}

// Pone al día todo lo que el CSS no puede: imágenes, color del navegador y controles.
function sync() {
  const forced = root.dataset.theme;
  const now = currentTheme();
  const media = forced ? (forced === 'dark' ? 'all' : 'not all') : '(prefers-color-scheme: dark)';
  for (const source of document.querySelectorAll('source[data-dark]')) {
    if (source.media !== media) source.media = media;
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"][data-light]')) {
    meta.content = now === 'dark' ? meta.dataset.dark : meta.dataset.light;
  }
  const choice = forced || 'system';
  for (const btn of document.querySelectorAll('[data-theme-set]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.themeSet === choice));
  }
  for (const btn of document.querySelectorAll('[data-theme-toggle]')) {
    btn.setAttribute('aria-label', now === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  }
}

function apply(choice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Sin almacenamiento el tema vale para esta visita.
  }
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  sync();
}

/** Cambia el tema. Si el navegador sabe, el nuevo se abre en círculo desde el botón. */
export function setTheme(choice, from) {
  const before = currentTheme();
  const after = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
  if (before === after || !document.startViewTransition || calm.matches) return apply(choice);

  const box = from?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : innerWidth / 2;
  const y = box ? box.top + box.height / 2 : 0;
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('theme-swap');
  const swap = document.startViewTransition(() => apply(choice));
  swap.ready
    .then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    ))
    .catch(() => {});
  swap.finished.finally(() => root.classList.remove('theme-swap'));
}

export function initTheme() {
  for (const btn of document.querySelectorAll('[data-theme-toggle]')) {
    btn.hidden = false;
    btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark', btn));
  }
  for (const btn of document.querySelectorAll('[data-theme-set]')) {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeSet, btn));
  }
  for (const group of document.querySelectorAll('[data-theme-group]')) group.hidden = false;
  system.addEventListener('change', sync);
  // Otra pestaña cambió el tema: esta la sigue.
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const v = stored();
    if (v) root.dataset.theme = v;
    else delete root.dataset.theme;
    sync();
  });
  sync();
}
