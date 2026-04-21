import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { QueryResult } from "@apollo/client";
import { Trans, useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoCircledIcon,
  TextAlignBottomIcon,
  TextAlignMiddleIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ShieldCheckIcon, UserGroupIcon } from "@heroicons/react/outline";
import {
  AccessControlListType,
  SharingSettingsTableOfContentsQuery,
  SharingSettingsTocItemFragment,
  SearchOverlaysQuery,
  SearchOverlaysQueryVariables,
  useSharingSettingsTableOfContentsQuery,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import type { TreeItem, TreeItemHighlights } from "../../components/TreeView";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import SearchResultsMessages from "../../dataLayers/SearchResultsMessages";
import { SearchResultHighlights } from "../../projects/Sketches/TreeItemComponent";
import AdminDataViewScreenHeading from "./AdminDataViewScreenHeading";

type SharingSettingsTocRow = NonNullable<
  NonNullable<
    SharingSettingsTableOfContentsQuery["projectBySlug"]
  >["draftTableOfContentsItems"]
>[number];

type TocItemShape = {
  id: number;
  title: string;
  stableId: string;
  isFolder: boolean;
  parentStableId: string | null;
  sortIndex: number;
};

type SharingLayerModel = {
  tocItem: SharingSettingsTocItemFragment;
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
  model: SharingLayerModel;
  sortIndex: number;
};

type TreeNode = FolderNode | LayerNode;

type AccessSectionKey = "public" | "group" | "admins" | "unknown";

type AccessSection = {
  key: AccessSectionKey;
  title: string;
  items: SharingLayerModel[];
};

function buildFolderTree(
  tocItems: TocItemShape[],
  layersByStableId: Map<string, SharingLayerModel>,
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

function filterSharingTree(
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
      const children = filterSharingTree(node.children, visible);
      if (children.length > 0) {
        filtered.push({ ...node, children });
      }
    }
  }
  return filtered;
}

function sortedGroupNames(
  groups:
    | NonNullable<SharingSettingsTocItemFragment["acl"]>["groups"]
    | null
    | undefined
): string[] {
  const names =
    groups
      ?.map((g) => g?.name?.trim())
      .filter((n): n is string => Boolean(n)) ?? [];
  return [...names].sort((a, b) => a.localeCompare(b));
}

function getAccessSectionKey(
  acl?: SharingSettingsTocItemFragment["acl"] | null
): AccessSectionKey {
  if (!acl?.type) return "unknown";
  if (acl.type === AccessControlListType.Public) return "public";
  if (acl.type === AccessControlListType.Group) return "group";
  if (acl.type === AccessControlListType.AdminsOnly) return "admins";
  return "unknown";
}

function SharingAccessChip({
  acl,
  title,
  slug,
  isActive,
  onMutate,
  onOpenChange,
}: {
  acl?: SharingSettingsTocItemFragment["acl"] | null;
  title: string;
  slug: string;
  isActive?: boolean;
  onMutate: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const type = acl?.type;
  const groups = acl?.groups;
  const names = sortedGroupNames(groups);

  let icon: ReactNode;
  let shortLabel: ReactNode;

  if (!acl || !type) {
    icon = (
      <InfoCircledIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
    );
    shortLabel = (
      <span className="truncate text-xs font-medium text-gray-600">
        <Trans ns="admin:data">Unknown</Trans>
      </span>
    );
  } else if (type === AccessControlListType.Public) {
    icon = (
      <GlobeIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
    );
    shortLabel = (
      <span className="truncate text-xs font-medium text-gray-900">
        <Trans ns="admin:data">Public</Trans>
      </span>
    );
  } else if (type === AccessControlListType.AdminsOnly) {
    icon = (
      <ShieldCheckIcon
        className="h-4 w-4 shrink-0 text-primary-600"
        aria-hidden
      />
    );
    shortLabel = (
      <span className="truncate text-xs font-medium text-gray-900">
        <Trans ns="admin:data">Admins</Trans>
      </span>
    );
  } else {
    icon = (
      <UserGroupIcon
        className="h-4 w-4 shrink-0 text-primary-600"
        aria-hidden
      />
    );
    shortLabel =
      names.length === 0 ? (
        <span className="truncate text-xs font-medium text-amber-800">
          <Trans ns="admin:data">Groups (none)</Trans>
        </span>
      ) : (
        <span className="max-w-[11rem] truncate text-xs font-medium text-gray-900">
          {names.join(", ")}
        </span>
      );
  }

  return (
    <Popover.Root
      open={Boolean(acl?.nodeId) && isActive}
      onOpenChange={onOpenChange}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!acl?.nodeId}
          className={`flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
            isActive
              ? "border-primary-300 bg-primary-50/80"
              : "border-gray-200 bg-gray-50/80 hover:border-gray-300 hover:bg-gray-100"
          } ${!acl?.nodeId ? "cursor-default opacity-70" : ""}`}
        >
          {icon}
          {shortLabel}
        </button>
      </Popover.Trigger>
      {acl?.nodeId && (
        <Popover.Portal>
          <Popover.Content
            align="center"
            className="z-50 rounded-md border border-gray-200 bg-white p-3 shadow-xl"
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="right"
            sideOffset={22}
          >
            <div className="mb-2 pb-1">
              <div className="text-sm font-medium text-gray-900">
                <Trans ns="admin:data">Access Control</Trans>
              </div>
              <div className="max-w-[18rem] truncate text-xs text-gray-500">
                {title}
              </div>
            </div>
            <AccessControlListEditor
              compact
              legend={null}
              nodeId={acl.nodeId}
              onMutate={onMutate}
              projectSlug={slug}
            />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

export default function SharingSettingsPanel({
  slug,
  filteredTreeNodes,
  search,
  searchState,
  searchResults,
}: {
  slug: string;
  filteredTreeNodes: TreeItem[];
  search?: string;
  searchState: {
    highlights?: { [id: string]: TreeItemHighlights };
    originalState?: string[];
  };
  searchResults: QueryResult<SearchOverlaysQuery, SearchOverlaysQueryVariables>;
}) {
  const { t } = useTranslation("admin:data");

  const sharingTocQuery = useSharingSettingsTableOfContentsQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const sharingTocItems =
    sharingTocQuery.data?.projectBySlug?.draftTableOfContentsItems;

  const [viewMode, setViewModeState] = useState<"alpha" | "folders" | "access">(
    () => {
      try {
        const stored = localStorage.getItem(
          "seasketch:sharingSettingsViewMode"
        );
        if (stored === "alpha" || stored === "folders" || stored === "access") {
          return stored;
        }
      } catch {
        /* ignore */
      }
      return "alpha";
    }
  );
  const setViewMode = useCallback((mode: "alpha" | "folders" | "access") => {
    setViewModeState(mode);
    try {
      localStorage.setItem("seasketch:sharingSettingsViewMode", mode);
    } catch {
      /* ignore */
    }
  }, []);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set()
  );
  const [activeEditorStableId, setActiveEditorStableId] = useState<
    string | null
  >(null);
  const [pendingScrollStableId, setPendingScrollStableId] = useState<
    string | null
  >(null);
  const prevViewMode = useRef(viewMode);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const layersByStableId = useMemo(() => {
    const map = new Map<string, SharingLayerModel>();
    const items = sharingTocItems || [];
    for (const item of items) {
      if (item.isFolder || !item.dataLayerId || !item.stableId) continue;
      map.set(item.stableId, {
        tocItem: item,
        sortIndex: item.sortIndex,
      });
    }
    return map;
  }, [sharingTocItems]);

  const tocItems = useMemo((): TocItemShape[] => {
    return (sharingTocItems || [])
      .filter((i): i is SharingSettingsTocRow => !!i?.stableId)
      .map((i: SharingSettingsTocRow) => ({
        id: i.id,
        title: i.title,
        stableId: i.stableId,
        isFolder: i.isFolder,
        parentStableId: i.parentStableId ?? null,
        sortIndex: i.sortIndex,
      }));
  }, [sharingTocItems]);

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

  const accessSections = useMemo((): AccessSection[] => {
    const sections: AccessSection[] = [
      { key: "public", title: t("Public"), items: [] },
      { key: "group", title: t("Group Access"), items: [] },
      { key: "admins", title: t("Admins Only"), items: [] },
      { key: "unknown", title: t("Unknown"), items: [] },
    ];
    const byKey = new Map(sections.map((section) => [section.key, section]));

    for (const item of filteredAlpha) {
      byKey.get(getAccessSectionKey(item.tocItem.acl))?.items.push(item);
    }

    return sections.filter((section) => section.items.length > 0);
  }, [filteredAlpha, t]);

  const folderTreeDisplay = useMemo(
    () => filterSharingTree(folderTree, visibleLeafStableIds),
    [folderTree, visibleLeafStableIds]
  );

  useEffect(() => {
    if (viewMode === "folders" && prevViewMode.current !== "folders") {
      setExpandedFolders(new Set(collectFolderStableIds(folderTreeDisplay)));
    }
    prevViewMode.current = viewMode;
  }, [viewMode, folderTreeDisplay]);

  useEffect(() => {
    if (!pendingScrollStableId || viewMode !== "access") return;
    const row = rowRefs.current.get(pendingScrollStableId);
    if (!row) return;

    row.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
    setPendingScrollStableId(null);
  }, [pendingScrollStableId, viewMode, accessSections]);

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

  const renderRow = (model: SharingLayerModel, depth: number) => {
    const { tocItem } = model;
    const hl = searchState.highlights?.[tocItem.stableId];

    const pad = depth > 0 ? { paddingLeft: 8 + depth * 12 } : undefined;

    return (
      <div
        key={tocItem.stableId}
        className="group flex items-center gap-2 py-1.5 px-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/90"
        ref={(el) => {
          if (el) {
            rowRefs.current.set(tocItem.stableId, el);
          } else {
            rowRefs.current.delete(tocItem.stableId);
          }
        }}
        style={pad}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug text-gray-900 min-w-0">
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
              <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                <SearchResultHighlights data={hl.metadata} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <SharingAccessChip
            acl={tocItem.acl}
            title={tocItem.title || t("Untitled layer")}
            isActive={activeEditorStableId === tocItem.stableId}
            onMutate={() => setPendingScrollStableId(tocItem.stableId)}
            onOpenChange={(open) => {
              if (!tocItem.acl?.nodeId) return;
              setActiveEditorStableId(open ? tocItem.stableId : null);
            }}
            slug={slug}
          />
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
            className="flex items-center gap-1 bg-gray-100 py-1 px-2 text-xs font-semibold text-gray-700"
            style={{ paddingLeft: 6 + depth * 12 }}
          >
            <button
              type="button"
              className="rounded p-0.5 text-gray-600 hover:bg-slate-200/80"
              onClick={() => toggleFolder(node.stableId)}
              aria-expanded={open}
            >
              {open ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
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
      : viewMode === "folders"
      ? folderTreeDisplay.length === 0
      : accessSections.length === 0;

  const sharingTocLoaded =
    !sharingTocQuery.loading ||
    sharingTocItems != null ||
    Boolean(sharingTocQuery.error);

  const layerCount = layersByStableId.size;

  const showListShell =
    sharingTocLoaded &&
    (!sharingTocItems?.length ||
      (!!sharingTocItems?.length && layerCount === 0) ||
      (layerCount > 0 && !listEmpty));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="z-10 flex-none border-b border-gray-200/90 bg-white px-4 py-3 shadow-md">
        <div className="flex items-center">
          <AdminDataViewScreenHeading className="flex-1">
            <Trans ns="admin:data">Sharing Settings</Trans>
          </AdminDataViewScreenHeading>
          {viewMode === "folders" && folderTreeDisplay.length > 0 && (
            <div className="mr-2 flex shrink-0 items-center gap-0.5">
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
          <div className="flex shrink-0 overflow-hidden rounded border border-gray-300 text-xs">
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
              className={`border-l border-gray-300 px-2 py-1.5 font-medium ${
                viewMode === "access"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setViewMode("access")}
            >
              <Trans ns="admin:data">Access</Trans>
            </button>
            <button
              type="button"
              className={`border-l border-gray-300 px-2 py-1.5 font-medium ${
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
      </div>
      <div className="flex-1 overflow-y-auto p-2 pb-4">
        {sharingTocQuery.loading && !sharingTocItems?.length && (
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
          <div className="overflow-hidden bg-white">
            {!sharingTocItems?.length && (
              <div className="p-4 text-center text-sm text-gray-500">
                <Trans ns="admin:data">No layers in this project yet.</Trans>
              </div>
            )}
            {!!sharingTocItems?.length && layerCount === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                <Trans ns="admin:data">
                  No data layers found to configure.
                </Trans>
              </div>
            )}
            {layerCount > 0 && !listEmpty && (
              <div>
                {viewMode === "alpha" ? (
                  filteredAlpha.map((m) => renderRow(m, 0))
                ) : viewMode === "folders" ? (
                  renderTreeNodes(folderTreeDisplay, 0)
                ) : (
                  <div>
                    {accessSections.map((section) => (
                      <div
                        key={section.key}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <div className="bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          {section.title}
                        </div>
                        <div className="bg-white">
                          {section.items.map((m) => renderRow(m, 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
