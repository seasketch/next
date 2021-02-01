import { Mark, MarkType, Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

export function markActive(state: EditorState, type: MarkType): boolean {
  let { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  else return state.doc.rangeHasMark(from, to, type);
}

export function marks(state: EditorState, type: MarkType) {
  let { from, $from, to, empty } = state.selection;
  if (empty) {
    console.log("empty", state.selection);
    const mark = type.isInSet(state.storedMarks || $from.marks());
    if (mark) {
      return [mark];
    } else {
      return [];
    }
  } else {
    const marks: Mark[] = [];
    state.doc.nodesBetween(from, to, (node) => {
      const mark = type.isInSet(node.marks);
      if (mark) {
        marks.push(mark);
      }
    });
    return marks;
  }
}
