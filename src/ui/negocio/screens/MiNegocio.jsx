// Negocio › Mi negocio: quién eres y cómo te ven tus clientes. Arriba, la ficha de
// tu negocio (portada con tus colores, tu logo, lo que llevas hecho y cuánto le
// falta al perfil); debajo, tres pestañas: Perfil, Identidad de marca y
// Facturación. Cada cambio se guarda solo; los documentos ya emitidos guardan su
// propia copia de estos datos.
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRightFromSquare,
  At,
  Briefcase,
  CircleCheck,
  Copy,
  EllipsisVertical,
  Envelope,
  FileText,
  Folder,
  Font,
  Globe,
  Handset,
  LogoFacebook,
  LogoGithub,
  LogoLinkedin,
  LogoTelegram,
  Megaphone,
  Palette,
  Pencil,
  Persons,
  Picture,
  Plus,
  Receipt,
  Sparkles,
  TrashBin,
  Box,
} from '@gravity-ui/icons';
import {
  Button,
  Card,
  Chip,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Description,
  Dropdown,
  Input,
  Label,
  ListBox,
  ProgressCircle,
  Select,
  Tabs,
  TextArea,
  TextField,
  Tooltip,
  toast,
} from '@heroui/react';
import { put, state as crm, todayISO, uid } from '../../../negocio-core.js';
import { deleteFile, fileUrl, uploadFile } from '../../../negocio-gastos.js';
import { accentColor } from '../../../negocio-sheet.js';
import { COLORS, FONTS, loadFont } from '../../../portal/brand.js';
import { copyText } from '../../kit/csv.js';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { NumberStepper } from '../../pro/index.js';
import { CurrencyCoin, CurrencyPicker } from '../currency.jsx';
import { ConfirmDialog } from '../fields.jsx';
import { go, useCrm } from '../store.js';

/* ── Guardar ────────────────────────────────────────────────────────────── */

const setSetting = (key, value) => put('settings', { ...crm.settings, [key]: value });
const brandOf = (s = crm.settings) => s.brand || {};
const setBrand = (patch) => put('settings', { ...crm.settings, brand: { ...brandOf(), ...patch } });

export async function readLogo(file) {
  if (file.type === 'image/svg+xml' && file.size < 120_000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // Las fotos se reducen: el logo viaja dentro de los datos del negocio.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 360 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  return png.length < 250_000 ? png : canvas.toDataURL('image/webp', 0.86);
}

/** Un SVG se pasa a PNG antes de subirlo (el almacén solo guarda imágenes y PDF). */
async function uploadable(file) {
  if (file.type !== 'image/svg+xml') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const w = img.naturalWidth || 1200;
    const h = img.naturalHeight || 1200;
    const scale = 1200 / Math.max(w, h);
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w * scale), height: Math.round(h * scale) });
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return new File([blob], file.name.replace(/\.svg$/i, '.png'), { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Abre el selector de archivos del sistema. */
function pickFiles({ accept, multiple = false }) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept, multiple });
    input.onchange = () => resolve([...(input.files || [])]);
    input.click();
  });
}

const sizeText = (n) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const dateShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/* ── Colores ────────────────────────────────────────────────────────────── */

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
/** Texto que se lee encima de un color: negro sobre claros, blanco sobre oscuros. */
function inkOn(hex) {
  if (!isHex(hex)) return '#fff';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  // Se elige el que más contraste da (WCAG): blanco o la tinta de la hoja.
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.0594 >= 1.05 / (L + 0.05) ? '#16181b' : '#fff';
}
const COLOR_ROLES = ['Principal', 'Secundario', 'Acento', 'Fondo', 'Texto', 'Apoyo'];

/** Los colores que pintan la ficha: los de tu marca o, si no hay, el de tus documentos. */
function brandHues(s) {
  const colors = (brandOf(s).colors || []).map((c) => c.hex).filter(isHex);
  const doc = accentColor(s.style?.accent);
  const main = colors[0] || (doc === '#16181b' ? '#00b8d4' : doc);
  return [main, colors[1] || '#387aff', colors[2] || '#f5b800'];
}

const fontFamily = (key) => (FONTS[key] ? `'${FONTS[key][0]}', var(--font-sans, system-ui), sans-serif` : undefined);

/* ── Campos ─────────────────────────────────────────────────────────────── */

function Text({ k, label, description, type, placeholder, area, max = 160, className = '', inputMode }) {
  return (
    <div data-field={k} className={`min-w-0 ${className}`}>
      <TextField type={type} defaultValue={crm.settings[k] ?? ''} onChange={(v) => setSetting(k, v)} maxLength={max} inputMode={inputMode}>
        <Label>{label}</Label>
        {area ? <TextArea rows={area} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
        {description && <Description>{description}</Description>}
      </TextField>
    </div>
  );
}

/** Lleva a un campo (cambiando de pestaña si hace falta) y lo deja listo para escribir. */
function focusField(key) {
  setTimeout(() => {
    const box = document.querySelector(`[data-field="${key}"]`);
    if (!box) return;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.querySelector('input, textarea, button')?.focus({ preventScroll: true });
  }, 120);
}

/* ── Lo que le falta al perfil ─────────────────────────────────────────── */

const CHECKS = [
  { key: 'logo', label: 'logo', cta: 'Sube tu logo', tab: 'perfil', ok: (s) => Boolean(s.logo) },
  { key: 'name', label: 'nombre', cta: 'Escribe tu nombre', tab: 'perfil', ok: (s) => Boolean(s.name?.trim()) },
  { key: 'tagline', label: 'frase', cta: 'Añade tu frase', tab: 'perfil', ok: (s) => Boolean(s.tagline?.trim()) },
  { key: 'taxId', label: 'RIF o NIF', cta: 'Añade tu RIF o NIF', tab: 'perfil', ok: (s) => Boolean(s.taxId?.trim()) },
  { key: 'email', label: 'correo', cta: 'Añade tu correo', tab: 'perfil', ok: (s) => Boolean(s.email?.trim()) },
  { key: 'phone', label: 'teléfono', cta: 'Añade tu teléfono', tab: 'perfil', ok: (s) => Boolean(s.phone?.trim()) },
  { key: 'address', label: 'dirección', cta: 'Añade tu dirección', tab: 'perfil', ok: (s) => Boolean(s.address?.trim()) },
  { key: 'colors', label: 'colores', cta: 'Elige tus colores', tab: 'marca', ok: (s) => (brandOf(s).colors || []).length > 0 },
  { key: 'fonts', label: 'tipografía', cta: 'Elige tu letra', tab: 'marca', ok: (s) => Boolean(brandOf(s).headingFont) },
  { key: 'pay', label: 'forma de cobro', cta: 'Añade cómo te pagan', href: '#/formas-de-cobro', ok: () => crm.paytemplates.length > 0 },
];

/* ── La ficha ───────────────────────────────────────────────────────────── */

function LogoTile({ s, hue }) {
  return (
    <button
      type="button"
      data-field="logo"
      onClick={async () => {
        const [f] = await pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });
        if (!f) return;
        try {
          setSetting('logo', await readLogo(f));
          toast.success('Logo actualizado');
        } catch {
          toast.danger('No se pudo leer esa imagen.');
        }
      }}
      className="group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] outline-none ring-4 ring-[var(--surface)] transition-transform focus-visible:ring-focus active:scale-95 sm:size-28"
      aria-label={s.logo ? 'Cambiar el logo' : 'Subir el logo'}
    >
      {s.logo ? (
        <img src={s.logo} alt="" className="size-full object-contain p-3" />
      ) : (
        <span className="flex size-full items-center justify-center text-3xl font-bold" style={{ background: hue, color: inkOn(hue) }}>
          {(s.name || '?').trim().slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Pencil className="size-4" />
        {s.logo ? 'Cambiar' : 'Subir'}
      </span>
    </button>
  );
}

function IdentityCard({ tab, onTab }) {
  const [state] = useCrm();
  const s = state.settings;
  const [h1, h2, h3] = brandHues(s);
  const checks = CHECKS.map((c) => ({ ...c, done: c.ok(s) }));
  const missing = checks.filter((c) => !c.done);
  const pct = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const next = missing[0];
  const issued = state.docs.filter((d) => d.number && d.type !== 'receipt').length;
  const colors = (brandOf(s).colors || []).filter((c) => isHex(c.hex));
  const site = String(s.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const goTo = (c) => {
    if (c.href) return go(c.href);
    if (c.tab !== tab) onTab(c.tab);
    return focusField(c.key);
  };
  const stats = [
    { label: 'Clientes', value: state.customers.length, icon: Persons, href: '#/clientes' },
    { label: 'Documentos emitidos', value: issued, icon: Receipt, href: '#/facturas' },
    { label: 'Proyectos', value: state.projects.length, icon: Folder, href: '#/proyectos' },
    { label: 'Servicios', value: state.catalog.length, icon: Box, href: '#/catalogo' },
  ];

  return (
    <Card className="overflow-hidden p-0">
      {/* La portada: tus colores, en suave */}
      <div aria-hidden className="relative h-24 overflow-hidden sm:h-32">
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${h1} 0%, ${h2} 55%, ${h3} 100%)`, opacity: 0.85 }} />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,rgb(255_255_255/0.45),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--surface)] to-transparent" />
      </div>
      <div className="relative -mt-14 flex flex-col gap-5 px-5 pb-2 sm:-mt-16 sm:px-7 lg:flex-row lg:items-end">
        <LogoTile s={s} hue={h1} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:pb-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            {[s.industry || 'Tu negocio', s.founded && `desde ${s.founded}`].filter(Boolean).join(' · ')}
          </span>
          <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl" style={{ fontFamily: fontFamily(brandOf(s).headingFont) }}>
            {s.name || 'Tu negocio'}
          </h2>
          {s.tagline ? (
            <p className="max-w-2xl text-sm text-muted sm:text-base">{s.tagline}</p>
          ) : (
            <button type="button" onClick={() => goTo(CHECKS[2])} className="w-fit text-start text-sm text-muted underline decoration-dashed underline-offset-4 hover:text-foreground">
              Añade una frase que diga qué haces
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {site && (
              <Chip size="sm" variant="secondary">
                <Globe className="size-3" />
                <Chip.Label>{site}</Chip.Label>
              </Chip>
            )}
            {s.email && (
              <Chip size="sm" variant="secondary">
                <Envelope className="size-3" />
                <Chip.Label>{s.email}</Chip.Label>
              </Chip>
            )}
            {s.phone && (
              <Chip size="sm" variant="secondary">
                <Handset className="size-3" />
                <Chip.Label>{s.phone}</Chip.Label>
              </Chip>
            )}
            <Chip size="sm" variant="secondary">
              <CurrencyCoin code={s.currency} size="xs" />
              <Chip.Label>Cobras en {s.currency}</Chip.Label>
            </Chip>
            {colors.length > 0 && (
              <span className="ms-1 flex -space-x-1.5" aria-label="Tus colores">
                {colors.slice(0, 6).map((c) => (
                  <span key={c.id} title={`${c.name} · ${c.hex}`} className="size-5 rounded-full ring-2 ring-[var(--surface)]" style={{ background: c.hex }} />
                ))}
              </span>
            )}
          </div>
        </div>
        {/* Cuánto le falta al perfil */}
        <div className="flex items-center gap-4 rounded-3xl bg-surface-secondary p-3 pe-4 lg:mb-1 lg:w-80">
          <div className="relative grid shrink-0 place-items-center">
            <ProgressCircle aria-label="Perfil completo" value={pct} color={pct === 100 ? 'success' : 'accent'} className="size-16">
              <ProgressCircle.Track strokeWidth={4} viewBox="0 0 36 36" className="size-16">
                <ProgressCircle.TrackCircle cx={18} cy={18} r={15.5} strokeWidth={4} />
                <ProgressCircle.FillCircle cx={18} cy={18} r={15.5} strokeWidth={4} strokeLinecap="round" />
              </ProgressCircle.Track>
            </ProgressCircle>
            <span className="absolute text-sm font-semibold tabular-nums">{pct === 100 ? <CircleCheck className="size-5 text-success" /> : `${pct}%`}</span>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-sm font-medium">{pct === 100 ? 'Tu perfil está completo' : 'Completa tu perfil'}</span>
            <span className="line-clamp-2 text-xs text-muted">
              {missing.length ? `Falta: ${missing.slice(0, 3).map((c) => c.label).join(', ')}${missing.length > 3 ? ` y ${missing.length - 3} más` : ''}.` : 'Tus documentos salen con todo lo tuyo.'}
            </span>
            {next && (
              <Button size="sm" variant="tertiary" className="mt-0.5" onPress={() => goTo(next)}>
                <Plus />
                {next.cta}
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Lo que llevas hecho con este nombre */}
      <div className="grid grid-cols-2 gap-px px-3 pt-3 sm:grid-cols-4 sm:px-5">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <a key={label} href={href} className="group flex items-center gap-3 rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus sm:px-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-muted transition-colors group-hover:bg-surface group-hover:text-foreground">
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-lg font-semibold leading-tight tabular-nums">{value}</span>
              <span className="truncate text-xs text-muted">{label}</span>
            </span>
          </a>
        ))}
      </div>
      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => onTab(String(k))} className="px-3 sm:px-5">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Partes de tu negocio">
            {[
              ['perfil', 'Perfil', Briefcase],
              ['marca', 'Identidad de marca', Palette],
              ['facturacion', 'Facturación', Receipt],
            ].map(([id, text, Icon]) => (
              <Tabs.Tab key={id} id={id} className="gap-1.5">
                <Icon className="size-4" />
                {text}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </Card>
  );
}

/* ── Así te ven ─────────────────────────────────────────────────────────── */

const PREFIX = { invoice: 'FAC', quote: 'COT', proposal: 'PRO', receipt: 'REC' };
/** El número que llevará el próximo documento de cada tipo (el servidor lo confirma). */
function nextNumber(type) {
  const series = `${PREFIX[type]}-${todayISO().slice(0, 4)}-`;
  let top = 0;
  for (const d of crm.docs) if (typeof d.number === 'string' && d.number.startsWith(series)) top = Math.max(top, Number(d.number.slice(series.length)) || 0);
  return series + String(top + 1).padStart(4, '0');
}

function Preview({ s }) {
  const accent = accentColor(s.style?.accent);
  const b = brandOf(s);
  const lines = (...v) => v.filter(Boolean).flatMap((x) => String(x).split('\n'));
  return (
    <Card>
      <Card.Header>
        <Card.Title>Así te ven tus clientes</Card.Title>
        <Card.Description>El encabezado de tu próxima factura, con tus datos de hoy.</Card.Description>
      </Card.Header>
      <Card.Content>
        <div
          className="flex flex-col gap-4 rounded-2xl bg-white p-5 text-[12px] leading-relaxed text-[#3a3f46] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-24px_rgb(0_0_0/0.45)] ring-1 ring-black/5"
          style={{ fontFamily: fontFamily(b.bodyFont) }}
          aria-label="Vista previa del encabezado de una factura"
        >
          <div className="h-1 rounded-full" style={{ background: accent }} />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {s.logo && <img src={s.logo} alt="" className="max-h-10 max-w-24 object-contain" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#16181b]" style={{ fontFamily: fontFamily(b.headingFont) }}>
                  {s.name || 'Tu negocio'}
                </p>
                {s.taxId && <p className="text-[11px] text-[#7a8088]">{s.taxId}</p>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#7a8088]">Factura</p>
              <p className="font-semibold tabular-nums" style={{ color: accent }}>
                {nextNumber('invoice')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7a8088]">De</p>
              {lines(s.address, s.email, s.phone, s.website).map((t, i) => (
                <p key={i} className="truncate">
                  {t}
                </p>
              ))}
              {!lines(s.address, s.email, s.phone, s.website).length && <p className="text-[#a3a8ae]">Tus datos de contacto</p>}
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7a8088]">Para</p>
              <p>Tu cliente</p>
              <p className="text-[#a3a8ae]">Su dirección y su correo</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 pt-3">
            <span>Vence en {Number(s.dueDays) || 0} días</span>
            <span className="flex items-center gap-1.5 font-semibold text-[#16181b]">
              <CurrencyCoin code={s.currency} size="xs" />
              Total en {s.currency}
            </span>
          </div>
          {(s.notes || s.signature || s.name) && (
            <div className="flex items-end justify-between gap-3 text-[11px]">
              <span className="line-clamp-2 text-[#7a8088]">{s.notes}</span>
              <span className="shrink-0 border-t border-[#16181b]/40 pt-1 italic text-[#16181b]">{s.signature || s.name}</span>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

/* ── Perfil ─────────────────────────────────────────────────────────────── */

const SOCIALS = [
  ['instagram', 'Instagram', At, '@tuestudio'],
  ['linkedin', 'LinkedIn', LogoLinkedin, 'linkedin.com/in/…'],
  ['whatsapp', 'WhatsApp', Handset, '+58 412…'],
  ['github', 'GitHub', LogoGithub, 'github.com/…'],
  ['facebook', 'Facebook', LogoFacebook, 'facebook.com/…'],
  ['telegram', 'Telegram', LogoTelegram, '@usuario'],
];

function Perfil() {
  const [state] = useCrm();
  const s = state.settings;
  const social = s.social || {};
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <Card.Header>
            <Card.Title>Quién eres</Card.Title>
            <Card.Description>Sale en el encabezado de cada factura, cotización y propuesta.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 sm:grid-cols-2">
            <Text k="name" label="Nombre o razón social" max={120} />
            <Text k="taxId" label="RIF, cédula o NIF" max={60} />
            <Text k="tagline" label="Tu frase" max={140} placeholder="Diseño y desarrollo web para marcas que quieren crecer" className="sm:col-span-2" description="Una línea que diga qué haces. Sale en tu ficha y en tus propuestas." />
            <Text k="industry" label="A qué te dedicas" max={60} placeholder="Estudio de diseño y desarrollo" />
            <Text k="founded" label="Desde" max={4} inputMode="numeric" placeholder={todayISO().slice(0, 4)} description="El año en que empezaste." />
            <Text k="signature" label="Firma" max={80} placeholder={s.name} description="El nombre que sale firmado al pie (y en el saludo del inicio)." className="sm:col-span-2" />
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Contacto</Card.Title>
            <Card.Description>Cómo te encuentran tus clientes.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 sm:grid-cols-2">
            <Text k="email" label="Correo" type="email" />
            <Text k="phone" label="Teléfono" type="tel" max={60} />
            <Text k="website" label="Web" className="sm:col-span-2" />
            <Text k="address" label="Dirección" area={2} max={400} className="sm:col-span-2" />
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Redes</Card.Title>
            <Card.Description>Donde te siguen. Vacías, no salen en ningún sitio.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 sm:grid-cols-2">
            {SOCIALS.map(([key, name, Icon, hint]) => (
              <TextField key={key} defaultValue={social[key] || ''} maxLength={200} onChange={(v) => setSetting('social', { ...(crm.settings.social || {}), [key]: v.trim() })}>
                <Label className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted" />
                  {name}
                </Label>
                <Input placeholder={hint} />
              </TextField>
            ))}
          </Card.Content>
        </Card>
      </div>
      <div className="flex flex-col gap-4 xl:sticky xl:top-24">
        <Preview s={s} />
      </div>
    </div>
  );
}

/* ── Identidad de marca ─────────────────────────────────────────────────── */

function ColorRow({ c, i, onChange, onRemove, isDocAccent }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-2 pe-1.5">
      <ColorPicker value={c.hex} onChange={(col) => onChange({ hex: col.toString('hex') })}>
        <ColorPicker.Trigger aria-label={`Cambiar el color ${c.name || i + 1}`} className="rounded-xl">
          <ColorSwatch size="lg" className="rounded-xl" />
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="w-64 gap-3">
          <ColorArea aria-label="Tono y brillo" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider aria-label="Tono" channel="hue" colorSpace="hsb" className="px-1">
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorField aria-label="Código del color">
            <ColorField.Group variant="secondary">
              <ColorField.Prefix>
                <ColorSwatch size="xs" />
              </ColorField.Prefix>
              <ColorField.Input />
            </ColorField.Group>
          </ColorField>
          <ColorSwatchPicker size="xs" className="justify-center">
            {COLORS.map((p) => (
              <ColorSwatchPicker.Item key={p} color={p}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        </ColorPicker.Popover>
      </ColorPicker>
      <div className="flex min-w-0 flex-1 flex-col">
        <TextField aria-label="Nombre del color" defaultValue={c.name} maxLength={40} onChange={(v) => onChange({ name: v })}>
          <Input variant="secondary" className="h-8 border-0 bg-transparent px-1 font-medium shadow-none focus:bg-surface" placeholder={COLOR_ROLES[i] || 'Color'} />
        </TextField>
        <span className="px-1 font-mono text-xs uppercase text-muted">{c.hex}</span>
      </div>
      {isDocAccent && (
        <Chip size="sm" variant="soft" color="accent" className="hidden sm:inline-flex">
          En documentos
        </Chip>
      )}
      <Dropdown>
        <Button isIconOnly size="sm" variant="ghost" aria-label={`Más opciones de ${c.name || 'este color'}`}>
          <EllipsisVertical />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-56">
          <Dropdown.Menu
            aria-label="Opciones del color"
            onAction={(k) => {
              if (k === 'doc') {
                setSetting('style', { ...(crm.settings.style || {}), accent: c.hex });
                toast.success('Tus documentos nuevos salen con este color');
              } else if (k === 'copy') copyText(c.hex);
              else if (k === 'remove') onRemove();
            }}
          >
            <Dropdown.Item id="doc" textValue="Usar en mis documentos">
              <Receipt className="size-4 shrink-0 text-muted" />
              <Label>Usar en mis documentos</Label>
            </Dropdown.Item>
            <Dropdown.Item id="copy" textValue="Copiar el código">
              <Copy className="size-4 shrink-0 text-muted" />
              <Label>Copiar {c.hex}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="remove" textValue="Quitar" variant="danger">
              <TrashBin className="size-4 shrink-0" />
              <Label>Quitar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </li>
  );
}

function Colores() {
  const [state] = useCrm();
  const colors = brandOf(state.settings).colors || [];
  const docAccent = state.settings.style?.accent;
  const update = (id, patch) => setBrand({ colors: (brandOf().colors || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const add = () => {
    const used = new Set(colors.map((c) => c.hex.toLowerCase()));
    const hex = COLORS.find((p) => !used.has(p.toLowerCase())) || '#00b8d4';
    setBrand({ colors: [...colors, { id: uid(), name: COLOR_ROLES[colors.length] || 'Color', hex }] });
  };
  return (
    <Card className="h-full">
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Card.Title>Colores</Card.Title>
          <Card.Description>Tu paleta. Cualquiera puede ser el color de tus documentos.</Card.Description>
        </div>
        <Button size="sm" variant="secondary" onPress={add} isDisabled={colors.length >= 8}>
          <Plus />
          Añadir
        </Button>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {colors.length ? (
          <>
            <div className="flex h-20 overflow-hidden rounded-2xl ring-1 ring-border" aria-hidden>
              {colors.map((c) => (
                <div key={c.id} className="flex min-w-0 flex-1 flex-col justify-end gap-0.5 p-2.5 transition-[flex] hover:flex-[1.6]" style={{ background: c.hex, color: inkOn(c.hex) }}>
                  <span className="truncate text-xs font-semibold">{c.name}</span>
                  <span className="truncate font-mono text-[10px] uppercase opacity-80">{c.hex}</span>
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-2" data-field="colors">
              {colors.map((c, i) => (
                <ColorRow
                  key={c.id}
                  c={c}
                  i={i}
                  isDocAccent={docAccent === c.hex}
                  onChange={(patch) => update(c.id, patch)}
                  onRemove={() => setBrand({ colors: (brandOf().colors || []).filter((x) => x.id !== c.id) })}
                />
              ))}
            </ul>
          </>
        ) : (
          <button
            type="button"
            data-field="colors"
            onClick={add}
            className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-8 text-center outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="flex -space-x-2">
              {COLORS.slice(0, 5).map((p) => (
                <span key={p} className="size-8 rounded-full ring-2 ring-[var(--surface)]" style={{ background: p }} />
              ))}
            </span>
            <span className="font-medium">Elige los colores de tu marca</span>
            <span className="max-w-xs text-sm text-muted">Pintan tu ficha, y puedes usarlos en tus facturas y propuestas.</span>
          </button>
        )}
      </Card.Content>
    </Card>
  );
}

function FontSelect({ label, value, onChange }) {
  return (
    <Select selectedKey={value} onSelectionChange={(k) => onChange(String(k))} aria-label={label}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value>{() => <span style={{ fontFamily: fontFamily(value) }}>{FONTS[value]?.[0] || 'Elegir…'}</span>}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {Object.entries(FONTS).map(([key, [family]]) => (
            <ListBox.Item key={key} id={key} textValue={family}>
              <span style={{ fontFamily: fontFamily(key) }} className="text-base">
                {family}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function Tipografia() {
  const [state] = useCrm();
  const s = state.settings;
  const b = brandOf(s);
  useEffect(() => {
    for (const key of Object.keys(FONTS)) loadFont(key);
  }, []);
  const heading = b.headingFont || 'inter';
  const body = b.bodyFont || 'inter';
  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title>Tipografía</Card.Title>
        <Card.Description>La letra de tus títulos y la de tus textos.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div data-field="fonts" className="grid gap-3 sm:grid-cols-2">
          <FontSelect label="Títulos" value={heading} onChange={(k) => setBrand({ headingFont: k })} />
          <FontSelect label="Textos" value={body} onChange={(k) => setBrand({ bodyFont: k })} />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-2xl bg-surface-secondary p-5">
          <div className="flex items-baseline gap-4">
            <span className="text-5xl font-bold leading-none" style={{ fontFamily: fontFamily(heading) }}>
              Aa
            </span>
            <span className="truncate text-xs text-muted">
              {FONTS[heading]?.[0]} · {FONTS[body]?.[0]}
            </span>
          </div>
          <p className="text-xl font-semibold leading-snug" style={{ fontFamily: fontFamily(heading) }}>
            {s.name || 'Tu negocio'}
          </p>
          <p className="text-sm text-muted" style={{ fontFamily: fontFamily(body) }}>
            {s.tagline || 'Así se lee un párrafo escrito con tu letra de textos: claro, cercano y con tu estilo.'}
          </p>
        </div>
      </Card.Content>
    </Card>
  );
}

const LOGO_SLOTS = [
  ['main', 'Principal', 'Sale en tus documentos.'],
  ['light', 'Para fondos oscuros', 'La versión clara.'],
  ['icon', 'Icono', 'El símbolo solo.'],
  ['mono', 'Un solo color', 'Para sellos y grabados.'],
];

function Logos() {
  const [state] = useCrm();
  const s = state.settings;
  const logos = brandOf(s).logos || {};
  const [busy, setBusy] = useState('');
  const upload = async (slot) => {
    const [f] = await pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });
    if (!f) return;
    setBusy(slot);
    try {
      if (slot === 'main') setSetting('logo', await readLogo(f));
      else {
        const up = await uploadFile(await uploadable(f), { noun: 'El logo' });
        const old = logos[slot];
        setBrand({ logos: { ...(brandOf().logos || {}), [slot]: { fileId: up.id, type: up.type, name: f.name, size: up.size } } });
        if (old?.fileId) deleteFile(old.fileId);
      }
      toast.success('Logo guardado');
    } catch (err) {
      toast.danger(err.message || 'No se pudo leer esa imagen.');
    } finally {
      setBusy('');
    }
  };
  const clear = (slot) => {
    if (slot === 'main') return setSetting('logo', '');
    const old = logos[slot];
    const next = { ...(brandOf().logos || {}) };
    delete next[slot];
    setBrand({ logos: next });
    if (old?.fileId) deleteFile(old.fileId);
    return undefined;
  };
  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title>Logos</Card.Title>
        <Card.Description>Todas las versiones de tu logo, a mano para descargarlas.</Card.Description>
      </Card.Header>
      <Card.Content className="@container">
        <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
          {LOGO_SLOTS.map(([slot, name, hint]) => {
            const src = slot === 'main' ? s.logo : logos[slot] ? fileUrl(logos[slot].fileId) : '';
            const dark = slot === 'light';
            return (
              <li key={slot} className="group/logo relative flex min-w-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => upload(slot)}
                  disabled={busy === slot}
                  aria-label={`${src ? 'Cambiar' : 'Subir'} logo: ${name}`}
                  className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.98] ${src ? (dark ? 'bg-[#16181b]' : 'bg-white ring-1 ring-black/5') : `border border-dashed border-border ${dark ? 'bg-[#16181b]' : 'bg-surface-secondary'}`}`}
                >
                  {src ? (
                    <img src={src} alt="" className="size-full object-contain p-3" />
                  ) : (
                    <span className={`flex flex-col items-center gap-1 text-xs ${dark ? 'text-white/70' : 'text-muted'}`}>
                      <Picture className="size-5" />
                      {busy === slot ? 'Subiendo…' : 'Subir'}
                    </span>
                  )}
                  {src && (
                    <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="size-3.5" />
                      Cambiar
                    </span>
                  )}
                </button>
                {/* Descargar y quitar, sobre la esquina del logo (siempre a mano en pantallas táctiles). */}
                {src && (
                  <div className="absolute end-1.5 top-1.5 flex rounded-full bg-surface/90 shadow-sm backdrop-blur transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/logo:opacity-100 [@media(hover:hover)]:group-hover/logo:opacity-100">
                    <Tooltip delay={400}>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Descargar ${name}`} onPress={() => Object.assign(document.createElement('a'), { href: src, download: `logo-${slot}` }).click()}>
                        <ArrowDownToLine />
                      </Button>
                      <Tooltip.Content>Descargar</Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={400}>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${name}`} onPress={() => clear(slot)}>
                        <TrashBin />
                      </Button>
                      <Tooltip.Content>Quitar</Tooltip.Content>
                    </Tooltip>
                  </div>
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="truncate text-xs text-muted">{hint}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card.Content>
    </Card>
  );
}

function Documentos() {
  const [state] = useCrm();
  const files = brandOf(state.settings).files || [];
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [removing, setRemoving] = useState(null);
  const add = async (list) => {
    const ok = list.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (ok.length < list.length) toast.warning('Solo se guardan PDF e imágenes (de hasta 3 MB).');
    if (!ok.length) return;
    setBusy(ok.length);
    const added = [];
    for (const f of ok) {
      try {
        const up = await uploadFile(await uploadable(f), { noun: 'El archivo' });
        added.push({ id: uid(), fileId: up.id, name: f.name.slice(0, 120), type: up.type, size: up.size, addedAt: new Date().toISOString() });
      } catch (err) {
        toast.danger(`${f.name}: ${err.message}`);
      }
      setBusy((n) => n - 1);
    }
    if (added.length) {
      setBrand({ files: [...(brandOf().files || []), ...added] });
      toast.success(added.length === 1 ? 'Documento guardado' : `${added.length} documentos guardados`);
    }
  };
  return (
    <Card className="h-full">
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Card.Title>Documentos de marca</Card.Title>
          <Card.Description>Tu manual de marca, plantillas, presentaciones… En PDF o imagen.</Card.Description>
        </div>
        <Button size="sm" variant="secondary" isPending={busy > 0} onPress={async () => add(await pickFiles({ accept: 'application/pdf,image/png,image/jpeg,image/webp,image/svg+xml', multiple: true }))}>
          <Plus />
          Subir
        </Button>
      </Card.Header>
      <Card.Content
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add([...(e.dataTransfer?.files || [])]);
        }}
        className={`rounded-3xl transition-colors ${drag ? 'bg-accent-soft' : ''}`}
      >
        {files.length ? (
          <ul className="flex flex-col gap-1.5">
            {files.map((f) => {
              const pdf = f.type === 'application/pdf';
              return (
                <li key={f.id} className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-secondary">
                  <span className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${pdf ? 'bg-danger-soft text-danger' : 'bg-surface-secondary'}`}>
                    {pdf ? <FileText className="size-5" /> : <img src={fileUrl(f.fileId)} alt="" className="size-full object-cover" />}
                  </span>
                  <a href={fileUrl(f.fileId)} target="_blank" rel="noopener" className="flex min-w-0 flex-1 flex-col outline-none focus-visible:underline">
                    <span className="truncate text-sm font-medium">{f.name}</span>
                    <span className="text-xs text-muted">
                      {pdf ? 'PDF' : 'Imagen'} · {sizeText(f.size || 0)} · {dateShort.format(new Date(f.addedAt))}
                    </span>
                  </a>
                  <div className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Abrir ${f.name}`} onPress={() => open(fileUrl(f.fileId), '_blank', 'noopener')}>
                      <ArrowUpRightFromSquare />
                    </Button>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar ${f.name}`} onPress={() => setRemoving(f)}>
                      <TrashBin />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-6 py-8 text-center">
            <FileText className="size-7 text-muted" />
            <p className="font-medium">{busy ? 'Subiendo…' : 'Arrastra aquí tu manual de marca'}</p>
            <p className="max-w-xs text-sm text-muted">O cualquier archivo de tu identidad: guías, plantillas, tarjetas. Hasta 3 MB cada uno.</p>
          </div>
        )}
      </Card.Content>
      <ConfirmDialog
        open={Boolean(removing)}
        title={`¿Quitar «${removing?.name || ''}»?`}
        text="Se borra el archivo. No se puede deshacer."
        confirm="Quitar"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          setBrand({ files: (brandOf().files || []).filter((x) => x.id !== removing.id) });
          deleteFile(removing.fileId);
          setRemoving(null);
        }}
      />
    </Card>
  );
}

/** Tu identidad, como una marca más en Marketing (para planificar tus propias publicaciones). */
function toMarketing() {
  const s = crm.settings;
  const b = brandOf(s);
  const hexes = (b.colors || []).map((c) => c.hex).filter(isHex);
  const existing = crm.brands?.find((x) => x.id === b.marketingId);
  const fonts = [b.headingFont, b.bodyFont].filter(Boolean).map((k) => FONTS[k]?.[0]).filter(Boolean);
  const item = {
    ...(existing || { id: uid(), order: (crm.brands || []).length, handle: '', pillars: '', hashtags: '', hashtagSets: '', cadence: 3, cta: '', assets: [], svgs: [], audience: '' }),
    name: s.name || 'Mi negocio',
    industry: s.industry || existing?.industry || '',
    tone: b.voice || existing?.tone || '',
    fonts: [...new Set(fonts)].join(', '),
    colors: { primary: hexes[0] || '#1d2126', secondary: hexes[1] || '#00b8d4', accent: hexes[2] || '#1f9d46' },
    guidelines: b.guidelines || existing?.guidelines || '',
    link: s.website ? (/^https?:\/\//.test(s.website) ? s.website : `https://${s.website}`) : existing?.link || '',
    logo: existing?.logo || '',
    own: true,
  };
  put('brands', item);
  if (!existing) setBrand({ marketingId: item.id });
  return item;
}

function Voz() {
  const [state] = useCrm();
  const b = brandOf(state.settings);
  const linked = state.brands?.some((x) => x.id === b.marketingId);
  return (
    <Card className="h-full lg:col-span-2">
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Card.Title>Voz y estilo</Card.Title>
          <Card.Description>Cómo hablas y lo que nunca harías con tu marca. Lo lee Claude al escribir por ti.</Card.Description>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const item = toMarketing();
            toast.success(linked ? 'Tu marca en Marketing está al día' : 'Tu marca ya está en Marketing', { actionProps: { children: 'Ver', onPress: () => go(`#/marketing/marcas/${item.id}`) } });
          }}
        >
          <Megaphone />
          {linked ? 'Actualizar en Marketing' : 'Llevar a Marketing'}
        </Button>
      </Card.Header>
      <Card.Content className="grid gap-4 md:grid-cols-2">
        <TextField defaultValue={b.voice || ''} maxLength={1000} onChange={(v) => setBrand({ voice: v })}>
          <Label className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-muted" />
            Tono
          </Label>
          <TextArea rows={4} placeholder="Cercano y claro, sin tecnicismos. Tuteamos. Frases cortas." />
        </TextField>
        <TextField defaultValue={b.guidelines || ''} maxLength={3000} onChange={(v) => setBrand({ guidelines: v })}>
          <Label className="flex items-center gap-1.5">
            <Font className="size-3.5 text-muted" />
            Reglas de marca
          </Label>
          <TextArea rows={4} placeholder="El logo siempre con aire alrededor. Nunca sobre fotos recargadas. Usamos el cian solo para destacar." />
        </TextField>
      </Card.Content>
    </Card>
  );
}

function Marca() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Colores />
      <Tipografia />
      <Logos />
      <Documentos />
      <Voz />
    </div>
  );
}

/* ── Facturación ────────────────────────────────────────────────────────── */

const DAYS = { style: 'unit', unit: 'day', unitDisplay: 'long' };

function Facturacion() {
  const [state] = useCrm();
  const s = state.settings;
  const cashCode = /^[A-Z]{3}$/.test(s.currency) && s.currency !== 'USDT';
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <Card.Header>
            <Card.Title>Moneda y plazos</Card.Title>
            <Card.Description>Lo que se propone al crear cada documento. Cada uno se puede cambiar después.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-6">
            <CurrencyPicker label="Moneda principal" value={s.currency} onChange={(c) => setSetting('currency', c)} description="Las cifras de los listados y los documentos nuevos van en esta moneda (salvo que el cliente tenga otra)." />
            <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
              <NumberStepper label="Días para pagar" value={Number(s.dueDays) || 0} onChange={(n) => setSetting('dueDays', Math.round(n))} min={0} max={365} formatOptions={DAYS} width={9} />
              <NumberStepper label="Validez de una cotización" value={Number(s.quoteDays) || 0} onChange={(n) => setSetting('quoteDays', Math.round(n))} min={0} max={365} formatOptions={DAYS} width={9} />
              <NumberStepper
                label="Tarifa por hora"
                value={Number(s.hourlyRate) || 0}
                onChange={(n) => setSetting('hourlyRate', n)}
                min={0}
                step={5}
                formatOptions={cashCode ? { style: 'currency', currency: s.currency, currencyDisplay: 'narrowSymbol' } : { maximumFractionDigits: 2 }}
                width={10}
              />
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Impuesto</Card.Title>
            <Card.Description>El que se añade con un toque en la hoja y, si quieres, en cada factura y cotización nueva.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div className="w-36">
                <TextField defaultValue={s.taxLabel || 'IVA'} maxLength={20} onChange={(v) => setSetting('taxLabel', v.trim())}>
                  <Label>Nombre</Label>
                  <Input placeholder="IVA" />
                </TextField>
              </div>
              <NumberStepper label="Porcentaje" value={Number(s.taxRate ?? 16)} onChange={(n) => setSetting('taxRate', Math.max(0, Math.min(100, n)))} min={0} max={100} step={1} formatOptions={{ maximumFractionDigits: 2 }} width={5} />
            </div>
            <SwitchField
              label="Añadirlo solo a las facturas y cotizaciones nuevas"
              description="Si no, lo añades tú desde «Total» en cada documento."
              isSelected={Boolean(s.autoTax)}
              onChange={(v) => setSetting('autoTax', v)}
            />
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Textos por defecto</Card.Title>
            <Card.Description>Van en cada documento nuevo. Para textos que eliges en cada caso, usa la Biblioteca.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4">
            <Text k="notes" label="Nota al pie" area={2} max={2000} />
            <Text k="terms" label="Términos y condiciones" area={4} max={8000} placeholder="Se añaden a cada documento nuevo. Vacío: no se añaden." />
          </Card.Content>
        </Card>
      </div>
      <div className="flex flex-col gap-4 xl:sticky xl:top-24">
        <Card>
          <Card.Header>
            <Card.Title>Numeración</Card.Title>
            <Card.Description>Los próximos números, por tipo y por año. Se asignan al emitir.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="grid grid-cols-2 gap-2">
              {[
                ['invoice', 'Factura'],
                ['quote', 'Cotización'],
                ['proposal', 'Propuesta'],
                ['receipt', 'Recibo'],
              ].map(([type, word]) => (
                <li key={type} className="flex flex-col rounded-2xl bg-surface-secondary px-3 py-2.5">
                  <span className="text-xs text-muted">{word}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{nextNumber(type)}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
        <Preview s={s} />
      </div>
    </div>
  );
}

/* ── La pantalla ────────────────────────────────────────────────────────── */

const TABS = ['perfil', 'marca', 'facturacion'];

export function MiNegocio({ tab: routeTab }) {
  const tab = TABS.includes(routeTab) ? routeTab : 'perfil';
  const onTab = (t) => go(t === 'perfil' ? '#/ajustes' : `#/ajustes/${t}`);
  return (
    <div className="flex flex-col gap-4">
      <IdentityCard tab={tab} onTab={onTab} />
      {tab === 'marca' ? <Marca /> : tab === 'facturacion' ? <Facturacion /> : <Perfil />}
    </div>
  );
}
