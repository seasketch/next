import { Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

/**
 * Fires when the user types `@` so the host can open an admin mention picker.
 */
export function createMentionAtTriggerPlugin(opts: {
  onAtInserted: (view: EditorView, atPos: number) => void;
}) {
  return new Plugin({
    props: {
      handleTextInput(view, from, _to, text) {
        if (text === "@") {
          const atPos = from;
          queueMicrotask(() => {
            opts.onAtInserted(view, atPos);
          });
        }
        return false;
      },
    },
  });
}
