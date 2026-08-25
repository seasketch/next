import React from "react";

/**
 * Stable node-view entry point for report widgets.
 *
 * `widgets.tsx` is in a circular import graph (widgets ↔ individual widget
 * files ↔ TooltipMenu). CRA Fast Refresh re-evaluates that graph and a live
 * ESM binding to `ReportWidgetNodeViewRouter` can be in the temporal dead
 * zone for a frame. Resolving the router at render time avoids that.
 */
export function ReportWidgetNodeView(props: any) {
  const { ReportWidgetNodeViewRouter } = require("./widgets") as {
    ReportWidgetNodeViewRouter: React.ComponentType<any>;
  };
  return <ReportWidgetNodeViewRouter {...props} />;
}
