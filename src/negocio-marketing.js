// Negocio · Marketing: la página con sus pestañas (calendario, tablero, copias,
// feed y marcas) y un filtro de marca que vale para todas.

import { state, find, put, remove, uid, el, icon, iconButton, field, input, select, confirmBox, toast, autosize, todayISO, dateText, empty } from './negocio-core.js';
import { go } from './negocio-views.js';
import { uploadFile, fileUrl } from './negocio-gastos.js';
import {
  ensureBrands, brands, brandOf, brandColor, brandMark, postsOf, byDate, newPost, postForm, igText, copyText, statusTag,
  POST_STATUS, STATUS_ORDER, ROLES, FORMATS, assetForm, svgForm, svgUrl, downloadSvg,
} from './negocio-contenido.js';
import { calendarView, boardView } from './negocio-calendario.js';

const list = (col) => state[col] || [];
const TABS = [['calendario', 'Calendario', 'calendar'], ['tablero', 'Tablero', 'board'], ['copias', 'Copias', 'instagram'], ['feed', 'Feed', 'grid'], ['marcas', 'Marcas', 'palette2']];
export const mk = { brand: 'all', role: 'all', status: 'all' };

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
        el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Qué publicaciones ver' }, scopes.map(([k, label]) => el('button', { type: 'button', class: 'ng-chipbtn', 'aria-pressed': String(scope === k), text: label, onclick: () => { scope = k; draw(); } }))),
        el('p', { class: 'ng-card-text', text: 'Copia el texto y pégalo en Instagram o Facebook. El de Instagram ya lleva los hashtags.' }),
      ),
      posts.length ? el('div', { class: 'ng-copies-list' }, posts.map((p) => {
        const b = brandOf(p);
        const ig = igText(p);
        return el('article', { class: 'ng-copy' },
          el('header', {},
            brandMark(b, 'is-sm'),
            el('div', { class: 'ng-copy-title' }, el('b', { text: p.title || 'Sin título' }), el('small', { text: [b?.name, dateText(p.date), p.time, FORMATS[p.format]?.[0]].filter(Boolean).join(' · ') })),
            statusTag(p.status),
            el('button', { type: 'button', class: 'pill ghost sm', onclick: () => postForm(p) }, icon('edit'), 'Editar'),
          ),
          el('div', { class: 'ng-copy-cols' },
            el('section', {},
              el('div', { class: 'ng-copy-label' }, icon('instagram'), 'Instagram', el('button', { type: 'button', class: 'pill sm', onclick: () => copyText(ig, 'Copy de Instagram'), disabled: !ig }, icon('copy'), 'Copiar')),
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

    const tile = (p) => el('button', { type: 'button', class: 'ng-tile', title: `${p.title} · ${dateText(p.date)}`, onclick: () => postForm(p) },
      p.assetUrl ? el('img', { src: p.assetUrl, alt: '', loading: 'lazy' }) : el('span', { class: 'ng-tile-cover', style: { '--c': p.color || brandColor(b) } }, el('b', { text: p.title })),
      p.format !== 'imagen' && el('span', { class: 'ng-tile-ico' }, icon(FORMATS[p.format]?.[1] || 'image')),
      p.status !== 'publicado' && el('span', { class: 'ng-tile-when', text: dateText(p.date).replace(/ \d{4}$/, '') }),
    );

    box.replaceChildren(
      el('div', { class: 'ng-phone' },
        el('div', { class: 'ng-phone-screen' },
          el('div', { class: 'ng-igp-head' },
            el('b', { text: (b.handle || b.name).replace(/^@/, '') }),
          ),
          el('div', { class: 'ng-igp-profile' },
            brandMark(b, 'is-ring'),
            el('div', { class: 'ng-igp-stats' },
              el('span', {}, el('b', { text: String(posts.length) }), 'publicaciones'),
              el('span', {}, el('b', { text: '—' }), 'seguidores'),
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
          el('p', { class: 'ng-card-text', text: 'Lo más nuevo arriba a la izquierda, como en Instagram. Las historias no entran en la cuadrícula.' }),
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

// ── Marcas ──

function brandsView() {
  const box = el('div', { class: 'ng-brands' });
  const draw = () => {
    const month = todayISO().slice(0, 7);
    box.replaceChildren(
      ...brands().map((b) => {
        const posts = list('posts').filter((p) => p.brandId === b.id);
        const upcoming = posts.filter((p) => p.date >= todayISO() && p.status !== 'publicado').length;
        return el('a', { class: 'ng-brand-card', href: `#/marketing/marcas/${b.id}`, style: { '--c': brandColor(b) } },
          el('div', { class: 'ng-brand-top' }, brandMark(b, 'is-lg'), el('div', { class: 'ng-brand-swatches' }, ['primary', 'secondary', 'accent'].map((k) => el('i', { style: { '--c': b.colors?.[k] || '#ccc' }, title: b.colors?.[k] })))),
          el('b', { text: b.name }),
          el('small', { text: [b.handle, b.industry].filter(Boolean).join(' · ') }),
          el('div', { class: 'ng-brand-stats' },
            el('span', {}, el('b', { text: String(posts.filter((p) => p.date.startsWith(month)).length) }), 'este mes'),
            el('span', {}, el('b', { text: String(upcoming) }), 'por publicar'),
            el('span', {}, el('b', { text: String((b.assets || []).length + (b.svgs || []).length) }), 'recursos'),
          ),
        );
      }),
      el('button', {
        type: 'button',
        class: 'ng-brand-card is-new',
        onclick: () => {
          const b = { id: uid(), order: brands().length, name: 'Marca nueva', handle: '', industry: '', tone: '', fonts: '', colors: { primary: '#1d2126', secondary: '#00b8d4', accent: '#1f9d46' }, guidelines: '', audience: '', pillars: '', hashtags: '', cta: '', link: '', logo: '', assets: [], svgs: [] };
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
      const node = input({ value: b[key] || '', ...props });
      node.addEventListener('input', () => { b[key] = node.value; save(); });
      return node;
    };
    const area = (key, props = {}) => {
      const node = autosize(el('textarea', { value: b[key] || '', rows: 2, ...props }));
      node.addEventListener('input', () => { b[key] = node.value; save(); });
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
          field('Pilares de contenido', area('pillars', { maxLength: 2000 }), 'Uno por línea.'),
          field('Llamada a la acción', text('cta', { maxLength: 200 })),
          field('Enlace', text('link', { maxLength: 300, placeholder: 'https://…' }), 'Sustituye a «link en la bio» al adaptar un copy a Facebook.'),
          field('Hashtags de la marca', area('hashtags', { maxLength: 1000 }), 'Se ponen solos en cada publicación nueva.'),
          field('Pautas de diseño', area('guidelines', { maxLength: 3000 })),
        ),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' },
          el('div', {}, el('h2', { text: 'Imágenes y capturas' }), el('p', { text: 'Se eligen al crear una publicación.' })),
          el('div', { class: 'ng-head-actions' },
            (b.assets || []).some((a) => a.darkUrl) && el('div', { class: 'ng-chips', role: 'group', 'aria-label': 'Versión' },
              el('button', { type: 'button', class: 'ng-chipbtn', 'aria-pressed': String(!dark), text: 'Claro', onclick: () => { dark = false; draw(); } }),
              el('button', { type: 'button', class: 'ng-chipbtn', 'aria-pressed': String(dark), text: 'Oscuro', onclick: () => { dark = true; draw(); } }),
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

  const content = el('div', { class: 'ng-mkt-body' });
  let view = null;
  const filterBar = el('div', { class: 'ng-mkt-filters' });

  const build = () => {
    const filter = { ...mk };
    view = tab === 'tablero' ? boardView(filter)
      : tab === 'copias' ? copiesView(filter)
        : tab === 'feed' ? feedView(filter)
          : tab === 'marcas' ? brandsView()
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
        tab !== 'feed' && el('button', { type: 'button', class: 'ng-chipbtn', 'aria-pressed': String(mk.brand === 'all'), text: 'Todas', onclick: () => { mk.brand = 'all'; drawFilters(); build(); } }),
        all.map((b) => el('button', {
          type: 'button',
          class: 'ng-chipbtn has-mark',
          'aria-pressed': String(mk.brand === b.id || (tab === 'feed' && mk.brand === 'all' && b === all[0])),
          onclick: () => { mk.brand = b.id; drawFilters(); build(); },
        }, brandMark(b, 'is-xs'), b.name)),
      ),
      (tab === 'calendario' || tab === 'copias') && el('div', { class: 'ng-filters' },
        select([['all', 'Todo el embudo'], ...Object.entries(ROLES).map(([k, r]) => [k, `${r[0]} (${r[1]})`])], mk.role, { 'aria-label': 'Rol en el embudo', onchange: (e) => { mk.role = e.target.value; build(); } }),
        select([['all', 'Todos los estados'], ...STATUS_ORDER.map((k) => [k, POST_STATUS[k][0]])], mk.status, { 'aria-label': 'Estado', onchange: (e) => { mk.status = e.target.value; build(); } }),
      ),
    ].filter(Boolean));
  };

  const node = el('div', { class: 'ng-page ng-mkt' },
    el('header', { class: 'ng-head' },
      el('div', {}, el('h1', { text: 'Marketing' }), el('p', { text: 'Qué vas a publicar, cuándo y con qué marca: del guion al copy listo para pegar.' })),
      el('div', { class: 'ng-head-actions' },
        el('button', { type: 'button', class: 'pill', onclick: () => postForm(newPost(mk.brand !== 'all' ? { brandId: mk.brand } : {})) }, icon('plus'), 'Nueva publicación'),
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

