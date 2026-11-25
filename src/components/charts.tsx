import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { cx } from './ui';
import { formatNumber } from '../domain/util';

/**
 * Gráficos SVG livianos con la paleta GeoAlerta.
 * Reglas aplicadas: barras ≤ 16 px con extremo redondeado de 4 px anclado a la línea base,
 * líneas de 2 px, marcadores r=4 con anillo blanco de 2 px, cuadrícula de 1 px recesiva,
 * tooltip al pasar el cursor, leyenda para ≥ 2 series y vista de tabla alternativa.
 */

export interface Datum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

const INK = { grid: '#DCE2E6', axis: '#8C9BA8', text: '#50606D', strong: '#1B2B38' };

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md bg-navy-950 text-white text-xs px-2.5 py-1.5 shadow-pop whitespace-nowrap"
      style={{ left: x, top: y, transform: 'translate(-50%, calc(-100% - 10px))' }}
      role="status"
    >
      {children}
    </div>
  );
}

/** Marco con título, alternancia gráfico/tabla y leyenda. */
export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string; dashed?: boolean }[];
  table: { headers: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, legend, table, children, className, actions }) => {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cx('bg-white rounded-lg border border-ink-200 shadow-card flex flex-col', className)}>
      <header className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-navy-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {actions}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="p-1.5 rounded text-ink-500 hover:bg-ink-100 hover:text-navy-900"
            aria-label={asTable ? 'Ver como gráfico' : 'Ver como tabla'}
            title={asTable ? 'Ver como gráfico' : 'Ver como tabla'}
          >
            {asTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
          </button>
        </div>
      </header>
      {legend && legend.length > 1 && !asTable && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2 text-[11px] text-ink-600">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-[3px] rounded" style={{ background: l.color, outline: l.dashed ? `1px dashed ${l.color}` : undefined }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 pb-4 flex-1">
        {asTable ? (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-200">
                  {table.headers.map((h) => (
                    <th key={h} scope="col" className="text-left py-1.5 pr-3 font-semibold text-ink-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-ink-100">
                    {r.map((c, j) => (
                      <td key={j} className={cx('py-1.5 pr-3', typeof c === 'number' && 'tabular-nums text-right')}>
                        {typeof c === 'number' ? formatNumber(c, Number.isInteger(c) ? 0 : 1) : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
};

/** Barras horizontales: magnitud por categoría (departamento, tipo de minería…). */
export function HBarChart({ data, color = '#0A93A1', onSelect, valueSuffix = '', maxRows }: { data: Datum[]; color?: string; onSelect?: (d: Datum) => void; valueSuffix?: string; maxRows?: number }) {
  const rows = maxRows ? data.slice(0, maxRows) : data;
  const max = Math.max(1, ...rows.map((d) => d.value));
  const top = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0] ?? { key: '', value: 0 });
  return (
    <ul className="space-y-1.5" aria-label="Gráfico de barras">
      {rows.map((d) => {
        const pct = (d.value / max) * 100;
        const content = (
          <>
            <span className="w-28 sm:w-32 shrink-0 truncate text-ink-700 text-left" title={d.label}>
              {d.label}
            </span>
            <span className="flex-1 h-4 relative" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-r-[4px] transition-all" style={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%`, background: d.color ?? color }} />
            </span>
            <span className={cx('w-12 text-right tabular-nums', d.key === top.key ? 'font-bold text-ink-900' : 'text-ink-600')}>
              {formatNumber(d.value, Number.isInteger(d.value) ? 0 : 1)}
              {valueSuffix}
            </span>
          </>
        );
        return (
          <li key={d.key} title={`${d.label}: ${d.value}${valueSuffix}`}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(d)} className="w-full flex items-center gap-2 text-xs rounded hover:bg-ink-50 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs py-0.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Anillo de proporciones con leyenda etiquetada (categoría + valor + %). */
export function DonutChart({ data, centerLabel, onSelect }: { data: Datum[]; centerLabel?: string; onSelect?: (d: Datum) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 60;
  const r = 40;
  const arcs = useMemo(() => {
    let angle = -Math.PI / 2;
    const gap = data.filter((d) => d.value > 0).length > 1 ? 0.025 : 0; // separación de superficie
    return data.map((d) => {
      const sweep = total ? (d.value / total) * Math.PI * 2 : 0;
      const a0 = angle + gap / 2;
      const a1 = angle + sweep - gap / 2;
      angle += sweep;
      if (sweep <= gap) return { d, path: '' };
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${70 + rad * Math.cos(a)} ${70 + rad * Math.sin(a)}`;
      return { d, path: `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z` };
    });
  }, [data, total]);
  const hovered = data.find((d) => d.key === hover);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0" role="img" aria-label={`Distribución. Total ${total}`}>
        {arcs.map(({ d, path }) =>
          path ? (
            <path
              key={d.key}
              d={path}
              fill={d.color}
              opacity={hover && hover !== d.key ? 0.35 : 1}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
              onClick={onSelect ? () => onSelect(d) : undefined}
              style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'opacity .15s' }}
            >
              <title>{`${d.label}: ${d.value} (${total ? ((d.value / total) * 100).toFixed(1) : 0}%)`}</title>
            </path>
          ) : null
        )}
        <text x="70" y="68" textAnchor="middle" className="fill-navy-900" style={{ fontSize: 20, fontWeight: 800 }}>
          {hovered ? hovered.value : total}
        </text>
        <text x="70" y="84" textAnchor="middle" style={{ fontSize: 8.5, fill: INK.text }}>
          {hovered ? hovered.label.slice(0, 22) : centerLabel ?? 'Total'}
        </text>
      </svg>
      <ul className="flex-1 w-full space-y-1 text-xs">
        {data.map((d) => (
          <li key={d.key}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(d)}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
              className={cx('w-full flex items-center gap-2 rounded px-1 py-0.5 text-left', onSelect && 'hover:bg-ink-50', hover === d.key && 'bg-ink-50')}
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} aria-hidden />
              <span className="flex-1 text-ink-700 truncate">{d.label}</span>
              <span className="tabular-nums font-semibold text-ink-900">{d.value}</span>
              <span className="tabular-nums text-ink-500 w-10 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

/** Líneas temporales con cursor en cruz y tooltip de todas las series. */
export function LineChart({ labels, series, height = 180, valueSuffix = '' }: { labels: string[]; series: LineSeries[]; height?: number; valueSuffix?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 520;
  const H = height;
  const pad = { l: 30, r: 12, t: 10, b: 22 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / (max > 10 ? 5 : 1)) * (max > 10 ? 5 : 1);
  const x = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, niceMax / 2, niceMax];

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (labels.length - 1));
    setHoverIdx(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  const tipX = hoverIdx !== null && wrap.current ? (x(hoverIdx) / W) * wrap.current.clientWidth : 0;
  const tipY = hoverIdx !== null && wrap.current ? (y(Math.max(...series.map((s) => s.values[hoverIdx] ?? 0))) / H) * wrap.current.clientHeight : 0;

  return (
    <div ref={wrap} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Serie temporal: ${series.map((s) => s.label).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={INK.grid} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" style={{ fontSize: 10, fill: INK.text }}>
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          labels.length <= 12 || i % 2 === 0 ? (
            <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" style={{ fontSize: 10, fill: INK.text }}>
              {l}
            </text>
          ) : null
        )}
        {series.map((s) => (
          <g key={s.key}>
            <path d={`M ${s.values.map((v, i) => `${x(i)} ${y(v)}`).join(' L ')} L ${x(s.values.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={s.color} opacity={series.length === 1 ? 0.1 : 0} />
            <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
            {/* Etiqueta directa del último valor */}
            <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1] ?? 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
          </g>
        ))}
        {hoverIdx !== null && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H - pad.b} stroke={INK.axis} strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.key} cx={x(hoverIdx)} cy={y(s.values[hoverIdx] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} />
      </svg>
      {hoverIdx !== null && (
        <Tooltip x={tipX} y={tipY}>
          <div className="font-semibold mb-0.5">{labels[hoverIdx]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}: <strong className="tabular-nums">{formatNumber(s.values[hoverIdx] ?? 0, 1)}{valueSuffix}</strong>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/** Barras apiladas horizontales (p. ej. situación administrativa por departamento). */
export function StackedBars({ rows, segments, onSelect }: { rows: { key: string; label: string; values: Record<string, number> }[]; segments: { key: string; label: string; color: string }[]; onSelect?: (rowKey: string, segKey: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => segments.reduce((s, seg) => s + (r.values[seg.key] ?? 0), 0)));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const total = segments.reduce((s, seg) => s + (r.values[seg.key] ?? 0), 0);
        return (
          <li key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-ink-700" title={r.label}>
              {r.label}
            </span>
            <span className="flex-1 min-w-0">
            <span className="flex h-4 gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
              {segments.map((seg, i) => {
                const v = r.values[seg.key] ?? 0;
                if (!v) return null;
                const isLast = segments.slice(i + 1).every((s2) => !(r.values[s2.key] ?? 0));
                return (
                  <button
                    key={seg.key}
                    type="button"
                    title={`${r.label} · ${seg.label}: ${v}`}
                    aria-label={`${r.label} · ${seg.label}: ${v}`}
                    onClick={onSelect ? () => onSelect(r.key, seg.key) : undefined}
                    className={cx('h-full', isLast && 'rounded-r-[4px]', onSelect ? 'cursor-pointer hover:opacity-80' : 'cursor-default')}
                    style={{ flexGrow: v, flexBasis: 0, background: seg.color }}
                  />
                );
              })}
            </span>
            </span>
            <span className="w-8 text-right tabular-nums text-ink-600">{total}</span>
          </li>
        );
      })}
    </ul>
  );
}
