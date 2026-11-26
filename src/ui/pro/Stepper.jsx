// Pasos, inspirados en el «Stepper» de HeroUI Pro: hechos (con su visto), el actual
// (con aro) y los que faltan (en gris), unidos por una línea que se rellena al avanzar.
// En vertical u horizontal. Si se pasa onChange, cada paso es un botón para ir a él
// (pasos controlados); si no, es solo para mirar (como el seguimiento de un envío).
import { Check } from '@gravity-ui/icons';

/**
 * steps: [{ id, title, description?, trailing? }]
 * current: índice del paso actual (steps.length = todos hechos)
 * onChange?(index), orientation: 'vertical' | 'horizontal'
 * numbered: número en los que faltan (si no, un círculo vacío)
 */
export function Stepper({ steps, current, onChange, orientation = 'vertical', numbered = true, label = 'Pasos', className = '' }) {
  const vertical = orientation === 'vertical';
  return (
    <ol aria-label={label} className={`flex ${vertical ? 'flex-col' : 'items-start'} ${className}`}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        const state = done ? 'hecho' : active ? 'en curso' : 'pendiente';
        const dot = (
          <span
            className={`relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
              done
                ? 'bg-accent text-accent-foreground'
                : active
                  ? 'border-2 border-accent bg-surface text-accent'
                  : 'border-2 border-default bg-surface text-muted'
            }`}
          >
            {done ? <Check className="size-3.5" /> : active && !numbered ? <span className="size-2 rounded-full bg-accent" /> : numbered ? i + 1 : null}
          </span>
        );
        const text = (
          <span className={`flex min-w-0 flex-col ${vertical ? 'pt-0.5' : 'items-center text-center'}`}>
            <span className={`text-sm font-medium ${active ? 'text-accent' : done ? '' : 'text-muted'}`}>
              {s.title}
              <span className="sr-only">, {state}</span>
            </span>
            {s.description && <span className="text-xs text-muted">{s.description}</span>}
          </span>
        );
        const inner = vertical ? (
          <span className="flex min-w-0 flex-1 items-start gap-3">
            {dot}
            {text}
            {s.trailing && <span className={`ms-auto shrink-0 pt-1 text-xs tabular-nums ${active ? 'text-accent' : 'text-muted'}`}>{s.trailing}</span>}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-2">
            {dot}
            {text}
          </span>
        );
        return (
          <li key={s.id} className={`relative flex ${vertical ? `min-w-0 ${last ? '' : 'pb-5'}` : 'min-w-0 flex-1 justify-center'}`} aria-current={active ? 'step' : undefined}>
            {!last &&
              (vertical ? (
                <span className={`absolute top-8 bottom-1 left-[13.5px] w-0.5 rounded-full ${done ? 'bg-accent' : 'bg-default'}`} aria-hidden />
              ) : (
                <span className={`absolute top-3.5 left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] h-0.5 rounded-full ${done ? 'bg-accent' : 'bg-default'}`} aria-hidden />
              ))}
            {onChange ? (
              <button
                type="button"
                onClick={() => onChange(i)}
                className={`flex min-w-0 rounded-2xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus ${vertical ? 'flex-1 -m-1 p-1 hover:bg-surface-secondary' : 'p-1'}`}
              >
                {inner}
              </button>
            ) : (
              <span className={`flex min-w-0 ${vertical ? 'flex-1' : ''}`}>
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
