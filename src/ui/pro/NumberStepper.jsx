// Número con − y +, como el «Number Stepper» de HeroUI Pro y hecho con el
// NumberField de HeroUI: un carril en píldora (--default) con dos botones redondos
// que resaltan sobre él (blancos con sombra en claro, oscuros en oscuro: .sw-stepper
// en theme.css) y el valor ya formateado en medio (moneda, porcentaje, días,
// horas…). Se escribe a mano, se sube o baja con los botones, con las flechas del
// teclado o con la rueda del ratón sobre el campo.
import { Minus, Plus } from '@gravity-ui/icons';
import { Description, Label, NumberField } from '@heroui/react';

const SIZE = {
  sm: { group: 'h-8', btn: 'size-7', icon: 'size-3.5', value: 'text-[13px]' },
  md: { group: 'h-9', btn: 'size-8', icon: 'size-4', value: 'text-sm' },
  lg: { group: 'h-11', btn: 'size-10', icon: 'size-4', value: 'text-base' },
};

/**
 * formatOptions de Intl.NumberFormat, por ejemplo:
 *   { style: 'currency', currency: 'USD' }        → 10,00 US$
 *   { style: 'percent' }                           → 50 % (el valor va de 0 a 1)
 *   { style: 'unit', unit: 'day', unitDisplay: 'long' } → 15 días
 * width: ancho del valor en caracteres (por defecto, según el tamaño).
 */
export function NumberStepper({ label, value, onChange, min, max, step = 1, formatOptions, description, align = 'start', className = '', ariaLabel, size = 'md', width, isDisabled }) {
  const s = SIZE[size] || SIZE.md;
  return (
    <NumberField
      value={Number.isFinite(Number(value)) ? Number(value) : 0}
      onChange={(n) => onChange?.(Number.isFinite(n) ? n : 0)}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      isDisabled={isDisabled}
      aria-label={ariaLabel || label}
      className={`flex flex-col gap-1.5 ${align === 'center' ? 'items-center text-center' : 'items-start'} ${className}`}
    >
      {label && <Label>{label}</Label>}
      <NumberField.Group className={`sw-stepper inline-flex w-auto items-center rounded-full bg-default p-0.5 ${s.group}`}>
        <NumberField.DecrementButton className={`sw-stepper__btn flex shrink-0 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus active:scale-90 disabled:opacity-40 ${s.btn}`}>
          <Minus className={s.icon} />
        </NumberField.DecrementButton>
        <NumberField.Input
          className={`min-w-0 border-0 bg-transparent px-2 text-center font-semibold tabular-nums shadow-none outline-none ${s.value}`}
          style={{ width: `${width || (size === 'sm' ? 7 : 9)}ch` }}
        />
        <NumberField.IncrementButton className={`sw-stepper__btn flex shrink-0 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus active:scale-90 disabled:opacity-40 ${s.btn}`}>
          <Plus className={s.icon} />
        </NumberField.IncrementButton>
      </NumberField.Group>
      {description && <Description>{description}</Description>}
    </NumberField>
  );
}
