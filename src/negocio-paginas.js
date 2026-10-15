// Negocio: páginas. Notas, guías, briefs y actas al estilo de las páginas de
// Runey (y de Notion): cada página tiene icono, portada y bloques —texto,
// títulos, listas, pendientes, citas, destacados, código, imágenes y enlaces—,
// puede colgar de otra página y enlazarse a un cliente o a un proyecto.
//
// Cada bloque se escribe en un campo de texto normal y, sin foco, se lee con
// sus enlaces: la clave de una tarea (CF-12), el número de un documento
// (FAC-2026-0001) o [[otra página]]. Atajos: «/» elige el tipo de bloque, y al
// empezar una línea con #, ##, -, 1., [], > o ``` se convierte sola.

import {
  state, find, put, remove, uid, bus, el, icon, iconButton, menu, picker, popover, confirmBox, toast, dateText, timeText,
  empty, addIcons, avatar,
} from './negocio-core.js';
import { uploadFile, fileUrl } from './negocio-gastos.js';
import { taskKey, projectName, TASK_STATUS } from './negocio-work.js';
import {
  richText, linkable, linkPicker, pageChip, taskChip, docChip, pageTitle, pageIcon, backlinks, renamePageRefs, coverMenu,
  coverNode,
} from './negocio-enlaces.js';

addIcons({
  h1: '<text x="2.5" y="17" font-size="13" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, sans-serif">H1</text>',
  h2: '<text x="2.5" y="17" font-size="13" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, sans-serif">H2</text>',
  h3: '<text x="2.5" y="17" font-size="13" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, sans-serif">H3</text>',
  listNum: '<path d="M10 6h11M10 12h11M10 18h11"/><text x="2" y="9" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">1</text><text x="2" y="15.5" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">2</text><text x="2" y="22" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">3</text>',
  quoteMark: '<path d="M6 7h4v4c0 3-1.4 5-4 6M14 7h4v4c0 3-1.4 5-4 6"/>',
  minus: '<path d="M4 12h16"/>',
  markdown: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M6 15V9l2.5 3L11 9v6M16 9v6M14 13l2 2 2-2"/>',
});

const KINDS = {
  p: ['Texto', 'edit', 'Escribe, o pulsa «/» para elegir un bloque'],
  h1: ['Título', 'h1', 'Título'],
  h2: ['Subtítulo', 'h2', 'Subtítulo'],
  h3: ['Encabezado', 'h3', 'Encabezado'],
  bullet: ['Lista', 'list', 'Elemento'],
  number: ['Lista numerada', 'listNum', 'Elemento'],
  todo: ['Pendiente', 'squareCheck', 'Por hacer'],
  quote: ['Cita', 'quoteMark', 'Cita'],
  callout: ['Destacado', 'spark', 'Algo que no se debe pasar por alto'],
  code: ['Código', 'code', 'Código'],
  divider: ['Separador', 'minus', ''],
  image: ['Imagen', 'image', 'Pie de foto (opcional)'],
  link: ['Enlace a una tarea, página o documento', 'link', ''],
  subpage: ['Subpágina', 'page', ''],
};
const TEXTUAL = new Set(['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code']);
const LISTS = new Set(['bullet', 'number', 'todo']);
const SHORTCUTS = [[/^###\s/, 'h3'], [/^##\s/, 'h2'], [/^#\s/, 'h1'], [/^[-*]\s/, 'bullet'], [/^1[.)]\s/, 'number'], [/^\[ ?\]\s/, 'todo'], [/^>\s/, 'quote'], [/^```$/, 'code'], [/^---$/, 'divider']];

const EMOJIS = ['📄', '📝', '📌', '📎', '📚', '🗂️', '💡', '🚀', '🎯', '✅', '📅', '📊', '📈', '💰', '🧾', '🤝', '👥', '🎨', '🖌️', '📱', '💻', '⚙️', '🔧', '🧪', '🐞', '📣', '✨', '🔥', '⭐', '❤️', '🏁', '📦', '🛒', '🏷️', '🧭', '🏠', '🏢', '🌐', '🔒', '🔑', '🧠', '🎬', '📸', '🎵', '☕', '🍀', '🦁', '🧩'];

const block = (kind, text = '', extra = {}) => ({ id: uid(), kind, text, checked: false, ...extra });

export const PAGE_TEMPLATES = {
  blank: ['En blanco', '📄', 'Una página vacía.', () => []],
  meeting: ['Notas de reunión', '🤝', 'Asistentes, temas, acuerdos y próximos pasos.', () => [
    block('callout', 'Fecha, lugar y objetivo de la reunión.', { emoji: '📅' }),
    block('h2', 'Asistentes'), block('bullet'),
    block('h2', 'Temas'), block('bullet'),
    block('h2', 'Acuerdos'), block('todo'),
    block('h2', 'Próximos pasos'), block('todo', 'Crear las tareas: escribe su clave (CF-12) para enlazarlas'),
  ]],
  brief: ['Brief de proyecto', '🎯', 'Objetivos, público, alcance y fechas clave.', () => [
    block('callout', 'En una frase: qué vamos a hacer y para quién.', { emoji: '🎯' }),
    block('h2', 'Objetivos'), block('number'),
    block('h2', 'Público'), block('p'),
    block('h2', 'Qué incluye'), block('bullet'),
    block('h2', 'Qué no incluye'), block('bullet'),
    block('h2', 'Fechas clave'), block('bullet'),
    block('h2', 'Enlaces'), block('p', 'Tareas, documentos o páginas: escribe su clave, su número o [[su título]].'),
  ]],
  guide: ['Guía o proceso', '📚', 'Cómo se hace algo, paso a paso.', () => [
    block('p', 'Para qué sirve esta guía y cuándo usarla.'),
    block('h2', 'Pasos'), block('number'),
    block('h2', 'Herramientas'), block('bullet'),
    block('h2', 'Preguntas frecuentes'), block('h3'), block('p'),
  ]],
  launch: ['Checklist de lanzamiento', '🚀', 'Lo que hay que tener listo antes, durante y después.', () => [
    block('h2', 'Antes'), block('todo', 'Textos y capturas listos'), block('todo', 'Pruebas en teléfonos reales'), block('todo', 'Ficha de la tienda revisada'),
    block('h2', 'El día'), block('todo', 'Publicar'), block('todo', 'Anunciarlo en redes'),
    block('h2', 'Después'), block('todo', 'Responder reseñas y mensajes'), block('todo', 'Medir resultados'),
  ]],
  content: ['Idea de contenido', '📣', 'Gancho, guion y copy para una publicación.', () => [
    block('callout', 'Marca, formato y objetivo (atraer, enseñar, vender o cuidar a la comunidad).', { emoji: '📣' }),
    block('h2', 'Gancho'), block('p'),
    block('h2', 'Guion'), block('number'),
    block('h2', 'Copy'), block('p'),
    block('h2', 'Llamada a la acción'), block('p'),
  ]],
  retro: ['Retrospectiva', '🔁', 'Qué salió bien, qué mejorar y qué cambiar.', () => [
    block('h2', 'Qué salió bien'), block('bullet'),
    block('h2', 'Qué mejorar'), block('bullet'),
    block('h2', 'Qué haremos distinto'), block('todo'),
  ]],
};

const pages = () => state.pages || [];
const go = (hash) => { location.hash = hash; };
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || pageTitle(a).localeCompare(pageTitle(b));
const byUpdated = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '');
const isRoot = (p) => !p.parentId || !find('pages', p.parentId);
const childrenOf = (id) => pages().filter((p) => p.parentId === id).sort(byOrder);
const localDay = (stamp) => (stamp ? new Date(stamp).toLocaleDateString('en-CA') : '');
const editedText = (p) => (p.updatedAt ? `Editada el ${dateText(localDay(p.updatedAt))}, ${timeText(p.updatedAt)}` : 'Sin guardar todavía');

function ancestors(p) {
  const out = [];
  const seen = new Set();
  let cur = p?.parentId && find('pages', p.parentId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId && find('pages', cur.parentId);
  }
  return out;
}

/** La página y todo lo que cuelga de ella. */
function familyOf(p) {
  const out = [p];
  for (let i = 0; i < out.length; i++) out.push(...childrenOf(out[i].id));
  return out;
}

const readOpen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem('ng-pages-open') || '[]'));
  } catch {
    return new Set();
  }
};
const saveOpen = (set) => {
  try {
    localStorage.setItem('ng-pages-open', JSON.stringify([...set]));
  } catch {
    // Sin almacenamiento el árbol se abre igual en esta visita.
  }
};

// ── Crear ──

/** Crea una página (desde una plantilla, si se pide) y la abre. */
export function createPage({ title = '', parentId = '', customerId = '', projectId = '', template = 'blank', open = true } = {}) {
  const t = PAGE_TEMPLATES[template] || PAGE_TEMPLATES.blank;
  const parent = parentId && find('pages', parentId);
  const page = {
    id: uid(),
    title,
    icon: template === 'blank' ? '' : t[1],
    cover: null,
    parentId,
    customerId: customerId || parent?.customerId || '',
    projectId: projectId || parent?.projectId || '',
    favorite: false,
    order: Date.now(),
    blocks: t[3](),
  };
  if (!page.blocks.length) page.blocks = [block('p')];
  put('pages', page, { now: true })?.catch(() => {});
  if (open) go(`#/paginas/${page.id}`);
  return page;
}

/** Menú de «Nueva página»: en blanco o desde una plantilla. */
export function newPageMenu(anchor, scope = {}, options = {}) {
  menu(anchor, Object.entries(PAGE_TEMPLATES).map(([k, [label, emoji, note]]) => ({
    label: `${emoji}  ${label}`,
    note: k === 'blank' ? '' : note.split(',')[0],
    run: () => createPage({ ...scope, template: k }),
  })), options);
}

// Un [[enlace]] a una página que no existe la crea al tocarlo.
bus.addEventListener('create-page', (e) => {
  const title = String(e.detail?.title || '').trim();
  if (title) createPage({ title });
});

// ── Markdown ──

function toMarkdown(page) {
  const lines = [`# ${pageTitle(page)}`, ''];
  let n = 0;
  for (const b of page.blocks || []) {
    n = b.kind === 'number' ? n + 1 : 0;
    const t = b.text || '';
    switch (b.kind) {
      case 'h1': lines.push(`## ${t}`, ''); break;
      case 'h2': lines.push(`### ${t}`, ''); break;
      case 'h3': lines.push(`#### ${t}`, ''); break;
      case 'bullet': lines.push(`- ${t}`); break;
      case 'number': lines.push(`${n}. ${t}`); break;
      case 'todo': lines.push(`- [${b.checked ? 'x' : ' '}] ${t}`); break;
      case 'quote': lines.push(`> ${t.split('\n').join('\n> ')}`, ''); break;
      case 'callout': lines.push(`> ${b.emoji || '💡'} ${t.split('\n').join('\n> ')}`, ''); break;
      case 'code': lines.push('```', t, '```', ''); break;
      case 'divider': lines.push('---', ''); break;
      case 'image': lines.push(`![${t}](${new URL(b.url || '', location.origin).href})`, ''); break;
      case 'link': {
        const target = b.target === 'page' ? find('pages', b.ref) : b.target === 'task' ? find('tasks', b.ref) : find('docs', b.ref);
        if (target) lines.push(b.target === 'page' ? `[[${pageTitle(target)}]]` : b.target === 'task' ? `${taskKey(target)} ${target.title || ''}` : target.number, '');
        break;
      }
      default: lines.push(t, '');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Piezas ──

function emojiMenu(anchor, onPick, { hasIcon = false } = {}) {
  let pop;
  const box = el('div', { class: 'ng-menu pg-emojis' },
    el('div', { class: 'pg-emoji-grid' }, EMOJIS.map((e) => el('button', { type: 'button', text: e, 'aria-label': e, onclick: () => { pop.hidePopover(); onPick(e); } }))),
    hasIcon && el('button', { type: 'button', class: 'is-danger', onclick: () => { pop.hidePopover(); onPick(''); } }, icon('x'), el('span', { text: 'Quitar icono' })),
  );
  pop = popover(anchor, box);
}

function pageCard(p) {
  const kids = childrenOf(p.id).length;
  const where = [p.projectId && projectName(p.projectId), p.customerId && find('customers', p.customerId)?.name].filter(Boolean).join(' · ');
  return el('a', { class: 'pg-card', href: `#/paginas/${p.id}` },
    el('div', { class: 'pg-card-cover' }, p.cover ? coverNode(p.cover) : null),
    el('span', { class: 'pg-card-icon', text: pageIcon(p) }),
    el('b', { text: pageTitle(p) }),
    el('small', { text: [where, kids && `${kids} ${kids === 1 ? 'subpágina' : 'subpáginas'}`, editedText(p)].filter(Boolean).join(' · ') }),
  );
}

/** Las páginas de un cliente o un proyecto, para su ficha. */
export function pagesCard(scope) {
  const list = pages().filter((p) => (scope.customerId ? p.customerId === scope.customerId : p.projectId === scope.projectId)).sort(byUpdated);
  const add = el('button', { type: 'button', class: 'pill ghost sm' }, icon('plus'), 'Nueva página', icon('down'));
  add.addEventListener('click', () => newPageMenu(add, scope, { align: 'end' }));
  return el('section', { class: 'ng-card ng-list' },
    el('header', { class: 'ng-card-head' },
      el('div', {}, el('h2', { text: 'Páginas' }), el('small', { text: list.length ? `${list.length} en total` : 'Notas, briefs y actas de reunión' })),
      add,
    ),
    list.length ? el('div', { class: 'ng-rows' }, list.map((p) => el('a', { class: 'ng-row is-item', href: `#/paginas/${p.id}` },
      el('span', { class: 'ng-row-ico pg-row-emoji', text: pageIcon(p) }),
      el('span', { class: 'ng-row-main' }, el('b', { text: pageTitle(p) }), el('small', { text: editedText(p) })),
      icon('right'),
    ))) : el('p', { class: 'ng-hint', text: 'Todavía no hay páginas aquí.' }),
  );
}

// ── Barra lateral ──

function sideBar(currentId) {
  const box = el('aside', { class: 'pg-side', 'aria-label': 'Páginas' });
  const open = readOpen();
  for (const a of ancestors(find('pages', currentId))) open.add(a.id);
  let q = '';
  const search = el('input', { type: 'search', class: 'pg-side-search', placeholder: 'Buscar páginas…', 'aria-label': 'Buscar páginas' });
  search.addEventListener('input', () => {
    q = search.value.trim().toLowerCase();
    drawTree();
  });
  const treeBox = el('nav', { class: 'pg-tree' });
  const add = el('button', { type: 'button', class: 'pill sm pg-side-new' }, icon('plus'), 'Nueva página');
  add.addEventListener('click', () => newPageMenu(add));

  const row = (p, depth) => {
    const kids = childrenOf(p.id);
    const isOpen = open.has(p.id);
    const toggle = kids.length
      ? el('button', {
        type: 'button',
        class: `pg-tree-toggle${isOpen ? ' is-open' : ''}`,
        'aria-label': isOpen ? 'Cerrar' : 'Abrir',
        'aria-expanded': String(isOpen),
        onclick: () => {
          if (isOpen) open.delete(p.id);
          else open.add(p.id);
          saveOpen(open);
          drawTree();
        },
      }, icon('right'))
      : el('span', { class: 'pg-tree-toggle is-leaf' });
    const addKid = iconButton('plus', 'Añadir subpágina', () => {
      open.add(p.id);
      saveOpen(open);
      createPage({ parentId: p.id });
    }, 'is-sm pg-tree-add');
    return [
      el('div', { class: `pg-tree-row${p.id === currentId ? ' is-on' : ''}`, style: { '--d': depth } },
        toggle,
        el('a', { href: `#/paginas/${p.id}`, 'aria-current': p.id === currentId ? 'page' : null }, el('span', { class: 'pg-tree-emoji', text: pageIcon(p) }), el('span', { class: 'pg-tree-title', text: pageTitle(p) })),
        addKid,
      ),
      isOpen && kids.map((k) => row(k, depth + 1)),
    ];
  };

  function drawTree() {
    const all = pages();
    if (q) {
      const found = all.filter((p) => `${pageTitle(p)} ${(p.blocks || []).map((b) => b.text || '').join(' ')}`.toLowerCase().includes(q)).sort(byUpdated);
      treeBox.replaceChildren(found.length ? el('div', {}, found.map((p) => row(p, 0))) : el('p', { class: 'pg-side-none', text: 'Ninguna página coincide.' }));
      return;
    }
    const favs = all.filter((p) => p.favorite).sort(byOrder);
    treeBox.replaceChildren(...[
      favs.length > 0 && el('div', { class: 'pg-tree-group' }, el('small', { text: 'Favoritas' }), favs.map((p) => row(p, 0))),
      el('div', { class: 'pg-tree-group' },
        el('small', { text: 'Todas' }),
        all.length ? all.filter(isRoot).sort(byOrder).map((p) => row(p, 0)) : el('p', { class: 'pg-side-none', text: 'Todavía no hay páginas.' }),
      ),
    ].filter(Boolean));
  }

  box.append(
    el('div', { class: 'pg-side-head' }, el('a', { class: 'pg-side-title', href: '#/paginas' }, icon('page'), 'Páginas'), add),
    el('label', { class: 'ng-search pg-side-find' }, icon('search'), search),
    treeBox,
  );
  drawTree();
  return { node: box, refresh: drawTree };
}

// ── Portada de la sección ──

function overview() {
  const box = el('div', { class: 'pg-overview' });
  const draw = () => {
    const all = pages();
    const favs = all.filter((p) => p.favorite).sort(byOrder);
    const recent = [...all].sort(byUpdated).slice(0, 12);
    const add = el('button', { type: 'button', class: 'pill' }, icon('plus'), 'Nueva página', icon('down'));
    add.addEventListener('click', () => newPageMenu(add, {}, { align: 'end' }));
    box.replaceChildren(...[
      el('header', { class: 'ng-head' },
        el('div', {}, el('h1', { text: 'Páginas' }), el('p', { text: 'Notas, guías, briefs y actas. Enlázalas desde cualquier tarea o página escribiendo [[su título]]; dentro, la clave de una tarea o el número de un documento se convierten en enlaces.' })),
        el('div', { class: 'ng-head-actions' }, add),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Empieza desde una plantilla' }), el('p', { text: 'Todo se puede cambiar después.' }))),
        el('div', { class: 'pg-templates' }, Object.entries(PAGE_TEMPLATES).map(([k, [label, emoji, note]]) => el('button', { type: 'button', class: 'pg-template', onclick: () => createPage({ template: k }) },
          el('span', { class: 'pg-template-emoji', text: emoji }), el('b', { text: label }), el('small', { text: note }),
        ))),
      ),
      favs.length > 0 && el('section', { class: 'pg-section' }, el('h2', { text: 'Favoritas' }), el('div', { class: 'pg-cards' }, favs.map(pageCard))),
      el('section', { class: 'pg-section' },
        el('h2', { text: 'Recientes' }),
        recent.length ? el('div', { class: 'pg-cards' }, recent.map(pageCard)) : el('div', { class: 'ng-card' }, empty({
          ico: 'page',
          title: 'Todavía no hay páginas',
          text: 'Crea una para tus notas de reunión, el brief de un proyecto o una guía de trabajo.',
          action: el('button', { type: 'button', class: 'pill', onclick: () => createPage({ template: 'blank' }) }, icon('plus'), 'Nueva página'),
        })),
      ),
    ].filter(Boolean));
  };
  draw();
  return { node: box, refresh: draw };
}

// ── El editor ──

function editor(id, side) {
  const page = find('pages', id);
  const box = el('article', { class: 'pg-main' });
  if (!page) {
    box.append(el('div', { class: 'ng-card' }, empty({ ico: 'page', title: 'Esa página ya no existe', action: el('a', { class: 'pill', href: '#/paginas', text: 'Ver páginas' }) })));
    return { node: box, refresh() {}, destroy() {} };
  }
  page.blocks ||= [];
  let saveTimer = 0;
  let savedTitle = page.title || '';
  let dragId = null;
  const marker = el('div', { class: 'pg-drop', 'aria-hidden': 'true' });
  const coverBox = el('div', { class: 'pg-cover-slot' });
  const headBox = el('div', { class: 'pg-head' });
  const blocksBox = el('div', { class: 'pg-blocks' });
  const footBox = el('div', { class: 'pg-foot' });

  const flush = () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    put('pages', page);
  };
  // Se guarda tras dos segundos sin escribir (o al salir): cada guardado es una
  // escritura del almacén, y el plan gratuito de KV admite unas mil al día.
  const touch = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 2000);
  };
  const flushPending = () => {
    if (saveTimer) flush();
  };
  const changed = () => {
    flush();
    drawBlocks();
  };

  const at = (b) => page.blocks.indexOf(b);
  const textual = (b) => b && TEXTUAL.has(b.kind);
  function focusBlock(blockId, where = 'end') {
    const area = blocksBox.querySelector(`[data-id="${blockId}"] .pg-in`);
    if (!area) return;
    area.focus();
    const pos = where === 'start' ? 0 : where === 'end' ? area.value.length : Math.min(Number(where) || 0, area.value.length);
    area.setSelectionRange(pos, pos);
  }
  function insertAfter(ref, b) {
    const i = ref ? at(ref) : page.blocks.length - 1;
    page.blocks.splice(i + 1, 0, b);
    return b;
  }

  // ── Cabecera ──

  function drawCover() {
    if (!page.cover) {
      coverBox.replaceChildren();
      return;
    }
    const change = el('button', { type: 'button', class: 'pill ghost sm' }, icon('image'), 'Cambiar portada');
    change.addEventListener('click', () => coverMenu(change, setCover, { hasCover: true }));
    coverBox.replaceChildren(el('div', { class: 'pg-cover' }, coverNode(page.cover), el('div', { class: 'pg-cover-tools' }, change)));
  }
  const setCover = (c) => {
    page.cover = c;
    flush();
    drawCover();
    drawHead();
  };

  function pickWhere(anchor, kind) {
    const isCustomer = kind === 'customer';
    picker(anchor, {
      placeholder: isCustomer ? 'Buscar cliente…' : 'Buscar proyecto…',
      items: () => (isCustomer ? [...state.customers] : [...state.projects]).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      label: (x) => x.name || 'Sin nombre',
      sub: (x) => (isCustomer ? x.company || x.email || '' : find('customers', x.customerId)?.name || 'Sin cliente'),
      onPick: (x) => {
        if (isCustomer) page.customerId = x.id;
        else {
          page.projectId = x.id;
          if (!page.customerId && x.customerId) page.customerId = x.customerId;
        }
        flush();
        drawHead();
      },
      extra: (isCustomer ? page.customerId : page.projectId) && el('button', {
        type: 'button',
        class: 'ng-pick-new',
        onclick: () => {
          if (isCustomer) page.customerId = '';
          else page.projectId = '';
          flush();
          drawHead();
        },
      }, icon('x'), isCustomer ? 'Sin cliente' : 'Sin proyecto'),
    });
  }

  function drawHead() {
    const crumbs = ancestors(page);
    const iconBtn = el('button', { type: 'button', class: `pg-icon${page.icon ? '' : ' is-empty'}`, 'aria-label': page.icon ? 'Cambiar icono' : 'Añadir icono', text: page.icon || '' });
    iconBtn.addEventListener('click', () => emojiMenu(iconBtn, (e) => { page.icon = e; flush(); drawHead(); side?.refresh(); }, { hasIcon: Boolean(page.icon) }));
    const addIcon = !page.icon && el('button', { type: 'button', class: 'pg-tool', onclick: (e) => emojiMenu(e.currentTarget, (x) => { page.icon = x; flush(); drawHead(); side?.refresh(); }) }, icon('spark'), 'Añadir icono');
    const addCover = !page.cover && el('button', { type: 'button', class: 'pg-tool', onclick: (e) => coverMenu(e.currentTarget, setCover) }, icon('image'), 'Añadir portada');

    const title = el('textarea', { class: 'pg-title', rows: 1, value: page.title || '', placeholder: 'Sin título', maxLength: 200, 'aria-label': 'Título de la página' });
    const fitTitle = () => {
      title.style.height = 'auto';
      title.style.height = `${title.scrollHeight}px`;
    };
    title.addEventListener('input', () => {
      page.title = title.value.replace(/\n/g, ' ');
      fitTitle();
      touch();
      document.title = `${pageTitle(page)} | Negocio`;
    });
    title.addEventListener('change', () => {
      // Los [[enlaces]] al título viejo pasan al nuevo.
      if (savedTitle && savedTitle !== page.title) renamePageRefs(savedTitle, page.title, put);
      savedTitle = page.title;
      flush();
      side?.refresh();
    });
    title.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = page.blocks.find(textual);
      if (first) focusBlock(first.id, 'start');
      else {
        page.blocks.unshift(block('p'));
        changed();
        focusBlock(page.blocks[0].id);
      }
    });
    requestAnimationFrame(fitTitle);

    const customer = page.customerId && find('customers', page.customerId);
    const project = page.projectId && find('projects', page.projectId);
    const custBtn = el('button', { type: 'button', class: 'ng-chipbtn is-plain' }, customer ? avatar(customer.name, 'is-sm') : icon('users'), el('span', { text: customer?.name || 'Cliente' }));
    custBtn.addEventListener('click', () => pickWhere(custBtn, 'customer'));
    const projBtn = el('button', { type: 'button', class: 'ng-chipbtn is-plain' }, icon('folder'), el('span', { text: project?.name || 'Proyecto' }));
    projBtn.addEventListener('click', () => pickWhere(projBtn, 'project'));
    const star = el('button', {
      type: 'button',
      class: `ng-ibtn is-sm pg-star${page.favorite ? ' is-on' : ''}`,
      'aria-pressed': String(Boolean(page.favorite)),
      'aria-label': page.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas',
      title: page.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas',
      onclick: () => {
        page.favorite = !page.favorite;
        flush();
        drawHead();
        side?.refresh();
      },
    }, icon(page.favorite ? 'starOn' : 'star'));
    const more = iconButton('more', 'Más acciones', () => menu(more, [
      { label: 'Añadir subpágina', icon: 'page', run: () => createPage({ parentId: page.id }) },
      { label: 'Mover a…', icon: 'folder', run: () => moveTo(more) },
      { label: 'Duplicar', icon: 'copy', run: duplicate },
      '-',
      { label: 'Copiar como Markdown', icon: 'markdown', run: copyMarkdown },
      { label: 'Imprimir o PDF', icon: 'printer', run: printPage },
      '-',
      { label: 'Eliminar página', icon: 'trash', danger: true, run: destroy },
    ], { align: 'end' }), 'is-sm');

    headBox.replaceChildren(...[
      el('div', { class: 'pg-topbar' },
        el('a', { class: 'ng-ibtn is-sm pg-back', href: '#/paginas', 'aria-label': 'Todas las páginas', title: 'Todas las páginas' }, icon('back')),
        el('nav', { class: 'pg-crumbs', 'aria-label': 'Ruta' },
          el('a', { href: '#/paginas', text: 'Páginas' }),
          crumbs.map((c) => [el('span', { text: '/' }), el('a', { href: `#/paginas/${c.id}`, text: `${c.icon ? `${c.icon} ` : ''}${pageTitle(c)}` })]),
        ),
        el('span', { class: 'ng-grow' }),
        el('small', { class: 'pg-edited', text: editedText(page) }),
        star,
        more,
      ),
      page.icon && iconBtn,
      (addIcon || addCover) && el('div', { class: 'pg-tools' }, addIcon, addCover),
      title,
      el('div', { class: 'pg-props' }, custBtn, projBtn),
    ].filter(Boolean));
  }

  // ── Bloques ──

  function numberOf(i) {
    let n = 1;
    for (let j = i - 1; j >= 0 && page.blocks[j].kind === 'number'; j--) n += 1;
    return n;
  }

  function convert(b, kind) {
    if (kind === 'divider') {
      b.kind = 'divider';
      b.text = '';
      const next = insertAfter(b, block('p'));
      changed();
      focusBlock(next.id, 'start');
      return;
    }
    if (kind === 'image') {
      pickImage((url) => {
        b.kind = 'image';
        b.url = url;
        b.text = '';
        changed();
      });
      return;
    }
    if (kind === 'link') {
      linkPicker(blocksBox.querySelector(`[data-id="${b.id}"]`) || blocksBox, (x) => {
        Object.assign(b, { kind: 'link', target: x.kind, ref: x.item.id, text: '' });
        const next = insertAfter(b, block('p'));
        changed();
        focusBlock(next.id, 'start');
      });
      return;
    }
    if (kind === 'subpage') {
      const child = createPage({ parentId: page.id, open: false });
      Object.assign(b, { kind: 'link', target: 'page', ref: child.id, text: '' });
      changed();
      side?.refresh();
      go(`#/paginas/${child.id}`);
      return;
    }
    b.kind = kind;
    if (kind === 'callout' && !b.emoji) b.emoji = '💡';
    changed();
    focusBlock(b.id, 'end');
  }

  function pickImage(done) {
    const fileIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      toast('Subiendo imagen…');
      try {
        done(fileUrl((await uploadFile(f)).id));
        toast('Imagen lista.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    fileIn.click();
  }

  async function addImages(files, after) {
    let ref = after;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      toast(`Subiendo ${f.name || 'imagen'}…`);
      try {
        const b = block('image', '', { url: fileUrl((await uploadFile(f)).id) });
        if (ref) insertAfter(ref, b);
        else page.blocks.push(b);
        ref = b;
        changed();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  }

  function kindPicker(anchor, b, { replaceSlash = false } = {}) {
    const choices = Object.entries(KINDS).map(([k, [label, ico]]) => ({ k, label, ico }));
    picker(anchor, {
      placeholder: 'Buscar un tipo de bloque…',
      items: () => choices,
      label: (x) => x.label,
      sub: (x) => ({ p: 'Párrafo', h1: '#', h2: '##', h3: '###', bullet: '-', number: '1.', todo: '[]', quote: '>', code: '```', divider: '---', image: 'Sube una foto o captura', link: 'La clave, el número o [[el título]]', subpage: 'Una página dentro de esta' }[x.k] || ''),
      onPick: (x) => {
        if (replaceSlash && b.text === '/') b.text = '';
        convert(b, x.k);
      },
    });
  }

  function blockMenu(anchor, b) {
    const i = at(b);
    const kinds = textual(b) ? ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code'].filter((k) => k !== b.kind) : [];
    menu(anchor, [
      ...kinds.map((k) => ({ label: `Convertir en ${KINDS[k][0].toLowerCase()}`, icon: KINDS[k][1], run: () => convert(b, k) })),
      kinds.length && '-',
      { label: 'Duplicar', icon: 'copy', run: () => { const copy = { ...structuredClone(b), id: uid() }; insertAfter(b, copy); changed(); } },
      { label: 'Subir', icon: 'up', disabled: i === 0, run: () => { page.blocks.splice(i, 1); page.blocks.splice(i - 1, 0, b); changed(); } },
      { label: 'Bajar', icon: 'down', disabled: i === page.blocks.length - 1, run: () => { page.blocks.splice(i, 1); page.blocks.splice(i + 1, 0, b); changed(); } },
      '-',
      { label: 'Eliminar bloque', icon: 'trash', danger: true, run: () => { page.blocks = page.blocks.filter((x) => x !== b); if (!page.blocks.length) page.blocks.push(block('p')); changed(); } },
    ]);
  }

  function wrapSelection(area, mark) {
    const { selectionStart: s, selectionEnd: e, value } = area;
    const inner = value.slice(s, e) || 'texto';
    area.value = `${value.slice(0, s)}${mark}${inner}${mark}${value.slice(e)}`;
    area.setSelectionRange(s + mark.length, s + mark.length + inner.length);
    area.dispatchEvent(new Event('input'));
  }

  function textBox(b) {
    const area = linkable(el('textarea', {
      class: 'pg-in',
      rows: 1,
      value: b.text || '',
      placeholder: KINDS[b.kind]?.[2] || '',
      spellcheck: b.kind !== 'code',
      wrap: b.kind === 'code' ? 'off' : null,
      'aria-label': KINDS[b.kind]?.[0] || 'Texto',
    }));
    const view = el('div', { class: 'pg-view' });
    const box = el('div', { class: 'pg-text' }, view, area);
    const fit = () => {
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight}px`;
    };
    const drawView = () => {
      view.replaceChildren(...(b.kind === 'code' ? [b.text || ''] : richText(b.text)));
      box.classList.toggle('is-empty', !(b.text || '').length);
    };
    drawView();

    area.addEventListener('input', () => {
      b.text = area.value;
      box.classList.toggle('is-empty', !b.text.length);
      fit();
      touch();
      if (b.text === '/') {
        kindPicker(box, b, { replaceSlash: true });
        return;
      }
      if (b.kind === 'p' || (/^#/.test(b.text) && /^h[123]$/.test(b.kind))) {
        for (const [re, kind] of SHORTCUTS) {
          const m = re.exec(b.text);
          if (!m) continue;
          const caret = Math.max(0, area.selectionStart - m[0].length);
          b.text = b.text.slice(m[0].length);
          convert(b, kind);
          focusBlock(b.id, caret);
          return;
        }
      }
    });
    area.addEventListener('focus', fit);
    area.addEventListener('blur', drawView);
    area.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      addImages(files, b);
    });
    area.addEventListener('keydown', (e) => {
      const i = at(b);
      const { selectionStart: s, selectionEnd: end, value } = area;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
        e.preventDefault();
        wrapSelection(area, e.key === 'b' ? '**' : '*');
        return;
      }
      if (e.key === 'Tab' && b.kind === 'code') {
        e.preventDefault();
        area.setRangeText('  ', s, end, 'end');
        area.dispatchEvent(new Event('input'));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        if (b.kind === 'code' && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        if (LISTS.has(b.kind) && !value.trim()) {
          b.kind = 'p';
          changed();
          focusBlock(b.id, 'start');
          return;
        }
        b.text = value.slice(0, s);
        const next = insertAfter(b, block(LISTS.has(b.kind) ? b.kind : 'p', value.slice(end)));
        changed();
        focusBlock(next.id, 'start');
        return;
      }
      if (e.key === 'Backspace' && s === 0 && end === 0) {
        if (b.kind !== 'p') {
          e.preventDefault();
          b.kind = 'p';
          changed();
          focusBlock(b.id, 'start');
          return;
        }
        const prev = page.blocks[i - 1];
        if (!prev) return;
        e.preventDefault();
        if (textual(prev)) {
          const join = (prev.text || '').length;
          prev.text = (prev.text || '') + value;
          page.blocks.splice(i, 1);
          changed();
          focusBlock(prev.id, join);
        } else if (!value) {
          page.blocks.splice(i, 1);
          changed();
          const before = page.blocks.slice(0, i).reverse().find(textual);
          if (before) focusBlock(before.id);
        } else if (prev.kind === 'divider') {
          page.blocks.splice(i - 1, 1);
          changed();
          focusBlock(b.id, 'start');
        }
        return;
      }
      if (e.key === 'ArrowUp' && !e.shiftKey && !value.slice(0, s).includes('\n')) {
        const prev = page.blocks.slice(0, i).reverse().find(textual);
        if (prev) {
          e.preventDefault();
          focusBlock(prev.id, 'end');
        }
        return;
      }
      if (e.key === 'ArrowDown' && !e.shiftKey && !value.slice(end).includes('\n')) {
        const next = page.blocks.slice(i + 1).find(textual);
        if (next) {
          e.preventDefault();
          focusBlock(next.id, 'start');
        }
      }
    });
    view.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    });
    return box;
  }

  function linkCard(b) {
    const target = b.target === 'page' ? find('pages', b.ref) : b.target === 'task' ? find('tasks', b.ref) : find('docs', b.ref);
    if (!target) return el('div', { class: 'pg-linkcard is-missing' }, icon('link'), 'Lo enlazado ya no existe.');
    if (b.target === 'page') {
      const kids = childrenOf(target.id).length;
      return el('a', { class: 'pg-linkcard', href: `#/paginas/${target.id}` },
        el('span', { class: 'pg-linkcard-emoji', text: pageIcon(target) }),
        el('span', { class: 'pg-linkcard-text' }, el('b', { text: pageTitle(target) }), el('small', { text: [kids && `${kids} ${kids === 1 ? 'subpágina' : 'subpáginas'}`, editedText(target)].filter(Boolean).join(' · ') })),
        icon('right'),
      );
    }
    if (b.target === 'task') {
      const [label, color] = TASK_STATUS[target.status] || TASK_STATUS.todo;
      return el('div', { class: 'pg-linkcard is-task' }, taskChip(target), el('span', { class: 'ng-tag', style: { '--c': color }, text: label }), el('small', { text: projectName(target.projectId) || 'Sin proyecto' }));
    }
    return el('div', { class: 'pg-linkcard is-doc' }, docChip(target), el('small', { text: target.customer?.name || '' }));
  }

  function blockNode(b, i) {
    const handle = el('button', { type: 'button', class: 'pg-handle', draggable: true, 'aria-label': 'Opciones del bloque', title: 'Arrastra para mover · toca para ver opciones' }, icon('drag'));
    handle.addEventListener('click', () => blockMenu(handle, b));
    handle.addEventListener('dragstart', (e) => {
      dragId = b.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', b.id);
      const row = handle.closest('.pg-block');
      e.dataTransfer.setDragImage(row, 20, 16);
      requestAnimationFrame(() => row.classList.add('is-dragging'));
    });
    handle.addEventListener('dragend', () => {
      dragId = null;
      marker.remove();
      for (const r of blocksBox.querySelectorAll('.is-dragging')) r.classList.remove('is-dragging');
    });

    let mark = el('span', { class: 'pg-mark' });
    if (b.kind === 'bullet') mark = el('span', { class: 'pg-mark is-dot', 'aria-hidden': 'true' }, el('i'));
    if (b.kind === 'number') mark = el('span', { class: 'pg-mark is-num', text: `${numberOf(i)}.` });
    if (b.kind === 'todo') {
      mark = el('span', { class: 'pg-mark' }, el('button', {
        type: 'button',
        class: 'ng-check pg-todo',
        'aria-pressed': String(Boolean(b.checked)),
        'aria-label': b.checked ? 'Desmarcar' : 'Marcar como hecho',
        onclick: () => { b.checked = !b.checked; changed(); },
      }, icon('check')));
    }

    let content;
    if (textual(b) && b.kind === 'callout') {
      const emoji = el('button', { type: 'button', class: 'pg-callout-emoji', text: b.emoji || '💡', 'aria-label': 'Cambiar el icono del destacado' });
      emoji.addEventListener('click', () => emojiMenu(emoji, (x) => { b.emoji = x || '💡'; changed(); }));
      content = el('div', { class: 'pg-callout' }, emoji, textBox(b));
    } else if (textual(b)) content = b.kind === 'code' ? el('div', { class: 'pg-code' }, textBox(b)) : textBox(b);
    else if (b.kind === 'divider') content = el('hr', { class: 'pg-hr' });
    else if (b.kind === 'image') {
      content = el('figure', { class: 'pg-figure' },
        b.url ? el('img', { src: b.url, alt: b.text || '', loading: 'lazy' }) : el('button', { type: 'button', class: 'pg-figure-empty', onclick: () => pickImage((url) => { b.url = url; changed(); }) }, icon('upload'), 'Subir una imagen'),
        el('figcaption', {}, textBox(b)),
      );
    } else if (b.kind === 'link') content = linkCard(b);
    else content = el('div');

    return el('div', { class: `pg-block is-${b.kind}${b.kind === 'todo' && b.checked ? ' is-checked' : ''}`, data: { id: b.id } }, handle, mark, content);
  }

  function drawBlocks() {
    const focused = document.activeElement?.closest?.('.pg-block')?.dataset.id;
    blocksBox.replaceChildren(...page.blocks.map(blockNode));
    if (focused && !blocksBox.contains(document.activeElement)) {
      const area = blocksBox.querySelector(`[data-id="${focused}"] .pg-in`);
      if (area) area.focus();
    }
    drawFoot();
  }

  // Arrastrar bloques con su asa, y soltar imágenes desde el ordenador.
  blocksBox.addEventListener('dragover', (e) => {
    const files = e.dataTransfer?.types?.includes('Files');
    if (!dragId && !files) return;
    e.preventDefault();
    const rows = [...blocksBox.querySelectorAll('.pg-block:not(.is-dragging)')];
    const next = rows.find((r) => {
      const rect = r.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });
    blocksBox.insertBefore(marker, next || null);
  });
  blocksBox.addEventListener('dragleave', (e) => {
    if (!blocksBox.contains(e.relatedTarget)) marker.remove();
  });
  blocksBox.addEventListener('drop', (e) => {
    e.preventDefault();
    const nextId = marker.nextElementSibling?.dataset?.id;
    marker.remove();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) {
      const nextIndex = nextId ? page.blocks.findIndex((x) => x.id === nextId) : page.blocks.length;
      addImages(files, page.blocks[nextIndex - 1] || null);
      return;
    }
    const b = dragId && page.blocks.find((x) => x.id === dragId);
    if (!b || b.id === nextId) return;
    page.blocks = page.blocks.filter((x) => x !== b);
    const to = nextId ? page.blocks.findIndex((x) => x.id === nextId) : page.blocks.length;
    page.blocks.splice(to < 0 ? page.blocks.length : to, 0, b);
    changed();
  });

  function drawFoot() {
    const kids = childrenOf(page.id);
    const linked = new Set(page.blocks.filter((b) => b.kind === 'link' && b.target === 'page').map((b) => b.ref));
    const loose = kids.filter((k) => !linked.has(k.id));
    const back = backlinks('page', page.id);
    const addBlock = el('button', { type: 'button', class: 'pg-addblock' }, icon('plus'), 'Añadir un bloque');
    addBlock.addEventListener('click', () => {
      const last = page.blocks.at(-1);
      if (last && textual(last) && !last.text) {
        kindPicker(addBlock, last);
        return;
      }
      const b = block('p');
      page.blocks.push(b);
      changed();
      focusBlock(b.id);
    });
    footBox.replaceChildren(...[
      addBlock,
      loose.length > 0 && el('section', { class: 'pg-sub' },
        el('h3', { text: 'Subpáginas' }),
        el('div', { class: 'pg-sub-list' }, loose.map((k) => linkCard({ target: 'page', ref: k.id }))),
      ),
      back.length > 0 && el('section', { class: 'pg-sub' },
        el('h3', { text: 'La mencionan' }),
        el('div', { class: 'pg-back' }, back.map((x) => (x.kind === 'page' ? pageChip(x.item) : taskChip(x.item)))),
      ),
    ].filter(Boolean));
  }

  // ── Acciones ──

  function moveTo(anchor) {
    const banned = new Set(familyOf(page).map((p) => p.id));
    picker(anchor, {
      placeholder: 'Mover dentro de…',
      items: () => pages().filter((p) => !banned.has(p.id)).sort(byOrder),
      label: (p) => `${pageIcon(p)}  ${pageTitle(p)}`,
      sub: (p) => ancestors(p).map(pageTitle).join(' / ') || 'Página principal',
      onPick: (p) => {
        page.parentId = p.id;
        flush();
        drawHead();
        side?.refresh();
        toast(`Ahora está dentro de «${pageTitle(p)}».`);
      },
      extra: page.parentId && el('button', { type: 'button', class: 'ng-pick-new', onclick: () => { page.parentId = ''; flush(); drawHead(); side?.refresh(); } }, icon('up'), 'Sacarla a la raíz'),
    });
  }

  function duplicate() {
    const copy = { ...structuredClone(page), id: uid(), title: `${pageTitle(page)} (copia)`, favorite: false, order: Date.now() };
    copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid() }));
    delete copy.createdAt;
    delete copy.updatedAt;
    put('pages', copy, { now: true })?.catch(() => {});
    toast('Página duplicada.');
    go(`#/paginas/${copy.id}`);
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(toMarkdown(page));
      toast('Copiada como Markdown.');
    } catch {
      toast('No se pudo copiar.', 'error');
    }
  }

  function printPage() {
    flush();
    const before = document.title;
    document.title = pageTitle(page);
    addEventListener('afterprint', () => { document.title = before; }, { once: true });
    print();
  }

  async function destroy() {
    const family = familyOf(page);
    const extra = family.length > 1 ? ` También se borran sus ${family.length - 1} ${family.length === 2 ? 'subpágina' : 'subpáginas'}.` : '';
    if (!(await confirmBox(`¿Eliminar «${pageTitle(page)}»?${extra}`))) return;
    clearTimeout(saveTimer);
    for (const p of family) remove('pages', p.id);
    toast('Página eliminada.');
    go(page.parentId && find('pages', page.parentId) ? `#/paginas/${page.parentId}` : '#/paginas');
  }

  drawCover();
  drawHead();
  drawBlocks();
  addEventListener('visibilitychange', flushPending);
  addEventListener('beforeunload', flushPending);
  box.append(coverBox, el('div', { class: 'pg-doc' }, headBox, blocksBox, footBox));
  blocksBox.addEventListener('click', (e) => {
    // Tocar debajo del último bloque es seguir escribiendo.
    if (e.target !== blocksBox) return;
    const last = page.blocks.at(-1);
    if (last && textual(last) && !last.text) focusBlock(last.id);
    else {
      const b = block('p');
      page.blocks.push(b);
      changed();
      focusBlock(b.id);
    }
  });
  if (!page.title) setTimeout(() => headBox.querySelector('.pg-title')?.focus());

  return {
    node: box,
    // Lo que cambia fuera (otra pestaña, una tarea renombrada) se ve sin pisar lo que se escribe.
    refresh: () => {
      if (box.contains(document.activeElement)) return;
      drawFoot();
      if (!saveTimer) drawBlocks();
    },
    destroy: () => {
      removeEventListener('visibilitychange', flushPending);
      removeEventListener('beforeunload', flushPending);
      flushPending();
      if (savedTitle && savedTitle !== page.title) renamePageRefs(savedTitle, page.title, put);
    },
  };
}

// ── La sección ──

export function pagesPage(id = '') {
  const side = sideBar(id);
  const main = id ? editor(id, side) : overview();
  const node = el('div', { class: `pg-layout${id ? ' is-editing' : ''}` }, side.node, main.node);
  const p = id && find('pages', id);
  return {
    node,
    title: p ? `${pageTitle(p)} | Negocio` : '',
    refresh: () => {
      if (!side.node.contains(document.activeElement)) side.refresh();
      main.refresh();
    },
    destroy: () => main.destroy?.(),
  };
}
