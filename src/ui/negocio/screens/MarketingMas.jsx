// Crecer › Marketing, lo que faltaba de la versión de siempre, en el diseño nuevo:
// los resultados del periodo (qué funcionó, por papel en el embudo y por formato), el
// feed simulado de una marca (arrastrar para cambiar el orden), la ficha de cada
// campaña con sus cifras, publicaciones y leads, y la ficha de cada marca con su
// identidad, su estrategia, sus imágenes y sus logos en SVG. Las reglas y los
// cálculos son los de negocio-contenido.js y negocio-marketing.js.
import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  Calendar,
  ChartColumn,
  Code,
  Copy,
  Flag,
  Funnel,
  Heart,
  Link as LinkIcon,
  Palette,
  Pencil,
  Picture,
  Plus,
  TrashBin,
} from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Checkbox, Chip, Input, Label, Meter, Tabs, TextArea, TextField, toast } from '@heroui/react';
import { addDays, dateText, find, put, remove, shortDate, todayISO, uid } from '../../../negocio-core.js';
import { PERIODS, change, fileUrl, periodRange, uploadFile, within } from '../../../negocio-gastos.js';
import {
  CAMPAIGN_COLORS,
  CAMPAIGN_STATUS,
  FORMATS,
  METRICS,
  POST_STATUS,
  ROLES,
  brandColor,
  brands,
  byDate,
  campaignStats,
  engagement,
  hasMetrics,
  leadsOf,
  newCampaign,
  newPost,
  pctText,
  svgUrl,
} from '../../../negocio-contenido.js';
import { newLead } from '../../../negocio-leads.js';
import { Empty, Panel, Stat } from '../../kit/parts.jsx';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { ComposedChart, DonutChart, KpiGroup, Widget } from '../../pro/index.js';
import { copyText } from '../../kit/csv.js';
import { go, useCrm } from '../store.js';
import { LEAD_STAGES, money } from '../domain.js';
import { CurrencyPicker } from '../currency.jsx';
import { AmountField, ConfirmButton, ConfirmDialog, DateInput, FormModal, SelectField } from '../fields.jsx';

export const ROLE_HEX = { tof: '#00b8d4', mof: '#8e5bd6', bof: '#34c759', com: '#f97316' };
const STATUS_COLOR = { idea: 'default', guion: 'accent', diseno: 'accent', aprobado: 'success', programado: 'warning', publicado: 'success' };
const CAMPAIGN_CHIP = { planned: 'default', active: 'accent', done: 'success' };
const nf0 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
const bigNum = (n) => nf0.format(Math.round(n || 0));
const list = (state, col) => state[col] || [];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function copy(text, done) {
  if (!String(text || '').trim()) return toast.warning('No hay nada que copiar.');
  if (await copyText(text)) toast.success(`${done} copiado`);
  else toast.danger('No se pudo copiar');
  return undefined;
}

/** Recuerda la marca elegida en Marketing (la usan el filtro y «Ver su calendario»). */
export const MARCA_KEY = 'negocio-marketing-marca';
export const openPost = (over = {}) => {
  const p = newPost(over);
  put('posts', p);
  go(`#/marketing/pieza/${p.id}`);
};

export function BrandMark({ b, size = 'size-10', rounded = 'rounded-xl' }) {
  if (b?.logo) return <img src={b.logo} alt="" className={`${size} ${rounded} shrink-0 bg-surface-secondary object-contain`} />;
  return (
    <span className={`${size} ${rounded} flex shrink-0 items-center justify-center text-sm font-bold text-white`} style={{ background: brandColor(b) }}>
      {(b?.name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

function PostStatus({ status }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status] || 'default'}>
      {POST_STATUS[status]?.[0] || status}
    </Chip>
  );
}

/** Barras horizontales sencillas: nombre, barra y cifra. */
function Bars({ rows }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={r.title}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="truncate">{r.label}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-default">
            <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
          </span>
          <span className="flex items-baseline gap-2 tabular-nums">
            <b className="font-semibold">{r.value}</b>
            {r.note && <span className="text-xs text-muted">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Resultados ─────────────────────────────────────────────────────────── */

export function Resultados({ brandId = 'all' }) {
  const [state, v] = useCrm();
  const [period, setPeriod] = useState(() => localStorage.getItem('negocio-marketing-periodo') || 'month');
  const data = useMemo(() => {
    const r = periodRange(period);
    const inBrand = (x) => brandId === 'all' || x.brandId === brandId;
    const published = list(state, 'posts').filter((p) => inBrand(p) && p.status === 'publicado' && within(p.date, r));
    const before = r.prev ? list(state, 'posts').filter((p) => inBrand(p) && p.status === 'publicado' && within(p.date, r.prev)) : [];
    const sum = (posts, k) => posts.reduce((s, p) => s + (Number(p.metrics?.[k]) || 0), 0);
    const measured = published.filter((p) => engagement(p) != null);
    const leads = list(state, 'leads').filter((l) => inBrand(l) && within(l.createdOn || '', r));
    const roles = Object.entries(ROLES).map(([k, role]) => {
      const posts = published.filter((p) => p.role === k);
      const m = posts.filter((p) => engagement(p) != null);
      return { k, role, posts: posts.length, eng: m.length ? m.reduce((s, p) => s + engagement(p), 0) / m.length : null, leads: posts.reduce((s, p) => s + leadsOf(p).length, 0) };
    });
    const formats = Object.entries(FORMATS)
      .map(([k, [label]]) => {
        const posts = published.filter((p) => p.format === k);
        const m = posts.filter((p) => engagement(p) != null);
        return { k, label, posts: posts.length, eng: m.length ? m.reduce((s, p) => s + engagement(p), 0) / m.length : null, reach: sum(posts, 'reach') };
      })
      .filter((x) => x.posts);
    return {
      published,
      before,
      reach: sum(published, 'reach'),
      reachBefore: sum(before, 'reach'),
      follows: sum(published, 'follows'),
      measured,
      avgEng: measured.length ? measured.reduce((s, p) => s + engagement(p), 0) / measured.length : null,
      leads,
      social: leads.filter((l) => l.postId || ['instagram', 'facebook', 'tiktok'].includes(l.source)),
      won: leads.filter((l) => l.stage === 'won'),
      ranked: [...published].map((p) => ({ p, e: engagement(p), leads: leadsOf(p).length })).sort((a, b) => b.leads - a.leads || (b.e ?? -1) - (a.e ?? -1)),
      missing: published.filter((p) => !hasMetrics(p)).length,
      roles,
      formats,
      top: Math.max(0.0001, ...roles.map((x) => x.eng || 0), ...formats.map((x) => x.eng || 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, v, period, brandId]);
  const d = data;
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        selectedKey={period}
        onSelectionChange={(k) => {
          setPeriod(String(k));
          localStorage.setItem('negocio-marketing-periodo', String(k));
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Periodo">
            {PERIODS.map(([k, label]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <Widget title="En el periodo">
        <KpiGroup
          items={[
            { label: 'Publicadas', value: String(d.published.length), delta: change(d.published.length, d.before.length), sub: d.missing ? `${d.missing} sin resultados apuntados` : 'Con sus resultados' },
            { label: 'Alcance', value: bigNum(d.reach), delta: change(d.reach, d.reachBefore), sub: d.follows ? `${bigNum(d.follows)} seguidores nuevos` : 'Personas a las que llegaste' },
            { label: 'Interacción media', value: pctText(d.avgEng), sub: d.measured.length ? `De ${d.measured.length} con alcance` : 'Apunta el alcance y los me gusta' },
            { label: 'Leads de redes', value: String(d.social.length), sub: `${plural(d.won.length, 'ganado', 'ganados')} de ${d.leads.length} en total` },
          ]}
        />
      </Widget>
      <Panel title="Las que mejor funcionaron" description="Primero las que trajeron leads; luego, por interacción.">
        {d.ranked.length ? (
          <ul className="flex flex-col">
            {d.ranked.slice(0, 8).map(({ p, e, leads: n }) => {
              const b = p.brandId && find('brands', p.brandId);
              return (
                <li key={p.id}>
                  <a href={`#/marketing/pieza/${p.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-surface-secondary">
                    {p.assetUrl ? <img src={p.assetUrl} alt="" loading="lazy" className="size-11 shrink-0 rounded-xl object-cover" /> : <span className="size-11 shrink-0 rounded-xl" style={{ background: p.color || brandColor(b) }} />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-sm font-medium">{p.title || 'Sin título'}</b>
                      <span className="truncate text-xs text-muted">{[b?.name, dateText(p.date), FORMATS[p.format]?.[0]].filter(Boolean).join(' · ')}</span>
                    </span>
                    {[
                      ['Alcance', p.metrics?.reach ? bigNum(p.metrics.reach) : '—'],
                      ['Interacción', pctText(e)],
                      ['Leads', String(n)],
                    ].map(([label, value]) => (
                      <span key={label} className="hidden w-20 flex-col items-end sm:flex">
                        <span className="text-[11px] text-muted">{label}</span>
                        <b className="text-sm tabular-nums">{value}</b>
                      </span>
                    ))}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ninguna publicada en este periodo.</p>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por papel en el embudo" description="Interacción media y leads de cada tipo de publicación.">
          <Bars
            rows={d.roles.map((x) => ({
              key: x.k,
              label: `${x.role[0]} (${x.posts})`,
              title: x.role[3],
              color: ROLE_HEX[x.k],
              pct: x.eng ? Math.max(3, (x.eng / d.top) * 100) : 0,
              value: pctText(x.eng),
              note: plural(x.leads, 'lead', 'leads'),
            }))}
          />
        </Panel>
        <Panel title="Por formato" description="Qué formato engancha más.">
          {d.formats.length ? (
            <Bars rows={d.formats.map((x) => ({ key: x.k, label: `${x.label} (${x.posts})`, color: 'var(--foreground)', pct: x.eng ? Math.max(3, (x.eng / d.top) * 100) : 0, value: pctText(x.eng), note: x.reach ? `${bigNum(x.reach)} alcance` : '' }))} />
          ) : (
            <p className="text-sm text-muted">Sin publicaciones en este periodo.</p>
          )}
        </Panel>
      </div>
      <p className="text-xs text-muted">
        Los resultados se apuntan en cada publicación ({METRICS.map(([, l]) => l.toLowerCase()).slice(0, 3).join(', ')}…). Instagram y Facebook los enseñan en sus estadísticas.
      </p>
    </div>
  );
}

/* ── Feed ───────────────────────────────────────────────────────────────── */

export function Feed({ brandId = 'all' }) {
  const [state] = useCrm();
  const [drafts, setDrafts] = useState(false);
  const [over, setOver] = useState(null);
  const dragId = useRef(null);
  const all = brands();
  const b = (brandId !== 'all' && find('brands', brandId)) || all[0];
  if (!b) return <Empty icon={Picture} title="Crea una marca primero" action={<Button onPress={() => go('#/marketing/marcas')}>Ir a Marcas</Button>} />;
  const shown = (p) => drafts || ['aprobado', 'programado', 'publicado'].includes(p.status);
  const posts = list(state, 'posts').filter((p) => p.brandId === b.id && p.format !== 'historia' && shown(p)).sort((x, y) => byDate(y, x));
  const month = todayISO().slice(0, 7);
  const thisMonth = list(state, 'posts').filter((p) => p.brandId === b.id && (p.date || '').startsWith(month));
  const mix = Object.entries(ROLES).map(([k, r]) => ({ k, r, n: thisMonth.filter((p) => p.role === k).length }));
  const top = Math.max(1, ...mix.map((x) => x.n));
  const next = list(state, 'posts')
    .filter((p) => p.brandId === b.id && p.date >= todayISO() && p.status !== 'publicado')
    .sort(byDate)
    .slice(0, 4);
  // Las últimas 8 semanas (de lunes a domingo): publicadas y programadas, frente a la cadencia de la marca.
  const today = todayISO();
  const dow = (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const cadence = Number(b.cadence) || 0;
  const brandPosts = list(state, 'posts').filter((p) => p.brandId === b.id && p.date);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(monday, (i - 6) * 7);
    const to = addDays(from, 6);
    const inWeek = brandPosts.filter((p) => p.date >= from && p.date <= to);
    return {
      key: from,
      label: shortDate(from),
      done: inWeek.filter((p) => p.status === 'publicado').length,
      planned: inWeek.filter((p) => p.status !== 'publicado' && ['aprobado', 'programado'].includes(p.status)).length,
      goal: cadence,
    };
  });
  const measured = brandPosts.filter((p) => p.status === 'publicado' && hasMetrics(p));
  const reachAvg = measured.length ? measured.reduce((sum, p) => sum + (Number(p.metrics?.reach) || 0), 0) / measured.length : 0;
  const engAvg = measured.length ? measured.reduce((sum, p) => sum + (engagement(p) || 0), 0) / measured.length : null;

  // Arrastrar una casilla sobre otra intercambia sus fechas: así se planea el orden de la cuadrícula.
  const swap = (target) => {
    const other = dragId.current && find('posts', dragId.current);
    dragId.current = null;
    setOver(null);
    if (!other || other.id === target.id || target.status === 'publicado') return;
    [other.date, target.date] = [target.date, other.date];
    [other.time, target.time] = [target.time, other.time];
    put('posts', other);
    put('posts', target);
    toast('Intercambiadas de fecha');
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3 px-2">
        <span className="text-xs text-muted">Arrastra una casilla sobre otra para cambiar sus fechas.</span>
        <SwitchField label="Borradores" isSelected={drafts} onChange={setDrafts} size="sm" />
      </div>
      <div className="w-full rounded-[2.5rem] bg-[#0b0b0c] p-2.5 shadow-[var(--overlay-shadow)]">
        <div className="flex min-h-[640px] flex-col gap-3 overflow-hidden rounded-[2rem] bg-white pb-3 text-[#111]">
          <div className="px-4 pt-4 text-center text-sm font-bold">{(b.handle || b.name).replace(/^@/, '')}</div>
          <div className="flex items-center gap-5 px-4">
            <span className="rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[3px]">
              <span className="block rounded-full bg-white p-[2px]">
                <BrandMark b={b} size="size-16" rounded="rounded-full" />
              </span>
            </span>
            <div className="grid min-w-0 flex-1 grid-cols-3 text-center text-[10px] leading-tight">
              {[
                [String(posts.length), 'publicaciones'],
                [b.followers ? bigNum(b.followers) : '—', 'seguidores'],
                ['—', 'seguidos'],
              ].map(([n, l]) => (
                <span key={l} className="flex flex-col">
                  <b className="text-sm">{n}</b>
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col px-4 text-xs">
            <b>{b.name}</b>
            {b.industry && <span>{b.industry}</span>}
            {b.link && <span className="text-[#00376b]">{b.link.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>}
          </div>
          <div className="mx-0 grid grid-cols-2 border-t border-[#dbdbdb] text-center text-[11px] text-[#737373]">
            <span className="border-t-2 border-[#111] py-2 font-semibold text-[#111]">Publicaciones</span>
            <span className="py-2">Reels</span>
          </div>
          {posts.length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {posts.slice(0, 18).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  draggable={p.status !== 'publicado'}
                  title={`${p.title || 'Sin título'} · ${dateText(p.date)}`}
                  onClick={() => go(`#/marketing/pieza/${p.id}`)}
                  onDragStart={(e) => {
                    dragId.current = p.id;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', p.id);
                  }}
                  onDragEnd={() => {
                    dragId.current = null;
                    setOver(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId.current || dragId.current === p.id || p.status === 'publicado') return;
                    e.preventDefault();
                    if (over !== p.id) setOver(p.id);
                  }}
                  onDragLeave={() => setOver((o) => (o === p.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    swap(p);
                  }}
                  className={`relative aspect-[4/5] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-focus ${over === p.id ? 'ring-4 ring-accent ring-inset' : ''}`}
                >
                  {p.assetUrl ? (
                    <img src={p.assetUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-end p-2 text-start text-[11px] font-semibold leading-tight text-white" style={{ background: p.color || brandColor(b) }}>
                      {p.title}
                    </span>
                  )}
                  {p.format !== 'imagen' && <span className="absolute end-1.5 top-1.5 rounded bg-black/50 px-1 text-[9px] font-semibold uppercase text-white">{FORMATS[p.format]?.[0]}</span>}
                  {p.status !== 'publicado' && <span className="absolute start-1.5 top-1.5 rounded bg-black/55 px-1 text-[9px] text-white">{shortDate(p.date)}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-6 py-10 text-center text-xs text-[#737373]">{drafts ? 'Esta marca todavía no tiene publicaciones.' : 'Aquí salen las aprobadas, programadas y publicadas.'}</p>
          )}
        </div>
      </div>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Widget title={b.name} description="Lo más nuevo arriba a la izquierda, como en Instagram. Las historias no entran en la cuadrícula." className="xl:col-span-2">
          <KpiGroup
            items={[
              { label: 'En el perfil', value: String(posts.length), sub: drafts ? 'Con ideas y borradores' : 'Aprobadas, programadas y publicadas' },
              { label: 'Este mes', value: String(thisMonth.length), sub: cadence ? `Cadencia: ${cadence} por semana` : 'Sin cadencia en la marca' },
              { label: 'Alcance medio', value: measured.length ? bigNum(reachAvg) : '—', sub: measured.length ? `De ${plural(measured.length, 'publicación', 'publicaciones')} medidas` : 'Apunta los resultados' },
              { label: 'Interacción media', value: engAvg == null ? '—' : pctText(engAvg), sub: 'Me gusta, comentarios y guardados sobre el alcance' },
            ]}
          />
        </Widget>
        <Widget title="Ritmo" description={cadence ? `Por semana, frente a tu cadencia de ${cadence}` : 'Publicaciones por semana'} className="xl:col-span-2">
          <ComposedChart
            title="Publicaciones por semana"
            xLabel="Semana"
            height={190}
            data={weeks}
            series={[
              { key: 'done', name: 'Publicadas', type: 'bar', color: 'var(--sw-chart-in)' },
              { key: 'planned', name: 'Programadas', type: 'bar', color: 'var(--sw-cat-other)' },
              ...(cadence ? [{ key: 'goal', name: 'Cadencia', type: 'line', color: 'var(--foreground)' }] : []),
            ]}
            format={(x) => String(x)}
            compact={(x) => (Number.isInteger(x) ? String(x) : '')}
          />
        </Widget>
        <Widget title="Equilibrio del embudo" description={`Este mes, por su papel`}>
          {thisMonth.length ? (
            <DonutChart
              title="Publicaciones del mes por papel en el embudo"
              parts={mix.map((x) => ({ key: x.k, label: `${x.r[0]} (${x.r[1]})`, value: x.n, color: ROLE_HEX[x.k] }))}
              format={(x) => String(x)}
              totalLabel="Este mes"
              size={140}
              layout="stack"
            />
          ) : (
            <p className="text-sm text-muted">Nada planeado este mes.</p>
          )}
        </Widget>
        <Widget title="Lo próximo" bodyClassName="p-2">
          {next.length ? (
            <ul className="flex flex-col">
              {next.map((p) => (
                <li key={p.id}>
                  <a href={`#/marketing/pieza/${p.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-surface-secondary">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-sm font-medium">{p.title || 'Sin título'}</b>
                      <span className="text-xs text-muted">
                        {dateText(p.date)}
                        {p.time ? ` · ${p.time}` : ''} · {FORMATS[p.format]?.[0]}
                      </span>
                    </span>
                    <PostStatus status={p.status} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-2 text-sm text-muted">Nada programado.</p>
          )}
        </Widget>
      </div>
    </div>
  );
}

/* ── Campañas ───────────────────────────────────────────────────────────── */

export function CampaignForm({ campaign, onClose, onSaved, over = {} }) {
  const [c] = useState(() => (campaign ? { ...campaign } : newCampaign(over)));
  const [brandId, setBrandId] = useState(c.brandId);
  const [status, setStatus] = useState(c.status);
  const [start, setStart] = useState(c.start);
  const [end, setEnd] = useState(c.end);
  const [budget, setBudget] = useState(Number(c.budget) || 0);
  const [spent, setSpent] = useState(Number(c.spent) || 0);
  const [currency, setCurrency] = useState(c.currency || 'USD');
  const [target, setTarget] = useState(Number(c.leadsTarget) || 0);
  const [color, setColor] = useState(c.color || CAMPAIGN_COLORS[0]);
  return (
    <FormModal
      title={campaign ? 'Editar campaña' : 'Nueva campaña'}
      submit={campaign ? 'Guardar' : 'Crear campaña'}
      size="sm:max-w-[640px]"
      onClose={onClose}
      extra={
        campaign && (
          <ConfirmButton
            title={`¿Eliminar «${campaign.name}»?`}
            text="Sus publicaciones y leads se quedan, sin campaña."
            onConfirm={() => {
              unlinkCampaign(campaign.id);
              remove('campaigns', campaign.id);
              toast('Campaña eliminada');
              onSaved?.(null);
              onClose();
            }}
            isIconOnly
            ariaLabel="Eliminar campaña"
          >
            <TrashBin />
          </ConfirmButton>
        )
      }
      onSubmit={(f) => {
        const name = String(f.name || '').trim();
        if (!name) return false;
        const saved = { ...c, name, brandId, status, start, end, budget, spent, currency, leadsTarget: target, color, goal: String(f.goal || '').trim(), notes: String(f.notes || '').trim() };
        put('campaigns', saved);
        onSaved?.(saved);
        return true;
      }}
    >
      <TextField name="name" isRequired defaultValue={c.name} maxLength={120} autoFocus className="sm:col-span-2">
        <Label>Nombre</Label>
        <Input placeholder="Lanzamiento de la versión 2" />
      </TextField>
      <SelectField label="Marca" value={brandId} onChange={setBrandId} options={brands().map((b) => [b.id, b.name])} />
      <SelectField label="Estado" value={status} onChange={setStatus} options={Object.entries(CAMPAIGN_STATUS).map(([k, [l]]) => [k, l])} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Color</span>
        <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
          {CAMPAIGN_COLORS.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={color === x}
              aria-label={`Color ${x}`}
              onClick={() => setColor(x)}
              className={`size-8 rounded-full outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-focus ${color === x ? 'ring-2 ring-foreground' : ''}`}
              style={{ background: x }}
            />
          ))}
        </div>
      </div>
      <DateInput label="Empieza" value={start} onChange={setStart} />
      <DateInput label="Termina" value={end} onChange={setEnd} />
      <TextField name="goal" defaultValue={c.goal} maxLength={1000} className="sm:col-span-2">
        <Label>Objetivo</Label>
        <TextArea rows={2} placeholder="Qué quieres conseguir: 50 descargas, 10 clientes nuevos…" />
      </TextField>
      <AmountField label="Presupuesto" value={budget} onChange={setBudget} />
      <AmountField label="Gastado hasta hoy" value={spent} onChange={setSpent} description="En anuncios, diseño…" />
      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} showName={false} className="sm:col-span-2" />
      <AmountField label="Leads que esperas" value={target} onChange={setTarget} step={1} description="Para ver el avance y el coste por lead." />
      <TextField name="notes" defaultValue={c.notes} maxLength={4000} className="sm:col-span-2">
        <Label>Notas</Label>
        <TextArea rows={2} />
      </TextField>
    </FormModal>
  );
}

/** Al borrar una campaña, sus publicaciones y leads se quedan, sin campaña. */
function unlinkCampaign(id) {
  const c = find('campaigns', id);
  if (!c) return;
  const s = campaignStats(c);
  for (const p of s.posts) put('posts', { ...p, campaignId: '' });
  for (const l of s.leads) put('leads', { ...l, campaignId: '' });
}

/** La lista de campañas, por estado. */
export function Campanas({ brandId = 'all' }) {
  const [state, v] = useCrm();
  const [creating, setCreating] = useState(false);
  const all = useMemo(
    () => [...list(state, 'campaigns')].filter((c) => brandId === 'all' || c.brandId === brandId).sort((a, b) => (b.start || '').localeCompare(a.start || '') || (a.name || '').localeCompare(b.name || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, v, brandId],
  );
  const groups = [
    ['active', 'En marcha'],
    ['planned', 'Planificadas'],
    ['done', 'Terminadas'],
  ]
    .map(([k, label]) => [label, all.filter((c) => (c.status || 'planned') === k)])
    .filter(([, l]) => l.length);
  const create = () => setCreating(true);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Una campaña junta las publicaciones y los leads de un objetivo: así sabes cuánto costó cada lead y cuánto vendiste.</p>
        <Button size="sm" onPress={create}>
          <Plus />
          Nueva campaña
        </Button>
      </div>
      {all.length === 0 ? (
        <Empty icon={Flag} title="Todavía no hay campañas" text="Crea una para un lanzamiento, una promoción o un mes de contenido, con su presupuesto y los leads que esperas." action={<Button onPress={create}>Nueva campaña</Button>} />
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="font-semibold">{label}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        ))
      )}
      {creating && <CampaignForm over={brandId !== 'all' ? { brandId } : {}} onClose={() => setCreating(false)} onSaved={(c) => c && go(`#/marketing/campanas/${c.id}`)} />}
    </div>
  );
}

function CampaignCard({ c }) {
  const s = campaignStats(c);
  const b = c.brandId && find('brands', c.brandId);
  const share = s.posts.length ? s.published.length / s.posts.length : 0;
  return (
    <a href={`#/marketing/campanas/${c.id}`} className="block rounded-3xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <Card className="relative h-full gap-3 overflow-hidden p-4 transition-transform hover:-translate-y-0.5">
        <span aria-hidden className="absolute inset-y-0 start-0 w-1" style={{ background: c.color || CAMPAIGN_COLORS[0] }} />
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-foreground">{c.name || 'Sin nombre'}</span>
            <span className="truncate text-xs text-muted">{[c.start && `${shortDate(c.start)} → ${c.end ? dateText(c.end) : 'sin final'}`, b?.name].filter(Boolean).join(' · ')}</span>
          </span>
          <Chip size="sm" variant="soft" color={CAMPAIGN_CHIP[c.status] || 'default'}>
            {CAMPAIGN_STATUS[c.status]?.[0] || 'Planificada'}
          </Chip>
        </div>
        {[
          ['Publicaciones', `${s.published.length}/${s.posts.length}`, share, 'accent'],
          ['Leads', s.target ? `${s.leads.length}/${s.target}` : String(s.leads.length), s.target ? Math.min(1, s.leads.length / s.target) : s.leads.length ? 1 : 0, 'success'],
        ].map(([label, value, pct, color]) => (
          <Meter key={label} value={pct * 100} size="sm" color={color} aria-label={label}>
            <div className="flex justify-between text-xs">
              <span className="text-muted">{label}</span>
              <b className="tabular-nums">{value}</b>
            </div>
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
        ))}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Coste por lead', s.cpl != null ? money(s.cpl, c.currency) : '—'],
            ['Ventas', money(s.wonValue, c.currency)],
            ['Retorno', s.roi != null ? `${s.roi >= 0 ? '+' : ''}${Math.round(s.roi * 100)} %` : '—', s.roi != null && s.roi < 0],
          ].map(([label, value, bad]) => (
            <div key={label} className="flex flex-col rounded-2xl bg-surface-secondary p-2">
              <span className={`text-sm font-semibold tabular-nums ${bad ? 'text-danger' : ''}`}>{value}</span>
              <span className="text-[10px] text-muted">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </a>
  );
}

/** La ficha de una campaña: sus cifras, sus publicaciones y sus leads. */
export function CampanaPage({ id }) {
  const [state] = useCrm();
  const [editing, setEditing] = useState(false);
  const c = find('campaigns', id);
  if (!c) return <Empty icon={Flag} title="Esa campaña ya no existe" action={<Button onPress={() => go('#/marketing/campanas')}>Ver campañas</Button>} />;
  const s = campaignStats(c);
  const b = c.brandId && find('brands', c.brandId);
  const order = Object.keys(CAMPAIGN_STATUS);
  return (
    <div className="flex flex-col gap-6" data-n={state.campaigns?.length}>
      <div className="flex flex-wrap items-start gap-3">
        <Button isIconOnly variant="ghost" aria-label="Volver a campañas" onPress={() => go('#/marketing/campanas')}>
          <ArrowLeft />
        </Button>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: c.color || CAMPAIGN_COLORS[0] }}>
          <Flag className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="sw-eyebrow">Campaña</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.name}</h1>
          <p className="text-sm text-muted">{[b?.name, c.start && `${dateText(c.start)} → ${c.end ? dateText(c.end) : 'sin final'}`].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="tertiary"
              aria-label="Cambiar el estado"
              onPress={() => put('campaigns', { ...c, status: order[(order.indexOf(c.status) + 1) % order.length] })}
            >
              <span className={`size-2 rounded-full ${c.status === 'active' ? 'bg-accent' : c.status === 'done' ? 'bg-success' : 'bg-muted'}`} />
              {CAMPAIGN_STATUS[c.status]?.[0] || 'Planificada'}
            </Button>
            {c.goal && <span className="text-sm">{c.goal}</span>}
          </div>
        </div>
        <ButtonGroup variant="secondary">
          <Button variant="secondary" onPress={() => setEditing(true)}>
            <Pencil />
            Editar
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              const l = newLead({ campaignId: c.id, brandId: c.brandId || '' });
              put('leads', l);
              go(`#/leads/${l.id}`);
            }}
          >
            <ButtonGroup.Separator />
            <Funnel />
            Nuevo lead
          </Button>
        </ButtonGroup>
        <Button onPress={() => openPost({ brandId: c.brandId || brands()[0]?.id, campaignId: c.id, date: c.start && c.start > todayISO() ? c.start : todayISO() })}>
          <Plus />
          Nueva publicación
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Publicaciones" value={`${s.published.length} / ${s.posts.length}`} icon={Calendar} sub={s.reach ? `${bigNum(s.reach)} de alcance` : 'Publicadas del total'} />
        <Stat label="Leads" value={s.target ? `${s.leads.length} / ${s.target}` : String(s.leads.length)} icon={Funnel} sub={plural(s.won.length, 'ganado', 'ganados')} />
        <Stat label="Coste por lead" value={s.cpl != null ? money(s.cpl, c.currency) : '—'} sub={s.spent ? `${money(s.spent, c.currency)} gastados` : c.budget ? `Con el presupuesto de ${money(c.budget, c.currency)}` : 'Sin presupuesto'} />
        <Stat label="Ventas" value={money(s.wonValue, c.currency)} tone={s.roi != null && s.roi < 0 ? 'var(--danger)' : undefined} icon={ChartColumn} sub={s.roi != null ? `Retorno del ${Math.round(s.roi * 100)} %` : 'De los leads ganados'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Publicaciones" description={s.posts.length ? 'Por fecha.' : 'Ninguna todavía.'}>
          {s.posts.length ? (
            <ul className="flex flex-col">
              {[...s.posts].sort(byDate).map((p) => {
                const e = engagement(p);
                const n = leadsOf(p).length;
                return (
                  <li key={p.id}>
                    <a href={`#/marketing/pieza/${p.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-surface-secondary">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-sm font-medium">{p.title || 'Sin título'}</b>
                        <span className="truncate text-xs text-muted">{[dateText(p.date), e != null && `Interacción ${pctText(e)}`, n && plural(n, 'lead', 'leads')].filter(Boolean).join(' · ')}</span>
                      </span>
                      <PostStatus status={p.status} />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Crea una publicación en esta campaña o elígela en la ficha de una existente.</p>
          )}
        </Panel>
        <Panel title="Leads" description={s.leads.length ? 'Los que llegaron por esta campaña.' : 'Ninguno todavía.'}>
          {s.leads.length ? (
            <ul className="flex flex-col">
              {s.leads.map((l) => {
                const st = LEAD_STAGES[l.stage] || LEAD_STAGES.new;
                return (
                  <li key={l.id}>
                    <a href={`#/leads/${l.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-surface-secondary">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-sm font-medium">{l.name || l.company || 'Sin nombre'}</b>
                        <span className="truncate text-xs text-muted">{[l.interest, l.value ? money(l.value, l.currency) : ''].filter(Boolean).join(' · ') || 'Sin detalle'}</span>
                      </span>
                      <Chip size="sm" variant="soft" color={st[1]}>
                        {st[0]}
                      </Chip>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Al apuntar un lead, elige esta campaña en «De dónde vino».</p>
          )}
        </Panel>
      </div>
      {c.notes && (
        <Panel title="Notas">
          <p className="whitespace-pre-line text-sm">{c.notes}</p>
        </Panel>
      )}
      {editing && <CampaignForm campaign={c} onClose={() => setEditing(false)} onSaved={(x) => !x && go('#/marketing/campanas')} />}
    </div>
  );
}

/* ── Marcas ─────────────────────────────────────────────────────────────── */

export function Marcas() {
  const [state] = useCrm();
  const month = todayISO().slice(0, 7);
  const create = () => {
    const b = {
      id: uid(),
      order: brands().length,
      name: 'Marca nueva',
      handle: '',
      industry: '',
      tone: '',
      fonts: '',
      colors: { primary: '#1d2126', secondary: '#00b8d4', accent: '#1f9d46' },
      guidelines: '',
      audience: '',
      pillars: '',
      hashtags: '',
      hashtagSets: '',
      cadence: 3,
      cta: '',
      link: '',
      logo: '',
      assets: [],
      svgs: [],
    };
    put('brands', b);
    go(`#/marketing/marcas/${b.id}`);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {brands().map((b) => {
        const posts = list(state, 'posts').filter((p) => p.brandId === b.id);
        const upcoming = posts.filter((p) => p.date >= todayISO() && p.status !== 'publicado').length;
        const leadsMonth = list(state, 'leads').filter((l) => l.brandId === b.id && (l.createdOn || '').startsWith(month)).length;
        return (
          <a key={b.id} href={`#/marketing/marcas/${b.id}`} className="block rounded-3xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Card className="relative h-full gap-3 overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: brandColor(b) }} />
              <div className="flex items-center gap-3">
                <BrandMark b={b} size="size-12" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate font-semibold text-foreground">{b.name}</b>
                  <span className="truncate text-xs text-muted">{[b.handle, b.industry].filter(Boolean).join(' · ') || 'Completa sus datos'}</span>
                </span>
                <span className="flex -space-x-1.5">
                  {['primary', 'secondary', 'accent'].map((k) => (
                    <span key={k} className="size-5 rounded-full ring-2 ring-surface" style={{ background: b.colors?.[k] || '#ccc' }} title={b.colors?.[k]} />
                  ))}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [posts.filter((p) => (p.date || '').startsWith(month)).length, b.cadence ? `este mes · ${b.cadence}/sem` : 'este mes'],
                  [upcoming, 'por publicar'],
                  [leadsMonth, 'leads este mes'],
                ].map(([n, label]) => (
                  <div key={label} className="flex flex-col rounded-2xl bg-surface-secondary p-2">
                    <b className="text-lg tabular-nums text-foreground">{n}</b>
                    <span className="text-[10px] text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </a>
        );
      })}
      <button type="button" onClick={create} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted outline-none hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus">
        <Plus className="size-5" />
        <b className="text-sm">Nueva marca</b>
      </button>
    </div>
  );
}

function AssetForm({ b, onClose }) {
  const clean = (v) => {
    const s = String(v || '').trim();
    return /^\/[\w./-]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
  };
  return (
    <FormModal
      title="Añadir imagen por dirección"
      submit="Añadir"
      onClose={onClose}
      onSubmit={(f) => {
        const url = clean(f.url);
        const title = String(f.title || '').trim();
        if (!title || !url) {
          toast.danger('Pon un nombre y una dirección que empiece por / o por https://');
          return false;
        }
        b.assets = [...(b.assets || []), { id: uid(), title, url, darkUrl: clean(f.darkUrl), note: '' }];
        put('brands', b);
        return true;
      }}
    >
      <TextField name="title" isRequired maxLength={80} className="sm:col-span-2">
        <Label>Nombre</Label>
        <Input placeholder="Pantalla de inicio" />
      </TextField>
      <TextField name="url" isRequired maxLength={500} className="sm:col-span-2">
        <Label>Dirección de la imagen</Label>
        <Input placeholder="/img/… o https://…" />
        <span className="text-xs text-muted">Una ruta del sitio (/img/…) o una dirección https.</span>
      </TextField>
      <TextField name="darkUrl" maxLength={500} className="sm:col-span-2">
        <Label>Versión oscura</Label>
        <Input placeholder="Opcional" />
        <span className="text-xs text-muted">Si la tiene, se usa al ver los recursos en oscuro.</span>
      </TextField>
    </FormModal>
  );
}

function SvgForm({ b, onClose }) {
  return (
    <FormModal
      title="Añadir SVG"
      submit="Añadir"
      size="sm:max-w-[640px]"
      onClose={onClose}
      onSubmit={(f) => {
        const title = String(f.title || '').trim();
        const code = String(f.code || '').trim();
        if (!title || !/^<svg[\s>][\s\S]*<\/svg>$/i.test(code)) {
          toast.danger('El código tiene que empezar por <svg y terminar en </svg>.');
          return false;
        }
        b.svgs = [...(b.svgs || []), { id: uid(), title, code }];
        put('brands', b);
        return true;
      }}
    >
      <TextField name="title" isRequired maxLength={80} className="sm:col-span-2">
        <Label>Nombre</Label>
        <Input placeholder="Logo en blanco" />
      </TextField>
      <TextField name="code" isRequired maxLength={60000} className="sm:col-span-2">
        <Label>Código</Label>
        <TextArea rows={8} placeholder="<svg …>…</svg>" className="font-mono text-xs" />
        <span className="text-xs text-muted">Pega el código completo, desde &lt;svg hasta &lt;/svg&gt;.</span>
      </TextField>
    </FormModal>
  );
}

function downloadSvg(s) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([s.code], { type: 'image/svg+xml' }));
  a.download = `${s.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'logo'}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ColorField({ label, value, onChange }) {
  const [hex, setHex] = useState(value || '#000000');
  const set = (v) => {
    setHex(v);
    if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl bg-surface-secondary p-1.5">
        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-border" style={{ background: /^#[0-9a-f]{6}$/i.test(hex) ? hex : value }}>
          <span className="sr-only">{label}</span>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'} onChange={(e) => set(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <input
          value={hex}
          maxLength={7}
          aria-label={`${label} en hexadecimal`}
          onChange={(e) => set(e.target.value)}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase outline-none"
        />
        <Button isIconOnly size="sm" variant="ghost" aria-label={`Copiar ${label}`} onPress={() => copy(hex, 'Color')}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** La ficha de una marca. Cada campo se guarda al escribir. */
export function MarcaPage({ id }) {
  const [state] = useCrm();
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState(null); // 'asset' | 'svg'
  const [ask, setAsk] = useState(null); // { kind, item }
  const timer = useRef(0);
  const b = find('brands', id);
  if (!b) return <Empty icon={Palette} title="Esa marca ya no existe" action={<Button onPress={() => go('#/marketing/marcas')}>Ver marcas</Button>} />;
  const posts = list(state, 'posts').filter((p) => p.brandId === b.id);
  const save = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => put('brands', b), 250);
  };
  const text = (key, label, { area = false, rows = 2, maxLength = 160, placeholder, hint, className = '' } = {}) => (
    <TextField
      key={`${b.id}-${key}`}
      defaultValue={b[key] ?? ''}
      maxLength={maxLength}
      className={className}
      onChange={(v) => {
        b[key] = v;
        save();
      }}
    >
      <Label>{label}</Label>
      {area ? <TextArea rows={rows} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </TextField>
  );
  const number = (key, label, hint) => (
    <TextField
      key={`${b.id}-${key}`}
      defaultValue={b[key] ? String(b[key]) : ''}
      inputMode="numeric"
      maxLength={9}
      onChange={(v) => {
        b[key] = Math.max(0, Math.round(Number(String(v).replace(/\D/g, '')) || 0));
        save();
      }}
    >
      <Label>{label}</Label>
      <Input placeholder="0" />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </TextField>
  );
  const uploadLogo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        toast('Subiendo logo…');
        b.logo = fileUrl((await uploadFile(f)).id);
        put('brands', b);
        toast.success('Logo listo');
      } catch (err) {
        toast.danger('No se pudo subir', { description: err.message });
      }
    });
    input.click();
  };
  const uploadAssets = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.multiple = true;
    input.addEventListener('change', async () => {
      for (const f of [...(input.files || [])]) {
        try {
          toast(`Subiendo ${f.name}…`);
          const meta = await uploadFile(f);
          b.assets = [...(b.assets || []), { id: uid(), title: f.name.replace(/\.[^.]+$/, ''), url: fileUrl(meta.id), darkUrl: '', note: 'Subida' }];
          put('brands', b);
        } catch (err) {
          toast.danger('No se pudo subir', { description: err.message });
        }
      }
    });
    input.click();
  };
  const assets = b.assets || [];
  const svgs = b.svgs || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button isIconOnly variant="ghost" aria-label="Volver a marcas" onPress={() => go('#/marketing/marcas')}>
          <ArrowLeft />
        </Button>
        <BrandMark b={b} size="size-14" rounded="rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="sw-eyebrow">Marca</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{b.name || 'Sin nombre'}</h1>
          <p className="text-sm text-muted">{[b.handle, b.industry].filter(Boolean).join(' · ') || 'Completa sus datos abajo.'}</p>
        </div>
        <ButtonGroup variant="secondary">
          <Button
            variant="secondary"
            onPress={() => {
              localStorage.setItem(MARCA_KEY, b.id);
              go('#/marketing/calendario');
            }}
          >
            <Calendar />
            Su calendario ({posts.length})
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              localStorage.setItem(MARCA_KEY, b.id);
              go('#/marketing/resultados');
            }}
          >
            <ButtonGroup.Separator />
            <ChartColumn />
            Resultados
          </Button>
        </ButtonGroup>
        <Button onPress={() => openPost({ brandId: b.id })}>
          <Plus />
          Nueva publicación
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Identidad">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {text('name', 'Nombre', { maxLength: 80 })}
              {text('handle', 'Usuario', { maxLength: 60, placeholder: '@marca' })}
            </div>
            {text('industry', 'A qué se dedica', { maxLength: 160 })}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Logo</span>
              <div className="flex items-center gap-3">
                <BrandMark b={b} size="size-16" rounded="rounded-2xl" />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onPress={uploadLogo}>
                    <Picture />
                    {b.logo ? 'Cambiar logo' : 'Subir logo'}
                  </Button>
                  {b.logo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        b.logo = '';
                        put('brands', b);
                      }}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['primary', 'Principal'],
                ['secondary', 'Secundario'],
                ['accent', 'Acento'],
              ].map(([k, label]) => (
                <ColorField
                  key={`${b.id}-${k}`}
                  label={label}
                  value={b.colors?.[k] || '#000000'}
                  onChange={(v) => {
                    b.colors = { ...b.colors, [k]: v };
                    save();
                  }}
                />
              ))}
            </div>
            {text('fonts', 'Tipografía', { maxLength: 160 })}
            {text('tone', 'Tono de voz', { area: true, maxLength: 1000 })}
          </div>
        </Panel>
        <Panel title="Estrategia">
          <div className="flex flex-col gap-4">
            {text('audience', 'Público (buyer persona)', { area: true, maxLength: 2000 })}
            {text('pillars', 'Pilares de contenido', { area: true, rows: 3, maxLength: 2000, hint: 'Uno por línea. Cada publicación puede llevar el suyo.' })}
            <div className="grid gap-3 sm:grid-cols-2">
              {number('cadence', 'Publicaciones por semana', 'El calendario te dice si vas al día.')}
              {number('followers', 'Seguidores', 'Para la vista del feed.')}
            </div>
            {text('cta', 'Llamada a la acción', { maxLength: 200 })}
            {text('link', 'Enlace', { maxLength: 300, placeholder: 'https://…', hint: 'Sustituye a «link en la bio» al adaptar un copy a Facebook.' })}
            {text('hashtags', 'Hashtags de la marca', { area: true, maxLength: 1000, hint: 'Se ponen solos en cada publicación nueva.' })}
            {text('hashtagSets', 'Grupos de hashtags', { area: true, rows: 3, maxLength: 3000, placeholder: 'Finanzas: #ahorro #presupuesto\nVenezuela: #venezuela #caracas', hint: 'Uno por línea, «Nombre: #uno #dos». Se añaden con un toque al escribir una publicación.' })}
            {text('guidelines', 'Pautas de diseño', { area: true, rows: 3, maxLength: 3000 })}
          </div>
        </Panel>
      </div>

      <Panel
        title="Imágenes y capturas"
        description="Se eligen al crear una publicación."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {assets.some((a) => a.darkUrl) && (
              <Tabs selectedKey={dark ? 'dark' : 'light'} onSelectionChange={(k) => setDark(k === 'dark')}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Versión">
                    <Tabs.Tab id="light">
                      Claro
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="dark">
                      Oscuro
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            )}
            <ButtonGroup size="sm" variant="secondary">
              <Button size="sm" variant="secondary" onPress={() => setDialog('asset')}>
                <LinkIcon />
                Por dirección
              </Button>
              <Button size="sm" variant="secondary" onPress={uploadAssets}>
                <ButtonGroup.Separator />
                <Picture />
                Subir
              </Button>
            </ButtonGroup>
          </div>
        }
      >
        {assets.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {assets.map((a) => {
              const src = dark && a.darkUrl ? a.darkUrl : a.url;
              return (
                <figure key={a.id} className="m-0 flex flex-col gap-1.5">
                  <a href={src} target="_blank" rel="noopener noreferrer" title="Abrir" className="block overflow-hidden rounded-2xl bg-surface-secondary">
                    <img src={src} alt={a.title} loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                  </a>
                  <figcaption className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-xs">{a.title}</span>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Copiar la dirección de ${a.title}`} onPress={() => copy(new URL(src, location.origin).href, 'Dirección')}>
                      <Copy className="size-3.5" />
                    </Button>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${a.title}`} onPress={() => setAsk({ kind: 'asset', item: a })}>
                      <TrashBin className="size-3.5" />
                    </Button>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">Todavía no hay imágenes.</p>
        )}
      </Panel>

      <Panel
        title="Logos en SVG"
        description="Pega el código una vez y cópialo o descárgalo cuando haga falta."
        action={
          <Button size="sm" variant="secondary" onPress={() => setDialog('svg')}>
            <Code />
            Añadir SVG
          </Button>
        }
      >
        {svgs.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {svgs.map((s) => (
              <figure key={s.id} className="m-0 flex flex-col gap-1.5">
                {/* Un SVG se enseña como imagen: así su código no se ejecuta nunca en la página. */}
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-[repeating-conic-gradient(var(--default)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4">
                  <img src={svgUrl(s.code)} alt={s.title} className="max-h-full max-w-full" />
                </div>
                <figcaption className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-xs">{s.title}</span>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={`Copiar el código de ${s.title}`} onPress={() => copy(s.code, 'Código SVG')}>
                    <Copy className="size-3.5" />
                  </Button>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={`Descargar ${s.title}`} onPress={() => downloadSvg(s)}>
                    <ArrowDownToLine className="size-3.5" />
                  </Button>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${s.title}`} onPress={() => setAsk({ kind: 'svg', item: s })}>
                    <TrashBin className="size-3.5" />
                  </Button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sin SVG todavía.</p>
        )}
      </Panel>

      <div className="flex justify-end">
        <ConfirmButton
          title={`¿Eliminar la marca ${b.name}?`}
          text={posts.length ? `Sus ${posts.length} publicaciones se quedan sin marca.` : 'No se puede deshacer.'}
          onConfirm={() => {
            remove('brands', b.id);
            toast('Marca eliminada');
            go('#/marketing/marcas');
          }}
        >
          <TrashBin />
          Eliminar marca
        </ConfirmButton>
      </div>

      {dialog === 'asset' && <AssetForm b={b} onClose={() => setDialog(null)} />}
      {dialog === 'svg' && <SvgForm b={b} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={!!ask}
        title={ask ? `¿Quitar «${ask.item.title}»${ask.kind === 'asset' ? ` de ${b.name}` : ''}?` : ''}
        confirm="Quitar"
        onClose={() => setAsk(null)}
        onConfirm={() => {
          const key = ask.kind === 'asset' ? 'assets' : 'svgs';
          b[key] = (b[key] || []).filter((x) => x.id !== ask.item.id);
          put('brands', b);
        }}
      />
    </div>
  );
}
