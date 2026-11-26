// Piezas de formulario de Negocio: la ventana con formulario, el selector, el
// importe, la fecha (en ISO, como se guarda) y la confirmación de borrar. Así cada
// pantalla escribe solo lo suyo y todas se ven y se comportan igual.
import { useState } from 'react';
import { parseDate } from '@internationalized/date';
import {
  AlertDialog,
  Button,
  Calendar,
  DateField,
  DatePicker,
  Description,
  Form,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
} from '@heroui/react';

/** Ventana con un formulario: Cancelar y el botón de guardar abajo. onSubmit recibe los datos y close. */
export function FormModal({ title, isOpen = true, onClose, onSubmit, submit = 'Guardar', size = 'sm:max-w-[560px]', danger, children, extra }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen={isOpen} onOpenChange={(o) => !o && onClose?.()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className={size}>
            {({ close }) => (
              <Form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const ok = await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
                    if (ok !== false) close();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>{title}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="grid max-h-[65vh] gap-4 overflow-y-auto px-1 sm:grid-cols-2">{children}</Modal.Body>
                <Modal.Footer className="flex-wrap">
                  {extra}
                  <span className="flex-1" />
                  <Button slot="close" variant="secondary">
                    Cancelar
                  </Button>
                  <Button type="submit" isPending={busy} variant={danger ? 'danger' : 'primary'}>
                    {submit}
                  </Button>
                </Modal.Footer>
              </Form>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Selector de una lista cerrada. options: [[id, texto, descripción?], …] */
export function SelectField({ label, value, onChange, options, className = '', placeholder = 'Elegir…', description, isDisabled, ariaLabel }) {
  return (
    <Select className={className} selectedKey={value ?? null} onSelectionChange={(k) => onChange(k == null ? '' : String(k))} placeholder={placeholder} isDisabled={isDisabled} aria-label={ariaLabel || label}>
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description && <Description>{description}</Description>}
      <Select.Popover>
        <ListBox>
          {options.map(([id, text, desc]) => (
            <ListBox.Item key={id || '_none'} id={id} textValue={text}>
              {desc ? (
                <div className="flex flex-col">
                  <Label>{text}</Label>
                  <Description>{desc}</Description>
                </div>
              ) : (
                text
              )}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Importe con decimales (sin símbolo: la moneda va al lado o en la etiqueta). */
export function AmountField({ label, value, onChange, name, className = '', min = 0, step, description, ariaLabel }) {
  return (
    <NumberField
      className={className}
      name={name}
      value={Number.isFinite(Number(value)) ? Number(value) : 0}
      onChange={(n) => onChange?.(Number.isFinite(n) ? n : 0)}
      minValue={min}
      step={step}
      formatOptions={{ maximumFractionDigits: 4 }}
      aria-label={ariaLabel || label}
    >
      {label && <Label>{label}</Label>}
      <NumberField.Group>
        <NumberField.Input />
      </NumberField.Group>
      {description && <Description>{description}</Description>}
    </NumberField>
  );
}

const toDate = (iso) => {
  try {
    return iso ? parseDate(iso) : null;
  } catch {
    return null;
  }
};

/** Fecha con calendario. value y onChange van en ISO (2026-11-26), como se guardan. */
export function DateInput({ label, value, onChange, className = '', description, ariaLabel, isRequired }) {
  return (
    <DatePicker className={className} value={toDate(value)} onChange={(d) => onChange(d ? d.toString() : '')} aria-label={ariaLabel || label} isRequired={isRequired}>
      {label && <Label>{label}</Label>}
      <DateField.Group fullWidth>
        <DateField.Input>{(seg) => <DateField.Segment segment={seg} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description && <Description>{description}</Description>}
      <DatePicker.Popover>
        <Calendar aria-label={label || ariaLabel}>
          <Calendar.Header>
            <Calendar.Heading />
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

/** Botón que pide confirmación antes de algo que no se deshace. */
export function ConfirmButton({ title, text, confirm = 'Eliminar', onConfirm, children, variant = 'danger-soft', size = 'sm', isIconOnly, ariaLabel }) {
  return (
    <AlertDialog>
      <Button variant={variant} size={size} isIconOnly={isIconOnly} aria-label={ariaLabel}>
        {children}
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {text && <AlertDialog.Body>{text}</AlertDialog.Body>}
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancelar
              </Button>
              <Button slot="close" variant="danger" onPress={onConfirm}>
                {confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/** Opciones de moneda para SelectField. */
export const currencyOptions = (CURRENCIES) => Object.entries(CURRENCIES).map(([k, c]) => [k, `${k} · ${c.label}`]);
