// Tabla de datos, inspirada en el «Data Grid» de HeroUI Pro y hecha sobre la Table de
// HeroUI: arriba, el título con su cuenta, el buscador y los botones de filtros,
// orden y columnas; abajo, las filas con casilla de selección, columnas ordenables,
// menú «⋮» por fila (también con clic derecho) y, si hay seleccionadas, la barra de
// acciones flotante. Muestra 50 filas y «Mostrar más» para el resto.
import { useMemo, useState } from 'react';
import { ArrowUpArrowDown, Bars, EllipsisVertical, Funnel, LayoutColumns } from '@gravity-ui/icons';
import { Button, Checkbox, Chip, Dropdown, Header, Label, SearchField, Table } from '@heroui/react';
import { ActionBar } from './ActionBar.jsx';
import { PointMenu, menuNodes } from './ContextMenu.jsx';

const PAGE = 50;

function SelectBox({ label }) {
  return (
    <Checkbox aria-label={label} slot="selection" variant="secondary">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

/**
 * columns: [{ id, name, render(row), sortValue?(row), align?: 'end', isRowHeader?, hideable?, hidden?, className? }]
 * rows, getKey(row)
 * search?(row, q) → bool; searchPlaceholder
 * filters?: [{ id, label, options: [[value, text]], match(row, value) }]
 * bulkActions?: [{ id, label, icon?, danger? }] y onBulkAction(id, rows, clear)
 * rowMenu?(row) → items del menú; onRowMenu(id, row)
 * onRowAction?(row): abrir la fila
 */
export function DataGrid({
  title,
  label,
  columns,
  rows,
  getKey = (r) => r.id,
  search,
  searchPlaceholder = 'Buscar',
  filters = [],
  defaultSort,
  bulkActions,
  onBulkAction,
  rowMenu,
  onRowMenu,
  onRowAction,
  actions,
  empty,
  minWidth = 720,
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState({}); // filtro → Set de valores
  const [sort, setSort] = useState(defaultSort || null);
  const [hidden, setHidden] = useState(() => new Set(columns.filter((c) => c.hidden).map((c) => c.id)));
  const [selected, setSelected] = useState(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [menu, setMenu] = useState(null); // { at, row }

  const selectable = !!(bulkActions && bulkActions.length);
  const visible = columns.filter((c) => !hidden.has(c.id));

  const shown = useMemo(() => {
    let list = rows;
    const text = q.trim().toLowerCase();
    if (text && search) list = list.filter((r) => search(r, text));
    for (const f of filters) {
      const set = picked[f.id];
      if (set && set.size) list = list.filter((r) => [...set].some((v) => f.match(r, v)));
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.column);
      const val = col?.sortValue || ((r) => r[sort.column]);
      const dir = sort.direction === 'descending' ? -1 : 1;
      list = [...list].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true }) * dir;
      });
    }
    return list;
  }, [rows, q, search, filters, picked, sort, columns]);

  const keys = useMemo(() => new Set(shown.map((r) => String(getKey(r)))), [shown, getKey]);
  const selectedRows = shown.filter((r) => selected === 'all' || selected.has(String(getKey(r))));
  const count = selectedRows.length;
  const clear = () => setSelected(new Set());
  const byKey = (k) => rows.find((r) => String(getKey(r)) === String(k));

  const activeFilters = filters.reduce((n, f) => n + (picked[f.id]?.size || 0), 0);
  const sortable = columns.filter((c) => c.sortValue || c.sortable);

  const openRowMenu = (e) => {
    if (!rowMenu) return;
    const tr = e.target.closest?.('[data-key]');
    const row = tr && byKey(tr.getAttribute('data-key'));
    if (!row) return;
    e.preventDefault();
    setMenu({ at: { x: e.clientX, y: e.clientY }, row });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <Chip size="sm" variant="soft">
              {shown.length === rows.length ? rows.length : `${shown.length} de ${rows.length}`}
            </Chip>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <SearchField aria-label={searchPlaceholder} value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} className="w-full sm:w-64">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={searchPlaceholder} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        )}

        {filters.map((f) => {
          const set = picked[f.id] || new Set();
          return (
            <Dropdown key={f.id}>
              <Button size="sm" variant={set.size ? 'secondary' : 'tertiary'} className="rounded-full">
                <Funnel className="size-3.5" />
                {f.label}
                {set.size > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">{set.size}</span>}
              </Button>
              <Dropdown.Popover className="min-w-52">
                <Dropdown.Menu
                  aria-label={f.label}
                  selectionMode="multiple"
                  selectedKeys={set}
                  onSelectionChange={(k) => {
                    setPicked((p) => ({ ...p, [f.id]: k === 'all' ? new Set(f.options.map((o) => o[0])) : new Set([...k].map(String)) }));
                    setLimit(PAGE);
                  }}
                >
                  {f.options.map(([v, text]) => (
                    <Dropdown.Item key={v} id={v} textValue={text}>
                      <Dropdown.ItemIndicator />
                      <Label>{text}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          );
        })}

        {sortable.length > 0 && (
          <Dropdown>
            <Button size="sm" variant={sort ? 'secondary' : 'tertiary'} className="rounded-full">
              <ArrowUpArrowDown className="size-3.5" />
              Orden
            </Button>
            <Dropdown.Popover className="min-w-56">
              <Dropdown.Menu
                aria-label="Ordenar"
                selectionMode="single"
                selectedKeys={sort ? new Set([`${sort.column}:${sort.direction}`]) : new Set()}
                onSelectionChange={(k) => {
                  const v = [...(k === 'all' ? [] : k)][0];
                  if (!v) return setSort(null);
                  const [column, direction] = String(v).split(':');
                  setSort({ column, direction });
                }}
              >
                {sortable.flatMap((c) => [
                  <Dropdown.Item key={`${c.id}:ascending`} id={`${c.id}:ascending`} textValue={`${c.name}, de menor a mayor`}>
                    <Dropdown.ItemIndicator />
                    <Label>{c.name}</Label>
                    <span className="text-xs text-muted">↑</span>
                  </Dropdown.Item>,
                  <Dropdown.Item key={`${c.id}:descending`} id={`${c.id}:descending`} textValue={`${c.name}, de mayor a menor`}>
                    <Dropdown.ItemIndicator />
                    <Label>{c.name}</Label>
                    <span className="text-xs text-muted">↓</span>
                  </Dropdown.Item>,
                ])}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}

        {columns.some((c) => c.hideable) && (
          <Dropdown>
            <Button size="sm" variant="tertiary" className="rounded-full">
              <LayoutColumns className="size-3.5" />
              Columnas
            </Button>
            <Dropdown.Popover className="min-w-52">
              <Dropdown.Menu
                aria-label="Columnas visibles"
                selectionMode="multiple"
                selectedKeys={new Set(columns.filter((c) => c.hideable && !hidden.has(c.id)).map((c) => c.id))}
                onSelectionChange={(k) => {
                  const on = k === 'all' ? new Set(columns.map((c) => c.id)) : new Set([...k].map(String));
                  setHidden(new Set(columns.filter((c) => c.hideable && !on.has(c.id)).map((c) => c.id)));
                }}
              >
                <Dropdown.Section>
                  <Header>Mostrar</Header>
                  {columns
                    .filter((c) => c.hideable)
                    .map((c) => (
                      <Dropdown.Item key={c.id} id={c.id} textValue={c.name}>
                        <Dropdown.ItemIndicator />
                        <Label>{c.name}</Label>
                      </Dropdown.Item>
                    ))}
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}

        {(activeFilters > 0 || q) && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setPicked({});
              setQ('');
            }}
          >
            Quitar filtros
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        empty || <p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">No hay nada con esos filtros.</p>
      ) : (
        <div onContextMenu={openRowMenu}>
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label={label || title || 'Tabla'}
                style={{ minWidth }}
                selectionMode={selectable ? 'multiple' : 'none'}
                selectedKeys={selected === 'all' ? keys : selected}
                onSelectionChange={(k) => setSelected(k === 'all' ? new Set(keys) : new Set([...k].map(String)))}
                sortDescriptor={sort || undefined}
                onSortChange={setSort}
                onRowAction={onRowAction ? (k) => { const r = byKey(k); if (r) onRowAction(r); } : undefined}
              >
                <Table.Header>
                  {[
                    selectable && (
                      <Table.Column key="__select" id="__select" className="w-10 pe-0">
                        <SelectBox label="Seleccionar todas" />
                      </Table.Column>
                    ),
                    ...visible.map((c) =>
                      c.sortValue || c.sortable ? (
                        <Table.Column key={c.id} id={c.id} allowsSorting isRowHeader={c.isRowHeader} className={`${c.align === 'end' ? 'text-end' : ''} ${c.className || ''}`}>
                          {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{c.name}</Table.SortableColumnHeader>}
                        </Table.Column>
                      ) : (
                        <Table.Column key={c.id} id={c.id} isRowHeader={c.isRowHeader} className={`${c.align === 'end' ? 'text-end' : ''} ${c.className || ''}`}>
                          {c.name}
                        </Table.Column>
                      ),
                    ),
                    rowMenu && (
                      <Table.Column key="__menu" id="__menu" className="w-12">
                        <span className="sr-only">Acciones</span>
                      </Table.Column>
                    ),
                  ].filter(Boolean)}
                </Table.Header>
                <Table.Body>
                  {shown.slice(0, limit).map((r) => {
                    const k = String(getKey(r));
                    return (
                      <Table.Row key={k} id={k}>
                        {[
                          selectable && (
                            <Table.Cell key="__select" className="pe-0">
                              <SelectBox label="Seleccionar fila" />
                            </Table.Cell>
                          ),
                          ...visible.map((c) => (
                            <Table.Cell key={c.id} className={`${c.align === 'end' ? 'text-end tabular-nums' : ''} ${c.className || ''}`}>
                              {c.render ? c.render(r) : r[c.id]}
                            </Table.Cell>
                          )),
                          rowMenu && (
                            <Table.Cell key="__menu" className="text-end">
                              <Dropdown>
                                <Button isIconOnly size="sm" variant="ghost" aria-label="Más acciones">
                                  <EllipsisVertical className="size-4" />
                                </Button>
                                <Dropdown.Popover placement="bottom end" className="min-w-52">
                                  <Dropdown.Menu aria-label="Acciones de la fila" onAction={(id) => onRowMenu?.(String(id), r)}>
                                    {menuNodes(rowMenu(r))}
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            </Table.Cell>
                          ),
                        ].filter(Boolean)}
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          {shown.length > limit && (
            <div className="mt-3 flex items-center justify-center gap-3 text-sm text-muted">
              <span>
                {limit} de {shown.length}
              </span>
              <Button size="sm" variant="secondary" onPress={() => setLimit((l) => l + PAGE)}>
                <Bars className="size-3.5" />
                Mostrar más
              </Button>
            </div>
          )}
        </div>
      )}

      {rowMenu && (
        <PointMenu
          at={menu?.at}
          items={menu ? rowMenu(menu.row) : []}
          onClose={() => setMenu(null)}
          onAction={(id) => menu && onRowMenu?.(id, menu.row)}
        />
      )}

      {selectable && (
        <ActionBar
          count={count}
          actions={bulkActions}
          onClear={clear}
          onAction={(id) => onBulkAction?.(id, selectedRows, clear)}
        />
      )}
    </div>
  );
}
