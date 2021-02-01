import React, { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import {
  useGetMetadataQuery,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { Schema, DOMParser, Node } from "prosemirror-model";
import "prosemirror-menu/style/menu.css";
import applyDevTools from "prosemirror-dev-tools";
import Spinner from "../../components/Spinner";
import "prosemirror-view/style/prosemirror.css";
import Button from "../../components/Button";
import { useProseMirror, ProseMirror } from "use-prosemirror";
import { schema, plugins } from "../../editor/config";
import EditorMenuBar from "../../editor/EditorMenuBar";
import { EditorView } from "prosemirror-view";

interface MetadataEditorProps {
  onRequestClose?: () => void;
  id: number;
}

export default function MetadataEditor({
  onRequestClose,
  id,
}: MetadataEditorProps) {
  const { data, error, loading } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
  });
  const [state, setState] = useProseMirror({ schema });
  const [changes, setChanges] = useState(false);
  const [originalDoc, setOriginalDoc] = useState<Node>();
  const [mutation, mutationState] = useUpdateMetadataMutation();
  // const viewHost = useRef<HTMLDivElement>(null);
  const viewRef = useRef<{ view: EditorView }>();

  useEffect(() => {
    if (data && !originalDoc) {
      const doc = data.tableOfContentsItem?.metadata
        ? Node.fromJSON(schema, data.tableOfContentsItem?.metadata)
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
  }, [data]);

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
                await mutation({
                  variables: {
                    itemId: id,
                    metadata: state.doc.toJSON(),
                  },
                });
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
        {loading && <Spinner />}
        {/* {data && <div ref={viewHost} />} */}
        {data && (
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
