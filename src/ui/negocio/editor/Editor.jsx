// El editor de facturas, cotizaciones, propuestas y recibos en el diseño nuevo.
// A la izquierda, la hoja tal como la ve y la imprime el cliente (renderSheet, la
// misma de la página pública), en vivo; a la derecha, pestañas para el contenido,
// el diseño, el enlace para compartir y los pagos. Las reglas (acciones según el
// estado, duplicar, convertir, eliminar con sus recibos, imprimir…) son las del
// editor de siempre, negocio-doc.js.
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRotateLeft,
  Ban,
  ChevronDown,
  CircleCheck,
  CircleDollar,
  Copy,
  FileText,
  Folder,
  Lock,
  PaperPlane,
  Printer,
  TrashBin,
  Wallet,
  Xmark,
} from '@gravity-ui/icons';
import { Button, ButtonGroup, Chip, Dropdown, Label, Link, Separator, Tabs, toast } from '@heroui/react';
import {
  DEFAULT_STYLE,
  addDays,
  docStatus,
  find,
  isLocked,
  isSignable,
  newDoc,
  pubOf,
  put,
  remove,
  snapshotBusiness,
  snapshotCustomer,
  state,
  todayISO,
  totals,
  uid,
} from '../../../negocio-core.js';
import { PROPOSAL_TEMPLATES, applyTemplate } from '../../../negocio-propuesta.js';
import { Empty } from '../../kit/parts.jsx';
import { DOC_STATUS } from '../domain.js';
import { ConfirmDialog, FormModal } from '../fields.jsx';
import { setDocStatus, toInvoice } from '../payments.jsx';
import { go, useCrm } from '../store.js';
import { Bloques } from './Bloques.jsx';
import { Contenido } from './Contenido.jsx';
import { Compartir, Diseno, Pagos } from './Paneles.jsx';
import { SheetPreview } from './shared.jsx';
import { menuNodes } from '../../pro/ContextMenu.jsx';

const TITLE = { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo', proposal: 'Propuesta' };
const LIST = { invoice: '#/facturas', receipt: '#/facturas', quote: '#/cotizaciones', proposal: '#/propuestas' };
const LIST_NAME = { invoice: 'Facturas', receipt: 'Facturas', quote: 'Cotizaciones', proposal: 'Propuestas' };
export const editorHash = (id) => `#/documentos/${id}/editar`;

/** Un documento incompleto (importado, o de una versión vieja) se abre igual. */
function normalize(doc) {
  doc.style = { ...DEFAULT_STYLE, ...doc.style };
  doc.from ||= snapshotBusiness();
  doc.customer ||= snapshotCustomer(null);
  doc.items ||= [];
  doc.payments ||= [];
  doc.sections ||= [];
  if (doc.type === 'proposal') doc.blocks ||= [];
}

/** Copia como borrador nuevo, con fechas de hoy y sin pagos ni enlace. */
function duplicate(doc) {
  const copy = structuredClone(doc);
  const today = todayISO();
  if (copy.equiv) copy.equiv.date = doc.equiv.date || doc.issueDate;
  Object.assign(copy, { id: uid(), number: '', status: 'draft', issueDate: today, payments: [], invoiceId: '', fromQuoteId: '', fromQuote: '', share: null });
  delete copy.createdAt;
  delete copy.updatedAt;
  if (copy.type === 'invoice') copy.dueDate = addDays(today, Number(state.settings.dueDays) || 15);
  if (isSignable(copy)) copy.validUntil = addDays(today, Number(state.settings.quoteDays) || 15);
  copy.items = copy.items.map((i) => ({ ...i, id: uid() }));
  put('docs', copy, { now: true })?.catch(() => {});
  toast.success(`${TITLE[copy.type]} duplicada`);
  go(editorHash(copy.id));
}

/** Borra el documento, sus recibos y los enlaces que otros tengan con él. */
function destroy(doc) {
  const receipts = doc.type === 'invoice' ? (doc.payments || []).map((p) => p.receiptId).filter((r) => r && find('docs', r)) : [];
  for (const r of receipts) remove('docs', r);
  if (doc.type === 'receipt') {
    const inv = find('docs', doc.invoiceId);
    const p = inv?.payments?.find((x) => x.id === doc.paymentId);
    if (p) {
      p.receiptId = '';
      put('docs', inv);
    }
  }
  if (doc.fromQuoteId) {
    const q = find('docs', doc.fromQuoteId);
    if (q?.invoiceId === doc.id) {
      q.invoiceId = '';
      put('docs', q);
    }
  }
  remove('docs', doc.id);
  toast('Eliminado');
  go(LIST[doc.type]);
}

function printDoc(doc) {
  const before = document.title;
  document.title = [doc.number || TITLE[doc.type], doc.customer?.name].filter(Boolean).join(' · ');
  addEventListener('afterprint', () => { document.title = before; }, { once: true });
  print();
}

/** La acción principal según el tipo y el estado, y el resto en el menú (como en el editor de siempre). */
function actionsOf(doc) {
  const status = docStatus(doc);
  const t = totals(doc);
  const dup = { id: 'dup', label: 'Duplicar', icon: Copy };
  const del = { id: 'delete', label: 'Eliminar', icon: TrashBin, danger: true };
  const send = { id: 'send', label: 'Marcar como enviada', icon: PaperPlane };
  if (doc.type === 'receipt') {
    const inv = find('docs', doc.invoiceId);
    return { primary: inv && { id: 'goinvoice', label: 'Ver la factura', icon: FileText, target: inv.id }, more: [del] };
  }
  if (isSignable(doc)) {
    const linked = doc.invoiceId && find('docs', doc.invoiceId);
    const convert = linked ? { id: 'goinvoice', label: 'Ver la factura', icon: FileText, target: linked.id } : { id: 'convert', label: 'Convertir en factura', icon: FileText };
    const withProject = !linked && { id: 'convert-project', label: 'Factura y proyecto', icon: Folder };
    const answered = pubOf(doc)?.acceptedAt || pubOf(doc)?.declinedAt;
    const reopen = { id: 'reopen', label: 'Reabrir', icon: ArrowRotateLeft };
    if (status === 'draft') return { primary: send, more: [convert, withProject, dup, '-', del] };
    if (status === 'accepted') return { primary: convert, more: [withProject, !answered && reopen, dup, '-', del] };
    if (status === 'declined') return { primary: answered ? null : reopen, more: [dup, '-', del] };
    return {
      primary: convert,
      more: [
        withProject,
        { id: 'accepted', label: 'Marcar como aceptada', icon: CircleCheck },
        { id: 'declined', label: 'Marcar como rechazada', icon: Xmark },
        { id: 'draft', label: 'Volver a borrador', icon: ArrowRotateLeft },
        dup,
        '-',
        del,
      ],
    };
  }
  if (status === 'draft') return { primary: send, more: [dup, '-', del] };
  if (status === 'void') return { primary: { id: 'reopen', label: 'Reactivar', icon: ArrowRotateLeft }, more: [dup, '-', del] };
  const hasPayments = (doc.payments || []).length > 0;
  return {
    primary: t.due > 0 ? { id: 'pay', label: 'Registrar pago', icon: CircleDollar } : { id: 'pay', label: 'Ver pagos', icon: Wallet },
    more: [
      { id: 'draft', label: hasPayments ? 'Volver a borrador (tiene pagos)' : 'Volver a borrador', icon: ArrowRotateLeft, isDisabled: hasPayments },
      { id: 'void', label: hasPayments ? 'Anular (tiene pagos)' : 'Anular', icon: Ban, isDisabled: hasPayments },
      dup,
      '-',
      del,
    ],
  };
}

export function DocEditor({ id }) {
  const [, v] = useCrm();
  const [tick, bump] = useReducer((x) => x + 1, 0);
  const [tab, setTab] = useState('content');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const doc = find('docs', id);

  useEffect(() => {
    if (!doc) return undefined;
    const before = document.title;
    document.title = `${doc.number || `${TITLE[doc.type]} nueva`} | Negocio`;
    return () => {
      document.title = before;
    };
  }, [doc, doc?.number, doc?.type]);

  if (!doc) return <Empty icon={FileText} title="Ese documento ya no existe" action={<Button onPress={() => go('#/facturas')}>Ver facturas</Button>} />;
  normalize(doc);

  // Cada cambio escribe en el documento, lo guarda (en la cola, como siempre) y repinta.
  const change = (fn) => {
    fn(doc);
    put('docs', doc);
    bump();
  };
  const locked = isLocked(doc);
  const status = docStatus(doc);
  const st = DOC_STATUS[status] || DOC_STATUS.draft;
  const { primary, more } = actionsOf(doc);

  const run = (k, item) => {
    if (k === 'send') {
      setDocStatus(doc, 'sent');
      bump();
      toast('Marcada como enviada');
    }
    if (k === 'goinvoice') go(editorHash(item?.target));
    if (k === 'convert') go(editorHash(toInvoice(doc).id));
    if (k === 'convert-project') go(editorHash(toInvoice(doc, { project: true }).id));
    if (k === 'reopen') change(() => { doc.status = 'sent'; });
    if (k === 'accepted' || k === 'declined' || k === 'draft' || k === 'void') change(() => { doc.status = k; });
    if (k === 'dup') duplicate(doc);
    if (k === 'delete') setConfirmDelete(true);
    if (k === 'pay') setTab('pay');
  };

  // Factura ↔ cotización (las propuestas y los recibos no cambian de tipo).
  const changeType = (type) =>
    change(() => {
      doc.type = type;
      const today = todayISO();
      if (type === 'invoice' && !doc.dueDate) doc.dueDate = addDays(doc.issueDate || today, Number(state.settings.dueDays) || 15);
      if (type === 'quote' && !doc.validUntil) doc.validUntil = addDays(doc.issueDate || today, Number(state.settings.quoteDays) || 15);
      if (!['draft', 'void', 'sent'].includes(doc.status)) doc.status = 'sent';
      if (type !== 'invoice' && tab === 'pay') setTab('content');
    });

  const receipts = doc.type === 'invoice' ? (doc.payments || []).filter((p) => p.receiptId && find('docs', p.receiptId)).length : 0;
  const tabs = [
    !locked && ['content', 'Contenido'],
    doc.type !== 'receipt' && !locked && ['design', 'Diseño'],
    doc.type !== 'receipt' && ['share', doc.share?.token ? 'Enlace' : 'Compartir'],
    doc.type === 'invoice' && ['pay', 'Pagos'],
  ].filter(Boolean);
  const current = tabs.some(([k]) => k === tab) ? tab : tabs[0]?.[0];
  const PrimaryIcon = primary?.icon;

  return (
    <div className="flex flex-col gap-5" data-v={v}>
      {/* Cabecera: de dónde viene, qué es y qué se puede hacer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href={LIST[doc.type]} className="flex items-center gap-1 text-sm text-muted">
            <ArrowLeft className="size-4" />
            {LIST_NAME[doc.type]}
          </Link>
          <Separator orientation="vertical" className="h-5" />
          {['invoice', 'quote'].includes(doc.type) && !locked ? (
            <Dropdown>
              <Button size="sm" variant="secondary">
                <FileText />
                {TITLE[doc.type]}
                <ChevronDown className="size-3.5" />
              </Button>
              <Dropdown.Popover className="min-w-48">
                <Dropdown.Menu
                  aria-label="Tipo de documento"
                  selectionMode="single"
                  selectedKeys={new Set([doc.type])}
                  disabledKeys={(doc.payments || []).length ? ['quote'] : []}
                  onAction={(k) => k !== doc.type && changeType(String(k))}
                >
                  <Dropdown.Item id="invoice" textValue="Factura">
                    <Label>Factura</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                  <Dropdown.Item id="quote" textValue="Cotización">
                    <Label>Cotización{(doc.payments || []).length ? ' (tiene pagos)' : ''}</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : (
            <Chip variant="soft">{TITLE[doc.type]}</Chip>
          )}
          <span className="text-lg font-semibold tabular-nums">{doc.type === 'proposal' && doc.title ? doc.title : doc.number || 'Borrador'}</span>
          <Chip size="sm" variant="soft" color={st[1]}>
            {st[0]}
          </Chip>
          {locked && (
            <Chip size="sm" variant="soft" color="success">
              <Lock className="size-3" />
              <Chip.Label>Firmada</Chip.Label>
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={() => printDoc(doc)}>
            <Printer />
            Imprimir o PDF
          </Button>
          <ButtonGroup size="sm">
            {primary && (
              <Button onPress={() => run(primary.id, primary)}>
                {PrimaryIcon && <PrimaryIcon />}
                {primary.label}
              </Button>
            )}
            <Dropdown>
              {/* Dentro de un Dropdown el botón no hereda el estilo del grupo: va explícito. */}
              <Button size="sm" variant="primary" isIconOnly={!!primary} aria-label="Más acciones">
                {primary && <ButtonGroup.Separator />}
                {!primary && 'Más'}
                <ChevronDown />
              </Button>
              <Dropdown.Popover placement="bottom end" className="min-w-56">
                <Dropdown.Menu aria-label="Más acciones" onAction={(k) => run(String(k), more.find((m) => m && m.id === k))}>
                  {menuNodes(more.filter(Boolean))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </ButtonGroup>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* La hoja en vivo */}
        <div className="order-2 min-w-0 rounded-[1.75rem] bg-surface-secondary p-3 shadow-[var(--surface-shadow)] sm:p-5 lg:order-1">
          <SheetPreview doc={doc} version={`${tick}-${v}`} />
        </div>

        {/* El panel */}
        <aside className="order-1 flex min-w-0 flex-col gap-4 rounded-[1.75rem] bg-surface p-4 shadow-[var(--surface-shadow)] lg:sticky lg:top-24 lg:order-2 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          {locked && (
            <div className="flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>El cliente la firmó: el contenido ya no cambia. Puedes ver el enlace, imprimirla o convertirla en factura.</span>
            </div>
          )}
          <Tabs selectedKey={current} onSelectionChange={(k) => setTab(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Panel del documento">
                {tabs.map(([k, label]) => (
                  <Tabs.Tab key={k} id={k}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          {current === 'content' && <Contenido doc={doc} change={change} blocks={doc.type === 'proposal' ? <Bloques doc={doc} change={change} /> : null} />}
          {current === 'design' && <Diseno doc={doc} change={change} />}
          {current === 'share' && <Compartir doc={doc} change={change} />}
          {current === 'pay' && <Pagos doc={doc} change={change} />}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar ${doc.type === 'receipt' ? 'el' : 'la'} ${`${TITLE[doc.type].toLowerCase()} ${doc.number || ''}`.trim()}?`}
        text={receipts ? `También se ${receipts === 1 ? 'borra su recibo' : `borran sus ${receipts} recibos`}.` : 'No se puede deshacer.'}
        confirm="Eliminar"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => destroy(doc)}
      />
    </div>
  );
}

/** Nueva propuesta: se elige una plantilla y se abre el editor. */
export function NewProposal({ onClose, customer = null }) {
  const [chosen, setChosen] = useState('app');
  // Al crearla se va al editor: el cierre del formulario no debe volver a la lista.
  const created = useRef(false);
  return (
    <FormModal
      title="Nueva propuesta"
      submit="Crear propuesta"
      onClose={() => {
        if (!created.current) onClose();
      }}
      onSubmit={() => {
        const doc = newDoc('proposal', customer);
        applyTemplate(doc, chosen);
        put('docs', doc, { now: true })?.catch(() => {});
        created.current = true;
        go(editorHash(doc.id));
        return true;
      }}
    >
      <p className="text-sm text-muted sm:col-span-2">Empieza desde una plantilla con objetivos, alcance y calendario. Todo se puede cambiar.</p>
      <div role="radiogroup" aria-label="Plantilla" className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        {Object.entries(PROPOSAL_TEMPLATES).map(([k, t]) => {
          const on = chosen === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(k)}
              className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                on ? 'border-accent bg-accent/8' : 'border-transparent bg-surface-secondary hover:border-default'
              }`}
            >
              <b className="text-sm">{t.label}</b>
              <span className="text-xs text-muted">{t.title || 'Solo introducción y precio'}</span>
            </button>
          );
        })}
      </div>
    </FormModal>
  );
}
