// Leads: quien todavía no es cliente. Embudo por etapas (se mueve con el menú de
// cada tarjeta), lista ordenable, análisis y la ficha (una ventana amplia: a la
// izquierda el siguiente paso, la etapa y los datos; a la derecha, lo hablado) con
// «Pasar a cliente». Las reglas son las del panel de siempre.
import { useMemo, useState } from 'react';
import { ArrowRightArrowLeft, Circle, CircleCheck, CircleXmark, Clock, Comment, EllipsisVertical, Envelope, FileText, Funnel, Handset, PersonPlus, Persons, Plus, TrashBin } from '@gravity-ui/icons';
import { getLocalTimeZone, parseDate, today as todayDate } from '@internationalized/date';
import {
  AlertDialog,
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Description,
  Drawer,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Meter,
  Modal,
  NumberField,
  Radio,
  RadioGroup,
  ScrollShadow,
  SearchField,
  Select,
  Separator,
  Slider,
  Table,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { addDays, find, put, remove } from '../../../negocio-core.js';
import { Empty, PageHeader, Panel, Person, Stat } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { useOpenAfterGesture } from '../../kit/hooks.js';
import { ComposedChart, DonutChart, Kanban, KpiGroup, QuestionCard, Timeline, Widget } from '../../pro/index.js';
import { monthKeys, monthLabel } from '../series.js';
import {
  ACTIVITIES,
  LEAD_STAGES,
  LOST_REASONS,
  OPEN_STAGES,
  SOURCES,
  STAGE_ORDER,
  base,
  change,
  fmt,
  followText,
  isDue,
  leadName,
  leadToCustomer,
  leadValue,
  logActivity,
  newLead,
  periodRange,
  probOf,
  setLeadStage,
  shortDate,
  stageOf,
  sumLeads,
  todayISO,
  within,
} from '../domain.js';
import { money } from '../../../negocio-core.js';

const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const toDate = (iso) => {
  try {
    return iso ? parseDate(iso) : null;
  } catch {
    return null;
  }
};

function StageChip({ lead, size = 'sm' }) {
  const [label, color] = stageOf(lead);
  return (
    <Chip size={size} variant="soft" color={color}>
      {label}
    </Chip>
  );
}

function FollowChip({ lead }) {
  if (!lead.nextAt || !OPEN_STAGES.includes(lead.stage)) return null;
  const today = todayISO();
  const color = lead.nextAt < today ? 'danger' : lead.nextAt === today ? 'warning' : 'default';
  return (
    <Chip size="sm" variant="soft" color={color}>
      <Clock className="size-3" />
      <Chip.Label>{followText(lead.nextAt, today)}</Chip.Label>
    </Chip>
  );
}

/** Pide el motivo antes de marcar un lead como perdido. */
function LostDialog({ lead, onClose }) {
  const [other, setOther] = useState('');
  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          {/* La tarjeta de preguntas hace de diálogo: una pregunta, sus opciones y «Marcar como perdido». */}
          <Modal.Dialog aria-label={`¿Por qué se perdió ${leadName(lead)}?`} className="bg-transparent p-0 shadow-none sm:max-w-[440px]">
            {({ close }) => (
              <QuestionCard
                question={`¿Por qué se perdió ${leadName(lead)}?`}
                description="Saldrá en el análisis de los leads perdidos."
                options={LOST_REASONS.map((r) => [r, r])}
                defaultValue={LOST_REASONS[0]}
                continueLabel="Marcar como perdido"
                continueVariant="danger"
                onClose={close}
                onContinue={(reason) => {
                  const text = other.trim();
                  if (reason === 'Otro' && !text) return toast.warning('Cuenta el motivo en pocas palabras.');
                  setLeadStage(lead, 'lost', reason === 'Otro' ? text : reason);
                  toast(`${leadName(lead)} pasó a «Perdido»`);
                  return close();
                }}
              >
                {(reason) =>
                  reason === 'Otro' && (
                    <TextField value={other} onChange={setOther} maxLength={120} autoFocus>
                      <Label>Otro motivo</Label>
                      <Input placeholder="Cuéntalo en pocas palabras" />
                    </TextField>
                  )
                }
              </QuestionCard>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Menú para mover un lead de etapa. */
function StageMenu({ lead, onLost, trigger }) {
  return (
    <Dropdown>
      {trigger}
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label="Mover a otra etapa"
          selectionMode="single"
          selectedKeys={new Set([lead.stage])}
          onAction={(key) => {
            const stage = String(key);
            if (stage === lead.stage) return;
            if (stage === 'lost') return onLost(lead);
            setLeadStage(lead, stage);
            toast(stage === 'won' ? `¡Ganado! Pásalo a cliente desde su ficha.` : `${leadName(lead)} → ${LEAD_STAGES[stage][0]}`);
          }}
        >
          {STAGE_ORDER.map((s) => (
            <Dropdown.Item key={s} id={s} textValue={LEAD_STAGES[s][0]}>
              <Label>{LEAD_STAGES[s][0]}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function LeadCard({ lead }) {
  const value = leadValue(lead);
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex min-w-0 items-center gap-2 pe-6">
        <Person name={leadName(lead)} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{leadName(lead)}</span>
          <span className="truncate text-xs text-muted">{lead.interest || SOURCES[lead.source] || '—'}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value ? <span className="text-xs font-medium tabular-nums">{money(value, lead.currency || base())}</span> : null}
        <Chip size="sm" variant="tertiary">
          {SOURCES[lead.source] || 'Otro'}
        </Chip>
        <FollowChip lead={lead} />
      </div>
    </div>
  );
}

const STAGE_ICON = { won: CircleCheck, lost: CircleXmark };
const ACTIVITY_ICON = { message: Comment, call: Handset, email: Envelope, meeting: Persons, note: FileText, stage: ArrowRightArrowLeft };
const colorVar = (c) => (c && c !== 'default' ? `var(--${c})` : 'var(--muted)');

/** Embudo: una columna por etapa; se arrastra una tarjeta para cambiarla de etapa. */
function Board({ leads, onLost }) {
  const columns = STAGE_ORDER.map((s) => {
    const { sum } = sumLeads(leads.filter((l) => l.stage === s));
    return { id: s, title: LEAD_STAGES[s][0], icon: STAGE_ICON[s] || Circle, color: colorVar(LEAD_STAGES[s][1]), meta: sum ? fmt(sum) : '' };
  });
  const move = (key, stage) => {
    const lead = leads.find((l) => l.id === key);
    if (!lead || stage === lead.stage) return;
    if (stage === 'lost') return onLost(lead);
    setLeadStage(lead, stage);
    toast(stage === 'won' ? '¡Ganado! Pásalo a cliente desde su ficha.' : `${leadName(lead)} → ${LEAD_STAGES[stage][0]}`);
  };
  return (
    <Kanban
      label="Embudo de leads"
      columns={columns}
      items={leads}
      getColumn={(l) => l.stage}
      onMove={move}
      onOpen={(l) => go(`#/leads/${l.id}`)}
      cardMenu={(l) => (l.stage === 'won' && !l.customerId ? [{ id: 'customer', label: 'Pasar a cliente', icon: PersonPlus }] : [])}
      onCardMenu={(id, l) => {
        if (id === 'customer') {
          const [c, isNew] = leadToCustomer(l);
          toast(isNew ? `${c.name} ya es cliente` : `Vinculado a ${c.name}`);
        }
      }}
      columnWidth={264}
      renderCard={(l) => <LeadCard lead={l} />}
    />
  );
}

function List({ leads }) {
  const [sort, setSort] = useState({ column: 'next', direction: 'ascending' });
  const rows = useMemo(() => {
    const key = (l) =>
      ({ name: plain(leadName(l)), stage: STAGE_ORDER.indexOf(l.stage), value: leadValue(l) || 0, next: l.nextAt || '9999', created: l.createdOn || '' })[sort.column];
    return [...leads].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.direction === 'descending' ? -cmp : cmp;
    });
  }, [leads, sort]);
  const col = (id, label, cls) => (
    <Table.Column allowsSorting id={id} className={cls} isRowHeader={id === 'name'}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Leads" className="min-w-[720px]" sortDescriptor={sort} onSortChange={setSort} onRowAction={(id) => go(`#/leads/${id}`)}>
          <Table.Header>
            {col('name', 'Lead')}
            {col('stage', 'Etapa')}
            <Table.Column>Fuente</Table.Column>
            {col('value', 'Valor', 'text-end')}
            {col('next', 'Siguiente paso')}
            {col('created', 'Llegó')}
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="p-6 text-center text-sm text-muted">Ningún lead coincide.</p>}>
            {rows.map((l) => (
              <Table.Row key={l.id} id={l.id} className="cursor-pointer">
                <Table.Cell>
                  <span className="flex items-center gap-2">
                    <Person name={leadName(l)} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{leadName(l)}</span>
                      <span className="truncate text-xs text-muted">{l.interest || l.company || '—'}</span>
                    </span>
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <StageChip lead={l} />
                </Table.Cell>
                <Table.Cell>{SOURCES[l.source] || 'Otro'}</Table.Cell>
                <Table.Cell className="text-end tabular-nums">{leadValue(l) ? money(leadValue(l), l.currency || base()) : '—'}</Table.Cell>
                <Table.Cell>
                  <span className="flex items-center gap-2">
                    <FollowChip lead={l} />
                    <span className="truncate text-xs text-muted">{OPEN_STAGES.includes(l.stage) ? l.nextNote : ''}</span>
                  </span>
                </Table.Cell>
                <Table.Cell className="text-muted">{shortDate(l.createdOn)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function Analysis({ leads }) {
  const r = periodRange('month');
  const created = (l, range) => within(l.createdOn, range);
  const wonIn = (l, range) => l.stage === 'won' && within((l.wonAt || '').slice(0, 10), range);
  const nowNew = leads.filter((l) => created(l, r)).length;
  const prevNew = r.prev ? leads.filter((l) => created(l, r.prev)).length : 0;
  const nowWon = leads.filter((l) => wonIn(l, r)).length;
  const prevWon = r.prev ? leads.filter((l) => wonIn(l, r.prev)).length : 0;
  const closed = leads.filter((l) => l.stage === 'won' || l.stage === 'lost');
  const conv = closed.length ? leads.filter((l) => l.stage === 'won').length / closed.length : null;
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const pipeline = sumLeads(open, true);
  const reached = (l) => (l.stage === 'won' ? OPEN_STAGES.length : l.stage === 'lost' ? Math.max(0, OPEN_STAGES.indexOf(l.lostFrom || 'new')) : Math.max(0, OPEN_STAGES.indexOf(l.stage)));
  const funnel = [...OPEN_STAGES, 'won'].map((s, i) => ({ s, n: leads.filter((l) => reached(l) >= i).length }));
  const bySource = Object.entries(
    leads.reduce((acc, l) => {
      acc[l.source || 'other'] = (acc[l.source || 'other'] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const reasons = Object.entries(
    leads
      .filter((l) => l.stage === 'lost')
      .reduce((acc, l) => {
        acc[l.lostReason || 'Sin motivo'] = (acc[l.lostReason || 'Sin motivo'] || 0) + 1;
        return acc;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, funnel[0]?.n || 1);
  // Mes a mes: los que entraron y los que se ganaron.
  const months = monthKeys(12).map((key) => ({
    key,
    label: monthLabel(key),
    nuevos: leads.filter((l) => (l.createdOn || '').slice(0, 7) === key).length,
    ganados: leads.filter((l) => l.stage === 'won' && (l.wonAt || '').slice(0, 7) === key).length,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Widget title="Este mes" action={<span>vs. el mismo tramo del mes pasado</span>}>
        <KpiGroup
          items={[
            { label: 'Nuevos', value: String(nowNew), delta: change(nowNew, prevNew), trend: months.map((m) => m.nuevos), trendColor: 'var(--accent)' },
            { label: 'Ganados', value: String(nowWon), delta: change(nowWon, prevWon), trend: months.map((m) => m.ganados), trendColor: 'var(--success)' },
            { label: 'Conversión', value: conv == null ? '—' : `${Math.round(conv * 100)} %`, sub: `${closed.length} cerrados (ganados o perdidos)` },
            { label: 'Valor del embudo', value: fmt(pipeline.sum), sub: pipeline.other ? `${pipeline.other} en otra moneda` : 'Ponderado por la probabilidad' },
          ]}
        />
      </Widget>
      <Widget title="Leads por mes" description="Los que entraron y los que se ganaron, en los últimos 12 meses">
        <ComposedChart
          title="Leads nuevos y ganados de los últimos 12 meses"
          xLabel="Mes"
          height={200}
          data={months}
          series={[
            { key: 'nuevos', name: 'Nuevos', type: 'bar', color: 'var(--accent)' },
            { key: 'ganados', name: 'Ganados', type: 'bar', color: 'var(--success)' },
          ]}
          format={(x) => String(x)}
          compact={(x) => (Number.isInteger(x) ? String(x) : '')}
        />
      </Widget>
      <div className="grid gap-4 lg:grid-cols-3">
        <Widget title="Embudo" description="Cuántos llegaron a cada etapa">
          <div className="flex flex-col gap-3">
            {funnel.map(({ s, n }) => (
              <Meter key={s} value={(n / top) * 100} color={s === 'won' ? 'success' : 'accent'} size="sm" aria-label={LEAD_STAGES[s][0]}>
                <Label>{LEAD_STAGES[s][0]}</Label>
                <Meter.Output>{n}</Meter.Output>
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>
            ))}
          </div>
        </Widget>
        <Widget title="Por fuente" description="De dónde llegan">
          {bySource.length ? (
            <DonutChart title="Leads por fuente" parts={bySource.map(([src, n]) => ({ key: src, label: SOURCES[src] || 'Otro', value: n }))} format={(x) => String(x)} totalLabel="Leads" size={140} layout="stack" />
          ) : (
            <p className="text-sm text-muted">Sin datos.</p>
          )}
        </Widget>
        <Widget title="Motivos de pérdida" description="Por qué no salieron">
          {reasons.length ? (
            <DonutChart title="Leads perdidos por motivo" parts={reasons.map(([why, n]) => ({ key: why, label: why, value: n }))} format={(x) => String(x)} totalLabel="Perdidos" size={140} layout="stack" />
          ) : (
            <p className="text-sm text-muted">Ninguno perdido.</p>
          )}
        </Widget>
      </div>
    </div>
  );
}

/** Ficha del lead, en una ventana. Cada cambio se guarda solo. */
function LeadDrawer({ id, onLost }) {
  const [, v] = useCrm();
  const l = find('leads', id);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('message');
  const ready = useOpenAfterGesture();
  if (!l) return null;
  const save = (patch) => {
    Object.assign(l, patch);
    put('leads', l);
  };
  const today = todayISO();
  const isNew = !l.name && !l.company && !(l.activities || []).length;

  return (
    <Modal isOpen={ready} onOpenChange={(open) => ready && !open && go('#/leads')}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[1040px]">
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row flex-wrap items-center gap-3 pe-10">
              <Person name={leadName(l)} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Modal.Heading className="truncate">{isNew ? 'Nuevo lead' : leadName(l)}</Modal.Heading>
                <span className="text-xs text-muted">
                  Llegó{l.createdOn ? ` el ${shortDate(l.createdOn)}` : ''} por {SOURCES[l.source] || 'otra vía'}
                  {leadValue(l) ? ` · ${money(leadValue(l), l.currency || base())}` : ''}
                </span>
              </div>
              <StageChip lead={l} size="md" />
            </Modal.Header>
            <Modal.Body className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex min-w-0 flex-col gap-5">
              {/* La etapa, a la vista: un toque la cambia (Perdido pide el motivo). */}
              <div className="flex flex-col gap-2">
                <span className="sw-eyebrow">Etapa</span>
                <div role="group" aria-label="Etapa del lead" className="flex flex-wrap gap-1 rounded-[1.25rem] bg-surface-secondary p-1">
                  {STAGE_ORDER.map((st) => {
                    const on = l.stage === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          if (on) return;
                          if (st === 'lost') return onLost(l);
                          setLeadStage(l, st);
                          toast(st === 'won' ? '¡Ganado! Pásalo a cliente.' : `${leadName(l)} → ${LEAD_STAGES[st][0]}`);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                          on ? (st === 'won' ? 'bg-success text-success-foreground' : st === 'lost' ? 'bg-danger text-danger-foreground' : 'bg-foreground text-background') : 'text-muted hover:bg-surface hover:text-foreground'
                        }`}
                      >
                        {LEAD_STAGES[st][0]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {l.customerId ? (
                  <Button size="sm" variant="tertiary" onPress={() => go(`#/clientes/${l.customerId}`)}>
                    Ver cliente
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onPress={() => {
                      const [c, created] = leadToCustomer(l);
                      toast.success(created ? `${c.name} ya está en tus clientes` : `${c.name} ya era cliente: quedó enlazado`);
                    }}
                  >
                    <PersonPlus />
                    Pasar a cliente
                  </Button>
                )}
              </div>

              {OPEN_STAGES.includes(l.stage) && (
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="sw-eyebrow">Siguiente paso</span>
                    <FollowChip lead={l} />
                  </div>
                  <TextField aria-label="Qué toca hacer" defaultValue={l.nextNote} onChange={(t) => save({ nextNote: t })} maxLength={160}>
                    <Input placeholder="Llamarla para enseñarle la propuesta" variant="secondary" />
                  </TextField>
                  <div className="flex flex-wrap items-end gap-2">
                    <DatePicker aria-label="Cuándo" value={toDate(l.nextAt)} onChange={(d) => save({ nextAt: d ? d.toString() : '' })} className="w-44">
                      <DateField.Group fullWidth variant="secondary">
                        <DateField.Input>{(seg) => <DateField.Segment segment={seg} />}</DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      <DatePicker.Popover>
                        <Calendar aria-label="Cuándo" minValue={todayDate(getLocalTimeZone()).subtract({ years: 1 })}>
                          <Calendar.Header>
                            <Calendar.Heading />
                            <Calendar.NavButton slot="previous" />
                            <Calendar.NavButton slot="next" />
                          </Calendar.Header>
                          <Calendar.Grid>
                            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                          </Calendar.Grid>
                        </Calendar>
                      </DatePicker.Popover>
                    </DatePicker>
                    {[
                      ['Mañana', 1],
                      ['En 3 días', 3],
                      ['En una semana', 7],
                    ].map(([label, days]) => (
                      <Button key={label} size="sm" variant="tertiary" onPress={() => save({ nextAt: addDays(today, days) })}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-fit"
                    onPress={() => {
                      logActivity(l, 'note', `Hecho: ${l.nextNote || 'seguimiento'}`);
                      save({ nextAt: addDays(today, 3), nextNote: 'Volver a escribirle' });
                      toast.success('Hecho. El siguiente, en 3 días.');
                    }}
                  >
                    <CircleCheck />
                    Hecho
                  </Button>
                </Card>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField defaultValue={l.name} onChange={(t) => save({ name: t })} maxLength={120}>
                  <Label>Nombre</Label>
                  <Input placeholder="Laura Díaz" />
                </TextField>
                <TextField defaultValue={l.company} onChange={(t) => save({ company: t })} maxLength={120}>
                  <Label>Empresa</Label>
                  <Input />
                </TextField>
                <TextField type="email" defaultValue={l.email} onChange={(t) => save({ email: t })} maxLength={160}>
                  <Label>Correo</Label>
                  <Input />
                </TextField>
                <TextField type="tel" defaultValue={l.phone} onChange={(t) => save({ phone: t })} maxLength={60}>
                  <Label>Teléfono</Label>
                  <Input />
                </TextField>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>De dónde llegó</Label>
                  <div role="group" aria-label="De dónde llegó" className="flex flex-wrap gap-1.5">
                    {Object.entries(SOURCES).map(([k, label]) => {
                      const on = (l.source || 'other') === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={on}
                          onClick={() => save({ source: k })}
                          className={`rounded-full px-3 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-accent font-medium text-accent-foreground' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <NumberField value={Number(l.value) || 0} minValue={0} onChange={(n) => save({ value: Number.isFinite(n) ? n : 0 })} formatOptions={{ maximumFractionDigits: 2 }}>
                  <Label>Valor ({l.currency || base()})</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>
                <TextField defaultValue={l.interest} onChange={(t) => save({ interest: t })} maxLength={160} className="sm:col-span-2">
                  <Label>Qué le interesa</Label>
                  <Input placeholder="Una app para su panadería" />
                </TextField>
                {OPEN_STAGES.includes(l.stage) && (
                  <Slider className="sm:col-span-2" value={probOf(l)} step={5} onChange={(n) => save({ probability: n })}>
                    <Label>Probabilidad de cierre</Label>
                    <Slider.Output>{({ state }) => `${state.values[0]} %`}</Slider.Output>
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                )}
                <TextField defaultValue={l.notes} onChange={(t) => save({ notes: t })} maxLength={4000} className="sm:col-span-2">
                  <Label>Notas</Label>
                  <TextArea rows={3} />
                </TextField>
              </div>

              </div>
              <div className="flex min-w-0 flex-col gap-3 lg:border-s lg:border-border lg:ps-6">
                <span className="sw-eyebrow">Lo hablado</span>
                <Form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    logActivity(l, kind, note.trim());
                    put('leads', l);
                    setNote('');
                  }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ACTIVITIES).map(([k, label]) => (
                      <Button key={k} size="sm" variant={kind === k ? 'primary' : 'tertiary'} onPress={() => setKind(k)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <TextField aria-label="Qué pasó" value={note} onChange={setNote} maxLength={1000}>
                    <TextArea rows={2} placeholder="Le mandé la propuesta por WhatsApp…" />
                  </TextField>
                  <Button type="submit" size="sm" variant="secondary" className="w-fit" isDisabled={!note.trim()}>
                    Anotar
                  </Button>
                </Form>
                {(l.activities || []).length > 0 && (
                  <Timeline
                    label="Lo hablado"
                    items={l.activities.map((a) => ({
                      id: a.id,
                      title: a.type === 'stage' ? 'Cambio de etapa' : ACTIVITIES[a.type] || 'Nota',
                      marker: { icon: ACTIVITY_ICON[a.type] || Comment, color: a.type === 'stage' ? 'var(--accent)' : undefined },
                      trailing: new Date(a.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                      description: <span className="whitespace-pre-line text-foreground">{a.text}</span>,
                    }))}
                  />
                )}
              </div>
            </Modal.Body>
            <Modal.Footer className="justify-between">
              <AlertDialog>
                <Button variant="danger-soft" size="sm">
                  <TrashBin />
                  Eliminar
                </Button>
                <AlertDialog.Backdrop>
                  <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-[400px]">
                      <AlertDialog.Header>
                        <AlertDialog.Icon status="danger" />
                        <AlertDialog.Heading>¿Eliminar a {leadName(l)}?</AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>Se borra con todo lo anotado. No se puede deshacer.</AlertDialog.Body>
                      <AlertDialog.Footer>
                        <Button slot="close" variant="tertiary">
                          Cancelar
                        </Button>
                        <Button
                          slot="close"
                          variant="danger"
                          onPress={() => {
                            remove('leads', l.id);
                            go('#/leads');
                          }}
                        >
                          Eliminar
                        </Button>
                      </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                  </AlertDialog.Container>
                </AlertDialog.Backdrop>
              </AlertDialog>
              <Button slot="close" variant="secondary">
                Listo
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Un lead nuevo: se pide lo mínimo y después se completa en su ficha. */
function NewLead({ onClose }) {
  const [source, setSource] = useState('instagram');
  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[440px]">
            {({ close }) => (
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  const l = newLead({ name: String(f.name).trim(), interest: String(f.interest || '').trim(), source });
                  put('leads', l);
                  close();
                  go(`#/leads/${l.id}`);
                }}
              >
                <Modal.Header>
                  <Modal.Heading>Nuevo lead</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  <TextField isRequired name="name" maxLength={120} autoFocus>
                    <Label>Nombre o empresa</Label>
                    <Input placeholder="Laura Díaz" />
                    <FieldError>Escribe cómo se llama.</FieldError>
                  </TextField>
                  <TextField name="interest" maxLength={160}>
                    <Label>Qué le interesa</Label>
                    <Input placeholder="Una app para su panadería" />
                  </TextField>
                  <Select selectedKey={source} onSelectionChange={(k) => setSource(String(k))}>
                    <Label>De dónde llegó</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {Object.entries(SOURCES).map(([k, label]) => (
                          <ListBox.Item key={k} id={k} textValue={label}>
                            {label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Description>El primer contacto queda para hoy. Lo demás se completa en su ficha.</Description>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary">
                    Cancelar
                  </Button>
                  <Button type="submit">Crear lead</Button>
                </Modal.Footer>
              </Form>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function Leads({ id, tab }) {
  const [state, v] = useCrm();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [losing, setLosing] = useState(null);
  const [view, setView] = useState(() => (['embudo', 'lista', 'analisis'].includes(tab) ? tab : localStorage.getItem('negocio-leads-vista') || 'embudo'));

  const all = state.leads || [];
  const leads = useMemo(() => {
    const q = plain(query.trim());
    return all.filter((l) => !q || plain(`${l.name} ${l.company} ${l.email} ${l.phone} ${l.interest}`).includes(q));
  }, [all, v, query]);
  const due = all.filter((l) => isDue(l)).length;
  const open = all.filter((l) => OPEN_STAGES.includes(l.stage));
  const pipeline = sumLeads(open, true);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ventas"
        title="Leads"
        description={`${open.length} abiertos · ${fmt(pipeline.sum)} en el embudo (ponderado)${due ? ` · ${due} para hoy` : ''}`}
        actions={
          <Button onPress={() => setCreating(true)}>
            <Plus />
            Nuevo lead
          </Button>
        }
      />
      {all.length === 0 ? (
        <Empty icon={Funnel} title="Todavía no hay leads" text="Apunta a quien te escribe por Instagram, WhatsApp o la web, y lleva cada conversación hasta que sea cliente." action={<Button onPress={() => setCreating(true)}>Nuevo lead</Button>} />
      ) : (
        <Tabs
          selectedKey={view}
          onSelectionChange={(k) => {
            setView(String(k));
            localStorage.setItem('negocio-leads-vista', String(k));
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Vista">
                {[
                  ['embudo', 'Embudo'],
                  ['lista', 'Lista'],
                  ['analisis', 'Análisis'],
                ].map(([k, label]) => (
                  <Tabs.Tab key={k} id={k}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {view !== 'analisis' && (
              <SearchField aria-label="Buscar leads" value={query} onChange={setQuery} className="w-full sm:w-72">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar un lead…" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            )}
          </div>
          <Tabs.Panel id="embudo" className="pt-4">
            <Board leads={leads} onLost={setLosing} />
          </Tabs.Panel>
          <Tabs.Panel id="lista" className="pt-4">
            <List leads={leads} />
          </Tabs.Panel>
          <Tabs.Panel id="analisis" className="pt-4">
            <Analysis leads={all} />
          </Tabs.Panel>
        </Tabs>
      )}
      {id && id !== 'nuevo' && <LeadDrawer id={id} onLost={setLosing} />}
      {(creating || id === 'nuevo') && (
        <NewLead
          onClose={() => {
            setCreating(false);
            if (id === 'nuevo') go('#/leads');
          }}
        />
      )}
      {losing && <LostDialog lead={losing} onClose={() => setLosing(null)} />}
    </div>
  );
}
