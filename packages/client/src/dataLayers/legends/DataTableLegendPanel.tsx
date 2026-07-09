import { useContext, useMemo } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import DataTableIcon from "../../components/icons/DataTableIcon";
import {
  ClientOverlayDataTableFragment,
  useOverlayDataTableVisualizationMetadataForLayerQuery,
} from "../../generated/graphql";
import { ActivatedDataTableContext } from "../ActivatedDataTableContext";
import {
  DataTableAggregation,
  DataTableVisualizationMetadata,
  resolveDataTableVisualizationSettings,
} from "../dataTableQueryApi";
import DataTableFilterControls from "../DataTableFilterControls";
import DataTableVisualizationControls from "../DataTableVisualizationControls";
import {
  columnStatsUrlForTable,
  useDataTableColumnStats,
} from "../useDataTableColumnStats";
import DataTableLegendBubble from "./DataTableLegendBubble";

export default function DataTableLegendPanel({
  layerId,
  tableId,
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
  tableId: number;
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
  const {
    userVisualizationChoices,
    setUserVisualizationChoice,
    setActiveTable,
  } = useContext(ActivatedDataTableContext);
  const table = tables.find((entry) => entry.id === tableId);

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
      };
    }
    return next;
  }, [metadataQuery.data?.tableOfContentsItem?.overlayDataTables]);

  const tableMetadata = table
    ? metadataByTableId[table.id] || {
        queryUrl: table.queryUrl,
        columnStatsUrl: table.columnStatsUrl,
        visualizationColumns: table.visualizationColumns,
        visualizationOps: table.visualizationOps,
      }
    : undefined;

  const columnStatsUrl = tableMetadata
    ? columnStatsUrlForTable(tableMetadata)
    : undefined;
  const columnStatsState = useDataTableColumnStats(columnStatsUrl);
  const columnStats = columnStatsState.columnStats;
  const userChoice = userVisualizationChoices[layerId] || {};
  const resolved = tableMetadata
    ? resolveDataTableVisualizationSettings(tableMetadata, userChoice)
    : { op, column };
  const effectiveColumn = userChoice.column || resolved.column || column;
  const visualizedColumns = useMemo(
    () => (effectiveColumn ? [effectiveColumn] : []),
    [effectiveColumn]
  );
  const validFilterColumns = useMemo(
    () =>
      new Set(
        (columnStats?.columns || [])
          .map((entry) => entry.attribute)
          .filter((entry) => !visualizedColumns.includes(entry))
      ),
    [columnStats?.columns, visualizedColumns]
  );
  const activeFilters = useMemo(
    () =>
      (userChoice.filters || []).filter((filter) =>
        validFilterColumns.has(filter.column)
      ),
    [userChoice.filters, validFilterColumns]
  );

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
            onClick={() => setActiveTable(layerId, null)}
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

      <div className="pt-1">
        <DataTableLegendBubble
          min={min}
          max={max}
          hasZero={hasZero}
          showValueScale={showValueScale}
        />
      </div>

      {!columnStatsState.loading &&
        !columnStatsState.error &&
        columnStats?.columns && (
          <DataTableFilterControls
            columns={columnStats.columns}
            filters={activeFilters}
            visualizedColumns={visualizedColumns}
            onChange={(filters) =>
              setUserVisualizationChoice(layerId, {
                ...userChoice,
                column: effectiveColumn,
                op: userChoice.op || op,
                filters,
              })
            }
          />
        )}
    </div>
  );
}
