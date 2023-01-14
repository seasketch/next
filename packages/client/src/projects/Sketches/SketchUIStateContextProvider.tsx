import { gql, InMemoryCache, useApolloClient } from "@apollo/client";
import { Feature } from "geojson";
import { MapMouseEvent, Popup } from "mapbox-gl";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { treeItemId } from ".";
import { DropdownDividerProps } from "../../components/ContextMenuDropdown";
import { DropdownOption } from "../../components/DropdownButton";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import {
  BASE_SERVER_ENDPOINT,
  LayerState,
  MapContext,
} from "../../dataLayers/MapContextManager";
import { download } from "../../download";
import {
  GetSketchForEditingDocument,
  GetSketchForEditingQuery,
  SketchEditorModalDetailsFragment,
  SketchingDetailsFragment,
  SketchingDetailsFragmentDoc,
  SketchingDocument,
  SketchingQuery,
  SketchTocDetailsFragment,
  useCopyTocItemMutation,
  useCreateSketchFolderMutation,
  useDeleteSketchFolderMutation,
  useDeleteSketchMutation,
  useProjectMetadataQuery,
  useRenameFolderMutation,
  ProjectSketchesFragment,
  ProjectSketchesFragmentDoc,
  SketchChildType,
} from "../../generated/graphql";
import { SketchFolderDetailsFragment } from "../../generated/queries";
import getSlug from "../../getSlug";
import useAccessToken from "../../useAccessToken";
import useLocalStorage from "../../useLocalStorage";
import { currentSidebarState } from "../ProjectAppSidebar";
import SketchEditorModal from "./SketchEditorModal";
import SketchReportWindow, { ReportWindowUIState } from "./SketchReportWindow";

type ReportState = {
  sketchId: number;
  uiState: ReportWindowUIState;
  sketchClassId: number;
};

/**
 * Manages selection, expansion, and visibility state of sketches (including folders),
 * and exposes methods to update this state. Also provides a list of context menu
 * actions that apply to the current selection.
 */
interface SketchUIStateContextValue {
  // Sketch Selection
  selectedIds: string[];
  clearSelection: () => void;
  onSelect: (
    metaKey: boolean,
    item: { id: string },
    isSelected: boolean
  ) => void;
  focusOnTableOfContentsItem: (
    type: "Sketch" | "SketchFolder",
    id: number,
    setVisible?: boolean
  ) => void;
  selectionType?: {
    /* collection geometryType */
    collection: boolean;
    /* SketchFolder selected */
    folder: boolean;
    /** only sketches with geometryType != collection */
    sketch: boolean;
  };
  selectionBBox?: number[];
  // Tree Node Expansion State
  expandedIds: string[];
  onExpand: (item: { id: string }, isExpanded: boolean) => void;
  expandItem: (item: { id: string }) => void;
  collapseItem: (item: { id: string }) => void;
  // Sketch Visibility
  visibleSketches: string[];
  onChecked: (items: string[], isChecked: boolean) => void;
  showSketches: (ids: string[]) => void;
  hideSketches: (ids: string[]) => void;
  // Event handler stuff
  setToolbarRef: (ref: HTMLDivElement | null) => void;
  /**
   * When displaying sketches on the map, data is pulled from cache both to
   * control rendering and to ensure the item actually exists and should be
   * displayed. If the Apollo cache is modified in any way this method should
   * be called. Do this by setting a useEffect on the output of queries
   * containing sketches, or by writing to apollo cache directly and then
   * calling the function (as in the case of sketches embedded in forum posts).
   */
  updateFromCache: () => void;
  openReports: ReportState[];
  setOpenReports: Dispatch<SetStateAction<ReportState[]>>;
  editSketch: (id: number) => void;
  editorIsOpen: boolean;
  menuOptions?: {
    contextMenu: (DropdownOption | DropdownDividerProps)[];
    viewReports?: DropdownOption;
    create: DropdownOption[];
    read: DropdownOption[];
    update: DropdownOption[];
  };
}

const NotImplemented = () => {
  throw new Error("Not implemented");
};

const defaultValue: SketchUIStateContextValue = {
  selectedIds: [],
  clearSelection: NotImplemented,
  onSelect: NotImplemented,
  focusOnTableOfContentsItem: NotImplemented,
  visibleSketches: [],
  showSketches: NotImplemented,
  hideSketches: NotImplemented,
  onChecked: NotImplemented,
  expandedIds: [],
  onExpand: NotImplemented,
  collapseItem: NotImplemented,
  expandItem: NotImplemented,
  setToolbarRef: NotImplemented,
  updateFromCache: NotImplemented,
  openReports: [],
  setOpenReports: NotImplemented,
  editSketch: NotImplemented,
  editorIsOpen: false,
};

export const SketchUIStateContext =
  createContext<SketchUIStateContextValue>(defaultValue);

export default function SketchUIStateContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation("sketching");
  const mapContext = useContext(MapContext);
  const client = useApolloClient();
  const slug = getSlug();
  const projectMetadata = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });

  const [cacheState, setCacheState] = useState<number>(0);
  const [openReports, setOpenReports] = useState<ReportState[]>([]);
  const updateFromCache = useCallback(() => {
    setCacheState((prev) => prev + 1);
  }, [setCacheState]);

  // # Table of Contents Item Expansion State
  // TODO: garbage collect
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>(
    `expanded-sketches-${slug}`,
    []
  );
  const { expandItem, collapseItem, onExpand } = useMemo(() => {
    const expandItem = (item: { id: string }) => {
      setExpandedIds((prev) => [
        ...prev.filter((id) => id !== item.id),
        item.id,
      ]);
    };
    const collapseItem = (item: { id: string }) => {
      setExpandedIds((prev) => [...prev.filter((id) => id !== item.id)]);
    };

    const onExpand = (item: { id: string }, isExpanded: boolean) => {
      if (!isExpanded) {
        collapseItem(item);
      } else {
        expandItem(item);
      }
    };

    return {
      expandItem,
      collapseItem,
      onExpand,
    };
  }, [setExpandedIds]);

  // # Sketch Visibility
  const [visibleSketches, setVisibleSketches] = useLocalStorage<string[]>(
    `sketch-visibility-${getSlug()}`,
    mapContext?.sketchLayerStates
      ? layerStatesToIds(mapContext.sketchLayerStates)
      : []
  );

  const onChecked = useCallback(
    (items: string[], isChecked: boolean) => {
      setVisibleSketches((prev) => [
        ...prev.filter((id) => items.indexOf(id) === -1),
        ...(isChecked ? items : []),
      ]);
    },
    [setVisibleSketches]
  );

  const { showSketches, hideSketches } = useMemo(() => {
    return {
      showSketches: (ids: string[]) =>
        setVisibleSketches((prev) => [
          ...prev.filter((id) => ids.indexOf(id) === -1),
          ...ids,
        ]),
      hideSketches: (ids: string[]) =>
        setVisibleSketches((prev) => [
          ...prev.filter((id) => ids.indexOf(id) === -1),
        ]),
    };
  }, [setVisibleSketches]);

  useEffect(() => {
    if (mapContext.manager) {
      const sketches: { id: number; timestamp?: string }[] = [];
      // @ts-ignore
      window.client = client;
      for (const stringId of visibleSketches) {
        if (/Sketch:/.test(stringId)) {
          // @ts-ignore private api
          const isCached = client.cache.data.get(stringId, "id");
          if (isCached) {
            // @ts-ignore private api
            const timestamp = client.cache.data.get(stringId, "timestamp");
            sketches.push({
              id: parseInt(stringId.split(":")[1]),
              timestamp: timestamp,
            });
          }
        }
      }
      mapContext.manager.setVisibleSketches(sketches);
    }
  }, [visibleSketches, mapContext.manager, cacheState, client]);

  // # Sketch and SketchFolder Selection
  // TODO: garbage collect missing ids
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [toolbarRef, setToolbarRef] = useState<HTMLDivElement | null>(null);

  /**
   * Adds a global (document.body) click handler to clear sketch selection
   * state. Uses refs to avoid clearing state when clicking on the toolbar
   */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON") {
        return;
      }
      if (
        toolbarRef &&
        toolbarRef.contains(target) &&
        !target.classList.contains("toolbarParentContainer")
      ) {
        return;
      }
      if (selectedIds.length) {
        setSelectedIds([]);
      }
      return true;
    };
    document.body.addEventListener("click", handler);
    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, [toolbarRef, selectedIds.length, setSelectedIds]);

  const [selectionBBox, setBBOX] = useState<number[] | undefined>();

  const [selectionType, setSelectionType] = useState<
    { collection: boolean; folder: boolean; sketch: boolean } | undefined
  >();

  const onError = useGlobalErrorHandler();

  const { onSelect, clearSelection } = useMemo(() => {
    const clearSelection = () => {
      setSelectedIds([]);
      document.querySelectorAll(".mapboxgl-popup").forEach((el) => el.remove());
    };
    // TODO: multi-select support
    const onSelect: (
      metaKey: boolean,
      item: { id: string },
      isSelected: boolean
    ) => void = (metaKey, item, isSelected) => {
      document.querySelectorAll(".mapboxgl-popup").forEach((el) => el.remove());
      if (isSelected) {
        setSelectedIds([item.id]);
        // @ts-ignore Using a private api here
        const bbox = client.cache.data.get(item.id, "bbox");
        const isCollection = Boolean(
          // @ts-ignore Using a private api here
          client.cache.data.get(item.id, "isCollection")
        );
        const typeName = item.id.split(":")[0];
        setSelectionType({
          collection: isCollection,
          folder: typeName === "SketchFolder",
          sketch: typeName === "Sketch",
        });
        if (bbox) {
          setBBOX(bbox);
        } else {
          setBBOX(undefined);
        }
      } else {
        setSelectedIds([]);
        setSelectionType(undefined);
        setBBOX(undefined);
      }
    };
    return {
      clearSelection,
      onSelect,
    };
  }, [client, setSelectedIds, setSelectionType, setBBOX]);

  const history = useHistory();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<
    | false
    | {
        sketch?: SketchEditorModalDetailsFragment;
        sketchClass: SketchingDetailsFragment;
        folderId?: number;
        collectionId?: number;
        loading?: boolean;
        loadingTitle?: string;
      }
  >(false);

  const clearOpenSketchReports = useCallback(() => {
    setOpenReports([]);
  }, [setOpenReports]);

  const openSketchReport = useCallback(
    (sketchId: number, uiState?: "left" | "right" | "docked") => {
      const sketch: SketchTocDetailsFragment =
        // @ts-ignore
        client.cache.data.data[`Sketch:${sketchId}`];
      if (sketch) {
        setOpenReports([
          { sketchId, uiState: "right", sketchClassId: sketch?.sketchClassId },
        ]);
      }
    },
    [client.cache]
  );

  const editSketch = useCallback(
    async (id: number) => {
      const sketch: SketchTocDetailsFragment =
        // @ts-ignore
        client.cache.data.data[`Sketch:${id}`];
      if (sketch) {
        const sketchClass = client.cache.readFragment<SketchingDetailsFragment>(
          {
            // eslint-disable-next-line i18next/no-literal-string
            id: `SketchClass:${sketch.sketchClassId}`,
            fragment: SketchingDetailsFragmentDoc,
            fragmentName: "SketchingDetails",
          }
        );
        if (sketchClass) {
          setOpenReports([]);
          history.replace(`/${getSlug()}/app`);
          setEditorOpen(true);
          setEditor({
            loadingTitle: sketch.name,
            loading: true,
            sketchClass,
          });
          try {
            const response = await client.query<GetSketchForEditingQuery>({
              query: GetSketchForEditingDocument,
              variables: {
                id,
              },
              fetchPolicy: "cache-first",
            });
            // then set editor state again with sketch, loading=false
            if (response.data.sketch) {
              setEditor((prev) => {
                if (prev) {
                  return {
                    ...prev,
                    sketch: response.data.sketch!,
                    loading: false,
                    loadingTitle: undefined,
                  };
                } else {
                  return false;
                }
              });
            } else {
              if (response.error) {
                throw new Error(response.error.message);
              } else {
                throw new Error(
                  "Unknown query error when retrieving sketch data"
                );
              }
            }
          } catch (e) {
            onError(e);
            setEditor(false);
          }
        }
      }
    },
    [client, history, onError]
  );

  /**
   * Selects an item in the table of contents, and expands it's parent if
   * necessary. Appropriate to call after a drag & drop action, or
   * creation/editing.
   */
  const focusOnTableOfContentsItem = useCallback(
    (type: "Sketch" | "SketchFolder", id: number, setVisible?: boolean) => {
      const normalizedIds = getParentIdsRecursive(
        type,
        id,
        client.cache as InMemoryCache
      );
      if (normalizedIds.length) {
        for (const id of normalizedIds) {
          expandItem({ id });
        }
      }
      setSelectedIds([treeItemId(id, type)]);
      // eslint-disable-next-line i18next/no-literal-string
      const item = document.querySelector(`[data-node-id="${type}:${id}"]`);
      if (item) {
        item.scrollIntoView({
          behavior: "auto",
          block: "nearest",
        });
      }
      if (type === "Sketch" && setVisible) {
        setVisibleSketches((prev) => [
          ...prev.filter((sk) => sk !== treeItemId(id, "Sketch")),
          treeItemId(id, "Sketch"),
        ]);
      }
    },
    [expandItem, setVisibleSketches, client.cache]
  );

  useEffect(() => {
    const interactivityManager = mapContext.manager?.interactivityManager;
    const map = mapContext.manager?.map;
    if (interactivityManager && map) {
      const handler = (feature: Feature<any>, e: MapMouseEvent) => {
        if (feature.id) {
          const id = parseInt(feature.id.toString());
          setTimeout(() => {
            const props = feature.properties!;
            focusOnTableOfContentsItem("Sketch", id);
            const name = feature.properties?.name;
            const itMe =
              projectMetadata.data?.me?.id &&
              projectMetadata.data?.me.id ===
                parseInt(feature.properties!.userId);
            const wasUpdated =
              props.updatedAt &&
              new Date(props.updatedAt) > new Date(props.createdAt);
            const dateString = new Date(
              wasUpdated ? props.updatedAt : props.createdAt
            ).toLocaleDateString();
            const popup = new Popup({
              closeOnClick: true,
              closeButton: true,
              className: "SketchPopup",
              maxWidth: "18rem",
            })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .setHTML(
                `
                <div class="w-72">
                  <div class="p-2">
                    <h2 class="truncate text-sm font-semibold">${name}</h2>
                    <p class="">
                      <span>
                      ${
                        itMe
                          ? t("You")
                          : feature.properties!.userSlug ||
                            feature.properties!.user_slug
                      }
                      </span> 
                      ${
                        feature.properties!.sharedInForum
                          ? t("shared this sketch on")
                          : wasUpdated
                          ? t("last updated this sketch on")
                          : t("created this sketch on")
                      } ${dateString}
                    </p>
                  </div>
                  <div class="py-2 space-x-1 bg-gray-50 p-2 border-t">
                    ${
                      feature.properties!.sharedInForum === true
                        ? ""
                        : `<button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-edit-sketch" class="underline">edit</button>`
                    }
                    <button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-view-sketch" class="underline">view reports</button>
                  </div>
                </div>
              `
              )
              .addTo(map);
            const el = popup.getElement();
            const edit = el.querySelector("button[id=popup-edit-sketch]");
            if (edit) {
              edit.addEventListener("click", () => {
                popup.remove();
                editSketch(id);
              });
            }
            const view = el.querySelector("button[id=popup-view-sketch]");
            if (view) {
              view.addEventListener("click", () => {
                setOpenReports((prev) => [
                  ...prev.filter((r) => r.sketchId !== id),
                  {
                    sketchId: id,
                    uiState: "right",
                    sketchClassId: parseInt(feature.properties!.sketchClassId),
                  },
                ]);
              });
            }

            setSelectedIds([treeItemId(id, "Sketch")]);
          }, 1);
        }
      };
      interactivityManager.on("click:sketch", handler);
      return () => {
        interactivityManager.off("click:sketch", handler);
      };
    }
  }, [
    editSketch,
    focusOnTableOfContentsItem,
    mapContext.manager?.interactivityManager,
    mapContext.manager?.map,
    setSelectedIds,
    t,
    projectMetadata.data?.me?.id,
    setOpenReports,
  ]);

  useEffect(() => {
    if (mapContext?.manager) {
      const sketches: SketchTocDetailsFragment[] = [];
      const folders: SketchFolderDetailsFragment[] = [];
      // @ts-ignore private api
      for (const key in client.cache.data.data) {
        if (/Sketch:/.test(key)) {
          // @ts-ignore
          sketches.push(client.cache.data.data[key]);
        } else if (/SketchFolder:/.test(key)) {
          // @ts-ignore
          folders.push(client.cache.data.data[key]);
        }
      }
      // get child sketches
      const children = [];
      for (const id of selectedIds) {
        if (/SketchFolder:/.test(id)) {
          const childNodes = getChildrenOfSketchOrSketchFolder(
            {
              __typename: "SketchFolder",
              id: parseInt(id.split(":")[1]),
            },
            sketches || [],
            folders || []
          );
          children.push(...childNodes.sketches);
        } else if (/Sketch:/.test(id)) {
          const childNodes = getChildrenOfSketchOrSketchFolder(
            {
              __typename: "Sketch",
              id: parseInt(id.split(":")[1]),
            },
            sketches || [],
            folders || []
          );
          children.push(...childNodes.sketches);
        }
      }

      mapContext.manager.setSelectedSketches([
        ...selectedIds
          .filter((s) => /Sketch:/.test(s))
          .map((s) => parseInt(s.split(":")[1])),
        ...children,
      ]);
    }
  }, [selectedIds, mapContext.manager, client]);
  // mySketches, myFolders]);

  const onRequestReportClose = useCallback(
    (id: number) => {
      setOpenReports((prev) => [...prev.filter((r) => r.sketchId !== id)]);
    },
    [setOpenReports]
  );

  const onReportClick = useCallback(
    (metaKey: boolean, id: number) => {
      // eslint-disable-next-line i18next/no-literal-string
      setSelectedIds([`Sketch:${id}`]);
    },
    [setSelectedIds]
  );

  const [renameFolder] = useRenameFolderMutation({
    onError,
  });

  const { prompt, confirmDelete } = useDialog();
  const [createFolder] = useCreateSketchFolderMutation({
    onError,
  });
  const [deleteSketch] = useDeleteSketchMutation({
    onError,
    update: async (cache, { data }) => {
      if (data?.deleteSketch?.sketch?.id) {
        const sketch = data.deleteSketch.sketch;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.mySketches) {
          // Will need to find all child items, including both folder and sketches,
          // and remove them from the list
          const deletedIds = getChildrenOfSketchOrSketchFolder(
            sketch,
            results.projectBySlug.myFolders || [],
            results.projectBySlug.mySketches || []
          );

          // eslint-disable-next-line i18next/no-literal-string
          hideSketches(deletedIds.sketches.map((id) => `Sketch:${id}`));

          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                myFolders: [
                  ...(results.projectBySlug.myFolders || []).filter(
                    (f) => deletedIds.folders.indexOf(f.id) === -1
                  ),
                ],
                mySketches: [
                  ...(results.projectBySlug.mySketches || []).filter(
                    (s) =>
                      deletedIds.sketches.indexOf(s.id) === -1 &&
                      s.id !== sketch.id
                  ),
                ],
              },
            },
          });
        }
      }
    },
  });
  const [deleteSketchFolder] = useDeleteSketchFolderMutation({
    onError,
    update: async (cache, { data }) => {
      if (data?.deleteSketchFolder?.sketchFolder) {
        const folder = data.deleteSketchFolder.sketchFolder;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.myFolders) {
          // Will need to find all child items, including both folder and sketches,
          // and remove them from the list
          const deletedIds = getChildrenOfSketchOrSketchFolder(
            folder,
            results.projectBySlug.myFolders || [],
            results.projectBySlug.mySketches || []
          );

          // eslint-disable-next-line i18next/no-literal-string
          hideSketches(deletedIds.sketches.map((id) => `Sketch:${id}`));

          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                myFolders: [
                  ...results.projectBySlug.myFolders.filter(
                    (f) =>
                      deletedIds.folders.indexOf(f.id) === -1 &&
                      f.id !== folder.id
                  ),
                ],
                mySketches: [
                  ...(results.projectBySlug.mySketches || []).filter(
                    (s) => deletedIds.sketches.indexOf(s.id) === -1
                  ),
                ],
              },
            },
          });
        }
      }
    },
  });

  const [copy] = useCopyTocItemMutation({
    onError,
    update: async (cache, response) => {
      const sketches = response.data?.copySketchTocItem?.sketches || [];
      const folders = response.data?.copySketchTocItem?.folders || [];
      const results = cache.readQuery<SketchingQuery>({
        query: SketchingDocument,
        variables: {
          slug: getSlug(),
        },
      });
      if (
        results?.projectBySlug?.mySketches &&
        results?.projectBySlug?.myFolders
      ) {
        await cache.writeQuery({
          query: SketchingDocument,
          variables: { slug: getSlug() },
          data: {
            ...results,
            projectBySlug: {
              ...results.projectBySlug,
              mySketches: [...results.projectBySlug.mySketches, ...sketches],
              myFolders: [...results.projectBySlug.myFolders, ...folders],
            },
          },
        });
      }
    },
  });

  const token = useAccessToken();
  const menuOptions = useMemo(() => {
    const multiple = selectedIds.length > 1;
    let selectionIsSharedContent = false;
    if (selectedIds.length === 1) {
      selectionIsSharedContent = Boolean(
        // @ts-ignore private api
        client.cache.data.get(selectedIds[0], "sharedInForum")
      );
    }
    function isValidChild(parentId: number, child: SketchingDetailsFragment) {
      return true;
      // const parent = sketchClasses?.find((sc) => sc.id === parentId);
      // if (parent) {
      //   return Boolean(
      //     parent.validChildren?.find((validChild) => validChild.id === child.id)
      //   );
      // } else {
      //   return false;
      // }
    }
    function getSelectedSketchClasses() {
      const sketchClasses: SketchingDetailsFragment[] = [];
      for (const id of selectedIds) {
        if (/Sketch:/.test(id)) {
          // @ts-ignore private api
          const sketchClassId = client.cache.data.get(id, "sketchClassId");
          if (
            sketchClassId &&
            !sketchClasses.find((sc) => sc.id === sketchClassId)
          ) {
            const sketchClass =
              client.cache.readFragment<SketchingDetailsFragment>({
                id: sketchClassId,
                fragment: SketchingDetailsFragmentDoc,
                fragmentName: "SketchingDetails",
              });
            if (sketchClass) {
              sketchClasses.push(sketchClass);
            }
          }
        }
      }
      return sketchClasses;
    }

    const selectedId = selectedIds.length
      ? parseInt(selectedIds[0].split(":")[1])
      : undefined;
    const contextMenu: (DropdownOption | DropdownDividerProps)[] = [];
    let sketchClasses: SketchingDetailsFragment[] = [];
    if (projectMetadata.data?.project?.id) {
      const data = client.cache.readFragment<ProjectSketchesFragment>({
        // eslint-disable-next-line i18next/no-literal-string
        id: `Project:${projectMetadata.data?.project.id}`,
        fragment: ProjectSketchesFragmentDoc,
        fragmentName: "ProjectSketches",
      });
      if (data?.sketchClasses) {
        sketchClasses = data.sketchClasses;
      }
    }

    const create: DropdownOption[] = [
      ...(!selectionIsSharedContent && (!selectionType || !selectionType.sketch)
        ? sketchClasses || []
        : []
      )
        .filter((sc) => !sc.formElementId && !sc.isArchived && sc.canDigitize)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((sc) => ({
          // eslint-disable-next-line i18next/no-literal-string
          id: `create-${sc.id}`,
          label: sc.name,
          onClick: async () => {
            history.replace(`/${getSlug()}/app`);
            setEditor({
              sketchClass: sc,
              folderId:
                selectedIds.length === 1 && /SketchFolder:/.test(selectedIds[0])
                  ? selectedId
                  : undefined,
              collectionId:
                selectedIds.length === 1 && selectionType?.collection
                  ? selectedId
                  : undefined,
            });
          },
        })),
      ...(!selectionIsSharedContent && (!selectionType || !selectionType.sketch)
        ? [
            {
              // eslint-disable-next-line i18next/no-literal-string
              id: `create-folder`,
              label: t("Folder"),
              onClick: async () => {
                prompt({
                  message: t(`What would you like to name your folder?`),
                  onSubmit: async (name) => {
                    if (!name.length) {
                      return;
                    }
                    await createFolder({
                      variables: {
                        name,
                        slug: getSlug(),
                        ...(selectionType?.folder
                          ? { folderId: selectedId }
                          : {}),
                      },
                      update: async (cache, { data }) => {
                        if (data?.createSketchFolder?.sketchFolder) {
                          const folder = data.createSketchFolder.sketchFolder;
                          const results = cache.readQuery<SketchingQuery>({
                            query: SketchingDocument,
                            variables: {
                              slug: getSlug(),
                            },
                          });
                          if (results?.projectBySlug?.myFolders) {
                            await cache.writeQuery({
                              query: SketchingDocument,
                              variables: { slug: getSlug() },
                              data: {
                                ...results,
                                projectBySlug: {
                                  ...results.projectBySlug,
                                  myFolders: [
                                    ...results.projectBySlug.myFolders,
                                    folder,
                                  ],
                                },
                              },
                            });
                            focusOnTableOfContentsItem(
                              "SketchFolder",
                              folder.id
                            );
                          }
                        }
                      },
                    });
                  },
                });
              },
            },
          ]
        : []),
    ];
    const update: DropdownOption[] = [];
    const read: DropdownOption[] = [];
    const viewReports: DropdownOption | undefined =
      selectionType?.folder && selectedId
        ? undefined
        : {
            id: "view-reports",
            label: t("View Reports"),
            keycode: "v",
            onClick: () => {
              openSketchReport(selectedId!);
            },
          };
    if (viewReports) {
      contextMenu.push(viewReports);
    }
    if (selectionBBox) {
      read.push({
        label: t("Zoom to"),
        id: "bbox-zoom",
        onClick: () => {
          const sidebar = currentSidebarState();
          if (visibleSketches.indexOf(selectedIds[0]) === -1) {
            onChecked(selectedIds, true);
          }
          if (mapContext.manager?.map) {
            mapContext.manager.map.fitBounds(
              selectionBBox as mapboxgl.LngLatBoundsLike,
              {
                animate: true,
                padding: {
                  bottom: 100,
                  top: 100,
                  left: sidebar.open ? sidebar.width + 100 : 100,
                  right: 100,
                },
              }
            );
          }
        },
      });
    }

    if (selectedId && selectionType && !selectionIsSharedContent) {
      update.push({
        label: selectionType.folder ? t("Rename Folder") : t("Edit"),
        id: "edit",
        keycode: "e",
        onClick: async () => {
          if (selectionType.folder) {
            const folder = client.cache.readFragment<{
              id: number;
              name: string;
            }>({
              // eslint-disable-next-line i18next/no-literal-string
              id: `SketchFolder:${selectedId}`,
              // eslint-disable-next-line i18next/no-literal-string
              fragment: gql`
                fragment data on SketchFolder {
                  id
                  name
                }
              `,
            });
            if (folder) {
              await prompt({
                message: t(`Rename "${folder.name}"`),
                defaultValue: folder.name,
                onSubmit: async (name) => {
                  if (name.length) {
                    await renameFolder({
                      variables: {
                        id: folder.id,
                        name,
                      },
                    });
                  }
                },
              });
            } else {
              throw new Error("Folder not found in cache");
            }
          } else {
            editSketch(selectedId);
          }
        },
      });
      update.push({
        id: "delete",
        label: t("Delete"),
        keycode: "Backspace",
        onClick: async () => {
          // TODO: implement multiple-delete
          // TODO: warn of child deletes
          if (multiple) {
            throw new Error("Multiple delete not implemented");
          }
          // @ts-ignore private api
          const name: string = client.cache.data.get(selectedIds[0], "name");
          confirmDelete({
            message: t(`Are you sure you want to delete "${name}"?`),
            onDelete: async () => {
              clearSelection();
              if (selectionType.folder) {
                collapseItem({ id: selectedIds[0] });
              }
              await (selectionType.sketch ? deleteSketch : deleteSketchFolder)({
                variables: {
                  id: selectedId,
                },
              });
            },
          });
        },
      });
      update.push({
        id: "copy",
        label: t("Copy"),
        onClick: async () => {
          const type = selectionType.sketch
            ? SketchChildType.Sketch
            : SketchChildType.SketchFolder;
          const response = await copy({
            variables: {
              id: selectedId,
              type,
            },
          });
          const parentId = response.data?.copySketchTocItem?.parentId;
          const sketches = response.data?.copySketchTocItem?.sketches || [];
          if (parentId) {
            clearSelection();
            setTimeout(() => {
              focusOnTableOfContentsItem(
                type === SketchChildType.Sketch ? "Sketch" : "SketchFolder",
                parentId
              );
              showSketches(sketches.map((s) => treeItemId(s.id, "Sketch")));
            }, 100);
          }
        },
      });
    }

    if (selectedId && !selectionType?.folder) {
      read.push({
        id: "export",
        label: t("Export as GeoJSON"),
        disabled: multiple,
        onClick: async () => {
          // TODO: support multiple
          download(
            // eslint-disable-next-line i18next/no-literal-string
            `${BASE_SERVER_ENDPOINT}/sketches/${
              selectedIds[0].split(":")[1]
            }.geojson.json?token=${token}`,
            // eslint-disable-next-line i18next/no-literal-string
            `${selectedIds[0].replace(":", "-")}.geojson.json`
          );
        },
      });
    }

    contextMenu.push(...update);
    contextMenu.push(...read);
    if (create.length) {
      contextMenu.push({
        label: t("Create"),
      } as DropdownDividerProps);
      contextMenu.push(...create);
    }

    return {
      contextMenu,
      create,
      update,
      read,
      viewReports,
    };
  }, [
    selectedIds,
    projectMetadata.data?.project?.id,
    selectionType,
    t,
    selectionBBox,
    client.cache,
    history,
    prompt,
    createFolder,
    focusOnTableOfContentsItem,
    openSketchReport,
    visibleSketches,
    mapContext.manager?.map,
    onChecked,
    renameFolder,
    editSketch,
    confirmDelete,
    clearSelection,
    deleteSketch,
    deleteSketchFolder,
    collapseItem,
    copy,
    showSketches,
    token,
  ]);

  return (
    <SketchUIStateContext.Provider
      value={{
        ...defaultValue,
        expandedIds,
        expandItem,
        onExpand,
        collapseItem,
        clearSelection,
        setToolbarRef,
        selectedIds,
        onSelect,
        focusOnTableOfContentsItem,
        selectionBBox,
        selectionType,
        onChecked,
        visibleSketches,
        updateFromCache,
        openReports,
        setOpenReports,
        editorIsOpen: editorOpen,
        editSketch,
        menuOptions,
        showSketches,
        hideSketches,
      }}
    >
      {children}
      {openReports.map(({ sketchId, uiState, sketchClassId }) => (
        <SketchReportWindow
          key={sketchId}
          sketchId={sketchId}
          sketchClassId={sketchClassId}
          onRequestClose={onRequestReportClose}
          uiState={uiState}
          selected={selectedIds.indexOf(`Sketch:${sketchId}`) !== -1}
          reportingAccessToken={
            projectMetadata?.data?.project?.sketchGeometryToken
          }
          onClick={onReportClick}
        />
      ))}
      {editor !== false && (
        <SketchEditorModal
          sketchClass={editor?.sketchClass}
          sketch={editor?.sketch}
          loading={editor?.loading}
          loadingTitle={editor?.loading ? editor.loadingTitle : undefined}
          folderId={editor?.folderId}
          collectionId={editor?.collectionId}
          onComplete={(item) => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
            focusOnTableOfContentsItem("Sketch", item.id, true);
          }}
          onCancel={() => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
          }}
        />
      )}
    </SketchUIStateContext.Provider>
  );
}

/**
 *
 * @param foo
 * @returns
 */
export const useSketchUIState = () => {
  const context = useContext(SketchUIStateContext);
  return context;
};

function layerStatesToIds(layerStates: { [id: number]: LayerState }) {
  const visible: string[] = [];
  for (const id in layerStates) {
    const layerState = layerStates[id];
    if (layerState.visible) {
      // eslint-disable-next-line i18next/no-literal-string
      visible.push(`Sketch:${id}`);
    }
  }
  return visible;
}

function getParentIdsRecursive(
  type: "Sketch" | "SketchFolder",
  id: number,
  cache: InMemoryCache
) {
  let ids: string[] = [`${type}:${id}`];
  const stringId = `${type}:${id}`;
  // @ts-ignore
  const folderId = cache.data.get(stringId, "folderId");
  // @ts-ignore
  const collectionId = cache.data.get(stringId, "folderId");
  if (folderId) {
    ids.push(...getParentIdsRecursive("SketchFolder", folderId, cache));
  } else if (collectionId) {
    ids.push(...getParentIdsRecursive("Sketch", collectionId, cache));
  }
  return ids;
}

export function getChildrenOfSketchOrSketchFolder(
  parent: { __typename?: "Sketch" | "SketchFolder"; id: number },
  folders: {
    __typename?: "Sketch" | "SketchFolder";
    id: number;
    collectionId?: number | null;
    folderId?: number | null;
  }[],
  sketches: {
    __typename?: "Sketch" | "SketchFolder";
    id: number;
    collectionId?: number | null;
    folderId?: number | null;
  }[],
  children = { sketches: [] as number[], folders: [] as number[] }
) {
  let isSketch = false;
  if (parent.__typename === "Sketch") {
    isSketch = true;
    children.sketches.push(parent.id);
  } else {
    children.folders.push(parent.id);
  }
  for (const folder of folders) {
    if ((isSketch ? folder.collectionId : folder.folderId) === parent.id) {
      getChildrenOfSketchOrSketchFolder(folder, folders, sketches, children);
    }
  }
  for (const sketch of sketches) {
    if ((isSketch ? sketch.collectionId : sketch.folderId) === parent.id) {
      getChildrenOfSketchOrSketchFolder(sketch, folders, sketches, children);
    }
  }
  return children;
}
