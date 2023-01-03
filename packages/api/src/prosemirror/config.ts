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

const forums = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block")
    // TODO: these should be added back in as styles and menu option support is added
    .remove("horizontal_rule")
    .remove("image")
    .remove("code_block")
    .remove("blockquote"),
  // @ts-ignore
  marks: baseMarks,
});

export { forums };
