// Dinero › Cobros: arriba, lo cobrado mes a mes frente a lo facturado y lo que falta
// por cobrar según lo atrasado que está; debajo, lo pendiente (con «Registrar» en
// cada factura) y el historial de todo lo cobrado, con la tasa del día de cada pago.
import { useMemo, useState } from 'react';
import { CircleDollar, Receipt } from '@gravity-ui/icons';
import { Button, Chip, Table, Tabs } from '@heroui/react';
import { paymentBase } from '../../../negocio-core.js';
import { Empty, PageHeader, StatusChip } from '../../kit/parts.jsx';
import { ComposedChart, DonutChart, Widget } from '../../pro/index.js';
import { aging, billedAndCollected, compactNum } from '../series.js';
import { go, useCrm } from '../store.js';
import { DOC_STATUS, base, collected, customerName, docStatus, fmt, invoices, money, periodRange, receivable, shortDate, todayISO, totals } from '../domain.js';
import { PaymentForm } from '../payments.jsx';

export function Cobros() {
  const [state, v] = useCrm();
  const [tab, setTab] = useState('pendiente');
  const [paying, setPaying] = useState(null);

  const data = useMemo(() => {
    const rec = receivable();
    const month = collected(periodRange('month'));
    const year = collected(periodRange('year'));
    const open = [...rec.open].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    const history = invoices()
      .flatMap((d) => (d.payments || []).map((p) => ({ d, p, base: paymentBase(d, p) })))
      .sort((a, b) => (b.p.date || '').localeCompare(a.p.date || ''));
    return { rec, month, year, open, history, months: billedAndCollected(state.docs), aging: aging(rec.open) };
  }, [state, v]);
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Dinero" title="Cobros" description="Lo que te deben y lo que ya entró. Cada pago cuenta con su tasa del día." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="Cobrado y facturado"
          description={`Últimos 12 meses, en ${base()}`}
          className="lg:col-span-2"
          action={
            <span className="flex gap-4">
              <span>
                Este mes <b className="text-foreground tabular-nums">{fmt(data.month.sum)}</b>
              </span>
              <span>
                Este año <b className="text-foreground tabular-nums">{fmt(data.year.sum)}</b>
              </span>
            </span>
          }
        >
          <ComposedChart
            title="Facturado y cobrado de los últimos 12 meses"
            xLabel="Mes"
            height={220}
            data={data.months}
            series={[
              { key: 'billed', name: 'Facturado', type: 'bar', color: 'var(--sw-cat-other)' },
              { key: 'collected', name: 'Cobrado', type: 'bar', color: 'var(--sw-chart-in)' },
            ]}
            format={(x) => money(x, base())}
            compact={compactNum}
          />
        </Widget>
        <Widget
          title="Por cobrar"
          description={data.rec.skipped ? `${data.rec.skipped} en otra moneda sin equivalencia` : `${data.rec.open.length} ${data.rec.open.length === 1 ? 'factura abierta' : 'facturas abiertas'}`}
        >
          {data.rec.open.length ? (
            <DonutChart title="Por cobrar según el atraso" parts={data.aging} format={(x) => money(x, base())} totalLabel="Por cobrar" size={150} layout="stack" max={4} />
          ) : (
            <Empty icon={CircleDollar} title="Nada por cobrar" text="Todo lo facturado está cobrado." />
          )}
        </Widget>
      </div>
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Cobros">
            <Tabs.Tab id="pendiente">
              Por cobrar <span className="ms-1 text-xs text-muted">{data.open.length}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="historial">
              Historial <span className="ms-1 text-xs text-muted">{data.history.length}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="pendiente" className="pt-4">
          {data.open.length === 0 ? (
            <Empty icon={CircleDollar} title="Nada por cobrar" text="Las facturas con saldo pendiente salen aquí, la más urgente primero." />
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Facturas por cobrar" className="min-w-[720px]" onRowAction={(id) => go(`#/documentos/${id}`)}>
                  <Table.Header>
                    <Table.Column isRowHeader>Factura</Table.Column>
                    <Table.Column>Cliente</Table.Column>
                    <Table.Column>Vence</Table.Column>
                    <Table.Column className="text-end">Falta</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column className="text-end">Cobrar</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.open.map((d) => {
                      const st = DOC_STATUS[docStatus(d)] || DOC_STATUS.pending;
                      const t = totals(d);
                      return (
                        <Table.Row key={d.id} id={d.id} className="cursor-pointer">
                          <Table.Cell className="font-medium">{d.number || 'Borrador'}</Table.Cell>
                          <Table.Cell>{customerName(d)}</Table.Cell>
                          <Table.Cell className={d.dueDate && d.dueDate < today ? 'text-danger' : 'text-muted'}>{shortDate(d.dueDate) || '—'}</Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{money(t.due, d.currency)}</Table.Cell>
                          <Table.Cell>
                            <StatusChip label={st[0]} color={st[1]} />
                          </Table.Cell>
                          <Table.Cell className="text-end">
                            <Button size="sm" variant="secondary" onPress={() => setPaying(d)}>
                              Registrar
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="historial" className="pt-4">
          {data.history.length === 0 ? (
            <Empty icon={Receipt} title="Todavía no hay cobros" text="Cada pago que registres en una factura sale aquí." />
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Historial de cobros" className="min-w-[760px]" onRowAction={(id) => go(`#/documentos/${String(id).split(':')[0]}`)}>
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Cliente</Table.Column>
                    <Table.Column>Factura</Table.Column>
                    <Table.Column>Forma</Table.Column>
                    <Table.Column className="text-end">Importe</Table.Column>
                    <Table.Column className="text-end">En {state.settings.currency}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.history.map(({ d, p, base: b }) => (
                      <Table.Row key={`${d.id}:${p.id}`} id={`${d.id}:${p.id}`} className="cursor-pointer">
                        <Table.Cell>{shortDate(p.date)}</Table.Cell>
                        <Table.Cell>{customerName(d)}</Table.Cell>
                        <Table.Cell className="text-muted">{d.number}</Table.Cell>
                        <Table.Cell>
                          {p.method || '—'}
                          {p.receiptId && (
                            <Chip size="sm" variant="tertiary" className="ms-2">
                              Recibo
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-end tabular-nums">{money(Number(p.amount) || 0, d.currency)}</Table.Cell>
                        <Table.Cell className="text-end tabular-nums text-muted">
                          {b == null ? 'Sin tasa' : fmt(b)}
                          {p.rate ? <span className="block text-xs">a {p.rate} ({p.rateSource})</span> : null}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
      {paying && <PaymentForm doc={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
