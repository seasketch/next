import { Feature } from "geojson";
import { MapMouseEvent, Popup } from "mapbox-gl";
import {
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { treeItemId } from ".";
import { MapContext } from "../../dataLayers/MapContextManager";
import {
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
  useProjectMetadataQuery,
} from "../../generated/graphql";
import { getChildrenOfSketchOrSketchFolder } from "./useSketchActions";
import getSlug from "../../getSlug";
import { useOpenReports } from "../ReportContext";

export default function useSketchingSelectionState({
  mySketches,
  toolbarRef,
  setVisibleSketches,
  editSketch,
  myFolders,
  expandItem,
  collapseItem,
}: {
  mySketches?: SketchTocDetailsFragment[] | null;
  myFolders?: SketchFolderDetailsFragment[] | null;
  toolbarRef: HTMLElement | null;
  setVisibleSketches: (val: string[] | ((prev: string[]) => string[])) => void;
  editSketch: (id: number) => void;
  expandItem: (item: { id: string }) => void;
  collapseItem: (item: { id: string }) => void;
}) {
  const mapContext = useContext(MapContext);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { t } = useTranslation("sketching");
  const { data } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    document.querySelectorAll(".mapboxgl-popup").forEach((el) => el.remove());
  }, [setSelectedIds]);

  const { setOpenReports } = useOpenReports();

  /**
   * Maintains a list of sketch classes associated with currently selected
   * sketches. Used by useSketchActions to determine what elements should be
   * shown in the toolbar. Could be overkill... might just need to know whether
   * any sketches are selected, and if any of them are collections.
   */
  // const [selectedSketchClasses] = useState<number[]>([]);
  const selectedSketchClasses = useMemo(() => {
    const sketches = mySketches || [];
    const selectedSketchClasses: number[] = [];
    if (selectedIds) {
      for (const id of selectedIds) {
        if (/Sketch:/.test(id)) {
          const n = parseInt(id.split(":")[1]);
          const sketch = sketches.find((s) => s.id === n);
          if (
            sketch &&
            selectedSketchClasses.indexOf(sketch.sketchClassId) === -1
          ) {
            selectedSketchClasses.push(sketch.sketchClassId);
          }
        }
      }
    }
    return selectedSketchClasses;
  }, [mySketches, selectedIds]);

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

  const onSelect = useCallback(
    (metaKey: boolean, item: any, isSelected: boolean) => {
      document.querySelectorAll(".mapboxgl-popup").forEach((el) => el.remove());
      if (isSelected) {
        setSelectedIds([item.id]);
      } else {
        setSelectedIds([]);
      }
    },
    [setSelectedIds]
  );

  /**
   * Selects an item in the table of contents, and expands it's parent if
   * necessary. Appropriate to call after a drag & drop action, or
   * creation/editing.
   */
  const focusOnTableOfContentsItem = useCallback(
    (
      type: "Sketch" | "SketchFolder",
      id: number,
      folderId?: number | null,
      collectionId?: number | null,
      setVisible?: boolean
    ) => {
      let normalizedIds: string[] = [];
      if (folderId) {
        normalizedIds.push(treeItemId(folderId, "SketchFolder"));
      }
      if (collectionId) {
        normalizedIds.push(treeItemId(collectionId, "Sketch"));
      }
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
    [expandItem, setVisibleSketches]
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
              data?.me?.id &&
              data.me.id === parseInt(feature.properties!.userId);
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

            // setSelectedIds([treeItemId(id, "Sketch")]);
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
    data?.me?.id,
  ]);

  useEffect(() => {
    if (mapContext?.manager) {
      // get child sketches
      const children = [];
      for (const id of selectedIds) {
        if (/SketchFolder:/.test(id)) {
          const childNodes = getChildrenOfSketchOrSketchFolder(
            {
              __typename: "SketchFolder",
              id: parseInt(id.split(":")[1]),
            },
            mySketches || [],
            myFolders || []
          );
          children.push(...childNodes.sketches);
        } else if (/Sketch:/.test(id)) {
          const childNodes = getChildrenOfSketchOrSketchFolder(
            {
              __typename: "Sketch",
              id: parseInt(id.split(":")[1]),
            },
            mySketches || [],
            myFolders || []
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
  }, [selectedIds, mapContext.manager, mySketches, myFolders]);

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectedSketchClasses,
    onSelect,
    focusOnTableOfContentsItem,
  };
}
