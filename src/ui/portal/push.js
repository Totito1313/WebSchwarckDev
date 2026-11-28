// Avisos al teléfono en la app nueva: el permiso, la suscripción de este dispositivo
// (con el service worker de /cliente-nuevo/) y guardarla en el portal. Es lo mismo que
// hace src/portal/profile.js en la app de siempre, con su propio service worker.
import { isIOS, isInstalled } from '../kit/install.js';
import { app } from '../../portal/state.js';

const SCOPE = '/cliente-nuevo/';
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const registration = async () => (pushSupported() ? navigator.serviceWorker.getRegistration(SCOPE) : null);

/** Cómo están los avisos aquí: 'on', 'off', 'denied', 'install' (iPhone sin instalar), 'unsupported' o 'demo'. */
export async function pushState() {
  if (app.backend?.mode === 'demo') return localStorage.getItem('portal:demo-push') ? 'on' : 'off';
  if (isIOS() && !isInstalled()) return 'install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

const keyBytes = (b64) => {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const keyText = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function subscribe() {
  const key = await app.backend.vapidKey();
  if (!key) throw new Error('El servidor de avisos no responde todavía.');
  const reg = await registration();
  if (!reg) throw new Error('La app todavía se está preparando: recarga la página y vuelve a intentarlo.');
  let sub = await reg.pushManager.getSubscription();
  // Si la clave del servidor cambió, la suscripción vieja ya no sirve.
  const current = sub?.options?.applicationServerKey;
  if (sub && current && keyText(current) !== key) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await app.backend.savePush(app.client.id, sub, app.studio);
}

/**
 * Pide permiso (solo después de un toque) y guarda la suscripción. Devuelve
 * { ok, message } para enseñarlo como aviso.
 */
export async function enablePush() {
  if (app.backend.mode === 'demo') {
    localStorage.setItem('portal:demo-push', '1');
    return { ok: true, message: 'En la demostración no llegan avisos de verdad.' };
  }
  if (isIOS() && !isInstalled()) return { ok: false, install: true, message: 'En el iPhone, primero instala la app: Compartir › «Añadir a pantalla de inicio».' };
  if (!pushSupported()) return { ok: false, message: 'Este navegador no admite notificaciones.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: permission === 'denied' ? 'Están bloqueadas: actívalas en los ajustes del navegador para esta web.' : 'Sin permiso no podemos avisarte.' };
  }
  try {
    await subscribe();
    return { ok: true, message: 'Te avisaremos en este dispositivo.' };
  } catch (err) {
    return { ok: false, message: err.message || 'No se pudieron activar.' };
  }
}

/** Al abrir: si ya había permiso, la suscripción se vuelve a guardar para este portal. */
export async function ensurePush() {
  if (app.backend?.mode !== 'live' || !pushSupported() || Notification.permission !== 'granted') return;
  await subscribe().catch(() => {});
}

/** Al salir: este dispositivo deja de recibir avisos de esta cuenta. */
export async function dropPush() {
  if (app.backend?.mode !== 'live') return;
  const sub = await (await registration())?.pushManager.getSubscription().catch(() => null);
  if (sub) await app.backend.dropPush(sub.endpoint).catch(() => {});
}
