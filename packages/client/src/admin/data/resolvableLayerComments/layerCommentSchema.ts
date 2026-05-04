import { Mark, Node as PMNode, Schema } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { schema as baseSchema } from "../../../editor/basicSchema";

/**
 * @mention mark + link target="_blank" for resolvable layer comments (ProseMirror JSON in DB).
 */
const mention = {
  attrs: { userId: {}, label: { default: "" } },
  inclusive: false,
  parseDOM: [
    {
      tag: "span[data-mention-user-id]",
      getAttrs(dom: string | HTMLElement) {
        if (typeof dom === "string") {
          return false;
        }
        const el = dom as HTMLElement;
        const id = el.getAttribute("data-mention-user-id");
        return {
          userId: id ? parseInt(id, 10) : 0,
          label: el.getAttribute("data-mention-label") || el.textContent || "",
        };
      },
    },
  ],
  toDOM(mark: Mark) {
    // Use content hole `0` only — document text already includes "@label ".
    // A static string here duplicated output as "@Name@Name".
    return [
      "span",
      {
        class: "mention",
        "data-mention-user-id": String(mark.attrs.userId),
        "data-mention-label": String(mark.attrs.label),
      },
      0,
    ];
  },
};

const baseMarks = baseSchema.spec.marks
  .addBefore("link", "mention", mention)
  // @ts-ignore toDOM override for external links
  .update("link", {
    ...baseSchema.spec.marks.get("link"),
    toDOM(node: PMNode) {
      const { href, title } = node.attrs;
      return ["a", { href, title, target: "_blank", rel: "noopener noreferrer" }, 0];
    },
  });

export const layerCommentSchema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseMarks,
});
