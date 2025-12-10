import { useEffect, useMemo, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { createReportCardSchema } from "../utils/createReportCardSchema";
import { createReactNodeView } from "../ReactNodeView";
import ReactNodeViewPortalsProvider, {
  useReactNodeViewPortals,
} from "../ReactNodeView/PortalProvider";

import "prosemirror-view/style/prosemirror.css";
import { ReportWidgetNodeViewRouter } from "../nodeTypes/routers";

type ReportCardBodyViewerProps = {
  body: any;
  className?: string;
};

function ReportCardBodyViewerInner({
  body,
  className = "",
}: ReportCardBodyViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const schema = useMemo(() => createReportCardSchema(), []);

  const nodeViews = useMemo(
    () => ({
      // @ts-ignore
      metric(node, view, getPos, decorations) {
        return createReactNodeView({
          node,
          view,
          // @ts-ignore
          getPos,
          // @ts-ignore
          decorations,
          component: ReportWidgetNodeViewRouter,
          onCreatePortal: createPortal,
          onDestroy: removePortal,
        });
      },
    }),
    [createPortal, removePortal]
  );

  // Create/destroy the view when core configuration changes
  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const initialState = EditorState.create({
      schema,
      doc: body ? Node.fromJSON(schema, body) : undefined,
    });

    const view = new EditorView(rootRef.current, {
      state: initialState,
      editable: () => false,
      nodeViews,
      // dispatchTransaction: (transaction) => {
      //   const currentView = viewRef.current!;
      //   const newState = currentView.state.apply(transaction);
      //   currentView.updateState(newState);

      //   if (newState.selection) {
      //     setSelection({
      //       anchorPos: newState.selection.$anchor.pos,
      //       headPos: newState.selection.$head.pos,
      //     });
      //   } else {
      //     setSelection(null);
      //   }
      // },
    });

    viewRef.current = view;

    return () => {
      setSelection(null);
      view.destroy();
      viewRef.current = undefined;
    };
  }, [schema, nodeViews, setSelection, body]);

  // Update the document when the body changes
  // cb - removed. might not be needed
  // useEffect(() => {
  //   if (!viewRef.current) {
  //     return;
  //   }
  //   const nextState = EditorState.create({
  //     schema,
  //     doc: body ? Node.fromJSON(schema, body) : undefined,
  //   });
  //   viewRef.current.updateState(nextState);
  // }, [body, schema]);

  // Without a body, render nothing
  if (!body) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={
        className && className.length > 0
          ? `${className} ProseMirrorBody`
          : "ProseMirrorBody"
      }
    />
  );
}

export default function ReportCardBodyViewer(props: ReportCardBodyViewerProps) {
  return (
    <ReactNodeViewPortalsProvider>
      <ReportCardBodyViewerInner {...props} />
    </ReactNodeViewPortalsProvider>
  );
}
