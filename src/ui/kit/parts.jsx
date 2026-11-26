// Piezas compartidas por Negocio y el portal nuevos, hechas solo con componentes
// de HeroUI: así las dos apps tienen la misma cabecera de página, las mismas
// tarjetas de cifras y los mismos vacíos.
import { ArrowDown, ArrowUp } from '@gravity-ui/icons';
import { Avatar, Card, Chip, EmptyState } from '@heroui/react';

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <p className="sw-eyebrow">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Variación frente al tramo anterior, en verde si es buena y en rojo si no. */
export function Delta({ value, upIsGood = true }) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = up === upIsGood;
  return (
    <Chip size="sm" variant="soft" color={good ? 'success' : 'danger'}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      <Chip.Label>{Math.abs(Math.round(value * 100))} %</Chip.Label>
    </Chip>
  );
}

/** Tarjeta de cifra: etiqueta arriba, la cifra en Anton y una línea de contexto. */
export function Stat({ label, value, sub, delta, upIsGood, tone, icon: Icon, href }) {
  const card = (
    <Card className={`h-full min-w-0 ${href ? 'transition-transform hover:bg-surface-hover active:scale-[0.98]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="sw-eyebrow">{label}</span>
        {delta != null ? <Delta value={delta} upIsGood={upIsGood} /> : Icon && <Icon className="size-4 text-muted" aria-hidden />}
      </div>
      <p className="sw-figure truncate text-3xl sm:text-4xl" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </Card>
  );
  return href ? (
    <a href={href} className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-focus">
      {card}
    </a>
  ) : (
    card
  );
}

/** Bloque con título (y acción a la derecha) para agrupar contenido. */
export function Panel({ title, description, action, children, className = '' }) {
  return (
    <Card className={`min-w-0 ${className}`}>
      {(title || action) && (
        <Card.Header className="flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <Card.Title>{title}</Card.Title>}
            {description && <Card.Description>{description}</Card.Description>}
          </div>
          {action}
        </Card.Header>
      )}
      <Card.Content className="min-w-0">{children}</Card.Content>
    </Card>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <EmptyState className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      {Icon && <Icon className="size-7 text-muted" aria-hidden />}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </EmptyState>
  );
}

export function StatusChip({ label, color = 'default', size = 'sm' }) {
  return (
    <Chip size={size} variant="soft" color={color}>
      {label}
    </Chip>
  );
}

const COLORS = ['accent', 'success', 'warning', 'danger', 'default'];
const colorFor = (name = '') => COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];

export function Person({ name, src, size = 'sm' }) {
  const ini =
    String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || '·';
  return (
    <Avatar size={size} color={colorFor(name)} variant="soft">
      {src && <Avatar.Image alt={name} src={src} />}
      <Avatar.Fallback>{ini}</Avatar.Fallback>
    </Avatar>
  );
}
