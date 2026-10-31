// Identidad de cada cliente en su app: colores, tipografía, esquinas, estilo del inicio,
// portada, tema y nombre. La guarda portal_clients (accent y brand) y la aplica la app;
// Negocio la edita con una vista previa en vivo. También los roles y las secciones.

export const BRAND_DEFAULTS = { accent2: '', font: 'inter', radius: 'suave', hero: 'degradado', theme: 'auto', cover: '', app_name: '' };

export const FONTS = {
  inter: ['Inter', 'Inter:wght@600;700;800'],
  'dm-sans': ['DM Sans', 'DM+Sans:wght@500;700;800'],
  poppins: ['Poppins', 'Poppins:wght@500;600;700;800'],
  montserrat: ['Montserrat', 'Montserrat:wght@600;700;800'],
  outfit: ['Outfit', 'Outfit:wght@500;600;700;800'],
  'space-grotesk': ['Space Grotesk', 'Space+Grotesk:wght@500;600;700'],
  nunito: ['Nunito', 'Nunito:wght@600;700;800'],
  playfair: ['Playfair Display', 'Playfair+Display:wght@600;700;800'],
  fraunces: ['Fraunces', 'Fraunces:wght@600;700;800'],
};
export const RADII = { recto: ['Rectas', 12, 10, 12], suave: ['Suaves', 24, 16, 25], redondo: ['Redondas', 32, 22, 999] };
export const HEROES = { degradado: 'Degradado', liso: 'Color liso', imagen: 'Imagen' };
export const THEMES = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' };
export const COLORS = ['#00b8d4', '#387aff', '#5b4cff', '#7c4dff', '#e1306c', '#ff5a36', '#c26a3d', '#ff9800', '#f5b800', '#34c759', '#14b8a6', '#111111'];

// Lo que se puede ocultar, a todo un portal o a una persona.
export const SECTIONS = [
  ['cronologia', 'Cronología', 'La pestaña con todo lo que pasa, día a día'],
  ['reporte', 'Reporte diario', 'Lo que el estudio hace cada día'],
  ['calendario', 'Calendario de contenido', 'Las publicaciones, para aprobarlas'],
  ['rendimiento', 'Rendimiento', 'Alcance, seguidores, ventas…'],
  ['leads', 'Leads', 'Clientes potenciales y su embudo'],
  ['recursos', 'Recursos', 'Guías, archivos y enlaces'],
  ['peticiones', 'Peticiones', 'Lo que le pides al cliente'],
  ['enviar', 'Enviar', 'Mandar mensajes, enlaces y archivos'],
];
export const ROLES = {
  owner: ['Dueño', 'Ve y hace todo, y edita los datos de su negocio'],
  member: ['Equipo', 'Ve, aprueba, comenta y envía'],
  viewer: ['Solo lectura', 'Solo mira: no aprueba, no comenta ni envía'],
};

// ── Permisos: qué ve y qué puede hacer cada persona de un portal ──
// La misma regla que private.perm() en la base (que es la que de verdad manda): la excepción de
// la persona si la tiene; si no, su rol dentro de lo que su portal permite.

export const PERMS = [
  ['Ve', [
    ['timeline.view', 'Cronología', 'La pestaña con todo lo que pasa, día a día'],
    ['report.view', 'Reporte diario', 'Lo que el estudio hace cada día'],
    ['content.view', 'Calendario de contenido', 'Las publicaciones y su estado'],
    ['metrics.view', 'Rendimiento', 'Alcance, seguidores, ventas…'],
    ['leads.view', 'Leads', 'Clientes potenciales y su embudo'],
    ['resources.view', 'Recursos', 'Guías, archivos y enlaces'],
    ['tasks.view', 'Peticiones', 'Lo que el estudio le pide'],
  ]],
  ['Decide sobre el contenido', [
    ['content.approve', 'Aprobar o pedir cambios', 'En lo que está para revisar'],
    ['content.reject', 'Rechazar publicaciones', 'Hasta que se programan'],
    ['content.propose', 'Proponer publicaciones', 'Entran como «Idea del cliente»'],
  ]],
  ['Crea y envía', [
    ['posts.create', 'Publicar anuncios', 'En el tablón, para su equipo y para ti'],
    ['tasks.submit', 'Entregar peticiones', 'Marcarlas como enviadas y adjuntar'],
    ['resources.upload', 'Subir recursos', 'Archivos y enlaces a Recursos'],
    ['leads.add', 'Añadir leads', 'Registrar clientes potenciales'],
    ['leads.edit', 'Mover leads', 'Cambiar su etapa y sus datos'],
    ['send', 'Enviar mensajes y archivos', 'El botón «Enviar»'],
    ['comment', 'Comentar', 'En publicaciones, peticiones y anuncios'],
  ]],
  ['Su negocio', [
    ['business.edit', 'Editar los datos del negocio', 'Sector, web, redes, horario…'],
  ]],
];
export const PERM_LABEL = Object.fromEntries(PERMS.flatMap(([, list]) => list.map(([k, label]) => [k, label])));
/** Los nombres de sección de antes, para lo que aún los usa. */
export const SECTION_PERM = { cronologia: 'timeline.view', reporte: 'report.view', calendario: 'content.view', rendimiento: 'metrics.view', leads: 'leads.view', recursos: 'resources.view', peticiones: 'tasks.view', enviar: 'send' };
const PERM_SECTION = Object.fromEntries(Object.entries(SECTION_PERM).map(([s, k]) => [k, s]));

/** Lo que trae cada rol: solo lectura ve; equipo, todo menos editar el negocio; dueño, todo. */
export const roleAllows = (role, k) => (role === 'owner' ? true : role === 'member' ? k !== 'business.edit' : k.endsWith('.view'));
/** Lo que un portal permite si nadie lo cambió: ver, decidir y entregar, sí; crear, no. */
export const permDefault = (k) => k.endsWith('.view') || ['content.approve', 'content.reject', 'comment', 'tasks.submit', 'send', 'business.edit'].includes(k);
/** Si el portal lo permite (sin mirar a nadie en concreto). */
export const portalAllows = (portal, k) => !(portal?.hidden || []).includes(PERM_SECTION[k]) && (portal?.perms?.[k] ?? permDefault(k));
/** Si una persona puede hacerlo: su excepción o, si no tiene, su rol dentro de lo que el portal permite. */
export function memberCan(member, portal, k) {
  if (!member) return false;
  const section = PERM_SECTION[k];
  if (section && ((portal?.hidden || []).includes(section) || (member.hidden || []).includes(section))) return false;
  if (member.perms && k in member.perms) return member.perms[k] === true;
  return roleAllows(member.role, k) && (portal?.perms?.[k] ?? permDefault(k));
}

export const brandOf = (client) => ({ ...BRAND_DEFAULTS, ...(client?.brand || {}) });

const loaded = new Set();
export function loadFont(key) {
  const spec = FONTS[key]?.[1];
  if (!spec || key === 'inter' || loaded.has(key)) return;
  loaded.add(key);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.append(link);
}

/** Pone la identidad del cliente en `target` (variables CSS que heredan la app y sus hojas). */
export function applyBrand(target, client, coverUrl) {
  const b = brandOf(client);
  const accent = client?.accent || '#00b8d4';
  target.style.setProperty('--accent', accent);
  target.style.setProperty('--accent-2', b.accent2 || `color-mix(in srgb, ${accent} 62%, #1b66b8)`);
  loadFont(b.font);
  const family = FONTS[b.font]?.[0];
  if (family && b.font !== 'inter') target.style.setProperty('--brand-font', `'${family}', var(--cf-font)`);
  else target.style.removeProperty('--brand-font');
  const [, card, cell, btn] = RADII[b.radius] || RADII.suave;
  target.style.setProperty('--r-card', `${card}px`);
  target.style.setProperty('--r-cell', `${cell}px`);
  target.style.setProperty('--r-btn', `${btn}px`);
  target.dataset.hero = b.hero === 'imagen' && !coverUrl ? 'degradado' : b.hero;
  if (coverUrl) target.style.setProperty('--hero-image', `url("${coverUrl}")`);
  else target.style.removeProperty('--hero-image');
  // El tema del cliente solo manda si la persona no eligió uno en su perfil.
  let chosen = null;
  try {
    chosen = localStorage.getItem('theme');
  } catch {
    // sin almacenamiento
  }
  if (!chosen) {
    if (b.theme === 'light' || b.theme === 'dark') document.documentElement.dataset.theme = b.theme;
    else delete document.documentElement.dataset.theme;
  }
  return b;
}
