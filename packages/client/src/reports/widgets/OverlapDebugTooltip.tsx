import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { ClassTableRow } from "./ClassTableRows";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../generated/graphql";

export type OverlapDebugTooltipRow = ClassTableRow & {
  overlap: number;
  geographyTotal?: number;
};

type OverlapDebugTooltipProps = {
  row: OverlapDebugTooltipRow;
  percent: number;
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  primaryGeographyId: number;
  formatters: ReturnType<typeof useNumberFormatters>;
  /** When set, percent > 100% is explained as a buffered-numerator effect. */
  bufferKm?: number;
  classLabel?: string;
};

export function OverlapDebugTooltip({
  row,
  percent,
  metrics,
  sources,
  primaryGeographyId,
  formatters,
  bufferKm,
  classLabel,
}: OverlapDebugTooltipProps) {
  const { t } = useTranslation("reports");
  const source = sources.find((s) => s.stableId === row.sourceId);

  const fragmentMetrics = useMemo(
    () =>
      !source
        ? []
        : metrics.filter(
            (m) =>
              m.sourceUrl === source.sourceUrl &&
              subjectIsFragment(m.subject) &&
              (m.subject as { geographies: number[] }).geographies.includes(
                primaryGeographyId,
              ),
          ),
    [metrics, source, primaryGeographyId],
  );

  const geographyMetric = useMemo(
    () =>
      !source
        ? undefined
        : metrics.find(
            (m) =>
              m.sourceUrl === source.sourceUrl &&
              subjectIsGeography(m.subject) &&
              (m.subject as { id: number }).id === primaryGeographyId,
          ),
    [metrics, source, primaryGeographyId],
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-gray-400 hover:text-gray-600 focus:outline-none align-middle"
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={4} className="z-50">
            <div className="text-xs bg-white border border-gray-200 shadow-lg rounded-md px-3 py-2 max-w-sm space-y-2">
              <p className="text-gray-700 leading-snug">
                {typeof bufferKm === "number" && bufferKm > 0
                  ? t(
                      "This sketch's {{buffer}} buffer reaches {{class}} area beyond the sketch itself, so the percentage can exceed 100%.",
                      {
                        buffer: t("{{km}} km", { km: bufferKm }),
                        class: classLabel || row.label,
                      },
                    )
                  : t(
                      "The percent within exceeds 100% because the overlap area is larger than the geography total. This can happen when sketch geometries extend beyond the geography boundary.",
                    )}
              </p>
              <table className="w-full border-t border-gray-200">
                <tbody>
                  <tr>
                    <td className="pr-4 py-0.5 text-gray-500">{t("Overlap")}</td>
                    <td className="text-right font-mono text-gray-900">
                      {formatters.area(row.overlap)}
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-0.5 text-gray-500">
                      {t("Geography total")}
                    </td>
                    <td className="text-right font-mono text-gray-900">
                      {formatters.area(row.geographyTotal!)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="pr-4 py-0.5 text-gray-500">
                      {t("Percent within")}
                    </td>
                    <td className="text-right font-mono text-gray-900">
                      {formatters.percent(percent)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {geographyMetric && (
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-gray-500 font-semibold mb-1">
                    {t("Geography metric (id={{id}})", {
                      id: geographyMetric.id,
                    })}
                  </p>
                  <pre className="text-[10px] whitespace-pre-wrap break-all text-gray-900 font-mono">
                    {JSON.stringify(
                      (geographyMetric.value as Record<string, unknown>)?.[
                        row.groupByKey
                      ] ?? geographyMetric.value,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
              {fragmentMetrics.length > 0 && (
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-gray-500 font-semibold mb-1">
                    {t("Fragment metrics ({{count}})", {
                      count: fragmentMetrics.length,
                    })}
                  </p>
                  {fragmentMetrics.map((m) => (
                    <div key={m.id} className="mb-2">
                      <p className="text-gray-400 text-[10px] mb-0.5">
                        {t("id={{id}} hash={{hash}}…", {
                          id: m.id,
                          hash: subjectIsFragment(m.subject)
                            ? (m.subject as { hash: string }).hash.slice(0, 8)
                            : "",
                        })}
                      </p>
                      <pre className="text-[10px] whitespace-pre-wrap break-all text-gray-900 font-mono">
                        {JSON.stringify(
                          (m.value as Record<string, unknown>)?.[
                            row.groupByKey
                          ] ?? m.value,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
