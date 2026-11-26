// Pestaña «Contenido» del editor: cliente y proyecto, fechas, líneas, ajustes del
// total, forma de cobro, nota y secciones del pie. Cada cambio escribe en el
// documento (como en el editor de siempre) y la hoja de al lado se repinta.
import { useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, Box, ChevronDown, Copy, EllipsisVertical, Picture as Image, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, ButtonGroup, Chip, Description, Disclosure, Dropdown, Label, Link, Separator, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import {
  CURRENCIES,
  CURRENCY_CODES,
  find,
  methodLabel,
  money,
  put,
  round2,
  snapshotCustomer,
  snapshotPayment,
  state,
  strongest,
  totals,
  uid,
  unitName,
} from '../../../negocio-core.js';
import { AmountField, DateInput, SelectField, currencyOptions } from '../fields.jsx';
import { CustomerForm } from '../screens/Clientes.jsx';
import { ServiceForm } from '../screens/Catalogo.jsx';
import { Block, Txt, pickImage } from './shared.jsx';

export const SECTION_TITLES = ['Términos y condiciones', 'Garantía', 'Información legal', 'Política de devoluciones', 'Confidencialidad'];
export const RATE_SOURCES = ['BCV', 'Paralelo', 'Binance P2P', 'Acordada'];
const isSignable = (doc) => doc.type === 'quote' || doc.type === 'proposal';

/** Cambiar de moneda: la equivalencia a esa misma moneda deja de tener sentido. */
export function changeCurrency(doc, code) {
  doc.currency = code;
  if (doc.equiv?.currency === code) doc.equiv = null;
}

/** El cliente del documento: se copian sus datos (y su moneda, si aún no hay precios). */
export function setCustomer(doc, c) {
  doc.customerId = c.id;
  doc.customer = snapshotCustomer(c);
  const untouched = (doc.items || []).every((i) => !i.price);
  if (untouched && c.currency && c.currency !== doc.currency) changeCurrency(doc, c.currency);
}

/** Guarda una sección en la biblioteca de Ajustes (o la actualiza si ya estaba). */
export function saveSection(s) {
  const library = [...(state.settings.sections || [])];
  const at = library.findIndex((x) => (s.libId && x.id === s.libId) || (x.title && x.title === s.title));
  const entry = { id: at >= 0 ? library[at].id : uid(), title: (s.title || '').trim() || 'Sin título', body: s.body || '' };
  if (at >= 0) library[at] = entry;
  else library.push(entry);
  s.libId = entry.id;
  put('settings', { ...state.settings, sections: library });
  toast.success(at >= 0 ? 'Actualizada en la biblioteca' : 'Guardada en la biblioteca: ya la puedes añadir a cualquier documento');
}

function MoreMenu({ label, items, onAction }) {
  return (
    <Dropdown>
      <Button isIconOnly size="sm" variant="ghost" aria-label={label}>
        <EllipsisVertical className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu aria-label={label} onAction={(k) => onAction(String(k))} disabledKeys={items.filter((i) => i.isDisabled).map((i) => i.id)}>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Dropdown.Item key={it.id} id={it.id} textValue={it.label} variant={it.danger ? 'danger' : undefined}>
                {Icon && <Icon className="size-4 shrink-0" />}
                <Label>{it.label}</Label>
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/* ── Cliente, proyecto y moneda ─────────────────────────────────────────── */

function Parties({ doc, change }) {
  const [creating, setCreating] = useState(false);
  const customers = [...state.customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const projects = state.projects.filter((p) => !doc.customerId || p.customerId === doc.customerId || p.id === doc.projectId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const paid = (doc.payments || []).length > 0;
  const c = doc.customer;
  const f = doc.from;
  const pickCustomer = (cust) => change(() => setCustomer(doc, cust));

  return (
    <Block title={doc.type === 'receipt' ? 'Recibido de' : isSignable(doc) ? 'Para quién' : 'Facturar a'}>
      {doc.type !== 'receipt' && (
        <>
          <SelectField
            label="Cliente"
            value={doc.customerId || '_none'}
            onChange={(k) => {
              if (k === '_new') return setCreating(true);
              if (k === '_none') return change(() => { doc.customerId = ''; });
              const cust = find('customers', k);
              return cust && pickCustomer(cust);
            }}
            options={[['_none', 'Escrito a mano', 'Sin ficha de cliente'], ...customers.map((x) => [x.id, x.name || 'Sin nombre', x.company || x.email || '']), ['_new', '+ Nuevo cliente', 'Se guarda en Clientes']]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {(state.projects.length > 0 || doc.projectId) && (
              <SelectField
                label="Proyecto"
                value={doc.projectId || '_none'}
                onChange={(k) =>
                  change(() => {
                    doc.projectId = k === '_none' ? '' : k;
                    const p = k !== '_none' && find('projects', k);
                    const cust = p && !doc.customerId && p.customerId && find('customers', p.customerId);
                    if (cust) setCustomer(doc, cust);
                  })
                }
                options={[['_none', 'Sin proyecto'], ...projects.map((p) => [p.id, p.name || 'Sin nombre', find('customers', p.customerId)?.name || ''])]}
              />
            )}
            <SelectField
              label="Moneda"
              value={doc.currency}
              isDisabled={paid}
              description={paid ? 'Tiene pagos: la moneda ya no cambia. Para otra moneda, duplícala.' : undefined}
              onChange={(k) => change(() => changeCurrency(doc, k))}
              options={currencyOptions(CURRENCIES).filter(([k]) => CURRENCY_CODES.includes(k))}
            />
          </div>
        </>
      )}
      <Disclosure>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex items-center gap-1 text-sm font-medium">
            Datos del cliente en la hoja
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="grid gap-3 pt-3 sm:grid-cols-2" key={doc.customerId || 'manual'}>
            <Txt label="Nombre" value={c.name} onChange={(v) => change(() => { c.name = v; })} placeholder="Nombre del cliente" />
            <Txt label="Empresa" value={c.company} onChange={(v) => change(() => { c.company = v; })} />
            <Txt label="RIF, cédula o NIF" value={c.taxId} onChange={(v) => change(() => { c.taxId = v; })} />
            <Txt label="Correo" value={c.email} onChange={(v) => change(() => { c.email = v; })} />
            <Txt label="Teléfono" value={c.phone} onChange={(v) => change(() => { c.phone = v; })} />
            <Txt label="Dirección" value={c.address} onChange={(v) => change(() => { c.address = v; })} area rows={2} className="sm:col-span-2" />
            <p className="text-xs text-muted sm:col-span-2">Cambiar estos datos no toca la ficha del cliente: solo este documento.</p>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      <Disclosure>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex items-center gap-1 text-sm font-medium">
            Tus datos (de)
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="grid gap-3 pt-3 sm:grid-cols-2">
            <Txt label="Nombre o empresa" value={f.name} onChange={(v) => change(() => { f.name = v; })} />
            <Txt label="RIF o cédula" value={f.taxId} onChange={(v) => change(() => { f.taxId = v; })} />
            <Txt label="Correo" value={f.email} onChange={(v) => change(() => { f.email = v; })} />
            <Txt label="Teléfono" value={f.phone} onChange={(v) => change(() => { f.phone = v; })} />
            <Txt label="Web" value={f.website} onChange={(v) => change(() => { f.website = v; })} />
            <Txt label="Firma" value={f.signature} onChange={(v) => change(() => { f.signature = v; })} placeholder={f.name} />
            <Txt label="Dirección" value={f.address} onChange={(v) => change(() => { f.address = v; })} area rows={2} className="sm:col-span-2" />
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      {creating && <CustomerForm isOpen onOpenChange={setCreating} onSaved={(cust) => pickCustomer(cust)} />}
    </Block>
  );
}

/* ── Fechas ──────────────────────────────────────────────────────────────── */

function Dates({ doc, change }) {
  return (
    <Block title="Fechas" hint={doc.number ? `Número ${doc.number}` : 'Se numera solo al guardarse.'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateInput label={doc.type === 'receipt' ? 'Fecha del pago' : 'Emisión'} value={doc.issueDate} onChange={(d) => change(() => { doc.issueDate = d; })} />
        {doc.type === 'invoice' && <DateInput label="Vence" value={doc.dueDate} onChange={(d) => change(() => { doc.dueDate = d; })} />}
        {isSignable(doc) && <DateInput label="Válida hasta" value={doc.validUntil} onChange={(d) => change(() => { doc.validUntil = d; })} />}
        {doc.type === 'receipt' && doc.invoiceNumber && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Factura</span>
            <span className="text-sm text-muted">{doc.invoiceNumber}</span>
          </div>
        )}
      </div>
    </Block>
  );
}

/* ── Líneas ──────────────────────────────────────────────────────────────── */

function Lines({ doc, change }) {
  const [saving, setSaving] = useState(null); // línea para guardar en el catálogo
  const [newService, setNewService] = useState(false);
  const cur = doc.currency;

  if (doc.type === 'receipt') {
    return (
      <Block title="Concepto">
        {doc.items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
            <Txt ariaLabel="Concepto" value={item.name} onChange={(v) => change(() => { item.name = v; })} />
            <Txt ariaLabel="Referencia" value={item.description} onChange={(v) => change(() => { item.description = v; })} placeholder="Referencia (opcional)" />
            <span className="text-end text-sm font-medium tabular-nums">{money(item.price, cur)}</span>
          </div>
        ))}
      </Block>
    );
  }

  const addItem = (from) =>
    change(() => {
      const item = { id: uid(), name: from?.name || '', description: from?.description || '', qty: 1, price: from?.price || 0, image: from?.image || '' };
      // Si la única línea está vacía, el servicio del catálogo ocupa su lugar.
      const blank = doc.items.length === 1 && !doc.items[0].name && !doc.items[0].price;
      if (from && blank) doc.items = [item];
      else doc.items.push(item);
      if (from?.currency && from.currency !== doc.currency) toast.warning(`Ese precio está en ${from.currency} y el documento en ${doc.currency}. Revísalo.`);
    });

  const lineAction = (id, item, i) => {
    const move = (to) =>
      change(() => {
        doc.items.splice(i, 1);
        doc.items.splice(to, 0, item);
      });
    if (id === 'image') pickImage((url) => change(() => { item.image = url; }));
    if (id === 'noimage') change(() => { item.image = ''; });
    if (id === 'dup') change(() => doc.items.splice(i + 1, 0, { ...structuredClone(item), id: uid() }));
    if (id === 'up') move(i - 1);
    if (id === 'down') move(i + 1);
    if (id === 'catalog') setSaving(item);
    if (id === 'remove') change(() => { doc.items = doc.items.filter((x) => x !== item); });
  };

  return (
    <Block
      title="Líneas"
      hint={`${doc.items.length} ${doc.items.length === 1 ? 'línea' : 'líneas'}`}
      action={
        <ButtonGroup size="sm" variant="secondary">
          <Button onPress={() => addItem()}>
            <Plus />
            Línea
          </Button>
          <Dropdown>
            <Button size="sm" variant="secondary">
              <ButtonGroup.Separator />
              <Box />
              Del catálogo
              <ChevronDown className="size-3.5" />
            </Button>
            <Dropdown.Popover placement="bottom end" className="max-h-80 min-w-64">
              <Dropdown.Menu
                aria-label="Servicios del catálogo"
                onAction={(k) => {
                  if (k === '_new') return setNewService(true);
                  const it = find('catalog', String(k));
                  return it && addItem(it);
                }}
              >
                {[
                  ...state.catalog.map((it) => (
                    <Dropdown.Item key={it.id} id={it.id} textValue={it.name}>
                      <div className="flex min-w-0 flex-col">
                        <Label>{it.name}</Label>
                        <span className="truncate text-xs text-muted">{[money(it.price, it.currency), it.description].filter(Boolean).join(' · ')}</span>
                      </div>
                    </Dropdown.Item>
                  )),
                  <Dropdown.Item key="_new" id="_new" textValue="Nuevo servicio">
                    <Plus className="size-4" />
                    <Label>Nuevo servicio</Label>
                  </Dropdown.Item>,
                ]}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>
      }
    >
      {doc.items.map((item, i) => (
        <div key={item.id} className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
          <div className="flex items-start gap-2">
            {item.image && <img src={item.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />}
            <Txt ariaLabel="Concepto" value={item.name} onChange={(v) => change(() => { item.name = v; })} placeholder="Concepto" className="min-w-0 flex-1" maxLength={300} />
            <MoreMenu
              label="Opciones de la línea"
              onAction={(k) => lineAction(k, item, i)}
              items={[
                { id: 'image', label: item.image ? 'Cambiar la imagen' : 'Poner una imagen', icon: Image },
                ...(item.image ? [{ id: 'noimage', label: 'Quitar la imagen', icon: Xmark }] : []),
                { id: 'dup', label: 'Duplicar línea', icon: Copy },
                { id: 'up', label: 'Subir', icon: ArrowUp, isDisabled: i === 0 },
                { id: 'down', label: 'Bajar', icon: ArrowDown, isDisabled: i === doc.items.length - 1 },
                { id: 'catalog', label: 'Guardar en el catálogo', icon: Box, isDisabled: !item.name?.trim() },
                { id: 'remove', label: 'Quitar línea', icon: TrashBin, danger: true },
              ]}
            />
          </div>
          <Txt ariaLabel="Detalle" value={item.description} onChange={(v) => change(() => { item.description = v; })} placeholder="Detalle (opcional)" area rows={2} />
          <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_auto] items-end gap-2">
            <AmountField label="Cant." value={item.qty} step={1} onChange={(n) => change(() => { item.qty = n; })} />
            <AmountField label={`Precio (${cur})`} value={item.price} onChange={(n) => change(() => { item.price = n; })} />
            <span className="pb-2.5 text-end text-sm font-medium tabular-nums">{money((Number(item.qty) || 0) * (Number(item.price) || 0), cur)}</span>
          </div>
        </div>
      ))}
      {saving && (
        <ServiceForm
          prefill={{ name: saving.name, description: saving.description, price: saving.price, currency: doc.currency, image: saving.image || '' }}
          onClose={() => setSaving(null)}
        />
      )}
      {newService && <ServiceForm onClose={() => setNewService(false)} onSaved={(it) => addItem(it)} />}
    </Block>
  );
}

/* ── Ajustes del total ───────────────────────────────────────────────────── */

function AdjRow({ title, onRemove, children }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${title.toLowerCase()}`} onPress={onRemove}>
          <Xmark className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function Totals({ doc, change }) {
  const cur = doc.currency;
  const sign = CURRENCIES[cur]?.sign || cur;
  const t = totals(doc);
  const e = doc.equiv;
  const strong = e ? strongest(cur, e.currency) : cur;
  const weak = e ? (strong === cur ? e.currency : cur) : cur;
  const equivValue = e && e.rate > 0 ? round2(strong === cur ? t.total * e.rate : t.total / e.rate) : null;
  const chips = [
    !doc.discount && ['Descuento', () => { doc.discount = { type: 'percent', value: 10 }; }],
    !doc.tax && ['Impuesto', () => { doc.tax = { label: 'IVA', rate: 16 }; }],
    !doc.withholding && ['Retención', () => { doc.withholding = { rate: 75, on: 'tax' }; }],
    !doc.shipping && ['Otro cargo', () => { doc.shipping = { label: 'Envío', amount: 0 }; }],
    !doc.equiv && ['Equivalencia', () => { doc.equiv = { currency: cur === 'VES' ? 'USD' : 'VES', rate: 0, source: 'BCV' }; }],
  ].filter(Boolean);
  const row = (label, value, cls = '') => (
    <div className={`flex items-center justify-between gap-3 ${cls}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <Block title="Total">
      {doc.type !== 'receipt' && (
        <>
          {doc.discount && (
            <AdjRow title="Descuento" onRemove={() => change(() => { doc.discount = null; })}>
              <div className="flex items-end gap-2">
                <AmountField ariaLabel="Descuento" value={doc.discount.value} onChange={(n) => change(() => { doc.discount.value = n; })} className="flex-1" />
                <ToggleButtonGroup
                  aria-label="Descuento en porcentaje o importe"
                  size="sm"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([doc.discount.type === 'amount' ? 'amount' : 'percent'])}
                  onSelectionChange={(keys) => change(() => { doc.discount.type = [...keys][0]; })}
                >
                  <ToggleButton id="percent">%</ToggleButton>
                  <ToggleButton id="amount">
                    <ToggleButtonGroup.Separator />
                    {sign}
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </AdjRow>
          )}
          {doc.tax && (
            <AdjRow title="Impuesto" onRemove={() => change(() => { doc.tax = null; })}>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-2">
                <Txt label="Nombre" value={doc.tax.label} onChange={(v) => change(() => { doc.tax.label = v; })} />
                <AmountField label="%" value={doc.tax.rate} step={1} onChange={(n) => change(() => { doc.tax.rate = n; })} />
              </div>
            </AdjRow>
          )}
          {doc.withholding && (
            <AdjRow title="Retención" onRemove={() => change(() => { doc.withholding = null; })}>
              <div className="flex items-end gap-2">
                <AmountField label="%" value={doc.withholding.rate} step={1} onChange={(n) => change(() => { doc.withholding.rate = n; })} className="w-28" />
                <ToggleButtonGroup
                  aria-label="Calcular la retención sobre"
                  size="sm"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([doc.withholding.on === 'base' ? 'base' : 'tax'])}
                  onSelectionChange={(keys) => change(() => { doc.withholding.on = [...keys][0]; })}
                >
                  <ToggleButton id="tax">del impuesto</ToggleButton>
                  <ToggleButton id="base">
                    <ToggleButtonGroup.Separator />
                    de la base
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </AdjRow>
          )}
          {doc.shipping && (
            <AdjRow title="Otro cargo" onRemove={() => change(() => { doc.shipping = null; })}>
              <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-2">
                <Txt label="Concepto" value={doc.shipping.label} onChange={(v) => change(() => { doc.shipping.label = v; })} />
                <AmountField label={`Importe (${cur})`} value={doc.shipping.amount} onChange={(n) => change(() => { doc.shipping.amount = n; })} />
              </div>
            </AdjRow>
          )}
          {e && (
            <AdjRow title="Equivalencia" onRemove={() => change(() => { doc.equiv = null; })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectField label="Equivale a" value={e.currency} onChange={(k) => change(() => { e.currency = k; })} options={CURRENCY_CODES.filter((k) => k !== cur).map((k) => [k, k])} />
                <SelectField label="Fuente de la tasa" value={e.source} onChange={(k) => change(() => { e.source = k; })} options={RATE_SOURCES.map((s) => [s, s])} />
                <AmountField
                  label={`1 ${unitName(strong)} = … ${unitName(weak)}`}
                  value={e.rate}
                  onChange={(n) => change(() => { e.rate = n; e.date = doc.issueDate; })}
                  className="sm:col-span-2"
                />
              </div>
              <p className="text-xs text-muted">{equivValue == null ? 'Falta la tasa.' : `El total equivale a ${money(equivValue, e.currency)}.`}</p>
            </AdjRow>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map(([text, run]) => (
                <Button key={text} size="sm" variant="tertiary" className="border border-dashed border-border" onPress={() => change(run)}>
                  <Plus className="size-3.5" />
                  {text}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      <dl className="flex flex-col gap-1.5 rounded-2xl border border-separator p-3 text-sm">
        {doc.type !== 'receipt' && row('Subtotal', money(t.subtotal, cur), 'text-muted')}
        {t.discount > 0 && row('Descuento', money(-t.discount, cur), 'text-muted')}
        {doc.tax && row(doc.tax.label || 'Impuesto', money(t.tax, cur), 'text-muted')}
        {t.withholding > 0 && row('Retención', money(-t.withholding, cur), 'text-muted')}
        {doc.shipping && row(doc.shipping.label || 'Otro cargo', money(t.shipping, cur), 'text-muted')}
        <Separator className="my-1" />
        {row(doc.type === 'receipt' ? 'Total recibido' : 'Total', money(t.total, cur), 'text-base font-semibold')}
        {equivValue != null && row(`Equivale a`, money(equivValue, e.currency), 'text-muted')}
        {doc.type === 'invoice' && (doc.payments || []).length > 0 && (
          <>
            {row('Pagado', money(-t.paid, cur), 'text-muted')}
            {row('Saldo pendiente', money(t.due, cur), t.due > 0.004 ? 'font-medium' : 'text-success')}
          </>
        )}
      </dl>
    </Block>
  );
}

/* ── Forma de cobro ──────────────────────────────────────────────────────── */

function Payment({ doc, change }) {
  if (doc.type === 'receipt') {
    return (
      <Block title="Pago">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-3 text-sm">
          <span>
            Forma de pago: <b>{doc.method || 'Sin indicar'}</b>
          </span>
          {doc.balanceAfter != null && <span className="text-muted">Saldo pendiente de la factura: {money(doc.balanceAfter, doc.currency)}</span>}
        </div>
      </Block>
    );
  }
  const p = doc.payment;
  const known = p?.templateId && state.paytemplates.some((x) => x.id === p.templateId);
  return (
    <Block title="Datos de pago" hint="Salen en la hoja, con su código QR si tienen enlace." action={<Link href="#/formas-de-cobro" className="text-xs">Formas de cobro</Link>}>
      <SelectField
        ariaLabel="Forma de cobro"
        value={p ? (known ? p.templateId : '_custom') : '_none'}
        onChange={(k) =>
          change(() => {
            if (k === '_none') doc.payment = null;
            else if (k !== '_custom') doc.payment = snapshotPayment(find('paytemplates', k));
          })
        }
        options={[
          ['_none', 'Sin datos de pago'],
          ...state.paytemplates.map((x) => [x.id, x.name || methodLabel(x.method), methodLabel(x.method)]),
          ...(p && !known ? [['_custom', p.name || methodLabel(p.method), 'Solo en este documento']] : []),
        ]}
      />
      {p && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3" key={p.templateId || 'custom'}>
          <Txt label="Nombre" value={p.name} onChange={(v) => change(() => { p.name = v; })} placeholder={methodLabel(p.method)} />
          {(p.fields || []).map((fl, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
              <Txt ariaLabel="Dato" value={fl.label} onChange={(v) => change(() => { fl.label = v; })} />
              <Txt ariaLabel={fl.label || 'Valor'} value={fl.value} onChange={(v) => change(() => { fl.value = v; })} />
            </div>
          ))}
          <Txt label="Enlace de pago" value={p.link} onChange={(v) => change(() => { p.link = v; })} placeholder="https://… (opcional)" />
        </div>
      )}
    </Block>
  );
}

/* ── Nota y secciones del pie ────────────────────────────────────────────── */

function Sections({ doc, change }) {
  const library = state.settings.sections || [];
  const used = new Set(doc.sections.map((s) => s.title));
  const add = (t) =>
    change(() => {
      const saved = library.find((x) => x.title === t);
      const body = saved ? saved.body : t === 'Términos y condiciones' ? state.settings.terms || '' : '';
      doc.sections.push({ id: uid(), title: t === 'Otra sección' ? '' : t, body, libId: saved?.id || '' });
    });
  return (
    <Block title="Secciones del pie" hint="Términos, garantía… Las guardadas en la biblioteca sirven para cualquier documento.">
      {doc.sections.map((s, i) => (
        <div key={s.id || i} className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
          <div className="flex items-start gap-2">
            <Txt ariaLabel="Título de la sección" value={s.title} onChange={(v) => change(() => { s.title = v; })} placeholder="Título" className="min-w-0 flex-1" />
            <MoreMenu
              label="Opciones de la sección"
              onAction={(k) => {
                const move = (to) =>
                  change(() => {
                    doc.sections.splice(i, 1);
                    doc.sections.splice(to, 0, s);
                  });
                if (k === 'up') move(i - 1);
                if (k === 'down') move(i + 1);
                if (k === 'save') change(() => saveSection(s));
                if (k === 'remove') change(() => { doc.sections = doc.sections.filter((x) => x !== s); });
              }}
              items={[
                { id: 'up', label: 'Subir', icon: ArrowUp, isDisabled: i === 0 },
                { id: 'down', label: 'Bajar', icon: ArrowDown, isDisabled: i === doc.sections.length - 1 },
                { id: 'save', label: 'Guardar en la biblioteca', icon: Bookmark, isDisabled: !`${s.title || ''}${s.body || ''}`.trim() },
                { id: 'remove', label: 'Quitar sección', icon: TrashBin, danger: true },
              ]}
            />
          </div>
          <Txt ariaLabel={s.title || 'Texto de la sección'} value={s.body} onChange={(v) => change(() => { s.body = v; })} area rows={4} placeholder="Escribe aquí…" maxLength={8000} />
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {library.length > 0 && (
          <Dropdown>
            <Button size="sm" variant="secondary">
              <Bookmark className="size-3.5" />
              De la biblioteca
              <ChevronDown className="size-3.5" />
            </Button>
            <Dropdown.Popover className="max-h-80 min-w-64">
              <Dropdown.Menu
                aria-label="Secciones guardadas"
                onAction={(k) =>
                  change(() => {
                    const x = library.find((y) => y.id === k);
                    if (x) doc.sections.push({ id: uid(), title: x.title, body: x.body, libId: x.id });
                  })
                }
              >
                {library.map((x) => (
                  <Dropdown.Item key={x.id} id={x.id} textValue={x.title || 'Sin título'}>
                    <div className="flex min-w-0 flex-col">
                      <Label>{x.title || 'Sin título'}</Label>
                      <span className="truncate text-xs text-muted">{(x.body || '').replace(/\s+/g, ' ').slice(0, 80)}</span>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
        {[...SECTION_TITLES.filter((t) => !used.has(t)), 'Otra sección'].map((t) => (
          <Button key={t} size="sm" variant="tertiary" className="border border-dashed border-border" onPress={() => add(t)}>
            <Plus className="size-3.5" />
            {t}
          </Button>
        ))}
      </div>
      <Link href="#/biblioteca" className="text-xs text-muted">
        Ordenar la biblioteca en Ajustes
      </Link>
    </Block>
  );
}

/** Todo el contenido, en el orden de la hoja. `blocks` (propuestas) va entre fechas y líneas. */
export function Contenido({ doc, change, blocks }) {
  return (
    <div className="flex flex-col gap-6">
      <Parties doc={doc} change={change} />
      <Separator />
      <Dates doc={doc} change={change} />
      {blocks && (
        <>
          <Separator />
          {blocks}
        </>
      )}
      <Separator />
      <Lines doc={doc} change={change} />
      <Totals doc={doc} change={change} />
      <Separator />
      <Payment doc={doc} change={change} />
      <Separator />
      <Block title="Nota para el cliente">
        <Txt ariaLabel="Nota para el cliente" value={doc.notes} onChange={(v) => change(() => { doc.notes = v; })} area rows={3} placeholder="Opcional" maxLength={4000} />
      </Block>
      {doc.type !== 'receipt' && (
        <>
          <Separator />
          <Sections doc={doc} change={change} />
        </>
      )}
      {doc.type !== 'receipt' && isSignable(doc) && (
        <Chip size="sm" variant="soft" className="self-start">
          El cliente la acepta y la firma desde su enlace
        </Chip>
      )}
      <Description className="text-xs">Todo se guarda solo mientras escribes.</Description>
    </div>
  );
}
