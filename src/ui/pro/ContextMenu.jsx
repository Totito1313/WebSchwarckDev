// Menú del clic derecho, inspirado en el «Context Menu» de HeroUI Pro y hecho con el
// Dropdown de HeroUI: al hacer clic derecho (o pulsar la tecla de menú, o
// Mayús+F10, sobre el elemento enfocado) se abre en el punto exacto. Las acciones
// pueden llevar icono, atajo, ir en rojo o estar desactivadas, y separarse en grupos.
//
// · ContextMenu envuelve un elemento y abre el menú sobre él.
// · PointMenu es el menú suelto, abierto en unas coordenadas: lo usan la tabla y el
//   tablero, que deciden ellos sobre qué fila o tarjeta se abrió.
import { useRef, useState } from 'react';
import { Check, ChevronRight } from '@gravity-ui/icons';
import { Dropdown, Kbd, Label, Separator } from '@heroui/react';

/**
 * Convierte la lista de acciones en elementos del menú ('-' separa grupos).
 * Un elemento con `items` abre un submenú (Mover a ›, Prioridad ›…); `checked`
 * marca la opción actual con un ✓; `dot` pone un punto de color delante.
 * onAction: el mismo del menú de fuera. React Aria no se lo pasa a los submenús,
 * así que va explícito a cada uno.
 */
export function menuNodes(items, onAction) {
  const nodes = [];
  items.forEach((it, i) => {
    if (!it) return;
    if (it === '-') {
      if (nodes.length && i < items.length - 1 && items[i + 1] !== '-') nodes.push(<Separator key={`sep-${i}`} />);
      return;
    }
    const Icon = it.icon;
    const lead = it.dot ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.dot }} aria-hidden /> : Icon ? <Icon className="size-4 shrink-0" /> : null;
    if (it.items) {
      const subs = it.items.filter(Boolean);
      nodes.push(
        <Dropdown.SubmenuTrigger key={it.id}>
          <Dropdown.Item id={it.id} textValue={it.label} isDisabled={it.isDisabled || !subs.length}>
            {lead}
            <Label>{it.label}</Label>
            <Dropdown.SubmenuIndicator>
              <ChevronRight className="size-3.5" />
            </Dropdown.SubmenuIndicator>
          </Dropdown.Item>
          <Dropdown.Popover className="min-w-48">
            <Dropdown.Menu aria-label={it.label} onAction={onAction}>
              {menuNodes(subs, onAction)}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.SubmenuTrigger>,
      );
      return;
    }
    nodes.push(
      <Dropdown.Item key={it.id} id={it.id} textValue={it.label} variant={it.danger ? 'danger' : undefined} isDisabled={it.isDisabled}>
        {lead}
        <Label>{it.label}</Label>
        {it.shortcut && <Kbd slot="keyboard">{it.shortcut}</Kbd>}
        {it.checked && <Check className="ms-auto size-4 shrink-0 text-accent" aria-label="actual" />}
      </Dropdown.Item>,
    );
  });
  return nodes;
}

/** Punto de apertura a partir de un evento de ratón o del elemento enfocado. */
export function pointFrom(e) {
  if (e && 'clientX' in e && (e.clientX || e.clientY)) return { x: e.clientX, y: e.clientY };
  const r = (e?.currentTarget || document.activeElement)?.getBoundingClientRect?.();
  return r ? { x: r.left + 12, y: r.top + Math.min(r.height, 32) } : { x: 40, y: 40 };
}

/**
 * Menú abierto en un punto. at: { x, y } o null (cerrado).
 * items: [{ id, label, icon?, shortcut?, danger?, isDisabled? } | '-']
 */
export function PointMenu({ at, items, onAction, onClose, label = 'Acciones' }) {
  const x = Math.min(at?.x ?? 0, window.innerWidth - 8);
  const y = Math.min(at?.y ?? 0, window.innerHeight - 8);
  const run = (k) => {
    onClose?.();
    onAction?.(String(k));
  };
  return (
    <Dropdown
      isOpen={!!at}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      {/* Ancla invisible en el punto del clic: el menú se abre ahí. */}
      <Dropdown.Trigger aria-label={label} excludeFromTabOrder className="pointer-events-none fixed size-px opacity-0" style={{ left: x, top: y }} />
      <Dropdown.Popover placement="bottom start" offset={4} className="min-w-52">
        <Dropdown.Menu aria-label={label} onAction={run}>
          {menuNodes(items || [], run)}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** Envuelve un elemento: clic derecho, tecla de menú o Mayús+F10 abren sus acciones. */
export function ContextMenu({ items, onAction, children, className = '', label = 'Acciones', isDisabled = false }) {
  const [at, setAt] = useState(null);
  const host = useRef(null);

  const onContextMenu = (e) => {
    if (isDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    setAt(pointFrom(e));
  };
  const onKeyDown = (e) => {
    if (isDisabled) return;
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = (document.activeElement || host.current).getBoundingClientRect();
      setAt({ x: r.left + 12, y: r.top + Math.min(r.height, 32) });
    }
  };

  return (
    <div ref={host} className={className} onContextMenu={onContextMenu} onKeyDown={onKeyDown}>
      {children}
      <PointMenu at={at} items={items} onAction={onAction} onClose={() => setAt(null)} label={label} />
    </div>
  );
}
