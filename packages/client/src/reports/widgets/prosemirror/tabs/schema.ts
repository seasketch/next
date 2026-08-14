import type { NodeSpec } from "prosemirror-model";

export const tabsNodes = (): Record<"tabContainer" | "tabPanel", NodeSpec> => {
  return {
    // Not in group "block" so it cannot nest inside details/lists/tab panels.
    // Allowed only as a direct child of doc (see reportBodySchema).
    tabContainer: {
      // eslint-disable-next-line i18next/no-literal-string
      content: "tabPanel+",
      isolating: true,
      selectable: false,
      parseDOM: [
        {
          tag: "div[data-report-tabs]",
          contentElement(node) {
            if (node instanceof HTMLElement) {
              return (
                node.querySelector(".report-tabs-panels") ||
                node.querySelector("[data-report-tabs-panels]") ||
                node
              );
            }
            return node as HTMLElement;
          },
        },
      ],
      toDOM() {
        return ["div", { "data-report-tabs": "true" }, 0];
      },
    },
    tabPanel: {
      // eslint-disable-next-line i18next/no-literal-string
      content: "block+",
      isolating: true,
      defining: true,
      attrs: {
        id: { default: null },
        // eslint-disable-next-line i18next/no-literal-string
        label: { default: "Tab" },
      },
      parseDOM: [
        {
          tag: "div[data-report-tab-panel]",
          getAttrs(node) {
            if (typeof node === "string") {
              return null;
            }
            return {
              id: node.getAttribute("data-tab-id") || null,
              label: node.getAttribute("data-tab-label") || "Tab",
            };
          },
        },
      ],
      toDOM(node) {
        return [
          "div",
          {
            "data-report-tab-panel": "true",
            "data-tab-id": node.attrs.id || "",
            "data-tab-label": node.attrs.label || "Tab",
            role: "tabpanel",
          },
          0,
        ];
      },
    },
  };
};
