// Catálogo · Botones, Colecciones y Selectores.
import { useState } from 'react';
import { ArrowUpRightFromSquare, Bold, ChevronDown, Copy, FileText, Italic, Pencil, Plus, Star, TrashBin, Underline } from '@gravity-ui/icons';
import {
  Autocomplete,
  Avatar,
  Button,
  ButtonGroup,
  CloseButton,
  ComboBox,
  Description,
  Dropdown,
  EmptyState,
  Header,
  Input,
  Kbd,
  Label,
  ListBox,
  SearchField,
  Select,
  Separator,
  Tag,
  TagGroup,
  ToggleButton,
  ToggleButtonGroup,
  useFilter,
} from '@heroui/react';
import { CLIENTS, CURRENCIES, LEAD_SOURCES, initials } from './sample.js';

function ButtonDemo() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Nueva factura</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="tertiary">Terciario</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="danger">Eliminar</Button>
        <Button variant="danger-soft">Anular</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Pequeño</Button>
        <Button size="md">Mediano</Button>
        <Button size="lg">Grande</Button>
        <Button isIconOnly aria-label="Añadir" variant="secondary">
          <Plus />
        </Button>
        <Button
          isPending={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => setBusy(false), 1500);
          }}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button isDisabled>Desactivado</Button>
      </div>
    </div>
  );
}

function ButtonGroupDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <ButtonGroup>
        <Button>Enviar al cliente</Button>
        <Dropdown>
          <Button isIconOnly aria-label="Más formas de enviar">
            <ButtonGroup.Separator />
            <ChevronDown />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label="Formas de enviar">
              <Dropdown.Item id="link" textValue="Copiar enlace">
                <Label>Copiar enlace</Label>
              </Dropdown.Item>
              <Dropdown.Item id="portal" textValue="Publicar en su portal">
                <Label>Publicar en su portal</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </ButtonGroup>
      <ButtonGroup variant="tertiary">
        <Button>Día</Button>
        <Button>
          <ButtonGroup.Separator />
          Semana
        </Button>
        <Button>
          <ButtonGroup.Separator />
          Mes
        </Button>
      </ButtonGroup>
    </div>
  );
}

function ToggleDemo() {
  const [fav, setFav] = useState(false);
  return (
    <ToggleButton isSelected={fav} onChange={setFav}>
      <Star />
      {fav ? 'En favoritas' : 'Marcar favorita'}
    </ToggleButton>
  );
}

function ToggleGroupDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <ToggleButtonGroup aria-label="Formato" selectionMode="multiple">
        <ToggleButton isIconOnly aria-label="Negrita" id="bold">
          <Bold />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Cursiva" id="italic">
          <ToggleButtonGroup.Separator />
          <Italic />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Subrayado" id="underline">
          <ToggleButtonGroup.Separator />
          <Underline />
        </ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup aria-label="Vista" selectionMode="single" defaultSelectedKeys={['board']} disallowEmptySelection>
        <ToggleButton id="board">Tablero</ToggleButton>
        <ToggleButton id="list">
          <ToggleButtonGroup.Separator />
          Lista
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

function DropdownDemo() {
  const [last, setLast] = useState('');
  return (
    <div className="flex flex-col items-start gap-3">
      <Dropdown>
        <Button variant="secondary">
          Acciones de la factura
          <ChevronDown />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Acciones de la factura" onAction={(key) => setLast(String(key))}>
            <Dropdown.Section>
              <Header>Documento</Header>
              <Dropdown.Item id="Editar" textValue="Editar">
                <Pencil />
                <Label>Editar</Label>
                <Kbd slot="keyboard">E</Kbd>
              </Dropdown.Item>
              <Dropdown.Item id="Duplicar" textValue="Duplicar">
                <Copy />
                <Label>Duplicar</Label>
              </Dropdown.Item>
              <Dropdown.Item id="Abrir" textValue="Abrir enlace">
                <ArrowUpRightFromSquare />
                <Label>Abrir enlace</Label>
                <Description>Lo que ve el cliente</Description>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator />
            <Dropdown.Item id="Eliminar" textValue="Eliminar" variant="danger">
              <TrashBin />
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <p className="text-sm text-muted">{last ? `Elegiste «${last}».` : 'Elige una acción.'}</p>
    </div>
  );
}

function ListBoxDemo() {
  return (
    <ListBox aria-label="Clientes" className="w-full max-w-xs" selectionMode="single" defaultSelectedKeys={['cafe']}>
      {CLIENTS.slice(0, 4).map((c) => (
        <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
          <Avatar size="sm" color={c.color} variant="soft">
            <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>{c.name}</Label>
            <Description>{c.email}</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox>
  );
}

function TagGroupDemo() {
  const [tags, setTags] = useState(['Android', 'Sitio web', 'Identidad', 'Mantenimiento']);
  return (
    <div className="flex flex-col gap-4">
      <TagGroup aria-label="Intereses del lead" onRemove={(keys) => setTags((t) => t.filter((x) => !keys.has(x)))}>
        <Label>Le interesa</Label>
        <TagGroup.List renderEmptyState={() => <span className="text-sm text-muted">Sin intereses.</span>}>
          {tags.map((t) => (
            <Tag key={t} id={t}>
              {t}
              <Tag.RemoveButton />
            </Tag>
          ))}
        </TagGroup.List>
        <Description>Toca la × para quitar uno.</Description>
      </TagGroup>
      <TagGroup aria-label="Fuente" selectionMode="single" defaultSelectedKeys={['instagram']} size="sm" variant="surface">
        <TagGroup.List>
          {LEAD_SOURCES.slice(0, 5).map((s) => (
            <Tag key={s.id} id={s.id}>
              {s.name}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}

function SelectDemo() {
  return (
    <Select className="w-full max-w-xs" placeholder="Elige una moneda" defaultSelectedKey="USD">
      <Label>Moneda principal</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Description>Se usa en el inicio y en los totales.</Description>
      <Select.Popover>
        <ListBox>
          {CURRENCIES.map((c) => (
            <ListBox.Item key={c.id} id={c.id} textValue={`${c.name} (${c.id})`}>
              <Label>{c.name}</Label>
              <Description>
                {c.id} · {c.symbol}
              </Description>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function ComboBoxDemo() {
  return (
    <ComboBox className="w-full max-w-xs" allowsEmptyCollection>
      <Label>Cliente</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Escribe para buscar…" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => <EmptyState>Ningún cliente se llama así.</EmptyState>}>
          {CLIENTS.map((c) => (
            <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
              {c.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

function AutocompleteDemo() {
  const { contains } = useFilter({ sensitivity: 'base' });
  const [selected, setSelected] = useState(['instagram', 'whatsapp']);
  return (
    <Autocomplete
      className="w-full max-w-xs"
      placeholder="Elige las redes"
      selectionMode="multiple"
      value={selected}
      onChange={(keys) => setSelected(keys || [])}
    >
      <Label>Redes de la publicación</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            if (isPlaceholder || state.selectedItems.length === 0) return defaultChildren;
            return (
              <TagGroup size="sm" aria-label="Redes elegidas" onRemove={(keys) => setSelected((s) => s.filter((k) => !keys.has(k)))}>
                <TagGroup.List>
                  {state.selectedItems.map((item) => (
                    <Tag key={item.key} id={item.key}>
                      {LEAD_SOURCES.find((s) => s.id === item.key)?.name}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="Buscar redes" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>Sin resultados</EmptyState>}>
            {LEAD_SOURCES.map((s) => (
              <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                {s.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function CloseButtonDemo() {
  const [open, setOpen] = useState(true);
  return open ? (
    <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl bg-surface-secondary px-4 py-3">
      <span className="flex items-center gap-2 text-sm">
        <FileText /> Recibo REC-2026-0012 listo
      </span>
      <CloseButton aria-label="Cerrar aviso" onPress={() => setOpen(false)} />
    </div>
  ) : (
    <Button size="sm" variant="tertiary" onPress={() => setOpen(true)}>
      Volver a enseñarlo
    </Button>
  );
}

export const ACCIONES = [
  {
    id: 'botones',
    title: 'Botones',
    items: [
      { name: 'Button', doc: 'button', desc: 'Siete variantes, tres tamaños, solo icono y estado «guardando».', render: ButtonDemo },
      { name: 'ButtonGroup', doc: 'button-group', desc: 'Botones unidos: una acción con su desplegable o un selector de periodo.', render: ButtonGroupDemo },
      { name: 'CloseButton', doc: 'close-button', desc: 'Para cerrar avisos, hojas y ventanas.', render: CloseButtonDemo },
      { name: 'ToggleButton', doc: 'toggle-button', desc: 'Un botón que se queda encendido.', render: ToggleDemo },
      { name: 'ToggleButtonGroup', doc: 'toggle-button-group', desc: 'Formato del texto (varios) o tablero/lista (uno).', render: ToggleGroupDemo },
    ],
  },
  {
    id: 'colecciones',
    title: 'Colecciones',
    items: [
      { name: 'Dropdown', doc: 'dropdown', desc: 'Menú de acciones con secciones, atajos y una acción peligrosa.', render: DropdownDemo },
      { name: 'ListBox', doc: 'list-box', desc: 'Lista seleccionable con avatar y descripción.', render: ListBoxDemo },
      { name: 'TagGroup', doc: 'tag-group', desc: 'Etiquetas que se quitan o se eligen.', render: TagGroupDemo },
    ],
  },
  {
    id: 'selectores',
    title: 'Selectores',
    items: [
      { name: 'Select', doc: 'select', desc: 'Elegir una opción de una lista cerrada.', render: SelectDemo },
      { name: 'ComboBox', doc: 'combo-box', desc: 'Escribir y filtrar: el cliente de una factura.', render: ComboBoxDemo },
      { name: 'Autocomplete', doc: 'autocomplete', desc: 'Varias opciones con buscador y etiquetas.', render: AutocompleteDemo },
    ],
  },
];
