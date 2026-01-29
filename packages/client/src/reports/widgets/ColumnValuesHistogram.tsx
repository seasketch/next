import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ColumnValuesMetric,
  Metric,
  MetricDependency,
  NumberColumnValueStats,
  combineMetricsForFragments,
  isNumberColumnValueStats,
  subjectIsFragment,
} from "overlay-engine";
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
import {
  Bucket,
  GeostatsLayer,
  isGeostatsLayer,
  isNumericGeostatsAttribute,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import {
  hasGetExpressionForProperty,
  isExpression,
} from "../../dataLayers/legends/utils";
import { UnitSelector } from "./UnitSelector";
import {
  getLocalizedUnitLabel,
  isAreaUnit,
  isLengthUnit,
  LengthUnit,
} from "../utils/units";
import { FormLanguageContext } from "../../formElements/FormElement";

type ColumnValuesHistogramSettings = {
  colorCoded?: boolean;
  labelDensity?: "none" | "less" | "default" | "more";
  showTooltips?: boolean;
  showBackgroundHistogram?: boolean;
  displayStats?: Partial<Record<ColumnValuesHistogramStatKey, boolean>>;
  title?: string;
  minLabel?: string;
  maxLabel?: string;
  meanLabel?: string;
  sumLabel?: string;
  countLabel?: string;
  countDistinctLabel?: string;
  stdDevLabel?: string;
  column?: string;
  unit?: LengthUnit;
  unitDisplay?: "short" | "long";
};

type HistogramEntry = { value: number; count: number };
type HistogramBar = { value: number; count: number; fraction: number };
type ColumnValuesHistogramStatKey =
  | "min"
  | "max"
  | "mean"
  | "sum"
  | "count"
  | "countDistinct"
  | "stdDev";

const statOrder: ColumnValuesHistogramStatKey[] = [
  "min",
  "max",
  "mean",
  "stdDev",
  "sum",
  "count",
  "countDistinct",
];

const statLabels = (
  t: (key: string) => string,
  settings?: ColumnValuesHistogramSettings
): Record<ColumnValuesHistogramStatKey, string> => ({
  min: settings?.minLabel || t("Min"),
  max: settings?.maxLabel || t("Max"),
  mean: settings?.meanLabel || t("Mean"),
  stdDev: settings?.stdDevLabel || t("Std Dev"),
  sum: settings?.sumLabel || t("Sum"),
  count: settings?.countLabel || t("Count"),
  countDistinct: settings?.countDistinctLabel || t("Distinct"),
});

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

function getLabelDomain(
  baseBuckets?: Bucket[],
  stats?: NumberColumnValueStats | null
): [number, number] | null {
  if (baseBuckets?.length) {
    const buckets = baseBuckets.filter((bucket) => bucket[1] !== null);
    if (!buckets.length) return null;
    const min = buckets[0][0];
    const max = buckets[buckets.length - 1][0];
    if (Number.isFinite(min) && Number.isFinite(max) && min !== max) {
      return [min, max];
    }
  }
  if (!stats) return null;
  const { min, max } = stats;
  if (Number.isFinite(min) && Number.isFinite(max) && min !== max) {
    return [min, max];
  }
  const values = stats.histogram
    .map((entry) => entry[0])
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;
  const fallbackMin = Math.min(...values);
  const fallbackMax = Math.max(...values);
  if (!Number.isFinite(fallbackMin) || !Number.isFinite(fallbackMax)) {
    return null;
  }
  return fallbackMin === fallbackMax ? null : [fallbackMin, fallbackMax];
}

function getBinBounds(
  histogram: [number, number][],
  baseBuckets?: Bucket[]
): Array<{ min: number; max: number }> {
  if (baseBuckets?.length) {
    const buckets = baseBuckets.filter((bucket) => bucket[1] !== null);
    return buckets.map((bucket, index) => {
      const next = buckets[index + 1];
      return {
        min: bucket[0],
        max: next ? next[0] : bucket[0],
      };
    });
  }
  if (!histogram.length) return [];
  return histogram.map((entry, index) => {
    const next = histogram[index + 1];
    return {
      min: entry[0],
      max: next ? next[0] : entry[0],
    };
  });
}

type ColumnColorSource =
  | { type: "expression"; expression: Expression }
  | { type: "color"; color: string };

function getColumnColorSource(
  mapboxGlStyles?: Array<{ type?: string; paint?: Record<string, any> }>,
  column?: string,
  geometryType?: string
): ColumnColorSource | null {
  if (!mapboxGlStyles?.length) return null;
  const paintProps =
    geometryType === "LineString" || geometryType === "MultiLineString"
      ? ["line-color"]
      : geometryType === "Point" || geometryType === "MultiPoint"
        ? ["circle-color"]
        : ["fill-color"];

  for (const layer of mapboxGlStyles) {
    const paint = layer.paint;
    if (!paint) continue;
    for (const prop of paintProps) {
      const value = paint[prop];
      if (typeof value === "string") {
        return { type: "color", color: value };
      }
      if (!isExpression(value)) continue;
      if (!column || hasGetExpressionForProperty(value, column)) {
        return { type: "expression", expression: value as Expression };
      }
    }
  }
  return null;
}

export const ColumnValuesHistogram: ReportWidget<ColumnValuesHistogramSettings> =
  ({ metrics, componentSettings, sources, loading }) => {
    const { t } = useTranslation("reports");
    const langContext = useContext(FormLanguageContext);
    const source = sources?.[0];
    const column = componentSettings?.column;
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

    const geostatsLayer = useMemo(() => {
      const layer = (source?.geostats as any)?.layers?.[0] as
        | GeostatsLayer
        | undefined;
      return layer && isGeostatsLayer(layer) ? layer : undefined;
    }, [source?.geostats]);

    const numericAttribute = useMemo(() => {
      if (!column || !geostatsLayer?.attributes?.length) return null;
      const attribute = geostatsLayer.attributes.find(
        (attr) => attr.attribute === column
      );
      if (attribute && isNumericGeostatsAttribute(attribute)) {
        return attribute as NumericGeostatsAttribute;
      }
      return null;
    }, [column, geostatsLayer?.attributes]);

    const columnStats = useMemo(() => {
      if (!column) return null;
      const fragmentMetrics = metrics.filter(
        (m) => subjectIsFragment(m.subject) && m.type === "column_values" && m.value
      ) as unknown as ColumnValuesMetric[];

      if (!fragmentMetrics.length || loading) {
        return null;
      }

      const combined = combineMetricsForFragments(
        fragmentMetrics as Pick<Metric, "type" | "value">[]
      ) as ColumnValuesMetric;

      const value = combined.value["*"]?.[column];
      if (!value || !isNumberColumnValueStats(value)) return null;
      return value;
    }, [metrics, loading, column]);

    const histogram = useMemo(
      () => columnStats?.histogram?.map((entry) => entry) || [],
      [columnStats]
    );

    const totalHistogramCount = useMemo(
      () =>
        histogram.reduce(
          (sum, entry) => sum + (typeof entry[1] === "number" ? entry[1] : 0),
          0
        ),
      [histogram]
    );

    const { baseBuckets, isDiscreteBuckets } = useMemo(() => {
      const histogram = numericAttribute?.stats?.histogram;
      const values = numericAttribute?.values;
      if (!histogram || !values) {
        return { baseBuckets: histogram, isDiscreteBuckets: false };
      }
      const entries = Object.entries(values);
      if (!entries.length || entries.length >= 49) {
        return { baseBuckets: histogram, isDiscreteBuckets: false };
      }
      const parsed = entries.map(([value, count]) => ({
        value: Number(value),
        count,
      }));
      if (
        parsed.every(
          (entry) =>
            Number.isFinite(entry.value) && Number.isInteger(entry.value)
        )
      ) {
        return {
          baseBuckets: parsed
            .sort((a, b) => a.value - b.value)
            .map((entry) => [entry.value, entry.count] as Bucket),
          isDiscreteBuckets: true,
        };
      }
      return { baseBuckets: histogram, isDiscreteBuckets: false };
    }, [numericAttribute?.stats?.histogram, numericAttribute?.values]);

    const histogramBuckets = useMemo(() => {
      return buildHistogramBuckets({
        baseBuckets,
        histogram,
        count: totalHistogramCount,
      });
    }, [baseBuckets, histogram, totalHistogramCount]);

    const labelDomain = useMemo(
      () => getLabelDomain(baseBuckets, columnStats),
      [baseBuckets, columnStats]
    );

    const binBounds = useMemo(
      () => getBinBounds(histogram, baseBuckets),
      [histogram, baseBuckets]
    );

    const columnColorSource = useMemo(
      () =>
        colorCoded
          ? getColumnColorSource(
            source?.mapboxGlStyles as any,
            column,
            geostatsLayer?.geometry
          )
          : null,
      [colorCoded, source?.mapboxGlStyles, column, geostatsLayer?.geometry]
    );

    const evaluator = useMemo(() => {
      if (!columnColorSource || columnColorSource.type !== "expression") {
        return null;
      }
      try {
        return ExpressionEvaluator.parse(columnColorSource.expression, "color");
      } catch (error) {
        console.warn("Failed to parse column color expression", error);
        return null;
      }
    }, [columnColorSource]);

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
        const properties: Record<string, number> = { value };
        if (column) {
          properties[column] = value;
        }
        const color =
          columnColorSource?.type === "color"
            ? columnColorSource.color
            : evaluator
              ? evaluator
                .evaluate({
                  type: "Feature",
                  properties,
                  geometry: { type: "Point", coordinates: [0, 0] },
                })
                .toString()
              : "#668";
        return { value, count, fraction, color };
      });
    }, [histogramBuckets, evaluator, column, columnColorSource]);

    const backgroundBars = useMemo(() => {
      if (!baseBuckets?.length) return [];
      return baseBuckets
        .filter((bucket) => bucket[1] !== null)
        .map((bucket) => ({
          value: bucket[0],
          count: bucket[1] as number,
        }));
    }, [baseBuckets]);

    const layerTotalCount = useMemo(() => {
      if (!numericAttribute?.count || !backgroundBars.length) {
        return backgroundBars.reduce((sum, bucket) => sum + bucket.count, 0);
      }
      return numericAttribute.count;
    }, [numericAttribute?.count, backgroundBars]);

    const backgroundMaxFraction = useMemo(() => {
      if (!layerTotalCount || !backgroundBars.length) return 0;
      return backgroundBars.reduce((max, bucket) => {
        const fraction = bucket.count / layerTotalCount;
        return fraction > max ? fraction : max;
      }, 0);
    }, [backgroundBars, layerTotalCount]);

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
      () =>
        new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 2,
        }),
      []
    );

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

    const formatValueWithUnit = (value: number, formatter = labelFormatter) => {
      const formatted = formatter.format(value);
      return unitLabel ? `${formatted} ${unitLabel}` : formatted;
    };

    const displayStats = useMemo(() => {
      return componentSettings?.displayStats || {};
    }, [componentSettings?.displayStats]);

    const statsToShow = useMemo(
      () => statOrder.filter((stat) => displayStats[stat]),
      [displayStats]
    );

    const meanPosition = useMemo(() => {
      if (!displayStats.mean || !labelScale || !columnStats) return null;
      const mean = columnStats.mean;
      if (mean === undefined || mean === null || Number.isNaN(mean)) {
        return null;
      }
      return labelScale(mean);
    }, [displayStats.mean, labelScale, columnStats]);

    const meanColor = "#888";

    const formatStatValue = (stat: ColumnValuesHistogramStatKey) => {
      if (!columnStats) return "—";
      const value = columnStats[stat as keyof NumberColumnValueStats];
      if (value === undefined || value === null || Number.isNaN(value)) {
        return "—";
      }
      if (stat === "count" || stat === "countDistinct") {
        return countFormatter.format(value as number);
      }
      return formatValueWithUnit(value as number, statFormatter);
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

    if (!columnStats || !histogramBuckets.length) {
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
                  className="absolute top-full flex items-start"
                  style={{
                    left: `${meanPosition}%`,
                    transform: "translateX(-50%)",
                    marginTop: "2px",
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
                const backgroundFraction =
                  background && layerTotalCount > 0
                    ? background.count / layerTotalCount
                    : 0;
                const overlayHeight =
                  bar.fraction && maxFraction > 0
                    ? Math.max((bar.fraction / maxFraction) * 100, 1)
                    : 1;
                const backgroundHeight =
                  background && backgroundMaxFraction > 0
                    ? Math.max(
                      (backgroundFraction / backgroundMaxFraction) * 100,
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
                        {background && backgroundHeight > overlayHeight ? (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-gray-200/10 z-10 opacity-0"
                            style={{ height: `${backgroundHeight}%` }}
                          />
                        ) : (
                          <div
                            className="absolute bottom-0 left-0 right-0 opacity-0 z-10"
                            style={{
                              height: `${overlayHeight}%`,
                              backgroundColor: bar.color,
                            }}
                          />
                        )}
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
                          {isDiscreteBuckets ? (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-300">{t("Value")}</span>
                              <span>{formatValueWithUnit(bar.value)}</span>
                            </div>
                          ) : bounds.min === bounds.max ? (
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
                          {/* <div className="flex justify-between gap-2 pt-0.5 border-t border-white/10">
                            <span className="text-gray-300">{t("Count")}</span>
                            <span>{countFormatter.format(bar.count)}</span>
                          </div> */}
                          <div className="flex justify-between gap-2 border-t border-white/10 pt-0.5">
                            <span className="text-gray-300">{t("Share")}</span>
                            <span>
                              {bar.fraction > 0
                                ? percentFormatter.format(bar.fraction)
                                : "—"}
                            </span>
                          </div>
                          {background && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-300">
                                {t("Layer share")}
                              </span>
                              <span>
                                {backgroundFraction > 0
                                  ? percentFormatter.format(backgroundFraction)
                                  : "—"}
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

export const ColumnValuesHistogramTooltipControls: ReportWidgetTooltipControls =
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
        ...(reportContext.preprocessedOverlaySources || []),
      ];
      const dep = dependencies.find((d) => d.tableOfContentsItemId);
      if (!dep?.tableOfContentsItemId) return null;
      return allSources.find(
        (s) => s.tableOfContentsItemId === dep.tableOfContentsItemId
      );
    }, [
      dependencies,
      reportContext.overlaySources,
      reportContext.preprocessedOverlaySources,
    ]);

    const numericColumnOptions = useMemo(() => {
      const options: Array<{ value: string; label: JSX.Element }> = [];
      if (!relatedOverlay?.geostats) return options;
      const geoLayer = (relatedOverlay.geostats as any)?.layers?.[0] && isGeostatsLayer(
        (relatedOverlay.geostats as any)?.layers?.[0] as GeostatsLayer
      )
        ? ((relatedOverlay.geostats as any).layers[0] as GeostatsLayer)
        : undefined;
      if (!geoLayer?.attributes) return options;

      for (const attr of geoLayer.attributes) {
        if (attr.type !== "number") continue;
        const exampleValues = Object.keys(attr.values || {})
          .slice(0, 5)
          .map((v) => String(v));
        const examplesText =
          exampleValues.length > 0 ? exampleValues.join(", ") : "";
        options.push({
          value: attr.attribute,
          label: (
            <div className="flex flex-col">
              <span className="font-medium">{attr.attribute}</span>
              {examplesText && (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  {examplesText}
                </span>
              )}
            </div>
          ),
        });
      }
      options.sort((a, b) => a.value.localeCompare(b.value));

      if (
        componentSettings.column &&
        !options.some((opt) => opt.value === componentSettings.column)
      ) {
        options.unshift({
          value: componentSettings.column,
          label: (
            <div className="flex flex-col">
              <span className="font-medium">{componentSettings.column}</span>
              <span className="text-xs text-gray-500 truncate max-w-[200px]">
                {t("Current selection")}
              </span>
            </div>
          ),
        });
      }

      return options;
    }, [relatedOverlay?.geostats, componentSettings.column, t]);

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
                        | "countDistinctLabel"
                        | "stdDevLabel";
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
          {numericColumnOptions.length > 0 && (
            <LabeledDropdown
              label={t("column")}
              value={componentSettings?.column || ""}
              options={numericColumnOptions}
              onChange={(value) =>
                onUpdate({
                  componentSettings: {
                    ...componentSettings,
                    column: value,
                  },
                })
              }
              getDisplayLabel={(selected) => selected?.value || ""}
            />
          )}
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
                {t("Column values histogram")}
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
