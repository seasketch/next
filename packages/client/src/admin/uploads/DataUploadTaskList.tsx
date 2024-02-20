/* eslint-disable i18next/no-literal-string */
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";
import { useCallback, useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Prompt, useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import ProgressBar from "../../components/ProgressBar";
import {
  JobDetailsFragment,
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useProjectDataQuotaRemainingQuery,
} from "../../generated/graphql";
import { ProjectBackgroundJobContext } from "./ProjectBackgroundJobContext";
import bytes from "bytes";
import useDialog from "../../components/useDialog";

export default function DataUploadTaskList({
  className,
}: {
  className: string;
}) {
  const { slug } = useParams<{ slug: string }>();
  const [modalOpen, setModalOpen] = useState<JobDetailsFragment | null>(null);

  const { t } = useTranslation("admin:data");
  const { data } = useProjectDataQuotaRemainingQuery({
    variables: {
      slug,
    },
    fetchPolicy: "cache-first",
  });

  const LeavingMsg = t(
    "Leaving this page will cancel your spatial data file upload. Are you sure you want to cancel?"
  );

  const { alert } = useDialog();

  // DataUploadDropzoneContext provides a list of files that have been dropped into
  // the browser. It is up to sub-components to get this list of files, request
  // upload tasks for them, and then clear them from the context.
  const context = useContext(ProjectBackgroundJobContext);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (
        Boolean(
          context.jobs.find(
            (j) =>
              j.state === ProjectBackgroundJobState.Queued &&
              context.manager &&
              context.manager.isUploadFromMySession(j.id)
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
  }, [LeavingMsg, context.manager, context.jobs]);

  const dismissAllFailures = useCallback(() => {
    context.jobs
      .filter((j) => j.state === ProjectBackgroundJobState.Failed)
      .forEach((j) => {
        context.manager?.dismissFailedUpload(j.id);
      });
  }, [context.jobs, context.manager]);

  const tasks = (context.jobs || []).filter(
    (j) => j.type === ProjectBackgroundJobType.DataUpload
  );

  const hasActiveUploads =
    tasks.filter((j) => j.state !== ProjectBackgroundJobState.Complete).length >
    0;

  if (!hasActiveUploads) {
    return null;
  }

  return (
    <div className={`bg-gray-50 p-4 space-y-2 border-t ${className}`}>
      <Prompt
        when={Boolean(
          tasks.find((j) => j.state === ProjectBackgroundJobState.Queued)
        )}
        message={LeavingMsg}
      />
      <h3 className="-mb-1">
        {hasActiveUploads ? (
          <Trans ns="admin:data">Upload Tasks</Trans>
        ) : (
          <Trans ns="admin:data">Upload Data</Trans>
        )}
      </h3>
      {!hasActiveUploads && (
        <div className="text-sm">
          <Trans ns="admin:data">
            Drag and drop spatial data files here to upload.
          </Trans>
        </div>
      )}
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
            {tasks.filter((u) => u.state === ProjectBackgroundJobState.Failed)
              .length > 1 && (
              <button className="underline" onClick={dismissAllFailures}>
                dismiss failures
              </button>
            )}
          </span>
        </p>
      )}
      {tasks
        .filter(
          (u) =>
            u.state !== ProjectBackgroundJobState.Complete &&
            (u.state !== ProjectBackgroundJobState.Queued ||
              (context.manager && context.manager.isUploadFromMySession(u.id)))
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((upload) => (
          <div key={upload.id}>
            <div
              className={`p-2 px-4  rounded ${
                upload.state === ProjectBackgroundJobState.Failed
                  ? "bg-red-100"
                  : "bg-indigo-50"
              }`}
            >
              <div className=" flex items-center text-sm ">
                <span className="flex-1 truncate">
                  {upload.dataUploadTask?.filename}
                </span>
                <span className="italic">
                  {upload.state === ProjectBackgroundJobState.Failed && (
                    <div className="flex items-center space-x-2">
                      <Trans ns="admin:data">{upload.progressMessage}</Trans>
                      <button
                        onClick={() =>
                          setModalOpen(tasks.find((t) => t.id === upload.id)!)
                        }
                      >
                        <InformationCircleIcon className="w-5 h-5 ml-2" />
                        {/* <TrashIcon className="w-5 h-5 ml-2" /> */}
                      </button>
                    </div>
                  )}
                  {upload.state !== ProjectBackgroundJobState.Failed &&
                    upload.progressMessage}
                </span>
              </div>
              {upload.state === ProjectBackgroundJobState.Running && (
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
