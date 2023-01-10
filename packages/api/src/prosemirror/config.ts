/**
 * WARNING!!
 * This file must be manually made up-to-date with the contents of the client
 * schema.
 */
import { Schema, Node, NodeSpec } from "prosemirror-model";
import { schema as baseSchema } from "./basicSchema";
import { addListNodes } from "prosemirror-schema-list";
let spec = baseSchema.spec;

baseSchema.spec.marks.update("link", {
  ...baseSchema.spec.marks.get("link"),
  // @ts-ignore
  toDOM: (node: Node) => {
    let { href, title } = node.attrs;
    return ["a", { href, title, target: "_blank" }, 0];
  },
});

const baseMarks = baseSchema.spec.marks.update("link", {
  ...baseSchema.spec.marks.get("link"),
  // @ts-ignore
  toDOM: (node: Node) => {
    let { href, title } = node.attrs;
    return ["a", { href, title, target: "_blank" }, 0];
  },
});

const sketchSpec: NodeSpec = {
  attrs: {
    sketchId: {},
    sketchClassId: {},
    title: { default: null },
  },
  inclusive: false,
  inline: false,
  group: "block",
  draggable: true,
  parseDOM: [
    {
      tag: "div[sketch-id]",
      // @ts-ignore
      getAttrs(dom: { getAttribute: (arg0: string) => any }) {
        return {
          sketchId: dom.getAttribute("sketch-id"),
          sketchClassId: dom.getAttribute("sketch-class-id"),
          title: dom.getAttribute("title"),
        };
      },
    },
  ],
  toDOM: (node) => [
    "div",
    {
      "sketch-id": node.attrs.sketchId,
      "sketch-class-id": node.attrs.sketchClassId,
      title: node.attrs.title,
    },
  ],
};

const forums = new Schema({
  // @ts-ignore
  nodes: addListNodes(
    baseSchema.spec.nodes.addBefore("paragraph", "sketch", sketchSpec),
    "paragraph block*",
    "block"
  )
    // TODO: these should be added back in as styles and menu option support is added
    // .remove("horizontal_rule")
    // .remove("image")
    .remove("code_block")
    .remove("blockquote"),
  // @ts-ignore
  marks: baseMarks,
});

export { forums };
