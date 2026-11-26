// La tarea en su propia página (antes era un panel lateral): arriba, de dónde viene
// y el título grande; sus estados como pasos que se tocan; a la izquierda la
// descripción con formato, el checklist con su avance, las subtareas y la
// conversación; a la derecha lo que la define (proyecto, prioridad, fechas,
// valor) y su tiempo, con el temporizador. Las reglas son las de negocio-work.js.
import { useState } from 'react';
import { ArrowLeft, ArrowUpRightFromSquare, CircleCheck, Clock, Copy, ListCheck, Pause, Play, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, ButtonGroup, Checkbox, Chip, Form, Input, Link, ProgressBar, Separator, TextArea, TextField, toast } from '@heroui/react';
import { durationText, find, money, nowISO, put, shortDate, todayISO, uid } from '../../../negocio-core.js';
import {
  PRIORITY,
  TASK_ORDER,
  TASK_STATUS,
  entryMinutes,
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
  taskEntries,
  taskKey,
  taskMinutes,
  taskValue,
} from '../../../negocio-work.js';
import { Empty, Panel } from '../../kit/parts.jsx';
import { copyText } from '../../kit/csv.js';
import { ChatMessage, ChatThread, RichText, Stepper, Timeline, Widget } from '../../pro/index.js';
import { go, useCrm } from '../store.js';
import { AmountField, ConfirmButton, DateInput, SelectField } from '../fields.jsx';

const PRIO_COLOR = { low: 'default', medium: 'warning', high: 'danger' };
const titleOf = (t) => t.title?.trim() || 'Sin título';
const when = (iso) => (iso ? new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export function Tarea({ id, backTo = '#/tareas' }) {
  const [state, v] = useCrm();
  const [check, setCheck] = useState('');
  const [comment, setComment] = useState('');
  const t = find('tasks', id);
  if (!t) return <Empty icon={ListCheck} title="Esa tarea ya no existe" action={<Button onPress={() => go(backTo)}>Ver tareas</Button>} />;

  const save = (patch) => {
    Object.assign(t, patch);
    put('tasks', t);
  };
  const running = runningEntry();
  const timingThis = running?.taskId === t.id;
  const subs = subtasksOf(t.id);
  const cur = taskCurrency(t);
  const parent = t.parentId && find('tasks', t.parentId);
  const checks = t.checklist || [];
  const doneChecks = checks.filter((c) => c.done).length;
  const statusIndex = Math.max(0, TASK_ORDER.indexOf(t.status));
  const overdue = t.dueDate && t.status !== 'done' && t.dueDate < todayISO();
  const entries = taskEntries(t.id)
    .filter((e) => !e.running)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const toggleTimer = () => {
    if (timingThis) {
      const saved = stopTimer({ quiet: true });
      toast(saved ? `Guardado: ${durationText(saved.minutes)}` : 'Menos de un minuto: no se guardó.');
    } else {
      if (running) stopTimer({ quiet: true });
      startTimer({ projectId: t.projectId, taskId: t.id });
      toast('Temporizador en marcha');
    }
  };

  return (
    <div className="flex flex-col gap-6" data-v={v}>
      {/* De dónde viene y qué se puede hacer con ella */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <Link href={backTo} className="flex items-center gap-1 text-muted">
            <ArrowLeft className="size-4" />
            Tareas
          </Link>
          {t.projectId && (
            <>
              <span aria-hidden>/</span>
              <Link href={`#/proyectos/${t.projectId}`} className="truncate text-muted">
                {projectName(t.projectId)}
              </Link>
            </>
          )}
          {parent && (
            <>
              <span aria-hidden>/</span>
              <Link href={`#/tareas/${parent.id}`} className="truncate font-mono text-xs text-muted">
                {taskKey(parent)}
              </Link>
            </>
          )}
          <span aria-hidden>/</span>
          <span className="font-mono text-xs text-foreground">{taskKey(t)}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup size="sm" variant="secondary">
            <Button onPress={toggleTimer}>
              {timingThis ? <Pause /> : <Play />}
              {timingThis ? 'Parar' : 'Iniciar temporizador'}
            </Button>
            <Button onPress={() => go(`#/horas/nueva?t=${t.id}`)}>
              <ButtonGroup.Separator />
              <Clock />
              Registrar horas
            </Button>
          </ButtonGroup>
          {t.status !== 'done' ? (
            <Button
              size="sm"
              onPress={() => {
                setTaskStatus(t, 'done');
                put('tasks', t);
                toast.success(`${taskKey(t)} hecha`);
              }}
            >
              <CircleCheck />
              Marcar hecha
            </Button>
          ) : (
            <Chip color="success" variant="soft">
              <CircleCheck className="size-3.5" />
              <Chip.Label>Hecha{t.doneAt ? ` el ${shortDate(t.doneAt.slice(0, 10))}` : ''}</Chip.Label>
            </Chip>
          )}
        </div>
      </div>

      {/* Título grande, escrito en el sitio */}
      <TextField aria-label="Título" defaultValue={t.title} onChange={(x) => save({ title: x })} maxLength={200} autoFocus={!t.title} key={t.id}>
        <Input
          placeholder="¿Qué hay que hacer?"
          className={`h-auto border-0 bg-transparent px-0 py-1 text-3xl font-semibold tracking-tight shadow-none focus:ring-0 sm:text-4xl ${t.status === 'done' ? 'text-muted line-through' : ''}`}
        />
      </TextField>

      {/* Sus estados: tocar uno la lleva ahí */}
      <Widget title="Estado" action={<span>{TASK_STATUS[t.status]?.[0]}</span>}>
        <div className="-mx-1 overflow-hidden px-1">
          <Stepper
            orientation="horizontal"
            numbered={false}
            label="Estado de la tarea"
            current={t.status === 'done' ? TASK_ORDER.length : statusIndex}
            steps={TASK_ORDER.map((s) => ({ id: s, title: TASK_STATUS[s][0] }))}
            onChange={(i) => {
              const s = TASK_ORDER[i];
              if (s === t.status) return;
              setTaskStatus(t, s);
              put('tasks', t);
              toast(`${taskKey(t)} → ${TASK_STATUS[s][0]}`);
            }}
          />
        </div>
      </Widget>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Lo que hay que hacer */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2" aria-label="Descripción">
            <h2 className="sw-eyebrow">Descripción</h2>
            <RichText
              key={t.id}
              value={t.description || ''}
              onChange={(md) => save({ description: md.slice(0, 8000) })}
              label="Descripción"
              minHeight={180}
              placeholder="Qué hay que hacer, cómo y para qué. Escribe la clave de otra tarea (WEB-3) o [[una página]] para enlazarla."
            />
          </section>

          <Panel
            title="Checklist"
            description={checks.length ? `${doneChecks} de ${checks.length} hechos` : 'Los pasos pequeños de la tarea.'}
          >
            {checks.length > 0 && (
              <ProgressBar aria-label="Avance del checklist" value={(doneChecks / checks.length) * 100} size="sm" className="mb-3">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}
            <ul className="flex flex-col">
              {checks.map((c) => (
                <li key={c.id} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-surface-secondary">
                  <Checkbox
                    isSelected={c.done}
                    onChange={(on) => {
                      c.done = on;
                      put('tasks', t);
                    }}
                    className="min-w-0 flex-1"
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className={`text-sm ${c.done ? 'text-muted line-through' : ''}`}>{c.text}</span>
                    </Checkbox.Content>
                  </Checkbox>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar «${c.text}»`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                    onPress={() => save({ checklist: t.checklist.filter((x) => x !== c) })}
                  >
                    <Xmark />
                  </Button>
                </li>
              ))}
            </ul>
            <Form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!check.trim()) return;
                save({ checklist: [...checks, { id: uid(), text: check.trim(), done: false }] });
                setCheck('');
              }}
            >
              <TextField aria-label="Nuevo punto" value={check} onChange={setCheck} className="flex-1" maxLength={300}>
                <Input placeholder="Añadir un punto y pulsar Intro…" variant="secondary" />
              </TextField>
              <Button type="submit" size="sm" variant="tertiary" isDisabled={!check.trim()}>
                <Plus />
                Añadir
              </Button>
            </Form>
          </Panel>

          <Panel
            title="Subtareas"
            description={subs.length ? `${subs.filter((s) => s.status === 'done').length} de ${subs.length} hechas` : 'Partes de la tarea con su propia clave.'}
            action={
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  const st = newTask({ projectId: t.projectId, parentId: t.id });
                  put('tasks', st);
                  go(`#/tareas/${st.id}`);
                }}
              >
                <Plus />
                Subtarea
              </Button>
            }
          >
            {subs.length ? (
              <ul className="flex flex-col">
                {subs.map((st) => (
                  <li key={st.id}>
                    <a href={`#/tareas/${st.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-secondary">
                      {st.status === 'done' ? <CircleCheck className="size-4 text-success" /> : <span className="size-4 rounded-full border-2 border-default" />}
                      <span className="font-mono text-xs text-muted">{taskKey(st)}</span>
                      <span className={`min-w-0 flex-1 truncate ${st.status === 'done' ? 'text-muted line-through' : ''}`}>{titleOf(st)}</span>
                      <Chip size="sm" variant="soft">
                        {TASK_STATUS[st.status]?.[0]}
                      </Chip>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sin subtareas.</p>
            )}
          </Panel>

          <Panel title="Conversación" description={(t.comments || []).length ? `${t.comments.length} comentarios` : 'Notas, avances y lo que dijo el cliente.'}>
            {(t.comments || []).length > 0 && (
              <div className="mb-4">
                <ChatThread label="Comentarios">
                  {t.comments.map((c) => {
                    const who = c.author || c.by || c.name;
                    return (
                      <ChatMessage
                        key={c.id}
                        mine={!who}
                        author={who}
                        time={when(c.at)}
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
              </div>
            )}
            <Form
              className="flex items-end gap-2 rounded-[1.25rem] bg-surface-secondary p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                save({ comments: [...(t.comments || []), { id: uid(), text: comment.trim(), at: nowISO() }] });
                setComment('');
              }}
            >
              <TextField aria-label="Comentario" value={comment} onChange={setComment} maxLength={4000} className="flex-1">
                <TextArea
                  rows={2}
                  placeholder="Escribe un comentario… (Ctrl+Intro para enviar)"
                  className="resize-none border-0 bg-transparent shadow-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
                  }}
                />
              </TextField>
              <Button type="submit" size="sm" isDisabled={!comment.trim()}>
                Comentar
              </Button>
            </Form>
          </Panel>
        </div>

        {/* Lo que la define */}
        <aside className="flex min-w-0 flex-col gap-4">
          <Widget title="Detalles">
            <div className="flex flex-col gap-4">
              <SelectField
                label="Proyecto"
                value={t.projectId || '_none'}
                onChange={(pid) => moveTask(t, pid === '_none' ? '' : pid)}
                options={[['_none', 'Sin proyecto'], ...state.projects.map((p) => [p.id, p.name || 'Sin nombre'])]}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Prioridad</span>
                <div role="radiogroup" aria-label="Prioridad" className="flex flex-wrap gap-1.5">
                  {[['', 'Sin prioridad'], ...Object.entries(PRIORITY).map(([k, [label]]) => [k, label])].map(([k, label]) => {
                    const on = (t.priority || '') === k;
                    return (
                      <button
                        key={k || 'none'}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => save({ priority: k })}
                        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Chip size="sm" variant={on ? 'primary' : 'soft'} color={on ? PRIO_COLOR[k] || 'accent' : 'default'}>
                          {label}
                        </Chip>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateInput label="Empieza" value={t.startDate} onChange={(d) => save({ startDate: d })} />
                <DateInput label="Vence" value={t.dueDate} onChange={(d) => save({ dueDate: d })} />
              </div>
              {overdue && <p className="-mt-2 text-xs text-danger">Venció el {shortDate(t.dueDate)}.</p>}
              <Separator />
              <AmountField label={`Valor fijo (${cur})`} value={t.value} onChange={(n) => save({ value: n })} description="Si tiene valor, se cobra por él y sus horas no suman dinero." />
              <AmountField
                label={`Tarifa por hora (${cur})`}
                value={t.rate ?? 0}
                onChange={(n) => save({ rate: n || null })}
                description={isFixed(t) ? 'No cuenta: tiene valor fijo.' : 'Vacía: la del proyecto o la de Ajustes.'}
              />
            </div>
          </Widget>

          <Widget title="Tiempo" action={timingThis ? <Chip size="sm" color="accent" variant="soft">En marcha</Chip> : null}>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted">Registrado</span>
                <span className="sw-figure text-3xl">{durationText(taskMinutes(t.id))}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted">{isFixed(t) ? 'Valor fijo' : 'Vale'}</span>
                <span className="sw-figure text-2xl">{money(taskValue(t), cur)}</span>
              </div>
            </div>
            {entries.length > 0 && (
              <>
                <Separator className="my-3" />
                <Timeline
                  label="Horas de la tarea"
                  items={entries.slice(0, 5).map((e) => ({
                    id: e.id,
                    title: durationText(entryMinutes(e)),
                    marker: { icon: Clock },
                    description: e.note || undefined,
                    trailing: shortDate(e.date),
                  }))}
                />
                {entries.length > 5 && (
                  <Link href={`#/horas`} className="mt-2 text-xs">
                    Ver todas en Horas
                  </Link>
                )}
              </>
            )}
          </Widget>

          <Widget title="Más">
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="justify-start"
                onPress={async () => {
                  if (await copyText(taskKey(t))) toast(`${taskKey(t)} copiada`);
                }}
              >
                <Copy />
                Copiar la clave ({taskKey(t)})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="justify-start"
                onPress={async () => {
                  if (await copyText(`${location.origin}${location.pathname}#/tareas/${t.id}`)) toast('Enlace copiado');
                }}
              >
                <ArrowUpRightFromSquare />
                Copiar el enlace
              </Button>
              <ConfirmButton
                title={`¿Eliminar ${taskKey(t)}?`}
                text={subs.length ? 'Se borran también sus subtareas. Sus horas se quedan, sin tarea.' : 'Sus horas se quedan, sin tarea.'}
                onConfirm={() => {
                  removeTask(t);
                  go(backTo);
                }}
              >
                <TrashBin />
                Eliminar la tarea
              </ConfirmButton>
            </div>
          </Widget>
        </aside>
      </div>
    </div>
  );
}
