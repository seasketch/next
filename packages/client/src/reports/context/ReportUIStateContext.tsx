import { createContext } from "react";

export const ReportUIStateContext = createContext<{
  selectedTabId?: number;
  setSelectedTabId: (tabId: number) => void;
  editing: number | null;
  setEditing: (editing: number | null, preselectTitle?: boolean) => void;
  adminMode?: boolean;
  preselectTitle?: boolean;
  showCalcDetails?: number;
  setShowCalcDetails: (cardId: number | undefined) => void;
  requestWidgetSettings: (cardId: number, widgetPosition: number) => void;
  pendingWidgetSettings?: {
    cardId: number;
    widgetPosition: number;
  } | null;
  clearPendingWidgetSettings: () => void;
  /** Called when a card's ProseMirror editor is ready; use the focus fn for proper keyboard focus */
  onEditorReadyForFocus?: (
    cardId: number,
    focus: () => void
  ) => void;
  /** True while the browser print dialog / print preview is active (also set briefly before programmatic print). */
  printing: boolean;
  setPrinting: (value: boolean) => void;
  /** Renders every tab and card into a hidden subtree and opens print via react-to-print (single compiled document). */
  requestFullReportPrint: () => void;
}>({
  setSelectedTabId: () => {},
  editing: null,
  setEditing: () => {},
  adminMode: false,
  preselectTitle: false,
  showCalcDetails: undefined,
  setShowCalcDetails: () => {},
  requestWidgetSettings: () => {},
  pendingWidgetSettings: null,
  clearPendingWidgetSettings: () => {},
  printing: false,
  setPrinting: () => {},
  requestFullReportPrint: () => {},
});
