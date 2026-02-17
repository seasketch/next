import { MetricDependency } from "overlay-engine";
import { createContext } from "react";
import { CompatibleSpatialMetricDetailsFragment, OverlaySourceDetailsFragment } from "../generated/graphql";

export const DraftReportContext = createContext<{
  draftMetrics: CompatibleSpatialMetricDetailsFragment[];
  draftOverlaySources: OverlaySourceDetailsFragment[];
  draftDependencies: MetricDependency[];
}>({
  draftMetrics: [],
  draftOverlaySources: [],
  draftDependencies: [],
});
