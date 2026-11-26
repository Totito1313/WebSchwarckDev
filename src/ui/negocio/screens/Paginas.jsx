// Páginas: notas, guías, briefs y actas, como en Notion. El árbol a la izquierda
// (favoritas primero) y la página con su icono, su cliente y proyecto y sus
// bloques: texto, títulos, listas, pendientes, citas, destacados, código y
// separadores. Las imágenes y enlaces que ya tengan se enseñan tal cual.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, SquareArticle, Star, StarFill, TrashBin } from '@gravity-ui/icons';
import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Label,
  Popover,
  ScrollShadow,
  SearchField,
  Separator,
  TextArea,
  TextField,
  Description,
  toast,
} from '@heroui/react';
import { find, put, remove, uid } from '../../../negocio-core.js';
import { PAGE_TEMPLATES, createPage } from '../../../negocio-paginas.js';
import { Empty, PageHeader } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { ConfirmButton, SelectField } from '../fields.jsx';

const KINDS = {
  p: 'Texto',
  h1: 'Título',
  h2: 'Subtítulo',
  h3: 'Encabezado',
  bullet: 'Lista',
  number: 'Lista numerada',
  todo: 'Pendiente',
  quote: 'Cita',
  callout: 'Destacado',
  code: 'Código',
  divider: 'Separador',
};
const TEXTUAL = new Set(['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code']);
const EMOJIS = ['📄', '📝', '📌', '📚', '🗂️', '💡', '🚀', '🎯', '✅', '📅', '📊', '💰', '🧾', '🤝', '👥', '🎨', '📱', '💻', '⚙️', '🧪', '📣', '✨', '🔥', '⭐', '🏁', '📦', '🧭', '🔒', '🧠', '🎬', '📸', '☕'];
const STYLE = {
  h1: 'text-2xl font-semibold',
  h2: 'text-xl font-semibold',
  h3: 'text-lg font-semibold',
  quote: 'border-s-4 border-border ps-3 italic',
  callout: 'rounded-2xl bg-surface-secondary p-3',
  code: 'rounded-2xl bg-surface-secondary p-3 font-mono text-sm',
};
const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const titleOf = (p) => p?.title?.trim() || 'Sin título';

/** Crea una página (en blanco o de una plantilla) y la abre. */
export function newPageAndOpen(template = 'blank', extra = {}) {
  const page = createPage({ template, open: false, ...extra });
  go(`#/paginas/${page.id}`);
  return page;
}

function NewPageButton({ parentId = '' }) {
  return (
    <ButtonGroup size="sm">
      <Button onPress={() => newPageAndOpen('blank', { parentId })}>
        <Plus />
        Nueva página
      </Button>
      <Dropdown>
        <Button isIconOnly aria-label="Desde una plantilla">
          <ButtonGroup.Separator />
          <ChevronDown />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-64">
          <Dropdown.Menu aria-label="Plantillas" onAction={(k) => newPageAndOpen(String(k), { parentId })}>
            {Object.entries(PAGE_TEMPLATES).map(([k, [label, emoji, note]]) => (
              <Dropdown.Item key={k} id={k} textValue={label}>
                <span aria-hidden>{emoji}</span>
                <div className="flex flex-col">
                  <Label>{label}</Label>
                  <Description>{note}</Description>
                </div>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </ButtonGroup>
  );
}

function Tree({ pages, current, query }) {
  const q = plain(query.trim());
  const children = (pid) => pages.filter((p) => (p.parentId || '') === pid && !(pid === '' && p.parentId && !find('pages', p.parentId))).sort((a, b) => (a.order || 0) - (b.order || 0));
  const orphans = pages.filter((p) => p.parentId && !find('pages', p.parentId));
  const row = (p, depth) => (
    <li key={p.id}>
      <a
        href={`#/paginas/${p.id}`}
        aria-current={p.id === current ? 'page' : undefined}
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
        className={`flex items-center gap-2 rounded-xl py-1.5 pe-2 text-sm ${p.id === current ? 'bg-default font-medium' : 'text-muted hover:bg-default hover:text-foreground'}`}
      >
        <span aria-hidden>{p.icon || '📄'}</span>
        <span className="truncate">{titleOf(p)}</span>
      </a>
      {!q && <ul>{children(p.id).map((c) => row(c, depth + 1))}</ul>}
    </li>
  );
  if (q) return <ul className="flex flex-col">{pages.filter((p) => plain(`${p.title} ${(p.blocks || []).map((b) => b.text).join(' ')}`).includes(q)).map((p) => row(p, 0))}</ul>;
  const favs = pages.filter((p) => p.favorite);
  return (
    <div className="flex flex-col gap-3">
      {favs.length > 0 && (
        <div>
          <p className="sw-eyebrow px-2 pb-1">Favoritas</p>
          <ul>{favs.map((p) => row(p, 0))}</ul>
        </div>
      )}
      <div>
        <p className="sw-eyebrow px-2 pb-1">Todas</p>
        <ul>{[...children(''), ...orphans].map((p) => row(p, 0))}</ul>
      </div>
    </div>
  );
}

function Block({ page, b, i, onChange }) {
  const blocks = page.blocks;
  const move = (dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    onChange();
  };
  const setKind = (kind) => {
    b.kind = kind;
    onChange();
  };
  const number = b.kind === 'number' ? blocks.slice(0, i + 1).reverse().findIndex((x) => x.kind !== 'number') : 0;
  const n = b.kind === 'number' ? (number === -1 ? i + 1 : number) : 0;

  return (
    <div className="group flex items-start gap-2">
      <Dropdown>
        <Button isIconOnly size="sm" variant="ghost" aria-label="Tipo de bloque" className="mt-1 opacity-60 group-hover:opacity-100">
          <ChevronDown />
        </Button>
        <Dropdown.Popover placement="bottom start">
          <Dropdown.Menu
            aria-label="Tipo de bloque"
            onAction={(k) => {
              if (k === 'up') return move(-1);
              if (k === 'down') return move(1);
              if (k === 'delete') {
                page.blocks = blocks.filter((x) => x !== b);
                if (!page.blocks.length) page.blocks = [{ id: uid(), kind: 'p', text: '', checked: false }];
                return onChange();
              }
              return setKind(String(k));
            }}
          >
            {Object.entries(KINDS).map(([k, label]) => (
              <Dropdown.Item key={k} id={k} textValue={label}>
                <Label>{label}</Label>
                {k === b.kind && <Dropdown.ItemIndicator />}
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="up" textValue="Subir">
              <ArrowUp className="size-4" />
              <Label>Subir</Label>
            </Dropdown.Item>
            <Dropdown.Item id="down" textValue="Bajar">
              <ArrowDown className="size-4" />
              <Label>Bajar</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Quitar" variant="danger">
              <TrashBin className="size-4" />
              <Label>Quitar el bloque</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <div className="min-w-0 flex-1">
        {b.kind === 'divider' ? (
          <Separator className="my-4" />
        ) : b.kind === 'image' ? (
          <figure className="flex flex-col gap-1">
            {b.url && <img src={b.url} alt={b.text || ''} className="max-h-96 rounded-2xl object-contain" />}
            {b.text && <figcaption className="text-xs text-muted">{b.text}</figcaption>}
          </figure>
        ) : TEXTUAL.has(b.kind) ? (
          <div className={`flex items-start gap-2 ${STYLE[b.kind] || ''}`}>
            {b.kind === 'bullet' && <span className="mt-2 select-none text-muted">•</span>}
            {b.kind === 'number' && <span className="mt-2 select-none text-muted tabular-nums">{n}.</span>}
            {b.kind === 'todo' && (
              <Checkbox
                className="mt-2"
                aria-label="Hecho"
                isSelected={Boolean(b.checked)}
                onChange={(on) => {
                  b.checked = on;
                  onChange();
                }}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
            )}
            {b.kind === 'callout' && <span className="mt-1.5">{b.emoji || '💡'}</span>}
            <TextField
              aria-label={KINDS[b.kind]}
              defaultValue={b.text}
              onChange={(t) => {
                b.text = t;
                onChange(false);
              }}
              className="flex-1"
            >
              <TextArea
                rows={1}
                placeholder={KINDS[b.kind]}
                className={`resize-none border-none bg-transparent px-1 shadow-none [field-sizing:content] ${b.kind === 'todo' && b.checked ? 'text-muted line-through' : ''} ${STYLE[b.kind]?.includes('text-') ? '' : ''}`}
                style={{ fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit' }}
              />
            </TextField>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-secondary px-3 py-2 text-sm text-muted">Bloque de enlace o subpágina: edítalo en la versión de siempre.</p>
        )}
      </div>
    </div>
  );
}

function Editor({ page }) {
  const [state, v] = useCrm();
  const [, setTick] = useState(0);
  const save = (redraw = true) => {
    put('pages', page);
    if (redraw) setTick((n) => n + 1);
  };
  const subpages = state.pages.filter((p) => p.parentId === page.id);

  return (
    <div className="flex min-w-0 flex-col gap-4" data-v={v}>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <Button variant="ghost" className="text-3xl" aria-label="Cambiar icono">
            {page.icon || '📄'}
          </Button>
          <Popover.Content placement="bottom start" className="w-72">
            <Popover.Dialog>
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <Button
                    key={e}
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    slot="close"
                    aria-label={e}
                    onPress={() => {
                      page.icon = e;
                      save();
                    }}
                  >
                    {e}
                  </Button>
                ))}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          aria-label={page.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}
          onPress={() => {
            page.favorite = !page.favorite;
            save();
          }}
        >
          {page.favorite ? <StarFill className="text-warning" /> : <Star />}
          {page.favorite ? 'Favorita' : 'Favorita'}
        </Button>
        <NewPageButton parentId={page.id} />
        <ConfirmButton
          title={`¿Eliminar «${titleOf(page)}»?`}
          text={subpages.length ? `Se borran también sus ${subpages.length} subpáginas.` : 'No se puede deshacer.'}
          onConfirm={() => {
            const family = [page];
            for (let k = 0; k < family.length; k += 1) family.push(...state.pages.filter((p) => p.parentId === family[k].id));
            for (const p of family) remove('pages', p.id);
            toast('Página eliminada');
            go(page.parentId && find('pages', page.parentId) ? `#/paginas/${page.parentId}` : '#/paginas');
          }}
          isIconOnly
          ariaLabel="Eliminar página"
        >
          <TrashBin />
        </ConfirmButton>
      </div>
      <TextField
        aria-label="Título"
        defaultValue={page.title}
        onChange={(t) => {
          page.title = t;
          save(false);
        }}
        maxLength={200}
      >
        <Input placeholder="Sin título" className="border-none bg-transparent px-0 text-3xl font-semibold shadow-none" />
      </TextField>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Cliente"
          value={page.customerId || '_none'}
          onChange={(id) => {
            page.customerId = id === '_none' ? '' : id;
            save();
          }}
          options={[['_none', 'Sin cliente'], ...state.customers.map((c) => [c.id, c.name])]}
        />
        <SelectField
          label="Proyecto"
          value={page.projectId || '_none'}
          onChange={(id) => {
            page.projectId = id === '_none' ? '' : id;
            save();
          }}
          options={[['_none', 'Sin proyecto'], ...state.projects.map((p) => [p.id, p.name || 'Sin nombre'])]}
        />
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        {(page.blocks || []).map((b, i) => (
          <Block key={b.id} page={page} b={b} i={i} onChange={save} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['p', 'h2', 'bullet', 'todo', 'callout', 'quote', 'code', 'divider'].map((k) => (
          <Button
            key={k}
            size="sm"
            variant="tertiary"
            onPress={() => {
              page.blocks = [...(page.blocks || []), { id: uid(), kind: k, text: '', checked: false }];
              save();
            }}
          >
            <Plus />
            {KINDS[k]}
          </Button>
        ))}
      </div>
      {subpages.length > 0 && (
        <Card variant="secondary" className="gap-2 p-4">
          <span className="sw-eyebrow">Subpáginas</span>
          {subpages.map((s) => (
            <a key={s.id} href={`#/paginas/${s.id}`} className="flex items-center gap-2 text-sm hover:underline">
              <span>{s.icon || '📄'}</span>
              {titleOf(s)}
            </a>
          ))}
        </Card>
      )}
    </div>
  );
}

export function Paginas({ id }) {
  const [state, v] = useCrm();
  const [query, setQuery] = useState('');
  const pages = useMemo(() => [...(state.pages || [])], [state, v]);
  const page = id ? find('pages', id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Trabajo" title="Páginas" description="Notas, guías, briefs y actas. Con cliente y proyecto salen también en su ficha." actions={<NewPageButton />} />
      {pages.length === 0 ? (
        <Empty icon={SquareArticle} title="Todavía no hay páginas" text="Empieza en blanco o desde una plantilla: notas de reunión, brief, guía, checklist…" action={<NewPageButton />} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-3">
            <SearchField aria-label="Buscar páginas" value={query} onChange={setQuery}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar páginas…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ScrollShadow className="max-h-[60vh] lg:max-h-[calc(100vh-14rem)]">
              <Tree pages={pages} current={id} query={query} />
            </ScrollShadow>
          </aside>
          <Card className="min-w-0 p-5 sm:p-8">
            {page ? <Editor key={page.id} page={page} /> : <p className="text-sm text-muted">Elige una página a la izquierda o crea una nueva.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
