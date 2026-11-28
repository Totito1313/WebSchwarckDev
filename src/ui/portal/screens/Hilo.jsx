// Conversaciones: el cliente y el estudio comentan una publicación, una petición, un
// anuncio o un trabajo. Burbujas como en Mensajes (las propias a la derecha), con la
// foto y el nombre de quien escribe cuando cambia. Va dentro de la ficha de cada cosa
// (Conversacion) o sola en una hoja (#/hilo/<tipo>/<id>, HiloHoja).
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, PaperPlane } from '@gravity-ui/icons';
import { Avatar, Button, Link, TextArea, toast } from '@heroui/react';
import { ago } from '../../../portal/kit.js';
import { app, can, commentsOf, memberOf, myName, targetTitle, upsertLocal, urlOf } from '../../../portal/state.js';
import { refresh, usePortal } from '../store.js';
import { Hoja } from '../ui.jsx';

const KIND = { content: 'Publicación', task: 'Petición', post: 'Tablón', work: 'Trabajo', submission: 'Envío' };
const WHERE = { content: (id) => `#/marketing/pieza/${id}`, task: () => '#/peticiones', post: () => '#/cronologia', work: () => '#/cronologia/reportes' };

function Face({ c }) {
  if (c.from_studio) {
    return (
      <Avatar size="sm" className="shrink-0">
        <Avatar.Image alt="Schwarck" src="/favicon.svg" />
        <Avatar.Fallback>S</Avatar.Fallback>
      </Avatar>
    );
  }
  const m = memberOf(c.user_id);
  const name = c.author || m?.name || 'Cliente';
  const src = urlOf(m?.avatar_path);
  return (
    <Avatar size="sm" color="accent" variant="soft" className="shrink-0">
      {src && <Avatar.Image alt={name} src={src} />}
      <Avatar.Fallback>{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
}

/** La conversación de algo: los mensajes y, si se puede comentar, la caja para escribir. */
export function Conversacion({ target, id, title = true }) {
  usePortal();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null);
  const end = useRef(null);
  // Siempre del más antiguo al más nuevo, venga como venga de la carga.
  const items = [...commentsOf(target, id)].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  useEffect(() => {
    if (!fresh || !end.current) return;
    // Dentro de una hoja se desplaza solo su cuerpo: scrollIntoView movería también la
    // hoja (que se arrastra con el desplazamiento) y la sacaría de la pantalla.
    const body = end.current.closest('[data-slot=sheet-body]');
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
    else end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [fresh]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const row = await app.backend.comment(app.client.id, target, id, body, { studio: app.studio, author: myName() });
      upsertLocal('comments', row);
      app.data.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setText('');
      setFresh(row.id);
      refresh();
    } catch (err) {
      toast.danger('No se envió', { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  let prev = null;
  return (
    <section className="flex flex-col gap-3" aria-label="Conversación">
      {title && (
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Conversación
          {items.length > 0 && <span className="rounded-full bg-default px-2 text-xs font-medium text-muted">{items.length}</span>}
        </h3>
      )}
      <div role="log" aria-live="polite" className="flex flex-col gap-1.5">
        {items.length === 0 && (
          <p className="rounded-2xl bg-surface-secondary px-3 py-2.5 text-sm text-muted">
            {app.studio ? 'Sin comentarios todavía.' : '¿Dudas o cambios? Escríbenos aquí: te respondemos en este mismo hilo.'}
          </p>
        )}
        {items.map((c) => {
          const mine = c.from_studio === app.studio;
          const who = c.from_studio ? 'Schwarck' : c.author || memberOf(c.user_id)?.name || 'Cliente';
          // Seguidos (mismo lado y misma persona, menos de 5 minutos): sin repetir la foto ni el nombre.
          const grouped = prev && prev.from_studio === c.from_studio && prev.user_id === c.user_id && new Date(c.created_at) - new Date(prev.created_at) < 300_000;
          prev = c;
          return mine ? (
            <div key={c.id} className={`flex flex-col items-end ${grouped ? '' : 'mt-1.5'} ${fresh === c.id ? 'sw-pop' : ''}`}>
              <p className="max-w-[82%] whitespace-pre-line break-words rounded-[1.25rem] rounded-br-md bg-accent px-3.5 py-2 text-sm text-accent-foreground">{c.body}</p>
              <span className="px-1 pt-0.5 text-[11px] text-muted">{ago(c.created_at)}</span>
            </div>
          ) : (
            <div key={c.id} className={`flex items-end gap-2 ${grouped ? '' : 'mt-1.5'}`}>
              {grouped ? <span className="w-8 shrink-0" /> : <Face c={c} />}
              <div className="flex min-w-0 max-w-[82%] flex-col">
                {!grouped && <span className="px-1 pb-0.5 text-xs font-medium text-muted">{who}</span>}
                <p className="whitespace-pre-line break-words rounded-[1.25rem] rounded-bl-md bg-surface-secondary px-3.5 py-2 text-sm">{c.body}</p>
                <span className="px-1 pt-0.5 text-[11px] text-muted">{ago(c.created_at)}</span>
              </div>
            </div>
          );
        })}
        <span ref={end} />
      </div>
      {can('comment') ? (
        <div className="flex items-end gap-2">
          <TextArea
            aria-label="Escribe un comentario"
            placeholder={app.studio ? 'Responde al cliente…' : 'Escribe una pregunta o un comentario…'}
            rows={1}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
            }}
            className="max-h-40 min-h-10 flex-1 resize-none"
            fullWidth
          />
          <Button isIconOnly aria-label="Enviar" isDisabled={!text.trim()} isPending={busy} onPress={send} className="shrink-0 rounded-full">
            <PaperPlane />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Puedes leer la conversación, pero tu acceso no deja escribir en ella.</p>
      )}
    </section>
  );
}

/** La conversación sola, en una hoja (desde la cronología, la campana o el buscador). */
export function HiloHoja({ target, id, onClose }) {
  usePortal();
  const where = WHERE[target]?.(id);
  return (
    <Hoja eyebrow={KIND[target] || 'Conversación'} title={targetTitle(target, id)} onClose={onClose}>
      {(close) => (
        <>
          {where && (
            <Link
              href={where}
              className="w-fit text-sm"
              onClick={(e) => {
                e.preventDefault();
                close(where);
              }}
            >
              Ver {KIND[target]?.toLowerCase() || 'el original'}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
          <Conversacion target={target} id={id} title={false} />
        </>
      )}
    </Hoja>
  );
}
