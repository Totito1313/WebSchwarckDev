// Recursos (con facturas y documentos), Peticiones y Perfil del portal nuevo.
import { useMemo, useState } from 'react';
import { ArrowRightFromSquare, ArrowUpRightFromSquare, Folder, Tray } from '@gravity-ui/icons';
import { Button, Card, Chip, Description, Label, Link, SearchField, Separator, Tabs, Tag, TagGroup, toast } from '@heroui/react';
import { Empty, Panel, Person } from '../../kit/parts.jsx';
import { ThemeSwitch } from '../../kit/ThemeSwitch.jsx';
import { ago, dueText, hostOf, money, safeUrl, shortDate } from '../../../portal/kit.js';
import { DOC_TYPE, EXPECTS, PRIORITY, RESOURCE_KIND, app, can, docState, has, isOwner, urlOf } from '../../../portal/state.js';
import { ROLES } from '../../../portal/brand.js';
import { go, save, usePortal } from '../store.js';
import { Bubble, Tone } from '../ui.jsx';

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
        <Panel title="Facturas y documentos" description={owed ? `Falta por pagar ${money(owed)}` : 'Todo al día'}>
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
        </Panel>
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
              <Tag id="todas">Todas</Tag>
              {cats.map((c) => (
                <Tag key={c} id={c}>
                  {c}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon={Folder} title={all.length ? 'Nada coincide' : 'Todavía no hay recursos'} text={all.length ? 'Prueba con otra palabra o categoría.' : 'Lo que el estudio te deje aquí aparecerá en esta lista.'} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((r) => {
            const [kind, ico, color] = RESOURCE_KIND[r.kind] || RESOURCE_KIND.file;
            const url = urlOf(r.url || r.path);
            return (
              <Card key={r.id} className="gap-2 p-4">
                <div className="flex items-start gap-3">
                  <Bubble name={ico} color={color} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-muted">
                      {kind}
                      {r.category ? ` · ${r.category}` : ''} · {ago(r.created_at)}
                    </span>
                  </div>
                </div>
                {r.description && <p className="text-sm text-muted">{r.description}</p>}
                {url && (
                  <Link href={url} target="_blank" rel="noopener noreferrer" className="text-sm">
                    Abrir {hostOf(url) ? `en ${hostOf(url)}` : ''}
                    <ArrowUpRightFromSquare className="size-3.5" />
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Peticiones({ tab }) {
  const [, v] = usePortal();
  const [busy, setBusy] = useState('');
  const current = ['pendientes', 'enviadas', 'hechas'].includes(tab) ? tab : 'pendientes';
  const status = { pendientes: 'pending', enviadas: 'submitted', hechas: 'done' }[current];
  const all = app.data.tasks || [];
  const list = all.filter((t) => t.status === status);
  const count = (s) => all.filter((t) => t.status === s).length;

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

  return (
    <div className="flex flex-col gap-5" data-v={v}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Peticiones</h1>
        <p className="text-sm text-muted">Lo que el estudio necesita de ti para avanzar.</p>
      </header>
      <Tabs selectedKey={current} onSelectionChange={(k) => go(`#/peticiones/${k}`)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Peticiones">
            {[
              ['pendientes', 'Por hacer', 'pending'],
              ['enviadas', 'Enviadas', 'submitted'],
              ['hechas', 'Revisadas', 'done'],
            ].map(([k, label, s]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <span className="ms-1 text-xs text-muted">{count(s)}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {list.length === 0 ? (
        <Empty icon={Tray} title={current === 'pendientes' ? 'Nada pendiente' : 'Nada por aquí'} text={current === 'pendientes' ? 'Cuando necesitemos algo de ti, aparecerá aquí con su fecha.' : undefined} />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((t) => {
            const [when, late] = t.due_date ? dueText(t.due_date) : ['Sin fecha', ''];
            return (
              <Card key={t.id} className="gap-3 p-4">
                <div className="flex items-start gap-3">
                  <Bubble name={EXPECTS[t.expects]?.[1] || 'inbox'} color={PRIORITY[t.priority]?.[1]} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{t.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="soft" color={late === 'is-late' ? 'danger' : late === 'is-soon' ? 'warning' : 'default'}>
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
          })}
        </div>
      )}
    </div>
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

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex-row items-center gap-4 p-5">
        <Person name={m.name || app.user?.email} src={urlOf(m.avatar_path) || undefined} size="lg" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-semibold">{m.name || 'Sin nombre'}</span>
          <span className="truncate text-sm text-muted">{[m.position, app.user?.email].filter(Boolean).join(' · ')}</span>
          {!app.studio && m.role && (
            <Chip size="sm" variant="soft" color="accent" className="mt-1 w-fit">
              {ROLES[m.role]?.[0] || m.role}
            </Chip>
          )}
        </div>
      </Card>

      <Panel title={c.name || 'Tu negocio'} description={isOwner() ? 'Eres quien edita estos datos.' : undefined}>
        {business.length ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {business.map(([label, x]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="break-words text-sm">{x}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">Sin datos todavía.</p>
        )}
        {c.description && <p className="mt-3 text-sm">{c.description}</p>}
      </Panel>

      <Panel title="Apariencia">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <Label>Tema</Label>
            <Description>Claro, oscuro o el de tu teléfono.</Description>
          </div>
          <ThemeSwitch />
        </div>
      </Panel>

      <Separator />
      <div className="flex flex-wrap gap-2">
        <Button variant="danger-soft" onPress={onSignOut}>
          <ArrowRightFromSquare />
          Salir
        </Button>
        <Button variant="tertiary" onPress={() => (location.href = `/cliente/${location.search}`)}>
          Versión de siempre
        </Button>
      </div>
    </div>
  );
}
