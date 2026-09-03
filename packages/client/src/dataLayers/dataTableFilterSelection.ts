/**
 * Search-aware select-all / select-none for data-table multi-select filters.
 * Operates on the currently visible (optionally filtered) values while
 * preserving selections that are hidden by the search query.
 */
export function applyVisibleMultiSelection(
  selected: string[],
  visible: string[],
  action: "all" | "none"
): string[] {
  if (visible.length === 0) {
    return selected;
  }
  if (action === "all") {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const value of selected) {
      if (!seen.has(value)) {
        next.push(value);
        seen.add(value);
      }
    }
    for (const value of visible) {
      if (!seen.has(value)) {
        next.push(value);
        seen.add(value);
      }
    }
    return next;
  }
  const hide = new Set(visible);
  return selected.filter((value) => !hide.has(value));
}

export function visibleSelectionStatus(
  selected: string[],
  visible: string[]
): { allSelected: boolean; noneSelected: boolean } {
  if (visible.length === 0) {
    return { allSelected: true, noneSelected: true };
  }
  const selectedSet = new Set(selected);
  let selectedCount = 0;
  for (const value of visible) {
    if (selectedSet.has(value)) {
      selectedCount += 1;
    }
  }
  return {
    allSelected: selectedCount === visible.length,
    noneSelected: selectedCount === 0,
  };
}
