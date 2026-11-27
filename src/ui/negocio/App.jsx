// Negocio (/admin/negocio/), hecho con HeroUI. Usa la sesión del panel y los datos de
// siempre (negocio-core.js y compañía): sustituye a la versión vieja, de la que conserva
// todas las funciones. /admin/negocio-nuevo/ redirige aquí.
//
// Navegación: una isla flotante arriba con las seis zonas (Inicio, Ventas,
// Trabajo, Dinero, Crecer y Negocio), el buscador, el temporizador, «Crear» y la
// cuenta; debajo, las pestañas de la zona abierta. Ver nav.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToSquare,
  ArrowRightFromSquare,
  ArrowUpRightFromSquare,
  ChevronDown,
  CircleExclamation,
  Clock,
  CloudCheck,
  Display,
  Magnifier,
  Pause,
  Play,
  Plus,
  Square,
} from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Card,
  Description,
  Dropdown,
  FieldError,
  Form,
  Header,
  Input,
  Label,
  ListBox,
  Modal,
  Popover,
  ScrollShadow,
  SearchField,
  Separator,
  Spinner,
  TextField,
  Tooltip,
  toast,
} from '@heroui/react';
import { bus, clockText, find } from '../../negocio-core.js';
import { elapsedMs, pauseTimer, resumeTimer, runningEntry, stopTimer, taskKey } from '../../negocio-work.js';
import { startAutoSync } from '../../negocio-puente.js';
import { Segment } from '../kit/Segment.jsx';
import { Loader, ShimmerText } from '../pro/index.js';
import { ThemeSwitch } from '../kit/ThemeSwitch.jsx';
import { useInstall } from '../kit/install.js';
import { Empty } from '../kit/parts.jsx';
import { go, useCrm, useLifecycle, useRoute, useSaving, useSession } from './store.js';
import { DOC_WORD, customerName, leadName } from './domain.js';
import { AREAS, CREATE, CREATE_HOME, SECTIONS, areaOf, lastSection, rememberSection, sectionOf } from './nav.js';
import { Inicio } from './screens/Inicio.jsx';
import { Cliente, Clientes, CustomerForm } from './screens/Clientes.jsx';
import { Leads } from './screens/Leads.jsx';
import { Documento, Documentos, createAndEdit } from './screens/Documentos.jsx';
import { DocEditor } from './editor/Editor.jsx';
import { Catalogo } from './screens/Catalogo.jsx';
import { Proyecto, Proyectos } from './screens/Proyectos.jsx';
import { Tareas } from './screens/Tareas.jsx';
import { Horas } from './screens/Horas.jsx';
import { Paginas } from './screens/Paginas.jsx';
import { createPage } from '../../negocio-paginas.js';
import { Cobros } from './screens/Cobros.jsx';
import { Gastos } from './screens/Gastos.jsx';
import { Marketing } from './screens/Marketing.jsx';
import { Portal } from './screens/Portal.jsx';
import { Ajustes } from './screens/Ajustes.jsx';

const LIST_OF = { invoice: 'facturas', quote: 'cotizaciones', proposal: 'propuestas', receipt: 'facturas' };

const PRIMARY = { inicio: 'factura', ventas: 'factura', trabajo: 'tarea', dinero: 'gasto', crecer: 'publicacion', negocio: 'factura' };
const SECTION_PRIMARY = { leads: 'lead', clientes: 'cliente', propuestas: 'propuesta', cotizaciones: 'cotizacion', facturas: 'factura', catalogo: 'servicio', proyectos: 'proyecto', tareas: 'tarea', horas: 'horas', paginas: 'pagina' };
const LABEL = Object.fromEntries(Object.values(CREATE).flat());
const iconOf = (k) => sectionOf(CREATE_HOME[k])?.icon;

function Login({ onLogin, expired }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm gap-5 p-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" width="40" height="40" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Negocio</h1>
            <p className="text-sm text-muted">{expired ? 'Tu sesión caducó. Entra otra vez y se guarda lo pendiente.' : 'Entra con la contraseña del panel.'}</p>
          </div>
        </div>
        <Form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onLogin(password);
            } catch (err) {
              setError(err.message);
            } finally {
              setPassword('');
              setBusy(false);
            }
          }}
        >
          <TextField
            name="password"
            type="password"
            isRequired
            autoFocus
            isInvalid={Boolean(error)}
            autoComplete="current-password"
            value={password}
            onChange={(t) => {
              setPassword(t);
              setError('');
            }}
          >
            <Label>Contraseña</Label>
            <Input />
            <FieldError>{error || 'Escribe la contraseña.'}</FieldError>
          </TextField>
          <Button type="submit" isPending={busy} className="w-full">
            {busy ? 'Comprobando…' : 'Entrar'}
          </Button>
        </Form>
      </Card>
    </main>
  );
}

function SaveStatus() {
  const s = useSaving();
  const map = {
    saved: [CloudCheck, 'Guardado', 'text-muted'],
    pending: [Spinner, 'Cambios sin guardar', 'text-muted'],
    saving: [Spinner, 'Guardando…', 'text-muted'],
    error: [CircleExclamation, s.message || 'No se guardó', 'text-danger'],
  };
  const [Icon, text, cls] = map[s.status] || map.saved;
  return (
    <Tooltip delay={200}>
      <Button variant="ghost" size="sm" isIconOnly aria-label={text} className={cls}>
        {Icon === Spinner ? <Spinner size="sm" color="current" /> : <Icon />}
      </Button>
      <Tooltip.Content>{text}</Tooltip.Content>
    </Tooltip>
  );
}

/** El temporizador en marcha, siempre a la vista: tocarlo lleva a Horas; pausar y parar al lado. */
function TimerPill() {
  useCrm();
  const e = runningEntry();
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!e?.resumedAt) return undefined;
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [e?.id, e?.resumedAt]);
  if (!e) return null;
  const task = e.taskId && find('tasks', e.taskId);
  const label = task ? `${taskKey(task)} ${task.title}` : e.note || find('projects', e.projectId)?.name || 'Sin tarea';
  return (
    <ButtonGroup size="sm" variant="secondary" className="hidden md:inline-flex">
      <Button onPress={() => go('#/horas')} aria-label={`Temporizador: ${label}`} className="max-w-56">
        <Clock className={e.resumedAt ? 'text-success' : 'text-warning'} />
        <span className="font-mono tabular-nums">{clockText(elapsedMs(e))}</span>
        <span className="hidden truncate text-muted xl:inline">{label}</span>
      </Button>
      <Button isIconOnly aria-label={e.resumedAt ? 'Pausar' : 'Seguir'} onPress={() => (e.resumedAt ? pauseTimer() : resumeTimer())}>
        <ButtonGroup.Separator />
        {e.resumedAt ? <Pause /> : <Play />}
      </Button>
      <Button
        isIconOnly
        aria-label="Parar y guardar"
        onPress={() => {
          const saved = stopTimer({ quiet: true });
          if (saved) toast.success(`Guardado: ${Math.round(saved.minutes)} min`);
          else toast('Menos de un minuto: no se guardó.');
        }}
      >
        <ButtonGroup.Separator />
        <Square />
      </Button>
    </ButtonGroup>
  );
}

/** «Crear»: la acción principal de donde estás, y en la flecha todo lo demás, por zona. */
function CreateButton({ area, section, onCreate }) {
  const main = SECTION_PRIMARY[section] || PRIMARY[area] || 'factura';
  return (
    <ButtonGroup size="sm">
      <Button size="sm" onPress={() => onCreate(main)}>
        <Plus />
        <span className="hidden sm:inline">{LABEL[main]}</span>
      </Button>
      <Dropdown>
        <Button isIconOnly size="sm" variant="primary" aria-label="Más cosas para crear">
          <ButtonGroup.Separator />
          <ChevronDown />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-56">
          <Dropdown.Menu aria-label="Crear" onAction={(k) => onCreate(String(k))}>
            {Object.entries(CREATE).map(([zone, items]) => (
              <Dropdown.Section key={zone}>
                <Header>{AREAS.find((a) => a.id === zone)?.label}</Header>
                {items.map(([k, label]) => {
                  const Icon = iconOf(k);
                  return (
                    <Dropdown.Item key={k} id={k} textValue={label}>
                      {Icon && <Icon className="size-4 shrink-0 text-muted" />}
                      <Label>{label}</Label>
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Section>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </ButtonGroup>
  );
}

/** Instalar Negocio como app de escritorio, cuando el navegador lo ofrece (Edge o Chrome). */
function InstallButton() {
  const { canInstall, install } = useInstall();
  if (!canInstall) return null;
  return (
    <Tooltip delay={400}>
      <Button isIconOnly variant="ghost" size="sm" aria-label="Instalar Negocio como app" className="hidden sm:inline-flex" onPress={() => install().then((ok) => ok && toast.success('Negocio ya está instalado: ábrelo desde el menú Inicio o el escritorio.'))}>
        <ArrowDownToSquare />
      </Button>
      <Tooltip.Content>Instalar como app</Tooltip.Content>
    </Tooltip>
  );
}

function AppRow() {
  const { canInstall, installed, done, install } = useInstall();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-default/60 p-2.5">
      <Display className="size-5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">App de escritorio</p>
        <p className="text-xs text-muted">{installed ? 'La estás usando ahora.' : done ? 'Instalada: ábrela desde el menú Inicio.' : canInstall ? 'Con su ventana y en el menú Inicio.' : 'En Edge o Chrome: menú › «Instalar Negocio».'}</p>
      </div>
      {canInstall && (
        <Button size="sm" variant="secondary" onPress={install}>
          Instalar
        </Button>
      )}
    </div>
  );
}

function Account({ onLogout }) {
  return (
    <Popover>
      <Button isIconOnly size="sm" variant="ghost" aria-label="Cuenta y apariencia">
        <Display />
      </Button>
      <Popover.Content placement="bottom end" className="w-64">
        <Popover.Dialog className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Tema</span>
            <ThemeSwitch />
          </div>
          <AppRow />
          <Separator />
          <a href="/admin/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-default">
            <ArrowUpRightFromSquare className="size-4" />
            Volver al panel
          </a>
          <a href="/admin/ui/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-default">
            <ArrowUpRightFromSquare className="size-4" />
            Catálogo de componentes
          </a>
          <Button variant="danger-soft" size="sm" onPress={onLogout}>
            <ArrowRightFromSquare />
            Salir
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** La isla flotante: zonas a la izquierda (en el teléfono, un menú) y herramientas a la derecha. */
/** true al bajar por la página (la isla se esconde); false al subir o arriba del todo. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = scrollY;
        const delta = y - last;
        if (y < 80) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.island = hidden ? 'hidden' : 'shown';
  }, [hidden]);
  return hidden;
}

function Island({ area, section, onSearch, onCreate, onLogout }) {
  const hidden = useHideOnScroll();
  const current = AREAS.find((a) => a.id === area) || AREAS[0];
  const CurIcon = current.icon;
  // Cada zona abre la última sección que se usó en ella.
  const zoneItems = useMemo(() => AREAS.map((a) => ({ id: a.id, label: a.label, href: `#/${lastSection(a)}`, icon: a.icon })), [area, section]);
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-2 pt-2 transition-transform duration-300 ease-out focus-within:translate-y-0 motion-reduce:transition-none sm:px-4 sm:pt-3 lg:px-8 ${hidden ? '-translate-y-[130%]' : ''}`}
    >
      <nav aria-label="Zonas" className="sw-glass pointer-events-auto flex w-full max-w-[1640px] items-center gap-1 rounded-full p-1.5 shadow-[var(--overlay-shadow)]">
        <a href="#/inicio" aria-label="Inicio" className="shrink-0 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <img src="/favicon.svg" alt="" width="30" height="30" />
        </a>

        {/* Escritorio: las seis zonas a la vista, en el mismo segmento de bandeja que
            las secciones; el indicador se desliza a la zona abierta. */}
        <div className="hidden lg:block">
          <Segment scroll={false} current="true" label="Zonas de trabajo" value={area} items={zoneItems} />
        </div>

        {/* Teléfono y tableta: la zona actual abre un menú con todas y sus secciones. */}
        <Dropdown>
          <Button variant="ghost" size="sm" className="lg:hidden">
            <CurIcon />
            {current.label}
            <ChevronDown className="size-3.5" />
          </Button>
          <Dropdown.Popover placement="bottom start" className="min-w-60">
            <Dropdown.Menu aria-label="Ir a" onAction={(k) => go(`#/${k}`)}>
              {AREAS.map((a) => (
                <Dropdown.Section key={a.id}>
                  <Header>{a.label}</Header>
                  {a.sections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Dropdown.Item key={s.id} id={s.id} textValue={s.label}>
                        <Icon className="size-4" />
                        <Label>{s.label}</Label>
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Section>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <span className="flex-1" />
        <Tooltip delay={400}>
          <Button isIconOnly variant="ghost" size="sm" onPress={onSearch} aria-label="Buscar (Ctrl K)">
            <Magnifier />
          </Button>
          <Tooltip.Content>Buscar · Ctrl K</Tooltip.Content>
        </Tooltip>
        <TimerPill />
        <SaveStatus />
        <CreateButton area={area} section={section} onCreate={onCreate} />
        <InstallButton />
        <Account onLogout={onLogout} />
      </nav>
    </div>
  );
}

/** Las secciones de la zona abierta, debajo de la isla: un segmento con iconos. */
function AreaTabs({ area, section }) {
  const a = AREAS.find((x) => x.id === area);
  const items = useMemo(
    () => (a ? a.sections.map((s) => ({ id: s.id, label: s.label, href: `#/${s.id}`, icon: s.icon })) : []),
    [a],
  );
  if (!a || items.length < 2) return null;
  // La clave por zona hace que, al cambiar de zona, el indicador aparezca en su
  // sitio en lugar de deslizarse desde las opciones de la zona anterior.
  return <Segment key={area} items={items} value={section} label={`Secciones de ${a.label}`} className="mb-6" />;
}

/** Buscador (Ctrl+K o ⌘K): secciones, clientes, leads, documentos, proyectos, tareas y páginas. */
function CommandPalette({ isOpen, onOpenChange }) {
  const [state, v] = useCrm();
  const [q, setQ] = useState('');
  const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const results = useMemo(() => {
    const t = plain(q.trim());
    const hit = (s) => !t || plain(s).includes(t);
    const zone = (id) => AREAS.find((a) => a.id === id)?.label;
    const out = [];
    for (const s of SECTIONS) if (hit(`${s.label} ${zone(s.area)}`)) out.push({ id: `s-${s.id}`, label: s.label, sub: `Sección · ${zone(s.area)}`, href: `#/${s.id}` });
    if (t) {
      for (const c of state.customers) if (hit(`${c.name} ${c.company} ${c.email}`)) out.push({ id: `c-${c.id}`, label: c.name, sub: 'Cliente', href: `#/clientes/${c.id}` });
      for (const l of state.leads || []) if (hit(`${l.name} ${l.company} ${l.interest}`)) out.push({ id: `l-${l.id}`, label: leadName(l), sub: 'Lead', href: `#/leads/${l.id}` });
      for (const d of state.docs) if (hit(`${d.number} ${customerName(d)} ${d.title || ''}`)) out.push({ id: `d-${d.id}`, label: `${DOC_WORD[d.type]} ${d.number || '(borrador)'}`, sub: customerName(d), href: `#/documentos/${d.id}` });
      for (const p of state.projects) if (hit(`${p.name} ${p.code}`)) out.push({ id: `p-${p.id}`, label: p.name || 'Proyecto', sub: 'Proyecto', href: `#/proyectos/${p.id}` });
      for (const k of state.tasks) if (hit(`${taskKey(k)} ${k.title}`)) out.push({ id: `t-${k.id}`, label: `${taskKey(k)} ${k.title || 'Sin título'}`, sub: 'Tarea', href: `#/tareas/${encodeURIComponent(k.id)}` });
      for (const g of state.pages || []) if (hit(g.title)) out.push({ id: `g-${g.id}`, label: `${g.icon || '📄'} ${g.title || 'Sin título'}`, sub: 'Página', href: `#/paginas/${g.id}` });
    }
    return out.slice(0, 40);
  }, [q, v, state]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="top">
          <Modal.Dialog className="sm:max-w-[560px]" aria-label="Buscar">
            {({ close }) => (
              <div className="flex flex-col gap-3">
                <SearchField aria-label="Buscar en Negocio" value={q} onChange={setQ} autoFocus>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Clientes, facturas, tareas, páginas o secciones…" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <ScrollShadow className="max-h-[55vh]">
                  <ListBox
                    aria-label="Resultados"
                    selectionMode="none"
                    onAction={(key) => {
                      const r = results.find((x) => x.id === key);
                      if (!r) return;
                      close();
                      setQ('');
                      go(r.href);
                    }}
                    renderEmptyState={() => <p className="p-4 text-center text-sm text-muted">Nada coincide con «{q}».</p>}
                  >
                    {results.map((r) => (
                      <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                        <div className="flex flex-col">
                          <Label>{r.label}</Label>
                          <Description>{r.sub}</Description>
                        </div>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </ScrollShadow>
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Screen({ route }) {
  const [section = 'inicio', id, sub] = route;
  switch (section) {
    case '':
    case 'inicio':
      return <Inicio />;
    case 'leads':
      return <Leads id={id && !['embudo', 'lista', 'analisis'].includes(id) ? id : null} tab={id} />;
    case 'clientes':
      return id ? <Cliente id={id} /> : <Clientes />;
    case 'facturas':
      return <Documentos type="invoice" />;
    case 'cotizaciones':
      return <Documentos type="quote" />;
    case 'propuestas':
      return <Documentos type="proposal" isNew={id === 'nueva'} />;
    case 'documentos':
      return sub === 'editar' ? <DocEditor key={id} id={id} /> : <Documento id={id} />;
    case 'doc':
      // Enlaces de la versión vieja (#/doc/…): abren el editor nuevo.
      return <DocEditor key={id} id={id} />;
    case 'catalogo':
      return <Catalogo isNew={id === 'nuevo'} />;
    case 'proyectos':
      return id && id !== 'nuevo' ? <Proyecto id={id} /> : <Proyectos isNew={id === 'nuevo'} />;
    case 'tareas':
      return <Tareas open={id} />;
    case 'horas':
      return <Horas isNew={id === 'nueva'} />;
    case 'paginas':
      return <Paginas id={id} />;
    case 'cobros':
      return <Cobros />;
    case 'gastos':
      return <Gastos tab={id} />;
    case 'marketing':
      return <Marketing tab={id} arg={sub} />;
    case 'portal':
      return <Portal tab={id} arg={sub} />;
    case 'ajustes':
    case 'formas-de-cobro':
    case 'biblioteca':
    case 'copia':
      return <Ajustes section={section} tab={id} />;
    default:
      return <Empty title="Esta sección no existe" action={<Button onPress={() => go('#/inicio')}>Ir al inicio</Button>} />;
  }
}

function Shell({ onLogout }) {
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(null);
  useLifecycle(true);
  useCrm();

  const section = route[0] === 'documentos' || route[0] === 'doc' ? LIST_OF[find('docs', route[1])?.type] || 'facturas' : sectionOf(route[0] || 'inicio')?.id || 'inicio';
  const area = areaOf(section).id;
  useEffect(() => rememberSection(section), [section]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    addEventListener('keydown', onKey);
    const onConflict = (e) =>
      toast.warning(e.detail.reason === 'signed' ? 'El cliente ya firmó este documento: se guardó solo su estado.' : 'Esto cambió en otro dispositivo. Se cargó la versión más reciente.');
    const onRejected = (e) => toast.danger('No se guardó un cambio', { description: e.detail.message });
    bus.addEventListener('conflict', onConflict);
    bus.addEventListener('rejected', onRejected);
    // Proyectos y documentos publicados se ponen al día solos en el portal de cada cliente.
    startAutoSync();
    return () => {
      removeEventListener('keydown', onKey);
      bus.removeEventListener('conflict', onConflict);
      bus.removeEventListener('rejected', onRejected);
    };
  }, []);

  const create = (key) => {
    const to = {
      lead: '#/leads/nuevo',
      proyecto: '#/proyectos/nuevo',
      tarea: '#/tareas/nueva',
      horas: '#/horas/nueva',
      gasto: '#/gastos/nuevo',
      publicacion: '#/marketing/nueva',
      servicio: '#/catalogo/nuevo',
    }[key];
    if (to) return go(to);
    if (key === 'cliente') return setCreating('cliente');
    if (key === 'factura') return createAndEdit('invoice');
    if (key === 'cotizacion') return createAndEdit('quote');
    if (key === 'propuesta') return createAndEdit('proposal');
    if (key === 'pagina') return createPage({ template: 'blank' });
    return undefined;
  };
  const createRef = useRef(create);
  createRef.current = create;
  useEffect(() => {
    const onCreate = (e) => createRef.current(e.detail);
    addEventListener('negocio:create', onCreate);
    return () => removeEventListener('negocio:create', onCreate);
  }, []);

  return (
    <div className="min-h-screen">
      <Island area={area} section={section} onSearch={() => setSearchOpen(true)} onCreate={create} onLogout={onLogout} />
      <main className="mx-auto w-full max-w-[1680px] px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        {/* En el editor de un documento la barra del propio editor ya dice dónde estás. */}
        {!(route[0] === 'doc' || (route[0] === 'documentos' && route[2] === 'editar')) && <AreaTabs area={area} section={section} />}
        <Screen route={route} />
      </main>
      <CommandPalette isOpen={searchOpen} onOpenChange={setSearchOpen} />
      {creating === 'cliente' && <CustomerForm isOpen onOpenChange={(o) => !o && setCreating(null)} onSaved={(c) => go(`#/clientes/${c.id}`)} />}
    </div>
  );
}

export function NegocioApp() {
  const { phase, error, login, logout } = useSession();
  const [wasReady, setWasReady] = useState(false);
  useEffect(() => {
    if (phase === 'ready') setWasReady(true);
  }, [phase]);

  if (phase === 'checking' || phase === 'loading')
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <img src="/favicon.svg" alt="" width="44" height="44" />
        <Loader variant="dots" label="Cargando Negocio" />
        <ShimmerText className="text-sm font-medium">{phase === 'checking' ? 'Comprobando la sesión…' : 'Cargando tu negocio…'}</ShimmerText>
      </main>
    );
  if (phase === 'error')
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Empty icon={CircleExclamation} title="No se pudo abrir Negocio" text={error} action={<Button onPress={() => location.reload()}>Reintentar</Button>} />
      </main>
    );
  if (phase === 'login') return <Login onLogin={login} expired={wasReady} />;
  return <Shell onLogout={logout} />;
}
