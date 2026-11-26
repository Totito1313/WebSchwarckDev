// Widgets de tablero, cifras con tendencia y la ficha de variación, inspirados en
// «Widget», «KPI» y «Trend Chip» de HeroUI Pro y hechos con nuestro tema:
// un marco gris con el título arriba y, dentro, una superficie con el contenido.
import { ArrowDown, ArrowUp, Minus } from '@gravity-ui/icons';
import { Separator } from '@heroui/react';
import { Sparkline } from './charts.jsx';

const pct = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Variación con su flecha: verde si es buena, roja si es mala y gris si no cambia.
 * value es una fracción (0.033 = 3,3 %). upIsGood decide qué dirección es buena.
 */
export function TrendChip({ value, upIsGood = true, label, size = 'sm' }) {
  if (value == null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.0005;
  const up = value > 0;
  const tone = flat ? 'neutral' : up === upIsGood ? 'good' : 'bad';
  const cls = {
    good: 'bg-success/12 text-success',
    bad: 'bg-danger/12 text-danger',
    neutral: 'bg-default text-muted',
  }[tone];
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const text = `${flat ? '' : up ? '+' : '−'}${pct.format(Math.abs(value) * 100)} %`;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`inline-flex shrink-0 items-center gap-0.5 rounded-full font-medium tabular-nums ${cls} ${size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'}`}
        aria-label={`${flat ? 'Sin cambio' : up ? 'Sube' : 'Baja'} ${pct.format(Math.abs(value) * 100)} por ciento${label ? `, ${label}` : ''}`}
      >
        <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
        {text}
      </span>
      {label && <span className="truncate text-xs text-muted">{label}</span>}
    </span>
  );
}

/**
 * Widget: marco con título (y lo que vaya a la derecha) y una superficie dentro.
 * flush quita el margen interior, para tablas o listas que llegan al borde.
 */
export function Widget({ title, description, action, footer, children, className = '', bodyClassName = '', flush = false }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[1.75rem] bg-surface-secondary p-1.5 shadow-[var(--surface-shadow)] ${className}`}>
      {(title || action) && (
        <header className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-1.5 pb-2">
          <div className="flex min-w-0 flex-col">
            {title && <h2 className="truncate text-sm font-semibold">{title}</h2>}
            {description && <p className="truncate text-xs text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2 text-xs text-muted">{action}</div>}
        </header>
      )}
      <div className={`min-w-0 flex-1 rounded-[1.375rem] bg-surface shadow-[var(--surface-shadow)] ${flush ? '' : 'p-4'} ${bodyClassName}`}>{children}</div>
      {footer && <footer className="px-3 pt-2 pb-1 text-xs text-muted">{footer}</footer>}
    </section>
  );
}

/** Cifra con su variación y, si se da, su tendencia en pequeño. */
export function Kpi({ label, value, delta, upIsGood = true, deltaLabel, trend, trendColor, sub, href, tone }) {
  const body = (
    <div className="flex min-w-0 items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-sm text-muted">{label}</span>
        <span className="sw-figure truncate text-3xl" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        {delta != null ? <TrendChip value={delta} upIsGood={upIsGood} label={deltaLabel} /> : sub && <span className="truncate text-xs text-muted">{sub}</span>}
      </div>
      {trend && trend.length > 1 && (
        <Sparkline
          values={trend}
          color={trendColor || (delta == null || Math.abs(delta) < 0.0005 ? 'var(--muted)' : (delta > 0) === upIsGood ? 'var(--success)' : 'var(--danger)')}
          label={`Tendencia de ${label}`}
        />
      )}
    </div>
  );
  return href ? (
    <a href={href} className="-m-2 block min-w-0 rounded-2xl p-2 outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus">
      {body}
    </a>
  ) : (
    body
  );
}

/** Fila de cifras dentro de un widget, separadas por una línea fina. */
export function KpiGroup({ items }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0">
      {items.map((k, i) => (
        <div key={k.label} className="flex min-w-0 items-stretch">
          {i > 0 && <Separator orientation="vertical" className="mx-5 hidden h-auto xl:block" />}
          <div className="min-w-0 flex-1">
            <Kpi {...k} />
          </div>
        </div>
      ))}
    </div>
  );
}
