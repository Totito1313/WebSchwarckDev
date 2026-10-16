// Panel: novedades de CeroFiao, moderación de reseñas y el botón de descarga.
// Habla con /api/admin/*; la sesión va en una cookie que el navegador no deja leer a este código.

import { initTheme } from './theme.js';
import { DOWNLOAD_TEXTS, resolveDownload } from './cf-download.js';

initTheme();

const views = Object.fromEntries([...document.querySelectorAll('[data-view]')].map((v) => [v.dataset.view, v]));
const logout = document.querySelector('[data-logout]');
const loadingNote = views.loading.firstElementChild;
const show = (name) => {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  logout.hidden = name !== 'panel';
};

async function api(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') show('login');
  if (!res.ok) throw new Error(data.error || 'No se pudo completar.');
  return data;
}

const say = (node, text, kind = '') => {
  node.textContent = text;
  node.dataset.kind = kind;
};
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// ── Entrada ──
const login = views.login;
const loginMsg = document.querySelector('[data-login-msg]');
login.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  say(loginMsg, 'Comprobando…');
  try {
    await api('/login', { method: 'POST', body: { password: login.elements.password.value } });
    say(loginMsg, '');
    await openPanel();
  } catch (err) {
    say(loginMsg, err.message, 'error');
  } finally {
    login.elements.password.value = '';
    button.disabled = false;
  }
});
logout.addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  show('login');
});

// ── Pestañas ──
const tabs = [...document.querySelectorAll('[data-tab]')];
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      document.querySelector(`[data-pane="${other.dataset.tab}"]`).hidden = !on;
    }
  });
}

// ── Novedades ──
const entriesBox = document.querySelector('[data-entries]');
const saveButton = document.querySelector('[data-save]');
const saveMsg = document.querySelector('[data-save-msg]');
let entries = [];
let dirty = false;

const touch = () => {
  dirty = true;
  saveButton.disabled = false;
  say(saveMsg, 'Hay cambios sin guardar.');
};
addEventListener('beforeunload', (event) => {
  if (dirty || dlDirty) event.preventDefault();
});

function drawEntries() {
  if (!entries.length) {
    entriesBox.replaceChildren(el('p', { className: 'adm-empty', textContent: 'No hay novedades. Añade la primera versión.' }));
    return;
  }
  entriesBox.replaceChildren(...entries.map((entry, i) => {
    const field = (label, input) => el('label', { className: 'adm-field' }, el('span', { textContent: label }), input);
    const bind = (input, key, read = (v) => v) => {
      input.addEventListener('input', () => {
        entry[key] = read(input.type === 'checkbox' ? input.checked : input.value);
        if (key === 'published') card.classList.toggle('is-draft', !entry.published);
        touch();
      });
      return input;
    };
    const move = (step) => {
      entries.splice(i + step, 0, entries.splice(i, 1)[0]);
      touch();
      drawEntries();
    };
    const card = el('article', { className: `adm-entry${entry.published ? '' : ' is-draft'}` },
      el('div', { className: 'adm-row' },
        field('Título', bind(el('input', { type: 'text', value: entry.title, maxLength: 80, placeholder: 'Versión 1.2' }), 'title')),
        field('Fecha', bind(el('input', { type: 'date', value: entry.date || '' }), 'date')),
        field('Etiqueta (opcional)', bind(el('input', { type: 'text', value: entry.tag || '', maxLength: 40, placeholder: 'En prueba interna' }), 'tag')),
      ),
      field('Cambios, uno por línea', bind(el('textarea', { value: entry.items.join('\n') }), 'items', (v) => v.split('\n').map((line) => line.trim()).filter(Boolean))),
      el('div', { className: 'adm-entry-foot' },
        el('label', { className: 'adm-check' }, bind(el('input', { type: 'checkbox', checked: entry.published }), 'published'), 'Publicada'),
        el('div', { className: 'adm-tools' },
          el('button', { type: 'button', textContent: 'Subir', disabled: i === 0, onclick: () => move(-1) }),
          el('button', { type: 'button', textContent: 'Bajar', disabled: i === entries.length - 1, onclick: () => move(1) }),
          el('button', {
            type: 'button',
            className: 'danger',
            textContent: 'Eliminar',
            onclick: () => {
              if (!confirm(`¿Eliminar «${entry.title || 'esta versión'}»? Se borra al guardar.`)) return;
              entries.splice(i, 1);
              touch();
              drawEntries();
            },
          }),
        ),
      ),
    );
    return card;
  }));
}

document.querySelector('[data-add]').addEventListener('click', () => {
  entries.unshift({ id: '', title: '', date: new Date().toLocaleDateString('en-CA'), tag: '', published: false, items: [] });
  touch();
  drawEntries();
  entriesBox.querySelector('input').focus();
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  say(saveMsg, 'Guardando…');
  try {
    entries = (await api('/changelog', { method: 'PUT', body: { entries } })).entries;
    dirty = false;
    say(saveMsg, 'Guardado.', 'ok');
    drawEntries();
  } catch (err) {
    saveButton.disabled = false;
    say(saveMsg, err.message, 'error');
  }
});

// ── Reseñas ──
const reviewsBox = document.querySelector('[data-reviews]');
const reviewMsg = document.querySelector('[data-review-msg]');
const pendingBadge = document.querySelector('[data-pending]');
const filters = [...document.querySelectorAll('[data-filter]')];
const EMPTY = { pending: 'No hay reseñas por revisar.', approved: 'Todavía no has aprobado ninguna.', rejected: 'No hay reseñas rechazadas.' };
let reviews = [];
let filter = 'pending';

for (const button of filters) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    for (const other of filters) other.setAttribute('aria-pressed', String(other === button));
    drawReviews();
  });
}

function drawReviews() {
  for (const status of ['pending', 'approved', 'rejected']) {
    document.querySelector(`[data-count="${status}"]`).textContent = reviews.filter((r) => r.status === status).length;
  }
  const pending = reviews.filter((r) => r.status === 'pending').length;
  pendingBadge.textContent = pending;
  pendingBadge.hidden = pending === 0;

  const shown = reviews.filter((r) => r.status === filter);
  if (!shown.length) {
    reviewsBox.replaceChildren(el('p', { className: 'adm-empty', textContent: EMPTY[filter] }));
    return;
  }
  const date = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
  reviewsBox.replaceChildren(...shown.map((review) => {
    // Una acción cada vez: dos seguidas podrían dejar la lista pública a medias.
    const act = async (run) => {
      reviewsBox.inert = true;
      say(reviewMsg, 'Guardando…');
      try {
        await run();
        say(reviewMsg, '');
        drawReviews();
      } catch (err) {
        say(reviewMsg, err.message, 'error');
      } finally {
        reviewsBox.inert = false;
      }
    };
    const setStatus = (status) => act(async () => {
      await api(`/reviews/${review.id}`, { method: 'POST', body: { status } });
      review.status = status;
    });
    const tools = el('div', { className: 'adm-tools' });
    if (review.status !== 'approved') tools.append(el('button', { type: 'button', textContent: 'Aprobar', onclick: () => setStatus('approved') }));
    if (review.status !== 'rejected') tools.append(el('button', { type: 'button', textContent: 'Rechazar', onclick: () => setStatus('rejected') }));
    tools.append(el('button', {
      type: 'button',
      className: 'danger',
      textContent: 'Eliminar',
      onclick: () => {
        if (!confirm(`¿Eliminar para siempre la reseña de ${review.name}?`)) return;
        act(async () => {
          await api(`/reviews/${review.id}`, { method: 'DELETE' });
          reviews = reviews.filter((r) => r !== review);
        });
      },
    }));
    return el('article', { className: 'adm-review' },
      el('header', {},
        el('b', { textContent: review.name }),
        el('span', { className: 'rate', textContent: '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating), title: `${review.rating} de 5` }),
        el('time', { textContent: date.format(new Date(review.createdAt)) }),
      ),
      el('p', { textContent: review.text }),
      tools,
    );
  }));
}

// ── Botón de descarga ──
const dlBox = document.querySelector('[data-dl]');
const dlSave = document.querySelector('[data-dl-save]');
const dlMsg = document.querySelector('[data-dl-msg]');
const MODES = [
  ['soon', 'Próximamente', 'La app aún no se puede instalar. Los botones de arriba y de la barra llevan a la sección de descarga, y el del cierre pide acceso a la prueba (por correo, o con el enlace de abajo si lo pones).'],
  ['test', 'Prueba abierta', 'Cualquiera puede unirse a la prueba. Todos los botones llevan al enlace para unirse.'],
  ['play', 'En Google Play', 'La app está publicada. Todos los botones llevan a su ficha de Google Play.'],
];
let download = null;
let dlDirty = false;

const dlTouch = () => {
  dlDirty = true;
  dlSave.disabled = false;
  say(dlMsg, 'Hay cambios sin guardar.');
};

function drawDownload() {
  const field = (label, input, hint) => el('label', { className: 'adm-field' }, el('span', { textContent: label }), input, hint ? el('small', { className: 'adm-hint', textContent: hint }) : '');
  const text = (key, max) => {
    const input = el('input', { type: 'text', value: download[key] || '', maxLength: max, placeholder: DOWNLOAD_TEXTS[download.mode][key] });
    input.addEventListener('input', () => {
      download[key] = input.value;
      dlTouch();
      drawPreview();
    });
    return input;
  };
  const url = (key, placeholder) => {
    const input = el('input', { type: 'text', inputMode: 'url', value: download[key] || '', maxLength: 500, placeholder });
    input.addEventListener('input', () => {
      download[key] = input.value.trim();
      dlTouch();
      drawPreview();
    });
    return input;
  };
  const modes = el('div', { className: 'adm-filter adm-dl-modes', role: 'group', ariaLabel: 'En qué punto está la app' },
    ...MODES.map(([key, label]) => el('button', {
      type: 'button',
      textContent: label,
      onclick: () => {
        if (download.mode === key) return;
        download.mode = key;
        dlTouch();
        drawDownload();
      },
    })));
  for (const [i, b] of [...modes.children].entries()) b.setAttribute('aria-pressed', String(MODES[i][0] === download.mode));
  const preview = el('div', { className: 'adm-dl-preview', ariaLive: 'polite' });
  const drawPreview = () => {
    const { note, buttons } = resolveDownload(download);
    const where = (href) => (href ? href.replace(/^mailto:([^?]+).*/, 'Correo a $1') : 'Baja a la sección de descarga');
    const pill = (role, title) => el('div', { className: 'adm-dl-item' },
      el('small', { textContent: title }),
      el('span', { className: `adm-dl-pill is-${role}`, textContent: buttons[role].label }),
      el('code', { textContent: where(buttons[role].href) }),
    );
    preview.replaceChildren(
      el('p', { className: 'adm-dl-label', textContent: 'Así se ve' }),
      pill('hero', 'Arriba, en la portada de la app'),
      pill('bar', 'En la barra'),
      pill('final', 'En el cierre'),
      el('p', { className: 'adm-dl-note', textContent: note }),
    );
  };
  drawPreview();
  dlBox.replaceChildren(
    el('section', { className: 'adm-entry' },
      el('div', { className: 'adm-field' }, el('span', { textContent: 'En qué punto está la app' }), modes),
      el('p', { className: 'adm-hint', textContent: MODES.find(([k]) => k === download.mode)[2] }),
      field('Enlace de Google Play', url('playUrl', 'https://play.google.com/store/apps/details?id=…'), download.mode === 'play' ? 'Hace falta para «En Google Play».' : 'Déjalo listo para cuando se publique.'),
      field('Enlace para pedir acceso o unirse a la prueba', url('testUrl', 'https://… o mailto:…'), download.mode === 'test' ? 'Hace falta para «Prueba abierta».' : 'Opcional. Sin él, el botón del cierre abre un correo a soporte.'),
    ),
    el('section', { className: 'adm-entry' },
      el('p', { className: 'adm-hint', textContent: 'Vacíos, los botones dicen lo de cada estado (el texto gris).' }),
      el('div', { className: 'adm-row is-two' },
        field('Botón principal', text('hero', 48)),
        field('Botón de la barra', text('bar', 24)),
      ),
      field('Botón del cierre', text('final', 48)),
      field('Nota del cierre', text('note', 160)),
    ),
    preview,
  );
}

dlSave.addEventListener('click', async () => {
  dlSave.disabled = true;
  say(dlMsg, 'Guardando…');
  try {
    download = await api('/download', { method: 'PUT', body: download });
    dlDirty = false;
    say(dlMsg, 'Guardado. La página lo enseña en un minuto como mucho.', 'ok');
    drawDownload();
  } catch (err) {
    dlSave.disabled = false;
    say(dlMsg, err.message, 'error');
  }
});

// ── Arranque ──
// El panel solo se enseña con los datos cargados: un panel vacío por un fallo de red
// invitaría a guardar encima de todas las novedades.
async function openPanel() {
  loadingNote.textContent = 'Cargando…';
  show('loading');
  let log;
  let revs;
  let dl;
  try {
    [log, revs, dl] = await Promise.all([api('/changelog'), api('/reviews'), api('/download')]);
  } catch (err) {
    if (views.loading.hidden) return; // la sesión caducó: ya se está pidiendo la contraseña
    loadingNote.textContent = `No se pudieron cargar los datos (${err.message}). Recarga la página.`;
    return;
  }
  // Si la sesión caducó a mitad de una edición, lo escrito sigue ahí al volver a entrar.
  if (!dirty) {
    entries = log.entries;
    saveButton.disabled = true;
    say(saveMsg, '');
  }
  reviews = revs.reviews;
  if (!dlDirty) {
    download = dl;
    dlSave.disabled = true;
    say(dlMsg, '');
  }
  drawEntries();
  drawReviews();
  drawDownload();
  show('panel');
}

try {
  const session = await api('/session');
  if (!session.configured || !session.storage) {
    document.querySelector('[data-setup-why]').textContent = session.configured
      ? 'La contraseña está puesta, pero el almacén de datos todavía no está enlazado. Suele resolverse solo en el siguiente despliegue.'
      : 'El panel todavía no tiene contraseña. Solo tú puedes ponerla:';
    views.setup.querySelector('ol').hidden = session.configured;
    show('setup');
  } else if (session.authed) {
    await openPanel();
  } else {
    show('login');
  }
} catch {
  loadingNote.textContent = 'No se pudo conectar con el servidor. Recarga la página.';
  show('loading');
}
