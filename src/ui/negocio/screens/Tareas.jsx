// Tareas: tablero (Solicitud, Por hacer, En curso, Revisión, Hecho) o lista, de
// todos los proyectos o de uno. Cada tarea tiene su clave (WEB-12) y se abre en un
// panel con estado, prioridad, fechas, valor o tarifa, checklist, comentarios,
// subtareas y el temporizador. Las reglas son las de negocio-work.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CircleCheck, Comment, EllipsisVertical, LayoutColumns, ListUl, Play, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Chip,
  Drawer,
  Dropdown,
  Form,
  Input,
  Label,
  ScrollShadow,
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

function TaskCard({ t }) {
  const subs = subtasksOf(t.id);
  const checks = t.checklist || [];
  return (
    <Card className="gap-2 p-3">
      <div className="flex items-start gap-2">
        <a href={`#/tareas/${t.id}`} className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-[11px] text-muted">{taskKey(t)}</span>
          <span className={`text-sm font-medium ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{titleOf(t)}</span>
        </a>
        <StatusMenu
          task={t}
          trigger={
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Mover ${taskKey(t)}`}>
              <EllipsisVertical />
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {t.priority && (
          <Chip size="sm" variant="soft" color={PRIO_COLOR[t.priority]}>
            {PRIORITY[t.priority]?.[0]}
          </Chip>
        )}
        {t.dueDate && (
          <Chip size="sm" variant="soft" color={t.status !== 'done' && t.dueDate < todayISO() ? 'danger' : 'default'}>
            {shortDate(t.dueDate)}
          </Chip>
        )}
        {checks.length > 0 && (
          <span>
            {checks.filter((c) => c.done).length}/{checks.length}
          </span>
        )}
        {subs.length > 0 && <span>{subs.length} subtareas</span>}
        {(t.comments || []).length > 0 && (
          <span className="flex items-center gap-0.5">
            <Comment className="size-3" />
            {t.comments.length}
          </span>
        )}
        {!t.projectId ? null : <span className="truncate">{projectName(t.projectId)}</span>}
      </div>
    </Card>
  );
}

function Board({ tasks, onAdd }) {
  return (
    <ScrollShadow orientation="horizontal" className="-mx-1 pb-2">
      <div className="flex w-max gap-3 px-1">
        {TASK_ORDER.map((s) => {
          const items = tasks.filter((t) => t.status === s).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
          return (
            <section key={s} className="flex w-72 shrink-0 flex-col gap-2 rounded-3xl bg-surface-secondary p-2" aria-label={TASK_STATUS[s][0]}>
              <header className="flex items-center justify-between px-2 pt-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Chip size="sm" variant="soft" color={COLOR[s]}>
                    {items.length}
                  </Chip>
                  {TASK_STATUS[s][0]}
                </span>
                <Button isIconOnly size="sm" variant="ghost" aria-label={`Nueva tarea en ${TASK_STATUS[s][0]}`} onPress={() => onAdd(s)}>
                  <Plus />
                </Button>
              </header>
              {items.map((t) => (
                <TaskCard key={t.id} t={t} />
              ))}
              {!items.length && <p className="px-2 py-4 text-center text-xs text-muted">Vacía</p>}
            </section>
          );
        })}
      </div>
    </ScrollShadow>
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

              <TextField defaultValue={t.description} onChange={(x) => save({ description: x })} maxLength={8000}>
                <Label>Descripción</Label>
                <TextArea rows={4} placeholder="Escribe la clave de otra tarea (WEB-3) o [[una página]] para enlazarla." />
              </TextField>

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
                <span className="sw-eyebrow">Comentarios</span>
                {(t.comments || []).map((c) => (
                  <div key={c.id} className="rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
                    <span className="text-xs text-muted">{new Date(c.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <p className="whitespace-pre-line">{c.text}</p>
                  </div>
                ))}
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
