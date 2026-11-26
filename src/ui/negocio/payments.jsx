// Cobrar una factura y pasar una cotización o propuesta a factura, con las mismas
// reglas del editor de siempre (negocio-doc.js): cada pago fuera de la moneda
// principal guarda la tasa del día (rate, rateBase, rateSource), puede generar su
// recibo y saca la factura de borrador.
import { useState } from 'react';
import { Description, Input, Label, Switch, TextField, toast } from '@heroui/react';
import {
  METHODS,
  addDays,
  convert,
  find,
  methodLabel,
  money,
  put,
  round2,
  snapshotPayment,
  state,
  strongest,
  todayISO,
  totals,
  uid,
  unitName,
} from '../../negocio-core.js';
import { SOURCES as RATE_SOURCES } from '../../negocio-gastos.js';
import { newProject } from '../../negocio-work.js';
import { AmountField, DateInput, FormModal, SelectField } from './fields.jsx';
import { SwitchField } from '../kit/SwitchField.jsx';

function receiptFor(doc, payment, balanceAfter) {
  return {
    id: uid(),
    type: 'receipt',
    status: 'issued',
    number: '',
    issueDate: payment.date,
    currency: doc.currency,
    equiv: doc.equiv ? { ...doc.equiv, date: doc.equiv.date || doc.issueDate } : null,
    customerId: doc.customerId,
    customer: { ...doc.customer },
    from: { ...doc.from },
    items: [{ id: uid(), name: `Pago de la factura ${doc.number || ''}`.trim(), description: payment.note || '', qty: 1, price: payment.amount }],
    invoiceId: doc.id,
    invoiceNumber: doc.number,
    paymentId: payment.id,
    method: payment.method,
    balanceAfter,
    notes: 'Gracias por tu pago.',
    sections: [],
    payments: [],
    signature: doc.signature !== false,
    style: { ...doc.style },
  };
}

/** Ventana para registrar un pago de una factura. */
export function PaymentForm({ doc, onClose }) {
  const t = totals(doc);
  const cur = doc.currency;
  const home = state.settings.currency;
  const known = doc.equiv?.currency === home && doc.equiv.rate > 0 ? doc.equiv : null;
  const methods = [...state.paytemplates.map((tp) => [`tpl:${tp.id}`, tp.name || methodLabel(tp.method)]), ...Object.entries(METHODS).map(([k, m]) => [k, m.label])];
  const defaultMethod = doc.payment?.templateId && state.paytemplates.some((x) => x.id === doc.payment.templateId) ? `tpl:${doc.payment.templateId}` : methods[0][0];
  const [amount, setAmount] = useState(round2(t.due));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState(defaultMethod);
  const [rate, setRate] = useState(known ? known.rate : 0);
  const [source, setSource] = useState(RATE_SOURCES.includes(known?.source) ? known.source : 'BCV');
  const [receipt, setReceipt] = useState(true);
  const [confirmOver, setConfirmOver] = useState(false);
  const [error, setError] = useState('');
  const needsRate = cur !== home;
  const strong = strongest(cur, home);
  const inHome = needsRate ? convert(amount, cur, home, rate) : null;
  const over = amount > t.due + 0.005;

  return (
    <FormModal
      title={`Registrar pago · ${doc.number || 'Factura'}`}
      submit={over && !confirmOver ? 'Registrar igual' : `Registrar ${money(amount, cur)}`}
      onClose={onClose}
      onSubmit={(f) => {
        if (!(amount > 0)) return setError('Escribe un importe mayor que cero.') || false;
        if (needsRate && !(rate > 0)) return setError(`Falta la tasa para pasarlo a ${home}.`) || false;
        // Un cero de más (5.000 en vez de 500) no deja la factura «pagada» sin avisar.
        if (over && !confirmOver) {
          setConfirmOver(true);
          return setError(`El saldo es de ${money(t.due, cur)}: sobran ${money(round2(amount - t.due), cur)}. Pulsa otra vez para registrarlo así.`) || false;
        }
        const tplId = method.startsWith('tpl:') ? method.slice(4) : '';
        const tpl = tplId && find('paytemplates', tplId);
        const payment = { id: uid(), date: date || todayISO(), amount: round2(amount), method: tpl ? tpl.name || methodLabel(tpl.method) : methodLabel(method), note: String(f.note || '').trim(), receiptId: '' };
        if (needsRate) Object.assign(payment, { rate, rateBase: home, rateSource: source });
        if (receipt) {
          const r = receiptFor(doc, payment, round2(Math.max(0, t.due - amount)));
          payment.receiptId = r.id;
          put('docs', r);
        }
        doc.payments = [...(doc.payments || []), payment];
        if (doc.status === 'draft' || doc.status === 'void') doc.status = 'sent';
        put('docs', doc, { now: true })?.catch(() => {});
        toast.success(receipt ? 'Pago registrado y recibo creado' : 'Pago registrado');
        return true;
      }}
    >
      <AmountField label={`Importe (${cur})`} value={amount} onChange={(n) => { setAmount(n); setConfirmOver(false); setError(''); }} description={`Saldo: ${money(t.due, cur)}`} />
      <DateInput label="Fecha" value={date} onChange={setDate} />
      {needsRate && (
        <>
          <AmountField
            label={`Tasa del día: 1 ${unitName(strong)} = … ${unitName(strong === cur ? home : cur)}`}
            value={rate}
            onChange={(n) => { setRate(n); setError(''); }}
            description={inHome == null ? `Con ella el pago pasa a ${home} en los informes.` : `Son ${money(round2(inHome), home)} en tu moneda principal.`}
          />
          <SelectField label="Fuente de la tasa" value={source} onChange={setSource} options={RATE_SOURCES.map((s) => [s, s])} />
        </>
      )}
      <SelectField label="Forma de pago" value={method} onChange={setMethod} options={methods} />
      <TextField name="note" maxLength={120}>
        <Label>Referencia</Label>
        <Input placeholder="Opcional" />
      </TextField>
      <SwitchField
        isSelected={receipt}
        onChange={setReceipt}
        className="sm:col-span-2"
        label="Generar recibo"
        description={doc.status === 'draft' ? 'Al registrar un pago, la factura deja de ser borrador.' : 'Queda en Facturas, enlazado a este pago.'}
      />
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </FormModal>
  );
}

/** Cotización o propuesta aceptada → factura con las mismas líneas (y, si se pide, un proyecto). */
export function toInvoice(doc, { project = false } = {}) {
  const today = todayISO();
  const inv = structuredClone(doc);
  if (inv.equiv) inv.equiv.date = doc.equiv.date || doc.issueDate;
  Object.assign(inv, {
    id: uid(),
    type: 'invoice',
    status: 'draft',
    number: '',
    issueDate: today,
    dueDate: addDays(today, Number(state.settings.dueDays) || 15),
    validUntil: '',
    payments: [],
    fromQuoteId: doc.id,
    fromQuote: doc.number,
    share: null,
  });
  delete inv.createdAt;
  delete inv.updatedAt;
  delete inv.blocks;
  delete inv.title;
  inv.style = { ...inv.style, cover: state.settings.style?.cover || 'none' };
  inv.items = (inv.items || []).map((i) => ({ ...i, id: uid() }));
  if (!inv.payment) inv.payment = snapshotPayment(state.paytemplates.find((x) => x.isDefault));
  if (project) {
    const customer = doc.customerId ? find('customers', doc.customerId) : null;
    const p = {
      ...newProject(customer),
      name: doc.title || `${doc.customer?.company || doc.customer?.name || 'Cliente'} · ${doc.number}`,
      budget: totals(doc).total,
      currency: doc.currency,
      description: (doc.blocks || []).find((b) => b.kind === 'intro')?.body || '',
    };
    put('projects', p);
    inv.projectId = p.id;
    doc.projectId = p.id;
  }
  doc.status = 'accepted';
  doc.invoiceId = inv.id;
  put('docs', doc);
  put('docs', inv, { now: true })?.catch(() => {});
  toast.success(project ? 'Listo: ya tienes la factura y el proyecto' : 'Aceptada. Ya tienes la factura.');
  return inv;
}

/** Anular o volver a borrador una factura, cotización o propuesta (los recibos no). */
export function setDocStatus(doc, status) {
  doc.status = status;
  put('docs', doc);
}
