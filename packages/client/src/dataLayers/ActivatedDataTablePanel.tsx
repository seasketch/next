import { useContext, useEffect, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CheckIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  ClientOverlayDataTableFragment,
  useOverlayDataTableVisualizationMetadataForLayerQuery,
} from "../generated/graphql";
import { ActivatedDataTableContext } from "./ActivatedDataTableContext";
import { DataTableVisualizationMetadata } from "./dataTableQueryApi";
import {
  columnStatsUrlForTable,
  fetchDataTableColumnStats,
} from "./useDataTableColumnStats";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";

/**
 * Popover panel for choosing which OverlayDataTable is active for a layer.
 * Display settings and filters are configured in the map legend.
 */
export default function ActivatedDataTablePanel({
  layerId,
  tocItemId,
  layerName,
  tables,
  onTableSelected,
}: {
  layerId: string;
  tocItemId?: number;
  layerName?: string;
  tables: ClientOverlayDataTableFragment[];
  onTableSelected?: () => void;
}) {
  const { t } = useTranslation("homepage");
  const { activeTableIds, setActiveTable } = useContext(
    ActivatedDataTableContext
  );
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const metadataQuery = useOverlayDataTableVisualizationMetadataForLayerQuery({
    variables: { tocItemId: tocItemId || -1 },
    skip: tocItemId === undefined,
    fetchPolicy: "cache-first",
  });

  const activeTableId = activeTableIds[layerId];
  const metadataByTableId = useMemo(() => {
    const next: {
      [tableId: number]: DataTableVisualizationMetadata | undefined;
    } = {};
    for (const table of metadataQuery.data?.tableOfContentsItem
      ?.overlayDataTables || []) {
      next[table.id] = {
        queryUrl: table.queryUrl,
        columnStatsUrl: table.columnStatsUrl,
        visualizationColumns: table.visualizationColumns,
        visualizationOps: table.visualizationOps,
        requiredFilterColumns: table.requiredFilterColumns,
      };
    }
    return next;
  }, [metadataQuery.data?.tableOfContentsItem?.overlayDataTables]);

  useEffect(() => {
    for (const table of tables) {
      const metadata = metadataByTableId[table.id] || table;
      const columnStatsUrl = columnStatsUrlForTable(metadata);
      if (columnStatsUrl) {
        void fetchDataTableColumnStats(columnStatsUrl, mapAccessToken);
      }
    }
  }, [metadataByTableId, tables, mapAccessToken]);

  return (
    <Popover.Content
      align="end"
      sideOffset={6}
      style={{ zIndex: 99999999 }}
      className="w-72 rounded-md bg-white text-gray-900 border border-black border-opacity-10 shadow-lg py-1.5 data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade"
    >
      <div className="px-3 pt-1 pb-2 border-b border-black border-opacity-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("Data Tables")}
        </h4>
        {layerName && (
          <p className="text-xs text-gray-400 truncate">{layerName}</p>
        )}
      </div>
      {metadataQuery.loading && (
        <div className="px-3 py-1 text-xs text-gray-400 border-b border-black border-opacity-5">
          {t("Loading table metadata...")}
        </div>
      )}
      <ul className="py-1 max-h-64 overflow-y-auto">
        {tables.map((table) => {
          const isActive = table.id === activeTableId;
          return (
            <li key={table.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveTable(layerId, isActive ? null : table.id);
                  if (!isActive) {
                    onTableSelected?.();
                  }
                }}
                className={clsx(
                  "w-full flex items-start gap-2 text-left px-3 py-2 text-sm hover:bg-gray-50",
                  isActive && "bg-primary-600 bg-opacity-5"
                )}
              >
                <span className="w-4 pt-0.5 flex-none">
                  {isActive && (
                    <CheckIcon className="w-4 h-4 text-primary-600" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">
                    {table.name}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    {`${table.rowCount.toLocaleString()} ${t("rows")}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Popover.Arrow className="fill-white" />
    </Popover.Content>
  );
}
