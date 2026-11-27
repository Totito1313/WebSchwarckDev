import { useEffect, useRef, useState } from 'react';

/**
 * Para hojas y paneles que se abren al cambiar la ruta (#/…/pieza/…): si se abren
 * en el mismo toque que cambió la ruta, ese mismo toque cae fuera de la hoja y la
 * cierra. Se abren un instante después, cuando el toque ya terminó.
 */
export function useOpenAfterGesture(delay = 80) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return open;
}

/**
 * Mantener pulsado (con el dedo o el ratón) o el clic derecho sobre un elemento
 * que cumpla `selector` dentro del contenedor: llama a onLong(elemento, { x, y }).
 * Si el dedo se mueve (está deslizando la página), no cuenta. El clic que sigue a
 * una pulsación larga no se dispara. Devuelve los manejadores para el contenedor.
 */
export function useLongPress(onLong, { ms = 480, selector } = {}) {
  const st = useRef(null);
  const fired = useRef(false);
  const cb = useRef(onLong);
  cb.current = onLong;
  const target = (e) => (selector ? e.target.closest?.(selector) : e.currentTarget);
  const clear = () => {
    clearTimeout(st.current?.timer);
    st.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      const el = target(e);
      if (!el) return;
      fired.current = false;
      const x = e.clientX;
      const y = e.clientY;
      st.current = {
        x,
        y,
        timer: setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(12);
          cb.current(el, { x, y });
        }, ms),
      };
    },
    onPointerMove: (e) => {
      const s = st.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e) => {
      const el = target(e);
      if (!el) return;
      e.preventDefault();
      // En el teléfono el menú del sistema llega con la pulsación larga: si ya se abrió el nuestro, nada.
      if (fired.current) return;
      clear();
      cb.current(el, { x: e.clientX, y: e.clientY });
    },
    onClickCapture: (e) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
