// Catálogo · Navegación y Capas (ventanas, hojas, paneles, globos).
import { useState } from 'react';
import { ChevronDown, CircleInfo, CreditCard, FileText, Gear, PersonPlus, Receipt, TrashBin } from '@gravity-ui/icons';
import {
  Accordion,
  AlertDialog,
  Breadcrumbs,
  Button,
  Description,
  Disclosure,
  DisclosureGroup,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Modal,
  Pagination,
  Popover,
  Separator,
  Sheet,
  Tabs,
  TextField,
  Tooltip,
  toast,
} from '@heroui/react';

const FAQ = [
  { icon: Receipt, title: '¿Cómo pago una factura?', body: 'Abre la factura desde tu portal y toca «Pagar»: verás Pago Móvil, Zelle o Binance Pay con su enlace y su QR.' },
  { icon: FileText, title: '¿Dónde firmo una propuesta?', body: 'En la misma hoja: escribe tu nombre o dibuja tu firma. Queda la fecha y la hora.' },
  { icon: CreditCard, title: '¿Puedo pagar en bolívares?', body: 'Sí, a la tasa del día del pago. El estudio la anota con su fuente (BCV, paralelo…).' },
];

function AccordionDemo() {
  return (
    <Accordion className="w-full max-w-md" variant="surface" allowsMultipleExpanded>
      {FAQ.map(({ icon: Icon, title, body }) => (
        <Accordion.Item key={title}>
          <Accordion.Heading>
            <Accordion.Trigger>
              <Icon className="me-3 size-4 shrink-0 text-muted" />
              {title}
              <Accordion.Indicator>
                <ChevronDown />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>{body}</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function BreadcrumbsDemo() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#">Negocio</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#">Proyectos</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#">App de Café Aroma</Breadcrumbs.Item>
      <Breadcrumbs.Item>WEB-12</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}

function DisclosureDemo() {
  return (
    <Disclosure className="w-full max-w-md">
      <Disclosure.Heading>
        <Button slot="trigger" variant="secondary">
          Notas del reporte de hoy
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="mt-2 rounded-2xl bg-surface-secondary p-4 text-sm">
          Dificultades: el cliente no envió las fotos del menú. Observaciones: el reel sale el jueves.
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

function DisclosureGroupDemo() {
  const [open, setOpen] = useState(new Set(['permisos']));
  const items = [
    ['permisos', 'Permisos del portal', 'Qué ve y qué puede hacer su gente: cronología, calendario, leads, recursos…'],
    ['marca', 'Identidad', 'Logo, colores, tipografía, esquinas y la portada de su app.'],
    ['claude', 'Conectar Claude', 'Una dirección secreta para cargar el calendario desde Claude.'],
  ];
  return (
    <DisclosureGroup className="w-full max-w-md" expandedKeys={open} onExpandedChange={setOpen}>
      {items.map(([id, title, body], i) => (
        <div key={id}>
          {i > 0 && <Separator className="my-1" />}
          <Disclosure id={id}>
            <Disclosure.Heading>
              <Button slot="trigger" variant="ghost" className="w-full justify-between">
                {title}
                <Disclosure.Indicator className="text-muted" />
              </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body className="px-4 pb-3 text-sm text-muted">{body}</Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </div>
      ))}
    </DisclosureGroup>
  );
}

function LinkDemo() {
  return (
    <div className="flex flex-col gap-2">
      <Link href="#">Ver la factura</Link>
      <Link href="https://schwarckdev.com" target="_blank" rel="noopener noreferrer">
        schwarckdev.com
        <Link.Icon />
      </Link>
      <Link isDisabled>Enlace desactivado</Link>
    </div>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(2);
  const total = 6;
  return (
    <Pagination className="w-full justify-between">
      <Pagination.Summary>
        Facturas {(page - 1) * 10 + 1}–{Math.min(page * 10, 54)} de 54
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page === 1} onPress={() => setPage((p) => p - 1)}>
            <Pagination.PreviousIcon />
            <span>Anterior</span>
          </Pagination.Previous>
        </Pagination.Item>
        {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
          <Pagination.Item key={p}>
            <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
              {p}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next isDisabled={page === total} onPress={() => setPage((p) => p + 1)}>
            <span>Siguiente</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

function TabsDemo() {
  const tabs = [
    ['embudo', 'Embudo', 'Nuevo, contactado, calificado, propuesta, negociación, ganado y perdido.'],
    ['hoy', 'Para hoy', 'Los seguimientos del día y los atrasados.'],
    ['analisis', 'Análisis', 'Conversión, valor del embudo y leads por fuente.'],
  ];
  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs className="w-full max-w-md">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Leads">
            {tabs.map(([id, label]) => (
              <Tabs.Tab key={id} id={id}>
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {tabs.map(([id, , body]) => (
          <Tabs.Panel key={id} id={id} className="pt-3 text-sm text-muted">
            {body}
          </Tabs.Panel>
        ))}
      </Tabs>
      <Tabs className="w-full max-w-md" variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Marketing">
            {['Calendario', 'Tablero', 'Copias', 'Feed'].map((t) => (
              <Tabs.Tab key={t} id={t}>
                {t}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </div>
  );
}

function ModalDemo() {
  return (
    <Modal>
      <Button>
        <PersonPlus />
        Nuevo cliente
      </Button>
      <Modal.Backdrop variant="blur">
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Nuevo cliente</Modal.Heading>
                </Modal.Header>
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    toast.success('Cliente creado (de prueba)');
                    close();
                  }}
                >
                  <Modal.Body className="flex flex-col gap-4">
                    <TextField isRequired name="name" autoFocus>
                      <Label>Nombre</Label>
                      <Input placeholder="Café Aroma" />
                      <FieldError />
                    </TextField>
                    <TextField name="email" type="email">
                      <Label>Correo</Label>
                      <Input placeholder="hola@cliente.com" />
                      <Description>Para mandarle sus documentos.</Description>
                    </TextField>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button slot="close" variant="secondary">
                      Cancelar
                    </Button>
                    <Button type="submit">Crear</Button>
                  </Modal.Footer>
                </Form>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function AlertDialogDemo() {
  return (
    <AlertDialog>
      <Button variant="danger">
        <TrashBin />
        Borrar cliente
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Borrar a Café Aroma?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Se borran sus datos. Los documentos ya emitidos guardan su propia copia y no cambian.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancelar
              </Button>
              <Button slot="close" variant="danger" onPress={() => toast('No se borró nada: es el catálogo.')}>
                Borrar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

function DrawerDemo() {
  return (
    <Drawer>
      <Button variant="secondary">Abrir la ficha del lead</Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Laura Díaz · Instagram</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3 text-sm">
              <p>Quiere una app para su panadería. Valor estimado: $ 2.400.</p>
              <p className="text-muted">Siguiente paso: llamarla mañana a las 10:00.</p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cerrar
              </Button>
              <Button slot="close">Pasar a cliente</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function SheetDemo() {
  return (
    <Sheet>
      <Sheet.Trigger>
        <Button variant="secondary">Enviar al estudio</Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className="mx-auto max-h-[90vh] max-w-[440px]">
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>¿Qué quieres enviar?</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body className="grid grid-cols-2 gap-2">
              {['Un mensaje', 'Un enlace', 'Un archivo', 'Un vídeo'].map((t) => (
                <Button key={t} variant="tertiary" className="h-16">
                  {t}
                </Button>
              ))}
            </Sheet.Body>
            <Sheet.Footer>
              <Sheet.Close>
                <Button variant="secondary" className="w-full">
                  Cancelar
                </Button>
              </Sheet.Close>
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function PopoverDemo() {
  return (
    <Popover>
      <Button variant="secondary">
        <Gear />
        Tasa del día
      </Button>
      <Popover.Content className="max-w-72">
        <Popover.Dialog className="flex flex-col gap-3">
          <Popover.Heading className="font-medium">1 USD = Bs 36,50</Popover.Heading>
          <p className="text-sm text-muted">Fuente: BCV, puesta hoy a las 9:00. Con ella se pasan los gastos y cobros en bolívares.</p>
          <Button size="sm" slot="close" variant="tertiary">
            Cambiar
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function TooltipDemo() {
  return (
    <div className="flex items-center gap-4">
      <Tooltip delay={0}>
        <Button variant="secondary">Pasa por encima</Button>
        <Tooltip.Content>Se cuenta como abierta una vez cada media hora.</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button isIconOnly aria-label="Más información" variant="tertiary">
          <CircleInfo />
        </Button>
        <Tooltip.Content showArrow placement="right">
          <Tooltip.Arrow />
          Retención: lo que el cliente descuenta por impuestos.
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export const NAVEGACION = [
  {
    id: 'navegacion',
    title: 'Navegación',
    items: [
      { name: 'Tabs', doc: 'tabs', desc: 'Pestañas con indicador relleno o subrayado.', render: TabsDemo },
      { name: 'Breadcrumbs', doc: 'breadcrumbs', desc: 'Dónde estás dentro de Negocio.', render: BreadcrumbsDemo },
      { name: 'Pagination', doc: 'pagination', desc: 'Páginas de una lista larga.', render: PaginationDemo, wide: true },
      { name: 'Link', doc: 'link', desc: 'Enlaces internos y externos.', render: LinkDemo },
      { name: 'Accordion', doc: 'accordion', desc: 'Preguntas que se abren y cierran.', render: AccordionDemo },
      { name: 'Disclosure', doc: 'disclosure', desc: 'Un bloque que se despliega.', render: DisclosureDemo },
      { name: 'DisclosureGroup', doc: 'disclosure-group', desc: 'Varios bloques coordinados.', render: DisclosureGroupDemo },
    ],
  },
  {
    id: 'capas',
    title: 'Ventanas y capas',
    items: [
      { name: 'Modal', doc: 'modal', desc: 'Ventana con un formulario.', render: ModalDemo },
      { name: 'AlertDialog', doc: 'alert-dialog', desc: 'Confirmar algo que no se deshace.', render: AlertDialogDemo },
      { name: 'Drawer', doc: 'drawer', desc: 'Panel lateral: la ficha de un lead.', render: DrawerDemo },
      { name: 'Sheet', doc: 'sheet', desc: 'Hoja que sube desde abajo y se cierra deslizando.', render: SheetDemo },
      { name: 'Popover', doc: 'popover', desc: 'Contenido flotante junto a un botón.', render: PopoverDemo },
      { name: 'Tooltip', doc: 'tooltip', desc: 'Una pista al pasar o enfocar.', render: TooltipDemo },
    ],
  },
];
