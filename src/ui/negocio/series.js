// Series por mes para los gráficos (Ventas, Cobros, Gastos, Leads): las claves de
// los últimos meses y sumas por mes en la moneda principal.
import { inBase, shortMonth, todayISO, totals } from '../../negocio-core.js';
import { collected, spent } from './domain.js';

/** Las claves «2026-11» de los últimos n meses, del más viejo al actual. */
export function monthKeys(n = 12, today = todayISO()) {
  const out = [];
  const d = new Date(`${today.slice(0, 7)}-15T12:00:00`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const m = new Date(d);
    m.setMonth(d.getMonth() - i);
    out.push(m.toLocaleDateString('en-CA').slice(0, 7));
  }
  return out;
}

export const monthRange = (key) => ({ from: `${key}-01`, to: `${key}-31` });
export const monthLabel = (key) => shortMonth(key);
const compact = new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 });
export const compactNum = (x) => compact.format(x);

/** Documentos emitidos (sin borradores ni anulados). */
export const issued = (d) => d.status !== 'draft' && d.status !== 'void' && Boolean(d.number);

/** Facturado (por fecha de emisión) y cobrado (por fecha de cada pago), mes a mes. */
export function billedAndCollected(docs, n = 12) {
  return monthKeys(n).map((key) => {
    let billed = 0;
    for (const d of docs) {
      if (d.type !== 'invoice' || !issued(d) || (d.issueDate || '').slice(0, 7) !== key) continue;
      const v = inBase(d, totals(d).total);
      if (v != null) billed += v;
    }
    return { key, label: monthLabel(key), billed: Math.round(billed * 100) / 100, collected: collected(monthRange(key)).sum };
  });
}

/** Gastado por mes. */
export const spentByMonth = (n = 12) => monthKeys(n).map((key) => ({ key, label: monthLabel(key), out: spent(monthRange(key)).sum }));

/** Lo que falta por cobrar, por antigüedad: al día, 1–30, 31–60 y más de 60 días vencido. */
export function aging(open, today = todayISO()) {
  const buckets = [
    { key: 'ok', label: 'Al día', value: 0, n: 0, color: 'var(--success)' },
    { key: '30', label: '1 a 30 días tarde', value: 0, n: 0, color: 'var(--warning)' },
    { key: '60', label: '31 a 60 días tarde', value: 0, n: 0, color: 'var(--sw-chart-out)' },
    { key: 'old', label: 'Más de 60 días tarde', value: 0, n: 0, color: 'var(--danger)' },
  ];
  for (const d of open) {
    const v = inBase(d, totals(d).due);
    if (v == null) continue;
    const late = d.dueDate && d.dueDate < today ? Math.round((Date.parse(today) - Date.parse(d.dueDate)) / 86400000) : 0;
    const b = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : buckets[3];
    b.value += v;
    b.n += 1;
  }
  return buckets;
}
