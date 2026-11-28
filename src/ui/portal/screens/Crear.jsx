// Lo que el cliente puede crear, si su portal se lo permite: un anuncio en el tablón
// (posts.create), una propuesta de publicación (content.propose, entra como idea), un
// recurso (resources.upload, archivo o enlace) y leads (leads.add y leads.edit para
// moverlos de etapa). Cada uno es una ventana con su formulario.
import { useState } from 'react';
import { File, Link as LinkIcon } from '@gravity-ui/icons';
import { Input, Label, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { addDays, hostOf, safeUrl, todayKey } from '../../../portal/kit.js';
import { safeName } from '../../../portal/data.js';
import { CHANNEL, FORMAT, LEAD_SOURCE, LEAD_STAGE, app, myName, upsertLocal } from '../../../portal/state.js';
import { refresh } from '../store.js';
import { AmountField, DateInput, FormModal, SelectField } from '../../negocio/fields.jsx';
import { FilePick } from './Enviar.jsx';

const fail = (title, err) => {
  toast.danger(title, { description: err.message });
  return false;
};

/** Publicar en el tablón: lo ve su equipo y le llega al estudio. */
export function AnuncioModal({ onClose }) {
  return (
    <FormModal
      title="Publicar en el tablón"
      submit="Publicar"
      onClose={onClose}
      onSubmit={async ({ title, body, link }) => {
        const url = String(link || '').trim();
        if (url && !safeUrl(url)) return fail('El enlace no vale', new Error('Tiene que empezar por https://'));
        try {
          const row = await app.backend.save('posts', {
            client_id: app.client.id,
            kind: 'announcement',
            title: String(title).trim(),
            body: String(body || '').trim() || null,
            link: safeUrl(url),
            occurred_at: new Date().toISOString(),
            origin: 'client',
            created_by: app.user?.id,
            author: myName(),
            notify: true,
          });
          upsertLocal('posts', row);
          refresh();
          toast.success('Publicado en el tablón', { description: 'Lo ve tu equipo y le llega al estudio.' });
          return true;
        } catch (err) {
          return fail('No se publicó', err);
        }
      }}
    >
      <TextField name="title" isRequired maxLength={200} autoFocus className="sm:col-span-2">
        <Label>Título</Label>
        <Input placeholder="El sábado cerramos a las 15:00" />
      </TextField>
      <TextField name="body" maxLength={20000} className="sm:col-span-2">
        <Label>Texto</Label>
        <TextArea rows={4} placeholder="Lo que quieras contar a tu equipo y al estudio" />
      </TextField>
      <TextField name="link" type="url" maxLength={2000} className="sm:col-span-2">
        <Label>Enlace (opcional)</Label>
        <Input inputMode="url" placeholder="https://…" />
      </TextField>
    </FormModal>
  );
}

const NETS = Object.entries(CHANNEL).filter(([k]) => !['google', 'web', 'email', 'otro'].includes(k));

/** Proponer una publicación: le llega al estudio como idea, que la prepara y la manda a revisar. */
export function ProponerModal({ day, onClose }) {
  const [date, setDate] = useState(day && day >= todayKey() ? day : addDays(todayKey(), 3));
  const [nets, setNets] = useState(new Set(['instagram']));
  const [format, setFormat] = useState('post');
  return (
    <FormModal
      title="Proponer una publicación"
      submit="Proponer"
      onClose={onClose}
      onSubmit={async ({ title, idea, ref }) => {
        const channels = [...nets];
        if (!channels.length) return fail('Elige al menos una red', new Error('Instagram, Facebook, TikTok…'));
        const url = safeUrl(String(ref || '').trim());
        try {
          const row = await app.backend.save('content', {
            client_id: app.client.id,
            title: String(title).trim(),
            date: date || todayKey(),
            channels,
            channel: channels[0],
            format,
            notes: String(idea || '').trim() || null,
            refs: url ? [{ url, label: hostOf(url) }] : [],
            status: 'idea',
            origin: 'client',
            created_by: app.user?.id,
            notify: false,
          });
          upsertLocal('content', row);
          app.data.content.sort((a, b) => a.date.localeCompare(b.date));
          refresh();
          toast.success('Idea enviada al estudio', { description: 'La preparan y te la mandan a revisar.' });
          return true;
        } catch (err) {
          return fail('No se envió', err);
        }
      }}
    >
      <p className="text-sm text-muted sm:col-span-2">Le llega al estudio como idea: ellos la preparan y te la mandan a revisar.</p>
      <TextField name="title" isRequired maxLength={200} autoFocus className="sm:col-span-2">
        <Label>Título</Label>
        <Input placeholder="Lo que quieres publicar" />
      </TextField>
      <DateInput label="¿Para cuándo?" value={date} onChange={setDate} />
      <SelectField label="Formato" value={format} onChange={(v) => setFormat(v || 'post')} options={Object.entries(FORMAT).filter(([k]) => k !== 'otro')} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Redes</span>
        <ToggleButtonGroup aria-label="Redes" selectionMode="multiple" size="sm" selectedKeys={nets} onSelectionChange={setNets} className="flex-wrap">
          {NETS.map(([k, [label, color]], i) => (
            <ToggleButton key={k} id={k}>
              {i > 0 && <ToggleButtonGroup.Separator />}
              <span className="size-2 rounded-full" style={{ background: color }} />
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <TextField name="idea" maxLength={5000} className="sm:col-span-2">
        <Label>La idea</Label>
        <TextArea rows={4} placeholder="Qué se ve, qué dice, por qué ahora…" />
      </TextField>
      <TextField name="ref" type="url" maxLength={2000} className="sm:col-span-2">
        <Label>Un ejemplo que te guste (opcional)</Label>
        <Input inputMode="url" placeholder="https://…" />
      </TextField>
    </FormModal>
  );
}

/** Subir un recurso (un archivo o un enlace) para el estudio. */
export function RecursoModal({ onClose }) {
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  return (
    <FormModal
      title="Subir un recurso"
      submit="Subir"
      onClose={onClose}
      onSubmit={async ({ title, url }) => {
        const row = { client_id: app.client.id, title: String(title || '').trim(), category: 'Del cliente', origin: 'client', created_by: app.user?.id, notify: false };
        try {
          if (mode === 'link') {
            row.url = safeUrl(String(url || '').trim());
            if (!row.url) throw new Error('Pega un enlace que empiece por https://');
            row.kind = /youtu|vimeo|loom/.test(row.url) ? 'video' : 'link';
            row.title ||= hostOf(row.url);
          } else {
            if (!file) throw new Error('Elige un archivo.');
            const path = `${app.client.id}/recursos/${app.user.id}/${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
            setProgress(0);
            await app.backend.upload(path, file, setProgress);
            Object.assign(row, {
              storage_path: path,
              file_name: file.name,
              size: file.size,
              mime: file.type || null,
              kind: file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'doc' : 'file',
            });
            row.title ||= file.name.replace(/\.[^.]+$/, '');
          }
          upsertLocal('resources', await app.backend.save('resources', row));
          refresh();
          toast.success('Recurso compartido con el estudio');
          return true;
        } catch (err) {
          setProgress(null);
          return fail('No se subió', err);
        }
      }}
    >
      <ToggleButtonGroup aria-label="Qué subes" selectionMode="single" disallowEmptySelection fullWidth selectedKeys={new Set([mode])} onSelectionChange={(k) => setMode(String([...k][0]))} className="sm:col-span-2">
        <ToggleButton id="file">
          <File />
          Archivo
        </ToggleButton>
        <ToggleButton id="link">
          <ToggleButtonGroup.Separator />
          <LinkIcon />
          Enlace
        </ToggleButton>
      </ToggleButtonGroup>
      <div className="sm:col-span-2">
        {mode === 'file' ? (
          <FilePick file={file} onFile={setFile} progress={progress} hint="Hasta 50 MB" />
        ) : (
          <TextField name="url" type="url" maxLength={2000}>
            <Label>Enlace</Label>
            <Input inputMode="url" placeholder="https://…" />
          </TextField>
        )}
      </div>
      <TextField name="title" maxLength={200} className="sm:col-span-2">
        <Label>Título</Label>
        <Input placeholder="Fotos del local, logo, menú…" />
      </TextField>
    </FormModal>
  );
}

/** Registrar un lead o cambiarle la etapa y los datos. */
export function LeadModal({ lead, onClose, extra }) {
  const [source, setSource] = useState(lead?.source || 'instagram');
  const [stage, setStage] = useState(lead?.stage || 'nuevo');
  const [value, setValue] = useState(lead?.value ?? '');
  const [date, setDate] = useState(lead?.date || todayKey());
  return (
    <FormModal
      title={lead ? 'Editar lead' : 'Nuevo lead'}
      onClose={onClose}
      extra={extra}
      onSubmit={async ({ name, contact, campaign, notes }) => {
        const row = {
          name: String(name).trim(),
          contact: String(contact || '').trim() || null,
          source,
          stage,
          value: Number(value) || null,
          date: date || todayKey(),
          campaign: String(campaign || '').trim() || null,
          notes: String(notes || '').trim() || null,
        };
        try {
          const saved = await app.backend.save('leads', lead?.id ? { ...row, id: lead.id } : { ...row, client_id: app.client.id });
          upsertLocal('leads', saved);
          refresh();
          toast.success(lead ? 'Guardado' : 'Lead registrado');
          return true;
        } catch (err) {
          return fail('No se guardó', err);
        }
      }}
    >
      <TextField name="name" isRequired maxLength={120} defaultValue={lead?.name || ''} autoFocus>
        <Label>Quién</Label>
        <Input placeholder="Nombre o empresa" />
      </TextField>
      <TextField name="contact" maxLength={200} defaultValue={lead?.contact || ''}>
        <Label>Contacto</Label>
        <Input placeholder="Teléfono, correo o @usuario" />
      </TextField>
      <SelectField label="Llegó por" value={source} onChange={(v) => setSource(v || 'otro')} options={Object.entries(LEAD_SOURCE)} />
      <SelectField label="Etapa" value={stage} onChange={(v) => setStage(v || 'nuevo')} options={Object.entries(LEAD_STAGE).map(([k, [l]]) => [k, l])} />
      <AmountField label="Valor (USD)" value={value} onChange={setValue} />
      <DateInput label="Fecha" value={date} onChange={setDate} />
      <TextField name="campaign" maxLength={120} defaultValue={lead?.campaign || ''} className="sm:col-span-2">
        <Label>Campaña (opcional)</Label>
        <Input />
      </TextField>
      <TextField name="notes" maxLength={2000} defaultValue={lead?.notes || ''} className="sm:col-span-2">
        <Label>Notas</Label>
        <TextArea rows={2} placeholder="Qué busca, cómo llegó…" />
      </TextField>
    </FormModal>
  );
}
