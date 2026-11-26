import { useEffect, useState } from 'react';

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
