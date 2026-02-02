import { createContext, useContext } from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
} from "../../generated/graphql";

export type CardDependenciesValue = {
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[];
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    "id" | "projectId" | "geometryType" | "form" | "clippingGeographies"
  > | null;
};

export const CardDependenciesContext = createContext<CardDependenciesValue>({
  metrics: [],
  sources: [],
  loading: true,
  geographies: [],
  sketchClass: null,
});

/**
 * Hook to access card-level dependencies from within widgets.
 * This provides metrics and sources scoped to the current card,
 * preventing unnecessary re-renders when other cards' data changes.
 */
export function useCardDependenciesContext() {
  return useContext(CardDependenciesContext);
}
