import { Plugin } from "prosemirror-state";
import { Schema } from "prosemirror-model";

const URL_IN_TEXT =
  /\b(https?:\/\/[^\s<]+[^\s<.,;:!?)])\b/gi;

/**
 * Apply link marks to bare URLs in comment text (best-effort; comments stay small).
 */
export function autolinkPlugin(schema: Schema) {
  const linkType = schema.marks.link;
  if (!linkType) {
    return new Plugin({});
  }
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((t) => t.docChanged)) {
        return null;
      }
      const tr = newState.tr;
      let changed = false;
      newState.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) {
          return;
        }
        URL_IN_TEXT.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = URL_IN_TEXT.exec(node.text))) {
          const raw = m[0];
          const from = pos + m.index;
          const to = from + raw.length;
          if (!newState.doc.rangeHasMark(from, to, linkType)) {
            tr.addMark(from, to, linkType.create({ href: raw, title: null }));
            changed = true;
          }
        }
      });
      return changed ? tr : null;
    },
  });
}
