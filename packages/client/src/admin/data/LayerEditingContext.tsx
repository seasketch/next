import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from "react";

export const LayerEditingContext = createContext<{
  openEditor?: number;
  setOpenEditor: (id: number | undefined) => void;
  openMetadataEditor?: number;
  setOpenMetadataEditor: (id: number | undefined) => void;
  /**
   * These are an optimization to immediately remove items from the legend or
   * table of contents after deletion, without waiting to refetch the entire
   * table of contents.
   */
  recentlyDeletedStableIds: string[];
  setRecentlyDeletedStableIds: Dispatch<SetStateAction<string[]>>;
}>({
  setOpenEditor: (id: number | undefined) => {},
  setOpenMetadataEditor: (id: number | undefined) => {},
  recentlyDeletedStableIds: [],
  // set state action
  setRecentlyDeletedStableIds: () => {},
});

export const LayerEditingContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [openEditor, setOpenEditor] = useState<number | undefined>(undefined);
  const [openMetadataEditor, setOpenMetadataEditor] = useState<
    number | undefined
  >(undefined);
  const [recentlyDeletedItems, setRecentlyDeletedItems] = useState<string[]>(
    []
  );
  return (
    <LayerEditingContext.Provider
      value={{
        openEditor,
        setOpenEditor,
        openMetadataEditor,
        recentlyDeletedStableIds: recentlyDeletedItems,
        setRecentlyDeletedStableIds: setRecentlyDeletedItems,
        setOpenMetadataEditor: setOpenMetadataEditor,
      }}
    >
      {children}
    </LayerEditingContext.Provider>
  );
};