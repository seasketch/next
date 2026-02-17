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
}>({
  setSelectedTabId: () => {},
  editing: null,
  setEditing: () => {},
  adminMode: false,
  preselectTitle: false,
  showCalcDetails: undefined,
  setShowCalcDetails: () => {},
});
