import { Trans, useTranslation } from "react-i18next";
import {
  useGetMetadataQuery,
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
import { Dispatch, SetStateAction, useEffect } from "react";
import Button from "../../components/Button";

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

  const { confirm } = useDialog();

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
