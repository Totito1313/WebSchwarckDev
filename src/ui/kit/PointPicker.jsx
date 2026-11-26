// Buscador flotante abierto en un punto: escribes para filtrar, las flechas mueven
// la opción activa y Intro la elige. Lo usan las páginas para «/» (tipo de bloque),
// «[[» (enlazar una página, tarea o documento), «Mover a…» y elegir cliente o
// proyecto. Es el Popover de HeroUI con un ancla invisible en el punto, como el
// menú del clic derecho (PointMenu).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, SearchField } from '@heroui/react';

const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El punto de abajo a la izquierda de un elemento (para abrir algo debajo de él). */
export const below = (node) => {
  const r = node?.getBoundingClientRect?.();
  return r ? { x: r.left, y: r.bottom } : { x: 40, y: 40 };
};

/**
 * at: { x, y } o null (cerrado).
 * items: [{ id, label, sub?, lead? (emoji o icono), keywords? }]
 * extra: un nodo bajo la lista (p. ej. «Sin cliente»).
 */
export function PointPicker({ at, items, onPick, onClose, placeholder = 'Buscar…', label = 'Buscar', extra = null, empty = 'Nada coincide.' }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef(null);
  useEffect(() => {
    if (at) {
      setQ('');
      setActive(0);
    }
  }, [at]);
  const shown = useMemo(() => {
    const t = plain(q.trim());
    return (items || []).filter((x) => !t || plain(`${x.label} ${x.sub || ''} ${x.keywords || ''}`).includes(t)).slice(0, 80);
  }, [items, q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const pick = (x) => {
    if (!x) return;
    onClose?.();
    onPick?.(x);
  };
  const x = Math.min(at?.x ?? 0, window.innerWidth - 8);
  const y = Math.min(at?.y ?? 0, window.innerHeight - 8);
  return (
    <Popover isOpen={!!at} onOpenChange={(open) => !open && onClose?.()}>
      <Popover.Trigger aria-label={label} className="pointer-events-none fixed size-px opacity-0" style={{ left: x, top: y }} />
      <Popover.Content placement="bottom start" offset={6} className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <Popover.Dialog aria-label={label} className="flex flex-col gap-1 p-2">
          <SearchField
            autoFocus
            aria-label={placeholder}
            value={q}
            onChange={(v) => {
              setQ(v);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(shown[active]);
              } else e.continuePropagation?.();
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={placeholder} />
            </SearchField.Group>
          </SearchField>
          <div ref={list} role="listbox" aria-label={label} className="flex max-h-72 flex-col overflow-y-auto">
            {shown.length ? (
              shown.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-i={i}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(it)}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-sm outline-none ${i === active ? 'bg-default' : ''}`}
                >
                  {it.lead && <span className="flex size-6 shrink-0 items-center justify-center text-base">{it.lead}</span>}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{it.label}</span>
                    {it.sub && <span className="truncate text-xs text-muted">{it.sub}</span>}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-sm text-muted">{empty}</p>
            )}
          </div>
          {extra}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
