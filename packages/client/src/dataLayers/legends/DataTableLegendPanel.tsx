import { useContext, useEffect, useMemo } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import DataTableIcon from "../../components/icons/DataTableIcon";
import {
  ClientOverlayDataTableFragment,
  useOverlayDataTableVisualizationMetadataForLayerQuery,
} from "../../generated/graphql";
import { MapManagerContext, MapOverlayContext } from "../MapContextManager";
import {
  DataTableAggregation,
  DataTableVisualizationMetadata,
  requiredDataTableFilterColumns,
  resolveDataTableVisualizationSettings,
} from "../dataTableQueryApi";
import DataTableFilterControls, {
  ensureRequiredDataTableFilters,
} from "../DataTableFilterControls";
import DataTableVisualizationControls from "../DataTableVisualizationControls";
import {
  columnStatsUrlForTable,
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
  const effectiveColumn = userChoice.column || resolved.column || column;
  const visualizedColumns = useMemo(
    () => (effectiveColumn ? [effectiveColumn] : []),
    [effectiveColumn]
  );
  const requiredFilterColumns = useMemo(
    () =>
      tableMetadata ? requiredDataTableFilterColumns(tableMetadata) : [],
    [tableMetadata]
  );
  const validFilterColumns = useMemo(
    () =>
      new Set(
        (columnStats?.columns || [])
          .map((entry: { attribute: string }) => entry.attribute)
          .filter((entry: string) => !visualizedColumns.includes(entry))
      ),
    [columnStats?.columns, visualizedColumns]
  );

  // Persist required filters into layer state so map queries include them
  // (and the legend shows them) as soon as column-stats are available.
  useEffect(() => {
    if (!tableMetadata || !columnStats?.columns?.length || !manager) {
      return;
    }
    if (requiredFilterColumns.length === 0 || !dataTable?.stableId) {
      return;
    }
    const ensured = ensureRequiredDataTableFilters(
      userChoice.filters,
      requiredFilterColumns,
      columnStats.columns,
      visualizedColumns
    );
    const current = userChoice.filters || [];
    if (JSON.stringify(ensured) === JSON.stringify(current)) {
      return;
    }
    manager.setLayerDataTable(layerId, {
      stableId: dataTable.stableId,
      column: effectiveColumn,
      op: userChoice.op || op,
      filters: ensured,
    });
  }, [
    manager,
    layerId,
    dataTable?.stableId,
    tableMetadata,
    columnStats?.columns,
    requiredFilterColumns,
    visualizedColumns,
    userChoice.filters,
    userChoice.op,
    effectiveColumn,
    op,
  ]);

  const activeFilters = useMemo(() => {
    const base = (userChoice.filters || []).filter((filter) =>
      validFilterColumns.has(filter.column)
    );
    if (!columnStats?.columns?.length || requiredFilterColumns.length === 0) {
      return base;
    }
    return ensureRequiredDataTableFilters(
      base,
      requiredFilterColumns,
      columnStats.columns,
      visualizedColumns
    ).filter((filter) => validFilterColumns.has(filter.column));
  }, [
    columnStats?.columns,
    requiredFilterColumns,
    userChoice.filters,
    validFilterColumns,
    visualizedColumns,
  ]);

  if (!table || !tableMetadata) {
    return null;
  }

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
          <button
            type="button"
            aria-label={t("Clear data table display")}
            title={t("Clear data table display")}
            onClick={() => manager?.setLayerDataTable(layerId, null)}
            className="flex-none p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Cross2Icon className="w-3.5 h-3.5" />
          </button>
        </div>
        <DataTableVisualizationControls
          layerId={layerId}
          metadata={tableMetadata}
          columnStatsState={columnStatsState}
          metadataLoading={metadataQuery.loading}
        />
      </div>

      {(showValueScale || Boolean(column)) && (
        <div className="pt-1">
          <DataTableLegendBubble
            min={min}
            max={max}
            hasZero={hasZero}
            showValueScale={showValueScale}
          />
        </div>
      )}

      {!columnStatsState.loading &&
        !columnStatsState.error &&
        columnStats?.columns && (
          <DataTableFilterControls
            columns={columnStats.columns}
            filters={activeFilters}
            visualizedColumns={visualizedColumns}
            requiredColumns={requiredFilterColumns}
            onChange={(filters) => {
              if (!tableStableId) return;
              manager?.setLayerDataTable(layerId, {
                stableId: tableStableId,
                column: effectiveColumn,
                op: userChoice.op || op,
                filters: ensureRequiredDataTableFilters(
                  filters,
                  requiredFilterColumns,
                  columnStats.columns,
                  visualizedColumns
                ),
              });
            }}
          />
        )}
    </div>
  );
}
