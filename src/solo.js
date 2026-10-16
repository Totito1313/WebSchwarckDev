// Páginas sueltas del estudio (Lion Fitness y 404): tema, movimiento y los
// mismos efectos de cursor y pie que la portada.
import { initMotion } from './motion.js';
import { initTheme } from './theme.js';
import { initSmoothScroll } from './smooth.js';
import { finePointer, initPointerFx, initWordmark } from './studio-fx.js';

const motion = initMotion();
initTheme();
initSmoothScroll();
const fine = finePointer();
initPointerFx(fine);
initWordmark(motion, fine);
