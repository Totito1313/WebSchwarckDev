// Negocio nuevo (/admin/negocio-nuevo/): el mismo negocio de /admin/negocio/,
// rehecho con HeroUI. Usa la misma sesión del panel y los mismos datos: lo que se
// cambia aquí se ve allí y al revés. Mientras se rehacen, las secciones que faltan
// llevan a su versión de siempre.
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightFromSquare,
  ArrowUpRightFromSquare,
  Bars,
  Box,
  CircleExclamation,
  Clock,
  CloudCheck,
  FileText,
  Folder,
  Funnel,
  Gear,
  Hammer,
  House,
  ListCheck,
  Magnifier,
  Megaphone,
  PaperPlane,
  Persons,
  Plus,
  Receipt,
  Smartphone,
  SquareArticle,
  Wallet,
} from '@gravity-ui/icons';
import {
  Button,
  Card,
  Description,
  Drawer,
  Dropdown,
  FieldError,
  Form,
  Input,
  Kbd,
  Label,
  ListBox,
  Modal,
  ScrollShadow,
  SearchField,
  Separator,
  Spinner,
  TextField,
  Tooltip,
  toast,
} from '@heroui/react';
import { bus, find } from '../../negocio-core.js';
import { ThemeSwitch } from '../kit/ThemeSwitch.jsx';
import { Empty } from '../kit/parts.jsx';
import { go, useCrm, useLifecycle, useRoute, useSaving, useSession } from './store.js';
import { DOC_WORD, customerName, leadName } from './domain.js';
import { Inicio } from './screens/Inicio.jsx';
import { Cliente, Clientes, CustomerForm } from './screens/Clientes.jsx';
import { Leads } from './screens/Leads.jsx';
import { Documento, Documentos, createAndEdit } from './screens/Documentos.jsx';

const OLD = '/admin/negocio/';

// Las secciones del riel, agrupadas. `ready: false` = todavía en la versión de siempre.
const NAV = [
  { group: null, items: [{ id: 'inicio', label: 'Inicio', icon: House, ready: true }] },
  {
    group: 'Ventas',
    items: [
      { id: 'leads', label: 'Leads', icon: Funnel, ready: true },
      { id: 'clientes', label: 'Clientes', icon: Persons, ready: true },
      { id: 'propuestas', label: 'Propuestas', icon: PaperPlane, ready: true },
      { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText, ready: true },
      { id: 'facturas', label: 'Facturas', icon: Receipt, ready: true },
    ],
  },
  {
    group: 'Trabajo',
    items: [
      { id: 'proyectos', label: 'Proyectos', icon: Folder },
      { id: 'tareas', label: 'Tareas', icon: ListCheck },
      { id: 'horas', label: 'Horas', icon: Clock },
      { id: 'paginas', label: 'Páginas', icon: SquareArticle },
    ],
  },
  { group: 'Dinero', items: [{ id: 'gastos', label: 'Gastos', icon: Wallet }] },
  {
    group: 'Crecer',
    items: [
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
      { id: 'portal', label: 'Portal de clientes', icon: Smartphone },
    ],
  },
  {
    group: 'Negocio',
    items: [
      { id: 'catalogo', label: 'Catálogo', icon: Box },
      { id: 'ajustes', label: 'Ajustes', icon: Gear },
    ],
  },
];
const ALL = NAV.flatMap((g) => g.items);
const LIST_OF = { invoice: 'facturas', quote: 'cotizaciones', proposal: 'propuestas', receipt: 'facturas' };

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
          <TextField name="password" type="password" isRequired autoFocus isInvalid={Boolean(error)} autoComplete="current-password" value={password} onChange={(t) => { setPassword(t); setError(''); }}>
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

function NavList({ active, onNavigate }) {
  return (
    <nav aria-label="Secciones" className="flex flex-col gap-4">
      {NAV.map(({ group, items }) => (
        <div key={group || 'top'} className="flex flex-col gap-0.5">
          {group && <p className="sw-eyebrow px-3 pb-1">{group}</p>}
          {items.map(({ id, label, icon: Icon, ready }) => {
            const on = active === id;
            return (
              <a
                key={id}
                href={ready ? `#/${id}` : `${OLD}#/${id}`}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                  on ? 'bg-foreground font-medium text-background' : 'text-foreground hover:bg-default'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {!ready && <ArrowUpRightFromSquare className="size-3 text-muted" aria-label="Versión de siempre" />}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

const CREATE = [
  ['lead', 'Nuevo lead', Funnel],
  ['cliente', 'Nuevo cliente', Persons],
  ['factura', 'Nueva factura', Receipt],
  ['cotizacion', 'Nueva cotización', FileText],
];

/** Buscador (Ctrl+K o ⌘K): secciones, clientes, leads y documentos. */
function CommandPalette({ isOpen, onOpenChange }) {
  const [state, v] = useCrm();
  const [q, setQ] = useState('');
  const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const results = useMemo(() => {
    const t = plain(q.trim());
    const hit = (s) => !t || plain(s).includes(t);
    const out = [];
    for (const s of ALL) if (hit(s.label)) out.push({ id: `s-${s.id}`, label: s.label, sub: s.ready ? 'Sección' : 'Sección (versión de siempre)', href: s.ready ? `#/${s.id}` : `${OLD}#/${s.id}` });
    if (t) {
      for (const c of state.customers) if (hit(`${c.name} ${c.company} ${c.email}`)) out.push({ id: `c-${c.id}`, label: c.name, sub: 'Cliente', href: `#/clientes/${c.id}` });
      for (const l of state.leads || []) if (hit(`${l.name} ${l.company} ${l.interest}`)) out.push({ id: `l-${l.id}`, label: leadName(l), sub: 'Lead', href: `#/leads/${l.id}` });
      for (const d of state.docs) if (hit(`${d.number} ${customerName(d)}`)) out.push({ id: `d-${d.id}`, label: `${DOC_WORD[d.type]} ${d.number || '(borrador)'}`, sub: customerName(d), href: `#/documentos/${d.id}` });
    }
    return out.slice(0, 30);
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
                    <SearchField.Input placeholder="Clientes, leads, facturas o secciones…" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <ScrollShadow className="max-h-[50vh]">
                  <ListBox
                    aria-label="Resultados"
                    selectionMode="none"
                    onAction={(key) => {
                      const r = results.find((x) => x.id === key);
                      if (!r) return;
                      close();
                      setQ('');
                      if (r.href.startsWith('#')) go(r.href);
                      else location.href = r.href;
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

function Soon({ id }) {
  const s = ALL.find((x) => x.id === id);
  return (
    <Empty
      icon={Hammer}
      title={s ? `${s.label}, en camino` : 'Esta sección no existe'}
      text={s ? 'Esta sección todavía se usa en la versión de siempre, con los mismos datos.' : 'Vuelve al inicio.'}
      action={
        s ? (
          <Button onPress={() => (location.href = `${OLD}#/${id}`)}>
            Abrir {s.label}
            <ArrowUpRightFromSquare />
          </Button>
        ) : (
          <Button onPress={() => go('#/inicio')}>Ir al inicio</Button>
        )
      }
    />
  );
}

function Screen({ route }) {
  const [section = 'inicio', id] = route;
  switch (section) {
    case '':
    case 'inicio':
      return <Inicio />;
    case 'clientes':
      return id ? <Cliente id={id} /> : <Clientes />;
    case 'leads':
      return <Leads id={id && !['embudo', 'lista', 'analisis'].includes(id) ? id : null} tab={id} />;
    case 'facturas':
      return <Documentos type="invoice" />;
    case 'cotizaciones':
      return <Documentos type="quote" />;
    case 'propuestas':
      return <Documentos type="proposal" />;
    case 'documentos':
      return <Documento id={id} />;
    default:
      return <Soon id={section} />;
  }
}

function Shell({ onLogout }) {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(null);
  useLifecycle(true);
  useCrm();

  const active = route[0] === 'documentos' ? LIST_OF[find('docs', route[1])?.type] || 'facturas' : route[0] || 'inicio';

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    addEventListener('keydown', onKey);
    // Avisos del guardado y de otros dispositivos, como en el panel de siempre.
    const onConflict = (e) =>
      toast.warning(e.detail.reason === 'signed' ? 'El cliente ya firmó este documento: se guardó solo su estado.' : 'Esto cambió en otro dispositivo. Se cargó la versión más reciente.');
    const onRejected = (e) => toast.danger('No se guardó un cambio', { description: e.detail.message });
    bus.addEventListener('conflict', onConflict);
    bus.addEventListener('rejected', onRejected);
    return () => {
      removeEventListener('keydown', onKey);
      bus.removeEventListener('conflict', onConflict);
      bus.removeEventListener('rejected', onRejected);
    };
  }, []);

  const create = (key) => {
    if (key === 'lead') go('#/leads/nuevo');
    if (key === 'cliente') setCreating('cliente');
    if (key === 'factura') createAndEdit('invoice');
    if (key === 'cotizacion') createAndEdit('quote');
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-4">
      <a href="#/inicio" className="flex items-center gap-2 px-3 pt-1">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        <span className="font-semibold tracking-tight">Negocio</span>
      </a>
      <Button variant="secondary" className="mx-1 justify-start" onPress={() => setSearchOpen(true)}>
        <Magnifier />
        <span className="flex-1 text-start">Buscar</span>
        <Kbd variant="light">
          <Kbd.Abbr keyValue="ctrl" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </Button>
      <ScrollShadow className="-mx-1 flex-1 px-1">
        <NavList active={active} onNavigate={() => setMenuOpen(false)} />
      </ScrollShadow>
      <Separator />
      <div className="flex items-center justify-between gap-2 px-1">
        <ThemeSwitch />
        <Tooltip delay={200}>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Salir" onPress={onLogout}>
            <ArrowRightFromSquare />
          </Button>
          <Tooltip.Content>Salir</Tooltip.Content>
        </Tooltip>
      </div>
      <a href={OLD} className="px-3 text-xs text-muted hover:text-foreground">
        Volver a la versión de siempre
      </a>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-separator p-3 lg:block">{sidebar}</aside>

      <div className="min-w-0 flex-1">
        <header className="sw-glass sticky top-0 z-30 flex items-center gap-2 border-x-0 border-t-0 px-3 py-2 sm:px-6">
          <Button isIconOnly variant="ghost" className="lg:hidden" aria-label="Menú" onPress={() => setMenuOpen(true)}>
            <Bars />
          </Button>
          <span className="flex-1 truncate text-sm font-medium lg:hidden">{ALL.find((s) => s.id === active)?.label || 'Negocio'}</span>
          <span className="hidden flex-1 lg:block" />
          <Button isIconOnly variant="ghost" className="lg:hidden" aria-label="Buscar" onPress={() => setSearchOpen(true)}>
            <Magnifier />
          </Button>
          <SaveStatus />
          <Dropdown>
            <Button size="sm">
              <Plus />
              <span className="hidden sm:inline">Crear</span>
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="Crear" onAction={(k) => create(String(k))}>
                {CREATE.map(([k, label, Icon]) => (
                  <Dropdown.Item key={k} id={k} textValue={label}>
                    <Icon className="size-4" />
                    <Label>{label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8">
          <Screen route={route} />
        </main>
      </div>

      <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog aria-label="Menú" className="h-full w-72 p-0">
              <Drawer.Body className="h-full p-3">{sidebar}</Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
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
        <Spinner />
        <span className="sr-only">Cargando</span>
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
