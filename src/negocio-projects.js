// Negocio: proyectos. El listado con sus cifras y la ficha de cada proyecto:
// resumen (cifras, etapas y documentos), tareas y horas.

import {
  state, find, put, uid, el, icon, iconButton, avatar, chip, kpi, empty, seg, field, input, select, menu, dialog,
  confirmBox, toast, autosize, money, amountText, parseNum, round2, todayISO, dateText, shortDate, durationText, CURRENCY_CODES,
} from './negocio-core.js';
import {
  PROJECT_STATUS, newProject, projectStats, customerOf, toggleStage, setProjectStatus, removeProject, runningEntry,
  startTimer, stopTimer,
} from './negocio-work.js';
import { taskBoard, createTask } from './negocio-tasks.js';
import { projectHours, timeForm, billDialog } from './negocio-time.js';
import { head, searchBox, groupedDocs, createDoc, customerForm, go } from './negocio-views.js';

const STATUS_RANK = { active: 0, pending: 1, paused: 2, completed: 3 };
const statusOf = (p) => PROJECT_STATUS[p.status] || PROJECT_STATUS.pending;

const readPref = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la vista vale para esta visita.
  }
};

// ── Alta y edición ──

export function projectForm(project, onSaved, { customer = null } = {}) {
  const p = project ? structuredClone(project) : newProject(customer);
  let currencyTouched = Boolean(project);
  const name = input({ value: p.name, required: true, maxLength: 120, placeholder: 'Rediseño de la web' });
  const customerOptions = () => [['', 'Elige un cliente'], ...[...state.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.company ? `${c.name} · ${c.company}` : c.name])];
  const customerSel = select(customerOptions(), p.customerId, { 'aria-label': 'Cliente' });
  const currency = select(CURRENCY_CODES.map((k) => [k, k]), p.currency, { 'aria-label': 'Moneda', onchange: () => { currencyTouched = true; } });
  const followCustomer = () => {
    const c = find('customers', customerSel.value);
    if (c?.currency && !currencyTouched) currency.value = c.currency;
  };
  customerSel.addEventListener('change', followCustomer);
  const newCustomer = el('button', {
    type: 'button',
    class: 'pill ghost sm',
    onclick: () => customerForm(null, (c) => {
      customerSel.replaceChildren(...customerOptions().map(([v, text]) => el('option', { value: v, text })));
      customerSel.value = c.id;
      followCustomer();
    }),
  }, icon('plus'), 'Nuevo');
  const status = select(Object.entries(PROJECT_STATUS).map(([k, [label]]) => [k, label]), p.status, { 'aria-label': 'Estado' });
  const amountBox = (value) => input({ value: value ? amountText(value) : '', inputmode: 'decimal', placeholder: '0,00' });
  const budget = amountBox(p.budget);
  const rate = amountBox(p.rate);
  const start = input({ type: 'date', value: p.startDate || '' });
  const due = input({ type: 'date', value: p.dueDate || '' });
  const description = autosize(el('textarea', { value: p.description || '', rows: 3, maxLength: 8000, placeholder: 'Objetivo, alcance, enlaces…' }));

  dialog({
    title: project ? 'Editar proyecto' : 'Nuevo proyecto',
    body: el('div', { class: 'ng-form' },
      field('Nombre', name),
      el('div', { class: 'ng-field' }, el('span', { text: 'Cliente' }), el('div', { class: 'ng-inline' }, customerSel, newCustomer)),
      el('div', { class: 'ng-grid2' }, field('Estado', status), field('Tarifa por hora', rate, 'La de las horas que cronometres.')),
      el('div', { class: 'ng-grid2 is-price' }, field('Presupuesto', budget, 'Opcional. La ficha avisa si te pasas.'), field('Moneda', currency)),
      el('div', { class: 'ng-grid2' }, field('Empieza', start), field('Entrega', due)),
      field('Descripción', description),
    ),
    danger: project && {
      label: 'Eliminar',
      run: () => {
        const tasks = state.tasks.filter((t) => t.projectId === project.id).length;
        const hours = state.time.filter((e) => e.projectId === project.id).length;
        const lost = [
          tasks && (tasks === 1 ? 'su tarea' : `sus ${tasks} tareas`),
          hours && (hours === 1 ? 'su registro de horas' : `sus ${hours} registros de horas`),
        ].filter(Boolean).join(' y ');
        confirmBox(`¿Eliminar «${project.name}»?${lost ? ` También se borran ${lost}.` : ''} Sus documentos se quedan.`).then((yes) => {
          if (!yes) return;
          removeProject(project);
          toast('Proyecto eliminado.');
          go('#/proyectos');
        });
      },
    },
    onSubmit: () => {
      p.name = name.value.trim();
      if (!p.name) return false;
      if (!customerSel.value) {
        toast('Elige de qué cliente es el proyecto.', 'error');
        customerSel.focus();
        return false;
      }
      p.customerId = customerSel.value;
      p.currency = currency.value;
      p.budget = round2(parseNum(budget.value));
      p.rate = round2(parseNum(rate.value));
      p.startDate = start.value;
      p.dueDate = due.value;
      p.description = description.value.trim();
      if (status.value !== p.status) setProjectStatus(p, status.value);
      put('projects', p);
      onSaved?.(p);
      return true;
    },
  });
}

// ── Piezas ──

function ring(share, label) {
  const pct = Math.round(share * 100);
  return el('span', { class: 'ng-ring', style: { '--p': Math.min(1, share) }, role: 'img', 'aria-label': `${label}: ${pct} %`, title: `${label}: ${pct} %` }, el('span', { text: `${pct}%` }));
}

function datesText(p) {
  if (p.startDate && p.dueDate) return `${shortDate(p.startDate)} → ${dateText(p.dueDate)}`;
  if (p.dueDate) return `Entrega el ${dateText(p.dueDate)}`;
  return p.startDate ? `Desde el ${dateText(p.startDate)}` : '';
}

function projectCard(p) {
  const s = projectStats(p);
  const share = s.tasks.length ? s.done.length / s.tasks.length : 0;
  const [amountLabel, amount] = s.budget ? ['Presupuesto', s.budget] : ['Ganado', s.earned];
  return el('a', { class: 'ng-pcard', href: `#/proyectos/${p.id}` },
    el('div', { class: 'ng-pcard-top' }, avatar(p.name), chip(...statusOf(p))),
    el('div', { class: 'ng-pcard-name' }, el('b', { text: p.name || 'Sin nombre' }), el('small', { text: customerOf(p)?.name || 'Sin cliente' })),
    el('div', { class: 'ng-pcard-tasks' },
      el('div', {}, el('span', { text: 'Tareas' }), el('b', { text: `${s.done.length}/${s.tasks.length}` })),
      el('span', { class: 'ng-bar' }, el('i', { style: { width: `${share * 100}%` } })),
    ),
    el('div', { class: 'ng-pcard-foot' },
      el('span', {}, el('small', { text: amountLabel }), el('b', { text: money(amount, s.cur) })),
      ring(s.progress, 'Etapas completadas'),
    ),
  );
}

export function projectRow(p) {
  const s = projectStats(p);
  return el('a', { class: 'ng-row is-project', href: `#/proyectos/${p.id}` },
    avatar(p.name),
    el('span', { class: 'ng-row-main' }, el('b', { text: p.name || 'Sin nombre' }), el('small', { text: customerOf(p)?.name || 'Sin cliente' })),
    el('span', { class: 'ng-row-tag' }, chip(...statusOf(p))),
    el('span', { class: 'ng-row-stat' }, el('small', { text: 'Tareas' }), el('b', { text: `${s.done.length}/${s.tasks.length}` })),
    el('span', { class: 'ng-row-stat' }, el('small', { text: 'Horas' }), el('b', { text: s.minutes >= 1 ? durationText(s.minutes) : '—' })),
    el('span', { class: 'ng-row-stat' }, el('small', { text: s.budget ? 'Presupuesto' : 'Ganado' }), el('b', { text: money(s.budget || s.earned, s.cur) })),
    icon('right'),
  );
}

const byRank = (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.name.localeCompare(b.name);

// ── Listado ──

export function projectsPage() {
  let q = '';
  let status = 'all';
  let view = readPref('ng-project-view', 'cards');
  const kpis = el('div', { class: 'ng-kpis' });
  const list = el('div', { class: 'ng-list-body' });
  const countText = el('small');

  const create = () => projectForm(null, (p) => go(`#/proyectos/${p.id}`));
  const draw = () => {
    const all = state.projects;
    const n = (k) => all.filter((p) => p.status === k).length;
    const late = all.filter((p) => p.status !== 'completed' && p.dueDate && p.dueDate < todayISO()).length;
    kpis.replaceChildren(
      kpi({ label: 'Activos', value: String(n('active')), ico: 'folder', sub: late ? `${late} con la entrega pasada` : 'En curso', tone: late ? 'var(--expense)' : null }),
      kpi({ label: 'Pendientes', value: String(n('pending')), ico: 'clock', sub: 'Por arrancar' }),
      kpi({ label: 'Completados', value: String(n('completed')), ico: 'checkCircle', sub: 'Entregados' }),
      kpi({ label: 'Total', value: String(all.length), ico: 'board', ...(all.length ? { bar: n('completed') / all.length } : { sub: 'Ninguno todavía' }) }),
    );
    const shown = all.filter((p) => (status === 'all' || p.status === status) && (!q || `${p.name} ${customerOf(p)?.name || ''} ${customerOf(p)?.company || ''}`.toLowerCase().includes(q))).sort(byRank);
    countText.textContent = shown.length === all.length ? `${all.length} en total` : `${shown.length} de ${all.length}`;
    if (!all.length) {
      list.replaceChildren(empty({
        ico: 'folder',
        title: 'Todavía no hay proyectos',
        text: 'Un proyecto junta las tareas, las horas y las facturas de un trabajo para un cliente.',
        action: el('button', { type: 'button', class: 'pill', onclick: create }, icon('plus'), 'Nuevo proyecto'),
      }));
      return;
    }
    if (!shown.length) list.replaceChildren(el('p', { class: 'ng-none', text: 'Ningún proyecto coincide.' }));
    else if (view === 'list') list.replaceChildren(el('div', { class: 'ng-rows' }, shown.map(projectRow)));
    else list.replaceChildren(el('div', { class: 'ng-pcards' }, shown.map(projectCard)));
  };

  const node = el('div', { class: 'ng-page' },
    head('Proyectos', 'Lo que tienes entre manos: de quién es, cómo va y cuánto vale.',
      el('button', { type: 'button', class: 'pill', onclick: create }, icon('plus'), 'Nuevo proyecto')),
    kpis,
    el('section', { class: 'ng-card ng-list' },
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Todos los proyectos' }), countText),
        el('div', { class: 'ng-filters' },
          select([['all', 'Todos los estados'], ...Object.entries(PROJECT_STATUS).map(([k, [label]]) => [k, label])], status, { 'aria-label': 'Estado', onchange: (e) => { status = e.target.value; draw(); } }),
          searchBox((v) => { q = v; draw(); }, 'Buscar proyectos…'),
          seg([['cards', 'Tarjetas'], ['list', 'Lista']], view, (v) => { view = v; savePref('ng-project-view', v); draw(); }, 'Vista'),
        ),
      ),
      list,
    ),
  );
  draw();
  return { node, refresh: draw };
}

// ── Ficha ──

function summary(id) {
  const kpis = el('div', { class: 'ng-kpis is-six' });
  const note = el('p', { class: 'ng-kpi-note', hidden: true });
  const stagesCard = el('section', { class: 'ng-card ng-phases-card' });
  const docsCard = el('section', { class: 'ng-card ng-list' });
  const aboutCard = el('section', { class: 'ng-card ng-notes' });
  let focusStage = '';

  function drawKpis(p, s) {
    const cur = s.cur;
    const over = s.budget > 0 && s.left < 0;
    const n = s.invoices.length;
    const drafts = s.docs.filter((d) => d.type === 'invoice' && d.status === 'draft').length;
    kpis.replaceChildren(
      kpi({
        label: 'Presupuesto restante',
        value: s.budget ? money(s.left, cur) : '—',
        ico: 'wallet',
        tone: over ? 'var(--expense)' : null,
        ...(!s.budget ? { sub: 'Sin presupuesto' } : over ? { sub: `Te pasaste en ${money(-s.left, cur)}` } : { bar: s.left / s.budget }),
      }),
      kpi({ label: 'Ganado', value: money(s.earned, cur), ico: 'dollar', ...(s.budget ? { bar: s.earned / s.budget } : { sub: 'Horas y tareas a precio cerrado' }) }),
      kpi({ label: 'Facturado', value: money(s.invoiced, cur), ico: 'file', sub: [`${n} ${n === 1 ? 'factura' : 'facturas'}`, drafts && `${drafts} en borrador`, s.unbilledValue > 0 && `${money(s.unbilledValue, cur)} sin facturar`].filter(Boolean).join(' · ') }),
      kpi({ label: 'Cobrado', value: money(s.paid, cur), ico: 'checkCircle', sub: s.due > 0 ? `${money(s.due, cur)} por cobrar` : 'Nada pendiente' }),
      kpi({ label: 'Horas', value: durationText(s.minutes), ico: 'timer', sub: s.unbilledMinutes >= 1 ? `${durationText(s.unbilledMinutes)} sin facturar` : s.minutes >= 1 ? 'Todo facturado' : 'Ninguna todavía' }),
      kpi({ label: 'Tareas', value: `${s.done.length} / ${s.tasks.length}`, ico: 'tasks', ...(s.tasks.length ? { bar: s.done.length / s.tasks.length } : { sub: 'Ninguna todavía' }) }),
    );
    note.hidden = !s.skipped;
    note.textContent = `${s.skipped} ${s.skipped === 1 ? 'factura en otra moneda no entra' : 'facturas en otras monedas no entran'} en estas cifras: ponles una equivalencia en ${cur}.`;
  }

  function drawStages(p, s) {
    const stages = p.stages || (p.stages = []);
    const active = stages.findIndex((x) => !x.done);
    const pct = stages.length ? Math.round((s.stagesDone / stages.length) * 100) : 0;
    const save = () => put('projects', p);
    const move = (from, to) => {
      const [it] = stages.splice(from, 1);
      stages.splice(to, 0, it);
      save();
    };
    stagesCard.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Etapas' }), el('small', { text: stages.length ? `${s.stagesDone} de ${stages.length} completadas` : 'Sin etapas' })),
        el('div', { class: 'ng-phases-progress' }, el('b', { text: `${pct} %` }), el('span', { class: 'ng-bar' }, el('i', { style: { width: `${pct}%` } }))),
      ),
      el('ol', { class: 'ng-phases' },
        stages.map((st, i) => {
          const phase = st.done ? 'done' : i === active ? 'active' : 'next';
          const name = input({ class: 'ng-phase-name', value: st.name, maxLength: 60, 'aria-label': `Nombre de la etapa ${i + 1}`, data: { id: st.id } });
          name.addEventListener('change', () => {
            st.name = name.value.trim() || st.name;
            save();
          });
          name.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') name.blur();
          });
          const more = iconButton('more', `Opciones de ${st.name}`, () => menu(more, [
            { label: 'Mover antes', icon: 'back', disabled: i === 0, run: () => move(i, i - 1) },
            { label: 'Mover después', icon: 'right', disabled: i === stages.length - 1, run: () => move(i, i + 1) },
            '-',
            { label: 'Quitar etapa', icon: 'trash', danger: true, run: () => { p.stages = stages.filter((x) => x !== st); save(); } },
          ], { align: 'end' }), 'is-sm');
          return el('li', { class: `ng-phase is-${phase}` },
            el('button', {
              type: 'button',
              class: 'ng-phase-dot',
              'aria-pressed': String(Boolean(st.done)),
              'aria-label': st.done ? `Reabrir ${st.name}` : `Completar ${st.name}`,
              title: st.done ? 'Reabrir desde aquí' : 'Completar hasta aquí',
              onclick: () => {
                toggleStage(p, i);
                save();
              },
            }, icon('check')),
            el('div', { class: 'ng-phase-text' }, name, el('small', { text: { done: 'Completada', active: 'Activa', next: 'Próxima' }[phase] })),
            more,
          );
        }),
        el('li', { class: 'ng-phase is-add' }, el('button', {
          type: 'button',
          class: 'ng-phase-add',
          onclick: () => {
            const st = { id: uid(), name: 'Nueva etapa', done: false };
            stages.push(st);
            if (p.status === 'completed') p.status = 'active';
            focusStage = st.id;
            save();
          },
        }, icon('plus'), 'Añadir etapa')),
      ),
    );
    if (focusStage) {
      const box = stagesCard.querySelector(`[data-id="${focusStage}"]`);
      focusStage = '';
      box?.focus();
      box?.select();
    }
  }

  function drawDocs(p, s) {
    const c = customerOf(p);
    docsCard.replaceChildren(
      el('header', { class: 'ng-card-head' },
        el('div', {}, el('h2', { text: 'Documentos' }), el('small', { text: s.docs.length ? `${s.docs.length} en total` : 'Ninguno todavía' })),
        el('div', { class: 'ng-filters' },
          el('button', { type: 'button', class: 'pill ghost sm', onclick: () => createDoc('quote', c, { projectId: p.id }) }, icon('quote'), 'Cotización'),
          el('button', { type: 'button', class: 'pill ghost sm', onclick: () => createDoc('invoice', c, { projectId: p.id }) }, icon('file'), 'Factura'),
        ),
      ),
      el('div', { class: 'ng-list-body' }, s.docs.length ? groupedDocs(s.docs) : empty({
        ico: 'file',
        title: 'Sin documentos todavía',
        text: 'Las cotizaciones y facturas del proyecto salen aquí. Sus horas se facturan con un clic.',
        action: el('button', { type: 'button', class: 'pill', onclick: () => billDialog(p.id) }, icon('file'), 'Facturar horas'),
      })),
    );
  }

  const draw = () => {
    const p = find('projects', id);
    if (!p) return;
    const s = projectStats(p);
    drawKpis(p, s);
    drawStages(p, s);
    drawDocs(p, s);
    aboutCard.hidden = !p.description;
    aboutCard.replaceChildren(el('h2', { text: 'Descripción' }), el('p', { text: p.description || '' }));
  };
  draw();
  return { node: el('div', { class: 'ng-tab' }, kpis, note, stagesCard, docsCard, aboutCard), refresh: draw };
}

const TABS = [['resumen', 'Resumen'], ['tareas', 'Tareas'], ['horas', 'Horas']];

export function projectPage(id, initialTab = 'resumen') {
  let tab = TABS.some(([k]) => k === initialTab) ? initialTab : 'resumen';
  const box = el('div', { class: 'ng-page' });
  const header = el('header', { class: 'ng-profile' });
  const content = el('div');
  let section = null;

  if (!find('projects', id)) {
    box.append(empty({ ico: 'folder', title: 'Ese proyecto ya no existe', action: el('a', { class: 'pill', href: '#/proyectos', text: 'Ver proyectos' }) }));
    return { node: box, refresh() {} };
  }

  // La pestaña va en la dirección, pero cambiarla no repinta la página entera.
  const tabs = seg(TABS, tab, (v) => {
    tab = v;
    history.replaceState(null, '', `#/proyectos/${id}${v === 'resumen' ? '' : `/${v}`}`);
    build();
  }, 'Secciones del proyecto');

  function build() {
    section = tab === 'tareas' ? taskBoard({ projectId: id }) : tab === 'horas' ? projectHours(id) : summary(id);
    content.replaceChildren(section.node);
  }

  function drawHeader(p) {
    const c = customerOf(p);
    const [label, color] = statusOf(p);
    const statusBtn = el('button', { type: 'button', class: 'ng-chipbtn is-lg', style: { '--c': color }, 'aria-label': `Estado: ${label}` }, el('i', { class: 'ng-chipbtn-dot' }), label, icon('down'));
    statusBtn.addEventListener('click', () => menu(statusBtn, Object.entries(PROJECT_STATUS).map(([k, [text]]) => ({
      label: text,
      icon: k === p.status ? 'check' : null,
      run: () => {
        setProjectStatus(p, k);
        put('projects', p);
      },
    }))));
    const live = runningEntry()?.projectId === p.id;
    const newBtn = el('button', { type: 'button', class: 'pill' }, icon('plus'), 'Nuevo', icon('down'));
    newBtn.addEventListener('click', () => menu(newBtn, [
      { label: 'Tarea', icon: 'tasks', run: () => createTask({ projectId: p.id }) },
      { label: 'Registrar horas', icon: 'clock', run: () => timeForm(null, { projectId: p.id }) },
      { label: 'Facturar horas', icon: 'timer', run: () => billDialog(p.id) },
      '-',
      { label: 'Factura', icon: 'file', run: () => createDoc('invoice', c, { projectId: p.id }) },
      { label: 'Cotización', icon: 'quote', run: () => createDoc('quote', c, { projectId: p.id }) },
    ], { align: 'end' }));
    const facts = [
      ['calendar', datesText(p)],
      ['dollar', p.budget ? `Presupuesto de ${money(p.budget, p.currency)}` : ''],
      ['timer', p.rate ? `${money(p.rate, p.currency)} por hora` : 'Sin tarifa por hora'],
    ].filter(([, text]) => text);
    header.replaceChildren(
      el('a', { class: 'ng-ibtn', href: '#/proyectos', 'aria-label': 'Volver a proyectos', title: 'Volver' }, icon('back')),
      el('div', { class: 'ng-profile-id' },
        avatar(p.name, 'is-xl'),
        el('div', {}, el('h1', { text: p.name || 'Sin nombre' }), el('p', {}, c ? el('a', { class: 'ng-link', href: `#/clientes/${c.id}`, text: c.name }) : 'Sin cliente')),
      ),
      el('div', { class: 'ng-profile-row' },
        el('ul', { class: 'ng-contact' }, el('li', {}, statusBtn), facts.map(([ic, text]) => el('li', {}, icon(ic), el('span', { text })))),
        el('div', { class: 'ng-head-actions' },
          el('button', { type: 'button', class: `pill ghost${live ? ' is-live' : ''}`, onclick: () => (live ? stopTimer() : startTimer({ projectId: p.id })) }, icon(live ? 'stop' : 'play'), live ? 'Parar' : 'Cronometrar'),
          el('button', { type: 'button', class: 'pill ghost', onclick: () => projectForm(p) }, icon('edit'), 'Editar'),
          newBtn,
        ),
      ),
    );
  }

  const refresh = () => {
    const p = find('projects', id);
    if (!p) return;
    drawHeader(p);
    section?.refresh();
  };

  drawHeader(find('projects', id));
  build();
  box.append(header, el('div', { class: 'ng-tabs' }, tabs), content);
  return { node: box, refresh };
}
