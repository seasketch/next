import { useContext } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import { ReportUIStateContext } from "../context/ReportUIStateContext";

const WARNING_THRESHOLD = 0.1; // 10% of naive total

/**
 * Residual uncertainty after the displayed correction
 * (`naiveSum − overcountMin`). Exact corrections have residual 0.
 */
export function bufferedOverlapResidual(
  overcountMin: number,
  overcountMax: number
): number {
  if (
    !Number.isFinite(overcountMin) ||
    !Number.isFinite(overcountMax) ||
    overcountMax <= overcountMin
  ) {
    return 0;
  }
  return overcountMax - overcountMin;
}

/**
 * Amber accuracy warning for buffered `overlay_area` results with residual
 * double-counting uncertainty.
 *
 * Renders nothing when:
 * - `overcountMax === overcountMin` (exact correction — silence guarantee), or
 * - residual (`overcountMax − overcountMin`) is below 10% of `total` (naive sum).
 *
 * On screen: icon + tooltip with magnitude and range.
 * When printing: icon + visible "≤N%" label (tooltips are not available).
 *
 * Same visual language as {@link ColumnStatsWarning}.
 *
 * @see OverlayAreaOverlapInfo in overlay-engine for the full double-counting model.
 */
export default function BufferedOverlapWarning({
  overcountMin,
  overcountMax,
  total,
  formatArea,
  className,
  overcountEstimate,
}: {
  /** Minimum overcount relative to the naive sum (km²). */
  overcountMin: number;
  /** Maximum overcount relative to the naive sum (km²). */
  overcountMax: number;
  /** Naive class total used as the percentage denominator. */
  total: number;
  /** Formats an absolute area for the low–high range. */
  formatArea: (sqKm: number) => string;
  className?: string;
  /**
   * When set (raster_overlay_area), the warning gate uses
   * `overcountEstimate / total` instead of residual hardMax uncertainty.
   * The displayed numeric range still uses overcountMin/Max.
   */
  overcountEstimate?: number;
}) {
  const { t } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);

  const residual = bufferedOverlapResidual(overcountMin, overcountMax);
  const gateMagnitude =
    typeof overcountEstimate === "number" && Number.isFinite(overcountEstimate)
      ? overcountEstimate
      : residual;

  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    gateMagnitude <= 0 ||
    gateMagnitude / total < WARNING_THRESHOLD
  ) {
    return null;
  }

  // "up to N%" must match the low end of the displayed range
  // (total − overcountMax), so it is always derived from the hard residual —
  // the estimate only decides whether the warning shows at all.
  const pct = Math.ceil((residual / total) * 100);
  const low = Math.max(0, total - overcountMax);
  const high = Math.max(0, total - overcountMin);

  if (printing) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-amber-700 text-xs tabular-nums whitespace-nowrap align-middle ${
          className || ""
        }`}
        aria-label={t("May be overestimated by up to {{pct}}%", { pct })}
      >
        <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
        <span>
          <Trans
            ns="reports"
            i18nKey="bufferedOverlapPrintPct"
            defaults="≤{{pct}}%"
            values={{ pct }}
          />
        </span>
      </span>
    );
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={t("Buffered area accuracy warning")}
            className={`inline-flex items-center text-amber-500 hover:text-amber-600 focus:outline-none align-middle ${
              className || ""
            }`}
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={4} className="z-50">
            <div className="text-xs bg-white border border-gray-200 shadow-lg rounded-md px-3 py-2 max-w-xs">
              <p className="text-gray-700 leading-snug">
                <Trans
                  ns="reports"
                  i18nKey="bufferedOverlapMayOverestimate"
                  defaults="May be overestimated by up to {{pct}}% due to overlapping buffer zones. Actual area is between {{low}} and {{high}}."
                  values={{
                    pct,
                    low: formatArea(low),
                    high: formatArea(high),
                  }}
                />
              </p>
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * True when residual buffered-overlap uncertainty warrants a UI warning.
 * Mirrors the render gate of {@link BufferedOverlapWarning}.
 */
export function bufferedOverlapWarrantsWarning(
  overcountMin: number,
  overcountMax: number,
  total: number
): boolean {
  const residual = bufferedOverlapResidual(overcountMin, overcountMax);
  return (
    Number.isFinite(total) &&
    total > 0 &&
    residual > 0 &&
    residual / total >= WARNING_THRESHOLD
  );
}
