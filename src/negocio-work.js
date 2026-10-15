// Negocio: proyectos, tareas y horas. Aquí van los datos y las cuentas; las
// pantallas están en negocio-projects.js, negocio-tasks.js y negocio-time.js.
//
// Las horas guardan su tarifa solo si se cambió a mano: si no, valen lo que diga
// su tarea, su proyecto o los ajustes en ese momento. Así una tarifa puesta tarde
// sirve también para lo ya cronometrado. Al facturar, la tarifa queda fija en la
// factura.

import {
  state, find, put, remove, uid, bus, totals, counts, convert, round2, todayISO, nowISO, dateText, shortDate,
  durationText, clockText, newDoc, toast,
} from './negocio-core.js';

export const PROJECT_STATUS = {
  pending: ['Pendiente', 'var(--usdt)'],
  active: ['En curso', 'var(--blue)'],
  paused: ['En pausa', 'var(--body)'],
  completed: ['Completado', 'var(--income)'],
};

export const TASK_STATUS = {
  request: ['Solicitud', 'var(--violet)'],
  todo: ['Por hacer', 'var(--body)'],
  doing: ['En curso', 'var(--blue)'],
  review: ['Revisión', 'var(--usdt)'],
  done: ['Hecho', 'var(--income)'],
};
export const TASK_ORDER = Object.keys(TASK_STATUS);

export const PRIORITY = {
  low: ['Baja', 'var(--cyan)'],
  medium: ['Media', 'var(--usdt)'],
  high: ['Alta', 'var(--expense)'],
};

export const DEFAULT_STAGES = ['Arranque', 'En curso', 'Revisión', 'Entregado'];

const has = (v) => v != null && v !== '';

// ── Proyectos ──

export function newProject(customer = null) {
  const s = state.settings;
  return {
    id: uid(),
    name: '',
    customerId: customer?.id || '',
    status: 'pending',
    currency: customer?.currency || s.currency || 'USD',
    budget: 0,
    rate: Number(s.hourlyRate) || 0,
    startDate: todayISO(),
    dueDate: '',
    description: '',
    stages: DEFAULT_STAGES.map((name) => ({ id: uid(), name, done: false })),
  };
}

export const projectCurrency = (p) => p?.currency || state.settings.currency || 'USD';
export const customerOf = (p) => (p?.customerId ? find('customers', p.customerId) : null);
export const projectName = (id) => (id && find('projects', id)?.name) || '';

/** Las etapas van en orden: completar una completa las anteriores, y reabrirla reabre las siguientes. */
export function toggleStage(p, index) {
  const stages = p.stages || [];
  const done = !stages[index].done;
  stages.forEach((s, i) => {
    if (done && i <= index) s.done = true;
    if (!done && i >= index) s.done = false;
  });
  const count = stages.filter((s) => s.done).length;
  if (p.status !== 'paused') {
    if (count === stages.length) p.status = 'completed';
    else if (count > 0) p.status = 'active';
    else if (p.status === 'completed') p.status = 'pending';
  }
}

export function setProjectStatus(p, status) {
  p.status = status;
  if (status === 'completed') for (const s of p.stages || []) s.done = true;
}

/** Borra el proyecto con sus tareas y sus horas. Los documentos se quedan, sin proyecto. */
export function removeProject(p) {
  for (const t of state.tasks.filter((x) => x.projectId === p.id)) remove('tasks', t.id);
  for (const e of state.time.filter((x) => x.projectId === p.id)) remove('time', e.id);
  for (const d of state.docs.filter((x) => x.projectId === p.id)) put('docs', { ...d, projectId: '' });
  remove('projects', p.id);
}

// ── Tareas ──

export function newTask({ projectId = '', status = 'todo' } = {}) {
  return {
    id: uid(),
    projectId,
    title: '',
    status,
    priority: '',
    startDate: '',
    dueDate: '',
    value: 0,
    rate: null,
    description: '',
    checklist: [],
    comments: [],
    order: nextOrder(status),
    doneAt: status === 'done' ? nowISO() : '',
    invoiceId: '',
  };
}

/** El hueco al final de una columna del tablero. */
export function nextOrder(status) {
  let top = 0;
  for (const t of state.tasks) if (t.status === status) top = Math.max(top, Number(t.order) || 0);
  return top + 1;
}

export function setTaskStatus(task, status) {
  if (task.status === status) return;
  task.status = status;
  task.order = nextOrder(status);
  task.doneAt = status === 'done' ? nowISO() : '';
}

/** Una tarea con valor fijo se cobra por ese valor; sus horas se cuentan, pero no suman dinero. */
export const isFixed = (task) => Number(task?.value) > 0;
export const taskEntries = (id) => state.time.filter((e) => e.taskId === id);
export const taskMinutes = (id) => taskEntries(id).reduce((s, e) => s + entryMinutes(e), 0);
export const taskValue = (task) => (isFixed(task) ? Number(task.value) : round2(taskEntries(task.id).reduce((s, e) => s + entryValue(e), 0)));
export const taskCurrency = (task) => (task.projectId && find('projects', task.projectId) ? projectCurrency(find('projects', task.projectId)) : state.settings.currency || 'USD');

/** Tarifa de la tarea: la suya o la de su proyecto (o la general, si no tiene proyecto). */
export function taskRate(task) {
  if (has(task?.rate)) return Number(task.rate) || 0;
  const p = task?.projectId && find('projects', task.projectId);
  return p ? Number(p.rate) || 0 : Number(state.settings.hourlyRate) || 0;
}

export function billedDocOf(item) {
  const doc = item?.invoiceId && find('docs', item.invoiceId);
  return doc && doc.status !== 'void' ? doc : null;
}

export function removeTask(task) {
  // Las horas de la tarea se quedan en el proyecto, sin tarea.
  for (const e of taskEntries(task.id)) put('time', { ...e, taskId: '' });
  remove('tasks', task.id);
}

// ── Horas ──

/** Una entrada en marcha suma lo acumulado antes de cada pausa más el tramo actual. */
export function elapsedMs(e, now = Date.now()) {
  if (!e.running) return (Number(e.minutes) || 0) * 60000;
  return (Number(e.accMs) || 0) + (e.resumedAt ? Math.max(0, now - Date.parse(e.resumedAt)) : 0);
}
export const entryMinutes = (e) => (e.running ? elapsedMs(e) / 60000 : Number(e.minutes) || 0);

export function rateOf(e) {
  if (has(e.rate)) return Number(e.rate) || 0;
  const task = e.taskId && find('tasks', e.taskId);
  if (task) return taskRate(task);
  const p = e.projectId && find('projects', e.projectId);
  return p ? Number(p.rate) || 0 : Number(state.settings.hourlyRate) || 0;
}

export const entryCurrency = (e) => (e.projectId && find('projects', e.projectId) ? projectCurrency(find('projects', e.projectId)) : state.settings.currency || 'USD');
const onFixedTask = (e) => Boolean(e.taskId) && isFixed(find('tasks', e.taskId));

export function entryValue(e) {
  if (e.billable === false || onFixedTask(e)) return 0;
  return round2((entryMinutes(e) / 60) * rateOf(e));
}

/** Lo que aún se puede facturar por horas: terminado, facturable, fuera de tareas a precio fijo y sin factura viva. */
export const isUnbilled = (e) => !e.running && e.billable !== false && (Number(e.minutes) || 0) > 0 && !onFixedTask(e) && !billedDocOf(e);

export function newEntry({ projectId = '', taskId = '', date = todayISO(), minutes = 0, note = '' } = {}) {
  return { id: uid(), projectId, taskId, note, date, start: '', end: '', minutes, running: false, accMs: 0, resumedAt: '', rate: null, billable: true, invoiceId: '' };
}

// ── Temporizador ──
// Solo hay uno: es la entrada con `running`. Vive en los datos, así sobrevive a
// recargar la página y se ve desde cualquier pantalla.

export const runningEntry = () => state.time.find((e) => e.running);
const timerChanged = () => bus.dispatchEvent(new CustomEvent('timer'));

export function startTimer({ projectId = '', taskId = '', note = '' } = {}) {
  const before = runningEntry();
  const saved = before ? stopTimer({ quiet: true }) : null;
  const now = nowISO();
  const entry = { ...newEntry({ projectId, taskId, note }), start: now, running: true, resumedAt: now };
  put('time', entry, { now: true })?.catch(() => {});
  if (saved) toast(`Se guardaron ${durationText(saved.minutes)} de lo anterior.`);
  tick();
  timerChanged();
  return entry;
}

export function pauseTimer() {
  const e = runningEntry();
  if (!e?.resumedAt) return;
  e.accMs = elapsedMs(e);
  e.resumedAt = '';
  put('time', e, { now: true })?.catch(() => {});
  tick();
  timerChanged();
}

export function resumeTimer() {
  const e = runningEntry();
  if (!e || e.resumedAt) return;
  e.resumedAt = nowISO();
  put('time', e, { now: true })?.catch(() => {});
  tick();
  timerChanged();
}

/** Para el temporizador y guarda lo hecho. Menos de un minuto no se guarda. */
export function stopTimer({ quiet = false } = {}) {
  const e = runningEntry();
  if (!e) return null;
  const ms = elapsedMs(e);
  if (ms < 60000) {
    remove('time', e.id);
    if (!quiet) toast('Menos de un minuto: no se guardó.');
    tick();
    timerChanged();
    return null;
  }
  Object.assign(e, { running: false, end: nowISO(), minutes: Math.round(ms / 60000), accMs: 0, resumedAt: '' });
  put('time', e, { now: true })?.catch(() => {});
  if (!quiet) toast(`Guardado: ${durationText(e.minutes)}.`);
  tick();
  timerChanged();
  return e;
}

export function discardTimer() {
  const e = runningEntry();
  if (!e) return;
  remove('time', e.id);
  tick();
  timerChanged();
}

let ticker = 0;
/** Pone al día cada cronómetro de la pantalla (`data-elapsed`); late cada segundo mientras corre. */
export function tick() {
  const e = runningEntry();
  const text = e ? clockText(elapsedMs(e)) : '';
  for (const node of document.querySelectorAll('[data-elapsed]')) node.textContent = text;
  const live = Boolean(e?.resumedAt);
  if (live && !ticker) ticker = setInterval(tick, 1000);
  if (!live && ticker) {
    clearInterval(ticker);
    ticker = 0;
  }
}

// ── Cuentas ──

/** Un importe de un documento en otra moneda, si el documento da la equivalencia. */
export function inCurrency(doc, amount, code) {
  if (doc.currency === code) return amount;
  if (doc.equiv?.currency === code) return convert(amount, doc.currency, code, doc.equiv.rate);
  return null;
}

export function projectStats(p) {
  const cur = projectCurrency(p);
  const tasks = state.tasks.filter((t) => t.projectId === p.id);
  const done = tasks.filter((t) => t.status === 'done');
  const entries = state.time.filter((e) => e.projectId === p.id);
  let minutes = 0;
  let timeValue = 0;
  let unbilledMinutes = 0;
  let unbilledValue = 0;
  for (const e of entries) {
    const m = entryMinutes(e);
    const v = entryValue(e);
    minutes += m;
    timeValue += v;
    if (isUnbilled(e)) {
      unbilledMinutes += m;
      unbilledValue += v;
    }
  }
  const fixedDone = done.filter(isFixed);
  const fixedValue = fixedDone.reduce((s, t) => s + Number(t.value), 0);
  const unbilledTasks = fixedDone.filter((t) => !billedDocOf(t));
  unbilledValue += unbilledTasks.reduce((s, t) => s + Number(t.value), 0);
  const earned = round2(timeValue + fixedValue);

  const docs = state.docs.filter((d) => d.projectId === p.id);
  const invoices = docs.filter((d) => d.type === 'invoice' && counts(d));
  let invoiced = 0;
  let paid = 0;
  let due = 0;
  let skipped = 0;
  for (const d of invoices) {
    const t = totals(d);
    const total = inCurrency(d, t.total, cur);
    if (total == null) {
      skipped += 1;
      continue;
    }
    invoiced += total;
    paid += inCurrency(d, Math.min(t.paid, t.total), cur);
    due += inCurrency(d, t.due, cur);
  }
  const budget = Number(p.budget) || 0;
  const stages = p.stages || [];
  const stagesDone = stages.filter((s) => s.done).length;
  return {
    cur, tasks, done, entries, docs, invoices, minutes, earned, budget, skipped, unbilledMinutes, unbilledTasks, stagesDone,
    left: round2(budget - earned),
    unbilledValue: round2(unbilledValue),
    invoiced: round2(invoiced),
    paid: round2(paid),
    due: round2(due),
    stagesTotal: stages.length,
    progress: stages.length ? stagesDone / stages.length : 0,
  };
}

// ── Facturar horas ──

export const BILL_PERIODS = [['all', 'Todo lo pendiente'], ['month', 'Este mes'], ['last', 'El mes pasado'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días']];

export function periodRange(period, today = todayISO()) {
  const d = new Date(`${today}T12:00:00`);
  const iso = (x) => x.toLocaleDateString('en-CA');
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (period === 'last') {
    const first = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
    const last = new Date(d.getFullYear(), d.getMonth(), 0, 12);
    return [iso(first), iso(last)];
  }
  if (period === '7d' || period === '30d') {
    d.setDate(d.getDate() - (period === '7d' ? 6 : 29));
    return [iso(d), today];
  }
  if (period === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [iso(d), today];
  }
  return ['', ''];
}

/** Lo que falta por facturar de un proyecto en un periodo. */
export function unbilledWork(p, period = 'all') {
  const [from, to] = periodRange(period);
  const entries = state.time
    .filter((e) => e.projectId === p.id && isUnbilled(e) && (!from || (e.date >= from && e.date <= to)))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '').localeCompare(b.start || ''));
  const tasks = state.tasks.filter((t) => t.projectId === p.id && t.status === 'done' && isFixed(t) && !billedDocOf(t));
  return { entries, tasks };
}

function rangeText(dates) {
  const sorted = [...dates].sort();
  if (sorted.length < 2) return dateText(sorted[0]);
  return `del ${shortDate(sorted[0])} al ${dateText(sorted.at(-1))}`;
}

const taskTitle = (id) => (id && find('tasks', id)?.title?.trim()) || '';

/** Las líneas de la factura: por tarea, por día o una por entrada. Cada tarifa va en su línea. */
export function billLines(p, { entries, tasks = [], group = 'task' }) {
  const groups = new Map();
  for (const e of entries) {
    const rate = rateOf(e);
    const key = group === 'entry' ? e.id : `${group === 'day' ? e.date : e.taskId || ''}|${rate}`;
    if (!groups.has(key)) groups.set(key, { list: [], rate });
    groups.get(key).list.push(e);
  }
  const lines = [];
  for (const { list, rate } of groups.values()) {
    const first = list[0];
    const minutes = list.reduce((s, e) => s + (Number(e.minutes) || 0), 0);
    const notes = [...new Set(list.map((e) => e.note?.trim()).filter(Boolean))];
    let name;
    let detail;
    if (group === 'day') {
      name = `Trabajo del ${dateText(first.date)}`;
      detail = [...new Set(list.map((e) => taskTitle(e.taskId) || e.note?.trim()).filter(Boolean))].join(' · ');
    } else if (group === 'entry') {
      name = taskTitle(first.taskId) || first.note?.trim() || `Horas de ${p.name}`;
      detail = [dateText(first.date), taskTitle(first.taskId) && first.note?.trim()].filter(Boolean).join(' · ');
    } else {
      name = taskTitle(first.taskId) || `Horas de ${p.name || 'proyecto'}`;
      detail = [rangeText(list.map((e) => e.date)), notes.join(' · ')].filter(Boolean).join(' · ');
    }
    lines.push({ name, description: [durationText(minutes), detail].filter(Boolean).join(' · ').slice(0, 600), qty: round2(minutes / 60), price: rate, minutes });
  }
  for (const t of tasks) lines.push({ name: t.title?.trim() || 'Tarea', description: 'Tarea terminada, a precio cerrado', qty: 1, price: Number(t.value) || 0, minutes: 0 });
  return lines;
}

/** Crea la factura con lo elegido y lo marca como facturado en ella. */
export function billWork(p, { entries, tasks = [], group = 'task' }) {
  const doc = newDoc('invoice', customerOf(p));
  doc.currency = projectCurrency(p);
  doc.projectId = p.id;
  doc.items = billLines(p, { entries, tasks, group }).map(({ minutes, ...line }) => ({ id: uid(), ...line }));
  put('docs', doc, { now: true })?.catch(() => {});
  for (const e of entries) put('time', { ...e, invoiceId: doc.id });
  for (const t of tasks) put('tasks', { ...t, invoiceId: doc.id });
  return doc;
}
