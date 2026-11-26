// Barras agrupadas (por ejemplo, entradas y salidas de cada mes). Un solo eje,
// barras finas con la punta redondeada apoyadas en la base, 2 px de aire entre
// las de un mismo grupo, rejilla discreta, leyenda arriba y, al pasar o enfocar
// un grupo, un globo con sus cifras. «Ver como tabla» da los mismos datos en texto.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Table } from '@heroui/react';

const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * groups: [{ key, label, values: [number, …] }]
 * series: [{ name, color }] en el mismo orden que values.
 */
export function BarsChart({ groups, series, format = (v) => String(v), compact = (v) => format(v), title }) {
  const box = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [asTable]);

  const max = useMemo(() => niceMax(Math.max(0, ...groups.flatMap((g) => g.values))), [groups]);
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, groups.length);
  const gap = 2;
  const barW = Math.max(3, Math.min(18, (slot * 0.62 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const bar = (x, v, color) => {
    const top = y(v);
    const h = PAD.top + innerH - top;
    if (h <= 0.5) return null;
    const r = Math.min(4, barW / 2, h);
    // Punta redondeada arriba y base recta.
    return (
      <path
        d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
        fill={color}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap items-center gap-4 text-xs text-muted" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onPress={() => setAsTable((t) => !t)}>
          {asTable ? 'Ver el gráfico' : 'Ver como tabla'}
        </Button>
      </div>

      {asTable ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={title || 'Datos del gráfico'}>
              <Table.Header>
                <Table.Column isRowHeader>Mes</Table.Column>
                {series.map((s) => (
                  <Table.Column key={s.name} className="text-end">
                    {s.name}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {groups.map((g) => (
                  <Table.Row key={g.key}>
                    <Table.Cell className="capitalize">{g.label}</Table.Cell>
                    {g.values.map((v, i) => (
                      <Table.Cell key={series[i].name} className="text-end tabular-nums">
                        {format(v)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <div ref={box} className="relative w-full">
          <svg width={width} height={H} role="group" aria-label={title} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--separator)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">
                  {compact(t)}
                </text>
              </g>
            ))}
            {groups.map((g, gi) => {
              const x0 = PAD.left + gi * slot + (slot - groupW) / 2;
              const active = hover === gi;
              return (
                <g
                  key={g.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${g.label}: ${series.map((s, i) => `${s.name} ${format(g.values[i])}`).join(', ')}`}
                  onMouseEnter={() => setHover(gi)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(gi)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  {/* Zona de toque más grande que las barras. */}
                  <rect x={PAD.left + gi * slot} y={PAD.top} width={slot} height={innerH} fill={active ? 'var(--surface-secondary)' : 'transparent'} rx="6" />
                  {g.values.map((v, i) => (
                    <g key={series[i].name}>{bar(x0 + i * (barW + gap), v, series[i].color)}</g>
                  ))}
                  <text x={PAD.left + gi * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={active ? 'var(--foreground)' : 'var(--muted)'}>
                    {g.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover != null && (
            <div
              className="pointer-events-none absolute z-10 min-w-36 rounded-2xl bg-overlay px-3 py-2 text-xs shadow-[var(--overlay-shadow)]"
              style={{
                left: Math.min(width - 160, Math.max(0, PAD.left + hover * slot + slot / 2 - 72)),
                top: 0,
              }}
            >
              <p className="mb-1 font-medium capitalize">{groups[hover].label}</p>
              {series.map((s, i) => (
                <p key={s.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </span>
                  <span className="tabular-nums">{format(groups[hover].values[i])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
