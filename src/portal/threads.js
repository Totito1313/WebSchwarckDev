// Conversaciones: el cliente y el estudio comentan una publicación, una petición,
// un anuncio o un trabajo. Burbujas como en Mensajes, la propia a la derecha.

import { el, fill, icon, toast, sheet, ago, textarea, avatar } from './kit.js';
import { react } from './feel.js';
import { app, myName, commentsOf, upsertLocal, targetTitle, memberOf, urlOf, redraw } from './state.js';

export function thread(target, id, { compact = false } = {}) {
  const list = el('div', { class: 'cl-thread-list', role: 'log', 'aria-live': 'polite' });
  const area = textarea({ placeholder: app.studio ? 'Responde al cliente…' : 'Escribe una pregunta o un comentario…', rows: 1, maxLength: 4000, 'aria-label': 'Comentario' });
  const send = el('button', { type: 'button', class: 'cl-thread-send', 'aria-label': 'Enviar', disabled: true }, icon('send'));
  area.addEventListener('input', () => {
    send.disabled = !area.value.trim();
  });
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send.click();
  });

  const draw = (fresh) => {
    const items = commentsOf(target, id);
    if (!items.length) {
      fill(list, el('p', { class: 'cl-thread-empty', text: app.studio ? 'Sin comentarios todavía.' : '¿Dudas o cambios? Escríbenos aquí: te respondemos en este mismo hilo.' }));
      return;
    }
    let prev = null;
    fill(list, items.map((c) => {
      const mine = c.from_studio === app.studio;
      const who = c.from_studio ? 'Schwarck' : c.author || memberOf(c.user_id)?.name || 'Cliente';
      const grouped = prev && prev.from_studio === c.from_studio && prev.user_id === c.user_id && new Date(c.created_at) - new Date(prev.created_at) < 300_000;
      prev = c;
      const face = c.from_studio ? el('span', { class: 'cl-avatar xs is-studio' }, el('img', { src: '/favicon.svg', alt: '' })) : avatar(who, urlOf(memberOf(c.user_id)?.avatar_path), 'xs');
      return el('div', { class: `cl-bubble-row${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}${fresh === c.id ? ' is-new' : ''}` },
        !mine && (grouped ? el('span', { class: 'cl-avatar-gap' }) : face),
        el('div', { class: 'cl-bubble' },
          !mine && !grouped && el('b', { class: 'cl-bubble-who', text: who }),
          el('p', { text: c.body }),
          el('small', { text: ago(c.created_at) }),
        ),
      );
    }));
    if (fresh) list.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  send.addEventListener('click', async () => {
    const body = area.value.trim();
    if (!body) return;
    send.disabled = true;
    send.classList.add('is-busy');
    try {
      const row = await app.backend.comment(app.client.id, target, id, body, { studio: app.studio, author: myName() });
      upsertLocal('comments', row);
      app.data.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      area.value = '';
      area.dispatchEvent(new Event('input'));
      react('send');
      draw(row.id);
      redraw();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      send.classList.remove('is-busy');
      send.disabled = !area.value.trim();
    }
  });

  draw();
  const node = el('section', { class: `cl-thread${compact ? ' is-compact' : ''}` },
    el('h3', { class: 'cl-thread-title' }, icon('chat'), 'Conversación', el('small', { text: commentsOf(target, id).length ? String(commentsOf(target, id).length) : '' })),
    list,
    el('div', { class: 'cl-thread-compose' }, area, send),
  );
  node.refresh = () => draw();
  return node;
}

export function openThread(target, id) {
  const t = thread(target, id);
  const ui = sheet(targetTitle(target, id), t, { subtitle: { content: 'Publicación', task: 'Petición', post: 'Tablón', work: 'Trabajo' }[target] });
  return ui;
}

/** Cuántos comentarios tiene algo, para la ficha de la lista. */
export function commentCount(target, id) {
  const n = commentsOf(target, id).length;
  return n ? el('span', { class: 'cl-ccount' }, icon('chat'), String(n)) : null;
}

export function refreshThreadsIn(root) {
  for (const t of root.querySelectorAll('.cl-thread')) t.refresh?.();
}
