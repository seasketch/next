import { useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MetricDependency } from "overlay-engine";
import {
  CaretDownIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
} from "../../generated/graphql";
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
} from "./charts/TimeSeriesChart";
import { LabeledDropdown } from "./LabeledDropdown";
import { UnitSelector } from "./UnitSelector";
import {
  ReportLayerMultiPicker,
  ReportSourceLayerValue,
} from "./ReportLayerMultiPicker";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import {
  applyBufferSettingsToParameters,
  BufferSelector,
  getBufferSettingsFromDependencies,
} from "./BufferSelector";
import {
  coverageForSource,
  finestPrecision,
  formatTimeTick,
  vectorGeometryFamily,
} from "./temporalChart";
import { DEFAULT_TIME_SERIES_COLOR } from "./timeSeriesCartography";
import { useBaseReportContext } from "../context/BaseReportContext";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import { AreaUnit, LengthUnit } from "../utils/units";
import { SketchGeometryType } from "../../generated/graphql";
import {
  getRasterTimeSeriesPresentation,
  getRasterTimeSeriesPrintPresentations,
  getRasterTimeSeriesTabLabels,
  getRasterTimeSeriesTabOrder,
  RasterTimeSeriesPresentation,
} from "./rasterTimeSeriesSettings";
import ColumnStatsWarning, {
  columnStatsHaveWarnings,
} from "./ColumnStatsWarning";
import {
  defaultNumericColumn,
  defaultVectorTimeSeriesMode,
  getVectorTimeSeriesMode,
  getVectorTimeSeriesUnit,
  intersectNumericColumns,
  pickerGeometryTypesForFamily,
  unionColumnValueDomain,
  VectorTimeSeriesMode,
  VectorTimeSeriesSettings,
  vectorTimeSeriesSupportsPercent,
} from "./vectorTimeSeriesSettings";
import {
  buildVectorTimeSeriesDependencies,
  expectedVectorTimeSeriesMetricType,
  extractVectorTimeSeriesSample,
  overlappingFlagsFromDependencies,
  samplesToChartData,
  VectorTimeSeriesSample,
} from "./vectorTimeSeriesData";

export {
  buildVectorTimeSeriesDependencies,
  defaultVectorTimeSeriesMode,
  getVectorTimeSeriesMode,
};

/**
 * Statistic plotted over time, one sample per vector source layer:
 *
 * - "count": overlapping feature count, optional percent of geography.
 * - "geometry": captured area (polygons) or length (lines), optional percent.
 * - "stats": min/mean/max envelope of a numeric column.
 * - "sum_proportion": column sum, optional percent of geography total.
 */
export function VectorTimeSeries({
  metrics,
  componentSettings,
  sources,
  loading,
  dependencies,
  sketchClass,
  geographies,
}: {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  componentSettings: VectorTimeSeriesSettings;
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  dependencies: MetricDependency[];
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    | "id"
    | "projectId"
    | "geometryType"
    | "form"
    | "clippingGeographies"
    | "project"
    | "validChildren"
  >;
  geographies: Pick<Geography, "id" | "name" | "stableIds">[];
}) {
  const { t } = useTranslation("reports");
  const { printing } = useContext(ReportUIStateContext);
  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const selectedGeography =
    componentSettings.geographyId === undefined ||
    componentSettings.geographyId === "auto"
      ? clippingGeography
      : geographies.find((g) => g.id === componentSettings.geographyId);
  const family =
    vectorGeometryFamily(sources[0]?.vectorGeometryType) ??
    vectorGeometryFamily(
      sources.find((s) => s.vectorGeometryType)?.vectorGeometryType
    );
  const mode = getVectorTimeSeriesMode(componentSettings, family);
  const column = componentSettings.column;
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings.minimumFractionDigits,
    unit: getVectorTimeSeriesUnit(componentSettings, family),
    unitDisplay: "short",
  });

  const supportsPercent = vectorTimeSeriesSupportsPercent(mode);
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

  const samples = useMemo(() => {
    const result: VectorTimeSeriesSample[] = [];
    if (loading || sources.length === 0 || metrics.length === 0) {
      return result;
    }
    const geographyId = selectedGeography?.id ?? clippingGeography?.id;
    if (!geographyId) {
      throw new Error("Primary geography not found.");
    }
    const combined = combineMetricsBySource(
      metrics,
      sources,
      geographyId,
      expectedVectorTimeSeriesMetricType(mode)
    );
    for (const source of sources) {
      const metricsForSource = combined[source.stableId];
      result.push(
        extractVectorTimeSeriesSample({
          stableId: source.stableId,
          title: source.tableOfContentsItem?.title || source.stableId,
          coverage: coverageForSource(source),
          mode,
          column,
          fragments: metricsForSource?.fragments,
          geographies: metricsForSource?.geographies,
        })
      );
    }
    return result;
  }, [
    loading,
    sources,
    metrics,
    clippingGeography?.id,
    selectedGeography?.id,
    mode,
    column,
  ]);

  const formatAbsoluteValue = useMemo(() => {
    if (mode === "count") {
      return (v: number) => formatters.count(v);
    }
    if (mode === "geometry") {
      return family === "line"
        ? (v: number) => formatters.distance(v)
        : (v: number) => formatters.area(v);
    }
    return (v: number) =>
      Number.isInteger(v) ? formatters.count(v) : formatters.decimal(v);
  }, [mode, family, formatters]);

  const {
    absoluteData,
    percentData,
    missingTemporal,
    missingColumn,
    percentUnavailable,
  } = useMemo(() => {
    if (loading || sources.length === 0 || metrics.length === 0) {
      const missing: string[] = [];
      if (!loading && metrics.length === 0) {
        for (const source of sources) {
          if (!coverageForSource(source)) {
            missing.push(source.tableOfContentsItem?.title || source.stableId);
          }
        }
      }
      return {
        absoluteData: [],
        percentData: [],
        missingTemporal: missing,
        missingColumn: [] as string[],
        percentUnavailable: false,
      };
    }
    return samplesToChartData({
      samples,
      mode,
      formatAbsolute: formatAbsoluteValue,
      formatEnvelope: (v) => formatters.decimal(v),
      formatPercent: (v) => formatters.percent(v),
    });
  }, [
    loading,
    sources,
    metrics.length,
    samples,
    mode,
    formatAbsoluteValue,
    formatters,
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
    return unionColumnValueDomain(sources, column || "") ?? undefined;
  }, [mode, componentSettings.yScale, sources, column]);

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

  const tabLabels = getRasterTimeSeriesTabLabels(componentSettings, {
    absolute:
      mode === "geometry"
        ? family === "line"
          ? t("Length")
          : t("Area")
        : mode === "count"
        ? t("Count")
        : t("Absolute"),
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
    const isPercent =
      tab === "percent" && !percentUnavailable && supportsPercent;
    const chartData = isPercent ? percentData : absoluteData;
    return chartData.length > 0;
  });

  const bufferSettings = useMemo(
    () => getBufferSettingsFromDependencies(dependencies || []),
    [dependencies]
  );
  const showColumnWarning = samples.some((sample) =>
    columnStatsHaveWarnings(
      sample.columnStats,
      mode === "stats" ? ["min", "mean", "max"] : ["sum"],
      (bufferSettings.distanceKm ?? 0) > 0
    )
  );
  const warningStats = samples.find((s) => s.columnStats)?.columnStats;

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
          {missingTemporal.length > 0 && samples.length === 0 ? (
            <Trans ns="reports">
              No layers in this chart have temporal coverage metadata yet.
            </Trans>
          ) : missingColumn.length > 0 ? (
            <Trans ns="reports">
              This column is not available on the selected layers.
            </Trans>
          ) : (
            <Trans ns="reports">
              The sketch does not overlap any features in this layer.
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
                  formatValue={
                    isPercent ? formatPercentValue : formatAbsoluteValue
                  }
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
      {!showLoading && showColumnWarning && (
        <div className="mx-3 mt-2 mb-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          <ColumnStatsWarning
            stats={warningStats}
            displayedStats={mode === "stats" ? ["min", "mean", "max"] : ["sum"]}
            buffered={(bufferSettings.distanceKm ?? 0) > 0}
          />
        </div>
      )}
      {!showLoading && missingTemporal.length > 0 && (
        <div className="mx-3 mt-2 mb-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-none mt-0.5" />
          <span>
            <Trans
              ns="reports"
              i18nKey="vectorTimeSeriesMissingTemporal"
              defaults="Not plotted (no temporal coverage): {{layers}}. This layer is missing temporal coverage metadata."
              values={{ layers: missingTemporal.join(", ") }}
            />
          </span>
        </div>
      )}
      {!showLoading && missingColumn.length > 0 && (
        <div className="mx-3 mt-2 mb-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-none mt-0.5" />
          <span>
            <Trans
              ns="reports"
              i18nKey="vectorTimeSeriesMissingColumn"
              defaults="Not plotted (column unavailable): {{layers}}."
              values={{ layers: missingColumn.join(", ") }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export const VectorTimeSeriesTooltipControls: ReportWidgetTooltipControls = ({
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
  const settings: VectorTimeSeriesSettings = useMemo(
    () => node.attrs?.componentSettings || {},
    [node.attrs?.componentSettings]
  );
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

  const selectedSources = useMemo(
    () =>
      stableIds
        .map((id) => overlaySources.find((s) => s.stableId === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [stableIds, overlaySources]
  );
  const family =
    vectorGeometryFamily(selectedSources[0]?.vectorGeometryType) ??
    vectorGeometryFamily(
      selectedSources.find((s) => s.vectorGeometryType)?.vectorGeometryType
    );
  const mode = getVectorTimeSeriesMode(settings, family);
  const numericColumns = useMemo(
    () => intersectNumericColumns(selectedSources),
    [selectedSources]
  );
  const column =
    settings.column && numericColumns.includes(settings.column)
      ? settings.column
      : defaultNumericColumn(numericColumns, settings.column);

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

  const handleUpdate = (patch: Partial<VectorTimeSeriesSettings>) => {
    onUpdate({
      componentSettings: {
        ...settings,
        ...patch,
      },
    });
  };

  const rebuildDependencies = (
    nextMode: VectorTimeSeriesMode,
    nextColumn: string | undefined,
    ids: string[],
    currentDeps: MetricDependency[]
  ) => {
    const overlapping = {
      ...overlappingFlagsFromDependencies(currentDeps),
    };
    for (const id of ids) {
      const source = overlaySources.find((s) => s.stableId === id);
      if (source?.containsOverlappingFeatures) {
        overlapping[id] = true;
      }
    }
    return buildVectorTimeSeriesDependencies({
      stableIds: ids,
      mode: nextMode,
      column: nextColumn,
      bufferSettings: getBufferSettingsFromDependencies(currentDeps),
      overlappingByStableId: overlapping,
    });
  };

  const handleModeChange = (next: VectorTimeSeriesMode) => {
    if (next === mode) return;
    const nextColumn =
      next === "stats" || next === "sum_proportion" ? column : settings.column;
    handleUpdate({ mode: next, column: nextColumn });
    onUpdateAllDependencies((currentDeps) =>
      rebuildDependencies(next, nextColumn, stableIds, currentDeps)
    );
  };

  const handleColumnChange = (nextColumn: string) => {
    handleUpdate({ column: nextColumn });
    if (mode !== "stats" && mode !== "sum_proportion") {
      return;
    }
    onUpdateAllDependencies((currentDeps) =>
      rebuildDependencies(mode, nextColumn, stableIds, currentDeps)
    );
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
      ...rebuildDependencies(mode, column, newIds, currentDeps),
    ]);
  };

  const handleRemoveLayer = (stableId: string) => {
    onUpdateAllDependencies((currentDeps) =>
      currentDeps.filter((d) => d.stableId !== stableId)
    );
  };

  const bufferSettings = useMemo(
    () => getBufferSettingsFromDependencies(dependencies),
    [dependencies]
  );
  const showBufferGeography = useMemo(
    () => dependencies.some((d) => d.subjectType === "geographies"),
    [dependencies]
  );

  const geometryLabel =
    family === "line" ? t("Length captured") : t("Area captured");
  const modeLabels: Record<VectorTimeSeriesMode, string> = {
    count: t("Feature count"),
    geometry: geometryLabel,
    stats: t("Min / Mean / Max"),
    sum_proportion: t("Sum captured"),
  };
  const modeOptions: Array<{
    value: VectorTimeSeriesMode;
    label: string;
    description: string;
  }> = [
    {
      value: "count",
      label: "Feature count",
      description:
        "Number of overlapping features, with the option to show the percent of geography total.",
    },
  ];
  if (family !== "point") {
    modeOptions.push({
      value: "geometry",
      label: family === "line" ? "Length captured" : "Area captured",
      description:
        family === "line"
          ? "Total overlapping line length, with the option to show the percent of geography total."
          : "Total overlapping area, with the option to show the percent of geography total.",
    });
  }
  if (numericColumns.length > 0) {
    modeOptions.push(
      {
        value: "stats",
        label: "Mean, Min, and Max Values",
        description: "Envelope of a numeric column for overlapping features.",
      },
      {
        value: "sum_proportion",
        label: "Sum captured",
        description:
          "Sum of a numeric column within the sketch, with optional percent of geography total.",
      }
    );
  }

  const absoluteLabel =
    mode === "geometry"
      ? family === "line"
        ? t("Length")
        : t("Area")
      : mode === "count"
      ? t("Count")
      : t("Absolute");
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
            {modeOptions.map((option) => (
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
      {(mode === "stats" || mode === "sum_proportion") &&
        numericColumns.length > 0 && (
          <LabeledDropdown
            label={t("Column")}
            value={column || numericColumns[0]}
            options={numericColumns.map((name) => ({
              value: name,
              label: name,
            }))}
            onChange={handleColumnChange}
            ariaLabel={t("Column")}
          />
        )}
      {mode === "geometry" && family === "polygon" && (
        <UnitSelector
          unitType="area"
          value={getVectorTimeSeriesUnit(settings, family) as AreaUnit}
          onChange={(unit) => handleUpdate({ unit })}
          unitDisplay="short"
        />
      )}
      {mode === "geometry" && family === "line" && (
        <UnitSelector
          unitType="distance"
          value={getVectorTimeSeriesUnit(settings, family) as LengthUnit}
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
                allowedGeometryTypes={pickerGeometryTypesForFamily(family)}
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
        <VectorTimeSeriesHeadingsEditor
          absoluteLabel={absoluteLabel}
          percentLabel={t("Percent")}
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

function VectorTimeSeriesHeadingsEditor(props: {
  absoluteLabel: string;
  percentLabel: string;
  componentSettings: VectorTimeSeriesSettings;
  onUpdate: (attrs: { componentSettings: VectorTimeSeriesSettings }) => void;
}) {
  // Loaded lazily so this module does not import widgets.tsx at init time
  // (that cycle left VectorTimeSeries undefined while the router memoized it).
  const { TableHeadingsEditor } = require("./widgets");
  return (
    <TableHeadingsEditor
      labelKeys={["absoluteLabel", "percentLabel"]}
      labelDisplayNames={[props.absoluteLabel, props.percentLabel]}
      componentSettings={props.componentSettings}
      onUpdate={props.onUpdate}
    />
  );
}
