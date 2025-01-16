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
import {
  defaultSettings,
  updateImageNode,
  imagePlugin,
  ImagePluginSettings,
} from "prosemirror-image-plugin";
import { ApolloClient } from "@apollo/client";
import { CreateFileUploadForAboutPageDocument } from "../generated/graphql";
import axios from "axios";

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

const imageSettings: ImagePluginSettings = {
  ...defaultSettings,
  isBlock: true,
  hasTitle: false,
  deleteSrc: async (src) => {
    // TODO: There's no way to implement this safely since the user can
    // later undo the deletion of the image, so it needs to stay available
    // on the server.
    // In the future, if uploads start to become costly, we can
    // cross-reference the file_uploads table and the contents of the
    // metadata and aboutPage prosemirror documents to find "orphaned"
    // uploads that can be deleted. This could be a periodic
    // graphile-worker job.
  },
  // defaultTitle: "",
};

const aboutPageSchema = new Schema({
  nodes: updateImageNode(
    addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
    {
      ...imageSettings,
    }
  ),
  marks: baseMarks,
});

export function createAboutPageEditorConfig(
  client: ApolloClient<any>,
  projectId: number
) {
  const uploadFile: (file: File) => Promise<string> = async (file) => {
    const response = await client.mutate({
      mutation: CreateFileUploadForAboutPageDocument,
      variables: {
        contentType: file.type,
        filename: file.name,
        fileSizeBytes: file.size,
        projectId,
      },
    });
    const uploadUrl =
      response?.data?.createFileUpload?.cloudflareImagesUploadUrl;
    if (!uploadUrl) {
      throw new Error("Failed to get upload URL");
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios({
      url: uploadUrl,
      method: "POST",
      data: formData,
    });
    if (
      "data" in res &&
      res.data &&
      "result" in res.data &&
      res.data["result"] &&
      "variants" in res.data["result"] &&
      res.data["result"]["variants"] &&
      Array.isArray(res.data["result"]["variants"])
    ) {
      const variants = res.data["result"]["variants"] as string[];
      const prosemirrorEmbed = variants.find((variant: any) =>
        /prosemirrorEmbed/.test(variant)
      );
      if (!prosemirrorEmbed) {
        throw new Error("Could not find prosemirrorEmbed variant");
      }
      // This rediculous hack is necessary to avoid having the image
      // flash with a broken icon (in chrome, others?) for a second
      // before it finally loads. The image is preloaded in a hidden
      // position before being finally inserted into the prosemirror
      // document.
      return new Promise((resolve) => {
        const img = document.createElement("img");
        img.src = prosemirrorEmbed;
        img.setAttribute(
          "style",
          "position: absolute; top: -10000px; left: -10000px;"
        );
        img.onload = () => {
          resolve(prosemirrorEmbed);
          document.body.removeChild(img);
        };
        document.body.append(img);
      });
    } else {
      throw new Error("Could not get variants from upload response");
    }
  };
  return {
    schema: aboutPageSchema,
    plugins: [
      ...exampleSetup({
        schema: aboutPageSchema,
        menuBar: false,
      }),
      imagePlugin({
        ...imageSettings,
        uploadFile,
      }),
    ],
    imageSettings: { ...imageSettings, uploadFile },
  };
}

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
