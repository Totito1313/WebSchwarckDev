// Instalar una app web (Negocio en Windows o macOS desde Edge o Chrome; el portal en
// el teléfono): el navegador avisa con «beforeinstallprompt» cuando se puede, y aquí
// se guarda ese aviso para enseñar un botón «Instalar» en el momento justo.
// Se importa al arrancar cada app (main.jsx): el aviso llega pronto y no se repite.
import { useEffect, useReducer } from 'react';

let deferred = null;
// Instalada en esta visita (la pestaña sigue abierta en el navegador, no como app).
let done = false;
const listeners = new Set();
const ping = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    ping();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    done = true;
    ping();
  });
}

/** Ya abierta como app (ventana propia, sin barra del navegador). */
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
/** iPhone y iPad no avisan: se instala desde «Compartir › Añadir a pantalla de inicio». */
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstall() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => listeners.delete(force);
  }, []);
  return {
    canInstall: Boolean(deferred) && !isInstalled(),
    installed: isInstalled(),
    done,
    async install() {
      if (!deferred) return false;
      const prompt = deferred;
      deferred = null;
      prompt.prompt();
      const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (outcome === 'accepted') done = true;
      ping();
      return outcome === 'accepted';
    },
  };
}

/** El service worker de cada app, solo en la versión publicada (en desarrollo, Vite no lo necesita). */
export function registerWorker(url, scope) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  addEventListener('load', () => navigator.serviceWorker.register(url, { scope }).catch(() => {}));
}
