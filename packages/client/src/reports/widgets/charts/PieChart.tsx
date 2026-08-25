/**
 * Presentational SVG pie chart used by ClassCompositionChart. Pure component:
 * all labels/formatting are provided by the caller so no i18n is needed here.
 */

export type CompositionChartDatum = {
  key: string;
  label: string;
  color: string;
  /** Share of the composition, 0–1. Slices with fraction <= 0 are skipped. */
  fraction: number;
  /** Pre-formatted percent (e.g. "46%") shown in slice labels and tooltips. */
  formattedPercent: string;
  /** Optional pre-formatted value appended to hover tooltips (e.g. "12 km²"). */
  formattedValue?: string;
};

const VIEWBOX = 200;
const CENTER = VIEWBOX / 2;
const RADIUS = 96;
const LABEL_RADIUS = RADIUS * 0.62;

function pointOnCircle(angle: number, radius: number): [number, number] {
  return [
    CENTER + radius * Math.cos(angle),
    CENTER + radius * Math.sin(angle),
  ];
}

function sliceTitle(d: CompositionChartDatum) {
  return d.formattedValue
    ? `${d.label}: ${d.formattedPercent} (${d.formattedValue})`
    : `${d.label}: ${d.formattedPercent}`;
}

export function PieChart({
  data,
  size = 160,
  minLabelFraction = 0.08,
  className,
}: {
  data: CompositionChartDatum[];
  /** Rendered width/height in px. */
  size?: number;
  /** Slices smaller than this fraction get no in-slice percent label. */
  minLabelFraction?: number;
  className?: string;
}) {
  const slices = data.filter((d) => d.fraction > 0);

  // A single (near-)full slice degenerates as an arc path; draw a circle.
  if (slices.length === 1 && slices[0].fraction > 0.999) {
    const d = slices[0];
    return (
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        role="img"
        className={className}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={d.color}>
          <title>{sliceTitle(d)}</title>
        </circle>
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontWeight={600}
          fill="#fff"
          style={{ paintOrder: "stroke" }}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth={2}
        >
          {d.formattedPercent}
        </text>
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const rendered = slices.map((d) => {
    const start = angle;
    const sweep = d.fraction * Math.PI * 2;
    const end = start + sweep;
    angle = end;
    const [x1, y1] = pointOnCircle(start, RADIUS);
    const [x2, y2] = pointOnCircle(end, RADIUS);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const mid = start + sweep / 2;
    const [lx, ly] = pointOnCircle(mid, LABEL_RADIUS);
    const path = [
      `M ${CENTER} ${CENTER}`,
      `L ${x1.toFixed(3)} ${y1.toFixed(3)}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(
        3
      )}`,
      "Z",
    ].join(" ");
    return { d, path, lx, ly };
  });

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      role="img"
      className={className}
    >
      {rendered.map(({ d, path }) => (
        <path
          key={d.key}
          d={path}
          fill={d.color}
          stroke="#fff"
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <title>{sliceTitle(d)}</title>
        </path>
      ))}
      {rendered
        .filter(({ d }) => d.fraction >= minLabelFraction)
        .map(({ d, lx, ly }) => (
          <text
            key={`label-${d.key}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight={600}
            fill="#fff"
            style={{ paintOrder: "stroke", pointerEvents: "none" }}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={2}
          >
            {d.formattedPercent}
          </text>
        ))}
    </svg>
  );
}
