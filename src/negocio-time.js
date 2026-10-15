// Negocio: horas. El temporizador del riel, el registro a mano, la lista de
// horas (de un proyecto o de todo) y «Facturar horas».

import {
  state, find, put, remove, bus, el, icon, iconButton, chip, kpi, empty, seg, field, input, select, dialog, confirmBox, toast,
  popover, money, numText, amountText, parseNum, round2, todayISO, dateText, timeText, durationText, clockText, parseDuration,
} from './negocio-core.js';
import {
  TASK_ORDER, BILL_PERIODS, runningEntry, startTimer, pauseTimer, resumeTimer, stopTimer, discardTimer, tick,
  elapsedMs, entryMinutes, entryValue, entryCurrency, rateOf, isFixed, isUnbilled, billedDocOf, newEntry, projectName,
  projectCurrency, customerOf, periodRange, unbilledWork, billLines, billWork, projectStats,
} from './negocio-work.js';
import { head, go } from './negocio-views.js';

const option = ([value, text], current) => el('option', { value, text, selected: value === current });
const STATUS_RANK = { active: 0, pending: 1, paused: 2, completed: 3 };

/** Proyectos para elegir: los abiertos, más el ya elegido aunque esté cerrado. */
function projectChoices(current) {
  return state.projects
    .filter((p) => p.status !== 'completed' || p.id === current)
    .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name))
    .map((p) => [p.id, [p.name || 'Sin nombre', customerOf(p)?.name].filter(Boolean).join(' · ')]);
}

/** Tareas abiertas del proyecto elegido (o las que no tienen proyecto), más la ya elegida. */
function taskChoices(projectId, current) {
  return state.tasks
    .filter((t) => (t.projectId || '') === (projectId || '') && (t.status !== 'done' || t.id === current))
    .sort((a, b) => TASK_ORDER.indexOf(a.status) - TASK_ORDER.indexOf(b.status) || (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((t) => [t.id, t.title || 'Sin título']);
}

/** Selectores de proyecto y tarea enlazados: cambiar de proyecto vacía la tarea. */
function workPickers(target, onChange) {
  const project = select([['', 'Sin proyecto'], ...projectChoices(target.projectId)], target.projectId || '', { 'aria-label': 'Proyecto' });
  const task = select([], '', { 'aria-label': 'Tarea' });
  const fillTasks = () => task.replaceChildren(...[['', 'Sin tarea'], ...taskChoices(target.projectId, target.taskId)].map((o) => option(o, target.taskId || '')));
  fillTasks();
  project.addEventListener('change', () => {
    target.projectId = project.value;
    target.taskId = '';
    fillTasks();
    onChange?.();
  });
  task.addEventListener('change', () => {
    target.taskId = task.value;
    onChange?.();
  });
  return { project, task };
}

/** Desde un proyecto abierto vale ese proyecto; si no (y no se pide `here`), el último en el que se trabajó. */
export function guessProject({ here = false } = {}) {
  const [section, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'proyectos' && id && find('projects', id)) return id;
  if (here) return '';
  const last = [...state.time].sort((a, b) => (b.start || b.date || '').localeCompare(a.start || a.date || '')).find((e) => e.projectId && find('projects', e.projectId)?.status !== 'completed');
  return last?.projectId || '';
}

const minutesOn = (iso) => state.time.filter((e) => e.date === iso).reduce((s, e) => s + entryMinutes(e), 0);

// ── El temporizador del riel ──

export function mountTimer(button) {
  const paint = () => {
    const e = runningEntry();
    button.classList.toggle('is-running', Boolean(e?.resumedAt));
    button.classList.toggle('is-paused', Boolean(e && !e.resumedAt));
    button.setAttribute('aria-label', e ? `Temporizador ${e.resumedAt ? 'en marcha' : 'en pausa'}` : 'Temporizador');
    tick();
  };
  button.addEventListener('click', () => openTimer(button));
  bus.addEventListener('timer', paint);
  bus.addEventListener('change', (ev) => {
    if (ev.detail.col === 'time') paint();
  });
  paint();
}

export function openTimer(anchor) {
  const box = el('div', { class: 'ng-menu ng-timer', role: 'dialog', 'aria-label': 'Temporizador' });
  let pop;
  const close = () => pop.hidePopover();
  const draw = () => {
    box.replaceChildren(...timerContent(close));
    tick();
  };
  draw();
  pop = popover(anchor, box, { side: matchMedia('(max-width: 760px)').matches ? 'below' : 'right' });
  bus.addEventListener('timer', draw);
  pop.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') bus.removeEventListener('timer', draw);
  });
  box.querySelector('button.pill')?.focus();
}

function timerContent(close) {
  const e = runningEntry();
  const today = minutesOn(todayISO());
  if (!e) {
    const draft = { projectId: guessProject(), taskId: '', note: '' };
    const { project, task } = workPickers(draft);
    const note = input({ placeholder: '¿En qué trabajas? (opcional)', maxLength: 200, 'aria-label': 'Nota' });
    const start = () => {
      draft.note = note.value.trim();
      startTimer(draft);
    };
    note.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') start();
    });
    return [
      el('div', { class: 'ng-timer-head' }, el('b', { text: 'Temporizador' }), el('small', { text: today >= 1 ? `Hoy llevas ${durationText(today)}` : 'Hoy aún nada' })),
      el('b', { class: 'ng-timer-clock is-idle', text: '00:00' }),
      el('div', { class: 'ng-timer-fields' }, project, task, note),
      el('div', { class: 'ng-timer-actions' },
        el('button', { type: 'button', class: 'pill', onclick: start }, icon('play'), 'Empezar'),
        el('button', { type: 'button', class: 'pill ghost', onclick: () => { close(); timeForm(null, { projectId: draft.projectId, taskId: draft.taskId }); } }, icon('plus'), 'A mano'),
      ),
    ];
  }
  const save = () => put('time', e);
  const { project, task } = workPickers(e, save);
  const note = input({ value: e.note || '', placeholder: '¿En qué trabajas? (opcional)', maxLength: 200, 'aria-label': 'Nota' });
  note.addEventListener('input', () => {
    e.note = note.value;
    save();
  });
  const live = Boolean(e.resumedAt);
  return [
    el('div', { class: 'ng-timer-head' },
      chip(live ? 'En marcha' : 'En pausa', live ? 'var(--cyan)' : 'var(--usdt)'),
      el('small', { text: `Desde las ${timeText(e.start)}` }),
    ),
    el('b', { class: 'ng-timer-clock', data: { elapsed: '' }, text: clockText(elapsedMs(e)) }),
    el('div', { class: 'ng-timer-fields' }, project, task, note),
    el('div', { class: 'ng-timer-actions' },
      el('button', { type: 'button', class: 'pill', title: 'Parar y guardar lo cronometrado', onclick: () => stopTimer() }, icon('stop'), 'Parar'),
      el('button', { type: 'button', class: 'pill ghost', onclick: live ? pauseTimer : resumeTimer }, icon(live ? 'pause' : 'play'), live ? 'Pausar' : 'Seguir'),
      iconButton('trash', 'Descartar sin guardar', async () => {
        close();
        if (await confirmBox('¿Descartar lo cronometrado sin guardarlo?', 'Descartar')) discardTimer();
      }, 'is-danger'),
    ),
  ];
}

// ── Registrar o editar horas ──

const durationInput = (minutes) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;

export function timeForm(entry, defaults = {}, onSaved) {
  const e = entry ? { ...entry } : newEntry(defaults);
  const target = { projectId: e.projectId || '', taskId: e.taskId || '' };
  const inherited = () => rateOf({ ...e, ...target, rate: null });
  const cur = () => entryCurrency(target);
  const rateHint = () => `Vacía, vale la de la tarea o el proyecto: ${money(inherited(), cur())} por hora.`;
  const rate = input({ value: e.rate != null && e.rate !== '' ? amountText(e.rate) : '', inputmode: 'decimal', placeholder: amountText(inherited()), 'aria-label': 'Tarifa por hora' });
  const rateField = field('Tarifa por hora', rate, rateHint());
  const { project, task } = workPickers(target, () => {
    rate.placeholder = amountText(inherited());
    rateField.querySelector('small').textContent = rateHint();
  });
  const date = input({ type: 'date', value: e.date || todayISO(), required: true });
  const duration = input({ value: e.minutes ? durationInput(e.minutes) : '', placeholder: '1:30', 'aria-label': 'Duración' });
  const startAt = input({ type: 'time', value: e.start ? timeText(e.start) : '' });
  const note = input({ value: e.note || '', maxLength: 300, placeholder: 'Qué hiciste (opcional)' });
  let billable = e.billable !== false;
  const billed = billedDocOf(e);
  const unbill = el('button', { type: 'button', class: 'pill ghost sm', text: 'Quitar de la factura' });
  const billedNote = billed && el('p', { class: 'ng-hint' },
    icon('file'),
    el('span', {}, 'Ya va en la factura ', el('a', { href: `#/doc/${billed.id}`, text: billed.number || 'sin número', onclick: () => dlg.close() }), '.'),
    unbill,
  );
  unbill.addEventListener('click', () => {
    e.invoiceId = '';
    billedNote.replaceChildren(icon('undo'), el('span', { text: 'Al guardar vuelve a quedar sin facturar. La factura no cambia.' }));
  });

  const dlg = dialog({
    title: entry ? (e.running ? 'Lo que estás cronometrando' : 'Editar horas') : 'Registrar horas',
    body: el('div', { class: 'ng-form' },
      el('div', { class: 'ng-grid2' }, field('Proyecto', project), field('Tarea', task)),
      !e.running && el('div', { class: 'ng-grid3' }, field('Fecha', date), field('Duración', duration, '1:30, 1,5 o 90 min'), field('Empezó a las', startAt, 'Si quieres')),
      field('Nota', note),
      rateField,
      el('div', { class: 'ng-field' }, el('span', { text: 'Factura' }), seg([['yes', 'Se factura'], ['no', 'No se factura']], billable ? 'yes' : 'no', (v) => { billable = v === 'yes'; }, 'Se factura')),
      billedNote,
    ),
    danger: entry && !e.running && {
      label: 'Eliminar',
      run: () => {
        remove('time', entry.id);
        toast('Horas eliminadas.');
        onSaved?.();
      },
    },
    onSubmit: () => {
      Object.assign(e, { ...target, note: note.value.trim(), rate: rate.value.trim() ? round2(parseNum(rate.value)) : null, billable });
      if (!e.running) {
        const minutes = parseDuration(duration.value);
        if (!(minutes > 0)) {
          toast('Escribe cuánto duró: 1:30, 1,5 o 90 min.', 'error');
          duration.focus();
          return false;
        }
        e.date = date.value || todayISO();
        e.minutes = minutes;
        if (startAt.value) {
          const from = new Date(`${e.date}T${startAt.value}`);
          e.start = from.toISOString();
          e.end = new Date(from.getTime() + minutes * 60000).toISOString();
        } else {
          e.start = '';
          e.end = '';
        }
      }
      put('time', e);
      toast(entry ? 'Horas guardadas.' : `Registradas ${durationText(e.minutes)}.`);
      onSaved?.(e);
      return true;
    },
  });
  if (!entry) duration.focus();
  return dlg;
}

// ── Lista de horas ──

const dfWeekday = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
function dayLabel(iso) {
  const today = todayISO();
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  if (iso === today) return 'Hoy';
  if (iso === y.toLocaleDateString('en-CA')) return 'Ayer';
  const text = dfWeekday.format(new Date(`${iso}T12:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1) + (iso.slice(0, 4) === today.slice(0, 4) ? '' : ` de ${iso.slice(0, 4)}`);
}

/** El estado de una entrada en una etiqueta: en marcha, facturada, sin facturar… */
function entryChip(e) {
  if (e.running) return chip(e.resumedAt ? 'En marcha' : 'En pausa', e.resumedAt ? 'var(--cyan)' : 'var(--usdt)');
  const billed = billedDocOf(e);
  if (billed) return chip(billed.number || 'Facturada', 'var(--income)');
  if (e.billable === false) return chip('No se factura', 'var(--body)');
  if (e.taskId && isFixed(find('tasks', e.taskId))) return chip('Precio cerrado', 'var(--violet)');
  return chip('Sin facturar', 'var(--usdt)');
}

/** Suma el dinero de varias entradas en una moneda; lo que va en otra se cuenta aparte. */
function sumValue(entries, code) {
  let sum = 0;
  let other = 0;
  for (const e of entries) {
    const v = entryValue(e);
    if (!v) continue;
    if (entryCurrency(e) === code) sum += v;
    else other += 1;
  }
  return { sum: round2(sum), other };
}

function entryRow(e, showProject) {
  const task = e.taskId && find('tasks', e.taskId);
  const title = task?.title || e.note || 'Sin tarea';
  const where = showProject ? projectName(e.projectId) || 'Sin proyecto' : '';
  const sub = [where, task && e.note].filter(Boolean).join(' · ') || (e.start ? 'Con el temporizador' : 'Registro a mano');
  const range = e.running ? `Desde las ${timeText(e.start)}` : e.start ? `${timeText(e.start)} – ${timeText(e.end)}` : 'A mano';
  return el('button', { type: 'button', class: 'ng-row is-time', onclick: () => timeForm(e) },
    el('span', { class: `ng-row-ico${e.running ? ' is-live' : ''}` }, icon(e.running ? 'timer' : 'clock')),
    el('span', { class: 'ng-row-main' }, el('b', { text: title }), el('small', { text: sub })),
    el('span', { class: 'ng-row-date is-soft', text: range }),
    el('b', { class: 'ng-row-dur', data: e.running ? { elapsed: '' } : null, text: e.running ? clockText(elapsedMs(e)) : durationText(e.minutes) }),
    el('span', { class: 'ng-row-tag' }, entryChip(e)),
    el('b', { class: 'ng-row-amount', text: e.billable === false ? '—' : money(entryValue(e), entryCurrency(e)) }),
  );
}

const LIMIT = 400;

/** Entradas agrupadas por día, la más reciente arriba. */
export function timeGroups(entries, { showProject = true } = {}) {
  const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.running || 0) - Number(a.running || 0) || (b.start || b.createdAt || '').localeCompare(a.start || a.createdAt || ''));
  const groups = new Map();
  for (const e of sorted.slice(0, LIMIT)) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }
  const out = [...groups].map(([date, list]) => {
    const minutes = list.reduce((s, e) => s + entryMinutes(e), 0);
    const codes = new Set(list.filter((e) => entryValue(e)).map(entryCurrency));
    const value = codes.size === 1 ? money(sumValue(list, [...codes][0]).sum, [...codes][0]) : '';
    return el('section', { class: 'ng-group' },
      el('header', {}, el('h3', {}, dayLabel(date), el('span', { text: String(list.length) })), el('span', { class: 'ng-group-sum', text: [durationText(minutes), value].filter(Boolean).join(' · ') })),
      el('div', { class: 'ng-rows' }, list.map((e) => entryRow(e, showProject))),
    );
  });
  if (sorted.length > LIMIT) out.push(el('p', { class: 'ng-none', text: `Se ven las ${LIMIT} más recientes. Elige un periodo más corto para ver el resto.` }));
  return out;
}

const STATES = [['all', 'Todas'], ['unbilled', 'Sin facturar'], ['billed', 'Facturadas'], ['free', 'No se facturan']];
function byState(e, show) {
  if (show === 'unbilled') return isUnbilled(e);
  if (show === 'billed') return Boolean(billedDocOf(e));
  if (show === 'free') return e.billable === false;
  return true;
}

/** La pestaña de horas de un proyecto. */
export function projectHours(projectId) {
  let show = 'all';
  const summary = el('small');
  const list = el('div', { class: 'ng-list-body' });
  const draw = () => {
    const p = find('projects', projectId);
    if (!p) return;
    const s = projectStats(p);
    summary.textContent = s.minutes >= 1
      ? `${durationText(s.minutes)} en total · ${s.unbilledMinutes >= 1 ? `${durationText(s.unbilledMinutes)} sin facturar` : 'todo facturado'}`
      : 'Todavía no hay horas';
    const entries = s.entries.filter((e) => byState(e, show));
    if (!s.entries.length) {
      list.replaceChildren(empty({
        ico: 'timer',
        title: 'Sin horas todavía',
        text: 'Cronometra mientras trabajas o apunta las horas a mano. Con la tarifa del proyecto, se facturan solas.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => startTimer({ projectId }) }, icon('play'), 'Empezar a cronometrar'),
      }));
      return;
    }
    list.replaceChildren(...(entries.length ? timeGroups(entries, { showProject: false }) : [el('p', { class: 'ng-none', text: 'Nada con ese filtro.' })]));
  };
  const node = el('section', { class: 'ng-card ng-list' },
    el('header', { class: 'ng-card-head' },
      el('div', {}, el('h2', { text: 'Horas' }), summary),
      el('div', { class: 'ng-filters' },
        select(STATES, show, { 'aria-label': 'Mostrar', onchange: (ev) => { show = ev.target.value; draw(); } }),
        el('button', { type: 'button', class: 'pill ghost sm', onclick: () => timeForm(null, { projectId }) }, icon('plus'), 'Registrar'),
        el('button', { type: 'button', class: 'pill sm', onclick: () => billDialog(projectId) }, icon('file'), 'Facturar horas'),
      ),
    ),
    list,
  );
  draw();
  return { node, refresh: draw };
}

// ── Página de horas ──

const HOUR_PERIODS = [['week', 'Esta semana'], ['month', 'Este mes'], ['30d', 'Últimos 30 días'], ['all', 'Todo']];

export function hoursPage() {
  let project = 'all';
  let show = 'all';
  let period = '30d';
  const kpis = el('div', { class: 'ng-kpis' });
  const note = el('p', { class: 'ng-kpi-note', hidden: true });
  const list = el('div', { class: 'ng-list-body' });
  const countText = el('small');
  const projectSel = select([], 'all', { 'aria-label': 'Proyecto', onchange: (ev) => { project = ev.target.value; drawList(); } });

  const drawKpis = () => {
    const base = state.settings.currency || 'USD';
    const today = todayISO();
    const [weekFrom] = periodRange('week');
    const [monthFrom] = periodRange('month');
    const inRange = (from) => state.time.filter((e) => e.date >= from && e.date <= today);
    const card = (label, entries, ico) => {
      const minutes = entries.reduce((s, e) => s + entryMinutes(e), 0);
      const v = sumValue(entries, base);
      return kpi({ label, value: durationText(minutes), ico, sub: `${money(v.sum, base)}${v.other ? ' + otras monedas' : ''}` });
    };
    const open = state.time.filter(isUnbilled);
    const v = sumValue(open, base);
    const projects = new Set(open.map((e) => e.projectId).filter(Boolean)).size;
    kpis.replaceChildren(
      card('Hoy', state.time.filter((e) => e.date === today), 'timer'),
      card('Esta semana', inRange(weekFrom), 'calendar'),
      card('Este mes', inRange(monthFrom), 'clock'),
      kpi({ label: 'Sin facturar', value: money(v.sum, base), ico: 'file', sub: `${durationText(open.reduce((s, e) => s + entryMinutes(e), 0))} · ${projects} ${projects === 1 ? 'proyecto' : 'proyectos'}`, tone: v.sum ? 'var(--usdt)' : null }),
    );
    note.hidden = !v.other;
    note.textContent = 'Las horas de proyectos en otras monedas no entran en estas cifras.';
  };

  const drawList = () => {
    const [from, to] = periodRange(period);
    const options = [['all', 'Todos los proyectos'], ['none', 'Sin proyecto'], ...state.projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.id, p.name || 'Sin nombre'])];
    if (!options.some(([v]) => v === project)) project = 'all';
    if (document.activeElement !== projectSel) projectSel.replaceChildren(...options.map((o) => option(o, project)));
    const entries = state.time.filter((e) => (project === 'all' || (project === 'none' ? !e.projectId : e.projectId === project))
      && byState(e, show) && (!from || e.running || (e.date >= from && e.date <= to)));
    countText.textContent = `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'} · ${durationText(entries.reduce((s, e) => s + entryMinutes(e), 0))}`;
    if (!state.time.length) {
      list.replaceChildren(empty({
        ico: 'timer',
        title: 'Todavía no hay horas',
        text: 'Usa el temporizador del riel mientras trabajas o apúntalas a mano después.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => timeForm(null, { projectId: guessProject() }) }, icon('plus'), 'Registrar horas'),
      }));
      return;
    }
    list.replaceChildren(...(entries.length ? timeGroups(entries) : [el('p', { class: 'ng-none', text: 'Nada en ese periodo con esos filtros.' })]));
  };

  const refresh = () => {
    drawKpis();
    drawList();
  };
  const node = el('div', { class: 'ng-page' },
    head('Horas', 'Lo que has trabajado, lo que vale y lo que falta por facturar.',
      el('button', { type: 'button', class: 'pill ghost', onclick: () => timeForm(null, { projectId: guessProject() }) }, icon('plus'), 'Registrar horas'),
      el('button', { type: 'button', class: 'pill', onclick: () => billDialog() }, icon('file'), 'Facturar horas'),
    ),
    kpis,
    note,
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Registro' }), countText),
        el('div', { class: 'ng-filters' },
          projectSel,
          select(STATES, show, { 'aria-label': 'Mostrar', onchange: (ev) => { show = ev.target.value; drawList(); } }),
          select(HOUR_PERIODS, period, { 'aria-label': 'Periodo', onchange: (ev) => { period = ev.target.value; drawList(); } }),
        ),
      ),
      list,
    ),
  );
  refresh();
  return { node, refresh };
}

// ── Facturar horas ──

export function billDialog(projectId = '') {
  const pending = state.projects.filter((p) => {
    const w = unbilledWork(p);
    return w.entries.length || w.tasks.length;
  });
  let p = find('projects', projectId) || pending[0];
  if (!p) {
    toast('No hay horas sin facturar.');
    return;
  }
  let period = 'all';
  let group = 'task';
  let withTasks = true;
  let picked = { entries: [], tasks: [] };

  const choices = [...new Set([p, ...pending])].map((x) => [x.id, `${x.name || 'Sin nombre'} · ${durationText(projectStats(x).unbilledMinutes)}`]);
  const projectSel = select(choices, p.id, { 'aria-label': 'Proyecto' });
  const periodSel = select(BILL_PERIODS, period, { 'aria-label': 'Periodo' });
  const tasksToggle = el('div', { class: 'ng-field' }, el('span', { text: 'Tareas terminadas a precio cerrado' }), seg([['yes', 'Incluirlas'], ['no', 'Dejarlas']], 'yes', (v) => { withTasks = v === 'yes'; draw(); }, 'Tareas a precio cerrado'));
  const preview = el('div', { class: 'ng-bill' });

  const draw = () => {
    const work = unbilledWork(p, period);
    picked = { entries: work.entries, tasks: withTasks ? work.tasks : [] };
    tasksToggle.hidden = !work.tasks.length;
    const cur = projectCurrency(p);
    const lines = billLines(p, { ...picked, group });
    if (!lines.length) {
      preview.replaceChildren(el('p', { class: 'ng-none', text: 'No queda nada sin facturar en ese periodo.' }));
      return;
    }
    const total = round2(lines.reduce((s, l) => s + round2(l.qty * l.price), 0));
    const free = picked.entries.filter((e) => !rateOf(e)).length;
    // replaceChildren no descarta false ni 0 como hace el(): se filtran aquí.
    preview.replaceChildren(...[
      el('ul', { class: 'ng-bill-lines' }, lines.map((l) => el('li', {},
        el('span', { class: 'ng-bill-what' }, el('b', { text: l.name }), l.description && el('small', { text: l.description })),
        el('span', { class: 'ng-bill-qty', text: `${numText(l.qty)} ${l.minutes ? 'h' : ''} × ${money(l.price, cur)}`.replace('  ', ' ') }),
        el('b', { class: 'ng-bill-amount', text: money(round2(l.qty * l.price), cur) }),
      ))),
      el('div', { class: 'ng-bill-total' }, el('span', { text: `${lines.length} ${lines.length === 1 ? 'línea' : 'líneas'}` }), el('b', { text: money(total, cur) })),
      free && el('p', { class: 'ng-hint is-warn' }, icon('clock'), `${free === 1 ? 'Una entrada no tiene' : `${free} entradas no tienen`} tarifa y ${free === 1 ? 'sale' : 'salen'} a cero. Ponla en el proyecto o en la tarea.`),
      !customerOf(p) && el('p', { class: 'ng-hint' }, icon('users'), 'El proyecto no tiene cliente: elígelo en la factura.'),
    ].filter(Boolean));
  };
  projectSel.addEventListener('change', () => {
    p = find('projects', projectSel.value);
    draw();
  });
  periodSel.addEventListener('change', () => {
    period = periodSel.value;
    draw();
  });
  draw();

  dialog({
    title: 'Facturar horas',
    wide: true,
    submit: 'Crear factura',
    body: el('div', { class: 'ng-form' },
      el('div', { class: 'ng-grid2' }, field('Proyecto', projectSel), field('Periodo', periodSel)),
      el('div', { class: 'ng-field' }, el('span', { text: 'Una línea' }), seg([['task', 'Por tarea'], ['day', 'Por día'], ['entry', 'Por entrada']], group, (v) => { group = v; draw(); }, 'Agrupar')),
      tasksToggle,
      preview,
    ),
    onSubmit: () => {
      if (!picked.entries.length && !picked.tasks.length) {
        toast('No hay nada que facturar.', 'error');
        return false;
      }
      const doc = billWork(p, { ...picked, group });
      const n = picked.entries.length;
      toast(n ? `Factura creada. ${n} ${n === 1 ? 'entrada queda' : 'entradas quedan'} como facturadas.` : 'Factura creada.');
      go(`#/doc/${doc.id}`);
      return true;
    },
  });
}

