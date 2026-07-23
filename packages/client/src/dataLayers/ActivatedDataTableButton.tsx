import { useContext, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ClientOverlayDataTableFragment } from "../generated/graphql";
import DataTableIcon from "../components/icons/DataTableIcon";
import { MapOverlayContext } from "./MapContextManager";
import ActivatedDataTablePanel from "./ActivatedDataTablePanel";

/**
 * Button + popover for choosing which OverlayDataTable (if any) is
 * "activated" for a layer and configuring its map display. Used in the
 * map Legend, and eventually the overlay Table of Contents as well.
 */
export default function ActivatedDataTableButton({
  layerId,
  tocItemId,
  layerName,
  tables,
  className,
  onDataTableActivated,
}: {
  /** Table of contents stableId for the associated layer */
  layerId: string;
  /** Numeric TableOfContentsItem id, used to prefetch table metadata in one query */
  tocItemId?: number;
  /** Used as a subtitle in the popover header */
  layerName?: string;
  tables?: ClientOverlayDataTableFragment[] | null;
  className?: string;
  /** Called when a table is activated (not when cleared), e.g. to focus the legend. */
  onDataTableActivated?: (layerId: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const { layerStatesByTocStaticId } = useContext(MapOverlayContext);
  const [open, setOpen] = useState(false);

  if (!tables || tables.length === 0) {
    return null;
  }

  const activeStableId = layerStatesByTocStaticId[layerId]?.dataTable?.stableId;
  const activeTable = tables.find((table) => table.stableId === activeStableId);
  const title = activeTable
    ? // eslint-disable-next-line i18next/no-literal-string
      `${t("Data table")}: ${activeTable.name}`
    : t("Show data tables");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={title}
          title={title}
          className={clsx(
            "relative inline-flex items-center justify-center w-5 h-5 rounded",
            open
              ? "opacity-100 bg-black/[0.07]"
              : "opacity-80 group-hover:opacity-100 focus:opacity-100",
            className
          )}
        >
          <DataTableIcon
            className={clsx(
              "w-[19px] h-[14px] cursor-pointer",
              activeTable ? "text-primary-600" : "text-black"
            )}
          />
          {activeTable && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 block w-1.5 h-1.5 rounded-full bg-primary-600 ring-1 ring-white"
            />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <ActivatedDataTablePanel
          layerId={layerId}
          tocItemId={tocItemId}
          layerName={layerName}
          tables={tables}
          onTableSelected={() => setOpen(false)}
          onDataTableActivated={onDataTableActivated}
        />
      </Popover.Portal>
    </Popover.Root>
  );
}
