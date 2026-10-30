// Negocio › Portal de clientes: administrar la app de cada cliente (/cliente/).
//
// · Resumen: el código QR para instalar la app y el trabajo de hoy de Negocio, listo
//   para mandarlo al reporte diario de cada cliente.
// · Clientes: crear portales (desde un cliente de Negocio), qué secciones ve cada uno,
//   archivarlos o borrarlos.
// · Accesos: todas las cuentas, con su rol (estudio, dueño, equipo o solo lectura), a qué
//   portales entran y qué secciones ven; crearlas, cambiar contraseñas, quitarlas.
// · Identidad: logo, portada, colores, tipografía, esquinas, inicio, tema y nombre de la
//   app de cada cliente, con la app de verdad al lado mientras se edita.
//
// Habla con Supabase con la cuenta del estudio, la misma sesión que la app (portal:auth,
// mismo sitio). La primera vez se crea desde aquí: el panel pide al Worker un pase de un
// solo uso (prueba que tienes la sesión del panel) y la función `portal` crea la cuenta.

import { state, el, icon, addIcons, empty, toast, qr, todayISO, find, dialog, confirmBox, field, input, select, seg, toggle, menu, avatar, chip, kpi, api, iconButton } from './negocio-core.js';
import { head, go } from './negocio-views.js';
import { SUPABASE_URL, SUPABASE_KEY, FUNCTION_URL, BUCKET } from './portal/config.js';
import { SECTIONS, ROLES, FONTS, RADII, HEROES, THEMES, COLORS, brandOf, loadFont } from './portal/brand.js';

addIcons({
  smartphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
  inbox: '<path d="M3 13.5 5.6 5.7A2 2 0 0 1 7.5 4.3h9a2 2 0 0 1 1.9 1.4L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.7 0 3.2-.5 4.5-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
});

// ── Supabase con la cuenta del estudio ──

// Una sola instancia aunque la pidan a la vez la página y el número del riel.
let client = null;
function sb() {
  client ||= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'portal:auth' } }));
  return client;
}
const must = ({ data, error }) => {
  if (error) throw new Error(friendly(error.message));
  return data;
};
function friendly(message = '') {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/failed to fetch|network/i.test(message)) return 'Sin conexión con Supabase.';
  if (/row-level security|permission denied/i.test(message)) return 'Esta cuenta no tiene permiso: ¿es del estudio?';
  return message || 'Algo salió mal.';
}
async function studioSession() {
  const s = (await (await sb()).auth.getSession()).data.session;
  return s ? { user: s.user, admin: s.user?.app_metadata?.role === 'admin', token: s.access_token } : null;
}
async function fn(action, body = {}) {
  const s = await studioSession();
  const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${s?.token}` }, body: JSON.stringify({ action, ...body }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
async function signedUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await (await sb()).storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
const safeName = (name) => String(name || 'archivo').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-60) || 'archivo';
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const ago = (iso) => {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2_592_000) return Math.floor(s / 86_400) === 1 ? 'ayer' : `hace ${Math.floor(s / 86_400)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
};
async function copy(text, done = 'Copiado.') {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('No se pudo copiar.', 'error');
  }
}

/** Ventanas que solo informan: sin «Cancelar», basta con el botón principal o la ×. */
const plain = (dlg) => {
  dlg.querySelector('.ng-dialog-foot > .pill.ghost:not(.danger)')?.remove();
  return dlg;
};
/** Como `field`, pero sin <label>: para grupos de botones (tocar el título no debe elegir el primero). */
const group = (label, control, hint) => el('div', { class: 'ng-field' }, el('span', { text: label }), control, hint && el('small', { text: hint }));

// ── La página ──

const TABS = [['', 'Resumen', 'home'], ['clientes', 'Clientes', 'users'], ['accesos', 'Accesos', 'key'], ['identidad', 'Identidad', 'palette']];
let accessFilter = 'todos';

export function portalPage(sub = '', id = '') {
  if (!TABS.some(([k]) => k === sub)) sub = '';
  const body = el('div', { class: 'pt-body' }, el('div', { class: 'pt-skel' }, el('i'), el('i'), el('i')));
  const who = el('div', { class: 'pt-who' });
  const node = el('div', { class: 'ng-page pt' },
    head('Portal de clientes', 'La app de cada cliente: quién entra, qué ve y cómo se ve. El día a día lo llevas desde la app, en modo estudio.',
      el('a', { class: 'pill ghost', href: '/cliente/?demo=estudio', target: '_blank' }, icon('eye'), 'Demo del estudio'),
      el('a', { class: 'pill', href: '/cliente/', target: '_blank' }, icon('external'), 'Abrir el portal')),
    el('div', { class: 'pt-bar' },
      el('nav', { class: 'ng-tabs', 'aria-label': 'Secciones del portal' }, TABS.map(([k, label, ico]) => el('a', { href: k ? `#/portal/${k}` : '#/portal', 'aria-current': k === sub ? 'page' : null }, icon(ico), label))),
      who,
    ),
    body,
  );
  const load = async () => {
    let s = null;
    try {
      s = await studioSession();
    } catch (err) {
      body.replaceChildren(empty({ ico: 'ban', title: 'No se pudo conectar con Supabase', text: err.message }));
      return;
    }
    if (!s?.admin) {
      who.replaceChildren();
      body.replaceChildren(connectCard(s, load), sub === '' ? await summary() : '');
      return;
    }
    who.replaceChildren(el('span', { class: 'pt-who-dot' }), el('span', { text: s.user.email }), el('button', { type: 'button', class: 'pt-who-out', onclick: async () => { await (await sb()).auth.signOut(); toast('Desconectado del portal.'); load(); } }, 'Desconectar'));
    try {
      const view = sub === 'clientes' ? await clientsView(load) : sub === 'accesos' ? await accessView(s) : sub === 'identidad' ? await identityView(id) : await summary(true);
      body.replaceChildren(view);
    } catch (err) {
      body.replaceChildren(empty({ ico: 'ban', title: 'No se pudo cargar', text: err.message }));
    }
  };
  load();
  // En pantallas estrechas la pestaña abierta puede quedar fuera de la tira.
  requestAnimationFrame(() => node.querySelector('.ng-tabs [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  return { node, title: 'Portal de clientes | Negocio' };
}

// ── Conectar la cuenta del estudio ──

function connectCard(s, done) {
  let mode = 'create';
  const name = input({ placeholder: 'Schwarck', value: 'Schwarck', maxLength: 120 });
  const email = input({ type: 'email', placeholder: 'tu@correo.com', autocomplete: 'username', value: s?.user?.email || '' });
  const pass = input({ type: 'password', placeholder: 'Mínimo 8 caracteres', autocomplete: 'new-password' });
  const msg = el('p', { class: 'pt-msg' });
  const fields = el('div', { class: 'ng-form' });
  const btn = el('button', { type: 'submit', class: 'pill' });
  const draw = () => {
    fields.replaceChildren(
      mode === 'create' && field('Tu nombre', name),
      field('Correo', email),
      field('Contraseña', pass, mode === 'create' ? 'La usarás también para entrar en la app desde tu teléfono.' : null),
    );
    pass.autocomplete = mode === 'create' ? 'new-password' : 'current-password';
    btn.replaceChildren(icon(mode === 'create' ? 'shield' : 'key'), mode === 'create' ? 'Crear mi cuenta del estudio' : 'Entrar');
  };
  draw();
  const form = el('form', { class: 'ng-card pt-connect' },
    el('div', { class: 'pt-connect-head' },
      el('span', { class: 'pt-connect-ico' }, icon('shield')),
      el('div', {}, el('h2', { text: s && !s.admin ? 'Esa cuenta no es del estudio' : 'Conecta tu cuenta del estudio' }), el('p', { text: 'Con ella administras los portales desde aquí y entras en la app de tu teléfono en modo estudio. Como ya tienes abierta la sesión del panel, la cuenta se crea al momento.' })),
    ),
    seg([['create', 'Crear cuenta'], ['login', 'Ya tengo cuenta']], mode, (v) => { mode = v; msg.textContent = ''; draw(); }, 'Cómo conectar'),
    fields,
    el('div', { class: 'pt-connect-foot' }, btn, msg),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return say('Escribe un correo válido.');
    if (pass.value.length < 8) return say('La contraseña tiene que tener al menos 8 caracteres.');
    btn.disabled = true;
    say(mode === 'create' ? 'Creando tu cuenta…' : 'Entrando…', '');
    try {
      if (mode === 'create') {
        const { ticket } = await api('/portal-ticket', { method: 'POST' });
        const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify({ action: 'claim', ticket, email: email.value.trim(), password: pass.value, name: name.value.trim() }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta.');
      }
      const c = await sb();
      await c.auth.signOut().catch(() => {});
      must(await c.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }));
      await c.auth.refreshSession();
      const now = await studioSession();
      if (!now?.admin) throw new Error('Has entrado, pero esa cuenta no es del estudio. Usa «Crear cuenta» con tu correo para convertirla.');
      toast(mode === 'create' ? 'Cuenta del estudio lista. También entra con ella en la app.' : 'Conectado al portal.');
      done();
    } catch (err) {
      say(err.message);
    } finally {
      btn.disabled = false;
      pass.value = '';
    }
  });
  function say(text, kind = 'error') {
    msg.textContent = text;
    msg.dataset.kind = kind;
  }
  return form;
}

// ── Resumen: el QR y el trabajo de hoy ──

const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
const minutesText = (m) => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

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
  const minutesOf = (taskId) => (state.time || []).filter((e) => e.taskId === taskId && e.date === today).reduce((s, e) => s + (Number(e.minutes) || 0), 0);
  for (const t of state.tasks) {
    if (t.status !== 'done' || !t.doneAt || localDay(t.doneAt) !== today || !t.title) continue;
    add(projectCustomer(t.projectId), { title: t.title, minutes: minutesOf(t.id) || null, source: `negocio:task:${t.id}` });
  }
  for (const e of state.time || []) {
    if (e.date !== today || e.running) continue;
    const task = e.taskId && find('tasks', e.taskId);
    if (task?.status === 'done' && task.doneAt && localDay(task.doneAt) === today) continue;
    const title = (e.note || task?.title || '').trim();
    if (title) add(projectCustomer(e.projectId), { title, minutes: Number(e.minutes) || null, source: `negocio:time:${e.id}` });
  }
  return [...byCustomer.values()];
}

function sendToPortal(group) {
  const items = group.items.map((it) => ({ ...it, customerId: group.customer.id, customerName: group.customer.name }));
  try {
    localStorage.setItem('portal:import', JSON.stringify({ at: Date.now(), items }));
  } catch {
    toast('No se pudo preparar el envío en este navegador.', 'error');
    return;
  }
  window.open('/cliente/#/importar', '_blank');
}

async function summary(connected = false) {
  const url = `${location.origin}/cliente/`;
  const groups = todayWork();
  let stats = null;
  if (connected) {
    const c = await sb();
    const [clients, members, unseen, sent] = await Promise.all([
      c.from('portal_clients').select('id, archived').then(must),
      c.from('portal_members').select('user_id').then(must),
      c.from('portal_submissions').select('id', { count: 'exact', head: true }).is('seen_at', null),
      c.from('portal_tasks').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    ]);
    stats = el('div', { class: 'ng-kpis' },
      kpi({ label: 'Portales', value: String(clients.filter((x) => !x.archived).length), ico: 'smartphone', sub: `${clients.filter((x) => x.archived).length} archivados` }),
      kpi({ label: 'Personas', value: String(new Set(members.map((m) => m.user_id)).size), ico: 'users', sub: 'Con acceso a algún portal' }),
      kpi({ label: 'Te enviaron', value: String(unseen.count || 0), ico: 'inbox', sub: 'Sin ver todavía' }),
      kpi({ label: 'Peticiones enviadas', value: String(sent.count || 0), ico: 'tasks', sub: 'Esperan tu revisión' }),
    );
  }
  return el('div', { class: 'pt-stack' },
    stats,
    el('div', { class: 'pt-launch' },
      el('section', { class: 'ng-card pt-qr' },
        el('div', { class: 'pt-qr-code' }, qr(url)),
        el('div', {},
          el('h2', { text: 'Llévalo en tu teléfono' }),
          el('p', { text: 'Escanea el código, entra con tu cuenta del estudio y toca «Instalar». Desde ahí publicas el reporte del día, pides cosas, llevas el calendario, los resultados y los leads, y te avisa de lo que te envían.' }),
          el('code', { class: 'pt-url', text: url }),
        ),
      ),
      el('section', { class: 'ng-card' },
        el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Trabajo de hoy' }), el('small', { text: 'Lo que terminaste hoy en Negocio, listo para el reporte diario de cada cliente.' }))),
        groups.length
          ? el('div', { class: 'pt-today' }, groups.map((g) => el('article', { class: 'pt-today-group' },
            el('header', {}, el('b', { text: g.customer.name }), el('small', { text: `${g.items.length} ${g.items.length === 1 ? 'cosa' : 'cosas'}` }),
              el('button', { type: 'button', class: 'pill sm', onclick: () => sendToPortal(g) }, icon('send'), 'Mandar al portal')),
            el('ul', {}, g.items.map((it) => el('li', {}, icon('check'), el('span', { text: it.title }), it.minutes ? el('small', { text: minutesText(it.minutes) }) : null))),
          )))
          : empty({ ico: 'tasks', title: 'Hoy no hay nada terminado', text: 'Cuando marques tareas como hechas o apuntes horas en proyectos de un cliente, aparecerán aquí para mandarlas a su portal.' }),
      ),
    ),
  );
}

// ── Clientes ──

async function loadAll() {
  const c = await sb();
  const [clients, members] = await Promise.all([
    c.from('portal_clients').select('*').order('archived').order('name').then(must),
    c.from('portal_members').select('*').order('created_at').then(must),
  ]);
  const logos = Object.fromEntries(await Promise.all(clients.filter((x) => x.logo_url).map(async (x) => [x.id, await signedUrl(x.logo_url)])));
  return { clients, members, logos };
}

function logoOf(p, logos, size = '') {
  return el('span', { class: `pt-logo ${size}`.trim(), style: { '--accent': p.accent } }, logos?.[p.id] ? el('img', { src: logos[p.id], alt: '' }) : initials(p.name));
}

async function clientsView(reload) {
  const { clients, members, logos } = await loadAll();
  const grid = clients.length
    ? el('div', { class: 'pt-grid' }, clients.map((p, i) => {
      const people = members.filter((m) => m.client_id === p.id);
      const customer = p.crm_customer_id && find('customers', p.crm_customer_id);
      return el('article', { class: `pt-card${p.archived ? ' is-archived' : ''}`, style: { '--accent': p.accent, '--i': Math.min(i, 8) } },
        el('div', { class: 'pt-card-top' }, logoOf(p, logos),
          iconButton('more', 'Opciones', (e) => menu(e.currentTarget, [
            { label: 'Abrir su app', icon: 'external', run: () => window.open(`/cliente/?p=${p.id}`, '_blank') },
            { label: 'Secciones que ve', icon: 'eye', run: () => sectionsDialog(p.name, p.hidden, async (hidden) => { must(await (await sb()).from('portal_clients').update({ hidden }).eq('id', p.id)); toast('Guardado.'); reload(); }) },
            { label: p.archived ? 'Reactivar' : 'Archivar', icon: 'box', run: async () => { must(await (await sb()).from('portal_clients').update({ archived: !p.archived }).eq('id', p.id)); toast(p.archived ? 'Activo otra vez.' : 'Archivado: su gente ya no lo ve.'); reload(); } },
            '-',
            { label: 'Borrar portal', icon: 'trash', danger: true, run: async () => {
              if (!(await confirmBox(`¿Borrar el portal de ${p.name} con todo lo publicado, lo recibido y sus accesos? No se puede deshacer.`, 'Borrar todo'))) return;
              must(await (await sb()).from('portal_clients').delete().eq('id', p.id));
              toast('Portal borrado.');
              reload();
            } },
          ], { align: 'end' }))),
        el('b', { class: 'pt-card-name', text: p.name }),
        el('small', { text: [p.archived && 'Archivado', customer ? `Cliente: ${customer.name}` : p.industry || 'Sin ficha en Negocio'].filter(Boolean).join(' · ') }),
        el('div', { class: 'pt-people' }, people.slice(0, 5).map((m) => avatar(m.name || m.email, 'is-sm')), people.length > 5 && el('span', { class: 'pt-more', text: `+${people.length - 5}` }), !people.length && el('small', { text: 'Nadie con acceso' })),
        p.hidden?.length ? el('small', { class: 'pt-hidden-note' }, icon('eyeOff'), `${p.hidden.length} ${p.hidden.length === 1 ? 'sección oculta' : 'secciones ocultas'}`) : null,
        el('div', { class: 'pt-card-actions' },
          el('a', { class: 'pill sm ghost', href: `#/portal/identidad/${p.id}` }, icon('palette'), 'Identidad'),
          el('button', { type: 'button', class: 'pill sm ghost', onclick: () => { accessFilter = p.id; go('#/portal/accesos'); } }, icon('users'), `Personas · ${people.length}`),
        ),
      );
    }))
    : empty({ ico: 'smartphone', title: 'Todavía no hay portales', text: 'Crea uno por cliente; luego le das acceso a su gente y le pones su identidad.' });
  return el('div', { class: 'pt-stack' },
    el('div', { class: 'pt-actions' }, el('button', { type: 'button', class: 'pill', onclick: () => newPortalDialog(reload) }, icon('plus'), 'Nuevo portal')),
    grid,
  );
}

function newPortalDialog(reload) {
  let accent = COLORS[0];
  const customers = [['', 'Sin enlazar'], ...[...state.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.company ? `${c.name} · ${c.company}` : c.name])];
  const crm = select(customers, '');
  const name = input({ maxLength: 120, placeholder: 'Café Aroma' });
  crm.addEventListener('change', () => {
    const c = find('customers', crm.value);
    if (c && !name.value.trim()) name.value = c.company || c.name;
  });
  const welcome = el('textarea', { rows: 3, maxLength: 2000, placeholder: 'Aquí verás cada avance de tu proyecto… (sale arriba en su inicio)' });
  dialog({
    title: 'Nuevo portal',
    body: el('div', { class: 'ng-form' },
      field('Cliente de Negocio', crm, 'Enlazarlo deja mandar su trabajo de hoy desde Negocio.'),
      field('Nombre que ve el cliente', name),
      group('Color', swatches(accent, (v) => { accent = v; })),
      field('Bienvenida', welcome),
    ),
    submit: 'Crear portal',
    onSubmit: () => {
      if (!name.value.trim()) {
        name.focus();
        return false;
      }
      (async () => {
        try {
          const row = must(await (await sb()).from('portal_clients').insert({ name: name.value.trim(), crm_customer_id: crm.value || null, accent, welcome: welcome.value.trim() || null }).select().single());
          toast('Portal creado. Dale acceso a su gente en Accesos.');
          go(`#/portal/identidad/${row.id}`);
        } catch (err) {
          toast(err.message, 'error');
        }
      })();
    },
  });
}

function swatches(value, onChange) {
  let current = value;
  const box = el('div', { class: 'pt-swatches' });
  const custom = el('input', { type: 'color', class: 'pt-color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#00b8d4', 'aria-label': 'Otro color', oninput: () => { current = custom.value; onChange(current); draw(); } });
  const draw = () => box.replaceChildren(...COLORS.map((c) => el('button', { type: 'button', class: 'pt-swatch', style: { '--c': c }, 'aria-label': c, 'aria-pressed': String(c.toLowerCase() === String(current).toLowerCase()), onclick: () => { current = c; custom.value = c; onChange(c); draw(); } })), custom);
  draw();
  return box;
}

/** Qué secciones se ocultan (a un portal entero o a una persona). */
function sectionsDialog(title, hidden = [], onSave) {
  const off = new Set(hidden || []);
  dialog({
    title: `Qué ve: ${title}`,
    body: el('div', { class: 'ng-form' },
      el('p', { class: 'pt-hint', text: 'Lo que apagues desaparece de su app y la base deja de darle esos datos. Inicio y el tablón siempre se ven.' }),
      el('div', { class: 'pt-sections' }, SECTIONS.map(([key, label, sub]) => el('div', { class: 'pt-section-row' }, toggle(label, !off.has(key), (on) => { if (on) off.delete(key); else off.add(key); }), el('small', { text: sub })))),
    ),
    submit: 'Guardar',
    onSubmit: () => {
      onSave([...off]).catch?.((err) => toast(err.message, 'error'));
    },
  });
}

// ── Accesos ──

async function accessView(session) {
  const [{ clients, members, logos }, { users }] = await Promise.all([loadAll(), fn('users')]);
  const box = el('div', { class: 'pt-users' });
  let q = '';
  const filterOptions = [['todos', 'Todas las cuentas'], ['estudio', 'Solo el estudio'], ['sin', 'Sin portal'], ...clients.map((p) => [p.id, p.name])];
  if (!filterOptions.some(([k]) => k === accessFilter)) accessFilter = 'todos';
  const filter = select(filterOptions, accessFilter, { 'aria-label': 'Filtrar' });
  filter.addEventListener('change', () => { accessFilter = filter.value; draw(); });
  const search = el('input', { type: 'search', class: 'pt-search', placeholder: 'Buscar por nombre o correo', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
  const reload = async () => {
    const [a, b] = await Promise.all([loadAll(), fn('users')]);
    clients.splice(0, clients.length, ...a.clients);
    members.splice(0, members.length, ...a.members);
    Object.assign(logos, a.logos);
    users.splice(0, users.length, ...b.users);
    draw();
  };
  const draw = () => {
    const shown = users
      .filter((u) => {
        const mine = members.filter((m) => m.user_id === u.id);
        if (accessFilter === 'estudio' && !u.studio) return false;
        if (accessFilter === 'sin' && (u.studio || mine.length)) return false;
        if (!['todos', 'estudio', 'sin'].includes(accessFilter) && !mine.some((m) => m.client_id === accessFilter)) return false;
        return !q || `${u.name || ''} ${u.email}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.studio) - Number(a.studio) || (a.name || a.email).localeCompare(b.name || b.email));
    box.replaceChildren(...(shown.length ? shown.map((u, i) => {
      const mine = members.filter((m) => m.user_id === u.id);
      return el('button', { type: 'button', class: 'ng-row pt-user', style: { '--i': Math.min(i, 10) }, onclick: () => userDialog(u, { clients, members, logos, session, reload }) },
        avatar(u.name || u.email),
        el('span', { class: 'ng-row-main' }, el('b', { text: u.name || u.email }), el('small', { text: `${u.email} · entró ${ago(u.last_sign_in_at)}` })),
        el('span', { class: 'pt-user-roles' },
          u.studio && chip('Estudio · todo', 'var(--cyan)'),
          mine.map((m) => {
            const p = clients.find((x) => x.id === m.client_id);
            return p && el('span', { class: 'pt-role', style: { '--accent': p.accent } }, el('i'), `${p.name} · ${ROLES[m.role]?.[0] || m.role}`, m.hidden?.length ? icon('eyeOff') : null);
          }),
          !u.studio && !mine.length && chip('Sin portal', 'var(--body)'),
        ),
        icon('right'),
      );
    }) : [el('p', { class: 'ng-none', text: 'Nadie coincide.' })]));
  };
  draw();
  return el('div', { class: 'pt-stack' },
    el('div', { class: 'pt-actions' },
      el('button', { type: 'button', class: 'pill', onclick: () => newUserDialog({ clients, session, reload }) }, icon('plus'), 'Nueva cuenta'),
      el('span', { class: 'ng-grow' }),
      filter,
      search,
    ),
    el('section', { class: 'ng-card' }, el('header', { class: 'ng-card-head' }, el('div', {}, el('h2', { text: 'Cuentas' }), el('small', { text: 'Quién entra en la app, con qué rol, a qué portales y qué ve en cada uno.' }))), box),
    el('section', { class: 'ng-card pt-legend' },
      el('h2', { text: 'Roles' }),
      el('ul', {},
        el('li', {}, chip('Estudio', 'var(--cyan)'), el('span', { text: 'Tu equipo: entra en todos los portales y lo puede todo, también aquí.' })),
        Object.entries(ROLES).map(([k, [label, sub]]) => el('li', {}, chip(label, { owner: 'var(--income)', member: 'var(--blue)', viewer: 'var(--body)' }[k]), el('span', { text: sub }))),
      ),
    ),
  );
}

function newUserDialog({ clients, session, reload, presetClient }) {
  let kind = 'client';
  let passMode = 'auto';
  let role = 'owner';
  let hidden = [];
  const name = input({ maxLength: 120, placeholder: 'Laura Méndez' });
  const email = input({ type: 'email', placeholder: 'correo@cliente.com', autocomplete: 'off' });
  const pass = input({ type: 'text', placeholder: 'Mínimo 8 caracteres', autocomplete: 'off', maxLength: 72 });
  const portal = select(clients.filter((p) => !p.archived).map((p) => [p.id, p.name]), presetClient || (accessFilter.length > 20 ? accessFilter : clients[0]?.id || ''));
  const passBox = el('div');
  const clientBox = el('div', { class: 'ng-form' });
  const drawPass = () => passBox.replaceChildren(passMode === 'own' ? field('Contraseña', pass, 'Se la mandas tú; luego la puede cambiar desde su perfil.') : el('p', { class: 'pt-hint', text: 'Se crea una contraseña segura y la ves una sola vez, con el mensaje listo para mandar.' }));
  const sectionsLabel = el('span');
  const drawSections = () => { sectionsLabel.textContent = hidden.length ? `${hidden.length} ocultas` : 'Ve todo'; };
  const drawClient = () => clientBox.replaceChildren(...(kind === 'client' ? [
    field('Portal', portal),
    group('Rol', seg(Object.entries(ROLES).map(([k, [l]]) => [k, l]), role, (v) => { role = v; }, 'Rol')),
    el('div', { class: 'pt-inline' }, el('span', { text: 'Secciones' }), el('button', { type: 'button', class: 'pill sm ghost', onclick: () => sectionsDialog(name.value || email.value || 'nueva cuenta', hidden, async (h) => { hidden = h; drawSections(); }) }, icon('eye'), sectionsLabel)),
  ] : [el('p', { class: 'pt-hint is-strong', text: 'Una cuenta del estudio entra en todos los portales y lo puede todo (también esta sección). Dásela solo a tu equipo.' })]));
  drawPass();
  drawClient();
  drawSections();
  dialog({
    title: 'Nueva cuenta',
    wide: true,
    body: el('div', { class: 'ng-form' },
      group('Para', seg([['client', 'Un cliente'], ['studio', 'El estudio']], kind, (v) => { kind = v; drawClient(); }, 'Tipo de cuenta')),
      el('div', { class: 'ng-grid2' }, field('Nombre', name), field('Correo', email)),
      group('Contraseña', seg([['auto', 'Generarla'], ['own', 'Elegirla yo']], passMode, (v) => { passMode = v; drawPass(); }, 'Contraseña')),
      passBox,
      clientBox,
    ),
    submit: 'Crear cuenta',
    onSubmit: () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        toast('Escribe un correo válido.', 'error');
        return false;
      }
      if (passMode === 'own' && pass.value.length < 8) {
        toast('La contraseña tiene que tener al menos 8 caracteres.', 'error');
        return false;
      }
      if (kind === 'client' && !portal.value) {
        toast('Crea primero un portal en Clientes.', 'error');
        return false;
      }
      (async () => {
        try {
          const r = await fn('create_user', {
            email: email.value.trim(),
            name: name.value.trim(),
            password: passMode === 'own' ? pass.value : undefined,
            studio: kind === 'studio',
            portals: kind === 'client' ? [{ client_id: portal.value, role, hidden }] : [],
          });
          await reload();
          const p = clients.find((x) => x.id === portal.value);
          if (r.password) credentialsDialog(r.user, r.password, kind === 'client' ? p?.name : null);
          else toast(`${r.user.email} ya tenía cuenta: se añadió con su contraseña de siempre.`);
        } catch (err) {
          toast(err.message, 'error');
        }
      })();
    },
  });
}

function userDialog(u, { clients, members, logos, session, reload }) {
  const self = u.id === session.user.id;
  const list = el('div', { class: 'pt-memberships' });
  const addSelect = el('select', { class: 'ng-select' });
  let addRole = 'member';
  const draw = () => {
    const mine = members.filter((m) => m.user_id === u.id);
    list.replaceChildren(...(mine.length ? mine.map((m) => {
      const p = clients.find((x) => x.id === m.client_id);
      if (!p) return null;
      const roleSel = select(Object.entries(ROLES).map(([k, [l]]) => [k, l]), m.role, { 'aria-label': 'Rol' });
      roleSel.addEventListener('change', async () => {
        try {
          must(await (await sb()).from('portal_members').update({ role: roleSel.value }).eq('client_id', m.client_id).eq('user_id', u.id));
          m.role = roleSel.value;
          toast(`Ahora es ${ROLES[m.role][0].toLowerCase()} en ${p.name}.`);
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      return el('div', { class: 'pt-membership' },
        logoOf(p, logos, 'sm'),
        el('span', { class: 'ng-row-main' }, el('b', { text: p.name }), el('small', { text: m.hidden?.length ? `${m.hidden.length} secciones ocultas` : 'Ve todo lo de su portal' })),
        roleSel,
        iconButton('eye', 'Qué ve', () => sectionsDialog(`${u.name || u.email} en ${p.name}`, m.hidden, async (hidden) => {
          must(await (await sb()).from('portal_members').update({ hidden }).eq('client_id', m.client_id).eq('user_id', u.id));
          m.hidden = hidden;
          toast('Guardado.');
          draw();
          reload();
        })),
        iconButton('trash', 'Quitar de este portal', async () => {
          if (!(await confirmBox(`¿Quitar a ${u.email} de ${p.name}?`, 'Quitar'))) return;
          try {
            must(await (await sb()).from('portal_members').delete().eq('client_id', m.client_id).eq('user_id', u.id));
            members.splice(members.indexOf(m), 1);
            draw();
            reload();
          } catch (err) {
            toast(err.message, 'error');
          }
        }),
      );
    }) : [el('p', { class: 'pt-hint', text: u.studio ? 'Como es del estudio, entra en todos los portales.' : 'Todavía no entra en ningún portal.' })]));
    const free = clients.filter((p) => !p.archived && !mine.some((m) => m.client_id === p.id));
    addSelect.replaceChildren(...free.map((p) => el('option', { value: p.id, text: p.name })));
    addRow.hidden = !free.length;
  };
  const addRow = el('div', { class: 'pt-add-membership' },
    addSelect,
    seg(Object.entries(ROLES).map(([k, [l]]) => [k, l]), addRole, (v) => { addRole = v; }, 'Rol'),
    el('button', { type: 'button', class: 'pill sm', onclick: async () => {
      if (!addSelect.value) return;
      try {
        const row = must(await (await sb()).from('portal_members').insert({ client_id: addSelect.value, user_id: u.id, email: u.email, name: u.name, role: addRole }).select().single());
        members.push(row);
        toast('Añadido al portal.');
        draw();
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    } }, icon('plus'), 'Añadir'),
  );
  draw();
  const studioToggle = toggle('Cuenta del estudio (entra en todo)', u.studio, async (on) => {
    try {
      await fn('set_studio', { user_id: u.id, studio: on });
      u.studio = on;
      toast(on ? 'Ahora es del estudio.' : 'Ya no es del estudio.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  if (self) studioToggle.querySelector('input').disabled = true;
  plain(dialog({
    title: u.name || u.email,
    wide: true,
    body: el('div', { class: 'ng-form' },
      el('p', { class: 'pt-hint', text: `${u.email} · creada ${ago(u.created_at)} · entró ${ago(u.last_sign_in_at)}${self ? ' · eres tú' : ''}` }),
      el('section', { class: 'pt-box' }, studioToggle),
      el('section', { class: 'pt-box' }, el('h3', { text: 'Portales' }), list, addRow),
      el('section', { class: 'pt-box pt-user-actions' },
        el('button', { type: 'button', class: 'pill sm ghost', onclick: async () => {
          if (!(await confirmBox(`¿Contraseña nueva para ${u.email}? La anterior deja de valer.`, 'Crear'))) return;
          try {
            const r = await fn('password', { user_id: u.id });
            credentialsDialog(u, r.password);
          } catch (err) {
            toast(err.message, 'error');
          }
        } }, icon('key'), 'Nueva contraseña'),
        el('button', { type: 'button', class: 'pill sm ghost', onclick: async () => {
          try {
            copy((await fn('link', { email: u.email, redirect_to: `${location.origin}/cliente/` })).link, 'Enlace copiado: entra sin contraseña una vez y caduca en una hora.');
          } catch (err) {
            toast(err.message, 'error');
          }
        } }, icon('link'), 'Copiar enlace de acceso'),
      ),
    ),
    submit: 'Listo',
    onSubmit: () => {},
    danger: !self && { label: 'Borrar cuenta', run: () => {
      confirmBox(`¿Borrar la cuenta de ${u.email}? Pierde el acceso a todos los portales. No se puede deshacer.`, 'Borrar').then(async (yes) => {
        if (!yes) return;
        try {
          await fn('delete_user', { user_id: u.id });
          toast('Cuenta borrada.');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    } },
  }));
}

function credentialsDialog(u, password, portalName) {
  const url = `${location.origin}/cliente/`;
  const text = `Hola${u.name ? ` ${u.name.split(' ')[0]}` : ''}: ya tienes tu acceso${portalName ? ` al proyecto ${portalName}` : ''} con Schwarck.\n\n${url}\nCorreo: ${u.email}\nContraseña: ${password}\n\nÁbrelo en el teléfono, toca «Instalar» y activa las notificaciones.`;
  plain(dialog({
    title: 'Datos de acceso',
    body: el('div', { class: 'ng-form' },
      el('p', { class: 'pt-hint', text: 'La contraseña solo se ve ahora. Mándala por WhatsApp o como prefieras; luego se puede cambiar desde el perfil de la app.' }),
      el('div', { class: 'pt-cred' }, el('small', { text: 'Correo' }), el('b', { text: u.email }), el('small', { text: 'Contraseña' }), el('code', { text: password })),
      el('pre', { class: 'pt-invite-text', text }),
    ),
    submit: 'Copiar mensaje',
    onSubmit: () => {
      copy(text, 'Mensaje copiado.');
    },
  }));
}

// ── Identidad ──

async function identityView(id) {
  const c = await sb();
  const clients = must(await c.from('portal_clients').select('*').order('archived').order('name'));
  if (!clients.length) return empty({ ico: 'palette', title: 'Todavía no hay portales', text: 'Crea uno en Clientes y vuelve aquí para ponerle su identidad.', action: el('a', { class: 'pill', href: '#/portal/clientes', text: 'Ir a Clientes' }) });
  const p = clients.find((x) => x.id === id) || clients[0];
  const draft = { name: p.name, accent: p.accent, welcome: p.welcome || '', logo_url: p.logo_url, hidden: p.hidden || [], brand: { ...brandOf(p) } };
  const srcs = { logo: await signedUrl(p.logo_url), cover: await signedUrl(draft.brand.cover) };
  for (const key of Object.keys(FONTS)) loadFont(key);

  // La app se dibuja al ancho de un teléfono de verdad y se encoge para caber aquí.
  const PHONE = 390;
  const frame = el('iframe', { class: 'pt-phone-frame', src: '/cliente/?demo&preview', title: 'Vista previa de la app', style: { width: `${PHONE}px` } });
  const screen = el('div', { class: 'pt-phone-screen' }, frame);
  new ResizeObserver(() => {
    const k = Math.min(1, screen.clientWidth / PHONE) || 1;
    frame.style.height = `${screen.clientHeight / k}px`;
    frame.style.transform = `scale(${k})`;
  }).observe(screen);
  const send = () => frame.contentWindow?.postMessage({ type: 'portal:preview', client: JSON.parse(JSON.stringify(draft)), logoSrc: srcs.logo, coverSrc: srcs.cover }, location.origin);
  const onReady = (e) => {
    if (e.origin === location.origin && e.data?.type === 'portal:preview-ready' && e.source === frame.contentWindow) send();
  };
  addEventListener('message', onReady);
  let dirty = false;
  const changed = () => {
    dirty = true;
    saveBtn.disabled = false;
    send();
    // El logo de muestra sigue al color y, sin imagen, a las iniciales.
    const tile = view.querySelector('.pt-image-preview.is-logo');
    tile?.style.setProperty('--accent', draft.accent);
    if (tile && !srcs.logo) tile.textContent = initials(draft.name);
  };

  const picker = select(clients.map((x) => [x.id, x.archived ? `${x.name} (archivado)` : x.name]), p.id, { 'aria-label': 'Portal' });
  picker.addEventListener('change', () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Cambiar de portal igualmente?')) {
      picker.value = p.id;
      return;
    }
    go(`#/portal/identidad/${picker.value}`);
  });

  const name = input({ value: draft.name, maxLength: 120, oninput: () => { draft.name = name.value; changed(); } });
  const appName = input({ value: draft.brand.app_name, maxLength: 60, placeholder: draft.name, oninput: () => { draft.brand.app_name = appName.value; changed(); } });
  const welcome = el('textarea', { rows: 3, maxLength: 2000, value: draft.welcome, placeholder: 'Aquí verás cada avance de tu proyecto…', oninput: () => { draft.welcome = welcome.value; changed(); } });

  const upload = async (file, kind) => {
    if (file.size > 8 * 1048576) throw new Error('La imagen pesa más de 8 MB.');
    const path = `${p.id}/marca/${crypto.randomUUID().slice(0, 8)}-${kind}-${safeName(file.name)}`;
    must(await c.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
    return path;
  };
  const imageField = (kind, label, hint) => {
    const box = el('div', { class: 'pt-image-field' });
    const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });
    const draw = () => {
      const src = srcs[kind];
      box.replaceChildren(
        el('span', { class: `pt-image-preview is-${kind}`, style: kind === 'logo' ? { '--accent': draft.accent } : null }, src ? el('img', { src, alt: '' }) : kind === 'logo' ? initials(draft.name) : icon('image')),
        el('div', { class: 'pt-image-actions' },
          el('button', { type: 'button', class: 'pill sm ghost', onclick: () => fileInput.click() }, icon('upload'), src ? 'Cambiar' : 'Subir'),
          src && el('button', { type: 'button', class: 'pill sm ghost', onclick: () => { if (kind === 'logo') draft.logo_url = null; else draft.brand.cover = ''; srcs[kind] = null; draw(); changed(); } }, 'Quitar'),
          el('small', { text: hint }),
        ),
        fileInput,
      );
    };
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try {
        toast('Subiendo…');
        const path = await upload(f, kind);
        if (kind === 'logo') draft.logo_url = path;
        else {
          draft.brand.cover = path;
          if (draft.brand.hero !== 'imagen') draft.brand.hero = 'imagen';
          heroSeg.querySelectorAll('button')[2]?.click();
        }
        srcs[kind] = await signedUrl(path);
        draw();
        changed();
        toast('Imagen lista. Guarda para que la vea el cliente.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    draw();
    return group(label, box);
  };

  const accent2Auto = el('button', { type: 'button', class: `pill sm ghost${draft.brand.accent2 ? '' : ' is-on'}`, text: 'Automático', onclick: () => { draft.brand.accent2 = ''; accent2Auto.classList.add('is-on'); changed(); } });
  const fonts = el('div', { class: 'pt-fonts' });
  const drawFonts = () => fonts.replaceChildren(...Object.entries(FONTS).map(([key, [family]]) => el('button', {
    type: 'button',
    class: 'pt-font',
    style: { 'font-family': `'${family}', system-ui` },
    'aria-pressed': String(draft.brand.font === key),
    onclick: () => { draft.brand.font = key; drawFonts(); changed(); },
  }, el('b', { text: 'Aa' }), el('small', { text: family }))));
  drawFonts();
  const heroSeg = seg(Object.entries(HEROES), draft.brand.hero, (v) => { draft.brand.hero = v; changed(); }, 'Inicio');

  const saveBtn = el('button', { type: 'button', class: 'pill', disabled: true, onclick: async () => {
    if (!draft.name.trim()) return toast('El portal necesita un nombre.', 'error');
    saveBtn.disabled = true;
    try {
      const brand = { ...draft.brand };
      for (const k of Object.keys(brand)) if (brand[k] === '' || brand[k] == null) delete brand[k];
      must(await c.from('portal_clients').update({ name: draft.name.trim(), accent: draft.accent, welcome: draft.welcome.trim() || null, logo_url: draft.logo_url || null, brand }).eq('id', p.id));
      dirty = false;
      toast('Identidad guardada: el cliente la ve al abrir su app.');
    } catch (err) {
      saveBtn.disabled = false;
      toast(err.message, 'error');
    }
  } }, icon('check'), 'Guardar');

  const controls = el('div', { class: 'pt-identity-controls' },
    el('section', { class: 'ng-card' },
      el('header', { class: 'ng-card-head' }, el('h2', { text: 'Marca' })),
      el('div', { class: 'ng-form' },
        el('div', { class: 'ng-grid2' }, field('Nombre del cliente', name), field('Nombre en su app', appName, 'Sale arriba en su inicio.')),
        imageField('logo', 'Logo', 'Cuadrado, PNG o JPG. Se ve en la barra y en el inicio.'),
        group('Color principal', swatches(draft.accent, (v) => { draft.accent = v; changed(); })),
        group('Color secundario', el('div', { class: 'pt-inline' }, swatches(draft.brand.accent2 || '#1b66b8', (v) => { draft.brand.accent2 = v; accent2Auto.classList.remove('is-on'); changed(); }), accent2Auto), 'Se mezcla con el principal en el degradado del inicio.'),
        field('Bienvenida', welcome),
      ),
    ),
    el('section', { class: 'ng-card' },
      el('header', { class: 'ng-card-head' }, el('h2', { text: 'Diseño' })),
      el('div', { class: 'ng-form' },
        group('Tipografía de los títulos', fonts),
        group('Esquinas', seg(Object.entries(RADII).map(([k, [l]]) => [k, l]), draft.brand.radius, (v) => { draft.brand.radius = v; changed(); }, 'Esquinas')),
        group('Inicio', heroSeg),
        imageField('cover', 'Imagen del inicio', 'Horizontal. Se usa con «Imagen»; encima va un velo para que se lea el texto.'),
        group('Tema por defecto', seg(Object.entries(THEMES), draft.brand.theme, (v) => { draft.brand.theme = v; changed(); }, 'Tema'), 'Si la persona elige otro en su perfil, manda el suyo.'),
      ),
    ),
    el('div', { class: 'pt-save-bar' }, el('span', { text: 'La vista previa usa contenido de ejemplo con la identidad de este cliente.' }), saveBtn),
  );

  const view = el('div', { class: 'pt-stack' },
    el('div', { class: 'pt-actions' }, el('span', { class: 'pt-label', text: 'Portal' }), picker, el('span', { class: 'ng-grow' }), el('a', { class: 'pill sm ghost', href: `/cliente/?p=${p.id}`, target: '_blank' }, icon('external'), 'Abrir su app')),
    el('div', { class: 'pt-identity' },
      controls,
      el('aside', { class: 'pt-phone' }, el('div', { class: 'pt-phone-shell' }, screen), el('small', { text: 'Puedes tocarla: es la app de verdad.' })),
    ),
  );
  // Al salir de la página, deja de escuchar a la vista previa.
  const stop = new MutationObserver(() => {
    if (!view.isConnected) {
      removeEventListener('message', onReady);
      stop.disconnect();
    }
  });
  requestAnimationFrame(() => stop.observe(document.body, { childList: true, subtree: true }));
  return view;
}

// ── El número del riel ──

/** Lo que los clientes te enviaron y aún no viste (si la cuenta del estudio está conectada en este navegador). */
export async function mountPortalBadge(link) {
  if (!link) return;
  try {
    if (!localStorage.getItem('portal:auth')) return;
  } catch {
    return;
  }
  const badge = el('i', { class: 'pt-rail-badge', hidden: true });
  link.append(badge);
  const check = async () => {
    try {
      const s = await studioSession();
      if (!s?.admin) return;
      const c = await sb();
      const [subs, tasks] = await Promise.all([
        c.from('portal_submissions').select('id', { count: 'exact', head: true }).is('seen_at', null),
        c.from('portal_tasks').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      ]);
      const n = (subs.count || 0) + (tasks.count || 0);
      badge.hidden = !n;
      badge.textContent = n > 9 ? '9+' : String(n);
    } catch {
      // sin portal no hay número
    }
  };
  check();
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || Date.now() - last < 60_000) return;
    last = Date.now();
    check();
  });
}
