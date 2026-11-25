// Panel: perfil público. La foto del titular que sale en la portada (/#fundador),
// junto a su nombre y sus datos de contacto: lo que revisa Payoneer.
// La foto se reduce aquí antes de subirla (como mucho 1400 px por lado) y la API
// la guarda en el almacén (site:photo). La portada siempre la pide a /api/perfil/foto.

import { initTheme } from './theme.js';

initTheme();

const MAX_SIDE = 1400;
const MAX_BYTES = 2_000_000;

const views = Object.fromEntries([...document.querySelectorAll('[data-view]')].map((v) => [v.dataset.view, v]));
const logout = document.querySelector('[data-logout]');
const loadingNote = views.loading.firstElementChild;
const show = (name) => {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  logout.hidden = name !== 'panel';
};
const say = (node, text, kind = '') => {
  node.textContent = text;
  node.dataset.kind = kind;
};

async function api(path, { method = 'GET', json, blob } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: json ? { 'content-type': 'application/json' } : blob ? { 'content-type': blob.type } : undefined,
    body: json ? JSON.stringify(json) : blob,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') show('login');
  if (!res.ok) throw new Error(data.error || 'No se pudo completar.');
  return data;
}

// ── Entrada ──
const login = views.login;
const loginMsg = document.querySelector('[data-login-msg]');
login.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  say(loginMsg, 'Comprobando…');
  try {
    await api('/login', { method: 'POST', json: { password: login.elements.password.value } });
    say(loginMsg, '');
    await openPanel();
  } catch (err) {
    say(loginMsg, err.message, 'error');
  } finally {
    login.elements.password.value = '';
    button.disabled = false;
  }
});
logout.addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  show('login');
});

// ── La foto ──
const drop = document.querySelector('[data-drop]');
const frames = [...document.querySelectorAll('[data-frame]')];
const pick = document.querySelector('[data-pick]');
const remove = document.querySelector('[data-remove]');
const fileInput = document.querySelector('[data-file]');
const msg = document.querySelector('[data-msg]');
const meta = document.querySelector('[data-meta]');
let busy = false;

const when = (iso) => new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Pinta la foto guardada (o las iniciales si no hay) en los dos recortes. */
function draw(photo) {
  for (const frame of frames) {
    frame.querySelector('img')?.remove();
    if (photo) {
      const img = Object.assign(document.createElement('img'), { alt: '', decoding: 'async' });
      img.src = `/api/perfil/foto?v=${encodeURIComponent(photo.updatedAt)}`;
      frame.append(img);
    }
  }
  pick.textContent = photo ? 'Cambiar foto' : 'Subir foto';
  remove.hidden = !photo;
  meta.textContent = photo ? `Subida el ${when(photo.updatedAt)} · ${kb(photo.size)}` : 'Todavía no hay foto: en la portada se ven tus iniciales.';
}

/** Abre la imagen, la reduce y la devuelve en WebP (o JPG si el navegador no sabe hacer WebP). */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('No se pudo leer esa imagen. Prueba con un JPG o un PNG.');
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encode = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode('image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.88);
    if (!blob) throw new Error('No se pudo preparar la foto.');
    if (blob.size > MAX_BYTES) blob = await encode('image/jpeg', 0.72);
    if (!blob || blob.size > MAX_BYTES) throw new Error('La foto sigue pasando de 2 MB. Prueba con otra.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function upload(file) {
  if (busy || !file) return;
  if (!/^image\//.test(file.type)) {
    say(msg, 'Eso no es una imagen.', 'error');
    return;
  }
  busy = true;
  pick.disabled = remove.disabled = true;
  try {
    say(msg, 'Preparando la foto…');
    const blob = await shrink(file);
    say(msg, 'Subiendo…');
    const { photo } = await api('/perfil/foto', { method: 'PUT', blob });
    draw(photo);
    say(msg, 'Lista. La portada la enseña en cinco minutos como mucho.', 'ok');
  } catch (err) {
    say(msg, err.message, 'error');
  } finally {
    busy = false;
    pick.disabled = remove.disabled = false;
    fileInput.value = '';
  }
}

pick.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => upload(fileInput.files[0]));
remove.addEventListener('click', async () => {
  if (busy || !confirm('¿Quitar la foto de la portada? En su lugar se verán tus iniciales.')) return;
  busy = true;
  pick.disabled = remove.disabled = true;
  try {
    await api('/perfil/foto', { method: 'DELETE' });
    draw(null);
    say(msg, 'Foto quitada.', 'ok');
  } catch (err) {
    say(msg, err.message, 'error');
  } finally {
    busy = false;
    pick.disabled = remove.disabled = false;
  }
});

// Soltar una foto encima también la sube.
for (const type of ['dragenter', 'dragover']) {
  drop.addEventListener(type, (event) => {
    if (![...(event.dataTransfer?.types || [])].includes('Files')) return;
    event.preventDefault();
    drop.classList.add('is-over');
  });
}
drop.addEventListener('dragleave', (event) => {
  if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-over');
});
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('is-over');
  upload(event.dataTransfer?.files?.[0]);
});

async function openPanel() {
  loadingNote.textContent = 'Cargando…';
  show('loading');
  try {
    const { photo } = await api('/perfil');
    draw(photo);
  } catch (err) {
    if (views.loading.hidden) return; // la sesión caducó: ya se está pidiendo la contraseña
    loadingNote.textContent = `No se pudieron cargar los datos (${err.message}). Recarga la página.`;
    return;
  }
  show('panel');
}

try {
  const session = await api('/session');
  if (!session.configured || !session.storage) {
    document.querySelector('[data-setup-why]').textContent = session.configured
      ? 'La contraseña está puesta, pero el almacén de datos todavía no está enlazado. Suele resolverse solo en el siguiente despliegue.'
      : 'El panel todavía no tiene contraseña. Solo tú puedes ponerla:';
    views.setup.querySelector('ol').hidden = session.configured;
    show('setup');
  } else if (session.authed) {
    await openPanel();
  } else {
    show('login');
  }
} catch {
  loadingNote.textContent = 'No se pudo conectar con el servidor. Recarga la página.';
  show('loading');
}
