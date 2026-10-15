// Negocio: enlaces entre tareas, páginas y documentos, al estilo de Linear, y
// las portadas que comparten tareas y páginas.
//
// Basta con escribir la clave de una tarea (CF-12), el número de un documento
// (FAC-2026-0001) o [[el título de una página]]: al leer, ese texto es un
// enlace. Escribir [[ abre un buscador para elegir qué enlazar. También se
// entienden **negrita**, *cursiva*, ~~tachado~~, `código` y las direcciones web.

import { state, bus, el, icon, picker, popover, toast, safeLink, addIcons, DOC_WORD } from './negocio-core.js';
import { findTaskByKey, taskKey, TASK_STATUS, projectName } from './negocio-work.js';
import { uploadFile, fileUrl } from './negocio-gastos.js';

addIcons({
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  subtasks: '<path d="M5 4v11a3 3 0 0 0 3 3h3"/><path d="M5 9h6"/><rect x="13" y="6" width="7" height="6" rx="2"/><rect x="13" y="15" width="7" height="6" rx="2"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  starOn: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
});

const TOKENS = new RegExp([
  '(?<code>`[^`\\n]+`)',
  '(?<mdlink>\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^\\s)]+\\))',
  '(?<page>\\[\\[[^\\]\\n]{1,120}\\]\\])',
  '(?<url>https?:\\/\\/[^\\s<>]+[^\\s<>().,;:!?\'"\\]])',
  '(?<doc>\\b(?:FAC|COT|REC|PRO)-\\d{4}-\\d{4,}\\b)',
  '(?<task>\\b[A-Z][A-Z0-9]{0,5}-\\d{1,5}\\b)',
  '(?<bold>\\*\\*[^*\\n]+\\*\\*)',
  '(?<strike>~~[^~\\n]+~~)',
  '(?<em>(?<![\\w*])\\*[^*\\n]+\\*(?![\\w*]))',
].join('|'), 'g');

// ── Buscar lo enlazado ──

export const pageTitle = (p) => p?.title?.trim() || 'Sin título';
export const pageIcon = (p) => p?.icon || '📄';
export const pageByTitle = (title) => {
  const t = String(title || '').trim().toLowerCase();
  return t ? (state.pages || []).find((p) => (p.title || '').trim().toLowerCase() === t) || null : null;
};
export const docByNumber = (n) => state.docs.find((d) => d.number === n) || null;

export const openTask = (id) => bus.dispatchEvent(new CustomEvent('open-task', { detail: { id } }));
const DOC_ICON = { invoice: 'file', quote: 'quote', proposal: 'send', receipt: 'receipt' };

// ── Chips ──

export function taskChip(t, { title = true } = {}) {
  const [label, color] = TASK_STATUS[t.status] || TASK_STATUS.todo;
  return el('a', {
    class: `ln-chip is-task${t.status === 'done' ? ' is-done' : ''}`,
    href: `#/tareas/${taskKey(t)}`,
    title: `${taskKey(t)} · ${t.title || 'Sin título'} · ${label}`,
    style: { '--c': color },
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTask(t.id);
    },
  }, el('i', { class: 'ln-dot' }), el('span', { class: 'ln-key', text: taskKey(t) }), title && el('span', { class: 'ln-title', text: t.title || 'Sin título' }));
}

export const pageChip = (p) => el('a', { class: 'ln-chip is-page', href: `#/paginas/${p.id}`, title: pageTitle(p) }, el('span', { class: 'ln-emoji', text: pageIcon(p) }), el('span', { class: 'ln-title', text: pageTitle(p) }));

export const docChip = (d) => el('a', { class: 'ln-chip is-doc', href: `#/doc/${d.id}`, title: `${DOC_WORD[d.type] || 'Documento'} ${d.number}` },
  icon(DOC_ICON[d.type] || 'file'), el('span', { class: 'ln-key', text: d.number }), (d.customer?.name || d.title) && el('span', { class: 'ln-title', text: d.type === 'proposal' && d.title ? d.title : d.customer?.name }));

export function urlChip(url, title = '') {
  const href = safeLink(url);
  if (!href) return null;
  return el('a', { class: 'ln-chip is-url', href, target: '_blank', rel: 'noopener', title: href }, icon('globe'), el('span', { class: 'ln-title', text: title || new URL(href).host.replace(/^www\./, '') }));
}

// ── Texto con enlaces ──

function token(raw, g) {
  if (g.code) return el('code', { text: raw.slice(1, -1) });
  if (g.mdlink) {
    const [, label, href] = /^\[([^\]]+)\]\((.+)\)$/.exec(raw);
    return safeLink(href) ? el('a', { class: 'ln-url', href: safeLink(href), target: '_blank', rel: 'noopener', text: label }) : raw;
  }
  if (g.page) {
    const title = raw.slice(2, -2).trim();
    const p = pageByTitle(title);
    if (p) return pageChip(p);
    return el('a', {
      class: 'ln-chip is-page is-new',
      href: '#',
      title: 'Esta página no existe: tócala para crearla',
      onclick: (e) => {
        e.preventDefault();
        bus.dispatchEvent(new CustomEvent('create-page', { detail: { title } }));
      },
    }, el('span', { class: 'ln-emoji', text: '+' }), el('span', { class: 'ln-title', text: title }));
  }
  if (g.url) return el('a', { class: 'ln-url', href: raw, target: '_blank', rel: 'noopener', text: raw.replace(/^https?:\/\/(www\.)?/, '') });
  if (g.doc) {
    const d = docByNumber(raw);
    return d ? docChip(d) : raw;
  }
  if (g.task) {
    const t = findTaskByKey(raw);
    return t ? taskChip(t) : raw;
  }
  if (g.bold) return el('strong', { text: raw.slice(2, -2) });
  if (g.strike) return el('s', { text: raw.slice(2, -2) });
  if (g.em) return el('em', { text: raw.slice(1, -1) });
  return raw;
}

/** El texto en piezas: trozos sueltos y enlaces. */
export function richText(text) {
  const s = String(text || '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(TOKENS)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(token(m[0], m.groups));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Qué tareas, páginas y documentos nombra un texto. */
export function mentionsIn(text) {
  const found = { task: new Set(), page: new Set(), doc: new Set() };
  for (const m of String(text || '').matchAll(TOKENS)) {
    const g = m.groups;
    if (g.task) {
      const t = findTaskByKey(m[0]);
      if (t) found.task.add(t.id);
    } else if (g.doc) {
      const d = docByNumber(m[0]);
      if (d) found.doc.add(d.id);
    } else if (g.page) {
      const p = pageByTitle(m[0].slice(2, -2));
      if (p) found.page.add(p.id);
    }
  }
  return found;
}

export const pageText = (p) => [p.title, ...(p.blocks || []).map((b) => b.text || '')].join('\n');
export const taskText = (t) => [t.description, ...(t.comments || []).map((c) => c.text)].join('\n');

/** Quién nombra algo: páginas y tareas que lo mencionan o lo enlazan. */
export function backlinks(kind, id) {
  const out = [];
  for (const p of state.pages || []) {
    if (kind === 'page' && p.id === id) continue;
    const named = mentionsIn(pageText(p))[kind].has(id) || (p.blocks || []).some((b) => b.kind === 'link' && b.target === kind && b.ref === id);
    if (named) out.push({ kind: 'page', item: p });
  }
  for (const t of state.tasks) {
    if (kind === 'task' && t.id === id) continue;
    if (mentionsIn(taskText(t))[kind].has(id) || (t.refs || []).some((r) => r.kind === kind && r.ref === id)) out.push({ kind: 'task', item: t });
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Al renombrar una página, los [[enlaces]] que la nombran cambian con ella. */
export function renamePageRefs(from, to, save) {
  const old = String(from || '').trim();
  const now = String(to || '').trim();
  if (!old || !now || old.toLowerCase() === now.toLowerCase()) return;
  const re = new RegExp(`\\[\\[\\s*${escapeRe(old)}\\s*\\]\\]`, 'gi');
  const swap = (text) => String(text || '').replace(re, `[[${now}]]`);
  for (const p of state.pages || []) {
    let changed = false;
    for (const b of p.blocks || []) {
      const next = swap(b.text);
      if (b.text && next !== b.text) {
        b.text = next;
        changed = true;
      }
    }
    if (changed) save('pages', p);
  }
  for (const t of state.tasks) {
    const desc = swap(t.description);
    const comments = (t.comments || []).map((c) => ({ ...c, text: swap(c.text) }));
    if (desc !== (t.description || '') || comments.some((c, i) => c.text !== t.comments[i].text)) save('tasks', { ...t, description: desc, comments });
  }
}

// ── Escribir enlaces ──

/** Buscador de páginas, tareas y documentos. Devuelve el texto que los enlaza. */
export function linkPicker(anchor, onPick, { only } = {}) {
  const items = () => [
    ...(!only || only === 'page' ? (state.pages || []).map((p) => ({ kind: 'page', item: p, label: `${pageIcon(p)}  ${pageTitle(p)}`, sub: 'Página', insert: `[[${pageTitle(p)}]]` })) : []),
    ...(!only || only === 'task' ? [...state.tasks].filter((t) => t.num).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map((t) => ({ kind: 'task', item: t, label: `${taskKey(t)} · ${t.title || 'Sin título'}`, sub: projectName(t.projectId) || 'Tarea sin proyecto', insert: taskKey(t) })) : []),
    ...(!only || only === 'doc' ? state.docs.filter((d) => d.number).sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')).map((d) => ({ kind: 'doc', item: d, label: `${d.number} · ${d.type === 'proposal' && d.title ? d.title : d.customer?.name || 'Sin cliente'}`, sub: DOC_WORD[d.type] || 'Documento', insert: d.number })) : []),
  ];
  return picker(anchor, {
    placeholder: only === 'task' ? 'Buscar por clave o título…' : only === 'page' ? 'Buscar página…' : only === 'doc' ? 'Buscar documento…' : 'Enlazar una página, tarea o documento…',
    items,
    label: (x) => x.label,
    sub: (x) => x.sub,
    onPick,
  });
}

/** Al escribir [[ en un campo se abre el buscador y se pone el enlace elegido. */
export function linkable(area) {
  area.addEventListener('input', (e) => {
    if (!/^insert/.test(e.inputType || '') || !String(e.data || '').endsWith('[')) return;
    const at = area.selectionStart;
    if (area.value.slice(at - 2, at) !== '[[') return;
    linkPicker(area, (x) => {
      const v = area.value;
      area.value = v.slice(0, at - 2) + x.insert + v.slice(at);
      const caret = at - 2 + x.insert.length;
      area.focus();
      area.setSelectionRange(caret, caret);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  return area;
}

const fit = (area) => {
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
};

/** Texto que se escribe en un campo y, sin foco, se lee con sus enlaces. */
export function richArea({ value = '', placeholder = '', onInput, cls = '', maxLength = 8000, rows = 2, label = '' }) {
  const area = linkable(el('textarea', { class: 'ln-area-in', rows, value, placeholder, maxLength, 'aria-label': label || placeholder }));
  const view = el('div', { class: 'ln-area-view' });
  const box = el('div', { class: `ln-area ${cls}`.trim() }, view, area);
  const draw = () => {
    view.replaceChildren(...richText(area.value));
    box.classList.toggle('is-empty', !area.value.trim());
  };
  area.addEventListener('input', () => {
    fit(area);
    onInput?.(area.value);
  });
  area.addEventListener('focus', () => requestAnimationFrame(() => fit(area)));
  area.addEventListener('blur', draw);
  view.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  });
  draw();
  requestAnimationFrame(() => fit(area));
  return box;
}

// ── Portadas ──

export const COVERS = ['sky', '#1d2126', '#00b8d4', '#0071bc', '#1f9d46', '#8e5bd6', '#f97316', '#d9a406', '#e0352b'];
const coverBg = (c) => (c === 'sky' ? 'linear-gradient(160deg, #cfe9f8 0%, #e6f3fb 55%, #fff6e6 100%)' : `linear-gradient(140deg, ${c}, color-mix(in srgb, ${c} 62%, #000))`);

/** La portada: una imagen o un color. */
export function coverNode(cover, cls = '') {
  if (!cover) return null;
  if (cover.url) return el('div', { class: `ln-cover ${cls}`.trim() }, el('img', { src: cover.url, alt: '', loading: 'lazy' }));
  return el('div', { class: `ln-cover is-color ${cls}`.trim(), style: { '--bg': coverBg(cover.color || 'sky') } });
}

/** Menú para elegir portada: colores, una imagen subida o quitarla. */
export function coverMenu(anchor, onChange, { hasCover = false } = {}) {
  let pop;
  const pickFile = () => {
    const fileIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      toast('Subiendo imagen…');
      try {
        onChange({ url: fileUrl((await uploadFile(f)).id) });
        toast('Portada lista.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    pop.hidePopover();
    fileIn.click();
  };
  const box = el('div', { class: 'ng-menu ln-cover-menu' },
    el('span', { class: 'ln-cover-label', text: 'Portada' }),
    el('div', { class: 'ng-swatches' }, COVERS.map((c) => el('button', {
      type: 'button',
      class: 'ng-swatch',
      style: { '--c': coverBg(c) },
      'aria-label': c === 'sky' ? 'Cielo' : `Color ${c}`,
      onclick: () => {
        pop.hidePopover();
        onChange({ color: c });
      },
    }))),
    el('button', { type: 'button', onclick: pickFile }, icon('upload'), el('span', { text: 'Subir una imagen' })),
    hasCover && el('button', { type: 'button', class: 'is-danger', onclick: () => { pop.hidePopover(); onChange(null); } }, icon('trash'), el('span', { text: 'Quitar portada' })),
  );
  pop = popover(anchor, box);
  return pop;
}
