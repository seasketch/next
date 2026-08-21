import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleTime } from "d3-scale";
import { splitObservedRuns } from "../temporalChart";
import {
  DEFAULT_TIME_SERIES_COLOR,
  timeSeriesRoleColor,
} from "../timeSeriesCartography";

/**
 * Presentational SVG time-series chart for report widgets.
 *
 * - "line": a single series with points (mangrove extent, fishing effort)
 * - "envelope": min/max band plus a mean line (degree heating weeks)
 *
 * X values are UTC milliseconds (TemporalInfo coverage). Samples whose
 * coverage is longer than one native-resolution unit render as a horizontal
 * span (markers at begin/end, solid line between). Colors come from each
 * sample when the widget binds layer cartography; span and interpolated
 * connectors are hue/lightness variants of that ink.
 *
 * Gaps are missing time between coverage intervals (they do not touch or
 * overlap). Those spans use interpolated symbology: a dashed connector and
 * a lightened envelope band.
 *
 * Tooltips appear only when the cursor is near a real sample (buffered
 * hit target around each marker, and along a coverage span).
 */

export type TimeSeriesDatum = {
  /** Inclusive coverage start, ms since epoch. */
  x: number;
  /** Exclusive coverage end, ms since epoch. Omit for a degenerate point. */
  xEnd?: number;
  /** True when this sample should render as a begin–end span. */
  span?: boolean;
  /** Primary value: the series value in "line" mode, the mean in "envelope". */
  value: number;
  /** Envelope bounds. Required for "envelope" mode points. */
  min?: number;
  max?: number;
  /** Tooltip / x-axis label for this sample (e.g. "2018" or "2015–2020"). */
  formattedX?: string;
  formattedValue?: string;
  formattedMin?: string;
  formattedMax?: string;
  /**
   * Contrast-safe stroke/fill from the layer's cartography (or the
   * raster-color at this Y value). Falls back to the chart `color` prop.
   */
  color?: string;
  /** Envelope-only: raster-color at min / max when Y drives styling. */
  colorMin?: string;
  colorMax?: string;
};

export type TimeSeriesChartMode = "line" | "envelope";
export type TimeSeriesTickDensity = "less" | "auto" | "more";

type ColoredConnector = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorA: string;
  colorB: string;
  line: string;
  envelope: string;
};

const TOOLTIP_GAP = 12;
const TOOLTIP_FLIP_THRESHOLD = 56;
const MARGIN = { top: 10, right: 12, bottom: 24, left: 8 };
const Y_TICK_TARGET = 4;
const HOVER_RADIUS = 16;
const DEFAULT_SPAN_COLOR = timeSeriesRoleColor(
  DEFAULT_TIME_SERIES_COLOR,
  "span"
);

const TICK_COUNTS: Record<TimeSeriesTickDensity, number> = {
  less: 4,
  auto: 8,
  more: 16,
};

function defaultFormatX(x: number) {
  const d = new Date(x);
  if (!Number.isFinite(d.getTime())) return String(x);
  return String(d.getUTCFullYear());
}

function coverageEnd(d: TimeSeriesDatum): number {
  return d.xEnd !== undefined && d.xEnd > d.x ? d.xEnd : d.x;
}

function isSpan(d: TimeSeriesDatum): boolean {
  return Boolean(d.span && d.xEnd !== undefined && d.xEnd > d.x);
}

/** Plotted x for a point sample — midpoint of its coverage bin. */
function pointX(d: TimeSeriesDatum): number {
  const end = coverageEnd(d);
  return d.x + (end - d.x) / 2;
}

function visualStart(d: TimeSeriesDatum): number {
  return isSpan(d) ? d.x : pointX(d);
}

function visualEnd(d: TimeSeriesDatum): number {
  return isSpan(d) ? coverageEnd(d) : pointX(d);
}

function datumInk(d: TimeSeriesDatum, fallback: string): string {
  return d.color ?? fallback;
}

function spanInk(
  d: TimeSeriesDatum,
  fallbackSpan: string,
  fallback: string
): string {
  if (d.color) return timeSeriesRoleColor(d.color, "span");
  return fallbackSpan ?? fallback;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function svgPaintUrl(id: string): string {
  // eslint-disable-next-line i18next/no-literal-string
  return `url(#${id})`;
}

type HoverState = {
  datum: TimeSeriesDatum;
  px: number;
  py: number;
};

export function TimeSeriesChart({
  data,
  mode = "line",
  color = DEFAULT_TIME_SERIES_COLOR,
  spanColor = DEFAULT_SPAN_COLOR,
  height = 190,
  formatValue,
  formatX = defaultFormatX,
  yDomain,
  xTickDensity = "auto",
  valueLabel,
  minLabel,
  maxLabel,
  className,
}: {
  data: TimeSeriesDatum[];
  mode?: TimeSeriesChartMode;
  color?: string;
  /** Color for a single source's multi-unit coverage span. */
  spanColor?: string;
  height?: number;
  formatValue: (value: number) => string;
  formatX?: (x: number) => string;
  /**
   * Y domain override (data domain, 0–1 percent, etc). When omitted the
   * axis nices to the plotted results, anchored at zero when values are
   * non-negative.
   */
  yDomain?: [number, number];
  xTickDensity?: TimeSeriesTickDensity;
  valueLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
}) {
  const gradPrefix = useMemo(() => {
    // eslint-disable-next-line i18next/no-literal-string
    return `ts${Math.random().toString(36).slice(2, 10)}`;
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hoverX = hover?.datum.x;
  useLayoutEffect(() => {
    if (hoverX !== undefined && tooltipRef.current) {
      setTooltipWidth(tooltipRef.current.offsetWidth);
    }
  }, [hoverX]);

  const sorted = useMemo(
    () =>
      [...data]
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.value))
        .sort((a, b) => a.x - b.x || coverageEnd(a) - coverageEnd(b)),
    [data]
  );

  const yAxisWidth = useMemo(() => {
    const domainMax = yDomain
      ? yDomain[1]
      : Math.max(
          0,
          ...sorted.map((d) =>
            mode === "envelope" ? d.max ?? d.value : d.value
          )
        );
    const sample = formatValue(domainMax);
    return Math.max(30, Math.min(72, sample.length * 6.6 + 8));
  }, [sorted, formatValue, yDomain, mode]);

  const plot = useMemo(() => {
    if (sorted.length === 0 || width === 0) return null;

    const xMin = Math.min(...sorted.map((d) => d.x));
    const xMax = Math.max(...sorted.map((d) => coverageEnd(d)));
    const span = xMax - xMin;
    const xPad = span === 0 ? 1000 * 60 * 60 * 24 * 182 : span * 0.02;

    const left = MARGIN.left + yAxisWidth;
    const right = width - MARGIN.right;
    const top = MARGIN.top;
    const bottom = height - MARGIN.bottom;
    if (right - left < 40) return null;

    const xScale = scaleTime()
      .domain([new Date(xMin - xPad), new Date(xMax + xPad)])
      .range([left, right]);

    let yLo: number;
    let yHi: number;
    if (yDomain) {
      [yLo, yHi] = yDomain;
      if (yHi === yLo) yHi = yLo + 1;
    } else {
      const values = sorted.flatMap((d) =>
        mode === "envelope"
          ? [d.value, d.min ?? d.value, d.max ?? d.value]
          : [d.value]
      );
      yLo = Math.min(0, ...values);
      yHi = Math.max(...values);
      if (yHi === yLo) yHi = yLo + 1;
    }
    const yScale = scaleLinear().domain([yLo, yHi]).range([bottom, top]);
    yScale.nice(Y_TICK_TARGET);

    const tickCount = TICK_COUNTS[xTickDensity] ?? TICK_COUNTS.auto;
    const rawTicks = xScale.ticks(tickCount).map((d) => d.getTime());
    const seen = new Set<string>();
    const xTicks: number[] = [];
    for (const tick of rawTicks) {
      const label = formatX(tick);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      xTicks.push(tick);
    }

    return {
      xScale,
      yScale,
      xTicks,
      yTicks: yScale.ticks(Y_TICK_TARGET),
      left,
      right,
      top,
      bottom,
    };
  }, [sorted, width, height, yAxisWidth, yDomain, mode, xTickDensity, formatX]);

  const samples = useMemo(
    () =>
      sorted.map((d) => ({
        ...d,
        start: d.x,
        end: coverageEnd(d),
      })),
    [sorted]
  );

  const segments = useMemo(() => splitObservedRuns(samples), [samples]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!plot || sorted.length === 0) return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const mx = e.clientX - bounds.left;
      const my = e.clientY - bounds.top;

      let nearest: TimeSeriesDatum | null = null;
      let best = HOVER_RADIUS;
      let hoverPx = 0;
      for (const d of sorted) {
        const py = plot.yScale(d.value);
        if (isSpan(d)) {
          const x1 = plot.xScale(new Date(d.x));
          const x2 = plot.xScale(new Date(coverageEnd(d)));
          const dist = distToSegment(mx, my, x1, py, x2, py);
          if (dist < best) {
            best = dist;
            nearest = d;
            hoverPx = Math.max(x1, Math.min(x2, mx));
          }
        } else {
          const px = plot.xScale(new Date(pointX(d)));
          const dist = Math.hypot(mx - px, my - py);
          if (dist < best) {
            best = dist;
            nearest = d;
            hoverPx = px;
          }
        }
      }
      if (!nearest) {
        setHover(null);
        return;
      }
      setHover({
        datum: nearest,
        px: hoverPx,
        py: plot.yScale(nearest.value),
      });
    },
    [plot, sorted]
  );

  const tooltipStyle = hover
    ? (() => {
        const halfTip = tooltipWidth / 2 + 4;
        const left = Math.min(
          Math.max(hover.px, halfTip),
          Math.max(width - halfTip, halfTip)
        );
        const flipBelow = hover.py < TOOLTIP_FLIP_THRESHOLD;
        return {
          left,
          top: flipBelow ? hover.py + TOOLTIP_GAP : hover.py - TOOLTIP_GAP,
          transform: flipBelow
            ? "translate(-50%, 0)"
            : "translate(-50%, -100%)",
        };
      })()
    : undefined;

  const isolated = useMemo(
    () =>
      segments
        .filter((seg) => seg.length === 1 && !isSpan(seg[0]))
        .map((seg) => seg[0]),
    [segments]
  );

  const spans = useMemo(() => sorted.filter(isSpan), [sorted]);

  const observedPairs = useMemo(() => {
    const pairs: Array<[TimeSeriesDatum, TimeSeriesDatum]> = [];
    for (const seg of segments) {
      for (let i = 1; i < seg.length; i++) {
        pairs.push([seg[i - 1], seg[i]]);
      }
    }
    return pairs;
  }, [segments]);

  const gapPairs = useMemo(() => {
    const pairs: Array<[TimeSeriesDatum, TimeSeriesDatum]> = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      pairs.push([prev[prev.length - 1], segments[i][0]]);
    }
    return pairs;
  }, [segments]);

  const connectors = useMemo(() => {
    if (!plot) {
      return {
        observed: [] as ColoredConnector[],
        gaps: [] as ColoredConnector[],
      };
    }
    const toConnector = (
      a: TimeSeriesDatum,
      b: TimeSeriesDatum,
      interpolated: boolean,
      index: number
    ): ColoredConnector => {
      const x1 = plot.xScale(new Date(visualEnd(a)));
      const x2 = plot.xScale(new Date(visualStart(b)));
      const y1 = plot.yScale(a.value);
      const y2 = plot.yScale(b.value);
      const inkA = interpolated
        ? timeSeriesRoleColor(datumInk(a, color), "interpolated")
        : datumInk(a, color);
      const inkB = interpolated
        ? timeSeriesRoleColor(datumInk(b, color), "interpolated")
        : datumInk(b, color);
      const maxA = plot.yScale(a.max ?? a.value);
      const maxB = plot.yScale(b.max ?? b.value);
      const minA = plot.yScale(a.min ?? a.value);
      const minB = plot.yScale(b.min ?? b.value);
      return {
        id: `${gradPrefix}-${interpolated ? "g" : "o"}-${index}`,
        x1,
        y1,
        x2,
        y2,
        colorA: inkA,
        colorB: inkB,
        // eslint-disable-next-line i18next/no-literal-string
        line: `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(
          2
        )}`,
        // eslint-disable-next-line i18next/no-literal-string
        envelope: `M ${x1.toFixed(2)} ${maxA.toFixed(2)} L ${x2.toFixed(
          2
        )} ${maxB.toFixed(2)} L ${x2.toFixed(2)} ${minB.toFixed(2)} L ${x1.toFixed(
          2
        )} ${minA.toFixed(2)} Z`,
      };
    };
    return {
      observed: observedPairs.map((pair, i) =>
        toConnector(pair[0], pair[1], false, i)
      ),
      gaps: gapPairs.map((pair, i) => toConnector(pair[0], pair[1], true, i)),
    };
  }, [plot, observedPairs, gapPairs, color, gradPrefix]);

  const hoverDatum = hover?.datum;
  const tooltipRows = hoverDatum
    ? mode === "envelope"
      ? ([
          [
            maxLabel,
            hoverDatum.formattedMax ??
              formatValue(hoverDatum.max ?? hoverDatum.value),
          ],
          [
            valueLabel,
            hoverDatum.formattedValue ?? formatValue(hoverDatum.value),
          ],
          [
            minLabel,
            hoverDatum.formattedMin ??
              formatValue(hoverDatum.min ?? hoverDatum.value),
          ],
        ] as Array<[string | undefined, string]>)
      : ([
          [
            valueLabel,
            hoverDatum.formattedValue ?? formatValue(hoverDatum.value),
          ],
        ] as Array<[string | undefined, string]>)
    : [];

  return (
    <div
      ref={containerRef}
      className={className ? `relative w-full ${className}` : "relative w-full"}
      style={{ height }}
    >
      {plot && (
        <svg width={width} height={height} role="img">
          {plot.yTicks.map((tick) => {
            const y = plot.yScale(tick);
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={plot.left}
                  x2={plot.right}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text
                  x={plot.left - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="#6b7280"
                >
                  {formatValue(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={plot.left}
            x2={plot.right}
            y1={plot.bottom}
            y2={plot.bottom}
            stroke="#d1d5db"
            strokeWidth={1}
          />
          {plot.xTicks.map((tick) => (
            <text
              key={`x-${tick}`}
              x={plot.xScale(new Date(tick))}
              y={plot.bottom + 16}
              textAnchor="middle"
              fontSize={11}
              fill="#6b7280"
            >
              {formatX(tick)}
            </text>
          ))}
          <defs>
            {[...connectors.gaps, ...connectors.observed].map((c) =>
              c.colorA === c.colorB ? null : (
                <linearGradient
                  key={`${c.id}-line`}
                  id={`${c.id}-line`}
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={c.colorA} />
                  <stop offset="100%" stopColor={c.colorB} />
                </linearGradient>
              )
            )}
            {mode === "envelope" &&
              isolated.map((d) => {
                if (!d.colorMin || !d.colorMax || d.colorMin === d.colorMax) {
                  return null;
                }
                const x = plot.xScale(new Date(pointX(d)));
                return (
                  <linearGradient
                    key={`${gradPrefix}-iso-${d.x}`}
                    id={`${gradPrefix}-iso-${d.x}`}
                    x1={x}
                    y1={plot.yScale(d.max ?? d.value)}
                    x2={x}
                    y2={plot.yScale(d.min ?? d.value)}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={d.colorMax} />
                    <stop offset="100%" stopColor={d.colorMin} />
                  </linearGradient>
                );
              })}
          </defs>
          {mode === "envelope" &&
            connectors.gaps.map((c) => (
              <path
                key={`${c.id}-env`}
                d={c.envelope}
                fill={c.colorA}
                fillOpacity={0.06}
              />
            ))}
          {mode === "envelope" &&
            connectors.observed.map((c) => (
              <path
                key={`${c.id}-env`}
                d={c.envelope}
                fill={c.colorA}
                fillOpacity={0.14}
              />
            ))}
          {connectors.gaps.map((c) => (
            <path
              key={`${c.id}-line`}
              d={c.line}
              fill="none"
              stroke={
                c.colorA === c.colorB ? c.colorA : svgPaintUrl(`${c.id}-line`)
              }
              strokeWidth={mode === "envelope" ? 1.5 : 1.75}
              strokeOpacity={0.55}
              strokeDasharray="2 5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {connectors.observed.map((c) => (
            <path
              key={`${c.id}-line`}
              d={c.line}
              fill="none"
              stroke={
                c.colorA === c.colorB ? c.colorA : svgPaintUrl(`${c.id}-line`)
              }
              strokeWidth={mode === "envelope" ? 1.75 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {spans.map((d) => {
            const x1 = plot.xScale(new Date(d.x));
            const x2 = plot.xScale(new Date(coverageEnd(d)));
            const y = plot.yScale(d.value);
            const ink = spanInk(d, spanColor, color);
            return (
              <g key={`span-${d.x}-${d.xEnd}`}>
                {mode === "envelope" && (
                  <path
                    d={`M ${x1.toFixed(2)} ${plot
                      .yScale(d.max ?? d.value)
                      .toFixed(2)} L ${x2.toFixed(2)} ${plot
                      .yScale(d.max ?? d.value)
                      .toFixed(2)} L ${x2.toFixed(2)} ${plot
                      .yScale(d.min ?? d.value)
                      .toFixed(2)} L ${x1.toFixed(2)} ${plot
                      .yScale(d.min ?? d.value)
                      .toFixed(2)} Z`}
                    fill={ink}
                    fillOpacity={0.12}
                  />
                )}
                <line
                  x1={x1}
                  x2={x2}
                  y1={y}
                  y2={y}
                  stroke={ink}
                  strokeWidth={mode === "envelope" ? 2.25 : 2.5}
                  strokeLinecap="round"
                />
                <circle
                  cx={x1}
                  cy={y}
                  r={mode === "line" ? 3 : 2.5}
                  fill={mode === "line" ? "#fff" : ink}
                  stroke={ink}
                  strokeWidth={mode === "line" ? 2 : 0}
                />
                <circle
                  cx={x2}
                  cy={y}
                  r={mode === "line" ? 3 : 2.5}
                  fill={mode === "line" ? "#fff" : ink}
                  stroke={ink}
                  strokeWidth={mode === "line" ? 2 : 0}
                />
              </g>
            );
          })}
          {mode === "envelope" &&
            isolated.map((d) => {
              const ink = datumInk(d, color);
              // eslint-disable-next-line i18next/no-literal-string
              const gradientId = `${gradPrefix}-iso-${d.x}`;
              const useRamp = Boolean(
                d.colorMin && d.colorMax && d.colorMin !== d.colorMax
              );
              return (
                <line
                  key={`iso-${d.x}`}
                  x1={plot.xScale(new Date(pointX(d)))}
                  x2={plot.xScale(new Date(pointX(d)))}
                  y1={plot.yScale(d.max ?? d.value)}
                  y2={plot.yScale(d.min ?? d.value)}
                  stroke={useRamp ? svgPaintUrl(gradientId) : ink}
                  strokeOpacity={useRamp ? 0.45 : 0.25}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
              );
            })}
          {sorted
            .filter((d) => !isSpan(d))
            .map((d) => {
              const ink = datumInk(d, color);
              return mode === "line" ? (
                <circle
                  key={d.x}
                  cx={plot.xScale(new Date(pointX(d)))}
                  cy={plot.yScale(d.value)}
                  r={3}
                  fill="#fff"
                  stroke={ink}
                  strokeWidth={2}
                />
              ) : (
                <circle
                  key={d.x}
                  cx={plot.xScale(new Date(pointX(d)))}
                  cy={plot.yScale(d.value)}
                  r={2.5}
                  fill={ink}
                />
              );
            })}
          {hover && (
            <g pointerEvents="none">
              <line
                x1={hover.px}
                x2={hover.px}
                y1={plot.top}
                y2={plot.bottom}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={hover.px}
                cy={hover.py}
                r={4.5}
                fill={
                  isSpan(hover.datum)
                    ? spanInk(hover.datum, spanColor, color)
                    : datumInk(hover.datum, color)
                }
                stroke="#fff"
                strokeWidth={2}
              />
            </g>
          )}
          <rect
            x={plot.left}
            y={plot.top}
            width={plot.right - plot.left}
            height={plot.bottom - plot.top}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover && (
        <div
          ref={tooltipRef}
          className="absolute z-10 pointer-events-none whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg text-sm"
          style={tooltipStyle}
          role="tooltip"
        >
          <div className="font-semibold text-gray-900 text-xs pb-0.5">
            {hover.datum.formattedX ?? formatX(hover.datum.x)}
          </div>
          {tooltipRows.map(([label, value], i) => (
            <div key={i} className="flex items-center gap-2">
              {label && (
                <span className="text-gray-500 text-xs w-10">{label}</span>
              )}
              <span className="tabular-nums text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
