import React, { useEffect, useRef, useState } from "react";
import ModalDeprecated from "../components/ModalDeprecated";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import "prosemirror-menu/style/menu.css";
import Spinner from "../components/Spinner";
import "prosemirror-view/style/prosemirror.css";
import Button from "../components/Button";
import { useProseMirror, ProseMirror } from "use-prosemirror";
import { metadata as editorConfig } from "../editor/config";
import EditorMenuBar from "../editor/EditorMenuBar";
import { EditorView } from "prosemirror-view";
import { MutationResult } from "@apollo/client";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../components/useDialog";

const { schema, plugins } = editorConfig;
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
  const viewRef = useRef<{ view: EditorView }>();
  const { t } = useTranslation("admin");
  const { confirm } = useDialog();

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
      // view.current = new EditorView(viewHost.current!, { state });
      // applyDevTools(view.current);
      // return () => view.current!.destroy();
    }
  }, [loading]);

  return (
    <ModalDeprecated
      open={true}
      onRequestClose={() => {
        if (!changes && onRequestClose) {
          onRequestClose();
        }
      }}
      title={
        <div className="flex p-4 px-5 items-center">
          <div className="text-lg flex-1">
            <Trans ns="admin">Edit Metadata</Trans>
          </div>
          {changes && (
            <button
              disabled={mutationState.loading}
              onClick={async () => {
                if (
                  onRequestClose &&
                  (await confirm("Are you sure you want to discard changes?"))
                ) {
                  onRequestClose();
                }
              }}
              className="text-sm p-2 px-4"
            >
              <Trans ns="admin">Discard Changes</Trans>
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
            label={changes ? t(`Save and Close`) : t(`Close`)}
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
          schema={schema}
        />
        {error &&
          // eslint-disable-next-line
          `Error: ${error.message}`}
        {loading && <Spinner />}
        {/* {data && <div ref={viewHost} />} */}
        {!loading && !error && (
          <ProseMirror
            className="metadata"
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
    </ModalDeprecated>
  );
}
