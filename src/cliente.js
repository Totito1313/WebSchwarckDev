// App del portal (/cliente/): la misma para el cliente y para el estudio.
//
// El cliente ve su proyecto: Inicio, Cronología (con el reporte diario), Marketing
// (calendario, rendimiento y leads), Recursos y Peticiones, más su Perfil. El estudio
// entra con su cuenta y ve el portal de cada cliente con todo editable, lo que le
// envían y sus herramientas (modo estudio), en el teléfono o en el ordenador.
//
// Barra de arriba al estilo iOS: el título grande de cada pantalla se recoge en uno
// pequeño centrado al bajar, sobre un cristal que se vuelve opaco. La de abajo es la
// cápsula de CeroFiao. Cada toque responde con vibración y, si se quiere, sonido.

import { initTheme } from './theme.js';
import { createBackend } from './portal/data.js';
import { el, fill, icon, toast, still, sheet, emptyBox, avatar, initials, plural } from './portal/kit.js';
import { installTouchFeedback, react } from './portal/feel.js';
import { app, setRedraw, unread, pendingTasks, collectPaths, signPaths, urlOf } from './portal/state.js';
import { homePage, timelinePage, resourcesPage, requestsPage, sendSheet, feedItem } from './portal/screens.js';
import { marketingPage } from './portal/marketing.js';
import { profilePage, ensurePush, notificationOnboarding, notificationsCard } from './portal/profile.js';
import { openThread } from './portal/threads.js';
import * as studio from './portal/studio.js';

initTheme();
installTouchFeedback();
for (const slot of document.querySelectorAll('[data-icon]')) slot.append(icon(slot.dataset.icon));

const views = Object.fromEntries([...document.querySelectorAll('[data-view]')].map((v) => [v.dataset.view, v]));
const main = document.querySelector('[data-main]');
const nav = document.querySelector('[data-nav]');
const navTitle = document.querySelector('[data-nav-title]');
const tabsNav = document.querySelector('.cl-tabs');
const thumb = tabsNav.querySelector('.cl-tabs-thumb');
const fab = document.querySelector('[data-fab]');
const show = (name) => {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
};
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

// ── Rutas ──

const TABS = ['inicio', 'cronologia', 'marketing', 'recursos', 'peticiones'];
let lastTab = null;
let lastRoute = '';

function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [section = '', a, b, c] = path.split('/');
  switch (section) {
    case 'cronologia': return { tab: 'cronologia', build: () => timelinePage(a === 'reportes' ? 'reportes' : query || 'todo') };
    case 'marketing': return { tab: 'marketing', build: () => marketingPage(a, b, c) };
    case 'calendario': return { tab: 'marketing', build: () => marketingPage('calendario', a, b) };
    case 'recursos': return { tab: 'recursos', build: resourcesPage };
    case 'peticiones':
    case 'tareas': return { tab: 'peticiones', build: () => requestsPage(a) };
    case 'perfil': return { tab: 'perfil', build: profilePage };
    case 'hilo': return { overlay: () => openThread(a, b) };
    case 'enviar': return { overlay: () => (app.studio ? studio.createMenu() : sendSheet()) };
    case 'importar': return { overlay: () => app.studio && studio.importFromNegocio() };
    default: return { tab: 'inicio', build: homePage };
  }
}

function render({ keepScroll = false } = {}) {
  if (!app.data) return;
  const r = route();
  if (r.overlay) {
    // Las hojas (un hilo, enviar…) se abren sobre la pestaña en la que se estaba.
    history.replaceState(null, '', lastRoute || '#/');
    if (!main.querySelector('[data-large]')) render();
    setTimeout(r.overlay, 30);
    return;
  }
  lastRoute = location.hash || '#/';
  const changed = r.tab !== lastTab;
  const dir = TABS.indexOf(r.tab) - TABS.indexOf(lastTab);
  lastTab = r.tab;
  const y = scrollY;
  let page;
  try {
    page = r.build();
  } catch (err) {
    console.error(err);
    page = { node: emptyBox('alert', 'No se pudo abrir esto', 'Vuelve a intentarlo en un momento.'), title: 'Portal', large: 'Ups' };
  }
  const node = el('div', { class: `cl-page${changed && !still.matches ? (dir < 0 ? ' cl-enter-r' : ' cl-enter') : ''}` },
    el('header', { class: 'cl-large', 'data-large': '' }, el('h1', { text: page.large || page.title }), page.sub && el('p', { text: page.sub })),
    page.node,
  );
  fill(main, node);
  navTitle.textContent = page.title || '';
  document.title = `${app.studio ? 'Estudio · ' : ''}${page.title || 'Portal'} | ${app.client.name}`;
  for (const a of tabsNav.querySelectorAll('[data-tab]')) {
    if (a.dataset.tab === r.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  placeThumb(changed);
  fab.hidden = r.tab === 'perfil';
  if (keepScroll) scrollTo(0, y);
  else if (changed) scrollTo({ top: 0 });
  onScroll();
}
setRedraw(() => {
  syncChrome();
  render({ keepScroll: true });
});
addEventListener('hashchange', () => {
  const r = route();
  if (r.tab && r.tab !== lastTab) react('tab');
  render();
});

function placeThumb(animate = true) {
  const on = tabsNav.querySelector('[aria-current="page"]');
  if (!on) {
    thumb.style.opacity = '0';
    return;
  }
  if (!animate || still.matches) thumb.style.transition = 'none';
  thumb.style.width = `${on.offsetWidth}px`;
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
  thumb.style.opacity = '1';
  if (thumb.style.transition === 'none') {
    thumb.getBoundingClientRect();
    thumb.style.transition = '';
  }
}
addEventListener('resize', () => placeThumb(false));

// ── Barra de arriba: el título grande se recoge al bajar ──

let ticking = false;
let lastY = 0;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
    const large = main.querySelector('[data-large]');
    const h = large ? large.offsetHeight : 60;
    const k = Math.min(1, Math.max(0, y / Math.max(30, h - 10)));
    nav.style.setProperty('--k', k.toFixed(3));
    nav.classList.toggle('is-collapsed', k >= 1);
    nav.classList.toggle('is-scrolled', y > 2);
    if (large) {
      // Tirar hacia abajo agranda el título, como en iOS; al subir, se desvanece.
      const scale = y < 0 ? 1 + Math.min(0.12, -y / 600) : 1;
      large.style.transform = `scale(${scale})`;
      large.style.opacity = String(1 - k * 0.9);
    }
    fab.classList.toggle('is-small', y > lastY && y > 120);
    lastY = y;
  });
}
addEventListener('scroll', onScroll, { passive: true });

// ── Cabecera, avisos sin leer y botón flotante ──

function syncChrome() {
  const c = app.client;
  views.app.style.setProperty('--accent', c.accent || '#00b8d4');
  views.app.classList.toggle('is-studio', app.studio);
  const logo = document.querySelector('[data-logo]');
  const src = urlOf(c.logo_url);
  fill(logo, src ? el('img', { src, alt: '' }) : initials(c.name));
  const me = document.querySelector('[data-me-avatar]');
  fill(me, app.studio ? el('span', { class: 'cl-avatar sm is-studio' }, el('img', { src: '/favicon.svg', alt: '' })) : avatar(app.member?.name || app.user?.email, urlOf(app.member?.avatar_path), 'sm'));
  const n = unread().length;
  const dot = document.querySelector('[data-unread]');
  const was = Number(dot.dataset.n || 0);
  dot.hidden = n === 0;
  dot.dataset.n = String(n);
  dot.textContent = n > 9 ? '9+' : String(n || '');
  if (n > was && was !== 0) document.querySelector('[data-bell]').classList.add('is-ring');
  const pending = app.studio ? app.data.tasks.filter((t) => t.status === 'submitted').length : pendingTasks().length;
  const count = document.querySelector('[data-pending]');
  count.hidden = pending === 0;
  count.textContent = String(pending);
  fill(fab, icon(app.studio ? 'plus' : 'send'), el('span', { class: 'cl-fab-text', text: app.studio ? 'Crear' : 'Enviar' }));
  fab.setAttribute('aria-label', app.studio ? 'Crear' : 'Enviar algo a Schwarck');
  const others = app.studio ? app.portals.filter((p) => p.client.id !== c.id).reduce((s, p) => s + (p.alerts || 0), 0) : 0;
  const lead = document.querySelector('[data-switch]');
  lead.dataset.others = others ? String(others) : '';
  lead.setAttribute('aria-label', app.studio || app.portals.length > 1 ? 'Cambiar de cliente' : 'Perfil');
  if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
}
document.querySelector('[data-bell]').addEventListener('animationend', (e) => e.currentTarget.classList.remove('is-ring'));
document.querySelector('[data-bell]').addEventListener('click', () => (app.studio ? studio.inboxSheet() : bellSheet()));
fab.addEventListener('click', () => (app.studio ? studio.createMenu() : sendSheet()));
document.querySelector('[data-switch]').addEventListener('click', () => (app.studio || app.portals.length > 1 ? switchPortal() : (location.hash = '#/perfil')));
document.addEventListener('portal:switch', () => switchPortal());

function switchPortal() {
  studio.portalSwitcher((p) => {
    remember('portal:client', p.client.id);
    openPortal(p);
  });
}

function bellSheet() {
  const items = unread();
  let ui;
  const list = items.length
    ? el('div', { class: 'cl-card cl-mini-feed' }, items.slice(0, 40).map((x) => feedItem(x, { compact: true })))
    : emptyBox('bell', 'Estás al día', 'Te avisaremos aquí de cada novedad.');
  ui = sheet('Novedades', el('div', { class: 'cl-stack' }, notificationsCard(), list), {
    subtitle: items.length ? plural(items.length, 'cosa nueva', 'cosas nuevas') : null,
    actions: items.length ? [el('button', { type: 'button', class: 'cl-btn', onclick: async () => { await markSeen(); react('success'); ui.close(); } }, icon('check'), 'Marcar como visto')] : null,
  });
  ui.dlg.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="#/"]')) ui.close();
  });
}

async function markSeen() {
  app.member.last_seen_at = new Date().toISOString();
  await app.backend.markSeen(app.client.id).catch(() => {});
  navigator.clearAppBadge?.().catch(() => {});
  syncChrome();
  render({ keepScroll: true });
}

// ── Datos y tiempo real ──

async function loadData() {
  const data = await app.backend.load(app.client.id);
  app.data = data;
  app.client = { ...app.client, ...data.client };
  if (!app.studio) app.member = { ...app.member, ...(data.members.find((m) => m.user_id === app.user.id) || {}) };
  await signPaths(collectPaths(data));
}

let reloadTimer = 0;
function scheduleReload(announce) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    const before = unread().length;
    try {
      await loadData();
    } catch {
      return;
    }
    syncChrome();
    // Con una hoja abierta no se repinta la pantalla de debajo (se perdería lo escrito).
    if (!document.querySelector('dialog[open]')) render({ keepScroll: true });
    if (announce && unread().length > before) {
      react('notify');
      toast(app.studio ? 'Hay algo nuevo del cliente.' : 'Hay novedades en tu proyecto.', 'ok');
    }
  }, 450);
}

async function refreshPortals() {
  try {
    app.portals = await app.backend.portals(app.user);
    syncChrome();
  } catch {
    // se reintenta en el próximo cambio
  }
}

async function openPortal(p) {
  app.unwatch?.();
  app.client = p.client;
  app.member = p.member;
  if (!views.app.hidden) fill(main, el('div', { class: 'cl-page' }, el('div', { class: 'cl-skel-page' }, Array.from({ length: 4 }, (_, i) => el('i', { style: { '--i': i } })))));
  try {
    await loadData();
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  app.unwatch = app.backend.watch(app.client.id, (table, payload) => {
    if (table === 'any') {
      if (payload?.new?.client_id !== app.client.id) {
        refreshPortals();
        react('notify');
        toast('Otro cliente te envió algo.', 'ok');
      }
      return;
    }
    scheduleReload(true);
  }, { studio: app.studio });
  show('app');
  syncChrome();
  lastTab = null;
  render();
  ensurePush();
  setTimeout(notificationOnboarding, 1400);
}

// ── Entrar ──

async function boot() {
  try {
    app.backend = await createBackend();
  } catch (err) {
    console.error(err);
    showLogin('No se pudo cargar la app. Revisa tu conexión y recarga.');
    return;
  }
  if (app.backend.mode === 'demo') document.body.classList.add('is-demo');
  app.user = await app.backend.user();
  if (!app.user) {
    show('login');
    return;
  }
  app.studio = app.backend.isAdmin(app.user);
  try {
    app.portals = await app.backend.portals(app.user);
  } catch (err) {
    showLogin(err.message);
    return;
  }
  if (!app.portals.length) {
    if (app.studio) return firstPortal();
    showLogin('Tu cuenta todavía no tiene un proyecto asignado. Escríbele a Schwarck.');
    await app.backend.signOut();
    return;
  }
  const params = new URLSearchParams(location.search);
  const wanted = params.get('p') || remember('portal:client');
  const pick = app.portals.find((x) => x.client.id === wanted) || app.portals.find((x) => !x.client.archived) || app.portals[0];
  remember('portal:client', pick.client.id);
  if (params.has('p')) {
    params.delete('p');
    history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }
  await openPortal(pick);
}

/** Primera vez del estudio, sin portales todavía. */
function firstPortal() {
  show('setup');
  const card = views.setup.querySelector('.cl-gate-card');
  fill(card,
    el('img', { src: '/favicon.svg', alt: '', width: 44, height: 44 }),
    el('h1', { text: 'Tu primer portal' }),
    el('p', { text: 'Crea el portal de un cliente: le das acceso con su correo y lo instala en su teléfono.' }),
    el('button', { type: 'button', class: 'cl-btn lg', onclick: () => studio.editPortal(null, (p) => openPortal(p)) }, icon('plus'), 'Crear portal'),
  );
}

function showLogin(text) {
  show('login');
  const msg = document.querySelector('[data-login-msg]');
  msg.textContent = text;
  msg.dataset.kind = 'error';
}

const loginForm = document.querySelector('[data-login]');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector('button[type="submit"]');
  const msg = loginForm.querySelector('[data-login-msg]');
  btn.disabled = true;
  btn.classList.add('is-busy');
  msg.textContent = '';
  try {
    await app.backend.signIn(loginForm.elements.email.value.trim(), loginForm.elements.password.value);
    loginForm.elements.password.value = '';
    react('success');
    show('loading');
    await boot();
  } catch (err) {
    msg.textContent = err.message;
    msg.dataset.kind = 'error';
    react('error');
    loginForm.classList.remove('is-shake');
    void loginForm.offsetWidth;
    loginForm.classList.add('is-shake');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-busy');
  }
});
loginForm.querySelector('[data-reveal]')?.addEventListener('click', (e) => {
  const input = loginForm.elements.password;
  input.type = input.type === 'password' ? 'text' : 'password';
  fill(e.currentTarget, icon(input.type === 'password' ? 'eye' : 'lock'));
});

// Instalada y avisos
addEventListener('appinstalled', () => {
  react('success');
  toast('¡Instalada! Ábrela desde tu pantalla de inicio.', 'ok');
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/cliente/sw.js', { scope: '/cliente/' }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'push' && app.data) {
      react('notify');
      scheduleReload(false);
      if (app.studio) refreshPortals();
    }
  });
}
// Al volver a la app, lo último (por si el tiempo real se durmió con el teléfono bloqueado).
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  navigator.clearAppBadge?.().catch(() => {});
  if (app.data && Date.now() - hiddenAt > 45_000) {
    scheduleReload(true);
    if (app.studio) refreshPortals();
  }
});

boot().catch((err) => {
  console.error(err);
  showLogin('No se pudo abrir. Revisa tu conexión y vuelve a intentarlo.');
});
