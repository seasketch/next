import { Dialog } from "@headlessui/react";
import { ExclamationCircleIcon, XIcon } from "@heroicons/react/outline";
import {
  DataTableOrganismConfig,
  ORGANISM_COLUMN_ROLES,
  OrganismCatalogRow,
  OrganismColumnRole,
  isOrganismInfo,
  rolesForColumn,
} from "@seasketch/geostats-types";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Spinner from "../../../components/Spinner";
import Switch from "../../../components/Switch";
import {
  JobDetailsFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  useCreateOverlayDataTableOrganismReprocessMutation,
  useSubmitOverlayDataTableUploadMutation,
  useUpdateOverlayDataTableOrganismMutation,
} from "../../../generated/graphql";
import { withHostedAuthParams } from "../../../dataLayers/tilesAuth";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "../../../dataLayers/useDataTableColumnStats";
import useCurrentProjectMetadata from "../../../useCurrentProjectMetadata";
import { dataTableMutationRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import LayerEditorTabs from "../TableOfContentsItemEditor/LayerEditorTabs";
import AttributeSelect from "../styleEditor/AttributeSelect";
import OrganismPreviewList from "./OrganismPreviewList";
import {
  useClearReprocessWhenJobSettles,
  useTrackOverlayDataTableJob,
} from "./useDataTableReprocessJob";
import {
  ORGANISM_EDITOR_STEPS,
  OrganismEditorFormState,
  OrganismEditorStep,
  classTableJoinColumnName,
  configFromForm,
  formStateFromOrganism,
  histogramDistinctCount,
  isOrganismPreviewPayload,
  observationAttributes,
  formatOrganismLookupProgress,
  organismJobProgressMessage,
  readCsvHeaders,
  rolesForEnrichment,
  sampleValuesForColumn,
  suggestValueKindForColumn,
  toggleOrganismRole,
} from "./dataTableOrganismForm";

type DataTableJob = Pick<
  JobDetailsFragment,
  "id" | "state" | "progress" | "progressMessage" | "errorMessage"
>;

type EditorView = "catalog" | "configure";

function roleLabel(
  role: OrganismColumnRole,
  t: (key: string) => string
) {
  switch (role) {
    case "code":
      return t("Code");
    case "scientificName":
      return t("Scientific name");
    case "genus":
      return t("Genus");
    case "species":
      return t("Species");
    case "commonName":
      return t("Common name");
    case "wormsAphiaId":
      return t("WoRMS ID");
    case "description":
      return t("Description");
    default:
      return role;
  }
}

function valueKindLabel(
  kind: OrganismEditorFormState["valueKind"],
  t: (key: string) => string
) {
  switch (kind) {
    case "code":
      return t("Codes");
    case "scientificName":
      return t("Scientific names");
    case "commonName":
      return t("Common names");
    default:
      return t("Mixed");
  }
}

function stepLabel(step: OrganismEditorStep, t: (key: string) => string) {
  switch (step) {
    case "identity":
      return t("Identity");
    case "classTable":
      return t("Class table");
    case "roles":
      return t("Roles");
    default:
      return t("Enrich");
  }
}

function reprocessProgressLabel(
  job: DataTableJob | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (!job) {
    return t("Starting enrichment…");
  }
  if (job.state === ProjectBackgroundJobState.Failed) {
    return job.errorMessage || t("Enrichment failed");
  }
  if (job.progressMessage === "uploading") {
    return t("Uploading class table…");
  }
  const mapped = organismJobProgressMessage(job.progressMessage);
  if (mapped?.kind === "lookup") {
    return formatOrganismLookupProgress(
      mapped.phase,
      mapped.done,
      mapped.total,
      t
    );
  }
  if (mapped?.kind === "key") {
    switch (mapped.key) {
      case "reading-table":
        return t("Reading table…");
      case "reading-class":
        return t("Reading class table…");
      case "resolving":
        return t("Looking up taxa…");
      case "writing":
        return t("Writing catalog…");
      default:
        break;
    }
  }
  return job.progressMessage || t("Enriching organisms…");
}

function OrganismReprocessOverlay({ job }: { job?: DataTableJob }) {
  const { t } = useTranslation("admin:data");
  const failed = job?.state === ProjectBackgroundJobState.Failed;
  const progress = job?.progress ?? 0;
  const label = reprocessProgressLabel(job, t);
  const percent = Math.round(progress * 100);

  return (
    <motion.div
      key="organism-reprocess-overlay"
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
          {failed ? t("Enrichment failed") : t("Enriching organisms…")}
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

async function putClassCsv(url: string, file: File) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "text/csv",
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Class table upload failed (${response.status})`);
  }
}

export default function DataTableOrganismEditor({
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

  const existing = isOrganismInfo(table.organism) ? table.organism : null;
  const [view, setView] = useState<EditorView>(existing ? "catalog" : "configure");
  const [step, setStep] = useState<OrganismEditorStep>("identity");
  const [form, setForm] = useState<OrganismEditorFormState>(() =>
    formStateFromOrganism(table.organism)
  );
  const [classFile, setClassFile] = useState<File | null>(null);
  const [classHeaders, setClassHeaders] = useState<string[]>([]);
  const [classFileError, setClassFileError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<OrganismCatalogRow[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const trackOverlayJob = useTrackOverlayDataTableJob();
  useClearReprocessWhenJobSettles({
    job,
    reprocessing,
    saving,
    setReprocessing,
    onSettled: () => setPreviewEpoch((value) => value + 1),
  });

  const changeLogRefetchQueries = useMemo(
    () => dataTableMutationRefetchQueries(tableOfContentsItemId),
    [tableOfContentsItemId]
  );
  const [createReprocess] = useCreateOverlayDataTableOrganismReprocessMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });
  const [submitUpload] = useSubmitOverlayDataTableUploadMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });
  const [updateOrganism] = useUpdateOverlayDataTableOrganismMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });

  const attributes = useMemo(
    () => observationAttributes(columnStats),
    [columnStats]
  );
  const roleColumns = classHeaders.length > 0 ? classHeaders : attributes.map(
    (attr) => attr.attribute
  );
  const joinColumn = classTableJoinColumnName(
    form.column,
    form.roles,
    roleColumns
  );
  const distinctHint = histogramDistinctCount(columnStats, form.column);
  const samples = sampleValuesForColumn(columnStats, form.column);
  const config = configFromForm(form);

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

  useEffect(() => {
    if (!open) return;
    setForm(formStateFromOrganism(table.organism));
    setClassFile(null);
    setClassHeaders([]);
    setClassFileError(null);
    setStep("identity");
    setView(isOrganismInfo(table.organism) ? "catalog" : "configure");
    setConfirmClear(false);
  }, [open, table.organism]);

  useEffect(() => {
    if (!open) {
      setReprocessing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || view !== "catalog" || !table.organismPreviewUrl) {
      if (!table.organismPreviewUrl) {
        setPreviewRows([]);
      }
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const authorized = withHostedAuthParams(table.organismPreviewUrl, {
      accessToken: mapAccessToken,
    });
    fetch(authorized, {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            (await response.text()) || t("Could not load the organism catalog.")
          );
        }
        return response.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        if (!isOrganismPreviewPayload(payload)) {
          throw new Error(t("Organism catalog preview is not valid JSON."));
        }
        setPreviewRows(payload.rows);
        setPreviewError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setPreviewRows([]);
          setPreviewError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, view, table.organismPreviewUrl, mapAccessToken, t, previewEpoch]);

  const applyClassFile = useCallback(
    async (file: File | null) => {
      setClassFile(file);
      setClassFileError(null);
      if (!file) {
        setClassHeaders([]);
        return;
      }
      try {
        const headers = await readCsvHeaders(file);
        if (headers.length === 0) {
          setClassHeaders([]);
          setClassFileError(t("Could not read column names from that CSV."));
          return;
        }
        setClassHeaders(headers);
      } catch (error) {
        setClassHeaders([]);
        setClassFileError(
          error instanceof Error
            ? error.message
            : t("Could not read that file.")
        );
      }
    },
    [t]
  );

  const goToStep = (next: OrganismEditorStep) => {
    if (next === "roles") {
      setForm((prev) => ({
        ...prev,
        roles: rolesForEnrichment(
          classHeaders.length > 0
            ? classHeaders
            : attributes.map((attr) => attr.attribute),
          prev.column,
          prev.valueKind,
          prev.roles
        ),
      }));
    }
    setStep(next);
  };

  const startEnrichment = async () => {
    if (!config || saving || jobRunning) return;
    setSaving(true);
    setReprocessing(true);
    try {
      const result = await createReprocess({
        variables: {
          tableId: table.id,
          organismConfig: config as DataTableOrganismConfig,
          classCsvFilename: classFile ? classFile.name : null,
          classCsvContentType: classFile
            ? classFile.type || "text/csv"
            : null,
        },
      });
      const payload = result.data?.createOverlayDataTableOrganismReprocess;
      const upload = payload?.overlayDataTableUpload;
      trackOverlayJob(tableOfContentsItemId, payload?.projectBackgroundJob);
      if (classFile) {
        if (!upload?.presignedUploadUrl || !upload.projectBackgroundJobId) {
          throw new Error(t("The class table upload URL was missing."));
        }
        await putClassCsv(upload.presignedUploadUrl, classFile);
        await submitUpload({
          variables: { jobId: upload.projectBackgroundJobId },
        });
      }
      onJobStarted();
    } catch {
      setReprocessing(false);
    } finally {
      setSaving(false);
    }
  };

  const clearOrganism = async () => {
    await updateOrganism({
      variables: { overlayDataTableId: table.id, organism: null },
    });
    onJobStarted();
    onClose();
  };

  const classifiedLabel =
    existing &&
    existing.classifiedCount != null &&
    existing.valueCount != null
      ? t("{{classified}}/{{total}} classified", {
          classified: existing.classifiedCount,
          total: existing.valueCount,
        })
      : null;

  const canAdvanceIdentity = Boolean(form.column);
  const stepIndex = ORGANISM_EDITOR_STEPS.indexOf(step);

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
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-700 text-gray-100 shadow-2xl [color-scheme:dark]"
          style={{ colorScheme: "dark" }}
        >
          <div className="border-b border-gray-600">
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <Dialog.Title className="min-w-0 flex-1 truncate font-medium text-indigo-100">
                <Trans ns="admin:data">Organism identity</Trans>
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
            {existing ? (
              <div
                className={
                  showJobOverlay
                    ? "pointer-events-none opacity-40 transition-opacity duration-300"
                    : undefined
                }
              >
                <LayerEditorTabs
                  tabs={[
                    { id: "catalog", name: t("Catalog"), current: view === "catalog" },
                    {
                      id: "configure",
                      name: t("Configure"),
                      current: view === "configure",
                    },
                  ]}
                  onSelect={(id) => {
                    if (!showJobOverlay) {
                      setView(id as EditorView);
                    }
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-x-hidden px-5 py-4 ${
                view === "catalog" ? "overflow-hidden" : "overflow-y-auto"
              }`}
            >
              {view === "catalog" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {existing ? (
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300">
                      {/* eslint-disable-next-line i18next/no-literal-string -- column identifier */}
                      <code className="font-mono text-green-300">{existing.column}</code>
                      <span>{valueKindLabel(existing.valueKind, t)}</span>
                      {classifiedLabel ? (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-100">
                          {classifiedLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-gray-400">
                      {t(
                        "This table has no organism identity yet. Configure a column to enrich it."
                      )}
                    </p>
                  )}
                  <OrganismPreviewList
                    rows={previewRows}
                    loading={previewLoading}
                    error={previewError}
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  <ol className="flex flex-wrap gap-1">
                    {ORGANISM_EDITOR_STEPS.map((item, index) => {
                      const current = item === step;
                      const reachable = index <= stepIndex || canAdvanceIdentity;
                      return (
                        <li key={item}>
                          <button
                            type="button"
                            disabled={!reachable || showJobOverlay}
                            onClick={() => goToStep(item)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              current
                                ? "bg-white/15 text-white"
                                : "text-gray-400 hover:bg-white/5 hover:text-gray-200 disabled:opacity-40"
                            }`}
                          >
                            {t("{{n}}. {{label}}", {
                              n: index + 1,
                              label: stepLabel(item, t),
                            })}
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  {step === "identity" ? (
                    <section className="space-y-4">
                      <p className="text-sm text-gray-300">
                        <Trans ns="admin:data">
                          Choose the observation column that identifies each
                          organism or category. Filter values stay the raw
                          strings in this column — including substrate and
                          lumps.
                        </Trans>
                      </p>
                      <label className="block min-w-0 space-y-1">
                        <span className="text-sm text-gray-200">
                          {t("Identity column")}
                        </span>
                        {statsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Spinner mini />
                            {t("Loading columns…")}
                          </div>
                        ) : (
                          <AttributeSelect
                            id="organism-identity-column"
                            attributes={attributes}
                            value={form.column || undefined}
                            onChange={(column) => {
                              setForm((prev) => ({
                                ...prev,
                                column,
                                valueKind: suggestValueKindForColumn(column),
                              }));
                            }}
                            placeholder={t("Select a column")}
                            fullWidth
                            triggerClassName="border !border-white/10 bg-gray-900/40 px-2.5 text-left text-green-300 hover:!border-white/20 disabled:cursor-not-allowed disabled:opacity-40 [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate"
                            contentStyle={{ zIndex: 80 }}
                            contentMaxWidth={340}
                          />
                        )}
                      </label>
                      <div>
                        <p className="mb-1.5 text-sm text-gray-200">
                          {t("Values look like")}
                        </p>
                        <LayerEditorTabs
                          tabs={(
                            [
                              "code",
                              "scientificName",
                              "commonName",
                              "mixed",
                            ] as const
                          ).map((kind) => ({
                            id: kind,
                            name: valueKindLabel(kind, t),
                            current: form.valueKind === kind,
                          }))}
                          onSelect={(id) =>
                            setForm((prev) => ({
                              ...prev,
                              valueKind: id as OrganismEditorFormState["valueKind"],
                            }))
                          }
                        />
                      </div>
                      {samples.length > 0 ? (
                        <p className="text-xs text-gray-400">
                          {distinctHint > 0
                            ? t(
                                "Examples: {{values}}. About {{n}} distinct values.",
                                {
                                  values: samples.join(", "),
                                  n: distinctHint.toLocaleString(),
                                }
                              )
                            : t("Examples: {{values}}", {
                                values: samples.join(", "),
                              })}
                        </p>
                      ) : null}
                    </section>
                  ) : null}

                  {step === "classTable" ? (
                    <section className="space-y-3">
                      <p className="text-sm text-gray-300">
                        <Trans ns="admin:data">
                          Optional. A class or species CSV is used for this run
                          only — scientific names, AphiaIDs, and notes. It is
                          not stored. Leave this empty if the identity column
                          already has useful names.
                        </Trans>
                      </p>
                      {existing ? (
                        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          {t(
                            "The previous class table was not kept. Upload it again if this run needs it."
                          )}
                        </p>
                      ) : null}
                      <label
                        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center hover:border-white/40"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const file = event.dataTransfer.files[0];
                          if (file) void applyClassFile(file);
                        }}
                      >
                        <span className="text-sm text-gray-200">
                          {classFile
                            ? classFile.name
                            : t("Drop a CSV here, or browse")}
                        </span>
                        <span className="mt-1 text-xs text-gray-400">
                          {classHeaders.length > 0
                            ? t("{{count}} columns", {
                                count: classHeaders.length,
                              })
                            : t(".csv class / taxon table")}
                        </span>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            void applyClassFile(file);
                          }}
                        />
                      </label>
                      {classFileError ? (
                        <p className="text-sm text-red-200">{classFileError}</p>
                      ) : null}
                      {classFile ? (
                        <button
                          type="button"
                          className="text-xs text-sky-300 hover:text-sky-200"
                          onClick={() => void applyClassFile(null)}
                        >
                          {t("Remove class table")}
                        </button>
                      ) : null}
                    </section>
                  ) : null}

                  {step === "roles" ? (
                    <section className="space-y-3">
                      <p className="text-sm text-gray-300">
                        {classFile
                          ? t(
                              "Confirm what each class-table column means. Heuristics are a starting point."
                            )
                          : t(
                              "Confirm roles on this observation table. Heuristics are a starting point."
                            )}
                      </p>
                      {classFile && !joinColumn ? (
                        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          {t(
                            "No join column yet. Assign a code, scientific name, or common name role — or include a column named like the identity column."
                          )}
                        </p>
                      ) : classFile && joinColumn ? (
                        <p className="text-xs text-gray-400">
                          {t("Joining class rows on {{column}}", {
                            column: joinColumn,
                          })}
                        </p>
                      ) : null}
                      <div className="overflow-hidden rounded-md border border-white/10">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-800 text-gray-300">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">
                                {t("Column")}
                              </th>
                              <th className="px-2 py-1.5 font-medium">
                                {t("Roles")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {roleColumns.map((column) => {
                              const assigned = rolesForColumn(
                                form.roles,
                                column
                              );
                              return (
                                <tr
                                  key={column}
                                  className="border-t border-white/5"
                                >
                                  <td className="px-2 py-1.5 align-top font-mono text-green-300">
                                    {column}
                                    {column === form.column ? (
                                      <span className="ml-1 font-sans text-[10px] uppercase tracking-wide text-sky-300">
                                        {t("identity")}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex flex-wrap gap-1">
                                      {ORGANISM_COLUMN_ROLES.map((role) => {
                                        const on = assigned.includes(role);
                                        return (
                                          <button
                                            key={role}
                                            type="button"
                                            onClick={() =>
                                              setForm((prev) => ({
                                                ...prev,
                                                roles: toggleOrganismRole(
                                                  prev.roles,
                                                  column,
                                                  role
                                                ),
                                              }))
                                            }
                                            className={`rounded-full px-2 py-0.5 ${
                                              on
                                                ? "bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/40"
                                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                                            }`}
                                          >
                                            {roleLabel(role, t)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  {step === "review" ? (
                    <section className="space-y-4">
                      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-md bg-black/20 px-3 py-2">
                          <dt className="text-xs text-gray-400">
                            {t("Identity column")}
                          </dt>
                          {/* eslint-disable-next-line i18next/no-literal-string -- column identifier */}
                          <dd className="font-mono text-green-300">
                            {form.column}
                          </dd>
                        </div>
                        <div className="rounded-md bg-black/20 px-3 py-2">
                          <dt className="text-xs text-gray-400">
                            {t("Values look like")}
                          </dt>
                          <dd>{valueKindLabel(form.valueKind, t)}</dd>
                        </div>
                        <div className="rounded-md bg-black/20 px-3 py-2">
                          <dt className="text-xs text-gray-400">
                            {t("Class table")}
                          </dt>
                          <dd>
                            {classFile
                              ? classFile.name
                              : t("None — enrich from this table")}
                          </dd>
                        </div>
                        <div className="rounded-md bg-black/20 px-3 py-2">
                          <dt className="text-xs text-gray-400">
                            {t("Distinct values")}
                          </dt>
                          <dd>
                            {distinctHint > 0
                              ? t("About {{n}}", {
                                  n: distinctHint.toLocaleString(),
                                })
                              : t("Unknown until enrichment")}
                          </dd>
                        </div>
                      </dl>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-3 py-3">
                        <div>
                          <p className="text-sm text-gray-100">
                            {t("Include low-confidence common-name matches")}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {t(
                              "Off by default. Guesses still appear in the catalog with a confidence badge. Turn this on to treat them as classified and put those iNaturalist ids on the search index."
                            )}
                          </p>
                        </div>
                        <Switch
                          isToggled={form.includeLowConfidenceMatches}
                          onClick={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              includeLowConfidenceMatches: value,
                            }))
                          }
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        {t(
                          "The first run can take several minutes while names are resolved. The observation table is not rewritten."
                        )}
                      </p>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
            <AnimatePresence>
              {showJobOverlay ? <OrganismReprocessOverlay job={job} /> : null}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-600 px-5 py-3">
            <div>
              {view === "catalog" && existing ? (
                confirmClear ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-300">
                      {t("Clear organism identity?")}
                    </span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200"
                      disabled={saving}
                      onClick={() => void clearOrganism()}
                    >
                      {t("Clear")}
                    </button>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-200"
                      onClick={() => setConfirmClear(false)}
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-red-300 hover:text-red-200 disabled:opacity-40"
                    disabled={showJobOverlay}
                    onClick={() => setConfirmClear(true)}
                  >
                    {t("Clear organism identity")}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {view === "catalog" ? (
                <>
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                    onClick={onClose}
                  >
                    {t("Close")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                    disabled={showJobOverlay}
                    onClick={() => setView("configure")}
                  >
                    {t("Re-enrich")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                    onClick={onClose}
                    disabled={saving}
                  >
                    {t("Cancel")}
                  </button>
                  {step !== "identity" ? (
                    <button
                      type="button"
                      className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                      disabled={showJobOverlay}
                      onClick={() =>
                        goToStep(ORGANISM_EDITOR_STEPS[stepIndex - 1])
                      }
                    >
                      {t("Back")}
                    </button>
                  ) : null}
                  {step !== "review" ? (
                    <button
                      type="button"
                      className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canAdvanceIdentity || showJobOverlay}
                      onClick={() =>
                        goToStep(ORGANISM_EDITOR_STEPS[stepIndex + 1])
                      }
                    >
                      {t("Next")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!config || showJobOverlay || saving}
                      onClick={() => void startEnrichment()}
                    >
                      {existing ? t("Re-enrich") : t("Enrich")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
