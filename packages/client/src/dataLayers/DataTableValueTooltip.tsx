import { useTranslation } from "react-i18next";
import { scaleLinear, scaleUtc } from "d3-scale";
import { parseTemporalIso } from "@seasketch/geostats-types";
import {
  DataTableTooltipContent,
} from "./MapContextManager";
import {
  DataTableAggregation,
  DataTableFeatureSeriesPoint,
  downsampleFeatureSeries,
  shouldShowDataTableSeriesChart,
  trimFeatureSeries,
} from "./dataTableQueryApi";
import { DATA_TABLE_ACTIVE_COLOR } from "./dataTableMapStyle";
import { formatLegendNumber } from "./legends/DataTableLegendBubble";

const SPARKLINE_WIDTH = 232;
const SPARKLINE_HEIGHT = 82;
const SPARKLINE_MAX_POINTS = 120;
const PLOT = { top: 8, right: 8, bottom: 18, left: 28 };
const Y_TICK_TARGET = 3;
const Y_TICK_MIN_GAP = 14;
const X_TICK_MIN_GAP = 8;
const X_LABEL_CHAR_WIDTH = 5.4;

function plotRect() {
  return {
    x: PLOT.left,
    y: PLOT.top,
    width: SPARKLINE_WIDTH - PLOT.left - PLOT.right,
    height: SPARKLINE_HEIGHT - PLOT.top - PLOT.bottom,
  };
}

function sparklineYDomain(values: number[]): { min: number; max: number } {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const includeZero = values.every((value) => value >= 0);
  const min = includeZero ? 0 : dataMin;
  const max = dataMax === min ? min + 1 : dataMax;
  const scale = scaleLinear().domain([min, max]);
  scale.nice(Y_TICK_TARGET);
  const [niceMin, niceMax] = scale.domain();
  return { min: niceMin, max: niceMax };
}

function estimateLabelWidth(label: string): number {
  return Math.max(8, label.length * X_LABEL_CHAR_WIDTH);
}

function xLabelBounds(
  x: number,
  label: string,
  anchor: "start" | "middle" | "end"
): { left: number; right: number } {
  const width = estimateLabelWidth(label);
  if (anchor === "start") {
    return { left: x, right: x + width };
  }
  if (anchor === "end") {
    return { left: x - width, right: x };
  }
  return { left: x - width / 2, right: x + width / 2 };
}

export function thinOverlappingXTicks<
  T extends { x: number; label: string; anchor: "start" | "middle" | "end" }
>(ticks: T[]): T[] {
  if (ticks.length <= 2) {
    return ticks;
  }
  const sorted = [...ticks].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const selected = [first];
  for (const candidate of sorted.slice(1, -1)) {
    const previous = selected[selected.length - 1];
    const prevBox = xLabelBounds(previous.x, previous.label, previous.anchor);
    const box = xLabelBounds(candidate.x, candidate.label, candidate.anchor);
    const lastBox = xLabelBounds(last.x, last.label, last.anchor);
    if (
      box.left - prevBox.right >= X_TICK_MIN_GAP &&
      lastBox.left - box.right >= X_TICK_MIN_GAP
    ) {
      selected.push(candidate);
    }
  }
  selected.push(last);
  return selected;
}

function thinOverlappingYTicks<T extends { y: number }>(ticks: T[]): T[] {
  if (ticks.length <= 2) {
    return ticks;
  }
  const sorted = [...ticks].sort((a, b) => a.y - b.y);
  const selected = [sorted[0]];
  for (const candidate of sorted.slice(1)) {
    const previous = selected[selected.length - 1];
    if (candidate.y - previous.y >= Y_TICK_MIN_GAP) {
      selected.push(candidate);
    }
  }
  const last = sorted[sorted.length - 1];
  if (selected[selected.length - 1] !== last) {
    if (last.y - selected[selected.length - 1].y >= Y_TICK_MIN_GAP) {
      selected.push(last);
    } else if (selected.length > 1) {
      selected[selected.length - 1] = last;
    }
  }
  return selected;
}

function stepTimestamp(step: string): number | null {
  const parts = parseTemporalIso(step);
  if (!parts) {
    return null;
  }
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function formatStepTick(step: string): string {
  const parts = parseTemporalIso(step);
  if (!parts) {
    return step;
  }
  const month = step.length >= 7;
  const day = step.length >= 10;
  const hour = step.length >= 13;
  if (hour) {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
      parts.day
    ).padStart(2, "0")}`;
  }
  if (day) {
    return `${parts.month}/${parts.day}/${String(parts.year).slice(2)}`;
  }
  if (month) {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }
  return String(parts.year);
}

/** Inclusive window shown under the aggregation caption in range mode. */
export function formatDataTableTooltipRange(
  steps?: string[]
): string | undefined {
  if (!steps || steps.length < 2) {
    return undefined;
  }
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (!first || !last || first === last) {
    return undefined;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return `${formatStepTick(first)} – ${formatStepTick(last)}`;
}

const DATA_TABLE_OPS: DataTableAggregation[] = [
  "mean",
  "sum",
  "count",
  "min",
  "max",
  "median",
];

function isDataTableAggregation(value: string): value is DataTableAggregation {
  return (DATA_TABLE_OPS as string[]).includes(value);
}

export function dataTableTooltipContextLabel(
  tableName?: string,
  layerTitle?: string
): string | undefined {
  const table = tableName?.trim();
  const layer = layerTitle?.trim();
  if (table) {
    return table;
  }
  return layer || undefined;
}

/** Turn join keys like `ANACAPPA_WEST_ISLE_W` into a readable title. */
export function formatDataTableSiteLabel(label?: string): string | undefined {
  if (typeof label !== "string") {
    return undefined;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/[_-]/.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function xAt(
  index: number,
  count: number,
  plot: { x: number; width: number } = plotRect()
): number {
  if (count <= 1) {
    return plot.x + plot.width / 2;
  }
  return plot.x + (index / (count - 1)) * plot.width;
}

function polylinePath(points: { x: number; y: number }[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    )
    .join(" ");
}

export function dataTableSparklineLayout(
  points: DataTableFeatureSeriesPoint[],
  currentSteps: string[] = []
): {
  plot: { x: number; y: number; width: number; height: number };
  segments: string[];
  gapSegments: string[];
  observedDots: { x: number; y: number }[];
  currentDots: { x: number; y: number }[];
  window: { x: number; width: number } | null;
  yTicks: { y: number; label: string }[];
  xTicks: {
    x: number;
    label: string;
    anchor: "start" | "middle" | "end";
  }[];
  firstStep?: string;
  lastStep?: string;
} {
  const sampled = downsampleFeatureSeries(
    trimFeatureSeries(points),
    SPARKLINE_MAX_POINTS,
    currentSteps
  );
  const plot = plotRect();
  const numeric = sampled
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  const domain = numeric.length
    ? sparklineYDomain(numeric)
    : { min: 0, max: 1 };
  const range = domain.max - domain.min || 1;
  const yAt = (value: number) =>
    plot.y + plot.height - ((value - domain.min) / range) * plot.height;

  const observed: { index: number; x: number; y: number }[] = [];
  sampled.forEach((point, index) => {
    if (point.value === null) {
      return;
    }
    observed.push({
      index,
      x: xAt(index, sampled.length, plot),
      y: yAt(point.value),
    });
  });

  const segments: string[] = [];
  const gapSegments: string[] = [];
  let run: { x: number; y: number }[] = [];
  const flushRun = () => {
    if (run.length > 1) {
      segments.push(polylinePath(run));
    }
    run = [];
  };
  observed.forEach((point, i) => {
    const previous = observed[i - 1];
    if (!previous) {
      run = [point];
      return;
    }
    if (point.index === previous.index + 1) {
      run.push(point);
      return;
    }
    flushRun();
    gapSegments.push(polylinePath([previous, point]));
    run = [point];
  });
  flushRun();

  const current = new Set(currentSteps);
  const currentDots: { x: number; y: number }[] = [];
  const windowIndexes: number[] = [];
  sampled.forEach((point, index) => {
    if (!current.has(point.step)) {
      return;
    }
    windowIndexes.push(index);
    if (point.value !== null) {
      currentDots.push({
        x: xAt(index, sampled.length, plot),
        y: yAt(point.value),
      });
    }
  });

  let window: { x: number; width: number } | null = null;
  if (windowIndexes.length > 0) {
    const left = xAt(windowIndexes[0], sampled.length, plot);
    const right = xAt(
      windowIndexes[windowIndexes.length - 1],
      sampled.length,
      plot
    );
    window = {
      x: Math.min(left, right) - 3,
      width: Math.max(Math.abs(right - left), 3) + 6,
    };
  }

  const yTickScale = scaleLinear().domain([domain.min, domain.max]);
  const yTicks = thinOverlappingYTicks(
    Array.from(new Set(yTickScale.ticks(Y_TICK_TARGET))).map((value) => ({
      y: yAt(value),
      label: formatLegendNumber(value),
    }))
  );

  const firstObserved = sampled.find((point) => point.value !== null);
  const lastObserved = [...sampled]
    .reverse()
    .find((point) => point.value !== null);

  const xTicks = pickSparklineXTicks(
    sampled.map((point) => point.step),
    plot
  );

  return {
    plot,
    segments,
    gapSegments,
    observedDots: observed.map((point) => ({ x: point.x, y: point.y })),
    currentDots,
    window,
    yTicks,
    xTicks,
    firstStep: firstObserved?.step,
    lastStep: lastObserved?.step,
  };
}

export function pickSparklineXTicks(
  steps: string[],
  plot: { x: number; width: number }
): { x: number; label: string; anchor: "start" | "middle" | "end" }[] {
  if (steps.length === 0) {
    return [];
  }
  if (steps.length === 1) {
    return [
      { x: plot.x + plot.width / 2, label: formatStepTick(steps[0]), anchor: "middle" },
    ];
  }

  const times = steps.map(stepTimestamp);
  const allTemporal = times.every((time) => time !== null);
  const target = Math.max(3, Math.min(5, Math.floor(plot.width / 48)));
  const indexes = new Set<number>([0, steps.length - 1]);

  if (allTemporal) {
    const start = times[0] as number;
    const end = times[times.length - 1] as number;
    const utc = scaleUtc()
      .domain([new Date(start), new Date(end)])
      .range([plot.x, plot.x + plot.width]);
    for (const tick of utc.ticks(target)) {
      const ms = tick.getTime();
      let nearest = 0;
      let best = Infinity;
      times.forEach((time, index) => {
        const delta = Math.abs((time as number) - ms);
        if (delta < best) {
          best = delta;
          nearest = index;
        }
      });
      indexes.add(nearest);
    }
  } else {
    const indexScale = scaleLinear().domain([0, steps.length - 1]);
    for (const tick of indexScale.ticks(target)) {
      indexes.add(Math.round(tick));
    }
  }

  const ordered = Array.from(indexes)
    .filter((index) => index >= 0 && index < steps.length)
    .sort((a, b) => a - b);
  const ticks = ordered.map((index, order) => ({
    x: xAt(index, steps.length, plot),
    label: formatStepTick(steps[index]),
    anchor:
      order === 0
        ? ("start" as const)
        : order === ordered.length - 1
        ? ("end" as const)
        : ("middle" as const),
  }));
  const unique: typeof ticks = [];
  const seen = new Set<string>();
  for (const tick of ticks) {
    if (seen.has(tick.label)) {
      continue;
    }
    seen.add(tick.label);
    unique.push(tick);
  }
  return thinOverlappingXTicks(unique);
}

export default function DataTableValueTooltip({
  content,
}: {
  content: DataTableTooltipContent;
}) {
  const { t } = useTranslation("homepage");
  const contextLabel = dataTableTooltipContextLabel(
    content.tableName,
    content.layerTitle
  );
  const siteLabel = formatDataTableSiteLabel(content.siteLabel);
  const rangeLabel =
    content.rangeLabel || formatDataTableTooltipRange(content.currentSteps);
  const showChart = shouldShowDataTableSeriesChart(content.series);
  const layout = showChart
    ? dataTableSparklineLayout(content.series || [], content.currentSteps || [])
    : null;

  const opLabel = isDataTableAggregation(content.op)
    ? {
        mean: t("Mean"),
        sum: t("Sum"),
        count: t("Count"),
        min: t("Min"),
        max: t("Max"),
        median: t("Median"),
      }[content.op]
    : content.op;

  const title =
    content.op === "count" && !content.columnLabel
      ? opLabel
      : t("{{op}} of {{column}}", {
          op: opLabel,
          column: content.columnLabel,
        });

  let valueText = content.formattedValue;
  if (content.status === "loading") {
    valueText = t("Loading…");
  } else if (content.status === "empty") {
    valueText = t("No data");
  }

  return (
    <div className="pointer-events-none w-64 text-left">
      <div>
        {siteLabel || contextLabel ? (
          <div>
            {siteLabel ? (
              <div className="text-[13px] font-medium text-gray-900 leading-snug tracking-tight break-words">
                {siteLabel}
              </div>
            ) : null}
            {contextLabel ? (
              <div
                className={
                  siteLabel
                    ? "mt-0.5 text-[11px] text-gray-400 leading-4 truncate"
                    : "text-[11px] text-gray-400 leading-4 truncate"
                }
              >
                {contextLabel}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={siteLabel || contextLabel ? "mt-3" : undefined}>
          <div
            className={
              content.status === "value"
                ? "text-2xl font-light tabular-nums tracking-tight text-gray-900 leading-none"
                : "text-sm text-gray-500 leading-5"
            }
          >
            {valueText}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 leading-snug">
            {rangeLabel
              ? t("{{title}}. {{range}}", { title, range: rangeLabel })
              : title}
          </div>
        </div>
        {content.tableDescription ? (
          <div className="mt-1.5 text-[11px] leading-4 text-gray-400 line-clamp-2">
            {content.tableDescription}
          </div>
        ) : null}
      </div>
      {layout && showChart ? (
        <div className="mt-3 pt-2.5 border-t border-gray-100">
          <svg
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
            className="block w-full h-auto"
            aria-hidden="true"
          >
            <rect
              x={layout.plot.x}
              y={layout.plot.y}
              width={layout.plot.width}
              height={layout.plot.height}
              fill="#f9fafb"
              stroke="#e5e7eb"
              strokeWidth={1}
              rx={2}
            />
            {layout.yTicks.map((tick, index) => {
              const onEdge =
                tick.y <= layout.plot.y + 1 ||
                tick.y >= layout.plot.y + layout.plot.height - 1;
              return (
                <g key={`ytick-${index}`}>
                  {onEdge ? null : (
                    <line
                      x1={layout.plot.x}
                      x2={layout.plot.x + layout.plot.width}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                    />
                  )}
                  <text
                    x={layout.plot.x - 4}
                    y={tick.y + 3}
                    textAnchor="end"
                    className="fill-gray-400"
                    fontSize={9}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}
            {layout.window ? (
              <rect
                x={layout.window.x}
                y={layout.plot.y}
                width={layout.window.width}
                height={layout.plot.height}
                fill={DATA_TABLE_ACTIVE_COLOR}
                opacity={0.1}
              />
            ) : null}
            {layout.gapSegments.map((d, index) => (
              <path
                key={`gap-${index}`}
                d={d}
                fill="none"
                stroke={DATA_TABLE_ACTIVE_COLOR}
                strokeWidth={1.25}
                strokeDasharray="2.5 2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.7}
              />
            ))}
            {layout.segments.map((d, index) => (
              <path
                key={`line-${index}`}
                d={d}
                fill="none"
                stroke={DATA_TABLE_ACTIVE_COLOR}
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {layout.observedDots.map((dot, index) => (
              <circle
                key={`obs-${index}`}
                cx={dot.x}
                cy={dot.y}
                r={1.75}
                fill={DATA_TABLE_ACTIVE_COLOR}
              />
            ))}
            {layout.currentDots.map((dot, index) => (
              <circle
                key={`current-${index}`}
                cx={dot.x}
                cy={dot.y}
                r={3.25}
                fill={DATA_TABLE_ACTIVE_COLOR}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
            {layout.xTicks.map((tick, index) => (
              <text
                key={`xtick-${index}`}
                x={tick.x}
                y={SPARKLINE_HEIGHT - 3}
                textAnchor={tick.anchor}
                className="fill-gray-400"
                fontSize={9}
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>
      ) : null}
    </div>
  );
}
