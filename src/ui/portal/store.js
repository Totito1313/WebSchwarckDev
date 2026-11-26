// Portal nuevo · los datos. Son los del portal de siempre: src/portal/data.js habla
// con Supabase (o con la demostración, ?demo) y src/portal/state.js guarda lo que
// se ve y deriva la cronología, lo pendiente y los permisos. Aquí solo se arranca
// todo y se avisa a React para repintar.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createBackend } from '../../portal/data.js';
import { app, collectPaths, signPaths, upsertLocal } from '../../portal/state.js';

let version = 0;
const listeners = new Set();
export const refresh = () => {
  version += 1;
  for (const l of listeners) l();
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** El estado del portal (app) y un número que sube con cada cambio. */
export function usePortal() {
  const v = useSyncExternalStore(subscribe, () => version);
  return [app, v];
}

const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

async function loadData() {
  const data = await app.backend.load(app.client.id);
  app.data = data;
  app.client = { ...app.client, ...data.client };
  if (!app.studio) app.member = { ...app.member, ...(data.members.find((m) => m.user_id === app.user.id) || {}) };
  await signPaths(collectPaths(data));
}

export async function openPortal(p) {
  app.unwatch?.();
  app.client = p.client;
  app.member = p.member;
  remember('portal:client', p.client.id);
  await loadData();
  let timer = 0;
  app.unwatch =
    app.backend.watch?.(
      app.client.id,
      (table) => {
        if (table === 'any') return;
        clearTimeout(timer);
        timer = setTimeout(() => loadData().then(refresh).catch(() => {}), 450);
      },
      { studio: app.studio },
    ) || null;
  refresh();
}

/**
 * Arranque: el backend (Supabase o la demostración), quién entra y sus portales.
 * Fases: booting, login, empty, ready, error.
 */
export function useBoot() {
  const [phase, setPhase] = useState('booting');
  const [message, setMessage] = useState('');

  const start = async () => {
    setPhase('booting');
    try {
      app.backend ||= await createBackend();
      app.user = await app.backend.user();
      if (!app.user) return setPhase('login');
      app.studio = app.backend.isAdmin(app.user);
      app.portals = await app.backend.portals(app.user);
      if (!app.portals.length) {
        setMessage(app.studio ? 'Todavía no hay portales. Créalos desde Negocio › Portal de clientes.' : 'Tu cuenta todavía no tiene un proyecto asignado. Escríbele a Schwarck.');
        return setPhase('empty');
      }
      const wanted = new URLSearchParams(location.search).get('p') || remember('portal:client');
      const pick = app.portals.find((x) => x.client.id === wanted) || app.portals.find((x) => !x.client.archived) || app.portals[0];
      await openPortal(pick);
      setPhase('ready');
    } catch (err) {
      setMessage(err.message || 'No se pudo cargar la app. Revisa tu conexión y recarga.');
      setPhase('error');
    }
  };

  useEffect(() => {
    start();
    // El cambio de pestaña o de sesión en otro sitio vuelve a arrancar.
  }, []);

  const signIn = async (email, password) => {
    await app.backend.signIn(email, password);
    await start();
  };
  const signOut = async () => {
    app.unwatch?.();
    await app.backend.signOut();
    location.reload();
  };
  return { phase, message, signIn, signOut, demo: app.backend?.mode === 'demo' };
}

/** Guarda una fila (alta o cambio) y la pone en los datos locales al momento. */
export async function save(table, row) {
  const saved = await app.backend.save(table, row);
  upsertLocal(table, saved);
  refresh();
  return saved;
}

export function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo({ top: 0 });
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (hash) => {
  location.hash = hash;
};
