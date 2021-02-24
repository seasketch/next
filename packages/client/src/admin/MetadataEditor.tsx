import React, { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { Node } from "prosemirror-model";
import "prosemirror-menu/style/menu.css";
import Spinner from "../components/Spinner";
import "prosemirror-view/style/prosemirror.css";
import Button from "../components/Button";
import { useProseMirror, ProseMirror } from "use-prosemirror";
import { schema, plugins } from "../editor/config";
import EditorMenuBar from "../editor/EditorMenuBar";
import { EditorView } from "prosemirror-view";
import { MutationResult } from "@apollo/client";

interface MetadataEditorProps {
  onRequestClose?: () => void;
  /* state of the mutation */
  mutationState: MutationResult;
  /* function to call which mutates the metadata document */
  mutation: (value: any) => Promise<any>;
  /* loading state of metadata fetch */
  loading: boolean;
  /* any errors from loading the current metadata document */
  error?: Error;
  /* metadata document as json */
  startingDocument?: any;
}

export default function MetadataEditor({
  onRequestClose,
  mutationState,
  mutation,
  loading,
  error,
  startingDocument,
}: MetadataEditorProps) {
  const [state, setState] = useProseMirror({ schema });
  const [changes, setChanges] = useState(false);
  const [originalDoc, setOriginalDoc] = useState<Node>();
  // const viewHost = useRef<HTMLDivElement>(null);
  const viewRef = useRef<{ view: EditorView }>();

  useEffect(() => {
    if (!loading) {
      const doc = startingDocument
        ? Node.fromJSON(schema, startingDocument)
        : null;
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
      // view.current = new EditorView(viewHost.current!, { state });
      // applyDevTools(view.current);
      // return () => view.current!.destroy();
    }
  }, [loading]);

  return (
    <Modal
      open={true}
      onRequestClose={() => {
        if (!changes && onRequestClose) {
          onRequestClose();
        }
      }}
      title={
        <div className="flex p-4 px-5 items-center">
          <div className="text-lg flex-1">Edit Metadata</div>
          {changes && (
            <button
              disabled={mutationState.loading}
              onClick={() => {
                if (
                  onRequestClose &&
                  window.confirm("Are you sure you want to discard changes?")
                ) {
                  onRequestClose();
                }
              }}
              className="text-sm p-2 px-4"
            >
              Discard Changes
            </button>
          )}
          <Button
            loading={mutationState.loading}
            disabled={mutationState.loading}
            className=""
            onClick={async () => {
              if (changes) {
                await mutation(state.doc.toJSON());
                onRequestClose && onRequestClose();
              } else {
                onRequestClose && onRequestClose();
              }
            }}
            label={changes ? `Save and Close` : `Close`}
            primary={changes}
          />
        </div>
      }
    >
      <div className="w-full h-full sm:h-auto md:w-160 lg:pb-4 relative">
        <EditorMenuBar
          view={viewRef.current?.view}
          className="-mt-6 -ml-6 mb-2"
          style={{ width: "calc(100% + 3rem)" }}
          state={state}
        />
        {error && `Error: ${error.message}`}
        {loading && <Spinner />}
        {/* {data && <div ref={viewHost} />} */}
        {!loading && !error && (
          <ProseMirror
            // @ts-ignore
            ref={viewRef}
            state={state}
            onChange={(state) => {
              if (originalDoc && !state.doc.eq(originalDoc)) {
                setChanges(true);
              } else if (!originalDoc && !!state.doc) {
                setChanges(true);
              } else {
                setChanges(false);
              }
              setState(state);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
