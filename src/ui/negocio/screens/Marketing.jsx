// Crecer › Marketing: el contenido de las marcas del estudio. Calendario del mes,
// tablero editorial, copias listas para pegar, campañas con su coste por lead y
// las marcas. Cada publicación se abre en un panel con todo lo suyo y sus
// resultados. Las reglas son las de negocio-contenido.js.
import { useEffect, useMemo, useState } from 'react';
import { Bulb, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, Copy, Flag, Megaphone, Palette, PaperPlane, PencilToSquare, Plus, TrashBin } from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Drawer,
  Dropdown,
  Input,
  Label,
  Meter,
  ScrollShadow,
  Separator,
  Tabs,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  TimeField,
  toast,
} from '@heroui/react';
import { parseTime } from '@internationalized/date';
import { addDays, find, monthText, numText, put, remove, round2, todayISO } from '../../../negocio-core.js';
import {
  CAMPAIGN_COLORS,
  CAMPAIGN_STATUS,
  FORMATS,
  METRICS,
  POST_CATEGORIES,
  POST_STATUS,
  ROLES,
  STATUS_ORDER,
  TEMPLATES,
  brandColor,
  brands,
  campaignOf,
  campaignStats,
  campaigns,
  engagement,
  ensureBrands,
  igText,
  leadsOf,
  newCampaign,
  newPost,
  pctText,
  pillarsOf,
  template,
  toFacebook,
} from '../../../negocio-contenido.js';
import { Empty, PageHeader, Panel, Stat } from '../../kit/parts.jsx';
import { useOpenAfterGesture } from '../../kit/hooks.js';
import { go, useCrm } from '../store.js';
import { fmt, money } from '../domain.js';
import { AmountField, ConfirmButton, DateInput, FormModal, SelectField } from '../fields.jsx';
import { Agenda, Kanban } from '../../pro/index.js';

const ROLE_HEX = { tof: '#00b8d4', mof: '#8e5bd6', bof: '#34c759', com: '#f97316' };
const STATUS_COLOR = { idea: 'default', guion: 'accent', diseno: 'accent', aprobado: 'success', programado: 'warning', publicado: 'success' };
const TABS = [
  ['calendario', 'Calendario'],
  ['agenda', 'Agenda'],
  ['tablero', 'Tablero'],
  ['copias', 'Copias'],
  ['campanas', 'Campañas'],
  ['marcas', 'Marcas'],
];

async function copy(text, what) {
  if (!String(text || '').trim()) return toast.warning(`No hay ${what.toLowerCase()} que copiar.`);
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  } catch {
    toast.danger('No se pudo copiar');
  }
  return undefined;
}

const toTime = (t) => {
  try {
    return t ? parseTime(t) : null;
  } catch {
    return null;
  }
};

function BrandDot({ post }) {
  const b = post.brandId && find('brands', post.brandId);
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: brandColor(b) }} aria-hidden />;
}

function PostChip({ p }) {
  return (
    <a href={`#/marketing/pieza/${p.id}`} className="flex items-center gap-1.5 truncate rounded-lg bg-surface px-1.5 py-1 text-xs shadow-[var(--surface-shadow)] hover:bg-surface-hover">
      <BrandDot post={p} />
      <span className="truncate">{p.title || 'Sin título'}</span>
    </a>
  );
}

function Calendario({ posts, ym, setYm }) {
  const first = new Date(`${ym}-01T12:00:00`);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
  const weeks = days[35].slice(0, 7) === ym ? 6 : 5;
  const today = todayISO();
  const shift = (n) => {
    const d = new Date(`${ym}-15T12:00:00`);
    d.setMonth(d.getMonth() + n);
    setYm(d.toLocaleDateString('en-CA').slice(0, 7));
  };
  const monthPosts = posts.filter((p) => (p.date || '').slice(0, 7) === ym);
  const roles = Object.keys(ROLES).map((k) => [k, monthPosts.filter((p) => p.role === k).length]);
  const total = Math.max(1, monthPosts.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{monthText(ym)}</h2>
        <ButtonGroup size="sm" variant="secondary">
          <Button isIconOnly aria-label="Mes anterior" onPress={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button onPress={() => setYm(today.slice(0, 7))}>
            <ButtonGroup.Separator />
            Hoy
          </Button>
          <Button isIconOnly aria-label="Mes siguiente" onPress={() => shift(1)}>
            <ButtonGroup.Separator />
            <ChevronRight />
          </Button>
        </ButtonGroup>
      </div>
      {monthPosts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {roles.map(([k, n]) => (
            <Meter key={k} value={(n / total) * 100} size="sm" aria-label={ROLES[k][0]}>
              <Label className="text-xs">{ROLES[k][0]}</Label>
              <Meter.Output className="text-xs">{n}</Meter.Output>
              <Meter.Track>
                <Meter.Fill style={{ background: ROLE_HEX[k] }} />
              </Meter.Track>
            </Meter>
          ))}
        </div>
      )}
      <ScrollShadow orientation="horizontal">
        <div className="grid min-w-[760px] grid-cols-7 gap-1">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <span key={d} className="sw-eyebrow px-1 pb-1">
              {d}
            </span>
          ))}
          {days.slice(0, weeks * 7).map((iso) => {
            const list = posts.filter((p) => p.date === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const out = iso.slice(0, 7) !== ym;
            return (
              <div key={iso} className={`flex min-h-24 flex-col gap-1 rounded-2xl p-1.5 ${out ? 'opacity-40' : 'bg-surface-secondary'} ${iso === today ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${iso === today ? 'font-semibold text-accent' : 'text-muted'}`}>{Number(iso.slice(8))}</span>
                  {!out && (
                    <Button isIconOnly size="sm" variant="ghost" className="size-5 min-w-5" aria-label={`Nueva publicación el ${iso}`} onPress={() => go(`#/marketing/nueva?d=${iso}`)}>
                      <Plus className="size-3" />
                    </Button>
                  )}
                </div>
                {list.slice(0, 3).map((p) => (
                  <PostChip key={p.id} p={p} />
                ))}
                {list.length > 3 && <span className="px-1 text-[10px] text-muted">+{list.length - 3} más</span>}
              </div>
            );
          })}
        </div>
      </ScrollShadow>
    </div>
  );
}

const POST_ICON = { idea: Bulb, guion: PencilToSquare, diseno: Palette, aprobado: CircleCheck, programado: Clock, publicado: PaperPlane };
const statusVar = (c) => (c && c !== 'default' ? `var(--${c})` : 'var(--muted)');

/** Tablero editorial: se arrastra una pieza para cambiarla de etapa. */
function Tablero({ posts }) {
  const sorted = [...posts].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return (
    <Kanban
      label="Tablero editorial"
      columns={STATUS_ORDER.map((s) => ({ id: s, title: POST_STATUS[s][0], icon: POST_ICON[s] || Flag, color: statusVar(STATUS_COLOR[s]) }))}
      items={sorted}
      getColumn={(p) => p.status}
      onMove={(key, status) => {
        const p = find('posts', key);
        if (!p || p.status === status) return;
        put('posts', { ...p, status });
        toast(`${p.title || 'La pieza'} → ${POST_STATUS[status][0]}`);
      }}
      onOpen={(p) => go(`#/marketing/pieza/${p.id}`)}
      cardMenu={() => [{ id: 'dup', label: 'Duplicar a la semana siguiente', icon: Copy }]}
      onCardMenu={(id, p) => {
        if (id !== 'dup') return;
        const copyOf = { ...structuredClone(p), id: newPost().id, status: 'idea', date: p.date ? addDays(p.date, 7) : p.date, metrics: {} };
        put('posts', copyOf);
        toast('Duplicada una semana después');
      }}
      columnWidth={256}
      renderCard={(p) => (
        <div className="flex flex-col gap-1.5 p-3">
          <span className="flex items-center gap-2 pe-6 text-sm font-semibold">
            <BrandDot post={p} />
            <span className="truncate">{p.title || 'Sin título'}</span>
          </span>
          <span className="text-xs text-muted">
            {p.date ? new Date(`${p.date}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha'}
            {p.time ? ` · ${p.time}` : ''}
          </span>
          <div className="flex flex-wrap gap-1">
            <Chip size="sm" variant="tertiary">
              {FORMATS[p.format]?.[0] || p.format || 'Formato'}
            </Chip>
            {ROLES[p.role] && (
              <Chip size="sm" variant="soft">
                <span className="size-1.5 rounded-full" style={{ background: ROLE_HEX[p.role] }} aria-hidden />
                <Chip.Label>{ROLES[p.role][0]}</Chip.Label>
              </Chip>
            )}
          </div>
        </div>
      )}
    />
  );
}

/** Agenda por horas: cada pieza en su día y su hora (media hora), del color de su marca. */
function AgendaView({ posts }) {
  const events = posts
    .filter((p) => p.date)
    .map((p) => {
      const b = p.brandId && find('brands', p.brandId);
      const start = new Date(`${p.date}T${p.time || '09:00'}:00`);
      return {
        id: p.id,
        title: p.title || 'Sin título',
        start,
        end: new Date(start.getTime() + 45 * 60000),
        allDay: !p.time,
        color: brandColor(b) || 'var(--accent)',
      };
    });
  return (
    <Agenda
      events={events}
      onOpen={(e) => go(`#/marketing/pieza/${e.id}`)}
      onCreate={(d) => go(`#/marketing/nueva?d=${d.toLocaleDateString('en-CA')}&t=${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)}
      defaultView="week"
      height={600}
    />
  );
}

function Copias({ posts }) {
  const list = posts.filter((p) => p.status !== 'publicado' && (p.copyIg || p.copyFb)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  if (!list.length) return <Empty icon={Copy} title="No hay copias pendientes" text="Las publicaciones sin publicar que ya tienen copy salen aquí, listas para copiar." />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {list.map((p) => (
        <Card key={p.id} className="gap-3 p-4">
          <a href={`#/marketing/pieza/${p.id}`} className="flex items-center gap-2 font-medium hover:underline">
            <BrandDot post={p} />
            {p.title || 'Sin título'}
          </a>
          <span className="text-xs text-muted">
            {p.date} {p.time} · {FORMATS[p.format]?.[0]}
          </span>
          <p className="line-clamp-4 whitespace-pre-line rounded-2xl bg-surface-secondary p-3 text-sm">{igText(p) || p.copyFb}</p>
          <ButtonGroup size="sm" variant="secondary">
            <Button onPress={() => copy(igText(p), 'Copy de Instagram')}>
              <Copy />
              Instagram
            </Button>
            <Button onPress={() => copy(p.copyFb, 'Copy de Facebook')}>
              <ButtonGroup.Separator />
              Facebook
            </Button>
            <Button
              onPress={() => {
                put('posts', { ...p, status: 'publicado' });
                toast.success('Marcada como publicada');
              }}
            >
              <ButtonGroup.Separator />
              Publicada
            </Button>
          </ButtonGroup>
        </Card>
      ))}
    </div>
  );
}

function CampaignForm({ campaign, onClose }) {
  const [c] = useState(() => (campaign ? { ...campaign } : newCampaign()));
  const [brandId, setBrandId] = useState(c.brandId);
  const [status, setStatus] = useState(c.status);
  const [start, setStart] = useState(c.start);
  const [end, setEnd] = useState(c.end);
  const [budget, setBudget] = useState(Number(c.budget) || 0);
  const [spent, setSpent] = useState(Number(c.spent) || 0);
  const [target, setTarget] = useState(Number(c.leadsTarget) || 0);
  return (
    <FormModal
      title={campaign ? 'Editar campaña' : 'Nueva campaña'}
      onClose={onClose}
      extra={
        campaign && (
          <ConfirmButton title={`¿Eliminar «${campaign.name}»?`} text="Sus publicaciones y leads se quedan, sin campaña." onConfirm={() => { remove('campaigns', campaign.id); onClose(); }} isIconOnly ariaLabel="Eliminar campaña">
            <TrashBin />
          </ConfirmButton>
        )
      }
      onSubmit={(f) => {
        const name = String(f.name || '').trim();
        if (!name) return false;
        put('campaigns', { ...c, name, brandId, status, start, end, budget, spent, leadsTarget: target, goal: String(f.goal || '').trim() });
        return true;
      }}
    >
      <TextField name="name" isRequired defaultValue={c.name} maxLength={120} autoFocus className="sm:col-span-2">
        <Label>Nombre</Label>
        <Input placeholder="Lanzamiento de diciembre" />
      </TextField>
      <SelectField label="Marca" value={brandId} onChange={setBrandId} options={brands().map((b) => [b.id, b.name])} />
      <SelectField label="Estado" value={status} onChange={setStatus} options={Object.entries(CAMPAIGN_STATUS).map(([k, [l]]) => [k, l])} />
      <DateInput label="Empieza" value={start} onChange={setStart} />
      <DateInput label="Termina" value={end} onChange={setEnd} />
      <AmountField label={`Presupuesto (${c.currency})`} value={budget} onChange={setBudget} />
      <AmountField label={`Gastado (${c.currency})`} value={spent} onChange={setSpent} />
      <AmountField label="Leads esperados" value={target} onChange={setTarget} step={1} />
      <TextField name="goal" defaultValue={c.goal} maxLength={300}>
        <Label>Objetivo</Label>
        <Input placeholder="50 descargas" />
      </TextField>
    </FormModal>
  );
}

function Campanas() {
  const [, v] = useCrm();
  const [editing, setEditing] = useState(null);
  const list = useMemo(() => campaigns(), [v]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onPress={() => setEditing('new')}>
          <Plus />
          Nueva campaña
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty icon={Flag} title="Todavía no hay campañas" text="Un lanzamiento, una promoción o un mes de contenido: con fechas, presupuesto y leads esperados." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => {
            const s = campaignStats(c);
            const b = c.brandId && find('brands', c.brandId);
            return (
              <Card key={c.id} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setEditing(c)} className="flex min-w-0 flex-col text-start">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="size-2.5 rounded-full" style={{ background: c.color || CAMPAIGN_COLORS[0] }} />
                      {c.name || 'Sin nombre'}
                    </span>
                    <span className="text-xs text-muted">
                      {b?.name || 'Sin marca'} · {c.start} → {c.end || 'sin fin'}
                    </span>
                  </button>
                  <Chip size="sm" variant="soft" color={c.status === 'active' ? 'accent' : c.status === 'done' ? 'success' : 'default'}>
                    {CAMPAIGN_STATUS[c.status]?.[0]}
                  </Chip>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Publicaciones', `${s.published.length}/${s.posts.length}`],
                    ['Leads', s.target ? `${s.leads.length}/${s.target}` : String(s.leads.length)],
                    ['Coste por lead', s.cpl == null ? '—' : money(s.cpl, c.currency)],
                    ['Retorno', s.roi == null ? '—' : pctText(s.roi)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col rounded-2xl bg-surface-secondary p-2">
                      <span className="text-sm font-semibold tabular-nums">{value}</span>
                      <span className="text-[10px] text-muted">{label}</span>
                    </div>
                  ))}
                </div>
                {s.target > 0 && (
                  <Meter value={Math.min(100, (s.leads.length / s.target) * 100)} size="sm" color="success" aria-label="Leads frente a lo esperado">
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {editing && <CampaignForm campaign={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Marcas() {
  const [, v] = useCrm();
  const list = useMemo(() => brands(), [v]);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {list.map((b) => (
        <Card key={b.id} className="gap-3 p-5">
          <div className="flex items-center gap-3">
            {b.logo ? <img src={b.logo} alt="" className="size-10 rounded-xl object-contain" /> : <span className="size-10 rounded-xl" style={{ background: brandColor(b) }} />}
            <div className="flex flex-col">
              <span className="font-semibold">{b.name}</span>
              <span className="text-xs text-muted">
                {b.handle} · {b.industry}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {Object.entries(b.colors || {}).map(([k, c]) => (
              <button key={k} type="button" className="size-7 rounded-full ring-1 ring-border" style={{ background: c }} title={`${k}: ${c}`} aria-label={`Copiar ${c}`} onClick={() => copy(c, 'Color')} />
            ))}
          </div>
          {b.tone && <p className="text-sm">{b.tone}</p>}
          {pillarsOf(b).length > 0 && (
            <TagGroup aria-label="Pilares" size="sm">
              <TagGroup.List>
                {pillarsOf(b).map((x) => (
                  <Tag key={x} id={x}>
                    {x}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          )}
          {b.hashtags && (
            <Button size="sm" variant="tertiary" className="w-fit" onPress={() => copy(b.hashtags, 'Hashtags')}>
              <Copy />
              {b.hashtags.split(/\s+/).length} hashtags
            </Button>
          )}
        </Card>
      ))}
      <p className="text-sm text-muted lg:col-span-2">Las imágenes, logos en SVG, pautas y grupos de hashtags de cada marca se editan en la versión de siempre (Marketing › Marcas).</p>
    </div>
  );
}

/** La ficha de una publicación. Cada cambio se guarda solo. */
function PostDrawer({ id, onClose }) {
  const [state, v] = useCrm();
  const ready = useOpenAfterGesture();
  // Sube cuando una plantilla o «Desde Instagram» reescribe un copy: el campo se vuelve a pintar con él.
  const [rev, setRev] = useState(0);
  const p = find('posts', id);
  if (!p) return null;
  const b = p.brandId && find('brands', p.brandId);
  const save = (patch) => {
    Object.assign(p, patch);
    put('posts', p);
  };
  const leads = leadsOf(p);
  const eng = engagement(p);
  const bump = () => setRev((r) => r + 1);

  return (
    <Drawer isOpen={ready} onOpenChange={(o) => ready && !o && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-full sm:max-w-[600px]" data-v={v}>
            <Drawer.CloseTrigger />
            <Drawer.Header className="flex flex-col items-start gap-1">
              <span className="flex items-center gap-2 text-xs text-muted">
                <BrandDot post={p} />
                {b?.name || 'Sin marca'}
              </span>
              <Drawer.Heading className="sr-only">{p.title || 'Publicación'}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5">
              <TextField aria-label="Título" defaultValue={p.title} onChange={(x) => save({ title: x })} maxLength={160} autoFocus={!p.title}>
                <Input className="text-lg font-semibold" placeholder="De qué va la publicación" />
              </TextField>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Marca" value={p.brandId} onChange={(x) => save({ brandId: x })} options={brands().map((x) => [x.id, x.name])} />
                <SelectField label="Estado" value={p.status} onChange={(x) => save({ status: x })} options={STATUS_ORDER.map((k) => [k, POST_STATUS[k][0]])} />
                <DateInput label="Fecha" value={p.date} onChange={(d) => save({ date: d })} />
                <TimeField value={toTime(p.time)} onChange={(t) => save({ time: t ? t.toString().slice(0, 5) : '' })}>
                  <Label>Hora</Label>
                  <TimeField.Group>
                    <TimeField.Input>{(seg) => <TimeField.Segment segment={seg} />}</TimeField.Input>
                  </TimeField.Group>
                </TimeField>
                <SelectField label="Formato" value={p.format} onChange={(x) => save({ format: x })} options={Object.entries(FORMATS).map(([k, [l]]) => [k, l])} />
                <SelectField label="Rol en el embudo" value={p.role} onChange={(x) => save({ role: x })} options={Object.entries(ROLES).map(([k, r]) => [k, `${r[0]} · ${r[1]}`, r[3]])} />
                <SelectField label="Categoría" value={p.category} onChange={(x) => save({ category: x })} options={POST_CATEGORIES.map((c) => [c, c])} />
                <SelectField label="Campaña" value={p.campaignId || '_none'} onChange={(x) => save({ campaignId: x === '_none' ? '' : x })} options={[['_none', 'Sin campaña'], ...campaigns().map((c) => [c.id, c.name])]} />
                {pillarsOf(b).length > 0 && (
                  <SelectField label="Pilar" value={p.pillar || '_none'} onChange={(x) => save({ pillar: x === '_none' ? '' : x })} options={[['_none', 'Sin pilar'], ...pillarsOf(b).map((x) => [x, x])]} className="sm:col-span-2" />
                )}
              </div>
              <TextField defaultValue={p.visualScript} onChange={(x) => save({ visualScript: x })} maxLength={4000}>
                <Label>Guion visual</Label>
                <TextArea rows={3} placeholder="0–3 s: gancho…" />
              </TextField>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Copy de Instagram</Label>
                  <ButtonGroup size="sm" variant="ghost">
                    <Dropdown>
                      {/* Dentro de un Dropdown el botón no hereda el estilo del grupo: va explícito. */}
                      <Button size="sm" variant="ghost">
                        Plantilla
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu aria-label="Plantillas de copy" onAction={(k) => {
                          save({ copyIg: template(String(k), p, b) });
                          bump();
                        }}>
                          {Object.entries(TEMPLATES).map(([k, [label, note]]) => (
                            <Dropdown.Item key={k} id={k} textValue={label}>
                              <Label>{label}</Label>
                              <span className="text-xs text-muted">{note}</span>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                    <Button onPress={() => copy(igText(p), 'Copy de Instagram')}>
                      <ButtonGroup.Separator />
                      <Copy />
                      Copiar
                    </Button>
                  </ButtonGroup>
                </div>
                <TextField aria-label="Copy de Instagram" key={`ig-${rev}`} defaultValue={p.copyIg} onChange={(x) => save({ copyIg: x })} maxLength={2200}>
                  <TextArea rows={6} />
                </TextField>
                <TextField defaultValue={p.hashtags} onChange={(x) => save({ hashtags: x })} maxLength={600}>
                  <Label>Hashtags</Label>
                  <Input />
                </TextField>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Copy de Facebook</Label>
                  <ButtonGroup size="sm" variant="ghost">
                    <Button
                      onPress={() => {
                        save({ copyFb: toFacebook(igText(p), b) });
                        bump();
                      }}
                    >
                      Desde Instagram
                    </Button>
                    <Button onPress={() => copy(p.copyFb, 'Copy de Facebook')}>
                      <ButtonGroup.Separator />
                      <Copy />
                      Copiar
                    </Button>
                  </ButtonGroup>
                </div>
                <TextField aria-label="Copy de Facebook" key={`fb-${rev}`} defaultValue={p.copyFb} onChange={(x) => save({ copyFb: x })} maxLength={4000}>
                  <TextArea rows={4} />
                </TextField>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="sw-eyebrow">Resultados</span>
                  <span className="text-xs text-muted">Interacción: {pctText(eng)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {METRICS.map(([k, label]) => (
                    <AmountField key={k} label={label} value={Number(p.metrics?.[k]) || 0} onChange={(n) => save({ metrics: { ...(p.metrics || {}), [k]: Math.round(n) } })} step={1} />
                  ))}
                </div>
                <TextField defaultValue={p.url} onChange={(x) => save({ url: x })} maxLength={500}>
                  <Label>Enlace a la publicación</Label>
                  <Input placeholder="https://instagram.com/p/…" />
                </TextField>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    {leads.length} {leads.length === 1 ? 'lead' : 'leads'} de esta publicación
                  </span>
                  {leads.map((l) => (
                    <Chip key={l.id} size="sm" variant="tertiary">
                      <a href={`#/leads/${l.id}`}>{l.name || l.company}</a>
                    </Chip>
                  ))}
                </div>
              </div>
              <TextField defaultValue={p.notes} onChange={(x) => save({ notes: x })} maxLength={2000}>
                <Label>Notas</Label>
                <TextArea rows={2} />
              </TextField>
            </Drawer.Body>
            <Drawer.Footer className="justify-between">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    const dup = { ...structuredClone(p), id: crypto.randomUUID(), date: addDays(p.date, 7), status: 'idea', metrics: {}, url: '' };
                    put('posts', dup);
                    toast.success('Duplicada una semana después');
                    go(`#/marketing/pieza/${dup.id}`);
                  }}
                >
                  <Copy />
                  Duplicar
                </Button>
                <ConfirmButton
                  title={`¿Eliminar «${p.title || 'la publicación'}»?`}
                  onConfirm={() => {
                    remove('posts', p.id);
                    onClose();
                  }}
                >
                  <TrashBin />
                  Eliminar
                </ConfirmButton>
              </div>
              <Button slot="close">Listo</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

export function Marketing({ tab, arg }) {
  const [state, v] = useCrm();
  const [ym, setYm] = useState(todayISO().slice(0, 7));
  const [brand, setBrand] = useState(new Set(['all']));
  useEffect(() => ensureBrands(), []);

  // #/marketing/nueva crea una publicación (en el día de ?d= si viene) y la abre.
  useEffect(() => {
    if (tab !== 'nueva') return;
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const d = q.get('d');
    const t = q.get('t');
    const b = [...brand][0];
    const p = newPost({ ...(d ? { date: d } : {}), ...(t && /^\d\d:\d\d$/.test(t) ? { time: t } : {}), ...(b && b !== 'all' ? { brandId: b } : {}) });
    put('posts', p);
    go(`#/marketing/pieza/${p.id}`);
  }, [tab]);

  const chosen = [...brand][0] || 'all';
  const posts = useMemo(() => (state.posts || []).filter((p) => chosen === 'all' || p.brandId === chosen), [state, v, chosen]);
  const view = TABS.some(([k]) => k === tab) ? tab : tab === 'pieza' ? localStorage.getItem('negocio-marketing-vista') || 'calendario' : 'calendario';
  const month = (state.posts || []).filter((p) => (p.date || '').slice(0, 7) === todayISO().slice(0, 7));
  const published = month.filter((p) => p.status === 'publicado');
  const reach = published.reduce((s, p) => s + (Number(p.metrics?.reach) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Crecer"
        title="Marketing"
        description="El contenido de tus marcas: planificarlo, escribirlo, publicarlo y medirlo."
        actions={
          <Button onPress={() => go('#/marketing/nueva')}>
            <Plus />
            Nueva publicación
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Este mes" value={String(month.length)} icon={Megaphone} sub={`${published.length} publicadas`} />
        <Stat label="Alcance del mes" value={numText(reach)} sub="De lo publicado" />
        <Stat label="Por aprobar" value={String((state.posts || []).filter((p) => ['guion', 'diseno'].includes(p.status)).length)} sub="En guion o diseño" />
        <Stat label="Campañas en marcha" value={String(campaigns().filter((c) => c.status === 'active').length)} sub={fmt(round2(campaigns().reduce((s, c) => s + (Number(c.spent) || 0), 0)))} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          selectedKey={view}
          onSelectionChange={(k) => {
            localStorage.setItem('negocio-marketing-vista', String(k));
            go(`#/marketing/${k}`);
          }}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Marketing">
              {TABS.map(([k, label]) => (
                <Tabs.Tab key={k} id={k}>
                  {label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {!['campanas', 'marcas'].includes(view) && (
          <TagGroup aria-label="Marca" selectionMode="single" disallowEmptySelection selectedKeys={brand} onSelectionChange={setBrand} size="sm">
            <TagGroup.List>
              <Tag id="all">Todas</Tag>
              {brands().map((b) => (
                <Tag key={b.id} id={b.id}>
                  {b.name}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}
      </div>
      {view === 'calendario' && <Calendario posts={posts} ym={ym} setYm={setYm} />}
      {view === 'agenda' && <AgendaView posts={posts} />}
      {view === 'tablero' && <Tablero posts={posts} />}
      {view === 'copias' && <Copias posts={posts} />}
      {view === 'campanas' && <Campanas />}
      {view === 'marcas' && <Marcas />}
      {tab === 'pieza' && arg && <PostDrawer key={arg} id={arg} onClose={() => go(`#/marketing/${view}`)} />}
    </div>
  );
}
