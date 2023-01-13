import { useCallback, useEffect, useState } from "react";
import { treeItemId } from ".";
import useLocalStorage from "../../useLocalStorage";
import useSessionStorage from "../../useSessionStorage";
import { FolderNodeDataProps } from "./FolderItem";
import { SketchNodeDataProps } from "./SketchItem";

export default function useExpandedIds(
  slug: string,
  folders?: { id: number }[] | null,
  sketches?: { id: number }[] | null,
  localStorageKey?: string,
  sessionOnly?: boolean
) {
  const [expandedIds, setExpandedIds] = (
    sessionOnly ? useSessionStorage : useLocalStorage
  )<string[]>(
    // eslint-disable-next-line i18next/no-literal-string
    localStorageKey || `expanded-my-plans-ids-${slug}`,
    []
  );

  /**
   * expandedFolderIds and expandedSketchIds can expand indefinitely as expanded items
   * are deleted. This could become a problem as this state is stored in localstorage.
   * Periodically this state should be cleaned up to make sure there aren't any ids
   * referencing non-existent items. This should be run
   *
   *   1. After loading the sketching data on application bootup, but not immediately
   *      so that we're not blocking the UI. There's a lot going on to render this
   *      list already.
   */
  const cleanupExpandedState = useCallback(() => {
    if (sessionOnly) {
      return;
    }
    if (folders && sketches) {
      const folderIds = folders.map((f) => treeItemId(f.id, "SketchFolder"));
      const sketchIds = sketches.map((s) => treeItemId(s.id, "Sketch"));
      const allIds = [...folderIds, ...sketchIds];
      setExpandedIds((prev) => {
        return [...prev.filter((id) => allIds.indexOf(id) !== -1)];
      });
    }
  }, [setExpandedIds, folders, sketches]);

  // Track whether the expanded state cleanup function was run
  const [cleanupWasRun, setCleanupWasRun] = useState(false);
  useEffect(() => {
    setCleanupWasRun(false);
  }, [slug, setCleanupWasRun]);

  useEffect(() => {
    if (!cleanupWasRun && sketches && folders) {
      setCleanupWasRun(true);
      setTimeout(() => {
        cleanupExpandedState();
      }, 3000);
    }
  }, [cleanupExpandedState, slug, cleanupWasRun, sketches, folders]);

  const onExpand = useCallback(
    (item: any, isExpanded: boolean) => {
      setExpandedIds((prev) => [
        ...prev.filter((id) => id !== item.id),
        ...(isExpanded ? [item.id] : []),
      ]);
    },
    [setExpandedIds]
  );

  return { expandedIds, setExpandedIds, onExpand };
}
