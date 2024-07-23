import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from "react";

export const LayerEditingContext = createContext<{
  openEditor?: { id: number; isFolder: boolean; title: string };
  isFolder?: boolean;
  setOpenEditor: (
    item: { id: number; isFolder: boolean; title: string } | undefined
  ) => void;
  openMetadataEditor?: number;
  setOpenMetadataEditor: (id: number | undefined) => void;
  /**
   * These are an optimization to immediately remove items from the legend or
   * table of contents after deletion, without waiting to refetch the entire
   * table of contents.
   */
  recentlyDeletedStableIds: string[];
  setRecentlyDeletedStableIds: Dispatch<SetStateAction<string[]>>;
  createFolderModal: { open: boolean; parentStableId?: string };
  setCreateFolderModal: (opts: {
    open: boolean;
    parentStableId?: string;
  }) => void;
}>({
  setOpenEditor: (
    item: { id: number; isFolder: boolean; title: string } | undefined
  ) => {},
  setOpenMetadataEditor: (id: number | undefined) => {},
  recentlyDeletedStableIds: [],
  // set state action
  setRecentlyDeletedStableIds: () => {},
  createFolderModal: { open: false },
  setCreateFolderModal: (opts) => {},
});

export const LayerEditingContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [openEditor, setOpenEditor] = useState<
    { id: number; isFolder: boolean; title: string } | undefined
  >(undefined);
  const [openMetadataEditor, setOpenMetadataEditor] = useState<
    number | undefined
  >(undefined);
  const [recentlyDeletedItems, setRecentlyDeletedItems] = useState<string[]>(
    []
  );
  const [createFolderModal, setCreateFolderModal] = useState({ open: false });

  return (
    <LayerEditingContext.Provider
      value={{
        openEditor,
        setOpenEditor,
        openMetadataEditor,
        recentlyDeletedStableIds: recentlyDeletedItems,
        setRecentlyDeletedStableIds: setRecentlyDeletedItems,
        setOpenMetadataEditor: setOpenMetadataEditor,
        createFolderModal,
        setCreateFolderModal,
      }}
    >
      {children}
    </LayerEditingContext.Provider>
  );
};
