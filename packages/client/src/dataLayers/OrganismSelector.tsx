import {
  KeyboardEvent,
  MutableRefObject,
  Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  CaretDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import {
  autoUpdate,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import clsx from "clsx";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import { DataTableFilter } from "./dataTableQueryApi";
import { applyVisibleMultiSelection } from "./dataTableFilterSelection";
import DataTableFilterMultiSelectRow from "./DataTableFilterMultiSelectRow";
import {
  emitStringFilters,
  parseStringFilterState,
} from "./DataTableStringFilter";
import {
  ORG_QUERY_DEFAULT_LIMIT,
  OrgQueryHit,
  fetchOrgQuery,
  fetchOrganismCatalog,
  orgQueryHitFromValue,
  orgQueryHitMatchedAncestor,
  peekOrganismCatalog,
} from "./orgQueryApi";
import INaturalistPhotoCredit from "../components/INaturalistThumbnail/INaturalistPhotoCredit";
import INaturalistThumbnail from "../components/INaturalistThumbnail/INaturalistThumbnail";
import Spinner from "../components/Spinner";
import {
  compactInaturalistAttribution,
  inaturalistAttributionParts,
  prefetchInaturalistTaxonPhotos,
  prioritizeInaturalistTaxonPhoto,
  unregisterInaturalistTaxonPhoto,
  useInaturalistTaxonPhoto,
} from "./inaturalistTaxonPhotos";
import {
  ORGANISM_SELECTOR_WIDTH_REM,
  OrganismSelectorPlacement,
  ViewportRect,
  placeOrganismSelectorPanel,
} from "./organismSelectorPlacement";

const DESCRIPTION_TEASER_CHARS = 90;
const SEARCH_DEBOUNCE_MS = 250;

type StringFilterMode = "value" | "isNull" | "notNull";

function OrganismDescription({ text }: { text: string }) {
  const { t } = useTranslation("homepage");
  const [expanded, setExpanded] = useState(false);
  const long = text.length > DESCRIPTION_TEASER_CHARS;
  const preview = text.slice(0, DESCRIPTION_TEASER_CHARS).trim();
  // eslint-disable-next-line i18next/no-literal-string
  const shown = !long || expanded ? text : `${preview}…`;
  return (
    <div className="mt-0.5 text-[10px] leading-snug text-gray-500">
      <p>{shown}</p>
      {long ? (
        <button
          type="button"
          className="mt-0.5 inline-flex items-center gap-0.5 text-primary-600 hover:text-primary-700"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? (
            <>
              {t("Show less")}
              <ChevronUpIcon className="h-3 w-3" aria-hidden />
            </>
          ) : (
            <>
              {t("Show more")}
              <ChevronDownIcon className="h-3 w-3" aria-hidden />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function organismPhotoCreditLabel(
  attribution: string,
  licenseCode?: string,
  photoId?: number | null
): string {
  const parts = inaturalistAttributionParts(attribution, licenseCode, photoId);
  return [parts.text, parts.licenseLabel].filter(Boolean).join(" ");
}

function OrganismDetails({
  hit,
  thumbnailRoot,
  compact = false,
}: {
  hit: OrgQueryHit;
  thumbnailRoot?: Element | null;
  compact?: boolean;
}) {
  const photoStatus = useInaturalistTaxonPhoto(hit.inatTaxonId, false);
  const commonName = hit.commonName;
  const scientificName = hit.scientificName;
  const primary = commonName || scientificName || hit.value;
  const showScientific = Boolean(scientificName && scientificName !== primary);
  const showValue = Boolean(
    hit.value && hit.value !== primary && hit.value !== scientificName
  );
  const photoCredit =
    photoStatus.status === "ready"
      ? compactInaturalistAttribution(photoStatus.photo.attribution)
      : "";
  const creditLabel = photoCredit
    ? organismPhotoCreditLabel(
        photoCredit,
        photoStatus.status === "ready"
          ? photoStatus.photo.licenseCode
          : undefined,
        photoStatus.status === "ready" ? photoStatus.photo.photoId : undefined
      )
    : "";

  return (
    <span
      className={clsx(
        "min-w-0 flex-1 flex",
        compact ? "items-center gap-2" : "items-start gap-2.5"
      )}
    >
      <span
        title={compact && creditLabel ? creditLabel : undefined}
        className="flex-none"
      >
        <INaturalistThumbnail
          sourceId={hit.inatTaxonId}
          size={compact ? "sm" : "md"}
          root={thumbnailRoot}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block font-medium text-gray-800",
            compact ? "text-sm truncate leading-5" : "text-sm leading-snug"
          )}
        >
          {primary}
        </span>
        {compact ? (
          showScientific || showValue ? (
            <span className="mt-0.5 block truncate text-[11px] leading-snug text-gray-500">
              {showScientific ? (
                <span className="italic">{scientificName}</span>
              ) : null}
              {showScientific && showValue ? " · " : null}
              {showValue ? (
                <span className="font-mono">{hit.value}</span>
              ) : null}
            </span>
          ) : null
        ) : (
          <>
            {showScientific ? (
              <span className="mt-0.5 block text-xs italic leading-snug text-gray-600">
                {scientificName}
              </span>
            ) : null}
            {showValue ? (
              <span className="mt-0.5 block font-mono text-[11px] leading-snug text-gray-500">
                {hit.value}
              </span>
            ) : null}
            {photoCredit ? (
              <INaturalistPhotoCredit
                attribution={photoCredit}
                licenseCode={
                  photoStatus.status === "ready"
                    ? photoStatus.photo.licenseCode
                    : undefined
                }
                photoId={
                  photoStatus.status === "ready"
                    ? photoStatus.photo.photoId
                    : undefined
                }
                className="mt-1 text-gray-500"
              />
            ) : null}
            {hit.description ? (
              <OrganismDescription text={hit.description} />
            ) : null}
          </>
        )}
      </span>
    </span>
  );
}

function OrganismSelectionSummary({
  hits,
  allSelected,
}: {
  hits: OrgQueryHit[];
  allSelected: boolean;
}) {
  const { t } = useTranslation("homepage");
  const preview = hits.filter((hit) => hit.inatTaxonId).slice(0, 4);
  const count = hits.length;
  const showBadge = count > preview.length || (allSelected && count > 4);
  const label = allSelected
    ? t("All selected")
    : t("{{count}} selected", { count });

  return (
    <span className="flex min-w-0 items-center" title={label}>
      <span
        className={clsx(
          "flex flex-none items-center",
          preview.length > 2 || showBadge ? "-space-x-5" : "gap-1"
        )}
      >
        {preview.map((hit, index) => (
          <span
            key={hit.value}
            className="relative"
            style={{ zIndex: preview.length - index }}
          >
            <INaturalistThumbnail
              sourceId={hit.inatTaxonId}
              size="sm"
              className="ring-2 ring-white"
            />
          </span>
        ))}
        {showBadge ? (
          <span
            className="relative z-20 flex h-10 min-w-[2.75rem] flex-col items-center justify-center rounded-md bg-gray-100 px-1.5 text-gray-800 ring-2 ring-white"
            aria-label={label}
          >
            <span className="text-sm font-semibold leading-none tabular-nums">
              {allSelected ? t("All") : count}
            </span>
            <span className="mt-0.5 text-[9px] font-medium leading-none text-gray-500">
              {t("selected")}
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );
}

function viewportRect(rect: DOMRect): ViewportRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function placementsMatch(
  prev: OrganismSelectorPlacement | null,
  next: OrganismSelectorPlacement
) {
  return (
    prev != null &&
    prev.side === next.side &&
    prev.top === next.top &&
    prev.left === next.left &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.maxWidth === next.maxWidth &&
    prev.maxHeight === next.maxHeight
  );
}

/**
 * Measure the panel after its width is capped to the chosen side, then
 * center that height on the trigger.
 */
function measureOrganismSelectorPlacement(
  trigger: Element,
  panel: HTMLElement
): OrganismSelectorPlacement {
  const rootFontSize =
    Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize
    ) || 16;
  const desiredWidth = ORGANISM_SELECTOR_WIDTH_REM * rootFontSize;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const triggerBox = viewportRect(trigger.getBoundingClientRect());
  const frame = placeOrganismSelectorPanel({
    trigger: triggerBox,
    panelWidth: desiredWidth,
    panelHeight: 0,
    viewportWidth,
    viewportHeight,
  });
  panel.style.width = frame.width + "px";
  panel.style.maxWidth = frame.maxWidth + "px";
  panel.style.maxHeight = frame.maxHeight + "px";
  const measuredHeight = panel.getBoundingClientRect().height;
  return placeOrganismSelectorPanel({
    trigger: triggerBox,
    panelWidth: desiredWidth,
    panelHeight: measuredHeight,
    viewportWidth,
    viewportHeight,
  });
}

/**
 * Browse + search organism filter. The catalog and taxon thumbs load on
 * mount so the trigger can show common names and the list is warm before
 * it opens.
 */
export default function OrganismSelector({
  column,
  filters,
  orgQueryUrl,
  accessToken,
  hiddenValues,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  orgQueryUrl: string;
  accessToken?: string | null;
  /** Nothing-seen placeholders etc. that must never be offered or selected. */
  hiddenValues?: string[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const hidden = useMemo(() => new Set(hiddenValues || []), [hiddenValues]);
  const parsed = useMemo(() => {
    const state = parseStringFilterState(filters);
    return hidden.size === 0
      ? state
      : {
          ...state,
          selected: state.selected.filter((value) => !hidden.has(value)),
        };
  }, [filters, hidden]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [multi, setMulti] = useState(parsed.multi);
  const [mode, setMode] = useState<StringFilterMode>(parsed.mode);
  const [selected, setSelected] = useState<string[]>(parsed.selected);
  const [rawCatalogHits, setCatalogHits] = useState<OrgQueryHit[]>(
    () => peekOrganismCatalog(orgQueryUrl, accessToken) || []
  );
  const [rawSearchHits, setSearchHits] = useState<OrgQueryHit[] | null>(
    null
  );
  const catalogHits = useMemo(
    () =>
      hidden.size === 0
        ? rawCatalogHits
        : rawCatalogHits.filter((hit) => !hidden.has(hit.value)),
    [hidden, rawCatalogHits]
  );
  const searchHits = useMemo(
    () =>
      hidden.size === 0 || !rawSearchHits
        ? rawSearchHits
        : rawSearchHits.filter((hit) => !hidden.has(hit.value)),
    [hidden, rawSearchHits]
  );
  const [catalogLoading, setCatalogLoading] = useState(
    () => peekOrganismCatalog(orgQueryUrl, accessToken) == null
  );
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [placement, setPlacement] = useState<OrganismSelectorPlacement | null>(
    null
  );
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const selectedOptionRef = useRef<HTMLDivElement>(null);
  const pendingTypeRef = useRef("");
  const didScrollRef = useRef(false);
  const { refs, context } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next && refs.domReference.current instanceof HTMLElement) {
        refs.domReference.current.focus({ preventScroll: true });
      }
    },
    strategy: "fixed",
  });
  const setPanelOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && refs.domReference.current instanceof HTMLElement) {
        refs.domReference.current.focus({ preventScroll: true });
      }
    },
    [refs]
  );
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  useEffect(() => {
    if (!open) {
      setMulti(parsed.multi);
      setMode(parsed.mode);
      setSelected(parsed.selected);
      setQuery("");
      setDebouncedQuery("");
      setSearchHits(null);
      setSearching(false);
      setError(null);
      pendingTypeRef.current = "";
      didScrollRef.current = false;
    }
  }, [open, parsed]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    let cancelled = false;
    const cached = peekOrganismCatalog(orgQueryUrl, accessToken);
    if (cached) {
      setCatalogHits(cached);
      setCatalogLoading(false);
    } else {
      setCatalogLoading(true);
    }
    fetchOrganismCatalog(orgQueryUrl, {
      accessToken,
      limit: ORG_QUERY_DEFAULT_LIMIT,
    })
      .then((nextHits) => {
        if (cancelled) return;
        setCatalogHits(nextHits);
        setCatalogLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled || err.name === "AbortError") return;
        setError(t("Couldn't load organisms"));
        setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgQueryUrl, t]);

  useEffect(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const hit of catalogHits) {
      const id = hit.inatTaxonId;
      if (id == null || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length === 0) return;
    prefetchInaturalistTaxonPhotos(ids);
    return () => {
      for (const id of ids) {
        unregisterInaturalistTaxonPhoto(id);
      }
    };
  }, [catalogHits]);

  useEffect(() => {
    for (const hit of catalogHits) {
      const id = hit.inatTaxonId;
      if (id == null || id <= 0 || !selected.includes(hit.value)) continue;
      prioritizeInaturalistTaxonPhoto(id, "visible");
    }
  }, [catalogHits, selected]);

  useEffect(() => {
    if (!open) return;
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setError(null);
    fetchOrgQuery(orgQueryUrl, trimmed, {
      accessToken,
      limit: ORG_QUERY_DEFAULT_LIMIT,
      signal: controller.signal,
    })
      .then((response) => {
        setSearchHits(response.hits);
        setSearching(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(t("Couldn't load search results"));
        setSearching(false);
      });
    return () => controller.abort();
  }, [accessToken, debouncedQuery, open, orgQueryUrl, t]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      if (pendingTypeRef.current) {
        setQuery(pendingTypeRef.current);
        pendingTypeRef.current = "";
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const hits = searchHits ?? catalogHits;
  const catalogCount = catalogHits.length || null;
  const catalogValues = useMemo(
    () => catalogHits.map((hit) => hit.value),
    [catalogHits]
  );
  const effectiveSelected =
    mode === "notNull" && catalogValues.length > 0 ? catalogValues : selected;
  const allCatalogSelected =
    mode === "notNull" ||
    (mode === "value" &&
      catalogValues.length > 0 &&
      effectiveSelected.length >= catalogValues.length &&
      catalogValues.every((value) => effectiveSelected.includes(value)));
  const selectedHits = allCatalogSelected
    ? catalogHits
    : effectiveSelected.map(orgQueryHitFromValue);
  const trimmedQuery = query.trim();
  const searchPending =
    Boolean(trimmedQuery) && (trimmedQuery !== debouncedQuery || searching);

  const scrollTargetValue = useMemo(() => {
    if (mode === "isNull" || effectiveSelected.length === 0) {
      return undefined;
    }
    return hits.find((hit) => effectiveSelected.includes(hit.value))?.value;
  }, [effectiveSelected, hits, mode]);

  useEffect(() => {
    if (!open || catalogLoading || searchPending || didScrollRef.current) {
      return;
    }
    const list = listEl;
    const item = selectedOptionRef.current;
    if (!list || !item) {
      return;
    }
    const itemOffset =
      item.getBoundingClientRect().top -
      list.getBoundingClientRect().top +
      list.scrollTop;
    list.scrollTop = itemOffset - list.clientHeight / 2 + item.clientHeight / 2;
    didScrollRef.current = true;
  }, [catalogLoading, hits, listEl, open, searchPending]);

  const ancestorHits = useMemo(
    () => hits.filter(orgQueryHitMatchedAncestor),
    [hits]
  );

  const commit = (
    nextMode: StringFilterMode,
    nextSelected: string[],
    nextMulti: boolean
  ) => {
    onChange(
      emitStringFilters(column.attribute, nextMode, nextSelected, nextMulti)
    );
  };

  const commitSelection = (nextSelected: string[], nextMulti: boolean) => {
    if (
      catalogValues.length > 0 &&
      nextSelected.length >= catalogValues.length &&
      catalogValues.every((value) => nextSelected.includes(value))
    ) {
      setMulti(nextMulti);
      setMode("notNull");
      setSelected(catalogValues);
      commit("notNull", [], nextMulti);
      return;
    }
    setMulti(nextMulti);
    setMode("value");
    setSelected(nextSelected);
    commit("value", nextSelected, nextMulti);
  };

  const selectSingle = (value: string) => {
    commitSelection([value], false);
    setPanelOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const trigger = refs.domReference.current;
    const panel = refs.floating.current;
    if (!trigger || !panel) {
      return;
    }
    const update = () => {
      const next = measureOrganismSelectorPlacement(trigger, panel);
      setPlacement((prev) => (placementsMatch(prev, next) ? prev : next));
    };
    update();
    return autoUpdate(trigger, panel, update);
  }, [open, refs]);

  const toggleMultiValue = (value: string) => {
    const nextSelected = effectiveSelected.includes(value)
      ? effectiveSelected.filter((entry) => entry !== value)
      : [...effectiveSelected, value];
    commitSelection(nextSelected, true);
  };

  const onMultiToggle = (enabled: boolean) => {
    if (!enabled) {
      const nextSelected = effectiveSelected.slice(0, 1);
      commitSelection(nextSelected, false);
      return;
    }
    if (mode === "notNull") {
      setMulti(true);
      return;
    }
    commitSelection(effectiveSelected, true);
  };

  const selectVisible = (action: "all" | "none") => {
    if (action === "none") {
      commitSelection([], true);
      return;
    }
    const browsingCatalog = !debouncedQuery.trim() && searchHits == null;
    if (browsingCatalog && catalogValues.length > 0) {
      commitSelection(catalogValues, true);
      return;
    }
    commitSelection(
      applyVisibleMultiSelection(
        effectiveSelected,
        hits.map((hit) => hit.value),
        action
      ),
      true
    );
  };

  const isSearchActive =
    Boolean(debouncedQuery.trim()) && searchHits != null && !searchPending;
  const showSelectAllResults = isSearchActive && hits.length > 1;
  const allResultsSelected =
    showSelectAllResults &&
    hits.every((hit) => effectiveSelected.includes(hit.value));
  const showSelectAncestors =
    ancestorHits.length > 1 &&
    (!showSelectAllResults || ancestorHits.length < hits.length);

  const selectAllResults = () => {
    const values = hits.map((hit) => hit.value);
    if (values.length === 0) return;
    commitSelection(values, true);
  };

  const selectAncestorMatches = () => {
    const values = ancestorHits.map((hit) => hit.value);
    if (values.length === 0) return;
    setMulti(true);
    setMode("value");
    setSelected(values);
    commit("value", values, true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      pendingTypeRef.current = event.key;
      setPanelOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className={clsx(
          "w-full min-w-0 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left",
          "hover:bg-gray-50 focus:outline-none focus:ring-0 focus:border-gray-300",
          "focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
        )}
        {...getReferenceProps({ onKeyDown: onTriggerKeyDown })}
        ref={refs.setReference}
      >
        <span className="min-w-0 flex-1">
          {mode === "isNull" ? (
            <span className="block text-sm font-medium text-gray-600">
              {t("Is blank")}
            </span>
          ) : allCatalogSelected ? (
            <OrganismSelectionSummary hits={catalogHits} allSelected />
          ) : selectedHits.length === 0 ? (
            <span className="block text-sm font-medium text-gray-500">
              {t("No selection")}
            </span>
          ) : selectedHits.length === 1 ? (
            <OrganismDetails hit={selectedHits[0]} compact />
          ) : (
            <OrganismSelectionSummary hits={selectedHits} allSelected={false} />
          )}
        </span>
        <CaretDownIcon className="w-4 h-4 flex-none text-gray-400" />
      </button>
      {open
        ? createPortal(
            <div
              ref={refs.setFloating}
              data-side={placement?.side}
              className="z-[100] flex w-[26rem] flex-col overflow-hidden rounded-md border border-black/10 bg-white shadow-lg"
              {...getFloatingProps({
                onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === "Escape") {
                    setPanelOpen(false);
                  }
                },
              })}
              style={{
                position: "fixed",
                top: placement?.top ?? 0,
                left: placement?.left ?? 0,
                width: placement?.width,
                maxWidth: placement?.maxWidth,
                maxHeight: placement?.maxHeight,
                visibility: placement ? "visible" : "hidden",
              }}
            >
              <div className="flex-none border-b border-black/5 px-2 py-1.5">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      catalogCount != null
                        ? t("Search {{count}} organisms...", {
                            count: catalogCount,
                          })
                        : t("Search scientific or common names...")
                    }
                    className={clsx(
                      "w-full rounded border border-gray-200 bg-gray-50 pl-7 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500",
                      searchPending ? "pr-7" : "pr-2"
                    )}
                    aria-busy={searchPending}
                  />
                  {searchPending ? (
                    <Spinner
                      mini
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
                    />
                  ) : null}
                </div>
              </div>

              {mode === "isNull" && (
                <div className="flex-none px-2.5 py-1.5 text-[11px] text-gray-500 border-b border-black/5 bg-amber-50/70">
                  {t("Filtering to blank values. Pick a value to switch.")}
                </div>
              )}

              {searchPending ? (
                <div className="flex flex-none items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-500 border-b border-black/5 bg-gray-50">
                  <Spinner mini className="opacity-80" />
                  <span>
                    {t("Searching for {{query}}…", { query: trimmedQuery })}
                  </span>
                </div>
              ) : null}

              {error && (
                <p className="flex-none px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <div
                ref={setListEl}
                className={clsx(
                  "min-h-0 max-h-96 shrink overflow-y-auto py-1",
                  searchPending && hits.length > 0 && "opacity-60"
                )}
                aria-busy={searchPending || catalogLoading}
              >
                {catalogLoading && hits.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">
                    {t("Loading organisms…")}
                  </p>
                ) : searchPending && hits.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">
                    {t("Searching…")}
                  </p>
                ) : hits.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">
                    {t("No matching values")}
                  </p>
                ) : (
                  hits.map((hit) => {
                    const isSelected =
                      mode !== "isNull" &&
                      effectiveSelected.includes(hit.value);
                    return (
                      <OrganismHitRow
                        key={hit.value}
                        hit={hit}
                        isSelected={isSelected}
                        multi={multi}
                        listEl={listEl}
                        rowRef={
                          hit.value === scrollTargetValue
                            ? selectedOptionRef
                            : undefined
                        }
                        onClick={() => {
                          if (multi) {
                            toggleMultiValue(hit.value);
                          } else {
                            selectSingle(hit.value);
                          }
                        }}
                      />
                    );
                  })
                )}
              </div>

              <div className="flex-none border-t border-black/5 px-2 py-1.5 space-y-1.5 bg-gray-50/80">
                {showSelectAllResults ? (
                  <button
                    type="button"
                    onClick={selectAllResults}
                    disabled={allResultsSelected}
                    className="w-full rounded px-1.5 py-1 text-[11px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:text-gray-400"
                  >
                    {t("Select all {{count}} results", { count: hits.length })}
                  </button>
                ) : null}
                {showSelectAncestors ? (
                  <button
                    type="button"
                    onClick={selectAncestorMatches}
                    className="w-full rounded px-1.5 py-1 text-[11px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {t("Select all matching in this table")}
                  </button>
                ) : null}
                <DataTableFilterMultiSelectRow
                  multi={multi || allCatalogSelected}
                  selected={mode === "isNull" ? [] : effectiveSelected}
                  visibleValues={hits.map((hit) => hit.value)}
                  onMultiToggle={onMultiToggle}
                  onSelectAll={() => selectVisible("all")}
                  onSelectNone={() => selectVisible("none")}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
}

function OrganismHitRow({
  hit,
  isSelected,
  multi,
  listEl,
  rowRef,
  onClick,
}: {
  hit: OrgQueryHit;
  isSelected: boolean;
  multi: boolean;
  listEl: HTMLDivElement | null;
  rowRef?: Ref<HTMLDivElement>;
  onClick: () => void;
}) {
  return (
    <div
      ref={(node) => {
        assignRef(rowRef, node);
      }}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={clsx(
        "w-full flex items-start gap-2.5 px-2.5 py-2 text-left cursor-pointer hover:bg-gray-50",
        isSelected && "bg-primary-50/60"
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span
        className={clsx(
          "mt-1.5 flex-none w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
          multi
            ? isSelected
              ? "border-primary-600 bg-primary-600 text-white"
              : "border-gray-300 bg-white"
            : isSelected
            ? "border-primary-600 text-primary-600"
            : "border-transparent"
        )}
      >
        {isSelected && <CheckIcon className="w-3 h-3" />}
      </span>
      <OrganismDetails hit={hit} thumbnailRoot={listEl} />
    </div>
  );
}
