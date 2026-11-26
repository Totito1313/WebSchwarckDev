// Catálogo · Datos, Avisos y progreso, Estructura, Personas, Texto y Utilidades.
import { useMemo, useState } from 'react';
import { Bell, Bold, CircleCheck, CircleDollar, CircleFill, Comment, Copy, FileText, Italic, Scissors, Underline } from '@gravity-ui/icons';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Chip,
  CloseButton,
  EmptyState,
  Kbd,
  Label,
  Link,
  Meter,
  ProgressBar,
  ProgressCircle,
  ScrollShadow,
  Separator,
  Skeleton,
  Spinner,
  Surface,
  Switch,
  Table,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
  toast,
} from '@heroui/react';
import { CLIENTS, INVOICES, INVOICE_STATUS, fmtMoney, initials } from './sample.js';

function ChipDemo() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(INVOICE_STATUS).map(([k, s]) => (
          <Chip key={k} color={s.color} variant="soft">
            <CircleFill width={6} />
            <Chip.Label>{s.label}</Chip.Label>
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip variant="primary" color="accent">
          Primario
        </Chip>
        <Chip variant="secondary">Secundario</Chip>
        <Chip variant="tertiary">Terciario</Chip>
        <Chip size="sm">Pequeño</Chip>
        <Chip size="lg" color="success">
          Grande
        </Chip>
      </div>
    </div>
  );
}

function BadgeDemo() {
  return (
    <div className="flex items-center gap-6">
      <Badge.Anchor>
        <Button isIconOnly aria-label="Avisos" variant="secondary">
          <Bell />
        </Button>
        <Badge color="danger" size="sm">
          3
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <Avatar color="accent" variant="soft">
          <Avatar.Fallback>CA</Avatar.Fallback>
        </Avatar>
        <Badge color="success" placement="bottom-right" size="sm" />
      </Badge.Anchor>
      <Badge.Anchor>
        <Button isIconOnly aria-label="Comentarios" variant="tertiary">
          <Comment />
        </Button>
        <Badge color="accent" size="sm">
          Nuevo
        </Badge>
      </Badge.Anchor>
    </div>
  );
}

function TableDemo() {
  const [sort, setSort] = useState({ column: 'date', direction: 'descending' });
  const [selected, setSelected] = useState(new Set());
  const rows = useMemo(() => {
    const list = [...INVOICES].sort((a, b) => {
      const x = a[sort.column];
      const y = b[sort.column];
      const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.direction === 'descending' ? -cmp : cmp;
    });
    return list;
  }, [sort]);
  const col = (id, label, extra = {}) => (
    <Table.Column allowsSorting id={id} {...extra}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );
  return (
    <div className="flex w-full flex-col gap-2">
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Facturas"
            className="min-w-[620px]"
            sortDescriptor={sort}
            onSortChange={setSort}
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectionChange={setSelected}
          >
            <Table.Header>
              <Table.Column className="pe-0">
                <Checkbox aria-label="Elegir todas" slot="selection">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              {col('id', 'Número', { isRowHeader: true })}
              {col('client', 'Cliente')}
              {col('date', 'Fecha')}
              {col('total', 'Total')}
              <Table.Column>Estado</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id} id={r.id}>
                  <Table.Cell className="pe-0">
                    <Checkbox aria-label={`Elegir ${r.id}`} slot="selection" variant="secondary">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </Table.Cell>
                  <Table.Cell className="font-medium">{r.id}</Table.Cell>
                  <Table.Cell>{r.client}</Table.Cell>
                  <Table.Cell>{new Date(`${r.date}T12:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</Table.Cell>
                  <Table.Cell className="tabular-nums">{fmtMoney(r.total)}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={INVOICE_STATUS[r.status].color}>
                      {INVOICE_STATUS[r.status].label}
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p className="text-sm text-muted">
        {selected === 'all' ? 'Todas elegidas.' : selected.size ? `${selected.size} elegidas.` : 'Toca una cabecera para ordenar.'}
      </p>
    </div>
  );
}

function AlertDemo() {
  return (
    <div className="grid w-full gap-3">
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>El cliente abrió la cotización</Alert.Title>
          <Alert.Description>COT-2026-0018 pasó a «Vista» hace 5 minutos.</Alert.Description>
        </Alert.Content>
      </Alert>
      <Alert status="success">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Pago recibido</Alert.Title>
        </Alert.Content>
        <CloseButton aria-label="Cerrar" />
      </Alert>
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>2 facturas vencen mañana</Alert.Title>
          <Alert.Description>Lion Fitness y Nexus Talent.</Alert.Description>
        </Alert.Content>
        <Button size="sm" variant="secondary">
          Ver
        </Button>
      </Alert>
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>No se pudo guardar</Alert.Title>
          <Alert.Description>La página pasa del tamaño máximo. Lo demás sí se guardó.</Alert.Description>
        </Alert.Content>
      </Alert>
      <Alert>
        <Alert.Indicator>
          <Spinner size="sm" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Sincronizando los portales…</Alert.Title>
        </Alert.Content>
      </Alert>
    </div>
  );
}

function MeterDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <Meter value={68} color="accent">
        <Label>Presupuesto usado</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter value={92} color="danger" size="sm">
        <Label>Almacén de archivos</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter value={35} color="success" size="lg" formatOptions={{ style: 'percent' }} minValue={0} maxValue={100}>
        <Label>Conversión de leads</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  );
}

function ProgressBarDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <ProgressBar value={75}>
        <Label>Tareas hechas</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar value={40} color="warning" size="sm">
        <Label>Subiendo el recibo</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar isIndeterminate aria-label="Cargando" size="sm">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}

function ProgressCircleDemo() {
  return (
    <div className="flex items-center gap-6">
      {[
        [25, 'sm', 'warning'],
        [60, 'md', 'accent'],
        [100, 'lg', 'success'],
      ].map(([v, size, color]) => (
        <div key={v} className="flex flex-col items-center gap-1">
          <ProgressCircle aria-label={`${v} %`} value={v} size={size} color={color}>
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
          <span className="text-xs text-muted">{v} %</span>
        </div>
      ))}
      <ProgressCircle aria-label="Cargando" isIndeterminate>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="flex items-center gap-5">
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" color="success" />
      <Spinner size="xl" color="warning" />
      <Button isPending variant="secondary">
        Enviando
      </Button>
    </div>
  );
}

function SkeletonDemo() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Card className="w-full">
        {loaded ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar color="accent" variant="soft">
                <Avatar.Fallback>CA</Avatar.Fallback>
              </Avatar>
              <div>
                <p className="font-medium">Café Aroma</p>
                <p className="text-sm text-muted">3 proyectos · $ 4.200 facturados</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-2/5 rounded-lg" />
              <Skeleton className="h-3 w-4/5 rounded-lg" />
            </div>
          </div>
        )}
      </Card>
      <Button size="sm" variant="tertiary" onPress={() => setLoaded((l) => !l)}>
        {loaded ? 'Volver a cargar' : 'Terminar de cargar'}
      </Button>
    </div>
  );
}

function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onPress={() => toast('Cambios guardados')}>
        Normal
      </Button>
      <Button size="sm" variant="secondary" onPress={() => toast.success('Factura enviada', { description: 'FAC-2026-0043 a Lion Fitness' })}>
        Éxito
      </Button>
      <Button size="sm" variant="secondary" onPress={() => toast.warning('La tasa del día no está puesta')}>
        Aviso
      </Button>
      <Button size="sm" variant="secondary" onPress={() => toast.danger('La sesión caducó', { description: 'Entra otra vez para seguir guardando.' })}>
        Error
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onPress={() =>
          toast.promise(new Promise((r) => setTimeout(r, 1500)), {
            loading: 'Sincronizando…',
            success: 'Portales al día',
            error: 'No se pudo sincronizar',
          })
        }
      >
        Con espera
      </Button>
    </div>
  );
}

function CardDemo() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <Card>
        <Card.Header>
          <span className="sw-eyebrow">Cobrado este mes</span>
          <Card.Title className="sw-figure text-4xl">$ 5.430</Card.Title>
          <Card.Description>+18 % frente al mes pasado</Card.Description>
        </Card.Header>
      </Card>
      <Card variant="secondary">
        <CircleDollar className="size-6 text-accent" aria-hidden />
        <Card.Header>
          <Card.Title>Formas de cobro</Card.Title>
          <Card.Description>Pago Móvil, Zelle y Binance Pay con su enlace y QR.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Link href="#">
            Configurar
            <Link.Icon />
          </Link>
        </Card.Footer>
      </Card>
      <Card variant="tertiary">
        <Card.Header>
          <Card.Title>Terciaria</Card.Title>
          <Card.Description>Para tarjetas dentro de tarjetas.</Card.Description>
        </Card.Header>
      </Card>
      <Card variant="transparent" className="border border-dashed border-border">
        <Card.Header>
          <Card.Title>Transparente</Card.Title>
          <Card.Description>Solo la estructura.</Card.Description>
        </Card.Header>
      </Card>
    </div>
  );
}

function SurfaceDemo() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {['default', 'secondary', 'tertiary', 'transparent'].map((v) => (
        <Surface key={v} variant={v} className="rounded-3xl p-5">
          <p className="font-medium">{{ default: 'Por defecto', secondary: 'Secundaria', tertiary: 'Terciaria', transparent: 'Transparente' }[v]}</p>
          <p className="text-sm text-muted">variant=&quot;{v}&quot;</p>
        </Surface>
      ))}
    </div>
  );
}

function SeparatorDemo() {
  return (
    <div className="w-full max-w-sm">
      <p className="font-medium">Factura FAC-2026-0042</p>
      <p className="text-sm text-muted">PatrykBioHacker · vence el 25 nov</p>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4 text-sm">
        <span>Ver</span>
        <Separator orientation="vertical" />
        <span>Cobrar</span>
        <Separator orientation="vertical" />
        <span>Compartir</span>
      </div>
    </div>
  );
}

function ToolbarDemo() {
  return (
    <Toolbar aria-label="Formato de la página">
      <ToggleButtonGroup aria-label="Estilo" selectionMode="multiple">
        <ToggleButton isIconOnly aria-label="Negrita" id="b">
          <Bold />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Cursiva" id="i">
          <ToggleButtonGroup.Separator />
          <Italic />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Subrayado" id="u">
          <ToggleButtonGroup.Separator />
          <Underline />
        </ToggleButton>
      </ToggleButtonGroup>
      <Separator />
      <ButtonGroup variant="tertiary">
        <Button isIconOnly aria-label="Copiar">
          <Copy />
        </Button>
        <Button isIconOnly aria-label="Cortar">
          <ButtonGroup.Separator />
          <Scissors />
        </Button>
      </ButtonGroup>
      <Separator />
      <Switch size="sm" aria-label="Vista previa">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </Toolbar>
  );
}

function AvatarDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar size="sm">
        <Avatar.Image alt="Schwarck" src="/favicon.svg" />
        <Avatar.Fallback>SW</Avatar.Fallback>
      </Avatar>
      {CLIENTS.slice(0, 4).map((c, i) => (
        <Avatar key={c.id} color={c.color} variant={i % 2 ? 'soft' : 'default'} size={['sm', 'md', 'lg', 'md'][i]}>
          <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
        </Avatar>
      ))}
    </div>
  );
}

function AvatarGroupDemo() {
  return (
    <div className="flex flex-col gap-3">
      <AvatarGroup variant="soft">
        {CLIENTS.map((c) => (
          <Avatar key={c.id} color={c.color}>
            <Avatar.Fallback>{initials(c.contact)}</Avatar.Fallback>
          </Avatar>
        ))}
      </AvatarGroup>
      <AvatarGroup size="sm" max={3}>
        {CLIENTS.map((c) => (
          <Avatar key={c.id} color={c.color} variant="soft">
            <Avatar.Fallback>{initials(c.contact)}</Avatar.Fallback>
          </Avatar>
        ))}
      </AvatarGroup>
    </div>
  );
}

function KbdDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">Buscar</span>
      <Kbd>
        <Kbd.Abbr keyValue="ctrl" />
        <Kbd.Content>K</Kbd.Content>
      </Kbd>
      <Kbd>
        <Kbd.Abbr keyValue="command" />
        <Kbd.Content>K</Kbd.Content>
      </Kbd>
      <span className="text-muted">o</span>
      <Kbd variant="light">
        <Kbd.Content>/</Kbd.Content>
      </Kbd>
      <span className="text-muted">Negrita</span>
      <Kbd>
        <Kbd.Abbr keyValue="ctrl" />
        <Kbd.Content>B</Kbd.Content>
      </Kbd>
    </div>
  );
}

function TypographyDemo() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <Typography type="h1">Tu proyecto</Typography>
      <Typography type="h2">Hoy en tu proyecto</Typography>
      <Typography type="h3">Reporte diario</Typography>
      <Typography type="h4">Tareas hechas</Typography>
      <Typography>El estudio terminó el diseño del carrusel y empezó el guion del reel.</Typography>
      <Typography color="muted" type="body-sm">
        Enviado por Ana a las 18:40.
      </Typography>
      <Typography type="body-xs" color="muted">
        Texto extra pequeño para notas al pie.
      </Typography>
      <Typography type="code">FAC-2026-0042</Typography>
      <p className="sw-figure text-5xl">$ 12.480</p>
    </div>
  );
}

function ScrollShadowDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <ScrollShadow className="max-h-[200px] rounded-2xl bg-surface-secondary p-4">
        <ul className="flex flex-col gap-3 text-sm">
          {Array.from({ length: 14 }, (_, i) => (
            <li key={i} className="flex items-center gap-2">
              <CircleCheck className="text-success" /> Tarea {i + 1}: {['Diseñar la portada', 'Revisar el copy', 'Subir el reel', 'Responder comentarios'][i % 4]}
            </li>
          ))}
        </ul>
      </ScrollShadow>
      <ScrollShadow orientation="horizontal" className="rounded-2xl">
        <div className="flex w-max gap-2 p-1">
          {Array.from({ length: 12 }, (_, i) => (
            <Chip key={i} variant="soft" color={i % 3 ? 'default' : 'accent'}>
              {['Instagram', 'Facebook', 'TikTok', 'WhatsApp'][i % 4]} {i + 1}
            </Chip>
          ))}
        </div>
      </ScrollShadow>
    </div>
  );
}

function EmptyStateDemo() {
  return (
    <EmptyState className="w-full rounded-3xl border border-dashed border-border p-8">
      <FileText className="size-8 text-muted" />
      <p className="font-medium">Todavía no hay facturas</p>
      <p className="text-sm text-muted">Crea la primera y aparecerá aquí.</p>
      <Button size="sm">Nueva factura</Button>
    </EmptyState>
  );
}

export const DATOS = [
  {
    id: 'datos',
    title: 'Datos',
    items: [
      { name: 'Chip', doc: 'chip', desc: 'Estados de facturas, etapas y etiquetas.', render: ChipDemo },
      { name: 'Badge', doc: 'badge', desc: 'Puntos de aviso y contadores sobre otro elemento.', render: BadgeDemo },
      { name: 'Table', doc: 'table', desc: 'Filas con orden por columna y selección.', render: TableDemo, wide: true },
    ],
  },
  {
    id: 'avisos',
    title: 'Avisos y progreso',
    items: [
      { name: 'Alert', doc: 'alert', desc: 'Mensajes con estado, acción o cierre.', render: AlertDemo, wide: true },
      { name: 'Toast', doc: 'toast', desc: 'Avisos que se van solos.', render: ToastDemo },
      { name: 'Meter', doc: 'meter', desc: 'Medidores: cuánto se ha usado de algo.', render: MeterDemo },
      { name: 'ProgressBar', doc: 'progress-bar', desc: 'Avance de una tarea, con o sin final conocido.', render: ProgressBarDemo },
      { name: 'ProgressCircle', doc: 'progress-circle', desc: 'El anillo de progreso del portal.', render: ProgressCircleDemo },
      { name: 'Spinner', doc: 'spinner', desc: 'Cargando, en cuatro tamaños.', render: SpinnerDemo },
      { name: 'Skeleton', doc: 'skeleton', desc: 'La forma de lo que viene mientras carga.', render: SkeletonDemo },
    ],
  },
  {
    id: 'estructura',
    title: 'Estructura',
    items: [
      { name: 'Card', doc: 'card', desc: 'Tarjetas: cifras, ajustes y bloques.', render: CardDemo, wide: true },
      { name: 'Surface', doc: 'surface', desc: 'Superficies en cuatro niveles.', render: SurfaceDemo },
      { name: 'Separator', doc: 'separator', desc: 'Líneas horizontales y verticales.', render: SeparatorDemo },
      { name: 'Toolbar', doc: 'toolbar', desc: 'Controles agrupados que se recorren con flechas.', render: ToolbarDemo },
      { name: 'EmptyState', doc: 'list-box', desc: 'Lo que se ve cuando una lista está vacía.', render: EmptyStateDemo },
    ],
  },
  {
    id: 'personas',
    title: 'Personas',
    items: [
      { name: 'Avatar', doc: 'avatar', desc: 'Foto o iniciales, en tres tamaños y cinco colores.', render: AvatarDemo },
      { name: 'AvatarGroup', doc: 'avatar-group', desc: 'Quién tiene acceso, con el resto contado.', render: AvatarGroupDemo },
    ],
  },
  {
    id: 'texto',
    title: 'Texto',
    items: [
      { name: 'Typography', doc: 'typography', desc: 'Títulos, cuerpo y código (más la Anton de las cifras).', render: TypographyDemo },
      { name: 'Kbd', doc: 'kbd', desc: 'Atajos de teclado.', render: KbdDemo },
    ],
  },
  {
    id: 'utilidades',
    title: 'Utilidades',
    items: [{ name: 'ScrollShadow', doc: 'scroll-shadow', desc: 'Sombra en los bordes cuando hay más contenido.', render: ScrollShadowDemo }],
  },
];
