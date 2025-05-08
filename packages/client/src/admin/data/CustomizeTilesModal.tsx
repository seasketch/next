import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import axios from "axios";
import Modal from "../../components/Modal";
import ProgressBar from "../../components/ProgressBar";
import {
  FullAdminSourceFragment,
  useGetPresignedPmTilesUploadUrlMutation,
  useReplacePmTilesMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export default function CustomizeTilesModal({
  onRequestClose,
  source,
}: {
  onRequestClose: () => void;
  source: Pick<FullAdminSourceFragment, "id" | "type">;
}) {
  const { t } = useTranslation("admin:data");
  const [mutation, mutationState] = useReplacePmTilesMutation();
  const [getPresignedUrl, getPresignedUrlState] =
    useGetPresignedPmTilesUploadUrlMutation();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const onError = useGlobalErrorHandler();
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const handleFileUpload = async (
    file: File,
    url: string,
    signal: AbortSignal
  ) => {
    try {
      await axios({
        url,
        method: "PUT",
        data: file,
        signal,
        headers: {
          "Content-Type": "application/vnd.pmtiles",
        },
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          setUploadProgress(progress);
        },
      });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      onError(error);
    }
  };

  return (
    <Modal
      title={t("Replace Tileset")}
      disableBackdropClick={mutationState.loading}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          disabled: mutationState.loading,
          onClick: () => {
            abortController?.abort();
            onRequestClose();
          },
        },
        {
          label: t("Choose a PMTiles file"),
          loading: mutationState.loading || uploadProgress !== null,
          disabled: mutationState.loading || uploadProgress !== null,
          onClick: () => {
            const ac = new AbortController();
            setAbortController(ac);
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pmtiles";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              const response = await getPresignedUrl({
                variables: {
                  bytes: file.size,
                  filename: file.name,
                },
              });
              if (!response.data) {
                alert("Failed to get presigned url");
                return;
              }
              const { url, key } = response.data.getPresignedPMTilesUploadUrl;
              try {
                await handleFileUpload(file, url, ac.signal);
                if (ac?.signal?.aborted) {
                  setUploadProgress(null);
                  onRequestClose();
                  return;
                }
                await mutation({
                  variables: {
                    dataSourceId: source.id,
                    pmtilesKey: key,
                  },
                });
                setUploadProgress(null);
                onRequestClose();
                // alert("File uploaded successfully");
              } catch (error) {
                if (error.name === "AbortError") {
                  return;
                }
                alert(error.message);
              }
            };
            input.click();
          },
          variant: "primary",
        },
      ]}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <Trans ns="admin:data">
            When you upload data to SeaSketch, the system creates a vector or
            raster tileset from the source upload. Sometimes it is desirable to
            build your own custom tileset as a replacement. For example, some
            global datasets may be too large to render in full detail within the
            limits of our hosted tiling system. You may want to use your
            workstation to create a full resolution tileset, which may take
            hours or days of processing.
          </Trans>
        </p>
        <p className="text-sm">
          <Trans ns="admin:data">
            <b className="font-bold">
              It is your responsibilty to ensure the tileset being uploaded is
              based on the same uploaded vector or raster source
            </b>
            . Otherwise there will be inconsistencies between data for download
            or analysis and what is presented on the map. Tilesets must be a{" "}
            <a
              className="text-primary-500"
              href="https://github.com/protomaps/PMTiles"
              target="_blank"
            >
              PMTiles
            </a>{" "}
            archive which contains a single layer.
          </Trans>
        </p>
      </div>
      {uploadProgress !== null && (
        <ProgressBar
          indeterminate={mutationState.loading}
          progress={mutationState.loading ? 0 : uploadProgress / 100}
        />
      )}
      {!mutationState.loading && uploadProgress !== null && (
        <div className="text-sm">
          <Trans ns="admin:data">
            Upload Progress: {uploadProgress.toFixed(1)}%
          </Trans>
        </div>
      )}
      {mutationState.loading && (
        <div className="text-sm">
          <Trans ns="admin:data">Server is processing the tileset...</Trans>
        </div>
      )}
    </Modal>
  );
}
