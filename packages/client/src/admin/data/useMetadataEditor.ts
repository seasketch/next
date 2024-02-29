import { useProseMirror } from "use-prosemirror";
import { metadata as editorConfig } from "../../editor/config";
import { useEffect, useRef, useState } from "react";
import { EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

const { schema, plugins } = editorConfig;

export default function useMetadataEditor({
  startingDocument,
  loading,
}: {
  startingDocument?: any;
  /* loading state of metadata fetch */
  loading: boolean;
}) {
  const [state, setState] = useProseMirror({ schema });
  const [changes, setChanges] = useState(false);
  const [originalDoc, setOriginalDoc] = useState<Node>();

  const viewRef = useRef<{ view: EditorView }>();

  useEffect(() => {
    if (!loading) {
      const doc = startingDocument
        ? Node.fromJSON(schema, startingDocument)
        : undefined;
      if (doc) {
        setOriginalDoc(doc);
      }
      // initial render
      const state = EditorState.create({
        schema: schema,
        plugins,
        doc,
      });
      setState(state);
    }
  }, [loading, setState, startingDocument]);

  return {
    state,
    hasChanges: changes,
    viewRef,
    schema,
    onChange: (state: EditorState) => {
      if (originalDoc && !state.doc.eq(originalDoc)) {
        setChanges(true);
      } else if (!originalDoc && !!state.doc) {
        setChanges(true);
      } else {
        setChanges(false);
      }
      setState(state);
    },
    // Call after calling save mutation
    reset: () => {
      setOriginalDoc(state.doc);
      setChanges(false);
    },
  };
}
