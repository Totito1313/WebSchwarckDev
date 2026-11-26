// Gráficos propios, inspirados en los «Composed», «Pie» y «Sparkline» de HeroUI Pro
// pero hechos desde cero en SVG y con las reglas de siempre:
//  · Un solo eje. Barras, área y línea comparten la misma escala (por ejemplo,
//    entradas, salidas y resultado, todo en dinero). Nunca dos escalas.
//  · Barras de 18 px como mucho, punta redondeada y base recta, 2 px de aire;
//    líneas de 2 px; el área es un velo del 10 % de su color.
//  · Rejilla de un pelo, leyenda arriba, globo al pasar (o con las flechas del
//    teclado) y «Ver como tabla» con los mismos datos.
//  · El texto nunca va del color de la serie: el color lo lleva la muestra.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Table } from '@heroui/react';

/* ── utilidades ─────────────────────────────────────────────────────────── */

function useWidth(min = 240) {
  const ref = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(min, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width];
}

function niceStep(range, count = 4) {
  const raw = range / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Dominio redondo que siempre incluye el cero, con sus marcas. */
export function niceScale(values, count = 4) {
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max === min) max = min + 1;
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { lo, hi, ticks };
}

/** Barra con la punta redondeada (arriba si es positiva, abajo si es negativa). */
function barPath(x, w, yBase, yVal) {
  const h = Math.abs(yBase - yVal);
  if (h < 0.5) return '';
  const r = Math.min(4, w / 2, h);
  if (yVal <= yBase) {
    return `M${x},${yBase} V${yVal + r} Q${x},${yVal} ${x + r},${yVal} H${x + w - r} Q${x + w},${yVal} ${x + w},${yVal + r} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yVal - r} Q${x},${yVal} ${x + r},${yVal} H${x + w - r} Q${x + w},${yVal} ${x + w},${yVal - r} V${yBase} Z`;
}

/** Muestra de la leyenda según el tipo de marca. */
function Swatch({ type = 'bar', color }) {
  if (type === 'line') return <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: color }} aria-hidden />;
  if (type === 'area')
    return (
      <span className="relative inline-block h-2.5 w-3.5 overflow-hidden rounded-[3px]" aria-hidden>
        <span className="absolute inset-0 opacity-20" style={{ background: color }} />
        <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      </span>
    );
  return <span className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />;
}

export function Legend({ series, className = '' }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted ${className}`} aria-label="Leyenda">
      {series.map((s) => (
        <li key={s.key || s.name} className="flex items-center gap-1.5">
          <Swatch type={s.type} color={s.color} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/* ── Gráfico compuesto: barras, área y línea en un solo eje ────────────── */

/**
 * data:   [{ key, label, [serie.key]: number }]
 * series: [{ key, name, type: 'bar' | 'line' | 'area', color }]
 */
export function ComposedChart({
  data,
  series,
  format = (v) => String(v),
  compact = format,
  title,
  height = 240,
  xLabel = 'Periodo',
  showLegend = true,
  allowTable = true,
}) {
  const [box, width] = useWidth();
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const gid = useId().replace(/:/g, '');

  const PAD = { top: 12, right: 10, bottom: 26, left: 56 };
  const values = useMemo(() => data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)), [data, series]);
  const { lo, hi, ticks } = useMemo(() => niceScale(values), [values]);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const y = (v) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const y0 = y(0);
  const cx = (i) => PAD.left + i * slot + slot / 2;

  const bars = series.filter((s) => s.type === 'bar');
  const gap = 2;
  const barW = bars.length ? Math.max(3, Math.min(18, (slot * 0.6 - gap * (bars.length - 1)) / bars.length)) : 0;
  const groupW = bars.length * barW + Math.max(0, bars.length - 1) * gap;

  // Etiquetas del eje x: si no caben todas, una de cada k.
  const every = Math.max(1, Math.ceil(n / Math.floor(innerW / 44)));

  const linePath = (s) => data.map((d, i) => `${i ? 'L' : 'M'}${cx(i)},${y(Number(d[s.key]) || 0)}`).join(' ');
  const areaPath = (s) => `${linePath(s)} L${cx(n - 1)},${y0} L${cx(0)},${y0} Z`;

  const onKey = (e) => {
    if (e.key === 'ArrowRight') setHover((h) => (h == null ? 0 : Math.min(n - 1, h + 1)));
    else if (e.key === 'ArrowLeft') setHover((h) => (h == null ? n - 1 : Math.max(0, h - 1)));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {(showLegend || allowTable) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showLegend ? <Legend series={series} /> : <span />}
          {allowTable && (
            <Button size="sm" variant="ghost" onPress={() => setAsTable((t) => !t)}>
              {asTable ? 'Ver el gráfico' : 'Ver como tabla'}
            </Button>
          )}
        </div>
      )}

      {asTable ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={title || 'Datos del gráfico'}>
              <Table.Header>
                <Table.Column isRowHeader>{xLabel}</Table.Column>
                {series.map((s) => (
                  <Table.Column key={s.key} className="text-end">
                    {s.name}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {data.map((d) => (
                  <Table.Row key={d.key}>
                    <Table.Cell className="capitalize">{d.label}</Table.Cell>
                    {series.map((s) => (
                      <Table.Cell key={s.key} className="text-end tabular-nums">
                        {format(Number(d[s.key]) || 0)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <div ref={box} className="relative w-full min-w-0">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title || 'Gráfico'}. Usa las flechas para recorrer los datos.`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            onMouseLeave={() => setHover(null)}
            className="block overflow-visible rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <defs>
              {series
                .filter((s) => s.type === 'area')
                .map((s) => (
                  <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                  </linearGradient>
                ))}
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? 'var(--border)' : 'var(--separator)'}
                  strokeWidth="1"
                />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}

            {/* Franja del punto activo (más grande que las marcas). */}
            {hover != null && (
              <rect x={PAD.left + hover * slot} y={PAD.top} width={slot} height={innerH} rx="6" fill="var(--surface-secondary)" />
            )}

            {series
              .filter((s) => s.type === 'area')
              .map((s) => (
                <path key={s.key} d={areaPath(s)} fill={`url(#${gid}-${s.key})`} />
              ))}

            {data.map((d, i) => {
              const x0 = cx(i) - groupW / 2;
              return (
                <g key={d.key}>
                  {bars.map((s, bi) => (
                    <path key={s.key} d={barPath(x0 + bi * (barW + gap), barW, y0, y(Number(d[s.key]) || 0))} fill={s.color} />
                  ))}
                </g>
              );
            })}

            {series
              .filter((s) => s.type === 'line' || s.type === 'area')
              .map((s) => (
                <path key={s.key} d={linePath(s)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              ))}

            {hover != null && (
              <line x1={cx(hover)} x2={cx(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border)" strokeWidth="1" />
            )}
            {series
              .filter((s) => s.type !== 'bar')
              .map((s) => {
                const i = hover ?? n - 1;
                return (
                  <circle
                    key={s.key}
                    cx={cx(i)}
                    cy={y(Number(data[i]?.[s.key]) || 0)}
                    r="4"
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                );
              })}

            {data.map((d, i) =>
              i % every === 0 || i === n - 1 ? (
                <text
                  key={d.key}
                  x={cx(i)}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={hover === i ? 'var(--foreground)' : 'var(--muted)'}
                  className="capitalize"
                >
                  {d.label}
                </text>
              ) : null,
            )}

            {/* Zonas de toque por periodo. */}
            {data.map((d, i) => (
              <rect
                key={d.key}
                x={PAD.left + i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            ))}
          </svg>

          {hover != null && data[hover] && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-2xl bg-overlay px-3 py-2 text-xs shadow-[var(--overlay-shadow)]"
              style={{ left: Math.min(width - 172, Math.max(0, cx(hover) + (cx(hover) > width / 2 ? -180 : 12))) }}
            >
              <p className="mb-1 font-medium capitalize">{data[hover].label}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Swatch type={s.type} color={s.color} />
                    {s.name}
                  </span>
                  <span className="tabular-nums">{format(Number(data[hover][s.key]) || 0)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Gráfico circular (anillo) ─────────────────────────────────────────── */

export const CATEGORY_COLORS = ['var(--sw-cat-1)', 'var(--sw-cat-2)', 'var(--sw-cat-3)', 'var(--sw-cat-4)', 'var(--sw-cat-5)'];

/** Deja las `max` partes más grandes y junta el resto en «Otras». */
export function foldParts(parts, max = 5, otherLabel = 'Otras') {
  const sorted = [...parts].filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted.map((p, i) => ({ ...p, color: p.color || CATEGORY_COLORS[i] }));
  const head = sorted.slice(0, max - 1).map((p, i) => ({ ...p, color: p.color || CATEGORY_COLORS[i] }));
  const rest = sorted.slice(max - 1).reduce((s, p) => s + p.value, 0);
  return [...head, { key: '__other', label: otherLabel, value: rest, color: 'var(--sw-cat-other)' }];
}

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

/**
 * Anillo con su leyenda de cifras al lado (nombre, importe y parte del total).
 * parts: [{ key, label, value, color? }] — se ordenan y se pliegan en «Otras».
 */
export function DonutChart({ parts, format = (v) => String(v), title, totalLabel = 'Total', size = 168, max = 5, layout = 'side' }) {
  const [hover, setHover] = useState(null);
  const shown = useMemo(() => foldParts(parts, max), [parts, max]);
  const total = shown.reduce((s, p) => s + p.value, 0);
  const stroke = Math.round(size * 0.14);
  const r = size / 2 - stroke / 2 - 2;
  const c = size / 2;
  // 2 px de aire entre partes, medidos en el borde exterior.
  const padA = shown.length > 1 ? 2 / (r + stroke / 2) : 0;

  let a = 0;
  const arcs = shown.map((p) => {
    const span = total ? (p.value / total) * Math.PI * 2 : 0;
    const from = a + padA / 2;
    const to = a + span - padA / 2;
    a += span;
    return { ...p, from, to: Math.max(from + 0.001, to), share: total ? p.value / total : 0 };
  });
  const active = hover != null ? arcs[hover] : null;

  return (
    <div className={`flex min-w-0 gap-5 ${layout === 'side' ? 'flex-col items-center sm:flex-row' : 'flex-col items-center'}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${title || 'Reparto'}: ${arcs.map((p) => `${p.label} ${Math.round(p.share * 100)} %`).join(', ')}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-secondary)" strokeWidth={stroke} />
          {arcs.length === 1 ? (
            <circle cx={c} cy={c} r={r} fill="none" stroke={arcs[0].color} strokeWidth={stroke} />
          ) : (
            arcs.map((p, i) => (
              <path
                key={p.key}
                d={arc(c, c, r, p.from, p.to)}
                fill="none"
                stroke={p.color}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeLinecap="butt"
                opacity={hover == null || hover === i ? 1 : 0.45}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: 'opacity 150ms, stroke-width 150ms' }}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[70%] truncate text-[11px] text-muted">{active ? active.label : totalLabel}</span>
          <span className="max-w-[80%] truncate text-lg font-semibold tabular-nums">{format(active ? active.value : total)}</span>
          {active && <span className="text-[11px] text-muted tabular-nums">{Math.round(active.share * 100)} %</span>}
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-1.5" aria-label={title ? `${title}, en cifras` : 'En cifras'}>
        {arcs.map((p, i) => (
          <li
            key={p.key}
            className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors ${hover === i ? 'bg-surface-secondary' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="tabular-nums">{format(p.value)}</span>
            <span className="w-10 text-end text-xs text-muted tabular-nums">{Math.round(p.share * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Línea mínima para las cifras ──────────────────────────────────────── */

/** Tendencia sin ejes: la línea de 2 px con un velo debajo y el último punto. */
export function Sparkline({ values, color = 'var(--accent)', width = 112, height = 36, label }) {
  const gid = useId().replace(/:/g, '');
  const pts = values.length > 1 ? values : [values[0] || 0, values[0] || 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i) => 2 + (i / (pts.length - 1)) * (width - 6);
  const yv = (v) => 3 + (1 - (v - min) / span) * (height - 8);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${yv(v)}`).join(' ');
  return (
    <svg width={width} height={height} role="img" aria-label={label || 'Tendencia'} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${x(pts.length - 1)},${height} L${x(0)},${height} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={yv(pts[pts.length - 1])} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
