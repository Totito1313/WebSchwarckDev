// Negocio › Mi negocio, Formas de cobro, Biblioteca y Copia de seguridad. Cada
// cambio se guarda solo. Los documentos ya emitidos guardan su propia copia de estos
// datos: cambiar algo aquí no toca lo que ya mandaste.
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CircleDollar,
  Copy,
  CreditCard,
  EllipsisVertical,
  Envelope,
  Globe,
  LayoutHeaderCellsLarge,
  Link as LinkIcon,
  Pencil,
  Plus,
  Smartphone,
  SquareArticle,
  Star,
  TrashBin,
  Wallet,
  Xmark,
} from '@gravity-ui/icons';
import { Button, Card, Chip, Description, Dropdown, Input, Label, SearchField, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { METHODS, methodLabel, put, remove, safeLink, state as crm, uid } from '../../../negocio-core.js';
import { BLOCKS } from '../../../negocio-propuesta.js';
import { Empty, PageHeader } from '../../kit/parts.jsx';
import { copyText } from '../../kit/csv.js';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { useCrm } from '../store.js';
import { CurrencyCoin } from '../currency.jsx';
import { ConfirmDialog, FormModal } from '../fields.jsx';
import { Copia } from './Copia.jsx';
import { MiNegocio } from './MiNegocio.jsx';

/* ── Formas de cobro ────────────────────────────────────────────────────── */

// La «cara» de cada método: su color y su icono, para reconocerlo en la lista.
const METHOD_LOOK = {
  pagomovil: { bg: '#0f766e', icon: Smartphone },
  transfer: { bg: '#475569', icon: Wallet },
  zelle: { bg: '#6d1ed4', icon: Envelope },
  binance: { bg: '#f0b90b', fg: '#1e1600', icon: CircleDollar },
  usdt: { coin: 'USDT' },
  wise: { bg: '#9fe870', fg: '#163300', icon: Globe },
  paypal: { bg: '#003087', icon: CreditCard },
  cash: { bg: '#15803d', icon: Wallet },
  other: { bg: '#71717a', icon: CreditCard },
};

export function MethodBadge({ method, size = 'md' }) {
  const look = METHOD_LOOK[method] || METHOD_LOOK.other;
  const box = size === 'sm' ? 'size-8 rounded-xl' : 'size-11 rounded-2xl';
  if (look.coin) return <CurrencyCoin code={look.coin} size={size === 'sm' ? 'lg' : 'xl'} className={size === 'sm' ? 'size-8' : 'size-11'} />;
  const Icon = look.icon;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)] ${box}`} style={{ background: look.bg, color: look.fg || '#fff' }}>
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} />
    </span>
  );
}

export function PayForm({ template, onClose, onSaved }) {
  const [t] = useState(() =>
    template
      ? { ...template, fields: template.fields.map((x) => ({ ...x })) }
      : { id: uid(), method: 'pagomovil', name: '', fields: METHODS.pagomovil.fields.map((label) => ({ label, value: '' })), link: '', isDefault: !crm.paytemplates.length },
  );
  const [method, setMethod] = useState(t.method);
  const [fields, setFields] = useState(t.fields);
  const [isDefault, setIsDefault] = useState(Boolean(t.isDefault));
  const [error, setError] = useState('');
  const setField = (i, patch) => setFields((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <FormModal
      title={template ? 'Editar forma de cobro' : 'Nueva forma de cobro'}
      onClose={onClose}
      onSubmit={(f) => {
        const url = String(f.link || '').trim();
        if (url && !safeLink(url)) {
          setError('El enlace tiene que empezar por https://');
          return false;
        }
        const next = {
          ...t,
          method,
          name: String(f.name || '').trim(),
          link: url ? safeLink(url) : '',
          fields: fields.map((x) => ({ label: x.label.trim(), value: x.value.trim() })).filter((x) => x.label || x.value),
          isDefault,
        };
        if (isDefault) for (const other of crm.paytemplates) if (other.id !== next.id && other.isDefault) put('paytemplates', { ...other, isDefault: false });
        put('paytemplates', next);
        toast.success('Forma de cobro guardada');
        onSaved?.(next);
        return true;
      }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Método</Label>
        {/* Los métodos, a la vista y con su cara: menos lista, más reconocer. */}
        <div role="radiogroup" aria-label="Método" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Object.entries(METHODS).map(([k, m]) => {
            const on = method === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (k === method) return;
                  // Al cambiar de método se proponen sus datos, sin perder lo ya escrito.
                  const filled = fields.filter((x) => x.value.trim());
                  setMethod(k);
                  setFields([...filled, ...METHODS[k].fields.filter((l) => !filled.some((x) => x.label === l)).map((label) => ({ label, value: '' }))]);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-accent-soft font-medium text-accent-soft-foreground ring-1 ring-accent' : 'bg-surface-secondary hover:bg-default'}`}
              >
                <MethodBadge method={k} size="sm" />
                <span className="line-clamp-2 leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <TextField name="name" defaultValue={t.name} maxLength={80} className="sm:col-span-2">
        <Label>Nombre en la factura</Label>
        <Input placeholder={METHODS[method]?.label} />
      </TextField>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label>Datos que verá el cliente</Label>
        {fields.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextField aria-label="Nombre del dato" value={x.label} onChange={(v) => setField(i, { label: v })} maxLength={60} className="w-40">
              <Input placeholder="Dato" variant="secondary" />
            </TextField>
            <TextField aria-label={x.label || 'Valor'} value={x.value} onChange={(v) => setField(i, { value: v })} maxLength={200} className="flex-1">
              <Input placeholder="Valor" />
            </TextField>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar dato" onPress={() => setFields((list) => list.filter((_, j) => j !== i))}>
              <Xmark />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="tertiary" className="w-fit" onPress={() => setFields((list) => [...list, { label: '', value: '' }])}>
          <Plus />
          Añadir dato
        </Button>
      </div>
      <TextField name="link" type="url" defaultValue={t.link} maxLength={500} className="sm:col-span-2" isInvalid={Boolean(error)}>
        <Label>Enlace de pago (opcional)</Label>
        <Input placeholder="https://…" />
        <Description>Sale en la factura como botón y como código QR.</Description>
      </TextField>
      <SwitchField isSelected={isDefault} onChange={setIsDefault} className="sm:col-span-2" label="Usar por defecto en las facturas nuevas" />
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </FormModal>
  );
}

const makeDefault = (t) => {
  for (const other of crm.paytemplates) if (other.id !== t.id && other.isDefault) put('paytemplates', { ...other, isDefault: false });
  put('paytemplates', { ...t, isDefault: true });
  toast.success(`${t.name || methodLabel(t.method)} sale ahora en tus facturas nuevas`);
};

function PayCard({ t, uses, onEdit, onRemove }) {
  const shown = t.fields.filter((f) => f.value);
  return (
    <Card className={`h-full gap-3 ${t.isDefault ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex items-start gap-3">
        <MethodBadge method={t.method} />
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col text-start outline-none focus-visible:underline">
          <span className="truncate font-semibold">{t.name || methodLabel(t.method)}</span>
          <span className="text-xs text-muted">{methodLabel(t.method)}</span>
        </button>
        {t.isDefault && (
          <Chip size="sm" variant="soft" color="accent">
            <Star className="size-3" />
            <Chip.Label>Por defecto</Chip.Label>
          </Chip>
        )}
        <Dropdown>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`Opciones de ${t.name || methodLabel(t.method)}`}>
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end" className="min-w-56">
            <Dropdown.Menu
              aria-label="Opciones"
              disabledKeys={t.isDefault ? ['default'] : []}
              onAction={(k) => {
                if (k === 'edit') onEdit();
                else if (k === 'default') makeDefault(t);
                else if (k === 'copy') copyText(shown.map((f) => `${f.label}: ${f.value}`).join('\n')).then(() => toast.success('Datos copiados'));
                else if (k === 'remove') onRemove();
              }}
            >
              <Dropdown.Item id="edit" textValue="Editar">
                <Pencil className="size-4 shrink-0 text-muted" />
                <Label>Editar</Label>
              </Dropdown.Item>
              <Dropdown.Item id="default" textValue="Usar por defecto">
                <Star className="size-4 shrink-0 text-muted" />
                <Label>Usar por defecto</Label>
              </Dropdown.Item>
              <Dropdown.Item id="copy" textValue="Copiar los datos">
                <Copy className="size-4 shrink-0 text-muted" />
                <Label>Copiar los datos</Label>
              </Dropdown.Item>
              <Dropdown.Item id="remove" textValue="Eliminar" variant="danger">
                <TrashBin className="size-4 shrink-0" />
                <Label>Eliminar</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
      <dl className="flex flex-1 flex-col gap-1.5 rounded-2xl bg-surface-secondary p-3 text-sm">
        {shown.length ? (
          shown.map((f) => (
            <div key={f.label} className="group flex items-center gap-2">
              <dt className="w-28 shrink-0 truncate text-xs text-muted">{f.label}</dt>
              <dd className="min-w-0 flex-1 truncate font-medium">{f.value}</dd>
              <button
                type="button"
                aria-label={`Copiar ${f.label}`}
                onClick={() => copyText(f.value).then(() => toast.success(`${f.label} copiado`))}
                className="shrink-0 rounded-lg p-1 text-muted opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          ))
        ) : (
          <span className="text-xs text-muted">Sin datos. El cliente solo verá el nombre.</span>
        )}
      </dl>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{uses ? `En ${uses} ${uses === 1 ? 'documento' : 'documentos'}` : 'Aún sin usar'}</span>
        {t.link && (
          <span className="flex items-center gap-1">
            <LinkIcon className="size-3.5" />
            Con enlace y QR
          </span>
        )}
      </div>
    </Card>
  );
}

function FormasDeCobro() {
  const [state] = useCrm();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const uses = useMemo(() => {
    const n = {};
    for (const d of state.docs) if (d.payment?.templateId) n[d.payment.templateId] = (n[d.payment.templateId] || 0) + 1;
    return n;
  }, [state.docs]);
  const list = [...state.paytemplates].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
  return (
    <div className="flex flex-col gap-4">
      {list.length ? (
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <li key={t.id} className="min-w-0">
              <PayCard t={t} uses={uses[t.id] || 0} onEdit={() => setEditing(t)} onRemove={() => setRemoving(t)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border p-6 text-center outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-secondary">
                <Plus className="size-5" />
              </span>
              <span className="font-medium">Nueva forma de cobro</span>
              <span className="max-w-56 text-sm text-muted">Pago Móvil, Zelle, Binance, USDT, Wise…</span>
            </button>
          </li>
        </ul>
      ) : (
        <Empty
          icon={CreditCard}
          title="Todavía no hay formas de cobro"
          text="Añade cómo te pagan y saldrá en cada factura, con su enlace y su QR."
          action={
            <Button onPress={() => setEditing('new')}>
              <Plus />
              Añadir la primera
            </Button>
          }
        />
      )}
      {editing && <PayForm template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`¿Eliminar ${removing?.name || methodLabel(removing?.method)}?`}
        text="Las facturas que ya la llevan no cambian."
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove('paytemplates', removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

/* ── Biblioteca ─────────────────────────────────────────────────────────── */

const CATEGORIES = ['Términos', 'Pagos', 'Entrega', 'Garantía', 'Legal', 'Otros'];
const FIELD_LABEL = { title: 'Título', text: 'Texto', when: 'Cuándo', name: 'Nombre', role: 'Cargo', quote: 'Cita', image: 'Imagen (enlace https://)' };
const ROW_KEYS = ['when', 'name', 'role', 'title'];

function saveSection(next) {
  const list = [...(crm.settings.sections || [])];
  const at = list.findIndex((x) => x.id === next.id);
  if (at >= 0) list[at] = next;
  else list.push(next);
  put('settings', { ...crm.settings, sections: list });
}

function SectionForm({ entry, onClose }) {
  const [category, setCategory] = useState(entry?.category || '');
  return (
    <FormModal
      title={entry?.id ? 'Editar sección' : 'Nueva sección'}
      onClose={onClose}
      onSubmit={(f) => {
        const title = String(f.title || '').trim();
        if (!title) return false;
        saveSection({ id: entry?.id || uid(), title, body: String(f.body || ''), category });
        toast.success('Sección guardada en la biblioteca');
        return true;
      }}
    >
      <TextField name="title" isRequired defaultValue={entry?.title} maxLength={120} autoFocus className="sm:col-span-2">
        <Label>Título</Label>
        <Input placeholder="Garantía" />
      </TextField>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Tipo</Label>
        <ToggleButtonGroup aria-label="Tipo de sección" selectionMode="single" size="sm" selectedKeys={category ? new Set([category]) : new Set()} onSelectionChange={(k) => setCategory(String([...k][0] || ''))} className="flex-wrap" isDetached>
          {CATEGORIES.map((c) => (
            <ToggleButton key={c} id={c}>
              {c}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <TextField name="body" defaultValue={entry?.body} maxLength={8000} className="sm:col-span-2">
        <Label>Texto</Label>
        <TextArea rows={9} />
        <Description>Se añade tal cual a cualquier factura, cotización o propuesta (en la hoja, «Añadir sección» › Biblioteca).</Description>
      </TextField>
    </FormModal>
  );
}

const emptyLike = (template) => ({ id: uid(), ...Object.fromEntries(Object.keys(template || { title: '', text: '' }).filter((k) => k !== 'id').map((k) => [k, ''])) });

/** Un bloque de propuesta guardado, abierto para editarlo entero: título, texto y cada elemento. */
function BlockForm({ entry, kind, onClose }) {
  const [b, setB] = useState(() => (entry ? structuredClone(entry.block) : { kind, ...BLOCKS[kind].make() }));
  const def = BLOCKS[b.kind] || BLOCKS.text;
  const template = def.make().items?.[0];
  const set = (patch) => setB((x) => ({ ...x, ...patch }));
  const setItem = (i, patch) => set({ items: b.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const moveItem = (i, step) => {
    const items = [...b.items];
    const [x] = items.splice(i, 1);
    items.splice(i + step, 0, x);
    set({ items });
  };
  return (
    <FormModal
      title={entry ? `Editar «${entry.label}»` : `Nuevo bloque: ${def.label}`}
      size="sm:max-w-[680px]"
      onClose={onClose}
      onSubmit={(f) => {
        const label = String(f.label || '').trim() || b.title || def.label;
        const { id, ...rest } = b;
        const saved = { id: entry?.id || uid(), label, block: rest };
        const list = [...(crm.settings.savedBlocks || [])];
        const at = list.findIndex((x) => x.id === saved.id);
        if (at >= 0) list[at] = saved;
        else list.push(saved);
        put('settings', { ...crm.settings, savedBlocks: list });
        toast.success('Bloque guardado en la biblioteca');
        return true;
      }}
    >
      <TextField name="label" defaultValue={entry?.label || def.label} maxLength={80} className="sm:col-span-2">
        <Label>Nombre en la biblioteca</Label>
        <Input />
      </TextField>
      <TextField value={b.title || ''} onChange={(v) => set({ title: v })} maxLength={160} className="sm:col-span-2">
        <Label>Título del bloque</Label>
        <Input placeholder={def.label} />
      </TextField>
      {'body' in b && (
        <TextField value={b.body || ''} onChange={(v) => set({ body: v })} maxLength={8000} className="sm:col-span-2">
          <Label>Texto</Label>
          <TextArea rows={6} />
        </TextField>
      )}
      {'image' in b && !b.items && (
        <>
          <TextField value={b.image || ''} onChange={(v) => set({ image: v })} maxLength={600} className="sm:col-span-2">
            <Label>Imagen (enlace https://)</Label>
            <Input placeholder="https://…" />
          </TextField>
          <TextField value={b.caption || ''} onChange={(v) => set({ caption: v })} maxLength={300} className="sm:col-span-2">
            <Label>Pie de foto</Label>
            <Input />
          </TextField>
        </>
      )}
      {Array.isArray(b.items) && (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Label>Elementos</Label>
          {b.items.map((it, i) => {
            const keys = Object.keys(template || it).filter((k) => k !== 'id');
            const short = keys.filter((k) => ROW_KEYS.includes(k));
            const long = keys.filter((k) => !ROW_KEYS.includes(k));
            return (
              <div key={it.id || i} className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold tabular-nums">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    {short.map((k) => (
                      <TextField key={k} aria-label={FIELD_LABEL[k] || k} value={it[k] || ''} onChange={(v) => setItem(i, { [k]: v })} maxLength={200}>
                        <Input placeholder={FIELD_LABEL[k] || k} />
                      </TextField>
                    ))}
                  </div>
                  <div className="flex shrink-0">
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Subir" isDisabled={i === 0} onPress={() => moveItem(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Bajar" isDisabled={i === b.items.length - 1} onPress={() => moveItem(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar" onPress={() => set({ items: b.items.filter((_, j) => j !== i) })}>
                      <Xmark />
                    </Button>
                  </div>
                </div>
                {long.map((k) => (
                  <TextField key={k} aria-label={FIELD_LABEL[k] || k} value={it[k] || ''} onChange={(v) => setItem(i, { [k]: v })} maxLength={k === 'image' ? 600 : 2000}>
                    {k === 'image' ? <Input placeholder={FIELD_LABEL[k]} /> : <TextArea rows={2} placeholder={FIELD_LABEL[k] || k} />}
                  </TextField>
                ))}
              </div>
            );
          })}
          <Button size="sm" variant="tertiary" className="w-fit" onPress={() => set({ items: [...b.items, emptyLike(template)] })}>
            <Plus />
            Añadir elemento
          </Button>
        </div>
      )}
      {b.kind === 'pricing' && <p className="text-sm text-muted sm:col-span-2">El precio sale de las líneas de la propuesta: aquí solo se guarda el título.</p>}
    </FormModal>
  );
}

const excerpt = (x) => {
  if (x.kind === 'section') return x.body || '';
  const b = x.block || {};
  if (b.body) return b.body;
  if (Array.isArray(b.items)) return b.items.map((it) => [it.when, it.title || it.name, it.text || it.quote].filter(Boolean).join(' · ')).filter(Boolean).join('  ·  ');
  return b.caption || b.image || '';
};

function Biblioteca() {
  const [state] = useCrm();
  const [editing, setEditing] = useState(null); // { type: 'section' | 'block', entry?, kind? }
  const [removing, setRemoving] = useState(null);
  const [query, setQuery] = useState('');
  const [show, setShow] = useState('all');
  const [cat, setCat] = useState('');
  const sections = state.settings.sections || [];
  const blocks = state.settings.savedBlocks || [];

  // En cuántos documentos aparece cada sección (por su título).
  const uses = useMemo(() => {
    const n = {};
    for (const d of state.docs) for (const sec of d.sections || []) if (sec.title) n[sec.title] = (n[sec.title] || 0) + 1;
    return n;
  }, [state.docs]);

  const items = [
    ...sections.map((x, i) => ({ ...x, kind: 'section', i })),
    ...blocks.map((x, i) => ({ ...x, kind: 'block', i, title: x.label })),
  ].filter((x) => {
    if (show === 'sections' && x.kind !== 'section') return false;
    if (show === 'blocks' && x.kind !== 'block') return false;
    if (cat && (x.kind !== 'section' || (x.category || 'Otros') !== cat)) return false;
    const q = query.trim().toLowerCase();
    return !q || `${x.title} ${excerpt(x)}`.toLowerCase().includes(q);
  });
  const usedCats = CATEGORIES.filter((c) => sections.some((x) => (x.category || 'Otros') === c));

  const moveIn = (key, i, step) => {
    const list = [...(crm.settings[key] || [])];
    const [x] = list.splice(i, 1);
    list.splice(i + step, 0, x);
    put('settings', { ...crm.settings, [key]: list });
  };
  const duplicate = (x) => {
    if (x.kind === 'section') saveSection({ id: uid(), title: `${x.title} (copia)`, body: x.body, category: x.category || '' });
    else put('settings', { ...crm.settings, savedBlocks: [...blocks, { id: uid(), label: `${x.label} (copia)`, block: structuredClone(x.block) }] });
    toast.success('Duplicado');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField aria-label="Buscar en la biblioteca" value={query} onChange={setQuery} className="w-full sm:w-64">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <ToggleButtonGroup aria-label="Qué mostrar" selectionMode="single" disallowEmptySelection selectedKeys={new Set([show])} onSelectionChange={(k) => setShow(String([...k][0]))} size="sm">
          <ToggleButton id="all">Todo · {sections.length + blocks.length}</ToggleButton>
          <ToggleButton id="sections">
            <ToggleButtonGroup.Separator />
            <SquareArticle />
            Secciones · {sections.length}
          </ToggleButton>
          <ToggleButton id="blocks">
            <ToggleButtonGroup.Separator />
            <LayoutHeaderCellsLarge />
            Bloques · {blocks.length}
          </ToggleButton>
        </ToggleButtonGroup>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onPress={() => setEditing({ type: 'section' })}>
          <Plus />
          Sección
        </Button>
        <Dropdown>
          <Button size="sm">
            <Plus />
            Bloque de propuesta
          </Button>
          <Dropdown.Popover placement="bottom end" className="min-w-56">
            <Dropdown.Menu aria-label="Tipo de bloque" onAction={(k) => setEditing({ type: 'block', kind: String(k) })}>
              {Object.entries(BLOCKS).map(([k, def]) => (
                <Dropdown.Item key={k} id={k} textValue={def.label}>
                  <LayoutHeaderCellsLarge className="size-4 shrink-0 text-muted" />
                  <Label>{def.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
      {usedCats.length > 1 && show !== 'blocks' && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de sección">
          {['', ...usedCats].map((c) => (
            <button
              key={c || 'all'}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${cat === c ? 'bg-foreground text-background' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
            >
              {c || 'Todos los tipos'}
            </button>
          ))}
        </div>
      )}

      {sections.length + blocks.length === 0 ? (
        <Empty
          icon={BookOpen}
          title="La biblioteca está vacía"
          text="Guarda aquí los textos que repites (términos, garantías, condiciones de pago) y los bloques de propuesta que reutilizas."
          action={
            <Button onPress={() => setEditing({ type: 'section' })}>
              <Plus />
              Primera sección
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <Empty icon={BookOpen} title="Nada coincide" text="Prueba con otra palabra o quita el filtro." />
      ) : (
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((x) => {
            const isSection = x.kind === 'section';
            const key = isSection ? 'sections' : 'savedBlocks';
            const total = isSection ? sections.length : blocks.length;
            const kindLabel = isSection ? x.category || 'Sección' : BLOCKS[x.block?.kind]?.label || 'Bloque';
            const n = isSection ? uses[x.title] || 0 : 0;
            const open = () => setEditing(isSection ? { type: 'section', entry: x } : { type: 'block', entry: blocks[x.i] });
            return (
              <li key={`${x.kind}-${x.id}`} className="min-w-0">
                <Card className="h-full gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${isSection ? 'bg-accent-soft text-accent-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'}`}>
                      {isSection ? <SquareArticle className="size-5" /> : <LayoutHeaderCellsLarge className="size-5" />}
                    </span>
                    <button type="button" onClick={open} className="flex min-w-0 flex-1 flex-col text-start outline-none focus-visible:underline">
                      <span className="truncate font-semibold">{x.title || 'Sin título'}</span>
                      <span className="text-xs text-muted">{isSection ? `Sección · ${kindLabel}` : `Bloque · ${kindLabel}`}</span>
                    </button>
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Opciones de ${x.title}`}>
                        <EllipsisVertical />
                      </Button>
                      <Dropdown.Popover placement="bottom end" className="min-w-48">
                        <Dropdown.Menu
                          aria-label="Opciones"
                          disabledKeys={[...(x.i === 0 ? ['up'] : []), ...(x.i === total - 1 ? ['down'] : [])]}
                          onAction={(k) => {
                            if (k === 'edit') open();
                            else if (k === 'dup') duplicate(isSection ? x : blocks[x.i]);
                            else if (k === 'up') moveIn(key, x.i, -1);
                            else if (k === 'down') moveIn(key, x.i, 1);
                            else if (k === 'remove') setRemoving(x);
                          }}
                        >
                          <Dropdown.Item id="edit" textValue="Editar">
                            <Pencil className="size-4 shrink-0 text-muted" />
                            <Label>Editar</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="dup" textValue="Duplicar">
                            <Copy className="size-4 shrink-0 text-muted" />
                            <Label>Duplicar</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="up" textValue="Subir">
                            <ArrowUp className="size-4 shrink-0 text-muted" />
                            <Label>Subir</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="down" textValue="Bajar">
                            <ArrowDown className="size-4 shrink-0 text-muted" />
                            <Label>Bajar</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="remove" textValue="Quitar" variant="danger">
                            <TrashBin className="size-4 shrink-0" />
                            <Label>Quitar de la biblioteca</Label>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  </div>
                  <button type="button" onClick={open} tabIndex={-1} className="flex-1 text-start">
                    <p className="line-clamp-4 whitespace-pre-line text-sm text-muted">{excerpt(x).trim() || 'Sin texto todavía.'}</p>
                  </button>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{isSection ? (n ? `En ${n} ${n === 1 ? 'documento' : 'documentos'}` : 'Aún sin usar') : Array.isArray(x.block?.items) ? `${x.block.items.length} ${x.block.items.length === 1 ? 'elemento' : 'elementos'}` : 'Para propuestas'}</span>
                    <Button size="sm" variant="ghost" onPress={open}>
                      <Pencil />
                      Editar
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing?.type === 'section' && <SectionForm entry={editing.entry} onClose={() => setEditing(null)} />}
      {editing?.type === 'block' && <BlockForm entry={editing.entry} kind={editing.kind} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`¿Quitar «${removing?.title || ''}» de la biblioteca?`}
        text="Los documentos que ya lo llevan no cambian."
        confirm="Quitar"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing?.kind === 'section') put('settings', { ...crm.settings, sections: sections.filter((y) => y.id !== removing.id) });
          else if (removing) put('settings', { ...crm.settings, savedBlocks: blocks.filter((y) => y.id !== removing.id) });
          setRemoving(null);
        }}
      />
    </div>
  );
}

/* ── La pantalla ────────────────────────────────────────────────────────── */

const TITLES = {
  'formas-de-cobro': ['Formas de cobro', 'Cómo te pagan tus clientes. La marcada por defecto sale sola en cada factura nueva.'],
  biblioteca: ['Biblioteca', 'Los textos y bloques que reutilizas en tus facturas, cotizaciones y propuestas.'],
  copia: ['Copia de seguridad', 'Todo lo de Negocio, a salvo: copias automáticas, en tu carpeta de Drive y para descargar.'],
};

export function Ajustes({ section = 'ajustes', tab }) {
  if (section === 'ajustes' || !TITLES[section]) return <MiNegocio tab={tab} />;
  const [title, description] = TITLES[section];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Negocio" title={title} description={description} />
      {section === 'formas-de-cobro' ? <FormasDeCobro /> : section === 'biblioteca' ? <Biblioteca /> : <Copia />}
    </div>
  );
}
