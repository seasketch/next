import { Node as PMNode } from "prosemirror-model";

/** Session-only: which in-card tab is selected. Not written to the document. */
const selectedTabIdByCard = new Map<number, string>();

export function getSelectedCardTabId(cardId: number): string | undefined {
  return selectedTabIdByCard.get(cardId);
}

export function setSelectedCardTabId(cardId: number, tabId: string): void {
  if (!tabId) {
    return;
  }
  selectedTabIdByCard.set(cardId, tabId);
}

export function clearSelectedCardTabId(cardId: number): void {
  selectedTabIdByCard.delete(cardId);
}

export function indexOfCardTabId(
  node: PMNode,
  tabId: string | undefined
): number {
  if (!tabId) {
    return 0;
  }
  let match = -1;
  node.forEach((panel, _offset, index) => {
    if (typeof panel.attrs.id === "string" && panel.attrs.id === tabId) {
      match = index;
    }
  });
  return match >= 0 ? match : 0;
}

export function tabIdAtIndex(node: PMNode, index: number): string | undefined {
  if (index < 0 || index >= node.childCount) {
    return undefined;
  }
  const id = node.child(index).attrs.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}
