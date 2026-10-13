// Scroll con inercia.
//
// Lenis suaviza la rueda del ratón y los saltos a una sección moviendo el
// scroll de verdad de la ventana, así `sticky`, `fixed` y todo lo que escucha
// el scroll siguen funcionando igual. El táctil no se toca: el teléfono ya
// trae su propia inercia. Si la persona pidió menos movimiento, no se activa.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { reducedMotion } from './motion.js';

export function initSmoothScroll() {
  if (reducedMotion) return null;
  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.1, // cuánto se acerca a su destino en cada cuadro: menos es más inercia
    allowNestedScroll: true, // el carrusel y las cajas de texto conservan su propio scroll
    anchors: true, // los saltos a una sección respetan el `scroll-padding-top` de cada página
    stopInertiaOnNavigate: true,
  });
  // "#top" no es un elemento: es el principio de la página.
  for (const link of document.querySelectorAll('a[href="#top"]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      lenis.scrollTo(0);
    });
  }
  return lenis;
}
