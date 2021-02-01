import { Schema, DOMParser, Node } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-schema-basic";
// @ts-ignore
import { exampleSetup } from "prosemirror-example-setup";
import { addListNodes } from "prosemirror-schema-list";

const schema: Schema = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseSchema.spec.marks,
});

const plugins = exampleSetup({ schema, menuBar: false });

export { schema, plugins };
