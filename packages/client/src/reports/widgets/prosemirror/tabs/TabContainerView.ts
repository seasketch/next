import { Node as PMNode } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { EditorView, NodeView } from "prosemirror-view";
import {
  getSelectedCardTabId,
  indexOfCardTabId,
  setSelectedCardTabId,
  tabIdAtIndex,
} from "./selectedCardTab";

export type TabContainerViewOptions = {
  /** Show every panel (print / print-prep subtree). */
  forceShowAll?: boolean;
  tabListLabel?: string;
  /** Used to remember the selected tab across view/edit remounts. */
  cardId?: number;
};

function controlSignature(node: PMNode): string {
  const labels: string[] = [];
  node.forEach((panel) => {
    labels.push(
      typeof panel.attrs.label === "string" ? panel.attrs.label : ""
    );
  });
  return `${node.childCount}\0${labels.join("\0")}`;
}

export class TabContainerView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private control: HTMLElement;
  private getPos: () => number;
  private view: EditorView;
  private forceShowAll: boolean;
  private tabListLabel: string;
  private cardId?: number;
  private activeIndex = 0;
  private printingPreviewActive = false;
  private lastControlSignature = "";
  private destroyed = false;
  private caretRaf = 0;

  private readonly onBeforePrint = () => {
    this.printingPreviewActive = true;
    this.applyVisibility();
  };

  private readonly onAfterPrint = () => {
    this.printingPreviewActive = false;
    this.applyVisibility();
  };

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number,
    options?: TabContainerViewOptions
  ) {
    this.view = view;
    this.getPos = getPos;
    this.forceShowAll = options?.forceShowAll === true;
    this.tabListLabel = options?.tabListLabel || "Tabs";
    this.cardId = options?.cardId;
    this.activeIndex = indexOfCardTabId(
      node,
      this.cardId !== undefined
        ? getSelectedCardTabId(this.cardId)
        : undefined
    );
    this.persistActiveTab(node);

    this.dom = document.createElement("div");
    this.dom.setAttribute("data-report-tabs", "true");
    this.dom.className = "report-tabs";

    this.control = document.createElement("div");
    this.control.className = "report-tabs-control";
    this.control.contentEditable = "false";
    this.dom.appendChild(this.control);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "report-tabs-panels";
    this.contentDOM.setAttribute("data-report-tabs-panels", "true");
    this.dom.appendChild(this.contentDOM);

    this.rebuildControl(node);
    this.applyVisibility();
    if (this.view.editable && !this.showingAll()) {
      this.caretRaf = requestAnimationFrame(() => {
        this.caretRaf = 0;
        if (this.destroyed) {
          return;
        }
        this.placeCaretInActivePanel();
      });
    }

    if (typeof window !== "undefined") {
      window.addEventListener("beforeprint", this.onBeforePrint);
      window.addEventListener("afterprint", this.onAfterPrint);
    }
  }

  private showingAll() {
    return this.forceShowAll || this.printingPreviewActive;
  }

  private rebuildControl(node: PMNode) {
    this.lastControlSignature = controlSignature(node);
    this.control.replaceChildren();
    const track = document.createElement("div");
    track.className = "report-tabs-track";
    track.setAttribute("role", "tablist");
    track.setAttribute("aria-label", this.tabListLabel);

    const count = node.childCount;
    if (this.activeIndex >= count) {
      this.activeIndex = Math.max(0, count - 1);
    }

    node.forEach((panel, _offset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "report-tabs-tab";
      button.setAttribute("role", "tab");
      button.setAttribute("tabindex", index === this.activeIndex ? "0" : "-1");
      button.setAttribute(
        "aria-selected",
        index === this.activeIndex ? "true" : "false"
      );
      const label =
        typeof panel.attrs.label === "string" && panel.attrs.label.trim()
          ? panel.attrs.label
          : "Tab";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selectTab(index);
      });
      track.appendChild(button);
    });

    this.control.appendChild(track);
  }

  private selectTab(index: number) {
    if (this.showingAll()) {
      return;
    }
    if (this.activeIndex === index) {
      this.placeCaretInActivePanel();
      return;
    }
    this.activeIndex = index;
    this.persistActiveTabFromView();
    this.applyVisibility();
    this.syncSelectedAttrs();
    this.placeCaretInActivePanel();
  }

  private persistActiveTab(node: PMNode) {
    if (this.cardId === undefined) {
      return;
    }
    const tabId = tabIdAtIndex(node, this.activeIndex);
    if (tabId) {
      setSelectedCardTabId(this.cardId, tabId);
    }
  }

  private persistActiveTabFromView() {
    const pos = this.getPos();
    if (pos === undefined || pos === null) {
      return;
    }
    const current = this.view.state.doc.nodeAt(pos);
    if (!current || current.type.name !== "tabContainer") {
      return;
    }
    this.persistActiveTab(current);
  }

  private placeCaretInActivePanel() {
    if (this.destroyed || !this.view.editable) {
      return;
    }
    const pos = this.getPos();
    if (pos === undefined || pos === null) {
      return;
    }
    const current = this.view.state.doc.nodeAt(pos);
    if (!current || current.type.name !== "tabContainer") {
      return;
    }
    if (this.activeIndex >= current.childCount) {
      return;
    }
    let offset = pos + 1;
    for (let i = 0; i < this.activeIndex; i++) {
      offset += current.child(i).nodeSize;
    }
    try {
      const $pos = this.view.state.doc.resolve(offset + 1);
      const selection = TextSelection.near($pos);
      this.view.dispatch(this.view.state.tr.setSelection(selection));
      this.view.focus();
    } catch {
      // Panel boundary can be briefly invalid during a parent document replace.
    }
  }

  private syncSelectedAttrs() {
    const buttons = this.control.querySelectorAll(".report-tabs-tab");
    buttons.forEach((button, index) => {
      const selected = index === this.activeIndex;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.setAttribute("tabindex", selected ? "0" : "-1");
    });
  }

  /**
   * Visibility lives on this.dom (NodeView-owned), never on panel children.
   * ProseMirror rewrites contentDOM children from toDOM and would strip
   * classes we put on the panels.
   */
  private applyVisibility() {
    const showAll = this.showingAll();
    this.dom.setAttribute("data-show-all", showAll ? "true" : "false");
    this.dom.setAttribute("data-active-index", String(this.activeIndex));
  }

  update(node: PMNode) {
    if (node.type.name !== "tabContainer") {
      return false;
    }
    if (this.activeIndex >= node.childCount) {
      this.activeIndex = Math.max(0, node.childCount - 1);
      this.persistActiveTab(node);
    }
    const signature = controlSignature(node);
    if (signature !== this.lastControlSignature) {
      this.rebuildControl(node);
    } else {
      this.syncSelectedAttrs();
    }
    this.applyVisibility();
    return true;
  }

  ignoreMutation(mutation: MutationRecord) {
    if (this.control.contains(mutation.target)) {
      return true;
    }
    return mutation.type === "attributes" && mutation.target === this.dom;
  }

  stopEvent(event: Event) {
    return this.control.contains(event.target as Node);
  }

  destroy() {
    this.destroyed = true;
    if (this.caretRaf) {
      cancelAnimationFrame(this.caretRaf);
      this.caretRaf = 0;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeprint", this.onBeforePrint);
      window.removeEventListener("afterprint", this.onAfterPrint);
    }
  }
}
