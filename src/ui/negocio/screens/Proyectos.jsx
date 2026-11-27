// Proyectos: cada uno es de un cliente. La lista con su avance y lo ganado frente
// al presupuesto; la ficha con sus seis cifras, las etapas (se completan en orden),
// sus tareas, documentos y horas, y «Facturar horas». Las cuentas son las de
// negocio-work.js, las mismas del panel de siempre.
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, CircleCheck, Clock, Folder, ListCheck, Pencil, Plus, Receipt } from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Chip,
  Description,
  Dropdown,
  Input,
  Label,
  Link,
  ProgressBar,
  Radio,
  RadioGroup,
  ScrollShadow,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { durationText, find, money, put, shortDate } from '../../../negocio-core.js';
import {
  BILL_PERIODS,
  PROJECT_STATUS,
  TASK_STATUS,
  billWork,
  cleanCode,
  codeFrom,
  customerOf,
  newProject,
  projectCode,
  projectStats,
  removeProject,
  setProjectStatus,
  taskKey,
  takenCodes,
  toggleStage,
  unbilledWork,
} from '../../../negocio-work.js';
import { Empty, PageHeader, Panel, Stat, StatusChip } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { DOC_STATUS, DOC_WORD, docStatus, totals } from '../domain.js';
import { CurrencyPicker } from '../currency.jsx';
import { AmountField, ConfirmButton, DateInput, FormModal, SelectField } from '../fields.jsx';
import { RichView, Stepper, Timeline } from '../../pro/index.js';
import { PagesPanel } from './Paginas.jsx';
import { NuevoProyecto } from './NuevoProyecto.jsx';

const STATUS_COLOR = { pending: 'warning', active: 'accent', paused: 'default', completed: 'success' };
const TASK_COLOR = { request: 'accent', todo: 'default', doing: 'accent', review: 'warning', done: 'success' };

const whenText = (iso) => {
  const dt = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

/** Lo último del proyecto: etapas cumplidas, tareas hechas, documentos y pagos. */
function ProjectActivity({ p, tasks, docs }) {
  const items = [];
  (p.stages || []).forEach((st, i) => st.done && st.doneAt && items.push({ at: st.doneAt, id: `st-${i}`, title: `Etapa «${st.name}» hecha`, marker: { kind: 'check', color: 'var(--success)' } }));
  tasks.forEach((t) => t.status === 'done' && t.doneAt && items.push({ at: t.doneAt, id: `t-${t.id}`, title: <a href={`#/tareas/${t.id}`} className="hover:underline">{taskKey(t)} · {t.title || 'Sin título'}</a>, marker: { icon: CircleCheck, color: 'var(--success)' } }));
  docs.forEach((d) => {
    if (d.issueDate && d.status !== 'draft') items.push({ at: d.issueDate, id: `d-${d.id}`, title: <a href={`#/documentos/${d.id}`} className="hover:underline">{DOC_WORD[d.type]} {d.number || ''}</a>, marker: { icon: Receipt } });
    (d.payments || []).forEach((pay) => items.push({ at: pay.date, id: `p-${pay.id}`, title: `Cobrado ${money(Number(pay.amount) || 0, d.currency)}`, marker: { icon: CircleCheck, color: 'var(--success)' } }));
  });
  const list = items.filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
  if (!list.length) return <p className="text-sm text-muted">Aquí saldrán las etapas cumplidas, las tareas hechas y los cobros.</p>;
  return <Timeline label="Actividad del proyecto" items={list.map((x) => ({ ...x, trailing: whenText(x.at) }))} />;
}

export function ProjectForm({ project, onClose, onSaved }) {
  const [state] = useCrm();
  const [p] = useState(() => (project ? structuredClone(project) : newProject()));
  const [name, setName] = useState(p.name);
  const [code, setCode] = useState(p.code || '');
  const [codeTouched, setCodeTouched] = useState(Boolean(p.code));
  const [customerId, setCustomerId] = useState(p.customerId);
  const [currency, setCurrency] = useState(p.currency);
  const [budget, setBudget] = useState(Number(p.budget) || 0);
  const [rate, setRate] = useState(Number(p.rate) || 0);
  const [start, setStart] = useState(p.startDate || '');
  const [due, setDue] = useState(p.dueDate || '');
  const [error, setError] = useState('');
  const fail = (msg) => {
    setError(msg);
    return false;
  };
  const shownCode = codeTouched ? code : name.trim() ? codeFrom(name, takenCodes(p.id)) : '';

  return (
    <FormModal
      title={project ? 'Editar proyecto' : 'Nuevo proyecto'}
      onClose={onClose}
      submit={project ? 'Guardar' : 'Crear proyecto'}
      onSubmit={(f) => {
        if (!name.trim()) return fail('Escribe el nombre.');
        const next = cleanCode(shownCode) || codeFrom(name, takenCodes(p.id));
        if (!/^[A-Z][A-Z0-9]{0,5}$/.test(next)) return fail('La clave tiene que empezar por una letra.');
        if (takenCodes(p.id).has(next)) return fail(`La clave ${next} ya la usa otro proyecto.`);
        if (!customerId) return fail('Elige de qué cliente es el proyecto.');
        if (project?.code && project.code !== next) p.oldCodes = [...new Set([...(p.oldCodes || []), project.code])].filter((c) => c !== next).slice(-10);
        Object.assign(p, {
          name: name.trim(),
          code: next,
          customerId,
          currency,
          budget,
          rate,
          startDate: start,
          dueDate: due,
          description: String(f.description || '').trim(),
        });
        put('projects', p);
        toast.success(project ? 'Proyecto guardado' : `Proyecto ${next} creado`);
        onSaved?.(p);
        return true;
      }}
    >
      <TextField isRequired value={name} onChange={setName} maxLength={120} autoFocus>
        <Label>Nombre</Label>
        <Input placeholder="Rediseño de la web" />
      </TextField>
      <TextField
        value={shownCode}
        onChange={(t) => {
          setCode(cleanCode(t));
          setCodeTouched(true);
        }}
        maxLength={6}
      >
        <Label>Clave</Label>
        <Input placeholder="WEB" className="font-mono uppercase" />
        <Description>Las tareas se numeran con ella: {shownCode || 'WEB'}-12.</Description>
      </TextField>
      <SelectField
        label="Cliente"
        value={customerId}
        onChange={(id) => {
          setCustomerId(id);
          const c = find('customers', id);
          if (!project && c?.currency) setCurrency(c.currency);
        }}
        options={state.customers.map((c) => [c.id, c.name])}
        placeholder="¿De quién es?"
      />
      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} showName={false} className="sm:col-span-2" />
      <AmountField label={`Presupuesto (${currency})`} value={budget} onChange={setBudget} />
      <AmountField label={`Tarifa por hora (${currency})`} value={rate} onChange={setRate} description="La de sus tareas y horas, si no tienen otra." />
      <DateInput label="Empieza" value={start} onChange={setStart} />
      <DateInput label="Entrega" value={due} onChange={setDue} />
      <TextField name="description" defaultValue={p.description} maxLength={2000} className="sm:col-span-2">
        <Label>Descripción</Label>
        <TextArea rows={2} />
      </TextField>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </FormModal>
  );
}

function ProjectCard({ p }) {
  const s = projectStats(p);
  const c = customerOf(p);
  const [label, color] = [PROJECT_STATUS[p.status]?.[0], STATUS_COLOR[p.status]];
  return (
    <a href={`#/proyectos/${p.id}`} className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <Card className="h-full gap-3 transition-colors hover:bg-surface-hover">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-xs text-muted">{projectCode(p)}</span>
            <span className="truncate font-semibold">{p.name || 'Sin nombre'}</span>
            <span className="truncate text-xs text-muted">{c?.name || 'Sin cliente'}</span>
          </div>
          <StatusChip label={label} color={color} />
        </div>
        <ProgressBar value={s.progress * 100} size="sm" color={p.status === 'completed' ? 'success' : 'accent'} aria-label="Etapas">
          <span className="text-xs text-muted">
            {s.stagesDone}/{s.stagesTotal} etapas
          </span>
          <ProgressBar.Output className="text-xs text-muted">{`${s.done.length}/${s.tasks.length} tareas`}</ProgressBar.Output>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{s.budget ? `${money(s.earned, s.cur)} de ${money(s.budget, s.cur)}` : `${money(s.earned, s.cur)} ganado`}</span>
          <span>{durationText(s.minutes)}</span>
        </div>
      </Card>
    </a>
  );
}

export function Proyectos({ isNew }) {
  const [state, v] = useCrm();
  const [filter, setFilter] = useState('open');
  const [creating, setCreating] = useState(false);
  const all = state.projects;
  const list = useMemo(
    () =>
      all
        .filter((p) => (filter === 'all' ? true : filter === 'open' ? p.status !== 'completed' : p.status === filter))
        .sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    [all, v, filter],
  );
  const count = (f) => all.filter((p) => (f === 'all' ? true : f === 'open' ? p.status !== 'completed' : p.status === f)).length;
  const showForm = creating || isNew;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Trabajo"
        title="Proyectos"
        description={`${count('active')} en curso · ${count('pending')} pendientes · ${count('completed')} completados`}
        actions={
          <Button onPress={() => setCreating(true)}>
            <Plus />
            Nuevo proyecto
          </Button>
        }
      />
      {all.length === 0 ? (
        <Empty icon={Folder} title="Todavía no hay proyectos" text="Cada proyecto es de un cliente: tiene etapas, tareas, horas y sus documentos." action={<Button onPress={() => setCreating(true)}>Nuevo proyecto</Button>} />
      ) : (
        <>
          <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Filtrar proyectos">
                {[
                  ['open', 'Abiertos'],
                  ['active', 'En curso'],
                  ['pending', 'Pendientes'],
                  ['paused', 'En pausa'],
                  ['completed', 'Completados'],
                  ['all', 'Todos'],
                ].map(([k, label]) => (
                  <Tabs.Tab key={k} id={k}>
                    {label}
                    <span className="ms-1 text-xs text-muted">{count(k)}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          {list.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Ninguno en este filtro.</p>
          )}
        </>
      )}
      {/* Crear es un asistente por pasos; editar sigue en ProjectForm. */}
      {showForm && (
        <NuevoProyecto
          onClose={() => {
            setCreating(false);
            if (isNew) go('#/proyectos');
          }}
          onCreated={(p) => setTimeout(() => go(`#/proyectos/${p.id}`), 0)}
        />
      )}
    </div>
  );
}

/** Facturar horas: elegir el tramo y cómo agrupar; crea la factura y la abre. */
function BillHours({ p, onClose }) {
  const [period, setPeriod] = useState('all');
  const [group, setGroup] = useState('task');
  const work = unbilledWork(p, period);
  const minutes = work.entries.reduce((s, e) => s + (Number(e.minutes) || 0), 0);
  const nothing = !work.entries.length && !work.tasks.length;
  return (
    <FormModal
      title={`Facturar horas de ${p.name}`}
      submit="Crear la factura"
      onClose={onClose}
      onSubmit={() => {
        if (nothing) return false;
        const doc = billWork(p, { ...work, group });
        toast.success('Factura creada con lo pendiente');
        setTimeout(() => go(`#/documentos/${doc.id}`), 0);
        return true;
      }}
    >
      <SelectField label="Qué horas" value={period} onChange={setPeriod} options={BILL_PERIODS} className="sm:col-span-2" />
      <RadioGroup value={group} onChange={setGroup} className="sm:col-span-2">
        <Label>Una línea por</Label>
        {[
          ['task', 'Tarea', 'Las horas de cada tarea juntas.'],
          ['day', 'Día', 'El trabajo de cada día.'],
          ['entry', 'Entrada', 'Cada registro de horas por separado.'],
        ].map(([k, label, desc]) => (
          <Radio key={k} value={k}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {label}
            </Radio.Content>
            <Description>{desc}</Description>
          </Radio>
        ))}
      </RadioGroup>
      <p className={`rounded-2xl bg-surface-secondary p-3 text-sm sm:col-span-2 ${nothing ? 'text-muted' : ''}`}>
        {nothing ? 'No hay nada pendiente de facturar en ese tramo.' : `${work.entries.length} registros (${durationText(minutes)}) y ${work.tasks.length} tareas a precio cerrado.`}
      </p>
    </FormModal>
  );
}

export function Proyecto({ id }) {
  const [, v] = useCrm();
  const [editing, setEditing] = useState(false);
  const [billing, setBilling] = useState(false);
  const p = find('projects', id);
  const s = useMemo(() => (p ? projectStats(p) : null), [p, v]);
  if (!p) return <Empty icon={Folder} title="Ese proyecto ya no existe" action={<Button onPress={() => go('#/proyectos')}>Ver proyectos</Button>} />;
  const c = customerOf(p);
  const tasks = [...s.tasks].sort((a, b) => Object.keys(TASK_STATUS).indexOf(a.status) - Object.keys(TASK_STATUS).indexOf(b.status));

  return (
    <div className="flex flex-col gap-6">
      <Link href="#/proyectos" className="w-fit text-sm text-muted">
        <ArrowLeft className="size-4" />
        Proyectos
      </Link>
      <PageHeader
        eyebrow={`${projectCode(p)} · ${c?.name || 'Sin cliente'}`}
        title={p.name}
        description={[p.startDate && `Desde el ${shortDate(p.startDate)}`, p.dueDate && `entrega el ${shortDate(p.dueDate)}`].filter(Boolean).join(', ') || undefined}
        actions={
          <>
            <Dropdown>
              <Button variant="secondary">
                <StatusChip label={PROJECT_STATUS[p.status][0]} color={STATUS_COLOR[p.status]} />
                <ChevronDown />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  aria-label="Estado"
                  selectionMode="single"
                  selectedKeys={new Set([p.status])}
                  onAction={(k) => {
                    setProjectStatus(p, String(k));
                    put('projects', p);
                  }}
                >
                  {Object.entries(PROJECT_STATUS).map(([k, [label]]) => (
                    <Dropdown.Item key={k} id={k} textValue={label}>
                      <Label>{label}</Label>
                      <Dropdown.ItemIndicator />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
            <ButtonGroup>
              <Button onPress={() => go(`#/tareas/nueva?p=${p.id}`)}>
                <Plus />
                Nueva tarea
              </Button>
              <Dropdown>
                <Button isIconOnly variant="primary" aria-label="Más acciones del proyecto">
                  <ButtonGroup.Separator />
                  <ChevronDown />
                </Button>
                <Dropdown.Popover placement="bottom end">
                  <Dropdown.Menu
                    aria-label="Acciones"
                    onAction={(k) => {
                      if (k === 'edit') setEditing(true);
                      if (k === 'bill') setBilling(true);
                      if (k === 'hours') go(`#/horas/nueva?p=${p.id}`);
                    }}
                  >
                    <Dropdown.Item id="edit" textValue="Editar">
                      <Pencil className="size-4" />
                      <Label>Editar proyecto</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="hours" textValue="Registrar horas">
                      <Clock className="size-4" />
                      <Label>Registrar horas</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="bill" textValue="Facturar horas">
                      <Receipt className="size-4" />
                      <Label>Facturar horas</Label>
                      <Description>{s.unbilledValue ? `${money(s.unbilledValue, s.cur)} pendientes` : 'Nada pendiente'}</Description>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Presupuesto restante" value={money(s.left, s.cur)} tone={s.left < 0 ? 'var(--danger)' : undefined} sub={s.budget ? `de ${money(s.budget, s.cur)}` : 'Sin presupuesto'} />
        <Stat label="Ganado" value={money(s.earned, s.cur)} sub="Horas y tareas cerradas" />
        <Stat label="Facturado" value={money(s.invoiced, s.cur)} sub={`${s.invoices.length} facturas`} />
        <Stat label="Cobrado" value={money(s.paid, s.cur)} sub={s.due ? `faltan ${money(s.due, s.cur)}` : 'Al día'} />
        <Stat label="Horas" value={durationText(s.minutes)} sub={s.unbilledMinutes ? `${durationText(s.unbilledMinutes)} sin facturar` : 'Todo facturado'} />
        <Stat label="Tareas" value={`${s.done.length}/${s.tasks.length}`} sub="hechas" />
      </div>

      {(p.stages || []).length > 0 && (
        <Panel title="Etapas" description="Toca una etapa para marcarla hecha (y las de antes); toca una hecha para volver a ella.">
          <ScrollShadow orientation="horizontal" hideScrollBar className="-mx-1 px-1 pb-1">
            <Stepper
              orientation="horizontal"
              label="Etapas del proyecto"
              className="min-w-[30rem]"
              current={(p.stages || []).filter((st) => st.done).length}
              steps={p.stages.map((st, i) => ({
                id: st.id || `${i}-${st.name}`,
                title: st.name,
                description: st.done && st.doneAt ? shortDate(st.doneAt.slice(0, 10)) : undefined,
              }))}
              onChange={(i) => {
                toggleStage(p, i);
                put('projects', p);
              }}
            />
          </ScrollShadow>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Tareas"
          description={`${s.tasks.length} en total`}
          className="lg:col-span-2"
          action={
            <Link href={`#/tareas?p=${p.id}`} className="text-sm">
              Tablero
            </Link>
          }
        >
          {tasks.length ? (
            <ul className="flex flex-col">
              {tasks.map((t) => (
                <li key={t.id}>
                  <a href={`#/tareas/${t.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                    {t.status === 'done' ? <CircleCheck className="size-4 text-success" /> : <ListCheck className="size-4 text-muted" />}
                    <span className="font-mono text-xs text-muted">{taskKey(t)}</span>
                    <span className={`flex-1 truncate text-sm ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{t.title || 'Sin título'}</span>
                    <Chip size="sm" variant="soft" color={TASK_COLOR[t.status]}>
                      {TASK_STATUS[t.status]?.[0]}
                    </Chip>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin tareas todavía.</p>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Documentos">
          {s.docs.length ? (
            <ul className="flex flex-col">
              {s.docs.map((d) => {
                const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.draft;
                return (
                  <li key={d.id}>
                    <a href={`#/documentos/${d.id}`} className="flex items-center gap-2 rounded-2xl px-2 py-2 text-sm hover:bg-surface-secondary">
                      <span className="flex-1 truncate">
                        {DOC_WORD[d.type]} {d.number || '(borrador)'}
                      </span>
                      <StatusChip label={st[0]} color={st[1]} />
                      <span className="tabular-nums text-muted">{money(totals(d).total, d.currency)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin documentos. En una factura, el chip «Proyecto» la enlaza aquí.</p>
          )}
        </Panel>
        <PagesPanel projectId={p.id} />
        <Panel title="Actividad">
          <ProjectActivity p={p} tasks={s.tasks} docs={s.docs} />
        </Panel>
        </div>
      </div>

      {p.description && (
        <Panel title="Descripción">
          <RichView value={p.description} className="text-sm" />
        </Panel>
      )}

      <div className="flex justify-end">
        <ConfirmButton
          title={`¿Eliminar ${p.name}?`}
          text="Se borran sus tareas y sus horas. Los documentos y las páginas se quedan, sin proyecto."
          onConfirm={() => {
            removeProject(p);
            go('#/proyectos');
          }}
        >
          Eliminar proyecto
        </ConfirmButton>
      </div>
      {editing && <ProjectForm project={p} onClose={() => setEditing(false)} />}
      {billing && <BillHours p={p} onClose={() => setBilling(false)} />}
    </div>
  );
}
