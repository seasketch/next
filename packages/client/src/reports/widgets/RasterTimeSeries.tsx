import { useMemo, useState } from "react";
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
import { TimeSeriesChart, TimeSeriesDatum } from "./charts/TimeSeriesChart";
import { LabeledDropdown } from "./LabeledDropdown";
import { VrmSelector } from "./VrmSelector";
import {
  ReportLayerMultiPicker,
  ReportSourceLayerValue,
} from "./ReportLayerMultiPicker";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
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

export { temporalPositionForSource, coverageForSource };

/**
 * Statistic plotted over time, one sample per source layer:
 *
 * - "stats": min/mean/max envelope of raster values (e.g. Degree Heating
 *   Weeks). Uses `raster_stats` fragment metrics only.
 * - "area": raster area captured by the sketch, in km² or as a percent of the
 *   primary geography's raster area (e.g. mangrove extent). Uses
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
  /** Tooltip / axis label override (e.g. "Degree Heating Weeks"). */
  valueLabel?: string;
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
  mode: RasterTimeSeriesMode
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
  return deps;
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
  const { clippingGeography } = usePrimaryGeography(sketchClass, geographies);
  const formatters = useNumberFormatters({
    minimumFractionDigits: componentSettings.minimumFractionDigits,
  });

  const mode = getRasterTimeSeriesMode(componentSettings);
  const colorCoded = componentSettings.colorCoded !== false;
  const supportsPercent = mode !== "stats";
  const [viewerPresentation, setViewerPresentation] = useState<
    "absolute" | "percent" | null
  >(null);
  const presentation = supportsPercent
    ? viewerPresentation ??
      (componentSettings.defaultPresentation === "percent"
        ? "percent"
        : "absolute")
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

  const { data, missingTemporal, percentUnavailable } = useMemo(() => {
    const missing: string[] = [];
    let percentUnavailable = false;
    const empty = {
      data: [] as TimeSeriesDatum[],
      missingTemporal: missing,
      percentUnavailable,
    };
    if (loading || sources.length === 0 || metrics.length === 0) {
      // Don't treat in-flight metrics as a coverage error. Sketch switches
      // briefly empty the metric list while overlay sources are still present.
      if (!loading && metrics.length === 0) {
        for (const source of sources) {
          if (!coverageForSource(source)) {
            missing.push(source.tableOfContentsItem?.title || source.stableId);
          }
        }
      }
      return empty;
    }
    if (!clippingGeography?.id) {
      throw new Error("Primary geography not found.");
    }
    const combined = combineMetricsBySource(
      metrics,
      sources,
      clippingGeography.id,
      mode === "area" ? "raster_overlay_area" : "raster_stats"
    );
    const data: TimeSeriesDatum[] = [];
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
        if (!band) continue;
        data.push({
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
        data.push({
          x: coverage.start,
          xEnd: coverage.end,
          span: coverage.span,
          formattedX: coverage.label,
          value:
            presentation === "percent" && fraction !== null
              ? fraction
              : fragmentTotal,
          formattedValue:
            presentation === "percent" && fraction !== null
              ? formatters.percent(fraction)
              : formatters.area(fragmentTotal),
          ...(colorCoded
            ? timeSeriesDatumColors({
                styles: source.mapboxGlStyles,
                mode,
                value: fragmentTotal,
              })
            : {}),
        });
      } else {
        const fragmentBand = (
          metricsForSource.fragments as RasterStats | undefined
        )?.value?.bands?.[0];
        if (!fragmentBand) continue;
        const geographyBand = (
          metricsForSource.geographies as RasterStats | undefined
        )?.value?.bands?.[0];
        const fraction =
          geographyBand && geographyBand.sum > 0
            ? fragmentBand.sum / geographyBand.sum
            : null;
        if (fraction === null) percentUnavailable = true;
        data.push({
          x: coverage.start,
          xEnd: coverage.end,
          span: coverage.span,
          formattedX: coverage.label,
          value:
            presentation === "percent" && fraction !== null
              ? fraction
              : fragmentBand.sum,
          formattedValue:
            presentation === "percent" && fraction !== null
              ? formatters.percent(fraction)
              : formatters.decimal(fragmentBand.sum),
          ...(colorCoded
            ? timeSeriesDatumColors({
                styles: source.mapboxGlStyles,
                mode,
                value: fragmentBand.sum,
              })
            : {}),
        });
      }
    }
    return { data, missingTemporal: missing, percentUnavailable };
  }, [
    loading,
    sources,
    metrics,
    clippingGeography?.id,
    mode,
    presentation,
    formatters,
    colorCoded,
  ]);

  const showPercent = presentation === "percent" && !percentUnavailable;

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

  const yDomain = useMemo((): [number, number] | undefined => {
    if (showPercent) {
      return [0, 1];
    }
    if (mode !== "stats") {
      return undefined;
    }
    if (componentSettings.yScale === "results") {
      return undefined;
    }
    return unionRasterValueDomain(sources) ?? undefined;
  }, [showPercent, mode, componentSettings.yScale, sources]);

  const formatValue = useMemo(() => {
    if (showPercent) {
      return (v: number) => formatters.percent(v);
    }
    if (mode === "area") {
      return (v: number) => formatters.area(v);
    }
    // Integer-aware so axis ticks stay consistent ("0, 2, 4 … 10" rather
    // than mixing "8.0" and "10").
    return (v: number) =>
      Number.isInteger(v) ? formatters.count(v) : formatters.decimal(v);
  }, [showPercent, mode, formatters]);

  const valueLabel =
    componentSettings.valueLabel ||
    (mode === "stats"
      ? t("Mean")
      : mode === "area"
      ? t("Area")
      : t("Sum"));

  if (!loading && dependencyStableIds.length === 0) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No data available.</Trans>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden p-3 relative">
      {supportsPercent && !showLoading && data.length > 0 && !percentUnavailable && (
        <div className="absolute top-2 right-2 flex rounded-md border border-gray-200 overflow-hidden print:hidden z-10 text-xs font-medium">
          <button
            type="button"
            aria-label={t("Absolute values")}
            title={
              mode === "area" ? t("Area in km²") : t("Absolute values")
            }
            onClick={() => setViewerPresentation("absolute")}
            className={`px-2 py-1 ${
              presentation === "absolute"
                ? "bg-gray-100 text-gray-900"
                : "bg-white text-gray-400 hover:text-gray-700"
            }`}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span>#</span>
          </button>
          <button
            type="button"
            aria-label={t("Percent of geography")}
            title={t("Percent of geography")}
            onClick={() => setViewerPresentation("percent")}
            className={`px-2 py-1 border-l border-gray-200 ${
              presentation === "percent"
                ? "bg-gray-100 text-gray-900"
                : "bg-white text-gray-400 hover:text-gray-700"
            }`}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span>%</span>
          </button>
        </div>
      )}
      {showLoading ? (
        <div className="py-2">
          <div
            className="w-full bg-gray-100 animate-pulse rounded"
            style={{ height: 160 }}
            aria-hidden
          />
          <div className="pt-2 text-sm text-gray-500">
            <MetricLoadingDots />
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="text-gray-600 text-sm py-2">
          {missingTemporal.length > 0 ? (
            <Trans ns="reports">
              No layers in this chart have temporal coverage metadata yet.
            </Trans>
          ) : (
            <Trans ns="reports">
              The sketch does not overlap this layer.
            </Trans>
          )}
        </div>
      ) : (
        <TimeSeriesChart
          data={data}
          mode={mode === "stats" ? "envelope" : "line"}
          color={DEFAULT_TIME_SERIES_COLOR}
          formatValue={formatValue}
          formatX={(ms) => formatTimeTick(ms, xPrecision)}
          yDomain={yDomain}
          xTickDensity={
            componentSettings.xTickDensity === "less" ||
            componentSettings.xTickDensity === "more"
              ? componentSettings.xTickDensity
              : "auto"
          }
          valueLabel={valueLabel}
          minLabel={t("Min")}
          maxLabel={t("Max")}
        />
      )}
      {!showLoading && missingTemporal.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
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
    label: "Min / Mean / Max",
    description:
      "Envelope of raster values within the sketch. Best for continuous rasters like Degree Heating Weeks.",
  },
  {
    value: "area",
    label: "Area captured",
    description:
      "Raster area (km²) captured by the sketch, with a percent-of-geography toggle. Best for extent rasters like mangrove cover.",
  },
  {
    value: "sum_proportion",
    label: "Sum captured",
    description:
      "Sum of raster values within the sketch, with a percent-of-geography toggle. Best for quantity rasters like fishing effort.",
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
      return buildRasterTimeSeriesDependencies(ids, next);
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
      ...buildRasterTimeSeriesDependencies(newIds, mode),
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
            {mode !== "stats" && (
              <label className="flex items-center gap-2 px-2 pt-2 text-xs text-gray-700 border-t border-gray-100">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gray-300 text-gray-600 focus:ring-slate-500"
                  checked={settings.defaultPresentation === "percent"}
                  onChange={(e) =>
                    handleUpdate({
                      defaultPresentation: e.target.checked
                        ? "percent"
                        : "absolute",
                    })
                  }
                />
                {t("Show percent of geography by default")}
              </label>
            )}
          </div>
        </TooltipPopoverContent>
      </Popover.Root>
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
      <TableHeadingsEditor
        labelKeys={["valueLabel"]}
        labelDisplayNames={[t("Value label")]}
        componentSettings={settings}
        onUpdate={onUpdate}
      />
      <TooltipMorePopover>
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
              { value: "domain", label: t("Full data range") },
              { value: "results", label: t("Scale to results") },
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
              {t("Scale to results")}
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
