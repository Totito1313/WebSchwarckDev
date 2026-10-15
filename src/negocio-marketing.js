// Negocio · Marketing: la página con sus pestañas (calendario, tablero,
// campañas, resultados, copias, feed y marcas) y un filtro de marca que vale
// para todas.

import {
  state, find, put, remove, uid, el, icon, iconButton, field, input, select, confirmBox, toast, autosize, todayISO, dateText,
  shortDate, money, empty, seg, chip,
} from './negocio-core.js';
import { go } from './negocio-views.js';
import { uploadFile, fileUrl, PERIODS, periodRange, within, change, stat } from './negocio-gastos.js';
import {
  ensureBrands, brands, brandOf, brandColor, brandMark, postsOf, byDate, newPost, postForm, igText, copyText, statusTag,
  POST_STATUS, STATUS_ORDER, ROLES, FORMATS, assetForm, svgForm, svgUrl, downloadSvg, campaigns, campaignForm, campaignStats,
  CAMPAIGN_STATUS, engagement, pctText, hasMetrics, leadsOf, METRICS,
} from './negocio-contenido.js';
import { calendarView, boardView } from './negocio-calendario.js';
import { openLead, createLead, LEAD_STAGES } from './negocio-leads.js';

const list = (col) => state[col] || [];
const TABS = [
  ['calendario', 'Calendario', 'calendar'],
  ['tablero', 'Tablero', 'board'],
  ['campanas', 'Campañas', 'rocket'],
  ['resultados', 'Resultados', 'chart'],
  ['copias', 'Copias', 'instagram'],
  ['feed', 'Feed', 'grid'],
  ['marcas', 'Marcas', 'palette2'],
];
export const mk = { brand: 'all', role: 'all', status: 'all', period: 'month' };
const base = () => state.settings.currency || 'USD';
const nf0 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
const bigNum = (n) => nf0.format(Math.round(n || 0));

// ── Copias ──

function copiesView(filter) {
  const box = el('div', { class: 'ng-copies' });
  let scope = 'upcoming';
  const draw = () => {
    const today = todayISO();
    const posts = postsOf(filter)
      .filter((p) => (scope === 'upcoming' ? p.date >= today && p.status !== 'publicado' : scope === 'missing' ? !p.copyIg?.trim() : true))
      .sort(scope === 'all' ? (a, b) => byDate(b, a) : byDate);
    const scopes = [['upcoming', 'Próximas'], ['missing', 'Sin copy'], ['all', 'Todas']];
    box.replaceChildren(
      el('header', { class: 'ng-copies-head' },
        el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Qué publicaciones ver' }, scopes.map(([k, label]) => el('button', { type: 'button', class: 'ng-fchip', 'aria-pressed': String(scope === k), text: label, onclick: () => { scope = k; draw(); } }))),
        el('p', { class: 'ng-card-text', text: 'Copia el texto, pégalo en Instagram o Facebook y márcala como publicada. El de Instagram ya lleva los hashtags.' }),
      ),
      posts.length ? el('div', { class: 'ng-copies-list' }, posts.map((p) => {
        const b = brandOf(p);
        const ig = igText(p);
        return el('article', { class: 'ng-copy' },
          el('header', {},
            brandMark(b, 'is-sm'),
            el('div', { class: 'ng-copy-title' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: [b?.name, dateText(p.date), p.time, FORMATS[p.format]?.[0]].filter(Boolean).join(' · ') })),
            statusTag(p.status),
            p.status !== 'publicado' && el('button', {
              type: 'button',
              class: 'pill ghost sm',
              onclick: () => {
                p.status = 'publicado';
                if (p.date > today) p.date = today;
                put('posts', p);
                toast('Marcada como publicada. Apunta sus resultados en unos días.');
              },
            }, icon('check'), 'Publicada'),
            el('button', { type: 'button', class: 'pill ghost sm', onclick: () => postForm(p) }, icon('edit'), 'Editar'),
          ),
          el('div', { class: 'ng-copy-cols' },
            el('section', {},
              el('div', { class: 'ng-copy-label' }, icon('instagram'), 'Instagram', el('small', { text: ig ? `${ig.length} / 2200` : '' }), el('button', { type: 'button', class: 'pill sm', onclick: () => copyText(ig, 'Copy de Instagram'), disabled: !ig }, icon('copy'), 'Copiar')),
              el('p', { class: ig ? '' : 'is-empty', text: ig || 'Sin copy todavía.' }),
            ),
            el('section', {},
              el('div', { class: 'ng-copy-label' }, icon('facebook'), 'Facebook', el('button', { type: 'button', class: 'pill sm', onclick: () => copyText(p.copyFb || '', 'Copy de Facebook'), disabled: !p.copyFb }, icon('copy'), 'Copiar')),
              el('p', { class: p.copyFb ? '' : 'is-empty', text: p.copyFb || 'Sin copy. En «Editar» se adapta desde el de Instagram con un clic.' }),
            ),
          ),
        );
      })) : el('div', { class: 'ng-card' }, empty({ ico: 'instagram', title: scope === 'missing' ? 'Todas tienen copy' : 'Nada por aquí', text: scope === 'upcoming' ? 'No hay publicaciones próximas sin publicar.' : 'Cambia el filtro o crea una publicación.' })),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

// ── Feed 3×3 ──

function feedView(filter) {
  const box = el('div', { class: 'ng-feed-sim' });
  let drafts = false;
  let dragId = null;
  const draw = () => {
    const all = brands();
    const b = (filter.brand !== 'all' && find('brands', filter.brand)) || all[0];
    if (!b) {
      box.replaceChildren(el('div', { class: 'ng-card' }, empty({ ico: 'grid', title: 'Crea una marca primero' })));
      return;
    }
    const shown = (p) => drafts || ['aprobado', 'programado', 'publicado'].includes(p.status);
    const posts = list('posts').filter((p) => p.brandId === b.id && p.format !== 'historia' && shown(p)).sort((x, y) => byDate(y, x));
    const month = todayISO().slice(0, 7);
    const thisMonth = list('posts').filter((p) => p.brandId === b.id && p.date.startsWith(month));
    const mix = Object.entries(ROLES).map(([k, r]) => [r, thisMonth.filter((p) => p.role === k).length]);
    const top = Math.max(1, ...mix.map(([, n]) => n));
    const next = list('posts').filter((p) => p.brandId === b.id && p.date >= todayISO() && p.status !== 'publicado').sort(byDate).slice(0, 4);

    // Arrastrar una casilla sobre otra intercambia sus fechas: así se planea el orden de la cuadrícula.
    const tile = (p) => {
      const node = el('button', { type: 'button', class: 'ng-tile', draggable: p.status !== 'publicado', title: `${p.title} · ${dateText(p.date)}`, onclick: () => postForm(p) },
        p.assetUrl ? el('img', { src: p.assetUrl, alt: '', loading: 'lazy' }) : el('span', { class: 'ng-tile-cover', style: { '--c': p.color || brandColor(b) } }, el('b', { text: p.title })),
        p.format !== 'imagen' && el('span', { class: 'ng-tile-ico' }, icon(FORMATS[p.format]?.[1] || 'image')),
        p.status !== 'publicado' && el('span', { class: 'ng-tile-when', text: dateText(p.date).replace(/ \d{4}$/, '') }),
      );
      node.addEventListener('dragstart', (e) => {
        dragId = p.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', p.id);
        setTimeout(() => node.classList.add('is-dragging'));
      });
      node.addEventListener('dragend', () => {
        dragId = null;
        node.classList.remove('is-dragging');
        for (const t of box.querySelectorAll('.is-over')) t.classList.remove('is-over');
      });
      node.addEventListener('dragover', (e) => {
        if (!dragId || dragId === p.id || p.status === 'publicado') return;
        e.preventDefault();
        node.classList.add('is-over');
      });
      node.addEventListener('dragleave', () => node.classList.remove('is-over'));
      node.addEventListener('drop', (e) => {
        e.preventDefault();
        node.classList.remove('is-over');
        const other = dragId && find('posts', dragId);
        if (!other || other.id === p.id) return;
        [other.date, p.date] = [p.date, other.date];
        [other.time, p.time] = [p.time, other.time];
        put('posts', other);
        put('posts', p);
        toast('Intercambiadas de fecha.');
      });
      return node;
    };

    box.replaceChildren(
      el('div', { class: 'ng-phone' },
        el('div', { class: 'ng-phone-screen' },
          el('div', { class: 'ng-igp-head' }, el('b', { text: (b.handle || b.name).replace(/^@/, '') })),
          el('div', { class: 'ng-igp-profile' },
            brandMark(b, 'is-ring'),
            el('div', { class: 'ng-igp-stats' },
              el('span', {}, el('b', { text: String(posts.length) }), 'publicaciones'),
              el('span', {}, el('b', { text: b.followers ? bigNum(b.followers) : '—' }), 'seguidores'),
              el('span', {}, el('b', { text: '—' }), 'seguidos'),
            ),
          ),
          el('div', { class: 'ng-igp-bio' }, el('b', { text: b.name }), el('span', { text: b.industry || '' }), b.link && el('span', { class: 'ng-igp-link', text: b.link.replace(/^https?:\/\//, '').replace(/\/$/, '') })),
          el('div', { class: 'ng-igp-tabs', 'aria-hidden': 'true' }, icon('grid'), icon('reel')),
          posts.length ? el('div', { class: 'ng-igp-grid' }, posts.slice(0, 18).map(tile)) : el('p', { class: 'ng-igp-empty', text: drafts ? 'Esta marca todavía no tiene publicaciones.' : 'Aquí salen las aprobadas, programadas y publicadas.' }),
        ),
      ),
      el('div', { class: 'ng-feed-side' },
        el('section', { class: 'ng-card' },
          el('h2', { text: 'Así se verá tu perfil' }),
          el('p', { class: 'ng-card-text', text: 'Lo más nuevo arriba a la izquierda, como en Instagram. Arrastra una casilla sobre otra para intercambiar sus fechas. Las historias no entran en la cuadrícula.' }),
          el('label', { class: 'ng-chk' }, el('input', { type: 'checkbox', checked: drafts, onchange: (e) => { drafts = e.target.checked; draw(); } }), el('span', { text: 'Incluir ideas y borradores' })),
        ),
        el('section', { class: 'ng-card' },
          el('h2', { text: 'Equilibrio del embudo' }),
          el('p', { class: 'ng-card-text', text: `Publicaciones de ${b.name} este mes, por su papel.` }),
          el('ul', { class: 'ng-bars' }, mix.map(([r, n]) => el('li', { style: { '--c': r[2] }, title: r[3] },
            el('div', { class: 'ng-bars-name' }, el('i', { class: 'ng-dot' }), el('span', { text: `${r[0]} (${r[1]})` })),
            el('span', { class: 'ng-bars-track' }, el('i', { style: { width: `${n ? Math.max(4, (n / top) * 100) : 0}%` } })),
            el('b', { text: String(n) }),
            el('small', { text: thisMonth.length ? `${Math.round((n / thisMonth.length) * 100)}%` : '' }),
          ))),
        ),
        el('section', { class: 'ng-card' },
          el('h2', { text: 'Lo próximo' }),
          next.length ? el('div', { class: 'ng-rows' }, next.map((p) => el('button', { type: 'button', class: 'ng-row is-mini', onclick: () => postForm(p) },
            el('span', { class: 'ng-row-ico' }, icon(FORMATS[p.format]?.[1] || 'image')),
            el('span', { class: 'ng-row-main' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: `${dateText(p.date)} · ${p.time || ''}` })),
            el('span', { class: 'ng-row-tag' }, statusTag(p.status)),
            el('span'),
          ))) : el('p', { class: 'ng-none', text: 'Nada programado.' }),
        ),
      ),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

// ── Campañas ──

function campaignCard(c) {
  const s = campaignStats(c);
  const b = c.brandId && find('brands', c.brandId);
  const [label, color] = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.planned;
  const share = s.posts.length ? s.published.length / s.posts.length : 0;
  return el('a', { class: 'ng-camp', href: `#/marketing/campanas/${c.id}`, style: { '--c': c.color || 'var(--ink)' } },
    el('div', { class: 'ng-camp-top' }, b ? brandMark(b, 'is-sm') : el('span', { class: 'ng-camp-dot' }), chip(label, color)),
    el('b', { class: 'ng-camp-name', text: c.name }),
    el('small', { text: [c.start && `${shortDate(c.start)} → ${c.end ? dateText(c.end) : 'sin final'}`, b?.name].filter(Boolean).join(' · ') }),
    el('div', { class: 'ng-camp-bar' },
      el('div', {}, el('span', { text: 'Publicaciones' }), el('b', { text: `${s.published.length}/${s.posts.length}` })),
      el('span', { class: 'ng-bar' }, el('i', { style: { width: `${share * 100}%` } })),
    ),
    el('div', { class: 'ng-camp-bar' },
      el('div', {}, el('span', { text: 'Leads' }), el('b', { text: s.target ? `${s.leads.length}/${s.target}` : String(s.leads.length) })),
      el('span', { class: 'ng-bar is-ok' }, el('i', { style: { width: `${s.target ? Math.min(100, (s.leads.length / s.target) * 100) : s.leads.length ? 100 : 0}%` } })),
    ),
    el('div', { class: 'ng-camp-stats' },
      el('span', {}, el('small', { text: 'Coste por lead' }), el('b', { text: s.cpl != null ? money(s.cpl, c.currency) : '—' })),
      el('span', {}, el('small', { text: 'Ventas' }), el('b', { text: money(s.wonValue, c.currency) })),
      el('span', {}, el('small', { text: 'Retorno' }), el('b', { class: s.roi != null && s.roi < 0 ? 'is-bad' : '', text: s.roi != null ? `${s.roi >= 0 ? '+' : ''}${Math.round(s.roi * 100)} %` : '—' })),
    ),
  );
}

function campaignsView(filter) {
  const box = el('div', { class: 'ng-camps-view' });
  const draw = () => {
    const all = campaigns().filter((c) => filter.brand === 'all' || c.brandId === filter.brand);
    const groups = [['active', 'En marcha'], ['planned', 'Planificadas'], ['done', 'Terminadas']].map(([k, label]) => [label, all.filter((c) => (c.status || 'planned') === k)]).filter(([, l]) => l.length);
    const create = () => campaignForm(null, (c) => c && go(`#/marketing/campanas/${c.id}`), filter.brand !== 'all' ? { brandId: filter.brand } : {});
    box.replaceChildren(...(all.length ? [
      el('header', { class: 'ng-copies-head' },
        el('p', { class: 'ng-card-text', text: 'Una campaña junta las publicaciones y los leads de un objetivo: así sabes cuánto costó cada lead y cuánto vendiste.' }),
        el('button', { type: 'button', class: 'pill', onclick: create }, icon('plus'), 'Nueva campaña'),
      ),
      ...groups.map(([label, items]) => el('section', { class: 'pg-section' }, el('h2', { text: label }), el('div', { class: 'ng-camps' }, items.map(campaignCard)))),
    ] : [el('div', { class: 'ng-card' }, empty({
      ico: 'rocket',
      title: 'Todavía no hay campañas',
      text: 'Crea una para un lanzamiento, una promoción o un mes de contenido, con su presupuesto y los leads que esperas.',
      action: el('button', { type: 'button', class: 'pill', onclick: create }, icon('plus'), 'Nueva campaña'),
    }))]));
  };
  draw();
  return { node: box, refresh: draw };
}

function campaignPage(id) {
  const box = el('div', { class: 'ng-brand-page' });
  const draw = () => {
    const c = find('campaigns', id);
    if (!c) {
      box.replaceChildren(el('div', { class: 'ng-card' }, empty({ ico: 'rocket', title: 'Esa campaña ya no existe', action: el('a', { class: 'pill', href: '#/marketing/campanas', text: 'Ver campañas' }) })));
      return;
    }
    const s = campaignStats(c);
    const b = c.brandId && find('brands', c.brandId);
    const [label, color] = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.planned;
    const leadsWon = s.won.length;
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg', style: { '--c': color } }, el('i', { class: 'ng-chipbtn-dot' }), label);
    statusBtn.addEventListener('click', () => {
      const order = Object.keys(CAMPAIGN_STATUS);
      c.status = order[(order.indexOf(c.status) + 1) % order.length];
      put('campaigns', c);
    });
    box.replaceChildren(
      el('header', { class: 'ng-profile' },
        el('a', { class: 'ng-ibtn', href: '#/marketing/campanas', 'aria-label': 'Volver a campañas', title: 'Volver' }, icon('back')),
        el('div', { class: 'ng-profile-id' },
          el('span', { class: 'ng-camp-mark', style: { '--c': c.color || 'var(--ink)' } }, icon('rocket')),
          el('div', {}, el('h1', { text: c.name }), el('p', { text: [b?.name, c.start && `${dateText(c.start)} → ${c.end ? dateText(c.end) : 'sin final'}`].filter(Boolean).join(' · ') })),
        ),
        el('div', { class: 'ng-profile-row' },
          el('ul', { class: 'ng-contact' }, el('li', {}, statusBtn), c.goal && el('li', {}, icon('target'), el('span', { text: c.goal }))),
          el('div', { class: 'ng-head-actions' },
            el('button', { type: 'button', class: 'pill ghost', onclick: () => campaignForm(c, (x) => { if (!x) go('#/marketing/campanas'); }) }, icon('edit'), 'Editar'),
            el('button', { type: 'button', class: 'pill ghost', onclick: () => createLead({ campaignId: c.id, brandId: c.brandId || '' }) }, icon('funnel'), 'Nuevo lead'),
            el('button', { type: 'button', class: 'pill', onclick: () => postForm(newPost({ brandId: c.brandId || brands()[0]?.id, campaignId: c.id, date: c.start && c.start > todayISO() ? c.start : todayISO() })) }, icon('plus'), 'Nueva publicación'),
          ),
        ),
      ),
      el('div', { class: 'ng-kpis' },
        stat({ label: 'Publicaciones', value: `${s.published.length} / ${s.posts.length}`, ico: 'calendar', sub: s.reach ? `${bigNum(s.reach)} de alcance` : 'Publicadas del total' }),
        stat({ label: 'Leads', value: s.target ? `${s.leads.length} / ${s.target}` : String(s.leads.length), ico: 'funnel', sub: `${leadsWon} ${leadsWon === 1 ? 'ganado' : 'ganados'}` }),
        stat({ label: 'Coste por lead', value: s.cpl != null ? money(s.cpl, c.currency) : '—', ico: 'wallet', sub: s.spent ? `${money(s.spent, c.currency)} gastados` : c.budget ? `Con el presupuesto de ${money(c.budget, c.currency)}` : 'Sin presupuesto' }),
        stat({ label: 'Ventas', value: money(s.wonValue, c.currency), ico: 'trophy', tone: s.roi != null && s.roi < 0 ? 'var(--expense)' : null, sub: s.roi != null ? `Retorno del ${Math.round(s.roi * 100)} %` : 'De los leads ganados' }),
      ),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Publicaciones' }), el('p', { text: s.posts.length ? 'Por fecha.' : 'Ninguna todavía.' }))),
          s.posts.length ? el('div', { class: 'ng-rows' }, [...s.posts].sort(byDate).map((p) => {
            const e = engagement(p);
            const n = leadsOf(p).length;
            return el('button', { type: 'button', class: 'ng-row is-mini ng-camp-post', onclick: () => postForm(p) },
              el('span', { class: 'ng-row-ico' }, icon(FORMATS[p.format]?.[1] || 'image')),
              el('span', { class: 'ng-row-main' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: [dateText(p.date), e != null && `Interacción ${pctText(e)}`, n && `${n} ${n === 1 ? 'lead' : 'leads'}`].filter(Boolean).join(' · ') })),
              el('span', { class: 'ng-row-tag' }, statusTag(p.status)),
            );
          })) : el('p', { class: 'ng-hint', text: 'Crea una publicación en esta campaña o elígela en el formulario de una existente.' }),
        ),
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Leads' }), el('p', { text: s.leads.length ? 'Los que llegaron por esta campaña.' : 'Ninguno todavía.' }))),
          s.leads.length ? el('div', { class: 'ng-rows' }, s.leads.map((l) => el('button', { type: 'button', class: 'ng-row is-mini ng-camp-post', onclick: () => openLead(l.id) },
            el('span', { class: 'ng-row-ico' }, icon('funnel')),
            el('span', { class: 'ng-row-main' }, el('b', { text: l.name || l.company || 'Sin nombre' }), el('small', { text: [l.interest, l.value ? money(l.value, l.currency) : ''].filter(Boolean).join(' · ') || 'Sin detalle' })),
            el('span', { class: 'ng-row-tag' }, chip(...(LEAD_STAGES[l.stage] || LEAD_STAGES.new).slice(0, 2))),
          ))) : el('p', { class: 'ng-hint', text: 'Al apuntar un lead, elige esta campaña en «De dónde vino».' }),
        ),
      ),
      c.notes && el('section', { class: 'ng-card ng-notes' }, el('h2', { text: 'Notas' }), el('p', { text: c.notes })),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

// ── Resultados ──

function resultsView(filter) {
  const box = el('div', { class: 'ng-results-view' });
  const draw = () => {
    const r = periodRange(mk.period);
    const inBrand = (p) => filter.brand === 'all' || p.brandId === filter.brand;
    const published = list('posts').filter((p) => inBrand(p) && p.status === 'publicado' && within(p.date, r));
    const before = r.prev ? list('posts').filter((p) => inBrand(p) && p.status === 'publicado' && within(p.date, r.prev)) : [];
    const sum = (posts, k) => posts.reduce((s, p) => s + (Number(p.metrics?.[k]) || 0), 0);
    const reach = sum(published, 'reach');
    const reachBefore = sum(before, 'reach');
    const measured = published.filter((p) => engagement(p) != null);
    const avgEng = measured.length ? measured.reduce((s, p) => s + engagement(p), 0) / measured.length : null;
    const leads = list('leads').filter((l) => (filter.brand === 'all' || l.brandId === filter.brand) && within(l.createdOn || '', r));
    const social = leads.filter((l) => l.postId || ['instagram', 'facebook', 'tiktok'].includes(l.source));
    const won = leads.filter((l) => l.stage === 'won');
    const follows = sum(published, 'follows');

    const ranked = [...published].map((p) => ({ p, e: engagement(p), leads: leadsOf(p).length })).sort((a, b) => (b.leads - a.leads) || ((b.e ?? -1) - (a.e ?? -1)));
    const missing = published.filter((p) => !hasMetrics(p)).length;

    // Qué papel del embudo trae resultados: interacción media y leads por rol.
    const roles = Object.entries(ROLES).map(([k, role]) => {
      const posts = published.filter((p) => p.role === k);
      const m = posts.filter((p) => engagement(p) != null);
      return { role, posts: posts.length, eng: m.length ? m.reduce((s, p) => s + engagement(p), 0) / m.length : null, leads: posts.reduce((s, p) => s + leadsOf(p).length, 0) };
    });
    const formats = Object.entries(FORMATS).map(([k, [label, ico]]) => {
      const posts = published.filter((p) => p.format === k);
      const m = posts.filter((p) => engagement(p) != null);
      return { label, ico, posts: posts.length, eng: m.length ? m.reduce((s, p) => s + engagement(p), 0) / m.length : null, reach: sum(posts, 'reach') };
    }).filter((x) => x.posts);
    const topEng = Math.max(0.0001, ...roles.map((x) => x.eng || 0), ...formats.map((x) => x.eng || 0));

    box.replaceChildren(
      el('div', { class: 'ng-kpis' },
        stat({ label: 'Publicadas', value: String(published.length), delta: change(published.length, before.length), sub: missing ? `${missing} sin resultados apuntados` : 'Con sus resultados' }),
        stat({ label: 'Alcance', value: bigNum(reach), delta: change(reach, reachBefore), sub: follows ? `${bigNum(follows)} seguidores nuevos` : 'Personas a las que llegaste' }),
        stat({ label: 'Interacción media', value: pctText(avgEng), ico: 'heart', sub: measured.length ? `De ${measured.length} con alcance` : 'Apunta el alcance y los me gusta' }),
        stat({ label: 'Leads de redes', value: String(social.length), ico: 'funnel', sub: `${won.length} ${won.length === 1 ? 'ganado' : 'ganados'} de ${leads.length} en total` }),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Las que mejor funcionaron' }), el('p', { text: 'Primero las que trajeron leads; luego, por interacción.' }))),
        ranked.length ? el('div', { class: 'ng-rows' }, ranked.slice(0, 8).map(({ p, e, leads: n }) => {
          const b = brandOf(p);
          return el('button', { type: 'button', class: 'ng-row is-mini ng-res-row', onclick: () => postForm(p) },
            el('span', { class: 'ng-res-media' }, p.assetUrl ? el('img', { src: p.assetUrl, alt: '', loading: 'lazy' }) : el('i', { style: { '--c': p.color || brandColor(b) } })),
            el('span', { class: 'ng-row-main' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: [b?.name, dateText(p.date), FORMATS[p.format]?.[0]].filter(Boolean).join(' · ') })),
            el('span', { class: 'ng-row-stat' }, el('small', { text: 'Alcance' }), el('b', { text: p.metrics?.reach ? bigNum(p.metrics.reach) : '—' })),
            el('span', { class: 'ng-row-stat' }, el('small', { text: 'Interacción' }), el('b', { text: pctText(e) })),
            el('span', { class: 'ng-row-stat' }, el('small', { text: 'Leads' }), el('b', { text: String(n) })),
          );
        })) : el('p', { class: 'ng-none', text: 'Ninguna publicada en este periodo.' }),
      ),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por papel en el embudo' }), el('p', { text: 'Interacción media y leads de cada tipo de publicación.' }))),
          el('ul', { class: 'ng-bars ng-res-bars' }, roles.map((x) => el('li', { style: { '--c': x.role[2] }, title: x.role[3] },
            el('div', { class: 'ng-bars-name' }, el('i', { class: 'ng-dot' }), el('span', { text: `${x.role[0]} (${x.posts})` })),
            el('span', { class: 'ng-bars-track' }, el('i', { style: { width: `${x.eng ? Math.max(3, (x.eng / topEng) * 100) : 0}%` } })),
            el('b', { text: pctText(x.eng) }),
            el('small', { text: `${x.leads} ${x.leads === 1 ? 'lead' : 'leads'}` }),
          ))),
        ),
        el('section', { class: 'ng-card' },
          el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Por formato' }), el('p', { text: 'Qué formato engancha más.' }))),
          formats.length ? el('ul', { class: 'ng-bars ng-res-bars' }, formats.map((x) => el('li', { style: { '--c': 'var(--ink)' } },
            el('div', { class: 'ng-bars-name' }, icon(x.ico), el('span', { text: `${x.label} (${x.posts})` })),
            el('span', { class: 'ng-bars-track' }, el('i', { style: { width: `${x.eng ? Math.max(3, (x.eng / topEng) * 100) : 0}%` } })),
            el('b', { text: pctText(x.eng) }),
            el('small', { text: x.reach ? `${bigNum(x.reach)} alcance` : '' }),
          ))) : el('p', { class: 'ng-none', text: 'Sin publicaciones en este periodo.' }),
        ),
      ),
      el('p', { class: 'ng-kpi-note', text: `Los resultados se apuntan en cada publicación (${METRICS.map(([, l]) => l.toLowerCase()).slice(0, 3).join(', ')}…). Instagram y Facebook los enseñan en sus estadísticas.` }),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

// ── Marcas ──

function brandsView() {
  const box = el('div', { class: 'ng-brands' });
  const draw = () => {
    const month = todayISO().slice(0, 7);
    box.replaceChildren(
      ...brands().map((b) => {
        const posts = list('posts').filter((p) => p.brandId === b.id);
        const upcoming = posts.filter((p) => p.date >= todayISO() && p.status !== 'publicado').length;
        const leadsMonth = list('leads').filter((l) => l.brandId === b.id && (l.createdOn || '').startsWith(month)).length;
        return el('a', { class: 'ng-brand-card', href: `#/marketing/marcas/${b.id}`, style: { '--c': brandColor(b) } },
          el('div', { class: 'ng-brand-top' }, brandMark(b, 'is-lg'), el('div', { class: 'ng-brand-swatches' }, ['primary', 'secondary', 'accent'].map((k) => el('i', { style: { '--c': b.colors?.[k] || '#ccc' }, title: b.colors?.[k] })))),
          el('b', { text: b.name }),
          el('small', { text: [b.handle, b.industry].filter(Boolean).join(' · ') }),
          el('div', { class: 'ng-brand-stats' },
            el('span', {}, el('b', { text: String(posts.filter((p) => p.date.startsWith(month)).length) }), b.cadence ? `este mes · ${b.cadence}/sem` : 'este mes'),
            el('span', {}, el('b', { text: String(upcoming) }), 'por publicar'),
            el('span', {}, el('b', { text: String(leadsMonth) }), 'leads este mes'),
          ),
        );
      }),
      el('button', {
        type: 'button',
        class: 'ng-brand-card is-new',
        onclick: () => {
          const b = { id: uid(), order: brands().length, name: 'Marca nueva', handle: '', industry: '', tone: '', fonts: '', colors: { primary: '#1d2126', secondary: '#00b8d4', accent: '#1f9d46' }, guidelines: '', audience: '', pillars: '', hashtags: '', hashtagSets: '', cadence: 3, cta: '', link: '', logo: '', assets: [], svgs: [] };
          put('brands', b);
          go(`#/marketing/marcas/${b.id}`);
        },
      }, icon('plus'), el('b', { text: 'Nueva marca' })),
    );
  };
  draw();
  return { node: box, refresh: draw };
}

function brandPage(id) {
  const box = el('div', { class: 'ng-brand-page' });
  let dark = false;
  let pending = null;

  const draw = () => {
    const b = find('brands', id);
    if (!b) {
      box.replaceChildren(el('div', { class: 'ng-card' }, empty({ ico: 'palette2', title: 'Esa marca ya no existe', action: el('a', { class: 'pill', href: '#/marketing/marcas', text: 'Ver marcas' }) })));
      return;
    }
    // Cada campo se guarda al escribir; el resto de la página no se repinta mientras.
    const save = () => {
      clearTimeout(pending);
      pending = setTimeout(() => put('brands', b), 250);
    };
    const text = (key, props = {}) => {
      const node = input({ value: b[key] ?? '', ...props });
      node.addEventListener('input', () => { b[key] = node.value; save(); });
      return node;
    };
    const area = (key, props = {}) => {
      const node = autosize(el('textarea', { value: b[key] || '', rows: 2, ...props }));
      node.addEventListener('input', () => { b[key] = node.value; save(); });
      return node;
    };
    const number = (key, props = {}) => {
      const node = input({ value: b[key] ? String(b[key]) : '', inputmode: 'numeric', ...props });
      node.addEventListener('input', () => { b[key] = Math.max(0, Math.round(Number(node.value.replace(/\D/g, '')) || 0)); save(); });
      return node;
    };
    const color = (key, label) => {
      const value = b.colors?.[key] || '#000000';
      const hex = input({ value, maxLength: 7, 'aria-label': `${label} en hexadecimal`, class: 'ng-hex' });
      const pick = el('input', { type: 'color', value, 'aria-label': label });
      const set = (v) => {
        if (!/^#[0-9a-f]{6}$/i.test(v)) return;
        b.colors = { ...b.colors, [key]: v.toLowerCase() };
        save();
      };
      pick.addEventListener('input', () => { hex.value = pick.value; set(pick.value); });
      hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) pick.value = hex.value; set(hex.value); });
      return el('div', { class: 'ng-colorbox' }, el('span', { text: label }), el('div', {}, pick, hex, iconButton('copy', `Copiar ${label}`, () => copyText(hex.value, 'Color'))));
    };

    const logoIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    logoIn.addEventListener('change', async () => {
      const f = logoIn.files[0];
      logoIn.value = '';
      if (!f) return;
      try {
        b.logo = fileUrl((await uploadFile(f)).id);
        put('brands', b);
        draw();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    const assetIn = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, multiple: true });
    assetIn.addEventListener('change', async () => {
      const files = [...assetIn.files];
      assetIn.value = '';
      for (const f of files) {
        try {
          toast(`Subiendo ${f.name}…`);
          const meta = await uploadFile(f);
          b.assets = [...(b.assets || []), { id: uid(), title: f.name.replace(/\.[^.]+$/, ''), url: fileUrl(meta.id), darkUrl: '', note: 'Subida' }];
          put('brands', b);
        } catch (err) {
          toast(err.message, 'error');
        }
      }
      draw();
    });

    const posts = list('posts').filter((p) => p.brandId === b.id);
    box.replaceChildren(
      el('header', { class: 'ng-profile' },
        el('a', { class: 'ng-ibtn', href: '#/marketing/marcas', 'aria-label': 'Volver a marcas', title: 'Volver' }, icon('back')),
        el('div', { class: 'ng-profile-id' },
          brandMark(b, 'is-xl'),
          el('div', {}, el('h1', { text: b.name || 'Sin nombre' }), el('p', { text: [b.handle, b.industry].filter(Boolean).join(' · ') || 'Completa sus datos abajo.' })),
        ),
        el('div', { class: 'ng-profile-row' },
          el('div', { class: 'ng-head-actions' },
            el('button', { type: 'button', class: 'pill', onclick: () => postForm(newPost({ brandId: b.id })) }, icon('plus'), 'Nueva publicación'),
            el('button', { type: 'button', class: 'pill ghost', onclick: () => { mk.brand = b.id; go('#/marketing'); } }, icon('calendar'), `Ver su calendario (${posts.length})`),
            el('button', { type: 'button', class: 'pill ghost', onclick: () => { mk.brand = b.id; go('#/marketing/resultados'); } }, icon('chart'), 'Resultados'),
          ),
        ),
      ),
      el('div', { class: 'ng-split' },
        el('section', { class: 'ng-card ng-form' },
          el('h2', { text: 'Identidad' }),
          el('div', { class: 'ng-grid2' }, field('Nombre', text('name', { maxLength: 80 })), field('Usuario', text('handle', { maxLength: 60, placeholder: '@marca' }))),
          field('A qué se dedica', text('industry', { maxLength: 160 })),
          el('div', { class: 'ng-field' }, el('span', { text: 'Logo' }), el('div', { class: 'ng-logo-row' },
            el('div', { class: `ng-logo-pick${b.logo ? '' : ' is-empty'}` }, el('img', { src: b.logo || '', alt: '' }), el('span', { text: 'Sin logo' })),
            el('div', { class: 'ng-logo-actions' },
              el('button', { type: 'button', class: 'pill ghost sm', onclick: () => logoIn.click() }, icon('upload'), 'Subir logo'),
              b.logo && el('button', { type: 'button', class: 'pill ghost sm', text: 'Quitar', onclick: () => { b.logo = ''; put('brands', b); draw(); } }),
              logoIn,
            ),
          )),
          el('div', { class: 'ng-field' }, el('span', { text: 'Colores' }), el('div', { class: 'ng-colors' }, color('primary', 'Principal'), color('secondary', 'Secundario'), color('accent', 'Acento'))),
          field('Tipografía', text('fonts', { maxLength: 160 })),
          field('Tono de voz', area('tone', { maxLength: 1000 })),
        ),
        el('section', { class: 'ng-card ng-form' },
          el('h2', { text: 'Estrategia' }),
          field('Público (buyer persona)', area('audience', { maxLength: 2000 })),
          field('Pilares de contenido', area('pillars', { maxLength: 2000 }), 'Uno por línea. Cada publicación puede llevar el suyo.'),
          el('div', { class: 'ng-grid2' },
            field('Publicaciones por semana', number('cadence', { maxLength: 2, placeholder: '3' }), 'El calendario te dice si vas al día.'),
            field('Seguidores', number('followers', { maxLength: 9, placeholder: '0' }), 'Para la vista del feed.'),
          ),
          field('Llamada a la acción', text('cta', { maxLength: 200 })),
          field('Enlace', text('link', { maxLength: 300, placeholder: 'https://…' }), 'Sustituye a «link en la bio» al adaptar un copy a Facebook.'),
          field('Hashtags de la marca', area('hashtags', { maxLength: 1000 }), 'Se ponen solos en cada publicación nueva.'),
          field('Grupos de hashtags', area('hashtagSets', { maxLength: 3000, placeholder: 'Finanzas: #ahorro #presupuesto\nVenezuela: #venezuela #caracas' }), 'Uno por línea, «Nombre: #uno #dos». Se añaden con un toque al escribir una publicación.'),
          field('Pautas de diseño', area('guidelines', { maxLength: 3000 })),
        ),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' },
          el('div', {}, el('h2', { text: 'Imágenes y capturas' }), el('p', { text: 'Se eligen al crear una publicación.' })),
          el('div', { class: 'ng-head-actions' },
            (b.assets || []).some((a) => a.darkUrl) && el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Versión' },
              el('button', { type: 'button', class: 'ng-fchip is-soft', 'aria-pressed': String(!dark), text: 'Claro', onclick: () => { dark = false; draw(); } }),
              el('button', { type: 'button', class: 'ng-fchip is-soft', 'aria-pressed': String(dark), text: 'Oscuro', onclick: () => { dark = true; draw(); } }),
            ),
            el('button', { type: 'button', class: 'pill ghost sm', onclick: () => assetForm(b, draw) }, icon('link'), 'Por dirección'),
            el('button', { type: 'button', class: 'pill sm', onclick: () => assetIn.click() }, icon('upload'), 'Subir'),
            assetIn,
          ),
        ),
        (b.assets || []).length ? el('div', { class: 'ng-assets' }, b.assets.map((a) => {
          const src = dark && a.darkUrl ? a.darkUrl : a.url;
          return el('figure', { class: 'ng-asset' },
            el('a', { href: src, target: '_blank', rel: 'noopener', title: 'Abrir' }, el('img', { src, alt: a.title, loading: 'lazy' })),
            el('figcaption', {},
              el('span', { text: a.title }),
              iconButton('copy', 'Copiar dirección', () => copyText(new URL(src, location.origin).href, 'Dirección')),
              iconButton('trash', 'Quitar de la marca', async () => {
                if (!(await confirmBox(`¿Quitar «${a.title}» de ${b.name}?`, 'Quitar'))) return;
                b.assets = b.assets.filter((x) => x.id !== a.id);
                put('brands', b);
                draw();
              }),
            ),
          );
        })) : el('p', { class: 'ng-none', text: 'Todavía no hay imágenes.' }),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' },
          el('div', {}, el('h2', { text: 'Logos en SVG' }), el('p', { text: 'Pega el código una vez y cópialo o descárgalo cuando haga falta.' })),
          el('button', { type: 'button', class: 'pill sm', onclick: () => svgForm(b, draw) }, icon('code'), 'Añadir SVG'),
        ),
        (b.svgs || []).length ? el('div', { class: 'ng-assets is-svg' }, b.svgs.map((s) => el('figure', { class: 'ng-asset' },
          el('div', { class: 'ng-svg-box' }, el('img', { src: svgUrl(s.code), alt: s.title })),
          el('figcaption', {},
            el('span', { text: s.title }),
            iconButton('copy', 'Copiar código', () => copyText(s.code, 'Código SVG')),
            iconButton('download', 'Descargar .svg', () => downloadSvg(s)),
            iconButton('trash', 'Quitar', async () => {
              if (!(await confirmBox(`¿Quitar «${s.title}»?`, 'Quitar'))) return;
              b.svgs = b.svgs.filter((x) => x.id !== s.id);
              put('brands', b);
              draw();
            }),
          ),
        ))) : el('p', { class: 'ng-none', text: 'Sin SVG todavía.' }),
      ),
      el('div', { class: 'ng-danger-row' },
        el('button', {
          type: 'button',
          class: 'pill ghost danger',
          onclick: async () => {
            const n = posts.length;
            if (!(await confirmBox(`¿Eliminar la marca ${b.name}?${n ? ` Sus ${n} publicaciones se quedan sin marca.` : ''}`))) return;
            remove('brands', b.id);
            toast('Marca eliminada.');
            go('#/marketing/marcas');
          },
        }, icon('trash'), 'Eliminar marca'),
      ),
    );
  };
  draw();
  // Mientras se escribe no se repinta: solo cuando cambian cosas de fuera (imágenes, SVG).
  return { node: box, refresh: () => { if (!box.contains(document.activeElement) || document.activeElement === document.body) draw(); } };
}

// ── La página ──

export function marketingPage(sub = 'calendario', id = '') {
  ensureBrands();
  const tab = TABS.some(([k]) => k === sub) ? sub : 'calendario';
  if (tab === 'marcas' && id) {
    const page = brandPage(id);
    return { node: el('div', { class: 'ng-page ng-mkt' }, page.node), refresh: page.refresh };
  }
  if (tab === 'campanas' && id) {
    const page = campaignPage(id);
    return { node: el('div', { class: 'ng-page ng-mkt' }, page.node), refresh: () => { if (!document.querySelector('dialog[open]')) page.refresh(); } };
  }

  const content = el('div', { class: 'ng-mkt-body' });
  let view = null;
  const filterBar = el('div', { class: 'ng-mkt-filters' });

  const build = () => {
    const filter = { ...mk };
    view = tab === 'tablero' ? boardView(filter)
      : tab === 'copias' ? copiesView(filter)
        : tab === 'feed' ? feedView(filter)
          : tab === 'marcas' ? brandsView()
            : tab === 'campanas' ? campaignsView(filter)
              : tab === 'resultados' ? resultsView(filter)
                : calendarView(filter);
    content.replaceChildren(view.node);
  };

  const drawFilters = () => {
    if (tab === 'marcas') {
      filterBar.replaceChildren();
      return;
    }
    const all = brands();
    filterBar.replaceChildren(...[
      el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Marca' },
        tab !== 'feed' && el('button', { type: 'button', class: 'ng-fchip', 'aria-pressed': String(mk.brand === 'all'), text: 'Todas', onclick: () => { mk.brand = 'all'; drawFilters(); build(); } }),
        all.map((b) => el('button', {
          type: 'button',
          class: 'ng-fchip has-mark',
          'aria-pressed': String(mk.brand === b.id || (tab === 'feed' && mk.brand === 'all' && b === all[0])),
          onclick: () => { mk.brand = b.id; drawFilters(); build(); },
        }, brandMark(b, 'is-xs'), b.name)),
      ),
      (tab === 'calendario' || tab === 'copias') && el('div', { class: 'ng-filters' },
        select([['all', 'Todo el embudo'], ...Object.entries(ROLES).map(([k, r]) => [k, `${r[0]} (${r[1]})`])], mk.role, { 'aria-label': 'Rol en el embudo', onchange: (e) => { mk.role = e.target.value; build(); } }),
        select([['all', 'Todos los estados'], ...STATUS_ORDER.map((k) => [k, POST_STATUS[k][0]])], mk.status, { 'aria-label': 'Estado', onchange: (e) => { mk.status = e.target.value; build(); } }),
      ),
      tab === 'resultados' && seg(PERIODS, mk.period, (v) => { mk.period = v; build(); }, 'Periodo'),
    ].filter(Boolean));
  };

  const newMenu = () => {
    if (tab === 'campanas') campaignForm(null, (c) => c && go(`#/marketing/campanas/${c.id}`), mk.brand !== 'all' ? { brandId: mk.brand } : {});
    else postForm(newPost(mk.brand !== 'all' ? { brandId: mk.brand } : {}));
  };

  const node = el('div', { class: 'ng-page ng-mkt' },
    el('header', { class: 'ng-head' },
      el('div', {}, el('h1', { text: 'Marketing' }), el('p', { text: 'Qué vas a publicar, cuándo y con qué marca; qué campañas tienes en marcha y qué resultados y leads traen.' })),
      el('div', { class: 'ng-head-actions' },
        el('a', { class: 'pill ghost', href: '#/leads' }, icon('funnel'), 'Leads'),
        el('button', { type: 'button', class: 'pill', onclick: newMenu }, icon('plus'), tab === 'campanas' ? 'Nueva campaña' : 'Nueva publicación'),
      ),
    ),
    el('nav', { class: 'ng-tabs', 'aria-label': 'Secciones de marketing' }, TABS.map(([k, label, ico]) => el('a', { href: k === 'calendario' ? '#/marketing' : `#/marketing/${k}`, 'aria-current': k === tab ? 'page' : null }, icon(ico), label))),
    filterBar,
    content,
  );
  drawFilters();
  build();
  return {
    node,
    refresh: () => {
      // Con una ventana abierta no se repinta debajo; al cerrarla llega otro cambio.
      if (document.querySelector('dialog[open]')) return;
      build();
    },
  };
}
