import * as Tooltip from "@radix-ui/react-tooltip";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import {
  NumberColumnValueStats,
  StringOrBooleanColumnValueStats,
} from "overlay-engine";

type ColumnStats = NumberColumnValueStats | StringOrBooleanColumnValueStats;

// Statistics weighted by feature overlap size (area/length). When buffered
// analysis regions overlap, summed weights may overstate the true overlap,
// affecting only these. Whole-feature stats (count, sum, min, max, distinct
// values, presence) remain exact.
const WEIGHT_SENSITIVE_STATS = ["mean", "stdDev", "histogram"];

// Statistics affected when per-feature entries were truncated and stats had
// to be combined approximately, potentially double-counting features that
// span multiple fragments. Only whole-feature statistics are affected:
// count, sum, and per-value counts (histogram / distinctValues). min/max
// (and presence, derived from max) combine exactly regardless. mean and
// stdDev are also unaffected: the approximate merge weights them by each
// fragment's totalWeight, and since weighted mean is linear in
// (value, weight) pairs, splitting a feature's weight across disjoint
// fragments yields an identical result to entry-based deduplication.
const TRUNCATION_SENSITIVE_STATS = [
  "count",
  "countDistinct",
  "sum",
  "histogram",
  "distinctValues",
];

function truncationWarrantsWarning(
  stats: ColumnStats,
  displayedStats: string[]
): boolean {
  // truncationAffectedMerge is only set when stats from multiple fragments
  // were actually combined approximately due to truncated entries. A single
  // fragment's stats are exact even when its entries were truncated, so the
  // entriesTruncated marker alone does not warrant a warning.
  return (
    stats.truncationAffectedMerge === true &&
    displayedStats.some((s) => TRUNCATION_SENSITIVE_STATS.includes(s))
  );
}

function overlapWarrantsWarning(
  stats: ColumnStats,
  displayedStats: string[],
  buffered: boolean
): boolean {
  // Unbuffered fragments are disjoint, so a subdivided part seen by two
  // fragments (shared offset) still contributes exact, non-overlapping
  // weights. Only buffered analysis regions can truly overlap.
  return (
    buffered &&
    "weightsMayOverlap" in stats &&
    stats.weightsMayOverlap === true &&
    displayedStats.some((s) => WEIGHT_SENSITIVE_STATS.includes(s))
  );
}

/**
 * Returns true if the given combined column stats carry accuracy caveats
 * affecting any of the statistics being displayed.
 */
export function columnStatsHaveWarnings(
  stats: ColumnStats | null | undefined,
  displayedStats: string[],
  buffered: boolean
): boolean {
  if (!stats) {
    return false;
  }
  return (
    truncationWarrantsWarning(stats, displayedStats) ||
    overlapWarrantsWarning(stats, displayedStats, buffered)
  );
}

/**
 * Warning indicator for column statistics widgets. Renders an amber warning
 * icon with an explanatory tooltip when the combined stats carry accuracy
 * caveats (combined approximately due to truncated entries, or combined from
 * overlapping buffered analysis regions) that affect one of the statistics
 * being displayed. Renders nothing when the displayed statistics are
 * unaffected.
 */
export default function ColumnStatsWarning({
  stats,
  displayedStats,
  buffered,
  className,
}: {
  stats: ColumnStats | null | undefined;
  /** Stat keys the widget is currently showing (e.g. "mean", "histogram"). */
  displayedStats: string[];
  /**
   * Whether the underlying column_values dependency uses a distance buffer
   * (bufferDistanceKm). Only buffered analysis regions can overlap, so the
   * weightsMayOverlap warning is suppressed when false.
   */
  buffered: boolean;
  className?: string;
}) {
  const { t } = useTranslation("reports");
  if (!stats || !columnStatsHaveWarnings(stats, displayedStats, buffered)) {
    return null;
  }
  const entriesTruncated = truncationWarrantsWarning(stats, displayedStats);
  const weightsMayOverlap = overlapWarrantsWarning(
    stats,
    displayedStats,
    buffered
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={t("Statistics accuracy warning")}
            className={`inline-flex items-center text-amber-500 hover:text-amber-600 focus:outline-none align-middle ${
              className || ""
            }`}
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={4} className="z-50">
            <div className="text-xs bg-white border border-gray-200 shadow-lg rounded-md px-3 py-2 max-w-xs space-y-2">
              {entriesTruncated && (
                <p className="text-gray-700 leading-snug">
                  {t(
                    "Too many overlapping features to track individually. Statistics combined from multiple parts of the analysis area may count features that cross those boundaries more than once."
                  )}
                </p>
              )}
              {weightsMayOverlap && (
                <p className="text-gray-700 leading-snug">
                  {t(
                    "Buffered analysis areas overlap. Whole-feature statistics such as count and sum remain exact, but size-weighted statistics such as mean may be slightly overstated."
                  )}
                </p>
              )}
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * True when any column_values dependency uses a distance buffer, meaning its
 * analysis regions may genuinely overlap across fragments.
 */
export function hasBufferedColumnValuesDependency(
  dependencies: {
    type: string;
    parameters?: { bufferDistanceKm?: number | null } | null;
  }[]
): boolean {
  return dependencies.some(
    (d) =>
      d.type === "column_values" &&
      typeof d.parameters?.bufferDistanceKm === "number" &&
      d.parameters.bufferDistanceKm > 0
  );
}
