import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import { BarChartIcon, ValueNoneIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import Skeleton from "../../components/Skeleton";
import {
  subjectIsFragment,
  ColumnValuesMetric,
  IdentifiedValues,
  computeStatsFromIdentifiedValues,
} from "overlay-engine";
import {
  extractColorsForCategories,
  extractColorForLayers,
} from "../utils/colors";
import { AnyLayer } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";

export type ColumnStatisticsCardConfiguration = ReportCardConfiguration<{
  /**
   * Which statistics to display. Defaults to min, max, and mean.
   */
  displayStats?: {
    min?: boolean;
    max?: boolean;
    mean?: boolean;
    median?: boolean;
    stdDev?: boolean;
    count?: boolean;
    countDistinct?: boolean;
  };
}>;

export type ColumnStatisticsCardProps =
  ReportCardProps<ColumnStatisticsCardConfiguration>;

// Admin component for configuring the card
const ColumnStatisticsCardAdmin = lazy(
  () => import("./ColumnStatisticsCardAdmin")
);

export function ColumnStatisticsCard({
  config,
  metrics,
  loading,
  sources,
  errors,
}: ColumnStatisticsCardProps) {
  const { reportingLayers } = config;
  useTranslation("reports");

  // Default stats to show: min, max, mean
  const displayStats = config.componentSettings?.displayStats || {
    min: true,
    max: true,
    mean: true,
  };

  const statisticsByLayer = useMemo(() => {
    const result: {
      [layerId: string]: {
        layerTitle: string;
        sourceUrl: string;
        groupBy?: string;
        statistics: {
          [classKey: string]: ReturnType<
            typeof computeStatsFromIdentifiedValues
          >;
        };
      };
    } = {};

    for (const layer of reportingLayers) {
      const source = sources.find(
        (s) => s.tableOfContentsItemId === layer.tableOfContentsItemId
      );
      if (!source) {
        continue;
      }

      const layerId = layer.tableOfContentsItemId.toString();
      const groupBy = layer.layerParameters?.groupBy;

      // Find column_values metrics for fragments (sketch overlaps) for this layer
      const fragmentMetrics = metrics.filter(
        (m) =>
          subjectIsFragment(m.subject) &&
          m.type === "column_values" &&
          m.sourceUrl === source.sourceUrl &&
          m.parameters?.valueColumn
      );

      // Collect IdentifiedValues by groupBy value across all fragments
      const valuesByClass: { [classKey: string]: IdentifiedValues[] } = {};
      for (const metric of fragmentMetrics) {
        const columnValue = metric.value as ColumnValuesMetric["value"];
        if (columnValue && typeof columnValue === "object") {
          for (const classKey in columnValue) {
            const identifiedValues = columnValue[classKey];
            if (Array.isArray(identifiedValues)) {
              if (!valuesByClass[classKey]) {
                valuesByClass[classKey] = [];
              }
              valuesByClass[classKey].push(...identifiedValues);
            }
          }
        }
      }

      // Compute statistics for each class
      const statistics: {
        [classKey: string]: ReturnType<typeof computeStatsFromIdentifiedValues>;
      } = {};
      for (const classKey in valuesByClass) {
        const identifiedValues = valuesByClass[classKey];
        if (identifiedValues.length > 0) {
          statistics[classKey] =
            computeStatsFromIdentifiedValues(identifiedValues);
        }
      }

      if (Object.keys(statistics).length > 0) {
        result[layerId] = {
          layerTitle: layer.tableOfContentsItem?.title || "Untitled",
          sourceUrl: source.sourceUrl || "",
          groupBy,
          statistics,
        };
      }
    }

    return result;
  }, [reportingLayers, metrics, sources]);

  const getStatValue = (
    stats: ReturnType<typeof computeStatsFromIdentifiedValues>,
    statName: keyof ReturnType<typeof computeStatsFromIdentifiedValues>
  ): number | string => {
    const value = stats[statName];
    if (typeof value === "number") {
      if (isNaN(value) || !isFinite(value)) {
        return "-";
      }
      return value;
    }
    return "-";
  };

  const formatStatValue = (value: number | string): string => {
    if (typeof value === "string") {
      return value;
    }
    // Format numbers with appropriate precision
    if (value % 1 === 0) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    });
  };

  // Prepare table rows - combine all layers if multiple, or show single layer
  const hasMultipleLayers = Object.keys(statisticsByLayer).length > 1;
  const tableRows = useMemo(() => {
    const rows: Array<{
      layerId: string;
      layerTitle: string;
      classKey: string;
      stats: ReturnType<typeof computeStatsFromIdentifiedValues>;
      color?: string;
      groupBy?: string;
    }> = [];

    for (const layerId in statisticsByLayer) {
      const layerData = statisticsByLayer[layerId];
      const meta = reportingLayers.find(
        (l) => l.tableOfContentsItemId.toString() === layerId
      )?.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
      const mapboxGlStyles = reportingLayers.find(
        (l) => l.tableOfContentsItemId.toString() === layerId
      )?.tableOfContentsItem?.dataLayer?.mapboxGlStyles as AnyLayer[];

      let colors: { [key: string]: string } = {};
      if (layerData.groupBy && meta && !isRasterInfo(meta)) {
        const geostats = meta.layers[0] as GeostatsLayer;
        const attr = geostats.attributes.find(
          (a) => a.attribute === layerData.groupBy
        );
        if (attr && mapboxGlStyles) {
          colors = extractColorsForCategories(
            Object.keys(attr.values),
            attr,
            mapboxGlStyles
          );
        }
      } else if (!layerData.groupBy && mapboxGlStyles) {
        colors["*"] = extractColorForLayers(mapboxGlStyles);
      }

      const classKeys = Object.keys(layerData.statistics).sort((a, b) => {
        if (a === "*") return -1;
        if (b === "*") return 1;
        return a.localeCompare(b);
      });

      for (const classKey of classKeys) {
        rows.push({
          layerId,
          layerTitle: layerData.layerTitle,
          classKey,
          stats: layerData.statistics[classKey],
          color: colors[classKey],
          groupBy: layerData.groupBy,
        });
      }
    }

    return rows;
  }, [statisticsByLayer, reportingLayers]);

  // Determine if we need a groupBy column (check if any layer has groupBy)
  const hasGroupBy = Object.values(statisticsByLayer).some(
    (layerData) => layerData.groupBy
  );
  // Get the groupBy attribute name (assuming all layers use the same one if multiple)
  const groupByAttribute = Object.values(statisticsByLayer).find(
    (layerData) => layerData.groupBy
  )?.groupBy;

  return (
    <div>
      {config.reportingLayers.length === 0 && (
        <Warning>
          <Trans ns="reports">No layers selected.</Trans>
        </Warning>
      )}
      {!loading && Object.keys(statisticsByLayer).length === 0 && (
        <div className="flex items-center space-x-2 py-2">
          <ValueNoneIcon className="w-4 h-4 text-red-800" />
          <span className="text-gray-700">
            <Trans ns="reports">No statistics available.</Trans>
          </span>
        </div>
      )}
      {tableRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {hasMultipleLayers && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Layer</Trans>
                  </th>
                )}
                {hasGroupBy && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {groupByAttribute}
                  </th>
                )}
                {displayStats.min && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Min</Trans>
                  </th>
                )}
                {displayStats.max && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Max</Trans>
                  </th>
                )}
                {displayStats.mean && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Mean</Trans>
                  </th>
                )}
                {displayStats.median && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Median</Trans>
                  </th>
                )}
                {displayStats.stdDev && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Std Dev</Trans>
                  </th>
                )}
                {displayStats.count && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Count</Trans>
                  </th>
                )}
                {displayStats.countDistinct && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Distinct</Trans>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.map((row, index) => (
                <tr key={`${row.layerId}-${row.classKey}-${index}`}>
                  {hasMultipleLayers && (
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {row.layerTitle}
                    </td>
                  )}
                  {hasGroupBy && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        {row.color && (
                          <div
                            className="w-3 h-3 rounded mr-2"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
                        <span className="text-sm text-gray-900">
                          {row.classKey === "*" ? (
                            <Trans ns="reports">All</Trans>
                          ) : (
                            row.classKey
                          )}
                        </span>
                      </div>
                    </td>
                  )}
                  {displayStats.min && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "min"))
                      )}
                    </td>
                  )}
                  {displayStats.max && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "max"))
                      )}
                    </td>
                  )}
                  {displayStats.mean && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "mean"))
                      )}
                    </td>
                  )}
                  {displayStats.median && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "median"))
                      )}
                    </td>
                  )}
                  {displayStats.stdDev && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "stdDev"))
                      )}
                    </td>
                  )}
                  {displayStats.count && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(getStatValue(row.stats, "count"))
                      )}
                    </td>
                  )}
                  {displayStats.countDistinct && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(
                          getStatValue(row.stats, "countDistinct")
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

const defaultComponentSettings: ColumnStatisticsCardConfiguration["componentSettings"] =
  {
    displayStats: {
      min: true,
      max: true,
      mean: true,
    },
  };

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Column Statistics",
        },
      ],
    },
  ],
};

function ColumnStatisticsCardIcon() {
  return (
    <div className="bg-blue-100 w-full h-full text-blue-600 flex justify-center items-center rounded">
      <BarChartIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "ColumnStatistics",
  component: ColumnStatisticsCard,
  adminComponent: ColumnStatisticsCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Column Statistics</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display statistical summaries (min, max, mean, etc.) for numeric column
      values from overlapping features.
    </Trans>
  ),
  icon: ColumnStatisticsCardIcon,
  order: 4,
  minimumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataSourceTypes.SeasketchVector,
    DataSourceTypes.SeasketchMvt,
  ],
  requiredLayerParameters: ["valueColumn"],
});
