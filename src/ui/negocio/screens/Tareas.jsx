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
import { ChatMessage, ChatThread, Kanban, KanbanCard, RichText } from '../../pro/index.js';

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
function TaskDrawer({ id, onClose }) {
  const [state, v] = useCrm();
  const ready = useOpenAfterGesture();
  const [check, setCheck] = useState('');
  const [comment, setComment] = useState('');
  const t = find('tasks', id);
  if (!t) return null;
  const save = (patch) => {
    Object.assign(t, patch);
    put('tasks', t);
  };
  const running = runningEntry();
  const timingThis = running?.taskId === t.id;
  const subs = subtasksOf(t.id);
  const cur = taskCurrency(t);

  return (
    <Drawer isOpen={ready} onOpenChange={(o) => ready && !o && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-full sm:max-w-[560px]" data-v={v}>
            <Drawer.CloseTrigger />
            <Drawer.Header className="flex flex-col items-start gap-1">
              <span className="font-mono text-xs text-muted">
                {taskKey(t)} · {projectName(t.projectId) || 'Sin proyecto'}
              </span>
              <Drawer.Heading className="sr-only">{titleOf(t)}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5">
              <TextField aria-label="Título" defaultValue={t.title} onChange={(x) => save({ title: x })} maxLength={200} autoFocus={!t.title}>
                <Input className="text-lg font-semibold" placeholder="¿Qué hay que hacer?" />
              </TextField>
              <div className="flex flex-wrap items-center gap-2">
                <StatusMenu
                  task={t}
                  trigger={
                    <Button size="sm" variant="secondary">
                      <Chip size="sm" variant="soft" color={COLOR[t.status]}>
                        {TASK_STATUS[t.status]?.[0]}
                      </Chip>
                      <ChevronDown />
                    </Button>
                  }
                />
                {t.status !== 'done' && (
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      setTaskStatus(t, 'done');
                      put('tasks', t);
                      toast.success(`${taskKey(t)} hecha`);
                    }}
                  >
                    <CircleCheck />
                    Marcar hecha
                  </Button>
                )}
                <ButtonGroup size="sm" variant="secondary">
                  <Button
                    onPress={() => {
                      if (timingThis) {
                        const saved = stopTimer({ quiet: true });
                        toast(saved ? `Guardado: ${durationText(saved.minutes)}` : 'Menos de un minuto: no se guardó.');
                      } else {
                        if (running) stopTimer({ quiet: true });
                        startTimer({ projectId: t.projectId, taskId: t.id });
                        toast('Temporizador en marcha');
                      }
                    }}
                  >
                    <Play />
                    {timingThis ? 'Parar el temporizador' : 'Iniciar temporizador'}
                  </Button>
                  <Button onPress={() => go(`#/horas/nueva?t=${t.id}`)}>
                    <ButtonGroup.Separator />
                    Registrar horas
                  </Button>
                </ButtonGroup>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Proyecto"
                  value={t.projectId || '_none'}
                  onChange={(pid) => moveTask(t, pid === '_none' ? '' : pid)}
                  options={[['_none', 'Sin proyecto'], ...state.projects.map((p) => [p.id, p.name || 'Sin nombre'])]}
                />
                <SelectField
                  label="Prioridad"
                  value={t.priority || '_none'}
                  onChange={(k) => save({ priority: k === '_none' ? '' : k })}
                  options={[['_none', 'Sin prioridad'], ...Object.entries(PRIORITY).map(([k, [label]]) => [k, label])]}
                />
                <DateInput label="Empieza" value={t.startDate} onChange={(d) => save({ startDate: d })} />
                <DateInput label="Vence" value={t.dueDate} onChange={(d) => save({ dueDate: d })} />
                <AmountField label={`Valor fijo (${cur})`} value={t.value} onChange={(n) => save({ value: n })} description="Si tiene valor, se cobra por él y sus horas no suman dinero." />
                <AmountField
                  label={`Tarifa por hora (${cur})`}
                  value={t.rate ?? 0}
                  onChange={(n) => save({ rate: n || null })}
                  description={isFixed(t) ? 'No cuenta: tiene valor fijo.' : 'Vacía: la del proyecto o la de Ajustes.'}
                />
              </div>
              <p className="text-sm text-muted">
                {durationText(taskMinutes(t.id))} registradas · vale {money(taskValue(t), cur)}
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Descripción</span>
                <RichText
                  key={t.id}
                  value={t.description || ''}
                  onChange={(md) => save({ description: md.slice(0, 8000) })}
                  label="Descripción"
                  minHeight={110}
                  footer={false}
                  placeholder="Escribe la clave de otra tarea (WEB-3) o [[una página]] para enlazarla."
                  className="shadow-none ring-1 ring-separator"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="sw-eyebrow">
                  Checklist {(t.checklist || []).length ? `· ${(t.checklist || []).filter((c) => c.done).length}/${t.checklist.length}` : ''}
                </span>
                {(t.checklist || []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      isSelected={c.done}
                      onChange={(on) => {
                        c.done = on;
                        put('tasks', t);
                      }}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className={c.done ? 'text-muted line-through' : ''}>{c.text}</span>
                      </Checkbox.Content>
                    </Checkbox>
                    <span className="flex-1" />
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar" onPress={() => save({ checklist: t.checklist.filter((x) => x !== c) })}>
                      <Xmark />
                    </Button>
                  </div>
                ))}
                <Form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!check.trim()) return;
                    save({ checklist: [...(t.checklist || []), { id: uid(), text: check.trim(), done: false }] });
                    setCheck('');
                  }}
                >
                  <TextField aria-label="Nuevo punto" value={check} onChange={setCheck} className="flex-1" maxLength={300}>
                    <Input placeholder="Añadir un punto…" variant="secondary" />
                  </TextField>
                  <Button type="submit" size="sm" variant="tertiary" isDisabled={!check.trim()}>
                    Añadir
                  </Button>
                </Form>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="sw-eyebrow">Subtareas {subs.length ? `· ${subs.length}` : ''}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      const st = newTask({ projectId: t.projectId, parentId: t.id });
                      put('tasks', st);
                      go(`#/tareas/${st.id}`);
                    }}
                  >
                    <Plus />
                    Subtarea
                  </Button>
                </div>
                {subs.map((st) => (
                  <a key={st.id} href={`#/tareas/${st.id}`} className="flex items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2 text-sm">
                    {st.status === 'done' ? <CircleCheck className="text-success" /> : <span className="size-3.5 rounded-full border border-border" />}
                    <span className="font-mono text-xs text-muted">{taskKey(st)}</span>
                    <span className="truncate">{titleOf(st)}</span>
                  </a>
                ))}
              </div>

              <Separator />
              <div className="flex flex-col gap-2">
                <span className="sw-eyebrow">Comentarios {(t.comments || []).length ? `· ${t.comments.length}` : ''}</span>
                {(t.comments || []).length > 0 && (
                  <ChatThread label="Comentarios">
                    {t.comments.map((c) => {
                      const who = c.author || c.by || c.name;
                      return (
                        <ChatMessage
                          key={c.id}
                          mine={!who}
                          author={who}
                          time={c.at ? new Date(c.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          text={c.text}
                          actions={[
                            {
                              id: 'del',
                              label: 'Quitar el comentario',
                              icon: TrashBin,
                              onPress: () => save({ comments: t.comments.filter((x) => x.id !== c.id) }),
                            },
                          ]}
                        />
                      );
                    })}
                  </ChatThread>
                )}
                <Form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!comment.trim()) return;
                    save({ comments: [...(t.comments || []), { id: uid(), text: comment.trim(), at: nowISO() }] });
                    setComment('');
                  }}
                >
                  <TextField aria-label="Comentario" value={comment} onChange={setComment} maxLength={4000}>
                    <TextArea rows={2} placeholder="Escribe un comentario…" />
                  </TextField>
                  <Button type="submit" size="sm" variant="secondary" className="w-fit" isDisabled={!comment.trim()}>
                    Comentar
                  </Button>
                </Form>
              </div>
            </Drawer.Body>
            <Drawer.Footer className="justify-between">
              <ConfirmButton
                title={`¿Eliminar ${taskKey(t)}?`}
                text={subs.length ? 'Se borran también sus subtareas. Sus horas se quedan, sin tarea.' : 'Sus horas se quedan, sin tarea.'}
                onConfirm={() => {
                  removeTask(t);
                  onClose();
                }}
              >
                <TrashBin />
                Eliminar
              </ConfirmButton>
              <Button slot="close" variant="secondary">
                Listo
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

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
      {openTask && <TaskDrawer key={openTask.id} id={openTask.id} onClose={() => go(project !== 'all' ? `#/tareas?p=${project}` : '#/tareas')} />}
    </div>
  );
}
