// Pestañas «Diseño», «Compartir» y «Pagos» del editor de documentos. Las reglas son
// las del editor de siempre (negocio-doc.js): mismo enlace público, mismos pagos y
// recibos, mismo estilo de hoja.
import { useEffect, useState } from 'react';
import { ArrowUpRightFromSquare, Ban, CircleCheck, CircleDollar, Clock, Copy, Eye, Link as LinkIcon, Lock, Smartphone, TrashBin } from '@gravity-ui/icons';
import { Button, Chip, Input, Label, Link, ProgressBar, Slider, Tabs, TextField, toast } from '@heroui/react';
import { api, dateText, find, flushNow, money, numText, put, pubOf, remove, state, strongest, totals, unitName } from '../../../negocio-core.js';
import { ACCENTS, stampText } from '../../../negocio-sheet.js';
import { copyText } from '../../kit/csv.js';
import { SwitchField } from '../../kit/SwitchField.jsx';
import { ConfirmDialog } from '../fields.jsx';
import { PaymentForm } from '../payments.jsx';
import { Block } from './shared.jsx';

const ACCENT_NAMES = { ink: 'Tinta', cyan: 'Cian', blue: 'Azul', green: 'Verde', violet: 'Violeta', orange: 'Naranja' };
const FONTS = [['inter', 'Inter'], ['dm', 'DM Sans'], ['mono', 'Mono']];
const SHARE_DAYS = [['0', 'No caduca'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días']];
const TITLE = { invoice: 'factura', quote: 'cotización', receipt: 'recibo', proposal: 'propuesta' };
const isSignable = (doc) => doc.type === 'quote' || doc.type === 'proposal';

function Choice({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Tabs selectedKey={value} onSelectionChange={(k) => onChange(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={label}>
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

/* ── Diseño ─────────────────────────────────────────────────────────────── */

export function Diseno({ doc, change }) {
  const st = doc.style;
  const restyle = (key) => (v) => change(() => { st[key] = v; });
  return (
    <div className="flex flex-col gap-6">
      <Choice label="Diseño" value={st.layout} onChange={restyle('layout')} options={[['bold', 'Titular grande'], ['classic', 'Clásico']]} />
      <Choice label="Letra" value={st.font} onChange={restyle('font')} options={FONTS} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Color</span>
        <div role="radiogroup" aria-label="Color de acento" className="flex flex-wrap gap-2">
          {[
            ...Object.entries(ACCENTS).map(([key, color]) => [key, color, ACCENT_NAMES[key]]),
            // Los colores de tu marca (Mi negocio › Identidad de marca) también valen.
            ...(state.settings.brand?.colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex || '')).map((c) => [c.hex, c.hex, `${c.name || 'Color de marca'} · ${c.hex}`]),
          ].map(([key, color, name], i) => {
            const on = st.accent === key;
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={name}
                title={name}
                onClick={() => restyle('accent')(key)}
                className={`size-9 rounded-full border border-border outline-none ring-offset-2 ring-offset-surface transition-shadow focus-visible:ring-2 focus-visible:ring-focus ${on ? 'ring-2 ring-foreground' : ''} ${key.startsWith('#') ? 'rounded-xl' : ''}`}
                style={{ background: color }}
              />
            );
          })}
        </div>
      </div>
      <Choice label="Portada" value={st.cover} onChange={restyle('cover')} options={[['none', 'Sin portada'], ['sky', 'Cielo'], ['deep', 'Oscura']]} />
      <Slider value={Number(st.logoSize) || 44} minValue={24} maxValue={96} step={2} onChange={(v) => change(() => { st.logoSize = Number(v); })}>
        <Label>Tamaño del logo</Label>
        <Slider.Output>{({ state: s }) => `${s.values[0]} px`}</Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      {!state.settings.logo && (
        <p className="-mt-3 text-xs text-muted">
          Todavía no tienes logo: súbelo en <Link href="#/ajustes" className="text-xs">Mi negocio</Link>.
        </p>
      )}
      <SwitchField label="Firma al pie" isSelected={doc.signature !== false} onChange={(v) => change(() => { doc.signature = v; })} />
      <Button
        variant="secondary"
        className="self-start"
        onPress={() => {
          put('settings', { ...state.settings, style: { ...st } });
          toast.success('Los documentos nuevos saldrán con este estilo');
        }}
      >
        <CircleCheck />
        Usar en los documentos nuevos
      </Button>
    </div>
  );
}

/* ── Compartir ──────────────────────────────────────────────────────────── */

/** En la app del cliente: publicarla allí (con su estado al día) o quitarla. */
function PortalPublish({ doc }) {
  const [state0, setState0] = useState({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const { linkedPortals, portalOfCustomer, docInPortal, studioSession } = await import('../../../negocio-puente.js');
      const s = await studioSession().catch(() => null);
      if (!s?.admin) return setState0({ phase: 'nostudio' });
      const portal = portalOfCustomer(await linkedPortals(), doc.customerId);
      if (!portal) return setState0({ phase: 'noportal' });
      return setState0({ phase: 'ready', portal, row: await docInPortal(doc) });
    } catch (err) {
      return setState0({ phase: 'error', message: err.message });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.customerId]);

  const run = async (name, done) => {
    setBusy(true);
    try {
      const mod = await import('../../../negocio-puente.js');
      await mod[name](doc);
      toast.success(done);
    } catch (err) {
      toast.danger(err.message);
    }
    setBusy(false);
    load();
  };

  const word = isSignable(doc) ? 'firma' : 'paga';
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="size-4" />
        App del cliente
      </div>
      {state0.phase === 'loading' && <p className="text-xs text-muted">Mirando su portal…</p>}
      {state0.phase === 'error' && <p className="text-xs text-danger">{state0.message}</p>}
      {state0.phase === 'nostudio' && (
        <p className="text-xs text-muted">
          Para publicarla en la app del cliente, conecta la cuenta del estudio en <Link href="#/portal" className="text-xs">Portal de clientes</Link>.
        </p>
      )}
      {state0.phase === 'noportal' && (
        <p className="text-xs text-muted">
          Este cliente no tiene portal. Créalo en <Link href="#/portal/clientes" className="text-xs">Portal de clientes</Link> y podrás publicarla en su app.
        </p>
      )}
      {state0.phase === 'ready' && (
        <>
          <p className="text-xs text-muted">
            {state0.row
              ? `En el portal de ${state0.portal.name}: la ve en su app, con su estado al día (pagos, aperturas y firmas).`
              : `Publícala en la app de ${state0.portal.name}: le llega el aviso y la ${word} desde ahí.`}
          </p>
          {state0.row ? (
            <Button size="sm" variant="tertiary" isPending={busy} className="self-start" onPress={() => run('unpublishDoc', 'Quitada de su portal')}>
              <Ban />
              Quitar de su portal
            </Button>
          ) : (
            <Button size="sm" isPending={busy} className="self-start" onPress={() => run('publishDoc', `Publicada en el portal de ${state0.portal.name}`)}>
              <Smartphone />
              Publicar en su portal
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** El enlace público: crearlo (con contraseña y caducidad), copiarlo, ver quién lo abrió y desactivarlo. */
export function Compartir({ doc, change }) {
  const [password, setPassword] = useState('');
  const [days, setDays] = useState('0');
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const s = doc.share;
  const pub = pubOf(doc);
  const word = TITLE[doc.type];

  if (!doc.number) return <p className="text-sm text-muted">Se puede compartir en cuanto se guarde y tenga número (en unos segundos).</p>;

  if (s?.token) {
    const url = `${location.origin}/documento/#${s.token}`;
    const views = pub?.views || 0;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Quien tenga este enlace puede ver la {word}
          {isSignable(doc) ? ', aceptarla y firmarla' : ''}. No ve nada más de tu panel.
        </p>
        <TextField aria-label="Enlace" value={url} isReadOnly>
          <Input onFocus={(e) => e.target.select()} />
        </TextField>
        <div className="flex flex-wrap gap-2">
          <Button
            onPress={async () => {
              if (await copyText(url)) toast.success('Enlace copiado');
              else toast.danger('No se pudo copiar. Selecciónalo y cópialo a mano.');
            }}
          >
            <Copy />
            Copiar enlace
          </Button>
          <Button variant="secondary" onPress={() => window.open(`${location.origin}/documento/?vista=panel#${s.token}`, '_blank', 'noopener')}>
            <ArrowUpRightFromSquare />
            Abrir
          </Button>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <Lock className="size-4 text-muted" />
            {s.hasPassword ? 'Con contraseña' : 'Sin contraseña'}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-4 text-muted" />
            {s.expiresAt ? `Caduca el ${dateText(new Date(s.expiresAt).toLocaleDateString('en-CA'))}` : 'No caduca'}
          </li>
          <li className="flex items-center gap-2">
            <Eye className="size-4 text-muted" />
            {views ? `Abierto ${views} ${views === 1 ? 'vez' : 'veces'}; la última, el ${stampText(new Date(pub.lastViewAt || pub.viewedAt).toISOString())}` : 'Todavía no lo ha abierto nadie'}
          </li>
        </ul>
        {isSignable(doc) &&
          (pub?.acceptedAt ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-success/10 p-3">
              <Chip size="sm" color="success" variant="soft" className="self-start">
                <CircleCheck className="size-3.5" />
                <Chip.Label>Aceptada y firmada</Chip.Label>
              </Chip>
              {pub.mode === 'drawn' ? (
                <img src={`/api/admin/crm/signature/${doc.id}`} alt={`Firma de ${pub.name}`} className="max-h-20 self-start rounded-lg bg-white p-2" />
              ) : (
                <span className="font-['Allura'] text-3xl">{pub.name}</span>
              )}
              <span className="text-xs text-muted">
                {pub.name} · {stampText(pub.acceptedAt)}
              </span>
            </div>
          ) : pub?.declinedAt ? (
            <div className="flex flex-col gap-1 rounded-2xl bg-danger/10 p-3 text-sm">
              <b>Rechazada</b>
              <span className="text-xs text-muted">El {stampText(pub.declinedAt)}</span>
              {pub.reason && <span>Motivo: {pub.reason}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted">Esperando respuesta del cliente.</p>
          ))}
        <PortalPublish doc={doc} />
        <Button variant="danger-soft" className="self-start" onPress={() => setDisabling(true)}>
          <Ban />
          Desactivar enlace
        </Button>
        <ConfirmDialog
          open={disabling}
          title="¿Desactivar el enlace?"
          text="Quien lo tenga ya no podrá abrirlo."
          confirm="Desactivar"
          onClose={() => setDisabling(false)}
          onConfirm={async () => {
            try {
              await api(`/crm/share/${s.token}`, { method: 'DELETE' });
              change(() => { doc.share = null; });
              toast('Enlace desactivado');
            } catch (err) {
              toast.danger(err.message);
            }
          }}
        />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const pass = password.trim();
        if (pass && pass.length < 4) return toast.danger('La contraseña necesita al menos 4 caracteres.');
        setBusy(true);
        try {
          await flushNow();
          const share = await api('/crm/share', { method: 'POST', body: { docId: doc.id, password: pass, days: Number(days) } });
          change(() => {
            doc.share = share;
            if (doc.status === 'draft') doc.status = 'sent';
          });
          put('docs', doc, { now: true })?.catch(() => {});
          if (await copyText(`${location.origin}/documento/#${share.token}`)) toast.success('Enlace creado y copiado');
          else toast.success('Enlace creado');
        } catch (err) {
          toast.danger(err.message);
        }
        setBusy(false);
        return undefined;
      }}
    >
      <p className="text-sm text-muted">
        Crea un enlace para que el cliente vea la {word}
        {isSignable(doc) ? ', la acepte y la firme' : ' y la pague'} desde su teléfono. Sabrás cuándo la abre.
      </p>
      <TextField value={password} onChange={setPassword} maxLength={100}>
        <Label>Contraseña</Label>
        <Input placeholder="Opcional" autoComplete="off" />
        <span className="text-xs text-muted">Si la pones, envíala aparte. Mínimo 4 caracteres.</span>
      </TextField>
      <Choice label="Caducidad" value={days} onChange={setDays} options={SHARE_DAYS} />
      <Button type="submit" isPending={busy} className="self-start">
        <LinkIcon />
        Crear enlace
      </Button>
    </form>
  );
}

/* ── Pagos ──────────────────────────────────────────────────────────────── */

export function Pagos({ doc, change }) {
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const t = totals(doc);
  const cur = doc.currency;
  const history = [...(doc.payments || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const rateText = (p) => {
    if (!(p.rate > 0) || !p.rateBase) return '';
    const strong = strongest(cur, p.rateBase);
    return `1 ${unitName(strong)} = ${numText(p.rate)} ${unitName(strong === cur ? p.rateBase : cur)}`;
  };
  const delReceipt = deleting?.receiptId && find('docs', deleting.receiptId);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted">Total</span>
          <span className="sw-figure text-2xl">{money(t.total, cur)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-muted">Cobrado</span>
          <span className="sw-figure text-2xl">{money(t.paid, cur)}</span>
        </div>
        <ProgressBar aria-label="Cobrado del total" value={t.total ? Math.min(100, (t.paid / t.total) * 100) : 0} size="sm" color={t.due > 0.004 ? 'accent' : 'success'} className="col-span-2">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <div className="col-span-2 flex items-center justify-between text-sm">
          <span className="text-muted">Pendiente</span>
          <b className={t.due > 0.004 ? '' : 'text-success'}>{money(t.due, cur)}</b>
        </div>
      </div>
      {t.due > 0.004 ? (
        <Button className="self-start" onPress={() => setPaying(true)}>
          <CircleDollar />
          Registrar pago
        </Button>
      ) : (
        t.total > 0 && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheck />
            Esta factura está pagada.
          </p>
        )
      )}
      <Block title="Historial">
        {history.length ? (
          <ul className="flex flex-col">
            {history.map((p) => {
              const receipt = p.receiptId && find('docs', p.receiptId);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-secondary">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-sm tabular-nums">{money(p.amount, cur)}</b>
                    <span className="truncate text-xs text-muted">{[dateText(p.date), p.method, rateText(p), p.note].filter(Boolean).join(' · ')}</span>
                  </span>
                  {receipt && (
                    <Link href={`#/documentos/${receipt.id}/editar`} className="text-xs">
                      {receipt.number || 'Recibo'}
                    </Link>
                  )}
                  <Button isIconOnly size="sm" variant="ghost" aria-label="Borrar este pago" onPress={() => setDeleting(p)}>
                    <TrashBin className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todavía no hay pagos.</p>
        )}
      </Block>
      {paying && <PaymentForm doc={doc} onClose={() => { setPaying(false); change(() => {}); }} />}
      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `¿Borrar el pago de ${money(deleting.amount, cur)}?` : ''}
        text={delReceipt ? 'Su recibo también se borra.' : undefined}
        confirm="Borrar"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const p = deleting;
          if (p.receiptId && find('docs', p.receiptId)) remove('docs', p.receiptId);
          change(() => { doc.payments = doc.payments.filter((x) => x.id !== p.id); });
          toast('Pago borrado');
        }}
      />
    </div>
  );
}

