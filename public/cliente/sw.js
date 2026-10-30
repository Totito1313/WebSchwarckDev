// La app del cliente: abre sin conexión y recibe los avisos push.
//
// · Navegar a /cliente/: primero la red (para ver siempre lo último) y, sin
//   conexión, la última copia guardada.
// · /assets/* (con huella en el nombre) y los iconos: de la caché, para siempre.
// · Supabase y /api/: nunca se guardan; los datos los pide la app.

const VERSION = 'cliente-v2';
const SHELL = ['/cliente/', '/cliente/manifest.webmanifest', '/cliente/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/cliente/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(VERSION)).put('/cliente/', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('/cliente/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/cliente/icon') || url.pathname === '/favicon.svg') {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
      return res;
    })());
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'Novedades de tu proyecto';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/cliente/icon-192.png',
      badge: '/cliente/icon-192.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/cliente/' },
    });
    // Si la app está abierta, se entera y vuelve a leer.
    for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'push', data });
    if (navigator.setAppBadge) navigator.setAppBadge().catch(() => {});
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/cliente/', location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((w) => new URL(w.url).pathname === new URL(target).pathname);
    if (same) {
      await same.focus();
      if (same.url !== target) same.navigate(target).catch(() => {});
      return;
    }
    await self.clients.openWindow(target);
  })());
});
