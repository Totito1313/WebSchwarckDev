// Negocio nuevo · los datos. Son los mismos de siempre: negocio-core.js los carga
// enteros de /api/admin/crm, aplica cada cambio al momento y lo guarda en segundo
// plano, en lotes. Aquí solo se avisa a React cuando algo cambia, para repintar.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, bus, flushNow, hasUnsaved, loadAll, reloadAll, saving, state } from '../../negocio-core.js';

let version = 0;
const listeners = new Set();
const bump = () => {
  version += 1;
  for (const l of listeners) l();
};
for (const type of ['change', 'saved', 'conflict', 'status', 'pub']) bus.addEventListener(type, bump);

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Los datos del negocio y un número que sube con cada cambio (para useMemo). */
export function useCrm() {
  const v = useSyncExternalStore(subscribe, () => version);
  return [state, v];
}

/** Estado del guardado: saved, pending, saving o error. */
export function useSaving() {
  useSyncExternalStore(subscribe, () => version);
  return { ...saving };
}

/**
 * La sesión del panel: comprueba si ya está abierta, entra con la contraseña y
 * carga los datos. Devuelve la fase (checking, login, loading, ready, error).
 */
export function useSession() {
  const [phase, setPhase] = useState('checking');
  const [error, setError] = useState('');

  const open = async () => {
    setPhase('loading');
    try {
      await loadAll();
      setPhase('ready');
    } catch (err) {
      if (err.status === 401) setPhase('login');
      else {
        setError(err.message);
        setPhase('error');
      }
    }
  };

  useEffect(() => {
    api('/session')
      .then((s) => {
        if (!s.configured) {
          setError('El panel todavía no tiene contraseña. Ponla en Cloudflare (ADMIN_PASSWORD) o en .dev.vars en local.');
          setPhase('error');
        } else if (s.authed) open();
        else setPhase('login');
      })
      .catch((err) => {
        setError(err.message);
        setPhase('error');
      });
    // La sesión caducó a mitad de trabajo: se vuelve a entrar y lo pendiente se guarda.
    const onAuth = () => setPhase('login');
    bus.addEventListener('auth', onAuth);
    return () => bus.removeEventListener('auth', onAuth);
  }, []);

  const login = async (password) => {
    await api('/login', { method: 'POST', body: { password } });
    if (state.customers.length || state.docs.length) {
      setPhase('ready');
      flushNow().catch(() => {});
    } else await open();
  };

  const logout = async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  };

  return { phase, error, login, logout };
}

/**
 * Lo que hace el panel de siempre al cambiar de pestaña: guardar ya al salir (en
 * el teléfono la pestaña se puede cerrar sin avisar) y volver a leerlo todo al
 * volver tras un rato, como mucho una vez cada dos minutos.
 */
export function useLifecycle(active) {
  useEffect(() => {
    if (!active) return undefined;
    let lastSync = Date.now();
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        if (hasUnsaved()) flushNow().catch(() => {});
        return;
      }
      if (Date.now() - lastSync < 120_000 || Date.now() - hiddenAt < 30_000) return;
      lastSync = Date.now();
      reloadAll().catch(() => {});
    };
    const onUnload = (e) => {
      if (hasUnsaved()) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onVisibility);
    addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('beforeunload', onUnload);
    };
  }, [active]);
}

/** Ruta de la app: «#/leads/abc» → ['leads', 'abc']. */
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

/** Lo que va después de «?» en la ruta: #/tareas/nueva?p=ID. */
export const routeQuery = () => new URLSearchParams(location.hash.split('?')[1] || '');

export const go = (hash) => {
  location.hash = hash;
};
