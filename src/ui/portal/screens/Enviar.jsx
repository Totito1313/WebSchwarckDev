// Enviar a Schwarck: un mensaje, un enlace o un archivo (fotos, PDF, vídeos de hasta
// 50 MB, con su barra de progreso). Si es para una petición, al enviarlo queda como
// entregada. Se abre con el botón flotante (#/enviar) o desde una petición
// (#/enviar/<id de la petición>). Desde aquí también se puede pedir una reunión.
import { useRef, useState } from 'react';
import { ArrowUpFromLine, Calendar, ChevronRight, Comment, File, Link as LinkIcon, PaperPlane, Xmark } from '@gravity-ui/icons';
import { Button, Input, Label, ProgressBar, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { safeUrl } from '../../../portal/kit.js';
import { EXPECTS, app, can, has, myName, pendingTasks, upsertLocal } from '../../../portal/state.js';
import { refresh, usePortal } from '../store.js';
import { SelectField } from '../../negocio/fields.jsx';
import { Hoja, sizeOf } from '../ui.jsx';

const MAX = 50 * 1048576;
const MODES = [
  ['message', 'Mensaje', Comment],
  ['link', 'Enlace', LinkIcon],
  ['file', 'Archivo', File],
];

/** Elegir un archivo: tocar o soltarlo encima. Con `progress` (0 a 1), la barra de subida. */
export function FilePick({ file, onFile, progress = null, accept, hint = 'Hasta 50 MB. Para vídeos más grandes, pega un enlace de Drive o WeTransfer.' }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const take = (f) => {
    if (!f) return;
    if (f.size > MAX) return toast.danger('El archivo pesa más de 50 MB', { description: 'Para vídeos grandes, envía un enlace (Drive, WeTransfer, YouTube…).' });
    onFile(f);
  };
  if (file) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-muted">
            <File className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted">{sizeOf(file.size)}</span>
          </span>
          {progress == null && (
            <Button isIconOnly size="sm" variant="ghost" aria-label="Quitar el archivo" onPress={() => onFile(null)}>
              <Xmark />
            </Button>
          )}
        </div>
        {progress != null && (
          <ProgressBar aria-label="Subiendo" value={Math.round(progress * 100)} size="sm" color="accent">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-7 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${over ? 'border-accent bg-accent/10' : 'border-border hover:bg-surface-secondary'}`}
    >
      <ArrowUpFromLine className="size-6 text-muted" />
      <span className="text-sm font-medium">Elige una foto, un archivo o un vídeo</span>
      <span className="max-w-xs text-xs text-muted">{hint}</span>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => take(e.target.files?.[0])} />
    </button>
  );
}

export function EnviarHoja({ taskId: forTask = '', onClose }) {
  usePortal();
  const task = forTask ? app.data.tasks.find((t) => t.id === forTask) : null;
  const [mode, setMode] = useState(task?.expects === 'link' ? 'link' : task?.expects === 'file' ? 'file' : 'message');
  const [taskId, setTaskId] = useState(task?.id || '');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = pendingTasks();
  const canMeet = has('meetings') && !app.studio && can('meetings.request');

  const send = async (close) => {
    const payload = { clientId: app.client.id, taskId: taskId || null, kind: mode, author: myName() };
    if (mode === 'message') {
      if (!text.trim()) return toast.danger('Escribe algo primero.');
      payload.body = text.trim();
    } else if (mode === 'link') {
      const url = safeUrl(link.trim());
      if (!url) return toast.danger('Ese enlace no parece válido', { description: 'Tiene que empezar por https://' });
      payload.url = url;
      payload.body = note.trim();
    } else {
      if (!file) return toast.danger('Elige un archivo.');
      payload.kind = file.type.startsWith('video/') ? 'video' : 'file';
      payload.file = file;
      payload.body = note.trim();
      payload.onProgress = (p) => setProgress(p);
      setProgress(0);
    }
    setBusy(true);
    try {
      const row = await app.backend.submit(payload);
      upsertLocal('submissions', row);
      // Mandar algo para una petición la deja como entregada.
      const t = taskId && app.data.tasks.find((x) => x.id === taskId);
      if (t && t.status === 'pending') upsertLocal('tasks', await app.backend.save('tasks', { id: t.id, status: 'submitted' }).catch(() => t));
      refresh();
      toast.success(t ? 'Entregado. ¡Gracias!' : 'Enviado. ¡Gracias!', { description: t ? `«${t.title}» queda en revisión.` : 'El estudio lo verá enseguida.' });
      close();
    } catch (err) {
      setProgress(null);
      toast.danger('No se envió', { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Hoja
      eyebrow={task ? 'Entregar' : null}
      title={task ? task.title : 'Enviar a Schwarck'}
      subtitle={task ? `Te pedimos: ${EXPECTS[task.expects]?.[0]?.toLowerCase() || 'lo que tengas'}` : 'Un mensaje, un enlace o un archivo'}
      onClose={onClose}
      footer={(close) => (
        <>
          <Button variant="secondary" onPress={() => close()} isDisabled={busy}>
            Cancelar
          </Button>
          <Button onPress={() => send(close)} isPending={busy}>
            <PaperPlane />
            {task ? 'Entregar' : 'Enviar'}
          </Button>
        </>
      )}
    >
      {(close) => (
        <>
          {!task && canMeet && (
            <button
              type="button"
              onClick={() => close('#/reuniones/pedir')}
              className="flex items-center gap-3 rounded-2xl bg-surface-secondary px-3 py-2.5 text-start outline-none hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Calendar className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">¿Mejor hablarlo?</span>
                <span className="text-xs text-muted">Pide una reunión con los horarios que te vienen bien</span>
              </span>
              <ChevronRight className="size-4 text-muted" />
            </button>
          )}
          <ToggleButtonGroup aria-label="Qué envías" selectionMode="single" disallowEmptySelection fullWidth selectedKeys={new Set([mode])} onSelectionChange={(k) => setMode(String([...k][0]))}>
            {MODES.map(([k, label, Icon], i) => (
              <ToggleButton key={k} id={k}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                <Icon />
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {mode === 'message' && (
            <TextField value={text} onChange={setText} maxLength={10000} autoFocus>
              <Label>Mensaje</Label>
              <TextArea rows={5} placeholder="Escribe tu mensaje…" />
            </TextField>
          )}
          {mode === 'link' && (
            <TextField value={link} onChange={setLink} type="url" maxLength={2000}>
              <Label>Enlace</Label>
              <Input inputMode="url" placeholder="https://…" />
            </TextField>
          )}
          {mode === 'file' && <FilePick file={file} onFile={setFile} progress={progress} />}
          {mode !== 'message' && (
            <TextField value={note} onChange={setNote} maxLength={2000}>
              <Label>Comentario (opcional)</Label>
              <TextArea rows={2} placeholder="Algo que debamos saber…" />
            </TextField>
          )}
          {!task && pending.length > 0 && (
            <SelectField
              label="Es para"
              value={taskId}
              onChange={setTaskId}
              options={[['', 'Nada en concreto'], ...pending.map((t) => [t.id, t.title, EXPECTS[t.expects]?.[0]])]}
              description="Si es lo que te pedimos, esa petición queda como entregada."
            />
          )}
        </>
      )}
    </Hoja>
  );
}
