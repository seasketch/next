/**
 * WARNING!!
 * This file must be manually made up-to-date with the contents of the client
 * schema.
 */
import { Schema, Node } from "prosemirror-model";
import { schema as baseSchema } from "./basicSchema";
import { exampleSetup } from "prosemirror-example-setup";
import { addListNodes } from "prosemirror-schema-list";
import QuestionPlaceholderPlugin from "./QuestionPlaceholderPlugin";
import sketchNodeSpec from "./SketchTocAttachmentSpec";

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

const questionSchema: Schema = new Schema({
  nodes: spec.nodes
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
        // @ts-ignore
        toDOM(node: Node) {
          return ["h2", 0];
        },
      },
    })
    .update("doc", {
      content: "question block*",
    })
    .remove("heading"),
  // @ts-ignore
  marks: baseMarks,
});

const metadataSchema = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  // @ts-ignore
  marks: baseMarks,
});

const contentSchema = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  // @ts-ignore
  marks: baseMarks,
});

const nodes = addListNodes(baseSchema.spec.nodes, "paragraph block*", "block")
  .addBefore("paragraph", "sketch", sketchNodeSpec)
  // TODO: these should be added back in as styles and menu option support is added
  .remove("horizontal_rule")
  // .remove("image")
  .remove("code_block")
  .remove("blockquote");

const forumPostSchema = new Schema({
  // @ts-ignore
  nodes,
  // @ts-ignore
  marks: baseMarks.addBefore("link", "mapBookmark", {
    attrs: {
      "data-bookmark-id": {},
    },
    // @ts-ignore
    toDOM: (node: Node) => {
      const id = node.attrs["data-bookmark-id"];
      return ["button", { "data-bookmark-id": id }, 0];
    },
    parseDOM: [
      {
        tag: "button[data-bookmark-id]",
        // @ts-ignore
        getAttrs: (dom: { getAttribute: (arg0: string) => any }) => {
          return {
            "data-bookmark-id": dom.getAttribute("data-bookmark-id"),
          };
        },
      },
    ],
  }),
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

export const sketchType = forumPostSchema.nodes.sketch;

export const forumPosts = {
  schema: forumPostSchema,
  plugins: exampleSetup({
    schema: forumPostSchema,
    menuBar: false,
  }),
};
