// Leads: quien todavía no es cliente. Embudo por etapas (se mueve con el menú de
// cada tarjeta), lista ordenable, análisis y la ficha con el siguiente paso, lo
// hablado y «Pasar a cliente». Las reglas son las del panel de siempre.
import { useMemo, useState } from 'react';
import { ArrowRightArrowLeft, CircleCheck, Clock, EllipsisVertical, Funnel, PersonPlus, Plus, TrashBin } from '@gravity-ui/icons';
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
  const [reason, setReason] = useState(LOST_REASONS[0]);
  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            {({ close }) => (
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  const other = String(new FormData(e.currentTarget).get('other') || '').trim();
                  setLeadStage(lead, 'lost', reason === 'Otro' && other ? other : reason);
                  toast(`${leadName(lead)} pasó a «Perdido»`);
                  close();
                }}
              >
                <Modal.Header>
                  <Modal.Heading>¿Por qué se perdió {leadName(lead)}?</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  <RadioGroup value={reason} onChange={setReason} aria-label="Motivo">
                    {LOST_REASONS.map((r) => (
                      <Radio key={r} value={r}>
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          {r}
                        </Radio.Content>
                      </Radio>
                    ))}
                  </RadioGroup>
                  {reason === 'Otro' && (
                    <TextField name="other" maxLength={120} autoFocus>
                      <Label>Otro motivo</Label>
                      <Input placeholder="Cuéntalo en pocas palabras" />
                    </TextField>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary">
                    Cancelar
                  </Button>
                  <Button type="submit" variant="danger">
                    Marcar como perdido
                  </Button>
                </Modal.Footer>
              </Form>
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

function LeadCard({ lead, onLost }) {
  const value = leadValue(lead);
  return (
    <Card variant="default" className="gap-2 p-3">
      <div className="flex items-start gap-2">
        <a href={`#/leads/${lead.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Person name={leadName(lead)} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{leadName(lead)}</span>
            <span className="truncate text-xs text-muted">{lead.interest || SOURCES[lead.source] || '—'}</span>
          </span>
        </a>
        <StageMenu
          lead={lead}
          onLost={onLost}
          trigger={
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Mover ${leadName(lead)}`}>
              <EllipsisVertical />
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value ? <span className="text-xs font-medium tabular-nums">{money(value, lead.currency || base())}</span> : null}
        <Chip size="sm" variant="tertiary">
          {SOURCES[lead.source] || 'Otro'}
        </Chip>
        <FollowChip lead={lead} />
      </div>
    </Card>
  );
}

function Board({ leads, onLost }) {
  return (
    <ScrollShadow orientation="horizontal" className="-mx-1 pb-2">
      <div className="flex w-max gap-3 px-1">
        {STAGE_ORDER.map((s) => {
          const items = leads.filter((l) => l.stage === s);
          const { sum } = sumLeads(items);
          return (
            <section key={s} className="flex w-64 shrink-0 flex-col gap-2 rounded-3xl bg-surface-secondary p-2" aria-label={LEAD_STAGES[s][0]}>
              <header className="flex items-center justify-between px-2 pt-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Chip size="sm" variant="soft" color={LEAD_STAGES[s][1]}>
                    {items.length}
                  </Chip>
                  {LEAD_STAGES[s][0]}
                </span>
                <span className="text-xs tabular-nums text-muted">{sum ? fmt(sum) : ''}</span>
              </header>
              {items.length ? (
                items.map((l) => <LeadCard key={l.id} lead={l} onLost={onLost} />)
              ) : (
                <p className="px-2 py-4 text-center text-xs text-muted">Vacía</p>
              )}
            </section>
          );
        })}
      </div>
    </ScrollShadow>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevos este mes" value={String(nowNew)} delta={change(nowNew, prevNew)} sub="Frente al mismo tramo del mes pasado" />
        <Stat label="Ganados este mes" value={String(nowWon)} delta={change(nowWon, prevWon)} sub="Pasaron a «Ganado»" />
        <Stat label="Conversión" value={conv == null ? '—' : `${Math.round(conv * 100)} %`} sub={`${closed.length} cerrados (ganados o perdidos)`} />
        <Stat label="Valor del embudo" value={fmt(pipeline.sum)} sub={pipeline.other ? `${pipeline.other} en otra moneda` : 'Ponderado por la probabilidad'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Embudo" description="Cuántos llegaron a cada etapa">
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
        </Panel>
        <Panel title="Por fuente">
          <ul className="flex flex-col gap-2 text-sm">
            {bySource.length ? (
              bySource.map(([src, n]) => (
                <li key={src} className="flex items-center justify-between">
                  <span>{SOURCES[src] || 'Otro'}</span>
                  <span className="tabular-nums text-muted">{n}</span>
                </li>
              ))
            ) : (
              <li className="text-muted">Sin datos.</li>
            )}
          </ul>
        </Panel>
        <Panel title="Motivos de pérdida">
          <ul className="flex flex-col gap-2 text-sm">
            {reasons.length ? (
              reasons.map(([why, n]) => (
                <li key={why} className="flex items-center justify-between">
                  <span>{why}</span>
                  <span className="tabular-nums text-muted">{n}</span>
                </li>
              ))
            ) : (
              <li className="text-muted">Ninguno perdido.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** Ficha del lead, en un panel lateral. Cada cambio se guarda solo. */
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
    <Drawer isOpen={ready} onOpenChange={(open) => ready && !open && go('#/leads')}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-full sm:max-w-[520px]">
            <Drawer.CloseTrigger />
            <Drawer.Header className="flex-row items-center gap-3">
              <Person name={leadName(l)} size="md" />
              <div className="flex min-w-0 flex-col">
                <Drawer.Heading className="truncate">{isNew ? 'Nuevo lead' : leadName(l)}</Drawer.Heading>
                <span className="text-xs text-muted">Llegó el {shortDate(l.createdOn)} por {SOURCES[l.source] || 'otra vía'}</span>
              </div>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <StageMenu
                  lead={l}
                  onLost={onLost}
                  trigger={
                    <Button size="sm" variant="secondary">
                      <ArrowRightArrowLeft />
                      {stageOf(l)[0]}
                    </Button>
                  }
                />
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
                <Select selectedKey={l.source || 'other'} onSelectionChange={(k) => save({ source: String(k) })}>
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

              <Separator />
              <div className="flex flex-col gap-3">
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
                <ol className="flex flex-col gap-2">
                  {(l.activities || []).map((a) => (
                    <li key={a.id} className="rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
                      <span className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span>{a.type === 'stage' ? 'Etapa' : ACTIVITIES[a.type] || 'Nota'}</span>
                        <span>{new Date(a.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span className="whitespace-pre-line">{a.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Drawer.Body>
            <Drawer.Footer className="justify-between">
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
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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
