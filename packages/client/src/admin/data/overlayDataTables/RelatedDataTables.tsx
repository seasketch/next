import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  CheckIcon,
  CogIcon,
  TrashIcon,
  UploadIcon,
} from "@heroicons/react/outline";
import {
  FullAdminOverlayFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useGetLayerItemQuery,
  useRenameOverlayDataTableMutation,
  useSetOverlayDataTableVisualizationSettingsMutation,
  useSoftDeleteOverlayDataTableMutation,
} from "../../../generated/graphql";
import { GeostatsLayer } from "@seasketch/geostats-types";
import { ProjectBackgroundJobContext } from "../../uploads/ProjectBackgroundJobContext";
import { dataTableChangeLogRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import DataTableUploadJobProgress from "./DataTableUploadJobProgress";
import DataTableUploadModal from "./DataTableUploadModal";
import { DATA_TABLE_AGGREGATIONS } from "../../../dataLayers/dataTableQueryApi";
import {
  columnStatsUrlForTable,
  numericColumnNames,
  useDataTableColumnStats,
} from "../../../dataLayers/useDataTableColumnStats";
import useCurrentProjectMetadata from "../../../useCurrentProjectMetadata";
import useDialog from "../../../components/useDialog";
import Modal from "../../../components/Modal";

type RelatedDataTablesProps = {
  item: FullAdminOverlayFragment;
};

type DataTableJob = NonNullable<
  FullAdminOverlayFragment["projectBackgroundJobs"]
>[number];

function isActiveDataTableJob(job: DataTableJob) {
  return (
    job.type === ProjectBackgroundJobType.DataTableUpload &&
    (job.state === ProjectBackgroundJobState.Queued ||
      job.state === ProjectBackgroundJobState.Running ||
      job.state === ProjectBackgroundJobState.Failed)
  );
}

function getJobForTable(tableId: number, jobs: DataTableJob[]) {
  return jobs.find(
    (job) =>
      isActiveDataTableJob(job) &&
      job.overlayDataTableUpload?.replaceOverlayDataTableId === tableId
  );
}

/**
 * Map visualization limits (`visualization_columns` / `visualization_ops`).
 * Empty lists mean end users may choose freely.
 */
function MapDisplaySettings({
  table,
  selectedColumns,
  selectedOps,
  selectedRequiredFilters,
  onColumnsChange,
  onOpsChange,
  onRequiredFiltersChange,
}: {
  table: OverlayDataTableDetailsFragment;
  selectedColumns: string[];
  selectedOps: string[];
  selectedRequiredFilters: string[];
  onColumnsChange: (columns: string[]) => void;
  onOpsChange: (ops: string[]) => void;
  onRequiredFiltersChange: (columns: string[]) => void;
}) {
  const { t } = useTranslation("admin:data");
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const { columnStats, loading } = useDataTableColumnStats(
    columnStatsUrlForTable(table),
    mapAccessToken
  );
  const numericColumns = numericColumnNames(columnStats);
  const filterableColumns = useMemo(
    () =>
      (columnStats?.columns || [])
        .map((column) => column.attribute)
        .filter(
          (column) => column && column !== table.joinColumn
        )
        .sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        ),
    [columnStats?.columns, table.joinColumn]
  );

  const toggleColumn = (column: string) => {
    onColumnsChange(
      selectedColumns.includes(column)
        ? selectedColumns.filter((c) => c !== column)
        : [...selectedColumns, column]
    );
  };

  const toggleOp = (op: string) => {
    onOpsChange(
      selectedOps.includes(op)
        ? selectedOps.filter((o) => o !== op)
        : [...selectedOps, op]
    );
  };

  const toggleRequiredFilter = (column: string) => {
    onRequiredFiltersChange(
      selectedRequiredFilters.includes(column)
        ? selectedRequiredFilters.filter((c) => c !== column)
        : [...selectedRequiredFilters, column]
    );
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">
            {t("Data columns")}
          </p>
          <p className="text-xs text-gray-500">
            {t("Choose which measurements users can map.")}
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 italic">
            {t("Loading column metadata...")}
          </p>
        ) : numericColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            {t("No numeric columns found.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                selectedColumns.length === 0
                  ? "border-primary-500 bg-primary-50 text-primary-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => onColumnsChange([])}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {selectedColumns.length === 0 ? (
                  <CheckIcon className="h-4 w-4" />
                ) : null}
              </span>
              {t("All columns")}
            </button>
            {numericColumns.map((column: string) => (
              <button
                type="button"
                key={column}
                className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedColumns.includes(column)
                    ? "border-primary-500 bg-primary-50 text-primary-800"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => toggleColumn(column)}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selectedColumns.includes(column) ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : null}
                </span>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="truncate">{column}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">
            {t("Calculations")}
          </p>
          <p className="text-xs text-gray-500">
            {t("Choose how users can summarize values for each feature.")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
              selectedOps.length === 0
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => onOpsChange([])}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {selectedOps.length === 0 ? (
                <CheckIcon className="h-4 w-4" />
              ) : null}
            </span>
            {t("All calculations")}
          </button>
          {DATA_TABLE_AGGREGATIONS.map((op) => (
            <button
              type="button"
              key={op}
              className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                selectedOps.includes(op)
                  ? "border-primary-500 bg-primary-50 text-primary-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => toggleOp(op)}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {selectedOps.includes(op) ? (
                  <CheckIcon className="h-4 w-4" />
                ) : null}
              </span>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {op}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">
            {t("Required filters")}
          </p>
          <p className="text-xs text-gray-500">
            {t(
              "These filters always appear in the legend. Users must choose a value and cannot remove them."
            )}
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 italic">
            {t("Loading column metadata...")}
          </p>
        ) : filterableColumns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            {t("No filterable columns found.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                selectedRequiredFilters.length === 0
                  ? "border-primary-500 bg-primary-50 text-primary-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => onRequiredFiltersChange([])}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {selectedRequiredFilters.length === 0 ? (
                  <CheckIcon className="h-4 w-4" />
                ) : null}
              </span>
              {t("None required")}
            </button>
            {filterableColumns.map((column: string) => (
              <button
                type="button"
                key={column}
                className={`flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedRequiredFilters.includes(column)
                    ? "border-primary-500 bg-primary-50 text-primary-800"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => toggleRequiredFilter(column)}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selectedRequiredFilters.includes(column) ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : null}
                </span>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="truncate">{column}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTableSettingsModal({
  table,
  onClose,
  onRename,
  onDelete,
  onReplace,
  onSetVisualizationSettings,
}: {
  table: OverlayDataTableDetailsFragment;
  onClose: () => void;
  onRename: (id: number, name: string) => void | Promise<void>;
  onDelete: (id: number) => void;
  onReplace: (id: number) => void;
  onSetVisualizationSettings: (
    id: number,
    visualizationColumns: string[],
    visualizationOps: string[],
    requiredFilterColumns: string[]
  ) => void | Promise<void>;
}) {
  const { t } = useTranslation("admin:data");
  const [draftName, setDraftName] = useState(table.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [draftColumns, setDraftColumns] = useState<string[]>(
    (table.visualizationColumns || []).filter(Boolean) as string[]
  );
  const [draftOps, setDraftOps] = useState<string[]>(
    (table.visualizationOps || []).filter(Boolean) as string[]
  );
  const [draftRequiredFilters, setDraftRequiredFilters] = useState<string[]>(
    (table.requiredFilterColumns || []).filter(Boolean) as string[]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftName(table.name);
    setNameError(undefined);
    setDraftColumns(
      (table.visualizationColumns || []).filter(Boolean) as string[]
    );
    setDraftOps((table.visualizationOps || []).filter(Boolean) as string[]);
    setDraftRequiredFilters(
      (table.requiredFilterColumns || []).filter(Boolean) as string[]
    );
  }, [
    table.name,
    table.visualizationColumns,
    table.visualizationOps,
    table.requiredFilterColumns,
  ]);

  const originalColumns = (table.visualizationColumns || []).filter(
    Boolean
  ) as string[];
  const originalOps = (table.visualizationOps || []).filter(
    Boolean
  ) as string[];
  const originalRequiredFilters = (table.requiredFilterColumns || []).filter(
    Boolean
  ) as string[];
  const nameDirty = draftName.trim() !== table.name;
  const displayDirty =
    JSON.stringify(draftColumns) !== JSON.stringify(originalColumns) ||
    JSON.stringify(draftOps) !== JSON.stringify(originalOps) ||
    JSON.stringify(draftRequiredFilters) !==
      JSON.stringify(originalRequiredFilters);
  const dirty = nameDirty || displayDirty;

  const saveChanges = async () => {
    const next = draftName.trim();
    if (!next) {
      setNameError(t("Name is required"));
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      if (nameDirty) {
        await onRename(table.id, next);
      }
      if (displayDirty) {
        await onSetVisualizationSettings(
          table.id,
          draftColumns,
          draftOps,
          draftRequiredFilters
        );
      }
      onClose();
    } catch (e) {
      setNameError((e as Error).message || t("Could not rename table"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <Modal
      open
      onRequestClose={onClose}
      title={t("Data table settings")}
      scrollable
      autoWidth
      tipyTop
      panelClassName="sm:max-w-lg"
      footerClassName="items-center !py-3"
      footer={[
        {
          label: t("Cancel"),
          onClick: onClose,
          disabled: saving,
        },
        {
          label: t("Save changes"),
          variant: "primary",
          onClick: () => void saveChanges(),
          disabled: !dirty || saving,
          loading: saving,
        },
      ]}
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <label
            htmlFor="data-table-name"
            className="block text-sm font-medium text-gray-900"
          >
            {t("Table name")}
          </label>
          <input
            id="data-table-name"
            name="data-table-name"
            value={draftName}
            onChange={(event) => {
              setDraftName(event.target.value);
              setNameError(undefined);
            }}
            className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              nameError ? "border-red-400" : "border-gray-300"
            }`}
          />
          {nameError ? (
            <p className="text-xs text-red-600">{nameError}</p>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("Map display options")}
            </h3>
            <p className="text-sm text-gray-500">
              {t(
                "Control the choices available when someone displays this table on the map."
              )}
            </p>
          </div>
          <MapDisplaySettings
            table={table}
            selectedColumns={draftColumns}
            selectedOps={draftOps}
            selectedRequiredFilters={draftRequiredFilters}
            onColumnsChange={setDraftColumns}
            onOpsChange={setDraftOps}
            onRequiredFiltersChange={setDraftRequiredFilters}
          />
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("Table data")}
            </h3>
            <p className="text-sm text-gray-500">
              {t("Upload a new version or remove this table from the layer.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => {
                onClose();
                onReplace(table.id);
              }}
            >
              <UploadIcon className="h-4 w-4 text-gray-500" aria-hidden />
              {t("Upload new version")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={() => {
                onClose();
                onDelete(table.id);
              }}
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
              {t("Delete table")}
            </button>
          </div>
        </section>
      </div>
    </Modal>,
    document.body
  );
}

function DataTableRow({
  table,
  job,
  onDismissJob,
  onRename,
  onDelete,
  onReplace,
  onSetVisualizationSettings,
}: {
  table: OverlayDataTableDetailsFragment;
  job?: DataTableJob;
  onDismissJob: (jobId: string) => void;
  onRename: (id: number, name: string) => void | Promise<void>;
  onDelete: (id: number) => void;
  onReplace: (id: number) => void;
  onSetVisualizationSettings: (
    id: number,
    visualizationColumns: string[],
    visualizationOps: string[],
    requiredFilterColumns: string[]
  ) => void | Promise<void>;
}) {
  const { t } = useTranslation("admin:data");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sameJoinColumn = table.joinColumn === table.overlayJoinColumn;

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-medium text-gray-900">{table.name}</span>{" "}
          <span className="text-gray-400 text-xs font-normal">
            {t("v{{version}}", { version: table.version })}
          </span>
        </div>
        {!job && (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setSettingsOpen(true)}
          >
            <CogIcon className="h-4 w-4" aria-hidden />
            {t("Settings")}
          </button>
        )}
      </div>
      {job ? (
        <div className="mt-2">
          <DataTableUploadJobProgress
            job={job}
            onDismiss={
              job.state === ProjectBackgroundJobState.Failed
                ? () => onDismissJob(job.id)
                : undefined
            }
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          {t("{{rowCount}} rows · joined by", {
            rowCount: table.rowCount.toLocaleString(),
          })}{" "}
          {/* eslint-disable-next-line i18next/no-literal-string -- column identifiers */}
          <code className="text-gray-600 font-mono text-[11px]">
            {table.joinColumn}
          </code>
          {!sameJoinColumn && (
            <>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-gray-400"> → </span>
              {/* eslint-disable-next-line i18next/no-literal-string -- column identifiers */}
              <code className="text-gray-600 font-mono text-[11px]">
                {table.overlayJoinColumn}
              </code>
            </>
          )}
        </p>
      )}
      {settingsOpen ? (
        <DataTableSettingsModal
          table={table}
          onClose={() => setSettingsOpen(false)}
          onRename={onRename}
          onDelete={onDelete}
          onReplace={onReplace}
          onSetVisualizationSettings={onSetVisualizationSettings}
        />
      ) : null}
    </li>
  );
}

function PendingDataTableUploadRow({
  job,
  onDismissJob,
}: {
  job: DataTableJob;
  onDismissJob: (jobId: string) => void;
}) {
  const filename =
    job.overlayDataTableUpload?.filename ||
    job.title
      ?.replace(/^Replacement data table /, "")
      .replace(/^Data table /, "");

  return (
    <li className="rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-3 shadow-sm space-y-1.5">
      <p className="text-sm font-medium text-gray-900 truncate">{filename}</p>
      <DataTableUploadJobProgress
        job={job}
        onDismiss={
          job.state === ProjectBackgroundJobState.Failed
            ? () => onDismissJob(job.id)
            : undefined
        }
      />
    </li>
  );
}

export default function RelatedDataTables({ item }: RelatedDataTablesProps) {
  const { t } = useTranslation("admin:data");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceId, setReplaceId] = useState<number | undefined>();
  const { manager } = useContext(ProjectBackgroundJobContext);
  const client = useApolloClient();
  const { confirmDelete } = useDialog();

  const { data, refetch } = useGetLayerItemQuery({
    variables: { id: item.id },
    fetchPolicy: "cache-and-network",
  });

  const layerItem = data?.tableOfContentsItem ?? item;
  const tables = layerItem.overlayDataTables || [];
  const layer = layerItem.dataLayer;
  const source = layer?.dataSource;
  const geostatsLayer: GeostatsLayer | undefined = useMemo(() => {
    const layers = (source?.geostats?.layers || []) as GeostatsLayer[];
    if (!layer) {
      return undefined;
    }
    return (
      layers.find((entry) =>
        layer.sourceLayer ? entry.layer === layer.sourceLayer : true
      ) || layers[0]
    );
  }, [layer, source?.geostats?.layers]);
  const overlayJoinColumn = layerItem.dataTableJoinColumn || "";

  const changeLogRefetchQueries = useMemo(
    () => [...dataTableChangeLogRefetchQueries(layerItem.id)],
    [layerItem.id],
  );

  const refetchTablesAndHistory = useCallback(async () => {
    await refetch();
    await client.refetchQueries({
      include: changeLogRefetchQueries as Parameters<
        typeof client.refetchQueries
      >[0]["include"],
    });
  }, [refetch, client, changeLogRefetchQueries]);

  const [renameTable] = useRenameOverlayDataTableMutation({
    refetchQueries: changeLogRefetchQueries,
  });
  const [deleteTable] = useSoftDeleteOverlayDataTableMutation({
    refetchQueries: changeLogRefetchQueries,
  });
  const [setVisualizationSettingsMutation] =
    useSetOverlayDataTableVisualizationSettingsMutation({
      refetchQueries: changeLogRefetchQueries,
    });

  const onSetVisualizationSettings = useCallback(
    async (
      id: number,
      visualizationColumns: string[],
      visualizationOps: string[],
      requiredFilterColumns: string[]
    ) => {
      await setVisualizationSettingsMutation({
        variables: {
          id,
          visualizationColumns,
          visualizationOps,
          requiredFilterColumns,
        },
      });
    },
    [setVisualizationSettingsMutation]
  );

  const dataTableJobs = useMemo(
    () =>
      (layerItem.projectBackgroundJobs || []).filter(
        (job) => job.type === ProjectBackgroundJobType.DataTableUpload
      ),
    [layerItem.projectBackgroundJobs]
  );

  const activeDataTableJobs = useMemo(
    () => dataTableJobs.filter(isActiveDataTableJob),
    [dataTableJobs]
  );

  const pendingNewUploadJobs = useMemo(
    () =>
      activeDataTableJobs.filter(
        (job) => !job.overlayDataTableUpload?.replaceOverlayDataTableId
      ),
    [activeDataTableJobs]
  );

  const onUploadStarted = useCallback(() => {
    void refetchTablesAndHistory();
  }, [refetchTablesAndHistory]);

  const onDismissJob = useCallback(
    async (jobId: string) => {
      if (manager) {
        await manager.dismissFailedUpload(jobId);
        await refetchTablesAndHistory();
      }
    },
    [manager, refetchTablesAndHistory],
  );

  const hasActiveUploads = activeDataTableJobs.some(
    (job) => job.state !== ProjectBackgroundJobState.Failed,
  );

  const trackedJobStatesRef = useRef<Map<string, ProjectBackgroundJobState>>(
    new Map(),
  );

  useEffect(() => {
    let shouldRefetch = false;
    for (const job of dataTableJobs) {
      const previousState = trackedJobStatesRef.current.get(job.id);
      if (
        previousState &&
        previousState !== ProjectBackgroundJobState.Complete &&
        previousState !== ProjectBackgroundJobState.Failed &&
        (job.state === ProjectBackgroundJobState.Complete ||
          job.state === ProjectBackgroundJobState.Failed)
      ) {
        shouldRefetch = true;
      }
      trackedJobStatesRef.current.set(job.id, job.state);
    }
    if (shouldRefetch) {
      void refetchTablesAndHistory();
    }
  }, [dataTableJobs, refetchTablesAndHistory]);

  useEffect(() => {
    if (!hasActiveUploads) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refetchTablesAndHistory();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveUploads, refetchTablesAndHistory]);

  const openUploadModal = useCallback(() => {
    setReplaceId(undefined);
    setUploadOpen(true);
  }, []);

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("Related Data Tables")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-prose">
            {t(
              "Upload CSV tables linked to this layer by a shared ID column—for example species counts per site or survey results per polygon."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openUploadModal}
          className="shrink-0 whitespace-nowrap inline-flex items-center rounded-md border border-transparent bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {t("Upload Table")}
        </button>
      </div>
      {tables.length === 0 && pendingNewUploadJobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-600">
            {t("No data tables associated with this layer.")}
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-500"
            onClick={openUploadModal}
          >
            {t("Upload your first table")}
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {pendingNewUploadJobs.map((job) => (
            <PendingDataTableUploadRow
              key={job.id}
              job={job}
              onDismissJob={onDismissJob}
            />
          ))}
          {tables.map((table) => (
            <DataTableRow
              key={table.id}
              table={table}
              job={getJobForTable(table.id, dataTableJobs)}
              onDismissJob={onDismissJob}
              onRename={(id, name) =>
                renameTable({ variables: { id, name } }).then(() =>
                  refetchTablesAndHistory(),
                )
              }
              onDelete={(id) =>
                confirmDelete({
                  message: t("Delete data table?"),
                  description: t(
                    "\"{{name}}\" will no longer be available for display or analysis. Previous uploads remain in the change history.",
                    { name: table.name },
                  ),
                  onDelete: async () => {
                    await deleteTable({ variables: { id } });
                    await refetchTablesAndHistory();
                  },
                })
              }
              onSetVisualizationSettings={onSetVisualizationSettings}
              onReplace={(id) => {
                setReplaceId(id);
                setUploadOpen(true);
              }}
            />
          ))}
        </ul>
      )}
      <DataTableUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        tableOfContentsItemId={layerItem.id}
        geostatsLayer={geostatsLayer}
        canonicalOverlayJoinColumn={overlayJoinColumn}
        replaceTableId={replaceId}
        onUploadStarted={onUploadStarted}
        uploadOverlayDataTable={manager?.uploadOverlayDataTable.bind(manager)}
      />
    </div>
  );
}
