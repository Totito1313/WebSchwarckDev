// Marketing: el calendario de contenido (mes, lista y la cuadrícula del perfil), la ficha de
// cada publicación (para aprobarla o pedir cambios), el rendimiento del mes y los leads.

import {
  el, fill, icon, toast, sheet, seg, chips, chip, countUp, burst, emptyBox, sectionHead, copyText, textarea, avatar, ago, dayLabel, todayKey, localDay, dayDate, fMonth, fMonthShort, fWeekday, cap, fDay, safeUrl, hostOf, plural, compact, num, money, initials, shortDate,
} from './kit.js';
import { react, onLongPress } from './feel.js';
import {
  app, redraw, isStudio, upsertLocal, can, canAct, CONTENT_STATUS, STATUS_ORDER, CHANNEL, FORMAT, FUNNEL, LEAD_STAGE, LEAD_SOURCE, urlOf,
} from './state.js';
import { thread, commentCount } from './threads.js';
import * as studio from './studio.js';

const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
};

export function marketingPage(sub = 'calendario', a, b) {
  const tabs = [['calendario', 'Calendario'], ['rendimiento', 'Rendimiento'], ['leads', 'Leads']].filter(([k]) => can(k));
  if (sub === 'pieza') {
    setTimeout(() => openPiece(a), 60);
    sub = 'calendario';
    a = undefined;
  }
  if (!tabs.some(([k]) => k === sub)) sub = tabs[0]?.[0] || 'calendario';
  const body = el('div');
  const draw = () => {
    const view = sub === 'rendimiento' ? performance() : sub === 'leads' ? leads() : calendar(a, b);
    fill(body, view);
  };
  const switcher = seg(tabs, sub, (v) => {
    sub = v;
    a = undefined;
    b = undefined;
    history.replaceState(null, '', v === 'calendario' ? '#/marketing' : `#/marketing/${v}`);
    body.classList.remove('cl-swap');
    void body.offsetWidth;
    body.classList.add('cl-swap');
    draw();
  }, { label: 'Secciones de marketing' });
  if (tabs.length < 2) switcher.hidden = true;
  draw();
  return { node: el('div', { class: 'cl-stack' }, switcher, body), title: 'Marketing', large: 'Marketing', sub: isStudio() ? 'Contenido, resultados y leads del cliente' : 'Tu contenido, tus resultados y tus clientes nuevos' };
}

// ── Calendario ──

export function contentRow(c) {
  const [status, sColor] = CONTENT_STATUS[c.status] || CONTENT_STATUS.idea;
  const [channel, cColor, cIco] = CHANNEL[c.channel] || CHANNEL.otro;
  const d = dayDate(c.date);
  const img = urlOf(c.image_url) || urlOf(c.assets?.find((x) => x.kind === 'image')?.path);
  const row = el('button', { type: 'button', class: 'cl-row cl-content', style: { '--c': cColor }, onclick: () => openPiece(c.id) },
    el('span', { class: 'cl-date-tile' }, el('small', { text: fWeekday.format(d).replace('.', '') }), el('b', { text: String(d.getDate()) })),
    el('span', { class: 'cl-set-main' },
      el('b', { text: c.title }),
      el('small', {}, icon(cIco), `${channel} · ${FORMAT[c.format] || ''}${c.time ? ` · ${c.time.slice(0, 5)}` : ''}`),
      el('span', { class: 'cl-row-tags' },
        c.client_verdict === 'approved' ? chip(isStudio() ? 'Aprobada' : 'Aprobaste', 'var(--cf-income)') : c.client_verdict === 'changes' && c.status === 'review' ? chip('Pide cambios', 'var(--cf-orange)') : chip(status, sColor),
        commentCount('content', c.id),
      ),
    ),
    img && el('img', { class: 'cl-row-thumb', src: img, alt: '', loading: 'lazy' }),
    icon('right', 'cl-set-chev'),
  );
  if (isStudio()) onLongPress(row, () => studio.editContent(c));
  return row;
}

function calendar(month, selected) {
  const now = todayKey();
  let ym = /^\d{4}-\d{2}$/.test(month || '') ? month : now.slice(0, 7);
  let pick = /^\d{4}-\d{2}-\d{2}$/.test(selected || '') ? selected : ym === now.slice(0, 7) ? now : null;
  let mode = ['mes', 'lista', 'feed'].includes(remember('portal:cal-mode')) ? remember('portal:cal-mode') : 'mes';
  const title = el('h3', { class: 'cl-cal-title-text' });
  const body = el('div', { class: 'cl-stack' });

  const draw = () => {
    title.textContent = cap(fMonth.format(dayDate(`${ym}-15`)));
    const items = app.data.content;
    if (mode === 'lista') return fill(body, agenda(items, now));
    if (mode === 'feed') return fill(body, feedGrid(items));
    const first = dayDate(`${ym}-01`);
    const startPad = (first.getDay() + 6) % 7;
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const byDay = new Map();
    const inMonth = items.filter((x) => x.date.startsWith(ym));
    for (const c of inMonth) {
      if (!byDay.has(c.date)) byDay.set(c.date, []);
      byDay.get(c.date).push(c);
    }
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(el('span', { class: 'cl-cal-pad' }));
    for (let d = 1; d <= daysIn; d++) {
      const key = `${ym}-${String(d).padStart(2, '0')}`;
      const list = byDay.get(key) || [];
      const review = list.some((c) => c.status === 'review' && !c.client_verdict);
      cells.push(el('button', {
        type: 'button',
        class: `cl-cal-day${key === now ? ' is-today' : ''}${key === pick ? ' is-picked' : ''}${list.length ? ' has-items' : ''}${key < now ? ' is-past' : ''}${review ? ' is-review' : ''}`,
        'aria-pressed': String(key === pick),
        'aria-label': `${cap(fDay.format(dayDate(key)))}: ${plural(list.length, 'publicación', 'publicaciones')}`,
        style: { '--i': d },
        onclick: () => {
          pick = key;
          react('tick');
          history.replaceState(null, '', `#/marketing/calendario/${ym}/${key}`);
          draw();
        },
      }, el('span', { class: 'cl-cal-num', text: String(d) }), list.length ? el('i', { class: 'cl-cal-dots' }, list.slice(0, 3).map((c) => el('i', { style: { '--c': (CHANNEL[c.channel] || CHANNEL.otro)[1] } }))) : null));
    }
    const dayItems = pick ? byDay.get(pick) || [] : [];
    fill(body,
      el('div', { class: 'cl-card cl-cal' },
        el('div', { class: 'cl-cal-wd' }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => el('span', { text: w }))),
        el('div', { class: 'cl-cal-grid' }, cells),
      ),
      funnelBalance(inMonth),
      pick && el('section', { class: 'cl-sec cl-cal-pick' },
        sectionHead(dayLabel(pick), isStudio() && el('button', { type: 'button', class: 'cl-more', onclick: () => studio.editContent(null, { date: pick }) }, 'Añadir', icon('plus'))),
        dayItems.length ? el('div', { class: 'cl-list' }, dayItems.map(contentRow)) : el('p', { class: 'cl-none', text: 'Nada programado este día.' }),
      ),
    );
  };
  const shift = (n) => {
    const d = dayDate(`${ym}-15`);
    d.setMonth(d.getMonth() + n);
    ym = localDay(d).slice(0, 7);
    pick = ym === now.slice(0, 7) ? now : null;
    react('tick');
    history.replaceState(null, '', `#/marketing/calendario/${ym}`);
    body.classList.remove('cl-slide-l', 'cl-slide-r');
    void body.offsetWidth;
    body.classList.add(n > 0 ? 'cl-slide-l' : 'cl-slide-r');
    draw();
  };
  // Deslizar de lado sobre el mes cambia de mes.
  let sx = null;
  body.addEventListener('pointerdown', (e) => {
    if (mode === 'mes' && e.target.closest('.cl-cal')) sx = e.clientX;
  });
  body.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 70) shift(dx < 0 ? 1 : -1);
  });
  const head = el('div', { class: 'cl-cal-head' },
    el('div', { class: 'cl-cal-nav' },
      el('button', { type: 'button', class: 'cl-glass sm', 'aria-label': 'Mes anterior', onclick: () => shift(-1) }, icon('left')),
      title,
      el('button', { type: 'button', class: 'cl-glass sm', 'aria-label': 'Mes siguiente', onclick: () => shift(1) }, icon('right')),
    ),
    seg([['mes', 'Mes'], ['lista', 'Lista'], ['feed', 'Feed']], mode, (v) => { mode = v; remember('portal:cal-mode', v); draw(); }, { small: true, label: 'Vista' }),
  );
  draw();
  return el('div', { class: 'cl-stack' }, head, body);
}

/** El equilibrio del mes entre atracción, autoridad, conversión y comunidad. */
function funnelBalance(items) {
  const counted = items.filter((c) => c.funnel);
  if (!counted.length) return el('p', { class: 'cl-cal-sum', text: items.length ? `${plural(items.length, 'publicación', 'publicaciones')} este mes` : 'Sin publicaciones este mes' });
  const total = counted.length;
  const review = items.filter((c) => c.status === 'review' && !c.client_verdict).length;
  return el('section', { class: 'cl-card cl-balance' },
    el('div', { class: 'cl-balance-head' }, el('b', { text: plural(items.length, 'publicación', 'publicaciones') }), review ? el('span', { class: 'cl-due is-info' }, `${review} para revisar`) : el('small', { text: 'este mes' })),
    el('div', { class: 'cl-balance-bar' }, Object.entries(FUNNEL).map(([k, [, color]], i) => {
      const n = counted.filter((c) => c.funnel === k).length;
      return n ? el('i', { style: { '--w': `${(n / total) * 100}%`, '--c': color, '--i': i } }) : null;
    })),
    el('div', { class: 'cl-balance-legend' }, Object.entries(FUNNEL).map(([k, [label, color]]) => {
      const n = counted.filter((c) => c.funnel === k).length;
      return n ? el('span', { style: { '--c': color } }, el('i'), `${label} ${Math.round((n / total) * 100)}%`) : null;
    })),
  );
}

function agenda(items, now) {
  const upcoming = items.filter((c) => c.date >= now);
  const past = items.filter((c) => c.date < now).reverse();
  const groups = new Map();
  for (const c of upcoming) {
    if (!groups.has(c.date)) groups.set(c.date, []);
    groups.get(c.date).push(c);
  }
  return [
    upcoming.length ? el('div', { class: 'cl-agenda' }, [...groups].map(([d, cs]) => el('section', { class: 'cl-sec' }, el('h3', { class: 'cl-tl-date' }, el('span', { text: dayLabel(d) })), el('div', { class: 'cl-list' }, cs.map(contentRow))))) : emptyBox('calendar', 'No hay nada programado', 'Cuando planifiquemos tu contenido lo verás aquí.'),
    past.length && el('details', { class: 'cl-past' }, el('summary', { text: `Anteriores (${past.length})` }), el('div', { class: 'cl-list' }, past.slice(0, 40).map(contentRow))),
  ];
}

/** Cómo quedará el perfil de Instagram: lo más nuevo arriba a la izquierda. */
function feedGrid(items) {
  const ig = items.filter((c) => c.channel === 'instagram' && c.format !== 'historia').sort((a, b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
  if (!ig.length) return emptyBox('grid', 'Sin publicaciones para Instagram', 'Aquí verás cómo quedará tu perfil.');
  return el('div', { class: 'cl-stack is-tight' },
    el('div', { class: 'cl-feed-profile' }, el('span', { class: 'cl-logo lg' }, urlOf(app.client.logo_url) ? el('img', { src: urlOf(app.client.logo_url), alt: '' }) : initials(app.client.name)), el('div', {}, el('b', { text: app.client.instagram || app.client.name }), el('small', { text: `${ig.length} publicaciones planificadas` }))),
    el('div', { class: 'cl-feed' }, ig.map((c, i) => {
      const img = urlOf(c.image_url) || urlOf(c.assets?.find((x) => x.kind === 'image')?.path);
      const color = FUNNEL[c.funnel]?.[1] || 'var(--accent)';
      return el('button', { type: 'button', class: `cl-feed-tile${c.date >= todayKey() ? ' is-future' : ''}`, style: { '--c': color, '--i': Math.min(i, 12) }, onclick: () => openPiece(c.id), 'aria-label': c.title },
        img ? el('img', { src: img, alt: '', loading: 'lazy' }) : el('span', { class: 'cl-feed-ph' }, el('b', { text: c.title })),
        el('span', { class: 'cl-feed-badge' }, icon(c.format === 'reel' || c.format === 'video' ? 'film' : c.format === 'carrusel' ? 'layers' : 'image')),
        el('span', { class: 'cl-feed-date', text: shortDate(c.date) }),
      );
    })),
  );
}

// ── La ficha de una publicación ──

export function openPiece(id) {
  const c = app.data.content.find((x) => x.id === id);
  if (!c) return toast('Esa publicación ya no está en el calendario.', 'error');
  const [channel, cColor, cIco] = CHANNEL[c.channel] || CHANNEL.otro;
  const media = [...(c.assets || [])];
  if (!media.length && c.image_url) media.push({ path: c.image_url, kind: 'image' });
  const statusIndex = STATUS_ORDER.indexOf(c.status);
  const note = textarea({ placeholder: 'Qué cambiarías (obligatorio para pedir cambios)', maxLength: 2000, rows: 2, value: c.client_note || '' });
  const canAnswer = !isStudio() && canAct() && c.status !== 'published';
  let ui;
  const answer = async (verdict, btn) => {
    const text = (note.querySelector?.('textarea') || note).value.trim();
    if (verdict === 'changes' && !text) {
      toast('Cuéntanos qué cambiarías.', 'error');
      return (note.querySelector?.('textarea') || note).focus();
    }
    btn.classList.add('is-busy');
    try {
      upsertLocal('content', await app.backend.save('content', { id: c.id, client_verdict: verdict, client_note: text || null }));
      react('success');
      if (verdict === 'approved') burst(btn);
      ui.close();
      toast(verdict === 'approved' ? '¡Aprobada! Gracias.' : 'Recibido: la ajustamos y te avisamos.', 'ok');
      redraw();
    } catch (err) {
      btn.classList.remove('is-busy');
      toast(err.message, 'error');
    }
  };
  const tags = (c.hashtags || '').split(/\s+/).filter((t) => t.startsWith('#'));
  const body = el('div', { class: 'cl-detail' },
    media.length > 0 && carousel(media),
    el('div', { class: 'cl-chips is-wrap' },
      chip(channel, cColor, cIco),
      chip(FORMAT[c.format] || 'Post'),
      c.funnel && chip(FUNNEL[c.funnel][0], FUNNEL[c.funnel][1]),
      c.pillar && chip(c.pillar),
      c.campaign && chip(c.campaign, 'var(--cf-purple)', 'flag'),
    ),
    el('div', { class: 'cl-when' }, icon('calendar'), el('b', { text: `${cap(fDay.format(dayDate(c.date)))}${c.time ? `, ${c.time.slice(0, 5)}` : ''}` }), c.duration && el('span', {}, icon('clock'), c.duration)),
    // Las etapas: idea → producción → revisión → aprobado → programado → publicado.
    el('ol', { class: 'cl-steps-line', style: { '--n': String(STATUS_ORDER.length), '--at': String(statusIndex) } }, STATUS_ORDER.map((k, i) => el('li', { class: i < statusIndex ? 'is-done' : i === statusIndex ? 'is-now' : '', style: { '--c': CONTENT_STATUS[k][1] } }, el('i'), el('span', { text: CONTENT_STATUS[k][0] })))),
    c.client_verdict && el('p', { class: `cl-verdict is-${c.client_verdict}` }, icon(c.client_verdict === 'approved' ? 'checkCircle' : 'edit'), el('span', {}, c.client_verdict === 'approved' ? (isStudio() ? 'El cliente la aprobó' : 'La aprobaste') : isStudio() ? 'Pide cambios' : 'Pediste cambios', c.client_note && el('small', { text: `«${c.client_note}»` })), c.client_verdict_at && el('small', { text: ago(c.client_verdict_at) })),
    c.objective && infoBlock('Objetivo', 'target', el('p', { class: 'cl-prose is-strong', text: c.objective })),
    c.cta && infoBlock('Llamada a la acción', 'bolt', el('p', { class: 'cl-prose is-strong', text: c.cta })),
    c.caption && infoBlock('Texto de la publicación', 'message', el('p', { class: 'cl-prose is-strong', text: c.caption }), el('button', { type: 'button', class: 'cl-btn xs ghost', onclick: () => copyText(`${c.caption}${c.hashtags ? `\n\n${c.hashtags}` : ''}`, 'Texto copiado.') }, icon('copy'), 'Copiar')),
    tags.length > 0 && infoBlock('Hashtags', 'hash', el('div', { class: 'cl-tags' }, tags.map((t) => el('span', { text: t }))), el('button', { type: 'button', class: 'cl-btn xs ghost', onclick: () => copyText(tags.join(' '), 'Hashtags copiados.') }, icon('copy'), 'Copiar')),
    c.script && infoBlock('Guion', 'film', el('ol', { class: 'cl-script' }, c.script.split('\n').filter(Boolean).map((line) => {
      const m = /^([\d–\-:. s]+s?):\s*(.*)$/.exec(line);
      return el('li', {}, m ? [el('b', { text: m[1].trim() }), el('span', { text: m[2] })] : el('span', { text: line }));
    }))),
    c.notes && infoBlock('Notas', 'doc', el('p', { class: 'cl-prose', text: c.notes })),
    (c.refs?.length > 0 || safeUrl(c.link)) && infoBlock('Enlaces', 'link', el('div', { class: 'cl-ref-list' },
      safeUrl(c.link) && el('a', { class: 'cl-link is-strong', href: safeUrl(c.link), target: '_blank', rel: 'noopener' }, icon('external'), 'Ver la pieza'),
      (c.refs || []).map((r) => el('a', { class: 'cl-link', href: r.url, target: '_blank', rel: 'noopener' }, icon('link'), r.label || hostOf(r.url))),
    )),
    canAnswer && el('section', { class: 'cl-answer' }, el('h4', { class: 'cl-eyebrow', text: c.client_verdict ? 'Cambiar tu respuesta' : '¿Qué te parece?' }), note),
    isStudio() && el('section', { class: 'cl-answer' }, el('h4', { class: 'cl-eyebrow', text: 'Mover a' }), chips(STATUS_ORDER.map((k) => [k, CONTENT_STATUS[k][0], CONTENT_STATUS[k][1]]), c.status, (v) => { studio.setContentStatus(c, v); ui.close(); }, { scroll: true })),
    thread('content', c.id),
  );
  const actions = canAnswer
    ? [el('button', { type: 'button', class: 'cl-btn ghost', onclick: (e) => answer('changes', e.currentTarget) }, icon('edit'), 'Pedir cambios'), el('button', { type: 'button', class: 'cl-btn', onclick: (e) => answer('approved', e.currentTarget) }, icon('check'), 'Aprobar')]
    : isStudio() ? [el('button', { type: 'button', class: 'cl-btn', onclick: () => { ui.close(); studio.editContent(c); } }, icon('edit'), 'Editar')] : null;
  ui = sheet(c.title, body, { actions, subtitle: CONTENT_STATUS[c.status][0], className: 'is-tall' });
}

function infoBlock(title, ico, ...kids) {
  const [content, action] = kids;
  return el('section', { class: 'cl-info' }, el('header', {}, el('span', { class: 'cl-info-title' }, icon(ico), title), action), content);
}

function carousel(media) {
  const track = el('div', { class: 'cl-carousel' }, media.map((m) => {
    const src = urlOf(m.path || m.url);
    if (m.kind === 'video') return src ? el('video', { src, controls: true, playsInline: true, preload: 'metadata' }) : el('span', { class: 'cl-carousel-ph' }, icon('film'));
    return src ? el('img', { src, alt: '', loading: 'lazy' }) : el('span', { class: 'cl-carousel-ph' }, icon('image'));
  }));
  if (media.length < 2) return track;
  const dots = el('div', { class: 'cl-dots' }, media.map((_, i) => el('i', { class: i === 0 ? 'is-on' : '' })));
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('is-on', i === j));
  }, { passive: true });
  return el('div', { class: 'cl-carousel-wrap' }, track, dots);
}

// ── Rendimiento ──

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

function performance() {
  const totals = app.data.metrics.filter((m) => m.channel === 'total').sort((a, b) => b.month.localeCompare(a.month));
  if (!totals.length) {
    return emptyBox('chart', 'Todavía no hay resultados', isStudio() ? 'Apunta las cifras del mes desde las estadísticas de cada red.' : 'Cada mes verás aquí cómo le va a tu marca: alcance, seguidores, leads y ventas.', isStudio() && el('button', { type: 'button', class: 'cl-btn sm', onclick: () => studio.editMetrics() }, icon('plus'), 'Resultados del mes'));
  }
  let monthKey = totals[0].month;
  const box = el('div', { class: 'cl-stack' });
  const draw = () => {
    const i = totals.findIndex((m) => m.month === monthKey);
    const m = totals[i];
    const prev = totals[i + 1];
    const series = totals.slice(i, i + 6).reverse();
    const max = Math.max(...series.map((s) => s.reach || 0), 1);
    const delta = pct(m.reach || 0, prev?.reach || 0);
    const rate = m.reach ? ((m.engagement || 0) / m.reach) * 100 : 0;
    const cpl = m.leads ? (m.spend || 0) / m.leads : null;
    const roas = m.spend ? (m.sales || 0) / m.spend : null;
    const channels = app.data.metrics.filter((x) => x.month === monthKey && x.channel !== 'total');
    const tile = (label, value, fmt, ico, sub, tone) => el('div', { class: 'cl-kpi', style: tone ? { '--c': tone } : null }, el('span', { class: 'cl-kpi-label' }, icon(ico), label), countUp(el('b', { class: 'cl-kpi-value' }), value || 0, fmt), sub && el('small', { class: 'cl-kpi-sub', text: sub }));
    fill(box,
      el('section', { class: 'cl-card cl-perf-hero' },
        el('small', { class: 'cl-eyebrow', text: `Alcance · ${cap(fMonth.format(dayDate(m.month)))}` }),
        el('div', { class: 'cl-perf-big' }, countUp(el('b'), m.reach || 0, (v) => num(Math.round(v))), delta != null && el('span', { class: `cl-delta${delta < 0 ? ' is-down' : ''}` }, icon('trend'), `${delta > 0 ? '+' : ''}${delta}%`)),
        el('small', { class: 'cl-perf-sub', text: prev ? `frente a ${fMonth.format(dayDate(prev.month))}` : 'primer mes medido' }),
        el('div', { class: 'cl-bars' }, series.map((s, j) => el('span', { class: `cl-bar${s.month === monthKey ? ' is-on' : ''}`, style: { '--h': String((s.reach || 0) / max), '--i': j } }, el('i'), el('small', { text: fMonthShort.format(dayDate(s.month)).replace('.', '') })))),
      ),
      el('div', { class: 'cl-kpi-grid' },
        tile('Seguidores', m.followers, (v) => num(Math.round(v)), 'users', m.new_followers != null ? `${m.new_followers >= 0 ? '+' : ''}${num(m.new_followers)} este mes` : null, 'var(--cf-purple)'),
        tile('Interacciones', m.engagement, (v) => compact(v), 'heart', m.reach ? `${rate.toFixed(1)}% del alcance` : null, 'var(--cf-expense)'),
        tile('Leads', m.leads, (v) => String(Math.round(v)), 'funnel', cpl != null ? `${money(cpl)} por lead` : null, 'var(--cf-orange)'),
        tile('Ventas', m.sales, (v) => money(v), 'dollar', roas != null ? `${roas.toFixed(1)}× lo invertido` : null, 'var(--cf-income)'),
        tile('Clics', m.clicks, (v) => num(Math.round(v)), 'bolt', null, 'var(--cf-blue)'),
        tile('Impresiones', m.impressions, (v) => compact(v), 'layers', null, '#22c9a6'),
        tile('Publicaciones', m.posts, (v) => String(Math.round(v)), 'calendar', null, 'var(--cf-primary)'),
        tile('Inversión', m.spend, (v) => money(v), 'target', null, 'var(--cf-fg-muted)'),
      ),
      channels.length > 0 && el('section', { class: 'cl-sec' }, sectionHead('Por red'), el('div', { class: 'cl-card cl-channels' }, channels.sort((a, b) => (b.reach || 0) - (a.reach || 0)).map((ch, j) => {
        const [label, color, ico] = CHANNEL[ch.channel] || CHANNEL.otro;
        return el('div', { class: 'cl-channel', style: { '--c': color, '--w': `${((ch.reach || 0) / Math.max(1, m.reach || 0)) * 100}%`, '--i': j } }, el('span', { class: 'cl-channel-name' }, icon(ico), label), el('span', { class: 'cl-channel-bar' }, el('i')), el('b', { text: compact(ch.reach || 0) }));
      }))),
      m.notes && el('section', { class: 'cl-card cl-note-card' }, icon('sparkles'), el('p', { class: 'cl-prose is-strong', text: m.notes })),
      isStudio() && el('button', { type: 'button', class: 'cl-btn ghost', onclick: () => studio.editMetrics(m.month) }, icon('edit'), 'Editar este mes'),
    );
  };
  const months = chips(totals.map((t) => [t.month, cap(fMonth.format(dayDate(t.month)))]), monthKey, (v) => { monthKey = v; draw(); }, { scroll: true, label: 'Mes' });
  draw();
  return el('div', { class: 'cl-stack' }, months, box);
}

// ── Leads ──

function leads() {
  const all = app.data.leads;
  if (!all.length) return emptyBox('funnel', 'Todavía no hay leads', isStudio() ? 'Registra cada persona interesada: de dónde llegó, en qué etapa está y cuánto vale.' : 'Aquí verás cada persona interesada en tu negocio que llegó gracias a tu marketing.', isStudio() && el('button', { type: 'button', class: 'cl-btn sm', onclick: () => studio.editLead() }, icon('plus'), 'Nuevo lead'));
  let filter = 'abiertos';
  const list = el('div', { class: 'cl-list' });
  const month = todayKey().slice(0, 7);
  const won = all.filter((l) => l.stage === 'ganado');
  const lost = all.filter((l) => l.stage === 'perdido');
  const open = all.filter((l) => l.stage !== 'ganado' && l.stage !== 'perdido');
  const closed = won.length + lost.length;
  const stages = Object.keys(LEAD_STAGE).filter((k) => k !== 'perdido');
  const maxStage = Math.max(1, ...stages.map((k) => all.filter((l) => l.stage === k).length));
  const sources = Object.entries(LEAD_SOURCE).map(([k, label]) => [k, label, all.filter((l) => l.source === k).length]).filter(([, , n]) => n).sort((a, b) => b[2] - a[2]);
  const draw = () => {
    const shown = filter === 'abiertos' ? open : filter === 'ganados' ? won : filter === 'perdidos' ? lost : all;
    fill(list, shown.length ? shown.map(leadRow) : el('p', { class: 'cl-none', text: 'Nada en este grupo.' }));
  };
  draw();
  return el('div', { class: 'cl-stack' },
    el('div', { class: 'cl-kpi-grid' },
      el('div', { class: 'cl-kpi', style: { '--c': 'var(--cf-blue)' } }, el('span', { class: 'cl-kpi-label' }, icon('funnel'), 'Este mes'), countUp(el('b', { class: 'cl-kpi-value' }), all.filter((l) => l.date?.startsWith(month)).length), el('small', { class: 'cl-kpi-sub', text: `${all.length} en total` })),
      el('div', { class: 'cl-kpi', style: { '--c': 'var(--cf-income)' } }, el('span', { class: 'cl-kpi-label' }, icon('checkCircle'), 'Ganados'), countUp(el('b', { class: 'cl-kpi-value' }), won.length), el('small', { class: 'cl-kpi-sub', text: closed ? `${Math.round((won.length / closed) * 100)}% de conversión` : 'Aún sin cerrar' })),
      el('div', { class: 'cl-kpi', style: { '--c': 'var(--cf-orange)' } }, el('span', { class: 'cl-kpi-label' }, icon('target'), 'En el embudo'), countUp(el('b', { class: 'cl-kpi-value' }), open.reduce((s, l) => s + (Number(l.value) || 0), 0), money), el('small', { class: 'cl-kpi-sub', text: plural(open.length, 'lead abierto', 'leads abiertos') })),
      el('div', { class: 'cl-kpi', style: { '--c': 'var(--cf-purple)' } }, el('span', { class: 'cl-kpi-label' }, icon('dollar'), 'Vendido'), countUp(el('b', { class: 'cl-kpi-value' }), won.reduce((s, l) => s + (Number(l.value) || 0), 0), money)),
    ),
    el('section', { class: 'cl-card cl-funnel' }, el('h3', { class: 'cl-eyebrow', text: 'Embudo' }), stages.map((k, i) => {
      const n = all.filter((l) => l.stage === k).length;
      const [label, color] = LEAD_STAGE[k];
      return el('div', { class: 'cl-funnel-row', style: { '--c': color, '--w': `${(n / maxStage) * 100}%`, '--i': i } }, el('span', { text: label }), el('span', { class: 'cl-funnel-bar' }, el('i')), el('b', { text: String(n) }));
    })),
    sources.length > 0 && el('div', { class: 'cl-chips is-wrap' }, sources.map(([, label, n]) => el('span', { class: 'cl-chip' }, el('i'), `${label} · ${n}`))),
    seg([['abiertos', 'Abiertos', open.length], ['ganados', 'Ganados', won.length], ['perdidos', 'Perdidos'], ['todos', 'Todos']], filter, (v) => { filter = v; draw(); }, { label: 'Leads' }),
    list,
  );
}

function leadRow(l) {
  const [stage, color] = LEAD_STAGE[l.stage] || LEAD_STAGE.nuevo;
  return el('button', { type: 'button', class: 'cl-row cl-lead', style: { '--c': color }, onclick: () => (isStudio() ? studio.editLead(l) : leadSheet(l)) },
    avatar(l.name),
    el('span', { class: 'cl-set-main' }, el('b', { text: l.name }), el('small', { text: [LEAD_SOURCE[l.source], l.campaign, l.date && shortDate(l.date)].filter(Boolean).join(' · ') })),
    l.value ? el('b', { class: 'cl-lead-value', text: money(l.value) }) : null,
    chip(stage, color),
  );
}

function leadSheet(l) {
  sheet(l.name, el('div', { class: 'cl-detail' },
    el('div', { class: 'cl-chips is-wrap' }, chip(LEAD_STAGE[l.stage][0], LEAD_STAGE[l.stage][1]), chip(LEAD_SOURCE[l.source]), l.campaign && chip(l.campaign, 'var(--cf-purple)', 'flag')),
    l.value && el('div', { class: 'cl-when' }, icon('dollar'), el('b', { text: money(l.value) })),
    l.contact && el('div', { class: 'cl-when' }, icon('call'), el('b', { text: l.contact })),
    el('div', { class: 'cl-when' }, icon('calendar'), el('b', { text: cap(fDay.format(dayDate(l.date))) })),
    l.notes && el('p', { class: 'cl-note-box' }, icon('doc'), l.notes),
  ));
}
