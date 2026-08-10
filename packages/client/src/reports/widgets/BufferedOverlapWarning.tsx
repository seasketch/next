import { useContext } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import { ReportUIStateContext } from "../context/ReportUIStateContext";

const WARNING_THRESHOLD = 0.1; // 10%

/**
 * Amber accuracy warning for buffered `overlay_area` results with residual
 * double-counting uncertainty.
 *
 * Renders nothing when:
 * - `overcountMax === overcountMin` (exact correction — silence guarantee), or
 * - residual uncertainty is below 10% of `total`.
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
}: {
  /** Minimum overcount relative to the naive sum (km²). */
  overcountMin: number;
  /** Maximum overcount relative to the naive sum (km²). */
  overcountMax: number;
  /** Naive (or displayed) class total used for the percentage. */
  total: number;
  /** Formats an absolute area for the low–high range. */
  formatArea: (sqKm: number) => string;
  className?: string;
}) {
  const { t } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);

  if (
    !Number.isFinite(overcountMax) ||
    !Number.isFinite(total) ||
    total <= 0 ||
    overcountMax <= overcountMin ||
    overcountMax / total < WARNING_THRESHOLD
  ) {
    return null;
  }

  const pct = Math.ceil((overcountMax / total) * 100);
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
  return (
    Number.isFinite(overcountMax) &&
    Number.isFinite(total) &&
    total > 0 &&
    overcountMax > overcountMin &&
    overcountMax / total >= WARNING_THRESHOLD
  );
}
