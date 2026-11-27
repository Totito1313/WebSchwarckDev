// Recursos (con facturas y documentos), Peticiones (con filtros por tipo, plazo y
// prioridad) y Perfil y ajustes del portal nuevo.
import { useMemo, useState } from 'react';
import { ArrowRightFromSquare, ArrowUpRightFromSquare, Briefcase, ChevronRight, Folder, Palette, Persons, Sliders, Smartphone, Tray } from '@gravity-ui/icons';
import { Button, Card, Chip, Description, Disclosure, Label, Link, SearchField, Separator, Slider, Tabs, Tag, TagGroup, toast } from '@heroui/react';
import { Empty, Panel, Person } from '../../kit/parts.jsx';
import { KpiGroup, Widget } from '../../pro/index.js';
import { ThemeSwitch } from '../../kit/ThemeSwitch.jsx';
import { isIOS, useInstall } from '../../kit/install.js';
import { ago, dueText, hostOf, money, safeUrl, shortDate } from '../../../portal/kit.js';
import { DOC_TYPE, EXPECTS, PRIORITY, RESOURCE_KIND, app, can, docState, has, isOwner, urlOf } from '../../../portal/state.js';
import { ROLES } from '../../../portal/brand.js';
import { go, openPortal, save, usePortal } from '../store.js';
import { Bubble, Ico, Tone } from '../ui.jsx';

const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Recursos() {
  const [, v] = usePortal();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(new Set(['todas']));
  const all = app.data.resources || [];
  const cats = useMemo(() => [...new Set(all.map((r) => r.category).filter(Boolean))], [all, v]);
  const chosen = [...cat][0] || 'todas';
  const list = all.filter((r) => (chosen === 'todas' || r.category === chosen) && (!q.trim() || plain(`${r.title} ${r.description} ${r.category}`).includes(plain(q.trim()))));
  const docs = has('documents') && can('docs.view') ? [...app.data.documents].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')) : [];
  const owed = docs.filter((d) => d.type === 'invoice' && ['open', 'partial', 'viewed'].includes(d.status)).reduce((s, d) => s + Math.max(0, (d.total || 0) - (d.paid || 0)), 0);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Recursos</h1>
        <p className="text-sm text-muted">Guías, manuales, fotos, vídeos, enlaces y tus documentos.</p>
      </header>

      {docs.length > 0 && (
        <Widget title="Facturas y documentos" description={owed ? `Falta por pagar ${money(owed)}` : 'Todo al día'} bodyClassName="p-2">
          <ul className="flex flex-col">
            {docs.map((d) => {
              const [word, ico, color] = DOC_TYPE[d.type] || DOC_TYPE.invoice;
              const [label, tone] = docState(d);
              const href = d.url && safeUrl(d.url);
              const row = (
                <>
                  <Bubble name={ico} color={color} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{d.title || `${word} ${d.number}`}</span>
                    <span className="truncate text-xs text-muted">
                      {word} {d.number} · {shortDate(d.issue_date)} · {money(d.total || 0)}
                    </span>
                  </span>
                  <Tone label={label} color={tone} />
                </>
              );
              return (
                <li key={d.id}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                      {row}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Widget>
      )}

      <div className="flex flex-col gap-3">
        <SearchField aria-label="Buscar recursos" value={q} onChange={setQ}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar un recurso…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {cats.length > 1 && (
          <TagGroup aria-label="Categoría" selectionMode="single" disallowEmptySelection selectedKeys={cat} onSelectionChange={setCat} size="sm">
            <TagGroup.List>
              <Tag id="todas">Todas · {all.length}</Tag>
              {cats.map((c) => (
                <Tag key={c} id={c}>
                  {c} · {all.filter((r) => r.category === c).length}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon={Folder} title={all.length ? 'Nada coincide' : 'Todavía no hay recursos'} text={all.length ? 'Prueba con otra palabra o categoría.' : 'Lo que el estudio te deje aquí aparecerá en esta lista.'} />
      ) : (
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          {list.map((r) => {
            const [kind, ico, color] = RESOURCE_KIND[r.kind] || RESOURCE_KIND.file;
            const url = urlOf(r.url || r.path);
            const isImage = r.kind === 'image' && url;
            const Wrap = url ? 'a' : 'div';
            return (
              <Wrap
                key={r.id}
                {...(url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)] outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
              >
                {/* Arriba, la cara del recurso: la imagen o su tipo, en su color. */}
                <div className="relative flex h-28 items-center justify-center overflow-hidden" style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
                  {isImage ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <Bubble name={ico} color={color} />}
                  <span className="absolute start-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium backdrop-blur">{kind}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-muted">
                    {r.category ? `${r.category} · ` : ''}
                    {ago(r.created_at)}
                  </span>
                  {r.description && <p className="line-clamp-2 text-sm text-muted">{r.description}</p>}
                  {url && (
                    <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-accent">
                      Abrir {hostOf(url) ? `en ${hostOf(url)}` : ''}
                      <ArrowUpRightFromSquare className="size-3.5" />
                    </span>
                  )}
                </div>
              </Wrap>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PRIO_LEVEL = { low: 0, normal: 1, high: 2 };
const PRIO_NAMES = ['Todas', 'Normal o más', 'Solo urgentes'];
const DUE = [
  ['todas', 'Cualquier fecha'],
  ['tarde', 'Atrasadas'],
  ['semana', 'Esta semana'],
  ['sinfecha', 'Sin fecha'],
];
/** En qué está cada petición, más fino que su estado guardado. */
function phaseOf(t) {
  if (t.status === 'done') return ['Revisada', 'success'];
  if (t.status === 'submitted') return ['En revisión', 'accent'];
  if (!t.due_date) return ['Por hacer', 'default'];
  const [, late] = dueText(t.due_date);
  return late === 'is-late' ? ['Atrasada', 'danger'] : late === 'is-soon' ? ['Vence pronto', 'warning'] : ['A tiempo', 'default'];
}

/** Los filtros: tipo, plazo y prioridad (a la derecha en pantallas anchas). */
function TaskFilters({ all, kinds, setKinds, due, setDue, prio, setPrio }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Qué piden</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EXPECTS).map(([k, [label, ico]]) => {
            const on = kinds.has(k);
            const n = all.filter((t) => (t.expects || 'any') === k).length;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setKinds((cur) => {
                    const next = new Set(cur);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-foreground text-background' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
              >
                <Ico name={ico} className="size-3.5" />
                {label}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Plazo</Label>
        <div className="flex flex-wrap gap-1.5">
          {DUE.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={due === k}
              onClick={() => setDue(k)}
              className={`rounded-full px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${due === k ? 'bg-foreground text-background' : 'bg-surface-secondary text-muted hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Slider value={prio} minValue={0} maxValue={2} step={1} onChange={(n) => setPrio(Number(n))}>
        <Label>Prioridad</Label>
        <Slider.Output>{({ state }) => PRIO_NAMES[state.values[0]]}</Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}

export function Peticiones({ tab }) {
  const [, v] = usePortal();
  const [busy, setBusy] = useState('');
  const [kinds, setKinds] = useState(() => new Set());
  const [due, setDue] = useState('todas');
  const [prio, setPrio] = useState(0);
  const current = ['pendientes', 'enviadas', 'hechas'].includes(tab) ? tab : 'pendientes';
  const status = { pendientes: 'pending', enviadas: 'submitted', hechas: 'done' }[current];
  const all = app.data.tasks || [];
  const today = new Date().toLocaleDateString('en-CA');
  const week = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('en-CA');
  const list = all
    .filter((t) => t.status === status)
    .filter((t) => !kinds.size || kinds.has(t.expects || 'any'))
    .filter((t) => (PRIO_LEVEL[t.priority] ?? 1) >= prio)
    .filter((t) => (due === 'tarde' ? t.due_date && t.due_date < today : due === 'semana' ? t.due_date && t.due_date >= today && t.due_date <= week : due === 'sinfecha' ? !t.due_date : true))
    .sort((a, b) => (PRIO_LEVEL[b.priority] ?? 1) - (PRIO_LEVEL[a.priority] ?? 1) || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const count = (st) => all.filter((t) => t.status === st).length;
  const filtered = kinds.size || due !== 'todas' || prio > 0;
  const late = all.filter((t) => t.status === 'pending' && t.due_date && t.due_date < today).length;

  const submit = async (t) => {
    setBusy(t.id);
    try {
      await save('tasks', { id: t.id, status: 'submitted' });
      toast.success('Marcada como enviada', { description: 'El estudio la revisa y te avisa.' });
    } catch (err) {
      toast.danger('No se guardó', { description: err.message });
    } finally {
      setBusy('');
    }
  };
  const filters = <TaskFilters all={all} kinds={kinds} setKinds={setKinds} due={due} setDue={setDue} prio={prio} setPrio={setPrio} />;

  return (
    <div className="flex flex-col gap-5" data-v={v}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Peticiones</h1>
        <p className="text-sm text-muted">Lo que el estudio necesita de ti para avanzar.</p>
      </header>
      <Widget title="En resumen">
        <KpiGroup
          items={[
            { label: 'Por hacer', value: String(count('pending')), sub: late ? `${late} atrasadas` : 'Nada atrasado', tone: late ? 'var(--danger)' : undefined },
            { label: 'En revisión', value: String(count('submitted')), sub: 'El estudio las está mirando' },
            { label: 'Revisadas', value: String(count('done')), sub: 'Listas' },
            { label: 'Urgentes', value: String(all.filter((t) => t.status === 'pending' && t.priority === 'high').length), sub: 'Por hacer y con prisa' },
          ]}
        />
      </Widget>
      <Tabs selectedKey={current} onSelectionChange={(k) => go(`#/peticiones/${k}`)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Peticiones">
            {[
              ['pendientes', 'Por hacer', 'pending'],
              ['enviadas', 'En revisión', 'submitted'],
              ['hechas', 'Revisadas', 'done'],
            ].map(([k, label, st]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <span className="ms-1 text-xs text-muted">{count(st)}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
        {/* En el teléfono, los filtros se despliegan arriba; en pantallas anchas, a la derecha. */}
        <Disclosure className="rounded-2xl bg-surface-secondary p-3 md:hidden">
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center gap-2 text-sm font-medium">
              <Sliders className="size-4" />
              Filtros{filtered ? ' (activos)' : ''}
              <span className="flex-1" />
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-4">{filters}</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
        <div className="flex min-w-0 flex-col gap-3">
          {list.length === 0 ? (
            <Empty
              icon={Tray}
              title={filtered ? 'Nada con esos filtros' : current === 'pendientes' ? 'Nada pendiente' : 'Nada por aquí'}
              text={filtered ? 'Quita algún filtro para ver más.' : current === 'pendientes' ? 'Cuando necesitemos algo de ti, aparecerá aquí con su fecha.' : undefined}
            />
          ) : (
            list.map((t) => {
              const [when, lateCls] = t.due_date ? dueText(t.due_date) : ['Sin fecha', ''];
              const [phase, tone] = phaseOf(t);
              return (
                <Card key={t.id} className="gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <Bubble name={EXPECTS[t.expects]?.[1] || 'inbox'} color={PRIORITY[t.priority]?.[1]} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* Por hacer y con fecha, la fecha ya lo dice; si no, su fase. */}
                        {(t.status !== 'pending' || !t.due_date) && (
                          <Chip size="sm" variant="soft" color={tone}>
                            {phase}
                          </Chip>
                        )}
                        <Chip size="sm" variant="soft" color={lateCls === 'is-late' ? 'danger' : lateCls === 'is-soon' ? 'warning' : 'default'}>
                          {when}
                        </Chip>
                        {t.priority === 'high' && (
                          <Chip size="sm" variant="soft" color="danger">
                            Urgente
                          </Chip>
                        )}
                        <Chip size="sm" variant="tertiary">
                          {EXPECTS[t.expects]?.[0] || 'Lo que tengas'}
                        </Chip>
                      </span>
                    </div>
                  </div>
                  {t.description && <p className="whitespace-pre-line text-sm text-muted">{t.description}</p>}
                  {t.client_note && <p className="rounded-2xl bg-surface-secondary px-3 py-2 text-sm">«{t.client_note}»</p>}
                  {t.status === 'pending' && can('tasks.submit') && (
                    <Button className="w-fit" isPending={busy === t.id} onPress={() => submit(t)}>
                      Ya lo envié
                    </Button>
                  )}
                </Card>
              );
            })
          )}
        </div>
        <aside className="sticky top-24 hidden flex-col gap-4 rounded-3xl bg-surface-secondary p-4 md:flex" aria-label="Filtros">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sliders className="size-4" />
            Filtros
          </span>
          {filters}
          {filtered && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setKinds(new Set());
                setDue('todas');
                setPrio(0);
              }}
            >
              Quitar filtros
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Una fila de ajustes: icono, texto y lo que va a la derecha. */
function Row({ icon: Icon, title, text, children, onPress }) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        {text && <span className="truncate text-xs text-muted">{text}</span>}
      </span>
      {children}
      {onPress && <ChevronRight className="size-4 text-muted" />}
    </>
  );
  return onPress ? (
    <button type="button" onClick={onPress} className="flex w-full items-center gap-3 px-4 py-3 text-start outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover">
      {inner}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
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
    <Row icon={Smartphone} title={installed || done ? 'Instalada' : 'Instálala en tu teléfono'} text={text}>
      {canInstall && (
        <Button size="sm" variant="secondary" onPress={() => install().then((ok) => ok && toast.success('Listo: ya la tienes en tu pantalla de inicio.'))}>
          Instalar
        </Button>
      )}
    </Row>
  );
}
function Group({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="sw-eyebrow px-1">{title}</h2>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)]">{children}</div>
    </section>
  );
}

export function Perfil({ onSignOut }) {
  usePortal();
  const m = app.member || {};
  const c = app.client || {};
  const business = [
    ['Sector', c.industry],
    ['Web', c.website],
    ['Instagram', c.instagram],
    ['Teléfono', c.phone],
    ['Dirección', c.address],
    ['Horario', c.hours],
  ].filter(([, x]) => x);
  const others = app.portals.filter((p) => p.client.id !== c.id);

  return (
    <div className="flex flex-col gap-6">
      {/* Tu tarjeta: foto, nombre, cargo, correo y tu papel en el proyecto. */}
      <Card className="relative overflow-hidden p-0">
        <div aria-hidden className="h-20" style={{ background: `linear-gradient(120deg, ${c.accent || 'var(--accent)'}, color-mix(in oklab, ${c.accent || 'var(--accent)'} 40%, transparent))` }} />
        <div className="-mt-10 flex flex-col items-start gap-2 px-5 pb-5">
          <span className="rounded-full ring-4 ring-[var(--surface)]">
            <Person name={m.name || app.user?.email} src={urlOf(m.avatar_path) || undefined} size="lg" />
          </span>
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

      <Group title="Tu negocio">
        {business.length ? (
          <dl className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            {business.map(([label, x]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="break-words text-sm">{x}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Row icon={Briefcase} title="Sin datos todavía" text={isOwner() ? 'Puedes completarlos en la versión de siempre.' : 'Los completa el estudio o quien edita tu negocio.'} />
        )}
        {c.description && <p className="px-4 py-3 text-sm">{c.description}</p>}
        {isOwner() && <Row icon={Briefcase} title="Editar los datos del negocio" text="Sector, web, redes, horario…" onPress={() => (location.href = `/cliente/${location.search}#/perfil`)} />}
      </Group>

      {others.length > 0 && (
        <Group title="Tus proyectos">
          {app.portals.map((p) => (
            <Row key={p.client.id} icon={Persons} title={p.client.name} text={p.client.id === c.id ? 'El que tienes abierto' : 'Cambiar a este'} onPress={p.client.id === c.id ? undefined : () => openPortal(p)} />
          ))}
        </Group>
      )}

      <Group title="Apariencia">
        <Row icon={Palette} title="Tema" text="Claro, oscuro o el de tu teléfono">
          <ThemeSwitch />
        </Row>
      </Group>

      <Group title="La app">
        <InstallRow />
        <Row icon={ArrowUpRightFromSquare} title="Versión de siempre" text="La app anterior, con todo lo que aún no está aquí" onPress={() => (location.href = `/cliente/${location.search}`)} />
      </Group>

      <Button variant="danger-soft" className="self-start" onPress={onSignOut}>
        <ArrowRightFromSquare />
        Salir
      </Button>
    </div>
  );
}
