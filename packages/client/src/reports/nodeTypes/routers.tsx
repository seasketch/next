import InlineMetric, { InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { FC } from "react";
import { CommandPaletteGroup } from "../commandPalette/types";
import {
  GeographyDetailsFragment,
  OverlaySourceDetailsFragment,
  SketchGeometryType,
} from "../../generated/graphql";
import { EditorView } from "prosemirror-view";
import { MetricDependency } from "overlay-engine";
import { SelectionRange, TextSelection } from "prosemirror-state";

export const ReportWidgetTooltipControlsRouter: ReportWidgetTooltipControls = (
  props
) => {
  switch (props.node.type.name) {
    case "metric":
      return <InlineMetricTooltipControls {...props} />;
    default:
      return null;
  }
};

export const ReportWidgetNodeViewRouter: FC = (props: any) => {
  switch (props.node.type.name) {
    case "metric":
      return <InlineMetric {...props} />;
    default:
      // eslint-disable-next-line i18next/no-literal-string
      return <span>Unknown node type: {props.node.type.name}</span>;
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
                geographies: [clippingGeography],
              },
            ],
          });
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
  properties: MetricProperties
): boolean {
  const { state, dispatch } = view;
  const { schema } = state;
  const metricType = schema.nodes.metric;

  if (!metricType) {
    return false;
  }

  const node = metricType.create({
    ...properties,
  });

  let tr = state.tr.replaceRangeWith(range.$from.pos, range.$to.pos, node);

  // Place cursor after the inserted node
  const posAfter = range.$from.pos + node.nodeSize;
  tr = tr.setSelection(
    TextSelection.near(tr.doc.resolve(posAfter), 1 /* forward */)
  );

  dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export interface MetricProperties {
  metrics: MetricDependency[];
  componentSettings: Record<string, any>;
}
