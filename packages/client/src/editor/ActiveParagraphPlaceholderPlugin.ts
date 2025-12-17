import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Adds a class to the empty paragraph the cursor is currently in so we can
// show a contextual placeholder without affecting other empty paragraphs.
export default function ActiveParagraphPlaceholderPlugin() {
  return new Plugin({
    props: {
      decorations: (state) => {
        const decorations: Decoration[] = [];
        const { selection, doc } = state;

        // Only show when the selection is a caret inside an empty paragraph.
        if (selection.empty) {
          const $from = selection.$from;
          const parent = $from.parent;

          if (parent.type.name === "paragraph" && parent.childCount === 0) {
            const start = $from.before();
            decorations.push(
              Decoration.node(start, start + parent.nodeSize, {
                class: "empty-active-paragraph",
              })
            );
          }
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}

