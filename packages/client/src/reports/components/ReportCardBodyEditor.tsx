import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../../editor/config";
import { EditorView } from "prosemirror-view";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../../editor/TooltipMenu";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { useContext } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";

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
}

export default function ReportCardBodyEditor({
  body,
  onUpdate,
  isInput = false,
  className = "",
  isFooter = false,
  isExpanded = false,
  setIsExpanded,
}: ReportCardBodyEditorProps) {
  const editorConfigKey = isFooter ? "reportCardFooter" : "reportCardBody";
  const { schema, plugins } = editorConfig[editorConfigKey];
  const langContext = useContext(FormLanguageContext);
  const currentLangCode = langContext?.lang?.code || "EN";

  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();
  const lastLangCodeRef = useRef<string>(currentLangCode);
  const lastBodyRef = useRef<any>(body);

  useEffect(() => {
    const doc = body ? Node.fromJSON(schema, body) : undefined;
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
          save(newState.doc);
        }
      },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
    };
  }, [isInput]); // Only recreate when isInput changes, not when body changes

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

  // Initialize refs on mount
  useEffect(() => {
    lastLangCodeRef.current = currentLangCode;
    lastBodyRef.current = body;
  }, []);

  const save = useDebouncedFn(
    (doc: any) => {
      onUpdate(doc.toJSON());
    },
    100,
    { leading: true, trailing: true },
    [onUpdate]
  );

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
    </div>
  );
}
