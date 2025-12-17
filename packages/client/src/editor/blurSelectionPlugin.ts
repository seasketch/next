import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const BLUR_SELECTION_STYLES = `
.pm-blur-selection {
  background: rgba(147, 197, 253, 0.45);
  border-radius: 2px;
}
.ProseMirror ::selection {
  background: transparent;
}
.ProseMirror *::selection {
  background: transparent;
}
`;

export function createBlurSelectionPlugin() {
  const key = new PluginKey("blur-selection-highlight");
  return new Plugin({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(_tr: any, _old: DecorationSet, _oldState: any, newState: any) {
        const sel = newState.selection;
        if (!sel || sel.empty) {
          return DecorationSet.empty;
        }
        return DecorationSet.create(newState.doc, [
          Decoration.inline(sel.from, sel.to, {
            class: "pm-blur-selection",
          }),
        ]);
      },
    },
    props: {
      decorations(state: any) {
        return key.getState(state);
      },
    },
  });
}

