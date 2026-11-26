// Inicio: un tablero de widgets. Arriba, las cifras del periodo (cobrado, gastado,
// beneficio y por cobrar) con su variación y su tendencia de 12 meses; luego las
// entradas y salidas de cada mes con el beneficio encima, en qué se fue el dinero,
// lo que pide atención hoy, lo que falta por cobrar y lo último que pasó.
import { useMemo, useState } from 'react';
import { ArrowRight, Bell, CircleCheck, CircleDollar, Eye, FileText, Funnel, Person, Wallet, Xmark } from '@gravity-ui/icons';
import { Button, Chip, Link, ProgressBar, Tabs } from '@heroui/react';
import { Empty, PageHeader, Panel, Person as PersonAvatar, StatusChip } from '../../kit/parts.jsx';
import { ComposedChart, DonutChart, KpiGroup, Timeline, Widget } from '../../pro/index.js';
import { useCrm } from '../store.js';
import {
  DOC_STATUS,
  activity,
  base,
  change,
  collected,
  customerName,
  docStatus,
  dueLeads,
  firstSteps,
  fmt,
  followText,
  greeting,
  last12Months,
  leadName,
  periodRange,
  receivable,
  relDay,
  shortDate,
  spent,
  totals,
  within,
} from '../domain.js';
import { money, shortMonth } from '../../../negocio-core.js';
import { expenseBase } from '../../../negocio-gastos.js';

const PERIODS = [
  ['30d', '30 días'],
  ['month', 'Este mes'],
  ['year', 'Este año'],
  ['all', 'Todo'],
];
const PREV = { '30d': 'vs. 30 días antes', month: 'vs. el mes pasado', year: 'vs. el año pasado' };
const KIND_ICON = { in: CircleDollar, doc: FileText, view: Eye, ok: CircleCheck, no: Xmark, out: Wallet, person: Person, lead: Funnel };
const KIND_COLOR = { in: 'var(--success)', ok: 'var(--success)', no: 'var(--danger)', out: 'var(--sw-chart-out)', lead: 'var(--accent)' };
const STEPS_KEY = 'negocio-primeros-pasos';

const compactNum = new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 });

/** Gastos del periodo por categoría, en la moneda principal. */
function byCategory(state, r) {
  const names = new Map((state.categories || []).map((c) => [c.id, c.name]));
  const sums = new Map();
  for (const e of state.expenses || []) {
    if (!within(e.date, r)) continue;
    const v = expenseBase(e);
    if (v == null || v <= 0) continue;
    const key = e.categoryId || '__none';
    sums.set(key, (sums.get(key) || 0) + v);
  }
  return [...sums].map(([key, value]) => ({ key, label: names.get(key) || 'Sin categoría', value }));
}

export function Inicio() {
  const [state, v] = useCrm();
  const [period, setPeriod] = useState(() => localStorage.getItem('negocio-periodo') || 'year');
  const [stepsHidden, setStepsHidden] = useState(() => localStorage.getItem(STEPS_KEY) === 'cerrado');

  const data = useMemo(() => {
    const r = periodRange(period);
    const inNow = collected(r);
    const outNow = spent(r);
    const inPrev = r.prev ? collected(r.prev) : null;
    const outPrev = r.prev ? spent(r.prev) : null;
    const months = last12Months();
    return {
      r,
      inNow,
      outNow,
      profit: inNow.sum - outNow.sum,
      profitPrev: inPrev && outPrev ? inPrev.sum - outPrev.sum : null,
      dIn: inPrev ? change(inNow.sum, inPrev.sum) : null,
      dOut: outPrev ? change(outNow.sum, outPrev.sum) : null,
      rec: receivable(),
      months,
      cats: byCategory(state, r),
      feed: activity(8),
      due: dueLeads(),
      steps: firstSteps(),
    };
  }, [period, v, state]);

  const pickPeriod = (key) => {
    setPeriod(key);
    localStorage.setItem('negocio-periodo', key);
  };
  const stepsDone = data.steps.filter(([ok]) => ok).length;
  const showSteps = !stepsHidden && stepsDone < data.steps.length;
  const prevText = PREV[period];
  const cur = base();
  const periodLabel = PERIODS.find(([k]) => k === period)?.[1];
  const profitDelta = data.profitPrev != null && data.profitPrev > 0 ? change(data.profit, data.profitPrev) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={greeting()}
        description="Lo que entró, lo que salió y lo que falta por cobrar."
        actions={
          <Tabs selectedKey={period} onSelectionChange={(k) => pickPeriod(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Periodo">
                {PERIODS.map(([id, label]) => (
                  <Tabs.Tab key={id} id={id}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        }
      />

      {showSteps && (
        <Panel
          title="Primeros pasos"
          description={`${stepsDone} de ${data.steps.length} hechos`}
          action={
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                localStorage.setItem(STEPS_KEY, 'cerrado');
                setStepsHidden(true);
              }}
            >
              Ocultar
            </Button>
          }
        >
          <ProgressBar value={(stepsDone / data.steps.length) * 100} aria-label="Primeros pasos" size="sm">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <ol className="mt-3 grid gap-1 sm:grid-cols-2">
            {data.steps.map(([ok, text, href]) => (
              <li key={text}>
                <a href={href} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-secondary ${ok ? 'text-muted line-through' : ''}`}>
                  <CircleCheck className={ok ? 'text-success' : 'text-muted'} />
                  {text}
                </a>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Widget title="Cifras" action={<span>{periodLabel}{prevText ? ` · ${prevText}` : ''}</span>}>
        <KpiGroup
          items={[
            {
              label: 'Cobrado',
              value: fmt(data.inNow.sum),
              delta: data.dIn,
              sub: `${data.inNow.count} cobros`,
              trend: data.months.map((m) => m.in),
              trendColor: 'var(--sw-chart-in)',
              href: '#/cobros',
            },
            {
              label: 'Gastado',
              value: fmt(data.outNow.sum),
              delta: data.dOut,
              upIsGood: false,
              sub: data.outNow.skipped ? `${data.outNow.skipped} sin tasa` : 'En gastos',
              trend: data.months.map((m) => m.out),
              trendColor: 'var(--sw-chart-out)',
              href: '#/gastos',
            },
            {
              label: 'Beneficio',
              value: fmt(data.profit),
              delta: profitDelta,
              sub: 'Cobrado menos gastado',
              tone: data.profit < 0 ? 'var(--danger)' : undefined,
              trend: data.months.map((m) => m.in - m.out),
            },
            {
              label: 'Por cobrar',
              value: fmt(data.rec.sum),
              sub: data.rec.overdue.length ? `${data.rec.overdue.length} vencidas de ${data.rec.open.length}` : `${data.rec.open.length} facturas abiertas`,
              tone: data.rec.overdue.length ? 'var(--danger)' : undefined,
              href: '#/facturas',
            },
          ]}
        />
      </Widget>

      <div className="grid gap-4 xl:grid-cols-3">
        <Widget title="Entradas y salidas" description={`Últimos 12 meses, en ${cur}`} className="xl:col-span-2">
          <ComposedChart
            title="Entradas, salidas y beneficio de los últimos 12 meses"
            xLabel="Mes"
            data={data.months.map((m) => ({ key: m.key, label: shortMonth(m.key), in: m.in, out: m.out, net: m.in - m.out }))}
            series={[
              { key: 'in', name: 'Entradas', type: 'bar', color: 'var(--sw-chart-in)' },
              { key: 'out', name: 'Salidas', type: 'bar', color: 'var(--sw-chart-out)' },
              { key: 'net', name: 'Beneficio', type: 'line', color: 'var(--foreground)' },
            ]}
            format={(x) => money(x, cur)}
            compact={(x) => compactNum.format(x)}
          />
        </Widget>

        <Widget
          title="En qué se fue"
          description={`Gastos por categoría · ${periodLabel?.toLowerCase()}`}
          action={
            <Link href="#/gastos" className="text-xs">
              Gastos
              <ArrowRight className="size-3" />
            </Link>
          }
        >
          {data.cats.length ? (
            <DonutChart title="Gastos por categoría" parts={data.cats} format={(x) => money(x, cur)} totalLabel="Gastado" size={150} layout="stack" />
          ) : (
            <Empty icon={Wallet} title="Sin gastos" text="Cuando anotes gastos, aquí verás en qué se va el dinero." />
          )}
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="Para hoy"
          description={data.due.length ? `${data.due.length} seguimientos de leads` : 'Nada atrasado'}
          action={
            <Link href="#/leads" className="text-xs">
              Leads
              <ArrowRight className="size-3" />
            </Link>
          }
          bodyClassName="p-2"
        >
          {data.due.length ? (
            <ul className="flex flex-col">
              {data.due.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <a href={`#/leads/${l.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                    <PersonAvatar name={leadName(l)} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{leadName(l)}</span>
                      <span className="truncate text-xs text-muted">{l.nextNote || 'Seguimiento'}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={l.nextAt < new Date().toLocaleDateString('en-CA') ? 'danger' : 'warning'}>
                      {followText(l.nextAt)}
                    </Chip>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Bell} title="Todo al día" text="Los seguimientos de leads que toquen hoy salen aquí." />
          )}
        </Widget>

        <Widget
          title="Por cobrar"
          description={data.rec.skipped ? `${data.rec.skipped} en otra moneda sin equivalencia` : `${data.rec.open.length} facturas`}
          action={
            <Link href="#/cobros" className="text-xs">
              Cobros
              <ArrowRight className="size-3" />
            </Link>
          }
          bodyClassName="p-2"
        >
          {data.rec.open.length ? (
            <ul className="flex flex-col">
              {[...data.rec.open]
                .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                .slice(0, 6)
                .map((d) => {
                  const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.pending;
                  return (
                    <li key={d.id}>
                      <a href={`#/documentos/${d.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{customerName(d)}</span>
                          <span className="truncate text-xs text-muted">
                            {d.number} · vence {shortDate(d.dueDate) || '—'}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-sm tabular-nums">{money(totals(d).due, d.currency)}</span>
                          <StatusChip label={st[0]} color={st[1]} />
                        </span>
                      </a>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <Empty icon={CircleDollar} title="Nada por cobrar" text="Las facturas con saldo pendiente salen aquí." />
          )}
        </Widget>

        <Widget title="Lo último que pasó">
          {data.feed.length ? (
            <Timeline
              label="Lo último que pasó"
              items={data.feed.map((item, i) => ({
                id: `${item.href}-${i}`,
                marker: { icon: KIND_ICON[item.kind] || FileText, color: KIND_COLOR[item.kind] },
                title: (
                  <a href={item.href} className="font-normal hover:underline">
                    {item.text}
                  </a>
                ),
                trailing: relDay(item.date),
              }))}
            />
          ) : (
            <Empty icon={FileText} title="Todavía no hay movimiento" text="Cobros, facturas, firmas, gastos y clientes nuevos salen aquí." />
          )}
        </Widget>
      </div>
    </div>
  );
}
