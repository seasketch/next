import type { Node } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

const canToggle = (event: MouseEvent) =>
  event.target &&
  ((event.target instanceof HTMLElement && event.target.closest("summary")) ||
    event.target instanceof HTMLDetailsElement);

export class DetailsView implements NodeView {
  dom: HTMLDetailsElement;
  contentDOM: HTMLDetailsElement;
  private getPos: () => number;
  private view: EditorView;

  constructor(node: Node, view: EditorView, getPos: () => number) {
    this.dom = this.contentDOM = document.createElement("details");
    this.getPos = getPos;
    this.view = view;
    if (node.attrs["open"]) {
      this.dom.open = true;
    }

    this.dom.addEventListener("click", (event) => {
      if (canToggle(event)) {
        event.preventDefault();
        const pos = this.getPos();
        if (pos === undefined || pos === null) return;
        const currentNode = this.view.state.doc.nodeAt(pos);
        if (!currentNode || currentNode.type.name !== "details") return;
        const { open } = currentNode.attrs;
        const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...currentNode.attrs,
          open: !open,
        });
        this.view.dispatch(tr);
      }
    });
  }

  update(node: Node) {
    if (node.type.name !== "details") {
      return false;
    }
    // Sync the DOM element's open state with the node's attributes
    const shouldBeOpen = node.attrs["open"] === true;
    if (this.dom.open !== shouldBeOpen) {
      this.dom.open = shouldBeOpen;
    }
    return true;
  }
}
