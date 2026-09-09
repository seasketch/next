import { useContext, useEffect, useMemo } from "react";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import DataTableIcon from "../../components/icons/DataTableIcon";
import {
  ClientOverlayDataTableFragment,
  useOverlayDataTableVisualizationMetadataForLayerQuery,
} from "../../generated/graphql";
import { MapManagerContext, MapOverlayContext } from "../MapContextManager";
import {
  allowedDataTableVisualizationColumns,
  DataTableAggregation,
  DataTableVisualizationMetadata,
  hiddenDataTableFilterColumns,
  isAlwaysHiddenFilterColumn,
  isWhenStepLimitError,
  omitFiltersForColumns,
  parseFilterColumnLabels,
  requiredDataTableFilterColumns,
  effectiveDataTableVisualizationColumn,
  resolveDataTableVisualizationSettings,
  temporalSourceFilterColumns,
} from "../dataTableQueryApi";
import DataTableFilterControls, {
  ensureRequiredDataTableFilters,
  sanitizeDataTableFilters,
} from "../DataTableFilterControls";
import DataTableVisualizationControls from "../DataTableVisualizationControls";
import {
  columnStatsUrlForTable,
  numericColumnNames,
  useDataTableColumnStats,
} from "../useDataTableColumnStats";
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";
import DataTableLegendBubble from "./DataTableLegendBubble";

export default function DataTableLegendPanel({
  layerId,
  tableStableId,
  tableName,
  column,
  op,
  min,
  max,
  hasZero = false,
  showValueScale = true,
  loading = false,
  error,
  tables,
  tocItemId,
}: {
  layerId: string;
  tableStableId: string;
  tableName: string;
  column?: string;
  op: DataTableAggregation;
  min: number;
  max: number;
  hasZero?: boolean;
  showValueScale?: boolean;
  loading?: boolean;
  error?: string;
  tables: ClientOverlayDataTableFragment[];
  tocItemId?: number;
}) {
  const { t } = useTranslation("homepage");
  const { manager } = useContext(MapManagerContext);
  const { layerStatesByTocStaticId } = useContext(MapOverlayContext);
  const dataTable = layerStatesByTocStaticId[layerId]?.dataTable;
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const table = tables.find((entry) => entry.stableId === tableStableId);

  const metadataQuery = useOverlayDataTableVisualizationMetadataForLayerQuery({
    variables: { tocItemId: tocItemId || -1 },
    skip: tocItemId === undefined,
    fetchPolicy: "cache-first",
  });

  const metadataByTableId = useMemo(() => {
    const next: {
      [tableId: number]: DataTableVisualizationMetadata | undefined;
    } = {};
    for (const entry of metadataQuery.data?.tableOfContentsItem
      ?.overlayDataTables || []) {
      next[entry.id] = {
        queryUrl: entry.queryUrl,
        columnStatsUrl: entry.columnStatsUrl,
        visualizationColumns: entry.visualizationColumns,
        visualizationOps: entry.visualizationOps,
        requiredFilterColumns: entry.requiredFilterColumns,
        hiddenFilterColumns: entry.hiddenFilterColumns,
        filterColumnLabels: entry.filterColumnLabels,
      };
    }
    return next;
  }, [metadataQuery.data?.tableOfContentsItem?.overlayDataTables]);

  const tableMetadata = useMemo(() => {
    if (!table) {
      return undefined;
    }
    return (
      metadataByTableId[table.id] || {
        queryUrl: table.queryUrl,
        columnStatsUrl: table.columnStatsUrl,
        visualizationColumns: table.visualizationColumns,
        visualizationOps: table.visualizationOps,
        requiredFilterColumns: table.requiredFilterColumns,
        hiddenFilterColumns: table.hiddenFilterColumns,
        filterColumnLabels: table.filterColumnLabels,
      }
    );
  }, [metadataByTableId, table]);

  const columnStatsUrl = tableMetadata
    ? columnStatsUrlForTable(tableMetadata)
    : undefined;
  const columnStatsState = useDataTableColumnStats(
    columnStatsUrl,
    mapAccessToken
  );
  const columnStats = columnStatsState.columnStats;
  const userChoice = useMemo(
    () => ({
      column: dataTable?.column,
      op: dataTable?.op,
      filters: dataTable?.filters,
    }),
    [dataTable?.column, dataTable?.filters, dataTable?.op]
  );
  const resolved = tableMetadata
    ? resolveDataTableVisualizationSettings(tableMetadata, userChoice)
    : { op, column, requiredFilterColumns: [] as string[] };
  const visualizedColumns = useMemo(
    () =>
      allowedDataTableVisualizationColumns(
        tableMetadata,
        numericColumnNames(columnStats)
      ),
    [columnStats, tableMetadata]
  );
  const effectiveColumn =
    effectiveDataTableVisualizationColumn(resolved, visualizedColumns) ||
    column;
  const requiredFilterColumns = useMemo(
    () =>
      tableMetadata ? requiredDataTableFilterColumns(tableMetadata) : [],
    [tableMetadata]
  );
  const hiddenFilterColumns = useMemo(
    () => (tableMetadata ? hiddenDataTableFilterColumns(tableMetadata) : []),
    [tableMetadata]
  );
  const filterColumnLabels = useMemo(
    () => parseFilterColumnLabels(tableMetadata?.filterColumnLabels),
    [tableMetadata]
  );
  const temporalFilterColumns = useMemo(
    () => temporalSourceFilterColumns(table?.temporal),
    [table?.temporal]
  );
  const omittedFilterColumns = useMemo(() => {
    const names = new Set<string>([
      ...temporalFilterColumns,
      ...hiddenFilterColumns,
    ]);
    if (table?.joinColumn) {
      names.add(table.joinColumn);
    }
    for (const entry of columnStats?.columns || []) {
      if (isAlwaysHiddenFilterColumn(entry.attribute, table?.temporal, null)) {
        names.add(entry.attribute);
      }
    }
    return Array.from(names);
  }, [
    columnStats?.columns,
    hiddenFilterColumns,
    table?.joinColumn,
    table?.temporal,
    temporalFilterColumns,
  ]);
  const validFilterColumns = useMemo(
    () =>
      new Set(
        (columnStats?.columns || [])
          .map((entry: { attribute: string }) => entry.attribute)
          .filter(
            (entry: string) =>
              !visualizedColumns.includes(entry) &&
              omittedFilterColumns.indexOf(entry) === -1
          )
      ),
    [columnStats?.columns, omittedFilterColumns, visualizedColumns]
  );

  // Persist required filters into layer state so map queries include them
  // (and the legend shows them) as soon as column-stats are available.
  // Read the latest intent from the manager — not React props — so a
  // column-stats/metadata rerender cannot write back a stale filter set
  // while a newer range/value selection is already on the map.
  useEffect(() => {
    if (!tableMetadata || !columnStats?.columns?.length || !manager) {
      return;
    }
    const latest = manager.getLayerDataTable?.(layerId);
    const stableId = latest?.stableId;
    if (!stableId || stableId !== tableStableId) {
      return;
    }
    if (columnStatsState.loading) {
      return;
    }
    const latestFilters = sanitizeDataTableFilters(
      latest.filters,
      columnStats.columns
    );
    const required = requiredFilterColumns.filter(
      (column) => omittedFilterColumns.indexOf(column) === -1
    );
    const stripped = omitFiltersForColumns(
      latestFilters,
      omittedFilterColumns
    );
    const ensured =
      required.length > 0
        ? ensureRequiredDataTableFilters(
            stripped,
            required,
            columnStats.columns,
            [...visualizedColumns, ...omittedFilterColumns]
          )
        : stripped || [];
    const current = latestFilters || [];
    if (JSON.stringify(ensured) === JSON.stringify(current)) {
      return;
    }
    manager.setLayerDataTable(layerId, {
      stableId,
      column: effectiveColumn ?? latest?.column,
      op: latest?.op || userChoice.op || op,
      filters: ensured,
    });
  }, [
    manager,
    layerId,
    tableStableId,
    tableMetadata,
    columnStats?.columns,
    columnStatsState.loading,
    requiredFilterColumns,
    omittedFilterColumns,
    visualizedColumns,
    userChoice.filters,
    userChoice.op,
    effectiveColumn,
    op,
  ]);

  const activeFilters = useMemo(() => {
    const base = sanitizeDataTableFilters(
      userChoice.filters,
      columnStats?.columns || []
    ).filter((filter) => validFilterColumns.has(filter.column));
    if (!columnStats?.columns?.length || requiredFilterColumns.length === 0) {
      return base;
    }
    return ensureRequiredDataTableFilters(
      base,
      requiredFilterColumns,
      columnStats.columns,
      [...visualizedColumns, ...omittedFilterColumns]
    ).filter((filter) => validFilterColumns.has(filter.column));
  }, [
    columnStats?.columns,
    omittedFilterColumns,
    requiredFilterColumns,
    userChoice.filters,
    validFilterColumns,
    visualizedColumns,
  ]);

  if (!table || !tableMetadata) {
    return null;
  }

  const displayError = error
    ? isWhenStepLimitError({ message: error })
      ? t(
          "This time step is too detailed for the selected range. Choose a coarser step such as Month or Year."
        )
      : error
    : undefined;

  const showFilterControls =
    !columnStatsState.loading &&
    !columnStatsState.error &&
    Boolean(columnStats?.columns?.length);

  const clearTableButton = (
    <button
      type="button"
      title={t("Clear data table display")}
      onClick={() => manager?.setLayerDataTable(layerId, null)}
      className="text-xs text-primary-600 underline decoration-primary-600/30 underline-offset-2 transition-colors hover:text-primary-700 hover:decoration-primary-700/60"
    >
      {t("Clear visualization")}
    </button>
  );

  return (
    <div className="space-y-3 pt-1.5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <DataTableIcon className="w-[19px] h-[14px] flex-none text-primary-600" />
          <h3
            title={tableName || table.name}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 leading-5"
          >
            {tableName || table.name}
          </h3>
          {displayError && (
            <ExclamationTriangleIcon
              className="w-3.5 h-3.5 flex-none text-red-500"
              aria-label={displayError}
            />
          )}
        </div>
        <DataTableVisualizationControls
          key={tableStableId}
          layerId={layerId}
          metadata={tableMetadata}
          columnStatsState={columnStatsState}
          metadataLoading={metadataQuery.loading}
        />
      </div>

      {displayError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-100"
        >
          <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-none mt-0.5 text-red-500" />
          <span className="min-w-0 break-words leading-snug">{displayError}</span>
        </div>
      )}

      {(loading || error || showValueScale || Boolean(column)) && (
        <div className="pt-1">
          <DataTableLegendBubble
            min={min}
            max={max}
            hasZero={hasZero}
            showValueScale={showValueScale}
            loading={loading && !error}
            error={error}
          />
        </div>
      )}

      {showFilterControls && columnStats?.columns ? (
        <DataTableFilterControls
          key={tableStableId}
          columns={columnStats.columns}
          filters={activeFilters}
          visualizedColumns={visualizedColumns}
          requiredColumns={requiredFilterColumns.filter(
            (column) => omittedFilterColumns.indexOf(column) === -1
          )}
          hiddenColumns={omittedFilterColumns}
          columnLabels={filterColumnLabels}
          queryLoading={loading && !error}
          trailingAction={clearTableButton}
          onChange={(filters) => {
            const latest = manager?.getLayerDataTable?.(layerId);
            if (!latest?.stableId || latest.stableId !== tableStableId) {
              return;
            }
            manager?.setLayerDataTable(layerId, {
              stableId: latest.stableId,
              column: effectiveColumn ?? latest.column,
              op: latest.op || userChoice.op || op,
              filters: ensureRequiredDataTableFilters(
                filters,
                requiredFilterColumns,
                columnStats.columns,
                [...visualizedColumns, ...omittedFilterColumns]
              ),
            });
          }}
        />
      ) : (
        <div className="flex justify-end pt-1">{clearTableButton}</div>
      )}
    </div>
  );
}
