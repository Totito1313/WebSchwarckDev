// Negocio › Mi negocio, Formas de cobro, Biblioteca y Copia de seguridad: lo que
// antes era Ajustes, en cuatro pestañas. Cada cambio se guarda solo. Los
// documentos ya emitidos guardan su propia copia de estos datos.
import { useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, BookOpen, CreditCard, Pencil, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Chip, Description, Input, Label, Switch, TextArea, TextField, toast } from '@heroui/react';
import { CURRENCIES, METHODS, methodLabel, put, remove, safeLink, state as crm, todayISO, uid } from '../../../negocio-core.js';
import { Empty, PageHeader, Panel } from '../../kit/parts.jsx';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { useCrm } from '../store.js';
import { AmountField, ConfirmButton, FormModal, SelectField, currencyOptions } from '../fields.jsx';
import { NumberStepper } from '../../pro/index.js';

async function readLogo(file) {
  if (file.type === 'image/svg+xml' && file.size < 120_000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // Las fotos se reducen: el logo viaja dentro de los datos del negocio.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 360 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  return png.length < 250_000 ? png : canvas.toDataURL('image/webp', 0.86);
}

/** Cambia un dato de los ajustes y lo guarda (en lote, como todo). */
const setSetting = (key, value) => put('settings', { ...crm.settings, [key]: value });

function Text({ k, label, description, type, placeholder, area, max = 160, className = '' }) {
  return (
    <TextField type={type} defaultValue={crm.settings[k] ?? ''} onChange={(v) => setSetting(k, v)} maxLength={max} className={className}>
      <Label>{label}</Label>
      {area ? <TextArea rows={area} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
      {description && <Description>{description}</Description>}
    </TextField>
  );
}

function MiNegocio() {
  const [state] = useCrm();
  const s = state.settings;
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Tu negocio" description="Sale en el encabezado de cada factura, cotización y propuesta.">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
              {s.logo ? <img src={s.logo} alt="Logo" className="size-full object-contain p-2" /> : <span className="text-xs text-muted">Sin logo</span>}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onPress={() => document.getElementById('logo-file')?.click()}>
                  Subir logo
                </Button>
                {s.logo && (
                  <Button size="sm" variant="ghost" onPress={() => setSetting('logo', '')}>
                    Quitar
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted">PNG, JPG, WebP o SVG. Se reduce solo.</span>
              <input
                id="logo-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setSetting('logo', await readLogo(f));
                  } catch {
                    toast.danger('No se pudo leer esa imagen.');
                  }
                }}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text k="name" label="Nombre o razón social" max={120} />
            <Text k="taxId" label="RIF, cédula o NIF" max={60} />
            <Text k="email" label="Correo" type="email" />
            <Text k="phone" label="Teléfono" type="tel" max={60} />
            <Text k="website" label="Web" />
            <Text k="signature" label="Firma" max={80} placeholder={s.name} description="El nombre que sale firmado al pie (y en el saludo del inicio)." />
            <Text k="address" label="Dirección" area={2} max={400} className="sm:col-span-2" />
          </div>
        </div>
      </Panel>
      <Panel title="Facturación" description="Lo que se propone al crear cada documento.">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Moneda principal" value={s.currency} onChange={(c) => setSetting('currency', c)} options={currencyOptions(CURRENCIES)} description="Las cifras de los listados van en esta moneda." />
          <NumberStepper
            label="Días para pagar una factura"
            value={Number(s.dueDays) || 0}
            onChange={(n) => setSetting('dueDays', Math.round(n))}
            min={0}
            max={365}
            formatOptions={{ style: 'unit', unit: 'day', unitDisplay: 'long' }}
          />
          <NumberStepper
            label="Validez de una cotización"
            value={Number(s.quoteDays) || 0}
            onChange={(n) => setSetting('quoteDays', Math.round(n))}
            min={0}
            max={365}
            formatOptions={{ style: 'unit', unit: 'day', unitDisplay: 'long' }}
          />
          <NumberStepper
            label="Tarifa por hora"
            value={Number(s.hourlyRate) || 0}
            onChange={(n) => setSetting('hourlyRate', n)}
            min={0}
            step={5}
            formatOptions={CURRENCIES[s.currency] && /^[A-Z]{3}$/.test(s.currency) && s.currency !== 'USDT' ? { style: 'currency', currency: s.currency } : { maximumFractionDigits: 2 }}
            description="La de los proyectos nuevos y las horas sin proyecto."
          />
          <Text k="notes" label="Nota al pie por defecto" area={2} max={2000} className="sm:col-span-3" />
          <Text k="terms" label="Términos y condiciones por defecto" area={4} max={8000} placeholder="Se añaden a cada documento nuevo. Vacío: no se añaden." className="sm:col-span-3" />
        </div>
      </Panel>
    </div>
  );
}

function PayForm({ template, onClose }) {
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
        return true;
      }}
    >
      <SelectField
        label="Método"
        value={method}
        onChange={(m) => {
          // Al cambiar de método se proponen sus datos, sin perder lo ya escrito.
          const filled = fields.filter((x) => x.value.trim());
          setMethod(m);
          setFields([...filled, ...METHODS[m].fields.filter((l) => !filled.some((x) => x.label === l)).map((label) => ({ label, value: '' }))]);
        }}
        options={Object.entries(METHODS).map(([k, m]) => [k, m.label])}
      />
      <TextField name="name" defaultValue={t.name} maxLength={80}>
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

function FormasDeCobro() {
  const [state] = useCrm();
  const [editing, setEditing] = useState(null);
  return (
    <Panel
      title="Formas de cobro"
      description="Pago Móvil, Zelle, Binance… La que marques por defecto sale sola en cada factura nueva."
      action={
        <Button size="sm" onPress={() => setEditing('new')}>
          <Plus />
          Añadir
        </Button>
      }
    >
      {state.paytemplates.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.paytemplates.map((t) => (
            <li key={t.id}>
              <Card variant="secondary" className="flex-row items-start gap-3 p-4">
                <CreditCard className="mt-0.5 size-5 shrink-0 text-muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    {t.name || methodLabel(t.method)}
                    {t.isDefault && (
                      <Chip size="sm" variant="soft" color="accent">
                        Por defecto
                      </Chip>
                    )}
                  </span>
                  <span className="text-xs text-muted">{methodLabel(t.method)}</span>
                  {t.fields.filter((f) => f.value).map((f) => (
                    <span key={f.label} className="truncate text-sm">
                      <span className="text-muted">{f.label}:</span> {f.value}
                    </span>
                  ))}
                </div>
                <ButtonGroup size="sm" variant="ghost">
                  <Button isIconOnly aria-label="Editar" onPress={() => setEditing(t)}>
                    <Pencil />
                  </Button>
                  <ConfirmButton title={`¿Eliminar ${t.name || methodLabel(t.method)}?`} text="Las facturas que ya la llevan no cambian." onConfirm={() => remove('paytemplates', t.id)} variant="ghost" isIconOnly ariaLabel="Eliminar">
                    <ButtonGroup.Separator />
                    <TrashBin />
                  </ConfirmButton>
                </ButtonGroup>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={CreditCard} title="Todavía no hay formas de cobro" text="Añade cómo te pagan y saldrá en cada factura, con su enlace y su QR." />
      )}
      {editing && <PayForm template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function SectionForm({ entry, onClose }) {
  return (
    <FormModal
      title={entry ? 'Editar sección guardada' : 'Nueva sección guardada'}
      onClose={onClose}
      onSubmit={(f) => {
        const title = String(f.title || '').trim();
        if (!title) return false;
        const next = { id: entry?.id || uid(), title, body: String(f.body || '') };
        const list = [...(crm.settings.sections || [])];
        const at = list.findIndex((x) => x.id === next.id);
        if (at >= 0) list[at] = next;
        else list.push(next);
        put('settings', { ...crm.settings, sections: list });
        return true;
      }}
    >
      <TextField name="title" isRequired defaultValue={entry?.title} maxLength={120} autoFocus className="sm:col-span-2">
        <Label>Título</Label>
        <Input placeholder="Garantía" />
      </TextField>
      <TextField name="body" defaultValue={entry?.body} maxLength={8000} className="sm:col-span-2">
        <Label>Texto</Label>
        <TextArea rows={8} />
        <Description>Se añade tal cual a cualquier factura, cotización o propuesta («De la biblioteca», en el editor).</Description>
      </TextField>
    </FormModal>
  );
}

function Biblioteca() {
  const [state] = useCrm();
  const [editing, setEditing] = useState(null);
  const sections = state.settings.sections || [];
  const blocks = state.settings.savedBlocks || [];
  const move = (i, step) => {
    const list = [...sections];
    const [x] = list.splice(i, 1);
    list.splice(i + step, 0, x);
    put('settings', { ...state.settings, sections: list });
  };
  return (
    <Panel
      title="Biblioteca de secciones"
      description="Términos, garantías, condiciones de pago… Guárdalas una vez y añádelas a cualquier documento."
      action={
        <Button size="sm" onPress={() => setEditing('new')}>
          <Plus />
          Nueva sección
        </Button>
      }
    >
      {sections.length + blocks.length === 0 ? (
        <Empty icon={BookOpen} title="La biblioteca está vacía" text="Guarda aquí los textos que repites en cada documento." />
      ) : (
        <ul className="flex flex-col gap-2">
          {sections.map((x, i) => (
            <li key={x.id} className="flex items-start gap-3 rounded-2xl bg-surface-secondary p-3">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-muted" />
              <button type="button" className="flex min-w-0 flex-1 flex-col text-start" onClick={() => setEditing(x)}>
                <span className="font-medium">{x.title || 'Sin título'}</span>
                <span className="line-clamp-2 text-xs text-muted">{(x.body || '').replace(/\s+/g, ' ') || 'Sin texto'}</span>
              </button>
              <ButtonGroup size="sm" variant="ghost">
                <Button isIconOnly aria-label="Subir" isDisabled={i === 0} onPress={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button isIconOnly aria-label="Bajar" isDisabled={i === sections.length - 1} onPress={() => move(i, 1)}>
                  <ButtonGroup.Separator />
                  <ArrowDown />
                </Button>
                <ConfirmButton
                  title={`¿Quitar «${x.title}» de la biblioteca?`}
                  text="Los documentos que ya la llevan no cambian."
                  confirm="Quitar"
                  onConfirm={() => put('settings', { ...state.settings, sections: sections.filter((y) => y.id !== x.id) })}
                  variant="ghost"
                  isIconOnly
                  ariaLabel="Quitar"
                >
                  <ButtonGroup.Separator />
                  <TrashBin />
                </ConfirmButton>
              </ButtonGroup>
            </li>
          ))}
          {blocks.map((x) => (
            <li key={x.id} className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3">
              <BookOpen className="size-4 shrink-0 text-muted" />
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{x.label}</span>
                <span className="text-xs text-muted">Bloque de propuesta</span>
              </span>
              <ConfirmButton
                title={`¿Quitar «${x.label}» de la biblioteca?`}
                confirm="Quitar"
                onConfirm={() => put('settings', { ...state.settings, savedBlocks: blocks.filter((y) => y.id !== x.id) })}
                variant="ghost"
                isIconOnly
                ariaLabel="Quitar"
              >
                <TrashBin />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      {editing && <SectionForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function Copia() {
  const [state] = useCrm();
  const count = (col) => (state[col] || []).length;
  return (
    <Panel title="Copia de seguridad" description="Todo tu negocio en un archivo JSON: clientes, servicios, documentos, proyectos, tareas, horas, gastos, páginas, leads y marketing.">
      <div className="flex flex-wrap gap-2">
        {[
          ['customers', 'clientes'],
          ['docs', 'documentos'],
          ['projects', 'proyectos'],
          ['tasks', 'tareas'],
          ['time', 'registros de horas'],
          ['expenses', 'gastos'],
          ['pages', 'páginas'],
          ['leads', 'leads'],
          ['posts', 'publicaciones'],
        ].map(([col, word]) => (
          <Chip key={col} size="sm" variant="tertiary">
            {count(col)} {word}
          </Chip>
        ))}
      </div>
      <Button
        className="mt-4 w-fit"
        onPress={() => {
          const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `negocio-${todayISO()}.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }}
      >
        <ArrowDownToLine />
        Descargar copia
      </Button>
    </Panel>
  );
}

const TITLES = {
  ajustes: ['Mi negocio', 'Tus datos de facturación. Los documentos ya emitidos guardan su propia copia.'],
  'formas-de-cobro': ['Formas de cobro', 'Cómo te pagan tus clientes.'],
  biblioteca: ['Biblioteca', 'Los textos y bloques que reutilizas en tus documentos.'],
  copia: ['Copia de seguridad', 'Descarga todo lo de Negocio cuando quieras.'],
};

export function Ajustes({ section = 'ajustes' }) {
  const [title, description] = TITLES[section] || TITLES.ajustes;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Negocio" title={title} description={description} />
      {section === 'formas-de-cobro' ? <FormasDeCobro /> : section === 'biblioteca' ? <Biblioteca /> : section === 'copia' ? <Copia /> : <MiNegocio />}
    </div>
  );
}
