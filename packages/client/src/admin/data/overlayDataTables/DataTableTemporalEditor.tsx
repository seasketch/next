import { Dialog } from "@headlessui/react";
import { ExclamationCircleIcon, XIcon } from "@heroicons/react/outline";
import {
  DataTableTemporalConfig,
  GeostatsAttribute,
  TemporalDateFormat,
  TemporalPrecision,
  isTemporalInfo,
} from "@seasketch/geostats-types";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Spinner from "../../../components/Spinner";
import {
  JobDetailsFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  useCreateOverlayDataTableReprocessMutation,
  useSetOverlayDataTableVisualizationSettingsMutation,
  useUpdateOverlayDataTableTemporalMutation,
} from "../../../generated/graphql";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "../../../dataLayers/useDataTableColumnStats";
import AttributeSelect from "../styleEditor/AttributeSelect";
import { withHostedAuthParams } from "../../../dataLayers/tilesAuth";
import useCurrentProjectMetadata from "../../../useCurrentProjectMetadata";
import LayerEditorTabs from "../TableOfContentsItemEditor/LayerEditorTabs";
import { dataTableMutationRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import {
  DATE_FORMATS,
  DataTableTemporalFormState,
  DataTableTemporalMode,
  TemporalColumnUnavailableReason,
  allowedViewResolutionsForForm,
  applyNativeDefaults,
  configFromForm,
  formStateFromTemporal,
  isResolutionOnlyChange,
  parsedIsoPattern,
  sourceColumnsFromForm,
  temporalColumnAvailability,
  temporalInfoWithResolutions,
  withComponentMonth,
  withComponentYear,
  withInstantColumn,
  withSpanStart,
} from "./dataTableTemporalForm";

type DataTableJob = Pick<
  JobDetailsFragment,
  "id" | "state" | "progress" | "progressMessage" | "errorMessage"
>;

type PreviewSample = {
  raw: { [key: string]: unknown };
  parsed: {
    startIso: string;
    endIso: string;
    precision: TemporalPrecision;
  } | null;
};

type TemporalPreviewResult = {
  totalRows: number;
  parseableCount: number;
  unparseableCount: number;
  nativeResolution: TemporalPrecision;
  coverage: { start: string; end: string | null } | null;
  availability: {
    type: string;
    bins?: Array<{ start: string; count: number }>;
  } | null;
  samples: PreviewSample[];
};

const MAX_PREVIEW_BARS = 96;

function downsamplePreviewBins(
  bins: Array<{ start: string; count: number }>,
  maxBars: number = MAX_PREVIEW_BARS
): Array<{ start: string; count: number }> {
  if (bins.length <= maxBars) {
    return bins;
  }
  const out: Array<{ start: string; count: number }> = [];
  const bucketSize = bins.length / maxBars;
  for (let i = 0; i < maxBars; i++) {
    const from = Math.floor(i * bucketSize);
    const to = Math.max(from + 1, Math.floor((i + 1) * bucketSize));
    let count = 0;
    for (let j = from; j < to && j < bins.length; j++) {
      count += bins[j].count;
    }
    out.push({ start: bins[from].start, count });
  }
  return out;
}

function temporalPreviewUrlForTable(table: OverlayDataTableDetailsFragment) {
  if (!table.queryUrl) {
    return null;
  }
  try {
    const url = new URL(table.queryUrl);
    url.pathname = url.pathname.replace(/\/query$/, "/temporal-preview");
    url.search = "";
    return url.toString();
  } catch {
    return table.queryUrl.replace(/\/query(?:\?.*)?$/, "/temporal-preview");
  }
}

function formatLabel(
  format: TemporalDateFormat,
  t: (key: string, options?: { [key: string]: string }) => string
) {
  switch (format) {
    case "mdy":
      return t("MM/DD/YYYY");
    case "dmy":
      return t("DD/MM/YYYY");
    case "iso":
      return t("ISO date (e.g. {{example}})", {
        example: "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ",
      });
    case "year":
      return t("Year");
    default:
      return format;
  }
}

function resolutionLabel(
  resolution: TemporalPrecision,
  t: (key: string) => string
) {
  switch (resolution) {
    case "year":
      return t("Year");
    case "month":
      return t("Month");
    case "day":
      return t("Day");
    case "hour":
      return t("Hour");
    case "minute":
      return t("Minute");
    case "second":
      return t("Second");
    default:
      return resolution;
  }
}

function unavailableColumnHint(
  reason: TemporalColumnUnavailableReason,
  t: (key: string) => string
) {
  switch (reason) {
    case "date_string":
      return t('Use "A date column" for date strings');
    case "not_numeric":
      return t('Needs a number. Date strings belong on "A date column"');
    case "unsupported_type":
      return t("This column type cannot be used for dates");
    default:
      return "";
  }
}

function ColumnSelect({
  id,
  label,
  value,
  attributes,
  mode,
  allowEmpty,
  emptyLabel,
  disabled,
  onChange,
  onUnavailableActivate,
}: {
  id: string;
  label: string;
  value: string;
  attributes: GeostatsAttribute[];
  mode: Exclude<DataTableTemporalMode, "none">;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onUnavailableActivate: (attr: GeostatsAttribute) => void;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm text-gray-200">{label}</span>
      <AttributeSelect
        id={id}
        attributes={attributes}
        value={value || undefined}
        onChange={onChange}
        placeholder={allowEmpty ? emptyLabel : t("Select a column")}
        includeNone={allowEmpty}
        disabled={disabled}
        fullWidth
        triggerClassName="border !border-white/10 bg-gray-900/40 px-2.5 text-left text-green-300 hover:!border-white/20 disabled:cursor-not-allowed disabled:opacity-40 [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate"
        contentStyle={{ zIndex: 80 }}
        contentMaxWidth={340}
        attributeAvailability={(attr) => {
          const availability = temporalColumnAvailability(attr, mode);
          if (availability.available) {
            return { available: true };
          }
          return {
            available: false,
            hint: unavailableColumnHint(availability.reason, t),
          };
        }}
        onUnavailableAttributeActivate={onUnavailableActivate}
      />
    </label>
  );
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
    case "dropping unmatched sites":
      return t("Removing sites not found in this layer…");
    case "deriving temporal columns":
      return t("Deriving date columns…");
    case "computing stats":
      return t("Computing coverage…");
    case "downloading parquet":
    case "downloading":
      return t("Reading table…");
    case "processing":
      return t("Processing…");
    default:
      return job.progressMessage || t("Reprocessing…");
  }
}

function TemporalReprocessOverlay({ job }: { job?: DataTableJob }) {
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
      {!failed ? (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-sky-400/10 to-transparent"
          initial={{ left: "-33%" }}
          animate={{ left: "100%" }}
          transition={{ duration: 2.6, loop: Infinity, ease: "linear" }}
        />
      ) : null}
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

export default function DataTableTemporalEditor({
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
  const [form, setForm] = useState<DataTableTemporalFormState>(() =>
    formStateFromTemporal(table.temporal)
  );
  const [preview, setPreview] = useState<TemporalPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [removeRequired, setRemoveRequired] = useState(false);
  const [columnHint, setColumnHint] = useState<{
    column: string;
    reason: TemporalColumnUnavailableReason;
    suggestedMode?: Exclude<DataTableTemporalMode, "none">;
  } | null>(null);

  const changeLogRefetchQueries = useMemo(
    () => dataTableMutationRefetchQueries(tableOfContentsItemId),
    [tableOfContentsItemId]
  );
  const [updateTemporal] = useUpdateOverlayDataTableTemporalMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });
  const [createReprocess] = useCreateOverlayDataTableReprocessMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });
  const [setVisualizationSettings] =
    useSetOverlayDataTableVisualizationSettingsMutation({
      onError,
      refetchQueries: changeLogRefetchQueries,
    });

  const attributes = useMemo(
    () =>
      (columnStats?.columns || [])
        .filter(
          (column) =>
            column.attribute && !column.attribute.startsWith("_when_")
        )
        .slice()
        .sort((a, b) =>
          a.attribute.localeCompare(b.attribute, undefined, {
            sensitivity: "base",
          })
        ),
    [columnStats?.columns]
  );

  useEffect(() => {
    if (open) {
      setForm(formStateFromTemporal(table.temporal));
      setPreview(null);
      setPreviewError(null);
      setRemoveRequired(false);
      setReprocessing(false);
      setColumnHint(null);
    }
  }, [open, table.temporal]);

  const config = useMemo(() => configFromForm(form), [form]);
  const mappedColumns = useMemo(
    () => (config ? sourceColumnsFromForm(form) : null),
    [config, form]
  );
  const mappedNames = mappedColumns
    ? [
        mappedColumns.kind === "instant"
          ? mappedColumns.column
          : mappedColumns.kind === "components"
          ? mappedColumns.year
          : mappedColumns.start,
        ...(mappedColumns && mappedColumns.kind === "components"
          ? [mappedColumns.month, mappedColumns.day]
          : []),
        ...(mappedColumns && mappedColumns.kind === "span"
          ? [mappedColumns.end]
          : []),
      ].filter((name): name is string => Boolean(name))
    : [];
  const requiredOverlap = (table.requiredFilterColumns || []).filter(
    (column): column is string =>
      typeof column === "string" && mappedNames.includes(column)
  );

  useEffect(() => {
    if (!open || !config) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    const previewUrl = temporalPreviewUrlForTable(table);
    if (!previewUrl) {
      setPreviewError(t("This table has no preview URL."));
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const handle = window.setTimeout(() => {
      const url = new URL(previewUrl);
      url.searchParams.set("config", JSON.stringify(config));
      const authorized = withHostedAuthParams(url.toString(), {
        accessToken: mapAccessToken,
      });
      fetch(authorized, { headers: { accept: "application/json" } })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              (await response.text()) || t("Preview request failed")
            );
          }
          return response.json() as Promise<TemporalPreviewResult>;
        })
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
            setPreviewError(null);
          }
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setPreview(null);
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
  }, [open, config, table, mapAccessToken, t]);

  const existing = isTemporalInfo(table.temporal) ? table.temporal : null;
  const allUnparseable =
    Boolean(preview) &&
    preview!.totalRows > 0 &&
    preview!.parseableCount === 0;
  const jobRunning =
    job &&
    (job.state === ProjectBackgroundJobState.Queued ||
      job.state === ProjectBackgroundJobState.Running);
  const jobFailed = job?.state === ProjectBackgroundJobState.Failed;
  const showJobOverlay = Boolean(reprocessing || jobRunning || jobFailed);

  const tabs: Array<{ id: DataTableTemporalMode; name: string }> = [
    { id: "none", name: t("None") },
    { id: "instant", name: t("A date column") },
    { id: "components", name: t("Year, month, day") },
    { id: "span", name: t("Start & end") },
  ];

  const setMode = (mode: DataTableTemporalMode) => {
    setColumnHint(null);
    setForm((prev) => {
      const next = { ...prev, mode };
      return mode === "none" ? next : applyNativeDefaults(next);
    });
  };

  const applyInstantColumn = (attr: GeostatsAttribute) => {
    setForm((prev) =>
      withInstantColumn({ ...prev, mode: "instant" }, attr.attribute, attr)
    );
  };

  const onUnavailableActivate = (attr: GeostatsAttribute) => {
    if (form.mode === "none") {
      return;
    }
    const availability = temporalColumnAvailability(attr, form.mode);
    if (availability.available) {
      return;
    }
    setColumnHint({
      column: attr.attribute,
      reason: availability.reason,
      suggestedMode: availability.suggestedMode,
    });
  };

  const save = async () => {
    if (saving || jobRunning) return;
    setSaving(true);
    try {
      if (form.mode === "none") {
        if (existing) {
          await updateTemporal({
            variables: { overlayDataTableId: table.id, temporal: null },
          });
        }
        onClose();
        return;
      }
      const nextConfig = configFromForm(form);
      if (!nextConfig) {
        return;
      }
      if (requiredOverlap.length > 0 && removeRequired) {
        await setVisualizationSettings({
          variables: {
            id: table.id,
            visualizationColumns: (table.visualizationColumns || []).filter(
              (column): column is string => Boolean(column)
            ),
            visualizationOps: (table.visualizationOps || []).filter(
              (column): column is string => Boolean(column)
            ),
            requiredFilterColumns: (table.requiredFilterColumns || []).filter(
              (column): column is string =>
                typeof column === "string" && !mappedNames.includes(column)
            ),
          },
        });
      }
      if (existing && isResolutionOnlyChange(form, existing)) {
        await updateTemporal({
          variables: {
            overlayDataTableId: table.id,
            temporal: temporalInfoWithResolutions(existing, form),
          },
        });
        onClose();
        return;
      }
      if (allUnparseable) {
        return;
      }
      setReprocessing(true);
      try {
        await createReprocess({
          variables: {
            tableId: table.id,
            temporalConfig: nextConfig as DataTableTemporalConfig,
          },
        });
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
    void save();
  };

  const bins = downsamplePreviewBins(preview?.availability?.bins || []);
  const maxBin = bins.reduce((acc, bin) => Math.max(acc, bin.count), 0);
  const allowedViews = allowedViewResolutionsForForm(form);
  const defaultView = allowedViews.includes(form.defaultViewResolution)
    ? form.defaultViewResolution
    : allowedViews[0];
  const parsedPrecision =
    preview?.nativeResolution || allowedViews[allowedViews.length - 1] || "day";
  const parsedHeader = t("Parsed ({{pattern}})", {
    pattern: parsedIsoPattern(parsedPrecision),
  });

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
            <div className="border-b border-gray-600">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <Dialog.Title className="min-w-0 flex-1 truncate font-medium text-indigo-100">
                  <Trans ns="admin:data">Temporal coverage</Trans>
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
              <div
                className={
                  showJobOverlay
                    ? "pointer-events-none opacity-40 transition-opacity duration-300"
                    : undefined
                }
              >
                <LayerEditorTabs
                  tabs={tabs.map((tab) => ({
                    ...tab,
                    current: form.mode === tab.id,
                  }))}
                  onSelect={(id) => {
                    if (!showJobOverlay) {
                      setMode(id as DataTableTemporalMode);
                    }
                  }}
                />
              </div>
            </div>

            <div
              className={`min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-5 ${
                showJobOverlay
                  ? "[&>:not(.temporal-preview)]:pointer-events-none [&>:not(.temporal-preview)]:opacity-40 [&>:not(.temporal-preview)]:transition-opacity [&>:not(.temporal-preview)]:duration-300"
                  : ""
              }`}
            >
              {form.mode === "none" && (
                <p className="text-sm text-gray-400">
                  <Trans ns="admin:data">
                    This table has no time. It will not appear on the
                    timeslider.
                  </Trans>
                </p>
              )}

              {columnHint && form.mode !== "none" && (
                <div className="rounded-md border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                  <p>
                    {columnHint.reason === "date_string" &&
                    columnHint.suggestedMode
                      ? t(
                          "{{column}} cannot be used with {{tab}}. It looks like date strings. Try {{suggested}} instead.",
                          {
                            column: columnHint.column,
                            tab:
                              tabs.find((tab) => tab.id === form.mode)?.name ||
                              form.mode,
                            suggested:
                              tabs.find(
                                (tab) => tab.id === columnHint.suggestedMode
                              )?.name || columnHint.suggestedMode,
                          }
                        )
                      : columnHint.reason === "not_numeric" &&
                        columnHint.suggestedMode
                      ? t(
                          "{{column}} cannot be used with {{tab}}. Those settings need number columns. If it contains dates, try {{suggested}}.",
                          {
                            column: columnHint.column,
                            tab:
                              tabs.find((tab) => tab.id === form.mode)?.name ||
                              form.mode,
                            suggested:
                              tabs.find(
                                (tab) => tab.id === columnHint.suggestedMode
                              )?.name || columnHint.suggestedMode,
                          }
                        )
                      : t(
                          "{{column}} cannot be used with {{tab}}.",
                          {
                            column: columnHint.column,
                            tab:
                              tabs.find((tab) => tab.id === form.mode)?.name ||
                              form.mode,
                          }
                        )}
                  </p>
                  {columnHint.suggestedMode &&
                  columnHint.suggestedMode !== form.mode ? (
                    <button
                      type="button"
                      className="mt-2 text-sm font-medium text-sky-200 underline hover:text-white"
                      onClick={() => {
                        const attr = attributes.find(
                          (column) => column.attribute === columnHint.column
                        );
                        if (attr && columnHint.suggestedMode === "instant") {
                          applyInstantColumn(attr);
                          setColumnHint(null);
                        } else if (columnHint.suggestedMode) {
                          setMode(columnHint.suggestedMode);
                        }
                      }}
                    >
                      {t("Switch to {{tab}}", {
                        tab:
                          tabs.find(
                            (tab) => tab.id === columnHint.suggestedMode
                          )?.name || columnHint.suggestedMode,
                      })}
                    </button>
                  ) : null}
                </div>
              )}

              {form.mode === "instant" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ColumnSelect
                    id="dt-temporal-instant-column"
                    label={t("Date column")}
                    value={form.instantColumn}
                    attributes={attributes}
                    mode="instant"
                    onChange={(instantColumn) => {
                      setColumnHint(null);
                      const attr = attributes.find(
                        (column) => column.attribute === instantColumn
                      );
                      setForm((prev) =>
                        withInstantColumn(prev, instantColumn, attr)
                      );
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-200">
                      {t("Date format")}
                    </span>
                    <select
                      value={form.instantFormat}
                      disabled={!form.instantColumn}
                      onChange={(event) =>
                        setForm((prev) =>
                          applyNativeDefaults({
                            ...prev,
                            instantFormat: event.target
                              .value as TemporalDateFormat,
                          })
                        )
                      }
                      className="block w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 py-1.5 text-sm text-green-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {DATE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {formatLabel(format, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {form.mode === "components" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ColumnSelect
                    id="dt-temporal-year"
                    label={t("Year")}
                    value={form.yearColumn}
                    attributes={attributes}
                    mode="components"
                    onChange={(yearColumn) => {
                      setColumnHint(null);
                      setForm((prev) => withComponentYear(prev, yearColumn));
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                  <ColumnSelect
                    id="dt-temporal-month"
                    label={t("Month")}
                    value={form.monthColumn}
                    attributes={attributes}
                    mode="components"
                    allowEmpty
                    emptyLabel={t("Optional")}
                    disabled={!form.yearColumn}
                    onChange={(monthColumn) => {
                      setColumnHint(null);
                      setForm((prev) => withComponentMonth(prev, monthColumn));
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                  <ColumnSelect
                    id="dt-temporal-day"
                    label={t("Day")}
                    value={form.dayColumn}
                    attributes={attributes}
                    mode="components"
                    allowEmpty
                    emptyLabel={t("Optional")}
                    disabled={!form.yearColumn || !form.monthColumn}
                    onChange={(dayColumn) => {
                      setColumnHint(null);
                      setForm((prev) =>
                        applyNativeDefaults({ ...prev, dayColumn })
                      );
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                </div>
              )}

              {form.mode === "span" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ColumnSelect
                    id="dt-temporal-span-start"
                    label={t("Start column")}
                    value={form.spanStartColumn}
                    attributes={attributes}
                    mode="span"
                    onChange={(spanStartColumn) => {
                      setColumnHint(null);
                      const attr = attributes.find(
                        (column) => column.attribute === spanStartColumn
                      );
                      setForm((prev) =>
                        withSpanStart(prev, spanStartColumn, attr)
                      );
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                  <ColumnSelect
                    id="dt-temporal-span-end"
                    label={t("End column")}
                    value={form.spanEndColumn}
                    attributes={attributes}
                    mode="span"
                    disabled={!form.spanStartColumn}
                    onChange={(spanEndColumn) => {
                      setColumnHint(null);
                      setForm((prev) =>
                        applyNativeDefaults({ ...prev, spanEndColumn })
                      );
                    }}
                    onUnavailableActivate={onUnavailableActivate}
                  />
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-200">
                      {t("Date format")}
                    </span>
                    <select
                      value={form.spanFormat}
                      disabled={!form.spanStartColumn}
                      onChange={(event) =>
                        setForm((prev) =>
                          applyNativeDefaults({
                            ...prev,
                            spanFormat: event.target
                              .value as TemporalDateFormat,
                          })
                        )
                      }
                      className="block w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 py-1.5 text-sm text-green-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {DATE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {formatLabel(format, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {form.mode !== "none" && (
                <>
                  <div
                    className={
                      form.mode === "instant"
                        ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                        : "grid grid-cols-1 gap-3 sm:grid-cols-3"
                    }
                  >
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-200">
                        {t("Default view")}
                      </span>
                      <select
                        value={defaultView}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            defaultViewResolution: event.target
                              .value as TemporalPrecision,
                          }))
                        }
                        className="block w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 py-1.5 text-sm text-green-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {allowedViews.map((resolution) => (
                          <option key={resolution} value={resolution}>
                            {resolutionLabel(resolution, t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div
                      className={
                        form.mode === "instant"
                          ? "space-y-1"
                          : "space-y-1 sm:col-span-2"
                      }
                    >
                      <div className="text-sm text-gray-200">
                        {t("Supported views")}
                      </div>
                      <div
                        role="group"
                        aria-label={t("Supported views")}
                        className="flex min-h-[2.375rem] flex-wrap items-center gap-x-5 gap-y-2"
                      >
                        {allowedViews.map((resolution) => {
                          const checked =
                            form.supportedViewResolutions.includes(resolution);
                          return (
                            <label
                              key={resolution}
                              className="inline-flex items-center gap-1.5 text-sm text-gray-200"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    supportedViewResolutions: checked
                                      ? prev.supportedViewResolutions.filter(
                                          (item) => item !== resolution
                                        )
                                      : [
                                          ...prev.supportedViewResolutions,
                                          resolution,
                                        ],
                                  }))
                                }
                              />
                              {resolutionLabel(resolution, t)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {requiredOverlap.length > 0 && (
                    <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      <p>
                        <Trans ns="admin:data">
                          These date columns are also required filters. The
                          timeslider will replace those dropdowns.
                        </Trans>
                      </p>
                      <label className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={removeRequired}
                          onChange={(event) =>
                            setRemoveRequired(event.target.checked)
                          }
                        />
                        {t("Remove them from required filters")}
                      </label>
                    </div>
                  )}

                  <section className="temporal-preview space-y-2">
                    <h3 className="text-sm font-medium text-gray-100">
                      {showJobOverlay
                        ? jobFailed
                          ? t("Reprocessing failed")
                          : t("Reprocessing")
                        : t("Preview")}
                    </h3>
                    <div
                      className={`relative flex h-64 min-w-0 flex-col overflow-hidden rounded-md border bg-black/20 ${
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
                      {statsLoading || previewLoading ? (
                        <p className="m-auto px-4 text-center text-sm italic text-gray-400">
                          {t("Reading table dates…")}
                        </p>
                      ) : previewError ? (
                        <p className="m-auto px-4 text-center text-sm text-red-300">
                          {previewError}
                        </p>
                      ) : preview ? (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                          <div className="min-h-[2.75rem] shrink-0 text-sm text-gray-300">
                            <p>
                              {t(
                                "{{parseable}} of {{total}} rows parsed. Coverage {{start}} – {{end}}.",
                                {
                                  parseable:
                                    preview.parseableCount.toLocaleString(),
                                  total: preview.totalRows.toLocaleString(),
                                  start:
                                    preview.coverage?.start || t("unknown"),
                                  end: preview.coverage?.end || t("present"),
                                }
                              )}
                            </p>
                            {preview.unparseableCount > 0 && (
                              <p className="text-amber-200">
                                {t(
                                  "{{unparseable}} rows could not be parsed and will be stored without a date.",
                                  {
                                    unparseable:
                                      preview.unparseableCount.toLocaleString(),
                                  }
                                )}
                              </p>
                            )}
                            {allUnparseable && (
                              <p className="text-red-300">
                                {t(
                                  "No rows parsed. Choose a different column or format before reprocessing."
                                )}
                              </p>
                            )}
                          </div>
                          <div
                            className="mt-2 flex h-10 w-full min-w-0 shrink-0 items-end gap-px overflow-hidden rounded bg-black/30 px-1 py-1"
                            aria-hidden
                          >
                            {maxBin > 0
                              ? bins.map((bin) => (
                                  <span
                                    key={bin.start}
                                    className="min-w-0 flex-1 bg-sky-400/70"
                                    style={{
                                      height: `${Math.max(
                                        8,
                                        (bin.count / maxBin) * 100
                                      )}%`,
                                    }}
                                  />
                                ))
                              : null}
                          </div>
                          <div className="mt-2 min-h-0 flex-1 overflow-auto rounded border border-white/10">
                            <table className="w-full text-left text-xs">
                              <thead className="sticky top-0 bg-gray-800 text-gray-300">
                                <tr>
                                  <th className="px-2 py-1 font-medium">
                                    {t("Value")}
                                  </th>
                                  <th className="px-2 py-1 font-medium">
                                    {parsedHeader}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {preview.samples.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={2}
                                      className="px-2 py-3 text-center italic text-gray-500"
                                    >
                                      {t("No sample rows")}
                                    </td>
                                  </tr>
                                ) : (
                                  preview.samples.map((sample, index) => (
                                    <tr
                                      key={index}
                                      className="border-t border-white/5"
                                    >
                                      <td className="px-2 py-1 font-mono text-gray-200">
                                        {Object.values(sample.raw)
                                          .map((value) => String(value ?? ""))
                                          .join(" · ")}
                                      </td>
                                      <td className="px-2 py-1">
                                        {sample.parsed
                                          ? sample.parsed.startIso
                                          : t("Could not parse")}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="m-auto px-4 text-center text-sm italic text-gray-400">
                          {t("Choose columns to preview parsed dates.")}
                        </p>
                      )}
                      </div>
                      <AnimatePresence>
                        {showJobOverlay ? (
                          <TemporalReprocessOverlay job={job} />
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </section>
                </>
              )}
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
                disabled={
                  showJobOverlay ||
                  (form.mode !== "none" &&
                    (!config || allUnparseable))
                }
              >
                {form.mode === "none" ||
                (existing && isResolutionOnlyChange(form, existing))
                  ? t("Save")
                  : t("Save and Reprocess")}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
