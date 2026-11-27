// Horas: el temporizador (uno a la vez; vive en los datos, así sobrevive a
// recargar) y el registro a mano. La tarifa sale de la entrada, la tarea, el
// proyecto o Ajustes, en ese orden. Las cuentas son las de negocio-work.js.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CircleCheck, CircleXmark, Clock, Pause, Pencil, Play, Plus, Square, TrashBin } from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Chip, Input, Label, Switch, TextField, toast } from '@heroui/react';
import { addDays, clockText, dateText, durationText, find, money, parseDuration, put, remove, todayISO } from '../../../negocio-core.js';
import {
  billedDocOf,
  discardTimer,
  elapsedMs,
  entryCurrency,
  entryMinutes,
  entryValue,
  isUnbilled,
  newEntry,
  newTask,
  pauseTimer,
  projectName,
  resumeTimer,
  runningEntry,
  startTimer,
  stopTimer,
  taskKey,
} from '../../../negocio-work.js';
import { Empty, PageHeader, Panel, Stat } from '../../kit/parts.jsx';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { go, routeQuery, useCrm } from '../store.js';
import { base, fmt } from '../domain.js';
import { AmountField, ConfirmButton, ConfirmDialog, DateInput, FormModal, SelectField } from '../fields.jsx';
import { downloadCsv } from '../../kit/csv.js';
import { ActionBar, ListView } from '../../pro/index.js';

function useTick(on) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
}

const taskOptions = (tasks, projectId) => [['_none', 'Sin tarea'], ...tasks.filter((t) => t.status !== 'done' && (!projectId || t.projectId === projectId)).map((t) => [t.id, `${taskKey(t)} ${t.title || 'Sin título'}`])];

function Timer() {
  const [state] = useCrm();
  const e = runningEntry();
  useTick(Boolean(e?.resumedAt));
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('_none');
  const [note, setNote] = useState('');

  if (e) {
    const task = e.taskId && find('tasks', e.taskId);
    return (
      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="sw-eyebrow">{e.resumedAt ? 'En marcha' : 'En pausa'}</span>
            <span className={`sw-figure text-5xl tabular-nums ${e.resumedAt ? '' : 'text-muted'}`}>{clockText(elapsedMs(e))}</span>
            <span className="text-sm text-muted">{[task && `${taskKey(task)} ${task.title}`, projectName(e.projectId), e.note].filter(Boolean).join(' · ') || 'Sin tarea ni proyecto'}</span>
          </div>
          <ButtonGroup>
            <Button variant="secondary" onPress={() => (e.resumedAt ? pauseTimer() : resumeTimer())}>
              {e.resumedAt ? <Pause /> : <Play />}
              {e.resumedAt ? 'Pausar' : 'Seguir'}
            </Button>
            <Button
              onPress={() => {
                const saved = stopTimer({ quiet: true });
                toast(saved ? `Guardado: ${durationText(saved.minutes)}` : 'Menos de un minuto: no se guardó.');
              }}
            >
              <ButtonGroup.Separator />
              <Square />
              Parar y guardar
            </Button>
          </ButtonGroup>
        </div>
        <ConfirmButton title="¿Descartar el temporizador?" text="Lo contado no se guarda." confirm="Descartar" onConfirm={discardTimer} variant="ghost">
          Descartar
        </ConfirmButton>
      </Card>
    );
  }

  return (
    <Card className="gap-4 p-5">
      <span className="sw-eyebrow">Temporizador</span>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <SelectField
          label="Proyecto"
          value={projectId || '_none'}
          onChange={(id) => {
            setProjectId(id === '_none' ? '' : id);
            setTaskId('_none');
          }}
          options={[['_none', 'Sin proyecto'], ...state.projects.filter((p) => p.status !== 'completed').map((p) => [p.id, p.name || 'Sin nombre'])]}
        />
        <SelectField label="Tarea" value={taskId} onChange={setTaskId} options={taskOptions(state.tasks, projectId)} />
        <TextField value={note} onChange={setNote} maxLength={200}>
          <Label>Nota</Label>
          <Input placeholder="En qué estás" />
        </TextField>
        <Button
          onPress={() => {
            const t = taskId !== '_none' ? find('tasks', taskId) : null;
            startTimer({ projectId: t?.projectId || projectId, taskId: t?.id || '', note: note.trim() });
            setNote('');
          }}
        >
          <Play />
          Iniciar
        </Button>
      </div>
    </Card>
  );
}

const QUICK = [15, 30, 45, 60, 90, 120, 180, 240];
const NEW_TASK = '_new';
let lineSeq = 0;
const blankLine = (taskId = '_none', minutes = 0, note = '') => ({ key: (lineSeq += 1), taskId, title: '', dur: minutes ? durationText(minutes) : '', note });

/**
 * Registrar horas: el día, el proyecto y una o varias tareas, cada una con su
 * tiempo. Si la tarea aún no existe se crea aquí mismo; y «Cronometrar» arranca el
 * temporizador con ella en vez de apuntar un tiempo a mano.
 */
function EntryForm({ entry, onClose }) {
  const [state] = useCrm();
  const q = routeQuery();
  const fromTask = q.get('t') && find('tasks', q.get('t'));
  const [e] = useState(() => (entry ? { ...entry } : newEntry({ projectId: fromTask?.projectId || q.get('p') || '', taskId: fromTask?.id || '' })));
  const [projectId, setProjectId] = useState(e.projectId || '');
  const [date, setDate] = useState(e.date || todayISO());
  const [lines, setLines] = useState(() => [blankLine(e.taskId || '_none', e.minutes, e.note || '')]);
  const [billable, setBillable] = useState(e.billable !== false);
  const [rate, setRate] = useState(e.rate ?? 0);
  const [doneNew, setDoneNew] = useState(false);
  const [error, setError] = useState('');
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const total = lines.reduce((s, l) => s + (parseDuration(l.dur) || 0), 0);
  const setLine = (key, patch) => {
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setError('');
  };
  const options = [...taskOptions(state.tasks, projectId), [NEW_TASK, '+ Nueva tarea…', 'Se crea al guardar']];

  /** La tarea de una línea: la elegida, o la nueva (se crea ahora). */
  const resolveTask = (l) => {
    if (l.taskId === NEW_TASK) {
      const title = l.title.trim();
      if (!title) return '';
      const t = { ...newTask({ projectId }), title, status: doneNew ? 'done' : 'doing' };
      put('tasks', t);
      return t.id;
    }
    return l.taskId === '_none' ? '' : l.taskId;
  };
  const check = () => {
    const bad = lines.find((l) => l.taskId === NEW_TASK && !l.title.trim());
    if (bad) return 'Ponle un nombre a la tarea nueva.';
    return '';
  };

  return (
    <FormModal
      title={entry ? 'Editar horas' : 'Registrar horas'}
      size="sm:max-w-[680px]"
      submit={entry ? 'Guardar' : total ? `Registrar ${durationText(total)}` : 'Registrar'}
      onClose={onClose}
      extra={
        !entry && (
          <Button
            variant="secondary"
            onPress={() => {
              const why = check();
              if (why) return setError(why);
              const first = lines[0];
              const taskId = resolveTask(first);
              const t = taskId && find('tasks', taskId);
              startTimer({ projectId: t?.projectId || projectId, taskId, note: first.note.trim() });
              toast.success('Temporizador en marcha');
              onClose();
              return undefined;
            }}
          >
            <Play />
            Cronometrar
          </Button>
        )
      }
      onSubmit={() => {
        const why = check();
        if (why) {
          setError(why);
          return false;
        }
        const filled = lines.filter((l) => parseDuration(l.dur));
        if (!filled.length) {
          setError('Escribe cuánto tiempo: «1:30», «90 min», «2 h» o «1,5», o toca un atajo.');
          return false;
        }
        const missing = lines.find((l) => !parseDuration(l.dur) && (l.taskId !== '_none' || l.note.trim()));
        if (missing) {
          setError('A una de las tareas le falta su tiempo.');
          return false;
        }
        filled.forEach((l, i) => {
          const taskId = resolveTask(l);
          const t = taskId && find('tasks', taskId);
          put('time', {
            ...(entry && i === 0 ? e : newEntry()),
            projectId: t?.projectId || projectId,
            taskId,
            date,
            minutes: parseDuration(l.dur),
            note: l.note.trim(),
            billable,
            rate: rate > 0 ? rate : null,
          });
        });
        const sum = filled.reduce((s, l) => s + parseDuration(l.dur), 0);
        toast.success(entry ? 'Horas guardadas' : filled.length > 1 ? `Registradas ${durationText(sum)} en ${filled.length} tareas` : `Registradas ${durationText(sum)}`);
        return true;
      }}
    >
      <div className="flex flex-col gap-1.5">
        <DateInput label="Día" value={date} onChange={setDate} />
        <div className="flex gap-1.5">
          {[
            [today, 'Hoy'],
            [yesterday, 'Ayer'],
          ].map(([d, label]) => (
            <Button key={label} size="sm" variant={date === d ? 'secondary' : 'ghost'} onPress={() => setDate(d)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
      <SelectField
        label="Proyecto"
        value={projectId || '_none'}
        onChange={(id) => {
          setProjectId(id === '_none' ? '' : id);
          setLines((list) => list.map((l) => ({ ...l, taskId: l.taskId === NEW_TASK ? NEW_TASK : '_none' })));
        }}
        options={[['_none', 'Sin proyecto'], ...state.projects.map((p) => [p.id, p.name || 'Sin nombre'])]}
      />

      <div className="flex flex-col gap-3 sm:col-span-2">
        {lines.map((l, i) => {
          const minutes = parseDuration(l.dur);
          return (
            <section key={l.key} className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3">
              <div className="flex items-center gap-2">
                <span className="sw-eyebrow flex-1">{lines.length > 1 ? `Tarea ${i + 1}` : 'Tarea'}</span>
                {minutes ? <span className="text-xs font-medium tabular-nums text-muted">{durationText(minutes)}</span> : null}
                {lines.length > 1 && (
                  <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar esta tarea" onPress={() => setLines((list) => list.filter((x) => x.key !== l.key))}>
                    <TrashBin className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField ariaLabel="Tarea" value={l.taskId} onChange={(id) => setLine(l.key, { taskId: id })} options={options} />
                {l.taskId === NEW_TASK ? (
                  <TextField value={l.title} onChange={(x) => setLine(l.key, { title: x })} maxLength={200} autoFocus aria-label="Nombre de la tarea nueva">
                    <Input placeholder="Nombre de la tarea nueva" />
                  </TextField>
                ) : (
                  <TextField value={l.note} onChange={(x) => setLine(l.key, { note: x })} maxLength={300} aria-label="Nota">
                    <Input placeholder="Qué hiciste (opcional)" />
                  </TextField>
                )}
              </div>
              {l.taskId === NEW_TASK && (
                <TextField value={l.note} onChange={(x) => setLine(l.key, { note: x })} maxLength={300} aria-label="Nota">
                  <Input placeholder="Qué hiciste (opcional)" />
                </TextField>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <TextField value={l.dur} onChange={(x) => setLine(l.key, { dur: x })} isInvalid={Boolean(error) && !minutes} autoFocus={i === 0 && !entry && !fromTask} aria-label="Tiempo" className="w-36">
                  <Input placeholder="1:30, 2 h…" />
                </TextField>
                {QUICK.map((m) => (
                  <Button key={m} size="sm" variant={minutes === m ? 'secondary' : 'ghost'} className="tabular-nums" onPress={() => setLine(l.key, { dur: durationText(m) })}>
                    {durationText(m)}
                  </Button>
                ))}
              </div>
            </section>
          );
        })}
        {!entry && (
          <Button size="sm" variant="tertiary" className="self-start" onPress={() => setLines((list) => [...list, blankLine()])}>
            <Plus />
            Añadir otra tarea
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 sm:col-span-2">
        <SwitchField isSelected={billable} onChange={setBillable} label="Facturable" />
        {lines.some((l) => l.taskId === NEW_TASK) && <SwitchField isSelected={doneNew} onChange={setDoneNew} label="La tarea nueva ya está hecha" />}
        <AmountField label={`Tarifa propia (${base()})`} value={rate} onChange={setRate} description="0: la de la tarea, el proyecto o Ajustes." className="w-56" />
      </div>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </FormModal>
  );
}

export function Horas({ isNew }) {
  const [state, v] = useCrm();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const selectedEntries = state.time.filter((e) => picked.has(e.id) && !e.running);
  const today = todayISO();
  const weekStart = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString('en-CA');
  })();

  const data = useMemo(() => {
    const done = state.time.filter((e) => !e.running);
    const sum = (list) => list.reduce((s, e) => s + entryMinutes(e), 0);
    const unbilled = done.filter(isUnbilled);
    const byDay = new Map();
    for (const e of [...done].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.start || '').localeCompare(a.start || ''))) {
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date).push(e);
    }
    return {
      today: sum(done.filter((e) => e.date === today)),
      week: sum(done.filter((e) => e.date >= weekStart)),
      month: sum(done.filter((e) => (e.date || '').slice(0, 7) === today.slice(0, 7))),
      unbilledValue: unbilled.reduce((s, e) => s + (entryCurrency(e) === base() ? entryValue(e) : 0), 0),
      unbilledMinutes: sum(unbilled),
      days: [...byDay].slice(0, 30),
    };
  }, [state, v]);

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
    if (isNew) go('#/horas');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Trabajo"
        title="Horas"
        description="El temporizador y lo registrado a mano. «Facturar horas» está en cada proyecto."
        actions={
          <Button variant="secondary" onPress={() => setAdding(true)}>
            <Plus />
            Registrar a mano
          </Button>
        }
      />
      <Timer />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hoy" value={durationText(data.today)} icon={Clock} />
        <Stat label="Esta semana" value={durationText(data.week)} />
        <Stat label="Este mes" value={durationText(data.month)} />
        <Stat label="Sin facturar" value={fmt(data.unbilledValue)} sub={durationText(data.unbilledMinutes)} />
      </div>
      {data.days.length === 0 ? (
        <Empty icon={Clock} title="Todavía no hay horas" text="Inicia el temporizador o registra horas a mano." />
      ) : (
        <>
          <p className="-mb-3 text-xs text-muted">Toca un registro para editarlo; marca su casilla (o pulsa Espacio) para elegir varios y actuar sobre todos.</p>
          {data.days.map(([day, list]) => (
            <Panel key={day} title={day === today ? 'Hoy' : day === addDays(today, -1) ? 'Ayer' : dateText(day)} description={durationText(list.reduce((s, e) => s + entryMinutes(e), 0))}>
              <ListView
                label={`Horas del ${dateText(day)}`}
                selectionMode="multiple"
                selectedKeys={new Set(list.filter((e) => picked.has(e.id)).map((e) => e.id))}
                onSelectionChange={(keys) => {
                  const inDay = new Set(list.map((e) => e.id));
                  const chosen = keys === 'all' ? inDay : new Set([...keys].map(String));
                  setPicked((p) => new Set([...[...p].filter((k) => !inDay.has(k)), ...chosen]));
                }}
                onAction={(k) => setEditing(find('time', String(k)))}
                bare
                className="-mx-2"
                items={list.map((e) => {
                  const task = e.taskId && find('tasks', e.taskId);
                  const billed = billedDocOf(e);
                  return {
                    id: e.id,
                    title: task ? `${taskKey(task)} ${task.title}` : e.note || 'Sin tarea',
                    description: [projectName(e.projectId), task && e.note].filter(Boolean).join(' · ') || '—',
                    end: (
                      <>
                        {billed ? (
                          <Chip size="sm" variant="soft" color="success">
                            Facturada
                          </Chip>
                        ) : e.billable === false ? (
                          <Chip size="sm" variant="tertiary">
                            No facturable
                          </Chip>
                        ) : null}
                        <span className="w-16 text-end tabular-nums">{durationText(entryMinutes(e))}</span>
                        <span className="hidden w-24 text-end tabular-nums text-muted sm:block">{money(entryValue(e), entryCurrency(e))}</span>
                      </>
                    ),
                  };
                })}
              />
            </Panel>
          ))}
        </>
      )}
      <ActionBar
        count={selectedEntries.length}
        label={selectedEntries.length === 1 ? 'registro elegido' : 'registros elegidos'}
        onClear={() => setPicked(new Set())}
        actions={[
          { id: 'billable', label: 'Facturables', icon: CircleCheck, isDisabled: !selectedEntries.some((e) => !billedDocOf(e) && e.billable === false) },
          { id: 'nobill', label: 'No facturables', icon: CircleXmark, isDisabled: !selectedEntries.some((e) => !billedDocOf(e) && e.billable !== false) },
          { id: 'csv', label: 'Exportar CSV', icon: ArrowDownToLine },
          { id: 'delete', label: 'Borrar', icon: TrashBin, danger: true, isDisabled: !selectedEntries.some((e) => !billedDocOf(e)) },
        ]}
        onAction={(id) => {
          const free = selectedEntries.filter((e) => !billedDocOf(e));
          if (id === 'billable' || id === 'nobill') {
            const want = id === 'billable';
            const list = free.filter((e) => (e.billable !== false) !== want);
            list.forEach((e) => put('time', { ...e, billable: want }));
            toast(`${list.length} ${want ? 'ahora cuentan para facturar' : 'ya no se facturan'}${selectedEntries.length > free.length ? ' (las facturadas no cambian)' : ''}`);
          }
          if (id === 'csv') {
            downloadCsv(`horas-${today}`, [
              ['Fecha', 'Tarea', 'Proyecto', 'Nota', 'Minutos', 'Horas', 'Valor', 'Moneda', 'Facturable', 'Facturada'],
              ...selectedEntries.map((e) => {
                const task = e.taskId && find('tasks', e.taskId);
                const m = entryMinutes(e);
                return [e.date, task ? `${taskKey(task)} ${task.title}` : '', projectName(e.projectId) || '', e.note || '', m, (m / 60).toFixed(2).replace('.', ','), entryValue(e), entryCurrency(e), e.billable === false ? 'No' : 'Sí', billedDocOf(e)?.number || ''];
              }),
            ]);
            toast(`${selectedEntries.length} en el archivo`);
          }
          if (id === 'delete') setConfirmDelete(free);
        }}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.length === 1 ? '¿Borrar este registro?' : `¿Borrar ${confirmDelete?.length || 0} registros?`}
        text={selectedEntries.length > (confirmDelete?.length || 0) ? 'Los que ya están en una factura no se borran.' : 'Sus horas dejan de contar.'}
        confirm="Borrar"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          confirmDelete.forEach((e) => remove('time', e.id));
          toast(confirmDelete.length === 1 ? 'Borrado.' : `${confirmDelete.length} borrados.`);
          setPicked(new Set());
        }}
      />
      {(adding || isNew || editing) && <EntryForm key={editing?.id || 'new'} entry={editing} onClose={closeForm} />}
    </div>
  );
}
