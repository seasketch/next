import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import getSlug from "../../getSlug";
import {
  DataSourceTypes,
  useProjectReportingLayersQuery,
  usePreprocessSourceMutation,
} from "../../generated/graphql";
import {
  OverlayLayerInfo,
  OverlayProcessingStatus,
  ProcessForReportingFooter,
} from "./widgets";
import { ProjectReportingLayersDocument } from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { isGeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";

/** Supported geometry/type filters for report source layers */
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

export type ReportSourceLayerDropdownProps = {
  value?: undefined;
  onChange: (value: ReportSourceLayerValue | undefined) => void;
  /** Stable IDs of layers already in use - these will be excluded from the list */
  excludeStableIds?: Set<string>;
  /** When set, only layers matching these geometry/types are shown. Omit to allow all. */
  allowedGeometryTypes?: ReportSourceGeometryType[];
  children: ReactNode;
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

/**
 * Extract the report source geometry type from geostats.
 * Returns the geometry string for vectors (Polygon, MultiPolygon, etc.) or
 * "SingleBandRaster" for single-band rasters. Returns null if type cannot be determined.
 */
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
  copiedFromDataLibraryTemplateId?: string | null;
};

function buildLayerList(
  draftItems: Array<{
    id: number;
    title: string;
    stableId: string;
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
    if (!item.stableId || excludeStableIds.has(item.stableId)) continue;
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

    result.push({
      id: item.id,
      stableId: item.stableId,
      title: item.title || t("Unknown layer"),
      isProcessed: processedTocIds.has(item.id),
      sourceId,
      copiedFromDataLibraryTemplateId: item.copiedFromDataLibraryTemplateId,
    });
  }
  return result.sort((a, b) => a.title.localeCompare(b.title));
}

export function ReportSourceLayerDropdown({
  onChange,
  excludeStableIds = new Set(),
  allowedGeometryTypes,
  children,
}: ReportSourceLayerDropdownProps) {
  const { t } = useTranslation("admin:reports");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusAfterProcessStableId, setFocusAfterProcessStableId] = useState<
    string | null
  >(null);

  const { data, loading, error } = useProjectReportingLayersQuery({
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
        const gt = getGeometryTypeFromGeostats(layer.geostats);
        map.set(tocId, gt);
      }
    }
    const draftItems =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    for (const item of draftItems) {
      if (map.has(item.id)) continue;
      const ds = item.dataLayer?.dataSource as
        | { id: number; type: string; geostats?: unknown }
        | undefined;
      const geostats = ds?.geostats;
      const gt = getGeometryTypeFromGeostats(geostats);
      map.set(item.id, gt);
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
    const items =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    return buildLayerList(
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

  const filteredLayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allLayers;
    return allLayers.filter((l) => l.title.toLowerCase().includes(term));
  }, [allLayers, search]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = useCallback(
    (layer: LayerItem) => {
      if (!layer.isProcessed) return;
      onChange({
        stableId: layer.stableId,
        tableOfContentsItemId: layer.id,
        title: layer.title,
      });
      setOpen(false);
    },
    [onChange]
  );

  const handleProcessForReporting = useCallback(
    async (layer: LayerItem) => {
      if (!layer.sourceId) return false;
      await preprocessSourceMutation({
        variables: {
          slug: getSlug(),
          sourceId: layer.sourceId,
        },
        refetchQueries: [
          {
            query: ProjectReportingLayersDocument,
            variables: { slug: getSlug() },
          },
        ],
        awaitRefetchQueries: true,
      });
      setFocusAfterProcessStableId(layer.stableId);
      return true;
    },
    [preprocessSourceMutation]
  );

  const processFooterDescription = t(
    "This layer needs to be preprocessed before use in reports."
  );

  if (loading) {
    return (
      <div className="h-8 rounded border border-gray-300 px-2 flex items-center gap-2 text-gray-500 text-sm">
        <Spinner mini />
        {t("Loading…")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-8 rounded border border-red-200 px-2 flex items-center text-red-700 text-sm">
        {error.message}
      </div>
    );
  }

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFocusAfterProcessStableId(null);
      }}
      modal={false}
    >
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-50 w-72 p-1 outline-none"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target?.closest?.("[data-report-source-layer-dropdown]")) {
              e.preventDefault();
            }
          }}
          data-report-source-layer-dropdown="true"
        >
          <div
            className="px-2 pb-2 pt-1"
            data-report-source-layer-search
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search layers…")}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filteredLayers.length === 0 ? (
              <div className="text-xs text-gray-500 px-2.5 py-2 rounded-md bg-gray-50 mx-1">
                {t("No layers found")}
              </div>
            ) : (
              filteredLayers.map((layer) =>
                layer.isProcessed ? (
                  <ProcessedLayerSubmenu
                    key={layer.stableId}
                    layer={layer}
                    onSelect={handleSelect}
                    forceOpen={layer.stableId === focusAfterProcessStableId}
                    onForceOpenChange={(open) => {
                      if (!open) setFocusAfterProcessStableId(null);
                    }}
                  />
                ) : (
                  <LayerSubmenu
                    key={layer.stableId}
                    layer={layer}
                    onProcessForReporting={handleProcessForReporting}
                    processFooterDescription={processFooterDescription}
                  />
                )
              )
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ProcessedLayerSubmenu({
  layer,
  onSelect,
  forceOpen,
  onForceOpenChange,
}: {
  layer: LayerItem;
  onSelect: (layer: LayerItem) => void;
  forceOpen?: boolean;
  onForceOpenChange?: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!forceOpen) return;
    const el = document.querySelector(
      // eslint-disable-next-line i18next/no-literal-string
      `[data-report-source-layer-trigger="${layer.stableId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.focus?.();
      el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [forceOpen, layer.stableId]);

  return (
    <DropdownMenu.Sub
      {...(forceOpen && {
        open: true,
        onOpenChange: onForceOpenChange,
      })}
    >
      <DropdownMenu.SubTrigger
        data-report-source-layer-trigger={layer.stableId}
        className="w-full text-left px-2.5 py-1.5 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900 hover:bg-gray-50 text-gray-900"
        textValue={layer.title}
        onPointerDown={(e) => {
          e.preventDefault();
          onSelect(layer);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(layer);
          }
        }}
      >
        <span className="truncate block">{layer.title}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={4}
          alignOffset={-4}
          className="z-[60] outline-none rounded-md border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[16rem]"
          data-report-source-layer-dropdown="true"
        >
          <div className="w-64">
            <div className="px-3 py-2.5">
              <div className="text-sm font-semibold text-gray-800">
                {layer.title}
              </div>
              <OverlayLayerInfo tableOfContentsItemId={layer.id} />
              <OverlayProcessingStatus tableOfContentsItemId={layer.id} />
            </div>
          </div>
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function LayerSubmenu({
  layer,
  onProcessForReporting,
  processFooterDescription,
}: {
  layer: LayerItem;
  onProcessForReporting: (layer: LayerItem) => Promise<boolean>;
  processFooterDescription: string;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        className="w-full text-left px-2.5 py-1.5 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 hover:bg-gray-50 text-gray-600 opacity-90 flex items-center gap-1"
        textValue={layer.title}
      >
        <span className="truncate flex-1">{layer.title}</span>
        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={4}
          alignOffset={-4}
          className="z-[60] outline-none rounded-md border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[16rem]"
          data-report-source-layer-dropdown="true"
        >
          <div className="w-64">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-800">
                {layer.title}
              </div>
              <OverlayLayerInfo tableOfContentsItemId={layer.id} />
            </div>
            <ProcessForReportingFooter
              onProcess={() => onProcessForReporting(layer)}
              description={processFooterDescription}
            />
          </div>
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
