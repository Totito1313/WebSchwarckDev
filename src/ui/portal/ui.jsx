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
} from '@gravity-ui/icons';
import { Chip } from '@heroui/react';

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
