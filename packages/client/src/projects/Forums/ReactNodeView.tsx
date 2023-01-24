import { Node } from "prosemirror-model";
import { Decoration, EditorView, NodeView } from "prosemirror-view";
import React, { ReactPortal, useContext, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { nanoid } from "nanoid";

interface IReactNodeViewContext {
  node: Node;
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

type TGetPos = boolean | (() => number);

class ReactNodeView implements NodeView {
  componentRef: React.RefObject<HTMLDivElement>;
  // @ts-ignore
  dom?: HTMLElement;
  contentDOM?: HTMLElement;
  component: React.FC<any>;
  node: Node;
  view: EditorView;
  getPos: TGetPos;
  decorations: Decoration[];
  onDestroy: (key: string) => void;
  key?: string;

  constructor(
    node: Node,
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
    this.componentRef = React.createRef();
    this.onDestroy = onDestroy;
  }

  init() {
    this.dom = document.createElement("div");
    this.dom.classList.add("ProseMirror__dom");
    if (!this.node.isLeaf) {
      this.contentDOM = document.createElement("div");
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

  // toDOM(node: Node) {
  //   return [
  //     "div",
  //   ];
  // }

  renderPortal(container: HTMLElement) {
    const Component: React.FC = (props) => {
      const componentRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        const componentDOM = componentRef.current;
        if (componentDOM != null && this.contentDOM != null) {
          if (!this.node.isLeaf) {
            componentDOM.firstChild?.appendChild(this.contentDOM);
          }
        }
      }, [componentRef]);

      return (
        <div ref={componentRef} className="ProseMirror__reactComponent">
          <ReactNodeViewContext.Provider
            value={{
              node: this.node,
              view: this.view,
              getPos: this.getPos,
              decorations: this.decorations,
            }}
          >
            <this.component {...props} />
          </ReactNodeViewContext.Provider>
        </div>
      );
    };

    const key = nanoid();
    return {
      key,
      portal: ReactDOM.createPortal(<Component />, container, key),
    };
  }

  // setSelection(anchor: number, head: number, root: Document | ShadowRoot) {
  //   // console.log({ anchor, head, root });
  //   return;
  // }

  // setSelection⁠(
  //   anchor: number,
  //   head: number,
  //   root: Document | ShadowRoot
  // ) {
  //     console.log({anchor, head, root})
  //     return;
  //   }

  update(node: Node) {
    // see for reason: https://discuss.prosemirror.net/t/why-is-nodeview-update-called-with-different-node-types/4805
    if (node.type.name !== "sketch") {
      return false;
    }
    return true;
  }

  destroy() {
    this.dom = undefined;
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
