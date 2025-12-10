import { ReportCardConfiguration, ReportCardProps } from "./cards";
import { registerReportCardType } from "../registerCard";
import { Trans } from "react-i18next";
import { LayersIcon, ValueNoneIcon } from "@radix-ui/react-icons";
import { DataSourceTypes } from "../../generated/graphql";
import Warning from "../../components/Warning";
import { lazy, useMemo } from "react";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import Skeleton from "../../components/Skeleton";
import { useReportContext } from "../ReportContext";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import { useNumberFormatters } from "../hooks/useNumberFormatters";
import {
  extractColorsForCategories,
  extractColorForLayers,
} from "../utils/colors";
import { AnyLayer } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import { useUnits, AreaDisplayUnit } from "../hooks/useUnits";
import MapLayerVisibilityControl from "../components/MapLayerVisibilityControl";

// Restricted length units for overlap measurements (only km and mi supported)
type OverlapLengthUnit = "km" | "mi";

export type OverlappingAreasCardConfiguration = ReportCardConfiguration<{
  /**
   * The unit of measurement to display overlap values in.
   * For polygon layers: "km" | "mi" | "acres" | "ha"
   * For line layers: "km" | "mi"
   * @default "km"
   */
  unit?: AreaDisplayUnit | OverlapLengthUnit;
  /**
   * When true, the list will include categories with 0 overlap.
   * When false, categories with zero overlap are hidden.
   * @default false
   */
  showZeroOverlapCategories?: boolean;
  /**
   * Sorting of overlay items: by overlap amount (desc) or by name (asc)
   * @default "overlap"
   */
  sortBy?: "overlap" | "name";
  /**
   * Optional buffer distance (in meters) applied to the sketch before measuring
   * overlap. When omitted or zero, no buffer is applied.
   */
  bufferMeters?: number;
}>;

export type OverlappingAreasCardProps =
  ReportCardProps<OverlappingAreasCardConfiguration>;

// Admin component for configuring the card
const OverlappingAreasCardAdmin = lazy(
  () => import("./OverlappingAreasCardAdmin")
);

/**
 * Helper function to determine if a geometry type is a polygon type
 */
function isPolygonGeometry(geometry: string): boolean {
  return geometry === "Polygon" || geometry === "MultiPolygon";
}

export function OverlappingAreasCard({
  config,
  metrics,
  loading,
  sources,
  errors,
}: OverlappingAreasCardProps) {
  const { reportingLayers } = config;
  const reportContext = useReportContext();
  useTranslation("reports");

  const formatters = useNumberFormatters();

  // Determine geometry type from the first reporting layer's geostats metadata
  const geometryType = useMemo(() => {
    if (reportingLayers.length === 0) return null;
    const firstLayer = reportingLayers[0];
    const meta = undefined;
    // firstLayer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    return null;
    // if (!meta || isRasterInfo(meta)) return null;
    // const geostats = meta.layers[0] as GeostatsLayer;
    // return geostats.geometry;
  }, [reportingLayers]);

  // Determine unit category based on geometry type
  const isPolygonLayer = geometryType ? isPolygonGeometry(geometryType) : true; // Default to area for backwards compatibility

  const { unitLabel, convertFromBase } = useUnits(
    isPolygonLayer
      ? {
          category: "area",
          unit: (config.componentSettings?.unit ?? "km") as AreaDisplayUnit,
        }
      : {
          category: "length",
          unit: (config.componentSettings?.unit ?? "km") as "km" | "mi",
        }
  );

  // Sum overlap values by layer and category
  const sumSketchOverlaysByClass = useMemo(() => {
    let layers: { [layer: string]: { [classKey: string]: number } } = {};
    if (metrics.length > 0) {
      for (const metric of metrics) {
        if (subjectIsFragment(metric.subject)) {
          if (!(metric.sourceUrl! in layers)) {
            layers[metric.sourceUrl!] = {};
          }
          let key = !metric.parameters?.groupBy
            ? "*"
            : metric.parameters?.groupBy || "*";
          if (!(key in layers[metric.sourceUrl!])) {
            layers[metric.sourceUrl!][key] = 0;
          }
          if (metric.value && typeof metric.value === "object") {
            for (const valKey of Object.keys(metric.value)) {
              if (!(valKey in layers[metric.sourceUrl!])) {
                layers[metric.sourceUrl!][valKey] = 0;
              }
              layers[metric.sourceUrl!][valKey] += (
                metric.value as { [groupBy: string]: number }
              )[valKey];
            }
          }
        }
      }
      return layers;
    } else {
      return null;
    }
  }, [metrics]);

  const sketchClassPrimaryGeographyId =
    reportContext.sketchClass?.clippingGeographies?.[0]?.id;

  const items = useMemo(() => {
    const items: {
      title: string;
      value?: number;
      color?: string;
      percentage?: number;
    }[] = [];
    return items;

    // for (const layer of reportingLayers) {
    //   const source = sources.find(
    //     (s) => s.tableOfContentsItemId === layer.tableOfContentsItemId
    //   );
    //   if (!source) {
    //     continue;
    //     // throw new Error(
    //     //   `Source for layer ${layer.tableOfContentsItem?.title} not found`
    //     // );
    //   }
    //   const sourceUrl = source.output?.url;
    //   if (!sourceUrl) {
    //     continue;
    //   }
    //   // get the geography-level total for this layer
    //   const geographyMetric = sketchClassPrimaryGeographyId
    //     ? (metrics || []).find(
    //         (m) =>
    //           subjectIsGeography(m.subject) &&
    //           // @ts-ignore
    //           m.subject.id === sketchClassPrimaryGeographyId &&
    //           m.type === "overlay_area" &&
    //           m.parameters?.groupBy === layer.layerParameters?.groupBy
    //       )
    //     : null;

    //   // Determine if this layer is polygon or line geometry
    //   const layerMeta =
    //     layer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    //   if (!layerMeta) {
    //     throw new Error(
    //       `Layer ${layer.tableOfContentsItem?.title} has no geostats metadata`
    //     );
    //   }

    //   if (layer.layerParameters?.groupBy) {
    //     // get values for groupBy
    //     if (!isRasterInfo(layerMeta)) {
    //       const geostats = layerMeta.layers[0] as GeostatsLayer;
    //       const attr = geostats.attributes.find(
    //         (a) => a.attribute === layer.layerParameters.groupBy
    //       );
    //       if (!attr) {
    //         throw new Error(
    //           `Group by attribute ${
    //             layer.layerParameters.groupBy
    //           } not found in layer ${
    //             layer.tableOfContentsItem?.title || "Untitled"
    //           }`
    //         );
    //       }
    //       if (!layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles) {
    //         throw new Error(
    //           `Layer ${
    //             layer.tableOfContentsItem?.title || "Untitled"
    //           } has no mapboxGL styles`
    //         );
    //       }
    //       const colors = extractColorsForCategories(
    //         Object.keys(attr.values),
    //         attr,
    //         layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles as AnyLayer[]
    //       );
    //       const values = Object.keys(attr.values);
    //       for (const value of values) {
    //         const geographyTotal = (geographyMetric?.value as any)?.[value];
    //         const overlapValue = sumSketchOverlaysByClass?.[sourceUrl]?.[value];
    //         if (overlapValue && overlapValue > 0) {
    //           items.push({
    //             title: value,
    //             value: overlapValue,
    //             color: colors[value],
    //             percentage: geographyTotal
    //               ? overlapValue / geographyTotal
    //               : undefined,
    //           });
    //         } else if (config.componentSettings?.showZeroOverlapCategories) {
    //           items.push({ title: value, color: colors[value], percentage: 0 });
    //         }
    //       }
    //     } else {
    //       throw new Error(
    //         "OverlappingAreasCard does not support raster layers"
    //       );
    //     }
    //   } else {
    //     const overlapValue = sumSketchOverlaysByClass?.[sourceUrl]?.["*"];
    //     const geographyTotal = (geographyMetric?.value as any)?.["*"];
    //     if (overlapValue && overlapValue > 0) {
    //       items.push({
    //         title: "All features",
    //         value: overlapValue,
    //         percentage: geographyTotal
    //           ? overlapValue / geographyTotal
    //           : undefined,
    //         color: extractColorForLayers(
    //           layer.tableOfContentsItem?.dataLayer?.mapboxGlStyles as AnyLayer[]
    //         ),
    //       });
    //     } else if (config.componentSettings?.showZeroOverlapCategories) {
    //       items.push({ title: layer.tableOfContentsItem?.title || "Untitled" });
    //     }
    //   }
    // }
    // // Apply sorting per configuration
    // const sortBy = config.componentSettings?.sortBy || "overlap";
    // if (sortBy === "name") {
    //   items.sort((a, b) => a.title.localeCompare(b.title));
    // } else {
    //   items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    // }
    // return items;
  }, [
    reportingLayers,
    sumSketchOverlaysByClass,
    config.componentSettings,
    metrics,
    sources,
    sketchClassPrimaryGeographyId,
  ]);

  return (
    <div>
      {config.reportingLayers.length === 0 && (
        <Warning>
          <Trans ns="reports">No layers selected..</Trans>
        </Warning>
      )}
      <div>
        {!loading &&
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
                {loading ? (
                  <Skeleton className="w-10 h-4" />
                ) : (
                  <>
                    {formatters.area(convertFromBase(item.value || 0))}{" "}
                    {unitLabel}
                  </>
                )}
              </div>
              {typeof item.percentage === "number" && (
                <div className="tabular-nums w-16 text-right">
                  {loading ? (
                    <Skeleton className="w-10 h-4" />
                  ) : (
                    <>{formatters.percent(item.percentage)}</>
                  )}
                </div>
              )}
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
          text: "Measure Overlap",
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
  label: <Trans ns="admin:sketching">Measure Overlap</Trans>,
  description: (
    <Trans ns="admin:sketching">
      Quantify overlap with polygon or line layers. For example, display types
      of habitats captured along with targets for protection.
    </Trans>
  ),
  icon: OverlappingAreasCardIcon,
  order: 2,
  minimumReportingLayerCount: 1,
  supportedReportingLayerTypes: [
    DataSourceTypes.SeasketchVector,
    DataSourceTypes.SeasketchMvt,
  ],
});
