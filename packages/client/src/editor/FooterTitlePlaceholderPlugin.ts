import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export default function FooterTitlePlaceholderPlugin() {
  return new Plugin({
    props: {
      decorations: (state) => {
        const decorations: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (node.type.name === "footerTitle" && node.childCount === 0) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "empty-footer-title-node",
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
