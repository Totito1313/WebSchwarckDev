// Barra del estudio: vidrio más opaco al bajar, enlace de la página actual,
// un brillo que se desliza entre enlaces bajo el cursor y el menú del teléfono.
const bar = document.querySelector('.sb');
if (bar) {
  const stick = () => bar.classList.toggle('is-stuck', scrollY > 12);
  addEventListener('scroll', stick, { passive: true });
  stick();

  const here = location.pathname.replace(/\/?$/, '/');
  for (const a of bar.querySelectorAll('[data-sb-path]')) {
    const path = a.dataset.sbPath;
    if (path === '/' ? here === '/' : here.startsWith(path)) a.setAttribute('aria-current', 'page');
  }

  // El brillo nace en el enlace donde entra el cursor y luego lo sigue.
  const links = bar.querySelector('.sb-links');
  const glow = links?.querySelector('.sb-glow');
  if (glow) {
    let shown = false;
    const place = (a) => {
      if (!shown) glow.style.transition = 'opacity 0.2s';
      glow.style.width = `${a.offsetWidth}px`;
      glow.style.translate = `${a.offsetLeft}px 0`;
      if (!shown) {
        glow.getBoundingClientRect();
        glow.style.transition = '';
        shown = true;
      }
    };
    for (const a of links.querySelectorAll('a')) {
      a.addEventListener('pointerenter', () => place(a));
      a.addEventListener('focus', () => place(a));
    }
    links.addEventListener('pointerleave', () => { shown = false; });
  }

  const menu = bar.querySelector('.sb-menu');
  if (menu) {
    addEventListener('click', (e) => {
      if (menu.open && (!menu.contains(e.target) || e.target.closest('a'))) menu.open = false;
    });
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  }
}
