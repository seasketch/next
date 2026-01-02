import { InlineMetric, InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { FC, useContext, useMemo, useState, useEffect } from "react";
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
  SpatialMetricState,
} from "../../generated/graphql";
import { AnyLayer } from "mapbox-gl";
import { EditorView } from "prosemirror-view";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
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
import { Mark, Node } from "prosemirror-model";
import { useReportContext } from "../ReportContext";
import { filterMetricsByDependencies } from "../utils/metricSatisfiesDependency";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ExclamationTriangleIcon, Pencil2Icon } from "@radix-ui/react-icons";
import Badge from "../../components/Badge";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import {
  findGetExpression,
  isExpression,
} from "../../dataLayers/legends/utils";
import * as Popover from "@radix-ui/react-popover";
import { TooltipPopoverContent } from "../../editor/TooltipMenu";
import useDebounce from "../../useDebounce";

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
    default:
      return null;
  }
};

export const ReportWidgetNodeViewRouter: FC = (props: any) => {
  const {
    geographies,
    metrics: contextMetrics,
    overlaySources,
    sketchClass,
    adminSources,
    setShowCalcDetails,
  } = useReportContext();
  const { t } = useTranslation("reports");
  const languageContext = useContext(FormLanguageContext);
  const lang = languageContext?.lang?.code;
  const node = props.node as Node;
  const cardId = props.cardId;
  const { type, componentSettings, metrics: dependencies } = node.attrs || {};
  const alternateLanguageSettings = node.attrs?.alternateLanguageSettings || {};
  if (!type) {
    throw new Error("ReportWidget node type not specified");
  }
  if (!componentSettings) {
    throw new Error("ReportWidget component settings not specified");
  }

  const { metrics, loading, errors, sources } = useMemo(() => {
    let loading = false;
    let errors: string[] = [];
    const metrics = filterMetricsByDependencies(
      contextMetrics,
      dependencies,
      [...overlaySources, ...adminSources].reduce((acc, s) => {
        acc[s.tableOfContentsItemId!] = s.sourceUrl!;
        return acc;
      }, {} as Record<number, string>)
    ) as CompatibleSpatialMetricDetailsFragment[];
    for (const metric of metrics) {
      if (
        metric.state === SpatialMetricState.DependencyNotReady ||
        metric.state === SpatialMetricState.Processing ||
        metric.state === SpatialMetricState.Queued
      ) {
        loading = true;
      }
      if (metric.state === SpatialMetricState.Error) {
        errors.push(metric.errorMessage || "Unknown error");
      }
    }
    const sources = [...overlaySources, ...adminSources].filter((s) =>
      dependencies.some(
        (d: MetricDependency) =>
          d.tableOfContentsItemId === s.tableOfContentsItemId
      )
    );
    if (!loading) {
      // check to make sure each dependency has at least one related metric. If
      // not, that means the client is dynamically fetching metrics from a draft
      // report body and hasn't received those metrics (finished or not) yet.
      for (const dependency of dependencies) {
        const hash = hashMetricDependency(dependency);
        const relatedMetric = contextMetrics.find(
          (m) => m.dependencyHash === hash
        );
        if (!relatedMetric) {
          loading = true;
          break;
        }
      }
    }
    // loading = true;
    return { metrics, sources, loading, errors };
  }, [contextMetrics, dependencies, overlaySources, adminSources]);

  const widgetProps: ReportWidgetProps<any> = {
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
  };

  if (errors.length > 0) {
    const errorMap: Record<string, number> = {};
    for (const error of errors) {
      if (error in errorMap) {
        errorMap[error]++;
      } else {
        errorMap[error] = 1;
      }
    }
    if (node.isInline) {
      return (
        <button
          onClick={() => setShowCalcDetails(cardId!)}
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
    } else {
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
            onClick={() => setShowCalcDetails(cardId!)}
            className=" bg-red-50  text-black px-2 py-0.5 rounded shadow-sm inline-flex items-center space-x-1 mt-2 mb-1 text-sm "
          >
            <span className="">{t("View details")}</span>
          </button>
        </div>
      );
    }
  }

  switch (node.attrs.type) {
    case "InlineMetric":
      return <InlineMetric {...widgetProps} />;
    case "GeographySizeTable":
      return <GeographySizeTable {...widgetProps} />;
    case "SketchAttributesTable":
      return <SketchAttributesTable {...widgetProps} />;
    case "OverlappingAreasTable":
      return <OverlappingAreasTable {...widgetProps} />;
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

  if (sources && sources.length > 0) {
    const overlayItems: CommandPaletteItem[] = sources
      .filter((source) => source.tableOfContentsItemId)
      .map((source) => {
        const title =
          source.tableOfContentsItem?.title || "Layer Overlay Analysis";
        const tocId = source.tableOfContentsItemId!;
        let children: CommandPaletteItem[] = [];
        if ("bands" in source.geostats && source.geostats.bands.length > 0) {
          // Raster handling can be added here if needed
        } else if (
          "layers" in source.geostats &&
          isGeostatsLayer(source.geostats.layers[0])
        ) {
          const geostatsLayer = source.geostats.layers[0] as GeostatsLayer;
          const groupByColumn = groupByForStyle(
            source.mapboxGlStyles,
            geostatsLayer
          );
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
                      tableOfContentsItemId: tocId,
                      parameters: {},
                    },
                  ],
                });
              },
            });
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
                        tableOfContentsItemId: tocId,
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
                        tableOfContentsItemId: tocId,
                        parameters: {
                          groupBy: groupByColumn,
                        },
                      },
                      {
                        type: "overlay_area",
                        subjectType: "geographies",
                        tableOfContentsItemId: tocId,
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
        return {
          // eslint-disable-next-line i18next/no-literal-string
          id: `overlay-layer-${tocId}`,
          label: title,
          // description: "Layer-specific overlay analysis options.",
          run: () => false,
          children,
        };
      });

    if (overlayItems.length) {
      commandGroups.push({
        id: "layer-overlay-analysis",
        label: "Layer Overlay Analysis",
        items: overlayItems.sort((a, b) => a.label.localeCompare(b.label)),
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
  sketchClass: ReportContextSketchClassDetailsFragment;
  alternateLanguageSettings: { [langCode: string]: any };
  lang?: string;
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
    <label className="flex items-center text-gray-700 text-sm">
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

  // Sync local state when componentSettings change externally
  useEffect(() => {
    setLocalState(initialLabels);
  }, [initialLabels]);

  // Debounced update of componentSettings
  useEffect(() => {
    const hasChanges = labelKeys.some(
      (key) => debouncedLocalState[key] !== initialLabels[key]
    );
    if (hasChanges) {
      const updatedSettings: Record<string, any> = { ...componentSettings };
      labelKeys.forEach((key) => {
        updatedSettings[key] = debouncedLocalState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  }, [
    debouncedLocalState,
    initialLabels,
    componentSettings,
    labelKeys,
    onUpdate,
  ]);

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
