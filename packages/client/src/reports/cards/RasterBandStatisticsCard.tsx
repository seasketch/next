import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import { ImageIcon, ValueNoneIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import { Bucket, isRasterInfo, RasterInfo } from "@seasketch/geostats-types";
import Skeleton from "../../components/Skeleton";
import { useTranslation } from "react-i18next";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";
import { RasterInfoHistogram } from "../../admin/data/RasterInfoModal";
import { RasterBandStats } from "overlay-engine/dist/metrics/metrics";
import { combineRasterBandStats, subjectIsFragment } from "overlay-engine";

export type RasterBandStatisticsCardConfiguration = ReportCardConfiguration<{
  /**
   * Which statistics to display. Defaults to all available.
   */
  displayStats?: {
    min?: boolean;
    max?: boolean;
    mean?: boolean;
    sum?: boolean;
    histogram?: boolean;
  };
}>;

export type RasterBandStatisticsCardProps =
  ReportCardProps<RasterBandStatisticsCardConfiguration>;

// Admin component for configuring the card
const RasterBandStatisticsCardAdmin = lazy(
  () => import("./RasterBandStatisticsCardAdmin")
);

type HistogramEntry = { value: number; count: number };

function histogramEntriesToBuckets(entries: HistogramEntry[]): Bucket[] {
  return entries.map(({ value, count }) => [value, count] as Bucket);
}

export function RasterBandStatisticsCard({
  config,
  loading,
  sources,
  metrics,
}: RasterBandStatisticsCardProps) {
  const { reportingLayers } = config;
  const { t } = useTranslation("reports");

  // Default stats to show: all
  const displayStats = config.componentSettings?.displayStats || {
    min: true,
    max: true,
    mean: true,
    sum: true,
    histogram: true,
  };

  // Get metric data (statistics for the sketch area)
  // Combine statistics from all fragments to get accurate aggregate statistics
  const metricBands = useMemo((): RasterBandStats[] | undefined => {
    // Find all raster_stats metrics from fragments for the current layer
    const layer = reportingLayers[0];
    const source = sources.find(
      (s) => s.tableOfContentsItemId === layer.tableOfContentsItemId
    );
    if (!source) {
      return undefined;
    }

    const fragmentMetrics = metrics.filter(
      (m) =>
        subjectIsFragment(m.subject) &&
        m.type === "raster_stats" &&
        m.sourceUrl === source.sourceUrl
    );

    if (fragmentMetrics.length === 0) {
      return undefined;
    }

    // Collect all bands from all fragments
    const bandsByIndex: { [index: number]: RasterBandStats[] } = {};
    for (const metric of fragmentMetrics) {
      if (!("value" in metric)) continue;
      const bands = (metric.value as { bands?: RasterBandStats[] }).bands;
      if (!bands) continue;
      bands.forEach((band, i) => {
        if (!bandsByIndex[i]) {
          bandsByIndex[i] = [];
        }
        bandsByIndex[i].push(band);
      });
    }

    // Combine bands for each index
    const combinedBands: RasterBandStats[] = [];
    const indices = Object.keys(bandsByIndex)
      .map(Number)
      .sort((a, b) => a - b);
    for (const index of indices) {
      const combined = combineRasterBandStats(bandsByIndex[index]);
      if (combined) {
        combinedBands[index] = combined;
      }
    }

    return combinedBands.length > 0 ? combinedBands : undefined;
  }, [metrics, reportingLayers, sources]);

  // Get raster metadata (for band names, color interpretation, etc.)
  const rasterInfo = useMemo(() => {
    if (reportingLayers.length === 0) {
      return null;
    }

    const layer = reportingLayers[0];
    const source = sources.find(
      (s) => s.tableOfContentsItemId === layer.tableOfContentsItemId
    );
    if (!source) {
      return null;
    }

    // const meta = layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    // if (!meta || !isRasterInfo(meta)) {
    //   return null;
    // }
    return null as RasterInfo | null;
    // return meta;
  }, [reportingLayers, sources]);

  const histograms: Bucket[][] = useMemo(() => {
    if (!metricBands) {
      return [];
    }
    const results = [] as HistogramEntry[][];
    for (const band of metricBands) {
      const histogram: [number, number][] = band.histogram as unknown as [
        number,
        number
      ][];
      const idx = metricBands.indexOf(band);
      results[idx] = [];
      const buckets = rasterInfo?.bands[idx]?.stats?.histogram;
      if (!buckets) {
        continue;
      }
      for (const bucket of buckets) {
        if (bucket[1] === null) {
          continue;
        }
        const entry = { value: bucket[0], count: 0 };
        results[idx].push(entry);
      }
      for (const h of histogram) {
        const [hValue, hCount] = h;
        for (const entry of results[idx]) {
          if (entry.value >= hValue && hCount !== null) {
            entry.count += hCount;
            break;
          }
        }
      }
      for (const entry of results[idx]) {
        entry.count = entry.count / metricBands[idx].count;
      }
    }
    return results.map((entries) => histogramEntriesToBuckets(entries));
  }, [metricBands, rasterInfo]);

  const formatStatValue = (
    value: number | string | null | undefined
  ): string => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (typeof value === "string") {
      return value;
    }
    // Format numbers with appropriate precision
    if (value % 1 === 0) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 5,
      minimumFractionDigits: 0,
    });
  };

  return (
    <div>
      {config.reportingLayers.length === 0 && (
        <Warning>
          <Trans ns="reports">No layer selected.</Trans>
        </Warning>
      )}
      {!loading && !metricBands && config.reportingLayers.length > 0 && (
        <div className="flex items-center space-x-2 py-2">
          <ValueNoneIcon className="w-4 h-4 text-red-800" />
          <span className="text-gray-700">
            <Trans ns="reports">No raster statistics available.</Trans>
          </span>
        </div>
      )}
      {metricBands && metricBands.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Trans ns="reports">Band</Trans>
                </th>
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
                {displayStats.sum && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Sum</Trans>
                  </th>
                )}
                {displayStats.histogram && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Histogram</Trans>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metricBands.map((metricBand: RasterBandStats, index: number) => {
                // Get metadata from rasterInfo if available, otherwise use defaults
                const metadataBand = rasterInfo?.bands[index];
                const bandName =
                  metadataBand?.name ||
                  t("Band {{number}}", { number: index + 1 });
                const colorInterpretation = metadataBand?.colorInterpretation;
                const noDataValue = metadataBand?.noDataValue;

                return (
                  <tr key={index}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{bandName}</div>
                        {colorInterpretation && (
                          <div className="text-xs text-gray-500">
                            {colorInterpretation}
                          </div>
                        )}
                        {noDataValue !== null && noDataValue !== undefined && (
                          <div className="text-xs text-gray-500">
                            <Trans ns="reports">No Data: {noDataValue}</Trans>
                          </div>
                        )}
                      </div>
                    </td>
                    {displayStats.min && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                        {loading ? (
                          <Skeleton className="w-16 h-4" />
                        ) : (
                          formatStatValue(metricBand.min)
                        )}
                      </td>
                    )}
                    {displayStats.max && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                        {loading ? (
                          <Skeleton className="w-16 h-4" />
                        ) : (
                          formatStatValue(metricBand.max)
                        )}
                      </td>
                    )}
                    {displayStats.mean && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                        {loading ? (
                          <Skeleton className="w-16 h-4" />
                        ) : (
                          formatStatValue(metricBand.mean)
                        )}
                      </td>
                    )}
                    {displayStats.sum && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                        {loading ? (
                          <Skeleton className="w-16 h-4" />
                        ) : (
                          formatStatValue(metricBand.sum)
                        )}
                      </td>
                    )}
                    {displayStats.histogram && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        {loading ? (
                          <Skeleton className="w-48 h-20" />
                        ) : (
                          <RasterInfoHistogram
                            data={histograms[index] ?? []}
                            min={metricBand.min}
                            max={metricBand.max}
                            count={metricBand.count}
                            colorInterpretation={colorInterpretation}
                            width={200}
                            height={60}
                            className="rounded bg-gray-50 ring-1 ring-gray-400 overflow-hidden shadow-sm"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
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

const defaultComponentSettings: RasterBandStatisticsCardConfiguration["componentSettings"] =
  {
    displayStats: {
      min: true,
      max: true,
      mean: true,
      sum: true,
      histogram: true,
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
          text: "Raster Band Statistics",
        },
      ],
    },
  ],
};

function RasterBandStatisticsCardIcon() {
  return (
    <div className="bg-purple-100 w-full h-full text-purple-600 flex justify-center items-center rounded">
      <ImageIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "RasterBandStatistics",
  component: RasterBandStatisticsCard,
  adminComponent: RasterBandStatisticsCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Raster Band Statistics</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display statistical information about raster bands including min, max,
      mean, sum, and histograms.
    </Trans>
  ),
  icon: RasterBandStatisticsCardIcon,
  order: 5,
  minimumReportingLayerCount: 1,
  maximumReportingLayerCount: 1,
  supportedReportingLayerTypes: [DataSourceTypes.SeasketchRaster],
});
