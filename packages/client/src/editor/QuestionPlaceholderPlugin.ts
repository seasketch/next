import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export default function QuestionPlaceholderPlugin() {
  return new Plugin({
    props: {
      decorations: (state) => {
        const decorations: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (node.type.name === "question" && node.childCount === 0) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "empty-node",
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
