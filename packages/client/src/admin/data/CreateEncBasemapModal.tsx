import { useContext, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { useApolloClient } from "@apollo/client";
import Modal from "../../components/Modal";
import TextInput from "../../components/TextInput";
import ProgressBar from "../../components/ProgressBar";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useProjectId from "../../useProjectId";
import { BasemapContext } from "../../dataLayers/BasemapContext";
import {
  GetBasemapsAndRegionDocument,
  GetBasemapsDocument,
  useCreateEncBasemapUploadMutation,
  useEncBasemapJobQuery,
  useSubmitEncBasemapUploadMutation,
} from "../../generated/graphql";

async function putFile(url: string, file: File, contentType: string) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

export default function CreateEncBasemapModal({
  onRequestClose,
  onSave,
}: {
  onRequestClose: () => void;
  onSave?: (basemapId: number) => void;
}) {
  const { t } = useTranslation("admin");
  const projectId = useProjectId();
  const onError = useGlobalErrorHandler();
  const basemapContext = useContext(BasemapContext);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [attested, setAttested] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [createUpload] = useCreateEncBasemapUploadMutation();
  const [submitUpload] = useSubmitEncBasemapUploadMutation();
  const client = useApolloClient();

  const job = useEncBasemapJobQuery({
    variables: { jobId: jobId || "" },
    skip: !jobId,
    pollInterval: 1000,
    onError,
  });
  const jobState = job.data?.encBasemapJob;
  const failed = jobState?.state === "failed";
  const complete = jobState?.state === "complete" && jobState.basemapId != null;
  const busy = phase != null && !failed && !complete;

  const dropzone = useDropzone({
    disabled: busy || complete,
    multiple: true,
    onDrop: (accepted) => {
      setFiles((current) => {
        const next = [...current];
        for (const file of accepted) {
          if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) {
            next.push(file);
          }
        }
        if (!name && next[0]) {
          setName(next[0].name.replace(/\.(zip|000)$/i, ""));
        }
        return next;
      });
    },
  });

  const build = async () => {
    if (!projectId || files.length === 0 || !name.trim() || !attested) return;
    try {
      setPhase(t("Uploading charts"));
      const created = await createUpload({
        variables: {
          projectId,
          name: name.trim(),
          filenames: files.map((file) => file.name),
        },
      });
      const upload = created.data?.createEncBasemapUpload;
      if (!upload) throw new Error(t("Could not start the upload"));
      const byName = new Map(files.map((file) => [file.name, file]));
      for (const target of upload.uploads) {
        const file =
          byName.get(target.filename) ||
          files.find((candidate) => candidate.name.replace(/[^A-Za-z0-9._-]/g, "_") === target.filename);
        if (!file) throw new Error(t("A chart file was missing"));
        await putFile(target.url, file, target.contentType);
      }
      setPhase(t("Building the chart"));
      setJobId(upload.jobId);
      await submitUpload({ variables: { jobId: upload.jobId } });
    } catch (error) {
      setPhase(null);
      onError(error);
    }
  };

  const finish = async () => {
    const basemapId = jobState?.basemapId;
    await client.refetchQueries({
      include: [GetBasemapsDocument, GetBasemapsAndRegionDocument],
    });
    if (basemapId != null) {
      onSave?.(basemapId);
      basemapContext.setSelectedBasemap(basemapId);
    }
    onRequestClose();
  };

  return (
    <Modal
      title={t("Nautical chart")}
      onRequestClose={onRequestClose}
      disableBackdropClick={busy}
      scrollable
      panelClassName="max-w-lg"
      footer={
        complete
          ? [
              {
                label: t("Show on map"),
                variant: "primary",
                onClick: finish,
              },
            ]
          : [
              {
                label: t("Cancel"),
                variant: "secondary",
                disabled: busy,
                onClick: onRequestClose,
              },
              {
                label: t("Build chart"),
                variant: "primary",
                loading: busy,
                disabled: files.length === 0 || !name.trim() || !attested || busy,
                onClick: build,
              },
            ]
      }
    >
      <p className="text-sm text-gray-600 mb-3">
        <Trans ns="admin">
          Drop one or more unencrypted S-57 ENC files (.zip or .000). SeaSketch
          turns them into a single chart basemap. The chart is public, and it
          is not for navigation.
        </Trans>
      </p>
      <div
        {...dropzone.getRootProps()}
        className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center text-sm text-gray-600 cursor-pointer mb-3"
      >
        <input {...dropzone.getInputProps()} />
        {t("Drop chart files here, or click to choose them.")}
      </div>
      {files.length > 0 && (
        <ul className="text-sm mb-3 max-h-32 overflow-y-auto">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex justify-between gap-2">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="text-gray-500"
                disabled={busy || complete}
                onClick={() =>
                  setFiles((current) => current.filter((candidate) => candidate !== file))
                }
              >
                {t("Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <TextInput
        name="enc-basemap-name"
        label={t("Name")}
        value={name}
        disabled={busy || complete}
        onChange={setName}
      />
      <label className="flex items-start gap-2 text-sm mt-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={attested}
          disabled={busy || complete}
          onChange={(event) => setAttested(event.target.checked)}
        />
        <span>
          <Trans ns="admin">
            I have the right to publish this chart. It will be readable by
            anyone, and it is not for navigation.
          </Trans>
        </span>
      </label>
      {(busy || jobState) && (
        <div className="mt-4">
          <ProgressBar
            progress={jobState?.progress || (busy ? 0.02 : 0)}
            indeterminate={!complete && !failed && jobState?.progress == null}
          />
          <p className="text-sm mt-2 text-gray-700">
            {failed
              ? jobState?.errorMessage || t("The chart could not be built")
              : complete
              ? t("Chart ready")
              : jobState?.progressMessage || phase}
          </p>
        </div>
      )}
    </Modal>
  );
}
