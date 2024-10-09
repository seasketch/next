import "prosemirror-menu/style/menu.css";
import Spinner from "../components/Spinner";
import "prosemirror-view/style/prosemirror.css";
import Button from "../components/Button";
import { ProseMirror } from "use-prosemirror";
import { metadata as editorConfig } from "../editor/config";
import EditorMenuBar from "../editor/EditorMenuBar";
import { MutationResult } from "@apollo/client";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../components/useDialog";
import Modal from "../components/Modal";
import { Pencil1Icon } from "@radix-ui/react-icons";
import useMetadataEditor from "./data/useMetadataEditor";
import { MetadataXmlFileFragment } from "../generated/graphql";

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
  /* whether the metadata document is using dynamic metadata from a CustomGLSource */
  usingDynamicMetadata?: boolean;
  dynamicMetadataAvailable?: boolean;
  xml?: (MetadataXmlFileFragment & { format: string }) | null;
}

export default function MetadataEditor({
  onRequestClose,
  mutationState,
  mutation,
  loading,
  error,
  startingDocument,
  usingDynamicMetadata,
  dynamicMetadataAvailable,
  xml,
}: MetadataEditorProps) {
  const { t } = useTranslation("admin");
  const { confirm } = useDialog();

  const { state, hasChanges, viewRef, onChange } = useMetadataEditor({
    startingDocument,
    loading,
  });

  return (
    <Modal
      onRequestClose={() => {
        if (!hasChanges && onRequestClose) {
          onRequestClose();
        }
      }}
      disableBackdropClick={true}
      title={
        <div className="w-full flex items-center">
          <div className="text-lg flex-1">
            <Trans ns="admin">Edit Metadata</Trans>
          </div>
          {hasChanges && (
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
          {usingDynamicMetadata && (
            <Button
              loading={mutationState.loading}
              className="mr-2"
              onClick={async () => {
                mutation(state.doc.toJSON());
              }}
              label={
                <>
                  <Trans ns="admin:data">Convert to editable metadata</Trans>
                  <Pencil1Icon className="ml-2" />
                </>
              }
            />
          )}
          <Button
            loading={mutationState.loading}
            disabled={mutationState.loading}
            className=""
            onClick={async () => {
              if (hasChanges) {
                await mutation(state.doc.toJSON());
                onRequestClose && onRequestClose();
              } else {
                onRequestClose && onRequestClose();
              }
            }}
            label={hasChanges ? t(`Save and Close`) : t(`Close`)}
            primary={hasChanges}
          />
        </div>
      }
    >
      {usingDynamicMetadata && (
        <div className="text-sm py-4 italic text-center">
          <Trans ns="admin:data">
            This layer is currently using dynamic metadata from the service
            which cannot be edited.
          </Trans>
        </div>
      )}
      <div
        className={`relative min-w-full ${
          usingDynamicMetadata ? "pointer-events-none opacity-20" : ""
        }`}
      >
        <EditorMenuBar
          showUploadOption={true}
          view={viewRef.current?.view}
          className="border-t border-b mb-4 pl-0"
          state={state}
          schema={schema}
          dynamicMetadataAvailable={dynamicMetadataAvailable}
          onUseServiceMetadata={
            usingDynamicMetadata
              ? undefined
              : async () => {
                  if (
                    await confirm(
                      t(
                        "Using dynamic service metadata will discard any changes you have made to the metadata. Are you sure you want to proceed?"
                      )
                    )
                  ) {
                    mutation(null);
                  }
                }
          }
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
            onChange={onChange}
          />
        )}
        {xml && (
          <div className="mt-5 bg-blue-50 p-2 border rounded text-sm">
            <Trans ns="homepage">
              This layer includes metadata in {xml.format} XML format, available
              for{" "}
            </Trans>
            <a
              href={xml.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
              download={xml.filename}
            >
              <Trans ns="homepage">Download</Trans>
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
