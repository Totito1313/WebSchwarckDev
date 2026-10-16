import { initMotion, onScroll, pinned, through, range, easeOut, setVar, reducedMotion } from './motion.js';
import { initTheme } from './theme.js';
import { initSmoothScroll } from './smooth.js';
import { renderChangelog } from './changelog-render.js';
import { finePointer, initWordmark } from './studio-fx.js';
import { loadDownload } from './cf-download.js';

// El botón de descarga (texto y enlace) lo decide el panel: /admin › Botón de descarga.
loadDownload();

const motion = initMotion();
initTheme();
initSmoothScroll();

// El pie del estudio: el nombre gigante se ilumina bajo el cursor (src/studio-fx.js).
const fine = finePointer();
initWordmark(motion, fine);

// ── Fondo vivo: cuánto se ha leído (la barra de arriba y las auroras) ──
const root = document.documentElement;
onScroll(() => {
  const max = root.scrollHeight - innerHeight;
  setVar(root, '--sp', max > 0 ? scrollY / max : 0);
});

// ── Con ratón: la luz del fondo y la de cada tarjeta siguen al cursor ──
if (fine) {
  const bg = document.querySelector('.cf-bg');
  let raf = 0;
  let mx = 0;
  let my = 0;
  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      bg?.style.setProperty('--mx', `${mx}px`);
      bg?.style.setProperty('--my', `${my}px`);
    });
  }, { passive: true });
  for (const card of document.querySelectorAll('[data-spot], [data-spots] > li')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--sx', `${e.clientX - r.left}px`);
      card.style.setProperty('--sy', `${e.clientY - r.top}px`);
    });
  }
}

// ── Hero: el teléfono sube, el texto se va y las pantallas pasan dentro ──
const hero = document.querySelector('[data-hero]');
if (hero && motion) {
  const stage = hero.querySelector('.hero-stage');
  const copy = hero.querySelector('.hero-copy');
  const phone = hero.querySelector('.hero-phone');
  const reel = hero.querySelector('.reel');
  const steps = [...hero.querySelectorAll('.hero-steps li')];
  const count = reel.children.length;
  let shown = -1;

  // Cuánto baja el teléfono al inicio para asomar justo debajo del texto.
  const measure = () => {
    const drop = Math.max(0, copy.offsetTop + copy.offsetHeight + 28 - phone.offsetTop);
    stage.style.setProperty('--drop', `${drop}px`);
  };
  // En pantallas muy bajas (un teléfono acostado) el hero se queda como página normal.
  const tall = matchMedia('(min-height: 480px)');
  const pin = () => { hero.classList.toggle('is-pinned', tall.matches); measure(); };
  pin();
  tall.addEventListener('change', pin);
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);

  onScroll((vh) => {
    const p = pinned(hero, vh);
    const e = easeOut(range(p, 0, 0.22));
    setVar(stage, '--p', p);
    setVar(stage, '--e', e);
    copy.classList.toggle('is-gone', p > 0.2);

    const i = Math.min(count - 1, Math.floor(range(p, 0.22, 0.98) * count));
    if (i === shown) return;
    shown = i;
    stage.style.setProperty('--i', i);
    steps.forEach((step, k) => step.classList.toggle('on', k === i));
  });
}

// ── Tarjetas apiladas: cada una sabe por dónde va en la pantalla ──
if (motion) {
  const panels = [...document.querySelectorAll('[data-panel]')];
  if (panels.length) onScroll((vh) => { for (const panel of panels) setVar(panel, '--p', through(panel, vh)); });
}

// ── Balance: el mismo dinero en otra moneda ──
const bal = document.querySelector('[data-balance]');
if (bal) {
  const seg = bal.querySelector('.seg');
  const thumb = bal.querySelector('.seg-thumb');
  const sym = bal.querySelector('.bal-sym');
  const val = bal.querySelector('.bal-val');
  const buttons = [...seg.querySelectorAll('button')];
  // Miles con espacio fino y coma decimal, como en la app.
  const format = (n) => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let current = Number(buttons.find((b) => b.getAttribute('aria-pressed') === 'true').dataset.value);
  let frame = 0;

  const placeThumb = (btn) => {
    thumb.style.setProperty('--tx', `${btn.offsetLeft}px`);
    thumb.style.setProperty('--tw', `${btn.offsetWidth}px`);
  };
  const active = () => buttons.find((b) => b.getAttribute('aria-pressed') === 'true');

  // El aura y el borde de la tarjeta toman el color de la moneda.
  const tint = (btn) => { if (btn.dataset.color) bal.style.setProperty('--bal-c', btn.dataset.color); };
  const select = (btn) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
    placeThumb(btn);
    tint(btn);
    sym.textContent = btn.dataset.sym;
    sym.classList.toggle('is-word', btn.dataset.sym.length > 1);
    const from = current;
    const to = Number(btn.dataset.value);
    current = to;
    cancelAnimationFrame(frame);
    if (reducedMotion) { val.textContent = format(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 650);
      val.textContent = format(from + (to - from) * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  for (const btn of buttons) btn.addEventListener('click', () => { if (btn.getAttribute('aria-pressed') !== 'true') select(btn); });
  placeThumb(active());
  tint(active());
  seg.classList.add('is-live');
  addEventListener('resize', () => placeThumb(active()));
  document.fonts?.ready.then(() => placeThumb(active()));
}

// ── Carrusel de pantallas: flechas, barra de avance y arrastre con el ratón ──
for (const strip of document.querySelectorAll('[data-strip]')) {
  const track = strip.querySelector('[data-track]');
  const prev = strip.querySelector('[data-dir="-1"]');
  const next = strip.querySelector('[data-dir="1"]');
  const bar = strip.querySelector('.strip-bar i');
  const items = [...track.children];
  const smooth = reducedMotion ? 'auto' : 'smooth';
  const stepSize = () => items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '24');

  // Carrusel en 3D: cada pantalla sabe a qué distancia está del centro (−1 a 1).
  const depth = () => {
    if (reducedMotion) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    const reach = Math.max(1, track.clientWidth / 2);
    for (const item of items) {
      const d = Math.max(-1, Math.min(1, (item.offsetLeft + item.offsetWidth / 2 - mid) / reach));
      setVar(item, '--d', d, 3);
      setVar(item, '--ad', Math.abs(d), 3);
    }
  };
  const sync = () => {
    depth();
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    if (bar) {
      const visible = Math.min(1, track.clientWidth / track.scrollWidth);
      const at = max > 0 ? track.scrollLeft / max : 0;
      bar.style.setProperty('--v', (visible + (1 - visible) * at).toFixed(3));
    }
  };
  track.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  addEventListener('load', sync);
  sync();

  for (const btn of [prev, next]) {
    btn.addEventListener('click', () => track.scrollBy({ left: stepSize() * Number(btn.dataset.dir), behavior: smooth }));
  }

  // Arrastrar con el ratón; con el dedo ya lo hace el navegador.
  let down = false;
  let dragged = false;
  let startX = 0;
  let startLeft = 0;
  let settle = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true;
    dragged = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    clearTimeout(settle);
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) > 5) { dragged = true; track.classList.add('is-drag'); }
    if (dragged) track.scrollLeft = startLeft - dx;
  });
  const release = () => {
    if (!down) return;
    down = false;
    if (!dragged) return;
    // Termina en la pantalla más cercana antes de devolverle el imán al carril.
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = items[0];
    for (const item of items) {
      const c = item.offsetLeft + item.offsetWidth / 2;
      if (Math.abs(c - mid) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - mid)) best = item;
    }
    const target = best.offsetLeft + best.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left: target, behavior: smooth });
    settle = setTimeout(() => track.classList.remove('is-drag'), 500);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  track.addEventListener('dragstart', (e) => e.preventDefault());
}

// ── Novedades: cada versión se pliega; lo que guarde el panel sustituye a lo que vino en la página ──
const rels = document.querySelector('[data-changelog]');
if (rels) {
  const wire = () => {
    for (const rel of rels.querySelectorAll('.rel')) {
      const head = rel.querySelector('.rel-head');
      const body = rel.querySelector('.rel-body');
      const set = (open) => {
        rel.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));
        body.inert = !open;
      };
      set(rel.classList.contains('is-open'));
      head.addEventListener('click', () => set(!rel.classList.contains('is-open')));
    }
    document.documentElement.classList.add('rels-ready');
  };
  wire();

  const shown = () => [...rels.querySelectorAll('.rel')]
    .map((rel) => [rel.querySelector('.rel-title').textContent, ...[...rel.querySelectorAll('li')].map((li) => li.textContent)].join('|'))
    .join('#');
  const wanted = (entries) => entries.map((e) => [`${e.title}${e.tag || ''}`, ...e.items].join('|')).join('#');
  fetch('/api/changelog')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const entries = data?.entries;
      if (!Array.isArray(entries) || wanted(entries) === shown()) return;
      rels.innerHTML = renderChangelog(entries);
      rels.closest('section').hidden = !entries.length;
      wire();
    })
    .catch(() => {});
}

// ── Reseñas: se leen de /api/reviews y se envían al mismo sitio; nada se publica sin revisar ──
const revs = document.querySelector('[data-reviews]');
if (revs) {
  const part = (name) => revs.querySelector(`[data-revs-${name}]`);
  const list = part('list');
  const empty = part('empty');
  const summary = part('summary');
  const actions = part('actions');
  const form = part('form');
  const msg = part('msg');
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const stars = (rating) => {
    const row = el('span', 'stars');
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `${rating} de 5`);
    for (let i = 1; i <= 5; i++) {
      const star = el('span', i <= rating ? 'on' : '');
      star.innerHTML = STAR;
      row.append(star);
    }
    return row;
  };
  const month = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
  const card = (review) => {
    const node = el('article', 'rev');
    const foot = el('footer');
    const when = el('time', '', month.format(new Date(review.createdAt)));
    when.dateTime = review.createdAt;
    foot.append(el('b', '', review.name), when);
    node.append(stars(review.rating), el('p', '', review.text), foot);
    return node;
  };

  let openedAt = 0;
  fetch('/api/reviews')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return;
      actions.hidden = !data.enabled;
      if (!data.reviews?.length) return;
      empty.hidden = true;
      summary.replaceChildren(stars(Math.round(data.average)), el('b', '', data.average.toFixed(1).replace('.', ',')), el('span', '', `de 5 en ${data.count} ${data.count === 1 ? 'reseña' : 'reseñas'}`));
      summary.hidden = false;
      list.replaceChildren(...data.reviews.map(card));
      list.hidden = false;
    })
    .catch(() => {});

  part('open').addEventListener('click', () => {
    form.hidden = false;
    actions.hidden = true;
    openedAt = Date.now();
    form.elements.name.focus();
  });
  part('cancel').addEventListener('click', () => {
    form.hidden = true;
    actions.hidden = false;
    part('open').focus();
  });
  const rate = form.querySelector('[data-rate]');
  rate.addEventListener('change', () => { rate.dataset.value = form.elements.rating.value; });
  form.addEventListener('reset', () => { delete rate.dataset.value; });

  const say = (text, kind) => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };
  form.addEventListener('input', () => { if (msg.dataset.kind === 'error') say('', ''); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const text = form.elements.text.value.trim();
    const rating = Number(form.elements.rating.value);
    if (name.length < 2) return say('Escribe tu nombre o un alias.', 'error');
    if (!rating) return say('Elige una calificación.', 'error');
    if (text.length < 10) return say('Cuéntanos un poco más: al menos 10 caracteres.', 'error');

    const send = form.querySelector('[type="submit"]');
    send.disabled = true;
    say('Enviando…', '');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, rating, text, website: form.elements.website.value, elapsed: Date.now() - openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar. Inténtalo de nuevo.');
      form.reset();
      form.hidden = true;
      const thanks = el('span', 'form-msg', 'Gracias. La publicaremos cuando la revisemos.');
      thanks.dataset.kind = 'ok';
      thanks.setAttribute('role', 'status');
      thanks.tabIndex = -1;
      actions.replaceChildren(thanks);
      actions.hidden = false;
      thanks.focus();
    } catch (err) {
      say(err.message, 'error');
    } finally {
      send.disabled = false;
    }
  });
}
