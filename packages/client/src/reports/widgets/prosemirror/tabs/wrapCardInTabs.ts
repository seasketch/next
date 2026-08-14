import { nanoid } from "nanoid";

// Stored document defaults, not UI copy. Authors rename via Manage tabs.
// eslint-disable-next-line i18next/no-literal-string
const DEFAULT_TAB_LABEL = "Tab";
// eslint-disable-next-line i18next/no-literal-string
const DEFAULT_TAB_LABELS = ["Tab 1", "Tab 2"];

function defaultTabLabel(index: number): string {
  // eslint-disable-next-line i18next/no-literal-string
  return `${DEFAULT_TAB_LABEL} ${index + 1}`;
}

function panelId(panel: PMJSONNode, index: number): string {
  if (typeof panel.attrs?.id === "string" && panel.attrs.id.length > 0) {
    return panel.attrs.id;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return `__index_${index}`;
}

function isGeneratedIndexId(id: string): boolean {
  // eslint-disable-next-line i18next/no-literal-string
  return id.startsWith("__index_");
}

export type PMJSONNode = {
  type?: string;
  attrs?: Record<string, any>;
  content?: PMJSONNode[];
  text?: string;
};

export type CardTabInfo = {
  id: string;
  label: string;
};

function emptyParagraph(): PMJSONNode {
  return { type: "paragraph" };
}

function isEmptyBlockContent(content?: PMJSONNode[]): boolean {
  if (!content || content.length === 0) {
    return true;
  }
  if (content.length === 1) {
    const only = content[0];
    if (
      only.type === "paragraph" &&
      (!only.content || only.content.length === 0)
    ) {
      return true;
    }
  }
  return false;
}

function asLabel(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

function findTopLevelTabContainer(
  doc: PMJSONNode
): { container: PMJSONNode; index: number } | null {
  if (!doc || !Array.isArray(doc.content)) {
    return null;
  }
  const index = doc.content.findIndex((child) => child.type === "tabContainer");
  if (index < 0) {
    return null;
  }
  return { container: doc.content[index], index };
}

export function docHasTabContainer(doc: PMJSONNode | null | undefined): boolean {
  if (!doc || !Array.isArray(doc.content)) {
    return false;
  }
  return doc.content.some((child) => child.type === "tabContainer");
}

export function listCardTabs(doc: PMJSONNode | null | undefined): CardTabInfo[] {
  const found = doc ? findTopLevelTabContainer(doc) : null;
  if (!found || !Array.isArray(found.container.content)) {
    return [];
  }
  return found.container.content
    .filter((panel) => panel.type === "tabPanel")
    .map((panel, index) => ({
      id: panelId(panel, index),
      label: asLabel(panel.attrs?.label, DEFAULT_TAB_LABEL),
    }));
}

export function tabPanelHasContent(
  doc: PMJSONNode,
  tabId: string
): boolean {
  const found = findTopLevelTabContainer(doc);
  if (!found || !Array.isArray(found.container.content)) {
    return false;
  }
  const panels = found.container.content.filter((p) => p.type === "tabPanel");
  const panel = panels.find((p, index) => panelId(p, index) === tabId);
  if (!panel) {
    return false;
  }
  return !isEmptyBlockContent(panel.content);
}

/**
 * Wrap everything after `reportTitle` in a tabContainer. Existing body
 * becomes the first panel; additional labels get empty panels.
 */
export function wrapCardBodyInTabs(
  doc: PMJSONNode,
  labels: string[]
): PMJSONNode {
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) {
    return doc;
  }
  if (docHasTabContainer(doc)) {
    return doc;
  }
  const resolvedLabels =
    labels.length >= 2 ? labels : DEFAULT_TAB_LABELS;
  const title = doc.content.find((child) => child.type === "reportTitle") || {
    type: "reportTitle",
  };
  const rest = doc.content.filter((child) => child.type !== "reportTitle");
  const firstContent = rest.length > 0 ? rest : [emptyParagraph()];
  const panels: PMJSONNode[] = resolvedLabels.map((label, index) => ({
    type: "tabPanel",
    attrs: {
      id: nanoid(),
      label: asLabel(label, defaultTabLabel(index)),
    },
    content: index === 0 ? firstContent : [emptyParagraph()],
  }));
  return {
    ...doc,
    content: [title, { type: "tabContainer", content: panels }],
  };
}

/**
 * Replace each top-level tabContainer with the concatenation of its panel
 * contents, in tab order.
 */
export function unwrapCardBodyTabs(doc: PMJSONNode): PMJSONNode {
  if (!doc || !Array.isArray(doc.content)) {
    return doc;
  }
  const content: PMJSONNode[] = [];
  for (const child of doc.content) {
    if (child.type === "tabContainer" && Array.isArray(child.content)) {
      for (const panel of child.content) {
        if (panel.type === "tabPanel" && Array.isArray(panel.content)) {
          content.push(...panel.content);
        }
      }
    } else {
      content.push(child);
    }
  }
  const hasBlock = content.some((node) => node.type !== "reportTitle");
  if (!hasBlock) {
    content.push(emptyParagraph());
  }
  return { ...doc, content };
}

/**
 * Apply rename / reorder / add / remove from the manage-tabs UI.
 * Existing panel bodies are kept when ids match; new ids get an empty panel.
 */
export function applyCardTabEdits(
  doc: PMJSONNode,
  tabs: CardTabInfo[]
): PMJSONNode {
  if (!doc || !Array.isArray(doc.content) || tabs.length < 1) {
    return doc;
  }
  const found = findTopLevelTabContainer(doc);
  if (!found || !Array.isArray(found.container.content)) {
    return doc;
  }
  const existingById = new Map<string, PMJSONNode>();
  found.container.content.forEach((panel, index) => {
    if (panel.type !== "tabPanel") {
      return;
    }
    existingById.set(panelId(panel, index), panel);
  });
  const nextPanels: PMJSONNode[] = tabs.map((tab, index) => {
    const existing = existingById.get(tab.id);
    const id =
      isGeneratedIndexId(tab.id) || tab.id.length === 0 ? nanoid() : tab.id;
    return {
      type: "tabPanel",
      attrs: {
        id,
        label: asLabel(tab.label, defaultTabLabel(index)),
      },
      content:
        existing && Array.isArray(existing.content) && existing.content.length > 0
          ? existing.content
          : [emptyParagraph()],
    };
  });
  const nextContent = doc.content.slice();
  nextContent[found.index] = {
    ...found.container,
    content: nextPanels,
  };
  return { ...doc, content: nextContent };
}
