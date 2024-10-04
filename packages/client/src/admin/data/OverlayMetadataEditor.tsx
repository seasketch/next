import { Trans, useTranslation } from "react-i18next";
import {
  useGetMetadataQuery,
  useUpdateMetadataFromXmlMutation,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import Skeleton from "../../components/Skeleton";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import { ProseMirror } from "use-prosemirror";
import useMetadataEditor from "./useMetadataEditor";
import Warning from "../../components/Warning";
import EditorMenuBar from "../../editor/EditorMenuBar";
import useDialog from "../../components/useDialog";
import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export default function OverlayMetataEditor({
  id,
  registerPreventUnload,
}: {
  id: number;
  registerPreventUnload?: (id: string, message: string | undefined) => void;
}) {
  const { data, error, loading } = useGetMetadataQuery({
    variables: {
      itemId: id,
    },
  });
  const { t } = useTranslation("admin:data");
  const [mutation, mutationState] = useUpdateMetadataMutation();

  const usingDynamicMetadata = Boolean(
    data?.tableOfContentsItem?.usesDynamicMetadata
  );
  const dynamicMetadataAvailable =
    data?.tableOfContentsItem?.isCustomGlSource || false;

  const { state, hasChanges, viewRef, onChange, schema, reset } =
    useMetadataEditor({
      startingDocument: data?.tableOfContentsItem?.computedMetadata,
      loading,
    });

  const { confirm, loadingMessage } = useDialog();

  const xml = data?.tableOfContentsItem?.metadataXml
    ? {
        ...data.tableOfContentsItem.metadataXml,
        format: data.tableOfContentsItem.metadataFormat!,
      }
    : undefined;

  useEffect(() => {
    if (registerPreventUnload) {
      if (hasChanges) {
        registerPreventUnload(
          "OverlayMetadataEditor",
          t(
            "You have unsaved metadata changes. Are you sure you want to leave?"
          )
        );
        return () => {
          registerPreventUnload("OverlayMetadataEditor", undefined);
        };
      } else {
        registerPreventUnload("OverlayMetadataEditor", undefined);
      }
    }
  }, [hasChanges, registerPreventUnload, t]);

  const onError = useGlobalErrorHandler();

  const [uploadXMLMutation, uploadXMLMutationState] =
    useUpdateMetadataFromXmlMutation();

  const onUploadMetadataClick = useCallback(() => {
    // create an input element to trigger the file upload dialog
    var input = document.createElement("input");
    input.type = "file";
    // only accept xml files
    input.accept = ".xml";
    input.onchange = (e: any) => {
      if (e.target.files.length > 0 && id) {
        const file = e.target.files[0];
        // verify that the file is an xml file
        if (file.type !== "text/xml") {
          alert("Please upload an XML file");
          return;
        }
        const loader = loadingMessage(t("Reading XML metadata"));
        // read the xml file as a string
        const reader = new FileReader();
        reader.onload = async (e) => {
          let xml = e.target?.result;
          if (xml) {
            xml = xml.toString();
            try {
              loader.updateLoadingMessage(t("Uploading XML metadata"));
              const response = await uploadXMLMutation({
                variables: {
                  itemId: id!,
                  xml,
                  filename: file.name,
                },
              });
              loader.hideLoadingMessage();
              if (!response.errors?.length && viewRef.current?.view) {
                viewRef.current.view.focus();
                const tr = viewRef.current?.view.state.tr;
                const node = schema.nodeFromJSON(
                  response.data?.updateTocMetadataFromXML.computedMetadata
                );
                tr.replaceWith(
                  0,
                  viewRef.current?.view.state.doc.content.size,
                  node
                );
                viewRef.current?.view!.dispatch(tr);
              }
            } catch (e) {
              console.error(e);
              onError(e);
              loader.hideLoadingMessage();
            }
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [id, uploadXMLMutation, viewRef.current?.view]);

  return (
    <>
      {/* <h1>
        <Trans ns="admin:data">Metadata Editor</Trans>
      </h1> */}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="w-full h-8" />
          <div className="p-4">
            <Skeleton className="w-1/2 h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-7/12 h-4 mt-4" />
          </div>
        </div>
      )}
      {error && (
        <div className="p-4">
          <Warning level="error">{error.message}</Warning>
        </div>
      )}
      {!loading && !error && (
        <>
          {usingDynamicMetadata && (
            <Warning className="-mt-0.5" level="info">
              <p className="mb-2">
                <Trans ns="admin:data">
                  This layer is currently using dynamic metadata from the
                  service. Updates published to the origin server will be
                  reflected here.
                </Trans>
              </p>
              <Button
                onClick={async () => {
                  mutation({
                    variables: {
                      itemId: id,
                      metadata: state.doc.toJSON(),
                    },
                  }).then(reset);
                }}
                loading={mutationState.loading}
                small
                label={t("Convert to editable metadata")}
              />
            </Warning>
          )}
          <div
            className={`flex flex-col overflow-hidden ${
              usingDynamicMetadata ? "pointer-events-none opacity-20" : ""
            }`}
          >
            <EditorMenuBar
              tocId={id}
              showUploadOption={true}
              view={viewRef.current?.view}
              className="border-t border-b pl-0 bg-gray-100 shadow-sm mb-1 border-black border-opacity-10 flex-none"
              state={state}
              schema={schema}
              onUploadMetadataClick={onUploadMetadataClick}
              dynamicMetadataAvailable={dynamicMetadataAvailable}
            >
              <div className="flex-1 justify-end flex">
                <Button
                  disabled={!hasChanges}
                  primary
                  small
                  loading={mutationState.loading}
                  onClick={async () => {
                    mutation({
                      variables: {
                        itemId: id,
                        metadata: state.doc.toJSON(),
                      },
                    }).then(reset);
                  }}
                  label={t("Save changes")}
                />
              </div>
            </EditorMenuBar>
            <div className="p-4 pt-2 flex-1 overflow-y-auto">
              <ProseMirror
                className="metadata small-variant"
                state={state}
                onChange={onChange}
                // @ts-ignore
                ref={viewRef}
              />
              {!usingDynamicMetadata && xml && (
                <div className="mt-5 bg-blue-50 p-2 border rounded text-sm">
                  <Trans ns="homepage">
                    This layer includes metadata in {xml.format} XML format.
                  </Trans>
                  <div className="mt-1">
                    <a
                      href={xml.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white bg-primary-500 rounded px-1 py-0.5"
                      download={xml.filename}
                    >
                      <Trans ns="homepage">Download</Trans>
                    </a>
                    <button
                      onClick={onUploadMetadataClick}
                      className="bg-primary-500 text-white rounded px-1 ml-2"
                    >
                      <Trans ns="admin:data">Update</Trans>
                    </button>
                  </div>
                </div>
              )}
              {dynamicMetadataAvailable && !usingDynamicMetadata && (
                <Warning className="mt-6" level="info">
                  <p className="pb-4">
                    {t(
                      "Metadata from this ArcGIS Service has been customized within SeaSketch and will no longer show changes published from the origin server."
                    )}
                  </p>
                  <Button
                    small
                    loading={mutationState.loading}
                    label={t("Use metadata direct from the service")}
                    onClick={async () => {
                      if (
                        await confirm(t("Are you sure you want to proceed?"), {
                          description: t(
                            "Using dynamic service metadata will discard any changes you have made within SeaSketch."
                          ),
                        })
                      ) {
                        mutation({
                          variables: {
                            itemId: id,
                            metadata: null,
                          },
                        }).then(() => {
                          reset();
                        });
                      }
                    }}
                  />
                </Warning>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
