import {
  MetricDependency,
  Metric,
  subjectIsFragment,
  subjectIsGeography,
  combineMetricsForFragments,
} from "overlay-engine";
import { AnyLayer } from "mapbox-gl";
import { GeostatsLayer } from "@seasketch/geostats-types";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
} from "../../generated/graphql";
import {
  extractColorForLayers,
  extractColorsForCategories,
  extractPaletteColorsFromVectorStyle,
  isTransparentColor,
} from "../utils/colors";

export type ClassTableRow = {
  key: string;
  label: string;
  groupByKey: string;
  sourceId: string;
  color?: string;
  /** For vector or single-color raster; use with a single swatch. */
  stableId?: string;
  /**
   * For rasters: color stops from raster-color. For vectors: distinct colors
   * from data-driven fill/circle/line-color when a single row color cannot be resolved.
   */
  colors?: string[];
  /**
   * Multi-color 6×6 pixel swatch: ramp order for continuous raster ramps, soft
   * scatter for categorical rasters and vector palettes.
   */
  multiColorSwatchLayout?: "raster-ramp-order" | "soft-scatter";
};

/**
 * True when the overlay source is a raster dataset (geostats has bands, not vector layers).
 */
function isRasterSource(
  source: OverlaySourceDetailsFragment
): source is OverlaySourceDetailsFragment & { geostats: { bands: unknown[] } } {
  const g = source?.geostats;
  return (
    typeof g === "object" &&
    g !== null &&
    "bands" in g &&
    Array.isArray((g as { bands: unknown[] }).bands) &&
    (g as { bands: unknown[] }).bands.length >= 1
  );
}

type RasterColorsFromStyle = {
  colors: string[];
  multiColorSwatchLayout: "raster-ramp-order" | "soft-scatter";
};

/**
 * Extracts color values from raster-color. Interpolate/step → ramp order for
 * pixel swatches; match → soft scatter like categorical vectors.
 */
function getRasterColorsFromStyle(
  layers: AnyLayer[]
): RasterColorsFromStyle | undefined {
  for (const layer of layers) {
    if (layer.type !== "raster" || !layer.paint) continue;
    const rasterColor = (layer.paint as Record<string, unknown>)[
      "raster-color"
    ];
    if (!Array.isArray(rasterColor) || rasterColor.length < 3) continue;
    const fn = rasterColor[0];
    if (typeof fn !== "string") continue;

    const colorStops: string[] = [];

    const pushIfOpaque = (c: string) => {
      if (typeof c === "string" && !isTransparentColor(c)) colorStops.push(c);
    };

    let layout: "raster-ramp-order" | "soft-scatter";

    if (/^interpolate(-hcl|-lab)?$/.test(fn)) {
      layout = "raster-ramp-order";
      for (let i = 4; i < rasterColor.length; i += 2) {
        pushIfOpaque(rasterColor[i] as string);
      }
    } else if (fn === "step") {
      layout = "raster-ramp-order";
      for (let i = 2; i < rasterColor.length; i += 2) {
        pushIfOpaque(rasterColor[i] as string);
      }
    } else if (fn === "match") {
      layout = "soft-scatter";
      let i = 2;
      while (i < rasterColor.length) {
        if (i === rasterColor.length - 1) {
          pushIfOpaque(rasterColor[i] as string);
          break;
        }
        pushIfOpaque(rasterColor[i + 1] as string);
        i += 2;
      }
    } else {
      continue;
    }

    if (colorStops.length > 0) {
      return { colors: colorStops, multiColorSwatchLayout: layout };
    }
  }
  return undefined;
}

/**
 * Resolves a solid paint color when possible; otherwise distinct colors from
 * data-driven vector paint (match / step / interpolate) for a multi-stop swatch.
 */
function vectorSwatchFromSource(
  source: OverlaySourceDetailsFragment,
  singleColor: string | undefined
): {
  color?: string;
  colors?: string[];
  multiColorSwatchLayout?: "raster-ramp-order" | "soft-scatter";
} {
  const styles = source.mapboxGlStyles as AnyLayer[] | undefined;
  if (!styles?.length) {
    if (singleColor !== undefined && !isTransparentColor(singleColor)) {
      return { color: singleColor };
    }
    return {};
  }
  let color = singleColor;
  if (color !== undefined && isTransparentColor(color)) {
    color = undefined;
  }
  if (color !== undefined) {
    return { color };
  }
  const palette = extractPaletteColorsFromVectorStyle(styles);
  if (!palette?.length) {
    return {};
  }
  if (palette.length === 1) {
    return { color: palette[0] };
  }
  return { colors: palette, multiColorSwatchLayout: "soft-scatter" };
}

export type ClassTableRowComponentSettings = {
  /**
   * When true, row labels wrap instead of truncating with an ellipsis (default is truncated).
   */
  disableRowLabelTruncation?: boolean;
  /**
   * A list of row keys to exclude from the table. The key must match the ClassTableRow.key value.
   */
  excludedRowKeys?: string[];
  /**
   * A map of row keys to custom labels. The key must match the ClassTableRow.key value.
   */
  customRowLabels?: { [key: string]: string };
  /**
   * A map of row keys to stable IDs. The key must match the ClassTableRow.key value.
   */
  rowLinkedStableIds?: { [key: string]: string };
  /**
   * Overlay source stableIds for which an extra row should be shown for the
   * total across all features (`groupByKey` `"*"`). When `groupBy` is set, the
   * overlay engine still records combined overlap under `"*"` alongside per-class
   * keys; this setting exposes that as a table row.
   */
  includeAllFeaturesRowForGroupedSources?: string[];
};

/** Default: row labels are truncated to a single line unless `disableRowLabelTruncation` is set. */
export function shouldTruncateClassTableRowLabels(
  settings: Pick<ClassTableRowComponentSettings, "disableRowLabelTruncation">
): boolean {
  return !settings.disableRowLabelTruncation;
}

export function classTableRowKey(stableId: string, groupByKey?: string) {
  return `${stableId}-${groupByKey || "*"}`;
}

export function resolveClassTableRowStableId(
  row: Pick<ClassTableRow, "stableId" | "key" | "groupByKey">,
  linkedStableIds?: { [key: string]: string }
) {
  return (
    row.stableId ||
    linkedStableIds?.[row.key] ||
    (row.groupByKey ? linkedStableIds?.[row.groupByKey] : undefined)
  );
}

export function hasClassTableRowVisibilityToggle(
  rows: Pick<ClassTableRow, "stableId" | "key" | "groupByKey">[],
  linkedStableIds?: { [key: string]: string }
) {
  return rows.some((row) =>
    Boolean(resolveClassTableRowStableId(row, linkedStableIds))
  );
}

/**
 * Returns a list of ClassTableRows for the given dependencies and sources. In
 * report widgets like FeatureCountTable and OverlappingAreasTable, the widget
 * can populate these rows with metrics data for rendering as part of a table
 * component. The purpose of this function is to let table widgets delegate
 * responsibility for determining what rows to display, their colors, and their
 * labels, based on depedencies and common configuration. Widget-specific
 * functionality can then be implemented by callers.
 *
 * If sources aren't provided, likely because they haven't been loaded yet, the
 * function will return placeholder rows.
 * @param options
 * @returns
 */
export function getClassTableRows(options: {
  dependencies: MetricDependency[];
  sources: OverlaySourceDetailsFragment[];
  allFeaturesLabel: string;
  /**
   * A map of group by keys to custom labels. The key must match the
   * ClassTableRow.key value.
   */
  customLabels?: { [key: string]: string };
  /**
   * A map of table of contents item IDs to stable IDs for showing map layer
   * toggles. The key must match the ClassTableRow.sourceId value.
   */
  stableIds?: { [key: string]: string };
  excludedRowKeys?: string[];
  /** @see ClassTableRowComponentSettings.includeAllFeaturesRowForGroupedSources */
  includeAllFeaturesRowForGroupedSources?: string[];
}): ClassTableRow[] {
  const rows = [] as ClassTableRow[];
  const fragmentDependencies = options.dependencies.filter(
    (d) => d.subjectType === "fragments" && Boolean(d.stableId)
  );
  const multiSource =
    fragmentDependencies.length > 1 && options.sources.length > 1;
  for (const dependency of fragmentDependencies) {
    const source = options.sources.find(
      (s) => s.stableId === dependency.stableId
    );
    const layer = source?.geostats?.layers?.[0] as GeostatsLayer | undefined;
    if (!source || !layer) {
      if (dependency.parameters?.groupBy) {
        [1, 2, 3].forEach((i) => {
          rows.push({
            // eslint-disable-next-line i18next/no-literal-string
            key: `${dependency.stableId}-placeholder-${i}`,
            label: `-`,
            // eslint-disable-next-line i18next/no-literal-string
            groupByKey: `${dependency.stableId}-placeholder-${i}`,
            sourceId: dependency.stableId!.toString(),
          });
        });
      } else {
        const key = classTableRowKey(dependency.stableId!, "*");
        const styles = source?.mapboxGlStyles as AnyLayer[] | undefined;
        let swatch: {
          color?: string;
          colors?: string[];
          multiColorSwatchLayout?: "raster-ramp-order" | "soft-scatter";
        } = {};

        if (source && isRasterSource(source) && styles?.length) {
          const raster = getRasterColorsFromStyle(styles);
          if (raster?.colors.length) {
            swatch = {
              colors: raster.colors,
              multiColorSwatchLayout: raster.multiColorSwatchLayout,
            };
          } else {
            swatch = vectorSwatchFromSource(
              source,
              extractColorForLayers(styles)
            );
          }
        } else if (source && styles?.length) {
          swatch = vectorSwatchFromSource(
            source,
            extractColorForLayers(styles)
          );
        }

        rows.push({
          key,
          label:
            options.customLabels?.[key] ||
            (multiSource
              ? source?.tableOfContentsItem?.title || options.allFeaturesLabel
              : options.allFeaturesLabel),
          groupByKey: "*",
          sourceId: dependency.stableId!.toString(),
          stableId: options.stableIds?.[key],
          ...swatch,
        });
      }
    } else {
      if (dependency.parameters?.groupBy) {
        const attr = layer.attributes?.find(
          (a) => a.attribute === dependency.parameters?.groupBy
        );
        if (!attr) {
          throw new Error(
            `Attribute ${dependency.parameters?.groupBy} not found in geostats layer`
          );
        }
        const values = Object.keys(attr.values || {});
        const colors = extractColorsForCategories(
          values,
          attr,
          source.mapboxGlStyles as AnyLayer[]
        );
        const includeAllFeaturesRow =
          options.includeAllFeaturesRowForGroupedSources?.includes(
            dependency.stableId!
          );
        if (includeAllFeaturesRow) {
          const totalKey = classTableRowKey(dependency.stableId!, "*");
          const totalSwatch = vectorSwatchFromSource(
            source,
            extractColorForLayers(source.mapboxGlStyles as AnyLayer[])
          );
          rows.push({
            key: totalKey,
            label:
              options.customLabels?.[totalKey] ||
              source.tableOfContentsItem?.title ||
              options.allFeaturesLabel,
            groupByKey: "*",
            sourceId: dependency.stableId!.toString(),
            stableId: options.stableIds?.[totalKey],
            ...totalSwatch,
          });
        }
        for (const value of values) {
          const key = classTableRowKey(dependency.stableId!, value);
          const resolved: string | undefined =
            colors[value] ||
            extractColorForLayers(source.mapboxGlStyles as AnyLayer[]);
          const rowSwatch = vectorSwatchFromSource(source, resolved);
          rows.push({
            key,
            label: options.customLabels?.[key] || value,
            groupByKey: value,
            sourceId: dependency.stableId!.toString(),
            stableId: options.stableIds?.[key],
            ...rowSwatch,
          });
        }
      } else {
        const key = classTableRowKey(dependency.stableId!, "*");
        const swatch = vectorSwatchFromSource(
          source,
          extractColorForLayers(source.mapboxGlStyles as AnyLayer[])
        );
        rows.push({
          key,
          label:
            options.customLabels?.[key] ||
            (multiSource
              ? source.tableOfContentsItem?.title || options.allFeaturesLabel
              : options.allFeaturesLabel),
          groupByKey: "*",
          sourceId: dependency.stableId!.toString(),
          stableId: options.stableIds?.[key],
          ...swatch,
        });
      }
    }
  }
  return rows.filter((r) => !options.excludedRowKeys?.includes(r.key));
}

export function combineMetricsBySource<T extends Metric>(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  sources: OverlaySourceDetailsFragment[],
  geographyId: number,
  expectedMetricType?: Metric["type"]
): {
  [sourceId: string]: {
    fragments: T;
    geographies: T;
  };
} {
  // Keep a single complete metric per id while preserving metrics without ids.
  const dedupedMetrics: CompatibleSpatialMetricDetailsFragment[] = [];
  const seenMetricIds = new Set<string | number>();
  for (const metric of metrics) {
    if (metric.state !== SpatialMetricState.Complete) {
      continue;
    }
    if (metric.id === null || metric.id === undefined) {
      dedupedMetrics.push(metric);
      continue;
    }
    if (seenMetricIds.has(metric.id)) {
      continue;
    }
    seenMetricIds.add(metric.id);
    dedupedMetrics.push(metric);
  }

  const result: {
    [sourceId: string]: {
      fragments: T;
      geographies: T;
    };
  } = {};
  // first, gather up source ids
  const sourceIds = new Set<string>();
  for (const metric of dedupedMetrics) {
    if (metric.sourceUrl) {
      const source = sources.find((s) => s.sourceUrl === metric.sourceUrl);
      if (source) {
        sourceIds.add(source.stableId);
      }
    }
  }
  // then for each sourceId, combine the metrics
  for (const sourceId of sourceIds) {
    const source = sources.find((s) => s.stableId === sourceId);
    if (source) {
      const sourceMetrics = dedupedMetrics.filter(
        (m) =>
          m.sourceUrl === source.sourceUrl &&
          (!expectedMetricType || m.type === expectedMetricType)
      );
      const geographyMetrics = sourceMetrics.filter(
        (m) =>
          subjectIsGeography(m.subject) && m.subject.id === geographyId
      );
      const geographyMetric =
        geographyMetrics.length > 1
          ? geographyMetrics
              .slice()
              .sort((a, b) => Number(b.id) - Number(a.id))[0]
          : geographyMetrics[0];
      result[source.stableId] = {
        fragments: combineMetricsForFragments(
          sourceMetrics.filter(
            (m) =>
              subjectIsFragment(m.subject) &&
              m.subject.geographies.includes(geographyId)
          ) as Pick<Metric, "type" | "value">[],
          expectedMetricType
        ) as T,
        geographies: geographyMetric as unknown as T,
      };
    }
  }
  return result;
}
