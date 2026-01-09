import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
import { useReportContext } from "../ReportContext";
import getSlug from "../../getSlug";
import { useOverlaysForReportLayerTogglesQuery } from "../../generated/graphql";

export type LayerPickerValue = {
  stableId: string;
  tableOfContentsItemId?: number;
  title: string;
};

export type LayerPickerDropdownProps = {
  value?: string; // stableId
  onChange: (value: LayerPickerValue | undefined) => void;
  required?: boolean;
  onlyReportingLayers?: boolean;
  hideSearch?: boolean;
  popoverSide?: "top" | "bottom" | "left" | "right";
  popoverSideOffset?: number;
  children: ReactNode;
};

export function LayerPickerDropdown({
  value,
  onChange,
  required = false,
  onlyReportingLayers = false,
  hideSearch = false,
  popoverSide = "top",
  popoverSideOffset = 6,
  children,
}: LayerPickerDropdownProps) {
  const { t } = useTranslation("admin:reports");
  const reportContext = useReportContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const overlayOptions = useOverlayOptionsForLayerToggle(t);
  const { data, loading, error } = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

  useEffect(() => {
    if (open && !hideSearch) {
      inputRef.current?.focus();
    }
  }, [open, hideSearch]);

  // Build a map of stableId -> { tableOfContentsItemId, title, hasReportingOutput }
  const layerInfoMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tableOfContentsItemId?: number;
        title: string;
        hasReportingOutput: boolean;
      }
    >();

    // First, add items from the query
    const items =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    for (const item of items) {
      if (!item.stableId) continue;
      map.set(item.stableId, {
        tableOfContentsItemId:
          typeof item.id === "number" ? item.id : undefined,
        title: item.title || t("Unknown layer"),
        hasReportingOutput: !!item.reportingOutput,
      });
    }

    // Fallback to reportContext sources if query didn't return anything
    if (map.size === 0) {
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      for (const s of allSources) {
        const sid = s.tableOfContentsItem?.stableId;
        if (!sid || map.has(sid)) continue;
        const tocId = s.tableOfContentsItemId;
        map.set(sid, {
          tableOfContentsItemId: typeof tocId === "number" ? tocId : undefined,
          title: s.tableOfContentsItem?.title || t("Unknown layer"),
          hasReportingOutput: false, // We don't have this info from sources
        });
      }
    }

    return map;
  }, [
    data?.projectBySlug?.draftTableOfContentsItems,
    reportContext.overlaySources,
    reportContext.adminSources,
    t,
  ]);

  // Separate into reporting layers and all layers, alphabetized
  const { reportingLayers, allLayers } = useMemo(() => {
    const reporting: Array<{
      stableId: string;
      title: string;
      tableOfContentsItemId?: number;
    }> = [];
    const all: Array<{
      stableId: string;
      title: string;
      tableOfContentsItemId?: number;
    }> = [];

    for (const option of overlayOptions) {
      const info = layerInfoMap.get(option.value);
      if (!info) continue;

      const layer = {
        stableId: option.value,
        title: info.title,
        tableOfContentsItemId: info.tableOfContentsItemId,
      };

      if (info.hasReportingOutput) {
        reporting.push(layer);
      }
      all.push(layer);
    }

    // Alphabetize each list
    reporting.sort((a, b) => a.title.localeCompare(b.title));
    all.sort((a, b) => a.title.localeCompare(b.title));

    return { reportingLayers: reporting, allLayers: all };
  }, [overlayOptions, layerInfoMap]);

  const filterItems = (
    items: typeof reportingLayers
  ): typeof reportingLayers => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.title.toLowerCase().includes(term));
  };

  const filteredReporting = filterItems(reportingLayers);
  const filteredAll = onlyReportingLayers
    ? []
    : filterItems(
        allLayers.filter(
          (l) => !reportingLayers.some((r) => r.stableId === l.stableId)
        )
      );

  const handleSelect = (stableId: string | undefined) => {
    if (!stableId) {
      onChange(undefined);
      setOpen(false);
      return;
    }

    const info = layerInfoMap.get(stableId);
    if (!info) {
      onChange(undefined);
      setOpen(false);
      return;
    }

    onChange({
      stableId,
      tableOfContentsItemId: info.tableOfContentsItemId,
      title: info.title,
    });
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={loading || !!error}>
        {children}
      </Popover.Trigger>
      <Popover.Content
        side={popoverSide}
        sideOffset={popoverSideOffset}
        className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl z-50 w-60 p-1"
      >
        {!hideSearch && (
          <div className="px-2 pb-2 pt-1">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search layers…")}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        <div className="max-h-64 overflow-auto space-y-1.5 pb-1">
          {!required && (
            <button
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 focus:bg-gray-50 rounded-md transition-colors truncate"
              onClick={() => handleSelect(undefined)}
              title={t("None")}
            >
              {t("None")}
            </button>
          )}
          {filteredReporting.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-gray-700 bg-gray-100 sticky top-0 z-10  border-b border-gray-50">
                {t("Reporting Layers")}
              </div>
              <div className="space-y-1">
                {filteredReporting.map((layer) => (
                  <button
                    key={layer.stableId}
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 focus:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
                    onClick={() => handleSelect(layer.stableId)}
                    title={layer.title}
                  >
                    <span className="truncate">{layer.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!onlyReportingLayers && filteredAll.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-gray-700 sticky top-0 z-10 bg-gray-100 border-b border-gray-50">
                {t("All Layers")}
              </div>
              <div className="space-y-1">
                {filteredAll.map((layer) => (
                  <button
                    key={layer.stableId}
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 focus:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
                    onClick={() => handleSelect(layer.stableId)}
                    title={layer.title}
                  >
                    <span className="truncate">{layer.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {filteredReporting.length === 0 &&
            filteredAll.length === 0 &&
            (!required || value) && (
              <div className="text-xs text-gray-500 px-2.5 py-2 rounded-md bg-gray-50">
                {t("No layers found")}
              </div>
            )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
