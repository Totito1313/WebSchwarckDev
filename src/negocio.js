// Negocio: clientes, catálogo, facturas, cotizaciones y recibos, dentro del panel.
// Usa la misma sesión que el resto del panel (/api/admin/*) y la estética de CeroFiao.

import { initTheme } from './theme.js';
import { api, loadAll, bus, hasUnsaved, flushNow, find, el, icon, menu, toast } from './negocio-core.js';
import { docsPage, customersPage, customerPage, catalogPage, settingsPage, createDoc, customerForm, catalogForm, go } from './negocio-views.js';
import { docEditor } from './negocio-doc.js';

initTheme();

const views = Object.fromEntries([...document.querySelectorAll('[data-view]')].map((v) => [v.dataset.view, v]));
const rail = document.querySelector('[data-rail]');
const loadingNote = views.loading.querySelector('p');
for (const slot of document.querySelectorAll('[data-icon]')) slot.append(icon(slot.dataset.icon));

let opened = false;
const show = (name) => {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  rail.hidden = name !== 'app';
  document.body.classList.toggle('is-app', name === 'app');
};

// ── Entrada ──
const login = views.login.querySelector('form');
const loginMsg = login.querySelector('[data-login-msg]');
const say = (text, kind = '') => {
  loginMsg.textContent = text;
  loginMsg.dataset.kind = kind;
};
login.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  say('Comprobando…');
  try {
    await api('/login', { method: 'POST', body: { password: login.elements.password.value } });
    say('');
    if (opened) {
      // La sesión caducó a mitad de trabajo: lo que quedó en la fila se guarda ahora.
      show('app');
      flushNow().catch(() => {});
    } else {
      await openApp();
    }
  } catch (err) {
    say(err.message, 'error');
  } finally {
    login.elements.password.value = '';
    button.disabled = false;
  }
});
document.querySelector('[data-logout]').addEventListener('click', async () => {
  if (hasUnsaved() && !confirm('Hay cambios guardándose. ¿Salir igualmente?')) return;
  await api('/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

// ── Crear desde el riel ──
const newButton = document.querySelector('[data-new]');
newButton.addEventListener('click', () => menu(newButton, [
  { label: 'Nueva factura', icon: 'file', run: () => createDoc('invoice') },
  { label: 'Nueva cotización', icon: 'quote', run: () => createDoc('quote') },
  '-',
  { label: 'Nuevo cliente', icon: 'users', run: () => customerForm(null, (c) => go(`#/clientes/${c.id}`)) },
  { label: 'Nuevo servicio', icon: 'box', run: () => catalogForm(null, () => go('#/catalogo')) },
], { side: matchMedia('(max-width: 760px)').matches ? 'below' : 'right' }));

// ── Rutas ──
const TITLES = { facturas: 'Facturas', cotizaciones: 'Cotizaciones', clientes: 'Clientes', catalogo: 'Catálogo', ajustes: 'Ajustes' };
let current = null;
let lastList = '#/facturas';

function resolve() {
  const [section = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  switch (section) {
    case 'cotizaciones': return { nav: 'cotizaciones', build: () => docsPage('quote') };
    case 'clientes': return { nav: 'clientes', build: () => (id ? customerPage(id) : customersPage()) };
    case 'catalogo': return { nav: 'catalogo', build: catalogPage };
    case 'ajustes': return { nav: 'ajustes', build: settingsPage };
    case 'doc': {
      const doc = find('docs', id);
      return { nav: doc?.type === 'quote' ? 'cotizaciones' : 'facturas', editor: true, build: () => docEditor(id, { backTo: lastList }) };
    }
    default: return { nav: 'facturas', build: () => docsPage('invoice') };
  }
}

function render() {
  current?.destroy?.();
  const route = resolve();
  if (!route.editor) lastList = location.hash || '#/facturas';
  current = route.build();
  current.editor = route.editor;
  views.app.replaceChildren(current.node);
  document.body.classList.toggle('is-editor', Boolean(route.editor));
  for (const link of rail.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === route.nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (!route.editor) {
    const page = location.hash.replace(/^#\/?/, '').split('/')[0] || 'facturas';
    document.title = `${TITLES[page] || 'Negocio'} | Negocio`;
  }
  scrollTo(0, 0);
}
addEventListener('hashchange', render);

// Los listados se repintan cuando cambian los datos (un cliente nuevo, una factura borrada…).
let refreshQueued = false;
bus.addEventListener('change', () => {
  if (!current || current.editor || refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    if (!current.editor) current.refresh?.();
  });
});
bus.addEventListener('status', (e) => {
  if (e.detail.status === 'error' && !current?.editor) toast(`No se guardó: ${e.detail.message}`, 'error');
});
bus.addEventListener('auth', () => {
  say('Tu sesión caducó. Entra de nuevo y se guarda lo pendiente.');
  show('login');
});
addEventListener('beforeunload', (event) => {
  if (hasUnsaved()) event.preventDefault();
});

// ── Arranque ──
// Solo se enseña con los datos cargados: una lista vacía por un fallo de red
// haría pensar que no hay nada.
async function openApp() {
  loadingNote.textContent = 'Cargando…';
  show('loading');
  try {
    await loadAll();
  } catch (err) {
    if (err.status === 401) {
      show('login');
      return;
    }
    loadingNote.textContent = `No se pudieron cargar los datos (${err.message}). Recarga la página.`;
    return;
  }
  opened = true;
  show('app');
  render();
}

try {
  const session = await api('/session');
  if (!session.configured || !session.storage) {
    views.setup.querySelector('[data-setup-why]').textContent = session.configured
      ? 'La contraseña está puesta, pero el almacén de datos todavía no está enlazado. Suele resolverse solo en el siguiente despliegue.'
      : 'El panel todavía no tiene contraseña. Ponla primero en el panel principal.';
    show('setup');
  } else if (session.authed) {
    await openApp();
  } else {
    show('login');
  }
} catch {
  loadingNote.textContent = 'No se pudo conectar con el servidor. Recarga la página.';
  show('loading');
}
