import {
  ReactNode,
  createContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import { DataTableUserVisualizationChoice } from "./dataTableQueryApi";

export interface LegendFocusRequest {
  layerId: string;
  requestId: number;
}

export interface ActivatedDataTableContextValue {
  /**
   * Maps a table-of-contents stableId to the id of the OverlayDataTable
   * currently activated for display on the map for that layer, if any.
   */
  activeTableIds: { [tocStableId: string]: number | undefined };
  /** Activates the given table for a layer, or clears it when tableId is null. */
  setActiveTable: (tocStableId: string, tableId: number | null) => void;
  /** Set when a data table is activated so the map legend can expand and scroll to the layer. */
  legendFocusRequest: LegendFocusRequest | null;
  clearLegendFocusRequest: () => void;
  /**
   * The user's raw column/op picks from "Display settings" for the active
   * table on each layer, before reconciling with admin constraints (see
   * `resolveDataTableVisualizationSettings` in dataTableQueryApi.ts).
   * MapManagerContextProvider combines this with OverlayDataTable's
   * visualizationColumns/visualizationOps and forwards the result to
   * MapContextManager.
   */
  userVisualizationChoices: {
    [tocStableId: string]: DataTableUserVisualizationChoice | undefined;
  };
  /** Sets or clears (via null) the user's visualization choice for a layer's active table. */
  setUserVisualizationChoice: (
    tocStableId: string,
    choice: DataTableUserVisualizationChoice | null
  ) => void;
}

export const ActivatedDataTableContext =
  createContext<ActivatedDataTableContextValue>({
    activeTableIds: {},
    setActiveTable: () => {},
    legendFocusRequest: null,
    clearLegendFocusRequest: () => {},
    userVisualizationChoices: {},
    setUserVisualizationChoice: () => {},
  });

/**
 * Tracks which OverlayDataTable, if any, is "activated" for each layer, and
 * the user's raw display settings choices for it. MapManagerContextProvider
 * watches this context, reconciles choices with admin constraints
 * (resolveDataTableVisualizationSettings), and pushes the result into
 * MapContextManager to drive query execution and thematic map rendering.
 * Kept as a small standalone context (rather than folded into
 * MapContextManager's state machine) so it can be shared identically by the
 * Legend and the overlay Table of Contents.
 */
export function ActivatedDataTableContextProvider({
  children,
}: {
  children?: ReactNode;
}) {
  const [activeTableIds, setActiveTableIds] = useState<{
    [tocStableId: string]: number | undefined;
  }>({});
  const [userVisualizationChoices, setUserVisualizationChoicesState] =
    useState<{
      [tocStableId: string]: DataTableUserVisualizationChoice | undefined;
    }>({});
  const [legendFocusRequest, setLegendFocusRequest] =
    useState<LegendFocusRequest | null>(null);

  const clearLegendFocusRequest = useCallback(() => {
    setLegendFocusRequest(null);
  }, []);

  const setActiveTable = useCallback(
    (tocStableId: string, tableId: number | null) => {
      if (tableId !== null) {
        setLegendFocusRequest({
          layerId: tocStableId,
          requestId: Date.now(),
        });
      }
      setActiveTableIds((prev) => {
        if (tableId === null) {
          if (!(tocStableId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[tocStableId];
          return next;
        }
        if (prev[tocStableId] === tableId) {
          return prev;
        }
        return { ...prev, [tocStableId]: tableId };
      });
      // Changing (or clearing) the active table invalidates any previously
      // chosen display settings for this layer.
      setUserVisualizationChoicesState((prev) => {
        if (!(tocStableId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[tocStableId];
        return next;
      });
    },
    []
  );

  const setUserVisualizationChoice = useCallback(
    (tocStableId: string, choice: DataTableUserVisualizationChoice | null) => {
      setUserVisualizationChoicesState((prev) => {
        if (choice === null) {
          if (!(tocStableId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[tocStableId];
          return next;
        }
        return { ...prev, [tocStableId]: choice };
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      activeTableIds,
      setActiveTable,
      legendFocusRequest,
      clearLegendFocusRequest,
      userVisualizationChoices,
      setUserVisualizationChoice,
    }),
    [
      activeTableIds,
      setActiveTable,
      legendFocusRequest,
      clearLegendFocusRequest,
      userVisualizationChoices,
      setUserVisualizationChoice,
    ]
  );

  return (
    <ActivatedDataTableContext.Provider value={value}>
      {children}
    </ActivatedDataTableContext.Provider>
  );
}
