// Buscar en todo el portal: publicaciones, el trabajo de cada día, peticiones, recursos,
// anuncios, conversaciones, leads, documentos y reuniones. Sin tildes ni mayúsculas que
// estorben, agrupado por tipo y con lo encontrado resaltado. «/» o ⌘K lo abren en el ordenador.

import { el, fill, icon, sheet, shortDate, cap, fDay, dayDate } from './kit.js';
import { react } from './feel.js';
import { app, can, has, visibleContent, CHANNEL, FORMAT, channelsOf, CONTENT_STATUS, POST_KIND, RESOURCE_KIND, LEAD_STAGE, DOC_TYPE, docState, MEETING_STATUS, targetTitle } from './state.js';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const remember = (key, value) => {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return [];
  }
  return value;
};

/** Todo lo que se puede encontrar, ya con su texto plano para comparar. */
function index() {
  const d = app.data;
  const out = [];
  const add = (group, row) => out.push({ group, ...row, hay: fold([row.title, row.sub, row.extra].filter(Boolean).join(' · ')) });
  if (can('calendario')) {
    for (const c of visibleContent()) {
      add('Publicaciones', { title: c.title, sub: `${CONTENT_STATUS[c.status]?.[0] || ''} · ${FORMAT[c.format] || ''} · ${shortDate(c.date)}`, extra: [c.caption, c.hashtags, c.objective, c.pillar, c.campaign, ...channelsOf(c).map((k) => CHANNEL[k]?.[0])].join(' '), ico: CHANNEL[c.channel]?.[2] || 'calendar', color: CHANNEL[c.channel]?.[1], go: `#/marketing/pieza/${c.id}`, at: c.date });
    }
  }
  if (can('reporte')) {
    for (const w of d.work) add('Trabajo', { title: w.title, sub: `${cap(fDay.format(dayDate(w.day)))}${w.category ? ` · ${w.category}` : ''}`, extra: w.description, ico: 'tasks', color: 'var(--cf-income)', go: '#/cronologia/reportes', at: w.day });
  }
  if (can('peticiones')) {
    for (const t of d.tasks) add('Peticiones', { title: t.title, sub: t.status === 'done' ? 'Hecha' : t.status === 'submitted' ? 'Enviada' : 'Pendiente', extra: [t.description, t.client_note].join(' '), ico: 'inbox', color: 'var(--cf-orange)', go: `#/peticiones/${t.status === 'done' ? 'hechas' : t.status === 'submitted' ? 'enviadas' : 'pendientes'}`, at: t.created_at });
  }
  if (can('recursos')) {
    for (const r of d.resources) add('Recursos', { title: r.title, sub: [RESOURCE_KIND[r.kind]?.[0], r.category].filter(Boolean).join(' · '), extra: [r.description, r.file_name, r.url].join(' '), ico: RESOURCE_KIND[r.kind]?.[1] || 'folder', color: RESOURCE_KIND[r.kind]?.[2], go: '#/recursos', at: r.created_at });
  }
  for (const p of d.posts) add('Anuncios y avances', { title: p.title, sub: `${p.origin === 'client' ? `Anuncio de ${p.author || 'tu equipo'}` : POST_KIND[p.kind]?.[0] || ''} · ${shortDate(new Date(p.occurred_at).toLocaleDateString('en-CA'))}`, extra: p.body, ico: POST_KIND[p.kind]?.[1] || 'megaphone', color: POST_KIND[p.kind]?.[2], go: `#/cronologia?${p.kind === 'announcement' ? 'anuncios' : 'avances'}`, at: p.occurred_at });
  for (const c of d.comments) add('Conversaciones', { title: c.body, sub: `${c.from_studio ? 'Schwarck' : c.author || 'Cliente'} en «${targetTitle(c.target, c.target_id)}»`, ico: 'chat', color: 'var(--cf-primary)', go: `#/hilo/${c.target}/${c.target_id}`, at: c.created_at });
  if (can('leads')) {
    for (const l of d.leads) add('Leads', { title: l.name, sub: `${LEAD_STAGE[l.stage]?.[0] || ''}${l.campaign ? ` · ${l.campaign}` : ''}`, extra: [l.contact, l.notes, l.source].join(' '), ico: 'funnel', color: LEAD_STAGE[l.stage]?.[1], go: '#/marketing/leads', at: l.date });
  }
  if (has('documents') && can('docs.view')) {
    for (const doc of d.documents) add('Documentos', { title: doc.title || doc.number, sub: `${DOC_TYPE[doc.type]?.[0] || ''}${doc.number ? ` ${doc.number}` : ''} · ${docState(doc)[0]}`, ico: DOC_TYPE[doc.type]?.[1] || 'file', color: DOC_TYPE[doc.type]?.[2], go: '#/documentos/todos', at: doc.issue_date });
  }
  if (has('meetings')) {
    for (const m of d.meetings) add('Reuniones', { title: m.topic, sub: `${MEETING_STATUS[m.status]?.[0] || ''}${m.starts_at ? ` · ${shortDate(new Date(m.starts_at).toLocaleDateString('en-CA'))}` : ''}`, extra: [m.notes, m.studio_note].join(' '), ico: 'calendar', color: MEETING_STATUS[m.status]?.[1], go: '#/reuniones', at: m.starts_at || m.created_at });
  }
  return out;
}

/** El texto con lo buscado resaltado (sin tildes de por medio). */
function mark(text, words) {
  const raw = String(text ?? '');
  const folded = fold(raw);
  const spans = [];
  for (const w of words) {
    let i = folded.indexOf(w);
    while (i >= 0 && spans.length < 8) {
      spans.push([i, i + w.length]);
      i = folded.indexOf(w, i + w.length);
    }
  }
  if (!spans.length) return [raw];
  spans.sort((a, b) => a[0] - b[0]);
  const out = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a < at) continue;
    out.push(raw.slice(at, a), el('mark', { text: raw.slice(a, b) }));
    at = b;
  }
  out.push(raw.slice(at));
  return out;
}

export function openSearch() {
  const all = index();
  const box = el('div', { class: 'cl-search-results', role: 'list' });
  const field = el('input', { type: 'search', class: 'cl-input cl-search-input', placeholder: 'Buscar en todo el proyecto', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar' });
  let recent = remember('portal:search-recent').slice(0, 6);
  let ui;
  const go = (href, q) => {
    if (q) {
      recent = [q, ...recent.filter((x) => x !== q)].slice(0, 6);
      remember('portal:search-recent', recent);
    }
    react('tap');
    ui.close();
    setTimeout(() => {
      location.hash = href;
    }, 60);
  };
  const draw = () => {
    const q = field.value.trim();
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) {
      fill(box, recent.length
        ? el('div', { class: 'cl-search-recent' }, el('small', { text: 'Buscaste' }), recent.map((r) => el('button', { type: 'button', class: 'cl-fchip', onclick: () => { field.value = r; draw(); } }, icon('clock'), r)))
        : el('p', { class: 'cl-search-hint', text: 'Publicaciones, trabajo, peticiones, recursos, conversaciones, leads, documentos y reuniones.' }));
      return;
    }
    const hits = all.filter((x) => words.every((w) => x.hay.includes(w)));
    if (!hits.length) {
      fill(box, el('div', { class: 'cl-empty' }, el('span', { class: 'cl-empty-ico' }, icon('search')), el('b', { text: 'Sin resultados' }), el('p', { text: `Nada con «${q}». Prueba con otra palabra.` })));
      return;
    }
    const groups = new Map();
    for (const h of hits.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))) {
      if (!groups.has(h.group)) groups.set(h.group, []);
      groups.get(h.group).push(h);
    }
    fill(box, el('small', { class: 'cl-search-count', text: `${hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}` }),
      [...groups].map(([group, list]) => el('section', { class: 'cl-search-group' },
        el('h3', { text: `${group} · ${list.length}` }),
        list.slice(0, 8).map((h) => el('button', { type: 'button', class: 'cl-search-row', role: 'listitem', style: h.color ? { '--c': h.color } : null, onclick: () => go(h.go, q) },
          el('span', { class: 'cl-search-ico' }, icon(h.ico || 'search')),
          el('span', { class: 'cl-set-main' }, el('b', {}, ...mark(h.title, words)), el('small', {}, ...mark(h.sub, words))),
          icon('right', 'cl-set-chev'),
        )),
        list.length > 8 && el('small', { class: 'cl-search-more', text: `y ${list.length - 8} más: afina la búsqueda` }),
      )));
  };
  let timer = 0;
  field.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(draw, 60);
  });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = box.querySelector('.cl-search-row');
      if (first) first.click();
    }
  });
  draw();
  ui = sheet('Buscar', el('div', { class: 'cl-finder' }, el('label', { class: 'cl-search cl-search-bar' }, icon('search'), field), box), { className: 'is-search', subtitle: app.client.name });
  setTimeout(() => field.focus(), 120);
}

// «/» o ⌘K / Ctrl+K: buscar (si no se está escribiendo en otro sitio).
addEventListener('keydown', (e) => {
  if (!app.data || document.querySelector('dialog[open]')) return;
  const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    openSearch();
  }
});
