import { ReportCardConfiguration, ReportCardProps } from "./cards";
import ReportCard from "../ReportCard";
import {
  registerReportCardType,
  ReportCardConfigUpdateCallback,
} from "../registerCard";
import { Trans } from "react-i18next";
import {
  InfoCircledIcon,
  LayersIcon,
  ShadowNoneIcon,
  ValueNoneIcon,
} from "@radix-ui/react-icons";
import { DataUploadOutputType } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import { isRasterInfo } from "@seasketch/geostats-types";
import Skeleton from "../../components/Skeleton";
import { useMetrics } from "../hooks/useMetrics";
import { useReportContext } from "../ReportContext";
import { subjectIsFragment } from "overlay-engine";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import { extractColorsForCategories } from "../utils/colors";
import { AnyLayer } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import { useUnits } from "../hooks/useUnits";

export type OverlappingAreasCardConfiguration = ReportCardConfiguration<{
  /**
   * The unit of measurement to display the area in.
   * @default "km"
   */
  unit?: "km" | "mi" | "acres";
  /**
   * When true, the list will include categories with 0 area.
   * When false, categories with zero overlap are hidden.
   * @default false
   */
  showZeroOverlapCategories?: boolean;
  /**
   * Sorting of overlay items: by overlap amount (desc) or by name (asc)
   * @default "overlap"
   */
  sortBy?: "overlap" | "name";
}>;

export type OverlappingAreasCardProps =
  ReportCardProps<OverlappingAreasCardConfiguration>;

// Admin component for configuring the card
const OverlappingAreasCardAdmin = lazy(
  () => import("./OverlappingAreasCardAdmin")
);

export function OverlappingAreasCard({
  config,
  dragHandleProps,
  onUpdate,
}: OverlappingAreasCardProps & {
  dragHandleProps?: any;
  onUpdate?: ReportCardConfigUpdateCallback;
}) {
  const { reportingLayers } = config;
  const reportContext = useReportContext();
  useTranslation("reports");
  const allGeographyIds = useMemo(() => {
    return reportContext.geographies.map((g) => g.id);
  }, [reportContext.geographies]);

  const formatters = useNumberFormatters();

  const { unitLabel, convertFromBase } = useUnits({
    category: "area",
    unit: config.componentSettings?.unit ?? "km",
  });

  // Fetch total_area (if needed elsewhere later). Currently not used directly.

  const overlayMetrics = useMetrics({
    type: "overlay_area",
    geographyIds: allGeographyIds,
    layers: reportingLayers.map((l) => ({
      stableId: l.stableId,
      groupBy: l.groupBy,
      sourceUrl: l.url,
      sourceType: l.type,
    })),
  });

  const sumSketchOverlaysByClass = useMemo(() => {
    let layers: { [layer: string]: { [classKey: string]: number } } = {};
    if (overlayMetrics.data) {
      for (const metric of overlayMetrics.data) {
        if (subjectIsFragment(metric.subject)) {
          if (!(metric.stableId in layers)) {
            layers[metric.stableId] = {};
          }
          let key =
            !metric.groupBy && typeof metric.value === "number"
              ? "*"
              : metric.groupBy;
          if (!(key in layers[metric.stableId])) {
            layers[metric.stableId][key] = 0;
          }
          if (
            metric.groupBy &&
            metric.value &&
            typeof metric.value === "object"
          ) {
            for (const valKey of Object.keys(metric.value)) {
              if (!(valKey in layers[metric.stableId])) {
                layers[metric.stableId][valKey] = 0;
              }
              layers[metric.stableId][valKey] += (
                metric.value as { [groupBy: string]: number }
              )[valKey];
            }
          } else {
            layers[metric.stableId][key] += metric.value as number;
          }
        }
      }
      return layers;
    } else {
      return null;
    }
  }, [overlayMetrics.data]);

  const items = useMemo(() => {
    const items: { title: string; value?: number; color?: string }[] = [];
    for (const layer of reportingLayers) {
      if (layer.groupBy) {
        // get values for groupBy
        if (!isRasterInfo(layer.meta)) {
          const geostats = layer.meta.layers[0];
          const attr = geostats.attributes.find(
            (a) => a.attribute === layer.groupBy
          );
          if (!attr) {
            throw new Error(
              `Group by attribute ${layer.groupBy} not found in layer ${layer.title}`
            );
          }
          const colors = extractColorsForCategories(
            Object.keys(attr.values),
            attr,
            layer.mapboxGlStyles as AnyLayer[]
          );
          const values = Object.keys(attr.values);
          for (const value of values) {
            const area = sumSketchOverlaysByClass?.[layer.stableId]?.[value];
            if (area && area > 0) {
              items.push({ title: value, value: area, color: colors[value] });
            } else if (config.componentSettings?.showZeroOverlapCategories) {
              items.push({ title: value, color: colors[value] });
            }
          }
        } else {
          throw new Error(
            "OverlappingAreasCard does not support raster layers"
          );
        }
      } else {
        const area = sumSketchOverlaysByClass?.[layer.stableId]?.["*"];
        if (area && area > 0) {
          items.push({ title: layer.title, value: area });
        } else if (config.componentSettings?.showZeroOverlapCategories) {
          items.push({ title: layer.title });
        }
      }
    }
    // Apply sorting per configuration
    const sortBy = config.componentSettings?.sortBy || "overlap";
    if (sortBy === "name") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }
    return items;
  }, [reportingLayers, sumSketchOverlaysByClass, config.componentSettings]);

  return (
    <ReportCard
      dragHandleProps={dragHandleProps}
      cardId={config.id}
      onUpdate={onUpdate}
      config={config}
      className="pb-2"
      tint={config.tint}
      icon={config.icon}
    >
      <div>
        {config.reportingLayers.length === 0 && (
          <Warning>
            <Trans ns="reports">No layers selected..</Trans>
          </Warning>
        )}
        <div>
          {overlayMetrics.loading && (
            <div>
              <Skeleton className="w-full h-4" />
            </div>
          )}
          {!overlayMetrics.loading &&
            items.length > 0 &&
            items.map((item) => (
              <div
                className={`flex max-w-full items-center px-2 space-x-2 ${
                  item.value ? "opacity-100" : "opacity-50"
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
                  {overlayMetrics.loading ? (
                    <Skeleton className="w-10 h-4" />
                  ) : (
                    <>
                      {formatters.area(convertFromBase(item.value || 0))}{" "}
                      {unitLabel}
                    </>
                  )}
                </div>
              </div>
            ))}
          {!overlayMetrics.loading && items.length === 0 && (
            <div className="flex items-center space-x-2">
              <ValueNoneIcon className="w-4 h-4 text-red-800" />
              <span className="text-gray-700">
                <Trans ns="reports">No overlapping features found.</Trans>
              </span>
            </div>
          )}
        </div>
      </div>
    </ReportCard>
  );
}

const defaultComponentSettings: OverlappingAreasCardConfiguration["componentSettings"] =
  {};

const defaultBody = {
  type: "doc",
  content: [
    {
      type: "reportTitle",
      content: [
        {
          type: "text",
          text: "Overlapping Areas",
        },
      ],
    },
  ],
};

function OverlappingAreasCardIcon() {
  return (
    <div className="bg-fuchsia-100 w-full h-full text-fuchsia-600 flex justify-center items-center rounded">
      <LayersIcon className="w-5 h-5" />
    </div>
  );
}

registerReportCardType({
  type: "OverlappingAreas",
  component: OverlappingAreasCard,
  adminComponent: OverlappingAreasCardAdmin,
  defaultSettings: defaultComponentSettings,
  defaultBody: defaultBody,
  label: <Trans ns="admin:sketching">Measure Overlapping Areas</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Analyze overlap with vector layers. For example, display types of habitats
      captured along with targets for protection.
    </Trans>
  ),
  icon: OverlappingAreasCardIcon,
  order: 2,
  minimumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataUploadOutputType.GeoJson,
    DataUploadOutputType.FlatGeobuf,
  ],
});
