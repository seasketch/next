import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  ClockIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";
import {
  GeographyClippingSettingsDocument,
  SketchFragmentStatusDocument,
  useGenerateMissingFragmentsForProjectMutation,
  useSketchFragmentStatusQuery,
} from "../../generated/graphql";

type Props = {
  slug: string;
  onRequestClose: () => void;
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleString();
}

function getJobStatus(job: {
  lockedAt?: string | null;
  lastError?: string | null;
  attempts?: number | null;
  maxAttempts?: number | null;
}) {
  if (job.lockedAt) return "processing";
  if (job.lastError && (job.attempts ?? 0) >= (job.maxAttempts ?? 0)) {
    return "failed";
  }
  if (job.lastError) return "retrying";
  return "queued";
}

function getSketchId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "—";
  const maybeSketchId = (payload as { sketchId?: number | string }).sketchId;
  if (maybeSketchId === undefined || maybeSketchId === null) return "—";
  return `${maybeSketchId}`;
}

/** Shared column layout so header + body tables align when only the body scrolls. */
function JobQueueColgroup() {
  return (
    <colgroup>
      <col style={{ width: "5.5rem" }} />
      <col style={{ width: "8.5rem" }} />
      <col style={{ width: "9.5rem" }} />
      <col style={{ width: "9.5rem" }} />
      <col style={{ width: "5.5rem" }} />
      <col style={{ width: "32%", minWidth: "14rem" }} />
    </colgroup>
  );
}

function statusBadgeClass(status: string) {
  if (status === "processing") {
    return "bg-blue-100 text-blue-800 ring-blue-200";
  }
  if (status === "retrying") {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (status === "failed") {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function SketchFragmentStatusModal({
  slug,
  onRequestClose,
}: Props) {
  const { t } = useTranslation("admin:geography");
  const [pollInterval, setPollInterval] = useState(0);
  const [jobErrorDetail, setJobErrorDetail] = useState<{
    sketchLabel: string;
    message: string;
  } | null>(null);

  const { data, loading, error } = useSketchFragmentStatusQuery({
    variables: { slug },
    skip: !slug,
    pollInterval,
  });

  const fragmentGenerationInProgress =
    data?.projectBySlug?.sketchesFragmentGenerationInProgress ?? false;

  const [generateMissingFragments, { loading: reprocessing }] =
    useGenerateMissingFragmentsForProjectMutation({
      refetchQueries: [
        { query: SketchFragmentStatusDocument, variables: { slug } },
        { query: GeographyClippingSettingsDocument, variables: { slug } },
      ],
    });

  const classCounts =
    data?.projectBySlug?.sketchClassMissingFragmentCounts?.slice() ?? [];

  const jobsWithStatus = useMemo(() => {
    const jobs = data?.projectBySlug?.sketchFragmentJobDetails?.slice() ?? [];
    return jobs.map((job) => ({
      ...job,
      status: getJobStatus(job),
    }));
  }, [data?.projectBySlug?.sketchFragmentJobDetails]);

  const hasActiveJobs = jobsWithStatus.some(
    (job) =>
      job.status === "queued" ||
      job.status === "processing" ||
      job.status === "retrying"
  );

  const shouldPoll =
    fragmentGenerationInProgress || hasActiveJobs || reprocessing;

  useEffect(() => {
    setPollInterval(shouldPoll ? 1000 : 0);
  }, [shouldPoll]);

  return (
    <>
    <Modal
      onRequestClose={onRequestClose}
      title={t("Sketch Geography Clipping Status")}
      panelClassName="max-w-5xl"
      scrollable
      footer={[
        {
          label: t("Close"),
          onClick: onRequestClose,
        },
      ]}
    >
      <div className="space-y-6 text-sm">
        <p>
          <Trans ns="admin:geography">
            When users draw polygon sketches, their original geometry is clipped
            to the geography boundaries. This clipped version is used when
            calculating reports. If the Geography configuration for a project
            changes, or a Sketch Class is modified to clip to a different
            geography, this clipped geometry is no longer valid and is deleted.
          </Trans>
        </p>
        <p className="mt-2">
          <Trans ns="admin:geography">
            When the user goes to view a report on these sketches, the missing
            clipped geometry can be generated automatically. This process can be
            slow however. To speed up report generation, you can run a
            background process to precompute these clipped geometries.
          </Trans>
        </p>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("Unprocessed sketches by class")}
            </h3>
          </div>

          {loading && (
            <div className="flex items-center text-sm text-gray-600">
              <Spinner />
              <span className="ml-2">{t("Loading sketch status...")}</span>
            </div>
          )}

          {!loading && !error && classCounts.length === 0 && (
            <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {t("All sketches are clipped to the current configuration.")}
            </div>
          )}

          {!loading && error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {t("Unable to load fragment status data.")}
            </div>
          )}

          {!loading && !error && classCounts.length > 0 && (
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      {t("Sketch class")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      {t("Missing sketches")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {classCounts.map((item) => (
                    <tr key={item.sketchClassId}>
                      <td className="px-3 py-2 text-gray-900">
                        {item.sketchClassName}
                      </td>
                      <td className="px-3 py-2 text-gray-800">
                        {item.missingCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            {/* <h3 className="text-sm font-semibold text-gray-900">
              {t("Background processing")}
            </h3> */}
            <Button
              label={
                reprocessing ||
                fragmentGenerationInProgress ||
                hasActiveJobs ? (
                  <span className="flex items-center">
                    <Spinner />
                    <span className="ml-2">{t("Reprocessing...")}</span>
                  </span>
                ) : (
                  t("Start background reprocessing")
                )
              }
              disabled={
                reprocessing || fragmentGenerationInProgress || hasActiveJobs
              }
              onClick={() => {
                if (!slug) return;
                generateMissingFragments({ variables: { slug } });
              }}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("Job queue state")}
          </h3>

          {!loading && !error && jobsWithStatus.length === 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 h-48 text-center items-center justify-center">
              <div className="h-full flex items-center justify-center">
                <span>
                  {t("All background processing jobs have been completed.")}
                </span>
              </div>
            </div>
          )}

          {!loading && !error && jobsWithStatus.length > 0 && (
            <div className="flex h-48 max-h-48 flex-col overflow-hidden rounded border border-gray-200">
              <div className="min-h-0 flex-1 overflow-x-auto overscroll-x-contain">
                <div className="flex h-full min-h-0 min-w-[36rem] flex-col">
                  <div className="shrink-0 border-b border-gray-200 bg-gray-50">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                      <JobQueueColgroup />
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Sketch ID")}
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Status")}
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Queued at")}
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Last updated")}
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Attempts")}
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            {t("Error")}
                          </th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-white">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                      <JobQueueColgroup />
                      <tbody className="divide-y divide-gray-100">
                        {jobsWithStatus.map((job) => (
                          <tr key={job.id}>
                            <td className="px-3 py-2 text-gray-900">
                              {getSketchId(job.payload)}
                            </td>
                            <td className="px-3 py-2 text-gray-800">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(
                                  job.status
                                )}`}
                              >
                                {job.status === "processing" && (
                                  <UpdateIcon className="h-3.5 w-3.5 animate-spin" />
                                )}
                                {job.status === "failed" && (
                                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                )}
                                {job.status === "retrying" && (
                                  <ReloadIcon className="h-3.5 w-3.5" />
                                )}
                                {job.status === "queued" && (
                                  <ClockIcon className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {job.status === "processing" &&
                                    t("Processing")}
                                  {job.status === "failed" && t("Failed")}
                                  {job.status === "retrying" && t("Retrying")}
                                  {job.status === "queued" && t("Queued")}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {formatTimestamp(job.runAt)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {formatTimestamp(job.updatedAt)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {job.attempts} / {job.maxAttempts}
                            </td>
                            <td className="align-top px-3 py-2 text-gray-700">
                              {job.lastError ? (
                                <div className="space-y-1.5">
                                  <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs leading-snug text-gray-800 whitespace-pre-wrap break-words">
                                    {job.lastError}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-left text-xs font-medium text-primary-600 underline decoration-dotted underline-offset-2 hover:text-primary-800"
                                    onClick={() =>
                                      setJobErrorDetail({
                                        sketchLabel: getSketchId(
                                          job.payload
                                        ),
                                        message: job.lastError!,
                                      })
                                    }
                                  >
                                    {t("Open full message")}
                                  </button>
                                </div>
                              ) : job.status === "failed" ? (
                                <span className="text-xs text-amber-800">
                                  {t(
                                    "No error message was recorded for this job."
                                  )}
                                </span>
                              ) : (
                                t("N/A")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
    {jobErrorDetail && (
      <Modal
        tipyTop
        title={t("Job error — sketch {{id}}", {
          id: jobErrorDetail.sketchLabel,
        })}
        onRequestClose={() => setJobErrorDetail(null)}
        panelClassName="max-w-3xl"
        scrollable
        footer={[
          {
            label: t("Copy error"),
            onClick: () => {
              void navigator.clipboard.writeText(jobErrorDetail.message);
            },
          },
          {
            label: t("Close"),
            variant: "primary",
            onClick: () => setJobErrorDetail(null),
          },
        ]}
      >
        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-800">
          {jobErrorDetail.message}
        </pre>
      </Modal>
    )}
    </>
  );
}
