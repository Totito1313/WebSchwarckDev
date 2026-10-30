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
