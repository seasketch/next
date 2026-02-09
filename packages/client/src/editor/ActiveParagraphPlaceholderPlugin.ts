import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Adds a DOM-based placeholder to the empty paragraph the cursor is in.
// Uses a widget decoration so we can embed rich content (e.g. a <kbd> element
// for the "/" key) instead of relying on CSS ::before content strings.
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
            // Add a class to the paragraph so it becomes a positioning anchor.
            decorations.push(
              Decoration.node(start, start + parent.nodeSize, {
                class: "has-placeholder",
              })
            );
            const pos = start + 1; // inside the paragraph node
            decorations.push(
              Decoration.widget(pos, () => {
                const span = document.createElement("span");
                span.className = "active-paragraph-placeholder";
                span.contentEditable = "false";

                const textBefore = document.createTextNode(
                  "Start writing or type "
                );
                span.appendChild(textBefore);

                const kbd = document.createElement("kbd");
                kbd.textContent = "/";
                span.appendChild(kbd);

                const textAfter = document.createTextNode(
                  " to insert content\u2026"
                );
                span.appendChild(textAfter);

                return span;
              })
            );
          }
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}
