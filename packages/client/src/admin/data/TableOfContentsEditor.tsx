import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Route, useHistory, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import {
  GetLayerItemDocument,
  useDisableDownloadForSharedLayersMutation,
  useDraftStatusSubscription,
  useDraftTableOfContentsQuery,
  useEnableDownloadForEligibleLayersMutation,
  useExtraTocEditingInfoQuery,
  useLayersAndSourcesForItemsQuery,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import TableOfContentsMetadataEditor from "./TableOfContentsMetadataEditor";
import PublishReviewModal from "./PublishReviewModal";
import ChangeLogView from "./ChangeLogView";
import FolderEditor from "./FolderEditor";
import TreeView, { TreeItem } from "../../components/TreeView";
import { useOverlayState } from "../../components/TreeView";
import { SortingState } from "../../projects/Sketches/TreeItemComponent";
import { OverlayFragment } from "../../generated/queries";
import * as Menubar from "@radix-ui/react-menubar";
import {
  MenuBarContent,
  MenuBarItem,
  MenuBarLabel,
  MenuBarSeparator,
  MenuBarSubmenu,
  MenubarRadioItem,
  MenubarTrigger,
} from "../../components/Menubar";
import bbox from "@turf/bbox";
import { ProjectBackgroundJobContext } from "../uploads/ProjectBackgroundJobContext";
import { Feature } from "geojson";
import { Map } from "mapbox-gl";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Popover from "@radix-ui/react-popover";
import React from "react";
import { ZIndexEditableList } from "./ZIndexEditableList";
import { LayerEditingContext } from "./LayerEditingContext";
import FullScreenLoadingSpinner from "./FullScreenLoadingSpinner";
import { TableOfContentsItemMenu } from "./TableOfContentsItemMenu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import useOverlaySearchState from "../../dataLayers/useOverlaySearchState";
import SearchResultsMessages from "../../dataLayers/SearchResultsMessages";
import OverlaySearchInput from "../../dataLayers/OverlaySearchInput";
import DataDownloadDefaultSettingModal from "./DataDownloadDefaultSettingModal";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import Warning from "../../components/Warning";
import AddMVTUrlModal from "../AddMVTUrlModal";
import AddRemoteGeoJSONModal from "./AddRemoteGeoJSONModal";
import QuotaUsageDetails from "./QuotaUsageDetails";
import DataHostingRetentionPeriodModal from "./DataHostingRetentionPeriodModal";
import useProjectId from "../../useProjectId";
import withScrolling, {
  createVerticalStrength,
  createHorizontalStrength,
} from "@nosferatu500/react-dnd-scrollzone";
import { useApolloClient } from "@apollo/client";
import { ChatAlt2Icon, CheckIcon } from "@heroicons/react/outline";

const ScrollingComponent = withScrolling("div");

const LazyArcGISCartModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminArcGISBrowser" */ "./arcgis/ArcGISCartModal"
    )
);

const LazyDataLibraryModal = React.lazy(
  () => import(/* webpackChunkName: "DataLibrary" */ "./DataLibraryModal")
);

const LazyINaturalistModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "INaturalistLayer" */ "./AddINaturalistLayerModal"
    )
);

/** Mock: four layers show unresolved-comment badges; spread is deterministic by stableId sort. */
function buildMockCommentReplyCountByStableId(
  items: OverlayFragment[] | undefined | null
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!items?.length) return out;
  const leaves = items.filter((i) => !i.isFolder);
  const sorted = [...leaves].sort((a, b) =>
    a.stableId.localeCompare(b.stableId)
  );
  const n = sorted.length;
  const replyCounts = [2, 1, 4, 3];
  const pickCount = Math.min(4, n);
  for (let i = 0; i < pickCount; i++) {
    const idx =
      pickCount === 1
        ? 0
        : Math.floor((i * (n - 1)) / Math.max(pickCount - 1, 1));
    out[sorted[idx].stableId] = replyCounts[i];
  }
  return out;
}

function attachCommentBadgesToTreeItems(
  nodes: TreeItem[],
  replyCountByStableId: Record<string, number>
): TreeItem[] {
  return nodes.map((node) => {
    const replies = replyCountByStableId[node.id];
    if (replies === undefined || !node.isLeaf) {
      return node;
    }
    return {
      ...node,
      trailingAccessory: (
        <span
          className="inline-flex items-center gap-0.5 flex-none shrink-0 ml-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700"
          title={`${replies} ${replies === 1 ? "reply" : "replies"}`}
        >
          <ChatAlt2Icon className="h-3.5 w-3.5 opacity-90" aria-hidden />
          <span className="text-[11px] font-semibold tabular-nums leading-none">
            {replies}
          </span>
        </span>
      ),
    };
  });
}

/* eslint-disable i18next/no-literal-string */
const MOCK_COMMENT_SUMMARIES_ROTATING = [
  "Needs work on the cartography",
  "Following up with Will on source so I can complete the metadata",
  "Needs sign off by @NickAlcaraz",
];
/* eslint-enable i18next/no-literal-string */

function buildMockUnresolvedCommentsSummary(
  items: OverlayFragment[] | undefined | null
): {
  total: number;
  layers: {
    id: number;
    title: string;
    replyCount: number;
    summary: string;
  }[];
} {
  const counts = buildMockCommentReplyCountByStableId(items);
  const entries = Object.entries(counts).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const layers: {
    id: number;
    title: string;
    replyCount: number;
    summary: string;
  }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const [stableId, replyCount] = entries[i];
    const fragment = items?.find((it) => it.stableId === stableId);
    if (!fragment) continue;
    const summaryIndex = i % 4;
    /* eslint-disable i18next/no-literal-string -- mock per-layer comment summary */
    const summary =
      summaryIndex === 0
        ? `@NickAlcaraz — review replacement for ${fragment.title} original?`
        : MOCK_COMMENT_SUMMARIES_ROTATING[summaryIndex - 1] ?? "";
    /* eslint-enable i18next/no-literal-string */
    layers.push({
      id: fragment.id,
      title: fragment.title,
      replyCount,
      summary,
    });
  }
  const total = layers.reduce((sum, l) => sum + l.replyCount, 0);
  return { total, layers };
}

function UnresolvedCommentsHeaderButton({
  total,
  layers,
  onOpenLayer,
}: {
  total: number;
  layers: {
    id: number;
    title: string;
    replyCount: number;
    summary: string;
  }[];
  onOpenLayer: (id: number, title: string) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [open, setOpen] = useState(false);
  const [resolvedLayerIds, setResolvedLayerIds] = useState<Set<number>>(
    () => new Set()
  );
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 220);
  }, [clearCloseTimer]);

  const openPopover = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const displayedLayers = useMemo(
    () => layers.filter((l) => !resolvedLayerIds.has(l.id)),
    [layers, resolvedLayerIds]
  );

  const displayedTotal = useMemo(
    () => displayedLayers.reduce((sum, l) => sum + l.replyCount, 0),
    [displayedLayers]
  );

  const markResolved = useCallback((layerId: number) => {
    setResolvedLayerIds((prev) => {
      const next = new Set(prev);
      next.add(layerId);
      return next;
    });
  }, []);

  if (total < 1 || layers.length === 0) {
    return null;
  }

  if (displayedLayers.length === 0) {
    return null;
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-blue-200 bg-blue-50 text-blue-800 shadow-sm hover:bg-blue-100"
          aria-label={t("Unresolved comments")}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
        >
          <ChatAlt2Icon className="h-4 w-4 flex-none" aria-hidden />
          <span className="text-xs font-semibold tabular-nums min-w-[1rem] text-center">
            {displayedTotal}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={6}
          className="z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-md border border-gray-200 bg-white p-2 shadow-lg outline-none"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1.5 pt-0.5 pb-2">
            {t("Unresolved comments")}
          </p>
          <ul className="max-h-72 overflow-y-auto space-y-0.5">
            {displayedLayers.map((layer) => (
              <li key={layer.id} className="flex gap-1 items-start rounded px-1 py-1 hover:bg-gray-50">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left rounded px-1.5 py-1.5 border border-transparent hover:border-gray-100"
                  onClick={() => {
                    clearCloseTimer();
                    setOpen(false);
                    onOpenLayer(layer.id, layer.title);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                      {layer.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-3">
                    {layer.summary}
                  </p>
                </button>
                <div className="flex flex-none items-center gap-1.5 pt-0.5 shrink-0">
                  <span className="text-[11px] font-semibold tabular-nums text-blue-700 bg-blue-50 rounded-full px-1.5 py-0.5">
                    {layer.replyCount}
                  </span>
                  <button
                    type="button"
                    title={t("Mark as resolved")}
                    aria-label={t("Mark as resolved")}
                    className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-sm hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      markResolved(layer.id);
                    }}
                  >
                    <CheckIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-gray-100 pt-2 px-1.5 pb-0.5">
            <button
              type="button"
              className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
            >
              {t("View full comment history")}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default function TableOfContentsEditor() {
  const history = useHistory();
  const { slug } = useParams<{ slug: string }>();

  const setSelectedView = useCallback(
    (view: string) => {
      if (view === "order") {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data/zindex`);
      } else if (view === "quota") {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data/quota`);
      } else if (view === "changelog") {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data/changelog`);
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data`);
      }
    },
    [history, slug]
  );

  const selectedView = /zindex/.test(history.location.pathname)
    ? "order"
    : /quota/.test(history.location.pathname)
    ? "quota"
    : /changelog/.test(history.location.pathname)
    ? "changelog"
    : "tree";
  const { manager } = useContext(MapManagerContext);

  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });

  const [updateChildrenMutation] =
    useUpdateTableOfContentsItemChildrenMutation();
  const [folderId, setFolderId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [arcgisCartOpen, setArcgisCartOpen] = useState(false);
  useDraftStatusSubscription({
    variables: {
      slug,
    },
    shouldResubscribe: true,
  });
  const extraQuery = useExtraTocEditingInfoQuery({
    variables: {
      slug,
    },
  });

  const layerEditingContext = useContext(LayerEditingContext);

  const layersAndSources = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds:
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.map(
          (item) => item.id
        ) || [],
    },
  });

  useEffect(() => {
    const layers = layersAndSources?.data?.projectBySlug?.dataLayersForItems;
    const sources = layersAndSources?.data?.projectBySlug?.dataSourcesForItems;
    if (layers && sources && manager) {
      manager.reset(
        sources,
        layers,
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || []
      );
    }
  }, [
    layersAndSources.data,
    manager,
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
  ]);

  useEffect(() => {
    tocQuery.refetch();
  }, [slug]);

  const {
    expandedIds,
    onExpand,
    setExpandedIds,
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems: treeNodes,
    hiddenItems,
    onUnhide,
    hasLocalState,
    resetLocalState,
  } = useOverlayState(
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
    true,
    "admin"
  );

  const onSortEnd: (
    draggedTreeItem: TreeItem,
    target: TreeItem,
    state: SortingState
  ) => void = useCallback(
    (draggable, targetTreeItem, state) => {
      const items =
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
      if (
        state === SortingState.OVER_EXISTING_POSITION ||
        state === SortingState.NONE
      ) {
        return;
      }
      if (state === SortingState.DIRECTLY_OVER_FOLDER) {
        // Stick item at the end of the list of this folder's children
        const folder = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!folder) {
          throw new Error("Folder not found");
        }
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        const siblings = items
          .filter((item) => item.parentStableId === folder.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .map((item) => item.id);
        updateChildrenMutation({
          variables: {
            id: folder.id,
            childIds: [...siblings, draggedItem.id],
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: folder.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      } else {
        // Position item before or after target sibling, based on LEADING or TRAILING state
        const target = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        if (!target) {
          throw new Error("Could not find target item");
        }
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        let siblings: OverlayFragment[] = [];
        let parent: OverlayFragment | undefined = undefined;
        if (target.parentStableId) {
          parent = items.find(
            (item) => item.stableId === target.parentStableId
          );
          if (!parent) {
            throw new Error("Could not find parent");
          }
          siblings = items.filter(
            (item) => item.parentStableId === parent!.stableId
          );
        } else {
          siblings = items.filter((item) => !item.parentStableId);
        }
        siblings = siblings
          .filter((item) => item.stableId !== draggedItem.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex);

        const targetIdx = siblings.findIndex(
          (item) => item.stableId === target.stableId
        );
        if (targetIdx === -1) {
          throw new Error("Could not find index of drag target");
        }
        const children = [
          ...siblings.slice(
            0,
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
          draggedItem,
          ...siblings.slice(
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
        ];
        updateChildrenMutation({
          variables: {
            id: parent?.id || undefined,
            childIds: children.map((item) => item.id),
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: parent?.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      }
    },
    [
      tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
      updateChildrenMutation,
    ]
  );

  const {
    search,
    setSearch,
    searchResults,
    filteredTreeNodes,
    searchState,
    isFiltered,
    searching,
  } = useOverlaySearchState({
    isDraft: true,
    projectId: tocQuery.data?.projectBySlug?.id,
    treeNodes,
    expandedIds,
    setExpandedIds,
  });

  const draftTocItems =
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems;

  const treeItemsWithCommentBadges = useMemo(() => {
    const counts = buildMockCommentReplyCountByStableId(draftTocItems);
    return attachCommentBadgesToTreeItems(filteredTreeNodes, counts);
  }, [filteredTreeNodes, draftTocItems]);

  const unresolvedCommentsSummary = useMemo(
    () => buildMockUnresolvedCommentsSummary(draftTocItems),
    [draftTocItems]
  );

  const client = useApolloClient();

  return (
    <>
      {layerEditingContext.createFolderModal.open && (
        <EditFolderModal
          className="z-30"
          folderId={folderId}
          parentStableId={layerEditingContext.createFolderModal.parentStableId}
          onRequestClose={async (created) => {
            if (created) {
              await tocQuery.refetch();
            }
            setFolderId(undefined);
            layerEditingContext.setCreateFolderModal({ open: false });
          }}
          createNew={layerEditingContext.createFolderModal.open}
        />
      )}
      {folderId && (
        <FolderEditor
          id={folderId}
          onRequestClose={() => {
            setFolderId(undefined);
          }}
        />
      )}
      {publishOpen && (
        <PublishReviewModal
          onRequestClose={() => {
            setPublishOpen(false);
            document.getElementById("publish-button")?.blur();
            setTimeout(() => {
              document.getElementById("publish-button")?.blur();
            }, 10);
          }}
        />
      )}
      {tocQuery.data?.projectBySlug?.id && (
        <Header
          sharedLayersCount={
            extraQuery.data?.projectBySlug?.downloadableLayersCount || 0
          }
          eligibleLayersCount={
            extraQuery.data?.projectBySlug?.eligableDownloadableLayersCount || 0
          }
          searchLoading={searching}
          search={search}
          onSearchChange={setSearch}
          hasLocalState={hasLocalState}
          resetLocalState={resetLocalState}
          openArcGISCart={() => {
            setArcgisCartOpen(true);
          }}
          onRequestOpenFolder={() => {
            layerEditingContext.setCreateFolderModal({ open: true });
          }}
          map={manager?.map}
          region={tocQuery.data?.projectBySlug?.region.geojson}
          selectedView={selectedView}
          setSelectedView={setSelectedView}
          onRequestPublish={() => setPublishOpen(true)}
          publishDisabled={
            tocQuery.data?.projectBySlug?.draftTableOfContentsHasChanges ===
            false
          }
          lastPublished={
            tocQuery.data?.projectBySlug?.tableOfContentsLastPublished
              ? new Date(
                  tocQuery.data.projectBySlug.tableOfContentsLastPublished!
                )
              : undefined
          }
          unresolvedCommentsSummary={unresolvedCommentsSummary}
          onOpenLayerFromCommentSummary={(id, title) =>
            layerEditingContext.setOpenEditor({
              id,
              isFolder: false,
              title,
            })
          }
        />
      )}
      {tocQuery.error && (
        <Warning level="error">
          {tocQuery.error.message || "An error occurred"}
        </Warning>
      )}
      <ScrollingComponent
        className={`flex-1 overflow-y-auto p-2 ${
          selectedView === "quota" ? "px-4" : "px-8"
        }`}
        onContextMenu={(e: any) => e.preventDefault()}
      >
        {tocQuery.loading && !tocQuery.data?.projectBySlug && <Spinner />}

        <Route exact path={`/${slug}/admin/data`}>
          <>
            <SearchResultsMessages
              filteredTreeNodes={filteredTreeNodes}
              search={search}
              searchResults={searchResults}
            />
            {!searching &&
              !search?.length &&
              !tocQuery.loading &&
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
                ?.length === 0 && (
                <div className="text-center text-gray-500 p-4 text-sm">
                  <Trans ns="admin:data">
                    Your project does not have any data layers yet. Drag & drop
                    shapefiles or geojson here, or choose{" "}
                    <b>Edit {"->"} Add Data</b> from the toolbar to get started.
                  </Trans>
                </div>
              )}
            <div
              className={
                "transition-opacity " +
                (searching ? "opacity-50" : "opacity-100")
              }
            >
              <TreeView
                highlights={searchState.highlights}
                disableEditing={isFiltered}
                items={treeItemsWithCommentBadges}
                loadingItems={loadingItems}
                errors={overlayErrors}
                expanded={expandedIds}
                onExpand={onExpand}
                checkedItems={checkedItems}
                onChecked={onChecked}
                hiddenItems={hiddenItems}
                onUnhide={onUnhide}
                ariaLabel="Draft overlays"
                sortable={!isFiltered}
                onSortEnd={onSortEnd}
                getContextMenuContent={(treeItemId, clickEvent) => {
                  const item =
                    tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.find(
                      (item) => item.stableId === treeItemId
                    );
                  let sorted = manager?.getVisibleLayersByZIndex() || [];
                  sorted.filter(
                    (l) => !l.sketchClassLayerState && l.dataLayer?.tocId
                  );
                  if (item) {
                    const variables = {
                      id: item.id,
                    };
                    client.query({
                      query: GetLayerItemDocument,
                      variables,
                    });
                    return (
                      <TableOfContentsItemMenu
                        items={[item]}
                        type={ContextMenu}
                        onExpand={onExpand}
                        editable
                        transform={{
                          x: clickEvent.clientX,
                          y: clickEvent.clientY,
                        }}
                        top={sorted[0]?.dataLayer?.tocId === item.stableId}
                        bottom={
                          sorted[sorted.length - 1]?.dataLayer?.tocId ===
                          item.stableId
                        }
                      />
                    );
                  } else {
                    return null;
                  }
                }}
              />
            </div>
          </>
        </Route>
        <Route path={`/${slug}/admin/data/zindex`}>
          <ZIndexEditableList // @ts-ignore
            tableOfContentsItems={
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
            }
            // @ts-ignore
            dataLayers={
              layersAndSources.data?.projectBySlug?.dataLayersForItems
            }
            // @ts-ignore
            dataSources={
              layersAndSources.data?.projectBySlug?.dataSourcesForItems
            }
          />
        </Route>
        <Route path={`/${slug}/admin/data/changelog`}>
          <ChangeLogView />
        </Route>
        <Route path={`/${slug}/admin/data/quota`}>
          <QuotaUsageDetails // @ts-ignore
            tableOfContentsItems={
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
            }
            layers={
              layersAndSources.data?.projectBySlug?.dataLayersForItems || []
            }
            slug={slug}
          />
        </Route>
      </ScrollingComponent>
      {layerEditingContext.openEditor &&
        !layerEditingContext.openEditor.isFolder && (
          <LayerTableOfContentsItemEditor
            onRequestClose={() => layerEditingContext.setOpenEditor(undefined)}
            itemId={layerEditingContext.openEditor.id}
            title={layerEditingContext.openEditor.title}
          />
        )}
      {layerEditingContext.openEditor?.isFolder && (
        <FolderEditor
          id={layerEditingContext.openEditor.id}
          onRequestClose={() => layerEditingContext.setOpenEditor(undefined)}
        />
      )}
      {layerEditingContext.openMetadataEditor && (
        <TableOfContentsMetadataEditor
          id={layerEditingContext.openMetadataEditor}
          onRequestClose={() =>
            layerEditingContext.setOpenMetadataEditor(undefined)
          }
        />
      )}
      {arcgisCartOpen && (
        <Suspense fallback={<FullScreenLoadingSpinner />}>
          <LazyArcGISCartModal
            projectId={tocQuery.data?.projectBySlug?.id as number}
            region={tocQuery.data?.projectBySlug?.region.geojson}
            onRequestClose={() => setArcgisCartOpen(false)}
            importedArcGISServices={
              (extraQuery.data?.projectBySlug?.importedArcgisServices ||
                []) as string[]
            }
          />
        </Suspense>
      )}
    </>
  );
}

function Header({
  selectedView,
  setSelectedView,
  region,
  map,
  onRequestOpenFolder,
  onRequestPublish,
  publishDisabled,
  lastPublished,
  openArcGISCart,
  hasLocalState,
  resetLocalState,
  search,
  onSearchChange,
  searchLoading,
  sharedLayersCount,
  eligibleLayersCount: eligableLayersCount,
  unresolvedCommentsSummary,
  onOpenLayerFromCommentSummary,
}: {
  selectedView: string;
  setSelectedView: (view: string) => void;
  region?: Feature<any>;
  map?: Map;
  onRequestOpenFolder: () => void;
  onRequestPublish: () => void;
  publishDisabled?: boolean;
  lastPublished?: Date;
  openArcGISCart: () => void;
  hasLocalState?: boolean;
  resetLocalState?: () => void;
  onSearchChange?: (search: string) => void;
  search?: string;
  searchLoading?: boolean;
  sharedLayersCount: number;
  eligibleLayersCount: number;
  unresolvedCommentsSummary: {
    total: number;
    layers: {
      id: number;
      title: string;
      replyCount: number;
      summary: string;
    }[];
  };
  onOpenLayerFromCommentSummary: (id: number, title: string) => void;
}) {
  const uploadContext = useContext(ProjectBackgroundJobContext);
  const { t } = useTranslation("admin:data");
  const [dataHostingRetentionModalOpen, setDataHostingRetentionModalOpen] =
    useState(false);
  const [dataDownloadSettingOpen, setDataDownloadSettingOpen] = useState(false);
  const onError = useGlobalErrorHandler();
  const [enableDownload] = useEnableDownloadForEligibleLayersMutation({
    variables: {
      slug: getSlug(),
    },
    onError,
  });
  const [disableDownload] = useDisableDownloadForSharedLayersMutation({
    variables: {
      slug: getSlug(),
    },
    onError,
  });
  const [mvtUrlModalOpen, setMVTUrlModalOpen] = useState(false);
  const [remoteGeoJSONModalOpen, setRemoteGeoJSONModalOpen] = useState(false);
  const projectId = useProjectId();
  const [showDataLibrary, setShowDataLibrary] = useState(false);
  const [showINaturalistModal, setShowINaturalistModal] = useState(false);

  const { confirm } = useDialog();
  return (
    <header className="w-full min-w-0 max-w-full z-20 flex-none border-b shadow-sm bg-gray-100 mt-2 text-sm border-t px-1 overflow-x-clip">
      <Menubar.Root className="flex w-full min-w-0 max-w-full flex-nowrap p-1 py-0.5 rounded-md z-50 items-center overflow-x-clip">
        <Menubar.Menu>
          <MenubarTrigger>{t("View")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <Menubar.RadioGroup
                value={selectedView}
                onValueChange={setSelectedView}
              >
                <MenubarRadioItem value="tree">
                  <Trans ns="admin:data">Table of Contents</Trans>
                </MenubarRadioItem>
                <MenubarRadioItem value="order">
                  <Trans ns="admin:data">Layer Z-Ordering</Trans>
                </MenubarRadioItem>
                <MenubarRadioItem value="quota">
                  <Trans ns="admin:data">Data Hosting Quota</Trans>
                </MenubarRadioItem>
                <MenubarRadioItem value="changelog">
                  <Trans ns="admin:data">Change Log</Trans>
                </MenubarRadioItem>
              </Menubar.RadioGroup>
              <MenuBarSeparator />
              <MenuBarItem
                disabled={!region || !map}
                onClick={() => {
                  if (region && map) {
                    map.fitBounds(
                      bbox(region) as [number, number, number, number],
                      {
                        padding: {
                          top: 20,
                          bottom: 20,
                          left: 150,
                          right: 20,
                        },
                      }
                    );
                  }
                }}
              >
                <Trans ns="admin:data">Zoom to Project Bounds</Trans>
              </MenuBarItem>
              {resetLocalState && (
                <MenuBarItem
                  disabled={!hasLocalState}
                  onClick={() => {
                    resetLocalState();
                  }}
                >
                  <Trans ns="homepage">Reset overlays</Trans>
                </MenuBarItem>
              )}
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu>
          <MenubarTrigger>{t("Edit")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <MenuBarItem onClick={onRequestOpenFolder}>
                <Trans ns="admin:data">Add Folder</Trans>
              </MenuBarItem>
              <MenuBarSubmenu label={t("Add Data")}>
                <MenuBarLabel>{t("Host data on SeaSketch")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    uploadContext.browseForFiles(true);
                  }}
                >
                  {t("Upload spatial data files")}
                </MenuBarItem>
                <MenuBarItem
                  onClick={() => {
                    setShowDataLibrary(true);
                  }}
                >
                  {t("View the Data Library")}
                </MenuBarItem>

                <MenuBarSeparator />
                <MenuBarLabel>{t("Connect to data services")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    openArcGISCart();
                  }}
                >
                  {t("Esri ArcGIS service...")}
                </MenuBarItem>
                <MenuBarItem
                  onClick={() => {
                    setMVTUrlModalOpen(true);
                  }}
                >
                  {t("Vector tiles by URL...")}
                </MenuBarItem>
                {/* <MenuBarItem
                  onClick={() => {
                    // openArcGISCart();
                  }}
                >
                  {t("TileJSON endpoint...")}
                </MenuBarItem>*/}
                <MenuBarItem
                  onClick={() => {
                    setRemoteGeoJSONModalOpen(true);
                  }}
                >
                  {t("Remote GeoJSON...")}
                </MenuBarItem>
              </MenuBarSubmenu>
              <MenuBarSeparator />
              <MenuBarLabel>
                <Trans ns="admin:data">Data download</Trans>
              </MenuBarLabel>
              <MenuBarItem
                onClick={async () => {
                  if (
                    await confirm(
                      "Are you sure you want to enable data download for all eligible layers?",
                      {
                        description:
                          "You will need to publish the table of contents for this change to take effect.",

                        onSubmit: async () => {
                          await enableDownload();
                          return;
                        },
                      }
                    )
                  ) {
                  }
                }}
                disabled={eligableLayersCount === 0}
              >
                {t(`Enable for ${eligableLayersCount || ""} eligible layers`)}
              </MenuBarItem>
              <MenuBarItem
                onClick={async () => {
                  if (
                    await confirm(
                      "Are you sure you want to disable data download for all layers?",
                      {
                        description:
                          "You will need to publish the table of contents for this change to take effect.",
                        onSubmit: async () => {
                          await disableDownload();
                          return;
                        },
                      }
                    )
                  ) {
                  }
                }}
                disabled={sharedLayersCount === 0}
              >
                {t(`Disable for ${sharedLayersCount || ""} shared layers`)}
              </MenuBarItem>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu>
          <MenubarTrigger>{t("Settings")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <Menubar.MenubarGroup>
                <MenuBarItem onClick={() => setDataDownloadSettingOpen(true)}>
                  <Trans ns="admin:data">Data download...</Trans>
                </MenuBarItem>
                <MenuBarItem
                  onClick={() => setDataHostingRetentionModalOpen(true)}
                >
                  <Trans ns="admin:data">Archived Layer Retention...</Trans>
                </MenuBarItem>
              </Menubar.MenubarGroup>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-1.5 ml-1">
          {selectedView !== "changelog" && (
            <div className="min-w-0 flex-1">
              <OverlaySearchInput
                search={search}
                onChange={onSearchChange}
                loading={searchLoading}
              />
            </div>
          )}
          <div className="flex flex-none items-center justify-end gap-0.5 shrink-0">
          <UnresolvedCommentsHeaderButton
            total={unresolvedCommentsSummary.total}
            layers={unresolvedCommentsSummary.layers}
            onOpenLayer={onOpenLayerFromCommentSummary}
          />
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                <button
                  id="publish-button"
                  className={`${
                    publishDisabled
                      ? "bg-white text-black opacity-80"
                      : "bg-primary-500 text-white"
                  } rounded px-2 py-0.5 shadow-sm`}
                  onClick={onRequestPublish}
                >
                  <Trans ns="admin:data">Publish</Trans>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  style={{ maxWidth: 220 }}
                  className="z-50 select-none rounded bg-white px-4 py-2 shadow text-center"
                  // sideOffset={-200}
                  side="right"
                >
                  {publishDisabled ? (
                    t("No changes")
                  ) : (
                    <span>
                      {t("Has changes since last publish")}
                      {lastPublished
                        ? " on " + lastPublished.toLocaleDateString()
                        : null}
                    </span>
                  )}
                  <Tooltip.Arrow className="" style={{ fill: "white" }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          </div>
        </div>
      </Menubar.Root>
      {dataDownloadSettingOpen && (
        <DataDownloadDefaultSettingModal
          onRequestClose={() => setDataDownloadSettingOpen(false)}
        />
      )}
      {dataHostingRetentionModalOpen && projectId && (
        <DataHostingRetentionPeriodModal
          projectId={projectId}
          onRequestClose={() => setDataHostingRetentionModalOpen(false)}
        />
      )}
      {mvtUrlModalOpen && (
        <AddMVTUrlModal onRequestClose={() => setMVTUrlModalOpen(false)} />
      )}
      {remoteGeoJSONModalOpen && (
        <AddRemoteGeoJSONModal
          onRequestClose={() => setRemoteGeoJSONModalOpen(false)}
        />
      )}
      {showDataLibrary && (
        <Suspense fallback={<FullScreenLoadingSpinner />}>
          <LazyDataLibraryModal
            onRequestClose={() => setShowDataLibrary(false)}
            onOpenINaturalistModal={() => setShowINaturalistModal(true)}
          />
        </Suspense>
      )}
      {showINaturalistModal && (
        <Suspense fallback={<FullScreenLoadingSpinner />}>
          <LazyINaturalistModal
            onRequestClose={() => setShowINaturalistModal(false)}
          />
        </Suspense>
      )}
    </header>
  );
}
