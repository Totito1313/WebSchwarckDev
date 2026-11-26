// Facturas, cotizaciones y propuestas: la lista con su estado (que sale de los
// pagos, las fechas y lo que hizo el cliente en el enlace) y la ficha de cada una.
// Cobrar, convertir en factura y anular se hacen aquí; el editor de la hoja (líneas,
// diseño y enlace para el cliente) todavía es el de siempre: «Abrir en el editor»
// lleva a él con el mismo documento.
import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpRightFromSquare, ChevronDown, CircleCheck, CircleDollar, Copy, Eye, FileText, Folder, Plus, Xmark } from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Chip, Description, Dropdown, Label, Link, Separator, Table, Tabs, toast } from '@heroui/react';
import { find, newDoc, pubOf, put } from '../../../negocio-core.js';
import { Empty, PageHeader, Panel, Person, Stat, StatusChip } from '../../kit/parts.jsx';
import { copyText, downloadCsv } from '../../kit/csv.js';
import { DataGrid, Timeline } from '../../pro/index.js';
import { ConfirmDialog } from '../fields.jsx';
import { go, useCrm } from '../store.js';
import { PaymentForm, setDocStatus, toInvoice } from '../payments.jsx';
import { DOC_STATUS, DOC_WORD, base, customerName, dateText, docStatus, fmt, money, shortDate, sumBase, totals } from '../domain.js';

const PLURAL = { invoice: 'Facturas', quote: 'Cotizaciones', proposal: 'Propuestas' };
const NEW_WORD = { invoice: 'Nueva factura', quote: 'Nueva cotización', proposal: 'Nueva propuesta' };
const LIST_HASH = { invoice: '#/facturas', quote: '#/cotizaciones', proposal: '#/propuestas' };
const OLD_EDITOR = (id) => `/admin/negocio/#/doc/${id}`;
const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILTERS = {
  invoice: [
    ['all', 'Todas', () => true],
    ['open', 'Por cobrar', (s) => ['pending', 'partial', 'overdue'].includes(s)],
    ['overdue', 'Vencidas', (s) => s === 'overdue'],
    ['paid', 'Pagadas', (s) => s === 'paid'],
    ['draft', 'Borradores', (s) => s === 'draft'],
  ],
  quote: [
    ['all', 'Todas', () => true],
    ['waiting', 'Esperando', (s) => ['sent', 'viewed'].includes(s)],
    ['accepted', 'Aceptadas', (s) => s === 'accepted'],
    ['closed', 'Cerradas', (s) => ['declined', 'expired', 'void'].includes(s)],
    ['draft', 'Borradores', (s) => s === 'draft'],
  ],
};
FILTERS.proposal = FILTERS.quote;

/** Crea el borrador y lo abre en el editor de siempre (las propuestas eligen antes su plantilla allí). */
export async function createAndEdit(type) {
  if (type === 'proposal') {
    location.href = '/admin/negocio/#/propuestas';
    return;
  }
  const doc = newDoc(type);
  try {
    await put('docs', doc, { now: true });
    location.href = OLD_EDITOR(doc.id);
  } catch (err) {
    toast.danger('No se pudo crear', { description: err.message });
  }
}

export function Documentos({ type }) {
  const [state, v] = useCrm();
  const [filter, setFilter] = useState('all');
  const [paying, setPaying] = useState(null);
  const [confirm, setConfirm] = useState(null); // { rows, clear }

  const docs = useMemo(() => state.docs.filter((d) => d.type === type).map((d) => ({ id: d.id, d, s: docStatus(d), t: totals(d) })), [state, v, type]);
  const filters = FILTERS[type];
  const test = filters.find(([k]) => k === filter)?.[2] || (() => true);
  const rows = useMemo(() => docs.filter(({ s }) => test(s)), [docs, filter]);

  const counted = docs.filter(({ d }) => d.status !== 'draft' && d.status !== 'void');
  const total = sumBase(counted.map(({ d, t }) => [d, t.total]));
  const dueSum = type === 'invoice' ? sumBase(counted.filter(({ t }) => t.due > 0.004).map(({ d, t }) => [d, t.due])) : null;
  const isInvoice = type === 'invoice';

  const exportCsv = (list) =>
    downloadCsv(`${PLURAL[type].toLowerCase()}-${new Date().toLocaleDateString('en-CA')}`, [
      ['Número', 'Cliente', 'Fecha', isInvoice ? 'Vence' : 'Válida hasta', 'Moneda', 'Total', 'Pagado', 'Por cobrar', 'Estado'],
      ...list.map(({ d, s, t }) => [d.number || 'Borrador', customerName(d), d.issueDate || '', d.dueDate || d.validUntil || '', d.currency, t.total, t.paid || 0, t.due || 0, (DOC_STATUS[s] || DOC_STATUS.draft)[0]]),
    ]);

  const rowMenu = ({ d, s, t }) => [
    { id: 'open', label: 'Abrir la ficha', icon: FileText },
    { id: 'edit', label: 'Abrir en el editor', icon: ArrowUpRightFromSquare },
    isInvoice && t.due > 0.004 && d.status !== 'void' && { id: 'pay', label: 'Registrar pago', icon: CircleDollar },
    !isInvoice && !['void', 'declined', 'expired', 'accepted'].includes(s) && { id: 'convert', label: 'Convertir en factura', icon: FileText },
    { id: 'number', label: 'Copiar el número', icon: Copy, isDisabled: !d.number },
    '-',
    d.status !== 'void' ? { id: 'void', label: 'Anular', icon: Xmark, danger: true } : { id: 'draft', label: 'Volver a borrador', icon: ArrowLeft },
  ].filter(Boolean);
  const onRowMenu = async (id, { d }) => {
    if (id === 'open') go(`#/documentos/${d.id}`);
    if (id === 'edit') location.href = OLD_EDITOR(d.id);
    if (id === 'pay') setPaying(d);
    if (id === 'convert') go(`#/documentos/${toInvoice(d).id}`);
    if (id === 'number' && (await copyText(d.number))) toast(`${d.number} copiado`);
    if (id === 'void') setConfirm({ rows: [{ d }] });
    if (id === 'draft') {
      setDocStatus(d, 'draft');
      toast('Volvió a borrador.');
    }
  };
  const onBulk = async (id, list, clear) => {
    if (id === 'csv') {
      exportCsv(list);
      toast(`${list.length} en el archivo`);
    }
    if (id === 'copy') {
      const nums = list.map(({ d }) => d.number).filter(Boolean);
      if (await copyText(nums.join(', '))) toast(`${nums.length} números copiados`);
    }
    if (id === 'void') setConfirm({ rows: list.filter(({ d }) => d.status !== 'void'), clear });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ventas"
        title={PLURAL[type]}
        description={`${counted.length} emitidas · ${fmt(total.sum)}${total.skipped ? ' + otras monedas' : ''}${dueSum ? ` · ${fmt(dueSum.sum)} por cobrar` : ''}`}
        actions={
          <Button onPress={() => createAndEdit(type)}>
            <Plus />
            {NEW_WORD[type]}
          </Button>
        }
      />
      {docs.length === 0 ? (
        <Empty icon={FileText} title={`Todavía no hay ${PLURAL[type].toLowerCase()}`} text="Se numeran solas por tipo y año, y se comparten con un enlace para ver, pagar o firmar." action={<Button onPress={() => createAndEdit(type)}>{NEW_WORD[type]}</Button>} />
      ) : (
        <>
          <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Filtrar">
                {filters.map(([k, label, fn]) => (
                  <Tabs.Tab key={k} id={k}>
                    {label}
                    <span className="ms-1 text-xs text-muted">{docs.filter(({ s }) => fn(s)).length}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <DataGrid
            label={PLURAL[type]}
            rows={rows}
            search={({ d }, q) => plain(`${d.number} ${customerName(d)} ${d.title || ''}`).includes(plain(q))}
            searchPlaceholder="Número o cliente"
            defaultSort={{ column: 'date', direction: 'descending' }}
            filters={[
              {
                id: 'currency',
                label: 'Moneda',
                options: [...new Set(docs.map(({ d }) => d.currency).filter(Boolean))].map((c) => [c, c]),
                match: ({ d }, c) => d.currency === c,
              },
            ].filter((f) => f.options.length > 1)}
            columns={[
              { id: 'number', name: 'Número', isRowHeader: true, sortValue: ({ d }) => d.number || '', render: ({ d }) => <span className="font-medium">{d.number || <span className="text-muted">Borrador</span>}</span> },
              {
                id: 'client',
                name: 'Cliente',
                sortValue: ({ d }) => plain(customerName(d)),
                render: ({ d }) => (
                  <span className="flex min-w-0 items-center gap-2">
                    <Person name={customerName(d)} />
                    <span className="truncate">{customerName(d)}</span>
                  </span>
                ),
              },
              { id: 'date', name: 'Fecha', sortValue: ({ d }) => d.issueDate || '', render: ({ d }) => <span className="text-muted">{shortDate(d.issueDate)}</span>, hideable: true },
              { id: 'due', name: isInvoice ? 'Vence' : 'Válida hasta', sortValue: ({ d }) => d.dueDate || d.validUntil || '', render: ({ d }) => <span className="text-muted">{shortDate(d.dueDate || d.validUntil) || '—'}</span>, hideable: true },
              {
                id: 'total',
                name: 'Total',
                align: 'end',
                sortValue: ({ t }) => t.total,
                render: ({ d, t }) => (
                  <>
                    {money(t.total, d.currency)}
                    {isInvoice && t.paid > 0 && t.due > 0.004 && <span className="block text-xs text-muted">faltan {money(t.due, d.currency)}</span>}
                  </>
                ),
              },
              {
                id: 'status',
                name: 'Estado',
                sortValue: ({ s }) => s,
                render: ({ s }) => {
                  const st = DOC_STATUS[s] || DOC_STATUS.draft;
                  return <StatusChip label={st[0]} color={st[1]} />;
                },
              },
            ]}
            onRowAction={({ d }) => go(`#/documentos/${d.id}`)}
            rowMenu={rowMenu}
            onRowMenu={onRowMenu}
            bulkActions={[
              { id: 'csv', label: 'Exportar CSV', icon: ArrowDownToLine },
              { id: 'copy', label: 'Copiar números', icon: Copy },
              { id: 'void', label: 'Anular', icon: Xmark, danger: true },
            ]}
            onBulkAction={onBulk}
          />
          {paying && <PaymentForm doc={paying} onClose={() => setPaying(null)} />}
          <ConfirmDialog
            open={!!confirm}
            title={confirm?.rows.length === 1 ? `¿Anular ${confirm.rows[0].d.number || 'el borrador'}?` : `¿Anular ${confirm?.rows.length || 0} ${PLURAL[type].toLowerCase()}?`}
            text="Dejan de contar en las cifras y no se pueden pagar ni firmar. Se pueden volver a borrador después."
            confirm="Anular"
            onClose={() => setConfirm(null)}
            onConfirm={() => {
              const n = confirm.rows.length;
              confirm.rows.forEach(({ d }) => setDocStatus(d, 'void'));
              confirm.clear?.();
              toast(n === 1 ? 'Anulada.' : `${n} anuladas.`);
            }}
          />
        </>
      )}
    </div>
  );
}

const when = (iso) => {
  if (!iso) return '';
  const dt = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(dt.getTime())
    ? ''
    : dt.toLocaleString('es', iso.length === 10 ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Lo que le pasó al documento, en orden: creado, enviado, visto, firmado, pagos y anulación. */
function DocHistory({ d, pub, linked }) {
  const items = [];
  const add = (at, item) => at && items.push({ at: String(at), ...item });
  add(d.createdAt || d.issueDate, { id: 'created', title: d.fromQuote ? 'Creada desde una cotización' : 'Creado', marker: { icon: FileText } });
  if (d.number && d.status !== 'draft') add(d.sentAt || d.issueDate, { id: 'sent', title: `Emitido como ${d.number}`, marker: { icon: ArrowUpRightFromSquare, color: 'var(--accent)' } });
  if (pub?.viewedAt) add(pub.viewedAt, { id: 'viewed', title: 'Lo abrió el cliente', marker: { icon: Eye }, description: pub.views > 1 ? `${pub.views} veces` : undefined });
  if (pub?.acceptedAt) add(pub.acceptedAt, { id: 'ok', title: 'Firmado', badge: { label: pub.name || 'Cliente', color: 'success' }, marker: { kind: 'check', color: 'var(--success)' } });
  if (pub?.declinedAt) add(pub.declinedAt, { id: 'no', title: 'Rechazado', marker: { icon: Xmark, color: 'var(--danger)' }, description: pub.reason });
  (d.payments || []).forEach((p) =>
    add(p.date, { id: `p-${p.id}`, title: 'Pago recibido', badge: { label: money(Number(p.amount) || 0, d.currency), color: 'success' }, marker: { icon: CircleDollar, color: 'var(--success)' }, description: [p.method, p.rate ? `tasa ${p.rate}` : ''].filter(Boolean).join(' · ') || undefined }),
  );
  if (linked) add(linked.createdAt || linked.issueDate, { id: 'inv', title: <a href={`#/documentos/${linked.id}`} className="hover:underline">Convertida en {linked.number || 'factura'}</a>, marker: { icon: FileText, color: 'var(--accent)' } });
  if (d.status === 'void') add(d.updatedAt || d.issueDate, { id: 'void', title: 'Anulado', marker: { icon: Xmark, color: 'var(--danger)' } });
  items.sort((a, b) => a.at.localeCompare(b.at));
  if (!items.length) return <p className="text-sm text-muted">Sin movimientos todavía.</p>;
  return <Timeline label="Historial del documento" items={items.map((it) => ({ ...it, trailing: when(it.at) }))} />;
}

/** La acción principal de cada documento según lo que le toca, y el resto en la flecha. */
function DocActions({ d, s, t, linked }) {
  const [paying, setPaying] = useState(false);
  const editor = () => (location.href = OLD_EDITOR(d.id));
  const isInvoice = d.type === 'invoice';
  const signable = d.type === 'quote' || d.type === 'proposal';
  let main;
  if (isInvoice && t.due > 0.004 && d.status !== 'void') main = ['pay', 'Registrar pago', CircleDollar];
  else if (signable && linked) main = ['invoice', 'Ver la factura', FileText];
  else if (signable && !['void', 'declined', 'expired'].includes(s)) main = ['convert', 'Convertir en factura', FileText];
  else main = ['edit', 'Abrir en el editor', ArrowUpRightFromSquare];
  const run = (k) => {
    if (k === 'pay') setPaying(true);
    if (k === 'edit') editor();
    if (k === 'invoice') go(`#/documentos/${linked.id}`);
    if (k === 'convert') go(`#/documentos/${toInvoice(d).id}`);
    if (k === 'convert-project') go(`#/documentos/${toInvoice(d, { project: true }).id}`);
    if (k === 'void') {
      setDocStatus(d, 'void');
      toast('Anulada: ya no cuenta ni se puede pagar o firmar.');
    }
    if (k === 'draft') {
      setDocStatus(d, 'draft');
      toast('Volvió a borrador.');
    }
    if (k === 'declined') {
      setDocStatus(d, 'declined');
      toast('Marcada como rechazada.');
    }
  };
  const Icon = main[2];
  const more = [
    main[0] !== 'edit' && ['edit', 'Abrir en el editor', 'Líneas, diseño, enlace para el cliente e imprimir'],
    signable && !linked && main[0] === 'convert' && ['convert-project', 'Factura y proyecto', 'Crea también el proyecto con su presupuesto'],
    signable && d.status !== 'declined' && d.status !== 'void' && !linked && ['declined', 'Marcar como rechazada', ''],
    d.status !== 'void' && d.type !== 'receipt' && ['void', 'Anular', 'Deja de contar en las cifras'],
    d.status === 'void' && ['draft', 'Volver a borrador', ''],
  ].filter(Boolean);
  return (
    <>
      <ButtonGroup>
        <Button onPress={() => run(main[0])}>
          <Icon />
          {main[1]}
        </Button>
        {more.length > 0 && (
          <Dropdown>
            <Button isIconOnly variant="primary" aria-label="Más acciones">
              <ButtonGroup.Separator />
              <ChevronDown />
            </Button>
            <Dropdown.Popover placement="bottom end" className="min-w-64">
              <Dropdown.Menu aria-label="Acciones del documento" onAction={(k) => run(String(k))}>
                {more.map(([k, label, desc]) => (
                  <Dropdown.Item key={k} id={k} textValue={label} variant={k === 'void' ? 'danger' : 'default'}>
                    {k === 'convert-project' ? <Folder className="size-4" /> : k === 'edit' ? <ArrowUpRightFromSquare className="size-4" /> : k === 'void' || k === 'declined' ? <Xmark className="size-4" /> : <FileText className="size-4" />}
                    <div className="flex flex-col">
                      <Label>{label}</Label>
                      {desc && <Description>{desc}</Description>}
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </ButtonGroup>
      {paying && <PaymentForm doc={d} onClose={() => setPaying(false)} />}
    </>
  );
}

export function Documento({ id }) {
  const [state, v] = useCrm();
  const d = find('docs', id);
  if (!d) return <Empty icon={FileText} title="Ese documento ya no existe" action={<Button onPress={() => go('#/facturas')}>Ver facturas</Button>} />;
  const s = docStatus(d);
  const st = DOC_STATUS[s] || DOC_STATUS.draft;
  const t = totals(d);
  const pub = pubOf(d);
  const lines = (d.items || []).filter((it) => it.name || it.price);
  const linked = d.invoiceId && find('docs', d.invoiceId);

  return (
    <div className="flex flex-col gap-6" data-v={v}>
      <Link href={LIST_HASH[d.type] || '#/facturas'} className="w-fit text-sm text-muted">
        <ArrowLeft className="size-4" />
        {PLURAL[d.type] || 'Documentos'}
      </Link>
      <PageHeader
        eyebrow={DOC_WORD[d.type]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {d.type === 'proposal' && d.title ? d.title : d.number || 'Borrador'}
            <StatusChip label={st[0]} color={st[1]} size="md" />
          </span>
        }
        description={`${customerName(d)} · ${dateText(d.issueDate)}`}
        actions={<DocActions d={d} s={s} t={t} linked={linked} />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={money(t.total, d.currency)} sub={d.equiv?.rate ? `1 ${d.currency} = ${d.equiv.rate} ${d.equiv.currency}` : d.currency} />
        {d.type === 'invoice' ? (
          <>
            <Stat label="Cobrado" value={money(t.paid, d.currency)} sub={`${(d.payments || []).length} pagos`} />
            <Stat label="Falta" value={money(t.due, d.currency)} tone={s === 'overdue' ? 'var(--danger)' : undefined} sub={d.dueDate ? `Vence el ${shortDate(d.dueDate)}` : 'Sin vencimiento'} />
          </>
        ) : (
          <Stat label="Válida hasta" value={shortDate(d.validUntil) || '—'} sub={s === 'expired' ? 'Ya caducó' : 'Hasta la medianoche de Venezuela'} />
        )}
        <Stat label="El cliente" value={pub?.viewedAt ? 'La vio' : 'Sin abrir'} icon={Eye} sub={pub?.viewedAt ? `Por última vez el ${shortDate(new Date(pub.lastViewAt || pub.viewedAt).toLocaleDateString('en-CA'))}` : pub ? 'Tiene enlace' : 'Sin enlace compartido'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Líneas" className="lg:col-span-2">
          {lines.length ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Líneas" className="min-w-[480px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Concepto</Table.Column>
                    <Table.Column className="text-end">Cant.</Table.Column>
                    <Table.Column className="text-end">Precio</Table.Column>
                    <Table.Column className="text-end">Importe</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lines.map((it) => (
                      <Table.Row key={it.id}>
                        <Table.Cell>
                          <span className="font-medium">{it.name}</span>
                          {it.description && <span className="block text-xs text-muted">{it.description}</span>}
                        </Table.Cell>
                        <Table.Cell className="text-end tabular-nums">{it.qty}</Table.Cell>
                        <Table.Cell className="text-end tabular-nums">{money(Number(it.price) || 0, d.currency)}</Table.Cell>
                        <Table.Cell className="text-end tabular-nums">{money((Number(it.qty) || 0) * (Number(it.price) || 0), d.currency)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <p className="text-sm text-muted">Sin líneas todavía.</p>
          )}
          <dl className="ms-auto mt-4 grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
            {[
              ['Subtotal', t.subtotal],
              ['Descuento', -t.discount],
              ['Impuesto', t.tax],
              ['Retención', -t.withholding],
              ['Otros cargos', t.shipping],
            ]
              .filter(([, x]) => Math.abs(x) > 0.004 || x === t.subtotal)
              .map(([label, x]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-end tabular-nums">{money(x, d.currency)}</dd>
                </div>
              ))}
            <dt className="font-semibold">Total</dt>
            <dd className="text-end font-semibold tabular-nums">{money(t.total, d.currency)}</dd>
          </dl>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Cliente">
            <p className="font-medium">{customerName(d)}</p>
            <p className="text-sm text-muted">{[d.customer?.email, d.customer?.phone, d.customer?.taxId].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
            {d.customerId && (
              <Link href={`#/clientes/${d.customerId}`} className="mt-2 text-sm">
                Ver ficha
              </Link>
            )}
          </Panel>
          {d.type === 'invoice' && (
            <Panel title="Pagos">
              {(d.payments || []).length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <CircleCheck className="text-success" />
                        {shortDate(p.date)}
                        {p.rate ? <span className="text-xs text-muted">a {p.rate}</span> : null}
                      </span>
                      <span className="tabular-nums">{money(Number(p.amount) || 0, d.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin pagos todavía: regístralos con «Registrar pago».</p>
              )}
            </Panel>
          )}
          <Panel title="Historial">
            <DocHistory d={d} pub={pub} linked={linked} />
          </Panel>
          {pub && (pub.acceptedAt || pub.declinedAt) && (
            <Card variant="secondary">
              <Chip color={pub.acceptedAt ? 'success' : 'danger'} variant="soft" className="w-fit">
                {pub.acceptedAt ? <CircleCheck /> : <Xmark />}
                <Chip.Label>{pub.acceptedAt ? 'Firmada' : 'Rechazada'}</Chip.Label>
              </Chip>
              <p className="text-sm">
                {pub.acceptedAt ? `${pub.name || customerName(d)} la firmó el ${new Date(pub.acceptedAt).toLocaleString('es')}.` : `Motivo: ${pub.reason || 'sin motivo'}.`}
              </p>
            </Card>
          )}
        </div>
      </div>
      <Separator />
      <p className="text-xs text-muted">Moneda principal del negocio: {base()}.</p>
    </div>
  );
}
