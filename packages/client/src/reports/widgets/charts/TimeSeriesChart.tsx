import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scaleLinear, scaleUtc } from "d3-scale";
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
 * X values are UTC milliseconds (TemporalInfo coverage). Point samples
 * plot at coverage start so they sit on the labeled tick (year 2015 at
 * 2015-01-01, not the midpoint of [2015, 2016)). Multi-unit coverage
 * renders as a horizontal span (markers at begin/end, solid line
 * between). Colors come from each sample when the widget binds layer
 * cartography; span and interpolated connectors are hue/lightness
 * variants of that ink.
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
const TOOLTIP_VIEWPORT_GAP = 8;
const Y_TICK_FONT_SIZE = 11;
// The top tick is vertically centered on the plot boundary. Reserve a full
// label-height gutter both above and below its baseline so the top grid line
// reads as part of the plot instead of crowding the frame.
const MARGIN = {
  top: Y_TICK_FONT_SIZE * 2.5,
  right: 8,
  bottom: 28,
  left: 4,
};
const Y_TICK_TARGET = 4;
const HOVER_RADIUS = 16;
const DEFAULT_SPAN_COLOR = timeSeriesRoleColor(
  DEFAULT_TIME_SERIES_COLOR,
  "span"
);

const MIN_X_TICK_GAP: Record<TimeSeriesTickDensity, number> = {
  less: 88,
  auto: 52,
  more: 34,
};

function defaultFormatX(x: number) {
  const d = new Date(x);
  if (!Number.isFinite(d.getTime())) return String(x);
  return String(d.getUTCFullYear());
}

function coverageEnd(d: Pick<TimeSeriesDatum, "x" | "xEnd">): number {
  return d.xEnd !== undefined && d.xEnd > d.x ? d.xEnd : d.x;
}

function isSpan(d: Pick<TimeSeriesDatum, "x" | "xEnd" | "span">): boolean {
  return Boolean(d.span && d.xEnd !== undefined && d.xEnd > d.x);
}

/**
 * Inclusive UTC ms domain for the x-axis. Point samples sit on coverage
 * start (the labeled instant). Spans extend to their exclusive end.
 */
export function timeSeriesXDomain(
  data: Array<Pick<TimeSeriesDatum, "x" | "xEnd" | "span">>
): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of data) {
    if (!Number.isFinite(d.x)) continue;
    lo = Math.min(lo, d.x);
    hi = Math.max(hi, isSpan(d) ? coverageEnd(d) : d.x);
  }
  if (!Number.isFinite(lo)) return null;
  if (!(hi > lo)) hi = lo + 1;
  return [lo, hi];
}

/** Headroom above the observed max so the series is not flush with the frame. */
export const TIME_SERIES_Y_DOMAIN_PAD = 1.25;
/** Flat percent series: 1% instead of a 0–100% unit span. */
export const TIME_SERIES_PERCENT_Y_ZERO_SPAN = 0.01;

/**
 * Y domain for result-scaled series: anchored at zero when values are
 * non-negative, then padded to `pad` times the data span. `ceil` caps
 * the padded max without clipping observed values (percent stays ≤ 1).
 * `zeroSpan` is the fallback height when every finite value is the same
 * (absolute defaults to 1; percent should pass a fraction).
 */
export function paddedTimeSeriesYDomain(
  values: readonly unknown[],
  options?: { pad?: number; ceil?: number; zeroSpan?: number }
): [number, number] | null {
  const finite: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      finite.push(value);
    }
  }
  if (finite.length === 0) {
    return null;
  }
  const pad = options?.pad ?? TIME_SERIES_Y_DOMAIN_PAD;
  const zeroSpan = options?.zeroSpan ?? 1;
  const lo = Math.min(0, ...finite);
  const hi = Math.max(...finite);
  const span = hi - lo;
  let paddedHi = span === 0 ? lo + zeroSpan : lo + span * pad;
  if (options?.ceil !== undefined) {
    paddedHi = Math.max(hi, Math.min(options.ceil, paddedHi));
  }
  if (!(paddedHi > lo)) {
    paddedHi = lo + zeroSpan;
  }
  return [lo, paddedHi];
}

/**
 * Nicely rounded y domain and the ticks the chart will render. Shared so
 * the left gutter is reserved from the same labels that get painted.
 */
export function timeSeriesYAxis(
  yDomain: [number, number] | undefined,
  values: readonly number[],
  tickTarget = Y_TICK_TARGET
): { domain: [number, number]; ticks: number[] } {
  let yLo: number;
  let yHi: number;
  if (yDomain) {
    [yLo, yHi] = yDomain;
    if (yHi === yLo) yHi = yLo + 1;
  } else {
    const padded = paddedTimeSeriesYDomain(values);
    yLo = padded?.[0] ?? 0;
    yHi = padded?.[1] ?? 1;
  }
  const scale = scaleLinear().domain([yLo, yHi]);
  scale.nice(tickTarget);
  const [d0, d1] = scale.domain() as [number, number];
  return { domain: [d0, d1], ticks: scale.ticks(tickTarget) };
}

/**
 * Fraction digits so adjacent percent-axis ticks stay distinct. Tick values
 * are fractions (0.001 = 0.1%). The narrative "< 0.1%" formatter is wrong
 * here: a 0–0.1% domain would label every positive tick the same.
 */
export function percentAxisFractionDigits(ticks: readonly number[]): number {
  let step = Infinity;
  const sorted = [...ticks].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i] - sorted[i - 1];
    if (delta > 0 && delta < step) step = delta;
  }
  if (!Number.isFinite(step) || !(step > 0)) return 0;
  const percentStep = step * 100;
  if (percentStep >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(percentStep))));
}

export function formatPercentAxisTick(
  value: number,
  ticks: readonly number[],
  locale?: string
): string {
  if (value === 0) {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  const digits = percentAxisFractionDigits(ticks);
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Left-gutter width for y-axis labels at the chart's tick font size. */
export function yAxisGutterWidth(labels: readonly string[]): number {
  let widest = 0;
  for (const label of labels) {
    if (label.length > widest) widest = label.length;
  }
  return Math.max(12, Math.min(64, widest * 6.5 + 6));
}

export type TimeSeriesTick = {
  value: number;
  position: number;
  label: string;
};

/**
 * D3 chooses meaningful temporal intervals but does not perform label
 * collision detection. Keep its candidates and remove only labels that
 * would overlap, preserving both domain endpoints when space allows.
 */
export function removeOverlappingTimeTicks(
  candidates: TimeSeriesTick[],
  minGap: number
): TimeSeriesTick[] {
  const sorted = [...candidates].sort(
    (a, b) => a.position - b.position || a.value - b.value
  );
  const unique: TimeSeriesTick[] = [];
  const labels = new Set<string>();
  for (const candidate of sorted) {
    if (!candidate.label || labels.has(candidate.label)) continue;
    labels.add(candidate.label);
    unique.push(candidate);
  }
  if (unique.length <= 1) return unique;

  const first = unique[0];
  const last = unique[unique.length - 1];
  if (last.position - first.position < minGap) return [first];

  const selected = [first];
  for (const candidate of unique.slice(1, -1)) {
    const previous = selected[selected.length - 1];
    if (
      candidate.position - previous.position >= minGap &&
      last.position - candidate.position >= minGap
    ) {
      selected.push(candidate);
    }
  }
  selected.push(last);
  return selected;
}

function visualEnd(d: TimeSeriesDatum): number {
  return isSpan(d) ? coverageEnd(d) : d.x;
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
  topInset = MARGIN.top,
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
   * Y domain override (raster value domain, etc). When omitted the axis
   * nices to the plotted results, anchored at zero when values are
   * non-negative, with 1.25× headroom above the max.
   */
  yDomain?: [number, number];
  xTickDensity?: TimeSeriesTickDensity;
  valueLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  /** Plot inset above the top y-axis tick. */
  topInset?: number;
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
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

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
      setTooltipSize({
        width: tooltipRef.current.offsetWidth,
        height: tooltipRef.current.offsetHeight,
      });
    }
  }, [hoverX]);

  const sorted = useMemo(
    () =>
      [...data]
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.value))
        .sort((a, b) => a.x - b.x || coverageEnd(a) - coverageEnd(b)),
    [data]
  );

  const yAxis = useMemo(() => {
    const values = sorted.flatMap((d) =>
      mode === "envelope"
        ? [d.value, d.min ?? d.value, d.max ?? d.value]
        : [d.value]
    );
    return timeSeriesYAxis(yDomain, values);
  }, [sorted, yDomain, mode]);

  const yAxisWidth = useMemo(
    () => yAxisGutterWidth(yAxis.ticks.map(formatValue)),
    [yAxis.ticks, formatValue]
  );

  const plot = useMemo(() => {
    if (sorted.length === 0 || width === 0) return null;

    const domain = timeSeriesXDomain(sorted);
    if (!domain) return null;

    const left = MARGIN.left + yAxisWidth;
    const right = width - MARGIN.right;
    const top = topInset;
    const bottom = height - MARGIN.bottom;
    if (right - left < 40) return null;

    const minTickGap =
      MIN_X_TICK_GAP[xTickDensity] ?? MIN_X_TICK_GAP.auto;
    const tickCount = Math.max(
      2,
      Math.floor((right - left) / minTickGap)
    );
    const xScale = scaleUtc()
      .domain([new Date(domain[0]), new Date(domain[1])])
      .range([left, right]);

    const yScale = scaleLinear()
      .domain(yAxis.domain)
      .range([bottom, top]);

    const rawTicks = xScale.ticks(tickCount).map((d) => d.getTime());
    const xTickMarks = Array.from(
      new Set([domain[0], ...rawTicks, domain[1]])
    );
    const xTicks = removeOverlappingTimeTicks(
      xTickMarks.map((value) => ({
        value,
        position: xScale(value),
        label: formatX(value),
      })),
      minTickGap
    );

    return {
      xScale,
      yScale,
      xTicks,
      xTickMarks,
      yTicks: yAxis.ticks,
      left,
      right,
      top,
      bottom,
    };
  }, [
    sorted,
    width,
    height,
    yAxis,
    yAxisWidth,
    xTickDensity,
    formatX,
    topInset,
  ]);

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
          const x1 = plot.xScale(d.x);
          const x2 = plot.xScale(coverageEnd(d));
          const dist = distToSegment(mx, my, x1, py, x2, py);
          if (dist < best) {
            best = dist;
            nearest = d;
            hoverPx = Math.max(x1, Math.min(x2, mx));
          }
        } else {
          const px = plot.xScale(d.x);
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
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return undefined;
        const halfTip = tooltipSize.width / 2;
        const anchorX = bounds.left + hover.px;
        const anchorY = bounds.top + hover.py;
        const left = Math.min(
          Math.max(anchorX, TOOLTIP_VIEWPORT_GAP + halfTip),
          Math.max(
            window.innerWidth - TOOLTIP_VIEWPORT_GAP - halfTip,
            TOOLTIP_VIEWPORT_GAP + halfTip
          )
        );
        const flipBelow =
          anchorY - tooltipSize.height - TOOLTIP_GAP < TOOLTIP_VIEWPORT_GAP;
        return {
          left,
          top: flipBelow ? anchorY + TOOLTIP_GAP : anchorY - TOOLTIP_GAP,
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
      const x1 = plot.xScale(visualEnd(a));
      const x2 = plot.xScale(b.x);
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
      className={
        className
          ? `relative w-full overflow-x-hidden ${className}`
          : "relative w-full overflow-x-hidden"
      }
      style={{ height }}
    >
      {plot && (
        <svg
          width={width}
          height={height}
          role="img"
          overflow="visible"
        >
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
                  fontSize={Y_TICK_FONT_SIZE}
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
          {plot.xTickMarks.map((tick) => (
            <line
              key={`x-mark-${tick}`}
              x1={plot.xScale(tick)}
              x2={plot.xScale(tick)}
              y1={plot.bottom}
              y2={plot.bottom + 4}
              stroke="#9ca3af"
              strokeWidth={1}
            />
          ))}
          {plot.xTicks.map((tick, index) => (
            <text
              key={`x-${tick.value}`}
              x={tick.position}
              y={plot.bottom + 16}
              textAnchor={
                index === 0
                  ? "start"
                  : index === plot.xTicks.length - 1
                    ? "end"
                    : "middle"
              }
              fontSize={11}
              fill="#6b7280"
            >
              {tick.label}
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
                const x = plot.xScale(d.x);
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
            const x1 = plot.xScale(d.x);
            const x2 = plot.xScale(coverageEnd(d));
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
                  x1={plot.xScale(d.x)}
                  x2={plot.xScale(d.x)}
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
                  cx={plot.xScale(d.x)}
                  cy={plot.yScale(d.value)}
                  r={3}
                  fill="#fff"
                  stroke={ink}
                  strokeWidth={2}
                />
              ) : (
                <circle
                  key={d.x}
                  cx={plot.xScale(d.x)}
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
      {hover &&
        tooltipStyle &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[100] pointer-events-none rounded-md border border-gray-200 bg-white px-3 py-1.5 shadow-lg text-sm"
            style={tooltipStyle}
            role="tooltip"
          >
            <div className="font-semibold text-gray-900 text-xs pb-0.5">
              {hover.datum.formattedX ?? formatX(hover.datum.x)}
            </div>
            {tooltipRows.map(([label, value], i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-4 whitespace-nowrap"
              >
                {label && (
                  <span className="text-gray-500 text-xs">{label}</span>
                )}
                <span className="tabular-nums text-gray-900">{value}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
