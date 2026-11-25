// El informe del mes: lo que hizo el estudio (tareas y horas por área), lo que se publicó, los
// resultados frente al mes anterior, los leads, los hitos, las reuniones y el proyecto. Con la
// marca del cliente y listo para guardar en PDF (imprimir) o compartir. Solo enseña lo que
// quien mira tiene permiso para ver.

import { el, icon, sectionHead, emptyBox, cap, fDay, fMonth, dayDate, minutesText, compact, num, money, shortDate, countUp, initials, copyText, todayKey } from './kit.js';
import { react } from './feel.js';
import { app, can, isStudio, has, CHANNEL, FORMAT, channelsOf, visibleContent, LEAD_STAGE, POST_KIND, urlOf, currentProject, MEETING_STATUS } from './state.js';

const ym = (key) => key.slice(0, 7);
const shift = (month, n) => {
  const d = new Date(`${month}-15T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('en-CA').slice(0, 7);
};
/** El mes que se enseña por defecto: los primeros días, el que acaba de cerrar. */
export const defaultReportMonth = () => (new Date().getDate() <= 7 ? shift(ym(todayKey()), -1) : ym(todayKey()));
const monthLabel = (month) => fMonth.format(dayDate(`${month}-15`));
const inMonth = (iso, month) => Boolean(iso) && String(iso).slice(0, 7) === month;
const localMonth = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA').slice(0, 7) : '');
const delta = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 100) : null);

function kpi(label, value, { sub, ico, color, format } = {}) {
  return el('div', { class: 'cl-rep-kpi', style: color ? { '--c': color } : null },
    el('small', {}, ico && icon(ico), label),
    countUp(el('b'), Number(value) || 0, format || ((v) => num(Math.round(v)))),
    sub && el('span', { class: 'cl-rep-sub', text: sub }),
  );
}

function bars(rows) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return el('div', { class: 'cl-rep-bars' }, rows.map((r, i) => el('div', { class: 'cl-rep-bar', style: { '--p': String(r.value / top), '--i': i, '--c': r.color || 'var(--accent)' } },
    el('span', { text: r.label }), el('i'), el('b', { text: r.text }),
  )));
}

export function reportPage(month = defaultReportMonth()) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) month = defaultReportMonth();
  const d = app.data;
  const prev = shift(month, -1);
  const label = monthLabel(month);
  const sections = [];

  // ── Trabajo del estudio ──
  const work = can('reporte') ? d.work.filter((w) => w.status === 'done' && ym(w.day) === month) : [];
  const minutes = work.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const byCat = new Map();
  for (const w of work) byCat.set(w.category || 'Otros', (byCat.get(w.category || 'Otros') || 0) + (Number(w.minutes) || 0));

  // ── Contenido ──
  const content = can('calendario') ? visibleContent() : [];
  const published = content.filter((c) => c.status === 'published' && ym(c.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const byNet = new Map();
  for (const c of published) for (const ch of channelsOf(c)) byNet.set(ch, (byNet.get(ch) || 0) + 1);
  const nextMonth = content.filter((c) => ym(c.date) === shift(month, 1)).length;

  // ── Resultados ──
  const metric = (m) => (can('rendimiento') ? d.metrics.find((x) => x.channel === 'total' && ym(x.month) === m) : null);
  const now = metric(month);
  const before = metric(prev);

  // ── Leads, peticiones, hitos, reuniones ──
  const leads = can('leads') ? d.leads.filter((l) => ym(l.date || '') === month) : [];
  const won = leads.filter((l) => l.stage === 'ganado');
  const tasksDone = can('peticiones') ? d.tasks.filter((t) => t.status === 'done' && localMonth(t.done_at) === month) : [];
  const milestones = d.posts.filter((p) => ['milestone', 'delivery', 'report'].includes(p.kind) && localMonth(p.occurred_at) === month);
  const meetings = has('meetings') ? d.meetings.filter((m) => m.starts_at && localMonth(m.starts_at) === month && ['confirmed', 'done'].includes(m.status)) : [];
  const ratings = has('ratings') && isStudio() ? d.ratings.filter((r) => ym(r.month) === month) : [];

  const kpis = [
    can('reporte') && kpi('Tareas hechas', work.length, { ico: 'tasks', color: 'var(--cf-income)', sub: minutes ? `${minutesText(minutes)} de trabajo` : null }),
    can('calendario') && kpi('Publicaciones', published.length, { ico: 'megaphone', color: 'var(--cf-purple)', sub: byNet.size ? [...byNet].map(([k, n]) => `${n} en ${CHANNEL[k]?.[0] || k}`).slice(0, 2).join(' · ') : null }),
    now && kpi('Alcance', now.reach || 0, { ico: 'eye', color: 'var(--cf-blue)', format: (v) => compact(v), sub: before?.reach ? `${delta(now.reach, before.reach) >= 0 ? '+' : ''}${delta(now.reach, before.reach)}% frente a ${monthLabel(prev).split(' ')[0]}` : null }),
    (now || can('leads')) && kpi('Leads', now ? now.leads || 0 : leads.length, { ico: 'funnel', color: 'var(--cf-orange)', sub: won.length ? `${won.length} ${won.length === 1 ? 'ganado' : 'ganados'}` : null }),
    can('peticiones') && tasksDone.length > 0 && kpi('Peticiones resueltas', tasksDone.length, { ico: 'checkCircle', color: 'var(--cf-primary)' }),
    meetings.length > 0 && kpi('Reuniones', meetings.length, { ico: 'calendar', color: '#22c9a6' }),
  ].filter(Boolean);

  if (work.length) {
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('El trabajo del mes', null, `${work.length} ${work.length === 1 ? 'tarea' : 'tareas'}${minutes ? ` · ${minutesText(minutes)}` : ''}`),
      byCat.size > 1 && minutes > 0 && el('div', { class: 'cl-card' }, bars([...byCat].sort((a, b) => b[1] - a[1]).map(([cat, m]) => ({ label: cat, value: m, text: minutesText(m) || '—' })))),
      el('div', { class: 'cl-card cl-rep-list' }, work.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14).map((w) => el('div', { class: 'cl-rep-line' },
        icon('check'), el('span', { text: w.title }), el('small', { text: [w.category, shortDate(w.day)].filter(Boolean).join(' · ') }),
      )), work.length > 14 && el('small', { class: 'cl-rep-more', text: `y ${work.length - 14} más` })),
    ));
  }
  if (published.length) {
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('Lo que se publicó', null, `${published.length} ${published.length === 1 ? 'publicación' : 'publicaciones'}`),
      el('div', { class: 'cl-card cl-rep-list' }, published.map((c) => el('div', { class: 'cl-rep-line' },
        el('span', { class: 'cl-rep-nets' }, channelsOf(c).map((ch) => el('i', { style: { '--c': CHANNEL[ch]?.[1] } }, icon(CHANNEL[ch]?.[2] || 'globe')))),
        el('span', { text: c.title }), el('small', { text: `${FORMAT[c.format] || ''} · ${shortDate(c.date)}` }),
      ))),
    ));
  }
  if (now) {
    const rows = [
      ['Alcance', 'reach'], ['Impresiones', 'impressions'], ['Interacciones', 'engagement'], ['Seguidores nuevos', 'new_followers'], ['Clics', 'clicks'], ['Leads', 'leads'], ['Ventas', 'sales', true], ['Inversión', 'spend', true],
    ].filter(([, k]) => now[k] != null && now[k] !== 0);
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('Resultados', null, before ? `Frente a ${monthLabel(prev)}` : null),
      el('div', { class: 'cl-card cl-rep-table' },
        el('div', { class: 'cl-rep-tr is-head' }, el('span'), el('small', { text: cap(label.split(' ')[0]) }), el('small', { text: before ? cap(monthLabel(prev).split(' ')[0]) : '' }), el('small', { text: before ? 'Cambio' : '' })),
        rows.map(([name, k, isMoney]) => {
          const ch = before ? delta(now[k], before[k]) : null;
          const fmt = (v) => (isMoney ? money(v) : num(v));
          return el('div', { class: 'cl-rep-tr' }, el('span', { text: name }), el('b', { text: fmt(now[k]) }), el('small', { text: before && before[k] != null ? fmt(before[k]) : '' }),
            el('em', { class: ch == null ? '' : ch >= 0 ? 'is-up' : 'is-down', text: ch == null ? '' : `${ch >= 0 ? '+' : ''}${ch}%` }));
        }),
      ),
    ));
  }
  if (leads.length) {
    const byStage = Object.keys(LEAD_STAGE).map((k) => [k, leads.filter((l) => l.stage === k).length]).filter(([, n]) => n);
    const wonValue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('Clientes nuevos', null, `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}${wonValue ? ` · ${money(wonValue)} ganados` : ''}`),
      el('div', { class: 'cl-card' }, bars(byStage.map(([k, n]) => ({ label: LEAD_STAGE[k][0], value: n, text: String(n), color: LEAD_STAGE[k][1] })))),
    ));
  }
  if (milestones.length || meetings.length) {
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('Hitos, entregas y reuniones'),
      el('div', { class: 'cl-card cl-rep-list' },
        milestones.map((p) => el('div', { class: 'cl-rep-line' }, icon(POST_KIND[p.kind]?.[1] || 'flag'), el('span', { text: p.title }), el('small', { text: `${POST_KIND[p.kind]?.[0]} · ${shortDate(new Date(p.occurred_at).toLocaleDateString('en-CA'))}` }))),
        meetings.map((m) => el('div', { class: 'cl-rep-line' }, icon('calendar'), el('span', { text: m.topic }), el('small', { text: `${MEETING_STATUS[m.status]?.[0]} · ${shortDate(new Date(m.starts_at).toLocaleDateString('en-CA'))}` }))),
      ),
    ));
  }
  const project = month === ym(todayKey()) ? currentProject() : null;
  if (project) {
    const done = (project.stages || []).filter((s) => s.done).length;
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('El proyecto hoy', el('a', { class: 'cl-more cl-rep-tool', href: '#/proyecto' }, 'Ver', icon('right'))),
      el('div', { class: 'cl-card cl-rep-project' },
        el('b', { text: project.name }),
        el('small', { text: `${done} de ${(project.stages || []).length} etapas · ${project.tasks_done} de ${project.tasks_total} tareas${project.due_date ? ` · entrega el ${shortDate(project.due_date)}` : ''}` }),
        el('div', { class: 'cl-project-bar', style: { '--p': String(project.tasks_total ? project.tasks_done / project.tasks_total : 0) } }, el('i')),
      ),
    ));
  }
  if (ratings.length) {
    const avg = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
    sections.push(el('section', { class: 'cl-sec cl-rep-sec' },
      sectionHead('Valoración del cliente', null, `${avg.toFixed(1).replace('.', ',')} de 5 · ${ratings.length} ${ratings.length === 1 ? 'persona' : 'personas'}`),
      el('div', { class: 'cl-card cl-rep-list' }, ratings.map((r) => el('div', { class: 'cl-rep-line' }, icon('star'), el('span', { text: `${r.author || 'Cliente'}: ${'★'.repeat(r.score)}` }), r.comment && el('small', { text: r.comment })))),
    ));
  }
  if (nextMonth) sections.push(el('p', { class: 'cl-rep-next' }, icon('calendar'), `En ${monthLabel(shift(month, 1)).split(' ')[0]} hay ${nextMonth} ${nextMonth === 1 ? 'publicación' : 'publicaciones'} en el calendario.`));

  const logo = urlOf(app.client.logo_url);
  const future = month > ym(todayKey());
  const node = el('div', { class: 'cl-stack cl-report' },
    el('div', { class: 'cl-rep-tools' },
      el('a', { class: 'cl-glass sm', href: `#/informe/${shift(month, -1)}`, 'aria-label': 'Mes anterior' }, icon('left')),
      el('b', { text: cap(label) }),
      el('a', { class: `cl-glass sm${future || month === ym(todayKey()) ? ' is-off' : ''}`, href: `#/informe/${shift(month, 1)}`, 'aria-label': 'Mes siguiente' }, icon('right')),
      el('span', { class: 'cl-rep-tools-end' },
        el('button', { type: 'button', class: 'cl-btn sm ghost', onclick: () => share(month, { work, minutes, published, now, before, leads, won }) }, icon('share'), 'Compartir'),
        el('button', { type: 'button', class: 'cl-btn sm', onclick: () => { react('tap'); window.print(); } }, icon('download'), 'PDF'),
      ),
    ),
    el('header', { class: 'cl-rep-cover' },
      el('span', { class: 'cl-logo lg' }, logo ? el('img', { src: logo, alt: '' }) : initials(app.client.name)),
      el('div', {},
        el('small', { text: app.client.name }),
        el('h2', { text: `Informe de ${label}` }),
        el('p', { text: `Preparado por Schwarck Developer · ${fDay.format(new Date())}` }),
      ),
    ),
    kpis.length ? el('div', { class: 'cl-rep-kpis' }, kpis) : null,
    sections.length ? sections : emptyBox('chart', 'Nada que contar todavía', `No hay trabajo, publicaciones ni resultados de ${label}.`),
  );
  return { node, title: 'Informe', large: 'Informe del mes', sub: cap(label) };
}

async function share(month, { work, minutes, published, now, before, leads, won }) {
  const label = monthLabel(month);
  const lines = [
    `Informe de ${label} · ${app.client.name}`,
    work.length && `✅ ${work.length} tareas hechas${minutes ? ` (${minutesText(minutes)})` : ''}`,
    published.length && `📣 ${published.length} publicaciones`,
    now?.reach && `👀 ${num(now.reach)} de alcance${before?.reach ? ` (${delta(now.reach, before.reach) >= 0 ? '+' : ''}${delta(now.reach, before.reach)}%)` : ''}`,
    (now?.leads || leads.length) && `🎯 ${now?.leads || leads.length} leads${won.length ? `, ${won.length} ganados` : ''}`,
    `${location.origin}/cliente/#/informe/${month}`,
  ].filter(Boolean).join('\n');
  if (navigator.share) {
    try {
      await navigator.share({ title: `Informe de ${label}`, text: lines });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  copyText(lines, 'Resumen copiado.');
}

/** En Inicio, la primera semana del mes: el informe del que acaba de cerrar. */
export function reportCard() {
  if (new Date().getDate() > 7) return null;
  const month = defaultReportMonth();
  const any = app.data.work.some((w) => w.status === 'done' && ym(w.day) === month) || app.data.content.some((c) => c.status === 'published' && ym(c.date) === month);
  if (!any) return null;
  return el('a', { class: 'cl-card cl-rep-card', href: `#/informe/${month}` },
    el('span', { class: 'cl-rep-card-ico' }, icon('chart')),
    el('span', { class: 'cl-set-main' }, el('small', { class: 'cl-eyebrow', text: 'Ya está listo' }), el('b', { text: `Tu informe de ${monthLabel(month).split(' ')[0]}` }), el('small', { text: 'El trabajo, lo publicado y los resultados del mes, en PDF.' })),
    icon('right', 'cl-set-chev'),
  );
}

export const reportLink = (text = 'Informe del mes') => el('a', { class: 'cl-more', href: `#/informe/${defaultReportMonth()}` }, text, icon('right'));
