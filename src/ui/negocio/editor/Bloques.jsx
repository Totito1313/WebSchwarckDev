// Los bloques de una propuesta (introducción, objetivos, alcance, calendario,
// equipo, testimonios, trabajos, imagen, precio y texto libre), editados como
// tarjetas. Las reglas y las plantillas son las de negocio-propuesta.js: aquí solo
// cambia el diseño. El bloque «Precio» lleva las líneas y el total de la hoja.
import { useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, EllipsisVertical, FileText, Picture as Image, Plus, TrashBin, Xmark } from '@gravity-ui/icons';
import { Button, Dropdown, Header, Label, toast } from '@heroui/react';
import { put, state, uid } from '../../../negocio-core.js';
import { BLOCKS, PROPOSAL_TEMPLATES, applyTemplate, block } from '../../../negocio-propuesta.js';
import { ConfirmDialog } from '../fields.jsx';
import { saveSection } from './Contenido.jsx';
import { Block, Txt, pickImage } from './shared.jsx';

// Los campos de cada elemento de un bloque con lista.
const ITEM_FIELDS = {
  goals: [['title', 'Objetivo'], ['text', 'Detalle', true]],
  scope: [['title', 'Qué'], ['text', 'Detalle', true]],
  timeline: [['when', 'Cuándo'], ['title', 'Qué'], ['text', 'Detalle', true]],
  team: [['name', 'Nombre'], ['role', 'Papel'], ['text', 'Qué hace', true]],
  testimonials: [['quote', 'Lo que dijo', true], ['name', 'Nombre'], ['role', 'Cargo o empresa']],
  work: [['title', 'Trabajo'], ['text', 'Detalle', true]],
};
const EMPTY = {
  goals: { title: '', text: '' },
  scope: { title: '', text: '' },
  timeline: { when: '', title: '', text: '' },
  team: { name: '', role: '', text: '' },
  testimonials: { quote: '', name: '', role: '' },
  work: { title: '', text: '', image: '' },
};

/** Un bloque a la biblioteca: los de texto, como sección; el resto, enteros. */
function saveBlock(b) {
  if (b.kind === 'intro' || b.kind === 'text') {
    saveSection({ title: b.title, body: b.body });
    return;
  }
  const { id, ...rest } = structuredClone(b);
  const saved = [...(state.settings.savedBlocks || []), { id: uid(), label: b.title || BLOCKS[b.kind]?.label || 'Bloque', block: rest }];
  put('settings', { ...state.settings, savedBlocks: saved });
  toast.success('Bloque guardado: lo verás en «Añadir bloque» de cualquier propuesta');
}

/** Lo guardado que se puede añadir a una propuesta. */
function blockLibrary() {
  return [
    ...(state.settings.savedBlocks || []).map((x) => ({
      id: `saved:${x.id}`,
      label: x.label,
      note: BLOCKS[x.block?.kind]?.label || '',
      make: () => ({ ...structuredClone(x.block), id: uid(), items: (x.block.items || []).map((it) => ({ ...it, id: uid() })) }),
    })),
    ...(state.settings.sections || []).map((x) => ({ id: `section:${x.id}`, label: x.title || 'Sin título', note: 'Sección', make: () => block('text', { title: x.title, body: x.body }) })),
  ];
}

function BlockCard({ doc, b, i, change }) {
  const kind = BLOCKS[b.kind];
  const fields = ITEM_FIELDS[b.kind];
  const move = (to) =>
    change(() => {
      doc.blocks.splice(i, 1);
      doc.blocks.splice(to, 0, b);
    });
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-muted">{kind?.label || b.kind}</span>
        <span className="flex-1" />
        <Dropdown>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`Opciones del bloque ${kind?.label || ''}`}>
            <EllipsisVertical className="size-4" />
          </Button>
          <Dropdown.Popover placement="bottom end" className="min-w-52">
            <Dropdown.Menu
              aria-label="Opciones del bloque"
              disabledKeys={[i === 0 && 'up', i === doc.blocks.length - 1 && 'down', b.kind === 'pricing' && 'save'].filter(Boolean)}
              onAction={(k) => {
                if (k === 'up') move(i - 1);
                if (k === 'down') move(i + 1);
                if (k === 'save') saveBlock(b);
                if (k === 'remove') change(() => { doc.blocks = doc.blocks.filter((x) => x !== b); });
              }}
            >
              <Dropdown.Item id="up" textValue="Subir">
                <ArrowUp className="size-4" />
                <Label>Subir</Label>
              </Dropdown.Item>
              <Dropdown.Item id="down" textValue="Bajar">
                <ArrowDown className="size-4" />
                <Label>Bajar</Label>
              </Dropdown.Item>
              <Dropdown.Item id="save" textValue="Guardar en la biblioteca">
                <Bookmark className="size-4" />
                <Label>Guardar en la biblioteca</Label>
              </Dropdown.Item>
              <Dropdown.Item id="remove" textValue="Quitar el bloque" variant="danger">
                <TrashBin className="size-4" />
                <Label>Quitar el bloque</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
      <Txt ariaLabel="Título del bloque" value={b.title} onChange={(v) => change(() => { b.title = v; })} placeholder={kind?.label || 'Título'} />

      {(b.kind === 'intro' || b.kind === 'text') && (
        <Txt ariaLabel="Texto" value={b.body} onChange={(v) => change(() => { b.body = v; })} area rows={5} placeholder="Escribe aquí…" maxLength={8000} />
      )}

      {b.kind === 'image' && (
        <>
          {b.image ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={b.image} alt="" className="max-h-48 w-full object-cover" />
              <Button isIconOnly size="sm" variant="secondary" aria-label="Quitar la imagen" className="absolute top-2 right-2" onPress={() => change(() => { b.image = ''; })}>
                <Xmark className="size-4" />
              </Button>
            </div>
          ) : null}
          <Button size="sm" variant="secondary" className="self-start" onPress={() => pickImage((url) => change(() => { b.image = url; }))}>
            <Image className="size-4" />
            {b.image ? 'Cambiar la imagen' : 'Poner una imagen'}
          </Button>
          <Txt ariaLabel="Pie de foto" value={b.caption} onChange={(v) => change(() => { b.caption = v; })} placeholder="Pie de foto (opcional)" />
        </>
      )}

      {b.kind === 'pricing' && <p className="text-xs text-muted">Aquí van las líneas y el total: edítalos más abajo, en «Líneas» y «Total».</p>}

      {fields && (
        <div className="flex flex-col gap-2">
          {(b.items || []).map((it) => (
            <div key={it.id} className="flex flex-col gap-2 rounded-xl bg-surface p-2.5">
              <div className="flex items-start gap-2">
                {b.kind === 'work' && it.image && <img src={it.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />}
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  {fields
                    .filter(([, , area]) => !area)
                    .map(([key, label]) => (
                      <Txt key={key} ariaLabel={label} value={it[key]} onChange={(v) => change(() => { it[key] = v; })} placeholder={label} />
                    ))}
                </div>
                <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar" onPress={() => change(() => { b.items = b.items.filter((x) => x !== it); })}>
                  <Xmark className="size-4" />
                </Button>
              </div>
              {fields
                .filter(([, , area]) => area)
                .map(([key, label]) => (
                  <Txt key={key} ariaLabel={label} value={it[key]} onChange={(v) => change(() => { it[key] = v; })} placeholder={label} area rows={2} />
                ))}
              {b.kind === 'work' && (
                <Button size="sm" variant="ghost" className="self-start" onPress={() => pickImage((url) => change(() => { it.image = url; }))}>
                  <Image className="size-4" />
                  {it.image ? 'Cambiar la imagen' : 'Poner una imagen'}
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="tertiary" className="self-start" onPress={() => change(() => { b.items = [...(b.items || []), { id: uid(), ...EMPTY[b.kind] }]; })}>
            <Plus className="size-3.5" />
            Añadir
          </Button>
        </div>
      )}
    </div>
  );
}

/** El título y los bloques de la propuesta, con plantillas y biblioteca. */
export function Bloques({ doc, change }) {
  const [template, setTemplate] = useState(null);
  const library = blockLibrary();
  return (
    <Block
      title="Propuesta"
      hint="Bloques en el orden de la hoja."
      action={
        <Dropdown>
          <Button size="sm" variant="secondary">
            <FileText className="size-3.5" />
            Plantilla
            <ChevronDown className="size-3.5" />
          </Button>
          <Dropdown.Popover placement="bottom end" className="min-w-56">
            <Dropdown.Menu aria-label="Empezar desde una plantilla" onAction={(k) => setTemplate(String(k))}>
              {Object.entries(PROPOSAL_TEMPLATES).map(([k, t]) => (
                <Dropdown.Item key={k} id={k} textValue={t.label}>
                  <div className="flex flex-col">
                    <Label>{t.label}</Label>
                    <span className="text-xs text-muted">{t.title || 'Solo introducción y precio'}</span>
                  </div>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      }
    >
      <Txt label="Título de la propuesta" value={doc.title} onChange={(v) => change(() => { doc.title = v; })} placeholder="Título de la propuesta" maxLength={200} />
      {(doc.blocks || []).map((b, i) => (
        <BlockCard key={b.id} doc={doc} b={b} i={i} change={change} />
      ))}
      <Dropdown>
        <Button size="sm" variant="secondary" className="self-start">
          <Plus className="size-3.5" />
          Añadir bloque
          <ChevronDown className="size-3.5" />
        </Button>
        <Dropdown.Popover className="max-h-96 min-w-60">
          <Dropdown.Menu
            aria-label="Añadir bloque"
            onAction={(k) =>
              change(() => {
                const key = String(k);
                const lib = library.find((x) => x.id === key);
                doc.blocks = [...(doc.blocks || []), lib ? lib.make() : block(key)];
              })
            }
          >
            <Dropdown.Section>
              <Header>Bloques</Header>
              {Object.entries(BLOCKS).map(([k, x]) => (
                <Dropdown.Item key={k} id={k} textValue={x.label}>
                  <Label>{x.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            {library.length > 0 && (
              <Dropdown.Section>
                <Header>De la biblioteca</Header>
                {library.map((x) => (
                  <Dropdown.Item key={x.id} id={x.id} textValue={x.label}>
                    <div className="flex flex-col">
                      <Label>{x.label}</Label>
                      <span className="text-xs text-muted">{x.note}</span>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <ConfirmDialog
        open={!!template}
        status="accent"
        title={`¿Empezar desde «${PROPOSAL_TEMPLATES[template]?.label || ''}»?`}
        text="Se cambian el título, los bloques y las líneas de precio."
        confirm="Usar plantilla"
        onClose={() => setTemplate(null)}
        onConfirm={() => change(() => applyTemplate(doc, template))}
      />
    </Block>
  );
}
