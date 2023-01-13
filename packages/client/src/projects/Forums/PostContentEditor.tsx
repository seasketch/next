import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Node } from "prosemirror-model";
import { forumPosts as editorConfig } from "../../editor/config";
import { createReactNodeView } from "./ReactNodeView";
import { useReactNodeViewPortals } from "./ReactNodeView/PortalProvider";
import SketchNodeView from "./SketchNodeView";
import EditorMenuBar from "../../editor/EditorMenuBar";

export default function PostContentEditor({
  initialContent,
  onChange,
  autofocus,
  onSubmit,
  disabled,
}: {
  initialContent: any;
  onChange: (content: any) => void;
  autofocus?: boolean;
  onSubmit?: (content: any) => void;
  disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const viewRef = useRef<EditorView>();
  const { schema, plugins } = editorConfig;
  const editable = useRef(!disabled);
  const { createPortal, removePortal } = useReactNodeViewPortals();

  useEffect(() => {
    editable.current = !disabled;
    if (viewRef.current && state) {
      viewRef.current.updateState(state!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    let doc: Node | undefined;
    try {
      doc = initialContent ? Node.fromJSON(schema, initialContent) : undefined;
    } catch (e) {
      doc = undefined;
    }
    const view = new EditorView(root.current!, {
      state: EditorState.create({
        schema,
        plugins,
        doc,
      }),
      menu: false,
      editable: () => {
        return editable.current;
      },
      nodeViews: {
        // @ts-ignore
        sketch(node, view, getPos, decorations) {
          return createReactNodeView({
            node,
            view,
            getPos,
            // @ts-ignore
            decorations,
            component: SketchNodeView,
            onCreatePortal: createPortal,
            onDestroy: removePortal,
          });
        },
      },
      dispatchTransaction: (transaction) => {
        const view = viewRef.current!;
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setState(newState);
        if (transaction.docChanged) {
          onChange(newState.doc.toJSON());
        }
      },
    });
    viewRef.current = view;
    if (autofocus) {
      viewRef.current.focus();
      placeCaretAtEnd(viewRef.current.dom);
    }
    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, plugins, schema, createPortal, removePortal]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<any>) => {
      if (onSubmit && state) {
        if (e.metaKey && e.key === "Enter") {
          onSubmit(state.doc.toJSON());
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [state, onSubmit]
  );

  return (
    <>
      <div
        className={`prosemirror-body forum-post new-forum-post ${
          disabled === true ? "opacity-50" : "opacity-100"
        }`}
        onKeyDown={onKeyDown}
        ref={root}
      ></div>
      <EditorMenuBar
        view={viewRef.current}
        className=" border-t"
        style={{
          backgroundColor: "rgb(252, 252, 252)",
        }}
        state={state}
        schema={schema}
      />
    </>
  );
}

// from https://stackoverflow.com/questions/4233265/contenteditable-set-caret-at-the-end-of-the-text-cross-browser
function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  if (
    typeof window.getSelection != "undefined" &&
    typeof document.createRange != "undefined"
  ) {
    var range = document.createRange();
    // @ts-ignore
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // @ts-ignore
  } else if (typeof document.body.createTextRange != "undefined") {
    // @ts-ignore
    var textRange = document.body.createTextRange();
    textRange.moveToElementText(el);
    textRange.collapse(false);
    textRange.select();
  }
}
