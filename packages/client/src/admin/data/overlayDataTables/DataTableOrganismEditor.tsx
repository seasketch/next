import { Dialog } from "@headlessui/react";
import { ExclamationCircleIcon, XIcon } from "@heroicons/react/outline";
import {
  DataTableOrganismConfig,
  ORGANISM_COLUMN_ROLES,
  ORGANISM_VALUE_KINDS,
  OrganismCatalogRow,
  OrganismColumnRole,
  OrganismRoles,
  isOrganismInfo,
  isOrganismValueKind,
  rolesForColumn,
} from "@seasketch/geostats-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import Spinner from "../../../components/Spinner";
import Switch from "../../../components/Switch";
import {
  JobDetailsFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  useCancelUploadMutation,
  useCreateOverlayDataTableOrganismReprocessMutation,
  useSubmitOverlayDataTableUploadMutation,
  useUpdateOverlayDataTableOrganismMutation,
} from "../../../generated/graphql";
import { buildDataTableQuerySearchParams } from "../../../dataLayers/dataTableQueryApi";
import { withHostedAuthParams } from "../../../dataLayers/tilesAuth";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "../../../dataLayers/useDataTableColumnStats";
import useCurrentProjectMetadata from "../../../useCurrentProjectMetadata";
import { dataTableMutationRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import AttributeSelect from "../styleEditor/AttributeSelect";
import OrganismPreviewList from "./OrganismPreviewList";
import {
  useClearReprocessWhenJobSettles,
  useTrackOverlayDataTableJob,
} from "./useDataTableReprocessJob";
import {
  OrganismEditorFormState,
  classTableJoinColumnName,
  configFromForm,
  distinctValuesFromColumnStats,
  formStateFromOrganism,
  formatOrganismLookupProgress,
  isOrganismPreviewPayload,
  joinOrganismCatalogRows,
  observationAttributes,
  organismFormIsDirty,
  organismJobProgressMessage,
  parseDistinctOrganismGroups,
  readCsvRecords,
  rolesForSourceAndJoinTables,
  sampleValuesForColumn,
  suggestValueKindForColumn,
  toggleOrganismRole,
} from "./dataTableOrganismForm";

type DataTableJob = Pick<
  JobDetailsFragment,
  "id" | "state" | "progress" | "progressMessage" | "errorMessage"
>;

function roleLabel(role: OrganismColumnRole, t: (key: string) => string) {
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

function ColumnRolesDetails({
  title,
  columns,
  roles,
  open,
  onOpenChange,
  badgeForColumn,
  onToggleRole,
}: {
  title: string;
  columns: string[];
  roles: OrganismRoles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badgeForColumn: (column: string) => string | null;
  onToggleRole: (column: string, role: OrganismColumnRole) => void;
}) {
  const { t } = useTranslation("admin:data");
  if (columns.length === 0) return null;
  return (
    <details
      open={open}
      className="min-h-0 rounded-md border border-white/10 bg-black/20"
    >
      <summary
        className="cursor-pointer px-3 py-2 text-sm text-gray-200"
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
      >
        {title}
      </summary>
      <div className="max-h-[22vh] overflow-y-auto px-2 pb-2">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-800 text-gray-300">
            <tr>
              <th className="px-2 py-1 font-medium">{t("Column")}</th>
              <th className="px-2 py-1 font-medium">{t("Roles")}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const assigned = rolesForColumn(roles, column);
              const badge = badgeForColumn(column);
              return (
                <tr key={column} className="border-t border-white/5">
                  <td className="px-2 py-1 align-top font-mono text-green-300">
                    {column}
                    {badge ? (
                      <span className="ml-1 font-sans text-[10px] uppercase tracking-wide text-sky-300">
                        {badge}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {ORGANISM_COLUMN_ROLES.map((role) => {
                        const on = assigned.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => onToggleRole(column, role)}
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
    </details>
  );
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

function reprocessProgressLabel(
  job: DataTableJob | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (!job) {
    return t("Starting lookup…");
  }
  if (job.state === ProjectBackgroundJobState.Failed) {
    return job.errorMessage || t("Lookup failed");
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
      case "worms-snapshot":
        return t("Loading WoRMS snapshot…");
      case "resolving":
        return t("Looking up taxa…");
      case "writing":
        return t("Writing catalog…");
      default:
        break;
    }
  }
  return job.progressMessage || t("Looking up taxa…");
}

/** Headless UI Dialog treats focus leaving the panel as dismiss. Radix
 * Select portals outside the panel and unmounts before that check runs. */
function useDialogNestedPickerGuard() {
  const blockedRef = useRef(false);
  const timerRef = useRef(0);

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  const setNestedPickerOpen = useCallback((open: boolean) => {
    window.clearTimeout(timerRef.current);
    if (open) {
      blockedRef.current = true;
      return;
    }
    blockedRef.current = true;
    timerRef.current = window.setTimeout(() => {
      blockedRef.current = false;
    }, 200);
  }, []);

  const shouldBlockDismiss = useCallback(() => blockedRef.current, []);

  return { setNestedPickerOpen, shouldBlockDismiss };
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
  const projectId = projectMeta?.project?.id;
  const { columnStats, loading: statsLoading } = useDataTableColumnStats(
    columnStatsUrlForTable(table),
    mapAccessToken
  );

  const existing = isOrganismInfo(table.organism) ? table.organism : null;
  const [form, setForm] = useState<OrganismEditorFormState>(() =>
    formStateFromOrganism(table.organism)
  );
  const [classFile, setClassFile] = useState<File | null>(null);
  const [classHeaders, setClassHeaders] = useState<string[]>([]);
  const [classRows, setClassRows] = useState<Array<Record<string, string>>>([]);
  const [classFileError, setClassFileError] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<OrganismCatalogRow[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [distinctValues, setDistinctValues] = useState<
    Array<{ value: string; occurrenceCount: number }>
  >([]);
  const [distinctError, setDistinctError] = useState<string | null>(null);
  const [distinctLoading, setDistinctLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [openRolesList, setOpenRolesList] = useState<
    "source" | "join" | null
  >("source");
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const trackOverlayJob = useTrackOverlayDataTableJob();
  useClearReprocessWhenJobSettles({
    job,
    reprocessing,
    saving,
    setReprocessing,
    onSettled: () => {
      setPreviewEpoch((value) => value + 1);
      if (job?.state === ProjectBackgroundJobState.Complete) {
        setClassFile(null);
        setClassHeaders([]);
        setClassRows([]);
      }
    },
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
  const [cancelJob] = useCancelUploadMutation({ onError });
  const { setNestedPickerOpen, shouldBlockDismiss } =
    useDialogNestedPickerGuard();

  const attributes = useMemo(
    () => observationAttributes(columnStats),
    [columnStats]
  );
  const observationColumns = useMemo(
    () => attributes.map((attr) => attr.attribute),
    [attributes]
  );
  const joinColumn =
    form.classJoinColumn && classHeaders.includes(form.classJoinColumn)
      ? form.classJoinColumn
      : "";
  const samples = sampleValuesForColumn(columnStats, form.column);
  const config = configFromForm(form, { classHeaders });
  const dirty = organismFormIsDirty(form, existing, Boolean(classFile));

  const jobRunning =
    job &&
    (job.state === ProjectBackgroundJobState.Queued ||
      job.state === ProjectBackgroundJobState.Running);
  const jobFailed = job?.state === ProjectBackgroundJobState.Failed;
  const lookupBusy = Boolean(
    jobRunning ||
      (reprocessing && job?.state !== ProjectBackgroundJobState.Complete)
  );

  useEffect(() => {
    if (!open) return;
    setForm(formStateFromOrganism(table.organism));
    setClassFile(null);
    setClassHeaders([]);
    setClassRows([]);
    setClassFileError(null);
    setConfirmClear(false);
    setOpenRolesList("source");
    if (!isOrganismInfo(table.organism)) {
      setSavedRows([]);
      setSavedError(null);
      setSavedLoading(false);
    }
  }, [open, table.organism]);

  useEffect(() => {
    if (!open) {
      setReprocessing(false);
      setCancelling(false);
    }
  }, [open]);

  useEffect(() => {
    const previewUrl = table.organismPreviewUrl;
    if (!open || !existing || !previewUrl) {
      if (!existing || !previewUrl) {
        setSavedRows([]);
        setSavedError(null);
        setSavedLoading(false);
      }
      return;
    }
    if (dirty && !lookupBusy) {
      return;
    }
    let cancelled = false;
    const load = (showSpinner: boolean) => {
      if (showSpinner) setSavedLoading(true);
      const authorized = withHostedAuthParams(previewUrl, {
        accessToken: mapAccessToken,
      });
      return fetch(authorized, {
        cache: "no-store",
        headers: { accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              (await response.text()) ||
                t("Could not load the organism catalog.")
            );
          }
          return response.json();
        })
        .then((payload: unknown) => {
          if (cancelled) return;
          if (!isOrganismPreviewPayload(payload)) {
            throw new Error(t("Organism catalog preview is not valid JSON."));
          }
          setSavedRows(payload.rows);
          setSavedError(null);
        })
        .catch((error: Error) => {
          if (!cancelled && showSpinner) {
            setSavedRows([]);
            setSavedError(error.message);
          }
        })
        .finally(() => {
          if (!cancelled && showSpinner) setSavedLoading(false);
        });
    };
    void load(!lookupBusy);
    if (!lookupBusy) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => {
      void load(false);
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    open,
    dirty,
    lookupBusy,
    existing,
    table.organismPreviewUrl,
    mapAccessToken,
    t,
    previewEpoch,
  ]);

  useEffect(() => {
    if (!open || !form.column) {
      setDistinctValues([]);
      setDistinctError(null);
      setDistinctLoading(false);
      return;
    }
    const fromStats = distinctValuesFromColumnStats(columnStats, form.column);
    if (fromStats) {
      setDistinctValues(fromStats);
      setDistinctError(null);
      setDistinctLoading(false);
      return;
    }
    if (statsLoading) {
      setDistinctLoading(true);
      return;
    }
    if (!table.queryUrl) {
      setDistinctValues([]);
      setDistinctError(t("This table has no query URL."));
      setDistinctLoading(false);
      return;
    }
    let cancelled = false;
    setDistinctLoading(true);
    const params = buildDataTableQuerySearchParams({
      groupBy: form.column,
      op: "count",
    });
    params.set("f", "json");
    const url = new URL(table.queryUrl, window.location.origin);
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    const authorized = withHostedAuthParams(url.toString(), {
      accessToken: mapAccessToken,
    });
    fetch(authorized, {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            (await response.text()) ||
              t("Could not load distinct values for this column.")
          );
        }
        return response.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        setDistinctValues(parseDistinctOrganismGroups(payload, form.column));
        setDistinctError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setDistinctValues([]);
          setDistinctError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setDistinctLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    form.column,
    columnStats,
    statsLoading,
    table.queryUrl,
    mapAccessToken,
    t,
  ]);

  const applyClassFile = useCallback(
    async (file: File | null) => {
      setClassFile(file);
      setClassFileError(null);
      if (!file) {
        setClassHeaders([]);
        setClassRows([]);
        setOpenRolesList("source");
        setForm((prev) => ({
          ...prev,
          classJoinColumn: "",
          roles: rolesForSourceAndJoinTables(
            observationColumns,
            [],
            prev.column,
            prev.valueKind,
            prev.roles
          ),
        }));
        return;
      }
      try {
        const parsed = await readCsvRecords(file);
        if (parsed.headers.length === 0) {
          setClassHeaders([]);
          setClassRows([]);
          setClassFileError(t("Could not read column names from that CSV."));
          return;
        }
        setClassHeaders(parsed.headers);
        setClassRows(parsed.rows);
        setOpenRolesList("join");
        setForm((prev) => {
          const roles = rolesForSourceAndJoinTables(
            observationColumns,
            parsed.headers,
            prev.column,
            prev.valueKind,
            prev.roles
          );
          const classJoinColumn = parsed.headers.includes(prev.classJoinColumn)
            ? prev.classJoinColumn
            : classTableJoinColumnName(
                prev.column,
                roles,
                parsed.headers
              ) || "";
          return { ...prev, roles, classJoinColumn };
        });
      } catch (error) {
        setClassHeaders([]);
        setClassRows([]);
        setClassFileError(
          error instanceof Error
            ? error.message
            : t("Could not read that file.")
        );
      }
    },
    [observationColumns, t]
  );

  const startLookup = async () => {
    setOpenRolesList(null);
    if (!config || saving || jobRunning) return;
    setSaving(true);
    setReprocessing(true);
    try {
      const result = await createReprocess({
        variables: {
          tableId: table.id,
          organismConfig: config as DataTableOrganismConfig,
          classCsvFilename: classFile ? classFile.name : null,
          classCsvContentType: classFile ? classFile.type || "text/csv" : null,
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

  const cancelLookup = async () => {
    if (!projectId || !job?.id || cancelling) return;
    setCancelling(true);
    try {
      await cancelJob({
        variables: { projectId, jobId: job.id },
      });
      setReprocessing(false);
      onJobStarted();
    } finally {
      setCancelling(false);
    }
  };

  const clearOrganism = async () => {
    await updateOrganism({
      variables: { overlayDataTableId: table.id, organism: null },
    });
    onJobStarted();
    onClose();
  };

  const joinRows = useMemo(() => {
    if (!config || distinctValues.length === 0) return [];
    return joinOrganismCatalogRows({
      values: distinctValues,
      classRows,
      config,
    });
  }, [config, distinctValues, classRows]);

  const useSaved =
    Boolean(existing) && savedRows.length > 0 && (!dirty || lookupBusy);
  const previewRows = useSaved ? savedRows : joinRows;
  const previewLoading =
    (!useSaved && distinctLoading) || (useSaved && savedLoading && !lookupBusy);
  const previewError = useSaved ? savedError || distinctError : distinctError;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (saving || shouldBlockDismiss()) return;
        onClose();
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-gray-700 text-gray-100 shadow-2xl [color-scheme:dark]"
          style={{ colorScheme: "dark" }}
        >
          <div className="flex items-start gap-2 border-b border-gray-600 px-5 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-medium text-indigo-100">
                <Trans ns="admin:data">Subjects and organisms</Trans>
              </Dialog.Title>
              <p className="mt-1.5 text-sm leading-5 text-gray-300">
                <Trans ns="admin:data">
                  If this table represents observations of marine species, you
                  can identify column(s) that represent these subjects to
                  display rich inputs for filtering records by species name,
                  common name, or searching by higher-order taxonomy (e.g.
                  Sebastes). Taxonomic information will be supplemented with
                  data from{" "}
                  <a
                    href="https://www.marinespecies.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-sky-200"
                  >
                    WoRMS
                  </a>
                  , and photos will be dynamically displayed from{" "}
                  <a
                    href="https://www.inaturalist.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-sky-200"
                  >
                    iNaturalist
                  </a>
                  .
                </Trans>
              </p>
            </div>
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
            className={`min-h-0 shrink-0 space-y-3 overflow-y-auto border-b border-gray-600 px-5 py-3 ${
              lookupBusy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13.5rem]">
              <label className="block min-w-0 space-y-1">
                <span className="text-sm text-gray-200">
                  {t("Subject column")}
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
                    preventCloseAutoFocus={false}
                    onOpenChange={setNestedPickerOpen}
                    value={form.column || undefined}
                    onChange={(column) => {
                      const valueKind = suggestValueKindForColumn(column);
                      setForm((prev) => ({
                        ...prev,
                        column,
                        valueKind,
                        roles: rolesForSourceAndJoinTables(
                          observationColumns,
                          classHeaders,
                          column,
                          valueKind,
                          prev.roles
                        ),
                      }));
                    }}
                    placeholder={t("Select a column")}
                    fullWidth
                    triggerClassName="border !border-white/10 bg-gray-900/40 px-2.5 text-left text-green-300 hover:!border-white/20 disabled:cursor-not-allowed disabled:opacity-40 [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate"
                    contentStyle={{ zIndex: 80 }}
                    contentMaxWidth={340}
                  />
                )}
                {samples.length > 0 ? (
                  <p className="truncate text-xs text-gray-400">
                    {t("Examples: {{values}}", {
                      values: samples.join(", "),
                    })}
                  </p>
                ) : null}
              </label>
              <label className="block min-w-0 space-y-1">
                <span className="text-sm text-gray-200">
                  {t("Treat as")}
                </span>
                <select
                  value={form.valueKind}
                  onChange={(event) => {
                    const valueKind = event.target.value;
                    if (!isOrganismValueKind(valueKind)) return;
                    setForm((prev) => ({
                      ...prev,
                      valueKind,
                      roles: rolesForSourceAndJoinTables(
                        observationColumns,
                        classHeaders,
                        prev.column,
                        valueKind,
                        prev.roles
                      ),
                    }));
                  }}
                  className="h-[2.375rem] w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 text-sm text-green-300 outline-none hover:border-white/20 focus:ring-2 focus:ring-blue-600"
                >
                  {ORGANISM_VALUE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {valueKindLabel(kind, t)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-white/20 bg-black/20 px-3 py-1.5 text-sm hover:border-white/40"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) void applyClassFile(file);
                }}
              >
                <span className="text-gray-200">
                  {classFile ? classFile.name : t("Optional class / taxon CSV")}
                </span>
                {classHeaders.length > 0 ? (
                  <span className="text-xs text-gray-400">
                    {t("{{count}} columns", { count: classHeaders.length })}
                  </span>
                ) : null}
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
              {classFile ? (
                <button
                  type="button"
                  className="text-xs text-sky-300 hover:text-sky-200"
                  onClick={() => void applyClassFile(null)}
                >
                  {t("Remove class table")}
                </button>
              ) : existing ? (
                <p className="text-xs text-amber-100/80">
                  {t("Previous class table was not kept.")}
                </p>
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-300">
                  {t("Include low-confidence matches")}
                </span>
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
            </div>
            {classFileError ? (
              <p className="text-sm text-red-200">{classFileError}</p>
            ) : null}
            {classFile ? (
              <label className="block min-w-0 space-y-1">
                <span className="text-sm text-gray-200">
                  {t("Class table join column")}
                </span>
                <select
                  value={form.classJoinColumn}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      classJoinColumn: event.target.value,
                    }))
                  }
                  className="h-[2.375rem] w-full rounded-md border border-white/10 bg-gray-900/40 px-2.5 text-sm text-green-300 outline-none hover:border-white/20 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">
                    {t("Select the column that matches {{column}}", {
                      column: form.column || t("the identity column"),
                    })}
                  </option>
                  {classHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">
                  {t(
                    "Required. Identity-column values are matched to this class-table column."
                  )}
                </p>
              </label>
            ) : (
              <p className="text-xs text-gray-400">
                <Trans ns="admin:data">
                  Leave the class table empty if this column already has useful
                  names. Lookup uses WoRMS and Wikidata — not iNaturalist.
                </Trans>
              </p>
            )}

            {form.column ? (
              <div className="space-y-2">
                <ColumnRolesDetails
                  title={t("Source table column roles")}
                  columns={observationColumns}
                  roles={form.roles}
                  open={openRolesList === "source"}
                  onOpenChange={(nextOpen) =>
                    setOpenRolesList(nextOpen ? "source" : null)
                  }
                  badgeForColumn={(column) =>
                    column === form.column ? t("identity") : null
                  }
                  onToggleRole={(column, role) =>
                    setForm((prev) => ({
                      ...prev,
                      roles: toggleOrganismRole(prev.roles, column, role),
                    }))
                  }
                />
                <ColumnRolesDetails
                  title={t("Join table column roles")}
                  columns={classHeaders}
                  roles={form.roles}
                  open={openRolesList === "join"}
                  onOpenChange={(nextOpen) =>
                    setOpenRolesList(nextOpen ? "join" : null)
                  }
                  badgeForColumn={(column) =>
                    column === joinColumn ? t("join") : null
                  }
                  onToggleRole={(column, role) =>
                    setForm((prev) => ({
                      ...prev,
                      roles: toggleOrganismRole(prev.roles, column, role),
                    }))
                  }
                />
              </div>
            ) : null}
          </div>

          {lookupBusy || jobFailed ? (
            <div
              className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/30 px-5 py-2.5"
              role="status"
              aria-live="polite"
            >
              {jobFailed ? (
                <ExclamationCircleIcon
                  className="h-5 w-5 shrink-0 text-red-300"
                  aria-hidden
                />
              ) : (
                <Spinner color="white" className="shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    jobFailed ? "text-red-100" : "text-gray-100"
                  }`}
                >
                  {jobFailed
                    ? t("Lookup failed")
                    : reprocessProgressLabel(job, t)}
                </p>
                {jobFailed ? (
                  <p className="truncate text-xs text-red-200/90">
                    {reprocessProgressLabel(job, t)}
                  </p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-[width] duration-500"
                      style={{
                        width: `${Math.round((job?.progress ?? 0) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              {lookupBusy ? (
                <button
                  type="button"
                  className="shrink-0 text-sm text-sky-300 hover:text-sky-200 disabled:opacity-40"
                  disabled={cancelling || !projectId}
                  onClick={() => void cancelLookup()}
                >
                  {t("Cancel")}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
            <OrganismPreviewList
              rows={previewRows}
              loading={previewLoading}
              error={previewError}
              emptyLabel={
                form.column
                  ? t("No values in this column yet.")
                  : t("Choose an identity column to preview values.")
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-600 px-5 py-3">
            <div>
              {existing ? (
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
                      {t("Keep")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-red-300 hover:text-red-200 disabled:opacity-40"
                    disabled={lookupBusy}
                    onClick={() => setConfirmClear(true)}
                  >
                    {t("Clear organism identity")}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                onClick={onClose}
                disabled={saving}
              >
                {t("Close")}
              </button>
              <button
                type="button"
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  !config ||
                  lookupBusy ||
                  saving ||
                  !form.column ||
                  (classHeaders.length > 0 && !joinColumn)
                }
                onClick={() => void startLookup()}
              >
                {t("Classify taxa")}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
