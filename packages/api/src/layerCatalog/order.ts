export type OrderedItem = {
  stableId: string;
  parentStableId: string | null;
  title: string;
  isFolder: boolean;
  sortIndex: number;
};

/**
 * Draft overlay-list order: folders and layers walked depth-first, siblings
 * by sort index. Folder rows are omitted. The folder column is the ancestor
 * titles joined with " / ".
 */
export function layersInOverlayOrder<T extends OrderedItem>(
  items: T[]
): (T & { folder: string })[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(items.map((item) => item.stableId));
  for (const item of items) {
    const parent =
      item.parentStableId && ids.has(item.parentStableId)
        ? item.parentStableId
        : null;
    const siblings = byParent.get(parent);
    if (siblings) {
      siblings.push(item);
    } else {
      byParent.set(parent, [item]);
    }
  }
  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) =>
        a.sortIndex - b.sortIndex ||
        a.title.localeCompare(b.title) ||
        a.stableId.localeCompare(b.stableId)
    );
  }
  const ordered: (T & { folder: string })[] = [];
  const walk = (parent: string | null, folderTitles: string[]) => {
    for (const item of byParent.get(parent) || []) {
      if (item.isFolder) {
        walk(item.stableId, [...folderTitles, item.title]);
      } else {
        ordered.push({ ...item, folder: folderTitles.join(" / ") });
      }
    }
  };
  walk(null, []);
  return ordered;
}
