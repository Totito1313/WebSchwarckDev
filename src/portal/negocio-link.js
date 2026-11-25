// Del portal a Negocio (modo estudio): lo que pide el cliente (un envío, una idea, un cambio,
// un comentario, una reunión…) se convierte con un toque en una tarea de Negocio, en la
// columna «Solicitud» de su proyecto, con el enlace de vuelta al portal.
//
// Negocio vive en el Worker (/api/admin/crm) con la sesión del panel: es el mismo sitio, así
// que la cookie viaja sola. Se cargan aquí sus propios módulos (negocio-core y negocio-work):
// la tarea se numera y se guarda exactamente igual que si se creara en Negocio. Si la sesión
// del panel no está abierta, se pide la contraseña en una hoja.

import { el, icon, toast, sheet, field, input, textarea, seg, datePicker } from './kit.js';
import { react } from './feel.js';
import { app } from './state.js';

let loaded = null;
let loadedAt = 0;
/** Tareas de Negocio que salieron del portal, por el id de lo que las originó. */
const linked = new Map();

const demo = () => app.backend.mode === 'demo';
const DEMO_PROJECTS = [{ id: 'demo-proyecto', name: 'Marca y redes de Café Aroma', code: 'CAF', customerId: 'demo' }];
let demoNum = 27;

async function panelSession() {
  const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('No se pudo hablar con el panel.');
  return res.json();
}

/** Pide la contraseña del panel en una hoja. Se cumple con true si entró. */
function panelLogin() {
  return new Promise((resolve) => {
    let ok = false;
    const pass = input({ type: 'password', autocomplete: 'current-password', placeholder: 'La del panel de Schwarck' });
    const msg = el('p', { class: 'cl-msg', role: 'status' });
    const btn = el('button', { type: 'submit', class: 'cl-btn' }, icon('key'), 'Entrar');
    const form = el('form', { class: 'cl-form' },
      el('p', { class: 'cl-form-hint', text: 'Para crear tareas en Negocio hace falta la sesión del panel en este navegador. Se queda abierta 12 horas.' }),
      field('Contraseña del panel', pass),
      msg,
    );
    const ui = sheet('Conectar con Negocio', form, { actions: [btn], onClose: () => resolve(ok) });
    const submit = async (e) => {
      e?.preventDefault();
      btn.disabled = true;
      msg.textContent = 'Comprobando…';
      try {
        const res = await fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pass.value }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo entrar.');
        ok = true;
        ui.close();
      } catch (err) {
        msg.textContent = err.message;
        react('error');
      } finally {
        btn.disabled = false;
      }
    };
    form.addEventListener('submit', submit);
    btn.addEventListener('click', submit);
    setTimeout(() => pass.focus(), 250);
  });
}

/** Los módulos de Negocio con sus datos cargados (como mucho cada dos minutos). */
async function negocio({ fresh = false } = {}) {
  if (demo()) return null;
  if (loaded && !fresh && Date.now() - loadedAt < 120_000) return loaded;
  let session = await panelSession();
  if (!session.authed) {
    if (!session.configured) throw new Error('El panel todavía no tiene contraseña.');
    if (!(await panelLogin())) throw new Error('Sin la sesión del panel no se puede crear la tarea.');
    session = await panelSession();
    if (!session.authed) throw new Error('No se pudo abrir la sesión del panel.');
  }
  const [core, work] = await Promise.all([import('../negocio-core.js'), import('../negocio-work.js')]);
  await core.loadAll();
  loadedAt = Date.now();
  loaded = { core, work };
  for (const t of core.state.tasks) if (t.portal?.ref) linked.set(t.portal.ref, { key: work.taskKey(t), status: t.status });
  return loaded;
}

/** Si eso ya tiene su tarea en Negocio (lo que se sabe sin cargar nada). */
export const linkedTask = (ref) => linked.get(ref) || null;

/** Los proyectos donde puede ir la tarea: primero los del cliente de Negocio enlazado a este portal. */
function projectsFor(n) {
  if (!n) return DEMO_PROJECTS;
  const customerId = app.client.crm_customer_id;
  const list = n.core.state.projects.filter((p) => p.status !== 'completed');
  const mine = list.filter((p) => customerId && p.customerId === customerId);
  return [...mine, ...list.filter((p) => !mine.includes(p))];
}

/**
 * Crear (o abrir, si ya existe) la tarea de Negocio de algo que pidió el cliente.
 * `item`: { ref (id de lo que la origina), kind, title, description, due }.
 */
export async function taskFromPortal(item, from) {
  const existing = linkedTask(item.ref);
  if (existing) {
    openInNegocio(existing.key);
    return;
  }
  from?.classList.add('is-busy');
  let n = null;
  try {
    n = await negocio();
  } catch (err) {
    toast(err.message, 'error');
    return;
  } finally {
    from?.classList.remove('is-busy');
  }
  const again = linkedTask(item.ref);
  if (again) {
    openInNegocio(again.key);
    return;
  }
  const projects = projectsFor(n);
  const mine = projects.filter((p) => app.client.crm_customer_id && p.customerId === app.client.crm_customer_id);
  let projectId = (mine[0] || (demo() ? projects[0] : null))?.id || '';
  let priority = item.priority || 'medium';
  let due = item.due || '';
  const title = input({ value: item.title.slice(0, 200), maxLength: 200 });
  const description = textarea({ value: item.description || '', maxLength: 5000, rows: 4 });
  const options = [['', 'Sin proyecto'], ...projects.slice(0, 30).map((p) => [p.id, `${p.code ? `${p.code} · ` : ''}${p.name}`])];
  const select = el('select', { class: 'cl-input' }, options.map(([v, label]) => el('option', { value: v, text: label, selected: v === projectId })));
  select.addEventListener('change', () => { projectId = select.value; });
  const btn = el('button', { type: 'button', class: 'cl-btn' }, icon('check'), 'Crear tarea');
  const ui = sheet('Tarea en Negocio', el('div', { class: 'cl-form' },
    el('p', { class: 'cl-form-hint', text: `Entra en «Solicitud» del proyecto, con el enlace a lo que pidió ${app.client.name}. Al terminarla, «Mandar al portal» la lleva a su reporte.` }),
    field('Título', title),
    field('Proyecto', select, !app.client.crm_customer_id && !demo() ? 'Este portal no está enlazado a un cliente de Negocio: enlázalo en Negocio › Portal de clientes.' : null),
    field('Prioridad', seg([['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']], priority, (v) => { priority = v; }, { small: true })),
    field('Para cuándo', datePicker(due, (v) => { due = v; })),
    field('Detalles', description),
  ), { actions: [btn], subtitle: app.client.name });
  btn.addEventListener('click', async () => {
    if (!title.value.trim()) return title.focus();
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const key = await createTask(n, { title: title.value.trim(), description: description.value.trim(), projectId, priority, due, item });
      linked.set(item.ref, { key, status: 'request' });
      // El botón que la pidió pasa a enseñar su clave (la bandeja no se repinta sola).
      if (from?.isConnected) {
        from.classList.add('is-linked');
        from.replaceChildren(icon('tasks'), el('span', { text: key }));
        from.setAttribute('aria-label', `Abrir la tarea ${key} en Negocio`);
        from.title = `Tarea ${key}`;
      }
      react('success');
      ui.close();
      toast(`Tarea ${key} creada en Negocio.`, 'ok');
      document.dispatchEvent(new CustomEvent('portal:linked'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  });
}

async function createTask(n, { title, description, projectId, priority, due, item }) {
  const back = `${location.origin}/cliente/?p=${app.client.id}${item.route || ''}`;
  const text = [description, `Desde el portal de ${app.client.name}: ${back}`].filter(Boolean).join('\n\n');
  if (!n) {
    await new Promise((r) => setTimeout(r, 350));
    return `CAF-${++demoNum}`;
  }
  const { core, work } = n;
  const task = work.newTask({ projectId, status: 'request' });
  Object.assign(task, {
    title,
    description: text,
    priority,
    dueDate: due || '',
    portal: { clientId: app.client.id, ref: item.ref, kind: item.kind, at: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  });
  await core.put('tasks', task, { now: true });
  return work.taskKey(task) || task.title;
}

export function openInNegocio(key) {
  window.open(`/admin/negocio/#/tareas/${encodeURIComponent(key)}`, '_blank');
}

/** El botón pequeño que va en cada cosa que pide el cliente: «Tarea» o, si ya la tiene, su clave. */
export function taskButton(item) {
  const has = linkedTask(item.ref);
  const btn = el('button', {
    type: 'button',
    class: `cl-glass sm cl-task-link${has ? ' is-linked' : ''}`,
    'aria-label': has ? `Abrir la tarea ${has.key} en Negocio` : 'Crear tarea en Negocio',
    title: has ? `Tarea ${has.key}` : 'Crear tarea en Negocio',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      taskFromPortal(item, btn);
    },
  }, icon('tasks'), has && el('span', { text: has.key }));
  return btn;
}

/** Al abrir el portal en modo estudio: saber qué tiene ya tarea, sin pedir contraseña. */
export async function warmLinks() {
  if (demo() || !app.studio) return false;
  try {
    const session = await panelSession();
    if (!session.authed) return false;
    await negocio();
    return linked.size > 0;
  } catch {
    // sin panel: los botones dirán «Tarea» y pedirán la sesión al tocarlos
    return false;
  }
}
