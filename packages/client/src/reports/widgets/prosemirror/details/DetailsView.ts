import { Node } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";

const canToggle = (event: MouseEvent) =>
  event.target &&
  ((event.target instanceof HTMLElement && event.target.closest("summary")) ||
    event.target instanceof HTMLDetailsElement);

export class DetailsView implements NodeView {
  dom: HTMLDetailsElement;
  contentDOM: HTMLDetailsElement;
  private getPos: () => number;
  private view: EditorView;
  private forceOpen: boolean;
  /** While true, keep the native details element open for print preview even if attrs say closed. */
  private printingPreviewActive = false;

  private readonly onBeforePrint = () => {
    this.printingPreviewActive = true;
    this.dom.open = true;
  };

  private readonly onAfterPrint = () => {
    this.printingPreviewActive = false;
    if (this.forceOpen) {
      this.dom.open = true;
      return;
    }
    this.syncOpenFromDocumentAttrs();
  };

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number,
    options?: { forceOpen?: boolean }
  ) {
    this.dom = this.contentDOM = document.createElement("details");
    this.getPos = getPos;
    this.view = view;
    this.forceOpen = options?.forceOpen === true;
    this.dom.open = this.forceOpen || node.attrs["open"] === true;

    if (typeof window !== "undefined") {
      window.addEventListener("beforeprint", this.onBeforePrint);
      window.addEventListener("afterprint", this.onAfterPrint);
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

  private syncOpenFromDocumentAttrs() {
    const pos = this.getPos();
    if (pos === undefined || pos === null) {
      return;
    }
    const currentNode = this.view.state.doc.nodeAt(pos);
    if (!currentNode || currentNode.type.name !== "details") {
      return;
    }
    const shouldBeOpen = currentNode.attrs["open"] === true;
    if (this.dom.open !== shouldBeOpen) {
      this.dom.open = shouldBeOpen;
    }
  }

  update(node: Node) {
    if (node.type.name !== "details") {
      return false;
    }
    const shouldBeOpen =
      this.forceOpen || this.printingPreviewActive || node.attrs["open"] === true;
    if (this.dom.open !== shouldBeOpen) {
      this.dom.open = shouldBeOpen;
    }
    return true;
  }

  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeprint", this.onBeforePrint);
      window.removeEventListener("afterprint", this.onAfterPrint);
    }
  }
}
