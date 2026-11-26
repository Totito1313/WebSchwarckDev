// Subir un archivo (foto o PDF) al almacén del panel, con un botón de HeroUI.
// Usa uploadFile de negocio-gastos.js: reduce las fotos y las guarda en KV.
import { useRef, useState } from 'react';
import { ArrowUpFromLine } from '@gravity-ui/icons';
import { Button, toast } from '@heroui/react';
import { fileUrl, uploadFile } from '../../negocio-gastos.js';

/** Botón que abre el selector de archivos y devuelve { id, url, type, name, size } al subir. */
export function UploadButton({ onUploaded, accept = 'image/png,image/jpeg,image/webp', children = 'Subir', size = 'sm', variant = 'secondary' }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} isPending={busy} onPress={() => input.current?.click()}>
        <ArrowUpFromLine />
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const meta = await uploadFile(file);
            onUploaded({ ...meta, url: fileUrl(meta.id) });
          } catch (err) {
            toast.danger('No se pudo subir', { description: err.message });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
