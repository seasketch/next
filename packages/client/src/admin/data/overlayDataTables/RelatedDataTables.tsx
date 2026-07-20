import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
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
 * Admin controls for `overlay_data_tables.visualization_columns` /
 * `.visualization_ops` -- the columns and aggregation ops that are valid for
 * building a thematic map from this table. When either list is left empty,
 * end users can choose freely in "Display settings" (see
 * dataLayers/DataTableVisualizationControls.tsx).
 */
function VisualizationSettingsEditor({
  table,
  onSave,
}: {
  table: OverlayDataTableDetailsFragment;
  onSave: (visualizationColumns: string[], visualizationOps: string[]) => void;
}) {
  const { t } = useTranslation("admin:data");
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const { columnStats, loading } = useDataTableColumnStats(
    columnStatsUrlForTable(table),
    mapAccessToken
  );
  const numericColumns = numericColumnNames(columnStats);
  const selectedColumns = (table.visualizationColumns || []).filter(
    Boolean
  ) as string[];
  const selectedOps = (table.visualizationOps || []).filter(
    Boolean
  ) as string[];

  const toggleColumn = (column: string) => {
    onSave(
      selectedColumns.includes(column)
        ? selectedColumns.filter((c) => c !== column)
        : [...selectedColumns, column],
      selectedOps
    );
  };

  const toggleOp = (op: string) => {
    onSave(
      selectedColumns,
      selectedOps.includes(op)
        ? selectedOps.filter((o) => o !== op)
        : [...selectedOps, op]
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        {t(
          "Optionally limit which columns and aggregations map users can choose when visualizing this table. Leave everything unchecked to allow free choice."
        )}
      </p>
      <div>
        <p className="text-sm font-medium text-gray-900">
          {t("Columns")}
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-gray-400 italic">
            {t("Loading column metadata...")}
          </p>
        ) : numericColumns.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400 italic">
            {t("No numeric columns found.")}
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {numericColumns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={selectedColumns.includes(column)}
                  onChange={() => toggleColumn(column)}
                />
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="truncate">{column}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">
          {t("Aggregations")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {DATA_TABLE_AGGREGATIONS.map((op) => (
            <label
              key={op}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={selectedOps.includes(op)}
                onChange={() => toggleOp(op)}
              />
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {op}
            </label>
          ))}
        </div>
      </div>
      {(selectedColumns.length > 0 || selectedOps.length > 0) && (
        <button
          type="button"
          className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-2"
          onClick={() => onSave([], [])}
        >
          {t("Clear all limits")}
        </button>
      )}
    </div>
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
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onReplace: (id: number) => void;
  onSetVisualizationSettings: (
    id: number,
    visualizationColumns: string[],
    visualizationOps: string[]
  ) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isProcessing = Boolean(job);
  const sameJoinColumn = table.joinColumn === table.overlayJoinColumn;

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <input
            className="text-sm border border-gray-300 rounded-md px-2 py-1 flex-1 min-w-0"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setName(table.name);
                setEditing(false);
              }
            }}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name !== table.name) {
                onRename(table.id, name.trim());
              } else {
                setName(table.name);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 text-left group"
            onClick={() => setEditing(true)}
            disabled={isProcessing}
            title={t("Rename")}
          >
            <span className="font-medium text-gray-900 group-hover:text-gray-700">
              {table.name}
            </span>{" "}
            <span className="text-gray-400 text-xs font-normal">
              {t("v{{version}}", { version: table.version })}
            </span>
          </button>
        )}
        <div className="flex items-center gap-0.5 shrink-0 -mt-0.5 -mr-1">
          <button
            type="button"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            onClick={() => onReplace(table.id)}
            disabled={isProcessing}
            title={t("Replace")}
            aria-label={t("Replace")}
          >
            <UploadIcon className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            onClick={() => onDelete(table.id)}
            disabled={isProcessing}
            title={t("Delete")}
            aria-label={t("Delete")}
          >
            <TrashIcon className="w-4 h-4" aria-hidden />
          </button>
        </div>
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
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs text-gray-500">
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
          <button
            type="button"
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 decoration-gray-300 hover:decoration-gray-500"
            onClick={() => setSettingsOpen(true)}
          >
            {t("Thematic map settings")}
          </button>
        </div>
      )}
      {settingsOpen
        ? createPortal(
            <Modal
              open
              onRequestClose={() => setSettingsOpen(false)}
              title={t("Thematic map settings")}
              scrollable
              autoWidth
              tipyTop
              panelClassName="sm:max-w-lg"
              footer={[
                {
                  label: t("Done"),
                  variant: "primary",
                  onClick: () => setSettingsOpen(false),
                },
              ]}
            >
              <VisualizationSettingsEditor
                table={table}
                onSave={(columns, ops) =>
                  onSetVisualizationSettings(table.id, columns, ops)
                }
              />
            </Modal>,
            document.body
          )
        : null}
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
    (
      id: number,
      visualizationColumns: string[],
      visualizationOps: string[]
    ) => {
      void setVisualizationSettingsMutation({
        variables: { id, visualizationColumns, visualizationOps },
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
