import { Plugin } from "prosemirror-state";
import { NodeSelection, TextSelection } from "prosemirror-state";

/**
 * When a NodeSelection is active on a report widget node and the user types,
 * move the cursor after the node and insert the typed text instead of replacing
 * the widget. Delete/Backspace and arrow keys keep their default behaviour.
 */
export function createFriendlyInlineAtomPlugin(): Plugin {
  return new Plugin({
    props: {
      handleTextInput(view, _from, _to, text) {
        const { state } = view;
        const { selection } = state;
        if (
          selection instanceof NodeSelection &&
          (selection.node.type.name === "metric" ||
            selection.node.type.name === "blockMetric")
        ) {
          const posAfter = selection.from + selection.node.nodeSize;
          const tr = state.tr
            .setSelection(TextSelection.create(state.doc, posAfter))
            .insertText(text);
          view.dispatch(tr);
          return true;
        }
        return false;
      },
    },
  });
}
