// Botón de descarga de CeroFiao. Lo decide el panel (/admin › Botón de descarga)
// y lo sirve /api/download. Cada botón de la página lleva `data-play` con su
// papel: `hero` (el de arriba), `bar` (el de la barra), `menu` (el del menú del
// teléfono) y `final` (el del cierre). Sin JavaScript se ven los textos del HTML,
// que son los de «Próximamente».

const KEY = 'cf-download';
const ASK = 'mailto:soporte@schwarckdev.com?subject=Quiero%20probar%20CeroFiao';

/** Lo que dice cada botón según el punto en que está la app. El panel puede cambiar cada texto. */
export const DOWNLOAD_TEXTS = {
  soon: { hero: 'Próximamente en Google Play', bar: 'Google Play', final: 'Pedir acceso a la prueba', note: 'CeroFiao 1.1 está en prueba interna y llega pronto a Google Play.' },
  test: { hero: 'Unirme a la prueba', bar: 'Probar', final: 'Unirme a la prueba', note: 'CeroFiao está en prueba abierta. Únete y cuéntanos qué te parece.' },
  play: { hero: 'Descargar en Google Play', bar: 'Descargar', final: 'Descargar en Google Play', note: 'Ya está en Google Play. Instálala y ponte al día hoy.' },
};

/** Texto y enlace de cada botón. Un enlace vacío deja el del HTML (la sección de descarga). */
export function resolveDownload(cfg = {}) {
  const mode = DOWNLOAD_TEXTS[cfg.mode] ? cfg.mode : 'soon';
  const text = (role) => cfg[role] || DOWNLOAD_TEXTS[mode][role];
  const link = mode === 'play' ? cfg.playUrl : mode === 'test' ? cfg.testUrl : '';
  return {
    mode,
    note: text('note'),
    buttons: {
      hero: { label: text('hero'), href: link },
      bar: { label: text('bar'), href: link },
      menu: { label: text('hero'), href: link },
      final: { label: text('final'), href: link || cfg.testUrl || ASK },
    },
  };
}

export function applyDownload(cfg, scope = document) {
  const { mode, note, buttons } = resolveDownload(cfg);
  for (const a of scope.querySelectorAll('[data-play]')) {
    const b = buttons[a.dataset.play];
    if (!b) continue;
    a.dataset.origin ||= a.getAttribute('href') || '';
    const href = b.href || a.dataset.origin;
    a.setAttribute('href', href);
    // Lo que sale de la web se abre aparte; un correo o un salto de sección, no.
    if (/^https:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
    const label = a.querySelector('[data-play-label]');
    if (label) label.textContent = b.label;
  }
  for (const n of scope.querySelectorAll('[data-play-note]')) n.textContent = note;
  document.documentElement.classList.toggle('play-live', mode === 'play');
  document.documentElement.dataset.download = mode;
}

/** Aplica lo último que se vio (sin parpadeo al volver) y luego lo que diga el servidor. */
export async function loadDownload() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) applyDownload(saved);
  } catch {
    // Sin almacenamiento, se espera a la respuesta.
  }
  try {
    const res = await fetch('/api/download');
    if (!res.ok) return;
    const cfg = await res.json();
    applyDownload(cfg);
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      // Da igual: la próxima vez se vuelve a pedir.
    }
  } catch {
    // Sin conexión con la API se quedan los textos del HTML.
  }
}
