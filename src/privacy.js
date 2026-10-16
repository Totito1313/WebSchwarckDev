import { initMotion } from './motion.js';
import { initTheme } from './theme.js';
import { initSmoothScroll } from './smooth.js';
import { finePointer, initWordmark } from './studio-fx.js';

const motion = initMotion();
initTheme();
initSmoothScroll();
initWordmark(motion, finePointer());
