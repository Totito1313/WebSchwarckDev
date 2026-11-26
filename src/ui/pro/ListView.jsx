// Lista con filas, inspirada en la «List View» de HeroUI Pro y hecha sobre el
// ListBox de HeroUI (teclado y selección de React Aria): cada fila lleva icono o
// avatar, título, una línea de detalle y, a la derecha, lo que haga falta (cifra,
// estado, botón). Tres modos: sin selección (solo abrir), una o varias, con la
// casilla a la izquierda como en la demo.
import { useRef } from 'react';
import { Check } from '@gravity-ui/icons';
import { ListBox } from '@heroui/react';

/**
 * items: [{ id, title, description?, icon?: Component, media?: ReactNode, end?: ReactNode, textValue? }]
 * selectionMode: 'none' | 'single' | 'multiple'
 * selectedKeys / onSelectionChange (Set de ids, como en React Aria)
 * onAction(id): abrir una fila
 * bare: sin su propia tarjeta, para ir dentro de un panel que ya la tiene.
 */
export function ListView({ items, label, selectionMode = 'none', selectedKeys, onSelectionChange, onAction, className = '', dense = false, bare = false, renderEmpty }) {
  const selectable = selectionMode !== 'none';
  // Con acción (abrir) y selección a la vez, React Aria abre al hacer clic en la fila
  // y no selecciona; por eso la casilla selecciona por su cuenta (con el teclado,
  // Espacio selecciona e Intro abre).
  // La última selección enviada: si se marcan dos casillas antes de que la página
  // se vuelva a pintar, la segunda no borra la primera.
  const latest = useRef(selectedKeys);
  latest.current = selectedKeys;
  const toggle = (id) => {
    const keys = latest.current;
    const cur = keys === 'all' ? new Set(items.map((i) => i.id)) : new Set(keys || []);
    let next;
    if (selectionMode === 'single') next = cur.has(id) ? new Set() : new Set([id]);
    else {
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      next = cur;
    }
    latest.current = next;
    onSelectionChange?.(next);
  };
  const stop = (e) => e.stopPropagation();
  return (
    <ListBox
      aria-label={label}
      items={items}
      selectionMode={selectionMode}
      selectionBehavior="toggle"
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      onAction={onAction}
      renderEmptyState={renderEmpty}
      className={`flex flex-col ${bare ? '' : 'overflow-hidden rounded-3xl bg-surface p-1 shadow-[var(--surface-shadow)]'} ${className}`}
    >
      {(it) => {
        const Icon = it.icon;
        return (
          <ListBox.Item
            id={it.id}
            textValue={it.textValue || it.title}
            className={`group flex cursor-default items-center gap-3 rounded-[1.1rem] px-3 outline-none transition-colors data-[hovered=true]:bg-surface-secondary data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-focus data-[selected=true]:bg-accent/8 ${
              dense ? 'py-2' : 'py-2.5'
            }`}
          >
            {selectable && (
              <span
                aria-hidden
                className="-m-1.5 flex shrink-0 cursor-pointer items-center justify-center p-1.5"
                onPointerDown={stop}
                onPointerUp={stop}
                onMouseDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(it.id);
                }}
              >
                <span
                  className={`flex size-[18px] items-center justify-center border-2 transition-colors ${
                    selectionMode === 'single' ? 'rounded-full' : 'rounded-md'
                  } border-default group-hover:border-muted group-data-[selected=true]:border-accent group-data-[selected=true]:bg-accent group-data-[selected=true]:text-accent-foreground`}
                >
                  {selectionMode === 'single' ? (
                    <span className="size-1.5 rounded-full bg-current opacity-0 group-data-[selected=true]:opacity-100" />
                  ) : (
                    <Check className="size-3 opacity-0 group-data-[selected=true]:opacity-100" />
                  )}
                </span>
              </span>
            )}
            {it.media ||
              (Icon && (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-muted">
                  <Icon className="size-4" />
                </span>
              ))}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{it.title}</span>
              {it.description && <span className="truncate text-xs text-muted">{it.description}</span>}
            </span>
            {it.end && <span className="flex shrink-0 items-center gap-2 text-sm">{it.end}</span>}
          </ListBox.Item>
        );
      }}
    </ListBox>
  );
}
