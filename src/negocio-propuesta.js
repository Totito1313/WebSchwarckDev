// Negocio: propuestas hechas de bloques (introducción, objetivos, alcance,
// calendario, equipo, testimonios, trabajos y precio).
//
// Un mismo dibujo sirve para editar en el panel y para leer en el enlace
// público: en edición, `F` trae campos editables; en lectura, solo texto.

import { uid, el, icon, iconButton, menu, addIcons } from './negocio-core.js';

addIcons({
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  pen: '<path d="M4 20c3-1 4.5-3.5 7-6l5.5-5.5a2.1 2.1 0 0 0-3-3L8 11c-2.5 2.5-5 4-6 7z"/><path d="M14 20h6"/>',
  bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
});

const item = (fields) => ({ id: uid(), ...fields });

export const BLOCKS = {
  intro: { label: 'Introducción', icon: 'edit', make: () => ({ title: 'Introducción', body: '' }) },
  goals: { label: 'Objetivos', icon: 'flag', make: () => ({ title: 'Objetivos', items: [item({ title: '', text: '' })] }) },
  scope: { label: 'Alcance', icon: 'grid', make: () => ({ title: 'Qué incluye', items: [item({ title: '', text: '' })] }) },
  timeline: { label: 'Calendario', icon: 'calendar', make: () => ({ title: 'Calendario', items: [item({ when: 'Semana 1', title: '', text: '' })] }) },
  team: { label: 'Equipo', icon: 'users', make: () => ({ title: 'Quién lo hace', items: [item({ name: '', role: '', text: '' })] }) },
  testimonials: { label: 'Testimonios', icon: 'message', make: () => ({ title: 'Lo que dicen', items: [item({ quote: '', name: '', role: '' })] }) },
  work: { label: 'Trabajos', icon: 'image', make: () => ({ title: 'Trabajos anteriores', items: [item({ title: '', text: '', image: '' })] }) },
  image: { label: 'Imagen', icon: 'image', make: () => ({ title: '', image: '', caption: '' }) },
  pricing: { label: 'Precio', icon: 'dollar', make: () => ({ title: 'Inversión' }) },
  text: { label: 'Texto libre', icon: 'edit', make: () => ({ title: '', body: '' }) },
};

const ITEM_FIELDS = {
  goals: { title: '', text: '' },
  scope: { title: '', text: '' },
  timeline: { when: '', title: '', text: '' },
  team: { name: '', role: '', text: '' },
  testimonials: { quote: '', name: '', role: '' },
  work: { title: '', text: '', image: '' },
};

export const block = (kind, over = {}) => ({ id: uid(), kind, ...BLOCKS[kind].make(), ...over });

// ── Plantillas ──
// Los textos entre corchetes son para reescribir; los precios empiezan en cero.

const steps = (list) => list.map(([when, title, text]) => item({ when, title, text }));
const pairs = (list) => list.map(([title, text]) => item({ title, text }));

export const PROPOSAL_TEMPLATES = {
  app: {
    label: 'App para Android',
    title: 'Tu app para Android, de la idea a Google Play',
    blocks: () => [
      block('intro', { body: 'Hola [nombre]:\n\nGracias por contarnos tu idea. Esta propuesta explica cómo la convertimos en una app nativa para Android: rápida, cuidada y con tus datos donde deben estar.' }),
      block('goals', { items: pairs([['Una app que se use a diario', 'Pantallas claras, pocas pulsaciones y nada que estorbe.'], ['Publicada en Google Play', 'Con su ficha, sus capturas y lista para crecer.'], ['Fácil de mantener', 'Código ordenado para añadir funciones sin empezar de cero.']]) }),
      block('scope', { items: pairs([['Diseño de pantallas', 'Flujos y diseño en claro y en oscuro.'], ['Desarrollo nativo', 'Kotlin y Jetpack Compose.'], ['Datos y sincronización', '[Guardado local, copia de seguridad o servidor].'], ['Pruebas', 'En teléfonos reales y en Play Console.'], ['Publicación', 'Ficha de Google Play y primera versión.'], ['Acompañamiento', '[30] días de ajustes tras el lanzamiento.']]) }),
      block('timeline', { items: steps([['Semana 1', 'Descubrimiento', 'Objetivos, funciones y prioridades.'], ['Semanas 2–3', 'Diseño', 'Pantallas y prototipo navegable.'], ['Semanas 4–7', 'Desarrollo', 'La app funcionando, con entregas semanales.'], ['Semana 8', 'Pruebas y lanzamiento', 'Ajustes finales y publicación en Google Play.']]) }),
      block('pricing'),
    ],
    items: [['Diseño de la app', 'Flujos y pantallas en claro y en oscuro'], ['Desarrollo para Android', 'Kotlin y Jetpack Compose'], ['Publicación en Google Play', 'Ficha, capturas y primera versión']],
  },
  web: {
    label: 'Sitio web',
    title: 'Diseño y desarrollo de tu sitio web',
    blocks: () => [
      block('intro', { body: 'Hola [nombre]:\n\nEsta propuesta resume cómo vamos a diseñar y construir tu sitio web para que explique bien lo que haces y convierta visitas en clientes.' }),
      block('goals', { items: pairs([['Presencia clara y moderna', 'Que se entienda en segundos qué ofreces.'], ['Más contactos', 'Llamadas a la acción claras en cada página.'], ['Rápido en el teléfono', 'Pensado primero para pantallas pequeñas.']]) }),
      block('scope', { items: pairs([['Estructura y contenidos', 'Mapa del sitio y textos de cada página.'], ['Diseño', 'Diseño propio en claro y en oscuro.'], ['Desarrollo', 'Sitio rápido, accesible y fácil de actualizar.'], ['SEO básico', 'Títulos, descripciones y velocidad.'], ['Publicación', 'Dominio, alojamiento y certificado.'], ['Formación', 'Una sesión para que lo actualices tú.']]) }),
      block('timeline', { items: steps([['Semana 1', 'Estrategia', 'Objetivos, público y estructura.'], ['Semanas 2–3', 'Diseño', 'Propuesta visual de las páginas principales.'], ['Semanas 3–4', 'Desarrollo', 'El sitio funcionando con sus contenidos.'], ['Semana 5', 'Lanzamiento', 'Revisión, ajustes y publicación.']]) }),
      block('pricing'),
    ],
    items: [['Estrategia y estructura', 'Mapa del sitio y contenidos'], ['Diseño', 'Páginas principales en claro y en oscuro'], ['Desarrollo y publicación', 'Sitio rápido, accesible y en línea']],
  },
  brand: {
    label: 'Identidad de marca',
    title: 'Identidad de marca',
    blocks: () => [
      block('intro', { body: 'Hola [nombre]:\n\nUna marca clara hace que te reconozcan y te recuerden. Esta propuesta explica cómo vamos a construir la tuya.' }),
      block('scope', { items: pairs([['Logotipo', 'Versión principal, secundaria e isotipo.'], ['Colores y tipografía', 'Paleta y letras para todo lo que publiques.'], ['Aplicaciones', '[Redes, tarjetas, papelería].'], ['Manual de marca', 'Cómo usarla bien, en un documento.']]) }),
      block('timeline', { items: steps([['Semana 1', 'Investigación', 'Tu negocio, tu público y tu competencia.'], ['Semana 2', 'Propuestas', 'Dos caminos creativos para elegir.'], ['Semana 3', 'Desarrollo', 'El camino elegido, completo.'], ['Semana 4', 'Entrega', 'Archivos finales y manual de marca.']]) }),
      block('pricing'),
    ],
    items: [['Logotipo e isotipo', 'Versiones y archivos finales'], ['Sistema visual', 'Colores, tipografía y aplicaciones'], ['Manual de marca', 'Guía de uso en PDF']],
  },
  blank: {
    label: 'En blanco',
    title: '',
    blocks: () => [block('intro'), block('pricing')],
    items: [],
  },
};

export function applyTemplate(doc, kind) {
  const t = PROPOSAL_TEMPLATES[kind] || PROPOSAL_TEMPLATES.blank;
  doc.title = t.title;
  doc.blocks = t.blocks();
  doc.items = t.items.length ? t.items.map(([name, description]) => ({ id: uid(), name, description, qty: 1, price: 0 })) : [{ id: uid(), name: '', description: '', qty: 1, price: 0 }];
}

// ── Dibujo ──

/** Campos de solo lectura: lo vacío no se pinta. */
export const VIEW = {
  text: (value, _set, { cls = '' } = {}) => (value ? el('span', { class: `pb-t ${cls}`.trim(), text: value }) : null),
  area: (value, _set, { cls = '' } = {}) => (value ? el('p', { class: `pb-p ${cls}`.trim(), text: value }) : null),
};

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * Los bloques de una propuesta.
 * edit: true para el panel; F: los campos; pricing(): lo que va en el bloque de precio;
 * redraw(): repinta tras un cambio de estructura; pickImage(item, done): elige imagen de un trabajo.
 */
export function renderBlocks(doc, { edit = false, F = VIEW, pricing, redraw, touch, pickImage, saveBlock, library } = {}) {
  const blocks = doc.blocks || [];
  const changed = () => {
    touch?.();
    redraw?.();
  };

  const itemTools = (b, it) => edit && iconButton('x', 'Quitar', () => { b.items = b.items.filter((x) => x !== it); changed(); }, 'sh-del no-print pb-item-del');
  const addItem = (b) => edit && el('button', {
    type: 'button',
    class: 'sh-add no-print pb-add',
    onclick: () => {
      const last = b.items[b.items.length - 1];
      const fields = { ...ITEM_FIELDS[b.kind] };
      if (b.kind === 'timeline') fields.when = `Semana ${b.items.length + 1}`;
      if (last && b.kind === 'timeline' && /^Semana\s+(\d+)$/i.test(last.when)) fields.when = `Semana ${Number(last.when.match(/\d+/)[0]) + 1}`;
      b.items.push(item(fields));
      changed();
    },
  }, icon('plus'), 'Añadir');

  function body(b) {
    const set = (obj, key) => (v) => { obj[key] = v; };
    const items = b.items || [];
    switch (b.kind) {
      case 'intro':
      case 'text':
        return F.area(b.body, set(b, 'body'), { cls: 'pb-body', placeholder: 'Cuenta en dos o tres frases qué vas a hacer y por qué.', 'aria-label': b.title || 'Texto' });
      case 'goals':
        return [el('ol', { class: 'pb-goals' }, items.map((it, i) => el('li', {},
          el('span', { class: 'pb-num', text: String(i + 1) }),
          el('div', {}, F.text(it.title, set(it, 'title'), { cls: 'pb-strong', placeholder: 'Objetivo', 'aria-label': 'Objetivo' }), F.area(it.text, set(it, 'text'), { cls: 'is-soft', placeholder: 'Cómo se nota que se cumplió', 'aria-label': 'Detalle del objetivo' })),
          itemTools(b, it),
        ))), addItem(b)];
      case 'scope':
        return [el('div', { class: 'pb-grid' }, items.map((it) => el('div', { class: 'pb-cell' },
          F.text(it.title, set(it, 'title'), { cls: 'pb-strong', placeholder: 'Qué', 'aria-label': 'Parte del alcance' }),
          F.area(it.text, set(it, 'text'), { cls: 'is-soft', placeholder: 'En qué consiste', 'aria-label': 'Detalle' }),
          itemTools(b, it),
        ))), addItem(b)];
      case 'timeline':
        return [el('ol', { class: 'pb-timeline' }, items.map((it) => el('li', {},
          F.text(it.when, set(it, 'when'), { cls: 'pb-when', placeholder: 'Semana 1', 'aria-label': 'Cuándo' }),
          F.text(it.title, set(it, 'title'), { cls: 'pb-strong', placeholder: 'Fase', 'aria-label': 'Fase' }),
          F.area(it.text, set(it, 'text'), { cls: 'is-soft', placeholder: 'Qué pasa en esta fase', 'aria-label': 'Detalle de la fase' }),
          itemTools(b, it),
        ))), addItem(b)];
      case 'team':
        return [el('div', { class: 'pb-team' }, items.map((it) => el('div', { class: 'pb-person' },
          el('span', { class: 'pb-avatar', text: initials(it.name) }),
          F.text(it.name, set(it, 'name'), { cls: 'pb-strong', placeholder: 'Nombre', 'aria-label': 'Nombre' }),
          F.text(it.role, set(it, 'role'), { cls: 'is-soft', placeholder: 'Papel', 'aria-label': 'Papel' }),
          F.area(it.text, set(it, 'text'), { cls: 'is-soft', placeholder: 'Experiencia en una frase', 'aria-label': 'Experiencia' }),
          itemTools(b, it),
        ))), addItem(b)];
      case 'testimonials':
        return [el('div', { class: 'pb-quotes' }, items.map((it) => el('figure', { class: 'pb-quote' },
          F.area(it.quote, set(it, 'quote'), { cls: 'pb-quote-text', placeholder: '«Lo que dijo»', 'aria-label': 'Testimonio' }),
          el('figcaption', {}, F.text(it.name, set(it, 'name'), { cls: 'pb-strong', placeholder: 'Nombre', 'aria-label': 'Quién lo dijo' }), F.text(it.role, set(it, 'role'), { cls: 'is-soft', placeholder: 'Cargo y empresa', 'aria-label': 'Cargo' })),
          itemTools(b, it),
        ))), addItem(b)];
      case 'work':
        return [el('div', { class: 'pb-work' }, items.map((it) => el('figure', { class: 'pb-shot' },
          it.image ? el('img', { src: it.image, alt: it.title || '' }) : edit && el('span', { class: 'pb-shot-empty no-print' }, icon('image')),
          edit && el('button', { type: 'button', class: 'sh-chip no-print pb-shot-pick', onclick: () => pickImage?.(it, changed) }, icon('upload'), it.image ? 'Cambiar imagen' : 'Poner imagen'),
          F.text(it.title, set(it, 'title'), { cls: 'pb-strong', placeholder: 'Proyecto', 'aria-label': 'Proyecto' }),
          F.area(it.text, set(it, 'text'), { cls: 'is-soft', placeholder: 'Qué se hizo y qué se logró', 'aria-label': 'Resultado' }),
          itemTools(b, it),
        ))), addItem(b)];
      case 'image':
        if (!edit && !b.image) return null;
        return el('figure', { class: 'pb-figure' },
          b.image ? el('img', { src: b.image, alt: b.caption || b.title || '' }) : el('button', { type: 'button', class: 'pb-figure-empty no-print', onclick: () => pickImage?.(b, changed) }, icon('upload'), 'Subir una imagen'),
          edit && b.image && el('button', { type: 'button', class: 'sh-chip no-print pb-shot-pick', onclick: () => pickImage?.(b, changed) }, icon('upload'), 'Cambiar imagen'),
          F.text(b.caption, set(b, 'caption'), { cls: 'pb-caption is-soft', placeholder: 'Pie de foto (opcional)', 'aria-label': 'Pie de foto' }),
        );
      case 'pricing':
        return pricing ? pricing() : null;
      default:
        return null;
    }
  }

  const nodes = blocks.map((b, i) => {
    const content = body(b);
    const empty = !edit && (Array.isArray(content) ? !content.flat().filter(Boolean).some((n) => n.childElementCount || n.textContent) : !content);
    if (empty && b.kind !== 'pricing') return null;
    const move = (step) => {
      const j = i + step;
      if (j < 0 || j >= blocks.length) return;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      changed();
    };
    return el('section', { class: `pb pb--${b.kind}` },
      el('header', { class: 'pb-head' },
        edit ? F.text(b.title, (v) => { b.title = v; }, { cls: 'pb-title', placeholder: BLOCKS[b.kind]?.label || 'Título', 'aria-label': 'Título del bloque' }) : b.title && el('h2', { class: 'pb-title', text: b.title }),
        edit && el('span', { class: 'pb-tools no-print' },
          iconButton('up', 'Subir bloque', () => move(-1), i === 0 ? 'is-hidden' : ''),
          iconButton('down', 'Bajar bloque', () => move(1), i === blocks.length - 1 ? 'is-hidden' : ''),
          saveBlock && b.kind !== 'pricing' && iconButton('bookmark', 'Guardar en la biblioteca', () => saveBlock(b)),
          iconButton('trash', 'Quitar bloque', () => { doc.blocks = blocks.filter((x) => x !== b); changed(); }),
        ),
      ),
      content,
    );
  });

  if (edit) {
    const addBtn = el('button', { type: 'button', class: 'sh-chip is-dashed no-print' }, icon('plus'), 'Añadir bloque');
    addBtn.addEventListener('click', () => {
      const saved = library?.() || [];
      menu(addBtn, [
        ...Object.entries(BLOCKS)
          .filter(([kind]) => kind !== 'pricing' || !blocks.some((b) => b.kind === 'pricing'))
          .map(([kind, def]) => ({
            label: def.label,
            icon: def.icon,
            run: () => {
              doc.blocks = [...blocks, block(kind)];
              changed();
            },
          })),
        saved.length > 0 && '-',
        ...saved.map((x) => ({
          label: x.label,
          note: x.note,
          icon: 'bookmark',
          run: () => {
            doc.blocks = [...blocks, x.make()];
            changed();
          },
        })),
      ]);
    });
    nodes.push(el('div', { class: 'pb-addblock no-print' }, addBtn));
  }
  return nodes.filter(Boolean);
}
