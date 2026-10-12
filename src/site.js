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

// Palabra que rota en el titular del estudio.
const rotor = document.querySelector('[data-rotate]');
if (rotor && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const words = rotor.dataset.rotate.split('|');
  let i = 0;
  setInterval(() => {
    rotor.classList.add('is-out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      rotor.textContent = words[i];
      rotor.classList.remove('is-out');
    }, 260);
  }, 2600);
}

// Flechas del carrusel de pantallas.
for (const strip of document.querySelectorAll('[data-strip]')) {
  const track = strip.querySelector('[data-track]');
  for (const btn of strip.querySelectorAll('[data-dir]')) {
    btn.addEventListener('click', () => {
      const step = track.firstElementChild.getBoundingClientRect().width + 24;
      track.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    });
  }
}
