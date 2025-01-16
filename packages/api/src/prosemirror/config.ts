/**
 * WARNING!!
 * This file must be manually made up-to-date with the contents of the client
 * schema.
 */
import { Schema, Node, NodeSpec } from "prosemirror-model";
import { schema as baseSchema } from "./basicSchema";
import { addListNodes } from "prosemirror-schema-list";
import sketchNodeSpec from "./SketchTocAttachmentSpec";
import { defaultSettings, updateImageNode } from "prosemirror-image-plugin";

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

const aboutPageSchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseMarks,
});

export { forums, aboutPageSchema };
