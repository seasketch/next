import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueryResult } from "@apollo/client";
import { Trans, useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  InfoCircledIcon,
  TextAlignBottomIcon,
  TextAlignMiddleIcon,
} from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  DataSourceTypes,
  DownloadSettingsTableOfContentsQuery,
  DownloadSettingsTocItemFragment,
  ExtraTocEditingInfoDocument,
  LayersAndSourcesForItemsQuery,
  SearchOverlaysQuery,
  SearchOverlaysQueryVariables,
  SublayerType,
  useDownloadSettingsTableOfContentsQuery,
  useUpdateEnableDownloadMutation,
} from "../../generated/graphql";
import Switch from "../../components/Switch";
import Spinner from "../../components/Spinner";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import type { TreeItem, TreeItemHighlights } from "../../components/TreeView";
import SearchResultsMessages from "../../dataLayers/SearchResultsMessages";
import { SearchResultHighlights } from "../../projects/Sketches/TreeItemComponent";
import AdminDataViewScreenHeading from "./AdminDataViewScreenHeading";

type DataLayerRow = NonNullable<
  NonNullable<
    LayersAndSourcesForItemsQuery["projectBySlug"]
  >["dataLayersForItems"]
>[number];

type DataSourceRow = NonNullable<
  NonNullable<
    LayersAndSourcesForItemsQuery["projectBySlug"]
  >["dataSourcesForItems"]
>[number];

type TocItemShape = {
  id: number;
  title: string;
  stableId: string;
  isFolder: boolean;
  parentStableId: string | null;
  sortIndex: number;
};

type DownloadLayerModel = {
  tocItem: DownloadSettingsTocItemFragment;
  layer?: DataLayerRow;
  source?: DataSourceRow;
  sortIndex: number;
};

type FolderNode = {
  kind: "folder";
  stableId: string;
  title: string;
  sortIndex: number;
  children: TreeNode[];
};

type LayerNode = {
  kind: "layer";
  model: DownloadLayerModel;
  sortIndex: number;
};

type TreeNode = FolderNode | LayerNode;

type DownloadSettingsTocRow = NonNullable<
  NonNullable<
    DownloadSettingsTableOfContentsQuery["projectBySlug"]
  >["draftTableOfContentsItems"]
>[number];

function sourceSupportsDownload(
  sourceType: DataSourceTypes,
  sublayerType: SublayerType | null | undefined
): boolean {
  return (
    sourceType === DataSourceTypes.ArcgisVector ||
    (sourceType === DataSourceTypes.ArcgisDynamicMapserver &&
      sublayerType === SublayerType.Vector) ||
    sourceType === DataSourceTypes.Geojson ||
    sourceType === DataSourceTypes.SeasketchMvt ||
    sourceType === DataSourceTypes.SeasketchRaster ||
    sourceType === DataSourceTypes.SeasketchVector
  );
}

function supportAndToggleState(
  item: DownloadSettingsTocItemFragment,
  source: DataSourceRow | undefined,
  layer: DataLayerRow | undefined
): {
  supported: boolean;
  canToggle: boolean;
} {
  if (!layer || !source) {
    return { supported: false, canToggle: false };
  }
  const st = source.type as DataSourceTypes;
  if (!sourceSupportsDownload(st, layer.sublayerType)) {
    return { supported: false, canToggle: false };
  }
  if (
    st === DataSourceTypes.ArcgisVector ||
    st === DataSourceTypes.ArcgisDynamicMapserver
  ) {
    return { supported: true, canToggle: true };
  }
  if (st === DataSourceTypes.Geojson) {
    return { supported: true, canToggle: true };
  }
  if (!item.hasOriginalSourceUpload) {
    return { supported: true, canToggle: false };
  }
  return { supported: true, canToggle: true };
}

function buildFolderTree(
  tocItems: TocItemShape[],
  layersByStableId: Map<string, DownloadLayerModel>,
  layerSortIndex: Map<string, number>
): TreeNode[] {
  const itemMap = new Map<string, TocItemShape>();
  for (const item of tocItems) {
    itemMap.set(item.stableId, item);
  }

  const layerStableIds = new Set(layersByStableId.keys());

  const relevantFolders = new Set<string>();
  for (const layerStableId of layerStableIds) {
    let current = itemMap.get(layerStableId);
    while (current?.parentStableId) {
      const parent = itemMap.get(current.parentStableId);
      if (parent?.isFolder) {
        relevantFolders.add(parent.stableId);
      }
      current = parent;
    }
  }

  function buildChildren(parentStableId: string | null): TreeNode[] {
    const children: TreeNode[] = [];

    for (const item of tocItems) {
      const itemParent = item.parentStableId || null;
      if (itemParent !== parentStableId) continue;

      if (item.isFolder && relevantFolders.has(item.stableId)) {
        const folderChildren = buildChildren(item.stableId);
        if (folderChildren.length > 0) {
          children.push({
            kind: "folder",
            stableId: item.stableId,
            title: item.title,
            sortIndex: item.sortIndex,
            children: folderChildren,
          });
        }
      } else if (layersByStableId.has(item.stableId)) {
        children.push({
          kind: "layer",
          model: layersByStableId.get(item.stableId)!,
          sortIndex: layerSortIndex.get(item.stableId) ?? item.sortIndex,
        });
      }
    }

    children.sort((a, b) => a.sortIndex - b.sortIndex);
    return children;
  }

  return buildChildren(null);
}

function collectFolderStableIds(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind === "folder") {
      out.push(n.stableId, ...collectFolderStableIds(n.children));
    }
  }
  return out;
}

/** When `visible` is null, all layers pass. Otherwise only listed stableIds. */
function filterDownloadTree(
  nodes: TreeNode[],
  visible: Set<string> | null
): TreeNode[] {
  if (!visible) return nodes;
  const filtered: TreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "layer") {
      if (visible.has(node.model.tocItem.stableId)) {
        filtered.push(node);
      }
    } else {
      const children = filterDownloadTree(node.children, visible);
      if (children.length > 0) {
        filtered.push({ ...node, children });
      }
    }
  }
  return filtered;
}

export default function DataDownloadSettingsPanel({
  slug,
  projectId,
  dataLayers,
  dataSources,
  layersLoading,
  downloadableLayersCount,
  eligibleLayersCount,
  filteredTreeNodes,
  search,
  searchState,
  searchResults,
}: {
  slug: string;
  projectId: number;
  dataLayers?: DataLayerRow[] | null;
  dataSources?: DataSourceRow[] | null;
  layersLoading: boolean;
  downloadableLayersCount: number;
  eligibleLayersCount: number;
  filteredTreeNodes: TreeItem[];
  search?: string;
  searchState: {
    highlights?: { [id: string]: TreeItemHighlights };
    originalState?: string[];
  };
  searchResults: QueryResult<SearchOverlaysQuery, SearchOverlaysQueryVariables>;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const downloadTocQuery = useDownloadSettingsTableOfContentsQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const downloadTocItems =
    downloadTocQuery.data?.projectBySlug?.draftTableOfContentsItems;
  const [viewMode, setViewModeState] = useState<"alpha" | "folders">(() => {
    try {
      const stored = localStorage.getItem(
        "seasketch:dataDownloadSettingsViewMode"
      );
      if (stored === "alpha" || stored === "folders") return stored;
    } catch {
      /* ignore */
    }
    return "alpha";
  });
  const setViewMode = useCallback((mode: "alpha" | "folders") => {
    setViewModeState(mode);
    try {
      localStorage.setItem("seasketch:dataDownloadSettingsViewMode", mode);
    } catch {
      /* ignore */
    }
  }, []);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set()
  );
  const prevViewMode = useRef(viewMode);

  const sourceById = useMemo(() => {
    const m = new Map<number, DataSourceRow>();
    for (const s of dataSources || []) {
      m.set(s.id, s);
    }
    return m;
  }, [dataSources]);

  const layerById = useMemo(() => {
    const m = new Map<number, DataLayerRow>();
    for (const l of dataLayers || []) {
      m.set(l.id, l);
    }
    return m;
  }, [dataLayers]);

  const layersByStableId = useMemo(() => {
    const map = new Map<string, DownloadLayerModel>();
    const items = downloadTocItems || [];
    for (const item of items) {
      if (item.isFolder || !item.dataLayerId || !item.stableId) continue;
      const layer = layerById.get(item.dataLayerId);
      const source = layer ? sourceById.get(layer.dataSourceId) : undefined;
      map.set(item.stableId, {
        tocItem: item,
        layer,
        source,
        sortIndex: item.sortIndex,
      });
    }
    return map;
  }, [downloadTocItems, layerById, sourceById]);

  const tocItems = useMemo((): TocItemShape[] => {
    return (downloadTocItems || [])
      .filter((i): i is DownloadSettingsTocRow => !!i?.stableId)
      .map((i: DownloadSettingsTocRow) => ({
        id: i.id,
        title: i.title,
        stableId: i.stableId,
        isFolder: i.isFolder,
        parentStableId: i.parentStableId ?? null,
        sortIndex: i.sortIndex,
      }));
  }, [downloadTocItems]);

  const layerSortIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of tocItems) {
      if (!item.isFolder) {
        map.set(item.stableId, item.sortIndex);
      }
    }
    return map;
  }, [tocItems]);

  const folderTree = useMemo(
    () => buildFolderTree(tocItems, layersByStableId, layerSortIndex),
    [tocItems, layersByStableId, layerSortIndex]
  );

  const overlaySearchActive = Boolean(search && search.length >= 2);
  const visibleLeafStableIds = useMemo(() => {
    if (!overlaySearchActive) return null;
    return new Set(filteredTreeNodes.filter((n) => n.isLeaf).map((n) => n.id));
  }, [overlaySearchActive, filteredTreeNodes]);

  const alphabeticalModels = useMemo(() => {
    return [...layersByStableId.values()].sort((a, b) =>
      (a.tocItem.title || "").localeCompare(b.tocItem.title || "")
    );
  }, [layersByStableId]);

  const filteredAlpha = useMemo(() => {
    if (!visibleLeafStableIds) return alphabeticalModels;
    return alphabeticalModels.filter((m) =>
      visibleLeafStableIds.has(m.tocItem.stableId)
    );
  }, [alphabeticalModels, visibleLeafStableIds]);

  const folderTreeDisplay = useMemo(
    () => filterDownloadTree(folderTree, visibleLeafStableIds),
    [folderTree, visibleLeafStableIds]
  );

  useEffect(() => {
    if (viewMode === "folders" && prevViewMode.current !== "folders") {
      setExpandedFolders(new Set(collectFolderStableIds(folderTreeDisplay)));
    }
    prevViewMode.current = viewMode;
  }, [viewMode, folderTreeDisplay]);

  const summary = useMemo(() => {
    let enabled = 0;
    let blocked = 0;
    for (const m of layersByStableId.values()) {
      const { supported: sup, canToggle } = supportAndToggleState(
        m.tocItem,
        m.source,
        m.layer
      );
      if (m.tocItem.enableDownload) enabled++;
      if (sup && !canToggle) blocked++;
    }
    return {
      enabled,
      total: layersByStableId.size,
      blocked,
    };
  }, [layersByStableId]);

  const [updateEnableDownload] = useUpdateEnableDownloadMutation({
    onError,
    // Only refresh project stats. `enableDownload` merges into normalized
    // `TableOfContentsItem` cache (shared with DownloadSettingsTableOfContents).
    refetchQueries: [
      { query: ExtraTocEditingInfoDocument, variables: { slug } },
    ],
    awaitRefetchQueries: false,
  });

  const toggleFolder = useCallback((stableId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(stableId)) {
        next.delete(stableId);
      } else {
        next.add(stableId);
      }
      return next;
    });
  }, []);

  const expandAllFolders = useCallback(() => {
    setExpandedFolders(new Set(collectFolderStableIds(folderTreeDisplay)));
  }, [folderTreeDisplay]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const renderRow = (model: DownloadLayerModel, depth: number) => {
    const { tocItem, layer, source } = model;
    const { supported, canToggle } = supportAndToggleState(
      tocItem,
      source,
      layer
    );
    const waitingForLayer = Boolean(
      tocItem.dataLayerId &&
        !layer &&
        layersLoading &&
        (dataLayers == null || dataLayers.length === 0)
    );
    const hl = searchState.highlights?.[tocItem.stableId];

    const note =
      waitingForLayer || !layer || !source ? (
        <span className="text-xs text-gray-500">
          {waitingForLayer ? (
            <Trans ns="admin:data">Loading…</Trans>
          ) : (
            <Trans ns="admin:data">Details unavailable.</Trans>
          )}
        </span>
      ) : !supported ? null : !canToggle ? (
        <span className="text-xs text-amber-800">
          <Trans ns="admin:data">Original file not on SeaSketch.</Trans>
        </span>
      ) : null;

    const pad = depth > 0 ? { paddingLeft: 8 + depth * 12 } : undefined;

    return (
      <div
        key={tocItem.stableId}
        className="group flex items-center gap-2 py-1.5 px-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/90"
        style={pad}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 leading-snug min-w-0">
            {hl?.title ? (
              <div className="truncate">
                <SearchResultHighlights data={hl.title} />
              </div>
            ) : (
              <div className="truncate">
                {tocItem.title || t("Untitled layer")}
              </div>
            )}
            {hl?.metadata && !hl?.title ? (
              <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                <SearchResultHighlights data={hl.metadata} />
              </div>
            ) : null}
          </div>
          {note ? <div className="mt-0.5">{note}</div> : null}
        </div>
        <div className="flex items-center flex-shrink-0 w-11 justify-end">
          {supported && canToggle && !waitingForLayer ? (
            <Switch
              isToggled={tocItem.enableDownload}
              disabled={false}
              onClick={() =>
                updateEnableDownload({
                  variables: {
                    id: tocItem.id,
                    enableDownload: !tocItem.enableDownload,
                  },
                  optimisticResponse: {
                    __typename: "Mutation",
                    updateTableOfContentsItem: {
                      __typename: "UpdateTableOfContentsItemPayload",
                      tableOfContentsItem: {
                        __typename: "TableOfContentsItem",
                        id: tocItem.id,
                        enableDownload: !tocItem.enableDownload,
                        project: {
                          __typename: "Project",
                          id: projectId,
                          downloadableLayersCount: Math.max(
                            0,
                            downloadableLayersCount +
                              (!tocItem.enableDownload ? 1 : -1)
                          ),
                          eligableDownloadableLayersCount: eligibleLayersCount,
                        },
                        primaryDownloadUrl: tocItem.primaryDownloadUrl,
                      },
                    },
                  },
                })
              }
            />
          ) : !supported ? (
            <Tooltip.Provider>
              <Tooltip.Root delayDuration={200}>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100/80 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                    aria-label={t(
                      "Downloads not supported for this source type."
                    )}
                  >
                    <InfoCircledIcon
                      className="h-4 w-4 shrink-0"
                      aria-hidden
                    />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 max-w-xs select-none rounded bg-black px-2.5 py-1.5 text-xs text-white shadow-md"
                    side="left"
                    sideOffset={6}
                  >
                    {t("Downloads not supported for this source type.")}
                    <Tooltip.Arrow className="fill-black" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          ) : (
            <div
              className="h-6 w-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center"
              title={t("Cannot change from here")}
            >
              <span className="text-[10px] font-semibold text-gray-400">
                {waitingForLayer ? "…" : "!"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTreeNodes = (nodes: TreeNode[], depth: number) => {
    return nodes.map((node) => {
      if (node.kind === "layer") {
        return renderRow(node.model, depth);
      }
      const open = expandedFolders.has(node.stableId);
      return (
        <div
          key={node.stableId}
          className="border-b border-gray-100 last:border-b-0"
        >
          <div
            className="flex items-center gap-1 py-1 px-2 bg-gray-100 text-xs font-semibold text-gray-700"
            style={{ paddingLeft: 6 + depth * 12 }}
          >
            <button
              type="button"
              className="p-0.5 rounded hover:bg-slate-200/80 text-gray-600"
              onClick={() => toggleFolder(node.stableId)}
              aria-expanded={open}
            >
              {open ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
            <span className="truncate">{node.title}</span>
          </div>
          {open && (
            <div className="bg-white">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const listEmpty =
    viewMode === "alpha"
      ? filteredAlpha.length === 0
      : folderTreeDisplay.length === 0;

  const downloadTocLoaded =
    !downloadTocQuery.loading ||
    downloadTocItems != null ||
    Boolean(downloadTocQuery.error);

  const showListShell =
    downloadTocLoaded &&
    (!downloadTocItems?.length ||
      (!!downloadTocItems?.length && summary.total === 0) ||
      (summary.total > 0 && !listEmpty));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-none px-4 py-3 border-b border-gray-200/90 bg-white shadow-md z-10">
        <div className="flex items-center">
          <AdminDataViewScreenHeading className="flex-1">
            <Trans ns="admin:data">Download Settings</Trans>
          </AdminDataViewScreenHeading>
          {viewMode === "folders" && folderTreeDisplay.length > 0 && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip.Provider>
                <Tooltip.Root delayDuration={200}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100/80 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      aria-label={t("Expand all")}
                      onClick={expandAllFolders}
                    >
                      <TextAlignBottomIcon
                        className="h-4 w-4 shrink-0 opacity-90"
                        aria-hidden
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="z-50 select-none rounded bg-black px-2.5 py-1.5 text-xs text-white shadow-md"
                      side="bottom"
                      sideOffset={6}
                    >
                      {t("Expand all")}
                      <Tooltip.Arrow className="fill-black" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <Tooltip.Root delayDuration={200}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100/80 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      aria-label={t("Collapse all")}
                      onClick={collapseAllFolders}
                    >
                      <TextAlignMiddleIcon
                        className="h-4 w-4 shrink-0 opacity-90"
                        aria-hidden
                      />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="z-50 select-none rounded bg-black px-2.5 py-1.5 text-xs text-white shadow-md"
                      side="bottom"
                      sideOffset={6}
                    >
                      {t("Collapse all")}
                      <Tooltip.Arrow className="fill-black" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          )}
          <div className="flex shrink-0 rounded border border-gray-300 overflow-hidden text-xs">
            <button
              type="button"
              className={`px-2 py-1.5 font-medium ${
                viewMode === "folders"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setViewMode("folders")}
            >
              <Trans ns="admin:data">Folders</Trans>
            </button>
            <button
              type="button"
              className={`px-2 py-1.5 font-medium border-l border-gray-300 ${
                viewMode === "alpha"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setViewMode("alpha")}
            >
              <Trans ns="admin:data">A–Z</Trans>
            </button>
          </div>
        </div>

        {summary.blocked > 0 && (
          <p className="text-xs text-amber-800 mt-2 leading-snug">
            {t("{{count}} cannot be enabled (original file missing).", {
              count: summary.blocked,
            })}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 pb-4">
        {downloadTocQuery.loading && !downloadTocItems?.length && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        <SearchResultsMessages
          filteredTreeNodes={filteredTreeNodes}
          search={search}
          searchResults={searchResults}
        />

        {showListShell && (
          <div className=" bg-white overflow-hidden">
            {!downloadTocItems?.length && (
              <div className="p-4 text-center text-gray-500 text-sm">
                <Trans ns="admin:data">No layers in this project yet.</Trans>
              </div>
            )}
            {!!downloadTocItems?.length && summary.total === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                <Trans ns="admin:data">
                  No data layers found to configure.
                </Trans>
              </div>
            )}
            {summary.total > 0 && !listEmpty && (
              <div>
                {viewMode === "alpha"
                  ? filteredAlpha.map((m) => renderRow(m, 0))
                  : renderTreeNodes(folderTreeDisplay, 0)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
