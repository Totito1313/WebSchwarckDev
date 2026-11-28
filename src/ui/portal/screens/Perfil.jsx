// Perfil y ajustes de la app nueva: tu tarjeta (foto, nombre, cargo y teléfono, que se
// cambian aquí), tu proyecto (proyecto, reuniones, informe y valoración), los datos de
// tu negocio (los edita el dueño), los avisos en este teléfono y por categoría, el
// tema, instalar la app, la contraseña y salir.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightFromSquare,
  ArrowUpRightFromSquare,
  Bell,
  Briefcase,
  Calendar,
  Camera,
  ChartColumn,
  ChevronRight,
  Clock,
  Comments,
  Envelope,
  FileText,
  Folder,
  Globe,
  Handset,
  Key,
  ListCheck,
  MapPin,
  Megaphone,
  Palette,
  Person,
  Persons,
  Smartphone,
  Star,
  Tray,
} from '@gravity-ui/icons';
import { Button, Card, Chip, Input, Label, Switch, TextArea, TextField, toast } from '@heroui/react';
import { Person as Face } from '../../kit/parts.jsx';
import { ThemeSwitch } from '../../kit/ThemeSwitch.jsx';
import { isIOS, useInstall } from '../../kit/install.js';
import { safeUrl } from '../../../portal/kit.js';
import { safeName } from '../../../portal/data.js';
import { app, can, currentProject, has, isOwner, nextMeeting, pendingDocs, signPaths, urlOf } from '../../../portal/state.js';
import { ROLES } from '../../../portal/brand.js';
import { openPortal, refresh, usePortal } from '../store.js';
import { FormModal } from '../../negocio/fields.jsx';
import { enablePush, pushState } from '../push.js';
import { canRate, monthName, ratingMonth } from './Valoracion.jsx';
import { defaultReportMonth } from './Informe.jsx';

/** Una fila de ajustes: icono, texto y lo que va a la derecha (o una flecha si se toca). */
export function Row({ icon: Icon, title, text, children, onPress, href, tone }) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${tone || 'var(--muted)'} 14%, transparent)`, color: tone || 'inherit' }}>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        {text && <span className="truncate text-xs text-muted">{text}</span>}
      </span>
      {children}
      {(onPress || href) && <ChevronRight className="size-4 shrink-0 text-muted" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-start outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover';
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return onPress ? (
    <button type="button" onClick={onPress} className={cls}>
      {inner}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  );
}

export function Group({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="sw-eyebrow px-1">{title}</h2>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)]">{children}</div>
    </section>
  );
}

/** Instalar la app: con el aviso del navegador cuando lo hay; si no, cómo hacerlo a mano. */
function InstallRow() {
  const { canInstall, installed, done, install } = useInstall();
  const text = installed
    ? 'Ya la estás usando como app'
    : done
      ? 'Ábrela desde tu pantalla de inicio'
      : canInstall
        ? 'Con su icono, como cualquier app'
        : isIOS()
          ? 'Compartir › «Añadir a pantalla de inicio»'
          : 'Menú del navegador › «Instalar» o «Añadir a inicio»';
  return (
    <Row icon={Smartphone} tone="var(--success)" title={installed || done ? 'Instalada' : 'Instálala en tu teléfono'} text={text}>
      {canInstall && (
        <Button size="sm" variant="secondary" onPress={() => install().then((ok) => ok && toast.success('Listo: ya la tienes en tu pantalla de inicio.'))}>
          Instalar
        </Button>
      )}
    </Row>
  );
}

const STATE_TEXT = {
  on: 'Activadas en este dispositivo',
  off: 'Desactivadas',
  denied: 'Bloqueadas en el navegador',
  install: 'Instala la app para activarlas',
  unsupported: 'Este navegador no las admite',
};

/** El estado de los avisos aquí, con el botón que toca (activar o probar). */
function usePush() {
  const [state, setState] = useState(null);
  const check = () => pushState().then(setState, () => setState('unsupported'));
  useEffect(() => {
    check();
  }, []);
  const turnOn = async () => {
    const r = await enablePush();
    if (r.ok) toast.success('Notificaciones activadas', { description: r.message });
    else toast.danger('No se activaron', { description: r.message });
    check();
    return r.ok;
  };
  return [state, turnOn];
}

/** En Inicio y en Novedades: invita a activar los avisos (con «Más tarde» por tres días). */
export function PushCard() {
  const [state, turnOn] = usePush();
  const [hidden, setHidden] = useState(() => Date.now() - Number(localStorage.getItem('portal:push-later') || 0) < 3 * 86_400_000);
  if (hidden || !['off', 'install'].includes(state)) return null;
  const ios = state === 'install';
  return (
    <Card className="flex-row items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Bell className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{ios ? 'Instala la app para recibir avisos' : 'Activa las notificaciones'}</span>
        <span className="text-xs text-muted">Te avisamos de cada petición, del reporte del día y de lo que tienes que aprobar.</span>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Button size="sm" onPress={() => (ios ? (location.hash = '#/perfil') : turnOn())}>
          {ios ? 'Cómo' : 'Activar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => {
            localStorage.setItem('portal:push-later', String(Date.now()));
            setHidden(true);
          }}
        >
          Más tarde
        </Button>
      </div>
    </Card>
  );
}

const PREF_CATS = [
  ['peticiones', 'Peticiones y recordatorios', Tray, 'var(--warning)'],
  ['trabajo', 'Reporte diario', ListCheck, 'var(--success)'],
  ['marketing', 'Contenido y resultados', Megaphone, 'var(--accent)'],
  ['avisos', 'Anuncios, documentos y reuniones', Bell, 'var(--cf-blue, #3b82f6)'],
  ['mensajes', 'Respuestas a tus comentarios', Comments, 'var(--cf-purple, #8b5cf6)'],
];

const BUSINESS = [
  ['industry', 'Sector', Briefcase, { max: 80, placeholder: 'Cafetería, clínica, tienda…' }],
  ['description', 'Descripción', FileText, { max: 2000, long: true, placeholder: 'Qué hacéis, en dos líneas' }],
  ['website', 'Web', Globe, { max: 300, type: 'url', placeholder: 'https://…' }],
  ['instagram', 'Instagram', Persons, { max: 120, placeholder: '@tunegocio' }],
  ['facebook', 'Facebook', Persons, { max: 300 }],
  ['tiktok', 'TikTok', Persons, { max: 120, placeholder: '@tunegocio' }],
  ['phone', 'Teléfono', Handset, { max: 40, type: 'tel', placeholder: '+58 412 000 0000' }],
  ['email', 'Correo', Envelope, { max: 200, type: 'email' }],
  ['address', 'Dirección', MapPin, { max: 300 }],
  ['hours', 'Horario', Clock, { max: 300, placeholder: 'Lun–Sáb 8:00–20:00' }],
];
const short = (v, n = 28) => {
  const s = String(v || '').replace(/^https?:\/\/(www\.)?/, '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Una ventana para cambiar un dato (o la contraseña). */
function EditField({ field, onClose }) {
  const { title, value, save, max = 200, long, type = 'text', placeholder } = field;
  return (
    <FormModal
      title={title}
      onClose={onClose}
      onSubmit={async (data) => {
        try {
          await save(String(data.value ?? '').trim(), data);
          toast.success('Guardado');
          return true;
        } catch (err) {
          toast.danger('No se guardó', { description: err.message });
          return false;
        }
      }}
    >
      <TextField name="value" defaultValue={value || ''} maxLength={max} type={type} autoFocus className="sm:col-span-2">
        <Label>{title}</Label>
        {long ? <TextArea rows={4} placeholder={placeholder} /> : <Input placeholder={placeholder} inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'url' ? 'url' : undefined} />}
      </TextField>
    </FormModal>
  );
}

function PasswordModal({ onClose }) {
  return (
    <FormModal
      title="Cambiar contraseña"
      submit="Cambiar"
      onClose={onClose}
      onSubmit={async ({ pass, again }) => {
        if (String(pass).length < 8 || pass !== again) {
          toast.danger(String(pass).length < 8 ? 'Mínimo 8 caracteres.' : 'Las dos no coinciden.');
          return false;
        }
        try {
          await app.backend.updatePassword(pass);
          toast.success('Contraseña cambiada');
          return true;
        } catch (err) {
          toast.danger('No se cambió', { description: err.message });
          return false;
        }
      }}
    >
      <TextField name="pass" type="password" autoComplete="new-password" isRequired className="sm:col-span-2">
        <Label>Nueva contraseña</Label>
        <Input placeholder="Mínimo 8 caracteres" />
      </TextField>
      <TextField name="again" type="password" autoComplete="new-password" isRequired className="sm:col-span-2">
        <Label>Repítela</Label>
        <Input />
      </TextField>
    </FormModal>
  );
}

/** Reduce una foto a `size` píxeles por lado (JPEG) antes de subirla. */
async function shrink(file, size) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
}

export function Perfil({ onSignOut }) {
  usePortal();
  const [editing, setEditing] = useState(null);
  const [password, setPassword] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [push, turnOn] = usePush();
  const picker = useRef(null);
  const m = app.member || {};
  const c = app.client || {};
  const prefs = m.prefs || {};
  const mute = new Set(prefs.mute || []);
  const others = app.portals.filter((p) => p.client.id !== c.id);
  const project = currentProject();
  const meeting = nextMeeting();
  const docs = pendingDocs();
  const live = app.backend.mode === 'live';
  const rateMonth = canRate() ? ratingMonth() : null;
  const rated = rateMonth && app.data.ratings.find((r) => r.month === rateMonth && r.user_id === app.user?.id);

  const saveSelf = async (patch) => {
    app.member = { ...app.member, ...(await app.backend.updateSelf(c.id, patch)) };
    refresh();
  };
  const saveClient = async (patch) => {
    app.client = { ...app.client, ...(await app.backend.updateClient(c.id, patch)) };
    refresh();
  };
  const edit = (title, value, save, opts = {}) => setEditing({ title, value, save, ...opts });

  const changePhoto = async (f) => {
    if (!f) return;
    if (f.size > 8 * 1048576) return toast.danger('La foto pesa más de 8 MB.');
    setPhotoBusy(true);
    try {
      const small = await shrink(f, 512);
      const path = `${c.id}/perfil/${app.user.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name.replace(/\.[^.]+$/, '.jpg'))}`;
      await app.backend.upload(path, small);
      await signPaths([path]);
      await saveSelf({ avatar_path: path });
      toast.success('Foto actualizada');
    } catch (err) {
      toast.danger('No se cambió la foto', { description: err.message });
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggleCat = async (k, on) => {
    const next = new Set(mute);
    if (on) next.delete(k);
    else next.add(k);
    try {
      await saveSelf({ prefs: { ...prefs, mute: [...next], push: true } });
    } catch (err) {
      toast.danger('No se guardó', { description: err.message });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tu tarjeta: foto (se cambia tocándola), nombre, cargo, correo y tu papel. */}
      <Card className="relative overflow-hidden p-0">
        <div aria-hidden className="h-20" style={{ background: `linear-gradient(120deg, ${c.accent || 'var(--accent)'}, color-mix(in oklab, ${c.accent || 'var(--accent)'} 40%, transparent))` }} />
        <div className="-mt-10 flex flex-col items-start gap-2 px-5 pb-5">
          <button
            type="button"
            aria-label="Cambiar tu foto"
            disabled={app.studio || photoBusy}
            onClick={() => picker.current?.click()}
            className="group relative rounded-full outline-none ring-4 ring-[var(--surface)] focus-visible:ring-focus"
          >
            <Face name={m.name || app.user?.email} src={urlOf(m.avatar_path) || undefined} size="lg" />
            {!app.studio && (
              <span className="absolute -bottom-1 -end-1 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow transition-transform group-hover:scale-110">
                <Camera className="size-3.5" />
              </span>
            )}
          </button>
          <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => changePhoto(e.target.files?.[0])} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xl font-semibold">{m.name || 'Sin nombre'}</span>
            <span className="truncate text-sm text-muted">{[m.position, app.user?.email].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!app.studio && m.role && (
              <Chip size="sm" variant="soft" color="accent">
                {ROLES[m.role]?.[0] || m.role}
              </Chip>
            )}
            <Chip size="sm" variant="secondary">
              {c.name}
            </Chip>
          </div>
        </div>
      </Card>

      {!app.studio && (
        <Group title="Tú">
          <Row icon={Person} tone="var(--accent)" title="Nombre" text={m.name || 'Añadir'} onPress={() => edit('Tu nombre', m.name, (v) => saveSelf({ name: v || null }), { max: 120 })} />
          <Row icon={Briefcase} tone="var(--cf-purple, #8b5cf6)" title="Cargo" text={m.position || 'Añadir'} onPress={() => edit('Tu cargo', m.position, (v) => saveSelf({ position: v || null }), { max: 80, placeholder: 'Dueña, marketing, encargado…' })} />
          <Row icon={Handset} tone="var(--success)" title="Teléfono" text={m.phone || 'Añadir'} onPress={() => edit('Tu teléfono', m.phone, (v) => saveSelf({ phone: v || null }), { max: 40, type: 'tel', placeholder: '+58 412 000 0000' })} />
        </Group>
      )}

      <Group title="Tu proyecto">
        {has('projects') && can('project.view') && <Row icon={Folder} tone="var(--accent)" title="Proyecto" text={project ? project.name : 'Todavía sin proyecto'} href="#/proyecto" />}
        {has('documents') && can('docs.view') && <Row icon={FileText} tone="var(--warning)" title="Facturas y documentos" text={docs.length ? `${docs.length} ${docs.length === 1 ? 'espera' : 'esperan'} algo de ti` : 'Todo al día'} href="#/recursos" />}
        {has('meetings') && <Row icon={Calendar} tone="var(--success)" title="Reuniones" text={meeting ? `Próxima: ${meeting.topic}` : 'Pide una cuando quieras hablar'} href="#/reuniones" />}
        <Row icon={ChartColumn} tone="var(--cf-purple, #8b5cf6)" title="Informe del mes" text="El trabajo, lo publicado y los resultados, en PDF" href={`#/informe/${defaultReportMonth()}`} />
        {rateMonth && <Row icon={Star} tone="var(--warning)" title={rated ? `Tu valoración de ${monthName(rateMonth)}` : `Valorar ${monthName(rateMonth)}`} text={rated ? `${rated.score} de 5 · puedes cambiarla hasta el día 7` : '¿Cómo lo hicimos?'} href="#/valorar" />}
      </Group>

      <Group title="Tu negocio">
        {BUSINESS.map(([key, label, Icon, opts]) => {
          const value = c[key];
          if (!isOwner() && !value) return null;
          return (
            <Row
              key={key}
              icon={Icon}
              title={label}
              text={value ? short(value, key === 'description' ? 60 : 32) : 'Añadir'}
              onPress={
                isOwner()
                  ? () =>
                      edit(label, value, async (v) => {
                        if (key === 'website' && v && !safeUrl(v)) throw new Error('La web tiene que empezar por https://');
                        await saveClient({ [key]: v || null });
                      }, opts)
                  : undefined
              }
            />
          );
        })}
        {!isOwner() && <p className="px-4 py-3 text-xs text-muted">Los datos del negocio los cambia el dueño del portal o el estudio.</p>}
      </Group>

      {others.length > 0 && (
        <Group title="Tus proyectos">
          {app.portals.map((p) => (
            <Row key={p.client.id} icon={Persons} title={p.client.name} text={p.client.id === c.id ? 'El que tienes abierto' : 'Cambiar a este'} onPress={p.client.id === c.id ? undefined : () => openPortal(p)} />
          ))}
        </Group>
      )}

      <Group title="Notificaciones">
        <Row icon={Bell} tone="var(--danger)" title="En este dispositivo" text={push ? STATE_TEXT[push] : 'Comprobando…'}>
          {push === 'on' && live && (
            <Button
              size="sm"
              variant="secondary"
              onPress={async () => {
                const r = await app.backend.testPush().catch((e) => toast.danger(e.message));
                if (r?.sent) toast.success('Enviado: te llega en unos segundos.');
                else if (r) toast.danger('No hay dispositivos suscritos.');
              }}
            >
              Probar
            </Button>
          )}
          {(push === 'off' || push === 'install') && (
            <Button size="sm" onPress={turnOn}>
              Activar
            </Button>
          )}
        </Row>
        {!app.studio &&
          PREF_CATS.map(([k, label, Icon, tone]) => (
            <Row key={k} icon={Icon} tone={tone} title={label}>
              <Switch aria-label={label} isSelected={!mute.has(k) && prefs.push !== false} onChange={(on) => toggleCat(k, on)}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </Row>
          ))}
      </Group>

      <Group title="Apariencia">
        <Row icon={Palette} title="Tema" text="Claro, oscuro o el de tu teléfono">
          <ThemeSwitch />
        </Row>
      </Group>

      <Group title="La app">
        <InstallRow />
        {live && <Row icon={Key} title="Cambiar contraseña" onPress={() => setPassword(true)} />}
        <Row icon={ArrowUpRightFromSquare} title="Versión de siempre" text="La app anterior (y el modo estudio)" onPress={() => (location.href = `/cliente/${location.search}`)} />
      </Group>

      <Button variant="danger-soft" className="self-start" onPress={onSignOut}>
        <ArrowRightFromSquare />
        {live ? 'Salir' : 'Salir de la demostración'}
      </Button>

      {editing && <EditField field={editing} onClose={() => setEditing(null)} />}
      {password && <PasswordModal onClose={() => setPassword(false)} />}
    </div>
  );
}
