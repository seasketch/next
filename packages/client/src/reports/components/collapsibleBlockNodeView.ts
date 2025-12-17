import { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";

/**
 * Plain DOM-based node view for the collapsible_block node.
 * Provides an editable summary (title) and a toggleable open/closed state,
 * while leaving the body content to ProseMirror via contentDOM.
 */
export class CollapsibleBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private summaryEl: HTMLElement;
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: (() => number) | boolean;

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    getPos: (() => number) | boolean
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    const details = document.createElement("details");
    details.setAttribute("data-collapsible-block", "true");
    if (node.attrs.open) {
      details.setAttribute("open", "open");
    }

    const summary = document.createElement("summary");
    summary.setAttribute("data-collapsible-label", "true");
    summary.contentEditable = "true";
    summary.className =
      "pm-collapsible-summary text-gray-800 font-semibold outline-none";
    summary.textContent = node.attrs.title || "Details";

    // Body container
    const bodyContainer = document.createElement("div");
    bodyContainer.setAttribute("data-collapsible-content", "true");
    bodyContainer.className =
      "pm-collapsible-body pl-4 border-l border-gray-200 ml-1";
    const contentDOM = document.createElement("div");
    bodyContainer.appendChild(contentDOM);

    details.appendChild(summary);
    details.appendChild(bodyContainer);

    // Event listeners
    summary.addEventListener("input", this.handleSummaryInput);
    details.addEventListener("toggle", this.handleToggle);

    this.dom = details;
    this.contentDOM = contentDOM;
    this.summaryEl = summary;
  }

  handleSummaryInput = (event: Event) => {
    const title = (event.target as HTMLElement).textContent || "";
    this.updateAttrs({ title });
  };

  handleToggle = (event: Event) => {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    this.updateAttrs({ open });
  };

  stopEvent(event: Event): boolean {
    // Keep summary editing and toggling in the DOM (don't let PM capture)
    if (event.target === this.summaryEl) {
      return true;
    }
    return false;
  }

  ignoreMutation(mutation: MutationRecord): boolean {
    // Ignore summary text and details open/close attr changes
    if (mutation.target === this.summaryEl) return true;
    if (mutation.target === this.dom && mutation.type === "attributes") {
      return true;
    }
    return false;
  }

  update(node: ProseMirrorNode) {
    this.node = node;
    // Sync title text if changed externally
    if (this.summaryEl.textContent !== node.attrs.title) {
      this.summaryEl.textContent = node.attrs.title || "";
    }
    // Sync open state
    if (node.attrs.open) {
      if (!this.dom.hasAttribute("open")) {
        this.dom.setAttribute("open", "open");
      }
    } else {
      if (this.dom.hasAttribute("open")) {
        this.dom.removeAttribute("open");
      }
    }
    return true;
  }

  destroy() {
    this.summaryEl.removeEventListener("input", this.handleSummaryInput);
    this.dom.removeEventListener("toggle", this.handleToggle);
  }

  private updateAttrs(attrs: Partial<{ title: string; open: boolean }>) {
    if (typeof this.getPos !== "function") return;
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      ...attrs,
    });
    this.view.dispatch(tr);
  }
}
