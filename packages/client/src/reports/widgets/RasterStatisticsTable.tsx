import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RasterStats,
  MetricDependency,
  Metric,
  combineMetricsForFragments,
  subjectIsFragment,
} from "overlay-engine";
import { ReportWidget, TableHeadingsEditor } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { useReportContext } from "../ReportContext";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { NumberRoundingControl } from "./NumberRoundingControl";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { TooltipBooleanConfigurationOption } from "./widgets";
import { UnitSelector } from "./UnitSelector";
import {
  getLocalizedUnitLabel,
  isAreaUnit,
  isLengthUnit,
  LengthUnit,
} from "../utils/units";
import { FormLanguageContext } from "../../formElements/FormElement";

type RasterStatKey =
  | "count"
  | "min"
  | "max"
  | "mean"
  | "sum"
  | "invalid";

type RasterStatisticsTableSettings = {
  displayStats?: Partial<Record<RasterStatKey, boolean>>;
  minimumFractionDigits?: number;
  statLabel?: string;
  valueLabel?: string;
  countLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  meanLabel?: string;
  sumLabel?: string;
  invalidLabel?: string;
  unit?: LengthUnit;
  unitDisplay?: "short" | "long";
};

const statOrder: RasterStatKey[] = [
  "count",
  "min",
  "max",
  "mean",
  "sum",
  "invalid",
];

const statLabels = (
  t: (key: string, opts?: Record<string, any>) => string,
  settings?: RasterStatisticsTableSettings
): Record<RasterStatKey, string> => ({
  count: settings?.countLabel || t("Count"),
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  sum: settings?.sumLabel || t("Sum"),
  invalid: settings?.invalidLabel || t("Invalid Cells"),
});

const emptyStats: RasterStats["value"]["bands"][number] = {
  count: 0,
  min: NaN,
  max: NaN,
  mean: NaN,
  median: NaN,
  range: NaN,
  histogram: [],
  invalid: 0,
  sum: 0,
};

export const RasterStatisticsTable: ReportWidget<
  RasterStatisticsTableSettings
> = ({ metrics, componentSettings, loading }) => {
  const { t } = useTranslation("reports");
  const langContext = useContext(FormLanguageContext);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings?.minimumFractionDigits,
  });

  const unitLabel = useMemo(() => {
    const unit = componentSettings?.unit;
    if (!unit || (!isAreaUnit(unit) && !isLengthUnit(unit))) {
      return null;
    }
    const locale = langContext?.lang?.code?.toLowerCase() || "en";
    return getLocalizedUnitLabel(
      unit,
      locale,
      isAreaUnit(unit),
      componentSettings?.unitDisplay || "short"
    );
  }, [
    componentSettings?.unit,
    componentSettings?.unitDisplay,
    langContext?.lang?.code,
  ]);

  const resolvedDisplayStats = useMemo(() => {
    const defaults: Partial<Record<RasterStatKey, boolean>> = {
      mean: true,
    };
    return componentSettings?.displayStats || defaults;
  }, [componentSettings?.displayStats]);

  const statsToShow = useMemo(
    () => statOrder.filter((stat) => resolvedDisplayStats[stat]),
    [resolvedDisplayStats]
  );

  const bandStats = useMemo(() => {
    const fragmentMetrics = metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "raster_stats" && m.value
    ) as unknown as RasterStats[];

    if (!fragmentMetrics.length || loading) {
      return emptyStats;
    }

    const combined = combineMetricsForFragments(
      fragmentMetrics as Pick<Metric, "type" | "value">[]
    ) as RasterStats;

    return combined.value.bands[0] || emptyStats;
  }, [metrics, loading]);

  const formatValue = (stat: RasterStatKey) => {
    const value = bandStats[stat];
    if (value === undefined || value === null || Number.isNaN(value)) {
      return "–";
    }
    if (stat === "count" || stat === "invalid") {
      return formatters.count(value);
    }
    const formatted = formatters.decimal(value);
    return unitLabel ? `${formatted} ${unitLabel}` : formatted;
  };

  return (
    <Tooltip.Provider>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
        <div
          className="divide-y divide-gray-100"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(160px,1fr) minmax(90px, auto)",
          }}
        >
          <div className="contents bg-gray-50 border-b border-gray-200">
            <div className="px-3 py-2 text-gray-600 text-xs font-semibold uppercase tracking-wide truncate bg-gray-100 border-b">
              {componentSettings?.statLabel || t("Statistic")}
            </div>
            <div className="px-3 py-2 text-right text-gray-600 text-xs font-semibold uppercase tracking-wide bg-gray-100 border-b truncate">
              {componentSettings?.valueLabel || t("Value")}
            </div>
          </div>
          {statsToShow.map((stat, idx) => (
            <div key={stat} className="contents hover:bg-gray-50">
              <div
                className={`px-3 py-2 text-sm text-gray-900 truncate ${idx % 2 === 1 ? "bg-gray-50/50 border-t border-b border-black/5" : ""
                  }`}
              >
                {statLabels(t, componentSettings)[stat]}
              </div>
              <div
                className={`px-3 py-2 text-right text-sm text-gray-900 tabular-nums ${idx % 2 === 1 ? "bg-gray-50/50 border-t border-b border-black/5" : ""
                  }`}
              >
                {loading ? <MetricLoadingDots /> : formatValue(stat)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
};

export const RasterStatisticsTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const componentSettings = node.attrs?.componentSettings || {};
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const dependencies = useMemo(
      () => (node.attrs?.metrics || []) as MetricDependency[],
      [node.attrs?.metrics]
    );

    const handleToggleStat = (stat: RasterStatKey, enabled: boolean) => {
      onUpdate({
        componentSettings: {
          ...componentSettings,
          displayStats: {
            ...(componentSettings.displayStats || {}),
            [stat]: enabled,
          },
        },
      });
    };

    const statToggleList: Array<{ key: RasterStatKey; label: string }> = [
      { key: "count", label: t("Count") },
      { key: "min", label: t("Min") },
      { key: "max", label: t("Max") },
      { key: "mean", label: t("Mean") },
      { key: "sum", label: t("Sum") },
      { key: "invalid", label: t("Invalid Cells") },
    ];

    const relatedOverlay = useMemo(() => {
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      const dep = dependencies.find((d) => d.tableOfContentsItemId);
      if (!dep?.tableOfContentsItemId) return null;
      return allSources.find(
        (s) => s.tableOfContentsItemId === dep.tableOfContentsItemId
      );
    }, [
      dependencies,
      reportContext.overlaySources,
      reportContext.adminSources,
    ]);

    return (
      <Tooltip.Provider>
        <div className="flex gap-3 items-center text-sm text-gray-800">
          <NumberRoundingControl
            value={componentSettings?.minimumFractionDigits}
            onChange={(minimumFractionDigits) =>
              onUpdate({
                componentSettings: {
                  ...componentSettings,
                  minimumFractionDigits,
                },
              })
            }
          />
          <UnitSelector
            unitType="distance"
            allowNone
            value={componentSettings?.unit}
            unitDisplay={componentSettings?.unitDisplay}
            onChange={(value) =>
              onUpdate({
                componentSettings: {
                  ...componentSettings,
                  unit: value,
                },
              })
            }
            onUnitDisplayChange={(display) =>
              onUpdate({
                componentSettings: {
                  ...componentSettings,
                  unitDisplay: display,
                },
              })
            }
          />
          <TableHeadingsEditor
            labelKeys={[
              "statLabel",
              "valueLabel",
              ...statToggleList.map((s) => s.key + "Label"),
            ]}
            labelDisplayNames={[
              t("Statistic"),
              t("Value"),
              ...statToggleList.map((s) => s.label),
            ]}
            componentSettings={componentSettings}
            onUpdate={onUpdate}
          />
          <Popover.Root open={statsModalOpen} onOpenChange={setStatsModalOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
              >
                <Pencil2Icon className="w-3 h-3" />
                {t("stats")}
              </button>
            </Popover.Trigger>
            <TooltipPopoverContent>
              <div className="px-1 space-y-1 w-48">
                {statToggleList.map((item) => (
                  <TooltipBooleanConfigurationOption
                    key={item.key}
                    label={item.label}
                    checked={!!componentSettings.displayStats?.[item.key]}
                    onChange={(next) => handleToggleStat(item.key, next)}
                  />
                ))}
              </div>
            </TooltipPopoverContent>
          </Popover.Root>
          <TooltipMorePopover>
            <div className="flex">
              <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
                {t("Metric Type")}
              </span>
              <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
                {t("Raster statistics")}
              </span>
            </div>
            {relatedOverlay && (
              <div className="flex">
                <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
                  {t("Layer")}
                </span>
                <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right max-w-32 truncate">
                  {relatedOverlay.tableOfContentsItem?.title || t("Unknown")}
                </span>
              </div>
            )}
          </TooltipMorePopover>
        </div>
      </Tooltip.Provider>
    );
  };
