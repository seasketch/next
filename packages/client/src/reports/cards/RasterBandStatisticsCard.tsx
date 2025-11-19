import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import { ImageIcon, ValueNoneIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import { RasterInfo, isRasterInfo } from "@seasketch/geostats-types";
import Skeleton from "../../components/Skeleton";
import { useTranslation } from "react-i18next";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";
import { RasterInfoHistogram } from "../../admin/data/RasterInfoModal";

export type RasterBandStatisticsCardConfiguration = ReportCardConfiguration<{
  /**
   * Which statistics to display. Defaults to all available.
   */
  displayStats?: {
    min?: boolean;
    max?: boolean;
    mean?: boolean;
    stdev?: boolean;
    histogram?: boolean;
  };
}>;

export type RasterBandStatisticsCardProps =
  ReportCardProps<RasterBandStatisticsCardConfiguration>;

// Admin component for configuring the card
const RasterBandStatisticsCardAdmin = lazy(
  () => import("./RasterBandStatisticsCardAdmin")
);

export function RasterBandStatisticsCard({
  config,
  loading,
  sources,
}: RasterBandStatisticsCardProps) {
  const { reportingLayers } = config;
  const { t } = useTranslation("reports");

  // Default stats to show: all
  const displayStats = config.componentSettings?.displayStats || {
    min: true,
    max: true,
    mean: true,
    stdev: true,
    histogram: true,
  };

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

    const meta = layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    if (!meta || !isRasterInfo(meta)) {
      return null;
    }

    return meta;
  }, [reportingLayers, sources]);

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
      {!loading && !rasterInfo && config.reportingLayers.length > 0 && (
        <div className="flex items-center space-x-2 py-2">
          <ValueNoneIcon className="w-4 h-4 text-red-800" />
          <span className="text-gray-700">
            <Trans ns="reports">No raster statistics available.</Trans>
          </span>
        </div>
      )}
      {rasterInfo && rasterInfo.bands.length > 0 && (
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
                {displayStats.stdev && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Trans ns="reports">Std Dev</Trans>
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
              {rasterInfo.bands.map((band, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">
                        {band.name ||
                          t("Band {{number}}", { number: index + 1 })}
                      </div>
                      {band.colorInterpretation && (
                        <div className="text-xs text-gray-500">
                          {band.colorInterpretation}
                        </div>
                      )}
                      {band.noDataValue !== null && (
                        <div className="text-xs text-gray-500">
                          <Trans ns="reports">
                            No Data: {band.noDataValue}
                          </Trans>
                        </div>
                      )}
                    </div>
                  </td>
                  {displayStats.min && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(band.minimum)
                      )}
                    </td>
                  )}
                  {displayStats.max && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(band.maximum)
                      )}
                    </td>
                  )}
                  {displayStats.mean && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(band.stats.mean)
                      )}
                    </td>
                  )}
                  {displayStats.stdev && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900 tabular-nums">
                      {loading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        formatStatValue(band.stats.stdev)
                      )}
                    </td>
                  )}
                  {displayStats.histogram && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {loading ? (
                        <Skeleton className="w-48 h-20" />
                      ) : (
                        <RasterInfoHistogram
                          data={band.stats.histogram}
                          min={band.minimum}
                          max={band.maximum}
                          count={band.count}
                          colorInterpretation={band.colorInterpretation}
                          width={200}
                          height={60}
                          className="rounded bg-gray-50 ring-1 ring-gray-400 overflow-hidden shadow-sm"
                        />
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

const defaultComponentSettings: RasterBandStatisticsCardConfiguration["componentSettings"] =
  {
    displayStats: {
      min: true,
      max: true,
      mean: true,
      stdev: true,
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
      mean, standard deviation, and histograms.
    </Trans>
  ),
  icon: RasterBandStatisticsCardIcon,
  order: 5,
  minimumReportingLayerCount: 1,
  maximumReportingLayerCount: 1,
  supportedReportingLayerTypes: [DataSourceTypes.SeasketchRaster],
});
