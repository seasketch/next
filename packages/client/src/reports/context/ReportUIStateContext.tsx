import { createContext } from "react";

export const ReportUIStateContext = createContext<{
  selectedTabId?: number;
  setSelectedTabId: (tabId: number) => void;
  editing: number | null;
  setEditing: (editing: number | null, preselectTitle?: boolean) => void;
  adminMode?: boolean;
  preselectTitle?: boolean;
}>({
  setSelectedTabId: () => {},
  editing: null,
  setEditing: () => {},
  adminMode: false,
  preselectTitle: false,
});
