// El proyecto del cliente (#/proyecto), tal como lo lleva Negocio: en qué etapa va, el
// avance de las tareas, las horas, las fechas, lo próximo con fecha, los hitos y
// entregas y los otros proyectos. Negocio lo escribe en portal_projects; aquí solo se ve.
import { ArrowRight, Flag, Folder } from '@gravity-ui/icons';
import { Card, Chip, Link, ProgressCircle } from '@heroui/react';
import { ago, cap, dayDate, dueText, fDay, fShort, minutesText } from '../../../portal/kit.js';
import { POST_KIND, app, can, currentProject, has } from '../../../portal/state.js';
import { usePortal } from '../store.js';
import { Empty, Panel } from '../../kit/parts.jsx';
import { Stepper } from '../../pro/index.js';
import { Bubble, Tone } from '../ui.jsx';

const STATUS = { pending: ['Por empezar', 'var(--muted)'], active: ['En curso', 'var(--accent)'], paused: ['En pausa', 'var(--warning)'], completed: ['Completado', 'var(--success)'] };
const UPCOMING = { request: ['Solicitud', 'var(--muted)'], todo: ['Por hacer', 'var(--muted)'], doing: ['En curso', 'var(--warning)'], review: ['En revisión', 'var(--accent)'] };

export function Proyecto() {
  usePortal();
  const p = currentProject();
  if (!p) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">Proyecto</h1>
        <Empty
          icon={Folder}
          title={has('projects') && can('project.view') ? 'Sin proyecto todavía' : 'Todavía no disponible'}
          text={has('projects') ? 'Cuando arranquemos tu proyecto verás aquí sus etapas y cómo avanza.' : 'El proyecto llega con la próxima actualización del portal.'}
        />
      </div>
    );
  }
  const ratio = p.tasks_total ? p.tasks_done / p.tasks_total : 0;
  const [state, color] = STATUS[p.status] || STATUS.active;
  const stages = p.stages || [];
  const current = stages.findIndex((s) => !s.done);
  const milestones = (app.data.posts || [])
    .filter((x) => x.kind === 'milestone' || x.kind === 'delivery')
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, 6);
  const others = app.data.projects.filter((x) => x.id !== p.id && !x.hidden);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tone label={state} color={color} />
          {p.code && <span className="font-mono text-xs text-muted">{p.code}</span>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
        {p.description && <p className="text-sm text-muted">{p.description}</p>}
      </header>

      <Card className="gap-5">
        <div className="flex items-center gap-4">
          <ProgressCircle aria-label="Tareas hechas" value={Math.round(ratio * 100)} size="lg" color="accent">
            <ProgressCircle.Track className="size-20">
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
          <div className="flex min-w-0 flex-col">
            <span className="sw-figure text-4xl">{Math.round(ratio * 100)}%</span>
            <span className="text-sm font-medium">
              {p.tasks_done} de {p.tasks_total} tareas hechas
            </span>
            <span className="text-xs text-muted">
              {[p.minutes_total && `${minutesText(p.minutes_total)} en total`, p.minutes_month && `${minutesText(p.minutes_month)} este mes`].filter(Boolean).join(' · ') || 'Sin horas apuntadas'}
            </span>
          </div>
        </div>
        {stages.length > 0 && (
          <Stepper
            label="Etapas del proyecto"
            numbered={false}
            current={current < 0 ? stages.length : current}
            steps={stages.map((s, i) => ({
              id: `${i}-${s.name}`,
              title: s.name,
              description: s.done && s.done_at ? `Hecha el ${fShort.format(new Date(s.done_at)).replace('.', '')}` : i === current ? 'Ahora' : null,
            }))}
          />
        )}
        {(p.start_date || p.due_date) && (
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-secondary p-3">
            {p.start_date && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted">Empezó</dt>
                <dd className="text-sm font-medium">{cap(fDay.format(dayDate(p.start_date)))}</dd>
              </div>
            )}
            {p.due_date && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted">Entrega</dt>
                <dd className="text-sm font-medium">{cap(fDay.format(dayDate(p.due_date)))}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {p.upcoming?.length > 0 && (
        <Panel title="Lo próximo" description="Lo que viene, con su fecha">
          <ul className="flex flex-col divide-y divide-border">
            {p.upcoming.map((u, i) => {
              const [word, tone] = UPCOMING[u.status] || UPCOMING.todo;
              const [when, late] = u.due ? dueText(u.due) : [null, ''];
              return (
                <li key={`${u.title}-${i}`} className="flex items-center gap-3 py-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: tone }} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{u.title}</span>
                    <span className={`text-xs ${late === 'is-late' ? 'text-danger' : 'text-muted'}`}>{[word, when].filter(Boolean).join(' · ')}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {milestones.length > 0 && (
        <Panel
          title="Hitos y entregas"
          action={
            <Link href="#/cronologia/avances" className="text-sm">
              Cronología
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <ul className="flex flex-col">
            {milestones.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-1.5">
                <Bubble name={POST_KIND[x.kind]?.[1] || 'flag'} color={POST_KIND[x.kind]?.[2]} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{x.title}</span>
                  <span className="text-xs text-muted">
                    {POST_KIND[x.kind]?.[0]} · {ago(x.occurred_at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {others.length > 0 && (
        <Panel title="Otros proyectos">
          <ul className="flex flex-col divide-y divide-border">
            {others.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2">
                <Flag className="size-4 text-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{o.name}</span>
                  <span className="text-xs text-muted">
                    {o.tasks_done} de {o.tasks_total} tareas
                  </span>
                </span>
                <Chip size="sm" variant="secondary">
                  {STATUS[o.status]?.[0] || ''}
                </Chip>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-xs text-muted">Se actualiza solo desde el trabajo del estudio{p.updated_at ? ` · último cambio ${ago(p.updated_at)}` : ''}.</p>
    </div>
  );
}
