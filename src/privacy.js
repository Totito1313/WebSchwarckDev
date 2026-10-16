import { initMotion } from './motion.js';
import { initTheme } from './theme.js';
import { initSmoothScroll } from './smooth.js';
import { finePointer, initWordmark } from './studio-fx.js';
import { loadDownload } from './cf-download.js';

const motion = initMotion();
initTheme();
initSmoothScroll();
initWordmark(motion, finePointer());
loadDownload();
