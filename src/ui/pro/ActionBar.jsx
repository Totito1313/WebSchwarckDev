// Barra de acciones flotante, inspirada en la «Action Bar» de HeroUI Pro: aparece
// abajo, en el centro, cuando hay elementos seleccionados. Muestra cuántos son, las
// acciones (la peligrosa en rojo) y la X para soltar la selección. Esc también la
// cierra. Va en un portal para quedar por encima de todo.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Xmark } from '@gravity-ui/icons';
import { Button, ScrollShadow, Separator, Tooltip } from '@heroui/react';

/**
 * count: cuántos hay seleccionados (con 0 no se muestra).
 * actions: [{ id, label, icon?, danger?, isDisabled? }]
 * onAction(id), onClear()
 */
export function ActionBar({ count, actions, onAction, onClear, label: labelProp }) {
  const label = labelProp || (count === 1 ? 'seleccionado' : 'seleccionados');
  useEffect(() => {
    if (!count) return undefined;
    const onKey = (e) => {
      // Esc suelta la selección, salvo que haya un menú o un diálogo abierto (ese
      // Esc es para cerrarlo). Se escucha en captura porque la tabla se lo queda.
      if (e.key === 'Escape' && !document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"]')) onClear?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [count, onClear]);

  if (!count) return null;
  return createPortal(
    <div
      role="toolbar"
      aria-label={`${count} ${label}`}
      className="sw-action-bar fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full bg-overlay p-1.5 shadow-[var(--overlay-shadow)]"
    >
      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-default px-2 text-sm font-semibold tabular-nums" aria-live="polite">
        {count}
      </span>
      <span className="sr-only">{label}</span>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ScrollShadow orientation="horizontal" hideScrollBar size={24} className="flex min-w-0 items-center gap-0.5">
        {actions.map(({ id, label: text, icon: Icon, danger, isDisabled }) => (
          <Button
            key={id}
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            className={`shrink-0 ${danger ? 'text-danger' : ''}`}
            onPress={() => onAction?.(id)}
          >
            {Icon && <Icon className="size-4" />}
            {text}
          </Button>
        ))}
      </ScrollShadow>
      <Tooltip delay={300}>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Soltar la selección" onPress={onClear}>
          <Xmark className="size-4" />
        </Button>
        <Tooltip.Content>Soltar la selección (Esc)</Tooltip.Content>
      </Tooltip>
    </div>,
    document.body,
  );
}
