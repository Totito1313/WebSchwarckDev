// Dinero › Gastos: cada gasto con su proveedor, categoría, recibo y, si no está en
// la moneda principal, la tasa del día del pago (con la que se pasa para siempre).
// Las cuentas son las de negocio-gastos.js, las mismas del panel de siempre.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Paperclip, Plus, TrashBin, Wallet } from '@gravity-ui/icons';
import {
  Avatar,
  Button,
  ButtonGroup,
  Chip,
  ComboBox,
  Input,
  Label,
  ListBox,
  Meter,
  SearchField,
  Tabs,
  TextArea,
  TextField,
  Description,
  toast,
} from '@heroui/react';
import { CURRENCIES, convert, dateText, find, monthText, put, remove, round2, strongest, todayISO, uid, unitName } from '../../../negocio-core.js';
import {
  PERIODS,
  SOURCES as RATE_SOURCES,
  cleanDomain,
  deleteFile,
  ensureCategories,
  expenseBase,
  fileUrl,
  sortedCategories,
} from '../../../negocio-gastos.js';
import { Empty, PageHeader, Panel, Stat } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { base, change, fmt, money, periodRange, spent, within } from '../domain.js';
import { AmountField, ConfirmButton, DateInput, FormModal, SelectField, currencyOptions } from '../fields.jsx';
import { UploadButton } from '../upload.jsx';

// Los colores de las categorías se guardan por nombre (los de CeroFiao).
const COLORS = ['cyan', 'blue', 'violet', 'bs', 'income', 'usdt', 'expense', 'body'];
const HEX = { cyan: '#00b8d4', blue: '#387aff', violet: '#8e5bd6', bs: '#f97316', income: '#34c759', usdt: '#d9a406', expense: '#ff3b30', body: '#8a9096' };
const catHex = (c) => HEX[c?.color] || HEX.body;
const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function VendorMark({ name, domain }) {
  return (
    <Avatar size="sm" variant="soft" className="shrink-0">
      {domain && <Avatar.Image alt="" src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} referrerPolicy="no-referrer" />}
      <Avatar.Fallback>{(name || '?').slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
}

/** El proveedor se crea solo al escribir su nombre; si cambia su web o su categoría, se pone al día. */
function upsertVendor(name, domain, categoryId, vendors) {
  const clean = name.trim();
  if (!clean) return '';
  const found = vendors.find((v) => v.name.toLowerCase() === clean.toLowerCase());
  if (!found) {
    const vendor = { id: uid(), name: clean, domain, categoryId };
    put('vendors', vendor);
    return vendor.id;
  }
  if ((domain && domain !== found.domain) || (categoryId && categoryId !== found.categoryId)) put('vendors', { ...found, domain: domain || found.domain || '', categoryId: categoryId || found.categoryId || '' });
  return found.id;
}

export function ExpenseForm({ expense, onClose }) {
  const [state] = useCrm();
  const cats = sortedCategories();
  const [x] = useState(() =>
    expense
      ? structuredClone(expense)
      : { id: uid(), title: '', amount: 0, currency: base(), rate: 0, rateSource: 'BCV', vendorId: '', vendor: '', categoryId: cats[0]?.id || '', date: todayISO(), method: '', notes: '', receipt: null },
  );
  const vendor0 = x.vendorId ? find('vendors', x.vendorId) : null;
  const [amount, setAmount] = useState(Number(x.amount) || 0);
  const [currency, setCurrency] = useState(x.currency || base());
  const [rate, setRate] = useState(Number(x.rate) || 0);
  const [source, setSource] = useState(x.rateSource || 'BCV');
  const [date, setDate] = useState(x.date || todayISO());
  const [categoryId, setCategoryId] = useState(x.categoryId || '');
  const [vendorName, setVendorName] = useState(vendor0?.name || x.vendor || '');
  const [domain, setDomain] = useState(vendor0?.domain || '');
  const [receipt, setReceipt] = useState(x.receipt || null);
  const [error, setError] = useState('');
  const needsRate = currency !== base();
  const strong = strongest(currency, base());
  const inBase = needsRate ? convert(amount, currency, base(), rate) : null;
  // Las categorías se proponen la primera vez: si llegan con la ventana abierta, se elige la primera.
  useEffect(() => {
    if (!expense && !categoryId && cats[0]) setCategoryId(cats[0].id);
  }, [cats.length]);

  return (
    <FormModal
      title={expense ? 'Editar gasto' : 'Nuevo gasto'}
      submit="Guardar gasto"
      onClose={onClose}
      extra={
        expense && (
          <ConfirmButton
            title={`¿Eliminar «${expense.title}»?`}
            text={expense.receipt ? 'Se borra también su recibo.' : undefined}
            onConfirm={() => {
              if (expense.receipt) deleteFile(expense.receipt.id);
              remove('expenses', expense.id);
              onClose();
            }}
            isIconOnly
            ariaLabel="Eliminar gasto"
          >
            <TrashBin />
          </ConfirmButton>
        )
      }
      onSubmit={(f) => {
        const title = String(f.title || '').trim();
        if (!title) return setError('Escribe el concepto.') || false;
        if (!(amount > 0)) return setError('Escribe un importe mayor que cero.') || false;
        if (needsRate && !(rate > 0)) return setError(`Falta la tasa del día para pasarlo a ${base()}.`) || false;
        if (x.receipt && receipt?.id !== x.receipt.id) deleteFile(x.receipt.id);
        const cleanCat = find('categories', categoryId) ? categoryId : '';
        put('expenses', {
          ...x,
          title,
          amount: round2(amount),
          currency,
          rate: needsRate ? rate : 0,
          rateBase: needsRate ? base() : '',
          rateSource: needsRate ? source : '',
          date: date || todayISO(),
          categoryId: cleanCat,
          method: String(f.method || '').trim(),
          notes: String(f.notes || '').trim(),
          vendor: vendorName.trim(),
          vendorId: upsertVendor(vendorName, cleanDomain(domain), cleanCat, state.vendors || []),
          receipt,
        });
        toast.success(expense ? 'Gasto guardado' : 'Gasto añadido');
        return true;
      }}
    >
      <TextField name="title" isRequired defaultValue={x.title} maxLength={120} autoFocus className="sm:col-span-2">
        <Label>Concepto</Label>
        <Input placeholder="Suscripción de Figma" />
      </TextField>
      <AmountField label="Importe" value={amount} onChange={(n) => { setAmount(n); setError(''); }} />
      <SelectField label="Moneda" value={currency} onChange={setCurrency} options={currencyOptions(CURRENCIES)} />
      {needsRate && (
        <>
          <AmountField
            label={`Tasa del día: 1 ${unitName(strong)} = … ${unitName(strong === currency ? base() : currency)}`}
            value={rate}
            onChange={(n) => { setRate(n); setError(''); }}
            description={inBase == null ? 'Con ella se pasa a tu moneda principal; no cambia aunque cambie la tasa.' : `Son ${money(round2(inBase), base())}.`}
          />
          <SelectField label="Fuente de la tasa" value={source} onChange={setSource} options={RATE_SOURCES.map((s) => [s, s])} />
        </>
      )}
      <DateInput label="Fecha del pago" value={date} onChange={setDate} />
      <SelectField label="Categoría" value={categoryId} onChange={setCategoryId} options={cats.map((c) => [c.id, c.name])} placeholder="Sin categoría" />
      <ComboBox
        allowsCustomValue
        inputValue={vendorName}
        onInputChange={setVendorName}
        onSelectionChange={(id) => {
          const v = id && find('vendors', String(id));
          if (!v) return;
          setVendorName(v.name);
          if (v.domain) setDomain(v.domain);
          if (!expense && v.categoryId && find('categories', v.categoryId)) setCategoryId(v.categoryId);
        }}
      >
        <Label>Proveedor</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Figma" />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox renderEmptyState={() => <p className="p-3 text-sm text-muted">Se crea al guardar.</p>}>
            {(state.vendors || []).map((v) => (
              <ListBox.Item key={v.id} id={v.id} textValue={v.name}>
                {v.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <TextField value={domain} onChange={setDomain} maxLength={120}>
        <Label>Web del proveedor</Label>
        <Input placeholder="figma.com" />
        <Description>Con ella se ve su logo.</Description>
      </TextField>
      <TextField name="method" defaultValue={x.method} maxLength={60}>
        <Label>Forma de pago</Label>
        <Input placeholder="Tarjeta, Zelle, efectivo…" />
      </TextField>
      <div className="flex flex-col gap-1">
        <Label>Recibo</Label>
        <div className="flex flex-wrap items-center gap-2">
          <UploadButton accept="image/png,image/jpeg,image/webp,application/pdf" onUploaded={(m) => setReceipt({ id: m.id, type: m.type, name: m.name, size: m.size })}>
            {receipt ? 'Cambiar' : 'Subir foto o PDF'}
          </UploadButton>
          {receipt && (
            <>
              <a href={fileUrl(receipt.id)} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Ver
              </a>
              <Button size="sm" variant="ghost" onPress={() => setReceipt(null)}>
                Quitar
              </Button>
            </>
          )}
        </div>
      </div>
      <TextField name="notes" defaultValue={x.notes} maxLength={2000} className="sm:col-span-2">
        <Label>Notas</Label>
        <TextArea rows={2} />
      </TextField>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </FormModal>
  );
}

function Categorias() {
  const [state] = useCrm();
  const cats = sortedCategories(true);
  const uses = (id) => (state.expenses || []).filter((e) => e.categoryId === id).length;
  const move = (i, step) => {
    const other = cats[i + step];
    if (!other) return;
    const before = new Map(cats.map((c) => [c.id, c.order]));
    cats.forEach((c, k) => {
      c.order = k;
    });
    [cats[i].order, other.order] = [other.order, cats[i].order];
    for (const c of cats) if (before.get(c.id) !== c.order) put('categories', c);
  };
  return (
    <Panel
      title="Categorías"
      description="Archivar una la quita del formulario sin tocar los gastos que ya la usan."
      action={
        <Button
          size="sm"
          onPress={() => put('categories', { id: uid(), name: 'Nueva categoría', color: COLORS[cats.length % COLORS.length], order: Math.max(-1, ...cats.map((c) => c.order ?? 0)) + 1, archived: false })}
        >
          <Plus />
          Nueva
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {cats.map((c, i) => {
          const n = uses(c.id);
          return (
            <li key={c.id} className={`flex flex-wrap items-center gap-2 rounded-2xl bg-surface-secondary p-2 ${c.archived ? 'opacity-60' : ''}`}>
              <button
                type="button"
                aria-label="Cambiar color"
                className="size-6 shrink-0 rounded-full ring-2 ring-surface"
                style={{ background: catHex(c) }}
                onClick={() => put('categories', { ...c, color: COLORS[(COLORS.indexOf(c.color) + 1) % COLORS.length] })}
              />
              <TextField aria-label="Nombre" defaultValue={c.name} onChange={(t) => put('categories', { ...c, name: t })} maxLength={60} className="min-w-40 flex-1">
                <Input variant="secondary" />
              </TextField>
              <span className="text-xs text-muted">{n ? `${n} ${n === 1 ? 'gasto' : 'gastos'}` : 'Sin gastos'}</span>
              <ButtonGroup size="sm" variant="ghost">
                <Button isIconOnly aria-label="Subir" isDisabled={i === 0} onPress={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button isIconOnly aria-label="Bajar" isDisabled={i === cats.length - 1} onPress={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button onPress={() => put('categories', { ...c, archived: !c.archived })}>{c.archived ? 'Activar' : 'Archivar'}</Button>
                {!n && (
                  <Button isIconOnly aria-label="Borrar" onPress={() => remove('categories', c.id)}>
                    <TrashBin />
                  </Button>
                )}
              </ButtonGroup>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Gastos({ tab }) {
  const [state, v] = useCrm();
  const [period, setPeriod] = useState(() => localStorage.getItem('negocio-periodo') || 'year');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const isNew = tab === 'nuevo';
  const view = tab === 'categorias' ? 'categorias' : 'gastos';
  // La primera vez se proponen unas categorías (como en el panel de siempre).
  useEffect(() => ensureCategories(), []);

  const data = useMemo(() => {
    const r = periodRange(period);
    const now = spent(r);
    const prev = r.prev ? spent(r.prev) : null;
    const list = (state.expenses || []).filter((e) => within(e.date, r));
    const byCat = new Map();
    for (const e of list) {
      const val = expenseBase(e);
      if (val != null) byCat.set(e.categoryId || '', (byCat.get(e.categoryId || '') || 0) + val);
    }
    const q = plain(query.trim());
    const shown = list
      .filter((e) => !q || plain(`${e.title} ${e.vendor} ${e.notes} ${e.method}`).includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const months = new Map();
    for (const e of shown) {
      const k = (e.date || todayISO()).slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(e);
    }
    return { now, delta: prev ? change(now.sum, prev.sum) : null, count: list.length, byCat: [...byCat].sort((a, b) => b[1] - a[1]), months: [...months] };
  }, [state, v, period, query]);

  const top = data.byCat[0];
  const close = () => {
    setAdding(false);
    setEditing(null);
    if (isNew) go('#/gastos');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Dinero"
        title="Gastos"
        description="Lo que sale, con su recibo. En otra moneda, con la tasa del día."
        actions={
          <Button onPress={() => setAdding(true)}>
            <Plus />
            Nuevo gasto
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs selectedKey={view} onSelectionChange={(k) => go(k === 'gastos' ? '#/gastos' : '#/gastos/categorias')}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Gastos">
              <Tabs.Tab id="gastos">
                Gastos
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="categorias">
                Categorías
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {view === 'gastos' && (
          <Tabs
            variant="secondary"
            selectedKey={period}
            onSelectionChange={(k) => {
              setPeriod(String(k));
              localStorage.setItem('negocio-periodo', String(k));
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Periodo">
                {PERIODS.map(([k, label]) => (
                  <Tabs.Tab key={k} id={k}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        )}
      </div>

      {view === 'categorias' ? (
        <Categorias />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Gastado" value={fmt(data.now.sum)} delta={data.delta} upIsGood={false} sub={data.now.skipped ? `${data.now.skipped} sin tasa` : `${data.count} gastos`} />
            <Stat label="Mayor categoría" value={top ? find('categories', top[0])?.name || 'Sin categoría' : '—'} sub={top ? fmt(top[1]) : 'Sin gastos'} />
            <Stat label="Proveedores" value={String((state.vendors || []).length)} sub="Se crean solos" />
            <Stat label="Con recibo" value={`${(state.expenses || []).filter((e) => e.receipt).length}`} icon={Paperclip} sub={`de ${(state.expenses || []).length} gastos`} />
          </div>
          {data.byCat.length > 0 && (
            <Panel title="Por categoría">
              <div className="grid gap-3 sm:grid-cols-2">
                {data.byCat.map(([id, sum]) => {
                  const c = find('categories', id);
                  return (
                    <Meter key={id || 'none'} value={data.now.sum ? (sum / data.now.sum) * 100 : 0} size="sm" aria-label={c?.name || 'Sin categoría'}>
                      <Label className="text-sm">{c?.name || 'Sin categoría'}</Label>
                      <Meter.Output className="text-sm tabular-nums">{fmt(sum)}</Meter.Output>
                      <Meter.Track>
                        <Meter.Fill style={{ background: catHex(c) }} />
                      </Meter.Track>
                    </Meter>
                  );
                })}
              </div>
            </Panel>
          )}
          <SearchField aria-label="Buscar gastos" value={query} onChange={setQuery} className="w-full sm:max-w-sm">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Concepto, proveedor o nota…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {data.months.length === 0 ? (
            <Empty icon={Wallet} title={(state.expenses || []).length ? 'Nada en este periodo' : 'Todavía no hay gastos'} text="Apunta lo que pagas con su recibo y sabrás cuánto te queda de verdad." action={<Button onPress={() => setAdding(true)}>Nuevo gasto</Button>} />
          ) : (
            data.months.map(([key, list]) => (
              <Panel key={key} title={monthText(key)} description={fmt(list.reduce((s, e) => s + (expenseBase(e) || 0), 0))}>
                <ul className="flex flex-col">
                  {list.map((e) => {
                    const c = e.categoryId && find('categories', e.categoryId);
                    const vd = e.vendorId && find('vendors', e.vendorId);
                    const b = expenseBase(e);
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start hover:bg-surface-secondary">
                          <VendorMark name={vd?.name || e.vendor || e.title} domain={vd?.domain} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{e.title}</span>
                            <span className="truncate text-xs text-muted">{[vd?.name || e.vendor, e.method, dateText(e.date)].filter(Boolean).join(' · ')}</span>
                          </span>
                          {c && (
                            <Chip size="sm" variant="secondary" className="hidden sm:inline-flex">
                              <span className="size-1.5 rounded-full" style={{ background: catHex(c) }} />
                              <Chip.Label>{c.name}</Chip.Label>
                            </Chip>
                          )}
                          {e.receipt && <Paperclip className="size-4 text-muted" aria-label="Tiene recibo" />}
                          <span className="flex w-28 flex-col items-end">
                            <span className="text-sm tabular-nums">{money(-e.amount, e.currency)}</span>
                            {e.currency !== base() && <span className="text-xs text-muted">{b == null ? 'Sin tasa' : `≈ ${money(-b, base())}`}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))
          )}
        </>
      )}
      {(adding || isNew || editing) && <ExpenseForm key={editing?.id || 'new'} expense={editing} onClose={close} />}
    </div>
  );
}
