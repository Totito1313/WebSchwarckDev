// Cronología: todo lo que pasó, por días. El reporte diario del estudio (cada
// tarea con su tiempo, quién lo mandó, dificultades y observaciones), anuncios,
// avances, contenido, resultados y lo que mandó el propio cliente. Lo nuevo desde
// su última visita sale marcado.
import { useMemo } from 'react';
import { CircleCheck, Clock, Thunderbolt } from '@gravity-ui/icons';
import { Card, Chip, Disclosure, Tabs } from '@heroui/react';
import { Empty } from '../../kit/parts.jsx';
import { ago, dayLabel, localDay, minutesText } from '../../../portal/kit.js';
import { feed, unread } from '../../../portal/state.js';
import { go, usePortal } from '../store.js';
import { Timeline } from '../../pro/index.js';
import { Ico } from '../ui.jsx';

const FILTERS = [
  ['todo', 'Todo'],
  ['reportes', 'Reportes'],
  ['avances', 'Avances'],
  ['marketing', 'Marketing'],
  ['anuncios', 'Anuncios'],
  ['tuyo', 'Lo tuyo'],
];

function Report({ item, fresh }) {
  const { done, items, minutes, meta } = item.report;
  const doing = items.filter((w) => w.status === 'doing');
  return (
    <Card variant="secondary" className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          {item.label}
          {fresh && (
            <Chip size="sm" color="accent" variant="soft">
              Nuevo
            </Chip>
          )}
        </span>
        <span className="text-xs text-muted">
          {done.length} hechas{minutes ? ` · ${minutesText(minutes)}` : ''}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {done.map((w) => (
          <li key={w.id} className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="flex-1">{w.title}</span>
            {w.minutes ? <span className="shrink-0 text-xs text-muted">{minutesText(w.minutes)}</span> : null}
          </li>
        ))}
        {doing.map((w) => (
          <li key={w.id} className="flex items-start gap-2">
            <Thunderbolt className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="flex-1">{w.title}</span>
            <span className="shrink-0 text-xs text-muted">en curso</span>
          </li>
        ))}
      </ul>
      {meta && (meta.author || meta.blockers || meta.notes) && (
        <Disclosure>
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex items-center gap-1 text-xs text-muted">
              Notas del día
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="mt-2 flex flex-col gap-1 text-sm">
              {meta.author && (
                <p className="flex items-center gap-1.5 text-muted">
                  <Clock className="size-3.5" />
                  Lo mandó {meta.author}
                  {meta.sent_at ? ` a las ${meta.sent_at.slice(0, 5)}` : ''}
                </p>
              )}
              {meta.blockers && (
                <p>
                  <b>Dificultades:</b> {meta.blockers}
                </p>
              )}
              {meta.notes && (
                <p>
                  <b>Observaciones:</b> {meta.notes}
                </p>
              )}
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}
    </Card>
  );
}

export function Cronologia({ filter = 'todo' }) {
  const [, v] = usePortal();
  const current = FILTERS.some(([k]) => k === filter) ? filter : 'todo';
  const { days, fresh } = useMemo(() => {
    const items = feed().filter((x) => current === 'todo' || x.group === current);
    const byDay = new Map();
    for (const it of items) {
      const k = localDay(it.at);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(it);
    }
    return { days: [...byDay], fresh: new Set(unread().map((x) => x.id)) };
  }, [v, current]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cronología</h1>
        <p className="text-sm text-muted">Todo lo que pasó en tu proyecto, por días.</p>
      </header>
      <Tabs selectedKey={current} onSelectionChange={(k) => go(k === 'todo' ? '#/cronologia' : `#/cronologia/${k}`)}>
        <Tabs.ListContainer className="overflow-x-auto">
          <Tabs.List aria-label="Filtrar">
            {FILTERS.map(([k, label]) => (
              <Tabs.Tab key={k} id={k}>
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {days.length === 0 ? (
        <Empty icon={Clock} title="Nada por aquí todavía" text="Lo que vaya pasando aparecerá en esta lista." />
      ) : (
        days.map(([day, items]) => (
          <section key={day} className="flex flex-col gap-3" aria-label={dayLabel(day)}>
            <h2 className="sw-eyebrow sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-1 backdrop-blur">{dayLabel(day)}</h2>
            <Timeline
              label={`Lo que pasó el ${dayLabel(day)}`}
              items={items.map((it) => {
                const Icon = (p) => <Ico name={it.ico} className={p.className} />;
                const isNew = fresh.has(it.id);
                if (it.report)
                  return {
                    id: it.id,
                    title: it.title || 'Informe',
                    marker: { icon: Icon, color: it.color },
                    badge: isNew ? { label: 'Nuevo', color: 'accent' } : undefined,
                    trailing: ago(it.at),
                    children: <Report item={it} fresh={isNew} />,
                  };
                return {
                  id: it.id,
                  title: it.go ? (
                    <a href={it.go} className="hover:underline">
                      {it.title}
                    </a>
                  ) : (
                    it.title
                  ),
                  marker: { icon: Icon, color: it.color },
                  badge: isNew ? { label: 'Nuevo', color: 'accent' } : it.label ? { label: it.label } : undefined,
                  trailing: ago(it.at),
                  description: it.body ? <span className="line-clamp-3">{it.body}</span> : undefined,
                };
              })}
            />
          </section>
        ))
      )}
    </div>
  );
}
