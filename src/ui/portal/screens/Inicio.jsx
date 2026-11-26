// Inicio del cliente: saludo, «Hoy en tu proyecto» con su anillo de progreso, el
// anuncio fijado, lo que tiene que aprobar, lo que le pedimos, sus documentos
// pendientes, la próxima reunión, su proyecto y lo último que pasó.
import { ArrowRight, CircleCheck, Thunderbolt } from '@gravity-ui/icons';
import { Alert, Button, Card, Chip, Link, ProgressBar, ProgressCircle } from '@heroui/react';
import { Panel } from '../../kit/parts.jsx';
import { ago, cap, dayDate, dueText, fDay, fShort, minutesText, money, todayKey } from '../../../portal/kit.js';
import {
  CHANNEL,
  CONTENT_STATUS,
  DOC_TYPE,
  MEETING_MODE,
  PRIORITY,
  can,
  channelsOf,
  currentProject,
  docState,
  doingNow,
  feed,
  nextMeeting,
  pendingDocs,
  pendingTasks,
  toReview,
  unread,
  visibleContent,
  workToday,
} from '../../../portal/state.js';
import { usePortal } from '../store.js';
import { Bubble, Tone } from '../ui.jsx';

function greeting(name) {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const first = String(name || '').trim().split(/\s+/)[0];
  return first ? `${hello}, ${first}` : hello;
}

export function FeedRow({ item, fresh }) {
  const body = item.report ? item.report.done.map((w) => w.title).slice(0, 3).join(' · ') : item.body;
  const inner = (
    <>
      <Bubble name={item.ico} color={item.color} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-xs text-muted">
          {item.label}
          {fresh && (
            <Chip size="sm" color="accent" variant="soft">
              Nuevo
            </Chip>
          )}
        </span>
        <span className="truncate text-sm font-medium">{item.title}</span>
        {body && <span className="line-clamp-2 text-xs text-muted">{body}</span>}
      </span>
      <span className="shrink-0 text-xs text-muted">{ago(item.at)}</span>
    </>
  );
  const cls = 'flex items-start gap-3 rounded-2xl px-2 py-2.5';
  return item.go ? (
    <a href={item.go} className={`${cls} hover:bg-surface-secondary`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Inicio() {
  const [app] = usePortal();
  const today = workToday();
  const done = today.filter((w) => w.status === 'done');
  const doing = doingNow();
  const minutes = done.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const pinned = app.data.posts.find((p) => p.pinned && p.kind === 'announcement');
  const review = can('calendario') ? toReview() : [];
  const asks = can('peticiones') ? pendingTasks() : [];
  const docs = pendingDocs();
  const meeting = nextMeeting();
  const project = currentProject();
  const upcoming = can('calendario')
    ? visibleContent()
        .filter((c) => c.date >= todayKey() && c.status !== 'idea')
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 4)
    : [];
  const news = new Set(unread().map((x) => x.id));
  const latest = feed().slice(0, 6);
  const pct = today.length ? Math.round((done.length / today.length) * 100) : 0;
  const stagesDone = project ? (project.stages || []).filter((s) => s.done).length : 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="sw-eyebrow">{cap(fDay.format(new Date()))}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{greeting(app.member?.name)}</h1>
        {app.client.welcome && <p className="text-sm text-muted">{app.client.welcome}</p>}
      </header>

      {pinned && (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{pinned.title}</Alert.Title>
            {pinned.body && <Alert.Description>{pinned.body}</Alert.Description>}
          </Alert.Content>
        </Alert>
      )}

      {can('reporte') && (
        <Card className="gap-4">
          <div className="flex items-center gap-4">
            <ProgressCircle aria-label="Tareas de hoy" value={pct} size="lg" color="success">
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
            <div className="flex min-w-0 flex-col">
              <span className="sw-eyebrow">Hoy en tu proyecto</span>
              <span className="sw-figure text-3xl">
                {done.length}
                <span className="text-muted">/{today.length || 0}</span>
              </span>
              <span className="text-xs text-muted">{done.length ? `tareas hechas${minutes ? ` · ${minutesText(minutes)}` : ''}` : 'Todavía no hay tareas hechas hoy'}</span>
            </div>
          </div>
          {doing.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {doing.map((w) => (
                <li key={w.id} className="flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
                  <Thunderbolt className="size-4 text-warning" />
                  <span className="flex-1 truncate">{w.title}</span>
                  <Chip size="sm" variant="soft" color="warning">
                    Ahora
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {done.slice(0, 4).map((w) => (
                <li key={w.id} className="flex items-center gap-2">
                  <CircleCheck className="size-4 text-success" />
                  <span className="flex-1 truncate">{w.title}</span>
                  {w.minutes ? <span className="text-xs text-muted">{minutesText(w.minutes)}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <Link href="#/cronologia/reportes" className="text-sm">
            Ver los reportes
            <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      )}

      {review.length > 0 && (
        <Panel title="Para aprobar" description={`${review.length} ${review.length === 1 ? 'publicación espera' : 'publicaciones esperan'} tu visto bueno`}>
          <ul className="flex flex-col">
            {review.map((c) => (
              <li key={c.id}>
                <a href={`#/marketing/pieza/${c.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                  <Bubble name="sparkles" color={CHANNEL[channelsOf(c)[0]]?.[1]} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="text-xs text-muted">{cap(fDay.format(dayDate(c.date)))}</span>
                  </span>
                  <Chip size="sm" variant="soft" color="accent">
                    Revisar
                  </Chip>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {asks.length > 0 && (
        <Panel
          title="Te pedimos"
          action={
            <Link href="#/peticiones" className="text-sm">
              Todas
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <ul className="flex flex-col">
            {asks.slice(0, 3).map((t) => {
              const [when, late] = t.due_date ? dueText(t.due_date) : ['Sin fecha', ''];
              return (
                <li key={t.id}>
                  <a href="#/peticiones" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                    <Bubble name="inbox" color={PRIORITY[t.priority]?.[1]} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <span className={`text-xs ${late === 'is-late' ? 'text-danger' : 'text-muted'}`}>{when}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {docs.length > 0 && (
          <Panel title="Facturas y documentos" description="Esperan algo de ti">
            <ul className="flex flex-col">
              {docs.map((d) => {
                const [word, ico, color] = DOC_TYPE[d.type] || DOC_TYPE.invoice;
                const [stateLabel, stateColor] = docState(d);
                return (
                  <li key={d.id}>
                    <a href="#/documentos" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                      <Bubble name={ico} color={color} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{d.title || `${word} ${d.number}`}</span>
                        <span className="text-xs text-muted">{money(Math.max(0, (d.total || 0) - (d.paid || 0)))}</span>
                      </span>
                      <Tone label={stateLabel} color={stateColor} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {meeting && (
          <Panel title="Próxima reunión">
            <div className="flex items-start gap-3">
              <Bubble name={MEETING_MODE[meeting.mode]?.[1] || 'calendar'} color="var(--cf-income)" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{meeting.topic}</span>
                <span className="text-sm text-muted">
                  {cap(fDay.format(new Date(meeting.starts_at)))} · {new Date(meeting.starts_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} · {MEETING_MODE[meeting.mode]?.[0]}
                </span>
                {meeting.link && (
                  <Button size="sm" className="mt-1 w-fit" onPress={() => window.open(meeting.link, '_blank', 'noopener')}>
                    Unirse
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        )}

        {project && (
          <Panel
            title={project.name}
            description={`${stagesDone} de ${(project.stages || []).length} etapas`}
            action={
              <Link href="#/proyecto" className="text-sm">
                Ver
                <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <ProgressBar value={project.tasks_total ? (project.tasks_done / project.tasks_total) * 100 : 0} size="sm" color="accent">
              <span className="text-sm">Tareas hechas</span>
              <ProgressBar.Output>{`${project.tasks_done}/${project.tasks_total}`}</ProgressBar.Output>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ol className="mt-3 flex flex-wrap gap-1.5">
              {(project.stages || []).map((s) => (
                <li key={s.name}>
                  <Chip size="sm" variant={s.done ? 'soft' : 'tertiary'} color={s.done ? 'success' : 'default'}>
                    {s.done && <CircleCheck className="size-3" />}
                    <Chip.Label>{s.name}</Chip.Label>
                  </Chip>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {upcoming.length > 0 && (
          <Panel
            title="Próximo en el calendario"
            action={
              <Link href="#/marketing" className="text-sm">
                Calendario
                <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <ul className="flex flex-col">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <a href={`#/marketing/pieza/${c.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-secondary">
                    <span className="flex w-10 shrink-0 flex-col items-center rounded-xl bg-surface-secondary py-1">
                      <span className="text-[10px] uppercase text-muted">{fShort.format(dayDate(c.date)).split(' ')[1]?.replace('.', '')}</span>
                      <span className="sw-figure text-lg">{dayDate(c.date).getDate()}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{c.title}</span>
                      <span className="text-xs text-muted">{(c.time || '').slice(0, 5)}</span>
                    </span>
                    <Tone label={CONTENT_STATUS[c.status]?.[0]} color={CONTENT_STATUS[c.status]?.[1]} />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {can('cronologia') && (
        <Panel
          title="Lo último"
          action={
            <Link href="#/cronologia" className="text-sm">
              Cronología
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {latest.length ? (
            <ul className="flex flex-col">
              {latest.map((item) => (
                <li key={item.id}>
                  <FeedRow item={item} fresh={news.has(item.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todavía no ha pasado nada.</p>
          )}
        </Panel>
      )}
    </div>
  );
}
