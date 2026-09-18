import { Dialog } from "@headlessui/react";
import { ExclamationCircleIcon, MinusCircleIcon, XIcon } from "@heroicons/react/outline";
import {
  DataTableNodataConfig,
  DataTableNodataValue,
  nodataValuesEqual,
} from "@seasketch/geostats-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Spinner from "../../../components/Spinner";
import {
  JobDetailsFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  useCreateOverlayDataTableReprocessMutation,
} from "../../../generated/graphql";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "../../../dataLayers/useDataTableColumnStats";
import { withHostedAuthParams } from "../../../dataLayers/tilesAuth";
import useCurrentProjectMetadata from "../../../useCurrentProjectMetadata";
import { dataTableMutationRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import {
  useClearReprocessWhenJobSettles,
  useTrackOverlayDataTableJob,
} from "./useDataTableReprocessJob";
import {
  addNodataValue,
  formatNodataValue,
  nodataValuesFromUnknown,
  previewFromColumnStats,
  previewResponseError,
  removeNodataValue,
  suggestNodataValues,
} from "./dataTableNodataForm";

type DataTableJob = Pick<
  JobDetailsFragment,
  "id" | "state" | "progress" | "progressMessage" | "errorMessage"
>;

type NodataPreviewColumn = {
  name: string;
  type: string;
  nonNullCount: number;
  matchCount: number;
  excluded: boolean;
  numeric: {
    currentMean: number | null;
    previewMean: number | null;
    currentMin: number | null;
    previewMin: number | null;
    currentMax: number | null;
    previewMax: number | null;
  } | null;
};

type NodataPreviewResult = {
  totalRows: number;
  values: DataTableNodataValue[];
  columns: NodataPreviewColumn[];
  joinColumnWarning: { column: string; matchCount: number } | null;
};

function nodataPreviewUrlForTable(table: OverlayDataTableDetailsFragment) {
  if (!table.queryUrl) {
    return null;
  }
  try {
    const url = new URL(table.queryUrl);
    url.pathname = url.pathname.replace(/\/query$/, "/nodata-preview");
    url.search = "";
    return url.toString();
  } catch {
    return table.queryUrl.replace(/\/query(?:\?.*)?$/, "/nodata-preview");
  }
}

function formatMean(value: number | null, t: (key: string) => string) {
  if (value == null || Number.isNaN(value)) {
    return t("n/a");
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function reprocessProgressLabel(
  job: DataTableJob | undefined,
  t: (key: string) => string
) {
  if (!job) {
    return t("Starting reprocess…");
  }
  if (job.state === ProjectBackgroundJobState.Failed) {
    return job.errorMessage || t("Reprocessing failed");
  }
  switch (job.progressMessage) {
    case "uploading":
      return t("Saving processed table…");
    case "applying no-data values":
      return t("Applying no-data values…");
    case "deriving temporal columns":
      return t("Updating date columns…");
    case "computing stats":
      return t("Computing column stats…");
    case "downloading parquet":
    case "downloading":
      return t("Reading table…");
    case "processing":
      return t("Processing…");
    default:
      return job.progressMessage || t("Reprocessing…");
  }
}

function NodataReprocessOverlay({ job }: { job?: DataTableJob }) {
  const { t } = useTranslation("admin:data");
  const failed = job?.state === ProjectBackgroundJobState.Failed;
  const progress = job?.progress ?? 0;
  const label = reprocessProgressLabel(job, t);
  const percent = Math.round(progress * 100);

  return (
    <motion.div
      key="reprocess-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden bg-gray-950/70 px-6 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-busy={!failed}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm text-center"
      >
        {failed ? (
          <ExclamationCircleIcon
            className="mx-auto h-8 w-8 text-red-300"
            aria-hidden
          />
        ) : (
          <Spinner large color="white" className="opacity-80" />
        )}
        <p
          className={`mt-3 text-sm font-medium ${
            failed ? "text-red-100" : "text-gray-100"
          }`}
        >
          {failed ? t("Reprocessing failed") : t("Reprocessing table…")}
        </p>
        <p
          className={`mt-1 max-h-24 overflow-y-auto text-xs ${
            failed
              ? "whitespace-pre-wrap break-words font-mono text-red-200/90"
              : "text-gray-300"
          }`}
        >
          {label}
        </p>
        {!failed ? (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400 transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-sky-200/80">
              {t("{{percent}}%", { percent })}
            </p>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

export default function DataTableNodataEditor({
  table,
  tableOfContentsItemId,
  job,
  open,
  onClose,
  onJobStarted,
}: {
  table: OverlayDataTableDetailsFragment;
  tableOfContentsItemId: number;
  job?: DataTableJob;
  open: boolean;
  onClose: () => void;
  onJobStarted: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const { columnStats, loading: statsLoading } = useDataTableColumnStats(
    columnStatsUrlForTable(table),
    mapAccessToken
  );
  const columnStatsRef = useRef(columnStats);
  columnStatsRef.current = columnStats;
  const existing = useMemo(
    () => nodataValuesFromUnknown(table.nodataValues),
    [table.nodataValues]
  );
  const [values, setValues] = useState<DataTableNodataValue[]>(existing);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<NodataPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFromStats, setPreviewFromStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const trackOverlayJob = useTrackOverlayDataTableJob();
  useClearReprocessWhenJobSettles({
    job,
    reprocessing,
    saving,
    setReprocessing,
  });

  const changeLogRefetchQueries = useMemo(
    () => dataTableMutationRefetchQueries(tableOfContentsItemId),
    [tableOfContentsItemId]
  );
  const [createReprocess] = useCreateOverlayDataTableReprocessMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });

  useEffect(() => {
    if (open) {
      setValues(nodataValuesFromUnknown(table.nodataValues));
      setDraft("");
      setPreview(null);
      setPreviewError(null);
      setPreviewFromStats(false);
      setReprocessing(false);
    }
  }, [open, table.nodataValues]);

  const suggestions = useMemo(
    () => suggestNodataValues(columnStats, values),
    [columnStats, values]
  );
  const config = useMemo(
    (): DataTableNodataConfig | null =>
      values.length > 0 ? { values } : null,
    [values]
  );
  const previewUrl = nodataPreviewUrlForTable(table);
  const joinColumn = table.joinColumn;
  const unchanged = nodataValuesEqual(values, existing);

  useEffect(() => {
    if (!open || !config) {
      setPreview(null);
      setPreviewError(null);
      setPreviewFromStats(false);
      setPreviewLoading(false);
      return;
    }
    if (!previewUrl) {
      setPreviewError(t("This table has no preview URL."));
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewFromStats(false);
    const handle = window.setTimeout(() => {
      const url = new URL(previewUrl);
      url.searchParams.set("config", JSON.stringify(config));
      if (joinColumn) {
        url.searchParams.set("joinColumn", joinColumn);
      }
      const authorized = withHostedAuthParams(url.toString(), {
        accessToken: mapAccessToken,
      });
      fetch(authorized, { headers: { accept: "application/json" } })
        .then(async (response) => {
          if (!response.ok) {
            throw await previewResponseError(response);
          }
          return response.json() as Promise<NodataPreviewResult>;
        })
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
            setPreviewError(null);
            setPreviewFromStats(false);
          }
        })
        .catch((error: Error) => {
          if (cancelled) return;
          const fallback = previewFromColumnStats(
            columnStatsRef.current,
            config.values,
            joinColumn
          );
          if (fallback) {
            setPreview(fallback);
            setPreviewFromStats(true);
            setPreviewError(error.message);
          } else {
            setPreview(null);
            setPreviewFromStats(false);
            setPreviewError(error.message);
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, config, previewUrl, joinColumn, mapAccessToken, t]);

  useEffect(() => {
    if (!open || !config || preview) {
      return;
    }
    const fallback = previewFromColumnStats(
      columnStats,
      config.values,
      joinColumn
    );
    if (fallback) {
      setPreview(fallback);
      setPreviewFromStats(true);
    }
  }, [open, config, columnStats, joinColumn, preview]);

  const jobRunning =
    job &&
    (job.state === ProjectBackgroundJobState.Queued ||
      job.state === ProjectBackgroundJobState.Running);
  const jobFailed = job?.state === ProjectBackgroundJobState.Failed;
  const showJobOverlay = Boolean(
    jobFailed ||
      jobRunning ||
      (reprocessing && job?.state !== ProjectBackgroundJobState.Complete)
  );
  const impacted = (preview?.columns || []).filter(
    (column) => column.matchCount > 0 && !column.excluded
  );

  const commitDraft = () => {
    const next = addNodataValue(values, draft);
    setValues(next);
    setDraft("");
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    }
  };

  const save = async () => {
    if (saving || jobRunning || unchanged) return;
    setSaving(true);
    try {
      setReprocessing(true);
      try {
        const result = await createReprocess({
          variables: {
            tableId: table.id,
            nodataConfig: { values } as DataTableNodataConfig,
          },
        });
        trackOverlayJob(
          tableOfContentsItemId,
          result.data?.createOverlayDataTableReprocess?.projectBackgroundJob
        );
        onJobStarted();
      } catch {
        setReprocessing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim()) {
      commitDraft();
      return;
    }
    void save();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-700 text-gray-100 shadow-2xl [color-scheme:dark]"
          style={{ colorScheme: "dark" }}
        >
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-gray-600 px-3 pt-3 pb-3">
              <MinusCircleIcon className="h-5 w-5 shrink-0 text-indigo-200" aria-hidden />
              <Dialog.Title className="min-w-0 flex-1 truncate font-medium text-indigo-100">
                <Trans ns="admin:data">No-data values</Trans>
              </Dialog.Title>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-black/20 text-gray-200 hover:bg-gray-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                onClick={onClose}
                aria-label={t("Close")}
              >
                <XIcon className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-5">
              <p className="text-sm text-gray-300">
                <Trans ns="admin:data">
                  Empty cells are always treated as no-data. Add sentinel values
                  used in this table, such as -88 or NA. Matching cells become
                  null so they are not averaged into map results.
                </Trans>
              </p>

              <div className="space-y-2">
                <label className="text-sm text-gray-200" htmlFor="dt-nodata-input">
                  {t("Sentinel values")}
                </label>
                <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-gray-900/40 px-2 py-1.5">
                  {values.map((value) => (
                    <span
                      key={formatNodataValue(value)}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 font-mono text-xs text-indigo-100"
                    >
                      {formatNodataValue(value)}
                      <button
                        type="button"
                        className="text-indigo-200 hover:text-white"
                        onClick={() =>
                          setValues((prev) => removeNodataValue(prev, value))
                        }
                        aria-label={t("Remove {{value}}", {
                          value: formatNodataValue(value),
                        })}
                      >
                        <XIcon className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    id="dt-nodata-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onDraftKeyDown}
                    onBlur={() => {
                      if (draft.trim()) commitDraft();
                    }}
                    placeholder={
                      values.length === 0 ? t("Example: -88") : t("Add another")
                    }
                    className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-green-300 placeholder:text-gray-500 focus:outline-none"
                    disabled={showJobOverlay}
                  />
                </div>
                {suggestions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                    <span>{t("Suggested")}</span>
                    {suggestions.map((value) => (
                      <button
                        key={formatNodataValue(value)}
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-indigo-200 hover:border-indigo-300 hover:text-white"
                        onClick={() =>
                          setValues((prev) =>
                            addNodataValue(prev, formatNodataValue(value))
                          )
                        }
                      >
                        {formatNodataValue(value)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <section className="nodata-preview space-y-2">
                <h3 className="text-sm font-medium text-gray-100">
                  {showJobOverlay
                    ? jobFailed
                      ? t("Reprocessing failed")
                      : t("Reprocessing")
                    : t("Preview")}
                </h3>
                <div
                  className={`relative flex h-72 min-w-0 flex-col overflow-hidden rounded-md border bg-black/20 ${
                    jobFailed
                      ? "border-red-400/40"
                      : showJobOverlay
                      ? "border-sky-400/30"
                      : "border-white/10"
                  }`}
                >
                  <div
                    className={`flex min-h-0 flex-1 flex-col transition duration-500 ${
                      showJobOverlay
                        ? "pointer-events-none scale-[0.99] opacity-25 blur-[2px]"
                        : ""
                    }`}
                  >
                    {values.length === 0 ? (
                      <p className="m-auto px-4 text-center text-sm italic text-gray-400">
                        {t(
                          "Only empty cells are no-data. Add a sentinel to preview its impact."
                        )}
                      </p>
                    ) : (statsLoading || previewLoading) && !preview ? (
                      <p className="m-auto px-4 text-center text-sm italic text-gray-400">
                        {t("Reading table values…")}
                      </p>
                    ) : previewError && !preview ? (
                      <p className="m-auto max-w-md px-4 text-center text-sm text-red-300">
                        {previewError}
                      </p>
                    ) : preview ? (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                        <p className="shrink-0 text-sm text-gray-300">
                          {t(
                            "{{columns}} columns have matching cells in {{rows}} rows.",
                            {
                              columns: impacted.length.toLocaleString(),
                              rows: preview.totalRows.toLocaleString(),
                            }
                          )}
                        </p>
                        {preview.joinColumnWarning ? (
                          <p className="mt-1 text-xs text-amber-200">
                            {/* eslint-disable-next-line i18next/no-literal-string -- column identifier */}
                            <code className="font-mono">
                              {preview.joinColumnWarning.column}
                            </code>{" "}
                            <Trans ns="admin:data">
                              is the join column and will not be rewritten
                            </Trans>
                            {` (${preview.joinColumnWarning.matchCount.toLocaleString()})`}
                          </p>
                        ) : null}
                        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded border border-white/10">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-gray-800 text-gray-300">
                              <tr>
                                <th className="px-2 py-1 font-medium">
                                  {t("Column")}
                                </th>
                                <th className="px-2 py-1 font-medium">
                                  {t("Matches")}
                                </th>
                                <th className="px-2 py-1 font-medium">
                                  {t("Mean now")}
                                </th>
                                <th className="px-2 py-1 font-medium">
                                  {t("Mean after")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {impacted.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-2 py-3 text-center italic text-gray-500"
                                  >
                                    {t("No matching cells in this table")}
                                  </td>
                                </tr>
                              ) : (
                                impacted.map((column) => (
                                  <tr
                                    key={column.name}
                                    className="border-t border-white/5"
                                  >
                                    <td className="px-2 py-1 font-mono text-gray-200">
                                      {column.name}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums text-gray-200">
                                      {column.matchCount.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums text-gray-400">
                                      {formatMean(
                                        column.numeric?.currentMean ?? null,
                                        t
                                      )}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums text-green-300">
                                      {formatMean(
                                        column.numeric?.previewMean ?? null,
                                        t
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {previewFromStats ? (
                          <p className="mt-2 text-xs text-amber-200/90">
                            <Trans ns="admin:data">
                              Live preview is unavailable, so match counts come
                              from column stats and means are shown as n/a.
                            </Trans>
                            {previewError ? (
                              <span className="mt-1 block font-mono text-[11px] text-amber-100/80">
                                {previewError}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-gray-500">
                          <Trans ns="admin:data">
                            Saving rewrites matching cells to null. Removing a
                            value reprocesses from the original table so those
                            cells come back.
                          </Trans>
                        </p>
                      </div>
                    ) : (
                      <p className="m-auto px-4 text-center text-sm italic text-gray-400">
                        {t("Add a value to preview its impact.")}
                      </p>
                    )}
                  </div>
                  <AnimatePresence>
                    {showJobOverlay ? (
                      <NodataReprocessOverlay job={job} />
                    ) : null}
                  </AnimatePresence>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-600 px-5 py-3">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                onClick={onClose}
                disabled={saving}
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={showJobOverlay || unchanged}
              >
                {t("Save and Reprocess")}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
