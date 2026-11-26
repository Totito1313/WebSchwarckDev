// Tareas: tablero (Solicitud, Por hacer, En curso, Revisión, Hecho) o lista, de
// todos los proyectos o de uno. Cada tarea tiene su clave (WEB-12) y se abre en un
// panel con estado, prioridad, fechas, valor o tarifa, checklist, comentarios,
// subtareas y el temporizador. Las reglas son las de negocio-work.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CircleCheck, CircleDashed, CirclePlay, Comment, EllipsisVertical, Envelope, Eye, LayoutColumns, ListUl, Play, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  Drawer,
  Dropdown,
  Form,
  Input,
  Label,
  SearchField,
  Separator,
  Table,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from '@heroui/react';
import { durationText, find, money, nowISO, put, shortDate, todayISO, uid } from '../../../negocio-core.js';
import {
  PRIORITY,
  TASK_ORDER,
  TASK_STATUS,
  findTaskByKey,
  isFixed,
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
import { useOpenAfterGesture } from '../../kit/hooks.js';
import { go, routeQuery, useCrm } from '../store.js';
import { AmountField, ConfirmButton, DateInput, SelectField } from '../fields.jsx';
import { Kanban, KanbanCard } from '../../pro/index.js';
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
function Board({ tasks, onAdd }) {
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

function List({ tasks }) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Tareas" className="min-w-[720px]" onRowAction={(id) => go(`#/tareas/${id}`)}>
          <Table.Header>
            <Table.Column isRowHeader>Tarea</Table.Column>
            <Table.Column>Estado</Table.Column>
            <Table.Column>Prioridad</Table.Column>
            <Table.Column>Proyecto</Table.Column>
            <Table.Column>Vence</Table.Column>
            <Table.Column className="text-end">Horas</Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="p-6 text-center text-sm text-muted">Ninguna tarea coincide.</p>}>
            {tasks.map((t) => (
              <Table.Row key={t.id} id={t.id} className="cursor-pointer">
                <Table.Cell>
                  <span className="font-mono text-xs text-muted">{taskKey(t)}</span> <span className={t.status === 'done' ? 'text-muted line-through' : ''}>{titleOf(t)}</span>
                </Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="soft" color={COLOR[t.status]}>
                    {TASK_STATUS[t.status]?.[0]}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{t.priority ? PRIORITY[t.priority]?.[0] : <span className="text-muted">—</span>}</Table.Cell>
                <Table.Cell className="text-muted">{projectName(t.projectId) || '—'}</Table.Cell>
                <Table.Cell className="text-muted">{shortDate(t.dueDate) || '—'}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{durationText(taskMinutes(t.id))}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
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

  // Una tarea abierta ocupa la página entera (ya no es un panel lateral).
  if (openTask) return <Tarea key={openTask.id} id={openTask.id} backTo={project !== 'all' ? `#/tareas?p=${project}` : '#/tareas'} />;

  const add = (status) => {
    const t = newTask({ projectId: project !== 'all' && project !== '_none' ? project : '', status });
    put('tasks', t);
    go(`#/tareas/${t.id}`);
  };
  const pending = state.tasks.filter((k) => k.status !== 'done').length;

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
        <Board tasks={tasks} onAdd={add} />
      ) : (
        <List tasks={tasks} />
      )}
    </div>
  );
}
