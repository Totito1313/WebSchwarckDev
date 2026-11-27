// Tareas: tablero (Solicitud, Por hacer, En curso, Revisión, Hecho) o lista, de
// todos los proyectos o de uno. Cada tarea tiene su clave (WEB-12) y se abre en un
// panel con estado, prioridad, fechas, valor o tarifa, checklist, comentarios,
// subtareas y el temporizador. Las reglas son las de negocio-work.js.
//
// En las dos vistas, el clic derecho (o «⋮») abre el mismo menú de la tarea y se
// pueden marcar varias para cambiarlas a la vez desde la barra de acciones: en la
// lista, con sus casillas; en el tablero, con Ctrl/⌘ + clic o el círculo de la
// esquina de cada tarjeta.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckDouble,
  CircleCheck,
  CircleDashed,
  CirclePlay,
  Comment,
  Copy,
  Envelope,
  Eye,
  Flag,
  Folder,
  LayoutColumns,
  Link as LinkIcon,
  ListUl,
  Play,
  Plus,
  Stop,
  TrashBin,
} from '@gravity-ui/icons';
import { Button, Chip, Dropdown, Label, SearchField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { addDays, durationText, find, money, put, shortDate, todayISO, uid } from '../../../negocio-core.js';
import {
  PRIORITY,
  TASK_ORDER,
  TASK_STATUS,
  findTaskByKey,
  moveTask,
  newTask,
  projectName,
  removeTask,
  runningEntry,
  setTaskStatus,
  startTimer,
  stopTimer,
  subtasksOf,
  taskCurrency,
  taskKey,
  taskMinutes,
  taskValue,
} from '../../../negocio-work.js';
import { Empty, PageHeader } from '../../kit/parts.jsx';
import { copyText } from '../../kit/csv.js';
import { go, routeQuery, useCrm } from '../store.js';
import { ConfirmDialog, SelectField } from '../fields.jsx';
import { ActionBar, DataGrid, Kanban, KanbanCard } from '../../pro/index.js';
import { Tarea } from './Tarea.jsx';

const COLOR = { request: 'accent', todo: 'default', doing: 'accent', review: 'warning', done: 'success' };
const PRIO_COLOR = { low: 'default', medium: 'warning', high: 'danger' };
const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const titleOf = (t) => t.title?.trim() || 'Sin título';

function StatusMenu({ task, trigger }) {
  return (
    <Dropdown>
      {trigger}
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label="Mover a"
          selectionMode="single"
          selectedKeys={new Set([task.status])}
          onAction={(k) => {
            setTaskStatus(task, String(k));
            put('tasks', task);
          }}
        >
          {TASK_ORDER.map((s) => (
            <Dropdown.Item key={s} id={s} textValue={TASK_STATUS[s][0]}>
              <Label>{TASK_STATUS[s][0]}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const STATUS_ICON = { request: Envelope, todo: CircleDashed, doing: CirclePlay, review: Eye, done: CircleCheck };
const colorVar = (c) => (c && c !== 'default' ? `var(--${c})` : 'var(--muted)');
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);
const PRIO_RANK = { high: 3, medium: 2, low: 1 };
// Los colores del tema (los de PRIORITY son de la versión vieja y aquí no existen).
const PRIO_DOT = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--accent)' };

/* ── El menú de una tarea (clic derecho, «⋮») y lo que se hace con varias ── */

const statusItems = (current) => TASK_ORDER.map((st) => ({ id: `status:${st}`, label: TASK_STATUS[st][0], dot: colorVar(COLOR[st]), checked: current === st }));
const prioItems = (current) => [
  ...Object.entries(PRIORITY)
    .reverse()
    .map(([k, [label]]) => ({ id: `prio:${k}`, label, dot: PRIO_DOT[k], checked: current === k })),
  '-',
  { id: 'prio:', label: 'Sin prioridad', dot: 'var(--default)', checked: current === '' },
];
const projectItems = (projects, current) => [
  ...projects.map((p) => ({ id: `project:${p.id}`, label: p.name || 'Sin nombre', checked: current === p.id })),
  '-',
  { id: 'project:', label: 'Sin proyecto', checked: current === '' },
];
const dueItems = (hasDue) => [
  { id: 'due:today', label: 'Hoy' },
  { id: 'due:tomorrow', label: 'Mañana' },
  { id: 'due:week', label: 'En una semana' },
  '-',
  { id: 'due:', label: 'Sin fecha', isDisabled: !hasDue },
];

/** board: en el tablero «Abrir» y «Mover a» ya los pone el propio tablero. */
function taskMenu(t, projects, { board = false } = {}) {
  const timing = runningEntry()?.taskId === t.id;
  return [
    ...(board ? [] : [{ id: 'open', label: 'Abrir' }]),
    { id: timing ? 'timer:stop' : 'timer:start', label: timing ? 'Detener el cronómetro' : 'Cronometrar', icon: timing ? Stop : Play },
    '-',
    ...(board ? [] : [{ id: 'status', label: 'Mover a', icon: ArrowRight, items: statusItems(t.status) }]),
    { id: 'prio', label: 'Prioridad', icon: Flag, items: prioItems(t.priority || '') },
    { id: 'project', label: 'Proyecto', icon: Folder, items: projectItems(projects, t.projectId || '') },
    { id: 'due', label: 'Vence', icon: Calendar, items: dueItems(Boolean(t.dueDate)) },
    '-',
    { id: 'dup', label: 'Duplicar', icon: Copy },
    { id: 'link', label: 'Copiar enlace', icon: LinkIcon },
    '-',
    { id: 'delete', label: 'Eliminar', icon: TrashBin, danger: true },
  ];
}

/** Las acciones de la barra cuando hay varias marcadas. */
const bulkActions = (projects) => [
  { id: 'status:done', label: 'Hechas', icon: CircleCheck },
  { id: 'status', label: 'Mover a', icon: ArrowRight, items: statusItems('') },
  { id: 'prio', label: 'Prioridad', icon: Flag, items: prioItems(null) },
  { id: 'project', label: 'Proyecto', icon: Folder, items: projectItems(projects, null) },
  { id: 'due', label: 'Vence', icon: Calendar, items: dueItems(true) },
  { id: 'dup', label: 'Duplicar', icon: Copy },
  { id: 'delete', label: 'Eliminar', icon: TrashBin, danger: true },
];

const many = (n, one, more) => (n === 1 ? one : more);

/** Hace la acción del menú (o de la barra) sobre una o varias tareas. Eliminar se confirma aparte. */
function runTaskAction(id, list, { askDelete }) {
  const at = id.indexOf(':');
  const kind = at < 0 ? id : id.slice(0, at);
  const value = at < 0 ? '' : id.slice(at + 1);
  const n = list.length;
  const first = list[0];
  if (!first) return;
  switch (kind) {
    case 'open':
      go(`#/tareas/${first.id}`);
      break;
    case 'timer':
      if (value === 'stop') stopTimer();
      else {
        startTimer({ projectId: first.projectId || '', taskId: first.id });
        toast.success(`Cronometrando ${taskKey(first) || titleOf(first)}`);
      }
      break;
    case 'status':
      for (const t of list) {
        setTaskStatus(t, value);
        put('tasks', t);
      }
      toast(`${n === 1 ? taskKey(first) || titleOf(first) : `${n} tareas`} → ${TASK_STATUS[value]?.[0]}`);
      break;
    case 'prio':
      for (const t of list) put('tasks', { ...t, priority: value });
      toast(value ? `Prioridad ${PRIORITY[value][0].toLowerCase()}` : 'Sin prioridad');
      break;
    case 'project':
      for (const t of list) moveTask(t, value);
      toast(`${n} ${many(n, 'tarea', 'tareas')} → ${value ? projectName(value) : 'sin proyecto'}`);
      break;
    case 'due': {
      const today = todayISO();
      const date = value === 'today' ? today : value === 'tomorrow' ? addDays(today, 1) : value === 'week' ? addDays(today, 7) : '';
      for (const t of list) put('tasks', { ...t, dueDate: date });
      toast(date ? `Vence el ${shortDate(date)}` : 'Sin fecha');
      break;
    }
    case 'dup':
      for (const t of list) {
        const copy = {
          ...newTask({ projectId: t.projectId || '', status: t.status === 'done' ? 'todo' : t.status }),
          title: `${titleOf(t)} (copia)`,
          description: t.description || '',
          priority: t.priority || '',
          dueDate: t.dueDate || '',
          value: t.value || 0,
          checklist: (t.checklist || []).map((c) => ({ ...c, id: uid(), done: false })),
        };
        put('tasks', copy);
      }
      toast.success(n === 1 ? 'Tarea duplicada' : `${n} tareas duplicadas`);
      break;
    case 'link':
      copyText(`${location.origin}${location.pathname}#/tareas/${first.id}`).then(() => toast.success('Enlace copiado'));
      break;
    case 'delete':
      askDelete(list);
      break;
    default:
  }
}

/** Tarjeta del tablero: clave y proyecto, título, prioridad y fecha, avance del checklist y contadores. */
function BoardCard({ t }) {
  const subs = subtasksOf(t.id);
  const checks = t.checklist || [];
  const tags = [];
  if (t.priority) tags.push({ label: PRIORITY[t.priority]?.[0], color: PRIO_COLOR[t.priority] });
  if (t.dueDate) tags.push({ label: shortDate(t.dueDate), color: t.status !== 'done' && t.dueDate < todayISO() ? 'danger' : 'default' });
  const meta = [];
  if ((t.comments || []).length) meta.push({ icon: Comment, value: t.comments.length, label: 'comentarios' });
  if (subs.length) meta.push({ icon: ListUl, value: subs.length, label: 'subtareas' });
  return (
    <KanbanCard
      title={<span className={t.status === 'done' ? 'text-muted line-through' : ''}>{titleOf(t)}</span>}
      description={[taskKey(t), t.projectId ? projectName(t.projectId) : ''].filter(Boolean).join(' · ')}
      tags={tags.filter((x) => x.label)}
      progress={checks.length ? checks.filter((c) => c.done).length / checks.length : undefined}
      meta={meta}
    />
  );
}

/** Tablero: se arrastra una tarea para cambiarla de estado o de sitio en su columna. */
function Board({ tasks, onAdd, projects, selected, onToggleSelect, onAction }) {
  const sorted = [...tasks].sort(byOrder);
  const move = (key, status, index) => {
    const task = find('tasks', key);
    if (!task) return;
    const before = task.status;
    setTaskStatus(task, status);
    // Orden nuevo de la columna de destino: se numera de 10 en 10.
    const col = sorted.filter((t) => t.status === status && t.id !== key);
    col.splice(Math.min(index, col.length), 0, task);
    col.forEach((t, i) => {
      const order = (i + 1) * 10;
      if (t.id === key) task.order = order;
      else if (Number(t.order) !== order) put('tasks', { ...t, order });
    });
    put('tasks', task);
    if (before !== status) toast(`${taskKey(task)} → ${TASK_STATUS[status][0]}`);
  };
  return (
    <Kanban
      label="Tablero de tareas"
      columns={TASK_ORDER.map((s) => ({ id: s, title: TASK_STATUS[s][0], icon: STATUS_ICON[s], color: colorVar(COLOR[s]) }))}
      items={sorted}
      getColumn={(t) => t.status}
      onMove={move}
      onOpen={(t) => go(`#/tareas/${t.id}`)}
      moveAsSubmenu
      cardMenu={(t) => taskMenu(t, projects, { board: true })}
      onCardMenu={(id, t) => onAction(id, [t])}
      selected={selected}
      onToggleSelect={onToggleSelect}
      columnWidth={280}
      renderCard={(t) => <BoardCard t={t} />}
      columnFooter={(c) => (
        <Button size="sm" variant="ghost" className="w-full justify-start text-muted" onPress={() => onAdd(c.id)}>
          <Plus className="size-4" />
          Nueva tarea
        </Button>
      )}
    />
  );
}

function List({ tasks, projects, onAction }) {
  return (
    <DataGrid
      label="Tareas"
      rows={tasks}
      minWidth={760}
      onRowAction={(t) => go(`#/tareas/${t.id}`)}
      rowMenu={(t) => taskMenu(t, projects)}
      onRowMenu={(id, t) => onAction(id, [t])}
      bulkActions={bulkActions(projects)}
      onBulkAction={(id, rows, clear) => onAction(id, rows, clear)}
      filters={[
        { id: 'status', label: 'Estado', options: TASK_ORDER.map((st) => [st, TASK_STATUS[st][0]]), match: (t, v) => t.status === v },
        { id: 'prio', label: 'Prioridad', options: [...Object.entries(PRIORITY).reverse().map(([k, [label]]) => [k, label]), ['_none', 'Sin prioridad']], match: (t, v) => (v === '_none' ? !t.priority : t.priority === v) },
      ]}
      empty={<p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">Ninguna tarea coincide.</p>}
      columns={[
        {
          id: 'title',
          name: 'Tarea',
          isRowHeader: true,
          sortValue: (t) => titleOf(t).toLowerCase(),
          render: (t) => {
            const checks = t.checklist || [];
            const subs = subtasksOf(t.id).length;
            return (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">
                  <span className="font-mono text-xs text-muted">{taskKey(t)}</span> <span className={t.status === 'done' ? 'text-muted line-through' : 'font-medium'}>{titleOf(t)}</span>
                </span>
                {(checks.length > 0 || subs > 0) && (
                  <span className="text-xs text-muted">
                    {[checks.length && `${checks.filter((c) => c.done).length}/${checks.length} del checklist`, subs && `${subs} ${many(subs, 'subtarea', 'subtareas')}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            );
          },
        },
        {
          id: 'status',
          name: 'Estado',
          sortValue: (t) => TASK_ORDER.indexOf(t.status),
          render: (t) => (
            <Chip size="sm" variant="soft" color={COLOR[t.status]}>
              {TASK_STATUS[t.status]?.[0]}
            </Chip>
          ),
        },
        {
          id: 'priority',
          name: 'Prioridad',
          sortValue: (t) => PRIO_RANK[t.priority] || 0,
          render: (t) =>
            t.priority ? (
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: PRIO_DOT[t.priority] }} aria-hidden />
                {PRIORITY[t.priority]?.[0]}
              </span>
            ) : (
              <span className="text-muted">—</span>
            ),
        },
        { id: 'project', name: 'Proyecto', hideable: true, sortValue: (t) => projectName(t.projectId), render: (t) => <span className="text-muted">{projectName(t.projectId) || '—'}</span> },
        {
          id: 'due',
          name: 'Vence',
          hideable: true,
          sortValue: (t) => t.dueDate || '9999',
          render: (t) => <span className={t.dueDate && t.status !== 'done' && t.dueDate < todayISO() ? 'font-medium text-danger' : 'text-muted'}>{shortDate(t.dueDate) || '—'}</span>,
        },
        { id: 'hours', name: 'Horas', align: 'end', hideable: true, sortValue: (t) => taskMinutes(t.id), render: (t) => durationText(taskMinutes(t.id)) },
        { id: 'value', name: 'Valor', align: 'end', hideable: true, hidden: true, sortValue: (t) => taskValue(t), render: (t) => (taskValue(t) ? money(taskValue(t), taskCurrency(t)) : '—') },
      ]}
    />
  );
}

/** La ficha de la tarea. Cada cambio se guarda solo. */
export function Tareas({ open }) {
  const [state, v] = useCrm();
  const q0 = routeQuery();
  const [project, setProject] = useState(q0.get('p') || 'all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('negocio-tareas-vista') || 'board');
  const [hideDone, setHideDone] = useState(false);
  const [picked, setPicked] = useState(() => new Set()); // tarjetas marcadas en el tablero
  const [deleting, setDeleting] = useState(null); // { list, done? }

  // #/tareas/nueva crea una tarea (en el proyecto de ?p= si viene) y la abre.
  const made = useRef(false);
  useEffect(() => {
    if (open !== 'nueva') {
      made.current = false;
      return;
    }
    if (made.current) return;
    made.current = true;
    const t = newTask({ projectId: routeQuery().get('p') || '' });
    put('tasks', t);
    go(`#/tareas/${t.id}`);
  }, [open]);
  const openTask = open && open !== 'nueva' ? find('tasks', open) || findTaskByKey(open) : null;

  const tasks = useMemo(() => {
    const t = plain(query.trim());
    return state.tasks.filter(
      (k) =>
        !k.parentId &&
        (project === 'all' || (project === '_none' ? !k.projectId : k.projectId === project)) &&
        (!hideDone || k.status !== 'done') &&
        (!t || plain(`${taskKey(k)} ${k.title} ${k.description}`).includes(t)),
    );
  }, [state, v, project, query, hideDone]);

  // Al cambiar de filtro o de vista, lo marcado se suelta (ya no se vería).
  useEffect(() => setPicked(new Set()), [project, query, hideDone, view]);

  // Una tarea abierta ocupa la página entera (ya no es un panel lateral).
  if (openTask) return <Tarea key={openTask.id} id={openTask.id} backTo={project !== 'all' ? `#/tareas?p=${project}` : '#/tareas'} />;

  const add = (status) => {
    const t = newTask({ projectId: project !== 'all' && project !== '_none' ? project : '', status });
    put('tasks', t);
    go(`#/tareas/${t.id}`);
  };
  const pending = state.tasks.filter((k) => k.status !== 'done').length;
  const projects = state.projects;
  const toggle = (key) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const clearPicked = () => setPicked(new Set());
  const act = (id, list, done = clearPicked) => {
    runTaskAction(id, list, { askDelete: (rows) => setDeleting({ list: rows, done }) });
    // Lo que cambia las tareas suelta la selección; abrir, cronometrar o copiar, no.
    if (!/^(open|timer|link|delete)/.test(id)) done?.();
  };
  const pickedTasks = tasks.filter((t) => picked.has(t.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Trabajo"
        title="Tareas"
        description={`${pending} sin terminar en todos los proyectos`}
        actions={
          <Button onPress={() => add('todo')}>
            <Plus />
            Nueva tarea
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          ariaLabel="Proyecto"
          value={project}
          onChange={setProject}
          className="w-full sm:w-64"
          options={[['all', 'Todos los proyectos'], ['_none', 'Sin proyecto'], ...state.projects.map((p) => [p.id, p.name || 'Sin nombre'])]}
        />
        <SearchField aria-label="Buscar tareas" value={query} onChange={setQuery} className="w-full sm:w-64">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Clave o título…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <span className="flex-1" />
        <ToggleButton size="sm" isSelected={hideDone} onChange={setHideDone}>
          Ocultar hechas
        </ToggleButton>
        <ToggleButtonGroup
          aria-label="Vista"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([view])}
          onSelectionChange={(keys) => {
            const [k] = keys;
            setView(String(k));
            localStorage.setItem('negocio-tareas-vista', String(k));
          }}
        >
          <ToggleButton id="board" aria-label="Tablero">
            <LayoutColumns />
            Tablero
          </ToggleButton>
          <ToggleButton id="list" aria-label="Lista">
            <ToggleButtonGroup.Separator />
            <ListUl />
            Lista
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      {state.tasks.length === 0 ? (
        <Empty title="Todavía no hay tareas" text="Cada tarea tiene su clave dentro del proyecto (WEB-12), su estado, sus horas y su checklist." action={<Button onPress={() => add('todo')}>Nueva tarea</Button>} />
      ) : view === 'board' ? (
        <>
          <Board tasks={tasks} onAdd={add} projects={projects} selected={picked} onToggleSelect={toggle} onAction={(id, list) => act(id, list, () => {})} />
          {picked.size === 0 && tasks.length > 0 && (
            <p className="-mt-3 text-xs text-muted">
              <span className="pointer-coarse:hidden">Ctrl o ⌘ + clic marca varias tarjetas para cambiarlas a la vez; clic derecho, para el menú de una.</span>
              <span className="hidden pointer-coarse:inline">Mantén pulsada una tarjeta para moverla; en «⋮» › Seleccionar marcas varias para cambiarlas a la vez.</span>
            </p>
          )}
          <ActionBar
            count={pickedTasks.length}
            label={many(pickedTasks.length, 'tarea marcada', 'tareas marcadas')}
            actions={[...(pickedTasks.length < tasks.length ? [{ id: 'all', label: 'Todas', icon: CheckDouble }] : []), ...bulkActions(projects)]}
            onClear={clearPicked}
            onAction={(id) => (id === 'all' ? setPicked(new Set(tasks.map((t) => t.id))) : act(id, pickedTasks))}
          />
        </>
      ) : (
        <List tasks={tasks} projects={projects} onAction={act} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting?.list.length === 1 ? `¿Eliminar «${titleOf(deleting.list[0])}»?` : `¿Eliminar ${deleting?.list.length || 0} tareas?`}
        text="Con sus subtareas. Las horas registradas se quedan, sin tarea."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          for (const t of deleting.list) if (find('tasks', t.id)) removeTask(t);
          toast(deleting.list.length === 1 ? 'Tarea eliminada' : `${deleting.list.length} tareas eliminadas`);
          deleting.done?.();
          setDeleting(null);
        }}
      />
    </div>
  );
}
