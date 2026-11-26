// Clientes: la lista con lo facturado y lo que falta por cobrar de cada uno, su
// ficha y el formulario para crear o editar. Editar un cliente no cambia lo ya
// emitido: cada documento guarda su propia copia de sus datos.
import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, Envelope, Globe, Handset, MapPin, Pencil, PersonPlus, Persons, TrashBin } from '@gravity-ui/icons';
import {
  AlertDialog,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  ListBox,
  Modal,
  SearchField,
  Select,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { CURRENCIES, CURRENCY_CODES, find, put, remove, uid } from '../../../negocio-core.js';
import { Empty, PageHeader, Panel, Person, Stat, StatusChip } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { copyText, downloadCsv } from '../../kit/csv.js';
import { DataGrid } from '../../pro/index.js';
import { DOC_STATUS, DOC_WORD, base, customerStats, docStatus, fmt, money, shortDate, totals } from '../domain.js';

const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CustomerForm({ customer, isOpen, onOpenChange, onSaved }) {
  const blank = { id: uid(), name: '', company: '', email: '', phone: '', website: '', taxId: '', address: '', currency: base(), notes: '' };
  const c = customer || blank;
  const [currency, setCurrency] = useState(c.currency || base());
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[560px]">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>{customer ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Heading>
                </Modal.Header>
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    const next = { ...c, currency };
                    for (const k of ['name', 'company', 'email', 'phone', 'website', 'taxId', 'address', 'notes']) next[k] = String(f[k] ?? '').trim();
                    if (!next.name) return;
                    put('customers', next);
                    toast.success(customer ? 'Cliente guardado' : `${next.name} ya está en tus clientes`);
                    onSaved?.(next);
                    close();
                  }}
                >
                  <Modal.Body className="grid gap-4 sm:grid-cols-2">
                    <TextField isRequired name="name" defaultValue={c.name} maxLength={120} autoFocus>
                      <Label>Nombre</Label>
                      <Input placeholder="María Pérez" />
                      <FieldError>Escribe su nombre.</FieldError>
                    </TextField>
                    <TextField name="company" defaultValue={c.company} maxLength={120}>
                      <Label>Empresa</Label>
                      <Input placeholder="Empresa C.A." />
                    </TextField>
                    <TextField name="email" type="email" defaultValue={c.email} maxLength={160}>
                      <Label>Correo</Label>
                      <Input />
                      <FieldError />
                    </TextField>
                    <TextField name="phone" type="tel" defaultValue={c.phone} maxLength={60}>
                      <Label>Teléfono</Label>
                      <Input />
                    </TextField>
                    <TextField name="website" defaultValue={c.website} maxLength={160}>
                      <Label>Web</Label>
                      <Input placeholder="empresa.com" />
                    </TextField>
                    <TextField name="taxId" defaultValue={c.taxId} maxLength={60}>
                      <Label>RIF, cédula o NIF</Label>
                      <Input placeholder="J-12345678-9" />
                    </TextField>
                    <TextField name="address" defaultValue={c.address} maxLength={400} className="sm:col-span-2">
                      <Label>Dirección</Label>
                      <TextArea rows={2} />
                    </TextField>
                    <Select selectedKey={currency} onSelectionChange={(k) => setCurrency(String(k))} className="sm:col-span-2">
                      <Label>Moneda en la que le facturas</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {CURRENCY_CODES.map((k) => (
                            <ListBox.Item key={k} id={k} textValue={`${k} · ${CURRENCIES[k].label}`}>
                              {k} · {CURRENCIES[k].label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <TextField name="notes" defaultValue={c.notes} maxLength={4000} className="sm:col-span-2">
                      <Label>Notas</Label>
                      <TextArea rows={2} />
                      <Description>Solo las ves tú.</Description>
                    </TextField>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button slot="close" variant="secondary">
                      Cancelar
                    </Button>
                    <Button type="submit">{customer ? 'Guardar' : 'Crear cliente'}</Button>
                  </Modal.Footer>
                </Form>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function Clientes() {
  const [state, v] = useCrm();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => state.customers.map((c) => ({ id: c.id, c, s: customerStats(c.id) })), [state, v]);
  const currencies = [...new Set(state.customers.map((c) => c.currency).filter(Boolean))];

  const exportCsv = (list) =>
    downloadCsv(`clientes-${new Date().toLocaleDateString('en-CA')}`, [
      ['Nombre', 'Empresa', 'Correo', 'Teléfono', 'Identificación fiscal', 'Moneda', 'Facturado', 'Por cobrar', 'Proyectos'],
      ...list.map(({ c, s }) => [c.name, c.company || '', c.email || '', c.phone || '', c.taxId || '', c.currency || '', s.billed, s.due, s.projects.length]),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ventas"
        title="Clientes"
        description="Sus datos se copian en cada documento nuevo."
        actions={
          <Button onPress={() => setCreating(true)}>
            <PersonPlus />
            Nuevo cliente
          </Button>
        }
      />
      {state.customers.length === 0 ? (
        <Empty icon={Persons} title="Todavía no hay clientes" text="Guarda el primero y sus datos se rellenarán solos en cada factura." action={<Button onPress={() => setCreating(true)}>Nuevo cliente</Button>} />
      ) : (
        <DataGrid
          label="Clientes"
          rows={rows}
          search={({ c }, q) => plain(`${c.name} ${c.company} ${c.email} ${c.phone}`).includes(plain(q))}
          searchPlaceholder="Nombre, empresa, correo o teléfono"
          defaultSort={{ column: 'name', direction: 'ascending' }}
          minWidth={640}
          filters={[
            {
              id: 'state',
              label: 'Situación',
              options: [
                ['due', 'Con saldo por cobrar'],
                ['overdue', 'Con facturas vencidas'],
                ['projects', 'Con proyectos'],
                ['none', 'Sin facturas'],
              ],
              match: ({ s }, k) => (k === 'due' ? s.due > 0 : k === 'overdue' ? !!s.overdue : k === 'projects' ? s.projects.length > 0 : !s.billed),
            },
            ...(currencies.length > 1 ? [{ id: 'currency', label: 'Moneda', options: currencies.map((x) => [x, x]), match: ({ c }, x) => c.currency === x }] : []),
          ]}
          columns={[
            {
              id: 'name',
              name: 'Cliente',
              isRowHeader: true,
              sortValue: ({ c }) => plain(c.name),
              render: ({ c }) => (
                <span className="flex items-center gap-3">
                  <Person name={c.name} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted">{c.company || c.email || c.phone || '—'}</span>
                  </span>
                </span>
              ),
            },
            { id: 'email', name: 'Correo', hideable: true, hidden: true, sortValue: ({ c }) => c.email || '', render: ({ c }) => <span className="text-muted">{c.email || '—'}</span> },
            { id: 'phone', name: 'Teléfono', hideable: true, hidden: true, render: ({ c }) => <span className="text-muted">{c.phone || '—'}</span> },
            { id: 'billed', name: 'Facturado', align: 'end', sortValue: ({ s }) => s.billed, render: ({ s }) => fmt(s.billed) },
            {
              id: 'due',
              name: 'Por cobrar',
              align: 'end',
              sortValue: ({ s }) => s.due,
              render: ({ s }) => (s.due > 0 ? <span className={s.overdue ? 'text-danger' : ''}>{fmt(s.due)}</span> : <span className="text-muted">—</span>),
            },
            { id: 'projects', name: 'Proyectos', align: 'end', hideable: true, sortValue: ({ s }) => s.projects.length, render: ({ s }) => s.projects.length || <span className="text-muted">—</span> },
          ]}
          onRowAction={({ c }) => go(`#/clientes/${c.id}`)}
          rowMenu={({ c }) => [
            { id: 'open', label: 'Abrir la ficha', icon: Persons },
            { id: 'edit', label: 'Editar', icon: Pencil },
            { id: 'mail', label: 'Copiar el correo', icon: Envelope, isDisabled: !c.email },
          ]}
          onRowMenu={async (id, { c }) => {
            if (id === 'open') go(`#/clientes/${c.id}`);
            if (id === 'edit') setEditing(c);
            if (id === 'mail' && (await copyText(c.email))) toast('Correo copiado');
          }}
          bulkActions={[
            { id: 'csv', label: 'Exportar CSV', icon: ArrowDownToLine },
            { id: 'mails', label: 'Copiar correos', icon: Envelope },
          ]}
          onBulkAction={async (id, list) => {
            if (id === 'csv') {
              exportCsv(list);
              toast(`${list.length} en el archivo`);
            }
            if (id === 'mails') {
              const mails = list.map(({ c }) => c.email).filter(Boolean);
              if (!mails.length) return toast('Ninguno tiene correo');
              if (await copyText(mails.join(', '))) toast(`${mails.length} correos copiados`);
            }
          }}
        />
      )}
      {creating && <CustomerForm isOpen onOpenChange={setCreating} onSaved={(c) => go(`#/clientes/${c.id}`)} />}
      {editing && <CustomerForm isOpen customer={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </div>
  );
}

export function Cliente({ id }) {
  const [state, v] = useCrm();
  const [editing, setEditing] = useState(false);
  const c = find('customers', id);
  const s = useMemo(() => (c ? customerStats(c.id) : null), [c, v, state]);

  if (!c) {
    return <Empty icon={Persons} title="Ese cliente ya no existe" action={<Button onPress={() => go('#/clientes')}>Ver clientes</Button>} />;
  }
  const docs = [...s.docs].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  const contact = [
    [Envelope, c.email, c.email && `mailto:${c.email}`],
    [Handset, c.phone, c.phone && `tel:${c.phone.replace(/[^\d+]/g, '')}`],
    [Globe, c.website, c.website && `https://${c.website.replace(/^https?:\/\//, '')}`],
    [MapPin, c.address],
  ].filter(([, text]) => text);

  return (
    <div className="flex flex-col gap-6">
      <Link href="#/clientes" className="w-fit text-sm text-muted">
        <ArrowLeft className="size-4" />
        Clientes
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Person name={c.name} size="lg" />
            {c.name}
          </span>
        }
        description={[c.company, c.taxId].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Button variant="secondary" onPress={() => setEditing(true)}>
              <Pencil />
              Editar
            </Button>
            <AlertDialog>
              <Button variant="danger-soft" isIconOnly aria-label="Eliminar cliente">
                <TrashBin />
              </Button>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[420px]">
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="danger" />
                      <AlertDialog.Heading>¿Eliminar a {c.name}?</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p>Sus documentos se quedan como están: cada uno guarda su copia de sus datos.</p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        Cancelar
                      </Button>
                      <Button
                        slot="close"
                        variant="danger"
                        onPress={() => {
                          remove('customers', c.id);
                          toast('Cliente eliminado');
                          go('#/clientes');
                        }}
                      >
                        Eliminar
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Facturado" value={fmt(s.billed)} sub={`${s.docs.filter((d) => d.type === 'invoice').length} facturas`} />
        <Stat label="Cobrado" value={fmt(s.collected)} sub="Cada pago a su tasa del día" />
        <Stat label="Por cobrar" value={fmt(s.due)} tone={s.overdue ? 'var(--danger)' : undefined} sub={s.overdue ? `${s.overdue} vencidas` : 'Al día'} />
        <Stat label="Proyectos" value={String(s.projects.length)} sub={s.projects.filter((p) => p.status === 'active').length ? 'Con alguno activo' : 'Ninguno activo'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Contacto" className="lg:col-span-1">
          {contact.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {contact.map(([Icon, text, href]) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
                  {href ? (
                    <Link href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="break-all">
                      {text}
                    </Link>
                  ) : (
                    <span className="whitespace-pre-line">{text}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin datos de contacto.</p>
          )}
          {c.notes && <p className="mt-4 whitespace-pre-line rounded-2xl bg-surface-secondary p-3 text-sm">{c.notes}</p>}
        </Panel>

        <Panel title="Documentos" description={`${docs.length} en total`} className="lg:col-span-2">
          {docs.length ? (
            <ul className="flex flex-col">
              {docs.map((d) => {
                const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.draft;
                return (
                  <li key={d.id}>
                    <a href={`#/documentos/${d.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {DOC_WORD[d.type]} {d.number || '(borrador)'}
                        </span>
                        <span className="text-xs text-muted">{shortDate(d.issueDate)}</span>
                      </span>
                      <StatusChip label={st[0]} color={st[1]} />
                      <span className="w-28 text-end text-sm tabular-nums">{money(totals(d).total, d.currency)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todavía no tiene documentos.</p>
          )}
        </Panel>
      </div>
      {editing && <CustomerForm customer={c} isOpen onOpenChange={setEditing} />}
    </div>
  );
}
