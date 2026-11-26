// Portal nuevo (/cliente-nuevo/): la app del cliente rehecha con HeroUI. Usa la
// misma cuenta y los mismos datos que /cliente/ (Supabase, con sus reglas y
// permisos), y /cliente-nuevo/?demo enseña la demostración. Por ahora es la vista
// del cliente; el modo estudio sigue en /cliente/.
import { useState } from 'react';
import { ChartColumn, CircleExclamation, Folder, House, ListTimeline, Tray } from '@gravity-ui/icons';
import { Alert, Avatar, Button, Card, Chip, Dropdown, FieldError, Form, Input, Label, TextField } from '@heroui/react';
import { Loader, ShimmerText } from '../pro/index.js';
import { Empty } from '../kit/parts.jsx';
import { app, can, pendingTasks, toReview, unread, urlOf } from '../../portal/state.js';
import { openPortal, useBoot, usePortal, useRoute } from './store.js';
import { Inicio } from './screens/Inicio.jsx';
import { Cronologia } from './screens/Cronologia.jsx';
import { Marketing } from './screens/Marketing.jsx';
import { Peticiones, Perfil, Recursos } from './screens/Resto.jsx';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: House, href: '#/' },
  { id: 'cronologia', label: 'Cronología', icon: ListTimeline, href: '#/cronologia', perm: 'cronologia' },
  { id: 'marketing', label: 'Marketing', icon: ChartColumn, href: '#/marketing', perms: ['calendario', 'rendimiento', 'leads'] },
  { id: 'recursos', label: 'Recursos', icon: Folder, href: '#/recursos', perms: ['recursos', 'docs.view'] },
  { id: 'peticiones', label: 'Peticiones', icon: Tray, href: '#/peticiones', perm: 'peticiones' },
];
const visible = (t) => app.studio || (t.perm ? can(t.perm) : t.perms ? t.perms.some((p) => can(p)) : true);

function Login({ onSignIn }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm gap-5 p-6">
        <img src="/favicon.svg" alt="" width="44" height="44" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tu proyecto</h1>
          <p className="text-sm text-muted">Entra con el correo y la contraseña que te dio Schwarck.</p>
        </div>
        <Form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onSignIn(email.trim(), password);
            } catch (err) {
              setError(err.message);
              setPassword('');
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextField type="email" isRequired value={email} onChange={setEmail} autoComplete="username">
            <Label>Correo</Label>
            <Input inputMode="email" />
            <FieldError>Escribe tu correo.</FieldError>
          </TextField>
          <TextField type="password" isRequired value={password} onChange={setPassword} isInvalid={Boolean(error)} autoComplete="current-password">
            <Label>Contraseña</Label>
            <Input />
            <FieldError>{error || 'Escribe tu contraseña.'}</FieldError>
          </TextField>
          <Button type="submit" size="lg" isPending={busy} className="w-full">
            Entrar
          </Button>
        </Form>
        <p className="text-xs text-muted">
          ¿Olvidaste la contraseña? Pídele una nueva a Schwarck: te la cambia al momento. <a href="?demo" className="underline">Ver una demostración</a>.
        </p>
      </Card>
    </main>
  );
}

function Logo({ client, size = 'sm' }) {
  const src = urlOf(client?.logo_url);
  return (
    <Avatar size={size} className="shrink-0">
      {src && <Avatar.Image alt={client?.name} src={src} />}
      <Avatar.Fallback style={{ background: client?.accent || 'var(--accent)', color: '#fff' }}>{(client?.name || '?').slice(0, 1)}</Avatar.Fallback>
    </Avatar>
  );
}

function Screen({ route, onSignOut }) {
  const [section = '', a, b] = route;
  switch (section) {
    case 'cronologia':
      return <Cronologia filter={a} />;
    case 'marketing':
      return <Marketing tab={a} arg={b} />;
    case 'calendario':
      return <Marketing tab="calendario" arg={a} />;
    case 'recursos':
    case 'documentos':
      return <Recursos />;
    case 'peticiones':
    case 'tareas':
      return <Peticiones tab={a} />;
    case 'perfil':
      return <Perfil onSignOut={onSignOut} />;
    case '':
    case 'inicio':
      return <Inicio />;
    default:
      return (
        <Empty
          title="Esto todavía está en la versión de siempre"
          text="Proyecto, reuniones, informe del mes y el modo estudio llegan pronto a esta versión."
          action={<Button onPress={() => (location.href = `/cliente/${location.search}${location.hash}`)}>Abrirlo allí</Button>}
        />
      );
  }
}

function Shell({ onSignOut, demo }) {
  const [, v] = usePortal();
  const route = useRoute();
  const section = route[0] || 'inicio';
  const tab = { calendario: 'marketing', documentos: 'recursos', tareas: 'peticiones' }[section] || section;
  const tabs = TABS.filter(visible);
  const badge = { inicio: unread().length, marketing: toReview().length, peticiones: pendingTasks().length };
  const others = app.portals.filter((p) => p.client.id !== app.client.id);

  return (
    <div className="min-h-dvh pb-28" data-v={v}>
      <header className="sw-glass sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          {others.length ? (
            <Dropdown>
              <Button variant="ghost" className="gap-2 px-1" aria-label="Cambiar de proyecto">
                <Logo client={app.client} />
                <span className="max-w-[40vw] truncate font-semibold">{app.client.name}</span>
              </Button>
              <Dropdown.Popover placement="bottom start">
                <Dropdown.Menu aria-label="Proyectos" onAction={(id) => openPortal(app.portals.find((p) => p.client.id === id))}>
                  {app.portals.map((p) => (
                    <Dropdown.Item key={p.client.id} id={p.client.id} textValue={p.client.name}>
                      <Logo client={p.client} />
                      <Label>{p.client.name}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : (
            <a href="#/" className="flex min-w-0 items-center gap-2">
              <Logo client={app.client} />
              <span className="truncate font-semibold">{app.client.name}</span>
            </a>
          )}
          <span className="flex-1" />
          {demo && (
            <Chip size="sm" variant="soft" color="warning">
              Demostración
            </Chip>
          )}
          <a href="#/perfil" aria-label="Tu perfil" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Avatar size="sm" color="accent" variant="soft">
              {urlOf(app.member?.avatar_path) && <Avatar.Image alt="" src={urlOf(app.member.avatar_path)} />}
              <Avatar.Fallback>{(app.member?.name || app.user?.email || '?').slice(0, 1).toUpperCase()}</Avatar.Fallback>
            </Avatar>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <Screen route={route} onSignOut={onSignOut} />
      </main>

      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <ul className="sw-glass flex w-full max-w-md items-stretch justify-around rounded-full p-1.5 shadow-[var(--overlay-shadow)]">
          {tabs.map(({ id, label, icon: Icon, href }) => {
            const on = tab === id;
            const n = badge[id] || 0;
            return (
              <li key={id} className="flex-1">
                <a
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`relative flex flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                    on ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="truncate">{label}</span>
                  {n > 0 && !on && (
                    <span className="absolute end-[18%] top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-4 text-danger-foreground">
                      {n > 9 ? '9+' : n}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PortalApp() {
  const { phase, message, signIn, signOut, demo } = useBoot();
  if (phase === 'booting')
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <img src="/favicon.svg" alt="" width="52" height="52" />
        <Loader variant="dots" label="Cargando tu app" />
        <ShimmerText className="text-sm font-medium">Cargando tu app…</ShimmerText>
      </main>
    );
  if (phase === 'login') return <Login onSignIn={signIn} />;
  if (phase === 'empty' || phase === 'error')
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex max-w-sm flex-col gap-4">
          <Alert status={phase === 'error' ? 'danger' : 'warning'}>
            <Alert.Indicator>
              <CircleExclamation />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{phase === 'error' ? 'No se pudo abrir tu proyecto' : 'Sin proyecto todavía'}</Alert.Title>
              <Alert.Description>{message}</Alert.Description>
            </Alert.Content>
          </Alert>
          <Button onPress={() => location.reload()}>Reintentar</Button>
        </div>
      </main>
    );
  return <Shell onSignOut={signOut} demo={demo} />;
}
