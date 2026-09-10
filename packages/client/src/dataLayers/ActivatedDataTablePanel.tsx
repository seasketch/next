import { useContext, useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  ClientOverlayDataTableFragment,
  useOverlayDataTableVisualizationMetadataForLayerQuery,
} from "../generated/graphql";
import { MapManagerContext, MapOverlayContext } from "./MapContextManager";
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
  tables,
  onTableSelected,
  onDataTableActivated,
  side,
  align = "end",
}: {
  layerId: string;
  tocItemId?: number;
  tables: ClientOverlayDataTableFragment[];
  onTableSelected?: () => void;
  onDataTableActivated?: (layerId: string) => void;
  /** Preferred popover side. Overlay TOC uses `right`; legend/popup keep default. */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const { t } = useTranslation("homepage");
  const { manager } = useContext(MapManagerContext);
  const { layerStatesByTocStaticId } = useContext(MapOverlayContext);
  const { data: projectMeta } = useCurrentProjectMetadata();
  const mapAccessToken = projectMeta?.project?.mapAccessToken;
  const metadataQuery = useOverlayDataTableVisualizationMetadataForLayerQuery({
    variables: { tocItemId: tocItemId || -1 },
    skip: tocItemId === undefined,
    fetchPolicy: "cache-first",
  });

  const activeStableId = layerStatesByTocStaticId[layerId]?.dataTable?.stableId;
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
        hiddenFilterColumns: table.hiddenFilterColumns,
        filterColumnLabels: table.filterColumnLabels,
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

  const [hoveringClear, setHoveringClear] = useState(false);

  const clearSelection = () => {
    setHoveringClear(false);
    manager?.setLayerDataTable(layerId, null);
    onTableSelected?.();
  };

  return (
    <Popover.Content
      side={side}
      align={align}
      sideOffset={6}
      style={{ zIndex: 99999999 }}
      className="w-72 rounded-md bg-white text-gray-900 border border-black border-opacity-10 shadow-lg py-1.5 data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade"
    >
      <div className="px-3 pt-1 pb-2 border-b border-black border-opacity-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t("Data Tables")}
        </h4>
        <p className="text-xs text-gray-600 leading-snug mt-0.5">
          {t("Visualize datasets related to this layer.")}
        </p>
      </div>
      {metadataQuery.loading && (
        <div className="px-3 py-1 text-xs text-gray-600 border-b border-black border-opacity-5">
          {t("Loading table metadata...")}
        </div>
      )}
      <ul className="py-1 max-h-64 overflow-y-auto">
        {tables.map((table) => {
          const isActive = table.stableId === activeStableId;
          return (
            <li
              key={table.id}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 hover:bg-gray-50",
                isActive && "bg-primary-600 bg-opacity-5"
              )}
            >
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  if (isActive) {
                    clearSelection();
                    return;
                  }
                  if (table.stableId) {
                    manager?.showTocItems([layerId]);
                    manager?.setLayerDataTable(layerId, {
                      stableId: table.stableId,
                    });
                    onDataTableActivated?.(layerId);
                    onTableSelected?.();
                  }
                }}
                className="flex-1 min-w-0 text-left text-sm"
              >
                <span className="block truncate font-medium">{table.name}</span>
                <span className="block text-xs text-gray-600 line-clamp-2 leading-snug">
                  {table.description?.trim() ? (
                    table.description
                  ) : (
                    // eslint-disable-next-line i18next/no-literal-string
                    `${table.rowCount.toLocaleString()} ${t("rows")}`
                  )}
                </span>
              </button>
              <span className="w-5 flex-none">
                {isActive && (
                  <button
                    type="button"
                    aria-label={t("Clear data table display")}
                    title={t("Clear data table display")}
                    onClick={clearSelection}
                    onPointerEnter={() => setHoveringClear(true)}
                    onPointerLeave={() => setHoveringClear(false)}
                    className="relative flex h-5 w-5 items-center justify-center text-primary-600 before:absolute before:-inset-[20%] before:content-['']"
                  >
                    {hoveringClear ? (
                      <Cross2Icon className="h-4 w-4" />
                    ) : (
                      <CheckIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Popover.Arrow className="fill-white" />
    </Popover.Content>
  );
}
