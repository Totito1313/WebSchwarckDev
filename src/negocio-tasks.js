// Negocio: tareas. El tablero por estados (y su vista de lista), la ficha de
// cada tarea y la página con las tareas de todos los proyectos.

import {
  state, find, put, uid, bus, el, icon, iconButton, chip, kpi, empty, seg, field, input, select, menu, picker, confirmBox,
  toast, autosize, money, amountText, parseNum, round2, todayISO, nowISO, dateText, shortDate, timeText, durationText, clockText,
} from './negocio-core.js';
import {
  TASK_STATUS, TASK_ORDER, PRIORITY, newTask, setTaskStatus, nextOrder, removeTask, taskEntries, taskMinutes, taskValue,
  taskCurrency, taskRate, isFixed, billedDocOf, runningEntry, startTimer, stopTimer, elapsedMs, entryValue, projectName,
  customerOf, periodRange,
} from './negocio-work.js';
import { timeForm } from './negocio-time.js';
import { head, searchBox } from './negocio-views.js';

const readPref = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la vista vale para esta visita.
  }
};

const titleOf = (t) => t.title?.trim() || 'Sin título';
const isLate = (t, today = todayISO()) => Boolean(t.dueDate) && t.dueDate < today && t.status !== 'done';

function datesText(t) {
  if (t.startDate && t.dueDate) return `${shortDate(t.startDate)} → ${shortDate(t.dueDate)}`;
  if (t.dueDate) return `Para el ${shortDate(t.dueDate)}`;
  return `Desde el ${shortDate(t.startDate)}`;
}

/** En cada columna, el orden del tablero; las hechas, la más reciente arriba. */
function sorted(list, status) {
  if (status === 'done') return [...list].sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  return [...list].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

/** Abre la ficha de una tarea nueva. Solo se guarda cuando se escribe algo en ella. */
export function createTask({ projectId = '', status = 'todo' } = {}) {
  const task = newTask({ projectId, status });
  state.tasks.push(task);
  openTask(task.id, { isNew: true });
  return task;
}

function checkButton(t, onDone) {
  const done = t.status === 'done';
  return el('button', {
    type: 'button',
    class: 'ng-check',
    'aria-pressed': String(done),
    'aria-label': done ? `Reabrir «${titleOf(t)}»` : `Marcar «${titleOf(t)}» como hecha`,
    title: done ? 'Reabrir' : 'Marcar como hecha',
    onclick: (e) => {
      e.stopPropagation();
      setTaskStatus(t, done ? 'todo' : 'done');
      put('tasks', t);
      onDone?.();
    },
  }, icon('check'));
}

function statusMenu(anchor, t, after) {
  menu(anchor, TASK_ORDER.map((s) => ({
    label: TASK_STATUS[s][0],
    icon: s === t.status ? 'check' : null,
    run: () => {
      setTaskStatus(t, s);
      put('tasks', t);
      after?.();
    },
  })));
}

// ── Tablero y lista ──

/** Las tareas de un proyecto o de todos. Devuelve { node, refresh }. */
export function taskBoard({ projectId = null } = {}) {
  const scoped = Boolean(projectId);
  let view = readPref('ng-task-view', 'board');
  let q = '';
  let priority = 'all';
  let project = 'all';
  let adding = null;
  let allDone = false;
  let dragId = null;
  const marker = el('div', { class: 'ng-drop-line', 'aria-hidden': 'true' });
  const progress = el('div', { class: 'ng-progress' });
  const body = el('div', { class: 'ng-board-body' });
  const projectSel = !scoped && select([], 'all', { 'aria-label': 'Proyecto', onchange: (e) => { project = e.target.value; draw(); } });
  const homeProject = () => (scoped ? projectId : project !== 'all' && project !== 'none' ? project : '');

  const inScope = () => state.tasks.filter((t) => (scoped ? t.projectId === projectId : project === 'all' || (project === 'none' ? !t.projectId : t.projectId === project)));
  const matches = (t) => (priority === 'all' || (t.priority || 'none') === priority)
    && (!q || `${t.title} ${t.description} ${projectName(t.projectId)}`.toLowerCase().includes(q));

  function card(t) {
    const run = runningEntry();
    const live = run?.taskId === t.id;
    const minutes = taskMinutes(t.id);
    const value = taskValue(t);
    const checks = t.checklist || [];
    const meta = [
      (t.startDate || t.dueDate) && el('span', { class: isLate(t) ? 'is-late' : '' }, icon('calendar'), datesText(t)),
      checks.length > 0 && el('span', {}, icon('squareCheck'), `${checks.filter((c) => c.done).length}/${checks.length}`),
      t.comments?.length > 0 && el('span', {}, icon('message'), String(t.comments.length)),
      live ? el('span', { class: 'is-live' }, icon('timer'), el('span', { data: { elapsed: '' }, text: clockText(elapsedMs(run)) }))
        : minutes >= 1 && el('span', {}, icon('clock'), durationText(minutes)),
      value > 0 && el('b', { class: 'ng-tcard-value', text: money(value, taskCurrency(t)) }),
    ].filter(Boolean);
    const where = !scoped && projectName(t.projectId);
    const node = el('article', {
      class: `ng-tcard${t.status === 'done' ? ' is-done' : ''}${live ? ' is-live' : ''}`,
      tabindex: 0,
      role: 'button',
      draggable: true,
      'aria-label': `${titleOf(t)}, ${TASK_STATUS[t.status]?.[0] || ''}`,
      data: { id: t.id },
      onclick: () => openTask(t.id),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === node) {
          e.preventDefault();
          openTask(t.id);
        }
      },
    },
      el('div', { class: 'ng-tcard-top' }, checkButton(t), el('b', { class: 'ng-tcard-title', text: titleOf(t) })),
      (t.priority || where) && el('div', { class: 'ng-tcard-tags' }, t.priority && PRIORITY[t.priority] && chip(...PRIORITY[t.priority]), where && el('small', { text: where })),
      meta.length > 0 && el('div', { class: 'ng-tcard-meta' }, meta),
    );
    node.addEventListener('dragstart', (e) => {
      dragId = t.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', t.id);
      requestAnimationFrame(() => node.classList.add('is-dragging'));
    });
    node.addEventListener('dragend', () => {
      dragId = null;
      node.classList.remove('is-dragging');
      marker.remove();
      for (const col of body.querySelectorAll('.is-over')) col.classList.remove('is-over');
    });
    return node;
  }

  /** Arrastrar y soltar: el hueco se marca con una línea y el orden queda entre las dos vecinas. */
  function dropZone(col, list, status) {
    const cardsBefore = () => [...list.querySelectorAll('.ng-tcard:not(.is-dragging)')];
    col.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const next = cardsBefore().find((c) => {
        const r = c.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      list.insertBefore(marker, next || list.querySelector(':scope > :not(.ng-tcard):not(.ng-drop-line)'));
      col.classList.add('is-over');
    });
    col.addEventListener('dragleave', (e) => {
      if (col.contains(e.relatedTarget)) return;
      col.classList.remove('is-over');
      marker.remove();
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      const task = dragId && find('tasks', dragId);
      if (!task || !marker.isConnected) return;
      const ids = [];
      for (const node of list.children) {
        if (node === marker) ids.push(null);
        else if (node.classList.contains('ng-tcard') && !node.classList.contains('is-dragging')) ids.push(node.dataset.id);
      }
      const at = ids.indexOf(null);
      const prev = at > 0 ? find('tasks', ids[at - 1]) : null;
      const next = at >= 0 && at < ids.length - 1 ? find('tasks', ids[at + 1]) : null;
      const o = (x) => Number(x.order) || 0;
      if (task.status !== status) {
        task.status = status;
        task.doneAt = status === 'done' ? nowISO() : '';
      }
      task.order = prev && next ? (o(prev) + o(next)) / 2 : prev ? o(prev) + 1 : next ? o(next) - 1 : nextOrder(status);
      marker.remove();
      put('tasks', task);
    });
  }

  function quickAdd(status) {
    const box = input({ class: 'ng-quick-in', placeholder: 'Título y Enter', maxLength: 300, 'aria-label': `Nueva tarea en ${TASK_STATUS[status][0]}` });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        adding = null;
        draw();
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const title = box.value.trim();
      if (!title) {
        adding = null;
        draw();
        return;
      }
      const task = newTask({ projectId: homeProject(), status });
      task.title = title;
      put('tasks', task);
    });
    box.addEventListener('blur', () => {
      setTimeout(() => {
        if (adding === status && !box.value.trim() && !document.activeElement?.classList.contains('ng-quick-in')) {
          adding = null;
          draw();
        }
      }, 150);
    });
    requestAnimationFrame(() => box.focus());
    return el('div', { class: 'ng-quick' }, box);
  }

  function drawBoard(tasks) {
    return el('div', { class: 'ng-board' }, TASK_ORDER.map((status) => {
      const [label, color] = TASK_STATUS[status];
      const all = sorted(tasks.filter((t) => t.status === status), status);
      const shown = status === 'done' && !allDone ? all.slice(0, 30) : all;
      const list = el('div', { class: 'ng-col-list' }, shown.map(card));
      if (shown.length < all.length) {
        list.append(el('button', { type: 'button', class: 'ng-col-more', onclick: () => { allDone = true; draw(); } }, `Ver ${all.length - shown.length} más`));
      }
      if (adding === status) list.append(quickAdd(status));
      else if (!all.length) list.append(el('p', { class: 'ng-col-empty', text: 'Nada aquí' }));
      const col = el('section', { class: 'ng-col', style: { '--c': color }, 'aria-label': label },
        el('header', { class: 'ng-col-head' },
          el('i', { class: 'ng-col-dot', 'aria-hidden': 'true' }),
          el('h3', { text: label }),
          el('span', { class: 'ng-col-count', text: String(all.length) }),
          iconButton('plus', `Añadir tarea en ${label}`, () => { adding = status; draw(); }, 'is-sm'),
        ),
        list,
      );
      dropZone(col, list, status);
      return col;
    }));
  }

  function row(t) {
    const minutes = taskMinutes(t.id);
    const value = taskValue(t);
    const checks = t.checklist || [];
    const [label, color] = TASK_STATUS[t.status] || TASK_STATUS.todo;
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn', style: { '--c': color }, 'aria-label': `Estado: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label);
    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      statusMenu(statusBtn, t);
    });
    const sub = [!scoped && (projectName(t.projectId) || 'Sin proyecto'), checks.length && `${checks.filter((c) => c.done).length}/${checks.length} pasos`].filter(Boolean).join(' · ');
    const node = el('div', {
      class: `ng-row is-task${t.status === 'done' ? ' is-done' : ''}`,
      tabindex: 0,
      role: 'button',
      onclick: () => openTask(t.id),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === node) {
          e.preventDefault();
          openTask(t.id);
        }
      },
    },
      checkButton(t),
      el('span', { class: 'ng-row-main' }, el('b', { text: titleOf(t) }), sub && el('small', { text: sub })),
      el('span', { class: 'ng-row-tag' }, t.priority && PRIORITY[t.priority] && chip(...PRIORITY[t.priority])),
      el('span', { class: `ng-row-date${isLate(t) ? ' is-late' : ''}`, text: t.dueDate ? shortDate(t.dueDate) : '' }),
      el('span', { class: 'ng-row-date is-soft', text: minutes >= 1 ? durationText(minutes) : '' }),
      el('b', { class: 'ng-row-amount', text: value > 0 ? money(value, taskCurrency(t)) : '' }),
      statusBtn,
    );
    return node;
  }

  function drawList(tasks) {
    const groups = TASK_ORDER.map((s) => [s, sorted(tasks.filter((t) => t.status === s), s)]).filter(([, l]) => l.length);
    return el('div', { class: 'ng-tlist' }, groups.map(([status, list]) => el('section', { class: 'ng-group', style: { '--c': TASK_STATUS[status][1] } },
      el('header', {}, el('h3', {}, el('i', { class: 'ng-col-dot', 'aria-hidden': 'true' }), TASK_STATUS[status][0], el('span', { text: String(list.length) }))),
      el('div', { class: 'ng-rows' }, list.map(row)),
    )));
  }

  function draw() {
    if (projectSel) {
      const options = [['all', 'Todos los proyectos'], ['none', 'Sin proyecto'], ...state.projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.id, p.name || 'Sin nombre'])];
      if (!options.some(([v]) => v === project)) project = 'all';
      if (document.activeElement !== projectSel) projectSel.replaceChildren(...options.map(([v, text]) => el('option', { value: v, text, selected: v === project })));
    }
    const scope = inScope();
    const done = scope.filter((t) => t.status === 'done').length;
    const share = scope.length ? done / scope.length : 0;
    progress.replaceChildren(
      el('b', { text: `${Math.round(share * 100)} %` }),
      el('span', { class: 'ng-bar' }, el('i', { style: { width: `${share * 100}%` } })),
      el('small', { text: `${done} de ${scope.length} hechas` }),
    );
    if (!scope.length && adding == null) {
      body.replaceChildren(empty({
        ico: 'tasks',
        title: 'Todavía no hay tareas',
        text: 'Apunta lo que hay que hacer y muévelo por el tablero hasta terminarlo.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => createTask({ projectId: homeProject() }) }, icon('plus'), 'Nueva tarea'),
      }));
      return;
    }
    const tasks = scope.filter(matches);
    if (view === 'list') body.replaceChildren(tasks.length ? drawList(tasks) : el('p', { class: 'ng-none', text: 'Nada coincide con esos filtros.' }));
    else body.replaceChildren(drawBoard(tasks));
  }

  const node = el('section', { class: `ng-card ng-tasks is-${view}` },
    el('header', { class: 'ng-card-head' },
      progress,
      el('div', { class: 'ng-filters' },
        projectSel,
        select([['all', 'Cualquier prioridad'], ['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja'], ['none', 'Sin prioridad']], priority, { 'aria-label': 'Prioridad', onchange: (e) => { priority = e.target.value; draw(); } }),
        searchBox((v) => { q = v; draw(); }, 'Buscar tareas…'),
        seg([['board', 'Tablero'], ['list', 'Lista']], view, (v) => {
          view = v;
          savePref('ng-task-view', v);
          node.classList.toggle('is-board', v === 'board');
          node.classList.toggle('is-list', v === 'list');
          draw();
        }, 'Vista'),
        scoped && el('button', { type: 'button', class: 'pill sm', onclick: () => createTask({ projectId }) }, icon('plus'), 'Nueva tarea'),
      ),
    ),
    body,
  );
  draw();
  return { node, refresh: draw };
}

// ── Ficha de la tarea ──

const PRIORITY_OPTIONS = [['', 'Ninguna'], ['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']];
const dfStamp = (iso) => `${dateText(new Date(iso).toLocaleDateString('en-CA'))}, ${timeText(iso)}`;

export function openTask(id, { isNew = false } = {}) {
  const task = find('tasks', id);
  if (!task) return null;
  task.checklist ||= [];
  task.comments ||= [];
  const save = () => put('tasks', task);
  const top = el('header', { class: 'ng-sheet-head' });
  const body = el('div', { class: 'ng-sheet-body' });
  const checklistBox = el('section', { class: 'ng-sheet-sec' });
  const hoursBox = el('section', { class: 'ng-sheet-sec' });
  const commentsBox = el('section', { class: 'ng-sheet-sec' });
  const dlg = el('dialog', { class: 'ng-dialog is-sheet', 'aria-label': 'Tarea' }, top, body);

  function drawTop() {
    const [label, color] = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg', style: { '--c': color }, 'aria-label': `Estado: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label, icon('down'));
    statusBtn.addEventListener('click', () => statusMenu(statusBtn, task, drawTop));
    const where = projectName(task.projectId);
    const projectBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg is-plain', 'aria-label': 'Proyecto' }, icon('folder'), el('span', { text: where || 'Sin proyecto' }), icon('down'));
    projectBtn.addEventListener('click', () => picker(projectBtn, {
      placeholder: 'Buscar proyecto…',
      items: () => state.projects.filter((p) => p.status !== 'completed' || p.id === task.projectId).sort((a, b) => a.name.localeCompare(b.name)),
      label: (p) => p.name || 'Sin nombre',
      sub: (p) => customerOf(p)?.name || 'Sin cliente',
      onPick: (p) => moveTo(p.id),
      extra: task.projectId && el('button', { type: 'button', class: 'ng-pick-new', onclick: () => moveTo('') }, icon('x'), 'Sin proyecto'),
    }));
    const live = runningEntry()?.taskId === task.id;
    const timerBtn = el('button', {
      type: 'button',
      class: `ng-ibtn${live ? ' is-live' : ''}`,
      'aria-label': live ? 'Parar el temporizador' : 'Cronometrar esta tarea',
      title: live ? 'Parar el temporizador' : 'Cronometrar esta tarea',
      onclick: () => (live ? stopTimer() : startTimer({ projectId: task.projectId, taskId: task.id })),
    }, icon(live ? 'stop' : 'play'));
    const more = iconButton('more', 'Más acciones', () => menu(more, [
      { label: 'Duplicar', icon: 'copy', run: duplicate },
      '-',
      { label: 'Eliminar tarea', icon: 'trash', danger: true, run: destroy },
    ], { align: 'end' }));
    top.replaceChildren(statusBtn, projectBtn, el('span', { class: 'ng-grow' }), timerBtn, more, iconButton('x', 'Cerrar', () => dlg.close()));
  }

  /** Al cambiar de proyecto, sus horas sin facturar se van con ella. */
  function moveTo(projectId) {
    task.projectId = projectId;
    for (const e of taskEntries(task.id)) if (!billedDocOf(e)) put('time', { ...e, projectId });
    save();
    drawTop();
    drawBody();
  }

  function drawBody() {
    const cur = taskCurrency(task);
    const title = autosize(el('textarea', { class: 'ng-ttitle', rows: 1, value: task.title, placeholder: 'Título de la tarea', maxLength: 300, 'aria-label': 'Título' }));
    title.addEventListener('input', () => {
      task.title = title.value.replace(/\n/g, ' ');
      save();
    });
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        title.blur();
      }
    });
    const dateBox = (key, label) => input({ type: 'date', value: task[key] || '', 'aria-label': label, onchange: (e) => { task[key] = e.target.value; save(); } });
    const money2 = (key, label, nullable) => {
      const box = input({ value: task[key] != null && task[key] !== '' && (nullable || task[key]) ? amountText(task[key]) : '', inputmode: 'decimal', 'aria-label': label });
      box.addEventListener('input', () => {
        const v = box.value.trim();
        task[key] = v ? round2(parseNum(v)) : nullable ? null : 0;
        save();
        drawHours();
      });
      box.addEventListener('blur', () => {
        if (box.value.trim()) box.value = amountText(parseNum(box.value));
      });
      return box;
    };
    const value = money2('value', 'Valor fijo');
    value.placeholder = '0,00';
    const rate = money2('rate', 'Tarifa por hora', true);
    const inherited = task.projectId ? Number(find('projects', task.projectId)?.rate) || 0 : Number(state.settings.hourlyRate) || 0;
    rate.placeholder = amountText(inherited);
    const desc = autosize(el('textarea', { rows: 3, value: task.description || '', placeholder: 'Detalles, enlaces, lo que haga falta…', maxLength: 8000 }));
    desc.addEventListener('input', () => {
      task.description = desc.value;
      save();
    });
    body.replaceChildren(
      title,
      el('div', { class: 'ng-form' },
        el('div', { class: 'ng-field' }, el('span', { text: 'Prioridad' }), seg(PRIORITY_OPTIONS, task.priority || '', (v) => { task.priority = v; save(); }, 'Prioridad')),
        el('div', { class: 'ng-grid2' }, field('Empieza', dateBox('startDate', 'Empieza')), field('Entrega', dateBox('dueDate', 'Entrega'))),
        el('div', { class: 'ng-grid2' },
          field(`Valor fijo (${cur})`, value, 'Si tiene precio cerrado. Sus horas se cuentan, pero no se cobran aparte.'),
          field(`Tarifa por hora (${cur})`, rate, `Vacía, vale la ${task.projectId ? 'del proyecto' : 'general'}: ${money(inherited, cur)}.`),
        ),
        field('Descripción', desc),
      ),
      checklistBox,
      hoursBox,
      commentsBox,
    );
    drawChecklist();
    drawHours();
    drawComments();
  }

  function secHead(text, note, ...extra) {
    return el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text }), note && el('small', { text: note }), el('span', { class: 'ng-grow' }), extra);
  }

  function drawChecklist() {
    const items = task.checklist;
    const done = items.filter((i) => i.done).length;
    const add = input({ placeholder: 'Añadir un paso y Enter', maxLength: 300, 'aria-label': 'Nuevo paso' });
    add.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const text = add.value.trim();
      if (!text) return;
      items.push({ id: uid(), text, done: false });
      save();
      drawChecklist();
      checklistBox.querySelector('.ng-check-add input')?.focus();
    });
    checklistBox.replaceChildren(...[
      secHead('Checklist', items.length ? `${done}/${items.length}` : ''),
      items.length > 0 && el('span', { class: 'ng-bar is-wide is-ok' }, el('i', { style: { width: `${(done / items.length) * 100}%` } })),
      el('ul', { class: 'ng-checklist' }, items.map((item) => el('li', { class: item.done ? 'is-done' : '' },
        el('button', {
          type: 'button',
          class: 'ng-check',
          'aria-pressed': String(item.done),
          'aria-label': item.done ? 'Desmarcar' : 'Marcar como hecho',
          onclick: () => {
            item.done = !item.done;
            save();
            drawChecklist();
          },
        }, icon('check')),
        input({ value: item.text, class: 'ng-check-text', maxLength: 300, 'aria-label': 'Paso', oninput: (e) => { item.text = e.target.value; save(); } }),
        iconButton('x', 'Quitar paso', () => {
          task.checklist = items.filter((x) => x !== item);
          save();
          drawChecklist();
        }, 'is-sm'),
      ))),
      el('label', { class: 'ng-check-add' }, icon('plus'), add),
    ].filter(Boolean));
  }

  function drawHours() {
    const entries = taskEntries(task.id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.start || '').localeCompare(a.start || ''));
    const minutes = taskMinutes(task.id);
    const value = taskValue(task);
    const cur = taskCurrency(task);
    const run = runningEntry();
    const rate = taskRate(task);
    const note = [minutes >= 1 && durationText(minutes), value > 0 && money(value, cur), !isFixed(task) && rate > 0 && `${money(rate, cur)}/h`].filter(Boolean).join(' · ');
    hoursBox.replaceChildren(
      secHead('Horas', note, el('button', { type: 'button', class: 'pill ghost sm', onclick: () => timeForm(null, { projectId: task.projectId, taskId: task.id }, drawHours) }, icon('plus'), 'Registrar')),
      entries.length ? el('ul', { class: 'ng-history' }, entries.slice(0, 60).map((e) => {
        const billed = billedDocOf(e);
        return el('li', {},
          el('div', {},
            e.running ? el('b', { data: { elapsed: '' }, text: clockText(elapsedMs(run)) }) : el('b', { text: durationText(e.minutes) }),
            el('small', { text: [dateText(e.date), e.note, billed && (billed.number || 'Facturada'), e.billable === false && 'No se factura'].filter(Boolean).join(' · ') }),
          ),
          !isFixed(task) && e.billable !== false && el('span', { class: 'ng-history-amount', text: money(entryValue(e), cur) }),
          iconButton('edit', 'Editar', () => timeForm(e, {}, drawHours)),
        );
      })) : el('p', { class: 'ng-hint', text: 'Todavía no hay horas en esta tarea.' }),
    );
  }

  function drawComments() {
    const list = task.comments;
    const text = autosize(el('textarea', { rows: 2, placeholder: 'Escribe un comentario…', maxLength: 4000, 'aria-label': 'Comentario' }));
    const send = () => {
      const v = text.value.trim();
      if (!v) return;
      list.push({ id: uid(), text: v, at: nowISO() });
      save();
      drawComments();
      commentsBox.querySelector('textarea')?.focus();
    };
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        send();
      }
    });
    commentsBox.replaceChildren(...[
      secHead('Comentarios', list.length ? String(list.length) : ''),
      list.length > 0 && el('ul', { class: 'ng-comments' }, list.map((c) => el('li', {},
        el('p', { text: c.text }),
        el('div', {}, el('small', { text: dfStamp(c.at) }), iconButton('trash', 'Borrar comentario', () => {
          task.comments = list.filter((x) => x !== c);
          save();
          drawComments();
        }, 'is-sm')),
      ))),
      el('div', { class: 'ng-comment-new' }, text, el('button', { type: 'button', class: 'pill sm', onclick: send }, 'Comentar')),
    ].filter(Boolean));
  }

  function duplicate() {
    const copy = { ...structuredClone(task), id: uid(), title: `${titleOf(task)} (copia)`, comments: [], invoiceId: '', order: nextOrder(task.status) };
    copy.checklist = copy.checklist.map((c) => ({ ...c, id: uid() }));
    delete copy.createdAt;
    delete copy.updatedAt;
    put('tasks', copy);
    dlg.close();
    openTask(copy.id);
    toast('Tarea duplicada.');
  }

  async function destroy() {
    const hours = taskEntries(task.id).length;
    const yes = await confirmBox(`¿Eliminar «${titleOf(task)}»?${hours ? ' Sus horas se quedan en el proyecto, sin tarea.' : ''}`);
    if (!yes) return;
    removeTask(task);
    dlg.close();
    toast('Tarea eliminada.');
  }

  const onTimer = () => {
    drawTop();
    drawHours();
  };
  bus.addEventListener('timer', onTimer);
  dlg.addEventListener('close', () => {
    bus.removeEventListener('timer', onTimer);
    const empty = !task.title.trim() && !task.description?.trim() && !task.checklist.length && !task.comments.length && !taskEntries(task.id).length;
    if (isNew && empty && find('tasks', task.id)) removeTask(task);
    dlg.remove();
  });
  drawTop();
  drawBody();
  document.body.append(dlg);
  dlg.showModal();
  if (!task.title.trim()) body.querySelector('.ng-ttitle').focus();
  return dlg;
}

// ── Página de tareas ──

export function tasksPage() {
  const kpis = el('div', { class: 'ng-kpis' });
  const board = taskBoard();
  const drawKpis = () => {
    const all = state.tasks;
    const count = (...s) => all.filter((t) => s.includes(t.status)).length;
    const done = count('done');
    const [weekFrom] = periodRange('week');
    const week = all.filter((t) => t.status === 'done' && t.doneAt && new Date(t.doneAt).toLocaleDateString('en-CA') >= weekFrom).length;
    const late = (...s) => all.filter((t) => s.includes(t.status) && isLate(t)).length;
    const lateText = (n) => `${n} ${n === 1 ? 'atrasada' : 'atrasadas'}`;
    const waiting = late('request', 'todo');
    const going = late('doing', 'review');
    kpis.replaceChildren(
      kpi({ label: 'Por hacer', value: String(count('request', 'todo')), ico: 'tasks', sub: waiting ? lateText(waiting) : `${count('request')} ${count('request') === 1 ? 'solicitud' : 'solicitudes'}`, tone: waiting ? 'var(--expense)' : null }),
      kpi({ label: 'En curso', value: String(count('doing', 'review')), ico: 'timer', sub: going ? lateText(going) : `${count('review')} en revisión`, tone: going ? 'var(--expense)' : null }),
      kpi({ label: 'Hechas', value: String(done), ico: 'checkCircle', sub: week ? `${week} esta semana` : 'Ninguna esta semana' }),
      kpi({ label: 'Total', value: `${done} / ${all.length}`, ico: 'board', bar: all.length ? done / all.length : 0 }),
    );
  };
  const refresh = () => {
    drawKpis();
    board.refresh();
  };
  const node = el('div', { class: 'ng-page' },
    head('Tareas', 'Todo lo que hay que hacer, en todos los proyectos.',
      el('button', { type: 'button', class: 'pill', onclick: () => createTask() }, icon('plus'), 'Nueva tarea')),
    kpis,
    board.node,
  );
  drawKpis();
  return { node, refresh };
}
