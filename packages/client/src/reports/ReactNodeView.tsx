import { Node as PMNode } from "prosemirror-model";
import { Decoration, EditorView, NodeView } from "prosemirror-view";
import React, {
  ReactPortal,
  useContext,
  useEffect,
  useRef,
  createRef,
} from "react";
import ReactDOM from "react-dom";
import { nanoid } from "nanoid";
import { ReactNodeViewPortalsContext } from "./ReactNodeView/PortalProvider";

type TGetPos = boolean | (() => number);

interface IReactNodeViewContext {
  node: PMNode;
  view: EditorView;
  getPos: TGetPos;
  decorations: Decoration[];
}

const ReactNodeViewContext = React.createContext<
  Partial<IReactNodeViewContext>
>({
  node: undefined,
  view: undefined,
  getPos: undefined,
  decorations: undefined,
});

class ReactNodeView implements NodeView {
  componentRef: React.RefObject<HTMLDivElement>;
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  component: React.FC<any>;
  node: PMNode;
  view: EditorView;
  getPos: TGetPos;
  decorations: Decoration[];
  onDestroy: (key: string) => void;
  key?: string;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: TGetPos,
    decorations: Decoration[],
    component: React.FC<any>,
    onDestroy: (key: string) => void
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.decorations = decorations;
    this.component = component;
    this.componentRef = createRef();
    this.onDestroy = onDestroy;
    // Use inline-friendly element for inline nodes, block for others.
    const tagName = node.isInline ? "span" : "div";
    this.dom = document.createElement(tagName);
  }

  init() {
    this.dom.classList.add("ProseMirror__dom");
    if (!this.node.isLeaf) {
      const contentTag = this.node.isInline ? "span" : "div";
      this.contentDOM = document.createElement(contentTag);
      this.contentDOM.classList.add("ProseMirror__contentDOM");
      this.dom.appendChild(this.contentDOM);
    }

    const { portal, key } = this.renderPortal(this.dom);
    this.key = key;
    return {
      nodeView: this,
      portal,
      key,
    };
  }

  renderPortal(container: HTMLElement) {
    const Component: React.FC = (props) => {
      const componentRef = useRef<HTMLElement>(null);

      useEffect(() => {
        const componentDOM = componentRef.current;
        if (componentDOM != null && this.contentDOM != null) {
          if (!this.node.isLeaf) {
            componentDOM.firstChild?.appendChild(this.contentDOM);
          }
        }
      }, [componentRef]);

      const portalContext = useContext(ReactNodeViewPortalsContext);
      useEffect(() => {
        if (portalContext.selection && typeof this.getPos === "function") {
          const pos = this.getPos();
          if (
            pos <
              Math.max(
                portalContext.selection.anchorPos,
                portalContext.selection.headPos
              ) &&
            pos >=
              Math.min(
                portalContext.selection.anchorPos,
                portalContext.selection.headPos
              )
          ) {
            this.dom?.classList.add("ProseMirror-selectednode");
            return;
          }
        }
        this.dom?.classList.remove("ProseMirror-selectednode");
      }, [portalContext.selection]);

      // Use span for inline nodes to avoid forcing block layout; div otherwise.
      return React.createElement(
        this.node.isInline ? "span" : "div",
        { ref: componentRef, className: "ProseMirror__reactComponent" },
        <ReactNodeViewContext.Provider
          value={{
            node: this.node,
            view: this.view,
            getPos: this.getPos,
            decorations: this.decorations,
          }}
        >
          <this.component {...props} node={this.node} />
        </ReactNodeViewContext.Provider>
      );
    };

    const key = nanoid();
    return {
      key,
      portal: ReactDOM.createPortal(<Component />, container, key),
    };
  }

  update(node: PMNode) {
    if (node.type.name !== this.node.type.name) {
      return false;
    }
    this.node = node;
    return true;
  }

  destroy() {
    this.contentDOM = undefined;
    if (this.key) {
      this.onDestroy(this.key);
    }
  }
}

interface TCreateReactNodeView extends IReactNodeViewContext {
  component: React.FC<any>;
  onCreatePortal: (key: string, portal: ReactPortal) => void;
  onDestroy: (key: string) => void;
}

export const createReactNodeView = ({
  node,
  view,
  getPos,
  decorations,
  component,
  onCreatePortal,
  onDestroy,
}: TCreateReactNodeView) => {
  const reactNodeView = new ReactNodeView(
    node,
    view,
    getPos,
    decorations,
    component,
    onDestroy
  );
  const { nodeView, portal, key } = reactNodeView.init();

  onCreatePortal(key, portal);

  return nodeView;
};

export const useReactNodeView = () => useContext(ReactNodeViewContext);

export default ReactNodeView;
