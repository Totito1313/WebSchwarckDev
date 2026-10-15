// Negocio: tareas. El tablero por estados (y su vista de lista), la ficha de
// cada tarea y la página con las tareas de todos los proyectos.
//
// Como en Linear, cada tarea tiene su clave (CF-12), puede tener portada,
// subtareas y relaciones con otras (la bloquea, está relacionada, es un
// duplicado), y enlaces a páginas, documentos o la web. Nombrar otra tarea por
// su clave en la descripción o en un comentario también la enlaza.

import {
  state, find, put, uid, bus, el, icon, iconButton, chip, kpi, empty, seg, field, input, select, menu, picker, confirmBox,
  toast, dialog, autosize, money, amountText, parseNum, round2, todayISO, nowISO, dateText, shortDate, timeText, durationText,
  clockText,
} from './negocio-core.js';
import {
  TASK_STATUS, TASK_ORDER, PRIORITY, newTask, setTaskStatus, nextOrder, nextNum, removeTask, taskEntries, taskMinutes,
  taskValue, taskCurrency, taskRate, isFixed, billedDocOf, runningEntry, startTimer, stopTimer, elapsedMs, entryValue,
  projectName, customerOf, periodRange, taskKey, findTaskByKey, subtasksOf, parentOf, familyOf, relationsOf, blockersOf,
  addRelation, removeRelation, moveTask,
} from './negocio-work.js';
import { timeForm } from './negocio-time.js';
import { head, searchBox } from './negocio-views.js';
import {
  richArea, richText, linkable, linkPicker, taskChip, pageChip, docChip, urlChip, backlinks, coverMenu, coverNode,
} from './negocio-enlaces.js';

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

const subsDone = (t) => {
  const subs = subtasksOf(t.id);
  return [subs.filter((s) => s.status === 'done').length, subs.length];
};

async function copyKey(t) {
  try {
    await navigator.clipboard.writeText(taskKey(t));
    toast(`${taskKey(t)} copiada. Pégala en otra tarea o en una página para enlazarla.`);
  } catch {
    toast('No se pudo copiar.', 'error');
  }
}

/** Abre la ficha de una tarea nueva. Solo se guarda cuando se escribe algo en ella. */
export function createTask({ projectId = '', status = 'todo', parentId = '' } = {}) {
  const task = newTask({ projectId, status, parentId });
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
  let showSubs = readPref('ng-task-subs', 'no') === 'si';
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
  // Las subtareas viven dentro de su tarea; se ven sueltas al buscar o si se pide.
  const matches = (t) => (showSubs || q || !t.parentId)
    && (priority === 'all' || (t.priority || 'none') === priority)
    && (!q || `${taskKey(t)} ${t.title} ${t.description} ${projectName(t.projectId)}`.toLowerCase().includes(q));

  function card(t) {
    const run = runningEntry();
    const live = run?.taskId === t.id;
    const minutes = taskMinutes(t.id);
    const value = taskValue(t);
    const checks = t.checklist || [];
    const [subDone, subTotal] = subsDone(t);
    const blocked = blockersOf(t).length > 0 && t.status !== 'done';
    const parent = parentOf(t);
    const meta = [
      blocked && el('span', { class: 'is-late' }, icon('ban'), 'Bloqueada'),
      (t.startDate || t.dueDate) && el('span', { class: isLate(t) ? 'is-late' : '' }, icon('calendar'), datesText(t)),
      subTotal > 0 && el('span', { title: 'Subtareas hechas' }, icon('subtasks'), `${subDone}/${subTotal}`),
      checks.length > 0 && el('span', {}, icon('squareCheck'), `${checks.filter((c) => c.done).length}/${checks.length}`),
      t.comments?.length > 0 && el('span', {}, icon('message'), String(t.comments.length)),
      live ? el('span', { class: 'is-live' }, icon('timer'), el('span', { data: { elapsed: '' }, text: clockText(elapsedMs(run)) }))
        : minutes >= 1 && el('span', {}, icon('clock'), durationText(minutes)),
      value > 0 && el('b', { class: 'ng-tcard-value', text: money(value, taskCurrency(t)) }),
    ].filter(Boolean);
    const where = !scoped && projectName(t.projectId);
    const node = el('article', {
      class: `ng-tcard${t.status === 'done' ? ' is-done' : ''}${live ? ' is-live' : ''}${t.cover ? ' has-cover' : ''}`,
      tabindex: 0,
      role: 'button',
      draggable: true,
      'aria-label': `${taskKey(t)} ${titleOf(t)}, ${TASK_STATUS[t.status]?.[0] || ''}`,
      data: { id: t.id },
      onclick: () => openTask(t.id),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === node) {
          e.preventDefault();
          openTask(t.id);
        }
      },
    },
      coverNode(t.cover, 'ng-tcard-cover'),
      el('div', { class: 'ng-tcard-top' },
        checkButton(t),
        el('div', { class: 'ng-tcard-head' },
          el('span', { class: 'ng-tkey' }, taskKey(t), parent && el('span', { class: 'ng-tkey-parent', text: ` · en ${taskKey(parent)}` })),
          el('b', { class: 'ng-tcard-title', text: titleOf(t) }),
        ),
      ),
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
    const [subDone, subTotal] = subsDone(t);
    const [label, color] = TASK_STATUS[t.status] || TASK_STATUS.todo;
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn', style: { '--c': color }, 'aria-label': `Estado: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label);
    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      statusMenu(statusBtn, t);
    });
    const sub = [
      !scoped && (projectName(t.projectId) || 'Sin proyecto'),
      subTotal && `${subDone}/${subTotal} subtareas`,
      checks.length && `${checks.filter((c) => c.done).length}/${checks.length} pasos`,
      blockersOf(t).length && t.status !== 'done' && 'Bloqueada',
    ].filter(Boolean).join(' · ');
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
      el('span', { class: 'ng-row-main' }, el('b', {}, el('span', { class: 'ng-tkey', text: taskKey(t) }), titleOf(t)), sub && el('small', { text: sub })),
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

  const subsBtn = el('button', {
    type: 'button',
    class: 'ng-fchip',
    'aria-pressed': String(showSubs),
    title: 'Ver también las subtareas como tarjetas',
    onclick: () => {
      showSubs = !showSubs;
      subsBtn.setAttribute('aria-pressed', String(showSubs));
      savePref('ng-task-subs', showSubs ? 'si' : 'no');
      draw();
    },
  }, icon('subtasks'), 'Subtareas');

  const node = el('section', { class: `ng-card ng-tasks is-${view}` },
    el('header', { class: 'ng-card-head' },
      progress,
      el('div', { class: 'ng-filters' },
        projectSel,
        select([['all', 'Cualquier prioridad'], ['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja'], ['none', 'Sin prioridad']], priority, { 'aria-label': 'Prioridad', onchange: (e) => { priority = e.target.value; draw(); } }),
        searchBox((v) => { q = v; draw(); }, 'Buscar por clave o título…'),
        subsBtn,
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
const LINK_KINDS = [
  ['blocks', 'Bloquea a…', 'ban'],
  ['blockedBy', 'Bloqueada por…', 'lock'],
  ['related', 'Relacionada con…', 'link'],
  ['duplicate', 'Duplicado de…', 'copy'],
];

export function openTask(id, { isNew = false } = {}) {
  const task = find('tasks', id);
  if (!task) return null;
  task.checklist ||= [];
  task.comments ||= [];
  task.links ||= [];
  task.refs ||= [];
  const save = () => put('tasks', task);
  const top = el('header', { class: 'ng-sheet-head' });
  const body = el('div', { class: 'ng-sheet-body' });
  const coverBox = el('div', { class: 'ng-tsheet-cover-slot' });
  const blockedBox = el('div', { class: 'ng-blocked-slot' });
  const subtasksBox = el('section', { class: 'ng-sheet-sec' });
  const linksBox = el('section', { class: 'ng-sheet-sec' });
  const checklistBox = el('section', { class: 'ng-sheet-sec' });
  const hoursBox = el('section', { class: 'ng-sheet-sec' });
  const commentsBox = el('section', { class: 'ng-sheet-sec' });
  const dlg = el('dialog', { class: 'ng-dialog is-sheet', 'aria-label': `Tarea ${taskKey(task)}` }, top, body);

  /** Otra tarea en la misma ficha: se cierra esta y se abre aquella. */
  const switchTo = (other) => {
    if (!other) return;
    dlg.close();
    openTask(other.id);
  };

  const setCover = (cover) => {
    task.cover = cover;
    save();
    drawCover();
    drawTop();
  };

  function drawTop() {
    const [label, color] = TASK_STATUS[task.status] || TASK_STATUS.todo;
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg', style: { '--c': color }, 'aria-label': `Estado: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label, icon('down'));
    statusBtn.addEventListener('click', () => statusMenu(statusBtn, task, () => { drawTop(); drawBlocked(); }));
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
    const parent = parentOf(task);
    const live = runningEntry()?.taskId === task.id;
    const timerBtn = el('button', {
      type: 'button',
      class: `ng-ibtn${live ? ' is-live' : ''}`,
      'aria-label': live ? 'Parar el temporizador' : 'Cronometrar esta tarea',
      title: live ? 'Parar el temporizador' : 'Cronometrar esta tarea',
      onclick: () => (live ? stopTimer() : startTimer({ projectId: task.projectId, taskId: task.id })),
    }, icon(live ? 'stop' : 'play'));
    const coverBtn = iconButton('image', task.cover ? 'Cambiar portada' : 'Añadir portada', () => coverMenu(coverBtn, setCover, { hasCover: Boolean(task.cover) }));
    const more = iconButton('more', 'Más acciones', () => menu(more, [
      { label: 'Copiar clave', note: taskKey(task), icon: 'hash', run: () => copyKey(task) },
      { label: 'Duplicar', icon: 'copy', run: duplicate },
      { label: 'Añadir subtarea', icon: 'subtasks', run: () => subtasksBox.querySelector('.ng-check-add input')?.focus() },
      '-',
      { label: 'Eliminar tarea', icon: 'trash', danger: true, run: destroy },
    ], { align: 'end' }));
    top.replaceChildren(...[
      parent && el('button', { type: 'button', class: 'ng-chipbtn is-lg is-plain ng-crumb', title: `Volver a ${titleOf(parent)}`, onclick: () => switchTo(parent) }, icon('back'), el('span', { text: taskKey(parent) })),
      el('button', { type: 'button', class: 'ng-keybtn', title: 'Copiar la clave', text: taskKey(task), onclick: () => copyKey(task) }),
      statusBtn,
      projectBtn,
      el('span', { class: 'ng-grow' }),
      coverBtn,
      timerBtn,
      more,
      iconButton('x', 'Cerrar', () => dlg.close()),
    ].filter(Boolean));
  }

  function drawCover() {
    if (!task.cover) {
      coverBox.replaceChildren();
      return;
    }
    const change = el('button', { type: 'button', class: 'pill ghost sm' }, icon('image'), 'Cambiar');
    change.addEventListener('click', () => coverMenu(change, setCover, { hasCover: true }));
    coverBox.replaceChildren(el('div', { class: 'ng-tsheet-cover' }, coverNode(task.cover), el('div', { class: 'ng-tsheet-cover-tools' }, change)));
  }

  /** Al cambiar de proyecto, sus subtareas y sus horas sin facturar se van con ella. */
  function moveTo(projectId) {
    const before = taskKey(task);
    moveTask(task, projectId);
    if (before !== taskKey(task)) toast(`Ahora es ${taskKey(task)}. Los enlaces a ${before} siguen funcionando.`);
    drawTop();
    drawBody();
  }

  function drawBlocked() {
    const blockers = blockersOf(task);
    blockedBox.replaceChildren(...(blockers.length && task.status !== 'done'
      ? [el('div', { class: 'ng-blocked' }, icon('ban'), el('span', { text: blockers.length === 1 ? 'Bloqueada por' : 'Bloqueada por estas tareas:' }), blockers.map((b) => taskChip(b)))]
      : []));
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
    const desc = richArea({
      value: task.description || '',
      placeholder: 'Detalles, enlaces… Escribe la clave de otra tarea (CF-12) o [[ para enlazar una página.',
      label: 'Descripción',
      rows: 3,
      onInput: (v) => {
        task.description = v;
        save();
      },
    });
    body.replaceChildren(
      coverBox,
      blockedBox,
      title,
      el('div', { class: 'ng-form' },
        el('div', { class: 'ng-field' }, el('span', { text: 'Prioridad' }), seg(PRIORITY_OPTIONS, task.priority || '', (v) => { task.priority = v; save(); }, 'Prioridad')),
        el('div', { class: 'ng-grid2' }, field('Empieza', dateBox('startDate', 'Empieza')), field('Entrega', dateBox('dueDate', 'Entrega'))),
        el('div', { class: 'ng-grid2' },
          field(`Valor fijo (${cur})`, value, 'Si tiene precio cerrado. Sus horas se cuentan, pero no se cobran aparte.'),
          field(`Tarifa por hora (${cur})`, rate, `Vacía, vale la ${task.projectId ? 'del proyecto' : 'general'}: ${money(inherited, cur)}.`),
        ),
        el('div', { class: 'ng-field' }, el('span', { text: 'Descripción' }), desc),
      ),
      subtasksBox,
      linksBox,
      checklistBox,
      hoursBox,
      commentsBox,
    );
    drawCover();
    drawBlocked();
    drawSubtasks();
    drawLinks();
    drawChecklist();
    drawHours();
    drawComments();
  }

  function secHead(text, note, ...extra) {
    return el('div', { class: 'ng-sheet-sec-head' }, el('h3', { text }), note && el('small', { text: note }), el('span', { class: 'ng-grow' }), extra);
  }

  function drawSubtasks() {
    const subs = subtasksOf(task.id).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.num || 0) - (b.num || 0));
    const done = subs.filter((s) => s.status === 'done').length;
    const add = input({ placeholder: 'Añadir una subtarea y Enter', maxLength: 300, 'aria-label': 'Nueva subtarea' });
    add.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const text = add.value.trim();
      if (!text) return;
      const sub = newTask({ projectId: task.projectId, parentId: task.id, status: 'todo' });
      sub.title = text;
      sub.priority = task.priority || '';
      put('tasks', sub);
      drawSubtasks();
      subtasksBox.querySelector('.ng-check-add input')?.focus();
    });
    subtasksBox.replaceChildren(...[
      secHead('Subtareas', subs.length ? `${done}/${subs.length}` : ''),
      subs.length > 0 && el('span', { class: 'ng-bar is-wide is-ok' }, el('i', { style: { width: `${(done / subs.length) * 100}%` } })),
      subs.length > 0 && el('ul', { class: 'ng-subs' }, subs.map((s) => {
        const [label, color] = TASK_STATUS[s.status] || TASK_STATUS.todo;
        const [d, n] = subsDone(s);
        return el('li', { class: s.status === 'done' ? 'is-done' : '' },
          checkButton(s, drawSubtasks),
          el('button', { type: 'button', class: 'ng-sub-open', onclick: () => switchTo(s) },
            el('span', { class: 'ng-tkey', text: taskKey(s) }),
            el('span', { class: 'ng-sub-title', text: titleOf(s) }),
            n > 0 && el('small', { text: `${d}/${n}` }),
          ),
          el('span', { class: 'ng-tag', style: { '--c': color }, text: label }),
        );
      })),
      el('label', { class: 'ng-check-add' }, icon('plus'), add),
    ].filter(Boolean));
  }

  function pickTask(kind, anchor) {
    linkPicker(anchor, (x) => {
      addRelation(task, kind, x.item);
      drawLinks();
      drawBlocked();
    }, { only: 'task' });
  }

  function addRef(kind, ref, title = '') {
    if (task.refs.some((r) => r.kind === kind && r.ref === ref)) return;
    task.refs = [...task.refs, { id: uid(), kind, ref, title }];
    save();
    drawLinks();
  }

  function urlForm() {
    const url = input({ type: 'url', required: true, maxLength: 500, placeholder: 'https://…' });
    const title = input({ maxLength: 120, placeholder: 'Opcional' });
    dialog({
      title: 'Enlace web',
      submit: 'Añadir',
      body: el('div', { class: 'ng-form' }, field('Dirección', url), field('Nombre', title, 'Si lo dejas vacío se ve el dominio.')),
      onSubmit: () => {
        const u = url.value.trim();
        if (!/^https?:\/\/\S+$/i.test(u)) {
          toast('La dirección tiene que empezar por https://', 'error');
          return false;
        }
        addRef('url', u, title.value.trim());
        return true;
      },
    });
  }

  function drawLinks() {
    const rels = relationsOf(task);
    const refs = task.refs.map((r) => {
      const target = r.kind === 'page' ? find('pages', r.ref) : r.kind === 'doc' ? find('docs', r.ref) : null;
      const node = r.kind === 'url' ? urlChip(r.ref, r.title) : target && (r.kind === 'page' ? pageChip(target) : docChip(target));
      return node && [r, node];
    }).filter(Boolean);
    const named = backlinks('task', task.id).filter((b) => !rels.some((r) => r.other.id === b.item.id));
    const addBtn = el('button', { type: 'button', class: 'pill ghost sm' }, icon('plus'), 'Enlazar', icon('down'));
    addBtn.addEventListener('click', () => menu(addBtn, [
      ...LINK_KINDS.map(([kind, label, ico]) => ({ label, icon: ico, run: () => pickTask(kind, addBtn) })),
      '-',
      { label: 'Una página…', icon: 'page', run: () => linkPicker(addBtn, (x) => addRef('page', x.item.id), { only: 'page' }) },
      { label: 'Un documento…', icon: 'file', run: () => linkPicker(addBtn, (x) => addRef('doc', x.item.id), { only: 'doc' }) },
      { label: 'Un enlace web…', icon: 'globe', run: urlForm },
    ], { align: 'end' }));
    const total = rels.length + refs.length;
    linksBox.replaceChildren(...[
      secHead('Enlaces', total ? String(total) : '', addBtn),
      total > 0 && el('ul', { class: 'ng-links' },
        rels.map((r) => el('li', {},
          el('small', { class: 'ng-link-kind', style: { '--c': r.color }, text: r.label }),
          taskChip(r.other),
          iconButton('x', 'Quitar la relación', () => { removeRelation(r.owner, r.link.id); drawLinks(); drawBlocked(); }, 'is-sm'),
        )),
        refs.map(([r, node]) => el('li', {},
          el('small', { class: 'ng-link-kind', text: r.kind === 'page' ? 'Página' : r.kind === 'doc' ? 'Documento' : 'Web' }),
          node,
          iconButton('x', 'Quitar el enlace', () => { task.refs = task.refs.filter((x) => x.id !== r.id); save(); drawLinks(); }, 'is-sm'),
        )),
      ),
      named.length > 0 && el('div', { class: 'ng-backlinks' },
        el('small', { text: 'La mencionan' }),
        el('div', {}, named.map((b) => (b.kind === 'page' ? pageChip(b.item) : taskChip(b.item)))),
      ),
      !total && !named.length && el('p', { class: 'ng-hint', text: 'Relaciónala con otras tareas o enlaza una página, un documento o una web.' }),
    ].filter(Boolean));
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
        iconButton('subtasks', 'Convertir en subtarea', () => {
          const sub = newTask({ projectId: task.projectId, parentId: task.id, status: item.done ? 'done' : 'todo' });
          sub.title = item.text;
          put('tasks', sub);
          task.checklist = items.filter((x) => x !== item);
          save();
          drawChecklist();
          drawSubtasks();
          toast(`Ahora es la subtarea ${taskKey(sub)}.`);
        }, 'is-sm'),
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
    const text = linkable(autosize(el('textarea', { rows: 2, placeholder: 'Escribe un comentario… (CF-12 o [[ para enlazar)', maxLength: 4000, 'aria-label': 'Comentario' })));
    const send = () => {
      const v = text.value.trim();
      if (!v) return;
      list.push({ id: uid(), text: v, at: nowISO() });
      save();
      drawComments();
      drawLinks();
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
        el('p', {}, richText(c.text)),
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
    const copy = { ...structuredClone(task), id: uid(), num: nextNum(task.projectId), title: `${titleOf(task)} (copia)`, comments: [], links: [], oldKeys: [], invoiceId: '', order: nextOrder(task.status) };
    copy.checklist = copy.checklist.map((c) => ({ ...c, id: uid() }));
    delete copy.createdAt;
    delete copy.updatedAt;
    put('tasks', copy);
    dlg.close();
    openTask(copy.id);
    toast(`Tarea duplicada: ${taskKey(copy)}.`);
  }

  async function destroy() {
    const hours = familyOf(task).reduce((s, t) => s + taskEntries(t.id).length, 0);
    const subs = familyOf(task).length - 1;
    const extra = [subs && (subs === 1 ? 'También se borra su subtarea.' : `También se borran sus ${subs} subtareas.`), hours && 'Sus horas se quedan en el proyecto, sin tarea.'].filter(Boolean).join(' ');
    const yes = await confirmBox(`¿Eliminar ${taskKey(task)} «${titleOf(task)}»?${extra ? ` ${extra}` : ''}`);
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
    const empty = !task.title.trim() && !task.description?.trim() && !task.checklist.length && !task.comments.length && !taskEntries(task.id).length && !subtasksOf(task.id).length;
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

/** Abre una tarea por su clave (CF-12), si existe. */
export function openTaskByKey(key) {
  const t = findTaskByKey(key);
  if (t) openTask(t.id);
  return t;
}

// Cualquier enlace a una tarea (en páginas, comentarios…) abre su ficha.
bus.addEventListener('open-task', (e) => {
  for (const d of document.querySelectorAll('dialog.is-sheet[open]')) d.close();
  openTask(e.detail.id);
});

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
    const blocked = all.filter((t) => t.status !== 'done' && blockersOf(t).length).length;
    kpis.replaceChildren(
      kpi({ label: 'Por hacer', value: String(count('request', 'todo')), ico: 'tasks', sub: waiting ? lateText(waiting) : blocked ? `${blocked} ${blocked === 1 ? 'bloqueada' : 'bloqueadas'}` : `${count('request')} ${count('request') === 1 ? 'solicitud' : 'solicitudes'}`, tone: waiting ? 'var(--expense)' : null }),
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
    head('Tareas', 'Todo lo que hay que hacer, en todos los proyectos. Cada tarea tiene su clave: escríbela en otra tarea o en una página para enlazarlas.',
      el('button', { type: 'button', class: 'pill', onclick: () => createTask() }, icon('plus'), 'Nueva tarea')),
    kpis,
    board.node,
  );
  drawKpis();
  return { node, refresh };
}
