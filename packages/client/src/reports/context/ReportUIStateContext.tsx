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
  /** Called when a card's ProseMirror editor is ready; use the focus fn for proper keyboard focus */
  onEditorReadyForFocus?: (
    cardId: number,
    focus: () => void
  ) => void;
}>({
  setSelectedTabId: () => {},
  editing: null,
  setEditing: () => {},
  adminMode: false,
  preselectTitle: false,
  showCalcDetails: undefined,
  setShowCalcDetails: () => {},
});
