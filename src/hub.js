// Panel: la entrada. Saluda según la hora, dice si la sesión sigue abierta y
// mueve la luz de cada tarjeta con el cursor.
import { initTheme } from './theme.js';

initTheme();

const hour = new Date().getHours();
document.querySelector('[data-greet]').textContent = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

fetch('/api/admin/session', { credentials: 'same-origin' })
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    if (!s) return;
    document.querySelector('[data-session]').classList.toggle('is-on', Boolean(s.authed));
    document.querySelector('[data-session-text]').textContent = s.authed ? 'Sesión abierta' : 'Entra desde cualquier sección';
  })
  .catch(() => {});

if (matchMedia('(hover: hover)').matches) {
  for (const card of document.querySelectorAll('.hub-card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
}
