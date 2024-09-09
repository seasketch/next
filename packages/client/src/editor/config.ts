/**
 * WARNING!!
 * This file must be manually made up-to-date with the contents of the client
 * schema.
 */
import { Schema, Node, NodeSpec } from "prosemirror-model";
import { schema as baseSchema } from "./basicSchema";
import { exampleSetup } from "prosemirror-example-setup";
import { addListNodes } from "prosemirror-schema-list";
import QuestionPlaceholderPlugin from "./QuestionPlaceholderPlugin";
import { tableNodes } from "prosemirror-tables";

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
  nodes: addListNodes(
    baseSchema.spec.nodes,
    "paragraph block*",
    "block"
  ).append(
    tableNodes({
      tableGroup: "block",
      cellContent: "block+",
      cellAttributes: {
        background: {
          default: null,
          getFromDOM(dom) {
            return (dom.style && dom.style.backgroundColor) || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              // eslint-disable-next-line i18next/no-literal-string
              attrs.style = (attrs.style || "") + `background-color: ${value};`;
          },
        },
      },
    })
  ),
  // @ts-ignore
  marks: baseMarks,
});

const contentSchema = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  // @ts-ignore
  marks: baseMarks,
});

const forumPostSchema = new Schema({
  // @ts-ignore
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block")
    .addBefore("paragraph", "sketch", {
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
    })
    // TODO: these should be added back in as styles and menu option support is added
    .remove("horizontal_rule")
    // .remove("image")
    .remove("code_block")
    .remove("blockquote")
    .update("doc", {
      content: "block+ attachments",
    })
    .append({
      attachment: {
        attrs: {
          id: {},
          type: {},
          data: {},
        },
        content: "text*",
        group: "block",
        defining: true,
        parseDOM: [
          {
            tag: "data[data-attachment-id]",
            // @ts-ignore
            getAttrs: (dom: { getAttribute: (arg0: string) => any }) => {
              return {
                id: dom.getAttribute("data-attachment-id"),
                type: dom.getAttribute("data-type"),
                data: JSON.parse(dom.getAttribute("data-attachment")),
              };
            },
          },
        ],
        toDOM: (node: Node) => {
          const id = node.attrs.id;
          const type = node.attrs.type;
          const data = node.attrs.data;
          return [
            "div",
            {
              "data-attachment-id": id,
              "data-type": type,
              "data-attachment": JSON.stringify(data),
            },
            `${type}:${id}`,
          ];
        },
      },
      attachments: {
        content: "attachment*",
        group: "block",
        defining: true,
        parseDOM: [{ tag: "div[attachments]" }],
        toDOM: function (node: any) {
          return [
            "div",
            { attachments: "forumAttachments" },
            // eslint-disable-next-line i18next/no-literal-string
            node.childCount ? 0 : 0,
          ];
        },
      },
    }),
  marks: baseMarks.addBefore("link", "attachmentLink", {
    attrs: {
      "data-attachment-id": {},
      "data-type": {},
    },
    toDOM: (node) => {
      const id = node.attrs["data-attachment-id"];
      const type = node.attrs["data-type"];
      return ["button", { "data-attachment-id": id, "data-type": type }, 0];
    },
    parseDOM: [
      {
        tag: "button[data-attachment-id]",
        getAttrs: (dom) => {
          if (dom instanceof HTMLElement) {
            return {
              "data-attachment-id": dom.getAttribute("data-attachment-id"),
              "data-type": dom.getAttribute("data-type"),
            };
          } else {
            throw new Error("String instead of HTMLElement passed to getAttrs");
          }
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
