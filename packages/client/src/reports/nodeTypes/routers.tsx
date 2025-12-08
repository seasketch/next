import InlineMetric, { InlineMetricTooltipControls } from "./InlineMetric";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { FC } from "react";

export const ReportWidgetTooltipControlsRouter: ReportWidgetTooltipControls = (
  props
) => {
  console.log("ReportWidgetTooltipControlsRouter", props.node.type.name);
  switch (props.node.type.name) {
    case "metric":
      return <InlineMetricTooltipControls {...props} />;
    default:
      return null;
  }
};

export const ReportWidgetNodeViewRouter: FC = (props: any) => {
  console.log("ReportWidgetNodeViewRouter", props.node.type.name);
  switch (props.node.type.name) {
    case "metric":
      return <InlineMetric {...props} />;
    default:
      // eslint-disable-next-line i18next/no-literal-string
      return <span>Unknown node type: {props.node.type.name}</span>;
  }
};
