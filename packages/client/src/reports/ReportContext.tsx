import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import {
  Sketch,
  SketchingDetailsFragment,
  SketchTocDetailsFragment,
} from "../generated/graphql";
import { ReportConfiguration } from "./cards";

export interface ReportContextState {
  /**
   * The sketch class details for the report
   */
  sketchClass: SketchingDetailsFragment | null;

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
  > | null;

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
}

const ReportContext = createContext<ReportContextState | null>(null);

export interface ReportContextProviderProps {
  children: ReactNode;
  sketchClass: SketchingDetailsFragment | null;
  sketch: Pick<
    Sketch,
    | "id"
    | "name"
    | "sketchClassId"
    | "createdAt"
    | "collectionId"
    | "updatedAt"
    | "properties"
  > | null;
  report: ReportConfiguration;
  initialSelectedTabId?: number;
}

export function ReportContextProvider({
  children,
  sketchClass,
  sketch,
  report,
  initialSelectedTabId,
}: ReportContextProviderProps) {
  const [selectedTabId, setSelectedTabId] = useState<number>(
    initialSelectedTabId || report.tabs?.[0]?.id || 0
  );

  // Get the selected tab based on selectedTabId, fallback to first tab
  const selectedTab = report.tabs?.find((tab) => tab.id === selectedTabId) ||
    report.tabs?.[0] || {
      id: 0,
      title: "Default Tab",
      position: 0,
      cards: [],
      alternateLanguageSettings: {},
    };

  // Update selectedTabId if the current one is no longer valid
  useEffect(() => {
    const currentTabExists = report.tabs?.some(
      (tab) => tab.id === selectedTabId
    );
    if (!currentTabExists && report.tabs?.[0]?.id) {
      setSelectedTabId(report.tabs[0].id);
    }
  }, [report.tabs, selectedTabId]);

  const value: ReportContextState = {
    sketchClass,
    sketch,
    report,
    selectedTabId,
    selectedTab,
    setSelectedTabId,
  };

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
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
