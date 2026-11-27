// La hoja interactiva de un documento: se edita escribiendo directamente sobre ella,
// como en el editor de siempre (negocio-doc.js). Los campos parecen texto hasta que
// se tocan; las líneas, los ajustes del total, la forma de cobro, las secciones del
// pie y los bloques de una propuesta se añaden, se ordenan y se quitan en la propia
// hoja. Lo que se imprime y lo que ve el cliente es esta misma hoja (las clases .sh-*
// y .pb-* de sheet.css), sin los controles (.no-print).
//
// Escribir solo actualiza el documento y las cifras (set → touch); los cambios de
// estructura (añadir una línea, quitar un impuesto…) vuelven a montar la hoja
// (change → redraw), igual que drawSheet() en la versión de siempre.
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, Box, Check, ChevronDown, Copy, EllipsisVertical, Grip, Picture, Plus, TrashBin, Wallet, Xmark } from '@gravity-ui/icons';
import { toast } from '@heroui/react';
import {
  CURRENCIES,
  CURRENCY_CODES,
  amountText,
  dateText,
  isSignable,
  methodLabel,
  money,
  numText,
  parseNum,
  pubOf,
  put,
  qr,
  round2,
  safeLink,
  snapshotPayment,
  state,
  strongest,
  taxOf,
  totals,
  uid,
  unitName,
} from '../../../negocio-core.js';
import { acceptance, accentColor } from '../../../negocio-sheet.js';
import { BLOCKS, block } from '../../../negocio-propuesta.js';
import { PointMenu } from '../../pro/ContextMenu.jsx';
import { PointPicker, below } from '../../kit/PointPicker.jsx';
import { ServiceForm } from '../screens/Catalogo.jsx';
import { PayForm } from '../screens/Ajustes.jsx';
import { pickImage } from './shared.jsx';

export const TITLE = { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo', proposal: 'Propuesta' };
const SECTION_TITLES = ['Términos y condiciones', 'Garantía', 'Información legal', 'Política de devoluciones', 'Confidencialidad'];
const RATE_SOURCES = ['BCV', 'Paralelo', 'Binance P2P', 'Acordada'];
const ITEM_FIELDS = {
  goals: { title: '', text: '' },
  scope: { title: '', text: '' },
  timeline: { when: '', title: '', text: '' },
  team: { name: '', role: '', text: '' },
  testimonials: { quote: '', name: '', role: '' },
  work: { title: '', text: '', image: '' },
};
const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/* ── Biblioteca (Ajustes › Biblioteca) ─────────────────────────────────── */

/** Guarda una sección en la biblioteca (o la actualiza si ya estaba). */
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

/** Un bloque de propuesta a la biblioteca: los de texto, como sección; el resto, enteros. */
function saveBlock(b) {
  if (b.kind === 'intro' || b.kind === 'text') {
    saveSection({ title: b.title, body: b.body });
    return;
  }
  const { id, ...rest } = structuredClone(b);
  const saved = [...(state.settings.savedBlocks || []), { id: uid(), label: b.title || BLOCKS[b.kind]?.label || 'Bloque', block: rest }];
  put('settings', { ...state.settings, savedBlocks: saved });
  toast.success('Bloque guardado: lo verás en «Añadir bloque» de cualquier propuesta');
}

/** Lo guardado que se puede añadir a una propuesta. */
function blockLibrary() {
  return [
    ...(state.settings.savedBlocks || []).map((x) => ({
      id: `saved:${x.id}`,
      label: x.label,
      make: () => ({ ...structuredClone(x.block), id: uid(), items: (x.block.items || []).map((it) => ({ ...it, id: uid() })) }),
    })),
    ...(state.settings.sections || []).map((x) => ({ id: `section:${x.id}`, label: x.title || 'Sin título', make: () => block('text', { title: x.title, body: x.body }) })),
  ];
}

/* ── Campos planos: parecen texto hasta que se tocan ───────────────────── */

const fit = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

function Flat({ value, onChange, className = '', placeholder, label, type = 'text', maxLength = 300 }) {
  return (
    <input
      className={`sh-in ${className}`.trim()}
      type={type}
      defaultValue={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      maxLength={maxLength}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

function FlatArea({ value, onChange, className = '', placeholder, label, maxLength = 8000 }) {
  const ref = useRef(null);
  useLayoutEffect(() => fit(ref.current));
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`sh-in ${className}`.trim()}
      defaultValue={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      maxLength={maxLength}
      onFocus={(e) => fit(e.currentTarget)}
      onChange={(e) => {
        fit(e.currentTarget);
        onChange(e.currentTarget.value);
      }}
    />
  );
}

function NumIn({ value, onChange, whole = false, label, className = '' }) {
  const show = (v) => (whole ? numText(v) : amountText(v));
  return (
    <input
      className={`sh-in is-num ${className}`.trim()}
      inputMode="decimal"
      defaultValue={show(value)}
      aria-label={label}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(parseNum(e.currentTarget.value))}
      onBlur={(e) => {
        e.currentTarget.value = show(parseNum(e.currentTarget.value));
      }}
    />
  );
}

function DateIn({ value, onChange, label }) {
  return (
    <span className="sh-date">
      <input type="date" className="sh-in sh-date-in" defaultValue={value || ''} aria-label={label} onChange={(e) => onChange(e.currentTarget.value)} />
      <span className="print-only">{dateText(value)}</span>
    </span>
  );
}

const Label = ({ children }) => <span className="sh-label">{children}</span>;

/** Pone un nodo del DOM (el QR, la firma del cliente) dentro de React. */
function DomNode({ make, deps, className = '' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = make();
    ref.current?.replaceChildren(...(node ? [node] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div ref={ref} className={className} />;
}

function Del({ label, onPress, className = '' }) {
  return (
    <button type="button" className={`sh-del no-print ${className}`.trim()} aria-label={label} title={label} onClick={onPress}>
      <Xmark />
    </button>
  );
}

/* ── La hoja ────────────────────────────────────────────────────────────── */

/**
 * doc: el documento; touch(): guarda y repinta las cifras; redraw(): guarda y vuelve a
 * montar la hoja (tras un cambio de estructura).
 */
export function Hoja({ doc, touch, redraw }) {
  const [menu, setMenu] = useState(null); // { at, items, onAction }
  const [pick, setPick] = useState(null); // { at, items, onPick, placeholder, extra }
  const [form, setForm] = useState(null); // { kind: 'service' | 'pay', prefill?, then? }
  const sheet = useRef(null);

  const set = (fn) => {
    fn();
    touch();
  };
  const change = (fn) => {
    fn();
    redraw();
  };
  const openMenu = (anchor, items, onAction) => setMenu({ at: below(anchor), items, onAction });
  const openPick = (anchor, opts) => setPick({ at: below(anchor), ...opts });

  const st = doc.style;
  const cur = doc.currency;
  const t = totals(doc);
  const isProposal = doc.type === 'proposal';
  const isReceipt = doc.type === 'receipt';
  const logo = state.settings.logo;

  /* Líneas */
  const addItem = (from) => {
    const item = { id: uid(), name: from?.name || '', description: from?.description || '', qty: 1, price: from?.price || 0, image: from?.image || '' };
    // Si la única línea está vacía, el servicio del catálogo ocupa su lugar.
    const blank = doc.items.length === 1 && !doc.items[0].name && !doc.items[0].price;
    change(() => {
      if (from && blank) doc.items = [item];
      else doc.items.push(item);
    });
    if (from?.currency && from.currency !== doc.currency) toast.warning(`Ese precio está en ${from.currency} y el documento en ${doc.currency}. Revísalo.`);
    // La hoja se vuelve a montar: el cursor va a la línea nueva cuando ya está pintada.
    if (!from) setTimeout(() => [...document.querySelectorAll('.sw-sheet-edit .sh-item .is-strong')].at(-1)?.focus(), 80);
  };
  const openCatalog = (anchor) =>
    openPick(anchor, {
      placeholder: 'Buscar en el catálogo…',
      items: state.catalog.map((it) => ({ id: it.id, label: it.name || 'Sin nombre', sub: [money(it.price, it.currency), it.description].filter(Boolean).join(' · '), item: it })),
      onPick: (x) => addItem(x.item),
      extra: (close) => (
        <button type="button" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm hover:bg-default" onClick={() => { close(); setForm({ kind: 'service', then: (it) => addItem(it) }); }}>
          <Plus className="size-4" />
          Nuevo servicio
        </button>
      ),
    });
  const lineMenu = (anchor, item, i) =>
    openMenu(
      anchor,
      [
        { id: 'image', label: item.image ? 'Cambiar la imagen' : 'Poner una imagen', icon: Picture },
        item.image && { id: 'noimage', label: 'Quitar la imagen', icon: Xmark },
        { id: 'dup', label: 'Duplicar línea', icon: Copy },
        { id: 'up', label: 'Subir', icon: ArrowUp, isDisabled: i === 0 },
        { id: 'down', label: 'Bajar', icon: ArrowDown, isDisabled: i === doc.items.length - 1 },
        { id: 'catalog', label: 'Guardar en el catálogo', icon: Box, isDisabled: !item.name?.trim() },
        '-',
        { id: 'remove', label: 'Quitar línea', icon: TrashBin, danger: true },
      ].filter(Boolean),
      (k) => {
        const move = (to) => change(() => { doc.items.splice(i, 1); doc.items.splice(to, 0, item); });
        if (k === 'image') pickImage((url) => change(() => { item.image = url; }));
        if (k === 'noimage') change(() => { item.image = ''; });
        if (k === 'dup') change(() => doc.items.splice(i + 1, 0, { ...structuredClone(item), id: uid() }));
        if (k === 'up') move(i - 1);
        if (k === 'down') move(i + 1);
        if (k === 'catalog') setForm({ kind: 'service', prefill: { name: item.name, description: item.description, price: item.price, currency: doc.currency, image: item.image || '' } });
        if (k === 'remove') change(() => { doc.items = doc.items.filter((x) => x !== item); });
      },
    );

  /* Forma de cobro */
  const payMenu = (anchor) => {
    const p = doc.payment;
    openMenu(
      anchor,
      [
        ...state.paytemplates.map((x) => ({ id: `tpl:${x.id}`, label: x.name || methodLabel(x.method), icon: p?.templateId === x.id ? Check : Wallet })),
        state.paytemplates.length ? '-' : null,
        { id: 'new', label: 'Nueva forma de cobro', icon: Plus },
        p && { id: 'none', label: 'Sin datos de pago', icon: Xmark },
      ].filter(Boolean),
      (k) => {
        if (k.startsWith('tpl:')) change(() => { doc.payment = snapshotPayment(state.paytemplates.find((x) => x.id === k.slice(4))); });
        if (k === 'new') setForm({ kind: 'pay', then: (tp) => change(() => { doc.payment = snapshotPayment(tp); }) });
        if (k === 'none') change(() => { doc.payment = null; });
      },
    );
  };

  /* Secciones */
  const sectionMenu = (anchor, s, i) =>
    openMenu(
      anchor,
      [
        { id: 'up', label: 'Subir', icon: ArrowUp, isDisabled: i === 0 },
        { id: 'down', label: 'Bajar', icon: ArrowDown, isDisabled: i === doc.sections.length - 1 },
        { id: 'save', label: 'Guardar en la biblioteca', icon: Bookmark, isDisabled: !`${s.title || ''}${s.body || ''}`.trim() },
        '-',
        { id: 'remove', label: 'Quitar sección', icon: TrashBin, danger: true },
      ],
      (k) => {
        const move = (to) => change(() => { doc.sections.splice(i, 1); doc.sections.splice(to, 0, s); });
        if (k === 'up') move(i - 1);
        if (k === 'down') move(i + 1);
        if (k === 'save') change(() => saveSection(s));
        if (k === 'remove') change(() => { doc.sections = doc.sections.filter((x) => x !== s); });
      },
    );
  const addSection = (title, body = '', libId = '') => {
    change(() => doc.sections.push({ id: uid(), title, body, libId }));
    setTimeout(() => [...document.querySelectorAll('.sw-sheet-edit .sh-section textarea')].at(-1)?.focus(), 80);
  };

  /* Bloques de propuesta */
  const addBlockMenu = (anchor) => {
    const library = blockLibrary();
    openMenu(
      anchor,
      [
        ...Object.entries(BLOCKS)
          .filter(([kind]) => kind !== 'pricing' || !(doc.blocks || []).some((b) => b.kind === 'pricing'))
          .map(([kind, def]) => ({ id: `kind:${kind}`, label: def.label })),
        library.length ? '-' : null,
        ...library.map((x) => ({ id: x.id, label: x.label, icon: Bookmark })),
      ].filter(Boolean),
      (k) =>
        change(() => {
          const lib = library.find((x) => x.id === k);
          doc.blocks = [...(doc.blocks || []), lib ? lib.make() : block(k.slice(5))];
        }),
    );
  };

  /* ── Piezas ── */

  const parties = () => {
    const f = doc.from;
    const c = doc.customer;
    return (
      <section className="sh-parties">
        <div className="sh-party">
          <Label>De</Label>
          <Flat value={f.name} onChange={(v) => set(() => { f.name = v; })} className="is-strong" placeholder="Tu nombre o empresa" label="Tu nombre" />
          <Flat value={f.taxId} onChange={(v) => set(() => { f.taxId = v; })} placeholder="RIF o cédula" label="Tu RIF" />
          <Flat value={f.email} onChange={(v) => set(() => { f.email = v; })} placeholder="Correo" label="Tu correo" />
          <Flat value={f.phone} onChange={(v) => set(() => { f.phone = v; })} placeholder="Teléfono" label="Tu teléfono" />
          <Flat value={f.website} onChange={(v) => set(() => { f.website = v; })} placeholder="Web" label="Tu web" />
          <FlatArea value={f.address} onChange={(v) => set(() => { f.address = v; })} placeholder="Dirección" label="Tu dirección" />
        </div>
        <div className="sh-party">
          <Label>{isSignable(doc) ? 'Preparada para' : isReceipt ? 'Recibido de' : 'Facturar a'}</Label>
          <Flat value={c.name} onChange={(v) => set(() => { c.name = v; })} className="is-strong" placeholder="Nombre del cliente" label="Nombre del cliente" />
          <Flat value={c.company} onChange={(v) => set(() => { c.company = v; })} placeholder="Empresa" label="Empresa del cliente" />
          <Flat value={c.taxId} onChange={(v) => set(() => { c.taxId = v; })} placeholder="RIF, cédula o NIF" label="RIF del cliente" />
          <Flat value={c.email} onChange={(v) => set(() => { c.email = v; })} placeholder="Correo" label="Correo del cliente" />
          <Flat value={c.phone} onChange={(v) => set(() => { c.phone = v; })} placeholder="Teléfono" label="Teléfono del cliente" />
          <FlatArea value={c.address} onChange={(v) => set(() => { c.address = v; })} placeholder="Dirección" label="Dirección del cliente" />
        </div>
        <div className="sh-dates">
          <Label>{isReceipt ? 'Fecha del pago' : 'Emisión'}</Label>
          <DateIn value={doc.issueDate} onChange={(v) => set(() => { doc.issueDate = v; })} label="Fecha de emisión" />
          {doc.type === 'invoice' && (
            <>
              <Label>Vence</Label>
              <DateIn value={doc.dueDate} onChange={(v) => set(() => { doc.dueDate = v; })} label="Fecha de vencimiento" />
            </>
          )}
          {isSignable(doc) && (
            <>
              <Label>Válida hasta</Label>
              <DateIn value={doc.validUntil} onChange={(v) => set(() => { doc.validUntil = v; })} label="Válida hasta" />
            </>
          )}
          {isReceipt && doc.invoiceNumber && (
            <>
              <Label>Factura</Label>
              <span className="sh-static">{doc.invoiceNumber}</span>
            </>
          )}
        </div>
      </section>
    );
  };

  const lines = () => <Lines doc={doc} set={set} change={change} onMenu={lineMenu} onAdd={() => addItem()} onCatalog={openCatalog} />;

  const receiptLines = () => (
    <section className="sh-items">
      <div className="sh-items-head">
        <span>Concepto</span>
        <span />
        <span />
        <span>Importe</span>
      </div>
      {doc.items.map((item) => (
        <div key={item.id} className="sh-item">
          <div className="sh-item-desc">
            <Flat value={item.name} onChange={(v) => set(() => { item.name = v; })} className="is-strong" label="Concepto" />
            <FlatArea value={item.description} onChange={(v) => set(() => { item.description = v; })} className="is-soft" placeholder="Referencia (opcional)" label="Referencia" />
          </div>
          <span />
          <span />
          <span className="sh-amount">{money(item.price, cur)}</span>
        </div>
      ))}
    </section>
  );

  const payBlock = () => {
    if (isReceipt)
      return (
        <div className="sh-pay">
          <Label>Forma de pago</Label>
          <b className="sh-static">{doc.method || 'Sin indicar'}</b>
          {doc.balanceAfter != null && (
            <>
              <Label>Saldo pendiente de la factura</Label>
              <span className="sh-static">{money(doc.balanceAfter, cur)}</span>
            </>
          )}
        </div>
      );
    const p = doc.payment;
    const link = p && safeLink(p.link);
    return (
      <div className="sh-pay">
        <Label>Datos de pago</Label>
        <button type="button" className="sh-chip no-print" onClick={(e) => payMenu(e.currentTarget)}>
          <Wallet />
          {p ? 'Cambiar forma de cobro' : 'Elegir forma de cobro'}
          <ChevronDown />
        </button>
        {p && (
          <>
            <Flat value={p.name} onChange={(v) => set(() => { p.name = v; })} className="is-strong" placeholder={methodLabel(p.method)} label="Forma de cobro" />
            <dl className="sh-kv">
              {(p.fields || []).map((f, i) => (
                <div key={i}>
                  <dt>
                    <Flat value={f.label} onChange={(v) => set(() => { f.label = v; })} label="Dato" />
                  </dt>
                  <dd>
                    <Flat value={f.value} onChange={(v) => set(() => { f.value = v; })} label={f.label || 'Valor'} />
                  </dd>
                </div>
              ))}
            </dl>
            <Flat value={p.link} onChange={(v) => set(() => { p.link = v; })} type="url" className="sh-link no-print" placeholder="Enlace de pago (opcional): https://…" label="Enlace de pago" />
            {link && (
              <div className="sh-qr-box">
                <DomNode className="sh-qr" make={() => qr(link)} deps={[link]} />
                <div className="sh-qr-text">
                  <b>Escanea para pagar</b>
                  <a className="sh-paybtn" href={link} target="_blank" rel="noopener noreferrer">
                    Pagar en línea
                  </a>
                  <small className="print-only">{link}</small>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const totalsBlock = () => {
    const sign = CURRENCIES[cur]?.sign || cur;
    const adj = (key, label, amount, onRemove) => (
      <div key={key} className="sh-row sh-adj">
        <span className="sh-adj-label">
          {label}
          <Del label="Quitar" onPress={() => change(onRemove)} />
        </span>
        <b>{amount}</b>
      </div>
    );
    const chips = isReceipt
      ? []
      : [
          !doc.discount && ['Descuento', () => { doc.discount = { type: 'percent', value: 10 }; }],
          !doc.tax && ['Impuesto', () => { doc.tax = taxOf(); }],
          !doc.withholding && ['Retención', () => { doc.withholding = { rate: 75, on: 'tax' }; }],
          !doc.shipping && ['Otro cargo', () => { doc.shipping = { label: 'Envío', amount: 0 }; }],
          !doc.equiv && ['Equivalencia', () => { doc.equiv = { currency: cur === 'VES' ? 'USD' : 'VES', rate: 0, source: 'BCV' }; }],
        ].filter(Boolean);
    const e = doc.equiv;
    let equivValue = null;
    if (e) {
      const v = e.rate > 0 ? (strongest(cur, e.currency) === cur ? t.total * e.rate : t.total / e.rate) : null;
      equivValue = v == null ? 'Falta la tasa' : money(round2(v), e.currency);
    }
    const strong = e && strongest(cur, e.currency);
    return (
      <div className="sh-totals">
        {!isReceipt && (
          <div className="sh-row">
            <span>Subtotal</span>
            <b>{money(t.subtotal, cur)}</b>
          </div>
        )}
        {doc.discount &&
          adj(
            'discount',
            <>
              <span>Descuento</span>
              <NumIn value={doc.discount.value} onChange={(v) => set(() => { doc.discount.value = v; })} label="Descuento" className="is-mini" />
              <button type="button" className="sh-unit" title="Cambiar entre porcentaje e importe" onClick={() => change(() => { doc.discount.type = doc.discount.type === 'amount' ? 'percent' : 'amount'; })}>
                {doc.discount.type === 'amount' ? sign : '%'}
              </button>
            </>,
            money(-t.discount, cur),
            () => { doc.discount = null; },
          )}
        {doc.tax &&
          adj(
            'tax',
            <>
              <Flat value={doc.tax.label} onChange={(v) => set(() => { doc.tax.label = v; })} className="is-mini is-label" label="Nombre del impuesto" />
              <NumIn value={doc.tax.rate} whole onChange={(v) => set(() => { doc.tax.rate = v; })} label="Porcentaje del impuesto" className="is-mini" />
              <span>%</span>
            </>,
            money(t.tax, cur),
            () => { doc.tax = null; },
          )}
        {doc.withholding &&
          adj(
            'withholding',
            <>
              <span>Retención</span>
              <NumIn value={doc.withholding.rate} whole onChange={(v) => set(() => { doc.withholding.rate = v; })} label="Porcentaje de retención" className="is-mini" />
              <span>%</span>
              <button type="button" className="sh-unit is-word" title="Calcular sobre la base o sobre el impuesto" onClick={() => change(() => { doc.withholding.on = doc.withholding.on === 'tax' ? 'base' : 'tax'; })}>
                {doc.withholding.on === 'tax' ? 'del impuesto' : 'de la base'}
              </button>
            </>,
            money(-t.withholding, cur),
            () => { doc.withholding = null; },
          )}
        {doc.shipping &&
          adj(
            'shipping',
            <>
              <Flat value={doc.shipping.label} onChange={(v) => set(() => { doc.shipping.label = v; })} className="is-mini is-label" label="Concepto del cargo" />
              <NumIn value={doc.shipping.amount} onChange={(v) => set(() => { doc.shipping.amount = v; })} label="Importe del cargo" className="is-mini" />
            </>,
            money(t.shipping, cur),
            () => { doc.shipping = null; },
          )}
        {chips.length > 0 && (
          <div className="sh-chips no-print">
            {chips.map(([text, run]) => (
              <button key={text} type="button" className="sh-chip is-dashed" onClick={() => change(run)}>
                <Plus />
                {text}
              </button>
            ))}
          </div>
        )}
        <div className="sh-grand">
          <span>{isReceipt ? 'Total recibido' : 'Total'}</span>
          <b>{money(t.total, cur)}</b>
        </div>
        {e && (
          <div className="sh-equiv">
            <div className="sh-row">
              <span className="sh-adj-label">
                <span>Equivale a</span>
                <select className="sh-pick no-print" aria-label="Moneda de la equivalencia" defaultValue={e.currency} onChange={(ev) => change(() => { e.currency = ev.target.value; })}>
                  {CURRENCY_CODES.filter((k) => k !== cur).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <Del label="Quitar equivalencia" onPress={() => change(() => { doc.equiv = null; })} />
              </span>
              <b>{equivValue}</b>
            </div>
            <div className="sh-rate">
              <span>1 {unitName(strong)} =</span>
              <NumIn value={e.rate} onChange={(v) => set(() => { e.rate = v; e.date = doc.issueDate; })} label="Tasa de cambio" className="is-mini" />
              <span>{unitName(strong === cur ? e.currency : cur)}</span>
              <select className="sh-pick no-print" aria-label="Fuente de la tasa" defaultValue={e.source} onChange={(ev) => set(() => { e.source = ev.target.value; })}>
                {RATE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="print-only">
                · {e.source}, {dateText(e.date || doc.issueDate)}
              </span>
            </div>
          </div>
        )}
        {doc.type === 'invoice' && (doc.payments || []).length > 0 && (
          <>
            <div className="sh-row is-soft">
              <span>Pagado</span>
              <b>{money(-t.paid, cur)}</b>
            </div>
            <div className="sh-row sh-due">
              <span>Saldo pendiente</span>
              <b>{money(t.due, cur)}</b>
            </div>
          </>
        )}
        {doc.signature !== false && (doc.from.signature || doc.from.name) && (
          <div className="sh-sign">
            <span className="sh-sign-name">{doc.from.signature || doc.from.name}</span>
            <small>{doc.from.name || ''}</small>
          </div>
        )}
      </div>
    );
  };

  const foot = () => (
    <div className="sh-foot">
      {payBlock()}
      {totalsBlock()}
    </div>
  );

  const sectionsBlock = () => {
    const library = state.settings.sections || [];
    const used = new Set(doc.sections.map((s) => s.title));
    return (
      <section className="sh-sections">
        {doc.sections.map((s, i) => (
          <div key={s.id || i} className="sh-section">
            <div className="sh-section-head">
              <Flat value={s.title} onChange={(v) => set(() => { s.title = v; })} className="sh-section-title" label="Título de la sección" />
              <button type="button" className="sh-del no-print" aria-label="Opciones de la sección" onClick={(e) => sectionMenu(e.currentTarget, s, i)}>
                <EllipsisVertical />
              </button>
            </div>
            <FlatArea value={s.body} onChange={(v) => set(() => { s.body = v; })} placeholder="Escribe aquí…" label={s.title || 'Sección'} />
          </div>
        ))}
        <div className="sh-chips no-print">
          {library.length > 0 && (
            <button
              type="button"
              className="sh-chip"
              onClick={(e) =>
                openPick(e.currentTarget, {
                  placeholder: 'Buscar en la biblioteca…',
                  items: library.map((x) => ({ id: x.id, label: x.title || 'Sin título', sub: (x.body || '').replace(/\s+/g, ' ').slice(0, 90), entry: x })),
                  onPick: (x) => addSection(x.entry.title, x.entry.body, x.entry.id),
                })
              }
            >
              <Bookmark />
              De la biblioteca
              <ChevronDown />
            </button>
          )}
          {[...SECTION_TITLES.filter((x) => !used.has(x)), 'Otra sección'].map((title) => (
            <button
              key={title}
              type="button"
              className="sh-chip is-dashed"
              onClick={() => {
                const saved = library.find((x) => x.title === title);
                const body = saved ? saved.body : title === 'Términos y condiciones' ? state.settings.terms || '' : '';
                addSection(title === 'Otra sección' ? '' : title, body, saved?.id || '');
              }}
            >
              <Plus />
              {title}
            </button>
          ))}
        </div>
      </section>
    );
  };

  const proposalBlocks = () => {
    const blocks = doc.blocks || [];
    return (
      <>
        {blocks.map((b, i) => (
          <ProposalBlock
            key={b.id}
            doc={doc}
            b={b}
            i={i}
            count={blocks.length}
            set={set}
            change={change}
            pricing={() => (
              <>
                {lines()}
                {foot()}
              </>
            )}
          />
        ))}
        <div className="pb-addblock no-print">
          <button type="button" className="sh-chip is-dashed" onClick={(e) => addBlockMenu(e.currentTarget)}>
            <Plus />
            Añadir bloque
            <ChevronDown />
          </button>
        </div>
      </>
    );
  };

  const response = isSignable(doc) ? pubOf(doc) : null;

  return (
    <>
      <article
        ref={sheet}
        className="ng-sheet"
        data-layout={st.layout}
        data-font={st.font}
        data-cover={st.cover}
        data-type={doc.type}
        style={{ '--accent': accentColor(st.accent), '--logo': `${Math.max(20, Math.min(120, Number(st.logoSize) || 44))}px` }}
      >
        {st.cover !== 'none' && (
          <div className="sh-cover" aria-hidden>
            <i />
            <i />
            <i />
          </div>
        )}
        <div className="sh-body">
          <header className="sh-top">
            {logo ? <img className="sh-logo" src={logo} alt={state.settings.name || ''} /> : <span className="sh-logo is-empty" />}
            <span className="sh-num">
              <span className="sh-hash">#</span>
              <span>{doc.number || 'Se numera al guardar'}</span>
            </span>
          </header>
          {isProposal ? (
            <FlatArea value={doc.title} onChange={(v) => set(() => { doc.title = v; })} className="sh-proposal-title" placeholder="Título de la propuesta" label="Título de la propuesta" maxLength={200} />
          ) : (
            <h1 className="sh-title">{TITLE[doc.type]}</h1>
          )}
          {parties()}
          {isProposal ? (
            proposalBlocks()
          ) : (
            <>
              {isReceipt ? receiptLines() : lines()}
              {foot()}
            </>
          )}
          <FlatArea value={doc.notes} onChange={(v) => set(() => { doc.notes = v; })} className="sh-notes" placeholder="Nota para el cliente (opcional)" label="Nota" />
          {!isReceipt && sectionsBlock()}
          {response && <DomNode className="contents" make={() => acceptance(response)} deps={[response?.acceptedAt, response?.declinedAt]} />}
        </div>
      </article>

      <PointMenu
        at={menu?.at}
        items={menu?.items || []}
        label="Opciones"
        onClose={() => setMenu(null)}
        onAction={(k) => menu?.onAction(k)}
      />
      <PointPicker
        at={pick?.at}
        items={pick?.items || []}
        placeholder={pick?.placeholder}
        label={pick?.placeholder || 'Buscar'}
        extra={pick?.extra ? pick.extra(() => setPick(null)) : null}
        onClose={() => setPick(null)}
        onPick={(x) => pick?.onPick(x)}
      />
      {form?.kind === 'service' && <ServiceForm prefill={form.prefill} onClose={() => setForm(null)} onSaved={(it) => form.then?.(it)} />}
      {form?.kind === 'pay' && <PayForm onClose={() => setForm(null)} onSaved={(tp) => form.then?.(tp)} />}
    </>
  );
}

/* ── Las líneas: cada una con su foto, y se reordenan arrastrando su asa ── */

function Lines({ doc, set, change, onMenu, onAdd, onCatalog }) {
  const [dragId, setDragId] = useState(null);
  const [dropAt, setDropAt] = useState(-1);
  const box = useRef(null);
  const cur = doc.currency;
  const indexAt = (e) => {
    const rows = [...(box.current?.querySelectorAll('.sh-item:not(.is-dragging)') || [])];
    const next = rows.findIndex((r) => {
      const rect = r.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });
    const id = next < 0 ? null : rows[next].dataset.id;
    return id ? doc.items.findIndex((x) => x.id === id) : doc.items.length;
  };
  return (
    <section
      ref={box}
      className="sh-items"
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const to = indexAt(e);
        if (to !== dropAt) setDropAt(to);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(-1);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const item = dragId && doc.items.find((x) => x.id === dragId);
        const to = indexAt(e);
        setDragId(null);
        setDropAt(-1);
        if (!item) return;
        const nextId = doc.items[to]?.id;
        if (nextId === item.id) return;
        change(() => {
          doc.items = doc.items.filter((x) => x !== item);
          const at = nextId ? doc.items.findIndex((x) => x.id === nextId) : doc.items.length;
          doc.items.splice(at < 0 ? doc.items.length : at, 0, item);
        });
      }}
    >
      <div className="sh-items-head">
        <span>Descripción</span>
        <span>Cant.</span>
        <span>Precio</span>
        <span>Importe</span>
      </div>
      {doc.items.map((item, i) => (
        <Fragment key={item.id}>
          {dropAt === i && dragId && <div className="sh-drop no-print" aria-hidden />}
          <div className={`sh-item${dragId === item.id ? ' is-dragging' : ''}`} data-id={item.id}>
            <button
              type="button"
              className="sh-handle no-print"
              draggable
              aria-label="Mover la línea u otras opciones"
              title="Arrastra para mover · toca para ver opciones"
              onClick={(e) => onMenu(e.currentTarget, item, i)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
                const row = e.currentTarget.closest('.sh-item');
                if (row) e.dataTransfer.setDragImage(row, 24, 20);
                setTimeout(() => setDragId(item.id));
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropAt(-1);
              }}
            >
              <Grip />
            </button>
            <div className={`sh-item-desc${item.image ? ' has-media' : ''}`}>
              {item.image && (
                <div className="sh-item-media">
                  <img src={item.image} alt="" />
                  <button type="button" className="sh-media-x no-print" aria-label="Quitar la imagen" title="Quitar la imagen" onClick={() => change(() => { item.image = ''; })}>
                    <Xmark />
                  </button>
                </div>
              )}
              <div className="sh-item-fields">
                <Flat value={item.name} onChange={(v) => set(() => { item.name = v; })} className="is-strong" placeholder="Concepto" label="Concepto" />
                <FlatArea value={item.description} onChange={(v) => set(() => { item.description = v; })} className="is-soft" placeholder="Detalle (opcional)" label="Detalle" />
              </div>
            </div>
            <NumIn value={item.qty} whole onChange={(v) => set(() => { item.qty = v; })} label="Cantidad" />
            <NumIn value={item.price} onChange={(v) => set(() => { item.price = v; })} label="Precio" />
            <span className="sh-amount">{money((Number(item.qty) || 0) * (Number(item.price) || 0), cur)}</span>
            <Del label="Quitar línea" onPress={() => change(() => { doc.items = doc.items.filter((x) => x !== item); })} />
          </div>
        </Fragment>
      ))}
      {dropAt === doc.items.length && dragId && <div className="sh-drop no-print" aria-hidden />}
      <div className="sh-adds no-print">
        <button type="button" className="sh-add" onClick={onAdd}>
          <Plus />
          Añadir línea
        </button>
        <button type="button" className="sh-add" onClick={(e) => onCatalog(e.currentTarget)}>
          <Box />
          Del catálogo
        </button>
      </div>
    </section>
  );
}

/* ── Un bloque de propuesta, editable en la hoja ─────────────────────────── */

function ProposalBlock({ doc, b, i, count, set, change, pricing }) {
  const items = b.items || [];
  const F = (obj, key, opts) => <Flat value={obj[key]} onChange={(v) => set(() => { obj[key] = v; })} {...opts} />;
  const A = (obj, key, opts) => <FlatArea value={obj[key]} onChange={(v) => set(() => { obj[key] = v; })} {...opts} />;
  const removeItem = (it) => <Del label="Quitar" className="pb-item-del" onPress={() => change(() => { b.items = b.items.filter((x) => x !== it); })} />;
  const addItem = () => (
    <button
      type="button"
      className="sh-add no-print pb-add"
      onClick={() =>
        change(() => {
          const last = items[items.length - 1];
          const fields = { ...ITEM_FIELDS[b.kind] };
          if (b.kind === 'timeline') fields.when = last && /^Semana\s+(\d+)$/i.test(last.when) ? `Semana ${Number(last.when.match(/\d+/)[0]) + 1}` : `Semana ${items.length + 1}`;
          b.items = [...items, { id: uid(), ...fields }];
        })
      }
    >
      <Plus />
      Añadir
    </button>
  );
  const move = (step) =>
    change(() => {
      const j = i + step;
      [doc.blocks[i], doc.blocks[j]] = [doc.blocks[j], doc.blocks[i]];
    });

  let body = null;
  switch (b.kind) {
    case 'intro':
    case 'text':
      body = A(b, 'body', { className: 'pb-body', placeholder: 'Cuenta en dos o tres frases qué vas a hacer y por qué.', label: b.title || 'Texto' });
      break;
    case 'goals':
      body = (
        <>
          <ol className="pb-goals">
            {items.map((it, n) => (
              <li key={it.id}>
                <span className="pb-num">{n + 1}</span>
                <div>
                  {F(it, 'title', { className: 'pb-strong', placeholder: 'Objetivo', label: 'Objetivo' })}
                  {A(it, 'text', { className: 'is-soft', placeholder: 'Cómo se nota que se cumplió', label: 'Detalle del objetivo' })}
                </div>
                {removeItem(it)}
              </li>
            ))}
          </ol>
          {addItem()}
        </>
      );
      break;
    case 'scope':
      body = (
        <>
          <div className="pb-grid">
            {items.map((it) => (
              <div key={it.id} className="pb-cell">
                {F(it, 'title', { className: 'pb-strong', placeholder: 'Qué', label: 'Parte del alcance' })}
                {A(it, 'text', { className: 'is-soft', placeholder: 'En qué consiste', label: 'Detalle' })}
                {removeItem(it)}
              </div>
            ))}
          </div>
          {addItem()}
        </>
      );
      break;
    case 'timeline':
      body = (
        <>
          <ol className="pb-timeline">
            {items.map((it) => (
              <li key={it.id}>
                {F(it, 'when', { className: 'pb-when', placeholder: 'Semana 1', label: 'Cuándo' })}
                {F(it, 'title', { className: 'pb-strong', placeholder: 'Fase', label: 'Fase' })}
                {A(it, 'text', { className: 'is-soft', placeholder: 'Qué pasa en esta fase', label: 'Detalle de la fase' })}
                {removeItem(it)}
              </li>
            ))}
          </ol>
          {addItem()}
        </>
      );
      break;
    case 'team':
      body = (
        <>
          <div className="pb-team">
            {items.map((it) => (
              <div key={it.id} className="pb-person">
                <span className="pb-avatar">{initials(it.name)}</span>
                {F(it, 'name', { className: 'pb-strong', placeholder: 'Nombre', label: 'Nombre' })}
                {F(it, 'role', { className: 'is-soft', placeholder: 'Papel', label: 'Papel' })}
                {A(it, 'text', { className: 'is-soft', placeholder: 'Experiencia en una frase', label: 'Experiencia' })}
                {removeItem(it)}
              </div>
            ))}
          </div>
          {addItem()}
        </>
      );
      break;
    case 'testimonials':
      body = (
        <>
          <div className="pb-quotes">
            {items.map((it) => (
              <figure key={it.id} className="pb-quote">
                {A(it, 'quote', { className: 'pb-quote-text', placeholder: '«Lo que dijo»', label: 'Testimonio' })}
                <figcaption>
                  {F(it, 'name', { className: 'pb-strong', placeholder: 'Nombre', label: 'Quién lo dijo' })}
                  {F(it, 'role', { className: 'is-soft', placeholder: 'Cargo y empresa', label: 'Cargo' })}
                </figcaption>
                {removeItem(it)}
              </figure>
            ))}
          </div>
          {addItem()}
        </>
      );
      break;
    case 'work':
      body = (
        <>
          <div className="pb-work">
            {items.map((it) => (
              <figure key={it.id} className="pb-shot">
                {it.image ? (
                  <img src={it.image} alt={it.title || ''} />
                ) : (
                  <span className="pb-shot-empty no-print">
                    <Picture />
                  </span>
                )}
                <button type="button" className="sh-chip no-print pb-shot-pick" onClick={() => pickImage((url) => change(() => { it.image = url; }))}>
                  <Picture />
                  {it.image ? 'Cambiar imagen' : 'Poner imagen'}
                </button>
                {F(it, 'title', { className: 'pb-strong', placeholder: 'Proyecto', label: 'Proyecto' })}
                {A(it, 'text', { className: 'is-soft', placeholder: 'Qué se hizo y qué se logró', label: 'Resultado' })}
                {removeItem(it)}
              </figure>
            ))}
          </div>
          {addItem()}
        </>
      );
      break;
    case 'image':
      body = (
        <figure className="pb-figure">
          {b.image ? (
            <img src={b.image} alt={b.caption || b.title || ''} />
          ) : (
            <button type="button" className="pb-figure-empty no-print" onClick={() => pickImage((url) => change(() => { b.image = url; }))}>
              <Picture />
              Subir una imagen
            </button>
          )}
          {b.image && (
            <button type="button" className="sh-chip no-print pb-shot-pick" onClick={() => pickImage((url) => change(() => { b.image = url; }))}>
              <Picture />
              Cambiar imagen
            </button>
          )}
          {F(b, 'caption', { className: 'pb-caption is-soft', placeholder: 'Pie de foto (opcional)', label: 'Pie de foto' })}
        </figure>
      );
      break;
    case 'pricing':
      body = pricing();
      break;
    default:
      body = null;
  }

  return (
    <section className={`pb pb--${b.kind}`}>
      <header className="pb-head">
        {F(b, 'title', { className: 'pb-title', placeholder: BLOCKS[b.kind]?.label || 'Título', label: 'Título del bloque' })}
        <span className="pb-tools no-print">
          <button type="button" className={`ng-ibtn${i === 0 ? ' is-hidden' : ''}`} aria-label="Subir bloque" title="Subir bloque" onClick={() => move(-1)}>
            <ArrowUp />
          </button>
          <button type="button" className={`ng-ibtn${i === count - 1 ? ' is-hidden' : ''}`} aria-label="Bajar bloque" title="Bajar bloque" onClick={() => move(1)}>
            <ArrowDown />
          </button>
          {b.kind !== 'pricing' && (
            <button type="button" className="ng-ibtn" aria-label="Guardar en la biblioteca" title="Guardar en la biblioteca" onClick={() => saveBlock(b)}>
              <Bookmark />
            </button>
          )}
          <button type="button" className="ng-ibtn" aria-label="Quitar bloque" title="Quitar bloque" onClick={() => change(() => { doc.blocks = doc.blocks.filter((x) => x !== b); })}>
            <TrashBin />
          </button>
        </span>
      </header>
      {body}
    </section>
  );
}
