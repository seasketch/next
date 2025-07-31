import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Sketch, SketchingDetailsFragment } from "../generated/graphql";
import { ReportConfiguration } from "./cards/cards";

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

  return {
    selectedTabId,
    setSelectedTabId,
    selectedTab,
    selectedForEditing,
    setSelectedForEditing,
  };
}

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
    | "userAttributes"
  > | null;
  report: ReportConfiguration;
  adminMode?: boolean;
  selectedTabId: number;
  setSelectedTabId: (tabId: number) => void;
  selectedTab: ReportConfiguration["tabs"][0];
  selectedForEditing: number | null;
  setSelectedForEditing: (cardId: number | null) => void;
  deleteCard?: (cardId: number) => void;
}

export function ReportContextProvider({
  children,
  sketchClass,
  sketch,
  report,
  adminMode = false,
  selectedTabId,
  setSelectedTabId,
  selectedTab,
  selectedForEditing,
  setSelectedForEditing,
  deleteCard,
}: ReportContextProviderProps) {
  const value: ReportContextState = {
    sketchClass,
    sketch,
    report,
    selectedTabId,
    selectedTab,
    setSelectedTabId,
    adminMode,
    selectedForEditing,
    setSelectedForEditing,
    deleteCard,
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
