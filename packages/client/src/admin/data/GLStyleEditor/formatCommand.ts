import { EditorView, KeyBinding } from "@codemirror/view";
import prettier from "prettier/standalone";
import babel from "prettier/parser-babel";

export function formatJSONCommand(view: EditorView) {
  const selection = view.state.selection;
  try {
    const parsed = JSON.parse(view.state.toJSON().doc);
    view.dispatch(
      view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: prettier.format(JSON.stringify(parsed), {
            parser: "json",
            plugins: [babel],
            printWidth: 50,
          }),
        },
        selection,
      })
    );
  } catch (e) {
    console.error(e);
    // do nothing. let linter handle it
  }
  return true;
}

export const formatJSONKeyBinding: KeyBinding = {
  key: "Mod-f",
  run: formatJSONCommand,
  preventDefault: true,
};
