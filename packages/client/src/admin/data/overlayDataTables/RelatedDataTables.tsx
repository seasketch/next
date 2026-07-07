import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { useTranslation } from "react-i18next";
import {
  FullAdminOverlayFragment,
  OverlayDataTableDetailsFragment,
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useGetLayerItemQuery,
  useRenameOverlayDataTableMutation,
  useSoftDeleteOverlayDataTableMutation,
} from "../../../generated/graphql";
import { GeostatsLayer } from "@seasketch/geostats-types";
import { ProjectBackgroundJobContext } from "../../uploads/ProjectBackgroundJobContext";
import { dataTableChangeLogRefetchQueries } from "../../changelogs/dataTableChangeLogRefetch";
import DataTableUploadJobProgress from "./DataTableUploadJobProgress";
import DataTableUploadModal from "./DataTableUploadModal";

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

function DataTableRow({
  table,
  job,
  onDismissJob,
  onRename,
  onDelete,
  onReplace,
}: {
  table: OverlayDataTableDetailsFragment;
  job?: DataTableJob;
  onDismissJob: (jobId: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onReplace: (id: number) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);
  const isProcessing = Boolean(job);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            className="text-sm border border-gray-300 rounded-md px-2 py-1 flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name !== table.name) onRename(table.id, name);
            }}
          />
        ) : (
          <button
            type="button"
            className="font-medium text-left text-gray-900 hover:text-primary-600"
            onClick={() => setEditing(true)}
            disabled={isProcessing}
          >
            {table.name}{" "}
            <span className="text-gray-500 text-xs font-normal">
              {t("v{{version}}", { version: table.version })}
            </span>
          </button>
        )}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            onClick={() => onReplace(table.id)}
            disabled={isProcessing}
          >
            {t("Replace")}
          </button>
          <button
            type="button"
            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            onClick={() => onDelete(table.id)}
            disabled={isProcessing}
          >
            {t("Delete")}
          </button>
        </div>
      </div>
      {job ? (
        <DataTableUploadJobProgress
          job={job}
          onDismiss={
            job.state === ProjectBackgroundJobState.Failed
              ? () => onDismissJob(job.id)
              : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {`${table.rowCount.toLocaleString()} rows · ${table.joinColumn} → ${table.overlayJoinColumn}`}
          </p>
          {table.queryUrl ? (
            <a
              href={table.queryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              {t("Explore data")}
            </a>
          ) : null}
        </>
      )}
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
                deleteTable({ variables: { id } }).then(() =>
                  refetchTablesAndHistory(),
                )
              }
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
