import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import { Node } from "prosemirror-model";
import { forumPosts as editorConfig } from "../../editor/config";

export default function PostContentEditor({
  initialContent,
  onChange,
  autofocus,
}: {
  initialContent: any;
  onChange: (content: any) => void;
  autofocus?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const viewRef = useRef<EditorView>();
  const { schema, plugins } = editorConfig;

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
  }, [onChange, plugins, schema]);

  return (
    <div
      className="prosemirror-body forum-post new-forum-post"
      ref={root}
    ></div>
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
