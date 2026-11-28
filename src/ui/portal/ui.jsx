// Piezas propias del portal nuevo: los iconos que usan las constantes del portal
// (por nombre) y la etiqueta con un punto del color de su estado.
import {
  ArrowUpFromLine,
  Box,
  Calendar,
  ChartColumn,
  Check,
  CircleCheck,
  Comment,
  Comments,
  File,
  FileText,
  Video,
  Flag,
  Folder,
  Globe,
  Handset,
  Heart,
  Link as LinkIcon,
  ListCheck,
  Magnifier,
  MapPin,
  Megaphone,
  PaperPlane,
  Pencil,
  Persons,
  Picture,
  Play,
  Sparkles,
  Thunderbolt,
  Tray,
  Xmark,
  Clock,
  Ellipsis,
  Star,
  Bell,
  ArrowDownToLine,
} from '@gravity-ui/icons';
import { useRef, useState } from 'react';
import { Chip, Sheet, toast } from '@heroui/react';
import { useOpenAfterGesture } from '../kit/hooks.js';
import { app } from '../../portal/state.js';

const ICONS = {
  megaphone: Megaphone,
  sparkles: Sparkles,
  flag: Flag,
  box: Box,
  chart: ChartColumn,
  tasks: ListCheck,
  inbox: Tray,
  checkCircle: CircleCheck,
  check: Check,
  send: PaperPlane,
  calendar: Calendar,
  folder: Folder,
  chat: Comments,
  message: Comment,
  heart: Heart,
  clock: Clock,
  edit: Pencil,
  x: Xmark,
  file: File,
  doc: FileText,
  link: LinkIcon,
  play: Play,
  film: Video,
  image: Picture,
  upload: ArrowUpFromLine,
  bolt: Thunderbolt,
  globe: Globe,
  call: Handset,
  pin: MapPin,
  users: Persons,
  search: Magnifier,
  more: Ellipsis,
  star: Star,
  bell: Bell,
  download: ArrowDownToLine,
};

export function Ico({ name, className = 'size-4' }) {
  const I = ICONS[name] || Sparkles;
  return <I className={className} aria-hidden />;
}

/** Etiqueta con un punto del color del estado (los colores vienen de state.js). */
export function Tone({ label, color, size = 'sm' }) {
  return (
    <Chip size={size} variant="secondary">
      <span className="inline-block size-1.5 rounded-full" style={{ background: color || 'var(--muted)' }} aria-hidden />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

/**
 * La hoja que sube desde abajo (en el ordenador, centrada y más ancha). Se cierra
 * deslizando, con Escape o con la X, y avisa con onClose cuando ya terminó de irse.
 * children y footer pueden ser funciones que reciben close(), para cerrarla desde
 * dentro (después de guardar) con su animación; close('#/otra') la cierra y va allí.
 */
export function Hoja({ title, eyebrow, subtitle, onClose, children, footer, wide = false, label, bodyClassName = '' }) {
  const ready = useOpenAfterGesture();
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const dest = useRef(null);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onClose?.(dest.current);
  };
  const close = (to) => {
    if (typeof to === 'string') dest.current = to;
    setClosing(true);
    // Por si la animación no avisa (movimiento reducido): se cierra igual.
    setTimeout(finish, 450);
  };
  const render = (x) => (typeof x === 'function' ? x(close) : x);
  return (
    <Sheet isOpen={ready && !closing} onOpenChange={(open) => !open && close(null)} onAnimationEnd={(open) => !open && closing && finish()}>
      <Sheet.Backdrop>
        <Sheet.Content className={`mx-auto max-h-[92vh] w-full ${wide ? 'max-w-[720px]' : 'max-w-[600px]'}`}>
          <Sheet.Dialog aria-label={label || (typeof title === 'string' ? title : undefined)}>
            <Sheet.Handle />
            <Sheet.CloseTrigger aria-label="Cerrar" />
            {title && (
              <Sheet.Header className="flex flex-col items-start gap-1 pe-12">
                {eyebrow && <span className="sw-eyebrow">{eyebrow}</span>}
                <Sheet.Heading className="text-xl font-semibold leading-tight">{title}</Sheet.Heading>
                {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
              </Sheet.Header>
            )}
            <Sheet.Body className={`flex flex-col gap-4 overflow-y-auto pb-3 ${bodyClassName}`}>{render(children)}</Sheet.Body>
            {footer && <Sheet.Footer className="flex flex-wrap items-center justify-end gap-2">{render(footer)}</Sheet.Footer>}
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

/** Abre un archivo del almacén (recursos, envíos) con una dirección firmada de un solo uso. */
export async function openFile(path, { download = true } = {}) {
  const win = window.open('', '_blank');
  try {
    const urls = await app.backend.fileUrls([path], download);
    if (!urls[path]) throw new Error(app.backend.mode === 'demo' ? 'En la demostración los archivos no se abren.' : 'No se encontró el archivo.');
    if (win) win.location = urls[path];
    else location.href = urls[path];
  } catch (err) {
    win?.close();
    toast.danger(err.message);
  }
}

/** Tamaño de un archivo en palabras. */
export const sizeOf = (bytes) => (!bytes ? '' : bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`);

/** Icono en un círculo suave del color del tipo de cosa. */
export function Bubble({ name, color }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: `color-mix(in oklab, ${color || 'var(--muted)'} 16%, transparent)`, color: color || 'var(--muted)' }}
    >
      <Ico name={name} />
    </span>
  );
}
