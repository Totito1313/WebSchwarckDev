// Facturas, cotizaciones y propuestas: la lista con su estado (que sale de los
// pagos, las fechas y lo que hizo el cliente en el enlace) y la ficha de cada una.
// Cobrar, convertir en factura y anular se hacen aquí; el editor de la hoja (líneas,
// diseño y enlace para el cliente) todavía es el de siempre: «Abrir en el editor»
// lleva a él con el mismo documento.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRightFromSquare, ChevronDown, CircleCheck, CircleDollar, Eye, FileText, Folder, Plus, Xmark } from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Chip, Description, Dropdown, Label, Link, SearchField, Separator, Table, Tabs, toast } from '@heroui/react';
import { find, newDoc, pubOf, put } from '../../../negocio-core.js';
import { Empty, PageHeader, Panel, Stat, StatusChip } from '../../kit/parts.jsx';
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ column: 'date', direction: 'descending' });

  const docs = useMemo(() => state.docs.filter((d) => d.type === type).map((d) => ({ d, s: docStatus(d), t: totals(d) })), [state, v, type]);
  const filters = FILTERS[type];
  const test = filters.find(([k]) => k === filter)?.[2] || (() => true);
  const rows = useMemo(() => {
    const q = plain(query.trim());
    const list = docs.filter(({ d, s }) => test(s) && (!q || plain(`${d.number} ${customerName(d)} ${d.title || ''}`).includes(q)));
    const key = ({ d, t }) => ({ number: d.number || '', client: plain(customerName(d)), date: d.issueDate || '', total: t.total, due: d.dueDate || d.validUntil || '' })[sort.column];
    return list.sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.direction === 'descending' ? -cmp : cmp;
    });
  }, [docs, query, filter, sort]);

  const counted = docs.filter(({ d }) => d.status !== 'draft' && d.status !== 'void');
  const total = sumBase(counted.map(({ d, t }) => [d, t.total]));
  const dueSum = type === 'invoice' ? sumBase(counted.filter(({ t }) => t.due > 0.004).map(({ d, t }) => [d, t.due])) : null;
  const col = (id, label, cls) => (
    <Table.Column allowsSorting id={id} className={cls} isRowHeader={id === 'number'}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );

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
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <SearchField aria-label="Buscar" value={query} onChange={setQuery} className="w-full sm:w-64">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Número o cliente" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={PLURAL[type]} className="min-w-[720px]" sortDescriptor={sort} onSortChange={setSort} onRowAction={(id) => go(`#/documentos/${id}`)}>
                <Table.Header>
                  {col('number', 'Número')}
                  {col('client', 'Cliente')}
                  {col('date', 'Fecha')}
                  {col('due', type === 'invoice' ? 'Vence' : 'Válida hasta')}
                  {col('total', 'Total', 'text-end')}
                  <Table.Column>Estado</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <p className="p-6 text-center text-sm text-muted">Nada por aquí.</p>}>
                  {rows.map(({ d, s, t }) => {
                    const st = DOC_STATUS[s] || DOC_STATUS.draft;
                    return (
                      <Table.Row key={d.id} id={d.id} className="cursor-pointer">
                        <Table.Cell className="font-medium">{d.number || <span className="text-muted">Borrador</span>}</Table.Cell>
                        <Table.Cell>{customerName(d)}</Table.Cell>
                        <Table.Cell className="text-muted">{shortDate(d.issueDate)}</Table.Cell>
                        <Table.Cell className="text-muted">{shortDate(d.dueDate || d.validUntil) || '—'}</Table.Cell>
                        <Table.Cell className="text-end tabular-nums">
                          {money(t.total, d.currency)}
                          {type === 'invoice' && t.paid > 0 && t.due > 0.004 && <span className="block text-xs text-muted">faltan {money(t.due, d.currency)}</span>}
                        </Table.Cell>
                        <Table.Cell>
                          <StatusChip label={st[0]} color={st[1]} />
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </>
      )}
    </div>
  );
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
            <Button isIconOnly aria-label="Más acciones">
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
