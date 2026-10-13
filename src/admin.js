// Panel: novedades de CeroFiao y moderación de reseñas.
// Habla con /api/admin/*; la sesión va en una cookie que el navegador no deja leer a este código.

import { initTheme } from './theme.js';

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
  if (dirty) event.preventDefault();
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

// ── Arranque ──
// El panel solo se enseña con los datos cargados: un panel vacío por un fallo de red
// invitaría a guardar encima de todas las novedades.
async function openPanel() {
  loadingNote.textContent = 'Cargando…';
  show('loading');
  let log;
  let revs;
  try {
    [log, revs] = await Promise.all([api('/changelog'), api('/reviews')]);
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
  drawEntries();
  drawReviews();
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
