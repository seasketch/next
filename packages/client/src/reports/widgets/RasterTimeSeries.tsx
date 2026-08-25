import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  RasterOverlayAreaMetric,
  RasterStats,
  getRasterOverlayAreaDisplayedClassValue,
} from "overlay-engine";
import {
  CaretDownIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import {
  ReportWidget,
  TableHeadingsEditor,
  TooltipBooleanConfigurationOption,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { useOverlaySources } from "../hooks/useOverlaySources";
import { usePrimaryGeography } from "../hooks/usePrimaryGeography";
import { combineMetricsBySource } from "./ClassTableRows";
import { GeographySelector } from "./InlineMetric";
import {
  formatPercentAxisTick,
  paddedTimeSeriesYDomain,
  TIME_SERIES_PERCENT_Y_ZERO_SPAN,
  timeSeriesYAxis,
  TimeSeriesChart,
  TimeSeriesDatum,
} from "./charts/TimeSeriesChart";
import { LabeledDropdown } from "./LabeledDropdown";
import { UnitSelector } from "./UnitSelector";
import { VrmSelector } from "./VrmSelector";
import {
  ReportLayerMultiPicker,
  ReportSourceLayerValue,
} from "./ReportLayerMultiPicker";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  applyBufferSettingsToParameters,
  BufferSelector,
  getBufferSettingsFromDependencies,
  BufferSettings,
} from "./BufferSelector";
import {
  coverageForSource,
  finestPrecision,
  formatTimeTick,
  temporalPositionForSource,
  unionRasterValueDomain,
} from "./temporalChart";
import {
  DEFAULT_TIME_SERIES_COLOR,
  timeSeriesDatumColors,
} from "./timeSeriesCartography";
import { useBaseReportContext } from "../context/BaseReportContext";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import { AreaUnit } from "../utils/units";
import { SketchGeometryType } from "../../generated/graphql";
import {
  getRasterTimeSeriesAreaUnit,
  getRasterTimeSeriesPresentation,
  getRasterTimeSeriesPrintPresentations,
  getRasterTimeSeriesTabLabels,
  getRasterTimeSeriesTabOrder,
  isPlottableRasterStatsBand,
  RasterTimeSeriesPresentation,
} from "./rasterTimeSeriesSettings";

export { temporalPositionForSource, coverageForSource };

/**
 * Statistic plotted over time, one sample per source layer:
 *
 * - "stats": min/mean/max envelope of raster values (e.g. Degree Heating
 *   Weeks). Uses `raster_stats` fragment metrics only.
 * - "area": raster area captured by the sketch, in a chosen area unit or as
 *   a percent of the primary geography's raster area (e.g. mangrove extent).
 *   Uses
 *   `raster_overlay_area` fragment + geography metrics.
 * - "sum_proportion": sum of raster values captured by the sketch, absolute
 *   or as a percent of the geography total (e.g. fishing effort). Uses
 *   `raster_stats` fragment + geography metrics.
 */
export type RasterTimeSeriesMode = "stats" | "area" | "sum_proportion";

type RasterTimeSeriesSettings = {
  mode?: RasterTimeSeriesMode;
  /**
   * Initial presentation for "area" and "sum_proportion" modes. Viewers can
   * toggle between absolute and percent when a geography total is available.
   */
  defaultPresentation?: "absolute" | "percent";
  /**
   * Which value presentations viewers can use, including the initial option
   * when both are available. Supersedes `defaultPresentation`.
   */
  presentation?: RasterTimeSeriesPresentation;
  /** Geography used as the denominator. Auto uses the clipping geography. */
  geographyId?: number | "auto";
  /** Area-mode display unit. Metrics stay in km²; labels convert. */
  unit?: AreaUnit;
  /** Legacy fallback for the absolute/area tab label. */
  valueLabel?: string;
  /** Absolute / Area tab label. Falls back to `valueLabel`, then Area/Absolute. */
  absoluteLabel?: string;
  /** Percent tab label. Falls back to "Percent". */
  percentLabel?: string;
  minimumFractionDigits?: number;
  /**
   * Stats mode only. "domain" (default) uses the raster's value range
   * (e.g. DHW 0–10). "results" nices the axis to the sketch overlap.
   */
  yScale?: "domain" | "results";
  /** How densely d3-scale labels the temporal x-axis. */
  xTickDensity?: "less" | "auto" | "more";
  /**
   * Color marks from the layer's cartography (default on). When the
   * Y-axis is the styled raster value (stats + interpolate/step/match),
   * each sample follows that value through the ramp.
   */
  colorCoded?: boolean;
};

export function getRasterTimeSeriesMode(
  settings: Pick<RasterTimeSeriesSettings, "mode">
): RasterTimeSeriesMode {
  return settings.mode === "area" ||
    settings.mode === "sum_proportion" ||
    settings.mode === "stats"
    ? settings.mode
    : "stats";
}

/**
 * Builds the MetricDependency fan-out for a set of source layers under a
 * given mode. Shared by the slash command and the tooltip controls so mode
 * switches and layer changes always produce consistent dependencies.
 */
export function buildRasterTimeSeriesDependencies(
  stableIds: string[],
  mode: RasterTimeSeriesMode,
  bufferSettings?: BufferSettings
): MetricDependency[] {
  const deps: MetricDependency[] = [];
  for (const stableId of stableIds) {
    if (mode === "area") {
      deps.push(
        {
          type: "raster_overlay_area",
          subjectType: "fragments",
          stableId,
        },
        {
          type: "raster_overlay_area",
          subjectType: "geographies",
          stableId,
          parameters: { vrm: false },
        }
      );
    } else {
      deps.push({
        type: "raster_stats",
        subjectType: "fragments",
        stableId,
      });
      if (mode === "sum_proportion") {
        deps.push({
          type: "raster_stats",
          subjectType: "geographies",
          stableId,
        });
      }
    }
  }
  if (!bufferSettings) {
    return deps;
  }
  return deps.map((dep) => ({
    ...dep,
    parameters: applyBufferSettingsToParameters(dep, bufferSettings),
  }));
}

/** Sum of displayed class areas across all class keys (grouped or "*"). */
export function totalRasterOverlayArea(
  value: RasterOverlayAreaMetric["value"] | null | undefined
): number {
  if (!value?.areas) return NaN;
  let total = 0;
  for (const key of Object.keys(value.areas)) {
    const v = getRasterOverlayAreaDisplayedClassValue(value, key);
    if (Number.isFinite(v)) {
      total += v;
    }
  }
  return total;
}

export const RasterTimeSeries: ReportWidget<RasterTimeSeriesSettings> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  sketchClass,
  geographies,
}) => {
  const { t } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);
  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const selectedGeography =
    componentSettings.geographyId === undefined ||
    componentSettings.geographyId === "auto"
      ? clippingGeography
      : geographies.find((g) => g.id === componentSettings.geographyId);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings.minimumFractionDigits,
    unit: getRasterTimeSeriesAreaUnit(componentSettings),
    unitDisplay: "short",
  });

  const mode = getRasterTimeSeriesMode(componentSettings);
  const colorCoded = componentSettings.colorCoded !== false;
  const supportsPercent = mode !== "stats";
  const presentationSettings =
    getRasterTimeSeriesPresentation(componentSettings);
  const [viewerPresentation, setViewerPresentation] = useState<
    "absolute" | "percent" | null
  >(null);
  useEffect(() => {
    setViewerPresentation(null);
  }, [
    mode,
    componentSettings.presentation,
    componentSettings.defaultPresentation,
  ]);
  const presentation = supportsPercent
    ? presentationSettings.showAbsolute && !presentationSettings.showPercent
      ? "absolute"
      : presentationSettings.showPercent && !presentationSettings.showAbsolute
      ? "percent"
      : viewerPresentation ?? presentationSettings.defaultValue
    : "absolute";

  const dependencyStableIds = useMemo(() => {
    const ids: string[] = [];
    for (const dep of dependencies || []) {
      if (dep.stableId && !ids.includes(dep.stableId)) {
        ids.push(dep.stableId);
      }
    }
    return ids;
  }, [dependencies]);

  const { absoluteData, percentData, missingTemporal, percentUnavailable } =
    useMemo(() => {
      const missing: string[] = [];
      let percentUnavailable = false;
      const empty = {
        absoluteData: [] as TimeSeriesDatum[],
        percentData: [] as TimeSeriesDatum[],
        missingTemporal: missing,
        percentUnavailable,
      };
      if (loading || sources.length === 0 || metrics.length === 0) {
        // Don't treat in-flight metrics as a coverage error. Sketch switches
        // briefly empty the metric list while overlay sources are still present.
        if (!loading && metrics.length === 0) {
          for (const source of sources) {
            if (!coverageForSource(source)) {
              missing.push(
                source.tableOfContentsItem?.title || source.stableId
              );
            }
          }
        }
        return empty;
      }
      const geographyId = selectedGeography?.id ?? clippingGeography?.id;
      if (!geographyId) {
        throw new Error("Primary geography not found.");
      }
      const combined = combineMetricsBySource(
        metrics,
        sources,
        geographyId,
        mode === "area" ? "raster_overlay_area" : "raster_stats"
      );
      const absoluteData: TimeSeriesDatum[] = [];
      const percentData: TimeSeriesDatum[] = [];
      for (const source of sources) {
        const coverage = coverageForSource(source);
        if (!coverage) {
          missing.push(source.tableOfContentsItem?.title || source.stableId);
          continue;
        }
        const metricsForSource = combined[source.stableId];
        if (!metricsForSource) {
          continue;
        }
        if (mode === "stats") {
          const band = (metricsForSource.fragments as RasterStats | undefined)
            ?.value?.bands?.[0];
          if (!isPlottableRasterStatsBand(band)) continue;
          absoluteData.push({
            x: coverage.start,
            xEnd: coverage.end,
            span: coverage.span,
            formattedX: coverage.label,
            value: band.mean,
            min: band.min,
            max: band.max,
            formattedValue: formatters.decimal(band.mean),
            formattedMin: formatters.decimal(band.min),
            formattedMax: formatters.decimal(band.max),
            ...(colorCoded
              ? timeSeriesDatumColors({
                  styles: source.mapboxGlStyles,
                  mode,
                  value: band.mean,
                  min: band.min,
                  max: band.max,
                })
              : {}),
          });
        } else if (mode === "area") {
          const fragmentTotal = totalRasterOverlayArea(
            (metricsForSource.fragments as RasterOverlayAreaMetric | undefined)
              ?.value
          );
          if (!Number.isFinite(fragmentTotal)) continue;
          const geographyTotal = totalRasterOverlayArea(
            (metricsForSource.geographies as RasterOverlayAreaMetric | undefined)
              ?.value
          );
          const fraction =
            Number.isFinite(geographyTotal) && geographyTotal > 0
              ? fragmentTotal / geographyTotal
              : null;
          if (fraction === null) percentUnavailable = true;
          const colors = colorCoded
            ? timeSeriesDatumColors({
                styles: source.mapboxGlStyles,
                mode,
                value: fragmentTotal,
              })
            : {};
          const base = {
            x: coverage.start,
            xEnd: coverage.end,
            span: coverage.span,
            formattedX: coverage.label,
            ...colors,
          };
          absoluteData.push({
            ...base,
            value: fragmentTotal,
            formattedValue: formatters.area(fragmentTotal),
          });
          if (fraction !== null) {
            percentData.push({
              ...base,
              value: fraction,
              formattedValue: formatters.percent(fraction),
            });
          }
        } else {
          const fragmentBand = (
            metricsForSource.fragments as RasterStats | undefined
          )?.value?.bands?.[0];
          if (!isPlottableRasterStatsBand(fragmentBand)) continue;
          const geographyBand = (
            metricsForSource.geographies as RasterStats | undefined
          )?.value?.bands?.[0];
          const fraction =
            geographyBand && geographyBand.sum > 0
              ? fragmentBand.sum / geographyBand.sum
              : null;
          if (fraction === null) percentUnavailable = true;
          const colors = colorCoded
            ? timeSeriesDatumColors({
                styles: source.mapboxGlStyles,
                mode,
                value: fragmentBand.sum,
              })
            : {};
          const base = {
            x: coverage.start,
            xEnd: coverage.end,
            span: coverage.span,
            formattedX: coverage.label,
            ...colors,
          };
          absoluteData.push({
            ...base,
            value: fragmentBand.sum,
            formattedValue: formatters.decimal(fragmentBand.sum),
          });
          if (fraction !== null) {
            percentData.push({
              ...base,
              value: fraction,
              formattedValue: formatters.percent(fraction),
            });
          }
        }
      }
      return {
        absoluteData,
        percentData,
        missingTemporal: missing,
        percentUnavailable,
      };
    }, [
      loading,
      sources,
      metrics,
      clippingGeography?.id,
      selectedGeography?.id,
      mode,
      formatters,
      colorCoded,
    ]);

  const data =
    presentation === "percent" && !percentUnavailable
      ? percentData
      : absoluteData;

  const awaitingMetrics =
    !loading &&
    metrics.length === 0 &&
    sources.some((source) => coverageForSource(source));
  const showLoading = loading || awaitingMetrics;

  const xPrecision = useMemo(() => {
    const coverages = sources
      .map((source) => coverageForSource(source))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return finestPrecision(coverages);
  }, [sources]);

  const absoluteYDomain = useMemo((): [number, number] | undefined => {
    if (mode !== "stats") {
      return undefined;
    }
    if (componentSettings.yScale === "results") {
      return undefined;
    }
    return unionRasterValueDomain(sources) ?? undefined;
  }, [mode, componentSettings.yScale, sources]);

  const percentYDomain = useMemo(
    () =>
      paddedTimeSeriesYDomain(
        percentData.map((d) => d.value),
        { ceil: 1, zeroSpan: TIME_SERIES_PERCENT_Y_ZERO_SPAN }
      ) ?? undefined,
    [percentData]
  );

  const formatPercentValue = useMemo(() => {
    const values = percentData.map((d) => d.value);
    const { ticks } = timeSeriesYAxis(percentYDomain, values);
    return (value: number) => formatPercentAxisTick(value, ticks);
  }, [percentData, percentYDomain]);

  const formatAbsoluteValue = useMemo(() => {
    if (mode === "area") {
      return (v: number) => formatters.area(v);
    }
    // Integer-aware so axis ticks stay consistent ("0, 2, 4 … 10" rather
    // than mixing "8.0" and "10").
    return (v: number) =>
      Number.isInteger(v) ? formatters.count(v) : formatters.decimal(v);
  }, [mode, formatters]);

  const tabLabels = getRasterTimeSeriesTabLabels(componentSettings, {
    absolute: mode === "area" ? t("Area") : t("Absolute"),
    percent: t("Percent"),
  });
  const showPresentationToggle =
    supportsPercent &&
    presentationSettings.showAbsolute &&
    presentationSettings.showPercent &&
    !showLoading &&
    data.length > 0 &&
    !percentUnavailable;
  const printPresentations = getRasterTimeSeriesPrintPresentations(
    componentSettings,
    { percentUnavailable: percentUnavailable || !supportsPercent }
  );
  const tabsToRender =
    printing && printPresentations.length > 1
      ? printPresentations
      : [presentation];
  const chartsToRender = tabsToRender.filter((tab) => {
    const isPercent = tab === "percent" && !percentUnavailable && supportsPercent;
    const chartData = isPercent ? percentData : absoluteData;
    return chartData.length > 0;
  });

  if (!loading && dependencyStableIds.length === 0) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No data available.</Trans>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full overflow-x-hidden bg-white pb-1 relative">
      {showPresentationToggle && !printing && (
        <div className="flex justify-center pt-3 print:hidden">
          <div
            className="report-tabs-track"
            role="tablist"
            aria-label={t("Value display")}
          >
            {getRasterTimeSeriesTabOrder(componentSettings).map((tab) => {
              const label =
                tab === "absolute" ? tabLabels.absolute : tabLabels.percent;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-label={label}
                  aria-selected={presentation === tab}
                  title={label}
                  onClick={() => setViewerPresentation(tab)}
                  className="report-tabs-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showLoading ? (
        <div className="px-3 py-2">
          <div
            className="w-full bg-gray-100 animate-pulse rounded"
            style={{ height: 160 }}
            aria-hidden
          />
          <div className="pt-2 text-sm text-gray-500">
            <MetricLoadingDots />
          </div>
        </div>
      ) : absoluteData.length === 0 && percentData.length === 0 ? (
        <div className="text-gray-600 text-sm px-3 py-2">
          {missingTemporal.length > 0 ? (
            <Trans ns="reports">
              No layers in this chart have temporal coverage metadata yet.
            </Trans>
          ) : (
            <Trans ns="reports">
              The sketch does not overlap any valid pixels in this layer.
            </Trans>
          )}
        </div>
      ) : (
        <div className="px-2">
          {chartsToRender.map((tab, index) => {
            const isPercent = tab === "percent" && !percentUnavailable;
            const chartData = isPercent ? percentData : absoluteData;
            const label = isPercent ? tabLabels.percent : tabLabels.absolute;
            return (
              <div
                key={tab}
                className={
                  index > 0
                    ? "mt-5 pt-4 border-t border-black/10"
                    : chartsToRender.length > 1
                    ? "pt-2"
                    : undefined
                }
              >
                {chartsToRender.length > 1 && (
                  <div className="px-1 pb-1 text-sm font-semibold text-gray-900">
                    {label}
                  </div>
                )}
                <TimeSeriesChart
                  data={chartData}
                  mode={mode === "stats" ? "envelope" : "line"}
                  color={DEFAULT_TIME_SERIES_COLOR}
                  formatValue={isPercent ? formatPercentValue : formatAbsoluteValue}
                  formatX={(ms) => formatTimeTick(ms, xPrecision)}
                  yDomain={isPercent ? percentYDomain : absoluteYDomain}
                  xTickDensity={
                    componentSettings.xTickDensity === "less" ||
                    componentSettings.xTickDensity === "more"
                      ? componentSettings.xTickDensity
                      : "auto"
                  }
                  valueLabel={mode === "stats" ? t("Mean") : label}
                  minLabel={t("Min")}
                  maxLabel={t("Max")}
                />
              </div>
            );
          })}
        </div>
      )}
      {!showLoading && missingTemporal.length > 0 && (
        <div className="mx-3 mt-2 mb-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-none mt-0.5" />
          <span>
            <Trans
              ns="reports"
              i18nKey="rasterTimeSeriesMissingTemporal"
              defaults="Not plotted (no temporal coverage): {{layers}}. This layer is missing temporal coverage metadata."
              values={{ layers: missingTemporal.join(", ") }}
            />
          </span>
        </div>
      )}
    </div>
  );
};

const MODE_OPTIONS: Array<{
  value: RasterTimeSeriesMode;
  label: string;
  description: string;
}> = [
  {
    value: "stats",
    label: "Mean, Min, and Max Values",
    description: "Envelope of raster values within the sketch.",
  },
  {
    value: "area",
    label: "Area Captured",
    description:
      "Total area overlap with the raster, with the option to show the percent of geography total.",
  },
  {
    value: "sum_proportion",
    label: "Sum Captured",
    description:
      "Sum of raster values within the sketch, with optional percent of geography total.",
  },
];

export const RasterTimeSeriesTooltipControls: ReportWidgetTooltipControls = ({
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
  const settings: RasterTimeSeriesSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );
  const mode = getRasterTimeSeriesMode(settings);
  const { geographies } = useBaseReportContext();
  const subjectReportContext = useSubjectReportContext();
  const sketchClass = subjectReportContext.data?.sketch?.sketchClass;
  const sketchClassForPrimaryGeography = sketchClass ?? {
    geometryType: SketchGeometryType.Polygon,
    clippingGeographies: [],
    validChildren: [],
    project: { sketchClasses: [] },
  };
  const { clippingGeography } = usePrimaryGeography(
    sketchClassForPrimaryGeography,
    geographies
  );
  const { allSources: overlaySources } = useOverlaySources();
  // Titles for layers just added from the picker, before sources refetch.
  const [titlesByStableId, setTitlesByStableId] = useState<
    Record<string, string>
  >({});

  const stableIds = useMemo(() => {
    const ids: string[] = [];
    for (const dep of dependencies) {
      if (dep.stableId && !ids.includes(dep.stableId)) {
        ids.push(dep.stableId);
      }
    }
    return ids;
  }, [dependencies]);

  const layers = useMemo(() => {
    return stableIds.map((stableId) => {
      const source = overlaySources.find((s) => s.stableId === stableId);
      const coverage = source ? coverageForSource(source) : null;
      return {
        stableId,
        title:
          source?.tableOfContentsItem?.title ||
          titlesByStableId[stableId] ||
          stableId,
        temporalLabel: coverage?.label ?? null,
      };
    });
  }, [stableIds, overlaySources, titlesByStableId]);

  const handleUpdate = (patch: Partial<RasterTimeSeriesSettings>) => {
    onUpdate({
      componentSettings: {
        ...settings,
        ...patch,
      },
    });
  };

  const handleModeChange = (next: RasterTimeSeriesMode) => {
    if (next === mode) return;
    handleUpdate({ mode: next });
    onUpdateAllDependencies((currentDeps) => {
      const ids: string[] = [];
      for (const dep of currentDeps) {
        if (dep.stableId && !ids.includes(dep.stableId)) {
          ids.push(dep.stableId);
        }
      }
      return buildRasterTimeSeriesDependencies(
        ids,
        next,
        getBufferSettingsFromDependencies(currentDeps)
      );
    });
  };

  const handleAddLayers = (added: ReportSourceLayerValue[]) => {
    const newIds = added
      .map((l) => l.stableId)
      .filter((id) => id && !stableIds.includes(id));
    if (newIds.length === 0) return;
    setTitlesByStableId((prev) => {
      const next = { ...prev };
      for (const l of added) {
        next[l.stableId] = l.title;
      }
      return next;
    });
    onUpdateAllDependencies((currentDeps) => [
      ...currentDeps,
      ...buildRasterTimeSeriesDependencies(
        newIds,
        mode,
        getBufferSettingsFromDependencies(currentDeps)
      ),
    ]);
  };

  const handleRemoveLayer = (stableId: string) => {
    onUpdateAllDependencies((currentDeps) =>
      currentDeps.filter((d) => d.stableId !== stableId)
    );
  };

  const currentVrm = useMemo(() => {
    const fragmentDep = dependencies.find((d) => d.subjectType === "fragments");
    return fragmentDep?.parameters?.vrm;
  }, [dependencies]);

  const bufferSettings = useMemo(
    () => getBufferSettingsFromDependencies(dependencies),
    [dependencies]
  );
  const showBufferGeography = useMemo(
    () => dependencies.some((d) => d.subjectType === "geographies"),
    [dependencies]
  );

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

  const modeLabels: Record<RasterTimeSeriesMode, string> = {
    stats: t("Min / Mean / Max"),
    area: t("Area captured"),
    sum_proportion: t("Sum captured"),
  };
  const absoluteLabel = mode === "area" ? t("Area") : t("Absolute");
  const presentationValue =
    settings.presentation ??
    (settings.defaultPresentation === "percent"
      ? "both_percent"
      : "both_absolute");
  const presentationOptions = [
    {
      value: "absolute",
      label: t("{{value}} only", { value: absoluteLabel }),
    },
    { value: "percent", label: t("Percent only") },
    {
      value: "both_absolute",
      label: t("Both — {{value}} first", { value: absoluteLabel }),
    },
    { value: "both_percent", label: t("Both — percent first") },
  ];

  return (
    <div className="flex gap-3 items-center text-sm text-gray-800">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
          >
            <span className="font-light text-gray-400">{t("Statistic")}</span>
            <span>{modeLabels[mode]}</span>
            <CaretDownIcon className="w-4 h-4 text-gray-400" />
          </button>
        </Popover.Trigger>
        <TooltipPopoverContent>
          <div className="px-1 space-y-1 w-64">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleModeChange(option.value)}
                className={`w-full text-left px-2 py-1.5 rounded-md border transition-colors ${
                  option.value === mode
                    ? "border-gray-300 bg-gray-50"
                    : "border-transparent hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm font-medium text-gray-900">
                  {t(option.label)}
                </span>
                <span className="block text-xs text-gray-500 leading-snug">
                  {t(option.description)}
                </span>
              </button>
            ))}
          </div>
        </TooltipPopoverContent>
      </Popover.Root>
      {mode === "area" && (
        <UnitSelector
          unitType="area"
          value={getRasterTimeSeriesAreaUnit(settings)}
          onChange={(unit) => handleUpdate({ unit })}
          unitDisplay="short"
        />
      )}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
          >
            <span className="font-light text-gray-400">{t("Layers")}</span>
            <span>{layers.length}</span>
            <CaretDownIcon className="w-4 h-4 text-gray-400" />
          </button>
        </Popover.Trigger>
        <TooltipPopoverContent>
          <div className="w-80">
            <p className="px-2 pb-1 text-xs text-gray-500">
              {t(
                "Each layer is placed by its temporal coverage. A multi-year layer draws as a span."
              )}
            </p>
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
              {layers.map((layer) => (
                <div
                  key={layer.stableId}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <span className="flex-1 min-w-0 truncate text-gray-900">
                    {layer.title}
                  </span>
                  {layer.temporalLabel ? (
                    <span className="flex-none text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 tabular-nums">
                      {layer.temporalLabel}
                    </span>
                  ) : (
                    <span
                      className="flex-none inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                      title={t(
                        "No temporal coverage. Set it in this layer's admin editor (Settings tab) to plot it."
                      )}
                    >
                      <ExclamationTriangleIcon className="w-3 h-3" />
                      {t("No date")}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={layers.length <= 1}
                    onClick={() => handleRemoveLayer(layer.stableId)}
                    className="flex-none p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t("Remove layer")}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-2 pt-2 border-t border-gray-100">
              <ReportLayerMultiPicker
                onAdd={handleAddLayers}
                excludeStableIds={new Set(stableIds)}
                allowedGeometryTypes={["SingleBandRaster"]}
                side="left"
                align="center"
                sideOffset={12}
              >
                <button
                  type="button"
                  className="h-7 rounded bg-blue-600 hover:bg-blue-700 px-2.5 text-xs flex items-center gap-1.5 text-white font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <PlusIcon className="w-3.5 h-3.5 text-white/80" />
                  {t("Add layer(s)")}
                </button>
              </ReportLayerMultiPicker>
            </div>
          </div>
        </TooltipPopoverContent>
      </Popover.Root>
      {mode !== "stats" && (
        <TableHeadingsEditor
          labelKeys={["absoluteLabel", "percentLabel"]}
          labelDisplayNames={[
            mode === "area" ? t("Area") : t("Absolute"),
            t("Percent"),
          ]}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
      )}
      <TooltipMorePopover>
        {mode !== "stats" && (
          <>
            <LabeledDropdown
              label={t("Values")}
              value={presentationValue}
              options={presentationOptions}
              onChange={(value) =>
                handleUpdate({
                  presentation: value as RasterTimeSeriesPresentation,
                  defaultPresentation: undefined,
                })
              }
            />
            <GeographySelector
              geographies={geographies}
              clippingGeography={clippingGeography}
              value={settings.geographyId}
              onChange={(geographyId) => {
                if (geographyId === null) return;
                handleUpdate({ geographyId });
              }}
              t={t}
            />
          </>
        )}
        <BufferSelector
          distanceKm={bufferSettings.distanceKm}
          bufferGeography={bufferSettings.bufferGeography}
          showBufferGeography={showBufferGeography}
          onChange={(next) => {
            onUpdateDependencyParameters((dependency) =>
              applyBufferSettingsToParameters(dependency, next)
            );
          }}
        />
        <VrmSelector value={currentVrm} onChange={handleVrmChange} />
        <LabeledDropdown
          label={t("X-axis labels")}
          value={
            settings.xTickDensity === "less" || settings.xTickDensity === "more"
              ? settings.xTickDensity
              : "auto"
          }
          options={[
            { value: "less", label: t("Fewer") },
            { value: "auto", label: t("Auto") },
            { value: "more", label: t("More") },
          ]}
          onChange={(value) =>
            handleUpdate({
              xTickDensity:
                value === "less" || value === "more" ? value : "auto",
            })
          }
        />
        {mode === "stats" ? (
          <LabeledDropdown
            label={t("Y-axis")}
            value={settings.yScale === "results" ? "results" : "domain"}
            options={[
              {
                value: "domain",
                label: t("Full"),
                description: t("Layer value range"),
              },
              {
                value: "results",
                label: t("Scaled"),
                description: t("Fit this sketch"),
              },
            ]}
            onChange={(value) =>
              handleUpdate({
                yScale: value === "results" ? "results" : "domain",
              })
            }
          />
        ) : (
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Y-axis")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right text-gray-500">
              {t("Scaled")}
            </span>
          </div>
        )}
        <TooltipBooleanConfigurationOption
          label={t("Color based on cartography")}
          checked={settings.colorCoded !== false}
          onChange={(next) => handleUpdate({ colorCoded: next })}
        />
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Component Type")}
          </span>
          <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
            {t("Time Series")}
          </span>
        </div>
      </TooltipMorePopover>
    </div>
  );
};
