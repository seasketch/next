import { useEffect, useMemo, useRef, memo } from "react";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { reportBodySchema } from "../widgets/prosemirror/reportBodySchema";
import { createReactNodeView } from "../ReactNodeView";
import ReactNodeViewPortalsProvider, {
  useReactNodeViewPortals,
} from "../ReactNodeView/PortalProvider";

import "prosemirror-view/style/prosemirror.css";
import { ReportWidgetNodeViewRouter } from "../widgets/widgets";
import { DetailsView } from "../widgets/prosemirror/details";

type ReportCardBodyViewerProps = {
  body: any;
  className?: string;
  cardId: number;
};

function ReportCardBodyViewerInner({
  body,
  className = "",
  cardId,
}: ReportCardBodyViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const schema = useMemo(() => reportBodySchema, []);

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
          cardId,
        });
      },
      // @ts-ignore
      blockMetric(node, view, getPos, decorations) {
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
          cardId,
        });
      },
      // @ts-ignore
      details(node, view, getPos) {
        return new DetailsView(node, view, getPos as () => number);
      },
      // @ts-ignore
      reportTitle(node, view, getPos, decorations) {
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
          cardId,
        });
      },
    }),
    [createPortal, removePortal, cardId]
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
      dispatchTransaction: (transaction) => {
        const currentView = viewRef.current!;
        const newState = currentView.state.apply(transaction);
        currentView.updateState(newState);
        // Note: We don't persist changes in the viewer, but we allow
        // local state updates (e.g., for toggling collapsible blocks)
      },
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

  const baseClass = "ProseMirrorBody ReportCardBodyViewer";

  return (
    <div
      ref={rootRef}
      className={
        className && className.length > 0
          ? `${className} ${baseClass}`
          : baseClass
      }
    />
  );
}

export default memo(function ReportCardBodyViewer(props: ReportCardBodyViewerProps) {
  return (
    <ReactNodeViewPortalsProvider>
      <ReportCardBodyViewerInner {...props} />
    </ReactNodeViewPortalsProvider>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.cardId === nextProps.cardId &&
    prevProps.body === nextProps.body &&
    prevProps.className === nextProps.className
  );
});
