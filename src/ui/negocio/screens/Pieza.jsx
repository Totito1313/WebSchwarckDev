// Una publicación de Marketing en su propia página (antes era un panel lateral):
// arriba la marca y el título grande, sus etapas como pasos que se tocan; a la
// izquierda la planificación, el guion, los copys (Instagram y Facebook) y los
// resultados; a la derecha, fija al deslizar, la vista previa como en el teléfono.
// Las reglas son las de negocio-contenido.js, las mismas del panel de siempre.
import { useState } from 'react';
import { ArrowLeft, Bookmark, ChevronDown, Comment, Copy, Heart, PaperPlane, TrashBin } from '@gravity-ui/icons';
import { Button, ButtonGroup, Chip, Dropdown, Input, Label, Link, Tabs, TextArea, TextField, TimeField, toast } from '@heroui/react';
import { parseTime } from '@internationalized/date';
import { addDays, find, put, remove } from '../../../negocio-core.js';
import {
  FORMATS,
  METRICS,
  POST_CATEGORIES,
  POST_STATUS,
  ROLES,
  STATUS_ORDER,
  TEMPLATES,
  brandColor,
  brands,
  campaigns,
  engagement,
  igText,
  leadsOf,
  pctText,
  pillarsOf,
  template,
  toFacebook,
} from '../../../negocio-contenido.js';
import { Empty } from '../../kit/parts.jsx';
import { copyText } from '../../kit/csv.js';
import { NumberStepper, Stepper, Widget } from '../../pro/index.js';
import { go, useCrm } from '../store.js';
import { ConfirmButton, DateInput, SelectField } from '../fields.jsx';

const toTime = (t) => {
  try {
    return t ? parseTime(t) : null;
  } catch {
    return null;
  }
};
// Proporción de la imagen según el formato, como se ve en el feed de Instagram
// (los reels y las historias se recortan a 4:5 y 3:4 para que quepa en pantalla).
const RATIO = { reel: '4 / 5', historia: '3 / 4', carrusel: '4 / 5', imagen: '1 / 1', video: '16 / 9' };

async function copy(text, what) {
  if (!String(text || '').trim()) return toast.warning(`No hay ${what.toLowerCase()} que copiar.`);
  if (await copyText(text)) toast.success(`${what} copiado`);
  else toast.danger('No se pudo copiar');
  return undefined;
}

/** Cómo se verá en el teléfono: cabecera de la marca, la pieza, acciones y el copy. */
function PhonePreview({ p, b }) {
  const [open, setOpen] = useState(false);
  const color = brandColor(b);
  const handle = (b?.handle || b?.name || 'marca').replace(/^@/, '');
  const text = igText(p);
  const when = p.date ? new Date(`${p.date}T${p.time || '12:00'}:00`) : null;
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2.25rem] bg-[#0b0b0c] p-2.5 shadow-[var(--overlay-shadow)]">
      <div className="overflow-hidden rounded-[1.75rem] bg-white text-[13px] text-[#0b0b0c]">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex size-8 items-center justify-center rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${color}, #f97316)` }}>
            <span className="flex size-full items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white" style={{ background: color }}>
              {handle.slice(0, 1).toUpperCase()}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{handle}</b>
            <span className="block truncate text-[11px] text-[#6e6e73]">{FORMATS[p.format]?.[0] || 'Publicación'}</span>
          </span>
        </div>
        <div className="relative flex items-center justify-center p-5 text-center" style={{ aspectRatio: RATIO[p.format] || '1 / 1', background: `linear-gradient(160deg, ${color}22, ${color}66)` }}>
          <div className="flex max-w-[85%] flex-col items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0b0b0c]/60">{p.category || 'Pieza'}</span>
            <span className="text-lg font-bold leading-tight">{p.production?.headline || p.title || 'Título de la pieza'}</span>
            {p.visualScript && <span className="line-clamp-3 text-[11px] text-[#0b0b0c]/70">{p.visualScript}</span>}
          </div>
          {p.format === 'carrusel' && (
            <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`size-1.5 rounded-full ${i ? 'bg-white/60' : 'bg-white'}`} />
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3.5 px-3 pt-2.5 pb-1">
          <Heart className="size-5" />
          <Comment className="size-5" />
          <PaperPlane className="size-5" />
          <span className="flex-1" />
          <Bookmark className="size-5" />
        </div>
        {Number(p.metrics?.likes) > 0 && <p className="px-3 text-[12px] font-semibold">{Number(p.metrics.likes).toLocaleString('es')} Me gusta</p>}
        <div className="px-3 pt-1 pb-3">
          <p className={`whitespace-pre-line ${open ? '' : 'line-clamp-3'}`}>
            <b>{handle} </b>
            {text || <span className="text-[#6e6e73]">El copy aparecerá aquí.</span>}
          </p>
          {text && text.length > 120 && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-[12px] text-[#6e6e73]">
              {open ? 'menos' : '… más'}
            </button>
          )}
          {when && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[#6e6e73]">
              {when.toLocaleDateString('es', { day: 'numeric', month: 'long' })}
              {p.time ? ` · ${p.time}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Pieza({ id, backTo = '#/marketing' }) {
  const [, v] = useCrm();
  // Sube cuando una plantilla o «Desde Instagram» reescribe un copy: el campo se vuelve a pintar con él.
  const [rev, setRev] = useState(0);
  const [copyTab, setCopyTab] = useState('ig');
  const p = find('posts', id);
  if (!p) return <Empty title="Esa publicación ya no existe" action={<Button onPress={() => go(backTo)}>Ver Marketing</Button>} />;
  const b = p.brandId && find('brands', p.brandId);
  const save = (patch) => {
    Object.assign(p, patch);
    put('posts', p);
  };
  const leads = leadsOf(p);
  const eng = engagement(p);
  const bump = () => setRev((r) => r + 1);
  const at = Math.max(0, STATUS_ORDER.indexOf(p.status));

  return (
    <div className="flex flex-col gap-6" data-v={v}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <Link href={backTo} className="flex items-center gap-1 text-muted">
            <ArrowLeft className="size-4" />
            Marketing
          </Link>
          <span aria-hidden>/</span>
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="size-2 rounded-full" style={{ background: brandColor(b) }} aria-hidden />
            {b?.name || 'Sin marca'}
          </span>
        </nav>
        <ButtonGroup size="sm" variant="secondary">
          <Button onPress={() => copy(igText(p), 'Copy de Instagram')}>
            <Copy />
            Copiar el copy
          </Button>
          <Button
            onPress={() => {
              const dup = { ...structuredClone(p), id: crypto.randomUUID(), date: p.date ? addDays(p.date, 7) : p.date, status: 'idea', metrics: {}, url: '' };
              put('posts', dup);
              toast.success('Duplicada una semana después');
              go(`#/marketing/pieza/${dup.id}`);
            }}
          >
            <ButtonGroup.Separator />
            Duplicar
          </Button>
        </ButtonGroup>
      </div>

      <TextField aria-label="Título" defaultValue={p.title} onChange={(x) => save({ title: x })} maxLength={160} autoFocus={!p.title} key={p.id}>
        <Input placeholder="De qué va la publicación" className="h-auto border-0 bg-transparent px-0 py-1 text-3xl font-semibold tracking-tight shadow-none focus:ring-0 sm:text-4xl" />
      </TextField>

      <Widget title="Etapa" action={<span>{POST_STATUS[p.status]?.[0]}</span>}>
        <Stepper
          orientation="horizontal"
          numbered={false}
          label="Etapa de la publicación"
          current={p.status === STATUS_ORDER[STATUS_ORDER.length - 1] ? STATUS_ORDER.length : at}
          steps={STATUS_ORDER.map((k) => ({ id: k, title: POST_STATUS[k][0] }))}
          onChange={(i) => {
            const s = STATUS_ORDER[i];
            if (s === p.status) return;
            save({ status: s });
            toast(`${p.title || 'La pieza'} → ${POST_STATUS[s][0]}`);
          }}
        />
      </Widget>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Widget title="Planificación">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Marca" value={p.brandId} onChange={(x) => save({ brandId: x })} options={brands().map((x) => [x.id, x.name])} />
              <SelectField label="Campaña" value={p.campaignId || '_none'} onChange={(x) => save({ campaignId: x === '_none' ? '' : x })} options={[['_none', 'Sin campaña'], ...campaigns().map((c) => [c.id, c.name])]} />
              <DateInput label="Fecha" value={p.date} onChange={(d) => save({ date: d })} />
              <TimeField value={toTime(p.time)} onChange={(t) => save({ time: t ? t.toString().slice(0, 5) : '' })}>
                <Label>Hora</Label>
                <TimeField.Group>
                  <TimeField.Input>{(seg) => <TimeField.Segment segment={seg} />}</TimeField.Input>
                </TimeField.Group>
              </TimeField>
              <SelectField label="Formato" value={p.format} onChange={(x) => save({ format: x })} options={Object.entries(FORMATS).map(([k, [l]]) => [k, l])} />
              <SelectField label="Rol en el embudo" value={p.role} onChange={(x) => save({ role: x })} options={Object.entries(ROLES).map(([k, r]) => [k, `${r[0]} · ${r[1]}`, r[3]])} />
              <SelectField label="Categoría" value={p.category} onChange={(x) => save({ category: x })} options={POST_CATEGORIES.map((c) => [c, c])} />
              {pillarsOf(b).length > 0 && (
                <SelectField label="Pilar" value={p.pillar || '_none'} onChange={(x) => save({ pillar: x === '_none' ? '' : x })} options={[['_none', 'Sin pilar'], ...pillarsOf(b).map((x) => [x, x])]} />
              )}
            </div>
            <TextField defaultValue={p.visualScript} onChange={(x) => save({ visualScript: x })} maxLength={4000} className="mt-4">
              <Label>Guion visual</Label>
              <TextArea rows={4} placeholder="0–3 s: gancho…" />
            </TextField>
          </Widget>

          <Widget
            title="Copy"
            action={
              <Tabs selectedKey={copyTab} onSelectionChange={(k) => setCopyTab(String(k))}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Red">
                    <Tabs.Tab id="ig">
                      Instagram
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="fb">
                      Facebook
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            }
          >
            {copyTab === 'ig' ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <ButtonGroup size="sm" variant="tertiary">
                    <Dropdown>
                      {/* Dentro de un Dropdown el botón no hereda el estilo del grupo: va explícito. */}
                      <Button size="sm" variant="tertiary">
                        Plantilla
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu
                          aria-label="Plantillas de copy"
                          onAction={(k) => {
                            save({ copyIg: template(String(k), p, b) });
                            bump();
                          }}
                        >
                          {Object.entries(TEMPLATES).map(([k, [label, note]]) => (
                            <Dropdown.Item key={k} id={k} textValue={label}>
                              <Label>{label}</Label>
                              <span className="text-xs text-muted">{note}</span>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                    <Button onPress={() => copy(igText(p), 'Copy de Instagram')}>
                      <ButtonGroup.Separator />
                      <Copy />
                      Copiar
                    </Button>
                  </ButtonGroup>
                </div>
                <TextField aria-label="Copy de Instagram" key={`ig-${rev}`} defaultValue={p.copyIg} onChange={(x) => save({ copyIg: x })} maxLength={2200}>
                  <TextArea rows={8} placeholder="El texto de la publicación…" />
                </TextField>
                <p className="-mt-1 text-end text-xs text-muted tabular-nums">{(p.copyIg || '').length} / 2.200</p>
                <TextField defaultValue={p.hashtags} onChange={(x) => save({ hashtags: x })} maxLength={600}>
                  <Label>Hashtags</Label>
                  <Input placeholder="#marca #tema" />
                </TextField>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <ButtonGroup size="sm" variant="tertiary">
                    <Button
                      onPress={() => {
                        save({ copyFb: toFacebook(igText(p), b) });
                        bump();
                      }}
                    >
                      Desde Instagram
                    </Button>
                    <Button onPress={() => copy(p.copyFb, 'Copy de Facebook')}>
                      <ButtonGroup.Separator />
                      <Copy />
                      Copiar
                    </Button>
                  </ButtonGroup>
                </div>
                <TextField aria-label="Copy de Facebook" key={`fb-${rev}`} defaultValue={p.copyFb} onChange={(x) => save({ copyFb: x })} maxLength={4000}>
                  <TextArea rows={8} placeholder="El texto para Facebook…" />
                </TextField>
              </div>
            )}
          </Widget>

          <Widget title="Resultados" action={<span>Interacción: {pctText(eng)}</span>}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              {METRICS.map(([k, label]) => (
                <NumberStepper
                  key={k}
                  label={label}
                  size="sm"
                  min={0}
                  value={Number(p.metrics?.[k]) || 0}
                  onChange={(n) => save({ metrics: { ...(p.metrics || {}), [k]: Math.round(n) } })}
                />
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField defaultValue={p.url} onChange={(x) => save({ url: x })} maxLength={500}>
                <Label>Enlace a la publicación</Label>
                <Input placeholder="https://instagram.com/p/…" />
              </TextField>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Leads que trajo</span>
                <div className="flex min-h-10 flex-wrap items-center gap-1.5">
                  {leads.length ? (
                    leads.map((l) => (
                      <a key={l.id} href={`#/leads/${l.id}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus">
                        <Chip size="sm" variant="soft" color="accent">
                          {l.name || l.company}
                        </Chip>
                      </a>
                    ))
                  ) : (
                    <span className="text-sm text-muted">Ninguno todavía.</span>
                  )}
                </div>
              </div>
            </div>
          </Widget>

          <TextField defaultValue={p.notes} onChange={(x) => save({ notes: x })} maxLength={2000}>
            <Label>Notas</Label>
            <TextArea rows={3} />
          </TextField>

          <div>
            <ConfirmButton
              title={`¿Eliminar «${p.title || 'la publicación'}»?`}
              onConfirm={() => {
                remove('posts', p.id);
                go(backTo);
              }}
            >
              <TrashBin />
              Eliminar la publicación
            </ConfirmButton>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
          <span className="sw-eyebrow text-center">Vista previa</span>
          <PhonePreview p={p} b={b} />
          <div className="flex flex-wrap justify-center gap-1.5">
            {ROLES[p.role] && (
              <Chip size="sm" variant="soft">
                {ROLES[p.role][0]}
              </Chip>
            )}
            <Chip size="sm" variant="tertiary">
              {FORMATS[p.format]?.[0] || p.format}
            </Chip>
          </div>
        </aside>
      </div>
    </div>
  );
}
