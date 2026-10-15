// Negocio: clientes, catálogo, facturas, cotizaciones y recibos, dentro del panel.
// Usa la misma sesión que el resto del panel (/api/admin/*) y la estética de CeroFiao.

import { initTheme } from './theme.js';
import { api, loadAll, bus, hasUnsaved, flushNow, find, el, icon, menu, toast, refreshPub } from './negocio-core.js';
import { docsPage, customersPage, customerPage, catalogPage, settingsPage, createDoc, customerForm, catalogForm, go } from './negocio-views.js';
import { docEditor } from './negocio-doc.js';
import { expensesPage, expenseForm } from './negocio-gastos.js';
import { homePage } from './negocio-inicio.js';
import { marketingPage } from './negocio-marketing.js';
import { postForm, newPost } from './negocio-contenido.js';
import { projectsPage, projectPage, projectForm } from './negocio-projects.js';
import { tasksPage, createTask, openTaskByKey } from './negocio-tasks.js';
import { hoursPage, mountTimer, timeForm, guessProject } from './negocio-time.js';
import { pagesPage, createPage } from './negocio-paginas.js';
import { leadsPage, createLead } from './negocio-leads.js';
import { ensureKeys } from './negocio-work.js';

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
  { label: 'Nueva propuesta', icon: 'send', run: () => createDoc('proposal') },
  { label: 'Nuevo gasto', icon: 'wallet', run: () => expenseForm(null, () => go('#/gastos')) },
  '-',
  { label: 'Nuevo proyecto', icon: 'folder', run: () => projectForm(null, (p) => go(`#/proyectos/${p.id}`)) },
  { label: 'Nueva tarea', icon: 'tasks', run: () => createTask({ projectId: guessProject({ here: true }) }) },
  { label: 'Nueva página', icon: 'page', run: () => createPage({ projectId: guessProject({ here: true }) || '' }) },
  { label: 'Registrar horas', icon: 'clock', run: () => timeForm(null, { projectId: guessProject() }) },
  '-',
  { label: 'Nuevo lead', icon: 'funnel', run: () => createLead() },
  { label: 'Nuevo cliente', icon: 'users', run: () => customerForm(null, (c) => go(`#/clientes/${c.id}`)) },
  { label: 'Nuevo servicio', icon: 'box', run: () => catalogForm(null, () => go('#/catalogo')) },
  '-',
  { label: 'Nueva publicación', icon: 'megaphone', run: () => postForm(newPost()) },
], { side: matchMedia('(max-width: 760px)').matches ? 'below' : 'right' }));

// ── Rutas ──
const TITLES = { leads: 'Leads', paginas: 'Páginas', propuestas: 'Propuestas', marketing: 'Marketing', proyectos: 'Proyectos', tareas: 'Tareas', horas: 'Horas', inicio: 'Inicio', gastos: 'Gastos', facturas: 'Facturas', cotizaciones: 'Cotizaciones', clientes: 'Clientes', catalogo: 'Catálogo', ajustes: 'Ajustes' };
let current = null;
let lastList = '#/facturas';

function resolve() {
  const [section = '', id, sub] = location.hash.replace(/^#\/?/, '').split('/');
  switch (section) {
    case 'proyectos': return { nav: 'proyectos', build: () => (id ? projectPage(id, sub) : projectsPage()) };
    case 'tareas': return {
      nav: 'tareas',
      build: () => {
        const page = tasksPage();
        // #/tareas/CF-12 abre esa tarea encima del tablero.
        if (id) setTimeout(() => { if (!openTaskByKey(decodeURIComponent(id))) toast(`No hay ninguna tarea ${decodeURIComponent(id)}.`, 'error'); });
        return page;
      },
    };
    case 'paginas': return { nav: 'paginas', build: () => pagesPage(id) };
    case 'leads': return { nav: 'leads', build: () => leadsPage(id) };
    case 'horas': return { nav: 'horas', build: hoursPage };
    case 'facturas': return { nav: 'facturas', build: () => docsPage('invoice') };
    case 'gastos': return { nav: 'gastos', build: expensesPage };
    case 'cotizaciones': return { nav: 'cotizaciones', build: () => docsPage('quote') };
    case 'propuestas': return { nav: 'propuestas', build: () => docsPage('proposal') };
    case 'clientes': return { nav: 'clientes', build: () => (id ? customerPage(id) : customersPage()) };
    case 'catalogo': return { nav: 'catalogo', build: catalogPage };
    case 'marketing': return { nav: 'marketing', build: () => marketingPage(id || 'calendario', sub) };
    case 'ajustes': return { nav: 'ajustes', build: settingsPage };
    case 'doc': {
      const doc = find('docs', id);
      const nav = { quote: 'cotizaciones', proposal: 'propuestas' }[doc?.type] || 'facturas';
      return { nav, editor: true, build: () => docEditor(id, { backTo: lastList }) };
    }
    default: return { nav: 'inicio', build: homePage };
  }
}

const still = matchMedia('(prefers-reduced-motion: reduce)');

/** Cambia de página con una transición suave (o sin ella, si se pidió menos movimiento). */
function render() {
  if (!opened || still.matches || document.hidden || document.querySelector('dialog[open]')) {
    draw();
    return;
  }
  if (document.startViewTransition) {
    // Si el navegador no llega a hacer la transición (pestaña oculta, sin pintar…),
    // la página se pinta igual: nunca se queda en blanco esperándola.
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      draw();
    };
    document.documentElement.classList.add('ng-nav');
    const t = document.startViewTransition(once);
    t.finished.catch(() => {}).finally(() => document.documentElement.classList.remove('ng-nav'));
    t.updateCallbackDone.catch(() => {});
    t.ready.catch(() => {});
    setTimeout(() => {
      if (done) return;
      t.skipTransition();
      once();
    }, 250);
    return;
  }
  draw();
  current?.node.classList.add('ng-enter');
}

function draw() {
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
    const page = location.hash.replace(/^#\/?/, '').split('/')[0] || 'inicio';
    document.title = current.title || `${TITLES[page] || 'Negocio'} | Negocio`;
  }
  scrollTo(0, 0);
}
addEventListener('hashchange', (e) => {
  // El documento vuelve a donde se estaba, con la pestaña tal como quedó (las fichas la cambian sin navegar).
  if (current && !current.editor) lastList = new URL(e.oldURL).hash || '#/facturas';
  render();
});

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
// Al volver a la pestaña se miran los enlaces públicos: quién abrió, firmó o rechazó.
let lastPub = 0;
const checkPub = () => {
  if (!opened || document.hidden || Date.now() - lastPub < 20_000) return;
  lastPub = Date.now();
  refreshPub().catch(() => {});
};
document.addEventListener('visibilitychange', checkPub);
addEventListener('focus', checkPub);

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
  lastPub = Date.now();
  ensureKeys();
  mountTimer(document.querySelector('[data-timer]'));
  show('app');
  draw();
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
