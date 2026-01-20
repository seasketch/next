import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  combineMetricsForFragments,
  Metric,
  MetricDependency,
  RasterStats,
  subjectIsFragment,
} from "overlay-engine";
import { Bucket, isRasterInfo, RasterInfo } from "@seasketch/geostats-types";
import { Expression } from "mapbox-gl";
import { scaleLinear } from "d3-scale";
import { ExpressionEvaluator } from "../../dataLayers/legends/ExpressionEvaluator";
import { ReportWidget, TooltipBooleanConfigurationOption } from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { LabeledDropdown } from "./LabeledDropdown";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { useReportContext } from "../ReportContext";
import { UnitSelector } from "./UnitSelector";
import {
  getLocalizedUnitLabel,
  isAreaUnit,
  isLengthUnit,
  LengthUnit,
} from "../utils/units";
import { FormLanguageContext } from "../../formElements/FormElement";

type RasterValuesHistogramSettings = {
  colorCoded?: boolean;
  labelDensity?: "none" | "less" | "default" | "more";
  showTooltips?: boolean;
  showBackgroundHistogram?: boolean;
  displayStats?: Partial<Record<RasterHistogramStatKey, boolean>>;
  title?: string;
  minLabel?: string;
  maxLabel?: string;
  meanLabel?: string;
  sumLabel?: string;
  countLabel?: string;
  invalidLabel?: string;
  unit?: LengthUnit;
  unitDisplay?: "short" | "long";
};

type HistogramEntry = { value: number; count: number };
type HistogramBar = { value: number; count: number; fraction: number };
type RasterHistogramStatKey =
  | "min"
  | "max"
  | "mean"
  | "sum"
  | "count"
  | "invalid";

const statOrder: RasterHistogramStatKey[] = [
  "min",
  "max",
  "mean",
  "sum",
  "count",
  "invalid",
];

const statLabels = (
  t: (key: string) => string,
  settings?: RasterValuesHistogramSettings
): Record<RasterHistogramStatKey, string> => ({
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  sum: settings?.sumLabel || t("Sum"),
  count: settings?.countLabel || t("Count"),
  invalid: settings?.invalidLabel || t("Invalid"),
});

function buildHistogramExpression(expression: Expression): Expression {
  const fnType = expression[0];
  return /interpolate/.test(fnType)
    ? [
      expression[0],
      expression[1],
      ["get", "value"],
      ...expression.slice(3),
    ]
    : [expression[0], ["get", "value"], ...expression.slice(2)];
}

function buildHistogramBuckets({
  baseBuckets,
  histogram,
  count,
}: {
  baseBuckets?: Bucket[];
  histogram: [number, number][];
  count: number;
}): HistogramBar[] {
  if (!baseBuckets?.length) {
    return histogram.map(([value, entryCount]) => ({
      value,
      count: entryCount,
      fraction: count > 0 ? entryCount / count : 0,
    }));
  }

  const entries: HistogramEntry[] = [];
  for (const bucket of baseBuckets) {
    if (bucket[1] === null) continue;
    entries.push({ value: bucket[0], count: 0 });
  }

  for (const [value, entryCount] of histogram) {
    const target =
      entries.find((entry) => entry.value >= value) || entries[entries.length - 1];
    if (target) {
      target.count += entryCount;
    }
  }

  return entries.map((entry) => ({
    value: entry.value,
    count: entry.count,
    fraction: count > 0 ? entry.count / count : 0,
  }));
}

function getLabelDomain(baseBuckets?: Bucket[]): [number, number] | null {
  if (!baseBuckets?.length) return null;
  const buckets = baseBuckets.filter((bucket) => bucket[1] !== null);
  if (!buckets.length) return null;
  const min = buckets[0][0];
  const max = buckets[buckets.length - 1][0];
  if (Number.isFinite(min) && Number.isFinite(max) && min !== max) {
    return [min, max];
  }
  return null;
}

function getBinBounds(baseBuckets?: Bucket[]): Array<{ min: number; max: number }> {
  if (!baseBuckets?.length) return [];
  const buckets = baseBuckets.filter((bucket) => bucket[1] !== null);
  return buckets.map((bucket, index) => {
    const next = buckets[index + 1];
    return {
      min: bucket[0],
      max: next ? next[0] : bucket[0],
    };
  });
}

function getRasterInfo(
  source?: { geostats?: RasterInfo | unknown }
): RasterInfo | undefined {
  if (!source?.geostats) return undefined;
  if (isRasterInfo(source.geostats)) {
    return source.geostats as RasterInfo;
  }
  return undefined;
}

function getRasterColorExpression(
  mapboxGlStyles?: Array<{ type?: string; paint?: Record<string, any> }>
): Expression | null {
  if (!mapboxGlStyles?.length) return null;
  for (const layer of mapboxGlStyles) {
    if (layer.type !== "raster") continue;
    const expr = layer.paint?.["raster-color"];
    if (expr) return expr as Expression;
  }
  return null;
}

export const RasterValuesHistogram: ReportWidget<RasterValuesHistogramSettings> =
  ({ metrics, componentSettings, sources, loading }) => {
    const { t } = useTranslation("reports");
    const langContext = useContext(FormLanguageContext);
    const source = sources?.[0];
    const rasterInfo = useMemo(() => getRasterInfo(source), [source]);
    const colorCoded = componentSettings?.colorCoded !== false;
    const labelDensity = componentSettings?.labelDensity || "default";
    const showTooltips = componentSettings?.showTooltips !== false;
    const showBackgroundHistogram =
      componentSettings?.showBackgroundHistogram === true;
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

    const bandStats = useMemo(() => {
      const fragmentMetrics = metrics.filter(
        (m) => subjectIsFragment(m.subject) && m.type === "raster_stats" && m.value
      ) as unknown as RasterStats[];

      if (!fragmentMetrics.length || loading) {
        return null;
      }

      const combined = combineMetricsForFragments(
        fragmentMetrics as Pick<Metric, "type" | "value">[]
      ) as RasterStats;

      return combined.value.bands[0] || null;
    }, [metrics, loading]);


    const baseBuckets = rasterInfo?.bands?.[0]?.stats?.histogram;
    const histogramBuckets = useMemo(() => {
      const histogram =
        bandStats?.histogram?.map((entry) => entry as [number, number]) || [];
      const totalCount = bandStats?.count || 0;
      return buildHistogramBuckets({
        baseBuckets,
        histogram,
        count: totalCount,
      });
    }, [baseBuckets, bandStats]);

    const labelDomain = useMemo(
      () => getLabelDomain(baseBuckets),
      [baseBuckets]
    );

    const binBounds = useMemo(() => getBinBounds(baseBuckets), [baseBuckets]);

    const rasterColorExpression = useMemo(
      () => getRasterColorExpression(source?.mapboxGlStyles as any),
      [source?.mapboxGlStyles]
    );

    const evaluator = useMemo(() => {
      if (!colorCoded || !rasterColorExpression) return null;
      try {
        return ExpressionEvaluator.parse(
          buildHistogramExpression(rasterColorExpression),
          "color"
        );
      } catch (error) {
        console.warn("Failed to parse raster color expression", error);
        return null;
      }
    }, [colorCoded, rasterColorExpression]);

    const maxFraction = useMemo(() => {
      return histogramBuckets.reduce(
        (max, bucket) => (bucket.fraction > max ? bucket.fraction : max),
        0
      );
    }, [histogramBuckets]);

    const bars = useMemo(() => {
      return histogramBuckets.map((bucket) => {
        const value = bucket.value;
        const count = bucket.count || 0;
        const fraction = bucket.fraction || 0;
        const color = evaluator
          ? evaluator
            .evaluate({
              type: "Feature",
              properties: { value },
              geometry: { type: "Point", coordinates: [0, 0] },
            })
            .toString()
          : "#668";
        return { value, count, fraction, color };
      });
    }, [histogramBuckets, evaluator]);

    const backgroundBars = useMemo(() => {
      const bandInfo = rasterInfo?.bands?.[0];
      const histogram = bandInfo?.stats?.histogram;
      const totalCount = bandInfo?.count || 0;
      if (!histogram || !histogram.length) return [];
      return histogram
        .filter((bucket) => bucket[1] !== null)
        .map((bucket) => ({
          value: bucket[0],
          fraction: bucket[1] as number
        }));
    }, [rasterInfo]);

    const layerTotalCount = useMemo(() => {
      const bandInfo = rasterInfo?.bands?.[0];
      if (!bandInfo?.stats?.histogram) return 0;
      const sum = bandInfo.stats.histogram.reduce((acc, bucket) => {
        return acc + (bucket[1] === null ? 0 : bucket[1]);
      }, 0);
      return bandInfo.count || sum;
    }, [rasterInfo]);

    const backgroundMaxFraction = useMemo(() => {
      return backgroundBars.reduce(
        (max, bucket) => (bucket.fraction > max ? bucket.fraction : max),
        0
      );
    }, [backgroundBars]);

    const labelScale = useMemo(() => {
      if (!labelDomain) return null;
      return scaleLinear().domain(labelDomain).range([0, 100]);
    }, [labelDomain]);

    const labelTicks = useMemo(() => {
      if (!labelScale || !labelDomain || labelDensity === "none") return [];
      const [min, max] = labelDomain;
      if (labelDensity === "less") {
        return min === max ? [min] : [min, max];
      }
      const desiredCount = labelDensity === "more" ? 9 : 5;
      return labelScale.ticks(desiredCount);
    }, [labelScale, labelDensity, labelDomain]);

    const labelFormatter = useMemo(() => {
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
      });
    }, []);

    const countFormatter = useMemo(
      () => new Intl.NumberFormat(undefined),
      []
    );

    const formatValueWithUnit = (value: number, formatter = labelFormatter) => {
      const formatted = formatter.format(value);
      return unitLabel ? `${formatted} ${unitLabel}` : formatted;
    };

    const percentFormatter = useMemo(
      () =>
        new Intl.NumberFormat(undefined, {
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        }),
      []
    );

    const statFormatter = useMemo(
      () =>
        new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 2,
        }),
      []
    );

    const displayStats = useMemo(() => {
      return componentSettings?.displayStats || {};
    }, [componentSettings?.displayStats]);

    const statsToShow = useMemo(
      () => statOrder.filter((stat) => displayStats[stat]),
      [displayStats]
    );

    const meanPosition = useMemo(() => {
      if (!displayStats.mean || !labelScale || !bandStats) return null;
      const mean = bandStats.mean;
      if (mean === undefined || mean === null || Number.isNaN(mean)) {
        return null;
      }
      return labelScale(mean);
    }, [displayStats.mean, labelScale, bandStats]);

    const meanColor = "#888";

    const formatStatValue = (stat: RasterHistogramStatKey) => {
      if (!bandStats) return "—";
      const value = bandStats[stat];
      if (value === undefined || value === null || Number.isNaN(value)) {
        return "—";
      }
      if (stat === "count" || stat === "invalid") {
        return countFormatter.format(value);
      }
      return formatValueWithUnit(value, statFormatter);
    };

    if (loading) {
      return (
        <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
          <div className="px-3 py-3 flex items-center justify-center">
            <MetricLoadingDots />
          </div>
        </div>
      );
    }

    if (!bandStats || !histogramBuckets.length) {
      return (
        <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
          <div className="px-3 py-3 text-sm text-gray-500">
            {t("No histogram available")}
          </div>
        </div>
      );
    }

    return (
      <Tooltip.Provider>
        <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 border-b">
            {componentSettings?.title || t("Histogram")}
          </div>
          <div className="px-3 py-3">
            <div className="relative h-32 w-full flex items-end gap-[1px] bg-gray-50 border border-gray-200 rounded pt-2">
              {meanPosition !== null && (
                <div
                  className="absolute top-full flex items-start z-10"
                  style={{
                    left: `${meanPosition}%`,
                    transform: "translateX(-50%)",
                    marginTop: "2px"
                  }}
                >
                  <div
                    className="w-0 h-0"
                    style={{
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderBottom: `7px solid ${meanColor}`,
                    }}
                  />
                </div>
              )}
              {bars.map((bar, index) => {
                const bounds = binBounds[index] || {
                  min: bar.value,
                  max: bar.value,
                };
                const background = showBackgroundHistogram
                  ? backgroundBars[index]
                  : undefined;
                const overlayHeight =
                  bar.fraction && maxFraction > 0
                    ? Math.max((bar.fraction / maxFraction) * 100, 1)
                    : 1;
                const backgroundHeight =
                  background && backgroundMaxFraction > 0
                    ? Math.max(
                      (background.fraction / backgroundMaxFraction) * 100,
                      1
                    )
                    : 1;
                if (!showTooltips) {
                  return (
                    <div key={`${bar.value}-${index}`} className="flex-1 h-full">
                      <div
                        className="relative flex-1 h-full"
                        title={!showTooltips ? String(bar.value) : undefined}
                      >
                        {background && (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-gray-200/70"
                            style={{ height: `${backgroundHeight}%` }}
                          />
                        )}
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: `${overlayHeight}%`,
                            backgroundColor: bar.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <Tooltip.Root key={`${bar.value}-${index}`} delayDuration={100}>
                    <div
                      className="relative flex-1 h-full"
                      title={!showTooltips ? String(bar.value) : undefined}
                    >
                      <Tooltip.Trigger asChild>
                        {
                          background && backgroundHeight > overlayHeight ?
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-gray-200/10 z-20"
                              style={{ height: `${backgroundHeight}%` }}
                            /> : <div
                              className="absolute bottom-0 left-0 right-0 opacity-10 z-20"
                              style={{
                                height: `${overlayHeight}%`,
                                backgroundColor: bar.color,
                              }}
                            />
                        }
                      </Tooltip.Trigger>
                      <div>
                        {background && (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-gray-200/70"
                            style={{ height: `${backgroundHeight}%` }}
                          />
                        )}
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: `${overlayHeight}%`,
                            backgroundColor: bar.color,
                          }}
                        />
                      </div>
                    </div>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 rounded-lg shadow-xl px-2 py-1 text-xs text-white z-50"
                        side="top"
                        sideOffset={4}
                        align="center"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[11px] uppercase tracking-wide text-gray-300">
                            {t("Bin")}
                          </div>
                          {bounds.min === bounds.max ? (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-300">{t("Value")}</span>
                              <span>{`>=`} {formatValueWithUnit(bounds.min)}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-300">{t("Min")}</span>
                                <span>{formatValueWithUnit(bounds.min)}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-300">{t("Max")}</span>
                                <span>{formatValueWithUnit(bounds.max)}</span>
                              </div>
                            </>
                          )}

                          <div className="flex justify-between gap-2 pt-0.5 border-t border-white/10">
                            <span className="text-gray-300">
                              {t("Overlay cells")}
                            </span>
                            <span>{countFormatter.format(bar.count)}</span>
                          </div>
                          {background && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-300">
                                {t("Layer cells")}
                              </span>
                              <span>
                                {background.fraction > 0 ? percentFormatter.format(background.fraction) : "—"}
                              </span>
                            </div>
                          )}
                        </div>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </div>
            {labelScale && labelDensity !== "none" && (
              <div className="relative mt-2 h-4 text-[10px] text-gray-500">
                {labelTicks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${labelScale(tick)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <span className="block h-1 w-px bg-gray-300 mb-0.5" />
                    <span className="whitespace-nowrap">
                      {labelFormatter.format(tick)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {statsToShow.length > 0 && (
              <div className="mt-4 rounded-md border border-gray-200  px-3 py-2 bg-gray-50">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-700">
                  {statsToShow.map((stat) => (
                    <div key={stat} className="flex justify-between gap-2">
                      <span className="uppercase tracking-wide text-gray-500 inline-flex items-center gap-1">
                        {statLabels(t, componentSettings)[stat]}
                        {stat === "mean" && meanColor ? (
                          <span
                            className="inline-block w-0 h-0"
                            style={{
                              borderLeft: "4px solid transparent",
                              borderRight: "4px solid transparent",
                              borderBottom: `6px solid ${meanColor}`,
                            }}
                          />
                        ) : null}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {formatStatValue(stat)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Tooltip.Provider>
    );
  };

export const RasterValuesHistogramTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate }) => {
    const { t } = useTranslation("admin:reports");
    const reportContext = useReportContext();
    const componentSettings = node.attrs?.componentSettings || {};
    const dependencies = useMemo(
      () => (node.attrs?.metrics || []) as MetricDependency[],
      [node.attrs?.metrics]
    );

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
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
              >
                <Pencil2Icon className="w-3 h-3" />
                {t("labels")}
              </button>
            </Popover.Trigger>
            <TooltipPopoverContent title={t("Labels")}>
              <div className="space-y-3 px-1">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("Histogram")}
                  </label>
                  <input
                    type="text"
                    value={componentSettings?.title || ""}
                    onChange={(e) =>
                      onUpdate({
                        componentSettings: {
                          ...componentSettings,
                          title: e.target.value || undefined,
                        },
                      })
                    }
                    placeholder={t("Histogram")}
                    className="w-48 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {t("Statistics")}
                  </div>
                  <div className="space-y-2">
                    {statOrder.map((stat) => {
                      // eslint-disable-next-line i18next/no-literal-string
                      const labelKey = `${stat}Label` as
                        | "minLabel"
                        | "maxLabel"
                        | "meanLabel"
                        | "sumLabel"
                        | "countLabel"
                        | "invalidLabel";
                      return (
                        <div key={stat}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {statLabels(t, componentSettings)[stat]}
                          </label>
                          <input
                            type="text"
                            value={componentSettings?.[labelKey] || ""}
                            onChange={(e) =>
                              onUpdate({
                                componentSettings: {
                                  ...componentSettings,
                                  [labelKey]: e.target.value || undefined,
                                },
                              })
                            }
                            placeholder={statLabels(t)[stat]}
                            className="w-48 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TooltipPopoverContent>
          </Popover.Root>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
              >
                <Pencil2Icon className="w-3 h-3" />
                {t("statistics")}
              </button>
            </Popover.Trigger>
            <TooltipPopoverContent title={t("Statistics")}>
              <div className="px-1 space-y-1 w-48">
                {statOrder.map((stat) => (
                  <TooltipBooleanConfigurationOption
                    key={stat}
                    label={statLabels(t, componentSettings)[stat]}
                    checked={!!componentSettings?.displayStats?.[stat]}
                    onChange={(next) =>
                      onUpdate({
                        componentSettings: {
                          ...componentSettings,
                          displayStats: {
                            ...(componentSettings.displayStats || {}),
                            [stat]: next,
                          },
                        },
                      })
                    }
                  />
                ))}
              </div>
            </TooltipPopoverContent>
          </Popover.Root>
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
          <LabeledDropdown
            label={t("axis labels")}
            value={componentSettings?.labelDensity || "default"}
            options={[
              { value: "none", label: t("none") },
              { value: "less", label: t("less") },
              { value: "default", label: t("default") },
              { value: "more", label: t("more") },
            ]}
            onChange={(value) =>
              onUpdate({
                componentSettings: {
                  ...componentSettings,
                  labelDensity: value as
                    | "none"
                    | "less"
                    | "default"
                    | "more",
                },
              })
            }
          />
          <TooltipMorePopover>
            <TooltipBooleanConfigurationOption
              label={t("Color based on cartography")}
              checked={componentSettings?.colorCoded !== false}
              onChange={(next) =>
                onUpdate({
                  componentSettings: {
                    ...componentSettings,
                    colorCoded: next,
                  },
                })
              }
            />
            <TooltipBooleanConfigurationOption
              label={t("Show tooltips")}
              checked={componentSettings?.showTooltips !== false}
              onChange={(next) =>
                onUpdate({
                  componentSettings: {
                    ...componentSettings,
                    showTooltips: next,
                  },
                })
              }
            />
            <TooltipBooleanConfigurationOption
              label={t("Include whole-layer distribution")}
              checked={componentSettings?.showBackgroundHistogram === true}
              onChange={(next) =>
                onUpdate({
                  componentSettings: {
                    ...componentSettings,
                    showBackgroundHistogram: next,
                  },
                })
              }
            />
            <div className="flex">
              <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
                {t("Metric Type")}
              </span>
              <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
                {t("Raster values histogram")}
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
