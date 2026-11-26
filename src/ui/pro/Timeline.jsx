// Línea de tiempo, inspirada en la «Timeline» de HeroUI Pro: cada paso con su marca
// (punto, aro, icono, visto o avatar) unida a la siguiente por una línea fina,
// título con su ficha, texto, hora a la derecha y, si hace falta, un bloque debajo
// (una tarjeta, unas cifras, una imagen) y un pie (quién y cuándo).
// Con split, la hora y el autor van en una columna a la izquierda de la línea.
import { Check } from '@gravity-ui/icons';
import { Chip } from '@heroui/react';
import { Person } from '../kit/parts.jsx';

function Marker({ marker = {}, current }) {
  const { icon: Icon, color, avatar, kind = Icon ? 'icon' : 'dot' } = marker;
  if (avatar != null) return <Person name={avatar} size="sm" />;
  if (kind === 'check')
    return (
      <span className="flex size-6 items-center justify-center rounded-full text-accent-foreground" style={{ background: color || 'var(--accent)' }}>
        <Check className="size-3.5" />
      </span>
    );
  if (kind === 'icon')
    return (
      <span
        className="flex size-7 items-center justify-center rounded-[0.6rem] bg-surface-secondary shadow-[var(--surface-shadow)]"
        style={color ? { color } : undefined}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
    );
  if (kind === 'ring')
    return (
      <span className="flex size-6 items-center justify-center rounded-full border-2" style={{ borderColor: color || 'var(--accent)' }}>
        {current && <span className="size-2 rounded-full" style={{ background: color || 'var(--accent)' }} />}
      </span>
    );
  return (
    <span className="flex size-6 items-center justify-center">
      <span className="size-2.5 rounded-full ring-4 ring-surface" style={{ background: color || 'var(--muted)' }} />
    </span>
  );
}

/**
 * items: [{
 *   id, title, marker?: { kind?: 'dot'|'ring'|'icon'|'check', icon?, color?, avatar? },
 *   badge?: { label, color? }, trailing?, description?, children?, footer?, aside?, current?
 * }]
 * split: pone `aside` (hora, autor…) en una columna a la izquierda de la línea.
 */
export function Timeline({ items, split = false, label = 'Historial', className = '' }) {
  return (
    <ol aria-label={label} className={`flex flex-col ${className}`}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li
            key={it.id}
            className={`relative grid gap-x-3 ${split ? 'grid-cols-[minmax(4.5rem,7rem)_1.75rem_minmax(0,1fr)]' : 'grid-cols-[1.75rem_minmax(0,1fr)]'} ${last ? '' : 'pb-5'}`}
            aria-current={it.current ? 'step' : undefined}
          >
            {split && <div className="flex min-w-0 flex-col items-end gap-1 pt-0.5 text-end text-xs text-muted">{it.aside}</div>}
            <div className="relative flex justify-center">
              <div className="relative z-[1] flex h-7 items-center">
                <Marker marker={it.marker} current={it.current} />
              </div>
              {!last && <span className="absolute top-8 bottom-[-0.25rem] w-px bg-separator" aria-hidden />}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sm font-medium ${it.current ? 'text-foreground' : ''}`}>{it.title}</span>
                  {it.badge && (
                    <Chip size="sm" variant="soft" color={it.badge.color || 'default'}>
                      {it.badge.label}
                    </Chip>
                  )}
                </div>
                {it.trailing && <span className="shrink-0 text-xs text-muted tabular-nums">{it.trailing}</span>}
              </div>
              {it.description && <div className="text-sm text-muted">{it.description}</div>}
              {it.children}
              {it.footer && <div className="flex items-center gap-1.5 text-xs text-muted">{it.footer}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Bloque con borde para el contenido de un paso (texto, cifras, imagen). */
export function TimelineCard({ children, stats, media, className = '' }) {
  return (
    <div className={`flex min-w-0 gap-3 rounded-2xl border border-separator bg-surface p-3 ${className}`}>
      {media && <div className="w-28 shrink-0 overflow-hidden rounded-xl">{media}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        {children && <div className="min-w-0">{children}</div>}
        {stats && (
          <dl className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
            {stats.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="truncate font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
