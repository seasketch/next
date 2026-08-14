import { Fragment, Node as PMNode, Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";

function countTopLevelTabContainers(doc: PMNode): number {
  let count = 0;
  doc.forEach((child) => {
    if (child.type.name === "tabContainer") {
      count += 1;
    }
  });
  return count;
}

function flattenTabStructure(fragment: Fragment): Fragment {
  const out: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === "tabContainer" || node.type.name === "tabPanel") {
      flattenTabStructure(node.content).forEach((child) => {
        out.push(child);
      });
      return;
    }
    const inner = flattenTabStructure(node.content);
    out.push(inner.eq(node.content) ? node : node.copy(inner));
  });
  return Fragment.fromArray(out);
}

/**
 * Replace any tabContainer / tabPanel in a pasted slice with the panel
 * contents so paste never introduces a second (or first) tab structure.
 */
export function unwrapTabContainersInSlice(slice: Slice): Slice {
  const next = flattenTabStructure(slice.content);
  if (next.eq(slice.content)) {
    return slice;
  }
  return new Slice(next, 0, 0);
}

/**
 * Tab chrome is managed from the card action menu. Unwrap tab structures
 * from pasted content, and block editor transactions that delete the
 * existing container or insert a second one.
 */
export function createProtectTabContainerPlugin() {
  return new Plugin({
    props: {
      transformPasted(slice) {
        return unwrapTabContainersInSlice(slice);
      },
    },
    filterTransaction(tr, state) {
      if (!tr.docChanged) {
        return true;
      }
      const before = countTopLevelTabContainers(state.doc);
      const after = countTopLevelTabContainers(tr.doc);
      if (before > 0 && after === 0) {
        return false;
      }
      if (after > 1) {
        return false;
      }
      return true;
    },
  });
}
