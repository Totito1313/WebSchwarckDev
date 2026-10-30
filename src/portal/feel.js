// Tacto y sonido de la app: cada toque responde.
//
// Vibración: en Android con navigator.vibrate; en el iPhone (iOS 18 o posterior) con el
// truco del interruptor nativo (<input type="checkbox" switch>), que Safari acompaña de un
// golpe háptico al cambiar. Los patrones copian los de CeroFiao: un toque seco al pulsar
// (TextHandleMove), uno más largo al mantener (LongPress), uno doble al confirmar.
//
// Sonido: tonos cortos generados al momento con Web Audio (sin archivos). En el iPhone la
// sesión de audio es «ambient»: respeta el interruptor de silencio.
//
// Las dos cosas se pueden apagar en el perfil; se recuerda en este teléfono.

const KEY = 'portal:feel';
const prefs = (() => {
  try {
    return { haptics: true, sounds: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { haptics: true, sounds: true };
  }
})();

export const feel = {
  get haptics() { return prefs.haptics; },
  get sounds() { return prefs.sounds; },
  set(key, value) {
    prefs[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // sin almacenamiento vale para esta visita
    }
  },
};

// ── Vibración ──

const PATTERNS = {
  tick: 6, // seleccionar, cambiar de pestaña
  tap: 10, // pulsar un botón
  press: 18, // mantener
  success: [10, 50, 18],
  warning: [16, 70, 16],
  error: [28, 60, 28, 60, 28],
  heavy: 30,
};
const canVibrate = typeof navigator.vibrate === 'function';
let iosSwitch = null;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind = 'tap') {
  if (!prefs.haptics) return;
  // Antes del primer toque real el navegador no deja vibrar (y lo anota como error).
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (canVibrate) {
    try {
      navigator.vibrate(PATTERNS[kind] ?? 10);
    } catch {
      // algunos navegadores lo bloquean fuera de un gesto
    }
    return;
  }
  iosTick();
  // El doble golpe del «hecho» en iPhone (el segundo puede no sonar fuera del gesto).
  if (kind === 'success' || kind === 'error' || kind === 'warning') setTimeout(iosTick, 90);
}

// ── Sonido ──

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch {
      // sin control de sesión de audio
    }
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(ac, { freq, to, dur = 0.08, type = 'sine', gain = 0.05, at = 0 }) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function whoosh(ac, { dur = 0.22, gain = 0.05, from = 600, to = 3200 } = {}) {
  const t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t);
}

const SOUNDS = {
  tap: (ac) => tone(ac, { freq: 1700, dur: 0.03, gain: 0.025 }),
  tick: (ac) => tone(ac, { freq: 2300, dur: 0.018, gain: 0.018, type: 'triangle' }),
  tab: (ac) => tone(ac, { freq: 1250, to: 1500, dur: 0.045, gain: 0.03 }),
  on: (ac) => tone(ac, { freq: 880, to: 1320, dur: 0.07, gain: 0.04, type: 'triangle' }),
  off: (ac) => tone(ac, { freq: 1320, to: 880, dur: 0.07, gain: 0.035, type: 'triangle' }),
  open: (ac) => tone(ac, { freq: 520, to: 780, dur: 0.09, gain: 0.03 }),
  close: (ac) => tone(ac, { freq: 760, to: 480, dur: 0.08, gain: 0.025 }),
  success: (ac) => {
    tone(ac, { freq: 1046.5, dur: 0.11, gain: 0.05, type: 'triangle' });
    tone(ac, { freq: 1568, dur: 0.18, gain: 0.045, type: 'triangle', at: 0.08 });
  },
  send: (ac) => {
    whoosh(ac, { gain: 0.06 });
    tone(ac, { freq: 700, to: 1400, dur: 0.16, gain: 0.03, at: 0.02 });
  },
  error: (ac) => {
    tone(ac, { freq: 330, to: 220, dur: 0.14, gain: 0.05, type: 'square' });
    tone(ac, { freq: 300, to: 200, dur: 0.16, gain: 0.04, type: 'square', at: 0.13 });
  },
  notify: (ac) => {
    tone(ac, { freq: 1568, dur: 0.3, gain: 0.04 });
    tone(ac, { freq: 2093, dur: 0.42, gain: 0.03, at: 0.09 });
  },
  pop: (ac) => tone(ac, { freq: 600, to: 1400, dur: 0.06, gain: 0.035 }),
};

export function sound(name) {
  if (!prefs.sounds) return;
  const ac = audio();
  if (!ac) return;
  try {
    SOUNDS[name]?.(ac);
  } catch {
    // el audio nunca debe romper una acción
  }
}

/** Un acontecimiento: vibración y sonido a la vez. */
export function react(kind) {
  const map = {
    tap: ['tap', null],
    tick: ['tick', 'tick'],
    tab: ['tick', 'tab'],
    open: ['tap', 'open'],
    close: ['tick', 'close'],
    on: ['tap', 'on'],
    off: ['tick', 'off'],
    success: ['success', 'success'],
    send: ['success', 'send'],
    error: ['error', 'error'],
    warning: ['warning', null],
    notify: ['warning', 'notify'],
    press: ['press', 'pop'],
  }[kind] || ['tap', null];
  haptic(map[0]);
  if (map[1]) sound(map[1]);
}

// ── Cada toque responde ──

const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="option"], label.cl-switch, summary, .cl-press';

/** Vibración al tocar cualquier cosa pulsable, y un pequeño «hundirse» marcado en CSS (.is-pressed). */
export function installTouchFeedback() {
  let pressed = null;
  const release = () => {
    pressed?.classList.remove('is-pressed');
    pressed = null;
  };
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest(PRESSABLE);
    if (!target || target.disabled || target.closest('[data-quiet]')) return;
    pressed = target;
    target.classList.add('is-pressed');
    // En Android vibra al apoyar el dedo (se siente inmediato); en iPhone, al soltar (click).
    if (canVibrate) haptic(target.matches('[role="tab"], .cl-fchip, .cl-seg button') ? 'tick' : 'tap');
  }, { passive: true });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'dragstart']) document.addEventListener(ev, release, { passive: true });
  if (!canVibrate) {
    document.addEventListener('click', (e) => {
      const target = e.target.closest(PRESSABLE);
      if (!target || target.disabled || target.closest('[data-quiet]')) return;
      haptic('tap');
    }, true);
  }
  // El primer gesto despierta el audio (los navegadores lo exigen).
  const wake = () => {
    if (prefs.sounds) audio();
    removeEventListener('pointerdown', wake);
  };
  addEventListener('pointerdown', wake, { passive: true });
}

/** Mantener pulsado: llama a `run` tras 450 ms (con vibración), y cancela si el dedo se mueve. */
export function onLongPress(node, run) {
  let timer = 0;
  let start = null;
  const cancel = () => {
    clearTimeout(timer);
    node.classList.remove('is-holding');
    start = null;
  };
  node.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
    node.classList.add('is-holding');
    timer = setTimeout(() => {
      node.classList.remove('is-holding');
      react('press');
      node.dataset.held = '1';
      run(e);
    }, 450);
  });
  node.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) node.addEventListener(ev, cancel);
  // Tras un «mantener», el clic que sigue no abre nada.
  node.addEventListener('click', (e) => {
    if (node.dataset.held) {
      e.preventDefault();
      e.stopImmediatePropagation();
      delete node.dataset.held;
    }
  }, true);
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}
