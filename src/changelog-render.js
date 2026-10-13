// Pinta las novedades. Lo usan vite (al construir, desde data/changelog.json),
// la página (al refrescar desde /api/changelog) y el panel (vista previa), así
// que es una función pura que devuelve HTML y escapa todo lo que recibe.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** "2026-10-12" → "octubre de 2026". Cadena vacía si no hay fecha válida. */
export function monthLabel(date) {
  const m = /^(\d{4})-(\d{2})/.exec(date || '');
  if (!m || +m[2] < 1 || +m[2] > 12) return '';
  return `${MONTHS[+m[2] - 1]} de ${m[1]}`;
}

/** Solo las publicadas, la primera abierta. */
export function renderChangelog(entries) {
  return entries
    .filter((entry) => entry && entry.published !== false && Array.isArray(entry.items) && entry.items.length)
    .map((entry, i) => {
      const id = `rel-${String(entry.id || i).replace(/[^a-z0-9-]/gi, '')}`;
      const when = monthLabel(entry.date);
      const count = entry.items.length === 1 ? '1 cambio' : `${entry.items.length} cambios`;
      return `
        <article class="rel${i === 0 ? ' is-open' : ''}">
          <h3><button class="rel-head" type="button" aria-expanded="${i === 0}" aria-controls="${id}">
            <span>
              <span class="rel-title">${escapeHtml(entry.title)}${entry.tag ? `<span class="rel-tag">${escapeHtml(entry.tag)}</span>` : ''}</span>
              ${when ? `<span class="rel-date">${when}</span>` : ''}
            </span>
            <span class="rel-side"><span class="rel-count">${count}</span><span class="rel-plus" aria-hidden="true"></span></span>
          </button></h3>
          <div class="rel-body" id="${id}"><div><ul>
            ${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n            ')}
          </ul></div></div>
        </article>`;
    })
    .join('\n');
}
