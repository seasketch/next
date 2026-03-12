import { MetricDependency, Metric, subjectIsFragment, subjectIsGeography, combineMetricsForFragments } from "overlay-engine";
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
   * For rasters: color stops from the mapbox-gl-style raster-color expression
   * (interpolate, step, match, etc.). Used to render a multi-color swatch.
   */
  colors?: string[];
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

/**
 * True if the color string is considered transparent (keyword, rgba(,,,0), or hex with alpha 0).
 */
function isTransparentColor(c: string): boolean {
  const s = c.trim().toLowerCase();
  if (s === "transparent") return true;
  if (s.startsWith("rgba(") && s.endsWith(")")) {
    const lastComma = s.lastIndexOf(",");
    if (lastComma !== -1) {
      const alpha = s.slice(lastComma + 1, s.length - 1).trim();
      if (alpha === "0" || alpha === "0.0" || /^0\.0+$/.test(alpha)) return true;
    }
  }
  if (/^#[0-9a-f]{8}$/i.test(s) && s.slice(-2).toLowerCase() === "00")
    return true;
  if (/^#[0-9a-f]{4}$/i.test(s) && s.slice(-1).toLowerCase() === "0")
    return true;
  return false;
}

/**
 * Extracts ordered color values from a raster layer's raster-color paint
 * expression, whether interpolate, step, or match. Returns undefined if none found.
 * Transparent colors (keyword, rgba with alpha 0, hex with alpha 00) are excluded.
 */
function getRasterColorsFromStyle(layers: AnyLayer[]): string[] | undefined {
  for (const layer of layers) {
    if (layer.type !== "raster" || !layer.paint) continue;
    const rasterColor = (layer.paint as Record<string, unknown>)["raster-color"];
    if (!Array.isArray(rasterColor) || rasterColor.length < 3) continue;
    const fn = rasterColor[0];
    if (typeof fn !== "string") continue;

    const colorStops: string[] = [];

    const pushIfOpaque = (c: string) => {
      if (typeof c === "string" && !isTransparentColor(c)) colorStops.push(c);
    };

    if (/^interpolate(-hcl|-lab)?$/.test(fn)) {
      // [ "interpolate", interpolation, input, v1, c1, v2, c2, ... ]
      for (let i = 4; i < rasterColor.length; i += 2) {
        pushIfOpaque(rasterColor[i] as string);
      }
    } else if (fn === "step") {
      // [ "step", input, defaultColor, v1, c1, v2, c2, ... ]
      for (let i = 2; i < rasterColor.length; i += 2) {
        pushIfOpaque(rasterColor[i] as string);
      }
    } else if (fn === "match") {
      // [ "match", input, c1, v1, c2, v2, ..., default ] — values at odd indices and last
      for (let i = 3; i < rasterColor.length - 1; i += 2) {
        pushIfOpaque(rasterColor[i] as string);
      }
      const defaultVal = rasterColor[rasterColor.length - 1];
      if (typeof defaultVal === "string") pushIfOpaque(defaultVal);
    }

    if (colorStops.length > 0) return colorStops;
  }
  return undefined;
}

export type ClassTableRowComponentSettings = {
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
};

export function classTableRowKey(stableId: string, groupByKey?: string) {
  return `${stableId}-${groupByKey || "*"}`;
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
        let color: string | undefined;
        let colors: string[] | undefined;

        if (source && isRasterSource(source) && styles?.length) {
          const rasterColors = getRasterColorsFromStyle(styles);
          if (rasterColors?.length) {
            colors = rasterColors;
          } else {
            color = extractColorForLayers(styles);
          }
        } else if (styles?.length) {
          color = extractColorForLayers(styles);
        }

        if (color !== undefined && isTransparentColor(color)) {
          color = undefined;
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
          ...(color !== undefined && { color }),
          ...(colors !== undefined && { colors }),
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
        for (const value of values) {
          const key = classTableRowKey(dependency.stableId!, value);
          let color: string | undefined =
            colors[value] ||
            extractColorForLayers(source.mapboxGlStyles as AnyLayer[]);
          if (color !== undefined && isTransparentColor(color)) {
            color = undefined;
          }
          rows.push({
            key,
            label: options.customLabels?.[key] || value,
            groupByKey: value,
            sourceId: dependency.stableId!.toString(),
            stableId: options.stableIds?.[key],
            color,
          });
        }
      } else {
        const key = classTableRowKey(dependency.stableId!, "*");
        let color: string | undefined = extractColorForLayers(
          source.mapboxGlStyles as AnyLayer[]
        );
        if (color !== undefined && isTransparentColor(color)) {
          color = undefined;
        }
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
          color,
        });
      }
    }
  }
  return rows.filter((r) => !options.excludedRowKeys?.includes(r.key));
}

export function combineMetricsBySource<T extends Metric>(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  sources: OverlaySourceDetailsFragment[],
  geographyId: number
): {
  [sourceId: string]: {
    fragments: T;
    geographies: T;
  };
} {
  // handle duplicates
  const metricIds = new Set<string>(metrics.map((m) => m.id));
  metrics = metrics.filter((m) => m.state === SpatialMetricState.Complete);
  metrics = Array.from(metricIds)
    .map((id) => metrics.find((m) => m.id === id))
    .filter(Boolean) as CompatibleSpatialMetricDetailsFragment[];
  const result: {
    [sourceId: string]: {
      fragments: T;
      geographies: T;
    };
  } = {};
  // first, gather up source ids
  const sourceIds = new Set<string>();
  for (const metric of metrics) {
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
      result[source.stableId] = {
        fragments: combineMetricsForFragments(
          metrics.filter(
            (m) =>
              m.sourceUrl === source.sourceUrl &&
              subjectIsFragment(m.subject) &&
              m.subject.geographies.includes(geographyId)
          ) as Pick<Metric, "type" | "value">[]
        ) as T,
        geographies: metrics.find(
          (m) =>
            m.sourceUrl === source.sourceUrl &&
            subjectIsGeography(m.subject) &&
            m.subject.id === geographyId
        ) as unknown as T,
      };
    }
  }
  return result;
}
