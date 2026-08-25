import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  RasterOverlayAreaMetric,
  getRasterOverlayAreaDisplayedClassValue,
} from "overlay-engine";
import { GridIcon, PieChartIcon } from "@radix-ui/react-icons";
import { ReportWidget } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipDropdown,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { useOverlaySources } from "../hooks/useOverlaySources";
import {
  ClassTableRowComponentSettings,
  combineMetricsBySource,
  getClassTableRows,
} from "./ClassTableRows";
import { ClassRowSettingsPopover } from "./ClassRowSettingsPopover";
import { VrmSelector } from "./VrmSelector";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import { CompositionChartDatum, PieChart } from "./charts/PieChart";
import { WaffleChart } from "./charts/WaffleChart";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { ReportUIStateContext } from "../context/ReportUIStateContext";

export type CompositionChartType = "pie" | "waffle";

type ClassCompositionChartSettings = {
  /**
   * Visualization types enabled by the admin, in the order they were enabled.
   * The first entry is what viewers see initially; the viewer-facing toggle
   * only appears when more than one type is enabled. Defaults to ["waffle"].
   */
  chartTypes?: CompositionChartType[];
  /** @deprecated Replaced by `chartTypes`. Read for previously saved cards. */
  chartType?: CompositionChartType;
  /** Include classes with zero area in the legend. Default false. */
  showZeroClasses?: boolean;
} & ClassTableRowComponentSettings;

/**
 * Resolves which visualization types are enabled, tolerating legacy settings
 * and unknown values. Always returns at least one type (waffle by default).
 */
export function getEnabledChartTypes(
  settings: Pick<ClassCompositionChartSettings, "chartTypes" | "chartType">
): CompositionChartType[] {
  const valid = (settings.chartTypes || []).filter(
    (v): v is CompositionChartType => v === "pie" || v === "waffle"
  );
  if (valid.length > 0) {
    return Array.from(new Set(valid));
  }
  if (settings.chartType === "pie" || settings.chartType === "waffle") {
    return [settings.chartType];
  }
  return ["waffle"];
}

/** Fallback slice colors for classes whose layer style has no category color. */
const FALLBACK_COLORS = [
  "#0284c7",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#4f46e5",
  "#78716c",
];

type CompositionRow = CompositionChartDatum & {
  areaKm2: number;
};

export const ClassCompositionChart: ReportWidget<
  ClassCompositionChartSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  sketchClass,
  geographies,
}) => {
  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const { printing } = useContext(ReportUIStateContext);
  const { t } = useTranslation("reports");
  const { percent: formatPercent, area: formatArea } = useNumberFormatters();

  const showZeroClasses = componentSettings.showZeroClasses ?? false;
  const enabledChartTypes = getEnabledChartTypes(componentSettings);
  const showViewerToggle = enabledChartTypes.length > 1;
  // Viewer preference; null follows the admin-configured default.
  const [viewerChartType, setViewerChartType] =
    useState<CompositionChartType | null>(null);
  useEffect(() => {
    setViewerChartType(null);
  }, [componentSettings.chartTypes, componentSettings.chartType]);
  const chartType =
    !printing &&
    viewerChartType &&
    enabledChartTypes.includes(viewerChartType)
      ? viewerChartType
      : enabledChartTypes[0];

  const rows = useMemo<CompositionRow[]>(() => {
    const classRows = getClassTableRows({
      dependencies: dependencies || [],
      sources,
      customLabels: componentSettings.customRowLabels,
      allFeaturesLabel: t("All features"),
      stableIds: componentSettings.rowLinkedStableIds,
      excludedRowKeys: componentSettings.excludedRowKeys,
    }).filter((r) => r.groupByKey !== "*");

    if (sources.length === 0 || metrics.length === 0 || loading) {
      return classRows.map((r, i) => ({
        key: r.key,
        label: r.label,
        color: r.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        fraction: 0,
        formattedPercent: "",
        areaKm2: NaN,
      }));
    }

    if (!clippingGeography?.id) {
      throw new Error("Primary geography not found.");
    }

    const combinedMetrics = combineMetricsBySource<RasterOverlayAreaMetric>(
      metrics,
      sources,
      clippingGeography.id,
      "raster_overlay_area"
    );

    const withAreas = classRows.map((r, i) => {
      const fragmentValue = combinedMetrics[r.sourceId]?.fragments?.value;
      const areaKm2 = getRasterOverlayAreaDisplayedClassValue(
        fragmentValue,
        r.groupByKey
      );
      return {
        key: r.key,
        label: r.label,
        color: r.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        areaKm2: Number.isFinite(areaKm2) ? areaKm2 : 0,
      };
    });

    const total = withAreas.reduce((sum, r) => sum + r.areaKm2, 0);

    return withAreas.map((r) => {
      const fraction = total > 0 ? r.areaKm2 / total : 0;
      return {
        ...r,
        fraction,
        formattedPercent: formatPercent(fraction),
        formattedValue: formatArea(r.areaKm2),
      };
    });
  }, [
    dependencies,
    sources,
    metrics,
    loading,
    clippingGeography?.id,
    componentSettings.customRowLabels,
    componentSettings.rowLinkedStableIds,
    componentSettings.excludedRowKeys,
    formatPercent,
    formatArea,
    t,
  ]);

  const legendRows = useMemo(
    () =>
      loading || showZeroClasses ? rows : rows.filter((r) => r.areaKm2 > 0),
    [rows, loading, showZeroClasses]
  );

  const total = rows.reduce(
    (sum, r) => sum + (Number.isFinite(r.areaKm2) ? r.areaKm2 : 0),
    0
  );
  const noOverlap = !loading && rows.length > 0 && total <= 0;

  if (!loading && rows.length === 0) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No data available.</Trans>
      </div>
    );
  }

  const legend = (
    <div
      className={
        chartType === "pie"
          ? "flex-1 min-w-[160px] space-y-1"
          : "flex flex-wrap gap-x-4 gap-y-1 pt-2"
      }
    >
      {legendRows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center gap-2 text-sm ${
            !loading && row.areaKm2 <= 0 ? "opacity-50" : ""
          }`}
        >
          <span
            className="inline-block flex-none w-3 h-3 rounded-sm"
            style={{ backgroundColor: row.color }}
            aria-hidden
          />
          <span className="min-w-0 truncate text-gray-800" title={row.label}>
            {row.label}
          </span>
          <span className="flex-none tabular-nums text-gray-900 font-medium">
            {loading ? <MetricLoadingDots /> : row.formattedPercent}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden relative">
      {showViewerToggle && !printing && !loading && !noOverlap && (
        <div className="flex justify-center pt-2 print:hidden">
          <div
            className="report-tabs-track"
            role="tablist"
            aria-label={t("Chart display")}
          >
            {enabledChartTypes.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-label={type === "pie" ? t("Pie chart") : t("Waffle chart")}
                aria-selected={chartType === type}
                title={type === "pie" ? t("Pie chart") : t("Waffle chart")}
                onClick={() => setViewerChartType(type)}
                className="report-tabs-tab inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {type === "pie" ? (
                  <PieChartIcon className="w-4 h-4" />
                ) : (
                  <GridIcon className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={showViewerToggle ? "px-3 pb-3 pt-2" : "p-3"}>
        {noOverlap ? (
          <div className="text-gray-600 text-sm py-2">
            <Trans ns="reports">
              The sketch does not overlap any mapped classes in this layer.
            </Trans>
          </div>
        ) : chartType === "pie" ? (
          <div className="flex flex-wrap items-center gap-4">
            {loading ? (
              <div
                className="flex-none rounded-full bg-gray-200 animate-pulse"
                style={{ width: 150, height: 150 }}
                aria-hidden
              />
            ) : (
              <PieChart data={rows} size={150} className="flex-none" />
            )}
            {legend}
          </div>
        ) : (
          <div>
            {loading ? (
              <div
                className="w-full bg-gray-100 animate-pulse rounded"
                style={{ aspectRatio: "2 / 1" }}
                aria-hidden
              />
            ) : (
              <WaffleChart data={rows} />
            )}
            {legend}
          </div>
        )}
      </div>
    </div>
  );
};

export const ClassCompositionChartTooltipControls: ReportWidgetTooltipControls =
  ({
    node,
    onUpdate,
    onUpdateDependencyParameters,
    onUpdateAllDependencies,
  }) => {
    const { t } = useTranslation("admin:reports");
    const dependencies = useMemo(
      () => (node.attrs?.metrics || []) as MetricDependency[],
      [node.attrs?.metrics]
    );
    const settings: ClassCompositionChartSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const { filteredSources: sources } = useOverlaySources(dependencies);

    const handleUpdate = (patch: Partial<ClassCompositionChartSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const currentVrm = useMemo(() => {
      const fragmentDep = dependencies.find(
        (d) => d.subjectType === "fragments"
      );
      return fragmentDep?.parameters?.vrm;
    }, [dependencies]);

    const handleVrmChange = (next: false | "auto" | number | undefined) => {
      onUpdateDependencyParameters((dependency) => {
        const params = { ...(dependency.parameters || {}) };
        if (dependency.subjectType !== "fragments") {
          return params;
        }
        if (next === undefined || next === "auto") {
          delete params.vrm;
        } else {
          params.vrm = next;
        }
        return params;
      });
    };

    const enabledChartTypes = getEnabledChartTypes(settings);
    const chartDisplayValue =
      enabledChartTypes.length === 1
        ? enabledChartTypes[0]
        : enabledChartTypes[0] === "pie"
        ? "both_pie"
        : "both_waffle";

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <span className="font-light text-gray-400 whitespace-nowrap">
            {t("Charts")}
          </span>
          <TooltipDropdown
            value={chartDisplayValue}
            options={[
              { value: "pie", label: t("Pie") },
              { value: "waffle", label: t("Waffle") },
              { value: "both_pie", label: t("Pie, Waffle") },
              { value: "both_waffle", label: t("Waffle, Pie") },
            ]}
            onChange={(value) => {
              const chartTypesByDisplay: Record<
                string,
                CompositionChartType[]
              > = {
                pie: ["pie"],
                waffle: ["waffle"],
                both_pie: ["pie", "waffle"],
                both_waffle: ["waffle", "pie"],
              };
              const chartTypes =
                chartTypesByDisplay[value] ?? chartTypesByDisplay.waffle;
              handleUpdate({ chartTypes, chartType: undefined });
            }}
            ariaLabel={t("Charts")}
          />
        </div>
        <ClassRowSettingsPopover
          settings={settings}
          onUpdateSettings={(patch) => handleUpdate(patch)}
          dependencies={dependencies || []}
          sources={sources}
          onUpdateDependencyParameters={onUpdateDependencyParameters}
          onUpdateAllDependencies={onUpdateAllDependencies}
          t={t}
          allowedGeometryTypes={["SingleBandRaster"]}
          hideGroupBy={true}
          showZeros={settings.showZeroClasses ?? false}
          onShowZerosChange={(next) => handleUpdate({ showZeroClasses: next })}
        />
        <TooltipMorePopover>
          <VrmSelector value={currentVrm} onChange={handleVrmChange} />
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Component Type")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {t("Composition Chart")}
            </span>
          </div>
        </TooltipMorePopover>
      </div>
    );
  };
