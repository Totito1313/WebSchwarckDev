// Negocio › Portal de clientes: la entrada a la app del portal (/cliente/).
//
// El portal se gestiona desde la propia app, en modo estudio (en el teléfono o aquí):
// esta página da el código QR para instalarla, la abre, y manda a cada cliente el
// trabajo de hoy que ya está en Negocio (tareas hechas y horas), que la app recoge
// para su reporte diario. Comparten sitio, así que comparten almacenamiento:
// `portal:import` lleva el trabajo y `portal:auth`, la sesión del estudio en la app.

import { state, el, icon, empty, toast, qr, todayISO, find } from './negocio-core.js';
import { head } from './negocio-views.js';
import { SUPABASE_URL, SUPABASE_KEY } from './portal/config.js';

const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
const minutesText = (m) => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

/** Lo hecho hoy en Negocio, por cliente: tareas terminadas y horas apuntadas. */
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

export function portalPage() {
  const url = `${location.origin}/cliente/`;
  const groups = todayWork();
  const node = el('div', { class: 'ng-page pt' },
    head('Portal de clientes', 'Cada cliente tiene su app con su reporte diario, su calendario, sus resultados y sus peticiones. Tú la gestionas desde la misma app, en modo estudio.',
      el('a', { class: 'pill ghost', href: '/cliente/?demo=estudio', target: '_blank' }, icon('eye'), 'Ver demo del estudio'),
      el('a', { class: 'pill', href: '/cliente/', target: '_blank' }, icon('external'), 'Abrir el portal')),
    el('div', { class: 'pt-launch' },
      el('section', { class: 'ng-card pt-qr' },
        el('div', { class: 'pt-qr-code' }, qr(url)),
        el('div', {},
          el('h2', { text: 'Llévalo en tu teléfono' }),
          el('p', { text: 'Escanea el código, entra con tu cuenta del estudio y toca «Instalar». Desde ahí creas portales, publicas el reporte del día, pides cosas a cada cliente, llevas su calendario, sus resultados y sus leads, y te llegan avisos de lo que te envían.' }),
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
  return { node, title: 'Portal de clientes | Negocio' };
}

/** El número del riel: lo que los clientes te enviaron y aún no viste (si entraste al portal como estudio en este navegador). */
export async function mountPortalBadge(link) {
  if (!link) return;
  let raw = null;
  try {
    raw = localStorage.getItem('portal:auth');
  } catch {
    return;
  }
  if (!raw) return;
  const badge = el('i', { class: 'pt-rail-badge', hidden: true });
  link.append(badge);
  let sb = null;
  const check = async () => {
    try {
      if (!sb) {
        const { createClient } = await import('@supabase/supabase-js');
        sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'portal:auth' } });
      }
      const { data } = await sb.auth.getSession();
      if (data.session?.user?.app_metadata?.role !== 'admin') return;
      const [subs, tasks] = await Promise.all([
        sb.from('portal_submissions').select('id', { count: 'exact', head: true }).is('seen_at', null),
        sb.from('portal_tasks').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
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
