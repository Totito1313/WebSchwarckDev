// Segmento con iconos: opciones en fila con un indicador que se desliza hasta la
// activa. La idea viene del «Segment» de HeroUI Pro, pero está hecho desde cero con
// lo nuestro. Dos aspectos (estilos en theme.css, .sw-segment):
//  · track: bandeja en píldora (--default) e indicador claro (--segment), los mismos
//    colores de las pestañas de HeroUI. Es el de las secciones de cada zona.
//  · bare: sin bandeja (va sobre otra superficie, como la isla de arriba) y con el
//    indicador en el color del texto: la píldora blanca (o negra) que se desliza.
//
// Es navegación: cada opción es un enlace y la activa lleva aria-current. Si no cabe
// (en el teléfono), se desliza de lado con la sombra de ScrollShadow y la opción
// activa se trae a la vista.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollShadow } from '@heroui/react';

/**
 * @param {{
 *   items: { id: string, label: string, href: string, icon?: import('react').ComponentType<{ className?: string }> }[],
 *   value: string,
 *   label: string,
 *   variant?: 'track' | 'bare',
 *   scroll?: boolean,
 *   current?: 'page' | 'true',
 *   className?: string,
 * }} props
 */
export function Segment({ items, value, label, variant = 'track', scroll = true, current = 'page', className = '' }) {
  const trackRef = useRef(null);
  const [pos, setPos] = useState(null);
  // El indicador aparece en su sitio la primera vez; solo se desliza en los cambios.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const place = () => {
      const on = track.querySelector('[data-active="true"]');
      setPos(on && on.offsetWidth ? { x: on.offsetLeft, w: on.offsetWidth } : null);
    };
    place();
    // Las letras pueden cargar después y cambiar los anchos; y si la barra estaba
    // oculta (pantalla estrecha) y aparece, también: se vuelve a medir.
    const ro = new ResizeObserver(place);
    ro.observe(track);
    for (const el of track.children) ro.observe(el);
    return () => ro.disconnect();
  }, [value, items]);

  useEffect(() => {
    if (!pos || ready) return undefined;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [pos, ready]);

  // Si la tira se desliza, la opción activa queda a la vista.
  useLayoutEffect(() => {
    if (!scroll) return;
    const track = trackRef.current;
    const scroller = track?.parentElement;
    const on = track?.querySelector('[data-active="true"]');
    if (!on || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const a = on.getBoundingClientRect();
    const b = scroller.getBoundingClientRect();
    const pad = 24;
    if (a.left < b.left + pad) scroller.scrollLeft -= b.left + pad - a.left;
    else if (a.right > b.right - pad) scroller.scrollLeft += a.right - (b.right - pad);
  }, [value, scroll]);

  const nav = (
    <nav ref={trackRef} className={`sw-segment ${variant === 'bare' ? 'sw-segment--bare' : ''} ${scroll ? '' : className}`} aria-label={label}>
      {pos && (
        <span
          aria-hidden="true"
          className="sw-segment__indicator"
          data-ready={ready}
          style={{ width: pos.w, translate: `${pos.x}px 0` }}
        />
      )}
      {items.map(({ id, label: text, href, icon: Icon }) => {
        const on = id === value;
        return (
          <a key={id} href={href} className="sw-segment__item" data-active={on} aria-current={on ? current : undefined}>
            {Icon && <Icon />}
            {text}
          </a>
        );
      })}
    </nav>
  );

  return scroll ? (
    <ScrollShadow orientation="horizontal" hideScrollBar className={className}>
      {nav}
    </ScrollShadow>
  ) : (
    nav
  );
}
