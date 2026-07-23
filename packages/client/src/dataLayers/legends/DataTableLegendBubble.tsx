import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DATA_TABLE_ACTIVE_COLOR,
  DATA_TABLE_NO_DATA_COLOR,
  DATA_TABLE_NO_DATA_FILL_OPACITY,
  DATA_TABLE_NO_DATA_RADIUS,
  DATA_TABLE_ZERO_FILL_OPACITY,
  DATA_TABLE_ZERO_RADIUS,
} from "../dataTableMapStyle";

function formatLegendNumber(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}

const MAX_RADIUS = 32;
const MID_RADIUS = 19;
const MIN_RADIUS = 10;
const FILL = "rgba(37, 99, 235, 0.92)";
const RING_STROKE = "rgba(255, 255, 255, 0.95)";
const EMPTY_FILL = "rgba(156, 163, 175, 0.45)";
const EMPTY_RING_STROKE = "rgba(255, 255, 255, 0.9)";

const WIDTH = MAX_RADIUS * 2 + 12;
const HEIGHT = MAX_RADIUS * 2 + 16;
const CENTER_X = WIDTH / 2;
const BASELINE_Y = HEIGHT - 8;

function labelFontSize(text: string, radius: number) {
  if (radius <= MIN_RADIUS && text.length > 4) {
    return 8;
  }
  if (radius <= MID_RADIUS && text.length > 5) {
    return 9;
  }
  return 11;
}

/** Grey outline + light grey fill, matching map no-data symbology. */
function NoDataSymbol() {
  const size = Math.max(DATA_TABLE_NO_DATA_RADIUS * 2, 7);
  return (
    <span
      className="rounded-full border-[1.5px] flex-none"
      style={{
        width: size,
        height: size,
        borderColor: DATA_TABLE_NO_DATA_COLOR,
        backgroundColor: `rgba(156, 163, 175, ${DATA_TABLE_NO_DATA_FILL_OPACITY})`,
      }}
    />
  );
}

/** Same footprint and outline as no-data, in active blue. Matches map paint. */
function ZeroSymbol() {
  const size = Math.max(DATA_TABLE_ZERO_RADIUS * 2, 7);
  return (
    <span
      className="rounded-full border-[1.5px] flex-none"
      style={{
        width: size,
        height: size,
        borderColor: DATA_TABLE_ACTIVE_COLOR,
        backgroundColor: `rgba(37, 99, 235, ${DATA_TABLE_ZERO_FILL_OPACITY})`,
      }}
    />
  );
}

/**
 * Nested bubble scale in a fixed WIDTH×HEIGHT footprint.
 *
 * `active` renders blue bubbles with value labels; otherwise a grey,
 * label-free version keeps the exact same geometry (optionally pulsing
 * while the first query loads) so state changes never shift layout.
 */
function ValueScaleBubble({
  min,
  max,
  active,
  pulse = false,
}: {
  min: number;
  max: number;
  active: boolean;
  pulse?: boolean;
}) {
  if (!active) {
    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className={`block flex-none ${pulse ? "animate-pulse" : ""}`}
        aria-hidden
      >
        <circle
          cx={CENTER_X}
          cy={BASELINE_Y - MAX_RADIUS}
          r={MAX_RADIUS}
          fill={EMPTY_FILL}
        />
        <circle
          cx={CENTER_X}
          cy={BASELINE_Y - MID_RADIUS}
          r={MID_RADIUS}
          fill="none"
          stroke={EMPTY_RING_STROKE}
          strokeWidth={1.5}
        />
        <circle
          cx={CENTER_X}
          cy={BASELINE_Y - MIN_RADIUS}
          r={MIN_RADIUS}
          fill="none"
          stroke={EMPTY_RING_STROKE}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  // Single unique positive value: one max-size bubble (matches map paint,
  // which renders that value at the top radius stop).
  if (!(max > min)) {
    const label = formatLegendNumber(max);
    const labelY = BASELINE_Y - MAX_RADIUS;
    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="block flex-none"
        aria-hidden
      >
        <circle
          cx={CENTER_X}
          cy={BASELINE_Y - MAX_RADIUS}
          r={MAX_RADIUS}
          fill={FILL}
        />
        <text
          x={CENTER_X}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={labelFontSize(label, MAX_RADIUS)}
          fontWeight={600}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {label}
        </text>
      </svg>
    );
  }

  const displayMid = min + (max - min) / 2;
  const stops = [
    { value: max, radius: MAX_RADIUS },
    { value: displayMid, radius: MID_RADIUS },
    { value: min, radius: MIN_RADIUS },
  ];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="block flex-none"
      aria-hidden
    >
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MAX_RADIUS}
        r={MAX_RADIUS}
        fill={FILL}
      />
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MID_RADIUS}
        r={MID_RADIUS}
        fill="none"
        stroke={RING_STROKE}
        strokeWidth={1.5}
      />
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MIN_RADIUS}
        r={MIN_RADIUS}
        fill="none"
        stroke={RING_STROKE}
        strokeWidth={1.5}
      />
      {stops.map((stop) => {
        const centerY = BASELINE_Y - stop.radius;
        const label = formatLegendNumber(stop.value);
        const labelY = centerY - stop.radius + 11;
        return (
          <text
            key={stop.radius}
            x={CENTER_X}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={labelFontSize(label, stop.radius)}
            fontWeight={600}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function SpecialSymbolEntry({
  symbol,
  label,
  labelClassName = "text-gray-700",
}: {
  symbol: ReactNode;
  label: ReactNode;
  labelClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {symbol}
      <span className={`text-xs leading-none truncate ${labelClassName}`}>
        {label}
      </span>
    </span>
  );
}

/**
 * Data-table map legend: nested bubble scale on the left, zero-value and
 * no-data symbols stacked to the right.
 *
 * All three symbols are always rendered in a fixed footprint so loading,
 * errors, or new extents change content (colors, labels, dimming) but never
 * shift layout:
 * - data settled → blue scale with numbers
 * - refetch with previous extents → same scale, dimmed
 * - first load / no data → grey scale, no numbers (pulsing while loading)
 * - a reserved status line shows "Loading values…" without inserting rows
 */
export default function DataTableLegendBubble({
  min,
  max,
  showValueScale = true,
  loading = false,
  error,
}: {
  min: number;
  max: number;
  /** Retained for API compatibility; all symbols are always shown. */
  hasZero?: boolean;
  /** True when there are real positive extents to label the scale with. */
  showValueScale?: boolean;
  loading?: boolean;
  error?: string;
}) {
  const { t } = useTranslation("homepage");
  const hasError = Boolean(error);
  const hasScale = showValueScale && max > 0;
  const muted = loading || hasError;

  return (
    <div className="min-w-0" aria-busy={loading || undefined}>
      <div className="flex items-end gap-4">
        <div
          className={`flex-none transition-opacity duration-300 ${
            muted && hasScale ? "opacity-40" : "opacity-100"
          }`}
        >
          <ValueScaleBubble
            min={min}
            max={max}
            active={hasScale}
            pulse={loading && !hasScale && !hasError}
          />
        </div>
        <ul
          className={`flex flex-col items-start gap-2.5 pb-1.5 flex-1 min-w-0 transition-opacity duration-300 ${
            muted ? "opacity-50" : "opacity-100"
          }`}
        >
          <li>
            <SpecialSymbolEntry
              symbol={<ZeroSymbol />}
              label={0}
              labelClassName="font-medium tabular-nums text-gray-700"
            />
          </li>
          <li>
            <SpecialSymbolEntry
              symbol={<NoDataSymbol />}
              label={t("No data")}
              labelClassName="text-gray-600"
            />
          </li>
        </ul>
      </div>
      {/* Reserved line: fades in/out without inserting or removing rows. */}
      <div className="h-4 mt-0.5">
        <span
          className={`text-xs text-gray-500 leading-none transition-opacity duration-300 ${
            loading && !hasError ? "opacity-100" : "opacity-0"
          }`}
        >
          {t("Loading values…")}
        </span>
      </div>
    </div>
  );
}
