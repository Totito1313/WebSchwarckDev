// Tablero por columnas con arrastrar y soltar, inspirado en el «Kanban» de HeroUI Pro
// y hecho desde cero con eventos de puntero (ratón, lápiz y dedo):
//  · Con el ratón se arrastra al moverlo unos píxeles; con el dedo, tras mantenerlo
//    pulsado un momento (así deslizar la página sigue funcionando).
//  · Mientras se arrastra, la tarjeta flota bajo el puntero y un hueco marca dónde cae.
//    Cerca de los bordes, el tablero se desliza solo.
//  · Sin ratón: Alt+← / Alt+→ pasan la tarjeta enfocada a la columna de al lado, y el
//    menú «⋮» (o clic derecho, o la tecla de menú) tiene «Mover a…».
import { useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisVertical } from '@gravity-ui/icons';
import { Avatar, AvatarGroup, Button, Chip, Dropdown, ProgressBar, ScrollShadow } from '@heroui/react';
import { PointMenu, menuNodes, pointFrom } from './ContextMenu.jsx';

const HOLD_MS = 220;

/**
 * columns: [{ id, title, icon?, color? }]
 * items, getKey(item), getColumn(item) → id de columna
 * renderCard(item) → contenido de la tarjeta (mejor con <KanbanCard>)
 * onMove(key, toColumn, toIndex), onOpen?(item)
 * cardMenu?(item) → acciones extra; onCardMenu(id, item)
 * columnFooter?(column) → por ejemplo, un botón para añadir
 */
export function Kanban({ columns, items, getKey = (i) => i.id, getColumn, renderCard, onMove, onOpen, cardMenu, onCardMenu, columnFooter, label = 'Tablero', columnWidth = 288 }) {
  const board = useRef(null);
  const press = useRef(null); // { key, x, y, pointerType, timer, el, started }
  const beginRef = useRef(null);
  const suppressClick = useRef(false);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [drag, setDrag] = useState(null); // { key, w, h, dx, dy, x, y }
  const [drop, setDrop] = useState(null); // { col, index }
  const [menu, setMenu] = useState(null); // { at, item }

  const byCol = (colId) => items.filter((i) => getColumn(i) === colId);
  const find = (key) => items.find((i) => String(getKey(i)) === String(key));

  const moveItems = (item) => [
    ...columns.filter((c) => c.id !== getColumn(item)).map((c) => ({ id: `move:${c.id}`, label: `Mover a ${c.title}`, icon: c.icon })),
  ];
  const fullMenu = (item) => {
    const extra = cardMenu ? cardMenu(item) : [];
    return [...(onOpen ? [{ id: 'open', label: 'Abrir' }] : []), ...extra, ...(extra.length || onOpen ? ['-'] : []), ...moveItems(item)];
  };
  const runMenu = (id, item) => {
    if (id === 'open') return onOpen?.(item);
    if (id.startsWith('move:')) {
      const col = id.slice(5);
      return onMove(String(getKey(item)), col, byCol(col).length);
    }
    return onCardMenu?.(id, item);
  };

  // Dónde caería la tarjeta con el puntero en (x, y).
  const target = useCallback(
    (x, y, key) => {
      const el = document.elementFromPoint(x, y);
      const list = el?.closest?.('[data-kanban-list]');
      if (!list || !board.current?.contains(list)) return null;
      const col = list.getAttribute('data-kanban-list');
      const cards = [...list.querySelectorAll(':scope > [data-kanban-card]')].filter((c) => c.getAttribute('data-kanban-card') !== String(key));
      let index = cards.length;
      for (let i = 0; i < cards.length; i += 1) {
        const r = cards[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          index = i;
          break;
        }
      }
      return { col, index };
    },
    [],
  );

  const autoScroll = (x, y) => {
    // El que se desliza es el ScrollShadow que envuelve al tablero.
    const b = board.current?.parentElement;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const edge = 56;
    if (x < r.left + edge) b.scrollLeft -= 14;
    else if (x > r.right - edge) b.scrollLeft += 14;
    if (y < 72) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 56) window.scrollBy(0, 14);
  };

  useEffect(() => {
    const begin = (p) => {
      const r = p.el.getBoundingClientRect();
      p.started = true;
      document.body.classList.add('sw-dragging');
      setDrag({ key: p.key, w: r.width, h: r.height, dx: p.x - r.left, dy: p.y - r.top, x: p.x, y: p.y });
      setDrop(target(p.x, p.y, p.key));
    };
    const onMoveEv = (e) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.started) {
        if (p.pointerType === 'touch') {
          if (dist > 8) cancel(); // está deslizando la página
          return;
        }
        if (dist < 6) return;
        begin(p);
      }
      e.preventDefault();
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      setDrop(target(e.clientX, e.clientY, p.key));
      autoScroll(e.clientX, e.clientY);
    };
    const finish = (e) => {
      const p = press.current;
      if (!p || (e && e.pointerId !== p.pointerId)) return;
      clearTimeout(p.timer);
      if (p.started) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        const t = e ? target(e.clientX, e.clientY, p.key) : null;
        if (t) onMoveRef.current(p.key, t.col, t.index);
      }
      press.current = null;
      document.body.classList.remove('sw-dragging');
      setDrag(null);
      setDrop(null);
    };
    const cancel = () => {
      const p = press.current;
      if (p) clearTimeout(p.timer);
      press.current = null;
      document.body.classList.remove('sw-dragging');
      setDrag(null);
      setDrop(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && press.current?.started) cancel();
    };
    // Con el dedo, una vez arrancado el arrastre, la página no se desliza.
    const noScroll = (e) => {
      if (press.current?.started) e.preventDefault();
    };
    window.addEventListener('pointermove', onMoveEv, { passive: false });
    window.addEventListener('touchmove', noScroll, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey);
    // Para el dedo: el arranque llega por el temporizador.
    beginRef.current = begin;
    return () => {
      window.removeEventListener('pointermove', onMoveEv);
      window.removeEventListener('touchmove', noScroll);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('sw-dragging');
    };
  }, [target]);

  const onPointerDown = (e, item) => {
    if (e.button !== 0 || e.target.closest('button, a, input, textarea, select, [data-no-drag]')) return;
    const key = String(getKey(item));
    const p = { key, x: e.clientX, y: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, el: e.currentTarget, started: false, timer: 0 };
    press.current = p;
    if (e.pointerType === 'touch') {
      p.timer = setTimeout(() => {
        if (press.current === p) beginRef.current?.(p);
      }, HOLD_MS);
    }
  };

  const onCardKey = (e, item) => {
    const key = String(getKey(item));
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpen?.(item);
    } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const i = columns.findIndex((c) => c.id === getColumn(item));
      const next = columns[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) {
        onMove(key, next.id, byCol(next.id).length);
        // El foco sigue a la tarjeta en su nueva columna.
        requestAnimationFrame(() => board.current?.querySelector(`[data-kanban-card="${CSS.escape(key)}"]`)?.focus());
      }
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      setMenu({ at: pointFrom(e), item });
    }
  };

  const dragged = drag && find(drag.key);

  return (
    <>
    {/* El tablero se desliza de lado dentro de un ScrollShadow: los bordes se
        difuminan cuando hay más columnas a la izquierda o a la derecha. */}
    <ScrollShadow orientation="horizontal" size={48} className="-mx-1 pb-3 [scrollbar-width:thin]">
    <div ref={board} role="group" aria-label={label} className="flex w-max gap-3 px-1">
      {columns.map((col) => {
        const list = byCol(col.id);
        const Icon = col.icon;
        const showSlotAt = drop && drop.col === col.id ? drop.index : -1;
        const visible = list.filter((i) => !drag || String(getKey(i)) !== drag.key);
        return (
          <section
            key={col.id}
            aria-label={`${col.title}, ${list.length}`}
            className={`flex shrink-0 flex-col rounded-[1.75rem] bg-surface-secondary p-2 transition-shadow ${drop?.col === col.id ? 'ring-2 ring-accent/50' : ''}`}
            style={{ width: columnWidth }}
          >
            <header className="flex items-center gap-2 px-2 pt-1 pb-2.5">
              {Icon && <Icon className="size-4 shrink-0" style={{ color: col.color || 'var(--muted)' }} aria-hidden />}
              <h3 className="truncate text-sm font-semibold">{col.title}</h3>
              <span className="text-xs text-muted tabular-nums">{list.length}</span>
              {col.meta && <span className="ms-auto truncate text-xs text-muted tabular-nums">{col.meta}</span>}
            </header>
            <div data-kanban-list={col.id} className="flex min-h-16 flex-1 flex-col gap-2">
              {visible.map((item, i) => {
                const key = String(getKey(item));
                return [
                  i === showSlotAt && <div key="__slot" className="sw-drop-slot shrink-0" style={{ height: drag.h }} aria-hidden />,
                  <div
                    key={key}
                    data-kanban-card={key}
                    tabIndex={0}
                    role="button"
                    aria-roledescription="tarjeta movible"
                    aria-description="Alt y flechas para cambiarla de columna; tecla de menú para más acciones."
                    onPointerDown={(e) => onPointerDown(e, item)}
                    onClick={() => {
                      if (!suppressClick.current) onOpen?.(item);
                    }}
                    onKeyDown={(e) => onCardKey(e, item)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ at: pointFrom(e), item });
                    }}
                    className="group relative cursor-grab touch-manipulation rounded-[1.25rem] bg-surface text-start shadow-[var(--surface-shadow)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]"
                  >
                    {renderCard(item)}
                    <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100" data-no-drag>
                      <Dropdown>
                        <Button isIconOnly size="sm" variant="tertiary" aria-label="Acciones de la tarjeta" className="size-7 min-w-7 bg-surface/90 backdrop-blur">
                          <EllipsisVertical className="size-3.5" />
                        </Button>
                        <Dropdown.Popover placement="bottom end" className="min-w-52">
                          <Dropdown.Menu aria-label="Acciones de la tarjeta" onAction={(id) => runMenu(String(id), item)}>
                            {menuNodes(fullMenu(item))}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>
                  </div>,
                ];
              })}
              {showSlotAt >= visible.length && <div className="sw-drop-slot shrink-0" style={{ height: drag.h }} aria-hidden />}
              {list.length === 0 && !drag && <p className="rounded-[1.25rem] border border-dashed border-border px-3 py-6 text-center text-xs text-muted">Suelta aquí</p>}
            </div>
            {columnFooter && <div className="pt-2">{columnFooter(col)}</div>}
          </section>
        );
      })}
    </div>
    </ScrollShadow>

      {drag && dragged && (
        <div className="sw-drag-ghost rounded-[1.25rem] bg-surface" style={{ width: drag.w, left: drag.x - drag.dx, top: drag.y - drag.dy }} aria-hidden>
          {renderCard(dragged)}
        </div>
      )}

      <PointMenu at={menu?.at} items={menu ? fullMenu(menu.item) : []} onClose={() => setMenu(null)} onAction={(id) => menu && runMenu(id, menu.item)} label="Acciones de la tarjeta" />
    </>
  );
}

/**
 * Tarjeta del tablero con las piezas de la demo: portada, título, texto, etiquetas,
 * progreso, personas y contadores. Todas opcionales.
 * tags: [{ label, color? }]; people: [nombres]; meta: [{ icon, value, label }]
 */
export function KanbanCard({ cover, title, description, tags = [], progress, people = [], meta = [], children }) {
  return (
    <div className="flex flex-col gap-2.5 p-3">
      {cover && <img src={cover} alt="" className="-mx-1 -mt-1 aspect-[16/8] w-[calc(100%+0.5rem)] rounded-[0.9rem] object-cover" draggable={false} />}
      <div className="flex flex-col gap-1 pe-6">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {description && <p className="line-clamp-2 text-xs text-muted">{description}</p>}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <Chip key={t.label} size="sm" variant="soft" color={t.color || 'default'}>
              {t.label}
            </Chip>
          ))}
        </div>
      )}
      {progress != null && (
        <ProgressBar aria-label="Avance" value={Math.round(progress * 100)} size="sm" className="gap-1">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
          <ProgressBar.Output className="text-[11px] text-muted" />
        </ProgressBar>
      )}
      {children}
      {(people.length > 0 || meta.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          {people.length > 0 ? (
            <AvatarGroup size="sm" max={3}>
              {people.map((n) => (
                <Avatar key={n} size="sm" variant="soft">
                  <Avatar.Fallback>{String(n).slice(0, 2).toUpperCase()}</Avatar.Fallback>
                </Avatar>
              ))}
            </AvatarGroup>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5 text-xs text-muted">
            {meta.map(({ icon: Icon, value, label }) => (
              <span key={label} className="flex items-center gap-1" title={label}>
                {Icon && <Icon className="size-3.5" aria-hidden />}
                <span className="tabular-nums">{value}</span>
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
