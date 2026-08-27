import { InlineMetric, InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControlsProps } from "../../editor/TooltipMenu";
import {
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  memo,
} from "react";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "../commandPalette/types";
import {
  CompatibleSpatialMetricDetailsFragment,
  DataSourceTypes,
  Geography,
  OverlaySourceDetailsFragment,
  OverlaySourceListDetailsFragment,
  ReportContextSketchClassDetailsFragment,
  SketchGeometryType,
  SpatialMetricState,
  useOverlaySourceProcessingStatusQuery,
  useProjectReportingLayersQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { AnyLayer } from "mapbox-gl";
import { EditorView } from "prosemirror-view";
import {
  MetricDependency,
  OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY,
} from "overlay-engine";
import {
  NodeSelection,
  SelectionRange,
  TextSelection,
} from "prosemirror-state";
import { ErrorBoundary } from "@sentry/react";
import { Trans, useTranslation } from "react-i18next";
import {
  GeographySizeTable,
  GeographySizeTableTooltipControls,
} from "./GeographySizeTable";
import {
  DistanceToShoreMap,
  DistanceToShoreMapTooltipControls,
} from "./DistanceToShoreMap";
import {
  SketchAttributesTable,
  SketchAttributesTableTooltipControls,
} from "./SketchAttributesTable";
import {
  MpaGuideLevelOfProtection,
  MpaGuideLevelOfProtectionTooltipControls,
} from "./mpaGuide/MpaGuideLevelOfProtection";
import {
  OverlappingAreasTable,
  OverlappingAreasTableTooltipControls,
} from "./OverlappingAreasTable";
import {
  FeatureCountTable,
  FeatureCountTableTooltipControls,
} from "./FeatureCountTable";
import {
  FeaturePresenceTable,
  FeaturePresenceTableTooltipControls,
} from "./FeaturePresenceTable";
import {
  IntersectingFeaturesList,
  IntersectingFeaturesListTooltipControls,
} from "./IntersectingFeaturesList";
import {
  BlockLayerToggle,
  BlockLayerToggleTooltipControls,
} from "./BlockLayerToggle";
import {
  InlineLayerToggle,
  InlineLayerToggleTooltipControls,
} from "./InlineLayerToggle";
import {
  ColumnStatisticsTable,
  ColumnStatisticsTableTooltipControls,
} from "./ColumnStatisticsTable";
import {
  ColumnSumTable,
  ColumnSumTableTooltipControls,
} from "./ColumnSumTable";
import { pickBestColumnForPercentOfColumnTotal } from "./columnTotalFromGeostats";
import {
  ColumnValuesHistogram,
  ColumnValuesHistogramTooltipControls,
} from "./ColumnValuesHistogram";
import {
  RasterValuesHistogram,
  RasterValuesHistogramTooltipControls,
} from "./RasterValuesHistogram";
import {
  RasterStatisticsTable,
  RasterStatisticsTableTooltipControls,
} from "./RasterStatisticsTable";
import {
  RasterProportionTable,
  RasterProportionTableTooltipControls,
} from "./RasterProportionTable";
import {
  RasterAreaCapturedTable,
  RasterAreaCapturedTableTooltipControls,
} from "./RasterAreaCapturedTable";
import {
  ClassCompositionChart,
  ClassCompositionChartTooltipControls,
} from "./ClassCompositionChart";
import {
  RasterTimeSeries,
  RasterTimeSeriesTooltipControls,
  buildRasterTimeSeriesDependencies,
} from "./RasterTimeSeries";
import {
  VectorTimeSeries,
  VectorTimeSeriesTooltipControls,
  buildVectorTimeSeriesDependencies,
  defaultVectorTimeSeriesMode,
} from "./VectorTimeSeries";
import {
  coverageForSource,
  findTimeSeriesSiblings,
  isLayerGranularityTemporal,
} from "./temporalChart";
import {
  OusDemographicsTable,
  OusDemographicsTableTooltipControls,
} from "./OusDemographicsTable";
import { Mark, Node } from "prosemirror-model";
import { useWidgetDependencies } from "../hooks/useWidgetDependencies";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useReactNodeView } from "../ReactNodeView";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ExclamationTriangleIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { FolderIcon } from "@heroicons/react/outline";
import Badge from "../../components/Badge";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Spinner from "../../components/Spinner";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import {
  findGetExpression,
  isExpression,
} from "../../dataLayers/legends/utils";
import * as Popover from "@radix-ui/react-popover";
import { TooltipPopoverContent } from "../../editor/TooltipMenu";
import useDebounce from "../../useDebounce";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  getMetricErrorInfo,
  MetricSuggestedFixes,
} from "../components/MetricSuggestedFixes";

type WidgetComponent = React.FC<any>;

const DEBUG_WIDGET_MEMO = false;

/**
 * HOC that adds mount/unmount logging for debugging widget lifecycle
 */
function withMountLogging(
  Component: WidgetComponent,
  name: string
): WidgetComponent {
  return function MountLoggedComponent(props: any) {
    useEffect(() => {
      // eslint-disable-next-line no-console
      console.warn(`🆕 [${name}] MOUNTED`);
      return () => {
        // eslint-disable-next-line no-console
        console.warn(`💀 [${name}] UNMOUNTED`);
      };
    }, []);
    return <Component {...props} />;
  };
}

/**
 * Deep comparison for widget props that checks value equality for objects
 * that might have new references but same content (e.g., from ProseMirror nodes)
 */
function widgetPropsAreEqual(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>
): boolean {
  // Props that can be compared by reference (already stabilized by useWidgetDependencies)
  const stableRefProps = [
    "metrics",
    "sources",
    "geographies",
    "sketchClass",
    "errors",
  ];

  // Props that need value comparison (come from ProseMirror or may change reference)
  const valueCompareProps = [
    "componentSettings",
    "dependencies",
    "alternateLanguageSettings",
  ];

  // Primitive props - simple equality
  const primitiveProps = ["loading", "lang"];

  // Check stable reference props
  for (const key of stableRefProps) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  // Check primitive props
  for (const key of primitiveProps) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  // Check value-compare props using JSON stringification
  for (const key of valueCompareProps) {
    const prev = prevProps[key];
    const next = nextProps[key];
    if (prev === next) continue;
    if (prev === undefined || next === undefined) {
      if (prev !== next) return false;
      continue;
    }
    try {
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        return false;
      }
    } catch {
      // If JSON.stringify fails, fall back to reference comparison
      if (prev !== next) return false;
    }
  }

  // Skip comparing 'node' and 'marks' - they don't affect widget output directly
  // The relevant data from node is already extracted into componentSettings/dependencies

  return true;
}

function debugPropsEqual(
  componentName: string,
  prevProps: Record<string, any>,
  nextProps: Record<string, any>
) {
  const allKeys = new Set([
    ...Object.keys(prevProps),
    ...Object.keys(nextProps),
  ]);
  const changed = Array.from(allKeys).filter(
    (key) => prevProps[key] !== nextProps[key]
  );
  if (changed.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`🔄 [${componentName}] Props changed:`, changed, {
      prev: Object.fromEntries(changed.map((k) => [k, prevProps[k]])),
      next: Object.fromEntries(changed.map((k) => [k, nextProps[k]])),
    });
    return false;
  }
  // eslint-disable-next-line no-console
  console.log(`✅ [${componentName}] Props stable, skipping render`);
  return true;
}

function memoWidget(Component: WidgetComponent, name: string) {
  if (DEBUG_WIDGET_MEMO) {
    // Wrap with mount logging, then memo with debug comparison
    const logged = withMountLogging(Component, name);
    return memo(logged, (prevProps, nextProps) =>
      debugPropsEqual(
        name,
        prevProps as Record<string, any>,
        nextProps as Record<string, any>
      )
    );
  }
  return memo(Component, widgetPropsAreEqual);
}

const WidgetErrorActions: FC<{
  cardId: number;
  compact?: boolean;
}> = ({ cardId, compact }) => {
  const { setShowCalcDetails, requestWidgetSettings, adminMode } =
    useContext(ReportUIStateContext);
  const { getPos } = useReactNodeView();
  const { t } = useTranslation("reports");

  const onAdjustSettings = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof getPos !== "function") {
        return;
      }
      try {
        requestWidgetSettings(cardId, getPos());
      } catch (e) {
        // Node views can briefly outlive their ProseMirror position during
        // edits. In that case, do nothing rather than throwing from the button.
      }
    },
    [cardId, getPos, requestWidgetSettings]
  );

  const onViewDetails = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setShowCalcDetails(cardId);
    },
    [cardId, setShowCalcDetails]
  );

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-2" : "mt-3"}`}>
      <button
        onClick={onViewDetails}
        className={`inline-flex items-center rounded border border-gray-300 bg-white font-medium text-gray-700 shadow-sm hover:bg-gray-50 ${
          compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        }`}
      >
        <span>{t("View details")}</span>
      </button>
      {adminMode && typeof getPos === "function" ? (
        <button
          onClick={onAdjustSettings}
          className={`inline-flex items-center rounded border border-gray-300 bg-white font-medium text-gray-700 shadow-sm hover:bg-gray-50 ${
            compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
          }`}
        >
          <span>{t("Adjust settings")}</span>
        </button>
      ) : null}
    </div>
  );
};

/**
 * Error display components that access ReportContext only when errors occur.
 * By isolating context access here, we avoid subscribing to context in the
 * normal (non-error) rendering path.
 */
const WidgetErrorInline: FC<{
  errors: string[];
  cardId: number;
  dependencies: MetricDependency[];
}> = ({ errors, cardId, dependencies }) => {
  const { setShowCalcDetails } = useContext(ReportUIStateContext);
  const { t } = useTranslation("reports");
  const errorDetails = errors.join(". \n");
  const { errorMap, suggestedFixes } = useMemo(
    () => getMetricErrorInfo(errors, dependencies),
    [dependencies, errors]
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            onClick={() => setShowCalcDetails(cardId)}
            className="bg-red-700 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center space-x-1"
          >
            <ExclamationTriangleIcon className="w-3 h-3 inline-block" />
            <span className="font-semibold">{t("Error")}</span>
            <span className="max-w-24 truncate text-red-200">
              {errorDetails}
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="pointer-events-auto z-50 max-w-sm rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <div className="font-semibold text-red-800">
                {t("Calculation error")}
              </div>
            </div>
            <ul className="mt-1 space-y-1 !pl-0">
              {Object.entries(errorMap).map(([error, count]) => (
                <li key={error} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                    {error}
                  </span>
                  {Number(count) > 1 && (
                    <Badge variant="error" className="ml-1 shrink-0">
                      {Number(count)}
                      {t("x")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <MetricSuggestedFixes suggestedFixes={suggestedFixes} compact />
            <WidgetErrorActions cardId={cardId} compact />
          </div>
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

const WidgetErrorBlock: FC<{
  errors: string[];
  cardId: number;
  dependencies: MetricDependency[];
  widgetType?: string;
}> = ({ errors, cardId, dependencies, widgetType }) => {
  const { t } = useTranslation("reports");

  const { errorMap, suggestedFixes } = useMemo(
    () => getMetricErrorInfo(errors, dependencies),
    [dependencies, errors]
  );

  return (
    <div className="my-3 overflow-hidden rounded-md border border-red-200 bg-white text-left shadow-sm">
      <div className="border-l-4 border-red-500 px-3 py-3">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-red-600" />
          <div className="text-base font-semibold leading-none text-red-800">
            {t("Calculation error")}
          </div>
        </div>
        {widgetType ? (
          <div className="mt-1 pl-6 text-xs font-medium text-gray-500">
            {widgetType}
          </div>
        ) : null}
        <ul className="py-1 !pl-0 space-y-1 text-sm text-gray-700">
          {Object.entries(errorMap).map(([msg, count]) => (
            <li key={msg} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <span className="min-w-0 flex-1">{msg}</span>
              {Number(count) > 1 && (
                <Badge variant="error" className="ml-2 shrink-0">
                  {Number(count)}
                  {t("x")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <MetricSuggestedFixes suggestedFixes={suggestedFixes} />
        <WidgetErrorActions cardId={cardId} />
      </div>
    </div>
  );
};

const memoizedWidgets: Record<string, WidgetComponent> = {
  InlineMetric: memoWidget(InlineMetric, "InlineMetric"),
  GeographySizeTable: memoWidget(GeographySizeTable, "GeographySizeTable"),
  DistanceToShoreMap: memoWidget(DistanceToShoreMap, "DistanceToShoreMap"),
  SketchAttributesTable: memoWidget(
    SketchAttributesTable,
    "SketchAttributesTable"
  ),
  MpaGuideLevelOfProtection: memoWidget(
    MpaGuideLevelOfProtection,
    "MpaGuideLevelOfProtection"
  ),
  OverlappingAreasTable: memoWidget(
    OverlappingAreasTable,
    "OverlappingAreasTable"
  ),
  FeatureCountTable: memoWidget(FeatureCountTable, "FeatureCountTable"),
  FeaturePresenceTable: memoWidget(
    FeaturePresenceTable,
    "FeaturePresenceTable"
  ),
  IntersectingFeaturesList: memoWidget(
    IntersectingFeaturesList,
    "IntersectingFeaturesList"
  ),
  ColumnStatisticsTable: memoWidget(
    ColumnStatisticsTable,
    "ColumnStatisticsTable"
  ),
  ColumnSumTable: memoWidget(ColumnSumTable, "ColumnSumTable"),
  ColumnValuesHistogram: memoWidget(
    ColumnValuesHistogram,
    "ColumnValuesHistogram"
  ),
  RasterValuesHistogram: memoWidget(
    RasterValuesHistogram,
    "RasterValuesHistogram"
  ),
  RasterStatisticsTable: memoWidget(
    RasterStatisticsTable,
    "RasterStatisticsTable"
  ),
  RasterProportionTable: memoWidget(
    RasterProportionTable,
    "RasterProportionTable"
  ),
  RasterAreaCapturedTable: memoWidget(
    RasterAreaCapturedTable,
    "RasterAreaCapturedTable"
  ),
  ClassCompositionChart: memoWidget(
    ClassCompositionChart,
    "ClassCompositionChart"
  ),
  RasterTimeSeries: memoWidget(RasterTimeSeries, "RasterTimeSeries"),
  VectorTimeSeries: memoWidget(VectorTimeSeries, "VectorTimeSeries"),
  OusDemographicsTable: memoWidget(
    OusDemographicsTable,
    "OusDemographicsTable"
  ),
  InlineLayerToggle: memoWidget(InlineLayerToggle, "InlineLayerToggle"),
  BlockLayerToggle: memoWidget(BlockLayerToggle, "BlockLayerToggle"),
};

function groupByForStyle(
  mapboxGlStyles: AnyLayer[] | null | undefined,
  geostatsLayer?: GeostatsLayer
): string | undefined {
  if (!mapboxGlStyles?.length || !geostatsLayer) {
    return undefined;
  }

  const geometry = geostatsLayer.geometry;
  const attributeNames = new Set(
    geostatsLayer.attributes?.map((a) => a.attribute) || []
  );

  const paintProps =
    geometry === "Polygon" || geometry === "MultiPolygon"
      ? ["fill-color"]
      : geometry === "LineString" || geometry === "MultiLineString"
      ? ["line-color"]
      : ["circle-color", "icon-image"];

  for (const layer of mapboxGlStyles) {
    if (!("paint" in layer)) continue;
    const paint = (layer as { paint?: Record<string, any> }).paint;
    if (!paint) continue;
    for (const prop of paintProps) {
      const value = paint[prop];
      if (!value || !isExpression(value)) continue;
      const getExpr = findGetExpression(value);
      if (
        getExpr?.property &&
        (!attributeNames.size || attributeNames.has(getExpr.property))
      ) {
        return getExpr.property;
      }
    }
  }

  return undefined;
}

function labelColumnForGeostatsLayer(
  geostatsLayer: GeostatsLayer,
  mapboxGlStyles?: AnyLayer[] | null
): string | undefined {
  if (!geostatsLayer?.attributes) return undefined;

  // Attributes to exclude from consideration
  const excludePatterns = [
    /shape[_-]?length/i,
    /shape[_-]?area/i,
    /area/i,
    /length/i,
    /perimeter/i,
    /id$/i,
    /^id/i,
    /^fid/i,
    /^gid/i,
    /^objectid/i,
    /^oid/i,
  ];

  // Important paint properties to check for get expressions
  const importantPaintProps = [
    "fill-color",
    "line-color",
    "circle-color",
    "icon-image",
  ];

  // First, collect attributes used in the style
  const styleAttributes = new Set<string>();
  if (mapboxGlStyles?.length) {
    for (const layer of mapboxGlStyles) {
      if ("paint" in layer && layer.paint) {
        for (const prop of importantPaintProps) {
          const value = (layer.paint as Record<string, any>)[prop];
          if (value && isExpression(value)) {
            const getExpr = findGetExpression(value);
            if (getExpr && "property" in getExpr) {
              styleAttributes.add(getExpr.property);
            }
          }
        }
      }
    }
  }

  // Score all attributes
  const scoredAttributes = geostatsLayer.attributes
    .map((attr) => {
      let score = 0;

      // Check if number of unique values matches feature count
      const uniqueValues = Object.keys(attr.values || {}).length;
      const hasUniqueValues = uniqueValues === geostatsLayer.count;
      if (hasUniqueValues) score += 3;

      // Highest priority: attributes used in style
      if (styleAttributes.has(attr.attribute)) {
        score += 5;
      }

      // Check if it's a string type
      const firstValue = Object.keys(attr.values || {})[0];
      if (firstValue && typeof firstValue === "string") {
        score += 2;
      }

      // Penalize attributes that match exclusion patterns
      const shouldExclude = excludePatterns.some((pattern) =>
        pattern.test(attr.attribute)
      );
      if (shouldExclude) score -= 2;

      return {
        attribute: attr.attribute,
        score,
        hasUniqueValues,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Prefer attributes with unique values, but fall back to highest scored if none
  const bestWithUniqueValues = scoredAttributes.find(
    (attr) => attr.hasUniqueValues
  );
  if (bestWithUniqueValues) {
    return bestWithUniqueValues.attribute;
  }

  // Fall back to highest scored attribute
  return scoredAttributes[0]?.attribute;
}

// Function declarations (not `const`) so these exports are initialized during
// module instantiation. widgets.tsx sits in a circular import graph with
// individual widgets and TooltipMenu; CRA Fast Refresh re-evaluates that
// graph and a `const` router throws "Cannot access X before initialization".

export function ReportWidgetTooltipControlsRouter(
  props: ReportWidgetTooltipControlsProps
) {
  switch (props.node.attrs.type) {
    case "InlineMetric":
      return <InlineMetricTooltipControls {...props} />;
    case "GeographySizeTable":
      return <GeographySizeTableTooltipControls {...props} />;
    case "DistanceToShoreMap":
      return <DistanceToShoreMapTooltipControls {...props} />;
    case "SketchAttributesTable":
      return <SketchAttributesTableTooltipControls {...props} />;
    case "MpaGuideLevelOfProtection":
      return <MpaGuideLevelOfProtectionTooltipControls {...props} />;
    case "OverlappingAreasTable":
      return <OverlappingAreasTableTooltipControls {...props} />;
    case "FeatureCountTable":
      return <FeatureCountTableTooltipControls {...props} />;
    case "FeaturePresenceTable":
      return <FeaturePresenceTableTooltipControls {...props} />;
    case "IntersectingFeaturesList":
      return <IntersectingFeaturesListTooltipControls {...props} />;
    case "ColumnStatisticsTable":
      return <ColumnStatisticsTableTooltipControls {...props} />;
    case "ColumnSumTable":
      return <ColumnSumTableTooltipControls {...props} />;
    case "ColumnValuesHistogram":
      return <ColumnValuesHistogramTooltipControls {...props} />;
    case "RasterValuesHistogram":
      return <RasterValuesHistogramTooltipControls {...props} />;
    case "RasterStatisticsTable":
      return <RasterStatisticsTableTooltipControls {...props} />;
    case "RasterProportionTable":
      return <RasterProportionTableTooltipControls {...props} />;
    case "RasterAreaCapturedTable":
      return <RasterAreaCapturedTableTooltipControls {...props} />;
    case "ClassCompositionChart":
      return <ClassCompositionChartTooltipControls {...props} />;
    case "RasterTimeSeries":
      return <RasterTimeSeriesTooltipControls {...props} />;
    case "VectorTimeSeries":
      return <VectorTimeSeriesTooltipControls {...props} />;
    case "OusDemographicsTable":
      return <OusDemographicsTableTooltipControls {...props} />;
    case "BlockLayerToggle":
      return <BlockLayerToggleTooltipControls {...props} />;
    case "InlineLayerToggle":
      return <InlineLayerToggleTooltipControls {...props} />;
    default:
      return null;
  }
}

export function ReportWidgetNodeViewRouter(props: any) {
  // NOTE: We intentionally avoid useReportContext() here to prevent re-renders
  // when unrelated context data changes. Error components access context themselves.
  const languageContext = useContext(FormLanguageContext);
  const lang = languageContext?.lang?.code;
  const node = props.node as Node;
  const cardId = props.cardId;
  const { type, componentSettings, metrics: dependencies } = node.attrs || {};
  const alternateLanguageSettings = node.attrs?.alternateLanguageSettings;
  if (!type) {
    throw new Error("ReportWidget node type not specified");
  }
  if (!componentSettings) {
    throw new Error("ReportWidget component settings not specified");
  }

  // Use stable hook that only triggers re-renders when this widget's data changes
  const { metrics, loading, errors, sources, geographies, sketchClass } =
    useWidgetDependencies(dependencies);

  // Memoize widgetProps to maintain stable reference
  const widgetProps = useMemo<ReportWidgetProps<any> | null>(
    () =>
      sketchClass
        ? {
            dependencies,
            componentSettings,
            metrics,
            sources,
            loading,
            errors,
            geographies,
            marks: node.marks as Mark[] | undefined,
            node,
            sketchClass,
            alternateLanguageSettings,
            lang,
          }
        : null,
    [
      dependencies,
      componentSettings,
      metrics,
      sources,
      loading,
      errors,
      geographies,
      node,
      sketchClass,
      alternateLanguageSettings,
      lang,
    ]
  );

  if (!sketchClass) {
    if (loading) {
      return node.isInline ? (
        <span className="inline-flex align-middle">
          <Spinner mini />
        </span>
      ) : (
        <div className="my-2 w-full rounded border border-gray-200 bg-white p-2">
          <Spinner mini />
        </div>
      );
    }

    const missingSketchClassErrors = ["Sketch class not available"];
    if (node.isInline) {
      return (
        <WidgetErrorInline
          errors={missingSketchClassErrors}
          cardId={cardId}
          dependencies={widgetProps?.dependencies || []}
        />
      );
    }
    return (
      <WidgetErrorBlock
        errors={missingSketchClassErrors}
        cardId={cardId}
        dependencies={widgetProps?.dependencies || []}
        widgetType={type}
      />
    );
  }

  // Error components access ReportContext themselves, so we only subscribe
  // to context when there are actual errors (exceptional case)
  if (errors.length > 0) {
    if (node.isInline) {
      return (
        <WidgetErrorInline
          errors={errors}
          cardId={cardId}
          dependencies={widgetProps?.dependencies || []}
        />
      );
    } else {
      return (
        <WidgetErrorBlock
          errors={errors}
          cardId={cardId}
          dependencies={widgetProps?.dependencies || []}
          widgetType={type}
        />
      );
    }
  }

  let widget: React.ReactNode;
  switch (node.attrs.type) {
    case "InlineMetric":
      widget = <memoizedWidgets.InlineMetric {...widgetProps} />;
      break;
    case "GeographySizeTable":
      widget = <memoizedWidgets.GeographySizeTable {...widgetProps} />;
      break;
    case "DistanceToShoreMap":
      widget = <memoizedWidgets.DistanceToShoreMap {...widgetProps} />;
      break;
    case "SketchAttributesTable":
      widget = <memoizedWidgets.SketchAttributesTable {...widgetProps} />;
      break;
    case "MpaGuideLevelOfProtection":
      widget = <memoizedWidgets.MpaGuideLevelOfProtection {...widgetProps} />;
      break;
    case "OverlappingAreasTable":
      widget = <memoizedWidgets.OverlappingAreasTable {...widgetProps} />;
      break;
    case "FeatureCountTable":
      widget = <memoizedWidgets.FeatureCountTable {...widgetProps} />;
      break;
    case "FeaturePresenceTable":
      widget = <memoizedWidgets.FeaturePresenceTable {...widgetProps} />;
      break;
    case "IntersectingFeaturesList":
      widget = <memoizedWidgets.IntersectingFeaturesList {...widgetProps} />;
      break;
    case "ColumnStatisticsTable":
      widget = <memoizedWidgets.ColumnStatisticsTable {...widgetProps} />;
      break;
    case "ColumnSumTable":
      widget = <memoizedWidgets.ColumnSumTable {...widgetProps} />;
      break;
    case "ColumnValuesHistogram":
      widget = <memoizedWidgets.ColumnValuesHistogram {...widgetProps} />;
      break;
    case "RasterValuesHistogram":
      widget = <memoizedWidgets.RasterValuesHistogram {...widgetProps} />;
      break;
    case "RasterStatisticsTable":
      widget = <memoizedWidgets.RasterStatisticsTable {...widgetProps} />;
      break;
    case "RasterProportionTable":
      widget = <memoizedWidgets.RasterProportionTable {...widgetProps} />;
      break;
    case "RasterAreaCapturedTable":
      widget = <memoizedWidgets.RasterAreaCapturedTable {...widgetProps} />;
      break;
    case "ClassCompositionChart":
      widget = <memoizedWidgets.ClassCompositionChart {...widgetProps} />;
      break;
    case "RasterTimeSeries":
      widget = <memoizedWidgets.RasterTimeSeries {...widgetProps} />;
      break;
    case "VectorTimeSeries":
      widget = <memoizedWidgets.VectorTimeSeries {...widgetProps} />;
      break;
    case "OusDemographicsTable":
      widget = <memoizedWidgets.OusDemographicsTable {...widgetProps} />;
      break;
    case "InlineLayerToggle":
      widget = <memoizedWidgets.InlineLayerToggle {...widgetProps} />;
      break;
    case "BlockLayerToggle":
      widget = <memoizedWidgets.BlockLayerToggle {...widgetProps} />;
      break;
    default:
      // eslint-disable-next-line i18next/no-literal-string
      return (
        <span className="bg-red-800 text-white px-1 py-0.5">
          <Trans ns="admin:reports">
            Unknown node type: {props.node.attrs.type}
          </Trans>
        </span>
      );
  }

  return (
    <ErrorBoundary
      fallback={({ error }) => {
        const message =
          error instanceof Error ? error.message : "Widget failed to render";
        return node.isInline ? (
          <WidgetErrorInline
            errors={[message]}
            cardId={cardId}
            dependencies={widgetProps?.dependencies || []}
          />
        ) : (
          <WidgetErrorBlock
            errors={[message]}
            cardId={cardId}
            dependencies={widgetProps?.dependencies || []}
            widgetType={type}
          />
        );
      }}
    >
      {widget}
    </ErrorBoundary>
  );
}

export type BuildReportCommandGroupsArgs = {
  sources?: OverlaySourceListDetailsFragment[];
  draftTableOfContentsItems?: Array<{
    id: number;
    title: string;
    stableId: string;
    parentStableId?: string | null;
    isFolder?: boolean | null;
    copiedFromDataLibraryTemplateId?: string | null;
    dataLayer?: {
      dataSource?: {
        id: number;
        type: DataSourceTypes;
        isSingleBandRaster?: boolean | null;
        vectorGeometryType?: string | null;
        temporal?: unknown;
      } | null;
    } | null;
  }>;
  geographies?: Pick<Geography, "id" | "name" | "stableIds">[];
  clippingGeography?: number;
  sketchClassGeometryType?: SketchGeometryType;
  overlayFooterItem?: CommandPaletteItem;
  overlayAugmenter?: (input: {
    source: OverlaySourceListDetailsFragment;
    item: CommandPaletteItem;
  }) => CommandPaletteItem;
  onProcessLayer?: (tocId: number, sourceId: number) => Promise<boolean>;
  /**
   * Time Series insert: preprocess unprocessed yearly siblings, then
   * call `insert`. Used to block the editor with a progress modal.
   */
  onPrepareTimeSeriesLayers?: (args: {
    unprocessed: Array<{ title: string; sourceId: number }>;
    insert: () => void;
  }) => void;
  projectSlug?: string;
  childSketchClassGeometryTypes?: SketchGeometryType[];
  /**
   * Enables the "Superuser Widgets" command group. These widgets encode
   * dataset-specific methodology (e.g. Ocean Use Survey demographics) and
   * only appear for sources with the required columns.
   */
  isSuperuser?: boolean;
};

export function ProcessForReportingFooter({
  onProcess,
  description,
}: {
  onProcess: () => Promise<boolean>;
  description?: string;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDescription =
    "To see more options for content related to overlay analysis, prepare it for reporting.";

  return (
    <div className="border-t border-gray-100 p-2">
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <p className="text-xs text-gray-500 mb-2 px-1">
        {description ?? defaultDescription}
      </p>
      {error && <p className="text-xs text-red-600 mb-2 px-1">{error}</p>}
      <button
        className="w-full px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait transition-colors flex items-center justify-center gap-2"
        disabled={isProcessing}
        onClick={async (e) => {
          e.preventDefault();
          setIsProcessing(true);
          setError(null);
          try {
            await onProcess();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Unable to start processing"
            );
          } finally {
            setIsProcessing(false);
          }
        }}
      >
        {isProcessing && <Spinner mini color="white" />}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {isProcessing ? "Processing\u2026" : "Process for Reporting"}
      </button>
    </div>
  );
}

/**
 * Fetches author/version/attribution info for all project reporting layers in
 * a single query (via ProjectReportingLayers) and returns the entry matching
 * the given tableOfContentsItemId.
 */
function useOverlayAuthorInfo(tableOfContentsItemId: number) {
  const { data, loading } = useProjectReportingLayersQuery({
    variables: { slug: getSlug() },
    fetchPolicy: "cache-only",
  });

  return useMemo(() => {
    if (loading || !data) return { loading, data: null };
    const item = data.projectBySlug?.draftTableOfContentsItems?.find(
      (i) => i.id === tableOfContentsItemId
    );
    if (!item) return { loading: false, data: null };

    const parentFolderTitle = item.containedBy?.[0]?.title ?? null;

    const dataLayer = item.dataLayer;
    const ds = dataLayer?.dataSource;
    if (!ds) {
      if (!parentFolderTitle) return { loading: false, data: null };
      return {
        loading: false,
        data: {
          parentFolderTitle,
          showAuthorRow: false,
          profile: null,
          createdAt: null,
          version: null,
          attribution: null,
        },
      };
    }
    return {
      loading: false,
      data: {
        parentFolderTitle: parentFolderTitle ?? null,
        showAuthorRow: true,
        profile: ds.authorProfile,
        createdAt: ds.createdAt ? new Date(ds.createdAt) : null,
        version: dataLayer?.version,
        attribution: ds.attribution,
      },
    };
  }, [loading, data, tableOfContentsItemId]);
}

/**
 * Fetches and displays version, author, and creation date for an overlay layer.
 */
export function OverlayLayerInfo({
  tableOfContentsItemId,
}: {
  tableOfContentsItemId: number;
}) {
  const { data, loading } = useOverlayAuthorInfo(tableOfContentsItemId);

  if (loading || !data) return null;

  const {
    parentFolderTitle,
    showAuthorRow,
    profile,
    createdAt,
    version,
    attribution,
  } = data;

  return (
    // eslint-disable-next-line i18next/no-literal-string
    <div className="mt-2 space-y-2.5">
      {parentFolderTitle ? (
        <div
          className="flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-2 max-w-full"
          title={parentFolderTitle}
        >
          <FolderIcon
            className="h-4 w-4 flex-shrink-0 text-slate-400"
            aria-hidden
          />
          <span className="min-w-0 truncate text-[11px] font-semibold leading-snug text-slate-600">
            {parentFolderTitle}
          </span>
        </div>
      ) : null}
      {attribution && (
        <div className="text-xs text-gray-500 italic max-w-full truncate">
          {attribution}
        </div>
      )}
      {showAuthorRow ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-5 h-5 flex-shrink-0">
            <ProfilePhoto
              fullname={profile?.fullname || undefined}
              email={profile?.email || undefined}
              canonicalEmail={profile?.email || ""}
              picture={profile?.picture || undefined}
            />
          </div>
          <span className="truncate">
            {profile?.fullname || profile?.email || "Unknown"}
            {createdAt ? `, ${createdAt.toLocaleDateString()}` : ""}
          </span>
          {version != null && version > 1 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-400 px-1 py-0 rounded-md">
              {
                // eslint-disable-next-line i18next/no-literal-string
                `v${version}`
              }
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reads the processing-job status for a layer from the cached
 * ProjectReportingLayers data. Only activates per-item polling when a job is
 * actually in an active state (Queued / Processing).
 */
function useOverlayProcessingStatus(tableOfContentsItemId: number) {
  const { data: bulkData } = useProjectReportingLayersQuery({
    variables: { slug: getSlug() },
    fetchPolicy: "cache-only",
  });

  const cachedJob = useMemo(() => {
    const item = bulkData?.projectBySlug?.reportingLayers?.find(
      (r) => r.tableOfContentsItemId === tableOfContentsItemId
    );
    return item?.sourceProcessingJob ?? null;
  }, [bulkData, tableOfContentsItemId]);

  const cachedState = cachedJob?.state as SpatialMetricState | undefined;
  const needsPolling =
    cachedState === SpatialMetricState.Processing ||
    cachedState === SpatialMetricState.Queued;

  const { data: polledData, stopPolling } =
    useOverlaySourceProcessingStatusQuery({
      variables: { tableOfContentsItemId },
      pollInterval: 1000,
      fetchPolicy: "network-only",
      skip: !needsPolling,
    });

  const polledJob =
    polledData?.tableOfContentsItem?.dataLayer?.dataSource
      ?.sourceProcessingJob ?? null;

  const job = polledJob ?? cachedJob;
  const state = job?.state as SpatialMetricState | undefined;

  useEffect(() => {
    if (
      needsPolling &&
      (state === SpatialMetricState.Complete ||
        state === SpatialMetricState.Error)
    ) {
      stopPolling();
    }
  }, [state, stopPolling, needsPolling]);

  return { job, state };
}

/**
 * Displays processing status for an overlay layer.
 * Renders nothing when complete or no job exists.
 */
export function OverlayProcessingStatus({
  tableOfContentsItemId,
}: {
  tableOfContentsItemId: number;
}) {
  const { job, state } = useOverlayProcessingStatus(tableOfContentsItemId);

  if (!job || state === SpatialMetricState.Complete) return null;

  const isActive =
    state === SpatialMetricState.Processing ||
    state === SpatialMetricState.Queued;

  return (
    // eslint-disable-next-line i18next/no-literal-string
    <div className="flex items-center gap-1.5 mt-1">
      {isActive && <Spinner mini />}
      <span className="text-xs text-gray-600">
        {state === SpatialMetricState.Processing &&
        job.progressPercentage != null
          ? // eslint-disable-next-line i18next/no-literal-string
            `Processing ${job.progressPercentage}%`
          : state === SpatialMetricState.Queued
          ? "Queued"
          : state === SpatialMetricState.Error
          ? // eslint-disable-next-line i18next/no-literal-string
            `Error: ${job.errorMessage || "Processing failed"}`
          : job.progressMessage || "Processing\u2026"}
      </span>
    </div>
  );
}

/**
 * Build context-dependent command groups for the report body editor.
 * @param sources - The available overlay sources
 * @param geographies - The available geographies
 * @param clippingGeography - The clipping geography
 * @param sketchClassGeometryType - The geometry type of the sketch class
 * @returns The command groups
 */
export function buildReportCommandGroups({
  sources,
  draftTableOfContentsItems,
  geographies,
  clippingGeography,
  sketchClassGeometryType,
  childSketchClassGeometryTypes,
  overlayFooterItem,
  overlayAugmenter,
  onProcessLayer,
  onPrepareTimeSeriesLayers,
  projectSlug,
  isSuperuser,
}: BuildReportCommandGroupsArgs = {}): CommandPaletteGroup[] {
  const commandGroups: CommandPaletteGroup[] = [];

  const showPolygonOptions =
    sketchClassGeometryType === SketchGeometryType.Polygon ||
    (sketchClassGeometryType === SketchGeometryType.Collection &&
      childSketchClassGeometryTypes &&
      childSketchClassGeometryTypes.includes(SketchGeometryType.Polygon));

  const inlineSketchMetricsGroup: CommandPaletteGroup = {
    id: "inline-sketch-metrics",
    label:
      sketchClassGeometryType === SketchGeometryType.Collection
        ? "Inline Collection Metrics"
        : "Inline Sketch Metrics",
    items: [],
  };
  if (showPolygonOptions) {
    inlineSketchMetricsGroup.items.push({
      id: "sketch-size",
      label: "Area",
      description: "Inline metric displays total area in chosen units.",
      screenshotSrc: "/slashCommands/inline-area.png",
      run: (state, dispatch, view) => {
        return insertInlineMetric(view, state.selection.ranges[0], {
          type: "InlineMetric",
          metrics: [
            {
              type: "total_area",
              subjectType: "fragments",
            },
          ],
          componentSettings: {
            presentation: "total_area",
          },
        });
      },
    });
    if (clippingGeography) {
      const geography = geographies?.find((g) => g.id === clippingGeography);
      const label = geography?.name || "Geography";
      inlineSketchMetricsGroup.items.push({
        id: "clipping-geography-percent",
        label: geography
          ? // eslint-disable-next-line i18next/no-literal-string
            `Percent of ${geography.name}`
          : "Percent of Geography",
        // eslint-disable-next-line i18next/no-literal-string
        description: `Fraction of the ${label} covered by the sketch.`,
        screenshotSrc: "/slashCommands/percent-geography.png",
        run: (state, dispatch, view) => {
          return insertInlineMetric(view, state.selection.ranges[0], {
            type: "InlineMetric",
            componentSettings: {
              presentation: "percent_area",
            },
            metrics: [
              {
                type: "total_area",
                subjectType: "fragments",
              },
              {
                type: "total_area",
                subjectType: "geographies",
              },
            ],
          });
        },
      });
    }
    inlineSketchMetricsGroup.items.push({
      id: "inline-distance-to-shore",
      label: "Distance to Shore",
      screenshotSrc: "/slashCommands/distance-to-shore.png",
      description: "Closest distance between the sketch and the shoreline.",
      run: (state, dispatch, view) => {
        return insertInlineMetric(view, state.selection.ranges[0], {
          type: "InlineMetric",
          metrics: [
            {
              type: "distance_to_shore",
              subjectType: "fragments",
            },
          ],
          componentSettings: {
            presentation: "distance_to_shore",
          },
        });
      },
    });
  }
  commandGroups.push(inlineSketchMetricsGroup);

  const sketchBlockWidgetsGroup: CommandPaletteGroup = {
    id: "sketch-block-widgets",
    label: "Sketch Block Widgets",
    items: [],
  };
  if (showPolygonOptions) {
    sketchBlockWidgetsGroup.items.push({
      id: "distance-to-shore-map",
      label: "Distance to Shore Map",
      description: "Map of the shortest path between the sketch and the shoreline.",
      screenshotSrc: "/slashCommands/distance-to-shore.png",
      run: (state, dispatch, view) => {
        return insertBlockMetric(view, state.selection.ranges[0], {
          type: "DistanceToShoreMap",
          metrics: [
            {
              type: "distance_to_shore",
              subjectType: "fragments",
            },
          ],
          componentSettings: {
            unit: "kilometer",
            unitDisplay: "short",
          },
        });
      },
    });
    sketchBlockWidgetsGroup.items.push({
      id: "sketch-attributes-table",
      label: "Sketch Attributes Table",
      description:
        "Displays user contributed information from the attributes form.",
      screenshotSrc: "/slashCommands/attributes-table.png",
      run: (state, dispatch, view) => {
        return insertBlockMetric(view, state.selection.ranges[0], {
          type: "SketchAttributesTable",
          metrics: [],
          componentSettings: {},
        });
      },
    });
    if (["bbnj", "cburt"].includes(projectSlug || "")) {
      sketchBlockWidgetsGroup.items.push({
        id: "mpa-guide-level-of-protection",
        label: "MPA Guide Level of Protection",
        description:
          "Shows the MPA Guide level of protection from sketch allowed-use attributes (BBNJ project only).",
        run: (state, dispatch, view) => {
          return insertBlockMetric(view, state.selection.ranges[0], {
            type: "MpaGuideLevelOfProtection",
            metrics: [],
            componentSettings: {},
          });
        },
      });
    }
    if (geographies && geographies.length > 1) {
      sketchBlockWidgetsGroup.items.push({
        id: "geography-size-table",
        label: "Geography Size Table",
        description:
          "Table displaying the size of the sketch in relation to each geography.",
        screenshotSrc: "/slashCommands/size-table.png",
        run: (state, dispatch, view) => {
          return insertBlockMetric(view, state.selection.ranges[0], {
            metrics: [
              {
                type: "total_area",
                subjectType: "geographies",
              },
              {
                type: "total_area",
                subjectType: "fragments",
              },
            ],
            componentSettings: {
              presentation: "total_area",
            },
            type: "GeographySizeTable",
          });
        },
      });
    }
  }
  commandGroups.push(sketchBlockWidgetsGroup);

  if (sources) {
    const overlayItems: CommandPaletteItem[] = sources
      .filter((source) => source.tableOfContentsItemId)
      .map((source) => {
        const title =
          source.tableOfContentsItem?.title || "Layer Overlay Analysis";
        const tocId = source.tableOfContentsItemId!;
        const stableId = source.tableOfContentsItem?.stableId;
        let childGroups: CommandPaletteGroup[] | undefined;
        let unsupportedMessage: string | undefined;
        if (source.rasterBandCount === 1) {
          const inlineGroup: CommandPaletteGroup = {
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-group`,
            label: "Inline Metrics",
            items: [],
          };
          inlineGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-band-stats`,
            label: "Raster Statistics",
            description:
              "Insert a raster statistic such as mean, min, max, or count for the sketch.",
            screenshotSrc: "/slashCommands/inline-raster-metric.png",
            run: (state, dispatch, view) => {
              return insertInlineMetric(view, state.selection.ranges[0], {
                type: "InlineMetric",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "fragments",
                    stableId,
                  },
                ],
                componentSettings: {
                  presentation: "raster_stats",
                  rasterStat: "mean",
                },
              });
            },
          });
          inlineGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-geography-band-stats`,
            label: "Geography Raster Statistics",
            description:
              "Insert a raster statistic (mean, min, max, or count) computed for an entire geography rather than just the sketch.",
            screenshotSrc: "/slashCommands/inline-raster-metric.png",
            run: (state, dispatch, view) => {
              return insertInlineMetric(view, state.selection.ranges[0], {
                type: "InlineMetric",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "geographies",
                    stableId,
                  },
                ],
                componentSettings: {
                  presentation: "geography_raster_stats",
                  rasterStat: "mean",
                },
              });
            },
          });
          inlineGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-raster-area-captured`,
            label: "Raster Area Captured",
            description:
              "Absolute area of the raster captured by the sketch, in chosen units (e.g. km²).",
            screenshotSrc: "/slashCommands/overlapping-area.png",
            run: (state, dispatch, view) => {
              return insertInlineMetric(view, state.selection.ranges[0], {
                type: "InlineMetric",
                metrics: [
                  {
                    type: "raster_overlay_area",
                    subjectType: "fragments",
                    stableId,
                  },
                ],
                componentSettings: {
                  presentation: "raster_overlay_area",
                },
              });
            },
          });
          inlineGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-geography-proportion-captured`,
            label: "Geography Proportion Captured",
            description:
              "Percentage of the total raster sum within a geography that falls inside the sketch.",
            screenshotSrc: "/slashCommands/percent-geography.png",
            run: (state, dispatch, view) => {
              return insertInlineMetric(view, state.selection.ranges[0], {
                type: "InlineMetric",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "fragments",
                    stableId,
                  },
                  {
                    type: "raster_stats",
                    subjectType: "geographies",
                    stableId,
                  },
                ],
                componentSettings: {
                  presentation: "geography_proportion_captured",
                },
              });
            },
          });
          const blockGroup: CommandPaletteGroup = {
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-block-group`,
            label: "Block Widgets",
            items: [],
          };
          blockGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-stats-table`,
            label: "Raster Statistics Table",
            description:
              "Table of raster band statistics such as mean, min, max, sum, and invalid pixels.",
            screenshotSrc: "/slashCommands/raster-stats-table.png",
            run: (state, dispatch, view) => {
              return insertBlockMetric(view, state.selection.ranges[0], {
                type: "RasterStatisticsTable",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "fragments",
                    stableId,
                  },
                ],
                componentSettings: {
                  displayStats: {
                    mean: true,
                    min: true,
                    max: true,
                    count: true,
                  },
                },
              });
            },
          });
          blockGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-histogram`,
            label: "Values Histogram",
            description:
              "Histogram of raster values for the sketch, using the layer's bin definitions.",
            screenshotSrc: "/slashCommands/raster-histogram.png",
            run: (state, dispatch, view) => {
              return insertBlockMetric(view, state.selection.ranges[0], {
                type: "RasterValuesHistogram",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "fragments",
                    stableId,
                  },
                ],
                componentSettings: {
                  colorCoded: true,
                  displayStats: {
                    mean: true,
                    min: true,
                    max: true,
                  },
                },
              });
            },
          });
          blockGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-proportion-table`,
            label: "Raster Proportion Captured Table",
            description:
              "Table showing what proportion of each raster layer's total value within a geography is captured by the sketch.",
            screenshotSrc: "/slashCommands/raster-proportion.png",
            run: (state, dispatch, view) => {
              return insertBlockMetric(view, state.selection.ranges[0], {
                type: "RasterProportionTable",
                metrics: [
                  {
                    type: "raster_stats",
                    subjectType: "fragments",
                    stableId,
                  },
                  {
                    type: "raster_stats",
                    subjectType: "geographies",
                    stableId,
                  },
                ],
                componentSettings: {},
              });
            },
          });
          // Like OverlappingAreasTable: one command; class breakdown defaults
          // from styleGroupByColumn ("value" for categorical rasters).
          const rasterAreaGroupBy =
            source.styleGroupByColumn === "value" ? "value" : undefined;
          blockGroup.items.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-area-captured-table`,
            label: "Raster Area Captured Table",
            description:
              "Table of raster area (km²) captured by the sketch. Optionally show percent of a geography. Supports grouping by class.",
            screenshotSrc: "/slashCommands/raster-proportion.png",
            run: (state, dispatch, view) => {
              return insertBlockMetric(view, state.selection.ranges[0], {
                type: "RasterAreaCapturedTable",
                metrics: [
                  {
                    type: "raster_overlay_area",
                    subjectType: "fragments",
                    stableId,
                    ...(rasterAreaGroupBy
                      ? { parameters: { groupBy: rasterAreaGroupBy } }
                      : {}),
                  },
                  {
                    type: "raster_overlay_area",
                    subjectType: "geographies",
                    stableId,
                    parameters: {
                      vrm: false,
                      ...(rasterAreaGroupBy
                        ? { groupBy: rasterAreaGroupBy }
                        : {}),
                    },
                  },
                ],
                // Hide "% Captured" until an admin picks a geography (same
                // pattern as OverlappingAreasTable percentGeographyId: null).
                componentSettings: { geographyId: null },
              });
            },
          });
          if (rasterAreaGroupBy === "value") {
            blockGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-class-composition-chart`,
              label: "Composition Chart",
              description:
                "Pie or waffle chart showing the share of the sketch covered by each class in a categorical raster.",
              screenshotSrc: "/slashCommands/class-composition-chart.png",
              run: (state, dispatch, view) => {
                return insertBlockMetric(view, state.selection.ranges[0], {
                  type: "ClassCompositionChart",
                  metrics: [
                    {
                      type: "raster_overlay_area",
                      subjectType: "fragments",
                      stableId,
                      parameters: { groupBy: "value" },
                    },
                  ],
                  componentSettings: {},
                });
              },
            });
          }
          if (stableId && coverageForSource(source)) {
            const timeSeriesMode =
              source.styleGroupByColumn === "value" ? "area" : "stats";
            blockGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-raster-time-series`,
              label: "Time Series",
              description: "Chart raster statistics, area, or sums over time.",
              screenshotSrc: "/slashCommands/raster-time-series.png",
              run: (state, dispatch, view) => {
                const siblings = findTimeSeriesSiblings({
                  subject: source,
                  sources: sources || [],
                  tocItems: draftTableOfContentsItems || [],
                });
                const siblingIds = siblings.map((s) => s.stableId);
                const range = state.selection.ranges[0];
                const insert = () =>
                  insertBlockMetric(view, range, {
                    type: "RasterTimeSeries",
                    metrics: buildRasterTimeSeriesDependencies(
                      [stableId, ...siblingIds],
                      timeSeriesMode
                    ),
                    componentSettings: { mode: timeSeriesMode },
                  });
                const unprocessed = siblings.flatMap((s) =>
                  !s.processed && typeof s.sourceId === "number"
                    ? [{ title: s.title, sourceId: s.sourceId }]
                    : []
                );
                if (unprocessed.length > 0 && onPrepareTimeSeriesLayers) {
                  onPrepareTimeSeriesLayers({
                    unprocessed,
                    insert,
                  });
                  return;
                }
                return insert();
              },
            });
          }
          childGroups = [inlineGroup, blockGroup];
        } else if (source.rasterBandCount && source.rasterBandCount > 1) {
          unsupportedMessage =
            "Only single-band rasters are supported in the reporting tools.";
        } else if (source.vectorGeometryType) {
          const groupByColumn =
            source.styleGroupByColumn || source.bestCategoryColumn || undefined;
          const bestLabelColumn = source.bestLabelColumn;
          const bestNumericColumn = source.bestContinuousColumn;
          const inlineGroup: CommandPaletteGroup = {
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-group`,
            label: "Inline Metrics",
            items: [],
          };
          const blockGroup: CommandPaletteGroup = {
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-block-group`,
            label: "Block Widgets",
            items: [],
          };
          if (
            [
              "Polygon",
              "MultiPolygon",
              "Point",
              "MultiPoint",
              "LineString",
              "MultiLineString",
            ].includes(source.vectorGeometryType)
          ) {
            inlineGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count`,
              label: "Feature Count",
              description:
                "Count the number of overlapping features, or features within a buffer distance.",
              screenshotSrc: "/slashCommands/feature-count.png",
              run: (state, dispatch, view) => {
                return insertInlineMetric(view, state.selection.ranges[0], {
                  type: "InlineMetric",
                  componentSettings: {
                    presentation: "count",
                  },
                  metrics: [
                    {
                      type: "count",
                      subjectType: "fragments",
                      stableId,
                      parameters: {},
                    },
                  ],
                });
              },
            });
            inlineGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count-percent-of-geography`,
              label: "Count as % of Geography",
              description:
                "Percentage of the geography's features that overlap the sketch, or are within a buffer distance of it.",
              screenshotSrc: "/slashCommands/feature-count.png",
              run: (state, dispatch, view) => {
                return insertInlineMetric(view, state.selection.ranges[0], {
                  type: "InlineMetric",
                  componentSettings: {
                    presentation: "percent_count",
                  },
                  metrics: [
                    {
                      type: "count",
                      subjectType: "fragments",
                      stableId,
                      parameters: {},
                    },
                    {
                      type: "count",
                      subjectType: "geographies",
                      stableId,
                      parameters: {},
                    },
                  ],
                });
              },
            });
            inlineGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count-percent-of-total`,
              label: "Count as % of Total",
              description:
                "Percentage of the layer's full feature count that overlaps the sketch, or is within a buffer distance of it. Uses layer statistics as the denominator, not a geography total.",
              screenshotSrc: "/slashCommands/percent-count-total.png",
              run: (state, dispatch, view) => {
                return insertInlineMetric(view, state.selection.ranges[0], {
                  type: "InlineMetric",
                  componentSettings: {
                    presentation: "percent_count_total",
                    minimumFractionDigits: 0,
                  },
                  metrics: [
                    {
                      type: "count",
                      subjectType: "fragments",
                      stableId,
                      parameters: {},
                    },
                  ],
                });
              },
            });
            blockGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count-table`,
              label: "Feature Count Table",
              description:
                "Table of feature counts, optionally grouped by a class key and compared to geography totals.",
              screenshotSrc: "/slashCommands/feature-count-table.png",
              run: (state, dispatch, view) => {
                return insertBlockMetric(view, state.selection.ranges[0], {
                  type: "FeatureCountTable",
                  componentSettings: {},
                  metrics: [
                    {
                      type: "count",
                      subjectType: "fragments",
                      stableId,
                      parameters: {
                        groupBy: groupByColumn,
                      },
                    },
                    {
                      type: "count",
                      subjectType: "geographies",
                      stableId,
                      parameters: {
                        groupBy: groupByColumn,
                      },
                    },
                  ],
                });
              },
            });
            if (
              stableId &&
              coverageForSource(source) &&
              isLayerGranularityTemporal(source)
            ) {
              const timeSeriesMode = defaultVectorTimeSeriesMode(
                source.vectorGeometryType
              );
              blockGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-vector-time-series`,
                label: "Time Series",
                description:
                  "Chart feature counts, overlap, or column statistics over time.",
                screenshotSrc: "/slashCommands/raster-time-series.png",
                run: (state, dispatch, view) => {
                  const siblings = findTimeSeriesSiblings({
                    subject: source,
                    sources: sources || [],
                    tocItems: draftTableOfContentsItems || [],
                  });
                  const siblingIds = siblings.map((s) => s.stableId);
                  const ids = [stableId, ...siblingIds];
                  const overlappingByStableId: {
                    [id: string]: boolean | undefined;
                  } = {};
                  for (const id of ids) {
                    const match = (sources || []).find(
                      (s) => s.stableId === id
                    );
                    if (match?.containsOverlappingFeatures) {
                      overlappingByStableId[id] = true;
                    }
                  }
                  const range = state.selection.ranges[0];
                  const insert = () =>
                    insertBlockMetric(view, range, {
                      type: "VectorTimeSeries",
                      metrics: buildVectorTimeSeriesDependencies({
                        stableIds: ids,
                        mode: timeSeriesMode,
                        column: source.bestContinuousColumn || undefined,
                        overlappingByStableId,
                      }),
                      componentSettings: {
                        mode: timeSeriesMode,
                        ...(source.bestContinuousColumn
                          ? { column: source.bestContinuousColumn }
                          : {}),
                      },
                    });
                  const unprocessed = siblings.flatMap((s) =>
                    !s.processed && typeof s.sourceId === "number"
                      ? [{ title: s.title, sourceId: s.sourceId }]
                      : []
                  );
                  if (unprocessed.length > 0 && onPrepareTimeSeriesLayers) {
                    onPrepareTimeSeriesLayers({
                      unprocessed,
                      insert,
                    });
                    return;
                  }
                  return insert();
                },
              });
            }
            blockGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-presence-table`,
              label: "Feature Presence Table",
              description:
                "Table that shows presence/absence based on intersecting feature counts, optionally grouped by a class key.",
              screenshotSrc: "/slashCommands/feature-presence-table.png",
              run: (state, dispatch, view) => {
                return insertBlockMetric(view, state.selection.ranges[0], {
                  type: "FeaturePresenceTable",
                  componentSettings: {},
                  metrics: [
                    {
                      type: "count",
                      subjectType: "fragments",
                      stableId,
                      parameters: {
                        groupBy: groupByColumn,
                      },
                    },
                  ],
                });
              },
            });
            blockGroup.items.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-intersecting-features-list`,
              label: "Intersecting Features List",
              description:
                "List of features that intersect with the sketch, with access to column values.",
              screenshotSrc: "/slashCommands/intersecting-features-list.png",
              run: (state, dispatch, view) => {
                return insertBlockMetric(view, state.selection.ranges[0], {
                  type: "IntersectingFeaturesList",
                  componentSettings: {
                    labelColumn: bestLabelColumn,
                  },
                  metrics: [
                    {
                      type: "presence_table",
                      subjectType: "fragments",
                      stableId,
                      parameters: {
                        maxResults: 25,
                      },
                    },
                  ],
                });
              },
            });
            // column_values widgets require a column to scope the metric to
            // (includedColumns). If the layer has no usable column, skip
            // these commands entirely rather than provisioning a broken
            // dependency.
            const columnForStats = bestNumericColumn || source.anyColumn;
            if (columnForStats) {
              inlineGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-inline-column-stats`,
                label: "Column Statistic",
                description:
                  "Summarize numeric columns with a mean, min, max, or distinct value count.",
                screenshotSrc: "/slashCommands/column-stats-inline.png",
                run: (state, dispatch, view) => {
                  return insertInlineMetric(view, state.selection.ranges[0], {
                    type: "InlineMetric",
                    metrics: [
                      {
                        type: "column_values",
                        subjectType: "fragments",
                        stableId,
                        parameters: {
                          // Scope columns so per-feature records are retained
                          // and fragment stats combine exactly.
                          includedColumns: [columnForStats],
                        },
                      },
                    ],
                    componentSettings: {
                      presentation: "column_values",
                      stat: "mean",
                      column: columnForStats,
                    },
                  });
                },
              });

              blockGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-column-stats-table`,
                label: "Column Statistics Table",
                description:
                  "Show key statistics for a column such as min, max, mean, sum, and distinct value count.",
                screenshotSrc: "/slashCommands/column-stats-table.png",
                run: (state, dispatch, view) => {
                  return insertBlockMetric(view, state.selection.ranges[0], {
                    type: "ColumnStatisticsTable",
                    metrics: [
                      {
                        type: "column_values",
                        subjectType: "fragments",
                        stableId,
                        parameters: {
                          includedColumns: [columnForStats],
                        },
                      },
                    ],
                    componentSettings: {
                      columns: [columnForStats],
                      displayStats: bestNumericColumn
                        ? {
                            min: true,
                            max: true,
                            mean: true,
                          }
                        : {
                            countDistinct: true,
                          },
                    },
                  });
                },
              });

              // Class-total sums need a numeric column and a groupBy class key.
              if (bestNumericColumn && groupByColumn) {
                const sumColumn = pickBestColumnForPercentOfColumnTotal({
                  preferred: bestNumericColumn,
                });
                if (sumColumn) {
                  blockGroup.items.push({
                    // eslint-disable-next-line i18next/no-literal-string
                    id: `overlay-layer-${tocId}-column-sum-table`,
                    label: "Column Totals by Class",
                    description:
                      "Sum a numeric column for overlapping features, grouped by a class key. Optionally compare each class sum to a geography total (e.g. % of province population).",
                    screenshotSrc: "/slashCommands/column-sum-table.png",
                    run: (state, dispatch, view) => {
                      return insertBlockMetric(
                        view,
                        state.selection.ranges[0],
                        {
                          type: "ColumnSumTable",
                          metrics: [
                            {
                              type: "column_values",
                              subjectType: "fragments",
                              stableId,
                              parameters: {
                                includedColumns: [sumColumn],
                                groupBy: groupByColumn,
                              },
                            },
                          ],
                          componentSettings: {
                            column: sumColumn,
                            sumLabel: sumColumn,
                            showZeroCountCategories: true,
                          },
                        }
                      );
                    },
                  });
                }
              }
            }

            // "% of Column Total" needs a numeric column whose full-dataset
            // sum can be recovered from geostats (avg × count).
            // bestContinuousColumn is derived from those numeric attributes.
            if (bestNumericColumn) {
              const columnForPercentTotal =
                pickBestColumnForPercentOfColumnTotal({
                  preferred: bestNumericColumn,
                });
              if (columnForPercentTotal) {
                inlineGroup.items.push({
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `overlay-layer-${tocId}-percent-column-total-overlapped`,
                  label: "% of Column Total",
                  description:
                    "Share of a column's full-dataset total that overlaps the sketch (or a buffer around it). Uses layer statistics as the denominator, not a geography total — useful for population and similar whole-feature quantities.",
                  screenshotSrc:
                    "/slashCommands/percent-column-total-overlapped.png",
                  run: (state, dispatch, view) => {
                    return insertInlineMetric(view, state.selection.ranges[0], {
                      type: "InlineMetric",
                      metrics: [
                        {
                          type: "column_values",
                          subjectType: "fragments",
                          stableId,
                          parameters: {
                            includedColumns: [columnForPercentTotal],
                          },
                        },
                      ],
                      componentSettings: {
                        presentation: "percent_column_total_overlapped",
                        column: columnForPercentTotal,
                        minimumFractionDigits: 1,
                      },
                    });
                  },
                });
              }

              blockGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-column-value-histogram`,
                label: "Values Histogram",
                description: "Histogram of values for a numeric column.",
                screenshotSrc: "/slashCommands/values-histogram.png",
                run: (state, dispatch, view) => {
                  return insertBlockMetric(view, state.selection.ranges[0], {
                    type: "ColumnValuesHistogram",
                    metrics: [
                      {
                        type: "column_values",
                        subjectType: "fragments",
                        stableId,
                        parameters: {
                          includedColumns: [bestNumericColumn],
                        },
                      },
                    ],
                    componentSettings: {
                      column: bestNumericColumn,
                      displayStats: {
                        min: true,
                        max: true,
                        mean: true,
                      },
                      colorCoded: true,
                    },
                  });
                },
              });
            }
          }
          switch (source.vectorGeometryType) {
            case "Polygon":
            case "MultiPolygon": {
              inlineGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-overlap-area`,
                label: "Overlapping Area",
                description:
                  "Display the total area of the sketch that overlaps with the layer.",
                screenshotSrc: "/slashCommands/overlapping-area.png",
                run: (state, dispatch, view) => {
                  return insertInlineMetric(view, state.selection.ranges[0], {
                    type: "InlineMetric",
                    metrics: [
                      {
                        type: "overlay_area",
                        subjectType: "fragments",
                        stableId,
                        ...(source.containsOverlappingFeatures
                          ? {
                              parameters: {
                                sourceHasOverlappingFeatures: true,
                              },
                            }
                          : {}),
                      },
                    ],
                    componentSettings: {
                      presentation: "overlay_area",
                    },
                  });
                },
              });
              inlineGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-geography-proportion-captured`,
                label: "Geography Proportion Captured",
                description:
                  "Percentage of this layer's area within a geography that overlaps the sketch.",
                screenshotSrc: "/slashCommands/percent-geography.png",
                run: (state, dispatch, view) => {
                  const overlayParams = source.containsOverlappingFeatures
                    ? { sourceHasOverlappingFeatures: true }
                    : undefined;
                  return insertInlineMetric(view, state.selection.ranges[0], {
                    type: "InlineMetric",
                    metrics: [
                      {
                        type: "overlay_area",
                        subjectType: "fragments",
                        stableId,
                        ...(overlayParams
                          ? { parameters: { ...overlayParams } }
                          : {}),
                      },
                      {
                        type: "overlay_area",
                        subjectType: "geographies",
                        stableId,
                        ...(overlayParams
                          ? { parameters: { ...overlayParams } }
                          : {}),
                      },
                    ],
                    componentSettings: {
                      presentation: "geography_proportion_captured",
                    },
                  });
                },
              });
              if (
                clippingGeography ||
                (geographies?.length && geographies.length > 1)
              ) {
                inlineGroup.items.push({
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `overlay-layer-${tocId}-geography-overlap-area`,
                  label: "Total Area in Geography",
                  description:
                    "Displays the sum area of polygons for this layer found within a specified geography.",
                  screenshotSrc: "/slashCommands/geography-sum-area.png",
                  run: (state, dispatch, view) => {
                    return insertInlineMetric(view, state.selection.ranges[0], {
                      type: "InlineMetric",
                      metrics: [
                        {
                          type: "overlay_area",
                          subjectType: "geographies",
                          stableId,
                          ...(source.containsOverlappingFeatures
                            ? {
                                parameters: {
                                  sourceHasOverlappingFeatures: true,
                                },
                              }
                            : {}),
                        },
                      ],
                      componentSettings: {
                        presentation: "geography_overlay_area",
                      },
                    });
                  },
                });
              }
              blockGroup.items.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-overlap-table`,
                label: "Overlapping Area Table",
                description:
                  "Table of overlapping area statistics. Works best when grouped by a class key. May include percent overlapped for a geography.",
                screenshotSrc: "/slashCommands/overlapping-area-table.png",
                run: (state, dispatch, view) => {
                  return insertBlockMetric(view, state.selection.ranges[0], {
                    type: "OverlappingAreasTable",
                    metrics: [
                      {
                        type: "overlay_area",
                        subjectType: "fragments",
                        stableId,
                        parameters: {
                          groupBy: groupByColumn,
                          ...(source.containsOverlappingFeatures
                            ? { sourceHasOverlappingFeatures: true }
                            : {}),
                        },
                      },
                      {
                        type: "overlay_area",
                        subjectType: "geographies",
                        stableId,
                        parameters: {
                          groupBy: groupByColumn,
                          ...(source.containsOverlappingFeatures
                            ? { sourceHasOverlappingFeatures: true }
                            : {}),
                        },
                      },
                    ],
                    componentSettings: {
                      // Hide "% Within" until an admin picks a geography.
                      // Legacy reports omit this and keep the old default (primary).
                      percentGeographyId: null,
                    },
                  });
                },
              });
              break;
            }
          }
          childGroups = [inlineGroup, blockGroup];
        }
        const layerToggleChildren: CommandPaletteItem[] = [
          {
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-block-toggle`,
            label: "Layer toggle",
            description: "Toggle this layer on the map from a report card",
            screenshotSrc: "/slashCommands/layer-toggle-block.png",
            run: (state, dispatch, view) =>
              insertBlockMetric(view, state.selection.ranges[0], {
                type: "BlockLayerToggle",
                metrics: [],
                componentSettings: { stableId, label: title },
              }),
          },
          // {
          //   // eslint-disable-next-line i18next/no-literal-string
          //   id: `overlay-layer-${tocId}-inline-toggle`,
          //   label: "Inline layer toggle",
          //   description: "Place layer toggles inline with any text.",
          //   screenshotSrc: "/slashCommands/layer-toggle-inline.png",
          //   run: (state, dispatch, view) =>
          //     insertInlineMetric(view, state.selection.ranges[0], {
          //       type: "InlineLayerToggle",
          //       metrics: [],
          //       componentSettings: { stableId, label: title },
          //     }),
          // },
        ];

        let item: CommandPaletteItem = {
          // eslint-disable-next-line i18next/no-literal-string
          id: `overlay-layer-${tocId}`,
          label: title,
          run: () => false,
          children: layerToggleChildren,
          childGroups,
          activateOnHover: true,
          popoverHeader: <OverlayLayerInfo tableOfContentsItemId={tocId} />,
          popoverStatus: (
            <OverlayProcessingStatus tableOfContentsItemId={tocId} />
          ),
          ...(unsupportedMessage && {
            description: unsupportedMessage,
          }),
        };
        if (overlayAugmenter) {
          item = overlayAugmenter({ source, item });
        }
        return item;
      });

    // Add unprocessed layers from draftTableOfContentsItems
    if (draftTableOfContentsItems) {
      const processedTocIds = new Set(
        sources
          .filter((s) => s.tableOfContentsItemId)
          .map((s) => s.tableOfContentsItemId!)
      );
      const ELIGIBLE_TYPES = new Set([
        DataSourceTypes.SeasketchMvt,
        DataSourceTypes.SeasketchRaster,
        DataSourceTypes.SeasketchVector,
      ]);
      for (const tocItem of draftTableOfContentsItems) {
        if (tocItem.copiedFromDataLibraryTemplateId) {
          if (/MARINE_REGIONS/.test(tocItem.copiedFromDataLibraryTemplateId)) {
            continue;
          } else if (/DAYLIGHT/.test(tocItem.copiedFromDataLibraryTemplateId)) {
            continue;
          }
        }
        const dsType = tocItem.dataLayer?.dataSource?.type;
        const sourceId = tocItem.dataLayer?.dataSource?.id;
        if (
          dsType &&
          sourceId &&
          ELIGIBLE_TYPES.has(dsType) &&
          !processedTocIds.has(tocItem.id)
        ) {
          const capturedSourceId = sourceId;
          const toggleItems: CommandPaletteItem[] = [
            {
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocItem.id}-block-toggle`,
              label: "Layer toggle",
              description: "Toggle this layer on the map from a report card.",
              screenshotSrc: "/slashCommands/layer-toggle-block.png",
              run: (state, dispatch, view) =>
                insertBlockMetric(view, state.selection.ranges[0], {
                  type: "BlockLayerToggle",
                  metrics: [],
                  componentSettings: {
                    stableId: tocItem.stableId,
                    label: tocItem.title,
                  },
                }),
            },
            // {
            //   // eslint-disable-next-line i18next/no-literal-string
            //   id: `overlay-layer-${tocItem.id}-inline-toggle`,
            //   label: "Inline layer toggle",
            //   description: "Place layer toggles inline with any text.",
            //   screenshotSrc: "/slashCommands/layer-toggle-inline.png",
            //   run: (state, dispatch, view) =>
            //     insertInlineMetric(view, state.selection.ranges[0], {
            //       type: "InlineLayerToggle",
            //       metrics: [],
            //       componentSettings: {
            //         stableId: tocItem.stableId,
            //         label: tocItem.title,
            //       },
            //     }),
            // },
          ];
          overlayItems.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocItem.id}`,
            label: tocItem.title,
            muted: true,
            activateOnHover: true,
            run: () => false,
            children: toggleItems,
            popoverHeader: (
              <OverlayLayerInfo tableOfContentsItemId={tocItem.id} />
            ),
            popoverFooter: onProcessLayer ? (
              <ProcessForReportingFooter
                onProcess={() => onProcessLayer(tocItem.id, capturedSourceId)}
              />
            ) : undefined,
          });
        }
      }
    }

    if (overlayItems.length || overlayFooterItem) {
      const sortedItems = overlayItems.sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      if (overlayFooterItem) {
        sortedItems.push(overlayFooterItem);
      }
      commandGroups.push({
        id: "layer-overlay-analysis",
        label: "Overlay Layer Widgets",
        items: sortedItems,
      });
    }
  }

  // Superuser-only widgets encode dataset-specific methodology and require
  // strictly validated columns, so they appear at the end of the menu and
  // only for conforming sources.
  if (isSuperuser && sources && showPolygonOptions) {
    const superuserItems: CommandPaletteItem[] = sources
      .filter(
        (source) =>
          source.tableOfContentsItemId &&
          source.vectorGeometryType &&
          ["Polygon", "MultiPolygon"].includes(source.vectorGeometryType) &&
          source.hasOusDemographicsColumns
      )
      .map((source) => {
        const title = source.tableOfContentsItem?.title || "Ocean Use Survey";
        const tocId = source.tableOfContentsItemId!;
        const stableId = source.tableOfContentsItem?.stableId;
        return {
          // eslint-disable-next-line i18next/no-literal-string
          id: `superuser-ous-demographics-${tocId}`,
          // eslint-disable-next-line i18next/no-literal-string
          label: `OUS Demographics Table: ${title}`,
          description:
            "People represented by Ocean Use Survey responses overlapping the plan, grouped by sector, village, or another column. Requires response_id, participants, represented_in_sector, and sector columns.",
          popoverHeader: <OverlayLayerInfo tableOfContentsItemId={tocId} />,
          popoverStatus: (
            <OverlayProcessingStatus tableOfContentsItemId={tocId} />
          ),
          run: (state, dispatch, view) => {
            return insertBlockMetric(view, state.selection.ranges[0], {
              type: "OusDemographicsTable",
              componentSettings: {},
              metrics: [
                {
                  type: "ous_demographics",
                  subjectType: "fragments",
                  stableId,
                  parameters: {
                    groupBy: OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY,
                  },
                },
              ],
            });
          },
        } as CommandPaletteItem;
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    if (superuserItems.length) {
      commandGroups.push({
        id: "superuser-widgets",
        label: "Superuser Widgets",
        items: superuserItems,
      });
    }
  }
  return commandGroups;
}

/**
 * Insert a metric node at the specified range.
 * @param properties - The metric properties (type, geography)
 */
function _insertMetric(
  view: EditorView,
  range: SelectionRange,
  properties: MetricProperties,
  inline: boolean = true
): boolean {
  const { state, dispatch } = view;
  const { schema } = state;
  const metricType = inline ? schema.nodes.metric : schema.nodes.blockMetric;

  if (!metricType) {
    return false;
  }

  const node = metricType.create({
    ...properties,
  });

  let tr = state.tr.replaceRangeWith(range.$from.pos, range.$to.pos, node);

  // Select the newly inserted node so the user sees what they just placed.
  // Use left bias (-1) so the mapped position lands at the start of the new
  // content rather than after it.
  const insertPos = tr.mapping.map(range.$from.pos, -1);
  try {
    tr = tr.setSelection(NodeSelection.create(tr.doc, insertPos));
  } catch {
    const $pos = tr.doc.resolve(
      Math.min(insertPos + node.nodeSize, tr.doc.content.size)
    );
    tr = tr.setSelection(TextSelection.near($pos, -1));
  }

  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Insert an inline metric node at the specified range.
 * @param view - The EditorView to insert the metric into
 * @param range - The SelectionRange to insert the metric into
 * @param properties - The properties of the metric to insert
 * @returns True if the metric was inserted successfully, false otherwise
 */
export function insertInlineMetric(
  view: EditorView,
  range: SelectionRange,
  properties: MetricProperties
): boolean {
  return _insertMetric(view, range, properties, true);
}

/**
 * Insert a block metric node at the specified range.
 * @param view - The EditorView to insert the metric into
 * @param range - The SelectionRange to insert the metric into
 * @param properties - The properties of the metric to insert
 * @returns True if the metric was inserted successfully, false otherwise
 */
export function insertBlockMetric(
  view: EditorView,
  range: SelectionRange,
  properties: MetricProperties
): boolean {
  return _insertMetric(view, range, properties, false);
}

export interface MetricProperties {
  metrics: MetricDependency[];
  componentSettings: Record<string, any>;
  type: string;
}

export interface ReportWidgetProps<T extends Record<string, any>> {
  dependencies: MetricDependency[];
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: string[];
  geographies: Pick<Geography, "id" | "name" | "stableIds">[];
  componentSettings: T;
  marks?: Mark[];
  node?: Node;
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    | "id"
    | "projectId"
    | "geometryType"
    | "form"
    | "clippingGeographies"
    | "project"
    | "validChildren"
  >;
  alternateLanguageSettings?: { [langCode: string]: any };
  lang: string;
}

export type ReportWidget<T extends Record<string, any>> = FC<
  ReportWidgetProps<T>
>;

/**
 * Reusable inline boolean option for widget tooltips.
 */
export function TooltipBooleanConfigurationOption({
  label,
  checked,
  onChange,
  checkboxFirst = false,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** When true, checkbox is shown before the label (better for stacked column toggles). */
  checkboxFirst?: boolean;
}) {
  const input = (
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-gray-300 text-gray-600 focus:ring-slate-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
  const labelEl = (
    <span
      className={
        checkboxFirst
          ? "text-gray-800"
          : "font-light text-gray-400 whitespace-nowrap"
      }
    >
      {label}
    </span>
  );
  return (
    <label
      className={`flex items-center gap-2 text-sm text-gray-800 ${
        checkboxFirst ? "" : "w-full justify-between"
      }`}
    >
      {checkboxFirst ? (
        <>
          {input}
          {labelEl}
        </>
      ) : (
        <>
          {labelEl}
          {input}
        </>
      )}
    </label>
  );
}

/**
 * Reusable component for editing table headings/labels.
 * Handles state management, debouncing, and explicit save on popover close.
 */
export function TableHeadingsEditor({
  labelKeys,
  labelDisplayNames,
  componentSettings,
  onUpdate,
}: {
  /**
   * Array of keys in componentSettings that store the label values
   */
  labelKeys: string[];
  /**
   * Array of display names for the labels (used as placeholders and field labels)
   */
  labelDisplayNames: string[];
  /**
   * Current componentSettings object
   */
  componentSettings: Record<string, any>;
  /**
   * Callback to update componentSettings
   */
  onUpdate: (update: { componentSettings: Record<string, any> }) => void;
}) {
  const { t } = useTranslation("admin:reports");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Stable signature so we don't treat new componentSettings object refs as changes
  // when values are unchanged (avoids update loops when labelKeys change).
  const headingsSettingsSignature =
    labelKeys.join("\0") +
    "\n" +
    labelKeys.map((k) => `${k}=${componentSettings[k] ?? ""}`).join("\n");

  const initialLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    labelKeys.forEach((key) => {
      labels[key] = componentSettings[key] || "";
    });
    return labels;
  }, [headingsSettingsSignature]);

  const [localState, setLocalState] = useState(initialLabels);
  const debouncedLocalState = useDebounce(localState, 100);

  // Sync local state when componentSettings change externally,
  // but only when the popover is closed to avoid overwriting
  // in-progress edits (the debounce round-trip would reset local state)
  useEffect(() => {
    if (!isPopoverOpen) {
      setLocalState(initialLabels);
    }
  }, [initialLabels, isPopoverOpen]);

  // Debounced update of componentSettings. Only persist while the popover
  // is open — changing labelKeys (e.g. hiding a column) must not write
  // back, or a new-key `undefined !== ""` comparison loops with onUpdate.
  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }
    const hasChanges = labelKeys.some(
      (key) => (debouncedLocalState[key] || "") !== (initialLabels[key] || "")
    );
    if (hasChanges) {
      const updatedSettings: Record<string, any> = {};
      labelKeys.forEach((key) => {
        updatedSettings[key] = debouncedLocalState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  }, [debouncedLocalState, initialLabels, isPopoverOpen, labelKeys, onUpdate]);

  // Explicit save when popover closes
  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (!open) {
      // Popover is closing - ensure all current values are saved
      const updatedSettings: Record<string, any> = { ...componentSettings };
      labelKeys.forEach((key) => {
        updatedSettings[key] = localState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  };

  return (
    <Popover.Root open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none"
        >
          <Pencil2Icon className="w-3 h-3" />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {"headings"}
        </button>
      </Popover.Trigger>
      <TooltipPopoverContent title={t("Headings")}>
        <div className="space-y-3 px-1">
          {labelKeys.map((key, index) => (
            <div key={key}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {labelDisplayNames[index]}
              </label>
              <input
                type="text"
                value={localState[key] ?? ""}
                onChange={(e) =>
                  setLocalState((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                placeholder={t(labelDisplayNames[index])}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </TooltipPopoverContent>
    </Popover.Root>
  );
}
