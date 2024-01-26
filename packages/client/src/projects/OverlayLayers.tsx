import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  TableOfContentsItem,
} from "../generated/graphql";
import TreeView, { useOverlayState } from "../components/TreeView";
import { useTranslation } from "react-i18next";
import { TableOfContentsItemMenu } from "../admin/data/TableOfContentsItemMenu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import Button from "../components/Button";

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

  const {
    expandedIds,
    onExpand,
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems,
    hiddenItems,
    onUnhide,
    hasLocalState,
    resetLocalState,
  } = useOverlayState(items);

  return (
    <div>
      <header className=" select-none fixed w-128 p-2 bg-gray-100 border-b z-10">
        <button
          disabled={!hasLocalState}
          onClick={() => {
            resetLocalState();
          }}
          className={`px-1 py-0.5 border bg-white text-sm rounded shadow-sm ${
            !hasLocalState ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {t("Reset layers")}
        </button>
      </header>
      <div className="mt-12 pl-6">
        <TreeView
          hiddenItems={hiddenItems}
          onUnhide={onUnhide}
          loadingItems={loadingItems}
          errors={overlayErrors}
          disableEditing={true}
          expanded={expandedIds}
          onExpand={onExpand}
          checkedItems={checkedItems}
          onChecked={onChecked}
          ariaLabel="Overlay Layers"
          items={treeItems}
          getContextMenuContent={(treeItemId, clickEvent) => {
            const item = items.find((item) => item.stableId === treeItemId);
            if (item?.isFolder) {
              return null;
            }
            if (item) {
              return (
                <TableOfContentsItemMenu
                  items={[item]}
                  type={ContextMenu}
                  transform={{
                    x: clickEvent.clientX,
                    y: clickEvent.clientY,
                  }}
                />
              );
            } else {
              return null;
            }
          }}
        />
      </div>
    </div>
  );
}

export function createBoundsRecursive(
  item: Pick<OverlayFragment, "bounds" | "stableId" | "id" | "parentStableId">,
  items: Pick<
    OverlayFragment,
    "bounds" | "id" | "stableId" | "parentStableId"
  >[],
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
