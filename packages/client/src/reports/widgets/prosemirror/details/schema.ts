import type { NodeSpec } from "prosemirror-model";

export const detailsNodes = (): Record<"details" | "summary", NodeSpec> => {
  return {
    details: {
      group: "block",
      // eslint-disable-next-line i18next/no-literal-string
      content: `summary block*`,
      attrs: {
        open: { default: true },
      },
      parseDOM: [
        {
          tag: "details",
          getAttrs(node) {
            if (typeof node === "string") {
              return null;
            }
            return { open: node.hasAttribute("open") };
          },
        },
      ],
      toDOM(node) {
        return [
          "details",
          { open: node.attrs.open === true ? "open" : undefined },
          0,
        ];
      },
    },
    summary: {
      content: "inline*",
      parseDOM: [{ tag: "summary" }],
      toDOM() {
        return ["summary", 0];
      },
    },
  };
};
