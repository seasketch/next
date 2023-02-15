import { useState, useContext, useCallback, useMemo } from "react";
import {
  ClientTableOfContentsItem,
  combineBounds,
} from "../dataLayers/tableOfContents/TableOfContents";
import TableOfContentsMetadataModal from "../dataLayers/TableOfContentsMetadataModal";
import { TableOfContentsItem } from "../generated/graphql";
import useLocalStorage from "../useLocalStorage";
import { MapContext } from "../dataLayers/MapContextManager";
import TreeView, { TreeItem } from "../components/TreeView";
import { DropdownDividerProps } from "../components/ContextMenuDropdown";
import { DropdownOption } from "../components/DropdownButton";
import { useTranslation } from "react-i18next";
import { currentSidebarState } from "./ProjectAppSidebar";

export default function OverlayLayers({
  items,
}: {
  items: TableOfContentsItem[];
}) {
  const { t } = useTranslation("homepage");
  const mapContext = useContext(MapContext);
  const [openMetadataViewerId, setOpenMetadataViewerId] = useState<number>();
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>(
    "overlays-expanded-ids",
    []
  );
  const [contextMenu, setContextMenu] = useState<
    | {
        id: string;
        target: HTMLElement;
        offsetX: number;
      }
    | undefined
  >();

  const getContextMenuItems = useCallback(
    (treeItem: TreeItem) => {
      const item = items.find((item) => item.stableId === treeItem.id);
      if (item) {
        const sidebar = currentSidebarState();
        const contextMenuOptions: (DropdownOption | DropdownDividerProps)[] = [
          {
            id: "zoom-to",
            label: t("Zoom to bounds"),
            onClick: () => {
              let bounds: [number, number, number, number] | undefined;
              if (item.isFolder) {
                bounds = createBoundsRecursive(item, items);
              } else {
                if (item.bounds) {
                  bounds = item.bounds.map((coord: string) =>
                    parseFloat(coord)
                  ) as [number, number, number, number];
                }
              }
              if (
                bounds &&
                [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")
              ) {
                mapContext.manager?.map?.fitBounds(bounds, {
                  animate: true,
                  padding: {
                    bottom: 100,
                    top: 100,
                    left: sidebar.open ? sidebar.width + 100 : 100,
                    right: 100,
                  },
                });
              }
            },
          },
        ];
        if (item.dataLayerId) {
          contextMenuOptions.push({
            id: "metadata",
            label: t("Metadata"),
            onClick: () => {
              setOpenMetadataViewerId(item.id);
            },
          });
        }
        return contextMenuOptions;
      } else {
        return [];
      }
    },
    [items, mapContext.manager?.map, t]
  );

  const treeNodes = useMemo(() => {
    return overlayLayerFragmentsToTreeItems(
      [...items].sort((a, b) => a.sortIndex - b.sortIndex)
    );
  }, [items]);

  const { checkedItems, loadingItems, overlayErrors } = useMemo(() => {
    const checkedItems: string[] = [];
    const loadingItems: string[] = [];
    const overlayErrors: { [id: string]: string } = {};
    for (const item of items) {
      if (item.dataLayerId) {
        const id = item.dataLayerId.toString();
        const record = mapContext.layerStates[id];
        if (record) {
          if (record.visible) {
            checkedItems.push(item.stableId);
          }
          if (record.loading) {
            loadingItems.push(item.stableId);
          }
          if (record.error) {
            overlayErrors[item.stableId] = record.error.toString();
          }
        }
      }
    }
    return {
      checkedItems,
      loadingItems,
      overlayErrors,
    };
  }, [items, mapContext.layerStates]);

  const onExpand = useCallback(
    (node: TreeItem, isExpanded: boolean) => {
      if (isExpanded) {
        setExpandedIds((prev) => [
          ...prev.filter((id) => id !== node.id),
          node.id,
        ]);
      } else {
        setExpandedIds((prev) => [...prev.filter((id) => id !== node.id)]);
      }
    },
    [setExpandedIds]
  );

  const onChecked = useCallback(
    (ids: string[], isChecked: boolean) => {
      const dataLayerIds = items
        .filter((item) => ids.indexOf(item.stableId) !== -1)
        .filter((item) => Boolean(item.dataLayerId))
        .map((item) => item.dataLayerId!.toString());
      if (isChecked) {
        mapContext.manager?.showLayers(dataLayerIds);
      } else {
        mapContext.manager?.hideLayers(dataLayerIds);
      }
    },
    [items, mapContext.manager]
  );
  return (
    <div className="mt-3 pl-1">
      {openMetadataViewerId && (
        <TableOfContentsMetadataModal
          id={openMetadataViewerId}
          onRequestClose={() => setOpenMetadataViewerId(undefined)}
        />
      )}
      <TreeView
        loadingItems={loadingItems}
        errors={overlayErrors}
        disableEditing={true}
        expanded={expandedIds}
        onExpand={onExpand}
        checkedItems={checkedItems}
        onChecked={onChecked}
        ariaLabel="Overlay Layers"
        items={treeNodes}
        setContextMenu={setContextMenu}
        contextMenuItemId={contextMenu?.id}
        getContextMenuItems={getContextMenuItems}
      />
    </div>
  );
}

function overlayLayerFragmentsToTreeItems(fragments: TableOfContentsItem[]) {
  const items: TreeItem[] = [];
  for (const fragment of fragments) {
    items.push({
      id: fragment.stableId,
      isLeaf: !fragment.isFolder,
      parentId: fragment.parentStableId || null,
      checkOffOnly: fragment.isClickOffOnly,
      radioFolder: fragment.showRadioChildren,
      hideChildren: fragment.hideChildren,
      title: fragment.title,
      type: fragment.__typename!,
    });
  }
  return items;
}

export function createBoundsRecursive(
  item: ClientTableOfContentsItem,
  items: TableOfContentsItem[],
  bounds?: [number, number, number, number]
): [number, number, number, number] {
  if (item.bounds) {
    if (!bounds) {
      bounds = item.bounds.map((v) => parseFloat(v)) as [
        number,
        number,
        number,
        number
      ];
    } else {
      bounds = combineBounds(
        bounds,
        item.bounds.map((v) => parseFloat(v)) as [
          number,
          number,
          number,
          number
        ]
      );
    }
  }
  if (!bounds) {
    bounds = [180.0, 90.0, -180.0, -90.0];
  }
  const children = items.filter((a) => a.parentStableId === item.stableId);
  for (const child of children) {
    bounds = createBoundsRecursive(child, items, bounds);
  }
  return bounds;
}
