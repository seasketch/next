import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { useOverlayOptionsForLayerToggle } from "./LayerToggleControls";
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
  optionsOverride?: LayerPickerOption[];
  /** And array of stableIds to suggest */
  suggested?: string[];
  title?: string;
  description?: string;
};

type LayerPickerOption = {
  stableId: string;
  title: string;
  tableOfContentsItemId?: number;
  reporting?: boolean;
};

type LayerLists = {
  reportingLayers: LayerPickerOption[];
  allLayers: LayerPickerOption[];
};

function buildLayerLists(options: LayerPickerOption[]): LayerLists {
  const reporting: LayerPickerOption[] = [];
  const all: LayerPickerOption[] = [];

  for (const opt of options) {
    if (opt.reporting) {
      reporting.push(opt);
    }
    all.push(opt);
  }

  reporting.sort((a, b) => a.title.localeCompare(b.title));
  all.sort((a, b) => a.title.localeCompare(b.title));

  return { reportingLayers: reporting, allLayers: all };
}

type LayerPickerBaseProps = {
  required?: boolean;
  onlyReportingLayers?: boolean;
  hideSearch?: boolean;
  optionsOverride?: LayerPickerOption[];
  className?: string;
  onSelect: (value: LayerPickerValue | undefined) => void;
  autoFocusSearch?: boolean;
};

function useLayerPickerData({
  t,
  optionsOverride,
}: {
  t: (k: string) => string;
  optionsOverride?: LayerPickerOption[];
}) {
  const overlayOptions = useOverlayOptionsForLayerToggle(t);
  const { data, loading, error } = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

  const lists = useMemo(() => {
    if (optionsOverride && optionsOverride.length) {
      return buildLayerLists(optionsOverride);
    }

    const map = new Map<
      string,
      {
        tableOfContentsItemId?: number;
        title: string;
        hasReportingOutput: boolean;
      }
    >();

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

    // if (map.size === 0) {
    //   const allSources = [
    //     ...(reportContext.overlaySources || []),
    //     ...(reportContext.preprocessedOverlaySources || []),
    //   ];
    //   for (const s of allSources) {
    //     const sid = s.tableOfContentsItem?.stableId;
    //     if (!sid || map.has(sid)) continue;
    //     const tocId = s.tableOfContentsItemId;
    //     map.set(sid, {
    //       tableOfContentsItemId: typeof tocId === "number" ? tocId : undefined,
    //       title: s.tableOfContentsItem?.title || t("Unknown layer"),
    //       hasReportingOutput: false, // We don't have this info from sources
    //     });
    //   }
    // }

    const options: LayerPickerOption[] = [];
    for (const opt of overlayOptions) {
      const info = map.get(opt.value);
      if (!info) continue;
      options.push({
        stableId: opt.value,
        title: info.title,
        tableOfContentsItemId: info.tableOfContentsItemId,
        reporting: info.hasReportingOutput,
      });
    }

    return buildLayerLists(options);
  }, [
    optionsOverride,
    data?.projectBySlug?.draftTableOfContentsItems,
    // reportContext.overlaySources,
    // reportContext.preprocessedOverlaySources,
    overlayOptions,
    t,
  ]);

  return { ...lists, loading, error };
}

export function LayerPickerList({
  required = false,
  onlyReportingLayers = false,
  hideSearch = false,
  onSelect,
  className,
  optionsOverride,
  autoFocusSearch = true,
}: LayerPickerBaseProps) {
  const { t } = useTranslation("admin:reports");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");

  const { reportingLayers, allLayers, loading, error } = useLayerPickerData({
    t,
    optionsOverride,
  });

  useEffect(() => {
    if (autoFocusSearch && !hideSearch) {
      inputRef.current?.focus();
    }
  }, [autoFocusSearch, hideSearch]);

  const filterItems = useMemo(
    () =>
      (items: LayerPickerOption[]): LayerPickerOption[] => {
        const term = search.trim().toLowerCase();
        if (!term) return items;
        return items.filter((i) => i.title.toLowerCase().includes(term));
      },
    [search]
  );

  const filteredReporting = filterItems(reportingLayers);
  const filteredAll = onlyReportingLayers
    ? []
    : filterItems(
        allLayers.filter(
          (l) => !reportingLayers.some((r) => r.stableId === l.stableId)
        )
      );

  const handleSelect = (
    layer?: LayerPickerOption,
    event?: React.MouseEvent | React.PointerEvent
  ) => {
    if (!layer) {
      onSelect(undefined);
      return;
    }
    onSelect({
      stableId: layer.stableId,
      tableOfContentsItemId: layer.tableOfContentsItemId,
      title: layer.title,
    });
  };

  if (loading) {
    return (
      <div
        className={`rounded-md border border-gray-200 bg-white shadow-sm text-sm text-gray-600 px-3 py-3 ${
          className || ""
        }`}
      >
        {t("Loading…")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-md border border-red-200 bg-white shadow-sm text-sm text-red-700 px-3 py-3 ${
          className || ""
        }`}
      >
        {error.message}
      </div>
    );
  }

  return (
    <div
      data-popover-content="true"
      className={`bg-white text-gray-900 border border-gray-200 rounded-lg shadow-sm w-60 p-1 ${
        className || ""
      }`}
      onMouseDown={(e) => {
        // Prevent popover from closing when clicking inside
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Prevent popover from closing when clicking inside
        e.stopPropagation();
      }}
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
            onPointerDown={(e) => handleSelect(undefined, e)}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
                  onPointerDown={(e) => handleSelect(layer, e)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
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
                  onPointerDown={(e) => handleSelect(layer, e)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
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
          (!required || optionsOverride?.length === 0) && (
            <div className="text-xs text-gray-500 px-2.5 py-2 rounded-md bg-gray-50">
              {t("No layers found")}
            </div>
          )}
      </div>
    </div>
  );
}

export function LayerPickerDropdown({
  value,
  onChange,
  required = false,
  onlyReportingLayers = false,
  hideSearch = false,
  popoverSide = "top",
  popoverSideOffset = 6,
  children,
  optionsOverride,
  suggested,
  title,
  description,
}: LayerPickerDropdownProps) {
  const { t } = useTranslation("admin:reports");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const { reportingLayers, allLayers, loading, error } = useLayerPickerData({
    t,
    optionsOverride,
  });

  useEffect(() => {
    if (open && !hideSearch) {
      inputRef.current?.focus();
    }
  }, [open, hideSearch]);

  const filterItems = useCallback(
    (items: LayerPickerOption[]): LayerPickerOption[] => {
      const term = search.trim().toLowerCase();
      if (!term) return items;
      return items.filter((i) => i.title.toLowerCase().includes(term));
    },
    [search]
  );

  const filteredReporting = useMemo(
    () => filterItems(reportingLayers),
    [filterItems, reportingLayers]
  );

  const filteredAll = useMemo(
    () =>
      onlyReportingLayers
        ? []
        : filterItems(
            allLayers.filter(
              (l) => !reportingLayers.some((r) => r.stableId === l.stableId)
            )
          ),
    [onlyReportingLayers, filterItems, allLayers, reportingLayers]
  );

  const suggestedLayers = useMemo(() => {
    if (!suggested || !suggested.length) return [];
    const allOptions = [...reportingLayers, ...allLayers];
    const byStableId = new Map<string, LayerPickerOption>();
    for (const opt of allOptions) {
      if (typeof opt.tableOfContentsItemId === "number") {
        byStableId.set(opt.stableId, opt);
      }
    }
    const found: LayerPickerOption[] = [];
    for (const id of suggested) {
      const match = byStableId.get(id);
      if (match) found.push(match);
    }
    return found;
  }, [allLayers, reportingLayers, suggested]);

  const filteredSuggested = useMemo(() => {
    if (!suggestedLayers.length) return [];
    return filterItems(suggestedLayers);
  }, [filterItems, suggestedLayers]);

  // Build a flat list of all visible selectable items (in render order)
  const flatItems = useMemo(() => {
    const items: (
      | { type: "none" }
      | { type: "layer"; layer: LayerPickerOption }
    )[] = [];
    if (!required) {
      items.push({ type: "none" });
    }
    for (const layer of filteredSuggested) {
      items.push({ type: "layer", layer });
    }
    for (const layer of filteredReporting) {
      items.push({ type: "layer", layer });
    }
    if (!onlyReportingLayers) {
      for (const layer of filteredAll) {
        items.push({ type: "layer", layer });
      }
    }
    return items;
  }, [
    required,
    filteredSuggested,
    filteredReporting,
    filteredAll,
    onlyReportingLayers,
  ]);

  // Offsets for computing data-option-index per section
  const noneCount = required ? 0 : 1;
  const suggestedStart = noneCount;
  const reportingStart = suggestedStart + filteredSuggested.length;
  const allStart = reportingStart + filteredReporting.length;

  // Reset highlight when search text changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search]);

  // Reset highlight and search when popover closes
  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      setSearch("");
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      // eslint-disable-next-line i18next/no-literal-string
      const selector = `[data-option-index="${highlightedIndex}"]`;
      const el = listRef.current.querySelector(selector);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (layer?: LayerPickerOption) => {
    if (!layer) {
      onChange(undefined);
      setOpen(false);
      return;
    }

    onChange({
      stableId: layer.stableId,
      tableOfContentsItemId: layer.tableOfContentsItemId,
      title: layer.title,
    });
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
          e.preventDefault();
          const item = flatItems[highlightedIndex];
          if (item.type === "none") {
            handleSelect(undefined);
          } else {
            handleSelect(item.layer);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
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
        onKeyDown={handleKeyDown}
      >
        {(title || description) && (
          <div className="px-2 pb-2 pt-1">
            {title && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                {title}
              </div>
            )}
            {description && (
              <div className="text-xs text-gray-500 mt-1">{description}</div>
            )}
          </div>
        )}
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
        <div ref={listRef} className="max-h-64 overflow-auto space-y-1.5 pb-1">
          {!required && (
            <button
              type="button"
              data-option-index={0}
              className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors truncate ${
                highlightedIndex === 0
                  ? "bg-blue-50"
                  : "hover:bg-gray-50 focus:bg-gray-50"
              }`}
              onClick={() => handleSelect(undefined)}
              title={t("None")}
            >
              {t("None")}
            </button>
          )}
          {filteredSuggested.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-gray-700 sticky top-0 z-10 bg-gray-100 border-b border-gray-50">
                {t("Suggested")}
              </div>
              <div className="space-y-1">
                {filteredSuggested.map((layer, i) => (
                  <button
                    key={`suggested-${layer.stableId}-${
                      layer.tableOfContentsItemId ?? "none"
                    }`}
                    type="button"
                    data-option-index={suggestedStart + i}
                    className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
                      highlightedIndex === suggestedStart + i
                        ? "bg-blue-50"
                        : "hover:bg-gray-50 focus:bg-gray-50"
                    }`}
                    onClick={() => handleSelect(layer)}
                    title={layer.title}
                  >
                    <span className="truncate">{layer.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {filteredReporting.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-gray-700 bg-gray-100 sticky top-0 z-10  border-b border-gray-50">
                {t("Reporting Layers")}
              </div>
              <div className="space-y-1">
                {filteredReporting.map((layer, i) => (
                  <button
                    key={layer.stableId}
                    type="button"
                    data-option-index={reportingStart + i}
                    className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
                      highlightedIndex === reportingStart + i
                        ? "bg-blue-50"
                        : "hover:bg-gray-50 focus:bg-gray-50"
                    }`}
                    onClick={() => handleSelect(layer)}
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
                {filteredAll.map((layer, i) => (
                  <button
                    key={layer.stableId}
                    type="button"
                    data-option-index={allStart + i}
                    className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
                      highlightedIndex === allStart + i
                        ? "bg-blue-50"
                        : "hover:bg-gray-50 focus:bg-gray-50"
                    }`}
                    onClick={() => handleSelect(layer)}
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
