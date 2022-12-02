import {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { treeItemId } from ".";
import { SketchTocDetailsFragment } from "../../generated/graphql";

export default function useSketchingSelectionState({
  mySketches,
  toolbarRef,
  setExpandedIds,
}: {
  mySketches?: SketchTocDetailsFragment[] | null;
  toolbarRef: HTMLElement | null;
  setExpandedIds: (value: SetStateAction<string[]>) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
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
      collectionId?: number | null
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
    },
    [setExpandedIds, setSelectedIds]
  );

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectedSketchClasses,
    onSelect,
    focusOnTableOfContentsItem,
  };
}
