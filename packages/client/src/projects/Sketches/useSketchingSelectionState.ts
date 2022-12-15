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
import { SketchTocDetailsFragment } from "../../generated/graphql";

export default function useSketchingSelectionState({
  mySketches,
  toolbarRef,
  setExpandedIds,
  setVisibleSketches,
  editSketch,
}: {
  mySketches?: SketchTocDetailsFragment[] | null;
  toolbarRef: HTMLElement | null;
  setExpandedIds: (value: SetStateAction<string[]>) => void;
  setVisibleSketches: (val: string[] | ((prev: string[]) => string[])) => void;
  editSketch: (id: number) => void;
}) {
  const mapContext = useContext(MapContext);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { t } = useTranslation("sketching");

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    document.querySelectorAll(".mapboxgl-popup").forEach((el) => el.remove());
  }, [setSelectedIds]);

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
        setExpandedIds((prev) => [
          ...prev.filter((id) => normalizedIds.indexOf(id) === -1),
          ...normalizedIds,
        ]);
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
    [setExpandedIds, setVisibleSketches]
  );

  useEffect(() => {
    const interactivityManager = mapContext.manager?.interactivityManager;
    const map = mapContext.manager?.map;
    if (interactivityManager && map) {
      const handler = (feature: Feature<any>, e: MapMouseEvent) => {
        if (feature.id) {
          const id = parseInt(feature.id.toString());
          setTimeout(() => {
            focusOnTableOfContentsItem("Sketch", id);
            const name = feature.properties?.name;
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
              <h2 class="truncate text-sm font-semibold">${name}</h2>
              <p class=""><span>${
                feature.properties!.user_slug || feature.properties!.user_id
              }</span> ${t("created this sketch on ")}${new Date(
                  feature.properties!.created_at
                ).toLocaleDateString()}</p>
                <button id="popup-edit-sketch" class="underline">edit</button>
                </div>
              `
              )
              .addTo(map);
            const el = popup.getElement();
            const button = el.querySelector("button[id=popup-edit-sketch]");
            if (button) {
              button.addEventListener("click", () => {
                popup.remove();
                editSketch(id);
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
  ]);

  useEffect(() => {
    if (mapContext?.manager) {
      mapContext.manager.setSelectedSketches(
        selectedIds
          .filter((s) => /Sketch:/.test(s))
          .map((s) => parseInt(s.split(":")[1]))
      );
    }
  }, [selectedIds, mapContext.manager, mySketches]);

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectedSketchClasses,
    onSelect,
    focusOnTableOfContentsItem,
  };
}
