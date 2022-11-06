import { EditorView, KeyBinding } from "@codemirror/view";

export function formatJSONCommand(view: EditorView) {
  const selection = view.state.selection;
  try {
    const parsed = JSON.parse(view.state.toJSON().doc);
    view.dispatch(
      view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: JSON.stringify(parsed, null, "  "),
        },
        selection,
      })
    );
  } catch (e) {
    // do nothing. let linter handle it
  }
  return true;
}

export const formatJSONKeyBinding: KeyBinding = {
  key: "Mod-f",
  run: formatJSONCommand,
  preventDefault: true,
};
