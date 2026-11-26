// Markdown pequeño para el editor de texto (RichText): lo que se guarda es texto
// con formato legible (# títulos, **negrita**, - listas…), así que en la versión de
// siempre, que lo muestra como texto, se sigue entendiendo.
//
// Bloques: # ## ### títulos, > cita, - o * lista, 1. lista numerada, ``` código.
// En línea: **negrita**, *cursiva*, ~~tachado~~, `código`, [texto](https://…), <u>subrayado</u>.
// La barra invertida protege un signo (\* se queda como asterisco).

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

/** Texto en línea de Markdown → HTML seguro (todo se escapa antes). */
export function inlineToHtml(text) {
  const slots = [];
  const keep = (html) => {
    slots.push(html);
    return `\u0000${slots.length - 1}\u0000`;
  };
  let s = text;
  // Signos protegidos y código, antes que nada.
  s = s.replace(/\\([\\*_~`[\]<>#-])/g, (_, c) => keep(esc(c)));
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, url) => {
    const u = url.replace(/&amp;/g, '&');
    return SAFE_URL.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t}</a>` : m;
  });
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+?)~~/g, '<s>$1</s>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, '<u>$1</u>');
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)]);
}

/** Markdown → HTML para el editor y para mostrarlo. */
export function mdToHtml(md = '') {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inlineToHtml).join('<br>')}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      out.push(`<h${h[1].length}>${inlineToHtml(h[2])}</h${h[1].length}>`);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${q.map(inlineToHtml).join('<br>')}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const li = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) li.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push(`<ul>${li.map((t) => `<li>${inlineToHtml(t)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara();
      const li = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) li.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push(`<ol>${li.map((t) => `<li>${inlineToHtml(t)}</li>`).join('')}</ol>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flushPara();
  return out.join('');
}

// Solo se protegen los signos que de verdad cambiarían el formato. Los corchetes y
// el guion bajo se dejan tal cual: la versión de siempre usa [[página]] y claves
// como WEB-3 en el texto, y deben seguir leyéndose igual.
const escMd = (s) => s.replace(/([\\*~`])/g, '\\$1').replace(/^(#{1,3}\s|>\s|[-*]\s|\d+[.)]\s)/, '\\$1');

/** Contenido de un elemento en línea → Markdown. */
function inlineMd(node) {
  let s = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      s += escMd(n.nodeValue.replace(/\u00a0/g, ' '));
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    const inner = inlineMd(n);
    const st = n.getAttribute('style') || '';
    if (tag === 'br') s += '\n';
    else if (!inner.trim() && tag !== 'code') s += inner;
    else if (tag === 'b' || tag === 'strong' || /font-weight:\s*(bold|[6-9]00)/.test(st)) s += `**${inner}**`;
    else if (tag === 'i' || tag === 'em' || /font-style:\s*italic/.test(st)) s += `*${inner}*`;
    else if (tag === 'u' || /underline/.test(st)) s += `<u>${inner}</u>`;
    else if (tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(st)) s += `~~${inner}~~`;
    else if (tag === 'code') s += `\`${n.textContent.replace(/`/g, "'")}\``;
    else if (tag === 'a') {
      const href = n.getAttribute('href') || '';
      s += SAFE_URL.test(href) ? `[${inner}](${href})` : inner;
    } else if (['p', 'div', 'h1', 'h2', 'h3', 'li', 'blockquote', 'ul', 'ol', 'pre'].includes(tag)) s += `${s && !s.endsWith('\n') ? '\n' : ''}${inner}`;
    else s += inner;
  });
  return s;
}

/** Contenido del editor → Markdown. */
export function htmlToMd(root) {
  const blocks = [];
  let loose = '';
  const flushLoose = () => {
    if (loose.trim()) blocks.push(loose.trim());
    loose = '';
  };
  root.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      loose += escMd(n.nodeValue);
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'a', 'span', 'br'].includes(tag)) {
      const wrap = document.createElement('div');
      wrap.appendChild(n.cloneNode(true));
      loose += inlineMd(wrap);
      return;
    }
    flushLoose();
    if (/^h[1-3]$/.test(tag)) blocks.push(`${'#'.repeat(Number(tag[1]))} ${inlineMd(n).replace(/\n/g, ' ').trim()}`);
    else if (tag === 'blockquote')
      blocks.push(
        inlineMd(n)
          .split('\n')
          .filter((l, k, arr) => l.trim() || (k > 0 && k < arr.length - 1))
          .map((l) => `> ${l}`)
          .join('\n'),
      );
    else if (tag === 'ul' || tag === 'ol') {
      const items = [...n.querySelectorAll(':scope > li')].map((li, k) => `${tag === 'ol' ? `${k + 1}.` : '-'} ${inlineMd(li).replace(/\n+/g, ' ').trim()}`);
      if (items.length) blocks.push(items.join('\n'));
    } else if (tag === 'pre') blocks.push(`\`\`\`\n${n.textContent.replace(/\n$/, '')}\n\`\`\``);
    else {
      const t = inlineMd(n).replace(/\n+$/, '');
      if (t.trim()) blocks.push(t);
    }
  });
  flushLoose();
  return blocks.join('\n\n');
}

/** Texto plano (para contar palabras o buscar). */
export function mdToText(md = '') {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<\/?u>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`#>]/g, '')
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, '')
    .trim();
}
