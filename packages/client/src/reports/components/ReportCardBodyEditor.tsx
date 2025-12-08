import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../../editor/config";
import { EditorView } from "prosemirror-view";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../../editor/TooltipMenu";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { FormLanguageContext } from "../../formElements/FormElement";
import SlashCommandPalette from "../../editor/slashCommands/SlashCommandPalette";
import { useSlashCommandPalette } from "../../editor/slashCommands/useSlashCommandPalette";
import { defaultSlashCommandItems } from "../../editor/slashCommands/plugin";
import { createReportCardEditorConfig } from "../../reports/utils/createReportCardEditorConfig";
import { MetricResolver } from "../../reports/utils/resolveMetric";
import ReactNodeViewPortalsProvider, {
  useReactNodeViewPortals,
} from "../ReactNodeView/PortalProvider";
import { createReactNodeView } from "../ReactNodeView";
import InlineMetric from "../nodeTypes/InlineMetric";
import { ReportWidgetNodeViewRouter } from "../nodeTypes/routers";

// Ensure legacy report bodies (saved before presenceBlock/absenceBlock existed) always
// have both presenceBlock and absenceBlock nodes at the end, each with at least one paragraph.
// Only applies when the active schema actually defines these nodes.
function ensurePresenceBlockJson(body: any, schema: any): any {
  if (!schema?.nodes?.presenceBlock || !schema?.nodes?.absenceBlock) {
    return body;
  }

  if (!body || body.type !== "doc" || !Array.isArray(body.content)) {
    return body;
  }

  const hasPresenceBlock = body.content.some(
    (node: any) => node && node.type === "presenceBlock"
  );
  const hasAbsenceBlock = body.content.some(
    (node: any) => node && node.type === "absenceBlock"
  );

  // If both already exist, return as-is
  if (hasPresenceBlock && hasAbsenceBlock) {
    return body;
  }

  const newContent = [...body.content];

  // Add presenceBlock if missing
  if (!hasPresenceBlock) {
    newContent.push({
      type: "presenceBlock",
      content: [
        {
          type: "paragraph",
        },
      ],
    });
  }

  // Add absenceBlock if missing (should always come after presenceBlock)
  if (!hasAbsenceBlock) {
    newContent.push({
      type: "absenceBlock",
      content: [
        {
          type: "paragraph",
        },
      ],
    });
  }

  return {
    ...body,
    content: newContent,
  };
}

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
   * Whether this is editing a footer (uses footer schema instead of body schema)
   */
  isFooter?: boolean;
  /**
   * Whether to expand the footer (only used for footer editor)
   */
  isExpanded?: boolean;
  /**
   * Callback to set the expanded state (only used for footer editor)
   */
  setIsExpanded?: Dispatch<SetStateAction<boolean>>;
  /**
   * Optional metric resolver for resolving metric node values
   */
  metricResolver?: MetricResolver;
}

function ReportCardBodyEditorInner({
  body,
  onUpdate,
  isInput = false,
  className = "",
  isFooter = false,
  isExpanded = false,
  setIsExpanded,
  metricResolver,
}: ReportCardBodyEditorProps) {
  // Use metrics-aware config if resolver is provided, otherwise use base config
  const editorConfigKey = isFooter ? "reportCardFooter" : "reportCardBody";
  const baseConfig = editorConfig[editorConfigKey];

  const { schema, plugins } = useMemo(() => {
    if (metricResolver) {
      return createReportCardEditorConfig(isFooter, metricResolver);
    }
    return baseConfig;
  }, [isFooter, metricResolver, baseConfig]);

  const langContext = useContext(FormLanguageContext);
  const currentLangCode = langContext?.lang?.code || "EN";

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

  const {
    slashState,
    slashItems,
    selectedIndex: selectedSlashIndex,
    anchor: paletteCoords,
    handleSelect: handleSlashSelect,
    handleHighlight: handleSlashHighlight,
  } = useSlashCommandPalette({
    schema,
    editorState: state,
    viewRef,
    rootRef: root,
    items: defaultSlashCommandItems,
  });

  const save = useDebouncedFn(
    (doc: any) => {
      onUpdate(doc.toJSON());
    },
    100,
    { leading: true, trailing: true },
    [onUpdate]
  );
  saveRef.current = save;

  useEffect(() => {
    const initialBody = initialBodyRef.current;
    const doc = initialBody
      ? Node.fromJSON(schema, ensurePresenceBlockJson(initialBody, schema))
      : undefined;
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
        const doc = Node.fromJSON(
          schema,
          ensurePresenceBlockJson(body, schema)
        );
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
      <TooltipMenu view={viewRef.current} state={state} schema={schema} />
      {isFooter && setIsExpanded && (
        <div className="absolute top-0 right-0 z-10">
          <button
            type="button"
            onClick={() => {
              setIsExpanded((prev) => !prev);
            }}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
      <div
        className={`ProseMirrorBody ReportCardBodyEditor ${
          isFooter && !isExpanded ? "ProseMirrorFooterHideBody" : ""
        }`}
        ref={root}
        onClick={() => {
          if (isFooter && !isExpanded && setIsExpanded) {
            setIsExpanded(true);
          }
        }}
      ></div>
      <SlashCommandPalette
        anchor={paletteCoords}
        isVisible={Boolean(slashState?.active)}
        items={slashItems}
        query={slashState?.query ?? ""}
        selectedIndex={selectedSlashIndex}
        onSelect={handleSlashSelect}
        onHighlight={handleSlashHighlight}
      />
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
