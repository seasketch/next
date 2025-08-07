import React, {
  createContext,
  useContext,
  useState,
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
import { MetricSubjectFragment } from "overlay-engine";

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

  childSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  siblingSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];

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
  relatedFragments: MetricSubjectFragment[];

  /**
   * Function to add a metric dependency
   */
  addMetricDependency: (
    hookId: number,
    dependency: SpatialMetricDependency
  ) => void;

  /**
   * Function to remove a metric dependency
   */
  removeMetricDependency: (
    hookId: number,
    dependency: SpatialMetricDependency
  ) => void;

  /**
   * Function to get all the metric dependencies registered with the context
   */
  getMetricDependencies: () => SpatialMetricDependency[];

  /**
   * The current metric dependencies, debounced
   */
  currentMetricDependencies: SpatialMetricDependency[];
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
    (SpatialMetricDependency & { hash: string; hooks: number[] })[]
  >([]);

  // Adds a metric dependency to metricDependencies, tracking the card it
  // belongs to. Multiple cards can share the same dependency, it should only be
  // added once, tracking all the cards that share the same dependency.
  const addMetricDependency = useCallback(
    (hookId: number, dependency: SpatialMetricDependency) => {
      const hash = hashMetricDependency(dependency);
      setMetricDependencies((currentDependencies) => {
        const existingDependency = currentDependencies.find(
          (d) => d.hash === hash
        );
        if (existingDependency) {
          return currentDependencies.map((d) =>
            d.hash === hash ? { ...d, hooks: [...d.hooks, hookId] } : d
          );
        } else {
          return [
            ...currentDependencies,
            { ...dependency, hash, hooks: [hookId] },
          ];
        }
      });
    },
    []
  );

  // Removes a metric dependency from metricDependencies, assuming no cards
  // reference it anymore.
  const removeMetricDependency = useCallback(
    (hookId: number, dependency: SpatialMetricDependency) => {
      const hash = hashMetricDependency(dependency);
      setMetricDependencies((currentDependencies) => {
        const existingDependency = currentDependencies.find(
          (d) => d.hash === hash
        );
        if (existingDependency) {
          const updatedHooks = existingDependency.hooks.filter(
            (id) => id !== hookId
          );
          if (updatedHooks.length === 0) {
            return currentDependencies.filter((d) => d.hash !== hash);
          } else {
            return currentDependencies.map((d) =>
              d.hash === hash ? { ...d, hooks: updatedHooks } : d
            );
          }
        }
        return currentDependencies;
      });
    },
    []
  );

  // Returns a list of all the metric dependencies registered with the context,
  // without any hook or hash ids.
  const getMetricDependencies = useCallback(() => {
    return metricDependencies.map((d) => {
      const dep = {
        ...d,
      } as any;
      delete dep.hash;
      delete dep.hooks;
      return dep as SpatialMetricDependency;
    });
  }, [metricDependencies]);

  const [currentMetricDependencies, setCurrentMetricDependencies] = useState<
    SpatialMetricDependency[]
  >([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentMetricDependencies(getMetricDependencies());
    }, 5);

    return () => clearTimeout(handler);
  }, [metricDependencies]);

  useEffect(() => {
    // console.log("currentMetricDependencies", currentMetricDependencies);
  }, [currentMetricDependencies]);

  return {
    selectedTabId,
    setSelectedTabId,
    selectedTab,
    selectedForEditing,
    setSelectedForEditing,
    addMetricDependency,
    removeMetricDependency,
    getMetricDependencies,
    currentMetricDependencies,
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

function hashMetricDependency(dependency: SpatialMetricDependency): string {
  const data = JSON.stringify(dependency);

  // Simple djb2 hash algorithm - works in both browser and Node.js
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) + hash + data.charCodeAt(i);
    // Convert to 32-bit integer
    hash = hash & hash;
  }

  // Convert to positive hex string
  return Math.abs(hash).toString(16);
}
