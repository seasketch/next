import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import {
  Geography,
  Sketch,
  SketchingDetailsFragment,
  SpatialMetricDependency,
} from "../generated/graphql";
import { ReportConfiguration } from "./cards/cards";

export interface ReportContextState {
  /**
   * The sketch class details for the report
   */
  sketchClass: SketchingDetailsFragment;

  /**
   * The sketch being reported on
   */
  sketch: Pick<
    Sketch,
    | "id"
    | "name"
    | "sketchClassId"
    | "createdAt"
    | "collectionId"
    | "updatedAt"
    | "properties"
  >;

  /**
   * Whether the sketch is a collection
   */
  isCollection: boolean;

  /**
   * The IDs of the child sketches, if a collection
   */
  childSketchIds: number[];

  /**
   * The report configuration containing tabs and cards
   */
  report: ReportConfiguration;

  /**
   * The currently selected tab ID
   */
  selectedTabId: number;

  /**
   * The currently selected tab configuration
   */
  selectedTab: ReportConfiguration["tabs"][0];

  /**
   * Function to update the selected tab
   */
  setSelectedTabId: (tabId: number) => void;

  /**
   * Whether the report is in admin/editable mode
   */
  adminMode: boolean;

  /**
   * The ID of the card currently selected for editing
   */
  selectedForEditing: number | null;

  /**
   * Function to set the card selected for editing
   */
  setSelectedForEditing: (cardId: number | null) => void;

  /**
   * Function to delete a card
   */
  deleteCard?: (cardId: number) => void;
  geographies: Pick<Geography, "id" | "name" | "translatedProps">[];

  /**
   * Function to add a metric dependency
   */
  addMetricDependency: (
    cardId: number,
    dependency: SpatialMetricDependency
  ) => Promise<void>;

  /**
   * Function to remove a metric dependency
   */
  removeMetricDependency: (
    cardId: number,
    dependency: SpatialMetricDependency
  ) => Promise<void>;
}

export const ReportContext = createContext<ReportContextState | null>(null);

/**
 * Custom hook to manage report state
 */
export function useReportState(
  report: ReportConfiguration | undefined,
  initialSelectedTabId?: number
) {
  const [selectedTabId, setSelectedTabId] = useState<number>(
    initialSelectedTabId || report?.tabs?.[0]?.id || 0
  );
  const [selectedForEditing, setSelectedForEditing] = useState<number | null>(
    null
  );

  // Get the selected tab based on selectedTabId, fallback to first tab
  const selectedTab = report?.tabs?.find((tab) => tab.id === selectedTabId) ||
    report?.tabs?.[0] || {
      id: 0,
      title: "Default Tab",
      position: 0,
      cards: [],
      alternateLanguageSettings: {},
    };

  // Update selectedTabId if the current one is no longer valid
  useEffect(() => {
    if (!report?.tabs) return;

    const currentTabExists = report.tabs.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && report.tabs[0]?.id) {
      setSelectedTabId(report.tabs[0].id);
    }
  }, [report?.tabs, selectedTabId]);

  const [metricDependencies, setMetricDependencies] = useState<
    (SpatialMetricDependency & { hash: string; cards: number[] })[]
  >([]);

  // Adds a metric dependency to metricDependencies, tracking the card it
  // belongs to. Multiple cards can share the same dependency, it should only be
  // added once, tracking all the cards that share the same dependency.
  const addMetricDependency = useCallback(
    async (cardId: number, dependency: SpatialMetricDependency) => {
      const hash = await hashMetricDependency(dependency);
      const existingDependency = metricDependencies.find(
        (d) => d.hash === hash
      );
      if (existingDependency) {
        existingDependency.cards.push(cardId);
        setMetricDependencies([...metricDependencies]);
      } else {
        setMetricDependencies([
          ...metricDependencies,
          { ...dependency, hash, cards: [cardId] },
        ]);
      }
    },
    [metricDependencies]
  );

  // Removes a metric dependency from metricDependencies, assuming no cards
  // reference it anymore.
  const removeMetricDependency = useCallback(
    async (cardId: number, dependency: SpatialMetricDependency) => {
      const hash = await hashMetricDependency(dependency);
      const existingDependency = metricDependencies.find(
        (d) => d.hash === hash
      );
      if (existingDependency) {
        existingDependency.cards = existingDependency.cards.filter(
          (id) => id !== cardId
        );
        if (existingDependency.cards.length === 0) {
          setMetricDependencies(
            metricDependencies.filter((d) => d.hash !== hash)
          );
        }
      }
    },
    [metricDependencies]
  );

  return {
    selectedTabId,
    setSelectedTabId,
    selectedTab,
    selectedForEditing,
    setSelectedForEditing,
    addMetricDependency,
    removeMetricDependency,
  };
}

export function useReportContext(): ReportContextState {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error(
      "useReportContext must be used within a ReportContextProvider"
    );
  }
  return context;
}

async function hashMetricDependency(
  dependency: SpatialMetricDependency
): Promise<string> {
  const data = JSON.stringify(dependency);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(data)
  );

  // Convert the hash buffer to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
