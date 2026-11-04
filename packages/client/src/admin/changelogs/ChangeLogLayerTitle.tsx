import { ChevronDownIcon, FolderIcon } from "@heroicons/react/outline";
import { CornersIcon } from "@radix-ui/react-icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import {
  LayerTreeContext,
  MapManagerContext,
} from "../../dataLayers/MapContextManager";
import { LayerEditingContext } from "../data/LayerEditingContext";
import { ChangeLogTocItem, mappableStableIds } from "./changeLogEntityTitle";

const menuItemClassName =
  "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-gray-100";

function visibilityFor(
  stableIds: string[],
  layerStates: { [id: string]: { visible?: boolean } | undefined }
): boolean | "mixed" {
  if (stableIds.length === 0) {
    return false;
  }
  let visibleCount = 0;
  for (const stableId of stableIds) {
    if (layerStates[stableId]?.visible) {
      visibleCount += 1;
    }
  }
  if (visibleCount === 0) {
    return false;
  }
  if (visibleCount === stableIds.length) {
    return true;
  }
  return "mixed";
}

export default function ChangeLogLayerTitle({
  item,
  title,
  tocItems,
}: {
  item: ChangeLogTocItem;
  title: string;
  tocItems: readonly ChangeLogTocItem[];
}) {
  const { t } = useTranslation("admin:data");
  const layerEditingContext = useContext(LayerEditingContext);
  const { manager } = useContext(MapManagerContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const mapContext = useContext(LayerTreeContext);
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const mappableIds = useMemo(
    () => mappableStableIds(item, tocItems),
    [item, tocItems]
  );
  const visibility = visibilityFor(
    mappableIds,
    mapContext.layerStatesByTocStaticId
  );

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = visibility === "mixed";
    }
  }, [visibility]);

  const toggleVisibility = () => {
    if (!manager || mappableIds.length === 0) {
      return;
    }
    if (visibility === false) {
      manager.showTocItems(mappableIds);
    } else {
      manager.hideTocItems(mappableIds);
    }
  };

  const zoomToExtent = () => {
    setMenuOpen(false);
    if (manager) {
      void manager.zoomToTocItem(item.stableId);
    }
  };

  return (
    <DropdownMenu.Root
      modal={false}
      open={menuOpen}
      onOpenChange={setMenuOpen}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded text-left font-semibold text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {item.isFolder && (
            <FolderIcon
              className="h-3.5 w-3.5 flex-none text-gray-400"
              aria-hidden
            />
          )}
          <span className="min-w-0 truncate">{title}</span>
          <ChevronDownIcon
            className="h-3 w-3 flex-none text-gray-400"
            aria-hidden
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-[80] min-w-[14rem] rounded-md border border-black/5 bg-white p-1 text-sm shadow-lg"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenu.Item
            className={menuItemClassName}
            onSelect={() => {
              layerEditingContext.setOpenEditor({
                id: item.id,
                isFolder: item.isFolder,
                title: item.title,
              });
            }}
          >
            {t("Edit")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItemClassName}
            disabled={mappableIds.length === 0}
            onSelect={(event) => {
              event.preventDefault();
              toggleVisibility();
            }}
          >
            <input
              ref={checkboxRef}
              type="checkbox"
              readOnly
              tabIndex={-1}
              aria-hidden
              checked={visibility === true}
              aria-checked={
                visibility === "mixed" ? "mixed" : visibility === true
              }
              className="pointer-events-none h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="min-w-0 flex-1">{t("Show on map")}</span>
            <button
              type="button"
              aria-label={t("Zoom to bounds")}
              title={t("Zoom to bounds")}
              className="ml-auto inline-flex h-6 w-6 flex-none items-center justify-center rounded text-gray-700 hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                zoomToExtent();
              }}
            >
              <CornersIcon className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
