import {
  ApolloClient,
  gql,
  InMemoryCache,
  useApolloClient,
} from "@apollo/client";
import { Feature } from "geojson";
import { FillLayer, MapMouseEvent, Popup } from "mapbox-gl";
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
import { DropdownDividerProps } from "../../components/ContextMenuDropdown";
import { DropdownOption } from "../../components/DropdownButton";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { treeItemId } from "../../components/TreeView";
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
  useProjectMetadataQuery,
  useRenameFolderMutation,
  SketchChildType,
  PopupShareDetailsFragment,
  useDeleteSketchTocItemsMutation,
  SketchClassDetailsFragment,
  SketchPopupDetailsFragment,
} from "../../generated/graphql";
import { SketchFolderDetailsFragment } from "../../generated/queries";
import getSlug from "../../getSlug";
import useAccessToken from "../../useAccessToken";
import useLocalStorage from "../../useLocalStorage";
import { currentSidebarState } from "../ProjectAppSidebar";
import SketchEditorModal from "./SketchEditorModal";
import SketchReportWindow, { ReportWindowUIState } from "./SketchReportWindow";
import { useTranslatedProps } from "../../components/TranslatedPropControl";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { FormLanguageContext } from "../../formElements/FormElement";
import { createPortal } from "react-dom";
import { LayerTemplate } from "../../formElements/FilterLayerManager";
import { LegendItem } from "../../dataLayers/Legend";
import { compileLegendFromGLStyleLayers } from "../../dataLayers/legends/compileLegend";

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
  setVisibleSketches: (ids: string[]) => void;
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
  errors: { [id: string]: string };
  loading: string[];
  getMenuOptions: (
    selectedIds: string[],
    selectionType?: {
      /* collection geometryType */
      collection: boolean;
      /* SketchFolder selected */
      folder: boolean;
      /** only sketches with geometryType != collection */
      sketch: boolean;
    },
    selectionBBox?: number[]
  ) => {
    contextMenu: (DropdownOption | DropdownDividerProps)[];
    viewReports?: DropdownOption;
    create: DropdownOption[];
    read: DropdownOption[];
    update: DropdownOption[];
  };
  setSketchClasses: (
    sketchClasses: Pick<
      SketchClassDetailsFragment,
      | "id"
      | "mapboxGlStyle"
      | "geometryType"
      | "filterApiServerLocation"
      | "name"
    >[]
  ) => void;
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
  setVisibleSketches: NotImplemented,
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
  errors: {},
  loading: [],
  getMenuOptions: NotImplemented,
  setSketchClasses: NotImplemented,
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
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>(
    `expanded-sketches-${slug}`,
    []
  );

  const [sketchClasses, setSketchClasses] = useState<
    Pick<
      SketchClassDetailsFragment,
      "id" | "mapboxGlStyle" | "filterApiServerLocation" | "name"
    >[]
  >([]);

  useEffect(() => {
    if (mapContext.manager && mapContext.ready) {
      const styles: { [sketchClassId: number]: any[] } = {};
      const layerConfig: {
        [sketchClassId: number]: {
          styles: any[];
          legendItem: LegendItem;
          name: string;
        };
      } = {};
      for (const sketchClass of sketchClasses) {
        if (sketchClass.mapboxGlStyle && sketchClass.mapboxGlStyle.length > 0) {
          styles[sketchClass.id] = sketchClass.mapboxGlStyle;
        } else if (sketchClass.filterApiServerLocation?.length) {
          const layer = {
            ...LayerTemplate,
          } as Partial<FillLayer>;
          delete layer["source"];
          layer.metadata = {
            ...layer.metadata,
            "s:filterApiServerLocation": sketchClass.filterApiServerLocation,
          };
          styles[sketchClass.id] = [layer];
        }
        const glStyles = styles[sketchClass.id];
        console.log("glStyles", glStyles, sketchClass);
        if (sketchClass.id in styles) {
          const legendItem: LegendItem = {
            legend: compileLegendFromGLStyleLayers(glStyles, "vector"),
            // eslint-disable-next-line i18next/no-literal-string
            id: `sketch-class-${sketchClass.id}`,
            label: sketchClass.name,
            type: "GLStyleLegendItem",
            isSketchClass: true,
          };
          layerConfig[sketchClass.id] = {
            styles: glStyles,
            legendItem,
            name: sketchClass.name,
          };
        }
      }
      mapContext.manager.setSketchClassLayerConfig(layerConfig);
      console.log(layerConfig);
    }
  }, [mapContext.manager, mapContext.ready, sketchClasses]);

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
    []
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
      const sketches: {
        id: number;
        timestamp?: string;
        sketchClassId?: number;
        filterMvtUrl?: string;
      }[] = [];
      // @ts-ignore
      window.client = client;
      for (const stringId of visibleSketches) {
        if (/Sketch:/.test(stringId)) {
          const data = client.cache.readFragment<any>({
            id: stringId,
            // eslint-disable-next-line i18next/no-literal-string
            fragment: gql`
              fragment SketchFilterMVTDetails on Sketch {
                id
                filterMvtUrl
              }
            `,
          });
          // @ts-ignore private api
          const isCached = client.cache.data.get(stringId, "id");
          // @ts-ignore private api
          const isCollection = client.cache.data.get(stringId, "isCollection");
          // @ts-ignore private api
          const sketchClassId = client.cache.data.get(
            stringId,
            "sketchClassId"
          );
          if (isCached && !isCollection) {
            // @ts-ignore private api
            const timestamp = client.cache.data.get(stringId, "timestamp");
            sketches.push({
              id: parseInt(stringId.split(":")[1]),
              timestamp: timestamp,
              sketchClassId: sketchClassId,
              filterMvtUrl: data?.filterMvtUrl,
            });
          }
        }
      }
      mapContext.manager.setVisibleSketches(sketches);
    }
  }, [visibleSketches, mapContext.manager, cacheState, client]);

  const { loading, errors } = useMemo(() => {
    const loading: string[] = [];
    const errors: { [id: string]: string } = {};
    for (const key in mapContext.sketchLayerStates) {
      const state = mapContext.sketchLayerStates[key];
      if (state.error) {
        errors[`Sketch:${key}`] = state.error.toString();
      }
      if (state.loading) {
        // eslint-disable-next-line i18next/no-literal-string
        loading.push(`Sketch:${key}`);
      }
    }
    return { loading, errors };
  }, [mapContext.sketchLayerStates]);

  // # Sketch and SketchFolder Selection
  const [selectedIds, _setSelectedIds] = useState<string[]>([]);

  const setSelectedIds = useCallback(
    (ids) => {
      _setSelectedIds(ids);
      // TODO: support multiselect
      if (ids.length > 0) {
        const id = ids[0];
        const typeName = id.split(":")[0];
        // @ts-ignore Using a private api here
        const bbox = client.cache.data.get(id, "bbox");
        const isCollection = Boolean(
          // @ts-ignore Using a private api here
          client.cache.data.get(id, "isCollection")
        );
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
        setBBOX(undefined);
        setSelectionType(undefined);
      }
    },
    [_setSelectedIds, client]
  );

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

  const openSketchReport = useCallback(
    (sketchId: number, uiState?: "left" | "right" | "docked") => {
      const sketch: SketchTocDetailsFragment =
        // @ts-ignore
        client.cache.data.data[`Sketch:${sketchId}`];
      if (sketch) {
        setOpenReports((openReports) => {
          const maxWindows = Math.floor((window.innerWidth - 69) / 512);
          return [
            {
              sketchId,
              uiState: "right",
              sketchClassId: sketch?.sketchClassId,
            },
            ...openReports
              .filter((r) => r.sketchId !== sketchId)
              .slice(0, maxWindows - 1),
          ];
        });
      }
    },
    [client.cache, setOpenReports]
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
    [client.cache, setSelectedIds, expandItem, setVisibleSketches]
  );

  useEffect(() => {
    const interactivityManager = mapContext.manager?.interactivityManager;
    const map = mapContext.manager?.map;
    if (interactivityManager && map) {
      const handler = (feature: Feature<any>, e: MapMouseEvent) => {
        if (
          "source" in feature &&
          /sketch-\d+/.test(feature["source"] as string)
        ) {
          const sketchId = parseInt(
            (feature["source"] as string).split("-")[1]
          );
          const sketch = client.cache.readFragment<
            SketchPopupDetailsFragment & { postId?: number }
          >({
            returnPartialData: true,
            // eslint-disable-next-line i18next/no-literal-string
            id: `Sketch:${sketchId}`,
            // eslint-disable-next-line i18next/no-literal-string
            fragment: gql`
              fragment SketchPopupDetails on Sketch {
                id
                sketchClassId
                postId
                userId
                updatedAt
                createdAt
                name
                sharedInForum
              }
            `,
          });
          if (!sketch) {
            console.warn("could not find sketch in cache");
            return;
          }
          const post = sketch.postId
            ? client.cache.readFragment<PopupShareDetailsFragment>({
                // eslint-disable-next-line i18next/no-literal-string
                id: `Post:${sketch.postId}`,
                returnPartialData: true,
                // eslint-disable-next-line i18next/no-literal-string
                fragment: gql`
                  fragment PopupShareDetails on Post {
                    id
                    topicId
                    topic {
                      id
                      title
                      forumId
                    }
                    authorProfile {
                      affiliations
                      affiliations
                      email
                      fullname
                      nickname
                      picture
                      userId
                    }
                  }
                `,
              })
            : undefined;
          if (sketch) {
            setTimeout(() => {
              focusOnTableOfContentsItem("Sketch", sketch.id);
              const name = sketch.name;
              const itMe =
                projectMetadata.data?.me?.id &&
                (projectMetadata.data.me.id === sketch.userId ||
                  projectMetadata.data.me.id === post?.authorProfile?.userId);
              const wasUpdated =
                sketch.updatedAt &&
                new Date(sketch.updatedAt) > new Date(sketch.createdAt);
              const dateString = new Date(
                wasUpdated ? sketch.updatedAt : sketch.createdAt
              ).toLocaleDateString();
              let userSlug = "You";
              if (!itMe && post && post.authorProfile) {
                userSlug =
                  post.authorProfile.nickname ||
                  post.authorProfile.fullname ||
                  post.authorProfile.email ||
                  "Unknown";
              }

              const editLabel = t("edit");
              const viewReportsLabel = t("view reports");
              const hideLabel = t("hide");

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
                    <div class="pb-2 -mt-2">
                      <h2 class="truncate text-sm font-semibold">${name}</h2>
                      <p class="">
                        <span>
                        ${itMe ? t("You") : userSlug}
                        </span> 
                        ${
                          sketch.sharedInForum
                            ? t("shared this sketch on")
                            : wasUpdated
                            ? t("last updated this sketch on")
                            : t("created this sketch on")
                        } ${dateString}
                      </p>
                      ${
                        post && post.topic
                          ? `<p>
                            ${t(
                              "in"
                            )} <button data-url="/${getSlug()}/app/forums/${
                              post.topic.forumId
                            }/${
                              post.topicId
                            }" class="underline text-primary-500">${
                              post.topic.title
                            }</button>
                          </p>`
                          : ""
                      }
                    </div>
                    <div class="-mx-3 py-2 space-x-1 bg-gray-50 p-2 border-t">
                      ${
                        sketch.sharedInForum === true
                          ? ""
                          : `<button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-edit-sketch" class="underline">${editLabel}</button>`
                      }
                      <button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-view-sketch" class="underline">${viewReportsLabel}</button>
                      <button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-hide-sketch" class="underline">${hideLabel}</button>
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
                  editSketch(sketch.id);
                });
              }
              const view = el.querySelector("button[id=popup-view-sketch]");
              if (view) {
                view.addEventListener("click", () => {
                  openSketchReport(sketch.id);
                });
              }
              const topicLink = el.querySelector("button[data-url]");
              if (topicLink) {
                topicLink.addEventListener("click", () => {
                  const url = topicLink.getAttribute("data-url");
                  if (url && url.length) {
                    history.replace(url);
                  }
                });
              }
              const hide = el.querySelector("button[id=popup-hide-sketch]");
              if (hide) {
                hide.addEventListener("click", () => {
                  hideSketches([`Sketch:${sketch.id}`]);
                  popup.remove();
                });
              }
              setSelectedIds([treeItemId(sketch.id, "Sketch")]);
            }, 1);
          }
        }
        if (feature.id) {
          const id = parseInt(feature.id.toString());
          // setTimeout(() => {
          //   const props = feature.properties!;
          //   focusOnTableOfContentsItem("Sketch", id);
          //   const name = feature.properties?.name;
          //   const itMe =
          //     projectMetadata.data?.me?.id &&
          //     projectMetadata.data?.me.id ===
          //       parseInt(feature.properties!.userId);
          //   const wasUpdated =
          //     props.updatedAt &&
          //     new Date(props.updatedAt) > new Date(props.createdAt);
          //   const dateString = new Date(
          //     wasUpdated ? props.updatedAt : props.createdAt
          //   ).toLocaleDateString();
          //   let post: PopupShareDetailsFragment | null | undefined;
          //   if (feature.properties!.postId) {
          //     const postId = parseInt(feature.properties!.postId);
          //     post = client.cache.readFragment<PopupShareDetailsFragment>({
          //       // eslint-disable-next-line i18next/no-literal-string
          //       id: `Post:${postId}`,
          //       // eslint-disable-next-line i18next/no-literal-string
          //       fragment: gql`
          //         fragment PopupShareDetails on Post {
          //           id
          //           topicId
          //           topic {
          //             id
          //             title
          //             forumId
          //           }
          //         }
          //       `,
          //     });
          //   }
          //   const editLabel = t("edit");
          //   const viewReportsLabel = t("view reports");
          //   const hideLabel = t("hide");

          //   const popup = new Popup({
          //     closeOnClick: true,
          //     closeButton: true,
          //     className: "SketchPopup",
          //     maxWidth: "18rem",
          //   })
          //     .setLngLat([e.lngLat.lng, e.lngLat.lat])
          //     .setHTML(
          //       `
          //       <div class="w-72">
          //         <div class="pb-2 -mt-2">
          //           <h2 class="truncate text-sm font-semibold">${name}</h2>
          //           <p class="">
          //             <span>
          //             ${
          //               itMe
          //                 ? t("You")
          //                 : feature.properties!.userSlug ||
          //                   feature.properties!.user_slug
          //             }
          //             </span>
          //             ${
          //               feature.properties!.sharedInForum
          //                 ? t("shared this sketch on")
          //                 : wasUpdated
          //                 ? t("last updated this sketch on")
          //                 : t("created this sketch on")
          //             } ${dateString}
          //           </p>
          //           ${
          //             post && post.topic
          //               ? `<p>
          //                 ${t(
          //                   "in"
          //                 )} <button data-url="/${getSlug()}/app/forums/${
          //                   post.topic.forumId
          //                 }/${
          //                   post.topicId
          //                 }" class="underline text-primary-500">${
          //                   post.topic.title
          //                 }</button>
          //               </p>`
          //               : ""
          //           }
          //         </div>
          //         <div class="-mx-3 py-2 space-x-1 bg-gray-50 p-2 border-t">
          //           ${
          //             feature.properties!.sharedInForum === true
          //               ? ""
          //               : `<button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-edit-sketch" class="underline">${editLabel}</button>`
          //           }
          //           <button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-view-sketch" class="underline">${viewReportsLabel}</button>
          //           <button class="bg-white border px-2 py-0 shadow-sm rounded" id="popup-hide-sketch" class="underline">${hideLabel}</button>
          //         </div>
          //       </div>
          //     `
          //     )
          //     .addTo(map);
          //   const el = popup.getElement();
          //   const edit = el.querySelector("button[id=popup-edit-sketch]");
          //   if (edit) {
          //     edit.addEventListener("click", () => {
          //       popup.remove();
          //       editSketch(id);
          //     });
          //   }
          //   const view = el.querySelector("button[id=popup-view-sketch]");
          //   if (view) {
          //     view.addEventListener("click", () => {
          //       openSketchReport(id);
          //     });
          //   }
          //   const topicLink = el.querySelector("button[data-url]");
          //   if (topicLink) {
          //     topicLink.addEventListener("click", () => {
          //       const url = topicLink.getAttribute("data-url");
          //       if (url && url.length) {
          //         history.replace(url);
          //       }
          //     });
          //   }
          //   const hide = el.querySelector("button[id=popup-hide-sketch]");
          //   if (hide) {
          //     hide.addEventListener("click", () => {
          //       hideSketches([`Sketch:${id}`]);
          //       popup.remove();
          //     });
          //   }
          //   setSelectedIds([treeItemId(id, "Sketch")]);
          // }, 1);
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
    openSketchReport,
    history,
    client,
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

      const selection = [
        ...selectedIds
          .filter((s) => /Sketch:/.test(s))
          .map((s) => parseInt(s.split(":")[1])),
        ...children,
      ];
      mapContext.manager.setSelectedSketches(selection);

      // TODO: make a combined bbox and set selectedBBOX so folders can have a zoom-to context menu option
      const bbox = bboxForSelection(
        selection,
        client as ApolloClient<InMemoryCache>
      );
      setBBOX(bbox as number[]);
    }
  }, [selectedIds, mapContext.manager, client]);
  // mySketches, myFolders]);

  const onRequestReportClose = useCallback(
    (id: number) => {
      setOpenReports((prev) => [...prev.filter((r) => r.sketchId !== id)]);
      setSelectedIds([]);
    },
    [setOpenReports, setSelectedIds]
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
  const [deleteSketchTocItem] = useDeleteSketchTocItemsMutation({
    onError,
    update: async (cache, { data }) => {
      const items = data?.deleteSketchTocItems?.deletedItems || [];
      hideSketches(items.filter((id) => /Sketch:/.test(id)));

      for (const id of items) {
        cache.evict({
          id: id,
        });
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

  useEffect(() => {
    // # Garbage collection routine
    // selectedIds and expandedIds can start to get filled with identifiers from the
    // discussion forum, or event deleted sketches from myplans that are never accessed
    // again. Since these are placed in localStorage, they should be routinely deleted.
    //
    // How do we know if they should be deleted? If the apollo client cache does not
    // contain them, that means either there is no active query containing them, or forum
    // post displaying the sketches. If the garbage collection routine is run without
    // myPlans rendering, user state could be lost.

    function gc() {
      setExpandedIds((prev) => [
        ...prev.filter((id) => {
          // @ts-ignore private api
          const isCached = client.cache.data.get(id, "id");
          return isCached;
        }),
      ]);
      // Using the more raw _setSelectedIds vs setSelectedIds here, but that shouldn't
      // matter since we are getting rid of entries that would not otherwise be rendered.
      setVisibleSketches((prev) => {
        const newState = [
          ...prev.filter((id) => {
            // @ts-ignore private api
            const isCached = client.cache.data.get(id, "id");
            return isCached;
          }),
        ];
        return newState;
      });
    }

    const interval = setInterval(gc, 60000);
    return () => {
      clearInterval(interval);
    };
  }, [setVisibleSketches, setExpandedIds, client]);

  const token = useAccessToken();

  const getTranslatedProp = useTranslatedProps();
  const getMenuOptions = useCallback(
    (
      selectedIds: string[],
      selectionType?: {
        /* collection geometryType */
        collection: boolean;
        /* SketchFolder selected */
        folder: boolean;
        /** only sketches with geometryType != collection */
        sketch: boolean;
      },
      selectionBBox?: number[]
    ) => {
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

      const selectedId = selectedIds.length
        ? parseInt(selectedIds[0].split(":")[1])
        : undefined;
      const contextMenu: (DropdownOption | DropdownDividerProps)[] = [];
      const sketchClasses = projectMetadata.data?.project?.sketchClasses || [];

      const create: DropdownOption[] = [
        ...(!selectionIsSharedContent &&
        (!selectionType || !selectionType.sketch)
          ? sketchClasses || []
          : []
        )
          .filter((sc) => !sc.formElementId && !sc.isArchived && sc.canDigitize)
          .sort((a, b) => {
            const aName = getTranslatedProp("name", a);
            const bName = getTranslatedProp("name", b);
            return aName.localeCompare(bName);
          })
          .map((sc) => ({
            // eslint-disable-next-line i18next/no-literal-string
            id: `create-${sc.id}`,
            label: getTranslatedProp("name", sc),
            onClick: async () => {
              history.replace(`/${getSlug()}/app`);
              const sketchClass: SketchingDetailsFragment | null =
                client.cache.readFragment({
                  // eslint-disable-next-line i18next/no-literal-string
                  id: `SketchClass:${sc.id}`,
                  fragment: SketchingDetailsFragmentDoc,
                  fragmentName: "SketchingDetails",
                });
              if (sketchClass) {
                setEditor({
                  sketchClass,
                  folderId:
                    selectedIds.length === 1 &&
                    /SketchFolder:/.test(selectedIds[0])
                      ? selectedId
                      : undefined,
                  collectionId:
                    selectedIds.length === 1 && selectionType?.collection
                      ? selectedId
                      : undefined,
                });
              }
            },
          })),
        ...(!selectionIsSharedContent &&
        (!selectionType || !selectionType.sketch)
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
        selectionType?.collection || selectionType?.sketch
          ? {
              id: "view-reports",
              label: t("View Reports"),
              keycode: "v",
              onClick: () => {
                openSketchReport(selectedId!);
              },
            }
          : undefined;
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
                  message: t("Rename {{folder.name}}", { folder }),
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
              message: t(`Are you sure you want to delete "{{name}}"?`, {
                name,
              }),
              onDelete: async () => {
                clearSelection();
                if (selectionType.folder) {
                  collapseItem({ id: selectedIds[0] });
                }
                await deleteSketchTocItem({
                  variables: {
                    items: [
                      {
                        type: selectionType?.sketch
                          ? SketchChildType.Sketch
                          : SketchChildType.SketchFolder,
                        id: selectedId,
                      },
                    ],
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

      if (selectionType && selectedId && selectionIsSharedContent) {
        update.push({
          id: "copy-from-shared",
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
              // eslint-disable-next-line i18next/no-literal-string
              history.push(`/${slug}/app/sketches`);
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

      if (
        selectedId &&
        !selectionType?.folder &&
        // @ts-ignore private api
        !client.cache.data.get(selectedIds[0], "filterMvtUrl")
      ) {
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
    },
    [
      projectMetadata.data?.project?.sketchClasses,
      t,
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
      deleteSketchTocItem,
      slug,
      collapseItem,
      copy,
      showSketches,
      token,
    ]
  );

  const menuOptions = useMemo(() => {
    return getMenuOptions(selectedIds, selectionType, selectionBBox);
  }, [selectedIds, getMenuOptions, selectionType, selectionBBox]);

  // Keyboard shortcut handling
  useEffect(() => {
    if (menuOptions?.contextMenu?.length) {
      const actions = menuOptions.contextMenu.filter(
        (a: any) => a.keycode
      ) as DropdownOption[];
      const handler = (e: KeyboardEvent) => {
        if (e.target) {
          const target = e.target as HTMLElement;
          if (target.tagName) {
            if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
              return;
            } else if (
              target.getAttribute &&
              target.getAttribute("contenteditable")
            ) {
              return;
            }
          }
        }
        if (e.key === "x" && openReports.length) {
          if (selectedIds.length > 0) {
            // TODO: support multiselect?
            const id = parseInt(selectedIds[0].split(":")[1]);
            onRequestReportClose(id);
            setSelectedIds([]);
            return;
          } else {
            setOpenReports((prev) => {
              return [...prev.slice(0, -1)];
            });
            setSelectedIds([]);
            return;
          }
        }
        for (const action of actions) {
          if (action.keycode === e.key) {
            action.onClick();
            e.preventDefault();
            return false;
          }
        }
      };
      document.body.addEventListener("keydown", handler);
      return () => {
        document.body.removeEventListener("keydown", handler);
      };
    }
  }, [
    menuOptions.contextMenu,
    onRequestReportClose,
    openReports.length,
    selectedIds,
    setOpenReports,
  ]);

  const { data } = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });

  const filteredLanguages = useMemo(
    () =>
      languages.filter(
        (f) =>
          !data?.project?.supportedLanguages ||
          data?.project?.supportedLanguages.find((o) => o === f.code) ||
          f.code === "EN"
      ),
    [data?.project?.supportedLanguages, languages]
  );

  const onComplete = useCallback(
    (item: SketchTocDetailsFragment) => {
      history.replace(`/${getSlug()}/app/sketches`);
      setEditor(false);
      focusOnTableOfContentsItem("Sketch", item.id, true);
    },
    [focusOnTableOfContentsItem, history]
  );

  const onCancel = useCallback(() => {
    history.replace(`/${getSlug()}/app/sketches`);
    setEditor(false);
  }, [history]);

  const { i18n } = useTranslation();
  const lang = getSelectedLanguage(i18n, filteredLanguages);

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
        editorIsOpen: editor !== false,
        editSketch,
        menuOptions,
        getMenuOptions,
        showSketches,
        hideSketches,
        setVisibleSketches,
        loading,
        errors,
        setSketchClasses,
      }}
    >
      <FormLanguageContext.Provider
        value={{
          lang: lang.selectedLang,
          setLanguage: (code: string) => {
            const lang = languages.find((lang) => lang.code === code);
            if (!lang) {
              throw new Error(`Unrecognized language ${code}`);
            }
            i18n.changeLanguage(lang.code);
          },
          supportedLanguages:
            (data?.project?.supportedLanguages as string[]) || [],
        }}
      >
        {children}
        {openReports.length > 0 &&
          createPortal(
            <div
              style={{ zIndex: 20 }}
              className="absolute top-2 right-2 flex flex-wrap gap-2 max-w-full justify-end pointer-events-none"
            >
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
            </div>,
            document.body
          )}

        {editor !== false && (
          <SketchEditorModal
            sketchClass={editor?.sketchClass}
            sketch={editor?.sketch}
            loading={editor?.loading}
            loadingTitle={editor?.loading ? editor.loadingTitle : undefined}
            folderId={editor?.folderId}
            collectionId={editor?.collectionId}
            onComplete={onComplete}
            onCancel={onCancel}
          />
        )}
      </FormLanguageContext.Provider>
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

function bboxForSelection(
  selection: number[],
  client: ApolloClient<InMemoryCache>
) {
  let bbox: [number, number, number, number] | null = null;
  for (const id of selection) {
    // @ts-ignore private api
    // eslint-disable-next-line i18next/no-literal-string
    const itemBBox = client.cache.data.get(`Sketch:${id}`, "bbox") as
      | [number, number, number, number]
      | null
      | undefined;
    if (itemBBox) {
      if (bbox === null) {
        bbox = [...itemBBox];
      } else {
        // expand bbox
        if (itemBBox[0] < bbox[0]) {
          bbox[0] = itemBBox[0];
        }
        if (itemBBox[1] < bbox[1]) {
          bbox[1] = itemBBox[1];
        }
        if (itemBBox[2] > bbox[2]) {
          bbox[2] = itemBBox[2];
        }
        if (itemBBox[3] > bbox[3]) {
          bbox[3] = itemBBox[3];
        }
      }
    }
  }
  return bbox;
}
