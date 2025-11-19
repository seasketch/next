import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export default function PresenceAbsenceBlockPlaceholderPlugin() {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      // Ensure presenceBlock and absenceBlock nodes always contain at least one block
      let tr = newState.tr;
      let changed = false;

      const { paragraph } = newState.schema.nodes;

      newState.doc.descendants((node, pos) => {
        if (
          (node.type.name === "presenceBlock" ||
            node.type.name === "absenceBlock") &&
          node.childCount === 0 &&
          paragraph
        ) {
          const para = paragraph.createAndFill();
          if (para) {
            tr = tr.insert(pos + 1, para);
            changed = true;
          }
        }
      });

      return changed ? tr : null;
    },
    props: {
      decorations: (state) => {
        const decorations: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (
            (node.type.name === "presenceBlock" ||
              node.type.name === "absenceBlock") &&
            node.childCount === 0
          ) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                // eslint-disable-next-line i18next/no-literal-string
                class: `empty-${node.type.name}-node`,
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
