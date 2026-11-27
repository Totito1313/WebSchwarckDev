// Crecer › Portal de clientes: lo que piden tus clientes (convertible en tarea),
// la sincronización de proyectos, documentos y datos con sus portales, el trabajo
// de hoy listo para su reporte, los portales, las cuentas con sus permisos (Accesos)
// y la identidad de cada app (PortalAdmin.jsx). Usa la cuenta del estudio en Supabase
// (la misma sesión que la app /cliente/). Al abrirlo con la sesión del panel, entra
// solo como el estudio (autoStudioLogin); la contraseña solo hace falta la primera vez,
// para crear la cuenta del estudio.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encode } from 'uqr';
import { Archive, ArrowRotateRight, ArrowUpRightFromSquare, ChevronDown, CircleCheck, EllipsisVertical, Key, Link as LinkIcon, Palette, Persons, Plus, Shield, Smartphone, Star, TrashBin, Tray } from '@gravity-ui/icons';
import {
  Avatar,
  AvatarGroup,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Chip,
  Description,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Popover,
  Skeleton,
  Tabs,
  TextField,
  toast,
} from '@heroui/react';
import { api, find, put, state as crm, todayISO } from '../../../negocio-core.js';
import { newTask, taskKey } from '../../../negocio-work.js';
import { autoStudioLogin, clientAsks, must, ratingsByPortal, sb, sendWork, settleField, studioSession, syncNow, syncState } from '../../../negocio-puente.js';
import { BUCKET, FUNCTION_URL, SUPABASE_KEY } from '../../../portal/config.js';
import { Empty, PageHeader, Panel, Stat } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { ConfirmDialog, FormModal } from '../fields.jsx';
import { Segment } from '../../kit/Segment.jsx';
import { Accesos, ClaudeDialog, Identidad, NewPortalDialog, PermsDialog, PortalLogo, changedPerms, loadPortals } from './PortalAdmin.jsx';
import { ApprovalCard, ComposedChart, DonutChart, KpiGroup, Widget } from '../../pro/index.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const minutesText = (m) => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
const ago = (iso) => {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2_592_000) return Math.floor(s / 86_400) === 1 ? 'ayer' : `hace ${Math.floor(s / 86_400)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

function Qr({ text }) {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  let d = '';
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`Código QR de ${text}`} className="size-32 rounded-xl bg-white p-2">
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Conectar (o crear) la cuenta del estudio en Supabase. */
function Connect({ session, onDone }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('Schwarck');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clientEmail = session && !session.admin ? session.user?.email : null;

  return (
    <Card className="grid gap-6 p-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Shield className="size-8 text-accent" />
        <h2 className="text-xl font-semibold">{clientEmail ? 'Esa cuenta no es del estudio' : 'Conecta tu cuenta del estudio'}</h2>
        <p className="text-sm text-muted">
          {clientEmail
            ? `Este navegador tiene abierto el portal con ${clientEmail}, una cuenta de cliente. Entra con la del estudio o créala aquí.`
            : 'Es la cuenta con la que administras los portales y entras en la app de tu teléfono en modo estudio.'}
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex gap-2">
            <Persons className="mt-0.5 size-4 shrink-0 text-muted" /> Lo que te piden tus clientes, convertido en tareas.
          </li>
          <li className="flex gap-2">
            <ArrowRotateRight className="mt-0.5 size-4 shrink-0 text-muted" /> Proyectos, documentos y datos al día en cada portal.
          </li>
          <li className="flex gap-2">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-muted" /> El trabajo de hoy, directo al reporte de cada cliente.
          </li>
        </ul>
      </div>
      <Form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Escribe un correo válido.');
          if (pass.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
          setBusy(true);
          setError('');
          try {
            if (mode === 'create') {
              const { ticket } = await api('/portal-ticket', { method: 'POST' });
              const res = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY },
                body: JSON.stringify({ action: 'claim', ticket, email: email.trim(), password: pass, name: name.trim() }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta.');
            }
            const c = await sb();
            await c.auth.signOut().catch(() => {});
            must(await c.auth.signInWithPassword({ email: email.trim(), password: pass }));
            await c.auth.refreshSession();
            const now = await studioSession();
            if (!now?.admin) throw new Error('Has entrado, pero esa cuenta no es del estudio. Usa «Crear cuenta» con tu correo para convertirla.');
            toast.success(mode === 'create' ? 'Cuenta del estudio lista' : 'Conectado al portal');
            onDone();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
            setPass('');
          }
          return undefined;
        }}
      >
        <Tabs selectedKey={mode} onSelectionChange={(k) => setMode(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Cómo conectar">
              <Tabs.Tab id="login">
                Ya tengo cuenta
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="create">
                Crear cuenta
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <p className="text-xs text-muted">
          {mode === 'create'
            ? 'Como ya tienes la sesión del panel, la cuenta se crea al momento. Si ese correo ya tenía cuenta, pasa a ser del estudio con esta contraseña. Solo funciona en schwarckdev.com.'
            : 'Entra con el correo y la contraseña de tu cuenta del estudio.'}
        </p>
        {mode === 'create' && (
          <TextField value={name} onChange={setName} maxLength={120}>
            <Label>Tu nombre</Label>
            <Input />
          </TextField>
        )}
        <TextField type="email" value={email} onChange={setEmail} isRequired autoComplete="username">
          <Label>Correo</Label>
          <Input placeholder="tu@correo.com" />
        </TextField>
        <TextField type="password" value={pass} onChange={setPass} isRequired isInvalid={Boolean(error)} autoComplete={mode === 'create' ? 'new-password' : 'current-password'}>
          <Label>Contraseña</Label>
          <Input />
          <FieldError>{error}</FieldError>
        </TextField>
        <Button type="submit" isPending={busy}>
          {mode === 'create' ? 'Crear mi cuenta del estudio' : 'Entrar'}
        </Button>
      </Form>
    </Card>
  );
}

/** Convierte lo que pidió el cliente en una tarea («Solicitud» de su proyecto). */
function askToTask(item) {
  const project = crm.projects.find((p) => item.customerId && p.customerId === item.customerId && p.status !== 'completed');
  const task = newTask({ projectId: project?.id || '', status: 'request' });
  Object.assign(task, {
    title: item.title.slice(0, 200),
    description: [item.detail, `Desde el portal de ${item.client}: ${location.origin}/cliente/?p=${item.clientId}${item.route || ''}`].filter(Boolean).join('\n\n'),
    priority: 'medium',
    portal: { clientId: item.clientId, ref: item.ref, kind: item.ref.split(':')[0], at: new Date().toISOString() },
  });
  put('tasks', task);
  toast.success(`Tarea ${taskKey(task)} creada${project ? ` en ${project.name}` : ''}`);
  return task;
}

function Asks() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    clientAsks().then(setItems).catch((err) => setError(err.message));
  }, []);
  const [skipped, setSkipped] = useState(() => new Set());
  const open = (items || []).filter((x) => !x.task);
  // La primera petición sin tarea, como tarjeta para decidir rápido (Ctrl+Intro o Esc).
  const next = open.find((x) => !skipped.has(x.ref));
  const makeTask = (x) => {
    const task = askToTask(x);
    setItems((list) => list.map((y) => (y.ref === x.ref ? { ...y, task } : y)));
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
    {next && (
      <ApprovalCard
        media={<div className="flex size-full items-center justify-center bg-accent/12 text-accent"><Tray className="size-6" /></div>}
        title={next.title}
        subtitle={`${next.client} · ${next.what} · ${ago(next.at)}`}
        note={open.length > 1 ? { label: `${open.length - 1} más esperando`, color: 'default' } : undefined}
        approveLabel="Crear tarea"
        rejectLabel="Más tarde"
        onApprove={() => makeTask(next)}
        onReject={() => setSkipped((s) => new Set([...s, next.ref]))}
        middle={{ label: 'Abrir en su app', onPress: () => window.open(`/cliente/?p=${next.clientId}${next.route || ''}`, '_blank', 'noopener') }}
      >
        {next.detail && <p className="line-clamp-4 whitespace-pre-line text-sm text-muted">{next.detail}</p>}
      </ApprovalCard>
    )}
    <Panel title="Lo que te piden tus clientes" description={items ? (items.length ? `${plural(open.length, 'sin tarea', 'sin tarea')} de ${items.length}` : 'Envíos, cambios, ideas y reuniones de todos los portales.') : 'Cargando…'}>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !items ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <Empty icon={Tray} title="Nada pendiente" text="Cuando un cliente te envíe algo, pida cambios, proponga una idea o pida una reunión, aparecerá aquí para convertirlo en tarea." />
      ) : (
        <ul className="flex flex-col">
          {items.slice(0, 14).map((x) => (
            <li key={x.ref} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs text-muted">
                  <b className="text-foreground">{x.client}</b> · {x.what} · {ago(x.at)}
                </span>
                <span className="truncate text-sm">{x.title}</span>
              </span>
              <ButtonGroup size="sm" variant={x.task ? 'tertiary' : 'secondary'}>
                {x.task ? (
                  <Button onPress={() => go(`#/tareas/${x.task.id}`)}>
                    <CircleCheck />
                    {taskKey(x.task)}
                  </Button>
                ) : (
                  <Button onPress={() => makeTask(x)}>
                    <Plus />
                    Crear tarea
                  </Button>
                )}
                <Button isIconOnly aria-label="Abrir en la app" onPress={() => window.open(`/cliente/?p=${x.clientId}${x.route || ''}`, '_blank', 'noopener')}>
                  <ButtonGroup.Separator />
                  <ArrowUpRightFromSquare />
                </Button>
              </ButtonGroup>
            </li>
          ))}
        </ul>
      )}
    </Panel>
    </div>
  );
}

const FIELD = { email: 'Correo', phone: 'Teléfono', address: 'Dirección', website: 'Web' };

function Sync() {
  const [status, setStatus] = useState(syncState.at ? `Última vez ${ago(new Date(syncState.at).toISOString())}` : 'Proyectos, documentos y datos de cada cliente.');
  const [busy, setBusy] = useState(false);
  const [differ, setDiffer] = useState([]);
  const run = async () => {
    setBusy(true);
    setStatus('Sincronizando…');
    try {
      const r = await syncNow({ customers: true });
      if (!r) throw new Error('Conecta la cuenta del estudio.');
      if (syncState.error) throw new Error(syncState.error);
      const p = r.projects || {};
      const parts = [
        p.projects ? plural(p.projects, 'proyecto al día', 'proyectos al día') : null,
        p.milestones ? plural(p.milestones, 'hito nuevo', 'hitos nuevos') : null,
        typeof r.docs === 'number' && r.docs ? plural(r.docs, 'documento al día', 'documentos al día') : null,
        r.customers?.toPortal ? `datos a ${plural(r.customers.toPortal, 'portal', 'portales')}` : null,
        r.customers?.toNegocio ? `datos de ${plural(r.customers.toNegocio, 'portal', 'portales')} a Negocio` : null,
      ].filter(Boolean);
      setStatus(parts.length ? `Hecho: ${parts.join(' · ')}.` : 'Todo estaba al día.');
      setDiffer(r.customers?.differ || []);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  };
  const settle = async (d, from) => {
    try {
      await settleField(d, from);
      setDiffer((list) => list.filter((x) => x !== d));
    } catch (err) {
      toast.danger(err.message);
    }
  };
  return (
    <Panel
      title="Al día con los portales"
      description={status}
      action={
        <Button size="sm" isPending={busy} onPress={run}>
          <ArrowRotateRight />
          Sincronizar ahora
        </Button>
      }
    >
      <ul className="flex flex-col gap-1 text-sm text-muted">
        <li>Proyectos: etapas, avance, horas y lo próximo; cada etapa completada llega como hito.</li>
        <li>Facturas y propuestas publicadas: pagos, aperturas y firmas.</li>
        <li>Datos del cliente: correo, teléfono, dirección y web, en los dos lados.</li>
      </ul>
      {differ.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm">Estos datos son distintos en Negocio y en la app del cliente. Elige cuál vale:</p>
          {differ.map((d) => (
            <div key={`${d.customer.id}-${d.field}`} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-secondary p-2 text-sm">
              <b className="flex-1">
                {d.customer.name} · {FIELD[d.field]}
              </b>
              <ButtonGroup size="sm" variant="secondary">
                <Button onPress={() => settle(d, 'negocio')}>Negocio: {d.negocio}</Button>
                <Button onPress={() => settle(d, 'app')}>
                  <ButtonGroup.Separator />
                  App: {d.app}
                </Button>
              </ButtonGroup>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function todayWork() {
  const today = todayISO();
  const byCustomer = new Map();
  const add = (customerId, item) => {
    const c = find('customers', customerId);
    if (!c) return;
    if (!byCustomer.has(customerId)) byCustomer.set(customerId, { customer: c, items: [] });
    byCustomer.get(customerId).items.push(item);
  };
  const projectCustomer = (pid) => find('projects', pid)?.customerId;
  const minutesOf = (taskId) => (crm.time || []).filter((e) => e.taskId === taskId && e.date === today).reduce((s, e) => s + (Number(e.minutes) || 0), 0);
  for (const t of crm.tasks) {
    if (t.status !== 'done' || !t.doneAt || localDay(t.doneAt) !== today || !t.title) continue;
    add(projectCustomer(t.projectId), { title: t.title, minutes: minutesOf(t.id) || null, source: `negocio:task:${t.id}` });
  }
  for (const e of crm.time || []) {
    if (e.date !== today || e.running) continue;
    const task = e.taskId && find('tasks', e.taskId);
    if (task?.status === 'done' && task.doneAt && localDay(task.doneAt) === today) continue;
    const title = (e.note || task?.title || '').trim();
    if (title) add(projectCustomer(e.projectId), { title, minutes: Number(e.minutes) || null, source: `negocio:time:${e.id}` });
  }
  return [...byCustomer.values()];
}

function SendWork({ group, onClose }) {
  const [chosen, setChosen] = useState(() => new Set(group.items.map((it) => it.source)));
  return (
    <FormModal
      title={`Al reporte de ${group.customer.name}`}
      submit="Mandar al reporte"
      onClose={onClose}
      onSubmit={async () => {
        const items = group.items.filter((it) => chosen.has(it.source));
        if (!items.length) return false;
        try {
          const { sent } = await sendWork(group.customer.id, items);
          toast.success(sent ? `${plural(sent, 'línea', 'líneas')} en su reporte de hoy` : 'Eso ya estaba en su reporte');
          return true;
        } catch (err) {
          toast.danger(err.message);
          return false;
        }
      }}
    >
      <p className="text-sm text-muted sm:col-span-2">Entra en su reporte de hoy como hecho y le llega el aviso. Lo que ya esté en su reporte no se repite.</p>
      <div className="flex flex-col gap-2 sm:col-span-2">
        {group.items.map((it) => (
          <Checkbox
            key={it.source}
            isSelected={chosen.has(it.source)}
            onChange={(on) =>
              setChosen((s) => {
                const n = new Set(s);
                if (on) n.add(it.source);
                else n.delete(it.source);
                return n;
              })
            }
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {it.title}
              {it.minutes ? <span className="ms-1 text-xs text-muted">· {minutesText(it.minutes)}</span> : null}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
    </FormModal>
  );
}

function Today() {
  const [, v] = useCrm();
  const groups = useMemo(() => todayWork(), [v]);
  const [sending, setSending] = useState(null);
  return (
    <Panel title="Trabajo de hoy" description="Lo que terminaste hoy, listo para el reporte diario de cada cliente.">
      {groups.length ? (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <Card key={g.customer.id} variant="secondary" className="gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{g.customer.name}</span>
                <Button size="sm" onPress={() => setSending(g)}>
                  Mandar al portal
                </Button>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {g.items.map((it) => (
                  <li key={it.source} className="flex items-center gap-2">
                    <CircleCheck className="size-4 text-success" />
                    <span className="flex-1 truncate">{it.title}</span>
                    {it.minutes ? <span className="text-xs text-muted">{minutesText(it.minutes)}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="Hoy no hay nada terminado" text="Cuando marques tareas como hechas o apuntes horas en proyectos de un cliente, aparecerán aquí para mandarlas a su portal." />
      )}
      {sending && <SendWork group={sending} onClose={() => setSending(null)} />}
    </Panel>
  );
}

function Summary() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      const c = await sb();
      const since = new Date(Date.now() - 56 * 86_400_000).toISOString();
      const [clients, members, unseen, sent, meetings, ratings, subs, tasks] = await Promise.all([
        c.from('portal_clients').select('id, name, archived, accent').then(must),
        c.from('portal_members').select('user_id, client_id').then(must),
        c.from('portal_submissions').select('id', { count: 'exact', head: true }).is('seen_at', null),
        c.from('portal_tasks').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        c.from('portal_meetings').select('id', { count: 'exact', head: true }).eq('status', 'requested').then((r) => (r.error ? null : r.count)),
        ratingsByPortal().catch(() => []),
        c.from('portal_submissions').select('created_at').gte('created_at', since).then((r) => (r.error ? [] : r.data)),
        c.from('portal_tasks').select('created_at, status').gte('created_at', since).then((r) => (r.error ? [] : r.data)),
      ]);
      const avg = ratings.length ? ratings.reduce((s, r) => s + r.avg, 0) / ratings.length : null;
      // Semana a semana: lo que te mandaron y las peticiones que abriste.
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const from = Date.now() - (8 - i) * 7 * 86_400_000;
        const to = from + 7 * 86_400_000;
        const inWeek = (row) => {
          const t = Date.parse(row.created_at);
          return t >= from && t < to;
        };
        return {
          key: String(i),
          label: new Date(to - 86_400_000).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
          subs: subs.filter(inWeek).length,
          tasks: tasks.filter(inWeek).length,
        };
      });
      const byPortal = clients
        .filter((x) => !x.archived)
        .map((x) => ({ key: x.id, label: x.name, value: new Set(members.filter((m) => m.client_id === x.id).map((m) => m.user_id)).size }));
      setStats({ clients, people: new Set(members.map((m) => m.user_id)).size, unseen: unseen.count || 0, sent: sent.count || 0, meetings, avg, rated: ratings.length, weeks, byPortal });
    })().catch((err) => toast.danger('No se pudo cargar el resumen', { description: err.message }));
  }, []);
  return (
    <div className="flex flex-col gap-4">
      {stats ? (
        <>
          <Widget title="Tus portales" action={<span>{plural(stats.clients.filter((x) => x.archived).length, 'archivado', 'archivados')}</span>}>
            <KpiGroup
              items={[
                { label: 'Portales activos', value: String(stats.clients.filter((x) => !x.archived).length), sub: `${plural(stats.people, 'persona', 'personas')} con acceso`, href: '#/portal/clientes' },
                { label: 'Te enviaron', value: String(stats.unseen), sub: 'Sin ver todavía', tone: stats.unseen ? 'var(--accent)' : undefined },
                { label: 'Peticiones', value: String(stats.sent), sub: stats.meetings ? `Esperan revisión · ${plural(stats.meetings, 'reunión pedida', 'reuniones pedidas')}` : 'Esperan tu revisión' },
                { label: 'Valoración', value: stats.avg != null ? `${stats.avg.toFixed(1).replace('.', ',')} ★` : '—', sub: stats.avg != null ? `Media de ${plural(stats.rated, 'cliente', 'clientes')}` : 'Sin valoraciones' },
              ]}
            />
          </Widget>
          <div className="grid gap-4 lg:grid-cols-3">
            <Widget title="Actividad" description="Lo que te mandaron y las peticiones, semana a semana" className="lg:col-span-2">
              <ComposedChart
                title="Envíos y peticiones de las últimas 8 semanas"
                xLabel="Semana"
                height={200}
                data={stats.weeks}
                series={[
                  { key: 'subs', name: 'Te enviaron', type: 'bar', color: 'var(--sw-chart-in)' },
                  { key: 'tasks', name: 'Peticiones', type: 'bar', color: 'var(--sw-cat-other)' },
                ]}
                format={(x) => String(x)}
                compact={(x) => (Number.isInteger(x) ? String(x) : '')}
              />
            </Widget>
            <Widget title="Personas por portal">
              {stats.byPortal.some((x) => x.value) ? (
                <DonutChart title="Personas con acceso en cada portal" parts={stats.byPortal} format={(x) => String(x)} totalLabel="Accesos" size={140} layout="stack" />
              ) : (
                <p className="text-sm text-muted">Nadie con acceso todavía. Dalo en Accesos.</p>
              )}
            </Widget>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-3xl lg:col-span-3" />
          <Skeleton className="h-64 rounded-3xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Asks />
        <Sync />
      </div>
      <Today />
    </div>
  );
}

function Portales() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'new' | 'perms' | 'claude' | 'delete', p? }
  const load = useCallback(async () => {
    try {
      setData(await loadPortals());
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const safely = (task) => async (...args) => {
    try {
      await task(...args);
      load();
    } catch (err) {
      toast.danger(err.message);
    }
  };
  const archive = (p) =>
    safely(async () => {
      must(await (await sb()).from('portal_clients').update({ archived: !p.archived }).eq('id', p.id));
      toast(p.archived ? 'Activo otra vez' : 'Archivado: su gente ya no lo ve');
    })();
  const savePerms = (p) =>
    safely(async (perms) => {
      must(await (await sb()).from('portal_clients').update({ perms, hidden: [] }).eq('id', p.id));
      toast.success('Permisos guardados');
    });
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data)
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onPress={() => go('#/portal/accesos')}>
          <Persons />
          Accesos y permisos
        </Button>
        <Button onPress={() => setDialog({ kind: 'new' })}>
          <Plus />
          Nuevo portal
        </Button>
      </div>
      {data.clients.length === 0 ? (
        <Empty
          icon={Smartphone}
          title="Todavía no hay portales"
          text="Crea uno por cliente; luego le das acceso a su gente y le pones su identidad."
          action={
            <Button onPress={() => setDialog({ kind: 'new' })}>
              <Plus />
              Nuevo portal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.clients.map((p) => {
            const people = data.members.filter((m) => m.client_id === p.id);
            const customer = p.crm_customer_id && find('customers', p.crm_customer_id);
            const changed = changedPerms(p);
            return (
              <Card key={p.id} className={`relative gap-3 overflow-hidden p-4 ${p.archived ? 'opacity-60' : ''}`}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: p.accent || 'var(--accent)' }} />
                <div className="flex items-center gap-3">
                  <PortalLogo p={p} logos={data.logos} size="size-11" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="truncate text-xs text-muted">{[p.archived && 'Archivado', customer ? `Cliente: ${customer.name}` : p.industry || 'Sin ficha en Negocio'].filter(Boolean).join(' · ')}</span>
                  </div>
                  <Dropdown>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Opciones de ${p.name}`}>
                      <EllipsisVertical className="size-4" />
                    </Button>
                    <Dropdown.Popover placement="bottom end" className="min-w-60">
                      <Dropdown.Menu
                        aria-label={`Opciones de ${p.name}`}
                        onAction={(k) => {
                          if (k === 'open') window.open(`/cliente/?p=${p.id}`, '_blank', 'noopener');
                          if (k === 'perms' || k === 'claude' || k === 'delete') setDialog({ kind: k, p });
                          if (k === 'archive') archive(p);
                        }}
                      >
                        <Dropdown.Item id="open" textValue="Abrir su app">
                          <ArrowUpRightFromSquare className="size-4" />
                          <Label>Abrir su app</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="perms" textValue="Permisos">
                          <Key className="size-4" />
                          <div className="flex flex-col">
                            <Label>Permisos</Label>
                            <span className="text-xs text-muted">Qué puede ver y hacer su gente</span>
                          </div>
                        </Dropdown.Item>
                        <Dropdown.Item id="claude" textValue="Conectar Claude">
                          <LinkIcon className="size-4" />
                          <div className="flex flex-col">
                            <Label>Conectar Claude</Label>
                            <span className="text-xs text-muted">Que cargue su calendario</span>
                          </div>
                        </Dropdown.Item>
                        <Dropdown.Item id="archive" textValue={p.archived ? 'Reactivar' : 'Archivar'}>
                          <Archive className="size-4" />
                          <Label>{p.archived ? 'Reactivar' : 'Archivar'}</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="delete" textValue="Borrar portal" variant="danger">
                          <TrashBin className="size-4" />
                          <Label>Borrar portal</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
                <div className="flex items-center gap-2">
                  {people.length ? (
                    <AvatarGroup size="sm" max={5} variant="soft">
                      {people.map((m) => (
                        <Avatar key={m.user_id}>
                          <Avatar.Fallback>{(m.name || m.email || '?').slice(0, 1).toUpperCase()}</Avatar.Fallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  ) : (
                    <span className="text-xs text-muted">Nadie con acceso</span>
                  )}
                  <span className="flex-1" />
                  {changed > 0 && (
                    <Button size="sm" variant="ghost" className="text-xs" onPress={() => setDialog({ kind: 'perms', p })}>
                      <Key className="size-3.5" />
                      {plural(changed, 'permiso cambiado', 'permisos cambiados')}
                    </Button>
                  )}
                </div>
                <ButtonGroup size="sm" variant="secondary" className="mt-auto self-start">
                  <Button onPress={() => window.open(`/cliente/?p=${p.id}`, '_blank', 'noopener')}>
                    <ArrowUpRightFromSquare />
                    Abrir
                  </Button>
                  <Button onPress={() => go(`#/portal/identidad/${p.id}`)}>
                    <ButtonGroup.Separator />
                    <Palette />
                    Editar
                  </Button>
                  <Button onPress={() => go(`#/portal/accesos/${p.id}`)}>
                    <ButtonGroup.Separator />
                    <Persons />
                    Personas · {people.length}
                  </Button>
                </ButtonGroup>
              </Card>
            );
          })}
        </div>
      )}
      {dialog?.kind === 'new' && <NewPortalDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'perms' && <PermsDialog title={`Permisos de ${dialog.p.name}`} portal={dialog.p} onSave={savePerms(dialog.p)} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'claude' && <ClaudeDialog p={dialog.p} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={dialog?.p ? `¿Borrar el portal de ${dialog.p.name}?` : ''}
        text="Se borra con todo lo publicado, lo recibido y sus accesos. No se puede deshacer."
        confirm="Borrar todo"
        onClose={() => setDialog(null)}
        onConfirm={safely(async () => {
          must(await (await sb()).from('portal_clients').delete().eq('id', dialog.p.id));
          toast('Portal borrado');
        })}
      />
    </div>
  );
}

const PORTAL_TABS = [
  { id: 'resumen', label: 'Resumen', href: '#/portal', icon: Tray },
  { id: 'clientes', label: 'Portales', href: '#/portal/clientes', icon: Smartphone },
  { id: 'accesos', label: 'Accesos', href: '#/portal/accesos', icon: Persons },
  { id: 'identidad', label: 'Identidad', href: '#/portal/identidad', icon: Palette },
];

/** El portal en el teléfono: el código para escanear, en un botón discreto. */
function PhoneQr() {
  const url = `${location.origin}/cliente/`;
  return (
    <Popover>
      <Button variant="secondary" size="sm">
        <Smartphone />
        En el teléfono
      </Button>
      <Popover.Content placement="bottom end" className="w-72">
        <Popover.Dialog className="flex flex-col items-center gap-3 p-4 text-center">
          <Qr text={url} />
          <p className="text-sm">Escanéalo, entra con tu cuenta del estudio y toca «Instalar».</p>
          <code className="break-all text-xs text-muted">{url}</code>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function Portal({ tab, arg }) {
  const [session, setSession] = useState(undefined);
  const [autoError, setAutoError] = useState('');
  const tried = useRef(false);
  const check = useCallback(() => {
    studioSession()
      .then(async (now) => {
        // Sin sesión del estudio, se intenta entrar solo una vez con la sesión del panel.
        if (now?.admin || tried.current) return setSession(now);
        tried.current = true;
        try {
          const auto = await autoStudioLogin();
          toast.success('Dentro como administrador del portal');
          return setSession(auto);
        } catch (err) {
          setAutoError(
            err.status === 404
              ? 'Todavía no hay cuenta del estudio: créala aquí (solo esta vez).'
              : `No se pudo entrar solo (${err.message.replace(/\.$/, '')}). Entra con tu cuenta del estudio.`,
          );
          return setSession(now);
        }
      })
      .catch(() => setSession(null));
  }, []);
  useEffect(() => check(), [check]);
  const view = PORTAL_TABS.some((t) => t.id === tab) ? tab : 'resumen';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Crecer"
        title="Portal de clientes"
        description="La app de cada cliente: quién entra, qué puede hacer, cómo se ve y lo que te piden."
        actions={
          <div className="flex items-center gap-2">
            <PhoneQr />
            <ButtonGroup size="sm">
              <Button size="sm" onPress={() => window.open('/cliente/', '_blank', 'noopener')}>
                <ArrowUpRightFromSquare />
                Abrir el portal
              </Button>
              <Dropdown>
                <Button size="sm" variant="primary" isIconOnly aria-label="Otras formas de abrirlo">
                  <ButtonGroup.Separator />
                  <ChevronDown />
                </Button>
                <Dropdown.Popover placement="bottom end" className="min-w-60">
                  <Dropdown.Menu aria-label="Abrir" onAction={(k) => window.open(String(k), '_blank', 'noopener')}>
                    <Dropdown.Item id="/cliente-nuevo/" textValue="App nueva">
                      <Smartphone className="size-4 text-muted" />
                      <div className="flex flex-col">
                        <Label>App nueva</Label>
                        <Description>La versión que estamos estrenando</Description>
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="/cliente/?demo=estudio" textValue="Demo del estudio">
                      <Star className="size-4 text-muted" />
                      <div className="flex flex-col">
                        <Label>Demo del estudio</Label>
                        <Description>Con datos de ejemplo, para enseñarla</Description>
                      </div>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
          </div>
        }
      />
      {session === undefined ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Entrando como administrador…</p>
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : !session?.admin ? (
        <>
          {autoError && <p className="rounded-2xl bg-warning/10 p-3 text-sm">{autoError}</p>}
          <Connect session={session} onDone={check} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segment items={PORTAL_TABS} value={view} label="Portal de clientes" />
            <span className="flex items-center gap-2 text-xs text-muted">
              <Chip size="sm" variant="soft" color="success">
                Conectado
              </Chip>
              {session.user.email}
              <Button
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await (await sb()).auth.signOut();
                  toast('Desconectado del portal');
                  check();
                }}
              >
                Desconectar
              </Button>
            </span>
          </div>
          {view === 'clientes' ? (
            <Portales />
          ) : view === 'accesos' ? (
            <Accesos key={arg || 'todos'} session={session} presetFilter={arg || 'todos'} />
          ) : view === 'identidad' ? (
            <Identidad id={arg} />
          ) : (
            <Summary />
          )}
        </>
      )}
    </div>
  );
}
