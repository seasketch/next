import { Trans, useTranslation } from "react-i18next";
import {
  GetMetadataDocument,
  useGetMetadataQuery,
  useUpdateMetadataFromXmlMutation,
  useUpdateMetadataMutation,
} from "../../generated/graphql";
import { ClockIcon } from "@heroicons/react/outline";
import Skeleton from "../../components/Skeleton";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import { ProseMirror } from "use-prosemirror";
import useMetadataEditor from "./useMetadataEditor";
import Warning from "../../components/Warning";
import EditorMenuBar from "../../editor/EditorMenuBar";
import useDialog from "../../components/useDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import Switch from "../../components/Switch";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";
import LayerMetadataRevisionModal from "./LayerMetadataRevisionModal";
import EsriRestUrlFooter from "../../dataLayers/EsriRestUrlFooter";
import HideArcGISRestLinkControl from "../../dataLayers/HideArcGISRestLinkControl";
import { esriRestUrlFromMetadataItem } from "../../dataLayers/esriRestUrl";
import MetadataFooterSetting from "../../dataLayers/MetadataFooterSetting";

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
  const [showHistory, setShowHistory] = useState(false);
  const changeLogRefetchQueries = useMemo(
    () => [...layerSettingsChangeLogRefetchQueries(id)],
    [id]
  );
  const [mutation, mutationState] = useUpdateMetadataMutation({
    refetchQueries: [
      ...changeLogRefetchQueries,
      { query: GetMetadataDocument, variables: { itemId: id } },
    ],
  });

  const usingDynamicMetadata = Boolean(
    data?.tableOfContentsItemByIdentifier?.usesDynamicMetadata
  );
  const dynamicMetadataAvailable =
    data?.tableOfContentsItemByIdentifier?.isCustomGlSource || false;
  const esriRestUrl = useMemo(
    () => esriRestUrlFromMetadataItem(data?.tableOfContentsItemByIdentifier),
    [data?.tableOfContentsItemByIdentifier]
  );
  const hideArcGisRestLink = Boolean(
    data?.tableOfContentsItemByIdentifier?.hideArcGisRestLink
  );

  const { state, hasChanges, viewRef, onChange, schema, reset } =
    useMetadataEditor({
      startingDocument: data?.tableOfContentsItemByIdentifier?.computedMetadata,
      loading,
    });

  const { confirm, loadingMessage } = useDialog();

  const xml = data?.tableOfContentsItemByIdentifier?.metadataXml
    ? {
        ...data.tableOfContentsItemByIdentifier.metadataXml,
        format: data.tableOfContentsItemByIdentifier.metadataFormat!,
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
    useUpdateMetadataFromXmlMutation({
      refetchQueries: changeLogRefetchQueries,
    });

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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className={
                usingDynamicMetadata ? "pointer-events-none opacity-20" : ""
              }
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
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  title={t("View metadata history")}
                  aria-label={t("View metadata history")}
                  className="overflow-hidden m-0 py-0 h-9 px-2 inline-flex items-center justify-center text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
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
            </div>
            <div className="relative flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
              <div
                className={
                  usingDynamicMetadata
                    ? "pointer-events-none opacity-20"
                    : ""
                }
              >
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
              </div>
              {esriRestUrl && !hideArcGisRestLink && (
                <EsriRestUrlFooter url={esriRestUrl} />
              )}
              {usingDynamicMetadata && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="h-1/3 flex items-center justify-center px-6">
                    <p className="max-w-xs text-center text-sm text-gray-700 bg-white/90 border border-gray-200 rounded-md shadow-sm px-4 py-3">
                      {t(
                        "Using dynamic service metadata. Disable this setting to customize content."
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {(esriRestUrl || dynamicMetadataAvailable) && (
              <div className="flex-none border-t border-gray-200 bg-white divide-y divide-gray-200">
                {dynamicMetadataAvailable && (
                  <MetadataFooterSetting
                    title={t("Use dynamic service metadata")}
                    description={t(
                      "When enabled, use metadata directly from the service, rather than customizing content in SeaSketch."
                    )}
                  >
                    <Switch
                      disabled={mutationState.loading}
                      isToggled={usingDynamicMetadata}
                      onClick={async (next) => {
                        if (next === usingDynamicMetadata) {
                          return;
                        }
                        if (next) {
                          if (
                            await confirm(
                              t("Are you sure you want to proceed?"),
                              {
                                description: t(
                                  "Using dynamic service metadata will discard any changes you have made within SeaSketch."
                                ),
                              }
                            )
                          ) {
                            mutation({
                              variables: {
                                itemId: id,
                                metadata: null,
                              },
                            }).then(reset);
                          }
                        } else {
                          mutation({
                            variables: {
                              itemId: id,
                              metadata: state.doc.toJSON(),
                            },
                          }).then(reset);
                        }
                      }}
                    />
                  </MetadataFooterSetting>
                )}
                {esriRestUrl && (
                  <HideArcGISRestLinkControl
                    itemId={id}
                    hideArcGisRestLink={hideArcGisRestLink}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showHistory && (
        <LayerMetadataRevisionModal
          tableOfContentsItemId={id}
          onRequestClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
