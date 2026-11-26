// Portal de clientes › administración, en el diseño nuevo: crear portales, qué puede
// ver y hacer su gente (permisos), el conector de Claude, las cuentas con su rol y a
// qué portales entran (Accesos) y la identidad de cada app con la app de verdad al
// lado. Las reglas y las llamadas son las de negocio-portal.js, la versión de siempre.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRotateLeft, ArrowUpRightFromSquare, Copy, Key, Link as LinkIcon, Plus, Smartphone, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, Chip, Input, Label, SearchField, Skeleton, Tabs, TextArea, TextField, toast } from '@heroui/react';
import { find, state } from '../../../negocio-core.js';
import { must, sb, studioSession } from '../../../negocio-puente.js';
import { BUCKET, FUNCTION_URL, SUPABASE_KEY } from '../../../portal/config.js';
import { COLORS, FONTS, HEROES, PERMS, RADII, ROLES, SECTION_PERM, THEMES, brandOf, loadFont, memberCan, permDefault, portalAllows, roleAllows } from '../../../portal/brand.js';
import { claudeInstructions } from '../../../portal/importers.js';
import { Empty, Person } from '../../kit/parts.jsx';
import { copyText } from '../../kit/csv.js';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { ConfirmDialog, FormModal, SelectField } from '../fields.jsx';
import { go } from '../store.js';

/* ── Supabase con la cuenta del estudio ─────────────────────────────────── */

async function fn(action, body = {}) {
  const s = await studioSession();
  const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${s?.token}` }, body: JSON.stringify({ action, ...body }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
async function signedUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await (await sb()).storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
export async function loadPortals() {
  const c = await sb();
  const [clients, members] = await Promise.all([
    c.from('portal_clients').select('*').order('archived').order('name').then(must),
    c.from('portal_members').select('*').order('created_at').then(must),
  ]);
  const logos = Object.fromEntries(await Promise.all(clients.filter((x) => x.logo_url).map(async (x) => [x.id, await signedUrl(x.logo_url)])));
  return { clients, members, logos };
}
const safeName = (name) => String(name || 'archivo').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-60) || 'archivo';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const ago = (iso) => {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2_592_000) return Math.floor(s / 86_400) === 1 ? 'ayer' : `hace ${Math.floor(s / 86_400)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
};
async function copy(text, done = 'Copiado') {
  if (await copyText(text)) toast.success(done);
  else toast.danger('No se pudo copiar');
}
/** Las secciones ocultas de antes, como permisos (para no perderlas al guardar). */
const hiddenAsPerms = (hidden = []) => Object.fromEntries(Object.entries(SECTION_PERM).filter(([s]) => (hidden || []).includes(s)).map(([, k]) => [k, false]));
/** Cuántos permisos de un portal no están como vienen. */
export const changedPerms = (p) => Object.entries({ ...hiddenAsPerms(p.hidden), ...(p.perms || {}) }).filter(([k, v]) => v !== permDefault(k)).length;

function Seg({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium">{label}</span>}
      <Tabs selectedKey={value} onSelectionChange={(k) => onChange(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={label || 'Opciones'}>
            {options.map(([k, t]) => (
              <Tabs.Tab key={k} id={k}>
                {t}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </div>
  );
}

/** Los colores de la marca, más uno a mano. */
function Swatches({ value, onChange, label = 'Color' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {COLORS.map((c) => {
        const on = c.toLowerCase() === String(value).toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c}
            onClick={() => onChange(c)}
            className={`size-8 rounded-full outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-focus ${on ? 'ring-2 ring-foreground' : ''}`}
            style={{ background: c }}
          />
        );
      })}
      <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-default" title="Otro color">
        <span className="sr-only">Otro color</span>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#00b8d4'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

export function PortalLogo({ p, logos, size = 'size-10' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white ${size}`} style={{ background: p.accent || 'var(--accent)' }}>
      {logos?.[p.id] ? <img src={logos[p.id]} alt="" className="size-full object-cover" /> : initials(p.name)}
    </span>
  );
}

/* ── Permisos ───────────────────────────────────────────────────────────── */

/**
 * Qué puede ver y hacer la gente de un portal (`portal`) o una persona en concreto (`member`,
 * con su rol). Lo de una persona son excepciones: lo que no toques sigue a su rol y a su portal.
 */
export function PermsDialog({ title, portal, member = null, onSave, onClose }) {
  const [role, setRole] = useState(member?.role || 'member');
  const [draft, setDraft] = useState(() => ({ ...hiddenAsPerms(member ? member.hidden : portal.hidden), ...((member ? member.perms : portal.perms) || {}) }));
  const value = (k) => (member ? memberCan({ role, perms: draft }, portal, k) : portalAllows({ perms: draft }, k));
  return (
    <FormModal
      title={title}
      size="sm:max-w-[760px]"
      submit="Guardar"
      onClose={onClose}
      onSubmit={() => {
        Promise.resolve(onSave({ ...draft }, role)).catch((err) => toast.danger(err.message));
        return true;
      }}
    >
      <div className="flex flex-col gap-4 sm:col-span-2">
        {member && <Seg label="Rol" value={role} onChange={setRole} options={Object.entries(ROLES).map(([k, [l]]) => [k, l])} />}
        <p className="text-sm text-muted">
          {member
            ? 'Lo marcado como «excepción» es solo para esta persona; lo demás sigue a su rol y a lo que permite su portal.'
            : 'Lo que su gente puede ver y hacer. «Solo lectura» nunca hace más que ver; a cada persona le puedes poner excepciones en Accesos. La base lo aplica: no es solo esconderlo en la app.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PERMS.map(([groupTitle, list]) => (
            <section key={groupTitle} className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3">
              <h3 className="sw-eyebrow">{groupTitle}</h3>
              {list.map(([k, label, sub]) => {
                const own = member && k in draft;
                const why = member && !own && (!roleAllows(role, k) ? `${ROLES[role]?.[0] || 'Su rol'}: no lo incluye` : !portalAllows(portal, k) ? 'Su portal no lo permite' : null);
                return (
                  <SwitchField
                    key={k}
                    label={label}
                    description={own ? 'Excepción para esta persona' : why || sub}
                    isSelected={value(k)}
                    onChange={(on) => setDraft((d) => ({ ...d, [k]: on }))}
                    size="sm"
                  />
                );
              })}
            </section>
          ))}
        </div>
        {Object.keys(draft).length > 0 && (
          <Button size="sm" variant="ghost" className="self-start" onPress={() => setDraft({})}>
            <ArrowRotateLeft />
            {member ? 'Quitar sus excepciones' : 'Volver a lo de siempre'}
          </Button>
        )}
      </div>
    </FormModal>
  );
}

/* ── El conector de Claude ──────────────────────────────────────────────── */

/** La dirección secreta con la que Claude (desde el proyecto de este cliente) carga su calendario. */
export function ClaudeDialog({ p, onClose }) {
  const [status, setStatus] = useState(undefined);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [ask, setAsk] = useState(null); // 'replace' | 'revoke'
  useEffect(() => {
    fn('mcp_status', { client_id: p.id })
      .then((r) => setStatus(r.status || null))
      .catch((err) => setError(err.message));
  }, [p.id]);
  const issue = async () => {
    try {
      const r = await fn('mcp_key', { client_id: p.id });
      setUrl(r.url);
      setStatus((await fn('mcp_status', { client_id: p.id })).status || null);
    } catch (err) {
      toast.danger(err.message);
    }
  };
  const revoke = async () => {
    try {
      await fn('mcp_revoke', { client_id: p.id });
      toast('Desconectado');
      setStatus(null);
      setUrl(null);
    } catch (err) {
      toast.danger(err.message);
    }
  };
  return (
    <FormModal title={`Claude y el calendario de ${p.name}`} size="sm:max-w-[640px]" submit="Listo" onClose={onClose} onSubmit={() => true}>
      <div className="flex flex-col gap-4 sm:col-span-2">
        <p className="text-sm text-muted">
          Con el conector, Claude ve el calendario de este cliente y carga de una vez lo que ideaste: cada publicación con sus redes, su formato, el copy, el guion o el diseño. Entra como «Idea» y el cliente no lo ve ni recibe aviso hasta que la pasas a producción o a revisión.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {status === undefined && !error && <Skeleton className="h-16 rounded-2xl" />}
        {url && (
          <section className="flex flex-col gap-2 rounded-2xl bg-accent/10 p-3">
            <h3 className="text-sm font-semibold">Tu dirección</h3>
            <code className="break-all rounded-xl bg-surface p-2 text-xs">{url}</code>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onPress={() => copy(url, 'Dirección copiada')}>
                <Copy />
                Copiar
              </Button>
              <span className="text-xs text-muted">Solo se ve ahora: guárdala en Claude. Si la pierdes, crea otra.</span>
            </div>
          </section>
        )}
        {status ? (
          <section className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-success" />
              Conectado desde {ago(status.created_at)}
              {status.last_used_at ? ` · Claude la usó ${ago(status.last_used_at)}` : ' · aún sin usar'}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onPress={() => setAsk('replace')}>
                <ArrowRotateLeft />
                Cambiar la dirección
              </Button>
              <Button size="sm" variant="danger-soft" onPress={() => setAsk('revoke')}>
                <Xmark />
                Desconectar
              </Button>
            </div>
          </section>
        ) : (
          status === null &&
          !url && (
            <Button className="self-start" onPress={issue}>
              <LinkIcon />
              Crear la dirección
            </Button>
          )
        )}
        <section className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3 text-sm">
          <h3 className="font-semibold">Cómo se usa</h3>
          <ol className="flex list-decimal flex-col gap-1 ps-5">
            <li>
              <b>En Claude:</b> Ajustes › Conectores › Añadir conector personalizado, y pega la dirección.
            </li>
            <li>
              <b>En el proyecto del cliente:</b> activa el conector en la conversación.
            </li>
            <li>
              <b>Pídeselo:</b> «Carga en el calendario de {p.name} lo que planificamos para noviembre en Instagram y TikTok».
            </li>
          </ol>
        </section>
        <section className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3 text-sm">
          <h3 className="font-semibold">Sin conector</h3>
          <p className="text-muted">Pega estas instrucciones en Claude: te dará un bloque que pegas en la app (Crear › Importar calendario de Claude).</p>
          <Button size="sm" variant="secondary" className="self-start" onPress={() => copy(claudeInstructions(p.name), 'Instrucciones copiadas')}>
            <Copy />
            Copiar instrucciones
          </Button>
        </section>
      </div>
      <ConfirmDialog
        open={ask === 'replace'}
        status="warning"
        title="¿Cambiar la dirección?"
        text="La anterior deja de valer al momento y tendrás que poner la nueva en Claude."
        confirm="Cambiar"
        onClose={() => setAsk(null)}
        onConfirm={issue}
      />
      <ConfirmDialog
        open={ask === 'revoke'}
        title={`¿Desconectar a Claude del calendario de ${p.name}?`}
        text="La dirección deja de valer."
        confirm="Desconectar"
        onClose={() => setAsk(null)}
        onConfirm={revoke}
      />
    </FormModal>
  );
}

/* ── Nuevo portal ───────────────────────────────────────────────────────── */

export function NewPortalDialog({ onClose }) {
  const [crm, setCrm] = useState('');
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(COLORS[0]);
  const [welcome, setWelcome] = useState('');
  const customers = [...state.customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return (
    <FormModal
      title="Nuevo portal"
      submit="Crear portal"
      onClose={onClose}
      onSubmit={async () => {
        if (!name.trim()) {
          toast.warning('El portal necesita un nombre.');
          return false;
        }
        try {
          const row = must(await (await sb()).from('portal_clients').insert({ name: name.trim(), crm_customer_id: crm || null, accent, welcome: welcome.trim() || null }).select().single());
          toast.success('Portal creado. Dale acceso a su gente en Accesos.');
          go(`#/portal/identidad/${row.id}`);
          return true;
        } catch (err) {
          toast.danger(err.message);
          return false;
        }
      }}
    >
      <SelectField
        label="Cliente de Negocio"
        value={crm || '_none'}
        description="Enlazarlo deja mandar su trabajo de hoy desde Negocio."
        className="sm:col-span-2"
        onChange={(k) => {
          const id = k === '_none' ? '' : k;
          setCrm(id);
          const c = id && find('customers', id);
          if (c && !name.trim()) setName(c.company || c.name);
        }}
        options={[['_none', 'Sin enlazar'], ...customers.map((c) => [c.id, c.company ? `${c.name} · ${c.company}` : c.name])]}
      />
      <TextField value={name} onChange={setName} maxLength={120} isRequired className="sm:col-span-2">
        <Label>Nombre que ve el cliente</Label>
        <Input placeholder="Café Aroma" />
      </TextField>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Color</span>
        <Swatches value={accent} onChange={setAccent} />
      </div>
      <TextField value={welcome} onChange={setWelcome} maxLength={2000} className="sm:col-span-2">
        <Label>Bienvenida</Label>
        <TextArea rows={3} placeholder="Aquí verás cada avance de tu proyecto… (sale arriba en su inicio)" />
      </TextField>
    </FormModal>
  );
}

/* ── Accesos ────────────────────────────────────────────────────────────── */

function CredentialsDialog({ u, password, portalName, onClose }) {
  const url = `${location.origin}/cliente/`;
  const text = `Hola${u.name ? ` ${u.name.split(' ')[0]}` : ''}: ya tienes tu acceso${portalName ? ` al proyecto ${portalName}` : ''} con Schwarck.\n\n${url}\nCorreo: ${u.email}\nContraseña: ${password}\n\nÁbrelo en el teléfono, toca «Instalar» y activa las notificaciones.`;
  return (
    <FormModal
      title="Datos de acceso"
      submit="Copiar mensaje"
      onClose={onClose}
      onSubmit={() => {
        copy(text, 'Mensaje copiado');
        return true;
      }}
    >
      <p className="text-sm text-muted sm:col-span-2">La contraseña solo se ve ahora. Mándala por WhatsApp o como prefieras; luego se puede cambiar desde el perfil de la app.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-surface-secondary p-3 text-sm sm:col-span-2">
        <dt className="text-muted">Correo</dt>
        <dd className="font-medium">{u.email}</dd>
        <dt className="text-muted">Contraseña</dt>
        <dd>
          <code className="rounded bg-surface px-1.5 py-0.5">{password}</code>
        </dd>
      </dl>
      <pre className="whitespace-pre-wrap rounded-2xl bg-surface-secondary p-3 text-xs sm:col-span-2">{text}</pre>
    </FormModal>
  );
}

function NewUserDialog({ clients, presetClient, onClose, onCreated }) {
  const active = clients.filter((p) => !p.archived);
  const [kind, setKind] = useState('client');
  const [passMode, setPassMode] = useState('auto');
  const [role, setRole] = useState('owner');
  const [perms, setPerms] = useState({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [portal, setPortal] = useState(presetClient || active[0]?.id || '');
  const [editingPerms, setEditingPerms] = useState(false);
  const p = clients.find((x) => x.id === portal);
  return (
    <FormModal
      title="Nueva cuenta"
      size="sm:max-w-[640px]"
      submit="Crear cuenta"
      onClose={onClose}
      onSubmit={async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          toast.warning('Escribe un correo válido.');
          return false;
        }
        if (passMode === 'own' && pass.length < 8) {
          toast.warning('La contraseña tiene que tener al menos 8 caracteres.');
          return false;
        }
        if (kind === 'client' && !portal) {
          toast.warning('Crea primero un portal.');
          return false;
        }
        try {
          const r = await fn('create_user', {
            email: email.trim(),
            name: name.trim(),
            password: passMode === 'own' ? pass : undefined,
            studio: kind === 'studio',
            portals: kind === 'client' ? [{ client_id: portal, role, perms }] : [],
          });
          onCreated(r, kind === 'client' ? p?.name : null);
          return true;
        } catch (err) {
          toast.danger(err.message);
          return false;
        }
      }}
    >
      <div className="sm:col-span-2">
        <Seg label="Para" value={kind} onChange={setKind} options={[['client', 'Un cliente'], ['studio', 'El estudio']]} />
      </div>
      <TextField value={name} onChange={setName} maxLength={120}>
        <Label>Nombre</Label>
        <Input placeholder="Laura Méndez" />
      </TextField>
      <TextField value={email} onChange={setEmail} type="email">
        <Label>Correo</Label>
        <Input placeholder="correo@cliente.com" autoComplete="off" />
      </TextField>
      <div className="sm:col-span-2">
        <Seg label="Contraseña" value={passMode} onChange={setPassMode} options={[['auto', 'Generarla'], ['own', 'Elegirla yo']]} />
      </div>
      {passMode === 'own' ? (
        <TextField value={pass} onChange={setPass} maxLength={72} className="sm:col-span-2">
          <Label>Contraseña</Label>
          <Input placeholder="Mínimo 8 caracteres" autoComplete="off" />
          <span className="text-xs text-muted">Se la mandas tú; luego la puede cambiar desde su perfil.</span>
        </TextField>
      ) : (
        <p className="text-sm text-muted sm:col-span-2">Se crea una contraseña segura y la ves una sola vez, con el mensaje listo para mandar.</p>
      )}
      {kind === 'client' ? (
        <>
          <SelectField label="Portal" value={portal} onChange={setPortal} options={active.map((x) => [x.id, x.name])} />
          <Seg label="Rol" value={role} onChange={setRole} options={Object.entries(ROLES).map(([k, [l]]) => [k, l])} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <span className="text-sm font-medium">Permisos</span>
            <Button size="sm" variant="secondary" isDisabled={!p} onPress={() => setEditingPerms(true)}>
              <Key />
              {Object.keys(perms).length ? plural(Object.keys(perms).length, 'excepción', 'excepciones') : 'Como su rol'}
            </Button>
          </div>
        </>
      ) : (
        <p className="rounded-2xl bg-warning/10 p-3 text-sm sm:col-span-2">Una cuenta del estudio entra en todos los portales y lo puede todo (también esta sección). Dásela solo a tu equipo.</p>
      )}
      {editingPerms && p && (
        <PermsDialog
          title={`${name || email || 'Nueva cuenta'} en ${p.name}`}
          portal={p}
          member={{ role, perms }}
          onClose={() => setEditingPerms(false)}
          onSave={(next, nextRole) => {
            setPerms(next);
            setRole(nextRole);
          }}
        />
      )}
    </FormModal>
  );
}

function UserDialog({ u, data, session, onClose, reload, onCredentials }) {
  const { clients, members, logos } = data;
  const self = u.id === session.user.id;
  const mine = members.filter((m) => m.user_id === u.id);
  const free = clients.filter((p) => !p.archived && !mine.some((m) => m.client_id === p.id));
  const [addId, setAddId] = useState(free[0]?.id || '');
  const [addRole, setAddRole] = useState('member');
  const [perming, setPerming] = useState(null); // membership
  const [ask, setAsk] = useState(null); // { kind, m? }
  const [studio, setStudio] = useState(u.studio);
  const run = (task) => async (...args) => {
    try {
      await task(...args);
      await reload();
    } catch (err) {
      toast.danger(err.message);
    }
  };
  return (
    <FormModal
      title={u.name || u.email}
      size="sm:max-w-[680px]"
      submit="Listo"
      onClose={onClose}
      onSubmit={() => true}
      extra={
        !self && (
          <Button variant="danger-soft" onPress={() => setAsk({ kind: 'delete' })}>
            <TrashBin />
            Borrar cuenta
          </Button>
        )
      }
    >
      <p className="text-sm text-muted sm:col-span-2">
        {u.email} · creada {ago(u.created_at)} · {u.last_sign_in_at ? `entró ${ago(u.last_sign_in_at)}` : 'aún no ha entrado'}
        {self ? ' · eres tú' : ''}
      </p>
      <div className="rounded-2xl bg-surface-secondary p-3 sm:col-span-2">
        <SwitchField
          label="Cuenta del estudio (entra en todo)"
          isSelected={studio}
          isDisabled={self}
          onChange={async (on) => {
            try {
              await fn('set_studio', { user_id: u.id, studio: on });
              setStudio(on);
              u.studio = on;
              toast(on ? 'Ahora es del estudio' : 'Ya no es del estudio');
              reload();
            } catch (err) {
              toast.danger(err.message);
            }
          }}
        />
      </div>
      <section className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3 sm:col-span-2">
        <h3 className="text-sm font-semibold">Portales</h3>
        {mine.length ? (
          mine.map((m) => {
            const p = clients.find((x) => x.id === m.client_id);
            if (!p) return null;
            const own = Object.keys({ ...hiddenAsPerms(m.hidden), ...(m.perms || {}) }).length;
            return (
              <div key={m.client_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-2">
                <PortalLogo p={p} logos={logos} size="size-8" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{p.name}</b>
                  <span className="text-xs text-muted">{own ? plural(own, 'excepción', 'excepciones') : 'Como su rol y su portal'}</span>
                </span>
                <SelectField
                  ariaLabel="Rol"
                  value={m.role}
                  className="w-36"
                  onChange={(k) =>
                    run(async () => {
                      must(await (await sb()).from('portal_members').update({ role: k }).eq('client_id', m.client_id).eq('user_id', u.id));
                      toast(`Ahora es ${ROLES[k][0].toLowerCase()} en ${p.name}`);
                    })()
                  }
                  options={Object.entries(ROLES).map(([k, [l]]) => [k, l])}
                />
                <Button isIconOnly size="sm" variant="ghost" aria-label="Permisos" onPress={() => setPerming(m)}>
                  <Key className="size-4" />
                </Button>
                <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar de este portal" onPress={() => setAsk({ kind: 'leave', m, p })}>
                  <TrashBin className="size-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted">{u.studio ? 'Como es del estudio, entra en todos los portales.' : 'Todavía no entra en ningún portal.'}</p>
        )}
        {free.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <SelectField ariaLabel="Portal" value={addId} onChange={setAddId} options={free.map((p) => [p.id, p.name])} className="min-w-40 flex-1" />
            <Seg value={addRole} onChange={setAddRole} options={Object.entries(ROLES).map(([k, [l]]) => [k, l])} />
            <Button
              size="sm"
              isDisabled={!addId}
              onPress={run(async () => {
                must(await (await sb()).from('portal_members').insert({ client_id: addId, user_id: u.id, email: u.email, name: u.name, role: addRole }).select().single());
                toast('Añadido al portal');
              })}
            >
              <Plus />
              Añadir
            </Button>
          </div>
        )}
      </section>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" variant="secondary" onPress={() => setAsk({ kind: 'password' })}>
          <Key />
          Nueva contraseña
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={async () => {
            try {
              copy((await fn('link', { email: u.email, redirect_to: `${location.origin}/cliente/` })).link, 'Enlace copiado: entra sin contraseña una vez y caduca en una hora');
            } catch (err) {
              toast.danger(err.message);
            }
          }}
        >
          <LinkIcon />
          Copiar enlace de acceso
        </Button>
      </div>
      {perming && (
        <PermsDialog
          title={`${u.name || u.email} en ${clients.find((x) => x.id === perming.client_id)?.name || ''}`}
          portal={clients.find((x) => x.id === perming.client_id)}
          member={perming}
          onClose={() => setPerming(null)}
          onSave={run(async (perms, nextRole) => {
            must(await (await sb()).from('portal_members').update({ perms, role: nextRole, hidden: [] }).eq('client_id', perming.client_id).eq('user_id', u.id));
            toast('Permisos guardados');
          })}
        />
      )}
      <ConfirmDialog
        open={ask?.kind === 'leave'}
        title={ask?.p ? `¿Quitar a ${u.email} de ${ask.p.name}?` : ''}
        confirm="Quitar"
        onClose={() => setAsk(null)}
        onConfirm={run(async () => {
          must(await (await sb()).from('portal_members').delete().eq('client_id', ask.m.client_id).eq('user_id', u.id));
        })}
      />
      <ConfirmDialog
        open={ask?.kind === 'password'}
        status="warning"
        title={`¿Contraseña nueva para ${u.email}?`}
        text="La anterior deja de valer."
        confirm="Crear"
        onClose={() => setAsk(null)}
        onConfirm={async () => {
          try {
            const r = await fn('password', { user_id: u.id });
            onCredentials(u, r.password);
          } catch (err) {
            toast.danger(err.message);
          }
        }}
      />
      <ConfirmDialog
        open={ask?.kind === 'delete'}
        title={`¿Borrar la cuenta de ${u.email}?`}
        text="Pierde el acceso a todos los portales. No se puede deshacer."
        confirm="Borrar"
        onClose={() => setAsk(null)}
        onConfirm={async () => {
          try {
            await fn('delete_user', { user_id: u.id });
            toast('Cuenta borrada');
            await reload();
            onClose();
          } catch (err) {
            toast.danger(err.message);
          }
        }}
      />
    </FormModal>
  );
}

/** Todas las cuentas: su rol, a qué portales entran y sus excepciones. */
export function Accesos({ session, presetFilter = 'todos' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(presetFilter);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState(null);
  const reload = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([loadPortals(), fn('users')]);
      setData({ ...a, users: b.users });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const shown = useMemo(() => {
    if (!data) return [];
    const text = q.trim().toLowerCase();
    return data.users
      .filter((u) => {
        const mine = data.members.filter((m) => m.user_id === u.id);
        if (filter === 'estudio' && !u.studio) return false;
        if (filter === 'sin' && (u.studio || mine.length)) return false;
        if (!['todos', 'estudio', 'sin'].includes(filter) && !mine.some((m) => m.client_id === filter)) return false;
        return !text || `${u.name || ''} ${u.email}`.toLowerCase().includes(text);
      })
      .sort((a, b) => Number(b.studio) - Number(a.studio) || (a.name || a.email).localeCompare(b.name || b.email));
  }, [data, filter, q]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <Skeleton className="h-64 rounded-3xl" />;
  const openUser = open && data.users.find((u) => u.id === open);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button onPress={() => setCreating(true)}>
          <Plus />
          Nueva cuenta
        </Button>
        <span className="flex-1" />
        <SelectField
          ariaLabel="Filtrar"
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-56"
          options={[['todos', 'Todas las cuentas'], ['estudio', 'Solo el estudio'], ['sin', 'Sin portal'], ...data.clients.map((p) => [p.id, p.name])]}
        />
        <SearchField aria-label="Buscar por nombre o correo" value={q} onChange={setQ} className="w-full sm:w-64">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Nombre o correo" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
      <section className="flex flex-col rounded-3xl bg-surface p-2 shadow-[var(--surface-shadow)]">
        {shown.length ? (
          shown.map((u) => {
            const mine = data.members.filter((m) => m.user_id === u.id);
            return (
              <button key={u.id} type="button" onClick={() => setOpen(u.id)} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 text-start outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus">
                <Person name={u.name || u.email} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{u.name || u.email}</b>
                  <span className="truncate text-xs text-muted">
                    {u.email} · {u.last_sign_in_at ? `entró ${ago(u.last_sign_in_at)}` : 'aún no ha entrado'}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {u.studio && (
                    <Chip size="sm" variant="soft" color="accent">
                      Estudio · todo
                    </Chip>
                  )}
                  {mine.map((m) => {
                    const p = data.clients.find((x) => x.id === m.client_id);
                    return (
                      p && (
                        <Chip key={m.client_id} size="sm" variant="secondary">
                          <span className="size-1.5 rounded-full" style={{ background: p.accent }} />
                          <Chip.Label>
                            {p.name} · {ROLES[m.role]?.[0] || m.role}
                          </Chip.Label>
                          {(Object.keys(m.perms || {}).length > 0 || m.hidden?.length > 0) && <Key className="size-3" />}
                        </Chip>
                      )
                    );
                  })}
                  {!u.studio && !mine.length && (
                    <Chip size="sm" variant="tertiary">
                      Sin portal
                    </Chip>
                  )}
                </span>
              </button>
            );
          })
        ) : (
          <p className="p-6 text-center text-sm text-muted">Nadie coincide.</p>
        )}
      </section>
      <section className="flex flex-col gap-2 rounded-3xl bg-surface-secondary p-4 text-sm">
        <h3 className="font-semibold">Roles</h3>
        <ul className="flex flex-col gap-1.5">
          <li className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color="accent">
              Estudio
            </Chip>
            <span className="text-muted">Tu equipo: entra en todos los portales y lo puede todo, también aquí.</span>
          </li>
          {Object.entries(ROLES).map(([k, [label, sub]]) => (
            <li key={k} className="flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft" color={{ owner: 'success', member: 'accent', viewer: 'default' }[k]}>
                {label}
              </Chip>
              <span className="text-muted">{sub}</span>
            </li>
          ))}
        </ul>
      </section>
      {creating && (
        <NewUserDialog
          clients={data.clients}
          presetClient={!['todos', 'estudio', 'sin'].includes(filter) ? filter : ''}
          onClose={() => setCreating(false)}
          onCreated={async (r, portalName) => {
            await reload();
            if (r.password) setCreds({ u: r.user, password: r.password, portalName });
            else toast(`${r.user.email} ya tenía cuenta: se añadió con su contraseña de siempre`);
          }}
        />
      )}
      {openUser && <UserDialog u={openUser} data={data} session={session} reload={reload} onClose={() => setOpen(null)} onCredentials={(u, password) => setCreds({ u, password })} />}
      {creds && <CredentialsDialog u={creds.u} password={creds.password} portalName={creds.portalName} onClose={() => setCreds(null)} />}
    </div>
  );
}

/* ── Identidad ──────────────────────────────────────────────────────────── */

const PHONE = 390;

/** Logo, portada, colores, tipografía, esquinas, inicio, tema y nombre de la app de un cliente, con la app de verdad al lado. */
export function Identidad({ id }) {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        setClients(must(await (await sb()).from('portal_clients').select('*').order('archived').order('name')));
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!clients) return <Skeleton className="h-96 rounded-3xl" />;
  if (!clients.length)
    return <Empty icon={Smartphone} title="Todavía no hay portales" text="Crea uno en Portales y vuelve aquí para ponerle su identidad." action={<Button onPress={() => go('#/portal/clientes')}>Ir a Portales</Button>} />;
  const p = clients.find((x) => x.id === id) || clients[0];
  return <IdentityEditor key={p.id} p={p} clients={clients} />;
}

function IdentityEditor({ p, clients }) {
  const [draft, setDraft] = useState(() => ({ name: p.name, accent: p.accent, welcome: p.welcome || '', logo_url: p.logo_url, hidden: p.hidden || [], perms: p.perms || {}, brand: { ...brandOf(p) } }));
  const [srcs, setSrcs] = useState({ logo: null, cover: null });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null);
  const frame = useRef(null);
  const screen = useRef(null);
  const [k, setK] = useState(1);
  const [h, setH] = useState(720);

  useEffect(() => {
    (async () => setSrcs({ logo: await signedUrl(p.logo_url), cover: await signedUrl(brandOf(p).cover) }))();
    for (const key of Object.keys(FONTS)) loadFont(key);
  }, [p]);

  // La app se dibuja al ancho de un teléfono de verdad y se encoge para caber aquí.
  useEffect(() => {
    if (!screen.current) return undefined;
    const ro = new ResizeObserver(() => {
      const kk = Math.min(1, screen.current.clientWidth / PHONE) || 1;
      setK(kk);
      setH(screen.current.clientHeight / kk);
    });
    ro.observe(screen.current);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'portal:preview', client: JSON.parse(JSON.stringify(draft)), logoSrc: srcs.logo, coverSrc: srcs.cover }, location.origin);
  }, [draft, srcs]);
  useEffect(() => {
    send();
  }, [send]);
  useEffect(() => {
    const onReady = (e) => {
      if (e.origin === location.origin && e.data?.type === 'portal:preview-ready' && e.source === frame.current?.contentWindow) send();
    };
    addEventListener('message', onReady);
    return () => removeEventListener('message', onReady);
  }, [send]);

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setBrand = (patch) => {
    setDraft((d) => ({ ...d, brand: { ...d.brand, ...patch } }));
    setDirty(true);
  };

  const upload = async (file, kind) => {
    if (file.size > 8 * 1048576) throw new Error('La imagen pesa más de 8 MB.');
    const path = `${p.id}/marca/${crypto.randomUUID().slice(0, 8)}-${kind}-${safeName(file.name)}`;
    must(await (await sb()).storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
    return path;
  };
  const pick = (kind) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        toast('Subiendo…');
        const path = await upload(f, kind);
        if (kind === 'logo') set({ logo_url: path });
        else setBrand({ cover: path, hero: 'imagen' });
        const url = await signedUrl(path);
        setSrcs((s) => ({ ...s, [kind]: url }));
        toast.success('Imagen lista. Guarda para que la vea el cliente.');
      } catch (err) {
        toast.danger(err.message);
      }
    });
    input.click();
  };
  const save = async () => {
    if (!draft.name.trim()) return toast.warning('El portal necesita un nombre.');
    setSaving(true);
    try {
      const brand = { ...draft.brand };
      for (const key of Object.keys(brand)) if (brand[key] === '' || brand[key] == null) delete brand[key];
      must(await (await sb()).from('portal_clients').update({ name: draft.name.trim(), accent: draft.accent, welcome: draft.welcome.trim() || null, logo_url: draft.logo_url || null, brand }).eq('id', p.id));
      setDirty(false);
      toast.success('Identidad guardada: el cliente la ve al abrir su app');
    } catch (err) {
      toast.danger(err.message);
    }
    setSaving(false);
    return undefined;
  };

  const imageField = ({ kind, label, hint }) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span
          className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface-secondary text-sm font-bold text-white ${kind === 'logo' ? 'size-14 rounded-2xl' : 'h-14 w-24 rounded-xl'}`}
          style={kind === 'logo' && !srcs.logo ? { background: draft.accent } : undefined}
        >
          {srcs[kind] ? <img src={srcs[kind]} alt="" className="size-full object-cover" /> : kind === 'logo' ? initials(draft.name) : null}
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => pick(kind)}>
              {srcs[kind] ? 'Cambiar' : 'Subir'}
            </Button>
            {srcs[kind] && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  if (kind === 'logo') set({ logo_url: null });
                  else setBrand({ cover: '' });
                  setSrcs((s) => ({ ...s, [kind]: null }));
                }}
              >
                Quitar
              </Button>
            )}
          </div>
          <span className="text-xs text-muted">{hint}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          label="Portal"
          value={p.id}
          className="w-full sm:w-72"
          onChange={(k2) => {
            if (k2 === p.id) return;
            if (dirty) setLeaveTo(k2);
            else go(`#/portal/identidad/${k2}`);
          }}
          options={clients.map((x) => [x.id, x.archived ? `${x.name} (archivado)` : x.name])}
        />
        <span className="flex-1" />
        <Button variant="secondary" onPress={() => window.open(`/cliente/?p=${p.id}`, '_blank', 'noopener')}>
          <ArrowUpRightFromSquare />
          Abrir su app
        </Button>
        <Button isDisabled={!dirty} isPending={saving} onPress={save}>
          Guardar
        </Button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)]">
            <h2 className="font-semibold">Marca</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField value={draft.name} onChange={(v) => set({ name: v })} maxLength={120}>
                <Label>Nombre del cliente</Label>
                <Input />
              </TextField>
              <TextField value={draft.brand.app_name || ''} onChange={(v) => setBrand({ app_name: v })} maxLength={60}>
                <Label>Nombre en su app</Label>
                <Input placeholder={draft.name} />
                <span className="text-xs text-muted">Sale arriba en su inicio.</span>
              </TextField>
            </div>
            {imageField({ kind: 'logo', label: 'Logo', hint: 'Cuadrado, PNG o JPG. Se ve en la barra y en el inicio.' })}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Color principal</span>
              <Swatches value={draft.accent} onChange={(v) => set({ accent: v })} label="Color principal" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Color secundario</span>
              <div className="flex flex-wrap items-center gap-3">
                <Swatches value={draft.brand.accent2 || '#1b66b8'} onChange={(v) => setBrand({ accent2: v })} label="Color secundario" />
                <Button size="sm" variant={draft.brand.accent2 ? 'ghost' : 'secondary'} onPress={() => setBrand({ accent2: '' })}>
                  Automático
                </Button>
              </div>
              <span className="text-xs text-muted">Se mezcla con el principal en el degradado del inicio.</span>
            </div>
            <TextField value={draft.welcome} onChange={(v) => set({ welcome: v })} maxLength={2000}>
              <Label>Bienvenida</Label>
              <TextArea rows={3} placeholder="Aquí verás cada avance de tu proyecto…" />
            </TextField>
          </section>
          <section className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)]">
            <h2 className="font-semibold">Diseño</h2>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Tipografía de los títulos</span>
              <div role="radiogroup" aria-label="Tipografía" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Object.entries(FONTS).map(([key, [family]]) => {
                  const on = draft.brand.font === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setBrand({ font: key })}
                      className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-2 outline-none focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-accent bg-accent/8' : 'border-transparent bg-surface-secondary'}`}
                      style={{ fontFamily: `'${family}', system-ui` }}
                    >
                      <b className="text-xl">Aa</b>
                      <small className="truncate text-[11px] text-muted">{family}</small>
                    </button>
                  );
                })}
              </div>
            </div>
            <Seg label="Esquinas" value={draft.brand.radius} onChange={(v) => setBrand({ radius: v })} options={Object.entries(RADII).map(([key, [l]]) => [key, l])} />
            <Seg label="Inicio" value={draft.brand.hero} onChange={(v) => setBrand({ hero: v })} options={Object.entries(HEROES)} />
            {imageField({ kind: 'cover', label: 'Imagen del inicio', hint: 'Horizontal. Se usa con «Imagen»; encima va un velo para que se lea el texto.' })}
            <Seg label="Tema por defecto" value={draft.brand.theme} onChange={(v) => setBrand({ theme: v })} options={Object.entries(THEMES)} />
            <span className="-mt-2 text-xs text-muted">Si la persona elige otro en su perfil, manda el suyo.</span>
          </section>
        </div>
        <aside className="flex flex-col items-center gap-2 lg:sticky lg:top-24">
          <div className="w-full max-w-[360px] rounded-[2.5rem] bg-[#0b0b0c] p-2.5 shadow-[var(--overlay-shadow)]">
            <div ref={screen} className="relative h-[620px] overflow-hidden rounded-[2rem] bg-white">
              <iframe
                ref={frame}
                src="/cliente/?demo&preview"
                title="Vista previa de la app"
                className="origin-top-left border-0"
                style={{ width: PHONE, height: h, transform: `scale(${k})` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted">Puedes tocarla: es la app de verdad, con contenido de ejemplo.</span>
        </aside>
      </div>
      <ConfirmDialog
        open={!!leaveTo}
        status="warning"
        title="Hay cambios sin guardar"
        text="¿Cambiar de portal igualmente? Se pierden."
        confirm="Cambiar"
        onClose={() => setLeaveTo(null)}
        onConfirm={() => go(`#/portal/identidad/${leaveTo}`)}
      />
    </div>
  );
}
