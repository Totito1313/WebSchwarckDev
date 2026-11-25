// El proyecto del cliente, tal como lo lleva Negocio: etapas, avance de tareas, horas y lo
// próximo con fecha. Negocio lo escribe en portal_projects; aquí solo se enseña.

import { el, icon, emptyBox, sectionHead, cap, fDay, fShort, dayDate, dueText, minutesText, ago, countUp, chip } from './kit.js';
import { app, isStudio, has, can, currentProject, POST_KIND } from './state.js';
import { meetingCard } from './meetings.js';
import { docsCard } from './documents.js';

const STATUS = { pending: ['Por empezar', 'var(--cf-fg-faint)'], active: ['En curso', 'var(--cf-blue)'], paused: ['En pausa', 'var(--cf-orange)'], completed: ['Completado', 'var(--cf-income)'] };
const UPCOMING = { request: 'Solicitud', todo: 'Por hacer', doing: 'En curso', review: 'En revisión' };
const hours = (m) => (m >= 60 ? `${Math.round(m / 6) / 10} h`.replace('.', ',') : `${m || 0} min`);

function stepper(p, { big = false } = {}) {
  const stages = p.stages || [];
  const current = stages.findIndex((s) => !s.done);
  return el('ol', { class: `cl-stages${big ? ' is-big' : ''}`, style: { '--n': String(stages.length || 1) } },
    stages.map((s, i) => el('li', { class: s.done ? 'is-done' : i === current ? 'is-now' : '' },
      el('i', {}, s.done ? icon('check') : null),
      el('span', { text: s.name }),
      big && s.done && s.done_at && el('small', { text: fShort.format(new Date(s.done_at)).replace('.', '') }),
      big && i === current && el('small', { text: 'Ahora' }),
    )),
  );
}

/** La tarjeta de Inicio. */
export function projectCard() {
  const p = currentProject();
  if (!p) return null;
  const ratio = p.tasks_total ? p.tasks_done / p.tasks_total : 0;
  const [state, color] = STATUS[p.status] || STATUS.active;
  return el('a', { class: 'cl-card cl-project', href: '#/proyecto' },
    el('div', { class: 'cl-project-head' },
      el('span', { class: 'cl-set-main' }, el('small', { class: 'cl-eyebrow', text: 'Tu proyecto' }), el('b', { text: p.name })),
      chip(state, color),
    ),
    stepper(p),
    el('div', { class: 'cl-project-bar', style: { '--p': String(ratio) } }, el('i')),
    el('div', { class: 'cl-project-facts' },
      el('span', {}, el('b', { text: `${p.tasks_done} de ${p.tasks_total}` }), ' tareas'),
      p.minutes_month > 0 && el('span', {}, el('b', { text: hours(p.minutes_month) }), ' este mes'),
      p.due_date && el('span', {}, 'Entrega ', el('b', { text: fShort.format(dayDate(p.due_date)).replace('.', '') })),
    ),
  );
}

export function projectPage() {
  const p = currentProject();
  if (!p) {
    return { node: el('div', { class: 'cl-stack' }, emptyBox('folder', has('projects') ? 'Sin proyecto todavía' : 'Todavía no disponible', has('projects') ? (isStudio() ? 'Enlaza este portal a un cliente de Negocio: sus proyectos aparecen aquí solos.' : 'Cuando arranquemos tu proyecto verás aquí sus etapas y cómo avanza.') : 'El proyecto llega con la próxima actualización del portal.')), title: 'Proyecto' };
  }
  const ratio = p.tasks_total ? p.tasks_done / p.tasks_total : 0;
  const [state, color] = STATUS[p.status] || STATUS.active;
  const milestones = (app.data.posts || []).filter((x) => x.kind === 'milestone' || x.kind === 'delivery').sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 6);
  const others = app.data.projects.filter((x) => x.id !== p.id && !x.hidden);
  const node = el('div', { class: 'cl-stack' },
    el('section', { class: 'cl-card cl-project is-page' },
      el('div', { class: 'cl-project-head' }, chip(state, color), p.code && el('small', { class: 'cl-project-code', text: p.code })),
      p.description && el('p', { class: 'cl-project-desc', text: p.description }),
      el('div', { class: 'cl-project-ring' },
        el('span', { class: 'cl-ring is-big', style: { '--p': String(ratio) } }, countUp(el('b'), Math.round(ratio * 100), (v) => `${Math.round(v)}%`)),
        el('div', {},
          el('b', { text: `${p.tasks_done} de ${p.tasks_total} tareas hechas` }),
          el('small', { text: [p.minutes_total && `${minutesText(p.minutes_total)} en total`, p.minutes_month && `${minutesText(p.minutes_month)} este mes`].filter(Boolean).join(' · ') || 'Sin horas apuntadas' }),
        ),
      ),
      stepper(p, { big: true }),
      el('div', { class: 'cl-project-dates' },
        p.start_date && el('span', {}, el('small', { text: 'Empezó' }), el('b', { text: cap(fDay.format(dayDate(p.start_date))) })),
        p.due_date && el('span', {}, el('small', { text: 'Entrega' }), el('b', { text: cap(fDay.format(dayDate(p.due_date))) })),
      ),
    ),
    p.upcoming?.length > 0 && el('section', { class: 'cl-sec' },
      sectionHead('Lo próximo', null, 'Lo que viene, con su fecha'),
      el('div', { class: 'cl-card cl-upcoming' }, p.upcoming.map((u) => el('div', { class: 'cl-upcoming-row' },
        el('span', { class: `cl-upcoming-dot is-${u.status || 'todo'}` }),
        el('span', { class: 'cl-set-main' }, el('b', { text: u.title }), el('small', { text: [UPCOMING[u.status], u.due && dueText(u.due)[0]].filter(Boolean).join(' · ') })),
      ))),
    ),
    meetingCard(),
    docsCard(),
    milestones.length > 0 && el('section', { class: 'cl-sec' },
      sectionHead('Hitos y entregas', el('a', { class: 'cl-more', href: '#/cronologia?avances' }, 'Cronología', icon('right'))),
      el('div', { class: 'cl-card cl-mini-feed' }, milestones.map((x) => el('div', { class: 'cl-tl-mini' },
        el('span', { class: 'cl-tl-ico', style: { '--c': POST_KIND[x.kind]?.[2] } }, icon(POST_KIND[x.kind]?.[1] || 'flag')),
        el('span', { class: 'cl-set-main' }, el('b', { text: x.title }), el('small', { text: `${POST_KIND[x.kind]?.[0]} · ${ago(x.occurred_at)}` })),
      ))),
    ),
    others.length > 0 && el('section', { class: 'cl-sec' },
      sectionHead('Otros proyectos'),
      el('div', { class: 'cl-list' }, others.map((o) => el('div', { class: 'cl-row' },
        el('span', { class: 'cl-set-main' }, el('b', { text: o.name }), el('small', { text: `${o.tasks_done} de ${o.tasks_total} tareas · ${STATUS[o.status]?.[0] || ''}` })),
        chip(STATUS[o.status]?.[0] || '', STATUS[o.status]?.[1]),
      ))),
    ),
    isStudio() && el('p', { class: 'cl-fine', text: `Se actualiza solo desde Negocio${p.updated_at ? ` · último cambio ${ago(p.updated_at)}` : ''}.` }),
  );
  return { node, title: 'Proyecto', large: p.name, sub: 'Cómo avanza tu proyecto' };
}

export const canSeeProject = () => has('projects') && can('project.view');
