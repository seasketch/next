import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../../editor/TooltipMenu";
import {
  BLUR_SELECTION_STYLES,
  createBlurSelectionPlugin,
} from "../../editor/blurSelectionPlugin";
import ActiveParagraphPlaceholderPlugin from "../../editor/ActiveParagraphPlaceholderPlugin";
import { FormLanguageContext } from "../../formElements/FormElement";
import { exampleSetup } from "prosemirror-example-setup";
import ReportTitlePlaceholderPlugin from "../../editor/ReportTitlePlaceholderPlugin";
import { createReportCardSchema } from "../utils/createReportCardSchema";
import ReactNodeViewPortalsProvider, {
  useReactNodeViewPortals,
} from "../ReactNodeView/PortalProvider";
import { createReactNodeView } from "../ReactNodeView";
import {
  ReportWidgetNodeViewRouter,
  buildReportCommandGroups,
} from "../widgets/widgets";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
} from "../../generated/graphql";
import { useSlashCommandPalette } from "../hooks/useSlashCommandPalette";
import { ReportContext } from "../ReportContext";

interface ReportCardBodyEditorProps {
  /**
   * The Prosemirror document to edit
   */
  body: any;
  /**
   * Callback when the document changes
   */
  onUpdate: (newBody: any) => void;
  /**
   * Whether this is an input field (affects editor configuration)
   */
  isInput?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   *
   */
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
}

function ReportCardBodyEditorInner({
  body,
  onUpdate,
  isInput = false,
  className = "",
  metrics,
  sources,
}: ReportCardBodyEditorProps) {
  const { schema, plugins } = useMemo(() => {
    const schema = createReportCardSchema();

    const plugins = [
      ...exampleSetup({ schema, menuBar: false }),
      ReportTitlePlaceholderPlugin(),
      createBlurSelectionPlugin(),
      ActiveParagraphPlaceholderPlugin(),
    ];
    return { schema, plugins };
  }, []);

  const langContext = useContext(FormLanguageContext);
  const currentLangCode = langContext?.lang?.code || "EN";

  const reportContext = useContext(ReportContext);

  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const lastLangCodeRef = useRef<string>(currentLangCode);
  const lastBodyRef = useRef<any>(body);
  const initialBodyRef = useRef<any>(body);
  const saveRef = useRef<((doc: any) => void) | null>(null);
  initialBodyRef.current = body;
  const { createPortal, removePortal, setSelection } =
    useReactNodeViewPortals();

  const save = useDebouncedFn(
    (doc: any) => {
      onUpdate(doc.toJSON());
    },
    100,
    { leading: true, trailing: true },
    [onUpdate]
  );
  saveRef.current = save;

  const contextualGroups = useMemo(
    () =>
      buildReportCommandGroups({
        sources,
        geographies: reportContext?.geographies,
        clippingGeography:
          reportContext?.sketchClass?.clippingGeographies?.[0]?.id,
        sketchClassGeometryType: reportContext?.sketchClass?.geometryType,
      }),
    [
      sources,
      reportContext?.geographies,
      reportContext?.sketchClass?.clippingGeographies,
      reportContext?.sketchClass?.geometryType,
    ]
  );

  const { palette: commandPalette } = useSlashCommandPalette({
    viewRef,
    state,
    schema,
    groups: contextualGroups,
  });

  useEffect(() => {
    const initialBody = initialBodyRef.current;
    const doc = initialBody ? Node.fromJSON(schema, initialBody) : undefined;
    const view = new EditorView(root.current!, {
      state: EditorState.create({
        schema,
        plugins,
        doc,
      }),
      nodeViews: {
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
          });
        },
      },
      dispatchTransaction: (transaction) => {
        const view = viewRef.current!;
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setState(newState);

        if (transaction.docChanged) {
          saveRef.current?.(newState.doc);
        }

        if (newState.selection) {
          setSelection({
            anchorPos: newState.selection.$anchor.pos,
            headPos: newState.selection.$head.pos,
          });
        } else {
          setSelection(null);
        }
      },
    });
    viewRef.current = view;
    setState(view.state);
    return () => {
      view.destroy();
    };
  }, [isInput, plugins, schema, createPortal, removePortal, setSelection]);

  // Update editor state when language changes (body will be different for different languages)
  useEffect(() => {
    if (viewRef.current && body) {
      const langChanged = lastLangCodeRef.current !== currentLangCode;

      // Always update when language changes to show the correct language's content
      if (langChanged) {
        const doc = Node.fromJSON(schema, body);
        const newState = EditorState.create({
          schema,
          plugins,
          doc,
        });
        viewRef.current.updateState(newState);
        setState(newState);

        lastLangCodeRef.current = currentLangCode;
        lastBodyRef.current = body;
      }
    }
  }, [body, schema, plugins, currentLangCode]);

  // Keep refs up to date with latest props
  useEffect(() => {
    lastLangCodeRef.current = currentLangCode;
    lastBodyRef.current = body;
  }, [body, currentLangCode]);

  return (
    <div className={`relative ${className}`}>
      <style>
        {
          // eslint-disable-next-line i18next/no-literal-string
          BLUR_SELECTION_STYLES
        }
      </style>
      <TooltipMenu view={viewRef.current} state={state} schema={schema} />
      {commandPalette}
      <div
        className={`ProseMirrorBody ReportCardBodyEditor ReportCardBody`}
        ref={root}
      ></div>
    </div>
  );
}

export default function ReportCardBodyEditor(props: ReportCardBodyEditorProps) {
  return (
    <ReactNodeViewPortalsProvider>
      <ReportCardBodyEditorInner {...props} />
    </ReactNodeViewPortalsProvider>
  );
}
