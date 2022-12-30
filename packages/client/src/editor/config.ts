import { Schema, Node } from "prosemirror-model";
import { schema as baseSchema } from "./basicSchema";
import { exampleSetup } from "prosemirror-example-setup";
import { addListNodes } from "prosemirror-schema-list";
import QuestionPlaceholderPlugin from "./QuestionPlaceholderPlugin";
let spec = baseSchema.spec;

// console.log(baseSchema.spec.marks.get("link"));
// let spec = new Schema({
//   nodes: baseSchema.nodes,
//   marks: baseSchema.spec.marks.update("link", {
//     // @ts-ignore
//     toDOM: (node: Node) => {
//       let { href, title } = node.attrs;
//       return ["a", { href, title }, 0];
//     },
//   }),
// }).spec;

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

const questionSchema: Schema = new Schema({
  nodes: spec.nodes
    // @ts-ignore
    .append({
      question: {
        content: "text*",
        group: "block",
        defining: true,
        marks: "em",
        parseDOM: [{ tag: "h1[data-question]" }],
        toDOM: function (node: any) {
          return ["h1", { "data-question": "yes" }, 0];
        },
      },
      h2: {
        content: "inline*",
        group: "block",
        defining: true,
        parseDOM: [{ tag: "h2" }],
        toDOM(node: Node) {
          return ["h2", 0];
        },
      },
    })
    .update("doc", {
      content: "question block*",
    })
    .remove("heading"),
  marks: baseMarks,
});

const metadataSchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseMarks,
});

const contentSchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseMarks,
});

const forumPostSchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block")
    // TODO: these should be added back in as styles and menu option support is added
    .remove("horizontal_rule")
    .remove("image")
    .remove("code_block")
    .remove("blockquote"),
  marks: baseMarks,
});

export const metadata = {
  schema: metadataSchema,
  plugins: exampleSetup({ schema: metadataSchema, menuBar: false }),
};
export const formElements = {
  questions: {
    schema: questionSchema,
    plugins: [
      ...exampleSetup({ schema: questionSchema, menuBar: false }),
      QuestionPlaceholderPlugin(),
    ],
  },
  content: {
    // TODO: customize for this type
    schema: contentSchema,
    plugins: exampleSetup({ schema: contentSchema, menuBar: false }),
  },
};

export const forumPosts = {
  schema: forumPostSchema,
  plugins: exampleSetup({
    schema: forumPostSchema,
    menuBar: true,
  }),
};
