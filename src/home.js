import { initMotion, onScroll, through, pinned, setVar, clamp, reducedMotion } from './motion.js';
import { initTheme } from './theme.js';
import { initSmoothScroll } from './smooth.js';
import { finePointer, initPointerFx, initWordmark } from './studio-fx.js';

const root = document.documentElement;
const motion = initMotion();
initTheme();
initSmoothScroll();

const fine = finePointer();
initPointerFx(fine);
initWordmark(motion, fine);
const hero = document.querySelector('[data-hero]');

// Progreso de lectura.
const bar = document.querySelector('.progress');
onScroll(() => {
  const max = root.scrollHeight - innerHeight;
  if (bar) setVar(bar, '--sp', max > 0 ? scrollY / max : 0);
});

// Solo con ratón: el marco del hero y las tarjetas se inclinan hacia el cursor.
if (fine) {
  const tilt = (area, target, x0, y0) => {
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      target.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * x0}deg`);
      target.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -y0}deg`);
    });
    area.addEventListener('pointerleave', () => {
      target.style.removeProperty('--ry');
      target.style.removeProperty('--rx');
    });
  };
  const frame = document.querySelector('[data-tilt]');
  if (frame && hero) tilt(hero, frame, 16, 11);
  for (const card of document.querySelectorAll('[data-card]')) tilt(card, card, 6, 5);

  // El logo grande del contacto gira con el cursor.
  const contact = document.querySelector('.contact');
  if (contact) {
    contact.addEventListener('pointermove', (e) => {
      const r = contact.getBoundingClientRect();
      contact.style.setProperty('--mr', `${-14 + ((e.clientX - r.left) / r.width) * 14}deg`);
    });
    contact.addEventListener('pointerleave', () => contact.style.removeProperty('--mr'));
  }
}

if (motion) {
  // Al bajar, el hero se aleja: el texto se desvanece y el teléfono sube.
  if (hero) onScroll(() => setVar(hero, '--hp', clamp(scrollY / hero.offsetHeight)));
  // Los teléfonos de CeroFiao se abren y se cierran un poco con el scroll.
  const fans = [...document.querySelectorAll('.app-card.cf')];
  onScroll((vh) => { for (const c of fans) setVar(c, '--dp', through(c, vh) * 2 - 1, 3); });
}

// La etiqueta del marco se escribe sola, como en un editor.
const typed = document.querySelector('[data-type]');
if (typed && !reducedMotion) {
  const text = typed.dataset.type;
  let n = 0;
  typed.textContent = '';
  setTimeout(function step() {
    typed.textContent = text.slice(0, ++n);
    if (n < text.length) setTimeout(step, 34 + Math.random() * 46);
  }, 1000);
}

// Proceso: el paso más cercano al centro de la pantalla enciende su pantalla.
const story = document.querySelector('[data-story]');
if (story) {
  const steps = [...story.querySelectorAll('[data-step]')];
  const screens = [...story.querySelectorAll('[data-screen]')];
  const list = story.querySelector('.story-steps');
  const meter = story.querySelector('.story-meter');
  const num = story.querySelector('[data-story-num]');
  let active = -1;
  const show = (i) => {
    if (i === active) return;
    active = i;
    steps.forEach((s, n) => s.classList.toggle('is-on', n === i));
    screens.forEach((s, n) => {
      s.classList.toggle('is-on', n === i);
      s.classList.toggle('is-past', n < i);
    });
    if (num) num.textContent = String(i + 1).padStart(2, '0');
  };
  // En el teléfono el teléfono fijo tapa la parte de arriba: manda el centro de lo que queda debajo.
  const stage = story.querySelector('.story-stage');
  const narrow = matchMedia('(max-width: 960px)');
  story.classList.add('is-live');
  show(0);
  onScroll((vh) => {
    const ref = narrow.matches && stage ? (stage.getBoundingClientRect().bottom + vh) / 2 : vh * 0.5;
    let best = 0;
    let dist = Infinity;
    steps.forEach((s, n) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - ref);
      if (d < dist) {
        dist = d;
        best = n;
      }
    });
    show(best);
    if (meter && list) setVar(meter, '--sp2', pinned(list, vh));
  });
}

// Cifras: cada dígito es una tira de 0 a 9 que gira hasta su número, como un
// cuentakilómetros. El número de verdad queda en el texto para los lectores de pantalla.
const figures = [...document.querySelectorAll('[data-count]')];
if (motion && figures.length) {
  const build = (el) => {
    const final = el.textContent.trim();
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = final;
    const odo = document.createElement('span');
    odo.className = 'odo';
    odo.setAttribute('aria-hidden', 'true');
    const strips = [];
    for (const ch of final) {
      if (!/\d/.test(ch)) {
        odo.append(Object.assign(document.createElement('span'), { className: 'odo-sep' }));
        continue;
      }
      const cell = Object.assign(document.createElement('span'), { className: 'odo-d' });
      const strip = Object.assign(document.createElement('span'), { className: 'odo-s' });
      for (let k = 0; k < 20; k++) strip.append(Object.assign(document.createElement('span'), { textContent: String(k % 10) }));
      cell.append(strip);
      odo.append(cell);
      strips.push([strip, Number(ch)]);
    }
    el.replaceChildren(label, odo);
    return strips;
  };
  const all = new Map(figures.map((el) => [el, build(el)]));
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      const strips = all.get(entry.target);
      const wait = 0.15 + figures.indexOf(entry.target) * 0.12;
      // Las unidades giran primero y las decenas después: la última vuelta da más vueltas.
      strips.forEach(([strip, d], k) => {
        strip.style.setProperty('--delay', `${wait + (strips.length - 1 - k) * 0.1}s`);
        strip.style.setProperty('--n', String(10 + d));
      });
    }
  }, { threshold: 0.55 });
  for (const el of figures) io.observe(el);
}

// Índice lateral: aparece pasado el hero y marca la sección en la que estás.
const rail = document.querySelector('.rail');
if (rail && hero) {
  const links = [...rail.querySelectorAll('a')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href')));
  const foot = document.querySelector('.foot');
  let current = -2;
  let shown = null;
  onScroll((vh) => {
    let at = -1;
    targets.forEach((t, n) => {
      if (t && t.getBoundingClientRect().top < vh * 0.45) at = n;
    });
    if (at !== current) {
      current = at;
      links.forEach((a, n) => (n === at ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    }
    const on = scrollY > hero.offsetHeight * 0.6 && (!foot || foot.getBoundingClientRect().top > vh * 0.55);
    if (on !== shown) {
      shown = on;
      rail.classList.toggle('is-on', on);
      rail.inert = !on;
    }
  });
}

// Copiar el correo: portapapeles moderno y, si no está, el método antiguo.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.readOnly = true;
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
for (const btn of document.querySelectorAll('[data-copy]')) {
  const status = btn.parentElement.querySelector('[data-copy-status]');
  let timer = 0;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    const ok = await copyText(btn.dataset.copy);
    btn.dataset.state = ok ? 'done' : 'fail';
    if (status) status.textContent = ok ? 'Copiado' : 'No se pudo copiar';
    clearTimeout(timer);
    timer = setTimeout(() => {
      delete btn.dataset.state;
      if (status) status.textContent = '';
    }, 2000);
  });
}

// Preguntas: sin JS están todas abiertas; aquí se pliegan y cada una abre con su botón.
const questions = [...document.querySelectorAll('.faq-item')];
if (questions.length) {
  const set = (item, open) => {
    item.classList.toggle('is-open', open);
    item.querySelector('.faq-q').setAttribute('aria-expanded', String(open));
    item.querySelector('.faq-a').inert = !open;
  };
  for (const item of questions) {
    set(item, false);
    item.querySelector('.faq-q').addEventListener('click', () => set(item, !item.classList.contains('is-open')));
  }
  root.classList.add('faq-ready');
}
