import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import {
  CounterClockwiseClockIcon,
  ValueNoneIcon,
} from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import Skeleton from "../../components/Skeleton";
import {
  subjectIsFragment,
  mergeUniqueIdIndexes,
  countUniqueIds,
  UniqueIdIndex,
  CountMetric,
} from "overlay-engine";
import { useTranslation } from "react-i18next";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";

export type FeatureCountCardConfiguration = ReportCardConfiguration<{
  /**
   * When true, the list will include categories with 0 count.
   * When false, categories with zero count are hidden.
   * @default false
   */
  showZeroCountCategories?: boolean;
  /**
   * Sorting of items: by count (desc) or by name (asc)
   * @default "count"
   */
  sortBy?: "count" | "name";
}>;

export type FeatureCountCardProps =
  ReportCardProps<FeatureCountCardConfiguration>;

// Admin component for configuring the card
const FeatureCountCardAdmin = lazy(() => import("./FeatureCountCardAdmin"));

export function FeatureCountCard({
  config,
  metrics,
  loading,
  sources,
  errors,
}: FeatureCountCardProps) {
  const { reportingLayers } = config;
  useTranslation("reports");

  const items = useMemo(() => {
    const items: {
      title: string;
      value?: number;
      color?: string;
    }[] = [];

    // FeatureCountCard only supports a single layer
    if (reportingLayers.length === 0) {
      return items;
    }

    const layer = reportingLayers[0];
    const source = sources.find(
      (s) => s.tableOfContentsItemId === layer.tableOfContentsItemId
    );
    if (!source) {
      return items;
    }

    // Find count metrics for fragments (sketch overlaps)
    const fragmentMetrics = metrics.filter(
      (m) => subjectIsFragment(m.subject) && m.type === "count"
    );

    // Collect uniqueIdIndexes by groupBy value across all fragments
    const indexesByClass: { [classKey: string]: UniqueIdIndex[] } = {};
    for (const metric of fragmentMetrics) {
      // Access the value property which should be CountMetric["value"]
      const countValue = metric.value as CountMetric["value"];
      if (countValue && typeof countValue === "object") {
        for (const classKey in countValue) {
          const entry = countValue[classKey];
          if (
            entry &&
            typeof entry === "object" &&
            "uniqueIdIndex" in entry &&
            "count" in entry
          ) {
            if (!indexesByClass[classKey]) {
              indexesByClass[classKey] = [];
            }
            indexesByClass[classKey].push(entry.uniqueIdIndex);
          }
        }
      }
    }

    // Merge indexes and calculate final counts
    const sumCountsByClass: { [classKey: string]: number } = {};
    for (const classKey in indexesByClass) {
      const indexes = indexesByClass[classKey];
      if (indexes.length > 0) {
        // Merge all indexes for this classKey
        const mergedIndex = mergeUniqueIdIndexes(...indexes);
        // Calculate count from merged index
        sumCountsByClass[classKey] = countUniqueIds(mergedIndex);
      } else {
        sumCountsByClass[classKey] = 0;
      }
    }

    // const meta = layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    // if (!meta) {
    //   throw new Error(
    //     `Layer ${layer.tableOfContentsItem?.title} has no geostats metadata`
    //   );
    // }

    // if (layer.layerParameters?.groupBy) {
    //   // get values for groupBy
    //   if (!isRasterInfo(meta)) {
    //     const geostats = meta.layers[0] as GeostatsLayer;
    //     const attr = geostats.attributes.find(
    //       (a) => a.attribute === layer.layerParameters.groupBy
    //     );
    //     if (!attr) {
    //       throw new Error(
    //         `Group by attribute ${
    //           layer.layerParameters.groupBy
    //         } not found in layer ${
    //           layer.tableOfContentsItem?.title || "Untitled"
    //         }`
    //       );
    //     }
    //     if (!layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles) {
    //       throw new Error(
    //         `Layer ${
    //           layer.tableOfContentsItem?.title || "Untitled"
    //         } has no mapboxGL styles`
    //       );
    //     }
    //     const colors = extractColorsForCategories(
    //       Object.keys(attr.values),
    //       attr,
    //       layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles as AnyLayer[]
    //     );
    //     const values = Object.keys(attr.values);
    //     for (const value of values) {
    //       const count = sumCountsByClass[value];
    //       if (count && count > 0) {
    //         items.push({
    //           title: value,
    //           value: count,
    //           color: colors[value],
    //         });
    //       } else if (config.componentSettings?.showZeroCountCategories) {
    //         items.push({ title: value, color: colors[value], value: 0 });
    //       }
    //     }
    //   } else {
    //     throw new Error("FeatureCountCard does not support raster layers");
    //   }
    // } else {
    //   // No groupBy - show total count
    //   const totalCount = sumCountsByClass["*"] || 0;
    //   if (totalCount > 0) {
    //     items.push({
    //       title: "All features",
    //       value: totalCount,
    //       color: extractColorForLayers(
    //         layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles as AnyLayer[]
    //       ),
    //     });
    //   }
    // }

    // Apply sorting per configuration
    const sortBy = config.componentSettings?.sortBy || "count";
    if (sortBy === "name") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }
    return items;
  }, [reportingLayers, config.componentSettings, metrics, sources]);

  return (
    <div>
      {config.reportingLayers.length === 0 && (
        <Warning>
          <Trans ns="reports">No layer selected.</Trans>
        </Warning>
      )}
      <div>
        {!loading &&
          items.length > 0 &&
          items.map((item) => (
            <div
              className={`flex max-w-full items-center px-2 space-x-2 ${
                item.value && item.value > 0 ? "opacity-100" : "opacity-50"
              }`}
              key={item.title}
            >
              {item.color && (
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <div
                title={item.title.length > 48 ? item.title : undefined}
                className="flex-1 truncate"
              >
                {item.title}
              </div>
              <div className="tabular-nums">
                {loading ? (
                  <Skeleton className="w-10 h-4" />
                ) : (
                  <>{item.value?.toLocaleString() || 0}</>
                )}
              </div>
            </div>
          ))}
        {!loading && items.length === 0 && (
          <div className="flex items-center space-x-2 py-2">
            <ValueNoneIcon className="w-4 h-4 text-red-800" />
            <span className="text-gray-700">
              <Trans ns="reports">No overlapping features found.</Trans>
            </span>
          </div>
        )}
      </div>
      {config.displayMapLayerVisibilityControls !== false &&
        reportingLayers.length === 1 &&
        reportingLayers[0].tableOfContentsItem?.stableId && (
          <MapLayerVisibilityControl
            stableId={reportingLayers[0].tableOfContentsItem.stableId}
          />
        )}
    </div>
  );
}

const defaultComponentSettings: FeatureCountCardConfiguration["componentSettings"] =
  {};

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Feature Count",
        },
      ],
    },
  ],
};

function FeatureCountCardIcon() {
  return (
    <div className="bg-green-100 w-full h-full text-green-600 flex justify-center items-center rounded">
      <CounterClockwiseClockIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "FeatureCount",
  component: FeatureCountCard,
  adminComponent: FeatureCountCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Feature Count</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Count the number of features from a layer that overlap with a sketch.
      Optionally group counts by a layer attribute.
    </Trans>
  ),
  icon: FeatureCountCardIcon,
  order: 3,
  minimumReportingLayerCount: 1,
  maximumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataSourceTypes.SeasketchVector,
    DataSourceTypes.SeasketchMvt,
  ],
});
