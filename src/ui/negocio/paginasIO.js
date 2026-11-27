// Páginas: traer contenido de fuera y sacarlo. Convierte Markdown y HTML (lo que
// exportan Notion, Google Docs, Obsidian o cualquier web al copiar) en bloques de
// página, y los bloques en Markdown. También decide qué vídeos se pueden incrustar.
import { uid } from '../../negocio-core.js';

export const block = (kind, text = '', extra = {}) => ({ id: uid(), kind, text, checked: false, ...extra });
const isWeb = (u) => /^https?:\/\//i.test(String(u || '').trim());
const EMOJI_START = /^(\p{Extended_Pictographic}️?)\s+([\s\S]*)$/u;

/* ── Markdown → bloques ─────────────────────────────────────────────────── */

const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

/** Markdown (con tablas, pendientes, citas, código e imágenes) en bloques. */
export function mdToBlocks(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    const text = para.join('\n').trim();
    if (text) out.push(block('p', text));
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*(```|~~~)/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(block('code', code.join('\n')));
      continue;
    }
    if (!line.trim()) {
      flush();
      i += 1;
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) {
      flush();
      const n = m[1].length;
      out.push(block(n === 1 ? 'h1' : n === 2 ? 'h2' : 'h3', m[2]));
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push(block('divider'));
      i += 1;
      continue;
    }
    if ((m = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) {
      flush();
      out.push(block('todo', m[2], { checked: m[1] !== ' ' }));
      i += 1;
      continue;
    }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
      flush();
      out.push(block('bullet', m[1]));
      i += 1;
      continue;
    }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flush();
      out.push(block('number', m[1]));
      i += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      const text = quote.join('\n').trim();
      const em = EMOJI_START.exec(text);
      out.push(em ? block('callout', em[2], { emoji: em[1] }) : block('quote', text));
      continue;
    }
    if ((m = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)\s*$/.exec(line))) {
      flush();
      // Las imágenes con ruta relativa (las de una exportación) no se pueden ver aquí.
      out.push(isWeb(m[2]) ? block('image', m[1], { url: m[2] }) : block('p', m[1] ? `Imagen: ${m[1]}` : 'Imagen'));
      i += 1;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      flush();
      const rows = [cells(line)];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      const width = Math.max(...rows.map((r) => r.length));
      out.push(block('table', '', { rows: rows.map((r) => [...r, ...Array(width - r.length).fill('')]), header: true }));
      continue;
    }
    para.push(line);
    i += 1;
  }
  flush();
  return out;
}

/* ── HTML → bloques ─────────────────────────────────────────────────────── */

/** El texto de un nodo con su formato en Markdown (negrita, cursiva, código y enlaces). */
function inlineMd(node) {
  let s = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) {
      s += n.textContent.replace(/\s+/g, ' ');
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    const inner = inlineMd(n);
    if (tag === 'br') s += '\n';
    else if ((tag === 'strong' || tag === 'b') && inner.trim()) s += `**${inner.trim()}**`;
    else if ((tag === 'em' || tag === 'i') && inner.trim()) s += `*${inner.trim()}*`;
    else if ((tag === 's' || tag === 'del' || tag === 'strike') && inner.trim()) s += `~~${inner.trim()}~~`;
    else if (tag === 'code' && inner.trim()) s += `\`${inner.trim()}\``;
    else if (tag === 'a' && isWeb(n.getAttribute('href'))) s += inner.trim() && inner.trim() !== n.getAttribute('href') ? `[${inner.trim()}](${n.getAttribute('href')})` : n.getAttribute('href');
    else if (tag === 'img') s += '';
    else s += inner;
  }
  return s;
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'img', 'table', 'figure', 'details', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'body']);

/** HTML (una exportación o lo que se copia de una web) en bloques. */
export function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const out = [];
  const text = (n) => inlineMd(n).replace(/[ \t]+\n/g, '\n').trim();
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.trim();
        if (t) out.push(block('p', t));
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (['script', 'style', 'meta', 'link', 'title', 'head', 'noscript'].includes(tag)) continue;
      if (/^h[1-6]$/.test(tag)) {
        const t = text(n);
        if (t) out.push(block(tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3', t));
      } else if (tag === 'p') {
        const imgs = [...n.querySelectorAll('img')].filter((img) => isWeb(img.getAttribute('src')));
        const t = text(n);
        if (t) out.push(block('p', t));
        for (const img of imgs) out.push(block('image', img.getAttribute('alt') || '', { url: img.getAttribute('src') }));
      } else if (tag === 'ul' || tag === 'ol') {
        for (const li of n.children) {
          if (li.tagName.toLowerCase() !== 'li') continue;
          const box = li.querySelector(':scope > input[type="checkbox"], :scope > label > input[type="checkbox"]');
          const nested = [...li.querySelectorAll(':scope > ul, :scope > ol')];
          for (const x of nested) x.remove();
          const t = text(li);
          if (box) out.push(block('todo', t, { checked: box.checked || box.hasAttribute('checked') }));
          else if (t) out.push(block(tag === 'ol' ? 'number' : 'bullet', t));
          for (const x of nested) walk({ childNodes: [x] });
        }
      } else if (tag === 'blockquote') {
        const t = text(n);
        const em = EMOJI_START.exec(t);
        if (t) out.push(em ? block('callout', em[2], { emoji: em[1] }) : block('quote', t));
      } else if (tag === 'pre') {
        out.push(block('code', n.textContent.replace(/\n$/, '')));
      } else if (tag === 'hr') {
        out.push(block('divider'));
      } else if (tag === 'img') {
        if (isWeb(n.getAttribute('src'))) out.push(block('image', n.getAttribute('alt') || '', { url: n.getAttribute('src') }));
      } else if (tag === 'table') {
        const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => text(c)));
        const width = Math.max(0, ...rows.map((r) => r.length));
        if (width) out.push(block('table', '', { rows: rows.map((r) => [...r, ...Array(width - r.length).fill('')]), header: Boolean(n.querySelector('th')) }));
      } else if (tag === 'details') {
        const summary = n.querySelector(':scope > summary');
        const title = summary ? text(summary) : '';
        if (summary) summary.remove();
        out.push(block('toggle', title, { body: text(n), open: false }));
      } else if (tag === 'figure') {
        const img = n.querySelector('img');
        const cap = n.querySelector('figcaption');
        if (img && isWeb(img.getAttribute('src'))) out.push(block('image', cap ? text(cap) : img.getAttribute('alt') || '', { url: img.getAttribute('src') }));
        else if (n.textContent.trim()) walk(n);
      } else if ([...n.children].some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()))) {
        walk(n);
      } else {
        const t = text(n);
        if (t) out.push(block('p', t));
      }
    }
  };
  walk(doc.body);
  return out;
}

/** Si el primer bloque es un título, pasa a ser el título de la página. */
export function takeTitle(blocks, fallback = '') {
  if (blocks[0]?.kind === 'h1' && blocks[0].text.trim()) return blocks.shift().text.trim();
  return fallback;
}

/** Un archivo (.md, .txt, .html) en { title, blocks }. */
export async function readPageFile(file) {
  const raw = await file.text();
  const name = file.name.replace(/\.[^.]+$/, '').replace(/\s+[0-9a-f]{32}$/i, '').trim();
  const isHtml = /\.html?$/i.test(file.name) || /^\s*<(!doctype|html|body|div|p|h1)/i.test(raw);
  const blocks = isHtml ? htmlToBlocks(raw) : /\.(md|markdown)$/i.test(file.name) ? mdToBlocks(raw) : mdToBlocks(raw);
  // En HTML el título puede venir en <title>.
  const htmlTitle = isHtml ? new DOMParser().parseFromString(raw, 'text/html').title?.trim() : '';
  const title = takeTitle(blocks, htmlTitle || name);
  return { title, blocks };
}

/* ── Vídeos ─────────────────────────────────────────────────────────────── */

/** La dirección para incrustar un vídeo de YouTube, Vimeo o Loom (o null). */
export function embedUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || (u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/) || [])[2];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(id || '') ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === 'loom.com') {
      const m = u.pathname.match(/\/share\/([a-z0-9]+)/i);
      return m ? `https://www.loom.com/embed/${m[1]}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

/* ── Bloques → Markdown (los que no son de texto) ───────────────────────── */

/** Una tabla en Markdown. */
export function tableMd(rows = [], header = true) {
  if (!rows.length) return '';
  const esc = (c) => String(c || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const line = (r) => `| ${r.map(esc).join(' | ')} |`;
  const head = header ? rows[0] : rows[0].map(() => '');
  const body = header ? rows.slice(1) : rows;
  return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}
