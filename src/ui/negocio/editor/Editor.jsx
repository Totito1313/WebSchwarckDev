// El editor de facturas, cotizaciones, propuestas y recibos, con la forma de trabajar
// de siempre (negocio-doc.js): la hoja es interactiva y se edita escribiendo sobre
// ella (Hoja.jsx); arriba, una barra con el tipo, el cliente, el proyecto, la moneda
// y las acciones; a la derecha, el panel de diseño, el enlace para el cliente y los
// pagos (en pantallas estrechas, ese panel sale como un cajón). Las reglas (acciones
// según el estado, duplicar, convertir, eliminar con sus recibos, imprimir…) son las
// del editor de siempre.
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRotateLeft,
  Ban,
  Briefcase,
  ChevronDown,
  CircleCheck,
  CircleDollar,
  Copy,
  EllipsisVertical,
  FileText,
  Folder,
  Link as LinkIcon,
  Lock,
  Palette,
  PaperPlane,
  Person as PersonIcon,
  Plus,
  Printer,
  TrashBin,
  Wallet,
  Xmark,
} from '@gravity-ui/icons';
import { Button, ButtonGroup, Chip, Drawer, Dropdown, Label, Tooltip, toast } from '@heroui/react';
import {
  CURRENCIES,
  CURRENCY_CODES,
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
import { Empty, Person } from '../../kit/parts.jsx';
import { PointPicker, below } from '../../kit/PointPicker.jsx';
import { menuNodes } from '../../pro/ContextMenu.jsx';
import { DOC_STATUS } from '../domain.js';
import { ConfirmDialog, FormModal } from '../fields.jsx';
import { setDocStatus, toInvoice } from '../payments.jsx';
import { CustomerForm } from '../screens/Clientes.jsx';
import { go, useCrm } from '../store.js';
import { Hoja, TITLE } from './Hoja.jsx';
import { Compartir, Diseno, Pagos } from './Paneles.jsx';
import { SheetPreview } from './shared.jsx';

const LIST = { invoice: '#/facturas', receipt: '#/facturas', quote: '#/cotizaciones', proposal: '#/propuestas' };
const LIST_NAME = { invoice: 'Facturas', receipt: 'Facturas', quote: 'Cotizaciones', proposal: 'Propuestas' };
const PANEL_KEY = 'negocio-editor-panel';
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

/** Cambiar de moneda: la equivalencia a esa misma moneda deja de tener sentido. */
function changeCurrency(doc, code) {
  doc.currency = code;
  if (doc.equiv?.currency === code) doc.equiv = null;
}

/** El cliente del documento: se copian sus datos (y su moneda, si aún no hay precios). */
function setCustomer(doc, c) {
  doc.customerId = c.id;
  doc.customer = snapshotCustomer(c);
  const untouched = (doc.items || []).every((i) => !i.price);
  if (untouched && c.currency && c.currency !== doc.currency) changeCurrency(doc, c.currency);
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

/** ¿Pantalla ancha? (el panel va al lado de la hoja; si no, en un cajón). */
const WIDE = '(min-width: 1280px)';
const subscribeWide = (cb) => {
  const m = matchMedia(WIDE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches);

/** Botón de la barra con su globo. */
function BarButton({ label, icon: Icon, onPress, isActive, children, isIconOnly = !children }) {
  const btn = (
    <Button size="sm" variant={isActive ? 'secondary' : 'ghost'} isIconOnly={isIconOnly} aria-label={label} aria-pressed={isActive} onPress={onPress} className={isActive ? 'bg-accent/15 text-foreground' : ''}>
      <Icon />
      {children}
    </Button>
  );
  if (!isIconOnly) return btn;
  return (
    <Tooltip delay={400}>
      {btn}
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

export function DocEditor({ id }) {
  const [, v] = useCrm();
  const [, touchTick] = useReducer((x) => x + 1, 0);
  const [ver, redrawTick] = useReducer((x) => x + 1, 0);
  // En pantalla ancha el panel se abre como se dejó la última vez (de entrada, el
  // diseño); en una estrecha sería un cajón encima de la hoja: empieza cerrado.
  const [panel, setPanelState] = useState(() => {
    if (!matchMedia(WIDE).matches) return null;
    const saved = localStorage.getItem(PANEL_KEY);
    return saved === 'none' ? null : saved || 'style';
  });
  const [ask, setAsk] = useState(null); // 'delete' | { template }
  const [pick, setPick] = useState(null); // { at, kind: 'customer' | 'project' }
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const wide = useWide();
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

  const locked = isLocked(doc);
  const isReceipt = doc.type === 'receipt';
  // Escribir: se guarda (en la cola, como siempre) y se repintan las cifras.
  const touch = () => {
    put('docs', doc);
    touchTick();
  };
  // Cambios de estructura: se guarda y la hoja se vuelve a montar con lo nuevo.
  const redraw = () => {
    put('docs', doc);
    redrawTick();
  };
  const change = (fn) => {
    fn(doc);
    redraw();
  };
  const setPanel = (p) => {
    const next = panel === p ? null : p;
    setPanelState(next);
    localStorage.setItem(PANEL_KEY, next || 'none');
  };

  // Los paneles que tiene este documento.
  const panels = [
    !isReceipt && !locked && { id: 'style', label: 'Personalizar', icon: Palette },
    !isReceipt && { id: 'share', label: doc.share?.token ? 'Enlace' : 'Compartir', icon: LinkIcon, wide: true },
    doc.type === 'invoice' && { id: 'pay', label: 'Pagos', icon: Wallet },
  ].filter(Boolean);
  const open = panels.some((p) => p.id === panel) ? panel : null;

  const status = docStatus(doc);
  const st = DOC_STATUS[status] || DOC_STATUS.draft;
  const { primary, more } = actionsOf(doc);
  const PrimaryIcon = primary?.icon;
  const run = (k, item) => {
    if (k === 'send') {
      setDocStatus(doc, 'sent');
      redraw();
      toast('Marcada como enviada');
    }
    if (k === 'goinvoice') go(editorHash(item?.target));
    if (k === 'convert') go(editorHash(toInvoice(doc).id));
    if (k === 'convert-project') go(editorHash(toInvoice(doc, { project: true }).id));
    if (k === 'reopen') change(() => { doc.status = 'sent'; });
    if (k === 'accepted' || k === 'declined' || k === 'draft' || k === 'void') change(() => { doc.status = k; });
    if (k === 'dup') duplicate(doc);
    if (k === 'delete') setAsk('delete');
    if (k === 'pay') {
      setPanelState('pay');
      localStorage.setItem(PANEL_KEY, 'pay');
    }
  };

  // Factura ↔ cotización (las propuestas y los recibos no cambian de tipo).
  const changeType = (type) =>
    change(() => {
      doc.type = type;
      const today = todayISO();
      if (type === 'invoice' && !doc.dueDate) doc.dueDate = addDays(doc.issueDate || today, Number(state.settings.dueDays) || 15);
      if (type === 'quote' && !doc.validUntil) doc.validUntil = addDays(doc.issueDate || today, Number(state.settings.quoteDays) || 15);
      if (!['draft', 'void', 'sent'].includes(doc.status)) doc.status = 'sent';
    });

  const who = doc.customer?.name || doc.customer?.company;
  const project = doc.projectId && find('projects', doc.projectId);
  const paid = (doc.payments || []).length > 0;
  const receipts = doc.type === 'invoice' ? (doc.payments || []).filter((p) => p.receiptId && find('docs', p.receiptId)).length : 0;

  const pickItems = () => {
    if (pick?.kind === 'customer') return [...state.customers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c) => ({ id: c.id, label: c.name || 'Sin nombre', sub: c.company || c.email || '', lead: <Person name={c.name} size="sm" /> }));
    if (pick?.kind === 'project')
      return state.projects
        .filter((p) => !doc.customerId || p.customerId === doc.customerId || p.id === doc.projectId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map((p) => ({ id: p.id, label: p.name || 'Sin nombre', sub: find('customers', p.customerId)?.name || 'Sin cliente', lead: <Briefcase className="size-4 text-muted" /> }));
    return [];
  };
  const pickExtra = () => {
    const row = (label, Icon, fn) => (
      <button type="button" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm hover:bg-default" onClick={() => { setPick(null); fn(); }}>
        <Icon className="size-4" />
        {label}
      </button>
    );
    if (pick?.kind === 'customer') return row('Nuevo cliente', Plus, () => setCreatingCustomer(true));
    if (pick?.kind === 'project' && doc.projectId) return row('Sin proyecto', Xmark, () => change(() => { doc.projectId = ''; }));
    return null;
  };

  const panelBody = open && (
    <>
      {open === 'style' && <Diseno doc={doc} change={change} />}
      {open === 'share' && <Compartir doc={doc} change={change} />}
      {open === 'pay' && <Pagos doc={doc} change={change} />}
    </>
  );
  const panelTitle = panels.find((p) => p.id === open)?.label;

  return (
    <div className="flex flex-col gap-4" data-v={v}>
      {/* La barra: de dónde viene, qué es, para quién y qué se puede hacer */}
      <div className="flex flex-wrap items-center gap-2 rounded-[1.75rem] bg-surface p-2 shadow-[var(--surface-shadow)] print:hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Tooltip delay={400}>
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Volver a ${LIST_NAME[doc.type]}`} onPress={() => go(LIST[doc.type])}>
              <ArrowLeft />
            </Button>
            <Tooltip.Content>Volver a {LIST_NAME[doc.type]}</Tooltip.Content>
          </Tooltip>
          {['invoice', 'quote'].includes(doc.type) && !locked ? (
            <Dropdown>
              <Button size="sm" variant="tertiary">
                <FileText />
                {TITLE[doc.type]}
                <ChevronDown className="size-3.5" />
              </Button>
              <Dropdown.Popover className="min-w-48">
                <Dropdown.Menu
                  aria-label="Tipo de documento"
                  selectionMode="single"
                  selectedKeys={new Set([doc.type])}
                  disabledKeys={paid ? ['quote'] : []}
                  onAction={(k) => k !== doc.type && changeType(String(k))}
                >
                  <Dropdown.Item id="invoice" textValue="Factura">
                    <Label>Factura</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                  <Dropdown.Item id="quote" textValue="Cotización">
                    <Label>Cotización{paid ? ' (tiene pagos)' : ''}</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : (
            <Chip variant="soft">{TITLE[doc.type]}</Chip>
          )}
          {doc.type === 'proposal' && !locked && (
            <Dropdown>
              <Button size="sm" variant="tertiary">
                <FileText />
                Plantilla
                <ChevronDown className="size-3.5" />
              </Button>
              <Dropdown.Popover className="min-w-60">
                <Dropdown.Menu aria-label="Empezar desde una plantilla" onAction={(k) => setAsk({ template: String(k) })}>
                  {Object.entries(PROPOSAL_TEMPLATES).map(([k, x]) => (
                    <Dropdown.Item key={k} id={k} textValue={x.label}>
                      <div className="flex flex-col">
                        <Label>{x.label}</Label>
                        <span className="text-xs text-muted">{x.title || 'Solo introducción y precio'}</span>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          <Chip size="sm" variant="soft" color={st[1]}>
            {st[0]}
          </Chip>
          {locked && (
            <Chip size="sm" variant="soft" color="success">
              <Lock className="size-3" />
              <Chip.Label>Firmada</Chip.Label>
            </Chip>
          )}
          {!isReceipt && !locked && (
            <>
              <Button size="sm" variant="tertiary" onPress={(e) => setPick({ at: below(e.target), kind: 'customer' })}>
                {who ? <Person name={who} size="sm" /> : <PersonIcon />}
                <span className="max-w-40 truncate">{who || 'Elegir cliente'}</span>
                <ChevronDown className="size-3.5" />
              </Button>
              {(state.projects.length > 0 || project) && (
                <Button size="sm" variant="tertiary" onPress={(e) => setPick({ at: below(e.target), kind: 'project' })}>
                  <Folder />
                  <span className="max-w-40 truncate">{project?.name || 'Sin proyecto'}</span>
                  <ChevronDown className="size-3.5" />
                </Button>
              )}
              <Dropdown>
                <Button size="sm" variant="tertiary" aria-label="Moneda">
                  {doc.currency}
                  {paid ? <Lock className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </Button>
                <Dropdown.Popover className="min-w-56">
                  <Dropdown.Menu
                    aria-label="Moneda"
                    selectionMode="single"
                    selectedKeys={new Set([doc.currency])}
                    disabledKeys={paid ? CURRENCY_CODES.filter((k) => k !== doc.currency) : []}
                    onAction={(k) => {
                      if (paid) return toast.warning('Esta factura ya tiene pagos en esta moneda. Para otra moneda, duplícala.');
                      return k !== doc.currency && change(() => changeCurrency(doc, String(k)));
                    }}
                  >
                    {CURRENCY_CODES.map((k) => (
                      <Dropdown.Item key={k} id={k} textValue={k}>
                        <Label>
                          {k} · {CURRENCIES[k].label}
                        </Label>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </>
          )}
          {locked && who && (
            <Chip size="sm" variant="secondary">
              {who}
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {panels.map((p) => (
            <BarButton key={p.id} label={p.label} icon={p.icon} isActive={open === p.id} onPress={() => setPanel(p.id)}>
              {p.wide ? <span className="hidden sm:inline">{p.label}</span> : null}
            </BarButton>
          ))}
          <BarButton label="Imprimir o PDF" icon={Printer} onPress={() => printDoc(doc)}>
            <span className="hidden md:inline">Imprimir o PDF</span>
          </BarButton>
          {primary ? (
            <ButtonGroup size="sm">
              <Button size="sm" onPress={() => run(primary.id, primary)}>
                {PrimaryIcon && <PrimaryIcon />}
                {primary.label}
              </Button>
              <Dropdown>
                {/* Dentro de un Dropdown el botón no hereda el estilo del grupo: va explícito. */}
                <Button size="sm" variant="primary" isIconOnly aria-label="Más acciones">
                  <ButtonGroup.Separator />
                  <ChevronDown />
                </Button>
                <Dropdown.Popover placement="bottom end" className="min-w-56">
                  <Dropdown.Menu aria-label="Más acciones" onAction={(k) => run(String(k), more.find((m) => m && m.id === k))}>
                    {menuNodes(more.filter(Boolean))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
          ) : (
            <Dropdown>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Más acciones">
                <EllipsisVertical />
              </Button>
              <Dropdown.Popover placement="bottom end" className="min-w-56">
                <Dropdown.Menu aria-label="Más acciones" onAction={(k) => run(String(k), more.find((m) => m && m.id === k))}>
                  {menuNodes(more.filter(Boolean))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm print:hidden">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>El cliente la firmó: el contenido ya no cambia. Puedes ver el enlace, imprimirla o convertirla en factura.</span>
        </div>
      )}

      <div className={`grid items-start gap-5 ${open && wide ? 'grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        {/* La hoja: se edita escribiendo sobre ella */}
        <div className="sw-print-area sw-sheet-edit flex min-w-0 justify-center pb-10">
          {locked ? (
            <div className="sw-sheet-stage w-full">
              <SheetPreview doc={doc} version={`${ver}-${v}`} />
            </div>
          ) : (
            <Hoja key={ver} doc={doc} touch={touch} redraw={redraw} />
          )}
        </div>

        {/* El panel de la derecha (en pantallas estrechas, un cajón) */}
        {open && wide && (
          <aside className="sticky top-24 flex max-h-[calc(100vh-7rem)] min-w-0 flex-col gap-4 overflow-y-auto rounded-[1.75rem] bg-surface p-4 shadow-[var(--surface-shadow)] print:hidden">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{panelTitle}</h2>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Cerrar el panel" onPress={() => setPanel(open)}>
                <Xmark />
              </Button>
            </div>
            {panelBody}
          </aside>
        )}
      </div>

      {!wide && (
        <Drawer isOpen={!!open} onOpenChange={(o) => !o && setPanel(open)}>
          <Drawer.Backdrop>
            <Drawer.Content placement="right">
              <Drawer.Dialog className="h-full w-full sm:max-w-[420px]">
                <Drawer.CloseTrigger />
                <Drawer.Header>
                  <Drawer.Heading>{panelTitle}</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body className="flex flex-col gap-4">{panelBody}</Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      )}

      <PointPicker
        at={pick?.at}
        items={pickItems()}
        placeholder={pick?.kind === 'project' ? 'Buscar proyecto…' : 'Buscar cliente…'}
        label={pick?.kind === 'project' ? 'Proyecto' : 'Cliente'}
        extra={pickExtra()}
        onClose={() => setPick(null)}
        onPick={(x) => {
          if (pick?.kind === 'customer') {
            const c = find('customers', x.id);
            if (c) change(() => setCustomer(doc, c));
          } else {
            const p = find('projects', x.id);
            change(() => {
              doc.projectId = x.id;
              const c = !doc.customerId && p?.customerId && find('customers', p.customerId);
              if (c) setCustomer(doc, c);
            });
          }
        }}
      />
      {creatingCustomer && <CustomerForm isOpen onOpenChange={setCreatingCustomer} onSaved={(c) => change(() => setCustomer(doc, c))} />}
      <ConfirmDialog
        open={ask === 'delete'}
        title={`¿Eliminar ${isReceipt ? 'el' : 'la'} ${`${TITLE[doc.type].toLowerCase()} ${doc.number || ''}`.trim()}?`}
        text={receipts ? `También se ${receipts === 1 ? 'borra su recibo' : `borran sus ${receipts} recibos`}.` : 'No se puede deshacer.'}
        confirm="Eliminar"
        onClose={() => setAsk(null)}
        onConfirm={() => destroy(doc)}
      />
      <ConfirmDialog
        open={!!ask?.template}
        status="accent"
        title={`¿Empezar desde «${PROPOSAL_TEMPLATES[ask?.template]?.label || ''}»?`}
        text="Se cambian el título, los bloques y las líneas de precio."
        confirm="Usar plantilla"
        onClose={() => setAsk(null)}
        onConfirm={() => change(() => applyTemplate(doc, ask.template))}
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
      <p className="text-sm text-muted sm:col-span-2">Empieza desde una plantilla con objetivos, alcance y calendario. Todo se puede cambiar en la propia hoja.</p>
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
