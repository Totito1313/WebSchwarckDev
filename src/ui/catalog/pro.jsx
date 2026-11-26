// Catálogo: nuestros componentes «Pro» (src/ui/pro), cada uno con datos de ejemplo.
// Se inspiran en las demos de HeroUI Pro (el enlace «Inspiración» lleva a cada una),
// pero están hechos desde cero con HeroUI libre y nuestro tema. Nada se guarda.
import { useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  CircleCheck,
  CircleDashed,
  Clock,
  Comment,
  Copy,
  FileText,
  Folder,
  ListCheck,
  Paperclip,
  PencilToSquare,
  Persons,
  Receipt,
  ThumbsUp,
  TrashBin,
} from '@gravity-ui/icons';
import { Button, Chip, toast } from '@heroui/react';
import {
  ActionBar,
  Agenda,
  ApprovalCard,
  ChatMessage,
  ChatThread,
  ComposedChart,
  ContextMenu,
  DataGrid,
  DonutChart,
  Kanban,
  KanbanCard,
  KpiGroup,
  LOADERS,
  ListView,
  Loader,
  NumberStepper,
  QuestionCard,
  RichText,
  ShimmerText,
  Stepper,
  Timeline,
  TimelineCard,
  TrendChip,
  Widget,
} from '../pro/index.js';
import { Person } from '../kit/parts.jsx';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdK = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10} k` : String(Math.round(v)));
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const IN = [2400, 3100, 2800, 3900, 3500, 4600, 4200, 5100, 4800, 5900, 5600, 6800];
const OUT = [1800, 1900, 2400, 2100, 2600, 2500, 3100, 2700, 3000, 3200, 2900, 3400];
const MONTHLY = MONTHS.map((m, i) => ({ key: m, label: m, in: IN[i], out: OUT[i], net: IN[i] - OUT[i] }));
const CHART_SERIES = [
  { key: 'in', name: 'Cobrado', type: 'bar', color: 'var(--sw-chart-in)' },
  { key: 'out', name: 'Gastado', type: 'bar', color: 'var(--sw-chart-out)' },
  { key: 'net', name: 'Resultado', type: 'area', color: 'var(--foreground)' },
];

/* ── Cifras y gráficos ─────────────────────────────────────────────────── */

function TrendChipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TrendChip value={0.033} />
      <TrendChip value={-0.011} />
      <TrendChip value={0} />
      <TrendChip value={0.124} upIsGood={false} label="en gastos" />
      <TrendChip value={0.082} size="md" label="frente al mes pasado" />
    </div>
  );
}

function KpiWidgetDemo() {
  return (
    <Widget title="Cifras clave" action="Últimos 30 días" className="w-full">
      <KpiGroup
        items={[
          { label: 'Cobrado', value: usd.format(6800), delta: 0.214, deltaLabel: 'vs. octubre', trend: IN },
          { label: 'Gastado', value: usd.format(3400), delta: 0.172, upIsGood: false, deltaLabel: 'vs. octubre', trend: OUT },
          { label: 'Resultado', value: usd.format(3400), delta: 0.26, deltaLabel: 'vs. octubre', trend: MONTHLY.map((m) => m.net) },
          { label: 'Por cobrar', value: usd.format(2150), sub: '4 facturas abiertas' },
        ]}
      />
    </Widget>
  );
}

function ComposedDemo() {
  return (
    <Widget title="Entradas y salidas" description="Cada mes, con el resultado encima" className="w-full">
      <ComposedChart data={MONTHLY} series={CHART_SERIES} format={usd.format} compact={usdK} title="Entradas y salidas por mes" xLabel="Mes" />
    </Widget>
  );
}

function ComposedLineDemo() {
  const data = MONTHLY.map((m, i) => ({ ...m, leads: 8 + ((i * 7) % 11) + i, won: 2 + ((i * 3) % 5) }));
  return (
    <Widget title="Leads por mes" action={<TrendChip value={0.18} label="este año" />} className="w-full">
      <ComposedChart
        data={data}
        series={[
          { key: 'leads', name: 'Entraron', type: 'bar', color: 'var(--sw-cat-1)' },
          { key: 'won', name: 'Ganados', type: 'line', color: 'var(--sw-cat-2)' },
        ]}
        title="Leads que entraron y ganados por mes"
        xLabel="Mes"
      />
    </Widget>
  );
}

function DonutDemo() {
  return (
    <Widget title="Gastos por categoría" action="Noviembre" className="w-full">
      <DonutChart
        title="Gastos por categoría"
        format={usd.format}
        parts={[
          { key: 'soft', label: 'Software', value: 420 },
          { key: 'ads', label: 'Publicidad', value: 610 },
          { key: 'eq', label: 'Equipos', value: 280 },
          { key: 'serv', label: 'Servicios', value: 190 },
          { key: 'trans', label: 'Transporte', value: 90 },
          { key: 'otros', label: 'Comida', value: 60 },
        ]}
      />
    </Widget>
  );
}

function DashboardDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-3">
      <Widget title="Resumen">
        <KpiGroup
          items={[
            { label: 'Ingresos', value: '228 k', delta: 0.125 },
            { label: 'Facturas', value: '1.234', delta: 0.082 },
            { label: 'Clientes', value: '89', delta: 0.031 },
            { label: 'Conversión', value: '3,2 %', delta: -0.004 },
          ]}
        />
      </Widget>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Widget title="Ingresos" action={<TrendChip value={0.125} />}>
          <ComposedChart data={MONTHLY} series={[{ key: 'in', name: 'Cobrado', type: 'area', color: 'var(--sw-chart-in)' }]} format={usd.format} compact={usdK} height={180} showLegend={false} title="Ingresos" />
        </Widget>
        <Widget title="Origen de los leads">
          <DonutChart
            format={(v) => String(v)}
            totalLabel="Leads"
            size={140}
            parts={[
              { key: 'ig', label: 'Instagram', value: 34 },
              { key: 'ref', label: 'Referidos', value: 21 },
              { key: 'web', label: 'Web', value: 12 },
              { key: 'wa', label: 'WhatsApp', value: 9 },
            ]}
          />
        </Widget>
      </div>
    </div>
  );
}

/* ── Tablas y tableros ─────────────────────────────────────────────────── */

const PEOPLE = [
  ['Café Aroma', 'maria@cafearoma.com', 'Venezuela', 'Cliente', 4200, 'activo'],
  ['Lion Fitness', 'luis@lionfitness.com', 'Panamá', 'Cliente', 2400, 'activo'],
  ['PatrykBioHacker', 'patryk@biohacker.com', 'España', 'Cliente', 780, 'pausa'],
  ['Estudio Norte', 'hola@estudionorte.co', 'Colombia', 'Lead', 0, 'nuevo'],
  ['Clínica Sonrisa', 'admin@sonrisa.com', 'Venezuela', 'Cliente', 3100, 'activo'],
  ['Pizzería Roma', 'pedidos@roma.com', 'Venezuela', 'Lead', 0, 'nuevo'],
  ['Andes Tours', 'info@andestours.com', 'Perú', 'Cliente', 1650, 'pausa'],
].map(([name, email, country, kind, billed, status], i) => ({ id: `c${i}`, code: `CLI-${String(101 + i)}`, name, email, country, kind, billed, status }));

const STATUS = { activo: ['Activo', 'success'], pausa: ['En pausa', 'warning'], nuevo: ['Nuevo', 'accent'] };

function DataGridDemo() {
  return (
    <DataGrid
      title="Clientes"
      rows={PEOPLE}
      search={(r, q) => `${r.name} ${r.email} ${r.code}`.toLowerCase().includes(q)}
      searchPlaceholder="Nombre, correo o código"
      defaultSort={{ column: 'billed', direction: 'descending' }}
      filters={[
        { id: 'kind', label: 'Tipo', options: [['Cliente', 'Cliente'], ['Lead', 'Lead']], match: (r, v) => r.kind === v },
        { id: 'status', label: 'Estado', options: Object.entries(STATUS).map(([k, [t]]) => [k, t]), match: (r, v) => r.status === v },
      ]}
      columns={[
        { id: 'code', name: 'Código', sortValue: (r) => r.code, hideable: true, render: (r) => <span className="font-mono text-xs text-muted">{r.code}</span> },
        {
          id: 'name',
          name: 'Cliente',
          isRowHeader: true,
          sortValue: (r) => r.name,
          render: (r) => (
            <span className="flex items-center gap-2.5">
              <Person name={r.name} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{r.name}</span>
                <span className="truncate text-xs text-muted">{r.email}</span>
              </span>
            </span>
          ),
        },
        { id: 'country', name: 'País', sortValue: (r) => r.country, hideable: true },
        { id: 'status', name: 'Estado', sortValue: (r) => r.status, render: (r) => <Chip size="sm" variant="soft" color={STATUS[r.status][1]}>{STATUS[r.status][0]}</Chip> },
        { id: 'billed', name: 'Facturado', align: 'end', sortValue: (r) => r.billed, render: (r) => usd.format(r.billed) },
      ]}
      actions={<Button size="sm">Nuevo cliente</Button>}
      bulkActions={[
        { id: 'export', label: 'Exportar', icon: ArrowDownToLine },
        { id: 'archive', label: 'Archivar', icon: Archive },
        { id: 'delete', label: 'Borrar', icon: TrashBin, danger: true },
      ]}
      onBulkAction={(id, rows, clear) => {
        toast(`${id === 'export' ? 'Exportados' : id === 'archive' ? 'Archivados' : 'Borrados'} ${rows.length} (es una demo)`);
        clear();
      }}
      rowMenu={() => [
        { id: 'open', label: 'Abrir', icon: FileText },
        { id: 'invoice', label: 'Nueva factura', icon: Receipt },
        { id: 'copy', label: 'Copiar correo', icon: Copy, shortcut: 'Ctrl C' },
        '-',
        { id: 'delete', label: 'Borrar', icon: TrashBin, danger: true },
      ]}
      onRowMenu={(id, r) => toast(`${id} · ${r.name}`)}
      onRowAction={(r) => toast(`Abrir ${r.name}`)}
      minWidth={680}
    />
  );
}

const FILES = [
  { id: 'f1', title: 'Propuesta Café Aroma.pdf', description: 'Cambiado hace 2 días', icon: FileText },
  { id: 'f2', title: 'Fotos del local', description: 'Cambiado hace 1 semana', icon: Folder },
  { id: 'f3', title: 'Brief de la app.md', description: 'Cambiado hace 3 horas', icon: FileText },
  { id: 'f4', title: 'Factura FAC-2026-0041.pdf', description: 'Cambiado ayer', icon: Receipt },
  { id: 'f5', title: 'Logos', description: 'Cambiado ahora', icon: Folder },
];

function ListViewDemo() {
  const [one, setOne] = useState(new Set());
  const [many, setMany] = useState(new Set());
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
      {[
        ['Sin selección', 'none', undefined, undefined],
        ['Una', 'single', one, setOne],
        ['Varias', 'multiple', many, setMany],
      ].map(([t, mode, sel, set]) => (
        <div key={mode} className="flex min-w-0 flex-col gap-2">
          <p className="flex justify-between text-sm font-medium">
            {t}
            {mode !== 'none' && <span className="text-xs font-normal text-muted">{sel.size ? `${sel.size} elegidas` : 'Ninguna'}</span>}
          </p>
          <ListView label={`Archivos, ${t}`} items={FILES} selectionMode={mode} selectedKeys={sel} onSelectionChange={set} onAction={(k) => toast(`Abrir ${k}`)} dense />
        </div>
      ))}
    </div>
  );
}

function ActionBarDemo() {
  const [sel, setSel] = useState(new Set());
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs text-muted">Elige dos o más filas: la barra aparece abajo, en el centro.</p>
      <ListView label="Archivos" items={FILES} selectionMode="multiple" selectedKeys={sel} onSelectionChange={setSel} dense />
      <ActionBar
        count={sel === 'all' ? FILES.length : sel.size}
        onClear={() => setSel(new Set())}
        actions={[
          { id: 'edit', label: 'Editar', icon: PencilToSquare },
          { id: 'export', label: 'Exportar', icon: ArrowDownToLine },
          { id: 'archive', label: 'Archivar', icon: Archive },
          { id: 'delete', label: 'Borrar', icon: TrashBin, danger: true },
        ]}
        onAction={(id) => toast(`${id} (es una demo)`)}
      />
    </div>
  );
}

const KCOLS = [
  { id: 'todo', title: 'Por hacer', icon: CircleDashed, color: 'var(--muted)' },
  { id: 'doing', title: 'En curso', icon: Clock, color: 'var(--warning)' },
  { id: 'done', title: 'Hecho', icon: CircleCheck, color: 'var(--success)' },
];

function KanbanDemo() {
  const [cards, setCards] = useState([
    { id: 'k1', col: 'todo', title: 'Pasarela de pago', description: 'Pago Móvil y Zelle en la app', tags: [{ label: 'Alta', color: 'danger' }], progress: 0, people: ['Alan'], comments: 3, files: 1 },
    { id: 'k2', col: 'todo', title: 'Rediseño del login', description: 'Pantalla con la marca nueva', tags: [{ label: 'Diseño', color: 'accent' }], people: ['Alan', 'María'], comments: 1, files: 0 },
    { id: 'k3', col: 'doing', title: 'Carrito de compras', description: 'Sumar, quitar y vaciar', tags: [{ label: 'En curso', color: 'warning' }], progress: 0.45, people: ['Alan', 'Luis'], comments: 12, files: 2 },
    { id: 'k4', col: 'doing', title: 'Error al subir fotos', description: 'Falla con fotos de más de 5 MB', tags: [{ label: 'Error', color: 'danger' }], progress: 0.7, people: ['Luis'], comments: 15, files: 4 },
    { id: 'k5', col: 'done', title: 'Menú del café', description: 'Categorías y fotos', tags: [{ label: 'Hecho', color: 'success' }], progress: 1, people: ['María'], comments: 7, files: 1 },
  ]);
  const move = (key, col, index) =>
    setCards((list) => {
      const card = list.find((c) => c.id === key);
      const rest = list.filter((c) => c.id !== key);
      const inCol = rest.filter((c) => c.col === col);
      const before = inCol[index];
      const moved = { ...card, col };
      if (!before) return [...rest, moved];
      const at = rest.indexOf(before);
      return [...rest.slice(0, at), moved, ...rest.slice(at)];
    });
  return (
    <div className="w-full min-w-0">
      <Kanban
        columns={KCOLS}
        items={cards}
        getColumn={(c) => c.col}
        onMove={move}
        onOpen={(c) => toast(`Abrir «${c.title}»`)}
        cardMenu={() => [{ id: 'dup', label: 'Duplicar', icon: Copy }]}
        onCardMenu={(id, c) => toast(`${id} · ${c.title}`)}
        columnWidth={260}
        renderCard={(c) => (
          <KanbanCard
            title={c.title}
            description={c.description}
            tags={c.tags}
            progress={c.progress}
            people={c.people}
            meta={[
              { icon: Comment, value: c.comments, label: 'comentarios' },
              { icon: Paperclip, value: c.files, label: 'adjuntos' },
            ]}
          />
        )}
      />
    </div>
  );
}

function ContextMenuDemo() {
  return (
    <ContextMenu
      label="Acciones de la factura"
      onAction={(id) => toast(`${id} (es una demo)`)}
      items={[
        { id: 'open', label: 'Abrir', icon: FileText, shortcut: '↵' },
        { id: 'dup', label: 'Duplicar', icon: Copy, shortcut: 'Ctrl D' },
        { id: 'pay', label: 'Registrar pago', icon: Receipt, isDisabled: true },
        '-',
        { id: 'delete', label: 'Anular', icon: TrashBin, danger: true },
      ]}
      className="w-full"
    >
      <div tabIndex={0} className="flex h-36 w-full items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted outline-none focus-visible:ring-2 focus-visible:ring-focus">
        Clic derecho aquí (o la tecla de menú)
      </div>
    </ContextMenu>
  );
}

/* ── Tiempo y pasos ────────────────────────────────────────────────────── */

function AgendaDemo() {
  const at = (day, h, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + day);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const [events, setEvents] = useState([
    { id: 'e1', title: 'Reunión con Café Aroma', start: at(0, 9), end: at(0, 10), color: 'var(--sw-cat-1)' },
    { id: 'e2', title: 'Reel: la tasa del día', start: at(1, 18), end: at(1, 18, 30), color: 'var(--sw-cat-5)' },
    { id: 'e3', title: 'Revisión del diseño', start: at(2, 11), end: at(2, 12, 30), color: 'var(--sw-cat-3)' },
    { id: 'e4', title: 'Llamada con Lion', start: at(2, 11, 30), end: at(2, 12), color: 'var(--sw-cat-2)' },
    { id: 'e5', title: 'Entrega del sprint', start: at(3, 0), end: at(4, 0), allDay: true, color: 'var(--sw-cat-1)' },
    { id: 'e6', title: 'Carrusel: privacidad', start: at(4, 12), end: at(4, 13), color: 'var(--sw-cat-5)' },
    { id: 'e7', title: 'Cobrar a Andes Tours', start: at(4, 15), end: at(4, 15, 30), color: 'var(--sw-cat-4)' },
  ]);
  return (
    <div className="w-full min-w-0">
      <Agenda
        events={events}
        height={420}
        onOpen={(e) => toast(e.title)}
        onCreate={(d) => setEvents((l) => [...l, { id: `n${l.length}`, title: 'Nuevo', start: d, end: new Date(d.getTime() + 3600000), color: 'var(--accent)' }])}
      />
    </div>
  );
}

function TimelineDemo() {
  return (
    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="sw-eyebrow">Historial de una factura</p>
        <Timeline
          items={[
            { id: 1, title: 'FAC-2026-0041 creada', badge: { label: 'Borrador' }, marker: { icon: FileText }, description: 'Desde la cotización COT-2026-0017.', trailing: '09:12' },
            { id: 2, title: 'Enviada a Café Aroma', badge: { label: 'Enviada', color: 'accent' }, marker: { icon: Receipt, color: 'var(--accent)' }, description: 'Vence el 15 de diciembre.', trailing: '09:34' },
            { id: 3, title: 'La vio el cliente', marker: { icon: Persons }, description: 'Abrió el enlace 3 veces.', trailing: '10:05' },
            { id: 4, title: 'Pago recibido', badge: { label: '$1.250', color: 'success' }, marker: { kind: 'check', color: 'var(--success)' }, description: 'Zelle · conciliado.', trailing: '16:42' },
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="sw-eyebrow">Versiones de una propuesta</p>
        <Timeline
          items={[
            { id: 'v3', title: 'v3', badge: { label: 'Borrador', color: 'accent' }, marker: { kind: 'ring', color: 'var(--accent)' }, current: true, description: 'Ajusté el alcance y el precio de la fase 2.', footer: <><Person name="Alan" size="sm" /> Alan · Actual</> },
            { id: 'v2', title: 'v2', badge: { label: 'Enviada', color: 'success' }, marker: { kind: 'ring', color: 'var(--success)' }, description: 'Añadí el mantenimiento mensual.', footer: <><Person name="Alan" size="sm" /> Alan · 20 nov, 16:42</> },
            { id: 'v1', title: 'v1', description: 'Primera versión con tres fases.', footer: <><Person name="María" size="sm" /> María · 18 nov, 09:06</> },
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
        <p className="sw-eyebrow">Revisión con contenido</p>
        <Timeline
          split
          items={[
            {
              id: 's1',
              title: 'Pantallas aprobadas',
              marker: { icon: CircleCheck, color: 'var(--success)' },
              aside: <><span className="font-medium text-foreground tabular-nums">09:15</span><Chip size="sm" variant="soft">Diseño</Chip><span>María</span></>,
              children: <TimelineCard stats={[['Pantallas', '18'], ['Notas abiertas', '2']]}>Revisamos el menú, el carrito y el pago. Queda <strong>ajustar el botón de pagar</strong>.</TimelineCard>,
            },
            {
              id: 's2',
              title: 'Pruebas en el teléfono',
              marker: { icon: Clock, color: 'var(--warning)' },
              aside: <><span className="font-medium text-foreground tabular-nums">12:05</span><Chip size="sm" variant="soft" color="warning">Pruebas</Chip><span>Luis</span></>,
              children: <TimelineCard stats={[['Errores', '3'], ['Arreglados', '1'], ['Tiempo', '2 h']]}>Falla al subir fotos grandes en Android.</TimelineCard>,
            },
          ]}
        />
      </div>
    </div>
  );
}

function StepperDemo() {
  const [step, setStep] = useState(1);
  const steps = [
    { id: 'a', title: 'Arranque', description: 'Brief y alcance' },
    { id: 'b', title: 'Diseño', description: 'Pantallas en Figma' },
    { id: 'c', title: 'Desarrollo', description: 'Sprints de dos semanas' },
    { id: 'd', title: 'Entrega', description: 'Publicación y cierre' },
  ];
  return (
    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <Stepper steps={steps} current={step} onChange={setStep} label="Etapas del proyecto" />
        <div className="flex gap-2">
          <Button size="sm" variant="tertiary" isDisabled={step === 0} onPress={() => setStep((s) => s - 1)}>
            Atrás
          </Button>
          <Button size="sm" isDisabled={step >= steps.length} onPress={() => setStep((s) => s + 1)}>
            {step >= steps.length - 1 ? 'Terminar' : 'Seguir'}
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 rounded-3xl bg-surface-secondary p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Proyecto CAF</span>
          <Chip size="sm" variant="soft" color="accent">
            En curso
          </Chip>
        </div>
        <p className="text-xl font-semibold">Entrega el viernes</p>
        <Stepper
          numbered={false}
          current={2}
          label="Avance del proyecto"
          steps={[
            { id: 1, title: 'Propuesta aceptada', description: 'Firmada por el cliente', trailing: '2 nov, 10:45' },
            { id: 2, title: 'Diseño aprobado', description: '18 pantallas', trailing: '12 nov, 15:12' },
            { id: 3, title: 'En desarrollo', description: 'Sprint 2 de 3', trailing: 'Hoy' },
            { id: 4, title: 'En revisión', description: 'Pendiente', trailing: '—' },
            { id: 5, title: 'Entregado', description: 'Pendiente', trailing: '—' },
          ]}
        />
      </div>
      <div className="md:col-span-2">
        <Stepper orientation="horizontal" steps={steps} current={step} onChange={setStep} label="Etapas en horizontal" />
      </div>
    </div>
  );
}

/* ── Escribir y decidir ────────────────────────────────────────────────── */

function NumberStepperDemo() {
  const [a, setA] = useState(10);
  const [b, setB] = useState(0.5);
  const [c, setC] = useState(15);
  const [d, setD] = useState(1.5);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <NumberStepper label="Precio (USD)" value={a} onChange={setA} min={0} step={5} formatOptions={{ style: 'currency', currency: 'USD' }} align="center" />
      <NumberStepper label="Avance" value={b} onChange={setB} min={0} max={1} step={0.1} formatOptions={{ style: 'percent' }} align="center" />
      <NumberStepper label="Días para pagar" value={c} onChange={setC} min={0} max={90} formatOptions={{ style: 'unit', unit: 'day', unitDisplay: 'long' }} align="center" />
      <NumberStepper label="Horas" value={d} onChange={setD} min={0} step={0.25} formatOptions={{ style: 'unit', unit: 'hour', unitDisplay: 'short', maximumFractionDigits: 2 }} align="center" size="sm" />
    </div>
  );
}

const MD = `## Brief de Café Aroma

> Una app de pedidos para recoger en tienda, con **Pago Móvil** y Zelle.

Selecciona una frase y usa el *menú flotante* para darle formato, o escribe con atajos de Markdown.

### Qué probar

- Cambiar títulos, citas y bloques de código desde la barra.
- Poner un enlace a [schwarckdev.com](https://schwarckdev.com) o quitarlo.
- Fíjate en que se guarda como \`Markdown\` legible.

\`\`\`
menú → carrito → pagar → listo
\`\`\``;

function RichTextDemo() {
  const [md, setMd] = useState(MD);
  return (
    <div className="flex w-full flex-col gap-3">
      <RichText value={md} onChange={setMd} label="Brief" />
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Lo que se guarda</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-secondary p-3">{md}</pre>
      </details>
    </div>
  );
}

function ApprovalDemo() {
  const [status, setStatus] = useState(null);
  const [always, setAlways] = useState(false);
  return (
    <div className="w-full max-w-lg">
      <ApprovalCard
        media={<div className="flex size-full items-center justify-center bg-accent/15 text-accent"><Receipt className="size-6" /></div>}
        title="Cotización COT-2026-0017"
        subtitle={<span className="flex items-center gap-1">Café Aroma · App de pedidos <ThumbsUp className="size-3.5" /> 4,9</span>}
        details={[
          ['Inicio', 'lun 1 dic'],
          ['Entrega', 'vie 19 dic'],
          ['Fases', '3'],
          ['Forma de pago', 'Zelle'],
        ]}
        lines={[
          ['Diseño · 18 pantallas', usd.format(1200)],
          ['Desarrollo · 3 sprints', usd.format(2400)],
          ['Descuento por pronto pago', `−${usd.format(200)}`],
        ]}
        total={['Total', usd.format(3400)]}
        note={{ label: 'Válida hasta el 15 de diciembre' }}
        status={status}
        always={{ label: 'Aprobar solas las de menos de $500', checked: always, onChange: setAlways }}
        middle={{ label: 'Pedir cambios', onPress: () => toast('Escribe qué cambiar (es una demo)') }}
        onReject={() => setStatus('rejected')}
        onApprove={() => setStatus('approved')}
      />
      {status && (
        <Button size="sm" variant="ghost" className="mt-2" onPress={() => setStatus(null)}>
          Volver a empezar
        </Button>
      )}
    </div>
  );
}

function QuestionDemo() {
  const [i, setI] = useState(0);
  const qs = [
    ['¿Cómo quieres que te paguen?', [['zelle', 'Zelle', 'En dólares, al momento'], ['pm', 'Pago Móvil', 'En bolívares, a la tasa del día'], ['usdt', 'Binance', 'En USDT']]],
    ['¿Cada cuánto envías la factura?', [['fin', 'A fin de mes', 'Todo junto'], ['entrega', 'Al entregar', 'Por cada fase'], ['adelanto', 'Por adelantado', 'Antes de empezar']]],
    ['¿Quién aprueba los diseños?', [['yo', 'El cliente', 'Desde su app'], ['equipo', 'Su equipo', 'Varias personas']]],
  ];
  if (i >= qs.length)
    return (
      <Button size="sm" variant="secondary" onPress={() => setI(0)}>
        Listo · volver a empezar
      </Button>
    );
  return (
    <div className="w-full max-w-md">
      <QuestionCard key={i} question={qs[i][0]} options={qs[i][1]} step={i + 1} steps={qs.length} onContinue={() => setI(i + 1)} onSkip={() => setI(i + 1)} onClose={() => setI(qs.length)} />
    </div>
  );
}

function ChatDemo() {
  return (
    <div className="w-full max-w-xl">
      <ChatThread>
        <ChatMessage mine time="10:02" text="¿Pueden cambiar el color del botón de pagar al verde de la marca?" />
        <ChatMessage
          author="Alan · Schwarck"
          time="10:05"
          text={'¡Claro! Lo cambio hoy y te aviso por aquí. Quedaría así:\n\n- Botón **verde** `#1f9d46`\n- Texto en blanco'}
          actions={[
            { id: 'like', label: 'Me gusta', icon: ThumbsUp, onPress: () => toast('👍') },
            { id: 'task', label: 'Crear tarea', icon: ListCheck, onPress: () => toast('Tarea creada (demo)') },
          ]}
        />
      </ChatThread>
    </div>
  );
}

function LoaderDemo() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-7">
        {LOADERS.map((v) => (
          <div key={v} className="flex flex-col items-center gap-2">
            <Loader variant={v} label={`Cargando (${v})`} />
            <span className="font-mono text-[11px] text-muted">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Loader variant="dots" size="sm" />
        <ShimmerText className="text-sm font-medium">Cargando tus facturas…</ShimmerText>
      </div>
    </div>
  );
}

export const PRO = [
  {
    id: 'pro-cifras',
    title: 'Pro · Cifras y gráficos',
    pro: true,
    items: [
      { name: 'TrendChip', doc: 'trend-chip', inspired: 'trend-chip-default', desc: 'Variación con flecha: verde si es buena, roja si no.', render: TrendChipDemo },
      { name: 'Widget + KpiGroup', doc: 'widget', inspired: 'widget-with-kpis', desc: 'Cifras con su variación y su tendencia.', render: KpiWidgetDemo, wide: true },
      { name: 'ComposedChart', doc: 'composed-chart', inspired: 'composed-chart-multi-type', desc: 'Barras, área y línea en un solo eje; globo y tabla.', render: ComposedDemo, wide: true },
      { name: 'ComposedChart (barras y línea)', doc: 'composed-chart-line', inspired: 'composed-chart-default', desc: 'Leads que entran y los que se ganan.', render: ComposedLineDemo },
      { name: 'DonutChart', doc: 'pie-chart', inspired: 'widget-with-pie-chart', desc: 'Partes de un todo con sus cifras al lado.', render: DonutDemo },
      { name: 'Widget (tablero)', doc: 'widget-grid', inspired: 'widget-dashboard-grid', desc: 'Varios widgets en rejilla, como Inicio.', render: DashboardDemo, wide: true },
    ],
  },
  {
    id: 'pro-colecciones',
    title: 'Pro · Tablas, listas y tableros',
    pro: true,
    items: [
      { name: 'DataGrid', doc: 'data-grid', inspired: 'data-grid-team-members', desc: 'Buscar, filtrar, ordenar, columnas, selección y menú por fila.', render: DataGridDemo, wide: true },
      { name: 'ListView', doc: 'list-view', inspired: 'list-view-selection-modes', also: ['list-view-default'], desc: 'Filas sin selección, de una o de varias.', render: ListViewDemo, wide: true },
      { name: 'ActionBar', doc: 'action-bar', inspired: 'action-bar-default', desc: 'Barra flotante con lo que se puede hacer con lo elegido.', render: ActionBarDemo },
      { name: 'ContextMenu', doc: 'context-menu', inspired: 'context-menu-default', desc: 'Menú del clic derecho en el punto exacto.', render: ContextMenuDemo },
      { name: 'Kanban', doc: 'kanban', inspired: 'kanban-default', desc: 'Arrastrar y soltar con ratón, dedo o teclado (Alt + flechas).', render: KanbanDemo, wide: true },
    ],
  },
  {
    id: 'pro-tiempo',
    title: 'Pro · Tiempo y pasos',
    pro: true,
    items: [
      { name: 'Agenda', doc: 'agenda', inspired: 'agenda-default', desc: 'Día, semana y mes; la línea de ahora; clic en un hueco crea.', render: AgendaDemo, wide: true },
      { name: 'Timeline', doc: 'timeline', inspired: 'timeline-default', also: ['timeline-document-revisions', 'timeline-split-content', 'timeline-studio-review'], desc: 'Historial, versiones y revisión con contenido.', render: TimelineDemo, wide: true },
      { name: 'Stepper', doc: 'stepper', inspired: 'stepper-controlled-vertical', also: ['stepper-package-tracking'], desc: 'Pasos controlados y seguimiento de un proyecto.', render: StepperDemo, wide: true },
    ],
  },
  {
    id: 'pro-entrada',
    title: 'Pro · Escribir y decidir',
    pro: true,
    items: [
      { name: 'NumberStepper', doc: 'number-stepper', inspired: 'number-stepper-with-format-options', desc: 'Moneda, porcentaje, días y horas con − y +.', render: NumberStepperDemo },
      { name: 'Loader + ShimmerText', doc: 'loader', inspired: 'loader-default', desc: 'Siete cargadores en CSS y texto que brilla.', render: LoaderDemo },
      { name: 'RichText', doc: 'rich-text-editor', inspired: 'rich-text-editor-default', desc: 'Formato con barra, menú flotante y atajos; guarda Markdown.', render: RichTextDemo, wide: true },
      { name: 'ApprovalCard', doc: 'approval-card', inspired: 'approval-card-custom-approval', desc: 'Aprobar o rechazar, con desglose, Esc y Ctrl+Intro.', render: ApprovalDemo },
      { name: 'QuestionCard', doc: 'question-card', inspired: 'approval-card-default', desc: 'Preguntas con opciones, saltar y avance.', render: QuestionDemo },
      { name: 'ChatMessage', doc: 'chat-message', inspired: 'chat-message-default', desc: 'Mensajes propios y ajenos, con formato y acciones.', render: ChatDemo, wide: true },
    ],
  },
];
