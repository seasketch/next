import { Trans, useTranslation } from "react-i18next";
import {
  JobDetailsFragment,
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useBackgroundJobsQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import ProgressBar from "../../components/ProgressBar";
import {
  CaretDownIcon,
  CrossCircledIcon,
  GearIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ProjectBackgroundJobContext } from "../uploads/ProjectBackgroundJobContext";
import Modal from "../../components/Modal";
import { InformationCircleIcon } from "@heroicons/react/outline";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import ProjectBackgroundJobManager from "../uploads/ProjectBackgroundJobManager";

export default function BackgroundJobList({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const onError = useGlobalErrorHandler();
  const { data } = useBackgroundJobsQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
  });
  const { t } = useTranslation("admin:data");
  const [hidden, setHidden] = useState(false);
  const context = useContext(ProjectBackgroundJobContext);
  const [hiddenLocalUploads, setHiddenLocalUploads] = useState<string[]>([]);
  const backgroundJobContext = useContext(ProjectBackgroundJobContext);
  useEffect(() => {
    if (backgroundJobContext.manager) {
      backgroundJobContext.manager.on("upload-processing-complete", (event) => {
        setTimeout(() => {
          setHiddenLocalUploads((prev) => [...prev, event.jobId]);
        }, 50);
      });
    }
  }, [backgroundJobContext.manager]);

  const activeJobs = useMemo(() => {
    const jobs = data?.projectBySlug?.projectBackgroundJobs || [];
    return jobs.filter(
      (job) =>
        job.state !== ProjectBackgroundJobState.Complete ||
        (backgroundJobContext.manager?.isUploadFromMySession(job.id) &&
          !hiddenLocalUploads.includes(job.id))
    );
  }, [
    data?.projectBySlug?.projectBackgroundJobs,
    backgroundJobContext.manager,
    hiddenLocalUploads,
  ]);

  // sort jobs by createdAt
  const sortedJobs = useMemo(() => {
    // @ts-ignore
    const jobs: JobDetailsFragment[] = [
      ...(data?.projectBySlug?.projectBackgroundJobs || []),
    ];
    return (
      jobs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ) || []
    );
  }, [data?.projectBySlug?.projectBackgroundJobs]);

  const dismissAllFailures = useCallback(() => {
    activeJobs
      .filter((j) => j.state === ProjectBackgroundJobState.Failed)
      .forEach((j) => {
        context.manager?.dismissFailedUpload(j.id);
      });
  }, [context.manager, activeJobs]);

  const LeavingMsg = t(
    "Leaving this page will cancel your spatial data file upload. Are you sure you want to cancel?"
  );

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
        event.returnValue = LeavingMsg;
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => {
      window.removeEventListener("beforeunload", listener);
    };
  }, [LeavingMsg, context.manager, context.jobs]);

  return (
    <>
      {activeJobs.length > 0 && (
        <div
          style={style}
          className={
            className +
            " " +
            "flex overflow-y-hidden flex-col rounded-tr-lg rounded-tl-lg  text-white bg-gradient-to-tl from-gray-500 to-gray-600 z-20"
          }
        >
          <h3 className="font-semibold  p-4 flex items-center space-x-1">
            <span className="flex-1">
              <Trans ns="admin:data">Background Jobs</Trans>
              {hidden && ` (${activeJobs.length})`}
            </span>
            {!hidden &&
              activeJobs.filter(
                (u) => u.state === ProjectBackgroundJobState.Failed
              ).length > 0 && (
                <button
                  className="hover:bg-gray-600 rounded px-1 py-0.5 text-sm text-indigo-100"
                  onClick={dismissAllFailures}
                >
                  {t("dismiss all failures")}
                </button>
              )}

            <button
              className="rounded-full hover:bg-gray-600"
              onClick={() => {
                setHidden((prev) => !prev);
              }}
            >
              <CaretDownIcon
                className={`text-white h-6 w-6 ${
                  hidden ? "transform rotate-180" : ""
                }`}
              />
            </button>
          </h3>
          {!hidden && (
            <ul className="space-y-3 flex-1 overflow-y-auto px-4 pb-4">
              <AnimatePresence initial={false}>
                {sortedJobs.map((job) => (
                  <BackgroundJobListItem
                    key={job.id}
                    job={job}
                    manager={backgroundJobContext.manager}
                    hiddenLocalUploads={hiddenLocalUploads}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export function BackgroundJobListItem({
  job,
  manager,
  hiddenLocalUploads,
  className,
  showCompletedItems,
}: {
  job: Pick<
    JobDetailsFragment,
    | "id"
    | "state"
    | "progress"
    | "progressMessage"
    | "errorMessage"
    | "type"
    | "title"
  >;
  manager?: ProjectBackgroundJobManager;
  hiddenLocalUploads?: string[];
  className?: string;
  showCompletedItems?: boolean;
}) {
  hiddenLocalUploads = hiddenLocalUploads || [];
  let complete = job.state === ProjectBackgroundJobState.Complete;
  const isMyUpload = manager?.isUploadFromMySession(
    job.id || hiddenLocalUploads.includes(job.id)
  );
  const [modalOpen, setModalOpen] = useState(false);
  if (
    !showCompletedItems &&
    complete &&
    (!isMyUpload || hiddenLocalUploads.includes(job.id))
  ) {
    return null;
  }

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.5,
        transition: {
          delay: job.state === ProjectBackgroundJobState.Complete ? 0.2 : 0,
        },
      }}
      key={job.id}
      className={`p-2 px-3 rounded shadow-lg  text-black ${
        job.state === ProjectBackgroundJobState.Failed
          ? "bg-red-50 text-red-800"
          : job.state === ProjectBackgroundJobState.Complete
          ? "bg-indigo-100"
          : "bg-white"
      } ${className}`}
    >
      {modalOpen && manager && (
        <FailedBackgroundJobModal
          item={job}
          onRequestClose={() => setModalOpen(false)}
          manager={manager}
        />
      )}
      <div className="flex items-center">
        {job.state === ProjectBackgroundJobState.Failed && (
          <CrossCircledIcon className="w-4 h-4 mr-1.5" />
        )}
        {job.state !== ProjectBackgroundJobState.Failed &&
          job.type === ProjectBackgroundJobType.DataUpload && (
            <UploadIcon className="w-4 h-4 mr-1.5" />
          )}
        {job.state !== ProjectBackgroundJobState.Failed &&
          job.type === ProjectBackgroundJobType.ArcgisImport && (
            <GearIcon className="w-4 h-4 mr-1.5" />
          )}

        <span className="flex-1 truncate">{job.title}</span>
        <span className="flex-none italic text-sm">{job.progressMessage}</span>
        {job.state === ProjectBackgroundJobState.Failed && (
          <button onClick={() => setModalOpen(true)}>
            <InformationCircleIcon className="w-5 h-5 ml-2" />
            {/* <TrashIcon className="w-5 h-5 ml-2" /> */}
          </button>
        )}
      </div>
      {(job.state === ProjectBackgroundJobState.Queued ||
        job.state === ProjectBackgroundJobState.Running ||
        job.state === ProjectBackgroundJobState.Complete) && (
        <div className="h-6 w-full overflow-hidden mb-2 -mt-1.5">
          <ProgressBar
            progress={
              job.state === ProjectBackgroundJobState.Complete
                ? 1
                : job.progress
            }
            colorClassName={
              job.progressMessage === "uploading"
                ? "bg-green-400"
                : "bg-indigo-400"
            }
          />
        </div>
      )}
    </motion.li>
  );
}

function FailedBackgroundJobModal({
  item,
  onRequestClose,
  manager,
}: {
  item: Pick<
    JobDetailsFragment,
    "id" | "state" | "progress" | "progressMessage" | "errorMessage" | "type"
  >;
  onRequestClose: () => void;
  manager: ProjectBackgroundJobManager;
}) {
  return (
    <Modal
      title={<Trans ns="admin:data">Job Failed</Trans>}
      onRequestClose={async () => {
        manager.dismissFailedUpload(item.id);
        onRequestClose();
      }}
      footer={[
        {
          label: <Trans ns="admin:data">Dismiss</Trans>,
          onClick: () => {
            manager.dismissFailedUpload(item.id);
            onRequestClose();
          },
          variant: "primary",
          loading: false,
          autoFocus: true,
        },
      ]}
    >
      <code>{item.errorMessage}</code>
      <p>
        <Trans ns="admin:data">
          Check that you uploaded a supported file type. If you would like to{" "}
          <a
            className="text-primary-500 underline"
            href={`mailto:support@seasketch.org?subject=Failed Upload ${item.id}`}
          >
            contact support
          </a>{" "}
          about this error, reference upload ID {item.id}
        </Trans>
      </p>
    </Modal>
  );
}
