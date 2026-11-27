// Páginas: notas, guías, briefs y actas, como en Notion. El árbol a la izquierda
// (favoritas primero, con sus subpáginas plegables) y la página con su portada, su
// icono, su cliente y proyecto y sus bloques: texto, títulos, listas, pendientes,
// citas, destacados, código, separadores, imágenes, enlaces y subpáginas.
//
// Cada bloque se escribe en un campo normal y, sin foco, se lee con sus enlaces: la
// clave de una tarea (CF-12), el número de un documento (FAC-2026-0001) o [[otra
// página]]. Atajos: «/» elige el tipo de bloque; al empezar una línea con #, ##, -,
// 1., [], > o ``` se convierte sola; «[[» busca qué enlazar; Ctrl+B y Ctrl+I ponen
// negrita y cursiva. Las reglas (plantillas, Markdown, menciones) son las de
// negocio-paginas.js y negocio-enlaces.js, la versión de siempre.
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpFromLine,
  ArrowUpRightFromSquare,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Copy,
  EllipsisVertical,
  FaceSmile,
  FileArrowUp,
  FileText,
  Globe,
  Grip,
  Link as LinkIcon,
  LogoMarkdown,
  Paperclip,
  Picture,
  Plus,
  Printer,
  Person as PersonIcon,
  SquareArticle,
  Star,
  StarFill,
  TrashBin,
  Xmark,
} from '@gravity-ui/icons';
import { Button, ButtonGroup, Card, Checkbox, Description, Dropdown, Label, Popover, ScrollShadow, SearchField, Separator, toast } from '@heroui/react';
import { dateText, find, put, remove, state as crm, timeText, uid } from '../../../negocio-core.js';
import { PAGE_TEMPLATES, createPage } from '../../../negocio-paginas.js';
import { COVERS, TOKENS, backlinks, coverBg, docByNumber, pageByTitle, pageIcon, pageTitle, renamePageRefs } from '../../../negocio-enlaces.js';
import { TASK_STATUS, findTaskByKey, projectName, taskKey } from '../../../negocio-work.js';
import { fileUrl, uploadFile } from '../../../negocio-gastos.js';
import { DOC_WORD } from '../domain.js';
import { block as ioBlock, embedUrl, htmlToBlocks, mdToBlocks, readPageFile, tableMd } from '../paginasIO.js';
import { Empty, PageHeader, Panel, Person } from '../../kit/parts.jsx';
import { PointPicker, below } from '../../kit/PointPicker.jsx';
import { copyText } from '../../kit/csv.js';
import { PointMenu } from '../../pro/ContextMenu.jsx';
import { pickImage } from '../editor/shared.jsx';
import { go, useCrm } from '../store.js';
import { ConfirmDialog } from '../fields.jsx';

/* ── Tipos de bloque ────────────────────────────────────────────────────── */

const KINDS = {
  p: ['Texto', 'Escribe, o pulsa «/» para elegir un bloque', 'Párrafo'],
  h1: ['Título', 'Título', '#'],
  h2: ['Subtítulo', 'Subtítulo', '##'],
  h3: ['Encabezado', 'Encabezado', '###'],
  bullet: ['Lista', 'Elemento', '-'],
  number: ['Lista numerada', 'Elemento', '1.'],
  todo: ['Pendiente', 'Por hacer', '[]'],
  quote: ['Cita', 'Cita', '>'],
  callout: ['Destacado', 'Algo que no se debe pasar por alto', 'Con su icono'],
  code: ['Código', 'Código', '```'],
  divider: ['Separador', '', '---'],
  image: ['Imagen', 'Pie de foto (opcional)', 'Sube una foto o captura'],
  link: ['Enlace', '', 'A una tarea, página o documento'],
  subpage: ['Subpágina', '', 'Una página dentro de esta'],
  toggle: ['Desplegable', 'Título del desplegable', 'Se abre y se cierra'],
  table: ['Tabla', '', 'Filas y columnas'],
  bookmark: ['Enlace web', '', 'Una dirección con su título'],
  video: ['Vídeo', 'Pie del vídeo (opcional)', 'YouTube, Vimeo o Loom'],
  file: ['PDF', '', 'Un documento adjunto'],
  toc: ['Índice', '', 'Los títulos de esta página'],
};
const KIND_LEAD = { p: '¶', h1: 'H1', h2: 'H2', h3: 'H3', bullet: '•', number: '1.', todo: '☐', quote: '❝', callout: '💡', code: '{ }', divider: '—', image: '🖼️', link: '🔗', subpage: '📄', toggle: '▸', table: '▦', bookmark: '🌐', video: '▶', file: '📎', toc: '☰' };
const TEXTUAL = new Set(['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code', 'toggle']);
const LISTS = new Set(['bullet', 'number', 'todo']);
const CONVERTIBLE = ['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'callout', 'code', 'toggle'];
const SHORTCUTS = [[/^###\s/, 'h3'], [/^##\s/, 'h2'], [/^#\s/, 'h1'], [/^[-*]\s/, 'bullet'], [/^1[.)]\s/, 'number'], [/^\[ ?\]\s/, 'todo'], [/^>\s/, 'quote'], [/^```$/, 'code'], [/^---$/, 'divider']];
const EMOJIS = ['📄', '📝', '📌', '📎', '📚', '🗂️', '💡', '🚀', '🎯', '✅', '📅', '📊', '📈', '💰', '🧾', '🤝', '👥', '🎨', '🖌️', '📱', '💻', '⚙️', '🔧', '🧪', '🐞', '📣', '✨', '🔥', '⭐', '❤️', '🏁', '📦', '🛒', '🏷️', '🧭', '🏠', '🏢', '🌐', '🔒', '🔑', '🧠', '🎬', '📸', '🎵', '☕', '🍀', '🦁', '🧩'];
const TEXT_STYLE = {
  p: 'text-[15px] leading-relaxed',
  h1: 'text-3xl font-bold tracking-tight leading-tight',
  h2: 'text-2xl font-semibold tracking-tight leading-snug',
  h3: 'text-lg font-semibold leading-snug',
  bullet: 'text-[15px] leading-relaxed',
  number: 'text-[15px] leading-relaxed',
  todo: 'text-[15px] leading-relaxed',
  quote: 'text-[15px] leading-relaxed italic',
  callout: 'text-[15px] leading-relaxed',
  code: 'font-mono text-[13px] leading-relaxed',
  image: 'text-xs text-muted',
  video: 'text-xs text-muted',
  toggle: 'text-[15px] font-medium leading-relaxed',
};
const TOP = { h1: 'mt-6', h2: 'mt-5', h3: 'mt-3' };
const STATUS_DOT = { request: 'bg-accent', todo: 'bg-muted', doing: 'bg-accent', review: 'bg-warning', done: 'bg-success' };

const block = (kind, text = '', extra = {}) => ({ id: uid(), kind, text, checked: false, ...extra });
const pages = () => crm.pages || [];
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || pageTitle(a).localeCompare(pageTitle(b));
const byUpdated = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '');
const isRoot = (p) => !p.parentId || !find('pages', p.parentId);
const childrenOf = (id) => pages().filter((p) => p.parentId === id).sort(byOrder);
const localDay = (stamp) => (stamp ? new Date(stamp).toLocaleDateString('en-CA') : '');
const editedText = (p) => (p.updatedAt ? `Editada el ${dateText(localDay(p.updatedAt))}, ${timeText(p.updatedAt)}` : 'Sin guardar todavía');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function ancestors(p) {
  const out = [];
  const seen = new Set();
  let cur = p?.parentId && find('pages', p.parentId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId && find('pages', cur.parentId);
  }
  return out;
}
/** La página y todo lo que cuelga de ella. */
function familyOf(p) {
  const out = [p];
  for (let i = 0; i < out.length; i += 1) out.push(...childrenOf(out[i].id));
  return out;
}

/** La página en Markdown (para pegarla en otro sitio). */
function toMarkdown(page) {
  const lines = [`# ${pageTitle(page)}`, ''];
  let n = 0;
  for (const b of page.blocks || []) {
    n = b.kind === 'number' ? n + 1 : 0;
    const t = b.text || '';
    switch (b.kind) {
      case 'h1': lines.push(`## ${t}`, ''); break;
      case 'h2': lines.push(`### ${t}`, ''); break;
      case 'h3': lines.push(`#### ${t}`, ''); break;
      case 'bullet': lines.push(`- ${t}`); break;
      case 'number': lines.push(`${n}. ${t}`); break;
      case 'todo': lines.push(`- [${b.checked ? 'x' : ' '}] ${t}`); break;
      case 'quote': lines.push(`> ${t.split('\n').join('\n> ')}`, ''); break;
      case 'callout': lines.push(`> ${b.emoji || '💡'} ${t.split('\n').join('\n> ')}`, ''); break;
      case 'code': lines.push('```', t, '```', ''); break;
      case 'divider': lines.push('---', ''); break;
      case 'image': lines.push(`![${t}](${new URL(b.url || '', location.origin).href})`, ''); break;
      case 'toggle': lines.push('<details>', `<summary>${t}</summary>`, '', b.body || '', '', '</details>', ''); break;
      case 'table': lines.push(tableMd(b.rows || [], b.header !== false), ''); break;
      case 'bookmark': if (b.url) lines.push(`[${t || b.url}](${b.url})`, ''); break;
      case 'video': if (b.url) lines.push(b.url, t, ''); break;
      case 'file': if (b.url) lines.push(`[${t || 'Documento'}](${new URL(b.url, location.origin).href})`, ''); break;
      case 'toc': break;
      case 'link': {
        const target = linkTarget(b);
        if (target) lines.push(b.target === 'page' ? `[[${pageTitle(target)}]]` : b.target === 'task' ? `${taskKey(target)} ${target.title || ''}` : target.number, '');
        break;
      }
      default: lines.push(t, '');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const IMPORT_ACCEPT = '.md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html';
/** Elegir uno o varios archivos de texto. */
function pickTextFiles(done) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMPORT_ACCEPT;
  input.multiple = true;
  input.addEventListener('change', () => {
    const files = [...(input.files || [])];
    if (files.length) done(files);
  });
  input.click();
}
/** Cada archivo, una página nueva (en scope: dentro de otra, de un cliente o de un proyecto). */
function importPages(scope = {}) {
  pickTextFiles(async (files) => {
    let last = null;
    for (const file of files) {
      try {
        const { title, blocks } = await readPageFile(file);
        const page = createPage({ ...scope, title, open: false });
        page.blocks = blocks.length ? blocks : [ioBlock('p')];
        put('pages', page);
        last = page;
      } catch {
        toast.danger(`No se pudo leer ${file.name}`);
      }
    }
    if (!last) return;
    toast.success(files.length > 1 ? `Importadas ${files.length} páginas` : `Importada «${pageTitle(last)}»`);
    go(`#/paginas/${last.id}`);
  });
}
function downloadText(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const linkTarget = (b) => (b.target === 'page' ? find('pages', b.ref) : b.target === 'task' ? find('tasks', b.ref) : find('docs', b.ref));

/** Lo que se puede enlazar: páginas, tareas con clave y documentos con número. */
function linkItems() {
  return [
    ...pages().map((p) => ({ id: `page:${p.id}`, kind: 'page', item: p, lead: pageIcon(p), label: pageTitle(p), sub: 'Página', insert: `[[${pageTitle(p)}]]` })),
    ...[...crm.tasks]
      .filter((t) => t.num)
      .sort(byUpdated)
      .map((t) => ({ id: `task:${t.id}`, kind: 'task', item: t, lead: <span className={`size-2 rounded-full ${STATUS_DOT[t.status] || 'bg-muted'}`} />, label: `${taskKey(t)} · ${t.title || 'Sin título'}`, sub: projectName(t.projectId) || 'Tarea sin proyecto', insert: taskKey(t) })),
    ...crm.docs
      .filter((d) => d.number)
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
      .map((d) => ({ id: `doc:${d.id}`, kind: 'doc', item: d, lead: <FileText className="size-4 text-muted" />, label: `${d.number} · ${d.type === 'proposal' && d.title ? d.title : d.customer?.name || 'Sin cliente'}`, sub: DOC_WORD[d.type] || 'Documento', insert: d.number })),
  ];
}

/* ── Texto con enlaces ──────────────────────────────────────────────────── */

const chip = 'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-lg bg-default px-1.5 py-px align-baseline text-[0.88em] font-medium leading-normal not-italic text-foreground no-underline hover:bg-default-hover';

export function TaskChip({ t }) {
  const [label] = TASK_STATUS[t.status] || TASK_STATUS.todo;
  return (
    <a href={`#/tareas/${taskKey(t)}`} title={`${taskKey(t)} · ${t.title || 'Sin título'} · ${label}`} className={chip}>
      <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[t.status] || 'bg-muted'}`} />
      <span className="font-mono text-[0.92em] text-muted">{taskKey(t)}</span>
      <span className={`truncate ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{t.title || 'Sin título'}</span>
    </a>
  );
}
export function PageChip({ p }) {
  return (
    <a href={`#/paginas/${p.id}`} title={pageTitle(p)} className={chip}>
      <span aria-hidden>{pageIcon(p)}</span>
      <span className="truncate">{pageTitle(p)}</span>
    </a>
  );
}
function DocChip({ d }) {
  return (
    <a href={`#/documentos/${d.id}`} title={`${DOC_WORD[d.type] || 'Documento'} ${d.number}`} className={chip}>
      <FileText className="size-3.5 shrink-0 text-muted" />
      <span className="font-mono text-[0.92em]">{d.number}</span>
      {(d.customer?.name || d.title) && <span className="truncate text-muted">{d.type === 'proposal' && d.title ? d.title : d.customer?.name}</span>}
    </a>
  );
}

function Token({ raw, g }) {
  if (g.code) return <code className="rounded-md bg-default px-1 font-mono text-[0.88em]">{raw.slice(1, -1)}</code>;
  if (g.mdlink) {
    const [, label, href] = /^\[([^\]]+)\]\((.+)\)$/.exec(raw);
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
        {label}
      </a>
    );
  }
  if (g.page) {
    const title = raw.slice(2, -2).trim();
    const p = pageByTitle(title);
    if (p) return <PageChip p={p} />;
    return (
      <button type="button" title="Esta página no existe: tócala para crearla" className={`${chip} border border-dashed border-border bg-transparent`} onClick={() => createPage({ title })}>
        <Plus className="size-3" />
        <span className="truncate">{title}</span>
      </button>
    );
  }
  if (g.url)
    return (
      <a href={raw} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">
        {raw.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
    );
  if (g.doc) {
    const d = docByNumber(raw);
    return d ? <DocChip d={d} /> : raw;
  }
  if (g.task) {
    const t = findTaskByKey(raw);
    return t ? <TaskChip t={t} /> : raw;
  }
  if (g.bold) return <strong>{raw.slice(2, -2)}</strong>;
  if (g.strike) return <s>{raw.slice(2, -2)}</s>;
  if (g.em) return <em>{raw.slice(1, -1)}</em>;
  return raw;
}

/** Texto con sus enlaces, negritas y código, como se lee sin foco. */
export function Inline({ text }) {
  const s = String(text || '');
  const out = [];
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(TOKENS)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<Token key={k++} raw={m[0]} g={m.groups} />);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function EmojiGrid({ onPick, onRemove }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((e) => (
          <Button key={e} isIconOnly size="sm" variant="ghost" slot="close" aria-label={e} className="text-lg" onPress={() => onPick(e)}>
            {e}
          </Button>
        ))}
      </div>
      {onRemove && (
        <Button size="sm" variant="danger-soft" slot="close" onPress={onRemove}>
          <Xmark />
          Quitar icono
        </Button>
      )}
    </div>
  );
}

function CoverArt({ cover, className = '' }) {
  if (!cover) return null;
  if (cover.url) return <img src={cover.url} alt="" loading="lazy" className={`object-cover ${className}`} />;
  return <div className={className} style={{ background: coverBg(cover.color || 'sky') }} />;
}

function CoverPicker({ hasCover, onChange, children }) {
  return (
    <Popover>
      {children}
      <Popover.Content placement="bottom end" className="w-72">
        <Popover.Dialog className="flex flex-col gap-3">
          <span className="sw-eyebrow">Portada</span>
          <div className="grid grid-cols-5 gap-2">
            {COVERS.map((c) => (
              <Button key={c} slot="close" isIconOnly aria-label={c === 'sky' ? 'Cielo' : `Color ${c}`} className="h-9 w-full rounded-xl p-0" style={{ background: coverBg(c) }} onPress={() => onChange({ color: c })} />
            ))}
          </div>
          <Button size="sm" variant="secondary" slot="close" onPress={() => pickImage((url) => onChange({ url }))}>
            <Picture />
            Subir una imagen
          </Button>
          {hasCover && (
            <Button size="sm" variant="danger-soft" slot="close" onPress={() => onChange(null)}>
              <TrashBin />
              Quitar portada
            </Button>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** Menú «Nueva página»: en blanco o desde una plantilla. scope: { parentId, customerId, projectId } */
function NewPageButton({ scope = {}, size = 'md', variant = 'primary', label = 'Nueva página' }) {
  return (
    <ButtonGroup size={size} variant={variant}>
      <Button size={size} variant={variant} onPress={() => createPage({ ...scope, template: 'blank' })}>
        <Plus />
        {label}
      </Button>
      <Dropdown>
        <Button isIconOnly size={size} variant={variant} aria-label="Desde una plantilla">
          <ButtonGroup.Separator />
          <ChevronDown />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-72">
          <Dropdown.Menu aria-label="Plantillas" onAction={(k) => (k === '_import' ? importPages(scope) : createPage({ ...scope, template: String(k) }))}>
            {Object.entries(PAGE_TEMPLATES).map(([k, [tLabel, emoji, note]]) => (
              <Dropdown.Item key={k} id={k} textValue={tLabel}>
                <span aria-hidden className="text-lg">
                  {emoji}
                </span>
                <div className="flex flex-col">
                  <Label>{tLabel}</Label>
                  <Description>{note}</Description>
                </div>
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="_import" textValue="Importar archivos">
              <FileArrowUp className="size-5 text-muted" />
              <div className="flex flex-col">
                <Label>Importar archivos…</Label>
                <Description>Markdown, texto o HTML (Notion, Google Docs…)</Description>
              </div>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </ButtonGroup>
  );
}

/** Tarjeta de lo enlazado: una página (con sus subpáginas), una tarea o un documento. */
function LinkCard({ b }) {
  const target = linkTarget(b);
  if (!target)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2.5 text-sm text-muted">
        <LinkIcon className="size-4" />
        Lo enlazado ya no existe.
      </div>
    );
  if (b.target === 'page') {
    const kids = childrenOf(target.id).length;
    return (
      <a href={`#/paginas/${target.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-secondary px-3 py-2.5 no-underline outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
        <span className="text-xl" aria-hidden>
          {pageIcon(target)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-sm font-semibold">{pageTitle(target)}</b>
          <span className="truncate text-xs text-muted">{[kids && plural(kids, 'subpágina', 'subpáginas'), editedText(target)].filter(Boolean).join(' · ')}</span>
        </span>
        <ChevronRight className="size-4 text-muted" />
      </a>
    );
  }
  if (b.target === 'task') {
    const [label] = TASK_STATUS[target.status] || TASK_STATUS.todo;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5 text-sm">
        <TaskChip t={target} />
        <span className="text-xs text-muted">
          {label} · {projectName(target.projectId) || 'Sin proyecto'}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5 text-sm">
      <DocChip d={target} />
      <span className="text-xs text-muted">{target.customer?.name || ''}</span>
    </div>
  );
}

/* ── Un bloque de texto ─────────────────────────────────────────────────── */

function TextBlock({ b, ed, className = '' }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const [focused, setFocused] = useState(false);
  const area = useRef(null);
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${a.scrollHeight}px`;
  });
  const text = b.text || '';
  const showView = !focused && text.length > 0;
  return (
    <div className={`relative min-w-0 flex-1 ${TEXT_STYLE[b.kind] || ''} ${className}`}>
      {showView && (
        <div
          className={`min-h-[1.5em] cursor-text break-words ${b.kind === 'code' ? 'whitespace-pre overflow-x-auto' : 'whitespace-pre-wrap'} ${b.kind === 'todo' && b.checked ? 'text-muted line-through' : ''}`}
          onClick={(e) => {
            if (e.target.closest('a,button')) return;
            area.current?.focus();
            area.current?.setSelectionRange(text.length, text.length);
          }}
        >
          {b.kind === 'code' ? text : <Inline text={text} />}
        </div>
      )}
      <textarea
        ref={area}
        rows={1}
        value={text}
        spellCheck={b.kind !== 'code'}
        wrap={b.kind === 'code' ? 'off' : undefined}
        aria-label={KINDS[b.kind]?.[0] || 'Texto'}
        placeholder={focused || b.kind !== 'p' ? KINDS[b.kind]?.[1] || '' : ''}
        className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-muted/70 ${showView ? 'pointer-events-none absolute inset-0 opacity-0' : ''} ${b.kind === 'todo' && b.checked ? 'text-muted line-through' : ''}`}
        style={{ font: 'inherit', letterSpacing: 'inherit' }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          ed.onInput(e, b);
          force();
        }}
        onKeyDown={(e) => ed.onKey(e, b)}
        onPaste={(e) => {
          const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            e.preventDefault();
            ed.addImages(files, b);
            return;
          }
          if (b.kind === 'code') return;
          // Markdown o HTML (de Notion, Google Docs o una web) se pegan como bloques.
          const html = e.clipboardData?.getData('text/html') || '';
          const plain = e.clipboardData?.getData('text/plain') || '';
          let list = [];
          if (html && /<(p|h[1-6]|li|table|pre|blockquote|hr|img|details)\b/i.test(html)) list = htmlToBlocks(html);
          else if (plain.includes('\n') || /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|\|)/.test(plain)) list = mdToBlocks(plain);
          if (list.length > 1 || (list.length === 1 && list[0].kind !== 'p')) {
            e.preventDefault();
            ed.insertBlocks(b, list);
          }
        }}
      />
    </div>
  );
}

/* ── Bloques que no son solo texto ──────────────────────────────────────── */

const fitArea = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const sizeText = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : n ? `${n} B` : '');

/** Texto de varias líneas que, sin foco, se lee con sus enlaces (el cuerpo de un desplegable). */
function BodyText({ value, onChange, placeholder }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useLayoutEffect(() => fitArea(ref.current));
  const text = value || '';
  const showView = !focused && text.length > 0;
  return (
    <div className="relative text-[15px] leading-relaxed">
      {showView && (
        <div
          className="min-h-[1.5em] cursor-text whitespace-pre-wrap break-words"
          onClick={(e) => {
            if (e.target.closest('a,button')) return;
            ref.current?.focus();
          }}
        >
          <Inline text={text} />
        </div>
      )}
      <textarea
        ref={ref}
        rows={1}
        value={text}
        aria-label={placeholder}
        placeholder={placeholder}
        className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-muted/70 ${showView ? 'pointer-events-none absolute inset-0 opacity-0' : ''}`}
        style={{ font: 'inherit' }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          onChange(e.target.value);
          force();
        }}
      />
    </div>
  );
}

/** Un campo para pegar una dirección (enlace web o vídeo). */
function UrlInput({ placeholder, onSubmit, check }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const url = value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return toast.warning('Escribe una dirección que empiece por https://');
    if (check && !check(url)) return undefined;
    onSubmit(url);
    return undefined;
  };
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-dashed border-border p-1.5 print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted/70"
      />
      <Button size="sm" type="submit">
        Añadir
      </Button>
    </form>
  );
}

/** Desplegable: un título que abre lo de dentro. */
function ToggleBlock({ b, ed }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-expanded={Boolean(b.open)}
          aria-label={b.open ? 'Cerrar' : 'Abrir'}
          onClick={() => ed.change(() => { b.open = !b.open; })}
          className="mt-[0.15em] flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-default"
        >
          <ChevronRight className={`size-4 transition-transform ${b.open ? 'rotate-90' : ''}`} />
        </button>
        <TextBlock b={b} ed={ed} />
      </div>
      {b.open && (
        <div className="ms-3 border-s-2 border-border ps-4 pt-1">
          <BodyText value={b.body} placeholder="Lo que se ve al abrirlo…" onChange={(v) => { b.body = v; ed.touch(); }} />
        </div>
      )}
    </div>
  );
}

/** Tabla: celdas que se escriben, con filas y columnas que se añaden y se quitan. */
function TableBlock({ b, ed }) {
  const [, force] = useReducer((x) => x + 1, 0);
  b.rows ||= [['', ''], ['', '']];
  const rows = b.rows;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div className="group/table min-w-0 flex-1">
      <ScrollShadow orientation="horizontal" size={32}>
        <table className="w-full min-w-max border-separate border-spacing-0 overflow-hidden rounded-xl border border-border text-sm">
          <thead className="print:hidden">
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="h-0 p-0">
                  {cols > 1 && (
                    <button
                      type="button"
                      aria-label={`Quitar la columna ${c + 1}`}
                      title="Quitar la columna"
                      onClick={() => ed.change(() => { b.rows = rows.map((r) => r.filter((_, j) => j !== c)); })}
                      className="relative -top-0 mx-auto hidden h-4 w-8 items-center justify-center rounded-b-md bg-default text-muted hover:text-danger group-hover/table:flex"
                    >
                      <Xmark className="size-3" />
                    </button>
                  )}
                </th>
              ))}
              <th className="w-0 p-0" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const head = b.header && r === 0;
              return (
                <tr key={r} className="group/row">
                  {Array.from({ length: cols }, (_, c) => (
                    <td key={c} className={`border-b border-border p-0 align-top [&:not(:last-of-type)]:border-e ${head ? 'bg-surface-secondary font-semibold' : ''} ${r === rows.length - 1 ? 'border-b-0' : ''}`}>
                      <textarea
                        rows={1}
                        value={row[c] ?? ''}
                        aria-label={`Fila ${r + 1}, columna ${c + 1}`}
                        ref={fitArea}
                        onChange={(e) => {
                          row[c] = e.target.value;
                          fitArea(e.target);
                          ed.touch();
                          force();
                        }}
                        className="block w-full min-w-28 resize-none overflow-hidden bg-transparent px-2.5 py-2 outline-none focus:bg-accent/8"
                        style={{ font: 'inherit' }}
                      />
                    </td>
                  ))}
                  <td className="w-0 p-0 align-middle print:hidden">
                    <button
                      type="button"
                      aria-label={`Quitar la fila ${r + 1}`}
                      title="Quitar la fila"
                      onClick={() => ed.change(() => {
                        b.rows = rows.filter((_, j) => j !== r);
                        if (!b.rows.length) b.rows = [Array(cols).fill('')];
                      })}
                      className="ms-1 flex size-6 items-center justify-center rounded-md text-muted opacity-0 hover:text-danger group-hover/row:opacity-100 max-sm:opacity-60"
                    >
                      <Xmark className="size-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollShadow>
      <div className="mt-1.5 flex flex-wrap gap-1 opacity-70 group-hover/table:opacity-100 print:hidden">
        <Button size="sm" variant="ghost" onPress={() => ed.change(() => { b.rows = [...rows, Array(cols).fill('')]; })}>
          <Plus />
          Fila
        </Button>
        <Button size="sm" variant="ghost" onPress={() => ed.change(() => { b.rows = rows.map((r) => [...r, ...Array(cols - r.length).fill(''), '']); })}>
          <Plus />
          Columna
        </Button>
        <Button size="sm" variant="ghost" onPress={() => ed.change(() => { b.header = !b.header; })}>
          {b.header ? 'Sin fila de títulos' : 'Primera fila como títulos'}
        </Button>
      </div>
    </div>
  );
}

/** Enlace web: una dirección con su título. */
function BookmarkBlock({ b, ed }) {
  const [, force] = useReducer((x) => x + 1, 0);
  if (!b.url)
    return (
      <UrlInput
        placeholder="Pega un enlace: https://…"
        onSubmit={(url) => ed.change(() => {
          b.url = url;
          if (!b.text) b.text = hostOf(url);
        })}
      />
    );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
        <Globe className="size-4 text-muted" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          value={b.text || ''}
          aria-label="Título del enlace"
          placeholder={hostOf(b.url)}
          onChange={(e) => {
            b.text = e.target.value;
            ed.touch();
            force();
          }}
          className="bg-transparent text-sm font-semibold outline-none"
        />
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted hover:underline">
          {b.url}
        </a>
      </div>
      <Button isIconOnly size="sm" variant="ghost" aria-label="Abrir el enlace" onPress={() => window.open(b.url, '_blank', 'noopener')}>
        <ArrowUpRightFromSquare />
      </Button>
    </div>
  );
}

/** Vídeo de YouTube, Vimeo o Loom, incrustado. */
function VideoBlock({ b, ed }) {
  const src = embedUrl(b.url);
  if (!b.url || !src)
    return (
      <UrlInput
        placeholder="Pega el enlace de YouTube, Vimeo o Loom"
        check={(url) => {
          if (embedUrl(url)) return true;
          toast.warning('Ese enlace no es de un vídeo de YouTube, Vimeo o Loom');
          return false;
        }}
        onSubmit={(url) => ed.change(() => { b.url = url; })}
      />
    );
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={src}
          title={b.text || 'Vídeo'}
          className="size-full border-0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <figcaption>
        <TextBlock b={b} ed={ed} />
      </figcaption>
    </figure>
  );
}

/** PDF adjunto. */
function FileBlock({ b, ed }) {
  if (!b.url)
    return (
      <button
        type="button"
        onClick={() => ed.pickFile(b)}
        className="flex h-20 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted hover:bg-surface-secondary print:hidden"
      >
        <Paperclip className="size-4" />
        Subir un PDF
      </button>
    );
  return (
    <a href={b.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border px-3 py-2.5 no-underline hover:bg-surface-secondary">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <FileText className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-sm font-semibold text-foreground">{b.text || 'Documento.pdf'}</b>
        <span className="text-xs text-muted">{['PDF', sizeText(b.size)].filter(Boolean).join(' · ')}</span>
      </span>
      <ArrowUpRightFromSquare className="size-4 text-muted" />
    </a>
  );
}

/** Índice: los títulos de la página, para saltar a ellos. */
function TocBlock({ ed }) {
  const heads = ed.page.blocks.filter((x) => ['h1', 'h2', 'h3'].includes(x.kind) && (x.text || '').trim());
  if (!heads.length) return <p className="flex-1 rounded-2xl bg-surface-secondary px-3 py-2.5 text-sm text-muted">Añade títulos a la página y aquí saldrá su índice.</p>;
  return (
    <nav aria-label="Índice de la página" className="flex min-w-0 flex-1 flex-col rounded-2xl bg-surface-secondary px-2 py-2">
      {heads.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => document.querySelector(`[data-block="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className={`truncate rounded-lg px-2 py-1 text-start text-sm hover:bg-default ${h.kind === 'h1' ? 'font-semibold' : h.kind === 'h2' ? 'ps-5' : 'ps-8 text-muted'}`}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}

function BlockRow({ b, i, ed }) {
  const n = useMemo(() => {
    if (b.kind !== 'number') return 0;
    let k = 1;
    for (let j = i - 1; j >= 0 && ed.page.blocks[j].kind === 'number'; j -= 1) k += 1;
    return k;
  }, [b.kind, i, ed.page.blocks]);

  let mark = null;
  if (b.kind === 'bullet') mark = <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-foreground" />;
  if (b.kind === 'number') mark = <span className="min-w-5 shrink-0 text-[15px] leading-relaxed text-muted tabular-nums">{n}.</span>;
  if (b.kind === 'todo')
    mark = (
      <Checkbox className="mt-[0.2em] shrink-0" aria-label={b.checked ? 'Desmarcar' : 'Marcar como hecho'} isSelected={Boolean(b.checked)} onChange={(on) => ed.change(() => { b.checked = on; })}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
    );

  let content;
  if (b.kind === 'callout')
    content = (
      <div className="flex min-w-0 flex-1 items-start gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5">
        <Popover>
          <Button isIconOnly size="sm" variant="ghost" aria-label="Cambiar el icono del destacado" className="-my-0.5 text-lg">
            {b.emoji || '💡'}
          </Button>
          <Popover.Content placement="bottom start" className="w-80">
            <Popover.Dialog>
              <EmojiGrid onPick={(e) => ed.change(() => { b.emoji = e; })} />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <TextBlock b={b} ed={ed} className="pt-0.5" />
      </div>
    );
  else if (b.kind === 'quote')
    content = (
      <div className="flex min-w-0 flex-1 border-s-[3px] border-foreground ps-3">
        <TextBlock b={b} ed={ed} />
      </div>
    );
  else if (b.kind === 'code')
    content = (
      <div className="flex min-w-0 flex-1 overflow-x-auto rounded-2xl bg-surface-secondary px-3.5 py-3">
        <TextBlock b={b} ed={ed} />
      </div>
    );
  else if (b.kind === 'toggle') content = <ToggleBlock b={b} ed={ed} />;
  else if (TEXTUAL.has(b.kind)) content = <TextBlock b={b} ed={ed} />;
  else if (b.kind === 'divider') content = <Separator className="my-3 flex-1" />;
  else if (b.kind === 'image')
    content = (
      <figure className="m-0 flex min-w-0 flex-1 flex-col gap-1.5">
        {b.url ? (
          <img src={b.url} alt={b.text || ''} loading="lazy" className="max-h-[32rem] w-full rounded-2xl bg-surface-secondary object-contain" />
        ) : (
          <button type="button" onClick={() => pickImage((url) => ed.change(() => { b.url = url; }))} className="flex h-32 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted hover:bg-surface-secondary">
            <Picture className="size-4" />
            Subir una imagen
          </button>
        )}
        <figcaption>
          <TextBlock b={b} ed={ed} />
        </figcaption>
      </figure>
    );
  else if (b.kind === 'link')
    content = (
      <div className="min-w-0 flex-1">
        <LinkCard b={b} />
      </div>
    );
  else if (b.kind === 'table') content = <TableBlock b={b} ed={ed} />;
  else if (b.kind === 'bookmark') content = <BookmarkBlock b={b} ed={ed} />;
  else if (b.kind === 'video') content = <VideoBlock b={b} ed={ed} />;
  else if (b.kind === 'file') content = <FileBlock b={b} ed={ed} />;
  else if (b.kind === 'toc') content = <TocBlock ed={ed} />;
  else content = <div className="flex-1" />;

  return (
    <div data-block={b.id} className={`group/block relative flex items-start gap-2 py-0.5 ${TOP[b.kind] || ''} ${ed.dragging === b.id ? 'opacity-40' : ''}`}>
      <button
        type="button"
        draggable
        aria-label="Opciones del bloque"
        title="Arrastra para mover · toca para ver opciones"
        className="absolute -start-5 top-[0.3em] sm:-start-7 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted opacity-0 outline-none hover:bg-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover/block:opacity-100 group-focus-within/block:opacity-100 print:hidden max-sm:opacity-60"
        onClick={(e) => ed.openMenu(e.currentTarget, b)}
        onDragStart={(e) => ed.dragStart(e, b)}
        onDragEnd={ed.dragEnd}
      >
        <Grip className="size-3.5" />
      </button>
      {mark}
      {content}
    </div>
  );
}

/* ── El editor ──────────────────────────────────────────────────────────── */

function Editor({ page }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const pageRef = useRef(page);
  pageRef.current = page;
  page.blocks ||= [];
  const timer = useRef(0);
  const savedTitle = useRef(page.title || '');
  const pending = useRef(null);
  const blocksBox = useRef(null);
  const titleRef = useRef(null);
  const dragId = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dropAt, setDropAt] = useState(-1);
  const [menu, setMenu] = useState(null); // { at, b }
  const [pick, setPick] = useState(null); // { at, kind, b?, slash?, caret? }
  const [asking, setAsking] = useState(false);

  const flush = () => {
    clearTimeout(timer.current);
    timer.current = 0;
    put('pages', pageRef.current);
  };
  // Se guarda tras dos segundos sin escribir (o al salir): cada guardado es una
  // escritura del almacén, y el plan gratuito de KV admite unas mil al día.
  const touch = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 2000);
  };
  const changed = () => {
    flush();
    bump();
  };
  const change = (fn) => {
    fn();
    changed();
  };

  useEffect(() => {
    const flushPending = () => {
      if (timer.current) flush();
    };
    addEventListener('visibilitychange', flushPending);
    addEventListener('beforeunload', flushPending);
    if (!pageRef.current.title) setTimeout(() => titleRef.current?.focus());
    return () => {
      removeEventListener('visibilitychange', flushPending);
      removeEventListener('beforeunload', flushPending);
      flushPending();
      const p = pageRef.current;
      if (savedTitle.current && savedTitle.current !== p.title) renamePageRefs(savedTitle.current, p.title, put);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${pageTitle(page)} | Negocio`;
  });

  // Llevar el cursor al bloque que toca, después de dibujar.
  const applyFocus = () => {
    const p = pending.current;
    if (!p) return false;
    const a = blocksBox.current?.querySelector(`[data-block="${p.id}"] textarea`);
    if (!a) return false;
    a.focus();
    const len = a.value.length;
    const pos = p.where === 'start' ? 0 : p.where === 'end' ? len : Math.min(Number(p.where) || 0, len);
    a.setSelectionRange(pos, p.end != null ? Math.min(p.end, len) : pos);
    return true;
  };
  useLayoutEffect(() => {
    if (applyFocus() && !pending.current?.keep) pending.current = null;
  });
  const focusBlock = (id, where = 'end', end = null) => {
    pending.current = { id, where, end };
    bump();
  };
  // Tras cerrar un buscador, el foco vuelve a su sitio cuando el Popover termina de irse.
  const focusSoon = (id, where = 'end') => {
    pending.current = { id, where, keep: true };
    bump();
    setTimeout(() => {
      applyFocus();
      pending.current = null;
    }, 260);
  };

  const at = (b) => page.blocks.indexOf(b);
  const insertAfter = (ref, b) => {
    const i = ref ? at(ref) : page.blocks.length - 1;
    page.blocks.splice(i + 1, 0, b);
    return b;
  };

  const addImages = async (files, after) => {
    let ref = after;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      toast(`Subiendo ${f.name || 'imagen'}…`);
      try {
        const b = block('image', '', { url: fileUrl((await uploadFile(f)).id) });
        if (ref) insertAfter(ref, b);
        else page.blocks.push(b);
        ref = b;
        changed();
      } catch (err) {
        toast.danger('No se pudo subir', { description: err.message });
      }
    }
  };

  const convert = (b, kind, caret = 'end') => {
    if (kind === 'divider') {
      b.kind = 'divider';
      b.text = '';
      const next = insertAfter(b, block('p'));
      changed();
      focusSoon(next.id, 'start');
      return;
    }
    if (kind === 'image') {
      pickImage((url) => {
        b.kind = 'image';
        b.url = url;
        b.text = '';
        changed();
      });
      return;
    }
    if (kind === 'link') {
      const row = blocksBox.current?.querySelector(`[data-block="${b.id}"]`);
      setPick({ at: below(row), kind: 'linkBlock', b });
      return;
    }
    if (kind === 'table' || kind === 'bookmark' || kind === 'video' || kind === 'toc') {
      Object.assign(b, { kind, text: '' }, kind === 'table' ? { rows: [['', '', ''], ['', '', ''], ['', '', '']], header: true } : kind === 'toc' ? {} : { url: '' });
      const next = insertAfter(b, block('p'));
      changed();
      if (kind === 'toc') focusSoon(next.id, 'start');
      return;
    }
    if (kind === 'file') {
      pickFile(b);
      return;
    }
    if (kind === 'toggle') {
      b.open = true;
      b.body ||= '';
    }
    if (kind === 'subpage') {
      const child = createPage({ parentId: page.id, open: false });
      Object.assign(b, { kind: 'link', target: 'page', ref: child.id, text: '' });
      changed();
      go(`#/paginas/${child.id}`);
      return;
    }
    b.kind = kind;
    if (kind === 'callout' && !b.emoji) b.emoji = '💡';
    changed();
    focusSoon(b.id, caret);
  };

  /** Un PDF (o una imagen) para un bloque «PDF». */
  const pickFile = (b) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      toast(`Subiendo ${f.name}…`);
      try {
        const meta = await uploadFile(f);
        if (f.type.startsWith('image/')) Object.assign(b, { kind: 'image', url: fileUrl(meta.id), text: '' });
        else Object.assign(b, { kind: 'file', url: fileUrl(meta.id), text: f.name, size: f.size });
        if (!page.blocks.includes(b)) page.blocks.push(b);
        changed();
        toast.success('Listo');
      } catch (err) {
        toast.danger('No se pudo subir', { description: err.message });
      }
    });
    input.click();
  };

  const ed = {
    page,
    dragging,
    change,
    addImages,
    touch,
    pickFile,
    /** Bloques que llegan de fuera (pegados): ocupan el bloque vacío o van detrás. */
    insertBlocks(b, list) {
      const i = at(b);
      if (TEXTUAL.has(b.kind) && !(b.text || '').trim()) page.blocks.splice(i, 1, ...list);
      else page.blocks.splice(i + 1, 0, ...list);
      changed();
      const last = [...list].reverse().find((x) => TEXTUAL.has(x.kind));
      if (last) focusSoon(last.id, 'end');
      toast(`Pegado como ${plural(list.length, 'bloque', 'bloques')}`);
    },
    onInput(e, b) {
      const area = e.target;
      const v = area.value;
      b.text = v;
      touch();
      if (v === '/') {
        setPick({ at: below(area), kind: 'kinds', b, slash: true });
        return;
      }
      if (b.kind === 'p' || (/^#/.test(v) && /^h[123]$/.test(b.kind))) {
        for (const [re, kind] of SHORTCUTS) {
          const m = re.exec(v);
          if (!m) continue;
          const caret = Math.max(0, area.selectionStart - m[0].length);
          b.text = v.slice(m[0].length);
          convert(b, kind, caret);
          return;
        }
      }
      const ne = e.nativeEvent;
      if (/^insert/.test(ne?.inputType || '') && String(ne?.data || '').endsWith('[')) {
        const caret = area.selectionStart;
        if (v.slice(caret - 2, caret) === '[[') setPick({ at: below(area), kind: 'linkText', b, caret });
      }
    },
    onKey(e, b) {
      const area = e.currentTarget;
      const i = at(b);
      const { selectionStart: s, selectionEnd: end, value } = area;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
        e.preventDefault();
        const mark = e.key === 'b' ? '**' : '*';
        const inner = value.slice(s, end) || 'texto';
        b.text = `${value.slice(0, s)}${mark}${inner}${mark}${value.slice(end)}`;
        touch();
        focusBlock(b.id, s + mark.length, s + mark.length + inner.length);
        return;
      }
      if (e.key === 'Tab' && b.kind === 'code') {
        e.preventDefault();
        b.text = `${value.slice(0, s)}  ${value.slice(end)}`;
        touch();
        focusBlock(b.id, s + 2);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        if (b.kind === 'code' && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        if (LISTS.has(b.kind) && !value.trim()) {
          b.kind = 'p';
          changed();
          focusBlock(b.id, 'start');
          return;
        }
        b.text = value.slice(0, s);
        const next = insertAfter(b, block(LISTS.has(b.kind) ? b.kind : 'p', value.slice(end)));
        changed();
        focusBlock(next.id, 'start');
        return;
      }
      if (e.key === 'Backspace' && s === 0 && end === 0) {
        if (b.kind !== 'p' && b.kind !== 'image') {
          e.preventDefault();
          b.kind = 'p';
          changed();
          focusBlock(b.id, 'start');
          return;
        }
        const prev = page.blocks[i - 1];
        if (!prev) return;
        e.preventDefault();
        if (TEXTUAL.has(prev.kind)) {
          const join = (prev.text || '').length;
          prev.text = (prev.text || '') + value;
          page.blocks.splice(i, 1);
          changed();
          focusBlock(prev.id, join);
        } else if (!value) {
          page.blocks.splice(i, 1);
          changed();
          const before = page.blocks.slice(0, i).reverse().find((x) => TEXTUAL.has(x.kind));
          if (before) focusBlock(before.id);
        } else if (prev.kind === 'divider') {
          page.blocks.splice(i - 1, 1);
          changed();
          focusBlock(b.id, 'start');
        }
        return;
      }
      if (e.key === 'ArrowUp' && !e.shiftKey && !value.slice(0, s).includes('\n')) {
        const prev = page.blocks.slice(0, i).reverse().find((x) => TEXTUAL.has(x.kind));
        if (prev) {
          e.preventDefault();
          focusBlock(prev.id, 'end');
        }
        return;
      }
      if (e.key === 'ArrowDown' && !e.shiftKey && !value.slice(end).includes('\n')) {
        const next = page.blocks.slice(i + 1).find((x) => TEXTUAL.has(x.kind));
        if (next) {
          e.preventDefault();
          focusBlock(next.id, 'start');
        }
      }
    },
    openMenu(anchor, b) {
      setMenu({ at: below(anchor), b });
    },
    dragStart(e, b) {
      dragId.current = b.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', b.id);
      const row = e.currentTarget.closest('[data-block]');
      if (row) e.dataTransfer.setDragImage(row, 20, 16);
      requestAnimationFrame(() => setDragging(b.id));
    },
    dragEnd() {
      dragId.current = null;
      setDragging(null);
      setDropAt(-1);
    },
  };

  // Arrastrar bloques con su asa, y soltar imágenes desde el ordenador.
  const dropIndex = (e) => {
    const rows = [...(blocksBox.current?.querySelectorAll('[data-block]') || [])];
    const next = rows.findIndex((r) => {
      const rect = r.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });
    return next < 0 ? rows.length : next;
  };
  const onDragOver = (e) => {
    const files = e.dataTransfer?.types?.includes('Files');
    if (!dragId.current && !files) return;
    e.preventDefault();
    const to = dropIndex(e);
    if (to !== dropAt) setDropAt(to);
  };
  const onDrop = (e) => {
    e.preventDefault();
    const to = dropIndex(e);
    setDropAt(-1);
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) {
      addImages(files, page.blocks[to - 1] || null);
      return;
    }
    const b = dragId.current && page.blocks.find((x) => x.id === dragId.current);
    if (!b) return;
    const from = at(b);
    page.blocks.splice(from, 1);
    page.blocks.splice(to > from ? to - 1 : to, 0, b);
    ed.dragEnd();
    changed();
  };

  const blockMenuItems = (b) => {
    const i = at(b);
    const kinds = TEXTUAL.has(b.kind) ? CONVERTIBLE.filter((k) => k !== b.kind) : [];
    return [
      ...kinds.map((k) => ({ id: `to:${k}`, label: `Convertir en ${KINDS[k][0].toLowerCase()}` })),
      kinds.length ? '-' : null,
      { id: 'dup', label: 'Duplicar', icon: Copy },
      { id: 'up', label: 'Subir', icon: ArrowUp, isDisabled: i === 0 },
      { id: 'down', label: 'Bajar', icon: ArrowDown, isDisabled: i === page.blocks.length - 1 },
      '-',
      { id: 'delete', label: 'Eliminar bloque', icon: TrashBin, danger: true },
    ];
  };
  const onBlockAction = (k, b) => {
    const i = at(b);
    if (k.startsWith('to:')) return convert(b, k.slice(3));
    if (k === 'dup') return change(() => insertAfter(b, { ...structuredClone(b), id: uid() }));
    if (k === 'up') return change(() => { page.blocks.splice(i, 1); page.blocks.splice(i - 1, 0, b); });
    if (k === 'down') return change(() => { page.blocks.splice(i, 1); page.blocks.splice(i + 1, 0, b); });
    if (k === 'delete')
      return change(() => {
        page.blocks = page.blocks.filter((x) => x !== b);
        if (!page.blocks.length) page.blocks.push(block('p'));
      });
    return undefined;
  };

  const duplicatePage = () => {
    const copy = { ...structuredClone(page), id: uid(), title: `${pageTitle(page)} (copia)`, favorite: false, order: Date.now() };
    copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid() }));
    delete copy.createdAt;
    delete copy.updatedAt;
    put('pages', copy, { now: true })?.catch(() => {});
    toast('Página duplicada');
    go(`#/paginas/${copy.id}`);
  };
  const printPage = () => {
    flush();
    const before = document.title;
    document.title = pageTitle(page);
    addEventListener('afterprint', () => { document.title = before; }, { once: true });
    print();
  };
  const destroy = () => {
    clearTimeout(timer.current);
    timer.current = 0;
    for (const p of familyOf(page)) remove('pages', p.id);
    toast('Página eliminada');
    go(page.parentId && find('pages', page.parentId) ? `#/paginas/${page.parentId}` : '#/paginas');
  };
  const onMore = (k) => {
    if (k === 'sub') createPage({ parentId: page.id });
    if (k === 'move') setPick({ at: below(document.querySelector('[data-page-more]')), kind: 'move' });
    if (k === 'dup') duplicatePage();
    if (k === 'md') copyText(toMarkdown(page)).then((ok) => (ok ? toast.success('Copiada como Markdown') : toast.danger('No se pudo copiar')));
    if (k === 'download') downloadText(`${pageTitle(page)}.md`, toMarkdown(page));
    if (k === 'import')
      pickTextFiles(async (files) => {
        let added = 0;
        for (const file of files) {
          const { title, blocks } = await readPageFile(file);
          if (!blocks.length) continue;
          const empty = page.blocks.length === 1 && TEXTUAL.has(page.blocks[0].kind) && !page.blocks[0].text;
          if (empty) page.blocks = [];
          if (files.length > 1) page.blocks.push(block('h2', title));
          page.blocks.push(...blocks);
          if (!page.title && files.length === 1) page.title = title;
          added += blocks.length;
        }
        changed();
        toast.success(added ? `Importados ${plural(added, 'bloque', 'bloques')}` : 'No había nada que importar');
      });
    if (k === 'print') printPage();
    if (k === 'delete') setAsking(true);
  };

  const customer = page.customerId && find('customers', page.customerId);
  const project = page.projectId && find('projects', page.projectId);
  const crumbs = ancestors(page);
  const kids = childrenOf(page.id);
  const linked = new Set(page.blocks.filter((b) => b.kind === 'link' && b.target === 'page').map((b) => b.ref));
  const loose = kids.filter((k) => !linked.has(k.id));
  const back = backlinks('page', page.id);
  const family = familyOf(page);

  // Las opciones de cada buscador.
  const pickItems = () => {
    if (!pick) return [];
    if (pick.kind === 'kinds') return Object.entries(KINDS).map(([k, [label, , sub]]) => ({ id: k, label, sub, lead: <span className="text-xs font-semibold text-muted">{KIND_LEAD[k]}</span> }));
    if (pick.kind === 'linkText' || pick.kind === 'linkBlock') return linkItems();
    if (pick.kind === 'move') {
      const banned = new Set(family.map((p) => p.id));
      return pages()
        .filter((p) => !banned.has(p.id))
        .sort(byOrder)
        .map((p) => ({ id: p.id, lead: pageIcon(p), label: pageTitle(p), sub: ancestors(p).map(pageTitle).join(' / ') || 'Página principal' }));
    }
    if (pick.kind === 'customer') return [...crm.customers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c) => ({ id: c.id, label: c.name || 'Sin nombre', sub: c.company || c.email || '', lead: <Person name={c.name} size="sm" /> }));
    if (pick.kind === 'project') return [...crm.projects].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => ({ id: p.id, label: p.name || 'Sin nombre', sub: find('customers', p.customerId)?.name || 'Sin cliente', lead: <Briefcase className="size-4 text-muted" /> }));
    return [];
  };
  const onPick = (x) => {
    const { kind, b } = pick;
    if (kind === 'kinds') {
      if (pick.slash && b.text === '/') b.text = '';
      convert(b, x.id);
    } else if (kind === 'linkText') {
      const v = b.text || '';
      const c = pick.caret;
      b.text = v.slice(0, c - 2) + x.insert + v.slice(c);
      touch();
      focusSoon(b.id, c - 2 + x.insert.length);
    } else if (kind === 'linkBlock') {
      Object.assign(b, { kind: 'link', target: x.kind, ref: x.item.id, text: '' });
      const next = insertAfter(b, block('p'));
      changed();
      focusSoon(next.id, 'start');
    } else if (kind === 'move') {
      const p = find('pages', x.id);
      page.parentId = x.id;
      changed();
      toast(`Ahora está dentro de «${pageTitle(p)}»`);
    } else if (kind === 'customer') {
      page.customerId = x.id;
      changed();
    } else if (kind === 'project') {
      const p = find('projects', x.id);
      page.projectId = x.id;
      if (!page.customerId && p?.customerId) page.customerId = p.customerId;
      changed();
    }
  };
  const pickExtra = () => {
    if (!pick) return null;
    const clear = (label, fn) => (
      <Button size="sm" variant="ghost" className="justify-start" onPress={() => { setPick(null); fn(); }}>
        <Xmark />
        {label}
      </Button>
    );
    if (pick.kind === 'move' && page.parentId)
      return (
        <Button size="sm" variant="ghost" className="justify-start" onPress={() => { setPick(null); change(() => { page.parentId = ''; }); }}>
          <ArrowUpFromLine />
          Sacarla a la raíz
        </Button>
      );
    if (pick.kind === 'customer' && page.customerId) return clear('Sin cliente', () => change(() => { page.customerId = ''; }));
    if (pick.kind === 'project' && page.projectId) return clear('Sin proyecto', () => change(() => { page.projectId = ''; }));
    return null;
  };
  const PLACEHOLDER = { kinds: 'Buscar un tipo de bloque…', linkText: 'Enlazar una página, tarea o documento…', linkBlock: 'Enlazar una página, tarea o documento…', move: 'Mover dentro de…', customer: 'Buscar cliente…', project: 'Buscar proyecto…' };

  const addBlock = (e) => {
    const last = page.blocks.at(-1);
    if (last && TEXTUAL.has(last.kind) && !last.text) {
      setPick({ at: below(e.currentTarget), kind: 'kinds', b: last });
      return;
    }
    const b = block('p');
    page.blocks.push(b);
    changed();
    focusBlock(b.id);
  };

  return (
    <article className="sw-print-area flex min-w-0 flex-col">
        <div className="flex items-center gap-2 print:hidden">
          <Button isIconOnly size="sm" variant="ghost" aria-label="Todas las páginas" onPress={() => go('#/paginas')}>
            <ArrowLeft />
          </Button>
          <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm text-muted">
            <a href="#/paginas" className="shrink-0 hover:text-foreground">
              Páginas
            </a>
            {crumbs.map((c) => (
              <span key={c.id} className="flex min-w-0 items-center gap-1">
                <span aria-hidden>/</span>
                <a href={`#/paginas/${c.id}`} className="truncate hover:text-foreground">
                  {c.icon ? `${c.icon} ` : ''}
                  {pageTitle(c)}
                </a>
              </span>
            ))}
          </nav>
          <span className="hidden text-xs text-muted sm:inline">{editedText(page)}</span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-pressed={Boolean(page.favorite)}
            aria-label={page.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}
            onPress={() => change(() => { page.favorite = !page.favorite; })}
          >
            {page.favorite ? <StarFill className="text-warning" /> : <Star />}
          </Button>
          <Dropdown>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Más acciones" data-page-more>
              <EllipsisVertical />
            </Button>
            <Dropdown.Popover placement="bottom end" className="min-w-56">
              <Dropdown.Menu aria-label="Más acciones" onAction={(k) => onMore(String(k))}>
                <Dropdown.Section>
                  <Dropdown.Item id="sub" textValue="Añadir subpágina">
                    <SquareArticle className="size-4" />
                    <Label>Añadir subpágina</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="move" textValue="Mover a…">
                    <ArrowUpFromLine className="size-4" />
                    <Label>Mover a…</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="dup" textValue="Duplicar">
                    <Copy className="size-4" />
                    <Label>Duplicar</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
                <Dropdown.Section>
                  <Dropdown.Item id="md" textValue="Copiar como Markdown">
                    <LogoMarkdown className="size-4" />
                    <Label>Copiar como Markdown</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="download" textValue="Descargar en Markdown">
                    <ArrowDownToLine className="size-4" />
                    <Label>Descargar (.md)</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="import" textValue="Importar aquí">
                    <FileArrowUp className="size-4" />
                    <Label>Importar aquí…</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="print" textValue="Imprimir o PDF">
                    <Printer className="size-4" />
                    <Label>Imprimir o PDF</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
                <Dropdown.Section>
                  <Dropdown.Item id="delete" textValue="Eliminar página" variant="danger">
                    <TrashBin className="size-4" />
                    <Label>Eliminar página</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

      {page.cover && (
        <div className="group/cover relative mt-3 h-36 overflow-hidden rounded-3xl sm:h-52">
          <CoverArt cover={page.cover} className="size-full" />
          <div className="absolute end-3 bottom-3 opacity-0 transition-opacity group-hover/cover:opacity-100 focus-within:opacity-100 print:hidden max-sm:opacity-100">
            <CoverPicker hasCover onChange={(c) => change(() => { page.cover = c; })}>
              <Button size="sm" variant="secondary">
                <Picture />
                Cambiar portada
              </Button>
            </CoverPicker>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-3xl flex-col">

        <div className={`flex flex-col gap-1 ${page.cover ? '' : 'pt-8'}`}>
          {page.icon && (
            <Popover>
              <Button variant="ghost" aria-label="Cambiar icono" className={`relative h-auto w-fit px-1 text-6xl leading-none ${page.cover ? '-mt-10 sm:-mt-12' : ''}`}>
                {page.icon}
              </Button>
              <Popover.Content placement="bottom start" className="w-80">
                <Popover.Dialog>
                  <EmojiGrid onPick={(e) => change(() => { page.icon = e; })} onRemove={() => change(() => { page.icon = ''; })} />
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          )}
          {(!page.icon || !page.cover) && (
            <div className="flex gap-1 print:hidden">
              {!page.icon && (
                <Popover>
                  <Button size="sm" variant="ghost" className="text-muted">
                    <FaceSmile />
                    Añadir icono
                  </Button>
                  <Popover.Content placement="bottom start" className="w-80">
                    <Popover.Dialog>
                      <EmojiGrid onPick={(e) => change(() => { page.icon = e; })} />
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              )}
              {!page.cover && (
                <CoverPicker onChange={(c) => change(() => { page.cover = c; })}>
                  <Button size="sm" variant="ghost" className="text-muted">
                    <Picture />
                    Añadir portada
                  </Button>
                </CoverPicker>
              )}
            </div>
          )}
          <textarea
            ref={titleRef}
            rows={1}
            maxLength={200}
            aria-label="Título de la página"
            placeholder="Sin título"
            defaultValue={page.title || ''}
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-4xl font-bold leading-tight tracking-tight outline-none [field-sizing:content] placeholder:text-muted/60"
            onChange={(e) => {
              page.title = e.target.value.replace(/\n/g, ' ');
              touch();
              document.title = `${pageTitle(page)} | Negocio`;
            }}
            onBlur={() => {
              // Los [[enlaces]] al título viejo pasan al nuevo.
              if (savedTitle.current && savedTitle.current !== page.title) renamePageRefs(savedTitle.current, page.title, put);
              savedTitle.current = page.title;
              changed();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const first = page.blocks.find((x) => TEXTUAL.has(x.kind));
              if (first) focusBlock(first.id, 'start');
              else {
                page.blocks.unshift(block('p'));
                changed();
                focusBlock(page.blocks[0].id);
              }
            }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
            <Button size="sm" variant="tertiary" onPress={(e) => setPick({ at: below(e.target), kind: 'customer' })}>
              {customer ? <Person name={customer.name} size="sm" /> : <PersonIcon />}
              {customer?.name || 'Cliente'}
            </Button>
            <Button size="sm" variant="tertiary" onPress={(e) => setPick({ at: below(e.target), kind: 'project' })}>
              <Briefcase />
              {project?.name || 'Proyecto'}
            </Button>
          </div>
        </div>

        <Separator className="my-5" />

        <div
          ref={blocksBox}
          className="relative flex min-h-24 flex-col"
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(-1);
          }}
          onDrop={onDrop}
          onClick={(e) => {
            // Tocar debajo del último bloque es seguir escribiendo.
            if (e.target !== e.currentTarget) return;
            const last = page.blocks.at(-1);
            if (last && TEXTUAL.has(last.kind) && !last.text) focusBlock(last.id);
            else {
              const b = block('p');
              page.blocks.push(b);
              changed();
              focusBlock(b.id);
            }
          }}
        >
          {page.blocks.map((b, i) => (
            <div key={b.id} className="contents">
              {dropAt === i && <div aria-hidden className="h-0.5 rounded-full bg-accent" />}
              <BlockRow b={b} i={i} ed={ed} />
            </div>
          ))}
          {dropAt === page.blocks.length && <div aria-hidden className="h-0.5 rounded-full bg-accent" />}
        </div>

        <div className="mt-3 flex flex-col gap-6 print:hidden">
          <Button size="sm" variant="ghost" className="self-start text-muted" onPress={(e) => addBlock({ currentTarget: e.target })}>
            <Plus />
            Añadir un bloque
          </Button>
          {loose.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="sw-eyebrow">Subpáginas</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {loose.map((k) => (
                  <LinkCard key={k.id} b={{ target: 'page', ref: k.id }} />
                ))}
              </div>
            </section>
          )}
          {back.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="sw-eyebrow">La mencionan</h3>
              <div className="flex flex-wrap gap-1.5">{back.map((x) => (x.kind === 'page' ? <PageChip key={`p${x.item.id}`} p={x.item} /> : <TaskChip key={`t${x.item.id}`} t={x.item} />))}</div>
            </section>
          )}
        </div>
      </div>

      <PointMenu at={menu?.at} items={menu ? blockMenuItems(menu.b) : []} label="Opciones del bloque" onClose={() => setMenu(null)} onAction={(k) => onBlockAction(k, menu.b)} />
      <PointPicker
        at={pick?.at}
        items={pickItems()}
        label={PLACEHOLDER[pick?.kind] || 'Buscar'}
        placeholder={PLACEHOLDER[pick?.kind] || 'Buscar…'}
        extra={pickExtra()}
        onClose={() => {
          const p = pick;
          setPick(null);
          if (p?.b && TEXTUAL.has(p.b.kind)) focusSoon(p.b.id, p.kind === 'linkText' ? p.caret : 'end');
        }}
        onPick={onPick}
      />
      <ConfirmDialog
        open={asking}
        title={`¿Eliminar «${pageTitle(page)}»?`}
        text={family.length > 1 ? `También se borran sus ${plural(family.length - 1, 'subpágina', 'subpáginas')}. No se puede deshacer.` : 'No se puede deshacer.'}
        onClose={() => setAsking(false)}
        onConfirm={destroy}
      />
    </article>
  );
}

/* ── El árbol ───────────────────────────────────────────────────────────── */

const readOpen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem('ng-pages-open') || '[]'));
  } catch {
    return new Set();
  }
};
const saveOpen = (set) => {
  try {
    localStorage.setItem('ng-pages-open', JSON.stringify([...set]));
  } catch {
    // Sin almacenamiento el árbol se abre igual en esta visita.
  }
};

function Tree({ current }) {
  const [open, setOpen] = useState(readOpen);
  const [q, setQ] = useState('');
  const all = pages();
  useEffect(() => {
    const p = current && find('pages', current);
    const up = ancestors(p);
    if (up.some((a) => !open.has(a.id))) {
      const next = new Set(open);
      for (const a of up) next.add(a.id);
      setOpen(next);
      saveOpen(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  const toggle = (id) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
    saveOpen(next);
  };
  const row = (p, depth, seen = new Set()) => {
    if (seen.has(p.id)) return null;
    const kids = childrenOf(p.id);
    const isOpen = open.has(p.id);
    const on = p.id === current;
    const path = new Set(seen).add(p.id);
    return (
      <li key={p.id}>
        <div className={`group/row flex items-center gap-0.5 rounded-xl pe-1 ${on ? 'bg-default' : 'hover:bg-default'}`} style={{ paddingInlineStart: `${4 + depth * 14}px` }}>
          {kids.length > 0 ? (
            <button type="button" aria-label={isOpen ? 'Cerrar' : 'Abrir'} aria-expanded={isOpen} onClick={() => toggle(p.id)} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-default-hover">
              <ChevronRight className={`size-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="size-6 shrink-0" />
          )}
          <a href={`#/paginas/${p.id}`} aria-current={on ? 'page' : undefined} className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm ${on ? 'font-medium' : 'text-muted hover:text-foreground'}`}>
            <span aria-hidden>{pageIcon(p)}</span>
            <span className="truncate">{pageTitle(p)}</span>
          </a>
          <button
            type="button"
            aria-label={`Añadir subpágina a ${pageTitle(p)}`}
            title="Añadir subpágina"
            onClick={() => {
              const next = new Set(open).add(p.id);
              setOpen(next);
              saveOpen(next);
              createPage({ parentId: p.id });
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 hover:bg-default-hover focus-visible:opacity-100 group-hover/row:opacity-100 max-lg:opacity-60"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {isOpen && kids.length > 0 && <ul>{kids.map((k) => row(k, depth + 1, path))}</ul>}
      </li>
    );
  };
  const text = q.trim().toLowerCase();
  const found = text ? all.filter((p) => `${pageTitle(p)} ${(p.blocks || []).map((b) => b.text || '').join(' ')}`.toLowerCase().includes(text)).sort(byUpdated) : [];
  const favs = all.filter((p) => p.favorite).sort(byOrder);
  return (
    <div className="flex flex-col gap-3">
      <SearchField aria-label="Buscar páginas" value={q} onChange={setQ}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Buscar páginas…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <ScrollShadow className="max-h-[60vh] lg:max-h-[calc(100vh-15rem)]">
        <nav aria-label="Páginas" className="flex flex-col gap-3">
          {text ? (
            found.length ? <ul>{found.map((p) => row(p, 0))}</ul> : <p className="px-2 text-sm text-muted">Ninguna página coincide.</p>
          ) : (
            <>
              {favs.length > 0 && (
                <div>
                  <p className="sw-eyebrow px-2 pb-1">Favoritas</p>
                  <ul>{favs.map((p) => row(p, 0))}</ul>
                </div>
              )}
              <div>
                <p className="sw-eyebrow px-2 pb-1">Todas</p>
                <ul>{all.filter(isRoot).sort(byOrder).map((p) => row(p, 0))}</ul>
              </div>
            </>
          )}
        </nav>
      </ScrollShadow>
    </div>
  );
}

/* ── Portada de la sección ──────────────────────────────────────────────── */

function PageCard({ p }) {
  const kids = childrenOf(p.id).length;
  const where = [p.projectId && projectName(p.projectId), p.customerId && find('customers', p.customerId)?.name].filter(Boolean).join(' · ');
  return (
    <a href={`#/paginas/${p.id}`} className="group flex flex-col overflow-hidden rounded-3xl bg-surface no-underline shadow-[var(--surface-shadow)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-focus">
      <div className="h-16 bg-surface-secondary">
        <CoverArt cover={p.cover} className="size-full" />
      </div>
      <div className="flex flex-col gap-1 px-4 pb-4">
        <span className="-mt-5 text-3xl" aria-hidden>
          {pageIcon(p)}
        </span>
        <b className="truncate text-sm font-semibold text-foreground">{pageTitle(p)}</b>
        <span className="line-clamp-2 text-xs text-muted">{[where, kids && plural(kids, 'subpágina', 'subpáginas'), editedText(p)].filter(Boolean).join(' · ')}</span>
      </div>
    </a>
  );
}

function Overview() {
  const all = pages();
  const favs = all.filter((p) => p.favorite).sort(byOrder);
  const recent = [...all].sort(byUpdated).slice(0, 12);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Empieza desde una plantilla</h2>
          <p className="text-sm text-muted">Todo se puede cambiar después.</p>
        </div>
        <ScrollShadow orientation="horizontal" size={48}>
          <div className="flex w-max gap-3 pb-1">
            {Object.entries(PAGE_TEMPLATES).map(([k, [label, emoji, note]]) => (
              <button
                key={k}
                type="button"
                onClick={() => createPage({ template: k })}
                className="flex w-48 shrink-0 flex-col gap-1 rounded-3xl bg-surface p-4 text-start shadow-[var(--surface-shadow)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <b className="text-sm font-semibold">{label}</b>
                <span className="line-clamp-2 text-xs text-muted">{note}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => importPages()}
              className="flex w-48 shrink-0 flex-col gap-1 rounded-3xl border-2 border-dashed border-border p-4 text-start outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
            >
              <FileArrowUp className="size-7 text-muted" />
              <b className="text-sm font-semibold">Importar</b>
              <span className="line-clamp-2 text-xs text-muted">Markdown, texto o HTML: de Notion, Google Docs u Obsidian.</span>
            </button>
          </div>
        </ScrollShadow>
      </section>
      {favs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Favoritas</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {favs.map((p) => (
              <PageCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Recientes</h2>
        {recent.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((p) => (
              <PageCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Empty icon={SquareArticle} title="Todavía no hay páginas" text="Crea una para tus notas de reunión, el brief de un proyecto o una guía de trabajo." action={<NewPageButton />} />
        )}
      </section>
    </div>
  );
}

/* ── Para las fichas de cliente y proyecto ──────────────────────────────── */

/** Las páginas de un cliente o un proyecto. scope: { customerId } o { projectId } */
export function PagesPanel({ customerId = '', projectId = '', className = '' }) {
  const [state] = useCrm();
  const list = (state.pages || []).filter((p) => (customerId ? p.customerId === customerId : p.projectId === projectId)).sort(byUpdated);
  return (
    <Panel
      className={className}
      title="Páginas"
      description={list.length ? plural(list.length, 'página', 'páginas') : 'Notas, briefs y actas de reunión'}
      action={<NewPageButton size="sm" variant="secondary" label="Nueva" scope={customerId ? { customerId } : { projectId }} />}
    >
      {list.length ? (
        <ul className="flex flex-col">
          {list.map((p) => (
            <li key={p.id}>
              <a href={`#/paginas/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 no-underline hover:bg-surface-secondary">
                <span className="text-lg" aria-hidden>
                  {pageIcon(p)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm font-medium">{pageTitle(p)}</b>
                  <span className="truncate text-xs text-muted">{editedText(p)}</span>
                </span>
                <ChevronRight className="size-4 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Todavía no hay páginas aquí.</p>
      )}
    </Panel>
  );
}

/* ── La sección ─────────────────────────────────────────────────────────── */

export function Paginas({ id }) {
  const [state, v] = useCrm();
  const page = id ? find('pages', id) : null;
  const count = (state.pages || []).length;
  useEffect(() => {
    if (!id) document.title = 'Páginas | Negocio';
  }, [id]);

  return (
    <div className="flex flex-col gap-6" data-v={v}>
      {!id && (
        <PageHeader
          eyebrow="Trabajo"
          title="Páginas"
          description="Notas, guías, briefs y actas. Enlázalas desde cualquier tarea o página escribiendo [[su título]]; dentro, la clave de una tarea o el número de un documento se convierten en enlaces."
          actions={<NewPageButton />}
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={`flex-col gap-3 lg:sticky lg:top-24 print:hidden ${id ? 'hidden lg:flex' : 'flex'}`}>
          {id && (
            <div className="flex items-center justify-between gap-2 px-1">
              <a href="#/paginas" className="flex items-center gap-2 text-sm font-semibold">
                <SquareArticle className="size-4" />
                Páginas
              </a>
              <NewPageButton size="sm" variant="secondary" label="Nueva" />
            </div>
          )}
          {count > 0 ? <Tree current={id} /> : <p className="px-2 text-sm text-muted">Todavía no hay páginas.</p>}
        </aside>
        {id ? (
          page ? (
            <Card className="min-w-0 overflow-hidden px-5 pt-5 pb-10 sm:px-10 sm:pt-8">
              <Editor key={page.id} page={page} />
            </Card>
          ) : (
            <Empty icon={SquareArticle} title="Esa página ya no existe" action={<Button onPress={() => go('#/paginas')}>Ver páginas</Button>} />
          )
        ) : (
          <Overview />
        )}
      </div>
    </div>
  );
}
