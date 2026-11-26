// Editor de texto con formato, inspirado en el «Rich Text Editor» de HeroUI Pro y
// hecho desde cero sobre un área editable: barra con deshacer, negrita, cursiva,
// subrayado, tachado, código, títulos, cita, bloque de código, listas, enlace y
// limpiar; menú flotante al seleccionar texto; atajos de Markdown al escribir
// («# » título, «- » lista, «1. » numerada, «> » cita) y, al pie, caracteres y
// palabras. Guarda Markdown (ver markdown.js), que se lee bien en cualquier sitio.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRotateLeft,
  ArrowRotateRight,
  Bold,
  BroomMotion,
  Code,
  Italic,
  Link as LinkIcon,
  ListOl,
  ListUl,
  QuoteOpen,
  Strikethrough,
  TrashBin,
  Underline,
} from '@gravity-ui/icons';
import { Button, Input, Separator, Tooltip } from '@heroui/react';
import { htmlToMd, mdToHtml, mdToText } from './markdown.js';

const exec = (cmd, arg) => document.execCommand(cmd, false, arg);

function Tool({ label, shortcut, active, onPress, children, isDisabled }) {
  return (
    <Tooltip delay={400}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-pressed={active ?? undefined}
        isDisabled={isDisabled}
        // No robar el foco al texto: así la selección sigue viva.
        onMouseDown={(e) => e.preventDefault()}
        onPress={onPress}
        className={`size-8 min-w-8 rounded-lg ${active ? 'bg-accent/15 text-accent' : ''}`}
      >
        {children}
      </Button>
      <Tooltip.Content>
        {label}
        {shortcut && <span className="ms-2 text-muted">{shortcut}</span>}
      </Tooltip.Content>
    </Tooltip>
  );
}

const TextTool = ({ children, ...p }) => (
  <Tool {...p}>
    <span className="text-xs font-semibold">{children}</span>
  </Tool>
);

/** Muestra Markdown con el mismo estilo del editor (solo lectura). */
export function RichView({ value, className = '' }) {
  return <div className={`sw-prose ${className}`} dangerouslySetInnerHTML={{ __html: mdToHtml(value || '') }} />;
}

/**
 * value: Markdown; onChange(markdown) — avisa al dejar de escribir (300 ms) y al salir.
 */
export function RichText({ value = '', onChange, placeholder = 'Escribe aquí…', label = 'Texto', minHeight = 160, footer = true, className = '' }) {
  const ed = useRef(null);
  const last = useRef(value);
  const timer = useRef(0);
  const [state, setState] = useState({});
  const [stats, setStats] = useState({ chars: 0, words: 0 });
  const [empty, setEmpty] = useState(!value);
  const [bubble, setBubble] = useState(null); // { x, y }
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('https://');
  const saved = useRef(null);

  const count = useCallback(() => {
    const text = (ed.current?.innerText || '').replace(/\s+/g, ' ').trim();
    setStats({ chars: text.length, words: text ? text.split(' ').length : 0 });
    setEmpty(!text && !ed.current?.querySelector('li, img'));
  }, []);

  // Carga inicial y cambios que llegan de fuera (otro dispositivo, deshacer…).
  useLayoutEffect(() => {
    if (!ed.current) return;
    if (value === last.current && ed.current.innerHTML) return;
    last.current = value;
    ed.current.innerHTML = mdToHtml(value) || '<p><br></p>';
    count();
  }, [value, count]);

  const emit = useCallback(() => {
    clearTimeout(timer.current);
    if (!ed.current) return;
    const md = htmlToMd(ed.current);
    if (md !== last.current) {
      last.current = md;
      onChange?.(md);
    }
  }, [onChange]);

  const refresh = useCallback(() => {
    const sel = window.getSelection();
    const inside = sel && sel.rangeCount && ed.current?.contains(sel.anchorNode);
    if (!inside) {
      setBubble(null);
      return;
    }
    let block = '';
    try {
      block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch {
      block = '';
    }
    const anchor = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    setState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      ul: document.queryCommandState('insertUnorderedList'),
      ol: document.queryCommandState('insertOrderedList'),
      code: !!anchor?.closest('code'),
      block,
    });
    if (!sel.isCollapsed) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width) setBubble({ x: r.left + r.width / 2, y: r.top });
    } else setBubble(null);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => {
      document.removeEventListener('selectionchange', refresh);
      clearTimeout(timer.current);
    };
  }, [refresh]);

  const changed = () => {
    count();
    clearTimeout(timer.current);
    timer.current = setTimeout(emit, 300);
  };

  const run = (cmd, arg) => {
    ed.current?.focus();
    exec(cmd, arg);
    changed();
    refresh();
  };

  const block = (tag) => run('formatBlock', state.block === tag ? '<p>' : `<${tag}>`);

  const toggleCode = () => {
    ed.current?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const anchor = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const inCode = anchor?.closest('code');
    if (inCode && ed.current.contains(inCode)) {
      inCode.replaceWith(document.createTextNode(inCode.textContent));
    } else if (!sel.isCollapsed) {
      const r = sel.getRangeAt(0);
      const code = document.createElement('code');
      code.textContent = r.toString();
      r.deleteContents();
      r.insertNode(code);
      sel.removeAllRanges();
      const after = document.createRange();
      after.setStartAfter(code);
      sel.addRange(after);
    }
    changed();
    refresh();
  };

  const openLink = () => {
    const sel = window.getSelection();
    saved.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const a = (sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest?.('a');
    setLink(a?.getAttribute('href') || 'https://');
    setLinkOpen(true);
  };
  const applyLink = () => {
    setLinkOpen(false);
    ed.current?.focus();
    const sel = window.getSelection();
    if (saved.current) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    const url = link.trim();
    if (!url || url === 'https://') run('unlink');
    else if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
      if (sel.isCollapsed) run('insertHTML', `<a href="${url.replace(/"/g, '%22')}">${url.replace(/</g, '&lt;')}</a>`);
      else run('createLink', url);
    }
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openLink();
      return;
    }
    if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      toggleCode();
      return;
    }
    // Atajos de Markdown al empezar un párrafo.
    if (e.key === ' ') {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (!node || node.nodeType !== 3 || !sel.isCollapsed) return;
      const before = node.nodeValue.slice(0, sel.anchorOffset);
      const blockEl = node.parentElement?.closest('p, div, h1, h2, h3, li, blockquote');
      if (!blockEl || blockEl.textContent.indexOf(before) !== 0) return;
      const map = { '#': '<h1>', '##': '<h2>', '###': '<h3>', '>': '<blockquote>' };
      const isList = before === '-' || before === '*' ? 'insertUnorderedList' : /^\d+\.$/.test(before) ? 'insertOrderedList' : null;
      if (map[before] || isList) {
        e.preventDefault();
        node.nodeValue = node.nodeValue.slice(sel.anchorOffset);
        const r = document.createRange();
        r.setStart(node, 0);
        sel.removeAllRanges();
        sel.addRange(r);
        if (isList) exec(isList);
        else exec('formatBlock', map[before]);
        changed();
        refresh();
      }
    }
  };

  const onPaste = (e) => {
    // Pegar como texto: nada de estilos ajenos.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    exec('insertText', text);
    changed();
  };

  const clearAll = () => {
    if (!ed.current) return;
    ed.current.focus();
    exec('selectAll');
    exec('delete');
    ed.current.innerHTML = '<p><br></p>';
    changed();
  };

  return (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--surface-shadow)] ${className}`}>
      <div role="toolbar" aria-label="Formato" className="flex flex-wrap items-center gap-0.5 border-b border-separator px-2 py-1.5">
        <Tool label="Deshacer" shortcut="Ctrl+Z" onPress={() => run('undo')}>
          <ArrowRotateLeft className="size-4" />
        </Tool>
        <Tool label="Rehacer" shortcut="Ctrl+Y" onPress={() => run('redo')}>
          <ArrowRotateRight className="size-4" />
        </Tool>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Tool label="Negrita" shortcut="Ctrl+B" active={state.bold} onPress={() => run('bold')}>
          <Bold className="size-4" />
        </Tool>
        <Tool label="Cursiva" shortcut="Ctrl+I" active={state.italic} onPress={() => run('italic')}>
          <Italic className="size-4" />
        </Tool>
        <Tool label="Subrayado" shortcut="Ctrl+U" active={state.underline} onPress={() => run('underline')}>
          <Underline className="size-4" />
        </Tool>
        <Tool label="Tachado" active={state.strike} onPress={() => run('strikeThrough')}>
          <Strikethrough className="size-4" />
        </Tool>
        <Tool label="Código" shortcut="Ctrl+E" active={state.code} onPress={toggleCode}>
          <Code className="size-4" />
        </Tool>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <TextTool label="Título grande" active={state.block === 'h1'} onPress={() => block('h1')}>
          H1
        </TextTool>
        <TextTool label="Título" active={state.block === 'h2'} onPress={() => block('h2')}>
          H2
        </TextTool>
        <TextTool label="Subtítulo" active={state.block === 'h3'} onPress={() => block('h3')}>
          H3
        </TextTool>
        <Tool label="Cita" active={state.block === 'blockquote'} onPress={() => block('blockquote')}>
          <QuoteOpen className="size-4" />
        </Tool>
        <TextTool label="Bloque de código" active={state.block === 'pre'} onPress={() => block('pre')}>
          {'{ }'}
        </TextTool>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Tool label="Lista" active={state.ul} onPress={() => run('insertUnorderedList')}>
          <ListUl className="size-4" />
        </Tool>
        <Tool label="Lista numerada" active={state.ol} onPress={() => run('insertOrderedList')}>
          <ListOl className="size-4" />
        </Tool>
        <Tool label="Enlace" shortcut="Ctrl+K" onPress={openLink}>
          <LinkIcon className="size-4" />
        </Tool>
        <span className="ms-auto flex items-center gap-0.5">
          <Tool label="Limpiar el formato" onPress={() => run('removeFormat')}>
            <BroomMotion className="size-4" />
          </Tool>
          <Tool label="Borrar todo" onPress={clearAll}>
            <TrashBin className="size-4" />
          </Tool>
        </span>
      </div>

      {linkOpen && (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-separator bg-surface-secondary px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <LinkIcon className="size-4 text-muted" aria-hidden />
          <Input aria-label="Dirección del enlace" value={link} onChange={(e) => setLink(e.target.value)} className="min-w-40 flex-1" autoFocus />
          <Button size="sm" type="submit">
            Poner
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setLinkOpen(false)}>
            Cancelar
          </Button>
          <span className="w-full text-xs text-muted">Déjalo vacío para quitar el enlace.</span>
        </form>
      )}

      <div
        ref={ed}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-empty={empty}
        data-placeholder={placeholder}
        className="sw-prose px-5 py-4"
        style={{ minHeight }}
        onFocus={() => exec('defaultParagraphSeparator', 'p')}
        onInput={changed}
        onBlur={emit}
        onKeyDown={onKeyDown}
        onKeyUp={refresh}
        onMouseUp={refresh}
        onPaste={onPaste}
      />

      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-separator px-5 py-2 text-xs text-muted">
          <span>Se guarda como texto con formato</span>
          <span className="tabular-nums">
            {stats.chars} caracteres, {stats.words} palabras
          </span>
        </div>
      )}

      {bubble &&
        createPortal(
          <div
            role="toolbar"
            aria-label="Formato del texto seleccionado"
            className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl bg-overlay p-1 shadow-[var(--overlay-shadow)]"
            style={{ left: bubble.x, top: bubble.y - 8 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Tool label="Negrita" active={state.bold} onPress={() => run('bold')}>
              <Bold className="size-4" />
            </Tool>
            <Tool label="Cursiva" active={state.italic} onPress={() => run('italic')}>
              <Italic className="size-4" />
            </Tool>
            <Tool label="Subrayado" active={state.underline} onPress={() => run('underline')}>
              <Underline className="size-4" />
            </Tool>
            <Tool label="Tachado" active={state.strike} onPress={() => run('strikeThrough')}>
              <Strikethrough className="size-4" />
            </Tool>
            <Tool label="Código" active={state.code} onPress={toggleCode}>
              <Code className="size-4" />
            </Tool>
            <Tool label="Enlace" onPress={openLink}>
              <LinkIcon className="size-4" />
            </Tool>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { mdToText };
