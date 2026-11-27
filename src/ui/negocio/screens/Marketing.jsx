// Crecer › Marketing: el contenido de las marcas del estudio. Calendario del mes,
// tablero editorial, copias listas para pegar, campañas con su coste por lead y
// las marcas. Cada publicación se abre en un panel con todo lo suyo y sus
// resultados. Las reglas son las de negocio-contenido.js.
import { useEffect, useMemo, useState } from 'react';
import { Bulb, Calendar, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, Copy, Flag, LayoutCellsLarge, LayoutColumns, Megaphone, Palette, PaperPlane, PencilToSquare, Plus, TrashBin } from '@gravity-ui/icons';
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
import { Kanban, KpiGroup, Widget } from '../../pro/index.js';
import { Pieza } from './Pieza.jsx';
import { Segment } from '../../kit/Segment.jsx';
import { BrandMark, CampanaPage, Campanas, Feed, MARCA_KEY, MarcaPage, Marcas, Resultados } from './MarketingMas.jsx';

const ROLE_HEX = { tof: '#00b8d4', mof: '#8e5bd6', bof: '#34c759', com: '#f97316' };
const STATUS_COLOR = { idea: 'default', guion: 'accent', diseno: 'accent', aprobado: 'success', programado: 'warning', publicado: 'success' };
const TABS = [
  ['calendario', 'Calendario', Calendar],
  ['tablero', 'Tablero', LayoutColumns],
  ['campanas', 'Campañas', Flag],
  ['resultados', 'Resultados', ChartColumn],
  ['copias', 'Copias', Copy],
  ['feed', 'Feed', LayoutCellsLarge],
  ['marcas', 'Marcas', Palette],
];
const TAB_ITEMS = TABS.map(([id, label, icon]) => ({ id, label, icon, href: `#/marketing/${id}` }));

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

const COPY_SCOPES = [
  ['upcoming', 'Próximas'],
  ['missing', 'Sin copy'],
  ['all', 'Todas'],
];

/** Copia el texto, pégalo en Instagram o Facebook y márcala como publicada. */
function Copias({ posts }) {
  const [scope, setScope] = useState('upcoming');
  const today = todayISO();
  const byWhen = (a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`);
  const list = posts
    .filter((p) => (scope === 'upcoming' ? p.date >= today && p.status !== 'publicado' : scope === 'missing' ? !p.copyIg?.trim() : true))
    .sort(scope === 'all' ? (a, b) => byWhen(b, a) : byWhen);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs selectedKey={scope} onSelectionChange={(k) => setScope(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Qué publicaciones ver">
              {COPY_SCOPES.map(([k, label]) => (
                <Tabs.Tab key={k} id={k}>
                  {label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <p className="text-sm text-muted">El de Instagram ya lleva los hashtags.</p>
      </div>
      {!list.length ? (
        <Empty
          icon={Copy}
          title={scope === 'missing' ? 'Todas tienen copy' : 'Nada por aquí'}
          text={scope === 'upcoming' ? 'No hay publicaciones próximas sin publicar.' : 'Cambia el filtro o crea una publicación.'}
        />
      ) : (
        list.map((p) => {
          const ig = igText(p);
          const b = p.brandId && find('brands', p.brandId);
          return (
            <Card key={p.id} className="gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <BrandDot post={p} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <a href={`#/marketing/pieza/${p.id}`} className="truncate font-medium hover:underline">
                    {p.title || 'Sin título'}
                  </a>
                  <span className="truncate text-xs text-muted">{[b?.name, p.date, p.time, FORMATS[p.format]?.[0]].filter(Boolean).join(' · ')}</span>
                </span>
                <Chip size="sm" variant="soft" color={STATUS_COLOR[p.status] || 'default'}>
                  {POST_STATUS[p.status]?.[0]}
                </Chip>
                <ButtonGroup size="sm" variant="secondary">
                  {p.status !== 'publicado' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        put('posts', { ...p, status: 'publicado', date: p.date > today ? today : p.date });
                        toast.success('Marcada como publicada', { description: 'Apunta sus resultados en unos días.' });
                      }}
                    >
                      <CircleCheck />
                      Publicada
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onPress={() => go(`#/marketing/pieza/${p.id}`)}>
                    {p.status !== 'publicado' && <ButtonGroup.Separator />}
                    <PencilToSquare />
                    Editar
                  </Button>
                </ButtonGroup>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Instagram', ig, ig ? `${ig.length} / 2200` : '', 'Sin copy todavía.'],
                  ['Facebook', p.copyFb || '', '', 'Sin copy. En la publicación se adapta desde el de Instagram con un clic.'],
                ].map(([net, text, count, none]) => (
                  <section key={net} className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
                    <div className="flex items-center gap-2">
                      <b className="text-sm">{net}</b>
                      {count && <span className={`text-xs tabular-nums ${ig.length > 2200 ? 'text-danger' : 'text-muted'}`}>{count}</span>}
                      <span className="flex-1" />
                      <Button size="sm" variant="tertiary" isDisabled={!text} onPress={() => copy(text, `Copy de ${net}`)}>
                        <Copy />
                        Copiar
                      </Button>
                    </div>
                    <p className={`line-clamp-6 whitespace-pre-line text-sm ${text ? '' : 'text-muted'}`}>{text || none}</p>
                  </section>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/** Moverse entre marcas: anterior, la elegida (con su menú) y siguiente. */
function BrandSwitcher({ value, onChange, allowAll = true }) {
  const list = brands();
  const opts = [...(allowAll ? [{ id: 'all', name: 'Todas las marcas' }] : []), ...list];
  if (!opts.length) return null;
  const i = Math.max(0, opts.findIndex((o) => o.id === value));
  const cur = opts[i];
  const step = (d) => onChange(opts[(i + d + opts.length) % opts.length].id);
  const mark = (o) =>
    o.id === 'all' ? (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-default text-[10px] font-bold">{list.length}</span>
    ) : (
      <BrandMark b={o} size="size-5" rounded="rounded-md" />
    );
  return (
    <ButtonGroup size="sm" variant="secondary">
      <Button size="sm" variant="secondary" isIconOnly aria-label="Marca anterior" onPress={() => step(-1)}>
        <ChevronLeft />
      </Button>
      <Dropdown>
        <Button size="sm" variant="secondary" aria-label="Elegir marca">
          <ButtonGroup.Separator />
          {mark(cur)}
          <span className="max-w-40 truncate">{cur.name}</span>
          <ChevronDown className="size-3.5" />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-60">
          <Dropdown.Menu aria-label="Marca" selectionMode="single" selectedKeys={new Set([cur.id])} onAction={(k) => onChange(String(k))}>
            {opts.map((o) => (
              <Dropdown.Item key={o.id} id={o.id} textValue={o.name}>
                {mark(o)}
                <Label>{o.name}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Button size="sm" variant="secondary" isIconOnly aria-label="Marca siguiente" onPress={() => step(1)}>
        <ButtonGroup.Separator />
        <ChevronRight />
      </Button>
    </ButtonGroup>
  );
}

/** La ficha de una publicación. Cada cambio se guarda solo. */
export function Marketing({ tab, arg }) {
  const [state, v] = useCrm();
  const [ym, setYm] = useState(todayISO().slice(0, 7));
  // La marca elegida se recuerda (también la pone «Su calendario» desde la ficha de una marca).
  const [brand, setBrandState] = useState(() => {
    const saved = localStorage.getItem(MARCA_KEY);
    return new Set([saved && find('brands', saved) ? saved : 'all']);
  });
  const setBrand = (keys) => {
    setBrandState(keys);
    localStorage.setItem(MARCA_KEY, [...keys][0] || 'all');
  };
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

  useEffect(() => {
    if (TABS.some(([k]) => k === tab)) localStorage.setItem('negocio-marketing-vista', tab);
  }, [tab]);
  const chosen = [...brand][0] || 'all';
  const posts = useMemo(() => (state.posts || []).filter((p) => chosen === 'all' || p.brandId === chosen), [state, v, chosen]);
  const view = TABS.some(([k]) => k === tab) ? tab : tab === 'pieza' ? localStorage.getItem('negocio-marketing-vista') || 'calendario' : 'calendario';
  // Una publicación abierta ocupa la página entera (ya no es un panel lateral).
  if (tab === 'pieza' && arg) return <Pieza key={arg} id={arg} backTo={`#/marketing/${view}`} />;
  if (tab === 'campanas' && arg) return <CampanaPage key={arg} id={arg} />;
  if (tab === 'marcas' && arg) return <MarcaPage key={arg} id={arg} />;

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
      <Widget title="Este mes">
        <KpiGroup
          items={[
            { label: 'Publicaciones', value: String(month.length), sub: `${published.length} publicadas` },
            { label: 'Alcance', value: numText(reach), sub: 'De lo publicado' },
            { label: 'Por aprobar', value: String((state.posts || []).filter((p) => ['guion', 'diseno'].includes(p.status)).length), sub: 'En guion o diseño', href: '#/marketing/tablero' },
            { label: 'Campañas en marcha', value: String(campaigns().filter((c) => c.status === 'active').length), sub: `${fmt(round2(campaigns().reduce((s, c) => s + (Number(c.spent) || 0), 0)))} gastado`, href: '#/marketing/campanas' },
          ]}
        />
      </Widget>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segment items={TAB_ITEMS} value={view} label="Vistas de marketing" className="max-w-full" />
        {view !== 'marcas' && (
          <BrandSwitcher
            value={view === 'feed' && chosen === 'all' && brands()[0] ? brands()[0].id : chosen}
            allowAll={view !== 'feed'}
            onChange={(id) => setBrand(new Set([id]))}
          />
        )}
      </div>
      {view === 'calendario' && <Calendario posts={posts} ym={ym} setYm={setYm} />}
      {view === 'tablero' && <Tablero posts={posts} />}
      {view === 'copias' && <Copias posts={posts} />}
      {view === 'campanas' && <Campanas brandId={chosen} />}
      {view === 'resultados' && <Resultados brandId={chosen} />}
      {view === 'feed' && <Feed brandId={chosen} />}
      {view === 'marcas' && <Marcas />}
    </div>
  );
}
