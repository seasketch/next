import { NodeSpec } from "prosemirror-model";

const sketchTocAttachmentNodeSpec: NodeSpec = {
  attrs: {
    title: {},
    items: { default: [] },
  },
  inline: false,
  group: "block",
  draggable: false,
  toDOM: (node) => {
    return [
      "div",
      {
        "data-sketch-toc-attachment": true,
        title: node.attrs.title,
        "data-items": JSON.stringify(node.attrs.items),
      },
      ["span", node.attrs.title],
    ];
  },
  parseDOM: [
    {
      tag: "div[data-sketch-toc-attachment]",
      getAttrs: (dom) => {
        let title = (dom as HTMLElement).getAttribute("title");
        const items = (dom as HTMLElement).getAttribute("data-items");
        return {
          title,
          items: JSON.parse(items || "[]"),
        };
      },
    },
  ],
};

export default sketchTocAttachmentNodeSpec;
