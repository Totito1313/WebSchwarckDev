// Negocio instalado (en Windows desde Edge o Chrome, o en el teléfono): abre al momento
// y, sin conexión, enseña la última versión guardada (los datos siempre vienen de la API).
//
// · Navegar a /admin/negocio/: primero la red (siempre lo último) y, sin conexión, la copia.
// · /assets/* (con huella en el nombre) y los iconos: de la caché, para siempre.
// · /api/ nunca se guarda: los datos y la sesión los lleva el Worker.

const VERSION = 'negocio-v1';
const SHELL = ['/admin/negocio/', '/admin/negocio/manifest.webmanifest', '/cliente/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('negocio-') && key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin/negocio/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(VERSION)).put('/admin/negocio/', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('/admin/negocio/')) || Response.error();
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
