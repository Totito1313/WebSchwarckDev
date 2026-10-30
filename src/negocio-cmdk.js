// Negocio: buscador de todo (Ctrl+K o ⌘K, o el botón de la lupa del riel).
//
// Lleva a cualquier sección, crea lo que haga falta y abre clientes, proyectos,
// tareas, documentos, páginas o leads escribiendo un trozo de su nombre, su
// clave (WEB-12) o su número (FAC-2026-0001). Flechas para moverse, Intro para
// abrir, Esc para cerrar. Lo último que se abrió sale primero.

import { state, el, icon, DOC_WORD } from './negocio-core.js';
import { taskKey } from './negocio-work.js';
import { openLead } from './negocio-leads.js';

const RECENT_KEY = 'ng:cmdk-recent';
const SECTIONS = [
  ['Inicio', '#/inicio', 'home'], ['Proyectos', '#/proyectos', 'folder'], ['Tareas', '#/tareas', 'tasks'], ['Páginas', '#/paginas', 'page'],
  ['Horas', '#/horas', 'clock'], ['Facturas', '#/facturas', 'file'], ['Cotizaciones', '#/cotizaciones', 'quote'], ['Propuestas', '#/propuestas', 'send'],
  ['Leads', '#/leads', 'funnel'], ['Clientes', '#/clientes', 'users'], ['Portal de clientes', '#/portal', 'smartphone'], ['Gastos', '#/gastos', 'wallet'],
  ['Catálogo', '#/catalogo', 'box'], ['Marketing', '#/marketing', 'megaphone'], ['Ajustes', '#/ajustes', 'sliders'],
];

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function records() {
  const customers = new Map(state.customers.map((c) => [c.id, c]));
  const projects = new Map(state.projects.map((p) => [p.id, p]));
  return [
    ...state.customers.map((c) => ({ group: 'Clientes', ico: 'users', label: c.name || 'Sin nombre', sub: c.company || c.email || '', go: `#/clientes/${c.id}`, key: `c:${c.id}` })),
    ...state.projects.map((p) => ({ group: 'Proyectos', ico: 'folder', label: p.name || 'Sin nombre', sub: [p.code, customers.get(p.customerId)?.name].filter(Boolean).join(' · '), go: `#/proyectos/${p.id}`, key: `p:${p.id}` })),
    ...state.tasks.filter((t) => t.num).map((t) => ({ group: 'Tareas', ico: 'tasks', label: t.title || 'Sin título', sub: [taskKey(t), projects.get(t.projectId)?.name].filter(Boolean).join(' · '), go: `#/tareas/${taskKey(t)}`, key: `t:${t.id}`, extra: taskKey(t) })),
    ...state.docs.map((d) => ({ group: 'Documentos', ico: { quote: 'quote', proposal: 'send', receipt: 'receipt' }[d.type] || 'file', label: d.number || `${DOC_WORD[d.type] || 'Documento'} en borrador`, sub: [DOC_WORD[d.type], d.customer?.name, d.title].filter(Boolean).join(' · '), go: `#/doc/${d.id}`, key: `d:${d.id}` })),
    ...(state.pages || []).map((p) => ({ group: 'Páginas', ico: 'page', label: p.title || 'Sin título', sub: projects.get(p.projectId)?.name || '', go: `#/paginas/${p.id}`, key: `g:${p.id}` })),
    ...(state.leads || []).map((l) => ({ group: 'Leads', ico: 'funnel', label: l.name || l.company || 'Sin nombre', sub: l.company || '', run: () => openLead(l.id), key: `l:${l.id}` })),
  ];
}

function recent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
function remember(item) {
  if (!item.key) return;
  const list = [item.key, ...recent().filter((k) => k !== item.key)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // sin almacenamiento no hay recientes
  }
}

let open = null;

/** `create`: las mismas acciones del botón «+» del riel. */
export function mountCommand({ create = [], trigger }) {
  const show = () => (open ? open.focus() : palette(create));
  trigger?.addEventListener('click', show);
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      if (document.querySelector('dialog[open]:not(.ng-cmdk)')) return;
      e.preventDefault();
      show();
    }
  });
}

function palette(create) {
  const search = el('input', { type: 'search', class: 'ng-cmdk-input', placeholder: 'Busca o escribe una orden…', 'aria-label': 'Buscar', autocomplete: 'off', spellcheck: false });
  const list = el('div', { class: 'ng-cmdk-list', role: 'listbox', id: 'ng-cmdk-list' });
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-controls', 'ng-cmdk-list');
  search.setAttribute('aria-expanded', 'true');
  const dlg = el('dialog', { class: 'ng-cmdk', 'aria-label': 'Buscar en Negocio' },
    el('div', { class: 'ng-cmdk-head' }, icon('search'), search, el('kbd', { text: 'Esc' })),
    list,
    el('footer', { class: 'ng-cmdk-foot' }, el('span', {}, el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), ' moverse'), el('span', {}, el('kbd', { text: '↵' }), ' abrir'), el('span', {}, el('kbd', { text: 'Ctrl K' }), ' en cualquier sitio')),
  );
  const all = records();
  const byKey = new Map(all.map((r) => [r.key, r]));
  const actions = [
    ...create.filter((c) => c && c !== '-').map((c) => ({ group: 'Crear', ico: c.icon, label: c.label, run: c.run, key: `n:${c.label}` })),
    ...SECTIONS.map(([label, go, ico]) => ({ group: 'Ir a', ico, label, go, key: `s:${go}` })),
  ];
  let items = [];
  let active = 0;

  const run = (item) => {
    remember(item);
    close();
    if (item.go) location.hash = item.go;
    else item.run?.();
  };
  const paint = () => {
    const q = fold(search.value.trim());
    const words = q.split(/\s+/).filter(Boolean);
    const hit = (it) => words.every((w) => fold(`${it.label} ${it.sub || ''} ${it.extra || ''} ${it.group}`).includes(w));
    if (!words.length) {
      const rec = recent().map((k) => byKey.get(k) || actions.find((a) => a.key === k)).filter(Boolean).map((r) => ({ ...r, group: 'Recientes' }));
      items = [...rec, ...actions.filter((a) => a.group === 'Crear').slice(0, 4), ...actions.filter((a) => a.group === 'Ir a')];
    } else {
      // Lo que empieza por lo escrito va antes; de cada grupo, como mucho ocho.
      const scored = [...actions, ...all].filter(hit).map((it) => ({ it, s: fold(it.label).startsWith(words[0]) || fold(it.extra).startsWith(words[0]) ? 0 : 1 }));
      scored.sort((a, b) => a.s - b.s);
      const per = new Map();
      items = scored.map((x) => x.it).filter((it) => {
        const n = (per.get(it.group) || 0) + 1;
        per.set(it.group, n);
        return n <= 8;
      });
      const order = ['Ir a', 'Crear', 'Clientes', 'Proyectos', 'Tareas', 'Documentos', 'Páginas', 'Leads'];
      items.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
    }
    active = Math.min(active, Math.max(0, items.length - 1));
    if (!items.length) {
      list.replaceChildren(el('p', { class: 'ng-cmdk-none', text: `Nada coincide con «${search.value.trim()}».` }));
      return;
    }
    let group = '';
    const rows = [];
    items.forEach((it, i) => {
      if (it.group !== group) {
        group = it.group;
        rows.push(el('small', { class: 'ng-cmdk-group', text: group }));
      }
      rows.push(el('button', {
        type: 'button',
        role: 'option',
        id: `ng-cmdk-${i}`,
        class: 'ng-cmdk-item',
        'aria-selected': String(i === active),
        style: { '--i': Math.min(i, 10) },
        onclick: () => run(it),
        onpointermove: () => {
          if (active === i) return;
          active = i;
          mark();
        },
      }, el('span', { class: 'ng-cmdk-ico' }, icon(it.ico || 'right')), el('span', { class: 'ng-cmdk-text' }, el('b', { text: it.label }), it.sub && el('small', { text: it.sub })), icon(it.go ? 'right' : 'plus')));
    });
    list.replaceChildren(...rows);
    mark();
  };
  const mark = () => {
    for (const b of list.querySelectorAll('.ng-cmdk-item')) b.setAttribute('aria-selected', String(b.id === `ng-cmdk-${active}`));
    const on = list.querySelector(`#ng-cmdk-${active}`);
    search.setAttribute('aria-activedescendant', on ? on.id : '');
    on?.scrollIntoView({ block: 'nearest' });
  };
  search.addEventListener('input', () => {
    active = 0;
    paint();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      mark();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[active]) run(items[active]);
    }
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    open = null;
  });
  function close() {
    if (!dlg.open) return;
    dlg.classList.add('is-closing');
    setTimeout(() => dlg.close(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140);
  }
  document.body.append(dlg);
  dlg.showModal();
  search.focus();
  paint();
  open = search;
}
