// Las monedas con su «moneda» dibujada: un círculo de color con su signo ($, €, ₮,
// Bs), para reconocerlas de un vistazo en los selectores. Dos formas de elegir:
//  · CurrencyPicker: botones en fila (todas a la vista), para formularios.
//  · CurrencyMenu: un botón con la elegida y un menú, para barras con poco sitio.
import { ChevronDown, Lock } from '@gravity-ui/icons';
import { Button, Description, Dropdown, Label, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { CURRENCIES, CURRENCY_CODES } from '../../negocio-core.js';

// El color va con la moneda, nunca con su orden; el signo la identifica igual sin color.
export const COIN = {
  USD: { glyph: '$', bg: '#15803d', fg: '#fff' },
  EUR: { glyph: '€', bg: '#2563eb', fg: '#fff' },
  USDT: { glyph: '₮', bg: '#14b8a6', fg: '#042f2e' },
  VES: { glyph: 'Bs', bg: '#f5b301', fg: '#2b1d00' },
};

const COIN_SIZE = { xs: 'size-4 text-[8px]', sm: 'size-5 text-[10px]', md: 'size-6 text-[11px]', lg: 'size-9 text-sm', xl: 'size-12 text-lg' };

export function CurrencyCoin({ code, size = 'sm', className = '' }) {
  // Un tamaño propio en className (size-…) manda sobre el del tamaño elegido.
  const box = /(^|\s)size-/.test(className) ? (COIN_SIZE[size] || COIN_SIZE.sm).replace(/size-\S+/, '') : COIN_SIZE[size] || COIN_SIZE.sm;
  const c = COIN[code] || { glyph: String(code || '?').slice(0, 2), bg: 'var(--default)', fg: 'var(--foreground)' };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none tracking-tight shadow-[inset_0_-1px_0_rgb(0_0_0/0.18),0_0_0_1px_rgb(0_0_0/0.04)] ${c.glyph.length > 1 ? 'tracking-[-0.04em]' : ''} ${box} ${className}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {c.glyph}
    </span>
  );
}

/** Todas las monedas a la vista, la elegida marcada. */
export function CurrencyPicker({ label, value, onChange, description, codes = CURRENCY_CODES, size = 'md', isDisabled, disabledKeys = [], fullWidth = false, showName = true, className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {label && <Label>{label}</Label>}
      <ToggleButtonGroup
        aria-label={label || 'Moneda'}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={value ? new Set([value]) : new Set()}
        onSelectionChange={(keys) => {
          const k = [...keys][0];
          if (k && k !== value) onChange(String(k));
        }}
        size={size}
        isDisabled={isDisabled}
        fullWidth={fullWidth}
        className="max-w-full flex-wrap"
      >
        {codes.map((k, i) => (
          <ToggleButton key={k} id={k} isDisabled={disabledKeys.includes(k)} aria-label={`${k} · ${CURRENCIES[k]?.label || k}`} className="gap-2">
            {i > 0 && <ToggleButtonGroup.Separator />}
            <CurrencyCoin code={k} size={size === 'lg' ? 'md' : 'sm'} />
            <span className="font-semibold tabular-nums">{k}</span>
            {showName && <span className="hidden text-muted md:inline">{CURRENCIES[k]?.label}</span>}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {description && <Description>{description}</Description>}
    </div>
  );
}

/** Un botón con la moneda elegida y su menú. locked: se ve el candado y no se cambia. */
export function CurrencyMenu({ value, onChange, size = 'sm', variant = 'tertiary', locked = false, onLocked, codes = CURRENCY_CODES, placement = 'bottom start' }) {
  return (
    <Dropdown>
      <Button size={size} variant={variant} aria-label={`Moneda: ${value}`}>
        <CurrencyCoin code={value} size={size === 'sm' ? 'xs' : 'sm'} />
        <span className="font-semibold">{value}</span>
        {locked ? <Lock className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </Button>
      <Dropdown.Popover placement={placement} className="min-w-60">
        <Dropdown.Menu
          aria-label="Moneda"
          selectionMode="single"
          selectedKeys={new Set([value])}
          disabledKeys={locked ? codes.filter((k) => k !== value) : []}
          onAction={(k) => {
            if (locked) return onLocked?.();
            return k !== value && onChange(String(k));
          }}
        >
          {codes.map((k) => (
            <Dropdown.Item key={k} id={k} textValue={`${k} ${CURRENCIES[k]?.label || ''}`}>
              <CurrencyCoin code={k} size="md" />
              <div className="flex flex-col">
                <Label>{CURRENCIES[k]?.label || k}</Label>
                <Description>
                  {k} · {CURRENCIES[k]?.sign}
                </Description>
              </div>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
