// Inicio: lo que entró, lo que salió y lo que falta por cobrar en el periodo
// elegido, frente al tramo anterior; entradas y salidas de 12 meses; lo que pide
// atención hoy y lo último que pasó.
import { useMemo, useState } from 'react';
import { ArrowRight, Bell, CircleCheck, CircleDollar, Eye, FileText, Funnel, Person, Wallet, Xmark } from '@gravity-ui/icons';
import { Button, Chip, Link, ProgressBar, Separator, Tabs, Label } from '@heroui/react';
import { BarsChart } from '../../kit/BarsChart.jsx';
import { Empty, PageHeader, Panel, Person as PersonAvatar, Stat, StatusChip } from '../../kit/parts.jsx';
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
} from '../domain.js';
import { money, shortMonth } from '../../../negocio-core.js';

const PERIODS = [
  ['30d', '30 días'],
  ['month', 'Este mes'],
  ['year', 'Este año'],
  ['all', 'Todo'],
];
const PREV = { '30d': 'frente a los 30 días anteriores', month: 'frente al mismo tramo del mes pasado', year: 'frente al mismo tramo del año pasado' };
const KIND_ICON = { in: CircleDollar, doc: FileText, view: Eye, ok: CircleCheck, no: Xmark, out: Wallet, person: Person, lead: Funnel };
const STEPS_KEY = 'negocio-primeros-pasos';

const compactNum = new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 });

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
    const rec = receivable();
    return {
      r,
      inNow,
      outNow,
      profit: inNow.sum - outNow.sum,
      profitPrev: inPrev && outPrev ? inPrev.sum - outPrev.sum : null,
      dIn: inPrev ? change(inNow.sum, inPrev.sum) : null,
      dOut: outPrev ? change(outNow.sum, outPrev.sum) : null,
      rec,
      months: last12Months(),
      feed: activity(8),
      due: dueLeads(),
      steps: firstSteps(),
      expenses: [...(state.expenses || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5),
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

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cobrado" value={fmt(data.inNow.sum)} delta={data.dIn} sub={data.dIn != null ? prevText : `${data.inNow.count} cobros`} />
        <Stat label="Gastado" value={fmt(data.outNow.sum)} delta={data.dOut} upIsGood={false} sub={data.outNow.skipped ? `${data.outNow.skipped} sin tasa` : prevText || 'En gastos'} href="#/gastos" />
        <Stat
          label="Beneficio"
          value={fmt(data.profit)}
          delta={data.profitPrev != null ? change(data.profit, data.profitPrev) : null}
          tone={data.profit < 0 ? 'var(--danger)' : undefined}
          sub="Cobrado menos gastado"
        />
        <Stat
          label="Por cobrar"
          value={fmt(data.rec.sum)}
          icon={CircleDollar}
          sub={data.rec.overdue.length ? `${data.rec.overdue.length} vencidas` : `${data.rec.open.length} facturas abiertas`}
          tone={data.rec.overdue.length ? 'var(--danger)' : undefined}
          href="#/facturas"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Entradas y salidas" description={`Últimos 12 meses, en ${cur}`} className="xl:col-span-2">
          <BarsChart
            title="Entradas y salidas de los últimos 12 meses"
            groups={data.months.map((m) => ({ key: m.key, label: shortMonth(m.key), values: [m.in, m.out] }))}
            series={[
              { name: 'Entradas', color: 'var(--sw-chart-in)' },
              { name: 'Salidas', color: 'var(--sw-chart-out)' },
            ]}
            format={(x) => money(x, cur)}
            compact={(x) => compactNum.format(x)}
          />
        </Panel>

        <Panel
          title="Para hoy"
          description={data.due.length ? `${data.due.length} seguimientos de leads` : 'Nada atrasado'}
          action={
            <Link href="#/leads" className="text-sm">
              Leads
              <ArrowRight className="size-3.5" />
            </Link>
          }
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
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Facturas por cobrar"
          description={data.rec.skipped ? `${data.rec.skipped} en otra moneda sin equivalencia` : undefined}
          action={
            <Link href="#/facturas" className="text-sm">
              Todas
              <ArrowRight className="size-3.5" />
            </Link>
          }
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
                        <StatusChip label={st[0]} color={st[1]} />
                        <span className="w-28 text-end text-sm tabular-nums">{money(totals(d).due, d.currency)}</span>
                      </a>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <Empty icon={CircleDollar} title="Nada por cobrar" text="Las facturas con saldo pendiente salen aquí." />
          )}
        </Panel>

        <Panel title="Lo último que pasó">
          {data.feed.length ? (
            <ol className="flex flex-col">
              {data.feed.map((item, i) => {
                const Icon = KIND_ICON[item.kind] || FileText;
                return (
                  <li key={`${item.href}-${i}`}>
                    <a href={item.href} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                        <Icon className="size-4 text-muted" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.text}</span>
                      <span className="shrink-0 text-xs text-muted">{relDay(item.date)}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Empty icon={FileText} title="Todavía no hay movimiento" text="Cobros, facturas, firmas, gastos y clientes nuevos salen aquí." />
          )}
          {data.expenses.length > 0 && (
            <>
              <Separator className="my-3" />
              <Label className="sw-eyebrow">Últimos gastos</Label>
              <ul className="mt-1 flex flex-col">
                {data.expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                    <span className="truncate">{e.vendor || e.title}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {money(e.amount, e.currency)} · {shortDate(e.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

