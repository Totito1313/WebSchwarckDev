// Reuniones (#/reuniones): el cliente pide una (tema, cómo, cuánto y hasta tres
// horarios que le vienen bien) y el estudio la confirma con uno de ellos o propone otra
// hora. La próxima sale en Inicio con «Unirse» y «Añadir al calendario» (un .ics con
// aviso 15 minutos antes). Quien la pidió la puede cancelar. El estudio agenda, confirma la
// pedida (o dice que no puede), la edita, la marca como hecha o la cancela.
import { useState } from 'react';
import { Calendar, Check, Clock, FileText, Handset, MapPin, Pencil, Play, Plus, Video, Xmark } from '@gravity-ui/icons';
import { Button, Chip, Input, Label, TextArea, TextField, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { ago, cap, fDay, fTime } from '../../../portal/kit.js';
import { MEETING_MODE, MEETING_STATUS, app, can, has, isMine, myName, nextMeeting, upsertLocal } from '../../../portal/state.js';
import { go, refresh, usePortal } from '../store.js';
import { ConfirmDialog, FormModal } from '../../negocio/fields.jsx';
import { Empty, Panel } from '../../kit/parts.jsx';
import { Hoja, Tone } from '../ui.jsx';
import { edit, setMeetingStatus } from '../estudio/Editores.jsx';

const DURATIONS = [30, 45, 60, 90];
const durText = (n) => (n < 60 ? `${n} min` : n === 60 ? '1 h' : `1 h ${n - 60}`);
const MODE_ICON = { video: Video, call: Handset, in_person: MapPin };
const whenText = (iso) => `${cap(fDay.format(new Date(iso)))} · ${fTime.format(new Date(iso))}`;
const endOf = (m) => new Date(new Date(m.starts_at).getTime() + (m.duration || 30) * 60_000);
const isPast = (m) => m.starts_at && endOf(m) < new Date();
const isLive = (m) => m.starts_at && new Date(m.starts_at) <= new Date() && !isPast(m);
export const canRequest = () => has('meetings') && !app.studio && can('meetings.request');

/** «Añadir al calendario»: un .ics con aviso 15 minutos antes. */
export function downloadIcs(m) {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Schwarck//Portal//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${m.id}@schwarckdev.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(m.starts_at))}`,
    `DTEND:${stamp(endOf(m))}`,
    `SUMMARY:${esc(`${m.topic} · Schwarck`)}`,
    m.notes && `DESCRIPTION:${esc(m.notes)}`,
    (m.link || m.place) && `LOCATION:${esc(m.link || m.place)}`,
    m.link && `URL:${m.link}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Reunión en 15 minutos', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })), download: 'reunion.ics' });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

/** La hoja del día y el mes, como en un calendario de papel. */
function DateTile({ iso }) {
  const d = new Date(iso);
  return (
    <span className="flex w-12 shrink-0 flex-col items-center rounded-2xl bg-surface-secondary py-1.5">
      <span className="text-[10px] uppercase text-muted">{d.toLocaleDateString('es', { month: 'short' }).replace('.', '')}</span>
      <span className="sw-figure text-xl leading-none">{d.getDate()}</span>
    </span>
  );
}

/** En Inicio: la próxima reunión (o la pedida que espera respuesta). */
export function MeetingCard() {
  usePortal();
  if (!has('meetings')) return null;
  const next = nextMeeting();
  const asked = app.data.meetings.filter((m) => m.status === 'requested' && !app.studio && isMine(m));
  if (!next && !asked.length) return null;
  if (!next) {
    return (
      <Panel title="Pediste una reunión" description="Esperando que Schwarck confirme la hora">
        <a href="#/reuniones" className="flex items-center gap-3 rounded-2xl px-1 py-1 hover:bg-surface-secondary">
          <Calendar className="size-5 text-warning" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{asked[0].topic}</span>
        </a>
      </Panel>
    );
  }
  const live = isLive(next);
  const Icon = MODE_ICON[next.mode] || Calendar;
  return (
    <Panel title={live ? 'Reunión ahora' : 'Próxima reunión'}>
      <div className="flex items-start gap-3">
        <DateTile iso={next.starts_at} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <a href="#/reuniones" className="truncate font-medium hover:underline">
            {next.topic}
          </a>
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Icon className="size-3.5" />
            {fTime.format(new Date(next.starts_at))} · {MEETING_MODE[next.mode]?.[0]} · {durText(next.duration || 30)}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {next.link && (
              <Button size="sm" variant={live ? 'primary' : 'secondary'} onPress={() => window.open(next.link, '_blank', 'noopener')}>
                <Play />
                {live ? 'Unirse ahora' : 'Enlace'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onPress={() => downloadIcs(next)}>
              <Calendar />
              Al calendario
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Pedir una reunión: tema, modalidad, duración y hasta tres horarios. */
function PedirReunion({ onClose }) {
  // Por defecto: el próximo día laborable a las 10 y el siguiente a las 16.
  const workday = (n, hour) => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    let added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
  };
  const [mode, setMode] = useState(() => localStorage.getItem('portal:meet-mode') || 'video');
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState([workday(1, 10), workday(2, 16), '']);
  return (
    <FormModal
      title="Pedir una reunión"
      submit="Pedir reunión"
      onClose={onClose}
      onSubmit={async ({ topic, notes }) => {
        if (!String(topic || '').trim()) {
          toast.danger('Escribe de qué quieres hablar.');
          return false;
        }
        const options = [...new Set(slots.filter(Boolean).map((s) => new Date(s).toISOString()))].filter((iso) => new Date(iso) > new Date()).sort();
        if (!options.length) {
          toast.danger('Propón al menos un horario que no haya pasado.');
          return false;
        }
        try {
          localStorage.setItem('portal:meet-mode', mode);
          const row = await app.backend.save('meetings', {
            client_id: app.client.id,
            topic: String(topic).trim(),
            notes: String(notes || '').trim() || null,
            mode,
            duration,
            options,
            origin: 'client',
            status: 'requested',
            created_by: app.user?.id,
            author: myName(),
          });
          upsertLocal('meetings', row);
          refresh();
          toast.success('Reunión pedida', { description: 'Te avisamos cuando confirmemos la hora.' });
          return true;
        } catch (err) {
          toast.danger('No se pidió', { description: err.message });
          return false;
        }
      }}
    >
      <p className="text-sm text-muted sm:col-span-2">Propón hasta tres horarios que te vengan bien: confirmamos uno y te avisamos.</p>
      <TextField name="topic" isRequired maxLength={200} autoFocus className="sm:col-span-2">
        <Label>Tema</Label>
        <Input placeholder="Ideas para la campaña de Navidad" />
      </TextField>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Cómo</span>
        <ToggleButtonGroup aria-label="Cómo" selectionMode="single" disallowEmptySelection fullWidth size="sm" selectedKeys={new Set([mode])} onSelectionChange={(k) => setMode(String([...k][0]))}>
          {Object.entries(MEETING_MODE).map(([k, [label]], i) => {
            const Icon = MODE_ICON[k];
            return (
              <ToggleButton key={k} id={k}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                <Icon />
                {label}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Duración</span>
        <ToggleButtonGroup aria-label="Duración" selectionMode="single" disallowEmptySelection fullWidth size="sm" selectedKeys={new Set([String(duration)])} onSelectionChange={(k) => setDuration(Number([...k][0]))}>
          {DURATIONS.map((n, i) => (
            <ToggleButton key={n} id={String(n)}>
              {i > 0 && <ToggleButtonGroup.Separator />}
              {durText(n)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium">Horarios</span>
        {slots.map((v, i) => (
          <label key={i} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted">Opción {i + 1}</span>
            <Input
              type="datetime-local"
              step={900}
              aria-label={`Opción ${i + 1}`}
              value={v}
              onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1"
            />
          </label>
        ))}
      </div>
      <TextField name="notes" maxLength={2000} className="sm:col-span-2">
        <Label>Notas (opcional)</Label>
        <TextArea rows={3} placeholder="Qué quieres tratar" />
      </TextField>
    </FormModal>
  );
}

/** Ver una reunión: cuándo, cómo, el enlace; cancelar la propia. */
function ReunionHoja({ m, onClose }) {
  const [confirm, setConfirm] = useState(false);
  const [state, color] = MEETING_STATUS[m.status] || MEETING_STATUS.requested;
  const Icon = MODE_ICON[m.mode] || Calendar;
  const mine = !app.studio && isMine(m) && ['requested', 'confirmed'].includes(m.status) && !isPast(m);
  const cancel = async () => {
    try {
      upsertLocal('meetings', await app.backend.save('meetings', { id: m.id, status: 'cancelled' }));
      refresh();
      toast.success('Reunión cancelada', { description: 'Avisamos al equipo.' });
      onClose();
    } catch (err) {
      toast.danger('No se canceló', { description: err.message });
    }
  };
  return (
    <Hoja
      eyebrow="Reunión"
      title={m.topic}
      onClose={onClose}
      footer={
        <>
          {app.studio && m.status === 'confirmed' && (
            <>
              <Button variant="danger-soft" onPress={() => setMeetingStatus(m, 'cancelled', 'Reunión cancelada').then(onClose)}>
                <Xmark />
                Cancelar
              </Button>
              {isPast(m) && (
                <Button variant="secondary" onPress={() => setMeetingStatus(m, 'done', 'Reunión hecha').then(onClose)}>
                  <Check />
                  Hecha
                </Button>
              )}
            </>
          )}
          {app.studio && (
            <Button variant="secondary" onPress={() => edit('meeting', { meeting: m })}>
              <Pencil />
              Editar
            </Button>
          )}
          {mine && (
            <Button variant="danger-soft" onPress={() => setConfirm(true)}>
              Cancelar la reunión
            </Button>
          )}
          {m.status === 'confirmed' && !isPast(m) && (
            <Button variant="secondary" onPress={() => downloadIcs(m)}>
              <Calendar />
              Al calendario
            </Button>
          )}
          {m.status === 'confirmed' && m.link && !isPast(m) && (
            <Button onPress={() => window.open(m.link, '_blank', 'noopener')}>
              <Play />
              Unirse
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <Tone label={state} color={color} />
        <Chip size="sm" variant="secondary">
          <Icon className="size-3" />
          {MEETING_MODE[m.mode]?.[0] || 'Reunión'}
        </Chip>
        <Chip size="sm" variant="secondary">
          <Clock className="size-3" />
          {durText(m.duration || 30)}
        </Chip>
      </div>
      {m.starts_at && (
        <p className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5 font-medium">
          <Calendar className="size-4 text-muted" />
          {whenText(m.starts_at)}
        </p>
      )}
      {!m.starts_at && m.options?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="sw-eyebrow">{app.studio ? 'Los horarios que propuso' : 'Los horarios que propusiste'}</span>
          {m.options.map((o) => (
            <span key={o} className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
              <Clock className="size-4 text-muted" />
              {whenText(o)}
            </span>
          ))}
        </div>
      )}
      {m.place && (
        <p className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted" />
          {m.place}
        </p>
      )}
      {m.notes && (
        <p className="flex gap-2 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
          {m.notes}
        </p>
      )}
      {m.studio_note && <p className="rounded-2xl bg-accent/10 px-3 py-2.5 text-sm">«{m.studio_note}» — Schwarck</p>}
      <p className="text-xs text-muted">{m.origin === 'client' ? !app.studio && isMine(m) ? `La pediste ${ago(m.created_at)}` : `La pidió ${m.author || (app.studio ? 'el cliente' : 'tu equipo')} ${ago(m.created_at)}` : `La agendó Schwarck ${ago(m.created_at)}`}</p>
      <ConfirmDialog open={confirm} title="¿Cancelar la reunión?" text="Avisaremos al equipo." confirm="Cancelar la reunión" onConfirm={cancel} onClose={() => setConfirm(false)} />
    </Hoja>
  );
}

function MeetingRow({ m, onOpen }) {
  const [state, color] = MEETING_STATUS[m.status] || MEETING_STATUS.requested;
  const Icon = MODE_ICON[m.mode] || Calendar;
  const when = m.starts_at ? `${new Date(m.starts_at).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${fTime.format(new Date(m.starts_at))}` : m.options?.length ? `${app.studio ? 'Propuso' : 'Propusiste'} ${m.options.length === 1 ? 'un horario' : `${m.options.length} horarios`}` : '';
  return (
    <li>
      <button type="button" onClick={() => onOpen(m)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus">
        {m.starts_at ? (
          <DateTile iso={m.starts_at} />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <Calendar className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{m.topic}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted">
            <Icon className="size-3" />
            {when}
          </span>
        </span>
        <Tone label={state} color={color} />
      </button>
    </li>
  );
}

export function Reuniones({ action }) {
  usePortal();
  const [open, setOpen] = useState(null);
  const asking = action === 'pedir' && canRequest();
  // Al estudio, la pedida se abre para responderla.
  const openRow = (m) => (app.studio && m.status === 'requested' ? edit('confirmMeeting', { meeting: m }) : setOpen(m));
  const all = has('meetings') ? [...app.data.meetings] : [];
  const upcoming = all.filter((m) => m.status === 'confirmed' && !isPast(m)).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const asked = all.filter((m) => m.status === 'requested').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const past = all.filter((m) => !upcoming.includes(m) && !asked.includes(m)).sort((a, b) => new Date(b.starts_at || b.created_at) - new Date(a.starts_at || a.created_at));
  const list = (items) => (
    <ul className="flex flex-col">
      {items.map((m) => (
        <MeetingRow key={m.id} m={m} onOpen={openRow} />
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reuniones</h1>
          <p className="text-sm text-muted">{app.studio ? `Las reuniones con ${app.client.name}.` : 'Para hablar con el equipo de Schwarck.'}</p>
        </div>
        {app.studio && has('meetings') && (
          <Button onPress={() => edit('meeting')}>
            <Plus />
            Agendar
          </Button>
        )}
        {canRequest() && (
          <Button onPress={() => go('#/reuniones/pedir')}>
            <Plus />
            Pedir una reunión
          </Button>
        )}
      </header>
      {!has('meetings') && <Empty icon={Calendar} title="Todavía no disponible" text="Las reuniones llegan con la próxima actualización del portal." />}
      {has('meetings') && !all.length && <Empty icon={Calendar} title="Sin reuniones" text="Cuando quieras hablar con el equipo, pide una reunión con los horarios que te vienen bien." />}
      {asked.length > 0 && (
        <Panel title="Pedidas" description={app.studio ? 'Toca una para confirmar la hora' : 'Te avisamos cuando confirmemos la hora'}>
          {list(asked)}
        </Panel>
      )}
      {upcoming.length > 0 && <Panel title="Próximas">{list(upcoming)}</Panel>}
      {past.length > 0 && <Panel title="Anteriores">{list(past.slice(0, 20))}</Panel>}
      {open && <ReunionHoja m={app.data.meetings.find((x) => x.id === open.id) || open} onClose={() => setOpen(null)} />}
      {asking && <PedirReunion onClose={() => location.replace('#/reuniones')} />}
    </div>
  );
}
