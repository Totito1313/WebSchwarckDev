// Inicio: un tablero de widgets que se arma a gusto. «Personalizar» deja añadir
// widgets (cifras, gráficos, tareas, temporizador, embudo, accesos directos, notas…),
// quitarlos, cambiarlos de tamaño y ordenarlos arrastrando (o con las flechas). La
// disposición se guarda en los ajustes (settings.home) y es la misma en todos los
// equipos; en el teléfono todos ocupan el ancho. Los widgets viven en home/widgets.jsx.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Grip, Plus, Sliders, ArrowRotateLeft, Xmark } from '@gravity-ui/icons';
import { Button, Chip, Label, Modal, ScrollShadow, Tabs, ToggleButton, ToggleButtonGroup, Tooltip, toast } from '@heroui/react';
import { put, state as crm } from '../../../negocio-core.js';
import { PageHeader } from '../../kit/parts.jsx';
import { Widget } from '../../pro/index.js';
import { useCrm } from '../store.js';
import { activity, change, collected, dueLeads, greeting, last12Months, periodRange, receivable, spent } from '../domain.js';
import { DEFAULT_LAYOUT, DEFAULT_SHORTCUTS, SHORTCUTS, SIZE_CLASS, SIZE_NAME, WIDGETS, readLayout } from '../home/widgets.jsx';

const PERIODS = [
  ['30d', '30 días'],
  ['month', 'Este mes'],
  ['year', 'Este año'],
  ['all', 'Todo'],
];
const PREV = { '30d': 'vs. 30 días antes', month: 'vs. el mes pasado', year: 'vs. el año pasado' };
const SIZE_SHORT = { s: 'S', m: 'M', l: 'L', xl: 'XL' };

const homeOf = () => crm.settings.home || {};
const saveHome = (patch) => put('settings', { ...crm.settings, home: { ...homeOf(), ...patch } });

/** La galería: todos los widgets, con su icono y lo que cuentan. */
function Gallery({ isOpen, onClose, layout, onAdd }) {
  const used = new Set(layout.map((w) => w.id));
  return (
    <Modal isOpen={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[760px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Añadir un widget</Modal.Heading>
              <p className="text-sm text-muted">Elige qué quieres ver en Inicio. Luego lo cambias de tamaño o de sitio.</p>
            </Modal.Header>
            <Modal.Body className="px-1">
              <ScrollShadow className="max-h-[62vh]" hideScrollBar>
                <ul className="grid gap-2 p-1 sm:grid-cols-2">
                  {Object.entries(WIDGETS).map(([id, w]) => {
                    const on = used.has(id);
                    const Icon = w.icon;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          disabled={on}
                          onClick={() => onAdd(id)}
                          className="flex h-full w-full items-start gap-3 rounded-2xl bg-surface-secondary p-3 text-start outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-60 disabled:hover:bg-surface-secondary"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface">
                            <Icon className="size-5" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-2 font-medium">
                              {w.title}
                              {on && (
                                <Chip size="sm" variant="soft" color="success">
                                  <Check className="size-3" />
                                  <Chip.Label>Ya está</Chip.Label>
                                </Chip>
                              )}
                            </span>
                            <span className="text-xs text-muted">{w.description}</span>
                            <span className="mt-1 flex gap-1">
                              {w.sizes.map((s) => (
                                <span key={s} className="rounded-md bg-surface px-1.5 text-[10px] font-semibold text-muted">
                                  {SIZE_SHORT[s]}
                                </span>
                              ))}
                            </span>
                          </span>
                          {!on && <Plus className="size-4 shrink-0 text-muted" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollShadow>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Qué accesos salen en «Accesos directos». */
function ShortcutPicker({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
      <Label className="text-xs">Accesos que se ven (toca para quitar o poner)</Label>
      <div className="flex flex-wrap gap-1.5">
        {SHORTCUTS.map((s) => {
          const on = value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-foreground text-background' : 'bg-surface text-muted hover:text-foreground'}`}
            >
              <s.icon className="size-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Inicio() {
  const [state, v] = useCrm();
  const [period, setPeriod] = useState(() => localStorage.getItem('negocio-periodo') || 'year');
  const [editing, setEditing] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [draft, setDraft] = useState(null); // el orden mientras se arrastra

  const saved = readLayout(state.settings);
  const layout = draft || saved;
  const home = state.settings.home || {};

  const data = useMemo(() => {
    const r = periodRange(period);
    const inNow = collected(r);
    const outNow = spent(r);
    const inPrev = r.prev ? collected(r.prev) : null;
    const outPrev = r.prev ? spent(r.prev) : null;
    const profit = inNow.sum - outNow.sum;
    const profitPrev = inPrev && outPrev ? inPrev.sum - outPrev.sum : null;
    return {
      r,
      inNow,
      outNow,
      profit,
      profitDelta: profitPrev != null && profitPrev > 0 ? change(profit, profitPrev) : null,
      dIn: inPrev ? change(inNow.sum, inPrev.sum) : null,
      dOut: outPrev ? change(outNow.sum, outPrev.sum) : null,
      rec: receivable(),
      months: last12Months(),
      feed: activity(8),
      due: dueLeads(),
    };
  }, [period, v, state]);

  const pickPeriod = (key) => {
    setPeriod(key);
    localStorage.setItem('negocio-periodo', key);
  };
  const periodLabel = PERIODS.find(([k]) => k === period)?.[1];
  const setLayout = (next) => saveHome({ layout: next });
  const move = (i, step) => {
    const next = [...layout];
    const [w] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + step)), 0, w);
    setLayout(next);
  };
  const resize = (id, size) => setLayout(layout.map((w) => (w.id === id ? { ...w, size } : w)));
  const removeW = (id) => setLayout(layout.filter((w) => w.id !== id));
  const add = (id) => {
    setLayout([...layout, { id, size: WIDGETS[id].size }]);
    setGallery(false);
    toast.success(`«${WIDGETS[id].title}» añadido al final`);
    requestAnimationFrame(() => document.querySelector(`[data-widget="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  // Arrastrar: mientras se arrastra, el orden se ve en vivo; al soltar, se guarda.
  const onDragOver = (e, overId) => {
    if (!dragId || dragId === overId) return;
    e.preventDefault();
    const cur = draft || saved;
    const from = cur.findIndex((w) => w.id === dragId);
    const to = cur.findIndex((w) => w.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...cur];
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w);
    setDraft(next);
  };
  const endDrag = () => {
    if (draft) setLayout(draft);
    setDraft(null);
    setDragId(null);
  };

  const ctx = { state, data, periodLabel, prevText: PREV[period] };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={greeting()}
        description="Lo que entró, lo que salió, lo que falta por cobrar y lo que tienes entre manos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button size="sm" variant={editing ? 'primary' : 'secondary'} onPress={() => setEditing((x) => !x)}>
              {editing ? <Check /> : <Sliders />}
              {editing ? 'Listo' : 'Personalizar'}
            </Button>
          </div>
        }
      />

      {editing && (
        <div className="sw-glass sw-sticky-top z-20 flex flex-wrap items-center gap-2 rounded-full p-1.5 ps-4 shadow-[var(--overlay-shadow)]">
          <span className="text-sm text-muted">
            <span className="hidden sm:inline">Arrastra los widgets para ordenarlos; cambia su tamaño o quítalos desde su esquina.</span>
            <span className="sm:hidden">Ordena con las flechas.</span>
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              saveHome({ layout: DEFAULT_LAYOUT });
              toast('Inicio como venía');
            }}
          >
            <ArrowRotateLeft />
            Restablecer
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setGallery(true)}>
            <Plus />
            Añadir widget
          </Button>
          <Button size="sm" onPress={() => setEditing(false)}>
            <Check />
            Listo
          </Button>
        </div>
      )}

      <div className="grid grid-flow-row-dense grid-cols-12 gap-4">
        {layout.map((w, i) => {
          const def = WIDGETS[w.id];
          const Body = def.body;
          const cfg = { shortcuts: home.shortcuts, notes: home.notes };
          return (
            <div
              key={w.id}
              data-widget={w.id}
              draggable={editing}
              onDragStart={(e) => {
                setDragId(w.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', w.id);
              }}
              onDragOver={(e) => onDragOver(e, w.id)}
              onDrop={(e) => {
                e.preventDefault();
                endDrag();
              }}
              onDragEnd={endDrag}
              className={`relative min-w-0 ${SIZE_CLASS[w.size]} ${editing ? 'cursor-grab rounded-[1.9rem] outline-2 outline-offset-2 outline-dashed outline-border' : ''} ${dragId === w.id ? 'opacity-50' : ''}`}
            >
              <Widget
                title={def.title}
                action={editing ? null : def.action?.(ctx)}
                className="h-full"
                flush={def.flush}
                bodyClassName={def.flush ? 'p-2' : ''}
              >
                {/* En modo personalizar el contenido no responde: así se arrastra sin abrir nada. */}
                <div inert={editing} className={editing ? 'pointer-events-none select-none' : ''}>
                  <Body {...ctx} cfg={cfg} size={w.size} setCfg={(patch) => saveHome(patch)} />
                </div>
                {/* Los accesos se eligen aquí mismo mientras se personaliza. */}
                {w.id === 'shortcuts' && editing && (
                  <div className="mt-3" draggable={false} onDragStart={(e) => e.preventDefault()}>
                    <ShortcutPicker value={home.shortcuts?.length ? home.shortcuts : DEFAULT_SHORTCUTS} onChange={(list) => saveHome({ shortcuts: list })} />
                  </div>
                )}
              </Widget>
              {editing && (
                <div className="absolute end-2 top-2 z-10 flex items-center gap-1 rounded-full bg-overlay p-1 shadow-[var(--overlay-shadow)]">
                  <Grip className="mx-1 hidden size-4 text-muted md:block" aria-hidden />
                  <Tooltip delay={300}>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Mover «${def.title}» antes`} isDisabled={i === 0} onPress={() => move(i, -1)}>
                      <ArrowLeft />
                    </Button>
                    <Tooltip.Content>Antes</Tooltip.Content>
                  </Tooltip>
                  <Tooltip delay={300}>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Mover «${def.title}» después`} isDisabled={i === layout.length - 1} onPress={() => move(i, 1)}>
                      <ArrowRight />
                    </Button>
                    <Tooltip.Content>Después</Tooltip.Content>
                  </Tooltip>
                  {def.sizes.length > 1 && (
                    <ToggleButtonGroup
                      aria-label={`Tamaño de «${def.title}»`}
                      selectionMode="single"
                      disallowEmptySelection
                      size="sm"
                      selectedKeys={new Set([w.size])}
                      onSelectionChange={(k) => resize(w.id, String([...k][0]))}
                      className="hidden sm:flex"
                    >
                      {def.sizes.map((s, k) => (
                        <ToggleButton key={s} id={s} aria-label={SIZE_NAME[s]} className="min-w-8 px-2 text-xs font-semibold">
                          {k > 0 && <ToggleButtonGroup.Separator />}
                          {SIZE_SHORT[s]}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  )}
                  <Tooltip delay={300}>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Quitar «${def.title}»`} onPress={() => removeW(w.id)}>
                      <Xmark />
                    </Button>
                    <Tooltip.Content>Quitar</Tooltip.Content>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}
        {editing && (
          <button
            type="button"
            onClick={() => setGallery(true)}
            className="col-span-12 flex min-h-40 flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-border text-muted outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus md:col-span-6 xl:col-span-4"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Añadir widget</span>
          </button>
        )}
      </div>

      {!editing && layout.length === 0 && (
        <button type="button" onClick={() => setEditing(true)} className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted">
          Inicio está vacío. Toca para añadir widgets.
        </button>
      )}

      <Gallery isOpen={gallery} onClose={() => setGallery(false)} layout={layout} onAdd={add} />
    </div>
  );
}
