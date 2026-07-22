import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DATA_TABLE_ACTIVE_COLOR,
  DATA_TABLE_NO_DATA_COLOR,
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

function NoDataSymbol() {
  const size = Math.max(DATA_TABLE_NO_DATA_RADIUS * 2, 7);
  return (
    <span
      className="rounded-full border-[1.5px] flex-none"
      style={{
        width: size,
        height: size,
        borderColor: DATA_TABLE_NO_DATA_COLOR,
      }}
    />
  );
}

function ZeroSymbol() {
  const size = Math.max(DATA_TABLE_ZERO_RADIUS * 2, 8);
  return (
    <span
      className="rounded-full border flex-none"
      style={{
        width: size,
        height: size,
        borderColor: DATA_TABLE_ACTIVE_COLOR,
        backgroundColor: `rgba(37, 99, 235, ${DATA_TABLE_ZERO_FILL_OPACITY})`,
      }}
    />
  );
}

function ValueScaleBubble({ min, max }: { min: number; max: number }) {
  // Single unique positive value: one max-size bubble (matches map paint,
  // which clamps that value to the top radius stop).
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

  const displayMin = min;
  const displayMax = max;
  const displayMid = displayMin + (displayMax - displayMin) / 2;

  const stops = [
    { value: displayMax, radius: MAX_RADIUS },
    { value: displayMid, radius: MID_RADIUS },
    { value: displayMin, radius: MIN_RADIUS },
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
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth={1.5}
      />
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MIN_RADIUS}
        r={MIN_RADIUS}
        fill="none"
        stroke="rgba(255, 255, 255, 0.95)"
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

/** Placeholder nested bubbles that reserve the same footprint while loading. */
function ValueScaleSkeleton() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="block flex-none animate-pulse"
      aria-hidden
    >
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MAX_RADIUS}
        r={MAX_RADIUS}
        fill="rgb(191 219 254)"
      />
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MID_RADIUS}
        r={MID_RADIUS}
        fill="rgb(219 234 254)"
      />
      <circle
        cx={CENTER_X}
        cy={BASELINE_Y - MIN_RADIUS}
        r={MIN_RADIUS}
        fill="rgb(239 246 255)"
      />
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
      <span
        className={`text-xs leading-none truncate ${labelClassName}`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Data-table map legend with a compact, balanced layout:
 * nested bubble scale plus special-value chips.
 *
 * While `loading`, keep the scale footprint stable: show a skeleton if no
 * extents yet, or dim the previous scale so refetch doesn't jump the layout.
 * On `error`, dim any previous scale and keep special-value chips muted.
 */
export default function DataTableLegendBubble({
  min,
  max,
  hasZero = true,
  showValueScale = true,
  loading = false,
  error,
}: {
  min: number;
  max: number;
  /** Show the zero chip only when the current results actually contain 0. */
  hasZero?: boolean;
  showValueScale?: boolean;
  loading?: boolean;
  error?: string;
}) {
  const { t } = useTranslation("homepage");
  const hasError = Boolean(error);
  const showSettledScale = showValueScale && !loading && !hasError;
  const showStaleScale = Boolean(showValueScale && (loading || hasError));
  const showSkeleton = Boolean(loading && !showValueScale && !hasError);
  const muted = loading || hasError;

  return (
    <div
      className="grid grid-cols-[auto_auto] items-end justify-between gap-x-3 min-w-0"
      aria-busy={loading || undefined}
    >
      {(showSettledScale || showStaleScale || showSkeleton) && (
        <div className="flex-none">
          {showSkeleton && <ValueScaleSkeleton />}
          {showStaleScale && (
            <div className="opacity-40 transition-opacity">
              <ValueScaleBubble min={min} max={max} />
            </div>
          )}
          {showSettledScale && <ValueScaleBubble min={min} max={max} />}
        </div>
      )}
      <ul className="flex flex-col items-start gap-2.5 pb-1.5 flex-none">
        {loading && !hasError && (
          <li>
            <span className="text-xs text-gray-500 leading-none">
              {t("Loading values…")}
            </span>
          </li>
        )}
        <li className={muted ? "opacity-50" : undefined}>
          <SpecialSymbolEntry
            symbol={<NoDataSymbol />}
            label={t("No data")}
            labelClassName="text-gray-600"
          />
        </li>
        {hasZero && (!muted || showValueScale) && (
          <li className={muted ? "opacity-40" : undefined}>
            <SpecialSymbolEntry
              symbol={<ZeroSymbol />}
              label={0}
              labelClassName="font-medium tabular-nums text-gray-700"
            />
          </li>
        )}
      </ul>
    </div>
  );
}
