import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  TableOfContentsItem,
  useProjectMetadataQuery,
} from "../generated/graphql";
import TreeView, { useOverlayState } from "../components/TreeView";
import { useTranslation } from "react-i18next";
import { TableOfContentsItemMenu } from "../admin/data/TableOfContentsItemMenu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { ProjectAppSidebarToolbar } from "./ProjectAppSidebar";
import useOverlaySearchState from "../dataLayers/useOverlaySearchState";
import SearchResultsMessages from "../dataLayers/SearchResultsMessages";
import OverlaySearchInput from "../dataLayers/OverlaySearchInput";
import getSlug from "../getSlug";

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
  const slug = getSlug();
  const metadata = useProjectMetadataQuery({ variables: { slug } });

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
    setExpandedIds,
    resetLocalState,
  } = useOverlayState(items);

  const {
    search,
    setSearch,
    searchResults,
    filteredTreeNodes,
    searchState,
    searching,
  } = useOverlaySearchState({
    isDraft: false,
    projectId: metadata.data?.projectPublicDetails?.id!,
    treeNodes: treeItems,
    expandedIds,
    setExpandedIds,
  });

  return (
    <div>
      <ProjectAppSidebarToolbar>
        <OverlaySearchInput
          className="mr-2 flex-1"
          search={search}
          onChange={setSearch}
          loading={searchResults.loading}
        />
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
      </ProjectAppSidebarToolbar>
      <SearchResultsMessages
        filteredTreeNodes={filteredTreeNodes}
        search={search}
        searchResults={searchResults}
      />
      <div className="mt-2 pl-6">
        <div
          className={
            "transition-opacity " + (searching ? "opacity-50" : "opacity-100")
          }
        >
          <TreeView
            highlights={searchState.highlights}
            items={filteredTreeNodes}
            disableEditing={true}
            hiddenItems={hiddenItems}
            onUnhide={onUnhide}
            loadingItems={loadingItems}
            errors={overlayErrors}
            expanded={expandedIds}
            onExpand={onExpand}
            checkedItems={checkedItems}
            onChecked={onChecked}
            ariaLabel="Overlay Layers"
            showContextMenuButtons={(node) => {
              return node.isLeaf;
            }}
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
