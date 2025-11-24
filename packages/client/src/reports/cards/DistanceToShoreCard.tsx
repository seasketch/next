import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans, useTranslation } from "react-i18next";
import {
  LayersIcon,
  RulerSquareIcon,
  ValueNoneIcon,
} from "@radix-ui/react-icons";
import { lazy, useCallback, useMemo } from "react";
import { subjectIsFragment } from "overlay-engine";
import Skeleton from "../../components/Skeleton";
import { useUnits, LengthDisplayUnit } from "../hooks/useUnits";
import { DistanceToShoreMetric } from "overlay-engine";
import { ReportMapStyle, useReportStyleToggle } from "../ReportContext";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";

export type DistanceToShoreCardConfiguration = ReportCardConfiguration<{
  /**
   * Unit to display distance in.
   * Base metric value is in meters; internally we convert to km then
   * use the standard length unit conversions.
   * @default "km"
   */
  unit?: LengthDisplayUnit;
}>;

export type DistanceToShoreCardProps =
  ReportCardProps<DistanceToShoreCardConfiguration>;

// Admin component for configuring the card
const DistanceToShoreCardAdmin = lazy(
  () => import("./DistanceToShoreCardAdmin")
);

export function DistanceToShoreCard({
  config,
  metrics,
  loading,
}: DistanceToShoreCardProps) {
  const { t } = useTranslation("reports");

  const unit = config.componentSettings?.unit ?? "km";
  const { unitLabel, convertFromBase } = useUnits({
    category: "length",
    unit,
  });

  const formatDistance = useCallback(
    (value: number | null): string => {
      if (value === null) {
        return "-";
      }
      if (value === 0) {
        return "0";
      }
      if (value % 1 === 0) {
        return value.toLocaleString();
      }
      if (value > 2) {
        return value.toLocaleString(undefined, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 0,
        });
      } else {
        return value.toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        });
      }
    },
    [unitLabel]
  );

  const minDistanceMeters = useMemo(() => {
    if (loading) {
      return null;
    }

    let min = Infinity;
    for (const metric of metrics) {
      if (!subjectIsFragment(metric.subject)) continue;
      if (metric.type !== "distance_to_shore") continue;
      const value = (metric.value as any)?.meters;
      if (typeof value === "number" && value >= 0 && value < min) {
        min = value;
      }
    }

    return Number.isFinite(min) ? min : null;
  }, [metrics, loading]);

  const minDistanceLineFeature = useMemo(() => {
    if (loading) {
      return null;
    }
    const distanceMetrics = metrics.filter(
      (metric) =>
        metric.type === "distance_to_shore" && subjectIsFragment(metric.subject)
    );
    // get the metric with the smallest value
    let minMetric: DistanceToShoreMetric["value"] | null = null;
    for (const metric of distanceMetrics) {
      const value = (metric.value as any)?.meters;
      if (
        minMetric === null ||
        (typeof value === "number" && value >= 0 && value < minMetric?.meters)
      ) {
        minMetric = metric.value;
      }
    }
    if (minMetric === null) {
      return null;
    } else {
      console.log(
        minMetric.meters,
        `${formatDistance(minMetric.meters / 1000)} ${unitLabel}`
      );
      return {
        ...minMetric.geojsonLine,
        properties: {
          distance: `${formatDistance(minMetric.meters / 1000)} ${unitLabel}`,
        },
      };
    }
    return minMetric?.geojsonLine;
  }, [metrics, loading, formatDistance]);
  const mapStyle = useMemo<ReportMapStyle | null>(() => {
    if (!minDistanceLineFeature) {
      return null;
    }
    return {
      sources: {
        "distance-to-shore": {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [minDistanceLineFeature] as any[],
          },
        },
      },
      layers: [
        {
          id: "distance-to-shore-outline",
          type: "line",
          source: "distance-to-shore",
          paint: {
            "line-color": "white",
            "line-width": 4,
            "line-opacity": 0.5,
          },
        },
        {
          id: "distance-to-shore-line",
          type: "line",
          source: "distance-to-shore",
          paint: {
            "line-color": "rgb(46, 115, 182)",
            "line-width": 2,
          },
        },
        {
          id: "distance-to-shore-line-label",
          type: "symbol",
          source: "distance-to-shore",
          layout: {
            "text-field": "{distance}",
            "text-font": ["Open Sans Regular"],
            "text-size": 12,
            "symbol-placement": "line-center",
            "text-keep-upright": true,
          },
          paint: {
            "text-color": "black",
            "text-halo-color": "rgba(255, 255, 255, 0.8)",
            "text-halo-width": 2,
          },
        },
      ],
    };
  }, [minDistanceLineFeature, unitLabel, formatDistance]);

  const { visible: mapVisible, toggle: toggleMapVisibility } =
    useReportStyleToggle(config.id, "shortest-path", mapStyle);

  // Convert from meters to display value.
  // For kilometers mode, show meters when under 1 km.
  let displayValue: number | null = null;
  let displayLabel = unitLabel;

  if (minDistanceMeters !== null) {
    const km = minDistanceMeters / 1000;
    if (unit === "km" && km < 1) {
      displayValue = minDistanceMeters; // show meters directly
      displayLabel = t("meters");
    } else {
      displayValue = convertFromBase(km);
      displayLabel = unitLabel;
    }
  }

  return (
    <div>
      {loading ? (
        <Skeleton className="w-40 h-6 my-2" />
      ) : minDistanceMeters === null ? (
        <div className="flex items-center space-x-2 py-2">
          <ValueNoneIcon className="w-4 h-4 text-red-800" />
          <span className="text-gray-700">
            <Trans ns="reports">No distance to shore data available.</Trans>
          </span>
        </div>
      ) : (
        <>
          <p className="text-[15px] leading-[24px] py-2">
            <Trans ns="reports">Minimum distance to shore:</Trans>{" "}
            <span className="tabular-nums font-semibold">
              {formatDistance(displayValue)} {displayLabel}
            </span>
          </p>
          {mapStyle && (
            <div className="flex items-center space-x-2 px-1 py-1 mt-1">
              <LayersIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <VisibilityCheckboxAnimated
                id={`distance-to-shore-${config.id}`}
                onClick={toggleMapVisibility}
                disabled={!mapStyle}
                visibility={mapVisible}
                loading={false}
                error={undefined}
                className="flex-none"
              />
              <button
                type="button"
                className="text-sm text-gray-700 cursor-pointer select-none flex-1 text-left"
                onClick={toggleMapVisibility}
              >
                {t("Show shortest path on the map", {
                  defaultValue: "Show shortest path on the map",
                })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const defaultComponentSettings: DistanceToShoreCardConfiguration["componentSettings"] =
  {
    unit: "km",
  };

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Distance to Shore",
        },
      ],
    },
  ],
};

function DistanceToShoreCardIcon() {
  return (
    <div className="bg-blue-100 w-full h-full text-blue-600 flex justify-center items-center rounded">
      <RulerSquareIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "DistanceToShore",
  component: DistanceToShoreCard,
  adminComponent: DistanceToShoreCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Distance to Shore</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Display the minimum distance from the sketch to the shoreline.
    </Trans>
  ),
  icon: DistanceToShoreCardIcon,
  order: 6,
  minimumReportingLayerCount: 0,
  supportedReportingLayerTypes: [],
});
