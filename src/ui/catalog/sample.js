// Datos de ejemplo del catálogo: los mismos tipos de cosas que llevan Negocio y el
// portal (clientes, facturas, leads, publicaciones), para ver cada componente con
// lo que va a enseñar de verdad. Nada de esto se guarda.

export const CLIENTS = [
  { id: 'cafe', name: 'Café Aroma', contact: 'María Pérez', email: 'maria@cafearoma.com', color: 'accent' },
  { id: 'patryk', name: 'PatrykBioHacker', contact: 'Patryk Nowak', email: 'patryk@biohacker.io', color: 'success' },
  { id: 'lion', name: 'Lion Fitness', contact: 'Luis Ortega', email: 'luis@lionfitness.com', color: 'warning' },
  { id: 'nexus', name: 'Nexus Talent', contact: 'Ariel Gómez', email: 'ariel@nexus.com', color: 'danger' },
  { id: 'cerofiao', name: 'CeroFiao', contact: 'Equipo CeroFiao', email: 'hola@cerofiao.app', color: 'default' },
];

export const INVOICES = [
  { id: 'FAC-2026-0041', client: 'Café Aroma', date: '2026-11-03', total: 1250, status: 'paid' },
  { id: 'FAC-2026-0042', client: 'PatrykBioHacker', date: '2026-11-10', total: 3400, status: 'partial' },
  { id: 'FAC-2026-0043', client: 'Lion Fitness', date: '2026-11-14', total: 780, status: 'open' },
  { id: 'FAC-2026-0044', client: 'Nexus Talent', date: '2026-10-28', total: 2100, status: 'overdue' },
  { id: 'FAC-2026-0045', client: 'CeroFiao', date: '2026-11-20', total: 640, status: 'draft' },
];

export const INVOICE_STATUS = {
  paid: { label: 'Cobrada', color: 'success' },
  partial: { label: 'Pago parcial', color: 'accent' },
  open: { label: 'Por cobrar', color: 'default' },
  overdue: { label: 'Vencida', color: 'danger' },
  draft: { label: 'Borrador', color: 'warning' },
};

export const LEAD_SOURCES = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'web', name: 'La web' },
  { id: 'referido', name: 'Recomendación' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'google', name: 'Google' },
];

export const CURRENCIES = [
  { id: 'USD', name: 'Dólar', symbol: '$' },
  { id: 'VES', name: 'Bolívar', symbol: 'Bs' },
  { id: 'USDT', name: 'Tether', symbol: '₮' },
  { id: 'EUR', name: 'Euro', symbol: '€' },
];

export const BRAND_COLORS = ['#00b8d4', '#387aff', '#5b4cff', '#7c4dff', '#e1306c', '#ff5a36', '#ff9800', '#f5b800', '#34c759', '#14b8a6', '#111111'];

export const fmtMoney = (v, code = 'USD') =>
  new Intl.NumberFormat('es', { style: 'currency', currency: code === 'USDT' ? 'USD' : code, maximumFractionDigits: 2 }).format(v);

export const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
