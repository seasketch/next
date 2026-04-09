import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Tooltip from "@radix-ui/react-tooltip";
import getSlug from "../../getSlug";
import {
  DataSourceTypes,
  SpatialMetricState,
  useProjectReportingLayersQuery,
  usePreprocessSourceMutation,
  ProjectReportingLayersDocument,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import {
  MagnifyingGlassIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoCircledIcon,
  CheckCircledIcon,
} from "@radix-ui/react-icons";
import { isGeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";

export type ReportSourceGeometryType =
  | "Polygon"
  | "MultiPolygon"
  | "LineString"
  | "MultiLineString"
  | "Point"
  | "MultiPoint"
  | "SingleBandRaster";

export type ReportSourceLayerValue = {
  stableId: string;
  tableOfContentsItemId?: number;
  title: string;
};

export type ReportLayerMultiPickerProps = {
  onAdd: (layers: ReportSourceLayerValue[]) => void;
  excludeStableIds?: Set<string>;
  allowedGeometryTypes?: ReportSourceGeometryType[];
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

const ELIGIBLE_TYPES = new Set([
  DataSourceTypes.SeasketchMvt,
  DataSourceTypes.SeasketchRaster,
  DataSourceTypes.SeasketchVector,
]);

const VECTOR_GEOMETRIES: ReportSourceGeometryType[] = [
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
  "Point",
  "MultiPoint",
];

function getGeometryTypeFromGeostats(
  geostats: unknown
): ReportSourceGeometryType | null {
  if (!geostats || typeof geostats !== "object") return null;
  const g = geostats as Record<string, unknown>;
  if (isRasterInfo(g)) {
    const bands = (g as { bands?: unknown[] }).bands;
    return bands?.length === 1 ? "SingleBandRaster" : null;
  }
  const layers = g.layers as Array<{ geometry?: string }> | undefined;
  const first = layers?.[0];
  if (!first) {
    if (isGeostatsLayer(g)) {
      const geom = (g as { geometry?: string }).geometry;
      if (
        geom &&
        VECTOR_GEOMETRIES.includes(geom as ReportSourceGeometryType)
      ) {
        return geom as ReportSourceGeometryType;
      }
    }
    return null;
  }
  if (isGeostatsLayer(first)) {
    const geom = (first as { geometry?: string }).geometry;
    if (geom && VECTOR_GEOMETRIES.includes(geom as ReportSourceGeometryType)) {
      return geom as ReportSourceGeometryType;
    }
  }
  return null;
}

type LayerItem = {
  id: number;
  stableId: string;
  title: string;
  isProcessed: boolean;
  sourceId?: number;
  disabledReason?: string;
};

type TocItem = {
  id: number;
  title: string;
  stableId: string;
  isFolder: boolean;
  parentStableId: string | null;
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
  layer: LayerItem;
  sortIndex: number;
};

type TreeNode = FolderNode | LayerNode;

function buildLayerItems(
  draftItems: Array<{
    id: number;
    title: string;
    stableId: string;
    isFolder: boolean;
    copiedFromDataLibraryTemplateId?: string | null;
    dataLayer?: {
      dataSource?: {
        id: number;
        type: string;
        geostats?: unknown;
      } | null;
    } | null;
  }>,
  processedTocIds: Set<number>,
  excludeStableIds: Set<string>,
  geometryTypeByTocId: Map<number, ReportSourceGeometryType | null>,
  allowedGeometryTypes: Set<ReportSourceGeometryType> | null,
  t: (k: string) => string
): LayerItem[] {
  const result: LayerItem[] = [];
  for (const item of draftItems) {
    if (!item.stableId || item.isFolder) continue;
    if (item.copiedFromDataLibraryTemplateId) {
      if (/MARINE_REGIONS/.test(item.copiedFromDataLibraryTemplateId)) continue;
      if (/DAYLIGHT/.test(item.copiedFromDataLibraryTemplateId)) continue;
    }
    const dsType = item.dataLayer?.dataSource?.type as
      | DataSourceTypes
      | undefined;
    const sourceId = item.dataLayer?.dataSource?.id;
    if (!dsType || !sourceId || !ELIGIBLE_TYPES.has(dsType)) continue;

    const geometryType = geometryTypeByTocId.get(item.id) ?? null;

    if (
      allowedGeometryTypes &&
      (!geometryType || !allowedGeometryTypes.has(geometryType))
    ) {
      continue;
    }

    let disabledReason: string | undefined;
    if (excludeStableIds.has(item.stableId)) {
      disabledReason = t("This layer has already been added as a source.");
    }

    result.push({
      id: item.id,
      stableId: item.stableId,
      title: item.title || t("Unknown layer"),
      isProcessed: processedTocIds.has(item.id),
      sourceId,
      disabledReason,
    });
  }
  return result;
}

function buildFolderTree(
  tocItems: TocItem[],
  layersByStableId: Map<string, LayerItem>,
  layerSortIndex: Map<string, number>
): TreeNode[] {
  const itemMap = new Map<string, TocItem>();
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
          layer: layersByStableId.get(item.stableId)!,
          sortIndex: layerSortIndex.get(item.stableId) ?? item.sortIndex,
        });
      }
    }

    children.sort((a, b) => a.sortIndex - b.sortIndex);
    return children;
  }

  return buildChildren(null);
}

export function ReportLayerMultiPicker({
  onAdd,
  excludeStableIds = new Set(),
  allowedGeometryTypes,
  children,
  side = "bottom",
  align = "end",
  sideOffset = 6,
}: ReportLayerMultiPickerProps) {
  const { t } = useTranslation("admin:reports");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewModeState] = useState<"alpha" | "folders">(() => {
    try {
      const stored = localStorage.getItem("seasketch:layerPickerViewMode");
      if (stored === "alpha" || stored === "folders") return stored;
    } catch {}
    return "alpha";
  });
  const setViewMode = useCallback((mode: "alpha" | "folders") => {
    setViewModeState(mode);
    try {
      localStorage.setItem("seasketch:layerPickerViewMode", mode);
    } catch {}
  }, []);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const { data, loading } = useProjectReportingLayersQuery({
    variables: { slug: getSlug() },
  });
  const [preprocessSourceMutation] = usePreprocessSourceMutation();

  const processedTocIds = useMemo(() => {
    const layers = data?.projectBySlug?.reportingLayers || [];
    return new Set(layers.map((r) => r.tableOfContentsItemId).filter(Boolean));
  }, [data?.projectBySlug?.reportingLayers]);

  const geometryTypeByTocId = useMemo(() => {
    const map = new Map<number, ReportSourceGeometryType | null>();
    const reportingLayers = data?.projectBySlug?.reportingLayers || [];
    for (const layer of reportingLayers) {
      const tocId = layer.tableOfContentsItemId;
      if (tocId != null) {
        map.set(
          tocId,
          layer.vectorGeometryType as ReportSourceGeometryType | null
        );
      }
    }
    const draftItems =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    for (const item of draftItems) {
      if (map.has(item.id)) continue;
      const ds = item.dataLayer?.dataSource;
      map.set(
        item.id,
        ds?.vectorGeometryType as ReportSourceGeometryType | null
      );
    }
    return map;
  }, [
    data?.projectBySlug?.reportingLayers,
    data?.projectBySlug?.draftTableOfContentsItems,
  ]);

  const allowedSet = useMemo(
    () => (allowedGeometryTypes?.length ? new Set(allowedGeometryTypes) : null),
    [allowedGeometryTypes]
  );

  const allLayers = useMemo(() => {
    const items = (data?.projectBySlug?.draftTableOfContentsItems?.filter(
      (i): i is NonNullable<typeof i> => !!i?.stableId
    ) || []) as Array<{
      id: number;
      title: string;
      stableId: string;
      isFolder: boolean;
      copiedFromDataLibraryTemplateId?: string | null;
      dataLayer?: {
        dataSource?: {
          id: number;
          type: string;
          geostats?: unknown;
        } | null;
      } | null;
    }>;
    return buildLayerItems(
      items,
      processedTocIds,
      excludeStableIds,
      geometryTypeByTocId,
      allowedSet,
      t
    );
  }, [
    data?.projectBySlug?.draftTableOfContentsItems,
    processedTocIds,
    excludeStableIds,
    geometryTypeByTocId,
    allowedSet,
    t,
  ]);

  const layersByStableId = useMemo(() => {
    const map = new Map<string, LayerItem>();
    for (const layer of allLayers) {
      map.set(layer.stableId, layer);
    }
    return map;
  }, [allLayers]);

  const tocItems = useMemo((): TocItem[] => {
    const items = (data?.projectBySlug?.draftTableOfContentsItems ||
      []) as Array<{
      id: number;
      title: string;
      stableId: string;
      isFolder: boolean;
      parentStableId?: string | null;
      sortIndex?: number | null;
    }>;
    return items
      .filter((i) => !!i?.stableId)
      .map((i) => ({
        id: i.id,
        title: i.title,
        stableId: i.stableId,
        isFolder: i.isFolder,
        parentStableId: i.parentStableId ?? null,
        sortIndex: i.sortIndex ?? 0,
      }));
  }, [data?.projectBySlug?.draftTableOfContentsItems]);

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

  const alphabeticalLayers = useMemo(
    () => [...allLayers].sort((a, b) => a.title.localeCompare(b.title)),
    [allLayers]
  );

  const searchTerm = search.trim().toLowerCase();
  const filteredAlphabetical = useMemo(() => {
    if (!searchTerm) return alphabeticalLayers;
    return alphabeticalLayers.filter((l) =>
      l.title.toLowerCase().includes(searchTerm)
    );
  }, [alphabeticalLayers, searchTerm]);

  function filterTree(nodes: TreeNode[]): TreeNode[] {
    if (!searchTerm) return nodes;
    const filtered: TreeNode[] = [];
    for (const node of nodes) {
      if (node.kind === "layer") {
        if (node.layer.title.toLowerCase().includes(searchTerm)) {
          filtered.push(node);
        }
      } else {
        const children = filterTree(node.children);
        if (children.length > 0) {
          filtered.push({ ...node, children });
        }
      }
    }
    return filtered;
  }

  const filteredTree = useMemo(
    () => filterTree(folderTree),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folderTree, searchTerm]
  );

  const reset = useCallback(() => {
    setSelected(new Set());
    setSearch("");
    setError(null);
    setProcessing(false);
    setProcessingLabel("");
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const toggleSelection = useCallback(
    (stableId: string) => {
      const layer = layersByStableId.get(stableId);
      if (!layer || layer.disabledReason) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(stableId)) {
          next.delete(stableId);
        } else {
          next.add(stableId);
        }
        return next;
      });
    },
    [layersByStableId]
  );

  const handleAdd = useCallback(async () => {
    const selectedLayers = allLayers.filter(
      (l) => selected.has(l.stableId) && !l.disabledReason
    );
    if (selectedLayers.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const unprocessed = selectedLayers.filter((l) => !l.isProcessed);
      for (let i = 0; i < unprocessed.length; i++) {
        const layer = unprocessed[i];
        setProcessingLabel(
          t("Processing {{name}}… ({{current}}/{{total}})", {
            name: layer.title,
            current: i + 1,
            total: unprocessed.length,
          })
        );
        if (!layer.sourceId) continue;
        const isLastLayer = i === unprocessed.length - 1;
        await preprocessSourceMutation({
          variables: { slug: getSlug(), sourceId: layer.sourceId },
          refetchQueries: isLastLayer
            ? [
                {
                  query: ProjectReportingLayersDocument,
                  variables: { slug: getSlug() },
                },
              ]
            : [],
          awaitRefetchQueries: isLastLayer,
        });
      }

      onAdd(
        selectedLayers.map((l) => ({
          stableId: l.stableId,
          tableOfContentsItemId: l.id,
          title: l.title,
        }))
      );
      reset();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("An unexpected error occurred")
      );
      setProcessing(false);
      setProcessingLabel("");
    }
  }, [allLayers, selected, t, preprocessSourceMutation, onAdd, reset]);

  const handleCancel = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

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

  const selectedCount = selected.size;

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{children}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className="bg-white rounded-lg shadow-xl border border-gray-200 w-96 flex flex-col z-50 outline-none"
            data-report-layer-multi-picker="true"
          >
            <Tooltip.Provider delayDuration={300}>
              {/* Header */}
              <div className="px-3 pt-3 pb-2 flex-none">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("Search layers…")}
                      className="w-full rounded border border-gray-300 pl-7 pr-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                    />
                  </div>
                  <div className="flex rounded border border-gray-300 overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                        viewMode === "alpha"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                      onClick={() => setViewMode("alpha")}
                      title={t("Alphabetical list")}
                    >
                      {t("A–Z")}
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1.5 text-xs font-medium border-l border-gray-300 transition-colors ${
                        viewMode === "folders"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                      onClick={() => setViewMode("folders")}
                      title={t("Folder view")}
                    >
                      {t("Folders")}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {allowedGeometryTypes && allowedGeometryTypes.length > 0
                    ? t(
                        "Select layers to add. Incompatible sources are not displayed."
                      )
                    : t("Select layers to add.")}
                </p>
              </div>

              {/* Layer list */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain border-t border-gray-100"
                style={{ maxHeight: 320 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
                    <Spinner mini />
                    {t("Loading layers…")}
                  </div>
                ) : viewMode === "alpha" ? (
                  <AlphabeticalList
                    layers={filteredAlphabetical}
                    selected={selected}
                    onToggle={toggleSelection}
                    t={t}
                  />
                ) : (
                  <FolderTreeView
                    tree={filteredTree}
                    selected={selected}
                    onToggle={toggleSelection}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    searchActive={!!searchTerm}
                    t={t}
                  />
                )}
                {!loading && allLayers.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-gray-500">
                    {t("No eligible layers found in this project.")}
                  </div>
                )}
                {!loading &&
                  allLayers.length > 0 &&
                  ((viewMode === "alpha" &&
                    filteredAlphabetical.length === 0) ||
                    (viewMode === "folders" && filteredTree.length === 0)) && (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">
                      {t("No layers match your search.")}
                    </div>
                  )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-none">
                {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                {processing && processingLabel && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                    <Spinner mini />
                    <span>{processingLabel}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      onClick={handleCancel}
                      disabled={processing}
                    >
                      {t("Cancel")}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 flex items-center gap-1.5"
                      disabled={selectedCount === 0 || processing}
                      onClick={handleAdd}
                    >
                      {processing ? (
                        <>
                          <Spinner mini color="white" />
                          {t("Adding…")}
                        </>
                      ) : selectedCount > 0 ? (
                        t("Add {{count}} layer(s)", { count: selectedCount })
                      ) : (
                        t("Add")
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </Tooltip.Provider>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

function LayerRow({
  layer,
  isSelected,
  onToggle,
  indent,
  t,
}: {
  layer: LayerItem;
  isSelected: boolean;
  onToggle: (stableId: string) => void;
  indent?: number;
  t: (k: string) => string;
}) {
  const disabled = !!layer.disabledReason;

  const row = (
    <label
      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : isSelected
          ? "bg-blue-50/60 cursor-pointer"
          : "hover:bg-gray-50 cursor-pointer"
      }`}
      style={indent ? { paddingLeft: `${indent * 20 + 12}px` } : undefined}
    >
      <Checkbox.Root
        checked={isSelected}
        disabled={disabled}
        onCheckedChange={() => onToggle(layer.stableId)}
        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          disabled
            ? "border-gray-300 bg-gray-100"
            : isSelected
            ? "border-blue-600 bg-blue-600"
            : "border-gray-400 bg-white hover:border-gray-500"
        }`}
      >
        <Checkbox.Indicator>
          <CheckIcon className="w-3 h-3 text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span
        className={`flex-1 min-w-0 truncate ${
          disabled ? "text-gray-500" : "text-gray-900"
        }`}
      >
        {layer.title}
      </span>
      {!disabled && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <InfoCircledIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={6}
              className="bg-white text-gray-900 border border-gray-200 px-3 py-2.5 rounded-lg shadow-lg z-[80] max-w-[260px]"
              onClick={(e) => e.stopPropagation()}
            >
              <LayerDetailTooltip tableOfContentsItemId={layer.id} />
              <Tooltip.Arrow className="fill-white" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      )}
    </label>
  );

  if (disabled && layer.disabledReason) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{row}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            className="bg-gray-900 text-white text-xs px-2 py-1.5 rounded shadow-lg z-[80] max-w-[220px] leading-snug"
          >
            {layer.disabledReason}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return row;
}

function AlphabeticalList({
  layers,
  selected,
  onToggle,
  t,
}: {
  layers: LayerItem[];
  selected: Set<string>;
  onToggle: (stableId: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="divide-y divide-gray-50">
      {layers.map((layer) => (
        <LayerRow
          key={layer.stableId}
          layer={layer}
          isSelected={selected.has(layer.stableId)}
          onToggle={onToggle}
          t={t}
        />
      ))}
    </div>
  );
}

function FolderTreeView({
  tree,
  selected,
  onToggle,
  expandedFolders,
  onToggleFolder,
  searchActive,
  t,
}: {
  tree: TreeNode[];
  selected: Set<string>;
  onToggle: (stableId: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (stableId: string) => void;
  searchActive: boolean;
  t: (k: string) => string;
}) {
  return (
    <div>
      {tree.map((node) =>
        node.kind === "folder" ? (
          <FolderAccordion
            key={node.stableId}
            folder={node}
            selected={selected}
            onToggle={onToggle}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            searchActive={searchActive}
            depth={0}
            t={t}
          />
        ) : (
          <LayerRow
            key={node.layer.stableId}
            layer={node.layer}
            isSelected={selected.has(node.layer.stableId)}
            onToggle={onToggle}
            t={t}
          />
        )
      )}
    </div>
  );
}

function FolderAccordion({
  folder,
  selected,
  onToggle,
  expandedFolders,
  onToggleFolder,
  searchActive,
  depth,
  t,
}: {
  folder: FolderNode;
  selected: Set<string>;
  onToggle: (stableId: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (stableId: string) => void;
  searchActive: boolean;
  depth: number;
  t: (k: string) => string;
}) {
  const isOpen = searchActive || expandedFolders.has(folder.stableId);
  const layerCount = countLayers(folder);

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        style={depth > 0 ? { paddingLeft: `${depth * 20 + 12}px` } : undefined}
        onClick={() => onToggleFolder(folder.stableId)}
      >
        {isOpen ? (
          <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
        <span className="truncate flex-1 min-w-0 text-left">
          {folder.title}
        </span>
        <span className="text-[10px] text-gray-400 flex-shrink-0">
          {layerCount}
        </span>
      </button>
      {isOpen && (
        <div>
          {folder.children.map((child) =>
            child.kind === "folder" ? (
              <FolderAccordion
                key={child.stableId}
                folder={child}
                selected={selected}
                onToggle={onToggle}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                searchActive={searchActive}
                depth={depth + 1}
                t={t}
              />
            ) : (
              <LayerRow
                key={child.layer.stableId}
                layer={child.layer}
                isSelected={selected.has(child.layer.stableId)}
                onToggle={onToggle}
                indent={depth + 1}
                t={t}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function countLayers(node: FolderNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.kind === "layer") {
      count++;
    } else {
      count += countLayers(child);
    }
  }
  return count;
}

function LayerDetailTooltip({
  tableOfContentsItemId,
}: {
  tableOfContentsItemId: number;
}) {
  const { data } = useProjectReportingLayersQuery({
    variables: { slug: getSlug() },
    fetchPolicy: "cache-only",
  });

  const info = useMemo(() => {
    const item = data?.projectBySlug?.draftTableOfContentsItems?.find(
      (i) => i.id === tableOfContentsItemId
    );
    const overlaySource = data?.projectBySlug?.reportingLayers?.find(
      (r) => r.tableOfContentsItemId === tableOfContentsItemId
    );
    const dataLayer = item?.dataLayer;
    const ds = dataLayer?.dataSource;
    const job = overlaySource?.sourceProcessingJob;
    return {
      title: item?.title,
      profile: ds?.authorProfile,
      createdAt: ds?.createdAt ? new Date(ds.createdAt) : null,
      version: dataLayer?.version ?? null,
      attribution: ds?.attribution,
      processingState: (job?.state as SpatialMetricState | undefined) ?? null,
      processingError: job?.errorMessage,
    };
  }, [data, tableOfContentsItemId]);

  const isProcessed = info.processingState === SpatialMetricState.Complete;
  const isActive =
    info.processingState === SpatialMetricState.Processing ||
    info.processingState === SpatialMetricState.Queued;
  const isError = info.processingState === SpatialMetricState.Error;
  const isUnprocessed = !info.processingState;

  return (
    <div className="space-y-2 min-w-[180px]">
      {info.profile && (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
            <ProfilePhoto
              fullname={info.profile.fullname || undefined}
              email={info.profile.email || undefined}
              canonicalEmail={info.profile.email || ""}
              picture={info.profile.picture || undefined}
            />
          </div>
          <div className="min-w-0">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <div className="text-xs font-medium text-gray-900 truncate">
              {info.profile.fullname || info.profile.email || "Unknown"}
            </div>
            {info.attribution && (
              <div className="text-[10px] text-gray-500 truncate">
                {info.attribution}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {info.createdAt && (
          <>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="text-gray-400 font-medium">Updated</span>
            <span className="text-gray-700">
              {info.createdAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </>
        )}

        {info.version != null && (
          <>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="text-gray-400 font-medium">Version</span>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="text-gray-700">{info.version}</span>
          </>
        )}

        <>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="text-gray-400 font-medium">Status</span>
          <span className="flex items-center gap-1">
            {isProcessed && (
              <>
                <CheckCircledIcon className="w-3 h-3 text-green-600" />
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="text-green-700">Processed</span>
              </>
            )}
            {isActive && (
              <>
                <Spinner mini />
                <span className="text-gray-600">
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {info.processingState === SpatialMetricState.Queued
                    ? "Queued"
                    : "Processing…"}
                </span>
              </>
            )}
            {isError && (
              /* eslint-disable-next-line i18next/no-literal-string */
              <span className="text-red-600">
                {info.processingError || "Processing failed"}
              </span>
            )}
            {isUnprocessed && (
              /* eslint-disable-next-line i18next/no-literal-string */
              <span className="text-amber-600">Not yet processed</span>
            )}
          </span>
        </>
      </div>
    </div>
  );
}
