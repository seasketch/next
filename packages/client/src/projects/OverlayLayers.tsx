import { useState, useContext, useCallback } from "react";
import TableOfContentsMetadataModal from "../dataLayers/TableOfContentsMetadataModal";
import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  TableOfContentsItem,
} from "../generated/graphql";
import {
  MapContext,
  sourceTypeIsCustomGLSource,
} from "../dataLayers/MapContextManager";
import TreeView, { TreeItem, useOverlayState } from "../components/TreeView";
import { DropdownDividerProps } from "../components/ContextMenuDropdown";
import { DropdownOption } from "../components/DropdownButton";
import { useTranslation } from "react-i18next";
import { currentSidebarState } from "./ProjectAppSidebar";

export default function OverlayLayers({
  items,
  layers,
  sources,
}: {
  items: TableOfContentsItem[];
  layers: DataLayerDetailsFragment[];
  sources: DataSourceDetailsFragment[];
}) {
  const { t } = useTranslation("homepage");
  const mapContext = useContext(MapContext);
  const [openMetadataViewerState, setOpenMetadataViewerState] = useState<
    undefined | number
  >();

  const {
    expandedIds,
    onExpand,
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems,
  } = useOverlayState(items);

  const getContextMenuItems = useCallback(
    (treeItem: TreeItem) => {
      const item = items.find((item) => item.stableId === treeItem.id);
      if (item) {
        const sidebar = currentSidebarState();
        const contextMenuOptions: (DropdownOption | DropdownDividerProps)[] = [
          {
            id: "zoom-to",
            label: t("Zoom to bounds"),
            disabled: !item.bounds && !checkedItems.includes(item.stableId),
            onClick: async () => {
              let bounds: [number, number, number, number] | undefined;
              if (item.isFolder) {
                bounds = createBoundsRecursive(item, items);
              } else {
                if (item.bounds) {
                  bounds = item.bounds.map((coord: string) =>
                    parseFloat(coord)
                  ) as [number, number, number, number];
                } else {
                  const layer = layers?.find((l) => l.id === item.dataLayerId);
                  if (layer && layer.dataSourceId) {
                    const source = sources?.find(
                      (s) => s.id === layer.dataSourceId
                    );
                    if (source && sourceTypeIsCustomGLSource(source.type)) {
                      const customSource =
                        mapContext.manager?.getCustomGLSource(source.id);
                      const metadata =
                        await customSource?.getComputedMetadata();
                      if (metadata?.bounds) {
                        bounds = metadata.bounds;
                      }
                    }
                  }
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
        if (item.dataLayerId || item.hasMetadata) {
          contextMenuOptions.push({
            id: "metadata",
            label: t("Metadata"),
            onClick: () => {
              setOpenMetadataViewerState(item.id);
            },
          });
        }
        return contextMenuOptions;
      } else {
        return [];
      }
    },
    [
      items,
      mapContext.manager?.map,
      t,
      mapContext.manager,
      layers,
      sources,
      checkedItems,
    ]
  );

  return (
    <div className="mt-3 pl-3">
      {openMetadataViewerState && (
        <TableOfContentsMetadataModal
          id={openMetadataViewerState}
          onRequestClose={() => setOpenMetadataViewerState(undefined)}
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
        items={treeItems}
        getContextMenuItems={getContextMenuItems}
      />
    </div>
  );
}

export function createBoundsRecursive(
  item: OverlayFragment,
  items: OverlayFragment[],
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

export function combineBounds(
  a: [number, number, number, number],
  b: [number, number, number, number]
): [number, number, number, number] {
  return [
    a[0] < b[0] ? a[0] : b[0],
    a[1] < b[1] ? a[1] : b[1],
    a[2] > b[2] ? a[2] : b[2],
    a[3] > b[3] ? a[3] : b[3],
  ];
}
