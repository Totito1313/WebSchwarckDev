// Buscar en todo el proyecto (#/buscar, la lupa de arriba, «/» o ⌘K): publicaciones, el
// trabajo de cada día, peticiones, recursos, anuncios, conversaciones, leads, documentos y
// reuniones. Sin tildes ni mayúsculas que estorben, agrupado por tipo, con lo encontrado
// resaltado y las últimas búsquedas.
import { useMemo, useState } from 'react';
import { ChevronRight, Clock, Magnifier } from '@gravity-ui/icons';
import { Button, SearchField } from '@heroui/react';
import { cap, dayDate, fDay, shortDate } from '../../../portal/kit.js';
import {
  CHANNEL,
  CONTENT_STATUS,
  DOC_TYPE,
  FORMAT,
  LEAD_STAGE,
  MEETING_STATUS,
  POST_KIND,
  RESOURCE_KIND,
  app,
  can,
  channelsOf,
  docState,
  has,
  targetTitle,
  visibleContent,
} from '../../../portal/state.js';
import { Bubble, Hoja } from '../ui.jsx';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RECENT = 'portal:search-recent';
const recentList = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT) || '[]').slice(0, 6);
  } catch {
    return [];
  }
};

/** Todo lo que se puede encontrar, ya con su texto plano para comparar. */
function index() {
  const d = app.data;
  const out = [];
  const add = (group, row) => out.push({ group, ...row, hay: fold([row.title, row.sub, row.extra].filter(Boolean).join(' · ')) });
  if (can('calendario')) {
    for (const c of visibleContent()) {
      add('Publicaciones', { id: `c${c.id}`, title: c.title, sub: `${CONTENT_STATUS[c.status]?.[0] || ''} · ${FORMAT[c.format] || ''} · ${shortDate(c.date)}`, extra: [c.caption, c.hashtags, c.objective, c.pillar, c.campaign, ...channelsOf(c).map((k) => CHANNEL[k]?.[0])].join(' '), ico: 'calendar', color: CHANNEL[channelsOf(c)[0]]?.[1], go: `#/marketing/pieza/${c.id}`, at: c.date });
    }
  }
  if (can('reporte')) {
    for (const w of d.work) add('Trabajo', { id: `w${w.id}`, title: w.title, sub: `${cap(fDay.format(dayDate(w.day)))}${w.category ? ` · ${w.category}` : ''}`, extra: w.description, ico: 'tasks', color: 'var(--success)', go: '#/cronologia/reportes', at: w.day });
  }
  if (can('peticiones')) {
    for (const t of d.tasks) add('Peticiones', { id: `t${t.id}`, title: t.title, sub: t.status === 'done' ? 'Hecha' : t.status === 'submitted' ? 'Enviada' : 'Pendiente', extra: [t.description, t.client_note].join(' '), ico: 'inbox', color: 'var(--warning)', go: '#/peticiones', at: t.created_at });
  }
  if (can('recursos')) {
    for (const r of d.resources) add('Recursos', { id: `r${r.id}`, title: r.title, sub: [RESOURCE_KIND[r.kind]?.[0], r.category].filter(Boolean).join(' · '), extra: [r.description, r.file_name, r.url].join(' '), ico: RESOURCE_KIND[r.kind]?.[1] || 'folder', color: RESOURCE_KIND[r.kind]?.[2], go: '#/recursos', at: r.created_at });
  }
  for (const p of d.posts) add('Anuncios y avances', { id: `p${p.id}`, title: p.title, sub: `${p.origin === 'client' ? `Anuncio de ${p.author || 'tu equipo'}` : POST_KIND[p.kind]?.[0] || ''} · ${shortDate(new Date(p.occurred_at).toLocaleDateString('en-CA'))}`, extra: p.body, ico: POST_KIND[p.kind]?.[1] || 'megaphone', color: POST_KIND[p.kind]?.[2], go: '#/cronologia', at: p.occurred_at });
  for (const c of d.comments) add('Conversaciones', { id: `m${c.id}`, title: c.body, sub: `${c.from_studio ? 'Schwarck' : c.author || 'Cliente'} en «${targetTitle(c.target, c.target_id)}»`, ico: 'chat', color: 'var(--accent)', go: `#/hilo/${c.target}/${c.target_id}`, at: c.created_at });
  if (can('leads')) {
    for (const l of d.leads) add('Leads', { id: `l${l.id}`, title: l.name, sub: `${LEAD_STAGE[l.stage]?.[0] || ''}${l.campaign ? ` · ${l.campaign}` : ''}`, extra: [l.contact, l.notes, l.source].join(' '), ico: 'users', color: LEAD_STAGE[l.stage]?.[1], go: '#/marketing/leads', at: l.date });
  }
  if (has('documents') && can('docs.view')) {
    for (const doc of d.documents) add('Documentos', { id: `d${doc.id}`, title: doc.title || doc.number, sub: `${DOC_TYPE[doc.type]?.[0] || ''}${doc.number ? ` ${doc.number}` : ''} · ${docState(doc)[0]}`, ico: DOC_TYPE[doc.type]?.[1] || 'file', color: DOC_TYPE[doc.type]?.[2], go: '#/recursos', at: doc.issue_date });
  }
  if (has('meetings')) {
    for (const m of d.meetings) add('Reuniones', { id: `q${m.id}`, title: m.topic, sub: `${MEETING_STATUS[m.status]?.[0] || ''}${m.starts_at ? ` · ${shortDate(new Date(m.starts_at).toLocaleDateString('en-CA'))}` : ''}`, extra: [m.notes, m.studio_note].join(' '), ico: 'calendar', color: MEETING_STATUS[m.status]?.[1], go: '#/reuniones', at: m.starts_at || m.created_at });
  }
  return out;
}

/** El texto con lo buscado resaltado (sin tildes de por medio). */
function Marked({ text, words }) {
  const raw = String(text ?? '');
  const folded = fold(raw);
  const spans = [];
  for (const w of words) {
    let i = folded.indexOf(w);
    while (i >= 0 && spans.length < 8) {
      spans.push([i, i + w.length]);
      i = folded.indexOf(w, i + w.length);
    }
  }
  if (!spans.length) return raw;
  spans.sort((a, b) => a[0] - b[0]);
  const out = [];
  let at = 0;
  spans.forEach(([a, b], k) => {
    if (a < at) return;
    out.push(raw.slice(at, a), <mark key={k} className="rounded bg-warning/30 px-0.5 text-foreground">{raw.slice(a, b)}</mark>);
    at = b;
  });
  out.push(raw.slice(at));
  return out;
}

export function BuscarHoja({ onClose }) {
  const all = useMemo(index, []);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState(recentList);
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  const hits = words.length ? all.filter((x) => words.every((w) => x.hay.includes(w))).sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))) : [];
  const groups = new Map();
  for (const h of hits) {
    if (!groups.has(h.group)) groups.set(h.group, []);
    groups.get(h.group).push(h);
  }
  const remember = () => {
    const term = q.trim();
    if (!term) return;
    const next = [term, ...recent.filter((x) => x !== term)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT, JSON.stringify(next));
    } catch {
      // sin almacenamiento
    }
  };

  return (
    <Hoja label="Buscar" onClose={onClose} wide>
      {(close) => (
        <>
          <SearchField
            aria-label="Buscar en todo el proyecto"
            value={q}
            onChange={setQ}
            autoFocus
            onSubmit={() => {
              if (hits[0]) {
                remember();
                close(hits[0].go);
              }
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={`Buscar en ${app.client.name}…`} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {!words.length &&
            (recent.length ? (
              <div className="flex flex-col gap-2">
                <span className="sw-eyebrow">Buscaste</span>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <Button key={r} size="sm" variant="secondary" onPress={() => setQ(r)}>
                      <Clock />
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Publicaciones, trabajo, peticiones, recursos, conversaciones, leads, documentos y reuniones.</p>
            ))}

          {words.length > 0 && !hits.length && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Magnifier className="size-7 text-muted" />
              <p className="font-medium">Sin resultados</p>
              <p className="text-sm text-muted">Nada con «{q.trim()}». Prueba con otra palabra.</p>
            </div>
          )}

          {hits.length > 0 && (
            <div className="flex flex-col gap-4" role="list" aria-label="Resultados">
              <span className="text-xs text-muted">
                {hits.length} {hits.length === 1 ? 'resultado' : 'resultados'}
              </span>
              {[...groups].map(([group, list]) => (
                <section key={group} className="flex flex-col gap-1">
                  <h3 className="sw-eyebrow px-1">
                    {group} · {list.length}
                  </h3>
                  {list.slice(0, 8).map((h) => (
                    <a
                      key={h.id}
                      role="listitem"
                      href={h.go}
                      onClick={(e) => {
                        e.preventDefault();
                        remember();
                        close(h.go);
                      }}
                      className="flex items-center gap-3 rounded-2xl px-2 py-2 outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <Bubble name={h.ico} color={h.color} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          <Marked text={h.title} words={words} />
                        </span>
                        <span className="truncate text-xs text-muted">
                          <Marked text={h.sub} words={words} />
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </a>
                  ))}
                  {list.length > 8 && <span className="px-2 text-xs text-muted">y {list.length - 8} más: afina la búsqueda</span>}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Hoja>
  );
}
