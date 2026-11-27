// Catálogo: lo que vendes, con su precio y su foto. Al hacer una factura, la
// línea se rellena sola con esto.
import { useMemo, useState } from 'react';
import { Box, Pencil, Plus, TrashBin } from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Input, Label, SearchField, TextArea, TextField, toast } from '@heroui/react';
import { money, put, remove, uid } from '../../../negocio-core.js';
import { Empty, PageHeader } from '../../kit/parts.jsx';
import { go, useCrm } from '../store.js';
import { base } from '../domain.js';
import { CurrencyPicker } from '../currency.jsx';
import { AmountField, ConfirmButton, FormModal } from '../fields.jsx';
import { UploadButton } from '../upload.jsx';

const plain = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** prefill: datos de partida para uno nuevo (por ejemplo, una línea de factura); onSaved(servicio). */
export function ServiceForm({ item, prefill, onClose, onSaved }) {
  const [it] = useState(() => (item ? { ...item } : { id: uid(), name: '', description: '', price: 0, currency: base(), image: '', ...prefill }));
  const [price, setPrice] = useState(Number(it.price) || 0);
  const [currency, setCurrency] = useState(it.currency || base());
  const [image, setImage] = useState(it.image || '');
  return (
    <FormModal
      title={item ? 'Editar servicio' : 'Nuevo servicio'}
      submit={item ? 'Guardar' : 'Añadir al catálogo'}
      onClose={onClose}
      onSubmit={(f) => {
        const name = String(f.name || '').trim();
        if (!name) return false;
        const saved = { ...it, name, description: String(f.description || '').trim(), price, currency, image };
        put('catalog', saved);
        toast.success(item ? 'Servicio guardado' : `${name} está en el catálogo`);
        onSaved?.(saved);
        return true;
      }}
    >
      <TextField name="name" isRequired defaultValue={it.name} maxLength={160} autoFocus className="sm:col-span-2">
        <Label>Nombre</Label>
        <Input placeholder="Diseño de interfaz" />
      </TextField>
      <TextField name="description" defaultValue={it.description} maxLength={1000} className="sm:col-span-2">
        <Label>Descripción</Label>
        <TextArea rows={2} placeholder="Lo que incluye, en una línea." />
      </TextField>
      <AmountField label="Precio" value={price} onChange={setPrice} />
      <CurrencyPicker label="Moneda" value={currency} onChange={setCurrency} showName={false} className="sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
          {image ? <img src={image} alt="" className="size-full object-cover" /> : <Box className="size-6 text-muted" />}
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <UploadButton onUploaded={(m) => setImage(m.url)}>{image ? 'Cambiar foto' : 'Subir foto'}</UploadButton>
            {image && (
              <Button size="sm" variant="ghost" onPress={() => setImage('')}>
                Quitar
              </Button>
            )}
          </div>
          <span className="text-xs text-muted">Sale junto a la línea en facturas, cotizaciones y propuestas.</span>
        </div>
      </div>
    </FormModal>
  );
}

export function Catalogo({ isNew }) {
  const [state, v] = useCrm();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => {
    const q = plain(query.trim());
    return [...state.catalog].filter((it) => !q || plain(`${it.name} ${it.description}`).includes(q)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [state, v, query]);
  const close = () => {
    setAdding(false);
    setEditing(null);
    if (isNew) go('#/catalogo');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ventas"
        title="Catálogo"
        description={`${state.catalog.length} ${state.catalog.length === 1 ? 'servicio' : 'servicios'} · lo que vendes, listo para las facturas`}
        actions={
          <Button onPress={() => setAdding(true)}>
            <Plus />
            Nuevo servicio
          </Button>
        }
      />
      {state.catalog.length === 0 ? (
        <Empty icon={Box} title="El catálogo está vacío" text="Guarda lo que vendes con su precio y añádelo a una factura con un clic." action={<Button onPress={() => setAdding(true)}>Nuevo servicio</Button>} />
      ) : (
        <>
          <SearchField aria-label="Buscar en el catálogo" value={query} onChange={setQuery} className="w-full sm:max-w-sm">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar en el catálogo…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <Card key={it.id} className="flex-row items-start gap-3 p-4">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary">
                  {it.image ? <img src={it.image} alt="" className="size-full object-cover" /> : <Box className="size-5 text-muted" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{it.name}</span>
                  <span className="line-clamp-2 text-xs text-muted">{it.description || 'Sin descripción'}</span>
                  <span className="sw-figure mt-1 text-xl">{money(Number(it.price) || 0, it.currency)}</span>
                </div>
                <ButtonGroup size="sm" variant="ghost">
                  <Button isIconOnly aria-label={`Editar ${it.name}`} onPress={() => setEditing(it)}>
                    <Pencil />
                  </Button>
                  <ConfirmButton
                    title={`¿Quitar ${it.name} del catálogo?`}
                    text="Las facturas que ya lo llevan no cambian."
                    onConfirm={() => remove('catalog', it.id)}
                    variant="ghost"
                    isIconOnly
                    ariaLabel={`Eliminar ${it.name}`}
                  >
                    <ButtonGroup.Separator />
                    <TrashBin />
                  </ConfirmButton>
                </ButtonGroup>
              </Card>
            ))}
          </div>
          {!items.length && <p className="text-sm text-muted">Nada coincide con «{query}».</p>}
        </>
      )}
      {(adding || isNew || editing) && <ServiceForm key={editing?.id || 'new'} item={editing} onClose={close} />}
    </div>
  );
}
