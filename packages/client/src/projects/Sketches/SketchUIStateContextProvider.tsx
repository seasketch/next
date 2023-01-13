import { InMemoryCache, useApolloClient } from "@apollo/client";
import { Feature } from "geojson";
import { MapMouseEvent, Popup } from "mapbox-gl";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { treeItemId } from ".";
import { LayerState, MapContext } from "../../dataLayers/MapContextManager";
import {
  SketchTocDetailsFragment,
  useProjectMetadataQuery,
} from "../../generated/graphql";
import { SketchFolderDetailsFragment } from "../../generated/queries";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";
import { useOpenReports } from "../ReportContext";
import { getChildrenOfSketchOrSketchFolder } from "./useSketchActions";

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
};

export const SketchUIStateContext =
  createContext<SketchUIStateContextValue>(defaultValue);

export default function SketchUIStateContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation("sketching");
  const { setOpenReports } = useOpenReports();
  const mapContext = useContext(MapContext);
  const client = useApolloClient();
  const slug = getSlug();
  const projectMetadata = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });

  const [cacheState, setCacheState] = useState<number>(0);
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
                // TODO:
                // editSketch(id);
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
    // editSketch,
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
      }}
    >
      {children}
    </SketchUIStateContext.Provider>
  );
}

/**
 *
 * @param foo
 * @returns
 */
export const useSketchUIState = (foo: boolean) => {
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
