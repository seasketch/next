import { useTranslation } from "react-i18next";
import {
  JobDetailsFragment,
  ProjectBackgroundJobState,
} from "../../../generated/graphql";
import ProgressBar from "../../../components/ProgressBar";
import Spinner from "../../../components/Spinner";

export default function DataTableUploadJobProgress({
  job,
  onDismiss,
}: {
  job: Pick<
    JobDetailsFragment,
    "state" | "progress" | "progressMessage" | "errorMessage"
  >;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const failed = job.state === ProjectBackgroundJobState.Failed;
  const active =
    job.state === ProjectBackgroundJobState.Queued ||
    job.state === ProjectBackgroundJobState.Running;
  const showBar =
    active || job.state === ProjectBackgroundJobState.Complete;

  const progressLabel = failed
    ? job.errorMessage || t("Upload failed")
    : job.progressMessage === "uploading"
      ? t("Uploading file…")
      : job.progressMessage || t("Processing…");

  if (failed) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-end gap-2">
          {onDismiss ? (
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-red-700 hover:text-red-800"
              onClick={onDismiss}
            >
              {t("Dismiss")}
            </button>
          ) : null}
        </div>
        <pre className="max-h-40 overflow-y-auto rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-xs leading-relaxed text-red-800 whitespace-pre-wrap break-words font-mono">
          {progressLabel}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {showBar ? (
        <div className="h-6 w-full overflow-hidden -mt-0.5">
          <ProgressBar
            progress={
              job.state === ProjectBackgroundJobState.Complete
                ? 1
                : job.progress ?? 0
            }
            colorClassName={
              job.progressMessage === "uploading"
                ? "bg-green-400"
                : "bg-indigo-400"
            }
          />
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-xs text-primary-600">
        {active ? <Spinner mini /> : null}
        <span className="min-w-0 flex-1 truncate">{progressLabel}</span>
        {active && job.progressMessage === "uploading" ? (
          <span className="shrink-0 tabular-nums text-gray-500">
            {t("{{percent}}%", {
              percent: Math.round((job.progress ?? 0) * 100),
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
