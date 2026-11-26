// Piezas comunes del editor de documentos: campos de texto que escriben directo en
// el documento, la vista previa de la hoja y la elección de una imagen.
import { useEffect, useRef, useState } from 'react';
import { Input, Label, TextArea, TextField, toast } from '@heroui/react';
import { isLocked, isSignable, pubOf, state } from '../../../negocio-core.js';
import { renderSheet } from '../../../negocio-sheet.js';
import { fileUrl, uploadFile } from '../../../negocio-gastos.js';
import '../sheet.css';

/**
 * Texto que escribe en el documento al teclear. Es «no controlado» (defaultValue):
 * así el cursor no salta mientras la hoja se repinta al lado.
 */
export function Txt({ label, value, onChange, area = false, rows = 3, placeholder, maxLength = 2000, className = '', ariaLabel, isDisabled }) {
  return (
    <TextField aria-label={ariaLabel || label} defaultValue={value ?? ''} onChange={onChange} maxLength={maxLength} className={className} isDisabled={isDisabled}>
      {label && <Label>{label}</Label>}
      {area ? <TextArea rows={rows} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
    </TextField>
  );
}

/** Un bloque del panel: título, una línea de ayuda opcional y lo de la derecha. */
export function Block({ title, hint, action, children, className = '' }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="sw-eyebrow">{title}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Abre el selector de archivos y sube la imagen; devuelve su dirección. */
export function pickImage(done) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    toast('Subiendo imagen…');
    try {
      done(fileUrl((await uploadFile(f)).id));
      toast.success('Imagen lista');
    } catch (err) {
      toast.danger('No se pudo subir', { description: err.message });
    }
  });
  input.click();
}

/**
 * La hoja tal como la ve y la imprime el cliente (renderSheet, la misma de la página
 * pública), escalada para caber en su columna. Se repinta un instante después de
 * cada cambio, para no hacerlo en cada tecla.
 */
export function SheetPreview({ doc, version }) {
  const box = useRef(null);
  const stage = useRef(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!box.current) return;
      const pub = pubOf(doc);
      const drawn = pub?.mode === 'drawn' ? `/api/admin/crm/signature/${doc.id}` : '';
      const node = renderSheet(doc, { logo: state.settings.logo, response: isSignable(doc) || isLocked(doc) ? pub : null, drawnSrc: drawn });
      box.current.replaceChildren(node);
    }, 90);
    return () => clearTimeout(t);
  }, [doc, version]);

  useEffect(() => {
    if (!stage.current) return undefined;
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, Math.max(0.35, e.contentRect.width / 860))));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={stage} className="sw-sheet-stage">
      <div ref={box} className="sw-print-area" style={{ '--sw-zoom': zoom }} aria-label="Vista previa del documento" role="document" />
    </div>
  );
}
