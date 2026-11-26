// Número con − y +, inspirado en el «Number Stepper» de HeroUI Pro y hecho con el
// NumberField de HeroUI: una píldora compacta con el valor ya formateado (moneda,
// porcentaje, días, horas…). Se escribe a mano, se sube o baja con los botones, con
// las flechas del teclado o con la rueda del ratón sobre el campo.
import { Minus, Plus } from '@gravity-ui/icons';
import { Description, Label, NumberField } from '@heroui/react';

/**
 * formatOptions de Intl.NumberFormat, por ejemplo:
 *   { style: 'currency', currency: 'USD' }        → 10,00 US$
 *   { style: 'percent' }                           → 50 % (el valor va de 0 a 1)
 *   { style: 'unit', unit: 'day', unitDisplay: 'long' } → 15 días
 */
export function NumberStepper({ label, value, onChange, min, max, step = 1, formatOptions, description, align = 'start', className = '', ariaLabel, size = 'md' }) {
  return (
    <NumberField
      value={Number.isFinite(Number(value)) ? Number(value) : 0}
      onChange={(n) => onChange?.(Number.isFinite(n) ? n : 0)}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      aria-label={ariaLabel || label}
      className={`flex flex-col gap-1.5 ${align === 'center' ? 'items-center text-center' : 'items-start'} ${className}`}
    >
      {label && <Label>{label}</Label>}
      <NumberField.Group className={`inline-flex w-auto items-center gap-0.5 rounded-full bg-default p-0.5 ${size === 'sm' ? 'h-8' : 'h-9'}`}>
        <NumberField.DecrementButton className={`flex shrink-0 items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 ${size === 'sm' ? 'size-7' : 'size-8'}`}>
          <Minus className="size-3.5" />
        </NumberField.DecrementButton>
        <NumberField.Input className={`min-w-0 border-0 bg-transparent px-1 text-center text-sm font-semibold tabular-nums shadow-none outline-none ${size === 'sm' ? 'w-[7ch]' : 'w-[9ch]'}`} />
        <NumberField.IncrementButton className={`flex shrink-0 items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 ${size === 'sm' ? 'size-7' : 'size-8'}`}>
          <Plus className="size-3.5" />
        </NumberField.IncrementButton>
      </NumberField.Group>
      {description && <Description>{description}</Description>}
    </NumberField>
  );
}
