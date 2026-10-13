import { initMotion, onScroll, through, setVar, clamp, easeOut } from './motion.js';
import { initTheme } from './theme.js';

const root = document.documentElement;
const motion = initMotion();
initTheme();

// Cabecera: línea y vidrio en cuanto la página se mueve.
onScroll(() => root.classList.toggle('scrolled', scrollY > 8));

// Menú del teléfono: se cierra con Escape, al tocar fuera o al elegir un enlace.
const menu = document.querySelector('.menu');
if (menu) {
  addEventListener('click', (e) => {
    if (menu.open && (!menu.contains(e.target) || e.target.closest('a'))) menu.open = false;
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    menu.querySelector('summary').focus();
  });
}

// Palabra que rota en el titular: la que sale sube y la que entra llega desde
// abajo, dentro de la ventana de su línea. Se detiene con la pestaña oculta o
// con el titular fuera de la pantalla.
const rotor = document.querySelector('[data-rotate]');
if (rotor && motion && rotor.animate) {
  const words = rotor.dataset.rotate.split('|').map((text, n) => {
    if (n === 0) return rotor.firstElementChild;
    const word = document.createElement('span');
    word.className = 'word';
    word.textContent = text;
    return rotor.appendChild(word);
  });
  const slide = { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' };
  let i = 0;
  let timer = 0;
  let seen = true;

  const swap = () => {
    const out = words[i];
    i = (i + 1) % words.length;
    const next = words[i];
    next.classList.add('is-on');
    next.animate({ transform: ['translateY(115%)', 'translateY(0)'] }, slide);
    out.animate({ transform: ['translateY(0)', 'translateY(-115%)'] }, slide).onfinish = () => out.classList.remove('is-on');
    timer = setTimeout(swap, 2600);
  };
  const play = () => {
    clearTimeout(timer);
    if (seen && !document.hidden) timer = setTimeout(swap, 2600);
  };
  document.addEventListener('visibilitychange', play);
  new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    play();
  }).observe(rotor);
}

// Las pantallas de las tarjetas se desplazan un poco con el scroll.
const drifts = [...document.querySelectorAll('[data-drift]')];
if (motion && drifts.length) {
  onScroll((vh) => {
    for (const el of drifts) setVar(el, '--p', through(el, vh) * 2 - 1, 3);
  });
}

// Cifras: cuentan una vez al entrar. Cada cifra se pinta sobre su cifra final,
// que sigue en el texto y guarda el sitio; las columnas que acaban en 1 (la
// cifra estrecha de DM Sans) no giran, para que nada se monte.
function count(el, wait) {
  const final = el.textContent;
  const target = Number(final.replace(/\D/g, ''));
  const cells = [];
  el.replaceChildren(...[...final].map((ch) => {
    if (!/\d/.test(ch)) return ch;
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.textContent = ch;
    cell.dataset.d = '';
    cells.unshift(cell);
    return cell;
  }));
  const span = 700 + cells.length * 250;
  const start = performance.now() + wait;
  const tick = (now) => {
    const t = clamp((now - start) / span);
    if (t === 1) return void (el.textContent = final);
    const shown = String(Math.round(target * easeOut(t))).split('').reverse();
    cells.forEach((cell, place) => {
      const d = place >= shown.length ? '' : cell.textContent === '1' ? '1' : shown[place];
      if (cell.dataset.d !== d) cell.dataset.d = d;
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const figures = [...document.querySelectorAll('[data-count]')];
if (motion && figures.length) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      count(entry.target, 150 + figures.indexOf(entry.target) * 120);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.5 });
  for (const el of figures) io.observe(el);
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
