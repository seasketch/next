import { InlineMetric, InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { FC, useMemo } from "react";
import { CommandPaletteGroup } from "../commandPalette/types";
import {
  CompatibleSpatialMetricDetailsFragment,
  GeographyDetailsFragment,
  OverlaySourceDetailsFragment,
  SketchGeometryType,
  SpatialMetricState,
} from "../../generated/graphql";
import { EditorView } from "prosemirror-view";
import { hashMetricDependency, MetricDependency } from "overlay-engine";
import { SelectionRange, TextSelection } from "prosemirror-state";
import { Trans } from "react-i18next";
import {
  GeographySizeTable,
  GeographySizeTableTooltipControls,
} from "./GeographySizeTable";
import { Mark, Node } from "prosemirror-model";
import { useReportContext } from "../ReportContext";
import { filterMetricsByDependencies } from "../utils/metricSatisfiesDependency";

export const ReportWidgetTooltipControlsRouter: ReportWidgetTooltipControls = (
  props
) => {
  switch (props.node.attrs.type) {
    case "InlineMetric":
      return <InlineMetricTooltipControls {...props} />;
    case "GeographySizeTable":
      return <GeographySizeTableTooltipControls {...props} />;
    default:
      return null;
  }
};

export const ReportWidgetNodeViewRouter: FC = (props: any) => {
  const {
    geographies,
    metrics: contextMetrics,
    overlaySources,
  } = useReportContext();
  const node = props.node as Node;
  const { type, componentSettings, metrics: dependencies } = node.attrs || {};
  if (!type) {
    throw new Error("ReportWidget node type not specified");
  }
  if (!componentSettings) {
    throw new Error("ReportWidget component settings not specified");
  }

  const { metrics, sources, loading, errors } = useMemo(() => {
    let loading = false;
    let errors: string[] = [];
    const metrics = filterMetricsByDependencies(
      contextMetrics,
      dependencies,
      overlaySources.map((s) => s.sourceUrl!)
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
    const sources = overlaySources.filter((s) =>
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
  }, [contextMetrics, dependencies, overlaySources]);

  const widgetProps = {
    dependencies,
    componentSettings,
    metrics,
    sources: overlaySources,
    loading,
    errors,
    geographies,
    marks: node.marks as Mark[] | undefined,
    node,
  };

  switch (node.attrs.type) {
    case "InlineMetric":
      return <InlineMetric {...widgetProps} />;
    case "GeographySizeTable":
      return <GeographySizeTable {...widgetProps} />;
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

export function buildReportCommandGroups({
  sources,
  geographies,
  clippingGeography,
  sketchClassGeometryType,
}: BuildReportCommandGroupsArgs = {}): CommandPaletteGroup[] {
  const commandGroups: CommandPaletteGroup[] = [];
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
            return insertMetric(view, state.selection.ranges[0], {
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
          return insertMetric(view, state.selection.ranges[0], {
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
          return insertMetric(
            view,
            state.selection.ranges[0],
            {
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
            },
            false
          );
        },
      });
    }
  }
  return commandGroups;
}

/**
 * Insert a metric node at the specified range.
 * @param properties - The metric properties (type, geography)
 */
export function insertMetric(
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
    : TextSelection.near($posAfter, -1 /* backward to stay in previous block */);
  tr = tr.setSelection(selection);

  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
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
}

export type ReportWidget<T extends Record<string, any>> = FC<
  ReportWidgetProps<T>
>;
