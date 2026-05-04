import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from "react";

export type LayerEditorTarget = {
  id: number;
  isFolder: boolean;
  title: string;
  /** When true, layer editor scrolls to Comments after opening (consumed once). */
  focusLayerComments?: boolean;
};

export const LayerEditingContext = createContext<{
  openEditor?: LayerEditorTarget;
  isFolder?: boolean;
  setOpenEditor: Dispatch<SetStateAction<LayerEditorTarget | undefined>>;
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
  setOpenEditor: () => {},
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
    LayerEditorTarget | undefined
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
