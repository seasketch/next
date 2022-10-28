/* eslint-disable i18next/no-literal-string */
import {
  InformationCircleIcon,
  StopIcon,
  TrashIcon,
  XIcon,
} from "@heroicons/react/outline";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Prompt, useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import ProgressBar from "../../components/ProgressBar";
import {
  DataUploadDetailsFragment,
  useProjectDataQuotaRemainingQuery,
} from "../../generated/graphql";
import { DataUploadState } from "../../generated/queries";
import { DataUploadDropzoneContext } from "./DataUploadDropzone";
import bytes from "bytes";
import useDialog from "../../components/useDialog";

export default function DataUploadTaskList({
  className,
}: {
  className: string;
}) {
  const { slug } = useParams<{ slug: string }>();
  const [modalOpen, setModalOpen] =
    useState<DataUploadDetailsFragment | null>(null);

  const { t } = useTranslation("admin:data");
  const { data } = useProjectDataQuotaRemainingQuery({
    variables: {
      slug,
    },
  });

  const LeavingMsg = t(
    "Leaving this page will cancel your spatial data file upload. Are you sure you want to cancel?"
  );

  const { alert } = useDialog();

  // DataUploadDropzoneContext provides a list of files that have been dropped into
  // the browser. It is up to sub-components to get this list of files, request
  // upload tasks for them, and then clear them from the context.
  const context = useContext(DataUploadDropzoneContext);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (
        Boolean(
          context.uploads.find(
            (u) => u.state === DataUploadState.AwaitingUpload
          )
        )
      ) {
        event.preventDefault();
        return (event.returnValue = LeavingMsg);
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => {
      window.removeEventListener("beforeunload", listener);
    };
  }, [LeavingMsg, context.uploads]);

  if (
    context.uploads.filter((u) => u.state !== DataUploadState.Complete)
      .length === 0
  ) {
    return null;
  }

  return (
    <div className={`p-4 space-y-2 border-t ${className}`}>
      <Prompt
        when={Boolean(
          context.uploads.find(
            (u) => u.state === DataUploadState.AwaitingUpload
          )
        )}
        message={LeavingMsg}
      />
      <h3 className="-mb-1">
        <Trans ns="admin:data">Upload Tasks</Trans>
      </h3>
      {data?.projectBySlug?.dataHostingQuota && (
        <p className="flex text-sm text-gray-500 pb-1 items-center">
          <span className="flex-1">
            Using{" "}
            {Math.round(
              (data.projectBySlug.dataHostingQuotaUsed! /
                data.projectBySlug.dataHostingQuota) *
                100
            )}
            {"% "}
            of {bytes(
              parseInt(data.projectBySlug.dataHostingQuota.toString())
            )}{" "}
            <button
              onClick={() =>
                alert(
                  t("Upload hosting quotas are designed to prevent abuse"),
                  {
                    description: t(
                      "Contact support@seasketch.org to discuss your needs and we may be able to increase your quota."
                    ),
                  }
                )
              }
              className="underline"
            >
              data hosting quota.
            </button>
            &nbsp;
          </span>
          <span>
            {context.uploads.filter((u) => u.state === DataUploadState.Failed)
              .length > 1 && (
              <button
                className="underline"
                onClick={context.manager?.dismissAllFailures}
              >
                dismiss failures
              </button>
            )}
          </span>
        </p>
      )}
      {context.uploads
        .filter((u) => u.state !== DataUploadState.Complete)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((upload) => (
          <div key={upload.id}>
            <div
              className={`p-2 px-4  rounded ${
                upload.state === DataUploadState.Failed
                  ? "bg-red-100"
                  : "bg-indigo-50"
              }`}
            >
              <div className=" flex items-center text-sm ">
                <span className="flex-1 truncate">{upload.filename}</span>
                <span className="italic">
                  {upload.state === DataUploadState.AwaitingUpload && (
                    <div className="flex items-center space-x-2">
                      <Trans ns="admin:data">uploading...</Trans>
                      <button
                        title={t("Cancel upload")}
                        onClick={() => {
                          context.manager?.abortUpload(upload.id);
                        }}
                      >
                        <XIcon className="w-5 h-5 ml-2" />
                      </button>
                    </div>
                  )}
                  {upload.state === DataUploadState.Uploaded && (
                    <Trans ns="admin:data">queued...</Trans>
                  )}
                  {upload.state === DataUploadState.Complete && (
                    <Trans ns="admin:data">complete</Trans>
                  )}
                  {upload.state === DataUploadState.Failed && (
                    <div className="flex items-center space-x-2">
                      <Trans ns="admin:data">failed</Trans>
                      <button
                        onClick={() =>
                          setModalOpen(
                            (context.uploads || []).find(
                              (t) => t.id === upload.id
                            )!
                          )
                        }
                      >
                        <InformationCircleIcon className="w-5 h-5 ml-2" />
                        {/* <TrashIcon className="w-5 h-5 ml-2" /> */}
                      </button>
                    </div>
                  )}
                  {upload.state === DataUploadState.FailedDismissed && (
                    <Trans ns="admin:data">dismissed</Trans>
                  )}
                  {upload.state === DataUploadState.Fetching && (
                    <Trans ns="admin:data">retrieving...</Trans>
                  )}
                  {upload.state === DataUploadState.RequiresUserInput && (
                    <Trans ns="admin:data">requires input</Trans>
                  )}
                  {upload.state === DataUploadState.Tiling && (
                    <Trans ns="admin:data">tiling...</Trans>
                  )}
                  {upload.state === DataUploadState.UploadingProducts && (
                    <Trans ns="admin:data">saving...</Trans>
                  )}
                  {upload.state === DataUploadState.Validating && (
                    <Trans ns="admin:data">validating...</Trans>
                  )}
                  {upload.state === DataUploadState.ConvertingFormat && (
                    <Trans ns="admin:data">converting...</Trans>
                  )}
                  {upload.state === DataUploadState.Processing && (
                    <Trans ns="admin:data">queued...</Trans>
                  )}
                </span>
              </div>
              {upload.state !== DataUploadState.Failed &&
                upload.state !== DataUploadState.FailedDismissed &&
                upload.state !== DataUploadState.Complete && (
                  <div className="h-6 w-full overflow-hidden mb-2 -mt-2">
                    <ProgressBar
                      // indeterminate={f.state === DataUploadState.AwaitingUpload}
                      progress={upload.progress}
                    />
                  </div>
                )}
            </div>
          </div>
        ))}
      {Boolean(modalOpen) && (
        <Modal
          title={<Trans ns="admin:data">Upload Failed</Trans>}
          onRequestClose={async () => {
            if (modalOpen) {
              context.manager?.dismissFailedUpload(modalOpen.id);
              setModalOpen(null);
            }
          }}
          footer={[
            {
              label: <Trans ns="admin:data">Dismiss</Trans>,
              onClick: () => {
                if (modalOpen) {
                  context.manager?.dismissFailedUpload(modalOpen.id);
                  setModalOpen(null);
                }
              },
              variant: "primary",
              loading: false,
              autoFocus: true,
            },
          ]}
        >
          <code>{modalOpen?.errorMessage}</code>
          <p>
            <Trans ns="admin:data">
              Check that you uploaded a supported file type. If you would like
              to{" "}
              <a
                className="text-primary-500 underline"
                href={`mailto:support@seasketch.org?subject=Failed Upload ${
                  modalOpen!.id
                }`}
              >
                contact support
              </a>{" "}
              about this error, reference upload ID {modalOpen!.id}
            </Trans>
          </p>
        </Modal>
      )}
    </div>
  );
}
