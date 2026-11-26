// Catálogo · Formularios, Controles, Colores y Fechas.
import { useState } from 'react';
import { At, Envelope, Eye, EyeSlash, FloppyDisk, Globe } from '@gravity-ui/icons';
import { getLocalTimeZone, today } from '@internationalized/date';
import {
  Button,
  Calendar,
  Checkbox,
  CheckboxGroup,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  DateField,
  DatePicker,
  DateRangePicker,
  Description,
  ErrorMessage,
  FieldError,
  FieldGroup,
  Fieldset,
  Form,
  Input,
  InputGroup,
  InputOTP,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  RangeCalendar,
  SearchField,
  Slider,
  Switch,
  SwitchGroup,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  TimeField,
  parseColor,
  toast,
} from '@heroui/react';
import { BRAND_COLORS } from './sample.js';

const Check = ({ children, value, desc }) => (
  <Checkbox value={value}>
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      {children}
    </Checkbox.Content>
    {desc && <Description>{desc}</Description>}
  </Checkbox>
);

function CheckboxDemo() {
  return (
    <div className="flex flex-col gap-3">
      <Checkbox defaultSelected>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Facturable
        </Checkbox.Content>
      </Checkbox>
      <Checkbox isIndeterminate>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Algunas tareas hechas
        </Checkbox.Content>
      </Checkbox>
      <Checkbox isDisabled>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Firmada (bloqueada)
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}

function CheckboxGroupDemo() {
  return (
    <CheckboxGroup name="avisos" defaultValue={['report', 'content']}>
      <Label>Avisos al teléfono</Label>
      <Description>Lo que le llega al cliente.</Description>
      <Check value="report" desc="Un solo aviso que se actualiza.">
        Reporte de hoy
      </Check>
      <Check value="content">Contenido para revisar</Check>
      <Check value="invoices">Facturas y pagos</Check>
    </CheckboxGroup>
  );
}

function RadioDemo() {
  return (
    <RadioGroup defaultValue="pagomovil" name="cobro">
      <Label>Forma de cobro</Label>
      {[
        ['pagomovil', 'Pago Móvil', 'En bolívares, a la tasa del día.'],
        ['zelle', 'Zelle', 'En dólares.'],
        ['binance', 'Binance Pay', 'En USDT.'],
      ].map(([value, label, desc]) => (
        <Radio key={value} value={value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
          <Description>{desc}</Description>
        </Radio>
      ))}
    </RadioGroup>
  );
}

function TextFieldDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <TextField name="name" isRequired>
        <Label>Nombre del cliente</Label>
        <Input placeholder="Café Aroma" />
        <Description>Sale en cada documento.</Description>
      </TextField>
      <TextField name="email" type="email" isInvalid defaultValue="maria@">
        <Label>Correo</Label>
        <Input />
        <FieldError>Falta el dominio (por ejemplo, @gmail.com).</FieldError>
      </TextField>
    </div>
  );
}

function InputDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <Input aria-label="Concepto" placeholder="Concepto del gasto" />
      <Input aria-label="En una superficie" placeholder="Variante secundaria" variant="secondary" />
    </div>
  );
}

function TextAreaDemo() {
  return (
    <TextField name="notes" className="w-full max-w-sm">
      <Label>Notas de la factura</Label>
      <TextArea placeholder="Gracias por tu confianza." rows={3} />
    </TextField>
  );
}

function InputGroupDemo() {
  const [show, setShow] = useState(false);
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <TextField name="web">
        <Label>Web</Label>
        <InputGroup>
          <InputGroup.Prefix>
            <Globe className="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="schwarckdev.com" />
        </InputGroup>
      </TextField>
      <TextField name="password" type={show ? 'text' : 'password'} defaultValue="una-contraseña">
        <Label>Contraseña</Label>
        <InputGroup>
          <InputGroup.Input />
          <InputGroup.Suffix>
            <Button isIconOnly size="sm" variant="ghost" aria-label={show ? 'Ocultar' : 'Ver'} onPress={() => setShow((s) => !s)}>
              {show ? <EyeSlash /> : <Eye />}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
    </div>
  );
}

function InputOTPDemo() {
  return (
    <div className="flex flex-col gap-2">
      <Label>Código de acceso</Label>
      <InputOTP maxLength={6}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>
      <Description>El que manda el estudio por WhatsApp.</Description>
    </div>
  );
}

function NumberFieldDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <NumberField defaultValue={1250} minValue={0} formatOptions={{ style: 'currency', currency: 'USD' }} name="amount">
        <Label>Importe</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <NumberField defaultValue={36.5} minValue={0} step={0.01} name="rate">
        <Label>Tasa del día (1 USD = Bs)</Label>
        <NumberField.Group>
          <NumberField.Input />
        </NumberField.Group>
        <Description>BCV, paralelo o la acordada.</Description>
      </NumberField>
    </div>
  );
}

function SearchFieldDemo() {
  return (
    <SearchField name="q" className="w-full max-w-xs">
      <Label>Buscar</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder="Clientes, facturas, tareas…" />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

function LabelDescriptionDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1">
      <Label htmlFor="cat-tax">RIF o cédula</Label>
      <Input id="cat-tax" aria-describedby="cat-tax-desc" placeholder="J-12345678-9" />
      <Description id="cat-tax-desc">Sale debajo de tu nombre en las facturas.</Description>
    </div>
  );
}

function ErrorMessageDemo() {
  const [selected, setSelected] = useState(new Set());
  return (
    <TagGroup selectionMode="multiple" selectedKeys={selected} onSelectionChange={setSelected} aria-label="Redes">
      <Label>Redes de la publicación</Label>
      <TagGroup.List>
        <Tag id="ig">Instagram</Tag>
        <Tag id="fb">Facebook</Tag>
        <Tag id="tt">TikTok</Tag>
      </TagGroup.List>
      <ErrorMessage>{selected.size === 0 && 'Elige al menos una red.'}</ErrorMessage>
    </TagGroup>
  );
}

function FormDemo() {
  return (
    <Form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        toast.success(`Cliente «${data.name}» listo`, { description: 'En el catálogo no se guarda nada.' });
      }}
    >
      <Fieldset>
        <Fieldset.Legend>Nuevo cliente</Fieldset.Legend>
        <Description>Los datos se copian en cada documento.</Description>
        <FieldGroup>
          <TextField isRequired name="name" validate={(v) => (v.trim().length < 2 ? 'Escribe al menos dos letras.' : null)}>
            <Label>Nombre</Label>
            <Input placeholder="Café Aroma" />
            <FieldError />
          </TextField>
          <TextField name="email" type="email">
            <Label>Correo</Label>
            <InputGroup>
              <InputGroup.Prefix>
                <Envelope className="size-4 text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input placeholder="hola@cliente.com" />
            </InputGroup>
            <FieldError />
          </TextField>
          <TextField name="ig">
            <Label>Instagram</Label>
            <InputGroup>
              <InputGroup.Prefix>
                <At className="size-4 text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input placeholder="cafearoma" />
            </InputGroup>
          </TextField>
        </FieldGroup>
        <Fieldset.Actions>
          <Button type="submit">
            <FloppyDisk />
            Guardar
          </Button>
          <Button type="reset" variant="secondary">
            Limpiar
          </Button>
        </Fieldset.Actions>
      </Fieldset>
    </Form>
  );
}

function SliderDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Slider defaultValue={60} step={5}>
        <Label>Probabilidad de cierre</Label>
        <Slider.Output>{({ state }) => `${state.values[0]} %`}</Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <Slider defaultValue={[500, 2500]} minValue={0} maxValue={5000} step={100} formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}>
        <Label>Presupuesto</Label>
        <Slider.Output />
        <Slider.Track>
          {({ state }) => (
            <>
              <Slider.Fill />
              {state.values.map((_, i) => (
                <Slider.Thumb key={i} index={i} />
              ))}
            </>
          )}
        </Slider.Track>
      </Slider>
      <Slider defaultValue={2} minValue={0} maxValue={4} step={1}>
        <Label>Etapa</Label>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Steps />
          <Slider.Thumb />
        </Slider.Track>
        <Slider.Marks>
          <Slider.Mark value={0}>Arranque</Slider.Mark>
          <Slider.Mark value={2}>Revisión</Slider.Mark>
          <Slider.Mark value={4}>Entregado</Slider.Mark>
        </Slider.Marks>
      </Slider>
    </div>
  );
}

// Como en la documentación de HeroUI: el riel dentro de Switch.Content, junto al
// texto; la descripción fuera, debajo (ver kit/SwitchField.jsx).
const Toggle = ({ children, desc, ...props }) => (
  <Switch {...props}>
    <Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      {children}
    </Switch.Content>
    {desc && <Description>{desc}</Description>}
  </Switch>
);

function SwitchDemo() {
  return (
    <div className="flex flex-col gap-4">
      <Toggle defaultSelected desc="Vibra al tocar, en Android y en el iPhone.">
        Vibración
      </Toggle>
      <Toggle size="sm">Sonidos</Toggle>
      <SwitchGroup>
        <Label>Lo que ve el cliente</Label>
        <Toggle defaultSelected>Cronología</Toggle>
        <Toggle defaultSelected>Calendario</Toggle>
        <Toggle>Leads</Toggle>
      </SwitchGroup>
    </div>
  );
}

function ColorSwatchDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {['#00b8d4', '#387aff', '#34c759', '#ff9800', '#ff3b30', '#8e5bd6'].map((c, i) => (
        <ColorSwatch key={c} aria-label={c} color={c} size={['xs', 'sm', 'md', 'lg', 'xl', 'md'][i]} />
      ))}
    </div>
  );
}

function ColorSwatchPickerDemo() {
  const [color, setColor] = useState(parseColor('#00b8d4'));
  return (
    <div className="flex flex-col gap-3">
      <Label>Color principal del portal</Label>
      <ColorSwatchPicker value={color} onChange={setColor}>
        {BRAND_COLORS.map((c) => (
          <ColorSwatchPicker.Item key={c} color={c}>
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker>
      <p className="text-sm text-muted">Elegido: {color.toString('hex')}</p>
    </div>
  );
}

function ColorFieldDemo() {
  const [color, setColor] = useState(parseColor('#00B8D4'));
  return (
    <ColorField className="w-full max-w-xs" value={color} onChange={setColor}>
      <Label>Color secundario</Label>
      <ColorField.Group>
        <ColorField.Prefix>
          <ColorSwatch color={color ?? undefined} size="xs" />
        </ColorField.Prefix>
        <ColorField.Input />
      </ColorField.Group>
    </ColorField>
  );
}

function ColorAreaDemo() {
  return (
    <ColorArea aria-label="Saturación y brillo" defaultValue="hsb(188, 100%, 83%)" colorSpace="hsb" xChannel="saturation" yChannel="brightness" className="max-w-xs">
      <ColorArea.Thumb />
    </ColorArea>
  );
}

function ColorSliderDemo() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <ColorSlider channel="hue" colorSpace="hsl" defaultValue="hsl(188, 100%, 42%)">
        <Label>Tono</Label>
        <ColorSlider.Output />
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <ColorSlider channel="alpha" defaultValue="rgba(0, 184, 212, 0.7)">
        <Label>Opacidad</Label>
        <ColorSlider.Output />
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
    </div>
  );
}

function ColorPickerDemo() {
  return (
    <ColorPicker defaultValue="#00B8D4">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Color de la marca</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover>
        <ColorArea aria-label="Color" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
          <Label>Tono</Label>
          <ColorSlider.Output className="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}

const CalendarParts = ({ C, yearPicker = false }) => (
  <>
    <C.Header>
      {yearPicker ? (
        <C.YearPickerTrigger>
          <C.YearPickerTriggerHeading />
          <C.YearPickerTriggerIndicator />
        </C.YearPickerTrigger>
      ) : (
        <C.Heading />
      )}
      <C.NavButton slot="previous" />
      <C.NavButton slot="next" />
    </C.Header>
    <C.Grid>
      <C.GridHeader>{(day) => <C.HeaderCell>{day}</C.HeaderCell>}</C.GridHeader>
      <C.GridBody>{(date) => <C.Cell date={date} />}</C.GridBody>
    </C.Grid>
    {yearPicker && (
      <C.YearPickerGrid>
        <C.YearPickerGridBody>{({ year }) => <C.YearPickerCell year={year} />}</C.YearPickerGridBody>
      </C.YearPickerGrid>
    )}
  </>
);

function CalendarDemo() {
  return (
    <Calendar aria-label="Fecha de la reunión" defaultValue={today(getLocalTimeZone())}>
      <CalendarParts C={Calendar} />
    </Calendar>
  );
}

function RangeCalendarDemo() {
  const now = today(getLocalTimeZone());
  return (
    <RangeCalendar aria-label="Duración de la campaña" defaultValue={{ start: now, end: now.add({ days: 9 }) }}>
      <CalendarParts C={RangeCalendar} />
    </RangeCalendar>
  );
}

const Segments = ({ slot }) => <DateField.Input slot={slot}>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>;

function DateFieldDemo() {
  return (
    <DateField className="w-full max-w-xs" defaultValue={today(getLocalTimeZone())} name="date">
      <Label>Fecha de emisión</Label>
      <DateField.Group>
        <Segments />
      </DateField.Group>
    </DateField>
  );
}

function DatePickerDemo() {
  return (
    <DatePicker className="w-full max-w-xs" name="due" defaultValue={today(getLocalTimeZone()).add({ days: 15 })}>
      <Label>Vence</Label>
      <DateField.Group fullWidth>
        <Segments />
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <Description>Quince días después de emitirla.</Description>
      <DatePicker.Popover>
        <Calendar aria-label="Vence">
          <CalendarParts C={Calendar} yearPicker />
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

function DateRangePickerDemo() {
  return (
    <DateRangePicker className="w-full max-w-sm" startName="from" endName="to">
      <Label>Periodo del informe</Label>
      <DateField.Group fullWidth>
        <Segments slot="start" />
        <DateRangePicker.RangeSeparator />
        <Segments slot="end" />
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        <RangeCalendar aria-label="Periodo del informe">
          <CalendarParts C={RangeCalendar} yearPicker />
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

function TimeFieldDemo() {
  return (
    <TimeField className="w-full max-w-xs" name="time">
      <Label>Hora de la publicación</Label>
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      </TimeField.Group>
    </TimeField>
  );
}

export const FORMULARIOS = [
  {
    id: 'formularios',
    title: 'Formularios',
    items: [
      { name: 'Form + Fieldset', doc: 'form', also: ['Fieldset', 'FieldGroup'], desc: 'Formulario con validación, grupo de campos y acciones.', render: FormDemo },
      { name: 'TextField', doc: 'text-field', desc: 'Campo con etiqueta, ayuda y error.', render: TextFieldDemo },
      { name: 'Input', doc: 'input', desc: 'La caja de texto sola, en sus dos variantes.', render: InputDemo },
      { name: 'TextArea', doc: 'text-area', desc: 'Texto de varias líneas.', render: TextAreaDemo },
      { name: 'InputGroup', doc: 'input-group', desc: 'Con icono delante o un botón detrás.', render: InputGroupDemo },
      { name: 'InputOTP', doc: 'input-otp', desc: 'Códigos de un solo uso.', render: InputOTPDemo },
      { name: 'NumberField', doc: 'number-field', desc: 'Importes con moneda y tasas.', render: NumberFieldDemo },
      { name: 'SearchField', doc: 'search-field', desc: 'Buscador con botón para limpiar.', render: SearchFieldDemo },
      { name: 'Checkbox', doc: 'checkbox', desc: 'Marcado, a medias y bloqueado.', render: CheckboxDemo },
      { name: 'CheckboxGroup', doc: 'checkbox-group', desc: 'Varias casillas con un título.', render: CheckboxGroupDemo },
      { name: 'RadioGroup', doc: 'radio-group', desc: 'Una sola opción entre varias.', render: RadioDemo },
      { name: 'Label + Description', doc: 'label', also: ['Description'], desc: 'Las piezas compartidas de cada campo.', render: LabelDescriptionDemo },
      { name: 'FieldError + ErrorMessage', doc: 'error-message', also: ['FieldError'], desc: 'Errores de campos y de colecciones.', render: ErrorMessageDemo },
    ],
  },
  {
    id: 'controles',
    title: 'Controles',
    items: [
      { name: 'Slider', doc: 'slider', desc: 'Un valor, un rango o pasos con marcas.', render: SliderDemo },
      { name: 'Switch', doc: 'switch', also: ['SwitchGroup'], desc: 'Interruptores sueltos o en grupo.', render: SwitchDemo },
    ],
  },
  {
    id: 'colores',
    title: 'Colores',
    items: [
      { name: 'ColorSwatch', doc: 'color-swatch', desc: 'Muestras de color en cinco tamaños.', render: ColorSwatchDemo },
      { name: 'ColorSwatchPicker', doc: 'color-swatch-picker', desc: 'Los colores de marca del portal.', render: ColorSwatchPickerDemo },
      { name: 'ColorField', doc: 'color-field', desc: 'Escribir un color en hexadecimal.', render: ColorFieldDemo },
      { name: 'ColorSlider', doc: 'color-slider', desc: 'Tono y opacidad.', render: ColorSliderDemo },
      { name: 'ColorArea', doc: 'color-area', desc: 'Saturación y brillo en dos ejes.', render: ColorAreaDemo },
      { name: 'ColorPicker', doc: 'color-picker', desc: 'Todo junto en un desplegable.', render: ColorPickerDemo },
    ],
  },
  {
    id: 'fechas',
    title: 'Fechas y horas',
    items: [
      { name: 'Calendar', doc: 'calendar', desc: 'Un mes para elegir un día.', render: CalendarDemo },
      { name: 'RangeCalendar', doc: 'range-calendar', desc: 'Un tramo de días.', render: RangeCalendarDemo },
      { name: 'DateField', doc: 'date-field', desc: 'Fecha escrita por partes.', render: DateFieldDemo },
      { name: 'DatePicker', doc: 'date-picker', desc: 'Fecha con calendario y selector de año.', render: DatePickerDemo },
      { name: 'DateRangePicker', doc: 'date-range-picker', desc: 'Desde y hasta, con calendario.', render: DateRangePickerDemo },
      { name: 'TimeField', doc: 'time-field', desc: 'Una hora.', render: TimeFieldDemo },
    ],
  },
];
