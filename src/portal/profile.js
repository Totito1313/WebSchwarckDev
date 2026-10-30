// Perfil y ajustes: la persona (foto, nombre, cargo, teléfono), su negocio (datos públicos y
// redes), las notificaciones por categoría, sonido y vibración, el tema, instalar la app,
// la contraseña y, al estudio, sus herramientas. Y el permiso de notificaciones.

import {
  el, fill, icon, toast, sheet, actionSheet, field, input, textarea, seg, group, rowLink, switchRow, avatar, burst, safeUrl,
} from './kit.js';
import { react, feel } from './feel.js';
import { safeName } from './data.js';
import { app, redraw, isStudio, urlOf, signPaths } from './state.js';
import * as studio from './studio.js';
import { setTheme } from '../theme.js';

// ── Instalar la app ──

let installEvent = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

export async function install() {
  if (installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice.catch(() => ({}));
    installEvent = null;
    if (outcome === 'accepted') {
      react('success');
      toast('¡Lista! Ya la tienes en tu pantalla de inicio.', 'ok');
    }
    return;
  }
  const steps = isIOS
    ? [['share', 'Toca Compartir', 'El cuadrado con la flecha, abajo en Safari.'], ['plus', '«Añadir a pantalla de inicio»', 'Baja un poco en la lista si no lo ves.'], ['check', 'Toca «Añadir»', 'Ábrela desde su icono y activa los avisos.']]
    : [['more', 'Abre el menú del navegador', 'Los tres puntos, arriba a la derecha.'], ['phone', '«Instalar aplicación»', 'O «Añadir a pantalla de inicio».'], ['check', 'Confirma', 'Aparecerá con el icono de Schwarck.']];
  sheet('Instalar la app', el('ol', { class: 'cl-steps' }, steps.map(([ico, t, s], i) => el('li', { style: { '--i': i } }, el('span', { class: 'cl-step-ico' }, icon(ico)), el('div', {}, el('b', { text: t }), el('small', { text: s }))))));
}

export function installCard() {
  if (standalone() || remember('portal:install-hidden')) return null;
  const card = el('article', { class: 'cl-card cl-promo' },
    el('img', { class: 'cl-promo-icon', src: '/cliente/icon-192.png', alt: '', width: 48, height: 48 }),
    el('div', { class: 'cl-set-main' }, el('b', { text: 'Llévala en tu teléfono' }), el('small', { text: 'Instálala como app: se abre en un toque y te avisa de cada novedad.' })),
    el('div', { class: 'cl-promo-actions' },
      el('button', { type: 'button', class: 'cl-btn sm', onclick: install }, icon('phone'), 'Instalar'),
      el('button', { type: 'button', class: 'cl-btn sm ghost', text: 'Ahora no', onclick: () => { remember('portal:install-hidden', '1'); card.classList.add('is-gone'); setTimeout(() => card.remove(), 300); } }),
    ),
  );
  return card;
}

// ── Notificaciones ──

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Cómo están los avisos en este teléfono: 'on', 'off', 'denied', 'install' (iPhone sin instalar) o 'unsupported'. */
export async function pushState() {
  if (isIOS && !standalone()) return 'install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration('/cliente/');
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

function keyBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/** Pide permiso (solo tras un toque) y guarda la suscripción de este teléfono. */
export async function enablePush() {
  if (app.backend.mode === 'demo') {
    react('success');
    toast('En la demostración no se activan los avisos.', 'ok');
    return true;
  }
  if (isIOS && !standalone()) {
    install();
    return false;
  }
  if (!pushSupported()) {
    toast('Este navegador no admite notificaciones.', 'error');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast(permission === 'denied' ? 'Las notificaciones están bloqueadas: actívalas en los ajustes del navegador para esta web.' : 'Sin permiso no podemos avisarte.', 'error');
    return false;
  }
  try {
    await subscribe();
    react('success');
    toast('Notificaciones activadas en este teléfono.', 'ok');
    redraw();
    return true;
  } catch (err) {
    toast(err.message || 'No se pudieron activar.', 'error');
    return false;
  }
}

async function subscribe() {
  const key = await app.backend.vapidKey();
  if (!key) throw new Error('El servidor de avisos no responde todavía.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // Si la clave del servidor cambió, la suscripción vieja ya no sirve.
  const current = sub?.options?.applicationServerKey;
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await app.backend.savePush(app.client.id, sub, isStudio());
}

/** Al abrir: si ya hay permiso, la suscripción se vuelve a guardar para este portal. */
export async function ensurePush() {
  if (app.backend.mode !== 'live' || !pushSupported() || Notification.permission !== 'granted') return;
  try {
    await subscribe();
  } catch {
    // se reintenta al abrir la próxima vez
  }
}

export function notificationsCard() {
  if (app.backend.mode === 'live' && (!pushSupported() || Notification.permission !== 'default') && !(isIOS && !standalone())) return null;
  if (app.backend.mode === 'demo' && remember('portal:demo-push')) return null;
  if (remember('portal:push-later') && Date.now() - Number(remember('portal:push-later')) < 3 * 86_400_000) return null;
  const ios = isIOS && !standalone();
  const card = el('article', { class: 'cl-card cl-promo is-push' },
    el('span', { class: 'cl-bell-big' }, icon('bell'), el('i'), el('i')),
    el('div', { class: 'cl-set-main' },
      el('b', { text: ios ? 'Instala la app para recibir avisos' : 'Activa las notificaciones' }),
      el('small', { text: isStudio() ? 'Te avisamos cuando el cliente envíe algo, apruebe contenido o comente.' : 'Te avisamos de cada petición, del reporte del día y del contenido que tienes que aprobar.' }),
    ),
    el('div', { class: 'cl-promo-actions' },
      el('button', { type: 'button', class: 'cl-btn sm', onclick: async () => { if (await enablePush()) { if (app.backend.mode === 'demo') remember('portal:demo-push', '1'); burst(card); card.classList.add('is-gone'); setTimeout(() => card.remove(), 300); } } }, icon(ios ? 'phone' : 'bell'), ios ? 'Cómo instalarla' : 'Activar'),
      el('button', { type: 'button', class: 'cl-btn sm ghost', text: 'Más tarde', onclick: () => { remember('portal:push-later', String(Date.now())); card.classList.add('is-gone'); setTimeout(() => card.remove(), 300); } }),
    ),
  );
  return card;
}

/** La primera vez tras entrar: una hoja que explica para qué sirven los avisos. */
export async function notificationOnboarding() {
  if (app.backend.mode !== 'live') return;
  const state = await pushState();
  if (state !== 'off' && state !== 'install') return;
  if (remember('portal:push-later') && Date.now() - Number(remember('portal:push-later')) < 3 * 86_400_000) return;
  if (sessionStorage.getItem('portal:onboarded')) return;
  sessionStorage.setItem('portal:onboarded', '1');
  const ios = state === 'install';
  const reasons = isStudio()
    ? [['inbox', 'Lo que te envían', 'Archivos, enlaces y mensajes de tus clientes.'], ['checkCircle', 'Aprobaciones', 'Cuando aprueben o pidan cambios en una pieza.'], ['chat', 'Comentarios', 'Cada pregunta en sus conversaciones.']]
    : [['inbox', 'Peticiones', 'Lo que necesitamos de ti, y un recordatorio el día que vence.'], ['tasks', 'Reporte diario', 'Lo que hicimos hoy por tu marca.'], ['calendar', 'Contenido para aprobar', 'Cada pieza nueva, para que la revises.']];
  let ui;
  const go = el('button', { type: 'button', class: 'cl-btn lg', onclick: async () => {
    if (ios) {
      ui.close();
      return install();
    }
    if (await enablePush()) {
      burst(go);
      ui.close();
    }
  } }, icon(ios ? 'phone' : 'bell'), ios ? 'Instalar la app' : 'Activar notificaciones');
  ui = sheet(ios ? 'Instala la app' : 'No te pierdas nada', el('div', { class: 'cl-onboard' },
    el('span', { class: 'cl-bell-big is-xl' }, icon('bell'), el('i'), el('i')),
    el('p', { class: 'cl-onboard-lead', text: ios ? 'En el iPhone, los avisos llegan cuando la app está instalada en tu pantalla de inicio.' : 'Activa los avisos en este teléfono y te escribimos solo cuando importa.' }),
    el('ul', { class: 'cl-onboard-list' }, reasons.map(([ico, t, s], i) => el('li', { style: { '--i': i } }, el('span', { class: 'cl-set-ico' }, icon(ico)), el('div', {}, el('b', { text: t }), el('small', { text: s }))))),
  ), { actions: [go, el('button', { type: 'button', class: 'cl-btn ghost', text: 'Ahora no', onclick: () => { remember('portal:push-later', String(Date.now())); ui.close(); } })], className: 'is-onboard' });
}

// ── La pantalla de perfil ──

const PREF_CATS = [
  ['peticiones', 'Peticiones y recordatorios', 'inbox', 'var(--cf-orange)'],
  ['trabajo', 'Reporte diario', 'tasks', 'var(--cf-income)'],
  ['marketing', 'Contenido y resultados', 'megaphone', 'var(--cf-primary)'],
  ['avisos', 'Anuncios y recursos', 'bell', 'var(--cf-blue)'],
  ['mensajes', 'Respuestas a tus comentarios', 'chat', 'var(--cf-purple)'],
];

export function profilePage() {
  const box = el('div', { class: 'cl-stack' });
  const draw = async () => {
    const m = app.member || {};
    const c = app.client;
    const state = await pushState();
    const prefs = m.prefs || {};
    const mute = new Set(prefs.mute || []);
    const savePrefs = async (patch) => {
      const next = { ...prefs, ...patch };
      try {
        Object.assign(app.member, await app.backend.updateSelf(c.id, { prefs: next }));
      } catch (err) {
        toast(err.message, 'error');
      }
    };
    const stateText = { on: 'Activadas en este teléfono', off: 'Desactivadas', denied: 'Bloqueadas en el navegador', install: 'Instala la app para activarlas', unsupported: 'Este navegador no las admite' }[state];
    fill(box,
      // Cabecera: foto, nombre y correo
      el('section', { class: 'cl-me' },
        el('button', { type: 'button', class: 'cl-me-photo', 'aria-label': 'Cambiar foto', onclick: () => isStudio() ? null : changePhoto() },
          isStudio() ? el('span', { class: 'cl-avatar xl is-studio' }, el('img', { src: '/favicon.svg', alt: '' })) : avatar(m.name || m.email, urlOf(m.avatar_path), 'xl'),
          !isStudio() && el('span', { class: 'cl-me-cam' }, icon('camera')),
        ),
        el('b', { class: 'cl-me-name', text: isStudio() ? 'Schwarck' : m.name || 'Tu nombre' }),
        el('small', { text: [isStudio() ? 'Estudio' : m.position, app.user?.email].filter(Boolean).join(' · ') }),
      ),
      !isStudio() && group('Tu perfil',
        rowLink('Nombre', { ico: 'user', tone: 'var(--cf-blue)', value: m.name || 'Añadir', onClick: () => editField('Tu nombre', m.name, (v) => saveSelf({ name: v }), { max: 120 }) }),
        rowLink('Cargo', { ico: 'store', tone: 'var(--cf-purple)', value: m.position || 'Añadir', onClick: () => editField('Tu cargo', m.position, (v) => saveSelf({ position: v }), { max: 80, placeholder: 'Dueña, marketing, encargado…' }) }),
        rowLink('Teléfono', { ico: 'call', tone: 'var(--cf-income)', value: m.phone || 'Añadir', onClick: () => editField('Tu teléfono', m.phone, (v) => saveSelf({ phone: v }), { max: 40, type: 'tel', placeholder: '+58 412 000 0000' }) }),
      ),
      group(isStudio() ? `Negocio de ${c.name}` : 'Tu negocio',
        businessRow('Sector', 'industry', 'store', 'var(--cf-orange)', { max: 80 }),
        businessRow('Descripción', 'description', 'doc', 'var(--cf-blue)', { max: 2000, long: true, placeholder: 'Qué hacéis, en dos líneas' }),
        businessRow('Web', 'website', 'globe', 'var(--cf-primary)', { max: 300, type: 'url', placeholder: 'https://…' }),
        businessRow('Instagram', 'instagram', 'instagram', '#e1306c', { max: 120, placeholder: '@tunegocio' }),
        businessRow('Facebook', 'facebook', 'facebook', '#1877f2', { max: 300 }),
        businessRow('TikTok', 'tiktok', 'tiktok', '#25c2d9', { max: 120, placeholder: '@tunegocio' }),
        businessRow('Teléfono', 'phone', 'call', 'var(--cf-income)', { max: 40, type: 'tel' }),
        businessRow('Correo', 'email', 'mail', 'var(--cf-orange)', { max: 200, type: 'email' }),
        businessRow('Dirección', 'address', 'pin', 'var(--cf-expense)', { max: 300 }),
        businessRow('Horario', 'hours', 'clock', 'var(--cf-purple)', { max: 300, placeholder: 'Lun–Sáb 8:00–20:00' }),
      ),
      group('Notificaciones',
        el('div', { class: 'cl-row-set' }, el('span', { class: 'cl-set-ico', style: { '--c': 'var(--cf-expense)' } }, icon('bell')), el('span', { class: 'cl-set-main' }, el('b', { text: 'En este teléfono' }), el('small', { text: stateText })),
          state === 'on' ? el('button', { type: 'button', class: 'cl-btn xs ghost', onclick: async () => { const r = await app.backend.testPush().catch((e) => toast(e.message, 'error')); if (r) toast(r.sent ? 'Enviado: te llega en unos segundos.' : 'No hay dispositivos suscritos.', r.sent ? 'ok' : 'error'); } }, 'Probar')
            : state === 'off' || state === 'install' ? el('button', { type: 'button', class: 'cl-btn xs', onclick: async () => { if (await enablePush()) draw(); } }, state === 'install' ? 'Instalar' : 'Activar') : null),
        !isStudio() && PREF_CATS.map(([k, label, ico, tone]) => switchRow(label, !mute.has(k) && prefs.push !== false, (on) => {
          const next = new Set(mute);
          if (on) next.delete(k);
          else next.add(k);
          savePrefs({ mute: [...next], push: true });
        }, { ico, tone })),
      ),
      group('Sonido y vibración',
        switchRow('Vibración', feel.haptics, (v) => feel.set('haptics', v), { ico: 'vibrate', tone: 'var(--cf-purple)', sub: 'Cada toque responde' }),
        switchRow('Sonidos', feel.sounds, (v) => feel.set('sounds', v), { ico: 'volume', tone: 'var(--cf-blue)', sub: 'Respetan el modo silencio del iPhone' }),
      ),
      group('Apariencia', el('div', { class: 'cl-row-set is-control' }, el('span', { class: 'cl-set-ico', style: { '--c': 'var(--cf-fg)' } }, icon('moon')), seg([['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], document.documentElement.dataset.theme || 'system', (v) => setTheme(v), { small: true, label: 'Tema' }))),
      isStudio() && group('Estudio',
        rowLink('Clientes', { ico: 'users', tone: 'var(--cf-primary)', value: String(app.portals.length), onClick: () => document.dispatchEvent(new CustomEvent('portal:switch')) }),
        rowLink(`Accesos de ${c.name}`, { ico: 'key', tone: 'var(--cf-orange)', value: String(app.data.members.length), onClick: studio.accessSheet }),
        rowLink('Ajustes del portal', { ico: 'store', tone: 'var(--cf-purple)', onClick: () => studio.editPortal(app.client) }),
        rowLink('Resultados del mes', { ico: 'chart', tone: '#22c9a6', onClick: () => studio.editMetrics() }),
        studio.readImport() && rowLink('Traer el trabajo de Negocio', { ico: 'download', tone: 'var(--cf-income)', onClick: studio.importFromNegocio }),
        rowLink('Abrir Negocio', { ico: 'external', tone: 'var(--cf-fg-muted)', href: '/admin/negocio/' }),
      ),
      group('App',
        !standalone() && rowLink('Instalar en el teléfono', { ico: 'phone', tone: 'var(--cf-income)', onClick: install }),
        !isStudio() && app.portals.length > 1 && rowLink('Cambiar de proyecto', { ico: 'swap', tone: 'var(--cf-blue)', onClick: () => document.dispatchEvent(new CustomEvent('portal:switch')) }),
        app.backend.mode === 'live' && rowLink('Cambiar contraseña', { ico: 'lock', tone: 'var(--cf-fg-muted)', onClick: passwordSheet }),
        rowLink(app.backend.mode === 'demo' ? 'Salir de la demostración' : 'Cerrar sesión', { ico: 'logout', danger: true, onClick: async () => {
          const ok = await actionSheet('¿Cerrar sesión?', [{ label: 'Cerrar sesión', danger: true, icon: 'logout' }], { message: 'Tendrás que entrar de nuevo con tu correo y contraseña.' });
          if (!ok) return;
          if (app.backend.mode === 'live' && pushSupported()) {
            const reg = await navigator.serviceWorker.getRegistration('/cliente/');
            const sub = await reg?.pushManager.getSubscription();
            if (sub) await app.backend.dropPush(sub.endpoint).catch(() => {});
          }
          await app.backend.signOut();
          if (app.backend.mode === 'live') location.replace('/cliente/');
        } }),
      ),
      el('p', { class: 'cl-fine' }, 'Hecho por ', el('a', { href: '/', text: 'Schwarck Developer' }), ' · Portal de clientes'),
    );
  };

  function businessRow(label, key, ico, tone, opts) {
    const value = app.client[key];
    const shown = key === 'website' && value ? value.replace(/^https?:\/\/(www\.)?/, '') : value;
    return rowLink(label, { ico, tone, value: shown ? String(shown).slice(0, 28) + (String(shown).length > 28 ? '…' : '') : 'Añadir', onClick: () => editField(label, value, async (v) => {
      if (key === 'website' && v && !safeUrl(v)) throw new Error('La web tiene que empezar por https://');
      Object.assign(app.client, await app.backend.updateClient(app.client.id, { [key]: v || null }));
    }, opts) });
  }
  async function saveSelf(patch) {
    Object.assign(app.member, await app.backend.updateSelf(app.client.id, patch));
    redraw();
  }
  function editField(title, value, save, { max = 200, long, type = 'text', placeholder } = {}) {
    const control = long ? textarea({ value: value || '', maxLength: max, rows: 4, placeholder }, { counter: true }) : input({ type, value: value || '', maxLength: max, placeholder, inputMode: type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'url' ? 'url' : null });
    const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('check'), 'Guardar');
    const ui = sheet(title, el('div', { class: 'cl-form' }, field(title, control)), { actions: [btn] });
    requestAnimationFrame(() => (control.querySelector?.('textarea') || control).focus());
    btn.addEventListener('click', async () => {
      btn.classList.add('is-busy');
      try {
        await save((control.querySelector?.('textarea') || control).value.trim());
        react('success');
        ui.close();
        draw();
      } catch (err) {
        btn.classList.remove('is-busy');
        toast(err.message, 'error');
      }
    });
  }
  function changePhoto() {
    const picker = el('input', { type: 'file', accept: 'image/*', hidden: true });
    picker.addEventListener('change', async () => {
      const f = picker.files[0];
      if (!f) return;
      if (f.size > 8 * 1048576) return toast('La foto pesa más de 8 MB.', 'error');
      try {
        toast('Subiendo tu foto…');
        const small = await shrink(f, 512);
        const path = `${app.client.id}/perfil/${app.user.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name.replace(/\.[^.]+$/, '.jpg'))}`;
        await app.backend.upload(path, small);
        await signPaths([path]);
        await saveSelf({ avatar_path: path });
        react('success');
        toast('Foto actualizada.', 'ok');
        draw();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    document.body.append(picker);
    picker.click();
    setTimeout(() => picker.remove(), 60_000);
  }
  draw();
  return { node: box, title: 'Perfil', large: 'Perfil', sub: isStudio() ? 'Tu cuenta del estudio y los datos del cliente' : 'Tus datos, tu negocio y tus avisos' };
}

/** Reduce una foto a `size` píxeles por lado (JPEG) antes de subirla. */
async function shrink(file, size) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
}

function passwordSheet() {
  const pass = input({ type: 'password', autocomplete: 'new-password', placeholder: 'Mínimo 8 caracteres' });
  const again = input({ type: 'password', autocomplete: 'new-password' });
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('check'), 'Guardar');
  const ui = sheet('Cambiar contraseña', el('div', { class: 'cl-form' }, field('Nueva contraseña', pass), field('Repítela', again)), { actions: [btn] });
  btn.addEventListener('click', async () => {
    if (pass.value.length < 8) return toast('Mínimo 8 caracteres.', 'error');
    if (pass.value !== again.value) return toast('Las dos no coinciden.', 'error');
    btn.classList.add('is-busy');
    try {
      await app.backend.updatePassword(pass.value);
      react('success');
      ui.close();
      toast('Contraseña cambiada.', 'ok');
    } catch (err) {
      btn.classList.remove('is-busy');
      toast(err.message, 'error');
    }
  });
}
