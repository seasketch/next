import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../../editor/config";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../../editor/TooltipMenu";

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
}

export default function ReportCardBodyEditor({
  body,
  onUpdate,
  isInput = false,
  className = "",
}: ReportCardBodyEditorProps) {
  const { schema, plugins } = editorConfig.reportCardBody;

  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();

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

  // Update editor state when body prop changes externally
  useEffect(() => {
    if (viewRef.current && body) {
      const doc = Node.fromJSON(schema, body);
      const newState = EditorState.create({
        schema,
        plugins,
        doc,
      });
      viewRef.current.updateState(newState);
      setState(newState);
    }
  }, [schema, plugins]);

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
      <div className="ProseMirrorBody ReportCardBodyEditor" ref={root}></div>
    </div>
  );
}
