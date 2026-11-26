// Mensajes de conversación, inspirados en el «Chat Message» de HeroUI Pro: los
// propios a la derecha en una burbuja gris; los de otros a la izquierda, con su
// avatar, nombre y hora, el texto suelto (con formato) y, debajo, sus acciones
// (copiar, me gusta, borrar…), que aparecen al pasar por encima o al enfocar.
import { Copy } from '@gravity-ui/icons';
import { Button, Tooltip, toast } from '@heroui/react';
import { Person } from '../kit/parts.jsx';
import { RichView } from './RichText.jsx';

/**
 * mine: mensaje propio (a la derecha).
 * author, time, text (Markdown); actions: [{ id, label, icon, onPress }]
 */
export function ChatMessage({ mine = false, author, avatar, time, text, children, actions = [], copy = true }) {
  const all = [
    ...(copy && text
      ? [
          {
            id: 'copy',
            label: 'Copiar',
            icon: Copy,
            onPress: () => navigator.clipboard?.writeText(text).then(() => toast('Copiado'), () => {}),
          },
        ]
      : []),
    ...actions,
  ];
  const tools = all.length > 0 && (
    <div className={`flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 ${mine ? 'justify-end' : ''}`}>
      {all.map(({ id, label, icon: Icon, onPress }) => (
        <Tooltip key={id} delay={300}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={onPress} className="size-7 min-w-7 text-muted">
            <Icon className="size-3.5" />
          </Button>
          <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  );

  if (mine) {
    return (
      <div className="group flex flex-col items-end gap-1">
        {time && <span className="px-1 text-[11px] text-muted">{time}</span>}
        <div className="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-default px-4 py-2.5 text-sm">
          {text ? <RichView value={text} className="text-sm" /> : children}
        </div>
        {tools}
      </div>
    );
  }
  return (
    <div className="group flex gap-3">
      <div className="shrink-0 pt-0.5">{avatar || <Person name={String(author || '').replace(/[^\p{L}\s]/gu, ' ')} size="sm" />}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{author}</span>
          {time && <span className="text-[11px] text-muted">{time}</span>}
        </div>
        {text ? <RichView value={text} className="text-sm" /> : children}
        {tools}
      </div>
    </div>
  );
}

/** Lista de mensajes con el aire justo entre ellos. */
export function ChatThread({ children, label = 'Conversación' }) {
  return (
    <div role="log" aria-label={label} className="flex flex-col gap-5">
      {children}
    </div>
  );
}
