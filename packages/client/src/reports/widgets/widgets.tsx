import { InlineMetric, InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import {
  FC,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  memo,
} from "react";
import {
  CommandPaletteGroup,
  CommandPaletteItem,
} from "../commandPalette/types";
import {
  CompatibleSpatialMetricDetailsFragment,
  GeographyDetailsFragment,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
  SketchGeometryType,
} from "../../generated/graphql";
import { AnyLayer } from "mapbox-gl";
import { EditorView } from "prosemirror-view";
import { EditorState } from "prosemirror-state";
import { MetricDependency } from "overlay-engine";
import { SelectionRange, TextSelection } from "prosemirror-state";
import { Trans, useTranslation } from "react-i18next";
import {
  GeographySizeTable,
  GeographySizeTableTooltipControls,
} from "./GeographySizeTable";
import {
  SketchAttributesTable,
  SketchAttributesTableTooltipControls,
} from "./SketchAttributesTable";
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
import { OverlayTogglePicker } from "./OverlayTogglePicker";
import {
  InlineLayerToggle,
  InlineLayerToggleTooltipControls,
} from "./InlineLayerToggle";
import {
  ColumnStatisticsTable,
  ColumnStatisticsTableTooltipControls,
} from "./ColumnStatisticsTable";
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
import { Mark, Node } from "prosemirror-model";
import { useWidgetDependencies } from "../hooks/useWidgetDependencies";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { FormLanguageContext } from "../../formElements/FormElement";
import {
  DotsHorizontalIcon,
  DragHandleDots1Icon,
  ExclamationTriangleIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import Badge from "../../components/Badge";
import {
  GeostatsLayer,
  isGeostatsLayer,
  RasterBandInfo,
} from "@seasketch/geostats-types";
import {
  findGetExpression,
  isExpression,
} from "../../dataLayers/legends/utils";
import * as Popover from "@radix-ui/react-popover";
import { TooltipPopoverContent } from "../../editor/TooltipMenu";
import useDebounce from "../../useDebounce";

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

/**
 * Error display components that access ReportContext only when errors occur.
 * By isolating context access here, we avoid subscribing to context in the
 * normal (non-error) rendering path.
 */
const WidgetErrorInline: FC<{ errors: string[]; cardId: number }> = ({
  errors,
  cardId,
}) => {
  const { setShowCalcDetails } = useContext(ReportUIStateContext);
  const { t } = useTranslation("reports");
  return (
    <button
      onClick={() => setShowCalcDetails(cardId)}
      className="bg-red-700 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center space-x-1"
      title={errors.join(". \n")}
    >
      <ExclamationTriangleIcon className="w-3 h-3 inline-block" />
      <span className="font-semibold">{t("Error")}</span>
      <span className="max-w-24 truncate text-red-200">
        {errors.join(". \n")}
      </span>
    </button>
  );
};

const WidgetErrorBlock: FC<{ errors: string[]; cardId: number }> = ({
  errors,
  cardId,
}) => {
  const { setShowCalcDetails } = useContext(ReportUIStateContext);
  const { t } = useTranslation("reports");

  const errorMap: Record<string, number> = {};
  for (const error of errors) {
    if (error in errorMap) {
      errorMap[error]++;
    } else {
      errorMap[error] = 1;
    }
  }

  return (
    <div className="bg-red-700 text-white p-2 rounded shadow-sm w-full text-left my-2">
      <div className="flex items-center space-x-2 py-1 text-base">
        <ExclamationTriangleIcon className="w-4 h-4 inline-block" />
        <div className="font-semibold">{t("Error")}</div>
      </div>
      <ul className="list-disc !pl-5 pt-1">
        {Object.entries(errorMap).map(([msg, count]) => (
          <li key={msg}>
            {msg}{" "}
            {Number(count) > 1 && (
              <Badge variant="error">
                {Number(count)}
                {t("x")}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={() => setShowCalcDetails(cardId)}
        className=" bg-red-50  text-black px-2 py-0.5 rounded shadow-sm inline-flex items-center space-x-1 mt-2 mb-1 text-sm "
      >
        <span className="">{t("View details")}</span>
      </button>
    </div>
  );
};

const memoizedWidgets: Record<string, WidgetComponent> = {
  InlineMetric: memoWidget(InlineMetric, "InlineMetric"),
  GeographySizeTable: memoWidget(GeographySizeTable, "GeographySizeTable"),
  SketchAttributesTable: memoWidget(
    SketchAttributesTable,
    "SketchAttributesTable"
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

export const ReportWidgetTooltipControlsRouter: ReportWidgetTooltipControls = (
  props
) => {
  switch (props.node.attrs.type) {
    case "InlineMetric":
      return <InlineMetricTooltipControls {...props} />;
    case "GeographySizeTable":
      return <GeographySizeTableTooltipControls {...props} />;
    case "SketchAttributesTable":
      return <SketchAttributesTableTooltipControls {...props} />;
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
    case "ColumnValuesHistogram":
      return <ColumnValuesHistogramTooltipControls {...props} />;
    case "RasterValuesHistogram":
      return <RasterValuesHistogramTooltipControls {...props} />;
    case "RasterStatisticsTable":
      return <RasterStatisticsTableTooltipControls {...props} />;
    case "BlockLayerToggle":
      return <BlockLayerToggleTooltipControls {...props} />;
    case "InlineLayerToggle":
      return <InlineLayerToggleTooltipControls {...props} />;
    default:
      return null;
  }
};

export const ReportWidgetNodeViewRouter: FC = (props: any) => {
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
  const widgetProps = useMemo<ReportWidgetProps<any>>(
    () => ({
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
    }),
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

  // Error components access ReportContext themselves, so we only subscribe
  // to context when there are actual errors (exceptional case)
  if (errors.length > 0) {
    if (node.isInline) {
      return <WidgetErrorInline errors={errors} cardId={cardId} />;
    } else {
      return <WidgetErrorBlock errors={errors} cardId={cardId} />;
    }
  }

  switch (node.attrs.type) {
    case "InlineMetric":
      return <memoizedWidgets.InlineMetric {...widgetProps} />;
    case "GeographySizeTable":
      return <memoizedWidgets.GeographySizeTable {...widgetProps} />;
    case "SketchAttributesTable":
      return <memoizedWidgets.SketchAttributesTable {...widgetProps} />;
    case "OverlappingAreasTable":
      return <memoizedWidgets.OverlappingAreasTable {...widgetProps} />;
    case "FeatureCountTable":
      return <memoizedWidgets.FeatureCountTable {...widgetProps} />;
    case "FeaturePresenceTable":
      return <memoizedWidgets.FeaturePresenceTable {...widgetProps} />;
    case "IntersectingFeaturesList":
      return <memoizedWidgets.IntersectingFeaturesList {...widgetProps} />;
    case "ColumnStatisticsTable":
      return <memoizedWidgets.ColumnStatisticsTable {...widgetProps} />;
    case "ColumnValuesHistogram":
      return <memoizedWidgets.ColumnValuesHistogram {...widgetProps} />;
    case "RasterValuesHistogram":
      return <memoizedWidgets.RasterValuesHistogram {...widgetProps} />;
    case "RasterStatisticsTable":
      return <memoizedWidgets.RasterStatisticsTable {...widgetProps} />;
    case "InlineLayerToggle":
      return <memoizedWidgets.InlineLayerToggle {...widgetProps} />;
    case "BlockLayerToggle":
      return <memoizedWidgets.BlockLayerToggle {...widgetProps} />;
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
};

export type BuildReportCommandGroupsArgs = {
  sources?: OverlaySourceDetailsFragment[];
  geographies?: Pick<GeographyDetailsFragment, "id" | "name">[];
  clippingGeography?: number;
  sketchClassGeometryType?: SketchGeometryType;
  overlayFooterItem?: CommandPaletteItem;
  overlayAugmenter?: (input: {
    source: OverlaySourceDetailsFragment;
    item: CommandPaletteItem;
  }) => CommandPaletteItem;
};

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
  geographies,
  clippingGeography,
  sketchClassGeometryType,
  overlayFooterItem,
  overlayAugmenter,
}: BuildReportCommandGroupsArgs = {}): CommandPaletteGroup[] {
  const commandGroups: CommandPaletteGroup[] = [];

  const attributesGroup: CommandPaletteGroup = {
    id: "attributes",
    label: "Attributes",
    items: [
      {
        id: "sketch-attributes-table",
        label: "Sketch Attributes Table",
        description: "Table of the current sketch's attributes.",
        run: (state, dispatch, view) => {
          return insertBlockMetric(view, state.selection.ranges[0], {
            type: "SketchAttributesTable",
            metrics: [],
            componentSettings: {},
          });
        },
      },
    ],
  };
  commandGroups.push(attributesGroup);

  if (sketchClassGeometryType === SketchGeometryType.Polygon) {
    const sizeGroup: CommandPaletteGroup = {
      id: "Size",
      label: "Sketch Size Metrics",
      items: [
        {
          id: "sketch-size",
          label: "Area",
          description: "The total area of the sketch",
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
        },
      ],
    };
    commandGroups.push(sizeGroup);
    if (clippingGeography) {
      const geography = geographies?.find((g) => g.id === clippingGeography);
      sizeGroup.items.push({
        id: "clipping-geography-percent",
        label: geography
          ? // eslint-disable-next-line i18next/no-literal-string
            `Percent of ${geography.name}`
          : "Percent of Geography",
        description: "Total area as a fraction of the clipping geography.",
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
    if (geographies && geographies.length > 1) {
      sizeGroup.items.push({
        id: "geography-size-table",
        label: "Geography Size Table",
        description: "A table of the sizes of the sketch in each geography.",
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

      const distanceGroup: CommandPaletteGroup = {
        id: "distance",
        label: "Distance",
        items: [
          {
            id: "inline-distance-to-shore",
            label: "Distance to Shore",
            description:
              "Closest distance between the sketch and the shoreline.",
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
          },
        ],
      };
      commandGroups.push(distanceGroup);
    }
  }

  if (sources) {
    commandGroups.push({
      id: "overlay-toggles",
      label: "Overlay Toggles",
      items: [
        {
          id: "block-layer-toggle",
          label: "Block Layer Toggle",
          description: "Toggle an overlay layer on the map",
          run: () => false,
          customPopoverContent: ({ closePopover, apply, focusPalette }) => (
            <OverlayTogglePicker
              onSelect={(stableId, label, helpers) => {
                const item = {
                  id: `block-layer-toggle-${stableId}`,
                  label,
                  run: (state: EditorState, dispatch: any, view: EditorView) =>
                    insertBlockMetric(view, state.selection.ranges[0], {
                      type: "BlockLayerToggle",
                      metrics: [],
                      componentSettings: { stableId, label },
                    }),
                };
                (helpers?.apply || apply)(item);
                closePopover();
              }}
              helpers={{ apply, closePopover, focusPalette }}
            />
          ),
        },
        {
          id: "inline-layer-toggle",
          label: "Inline Layer Toggle",
          description: "Inline toggle for an overlay layer",
          run: () => false,
          customPopoverContent: ({ closePopover, apply }) => (
            <OverlayTogglePicker
              onSelect={(stableId, label) => {
                const item = {
                  id: `inline-layer-toggle-${stableId}`,
                  label,
                  run: (state: EditorState, dispatch: any, view: EditorView) =>
                    insertInlineMetric(view, state.selection.ranges[0], {
                      type: "InlineLayerToggle",
                      metrics: [],
                      componentSettings: { stableId, label },
                    }),
                };
                apply(item);
                closePopover();
              }}
            />
          ),
        },
      ],
    });

    const overlayItems: CommandPaletteItem[] = sources
      .filter((source) => source.tableOfContentsItemId)
      .map((source) => {
        const title =
          source.tableOfContentsItem?.title || "Layer Overlay Analysis";
        const tocId = source.tableOfContentsItemId!;
        const sourceUrl = source.sourceUrl;
        const stableId = source.tableOfContentsItem?.stableId;
        let children: CommandPaletteItem[] = [];
        if ("bands" in source.geostats && source.geostats.bands.length === 1) {
          const band = source.geostats.bands[0] as RasterBandInfo;
          // Raster handling can be added here if needed
          children.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-inline-band-stats`,
            label: "Inline Raster Band Statistics",
            description:
              "Summarize a raster band with a mean, min, max, or distinct value count.",
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
          children.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-stats-table`,
            label: "Raster Statistics Table",
            description:
              "Table of raster band statistics such as mean, min, max, sum, and invalid pixels.",
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
          children.push({
            // eslint-disable-next-line i18next/no-literal-string
            id: `overlay-layer-${tocId}-raster-histogram`,
            label: "Raster Values Histogram",
            description:
              "Histogram of raster values for the sketch, using the layer's bin definitions.",
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
        } else if (
          "layers" in source.geostats &&
          isGeostatsLayer(source.geostats.layers[0])
        ) {
          const geostatsLayer = source.geostats.layers[0] as GeostatsLayer;
          const groupByColumn = groupByForStyle(
            source.mapboxGlStyles,
            geostatsLayer
          );
          const bestLabelColumn = labelColumnForGeostatsLayer(
            geostatsLayer,
            source.mapboxGlStyles
          );
          const numericColumns = geostatsLayer.attributes
            .filter((attr) => attr.type === "number")
            .map((attr) => attr.attribute);
          const bestNumericColumn =
            numericColumns.length > 0 ? numericColumns[0] : undefined;
          if (
            [
              "Polygon",
              "MultiPolygon",
              "Point",
              "MultiPoint",
              "LineString",
            ].includes(geostatsLayer.geometry)
          ) {
            children.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count`,
              label: "Feature Count",
              description: "Count of the number of overlapping features.",
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
            children.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-count-table`,
              label: "Feature Count Table",
              description:
                "Table with feature counts, optionally grouped by a class key and compared to counts in the entire geography.",
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
            children.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-feature-presence-table`,
              label: "Feature Presence Table",
              description:
                "Table that shows presence/absence based on intersecting feature counts, optionally grouped by a class key.",
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
            children.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-intersecting-features-list`,
              label: "Intersecting Features List",
              description: "List of features that intersect with the sketch.",
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
            if (
              bestNumericColumn ||
              source.geostats.layers[0]?.attributes?.[0]?.attribute
            ) {
              children.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-inline-column-stats`,
                label: "Inline Column Stats",
                description:
                  "Summarize numeric columns with a mean, min, max, or distinct value count.",
                run: (state, dispatch, view) => {
                  return insertInlineMetric(view, state.selection.ranges[0], {
                    type: "InlineMetric",
                    metrics: [
                      {
                        type: "column_values",
                        subjectType: "fragments",
                        stableId,
                      },
                    ],
                    componentSettings: {
                      presentation: "column_values",
                      stat: "mean",
                      column:
                        bestNumericColumn ||
                        source.geostats.layers[0].attributes[0].attribute,
                    },
                  });
                },
              });
            }

            children.push({
              // eslint-disable-next-line i18next/no-literal-string
              id: `overlay-layer-${tocId}-column-stats-table`,
              label: "Column Statistics Table",
              description:
                "Show key statistics for a column such as min, max, mean, sum, and distinct value count.",
              run: (state, dispatch, view) => {
                return insertBlockMetric(view, state.selection.ranges[0], {
                  type: "ColumnStatisticsTable",
                  metrics: [
                    {
                      type: "column_values",
                      subjectType: "fragments",
                      stableId,
                    },
                  ],
                  componentSettings: {
                    columns: [
                      bestNumericColumn ||
                        source.geostats.layers[0].attributes[0].attribute,
                    ],
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

            if (bestNumericColumn) {
              children.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-column-value-histogram`,
                label: "Column Value Histogram",
                description: "Histogram of values for a numeric column.",
                run: (state, dispatch, view) => {
                  return insertBlockMetric(view, state.selection.ranges[0], {
                    type: "ColumnValuesHistogram",
                    metrics: [
                      {
                        type: "column_values",
                        subjectType: "fragments",
                        stableId,
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
          switch (geostatsLayer.geometry) {
            case "Polygon":
            case "MultiPolygon": {
              children.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-overlap-area`,
                label: "Overlapping Area",
                description:
                  "Inline metric representing the total area of the sketch that overlaps with the layer.",
                run: (state, dispatch, view) => {
                  return insertInlineMetric(view, state.selection.ranges[0], {
                    type: "InlineMetric",
                    metrics: [
                      {
                        type: "overlay_area",
                        subjectType: "fragments",
                        stableId,
                      },
                    ],
                    componentSettings: {
                      presentation: "overlay_area",
                    },
                  });
                },
              });
              children.push({
                // eslint-disable-next-line i18next/no-literal-string
                id: `overlay-layer-${tocId}-overlap-table`,
                label: "Overlapping Area Table",
                description:
                  "Table of overlapping area statistics. Works best when grouped by a class key. May include percent overlapped for a geography.",
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
                        },
                      },
                      {
                        type: "overlay_area",
                        subjectType: "geographies",
                        stableId,
                        parameters: {
                          groupBy: groupByColumn,
                        },
                      },
                    ],
                    componentSettings: {
                      // presentation: "overlay_area",
                    },
                  });
                },
              });
              break;
            }
          }
        }
        let item: CommandPaletteItem = {
          // eslint-disable-next-line i18next/no-literal-string
          id: `overlay-layer-${tocId}`,
          label: title,
          // description: "Layer-specific overlay analysis options.",
          run: () => false,
          children,
        };
        if (overlayAugmenter) {
          item = overlayAugmenter({ source, item });
        }
        return item;
      });

    if (overlayItems.length || overlayFooterItem) {
      const sortedItems = overlayItems.sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      if (overlayFooterItem) {
        sortedItems.push(overlayFooterItem);
      }
      commandGroups.push({
        id: "layer-overlay-analysis",
        label: "Layer Overlay Analysis",
        items: sortedItems,
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

  // Place cursor just after the inserted node, preferring the same inline
  // parent so we don't jump into a following block node.
  const mappedFrom = tr.mapping.map(range.$from.pos);
  const posAfter = Math.min(tr.doc.content.size, mappedFrom + node.nodeSize);
  const $posAfter = tr.doc.resolve(posAfter);
  const selection = $posAfter.parent.inlineContent
    ? TextSelection.create(tr.doc, posAfter)
    : TextSelection.near(
        $posAfter,
        -1 /* backward to stay in previous block */
      );
  tr = tr.setSelection(selection);

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
  geographies: Pick<GeographyDetailsFragment, "id" | "name">[];
  componentSettings: T;
  marks?: Mark[];
  node?: Node;
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    "id" | "projectId" | "geometryType" | "form" | "clippingGeographies"
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
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center text-gray-700 text-sm space-x-1">
      <span className="flex-1 font-light text-gray-400 whitespace-nowrap">
        {label}
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 text-blue-600 rounded border-gray-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
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

  const initialLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    labelKeys.forEach((key) => {
      labels[key] = componentSettings[key] || "";
    });
    return labels;
  }, [labelKeys, componentSettings]);

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

  // Debounced update of componentSettings
  useEffect(() => {
    const hasChanges = labelKeys.some(
      (key) => debouncedLocalState[key] !== initialLabels[key]
    );
    if (hasChanges) {
      const updatedSettings: Record<string, any> = {};
      labelKeys.forEach((key) => {
        updatedSettings[key] = debouncedLocalState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  }, [debouncedLocalState, labelKeys, onUpdate]);

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
                value={localState[key]}
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
