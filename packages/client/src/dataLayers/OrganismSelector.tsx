import {
  KeyboardEvent,
  MutableRefObject,
  Ref,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CaretDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
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
  orgQueryHitLabel,
  orgQueryHitMatchedAncestor,
} from "./orgQueryApi";
import {
  compactInaturalistAttribution,
  inaturalistAttributionParts,
  inaturalistTaxonPhotoStatus,
  useInaturalistTaxonPhotos,
} from "./inaturalistTaxonPhotos";

const DESCRIPTION_TEASER_CHARS = 90;
const SEARCH_DEBOUNCE_MS = 250;

type StringFilterMode = "value" | "isNull" | "notNull";

const hitCache = new Map<string, OrgQueryHit>();

function cacheHits(hits: OrgQueryHit[]) {
  for (const hit of hits) {
    hitCache.set(hit.value, hit);
  }
}

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

function OrganismPhotoCredit({
  attribution,
  licenseCode,
}: {
  attribution: string;
  licenseCode?: string;
}) {
  const parts = inaturalistAttributionParts(attribution, licenseCode);
  if (!parts.text && !parts.licenseLabel) {
    return null;
  }
  return (
    <p className="mt-1 text-[10px] leading-snug text-gray-500">
      {parts.text}
      {parts.licenseUrl && parts.licenseLabel ? (
        <>
          {" "}
          <a
            href={parts.licenseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:text-primary-700"
            onClick={(event) => event.stopPropagation()}
          >
            {parts.licenseLabel}
          </a>
        </>
      ) : null}
    </p>
  );
}

function OrganismThumb({
  status,
}: {
  status: ReturnType<typeof inaturalistTaxonPhotoStatus> | null;
}) {
  if (!status) {
    return <span className="h-20 w-20 flex-none rounded bg-gray-100" />;
  }
  if (status.status === "ready") {
    return (
      <img
        src={status.photo.squareUrl}
        alt=""
        className="h-20 w-20 flex-none rounded object-cover bg-gray-100"
      />
    );
  }
  if (status.status === "loading") {
    return (
      <span className="h-20 w-20 flex-none rounded bg-gray-100 animate-pulse" />
    );
  }
  return <span className="h-20 w-20 flex-none rounded bg-gray-100" />;
}

function hitFromValue(value: string): OrgQueryHit {
  return (
    hitCache.get(value) || {
      table: "",
      column: "",
      value,
      scientificName: null,
      commonName: null,
      description: null,
      inatTaxonId: null,
      wormsAphiaId: null,
      score: 0,
      matchedFields: [],
    }
  );
}

/**
 * Browse + search organism filter. Empty orgQuery returns the full catalog;
 * typing ranks hits. Thumbnails load for rows in the scroll viewport only.
 */
export default function OrganismSelector({
  column,
  filters,
  orgQueryUrl,
  accessToken,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  orgQueryUrl: string;
  accessToken?: string | null;
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const parsed = useMemo(() => parseStringFilterState(filters), [filters]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [multi, setMulti] = useState(parsed.multi);
  const [mode, setMode] = useState<StringFilterMode>(parsed.mode);
  const [selected, setSelected] = useState<string[]>(parsed.selected);
  const [hits, setHits] = useState<OrgQueryHit[]>([]);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleTaxonIds, setVisibleTaxonIds] = useState<number[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLDivElement>(null);
  const pendingTypeRef = useRef("");
  const didScrollRef = useRef(false);
  const visibleTaxonSetRef = useRef(new Set<number>());
  const visibleFlushRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setMulti(parsed.multi);
      setMode(parsed.mode);
      setSelected(parsed.selected);
      setQuery("");
      setDebouncedQuery("");
      setHits([]);
      setCatalogCount(null);
      setError(null);
      setVisibleTaxonIds([]);
      visibleTaxonSetRef.current.clear();
      if (visibleFlushRef.current) {
        window.cancelAnimationFrame(visibleFlushRef.current);
        visibleFlushRef.current = 0;
      }
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
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchOrgQuery(orgQueryUrl, debouncedQuery, {
      accessToken,
      limit: ORG_QUERY_DEFAULT_LIMIT,
      signal: controller.signal,
    })
      .then((response) => {
        cacheHits(response.hits);
        setHits(response.hits);
        if (!debouncedQuery) {
          setCatalogCount(response.hits.length);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(t("Couldn't load search results"));
        setLoading(false);
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

  const onVisibleTaxon = useCallback((id: number, visible: boolean) => {
    const seen = visibleTaxonSetRef.current;
    const had = seen.has(id);
    if (visible === had) {
      return;
    }
    if (visible) {
      seen.add(id);
    } else {
      seen.delete(id);
    }
    if (visibleFlushRef.current) {
      return;
    }
    visibleFlushRef.current = window.requestAnimationFrame(() => {
      visibleFlushRef.current = 0;
      setVisibleTaxonIds([...visibleTaxonSetRef.current]);
    });
  }, []);

  const photos = useInaturalistTaxonPhotos(visibleTaxonIds);

  const scrollTargetValue = useMemo(() => {
    if (mode !== "value" || selected.length === 0) {
      return undefined;
    }
    return hits.find((hit) => selected.includes(hit.value))?.value;
  }, [hits, mode, selected]);

  useEffect(() => {
    if (!open || loading || debouncedQuery || didScrollRef.current) {
      return;
    }
    const list = listRef.current;
    const item = selectedOptionRef.current;
    if (!list || !item) {
      return;
    }
    const itemOffset =
      item.getBoundingClientRect().top -
      list.getBoundingClientRect().top +
      list.scrollTop;
    list.scrollTop =
      itemOffset - list.clientHeight / 2 + item.clientHeight / 2;
    didScrollRef.current = true;
  }, [debouncedQuery, hits, loading, open]);

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

  const selectedHits = selected.map(hitFromValue);
  const displayLabel = (() => {
    if (mode === "isNull") return t("Is blank");
    if (mode === "notNull") return t("Has a value");
    if (selected.length === 0) return t("Search organisms");
    if (selected.length === 1) {
      return orgQueryHitLabel(selectedHits[0]);
    }
    // eslint-disable-next-line i18next/no-literal-string
    return `${selected.length} ${t("selected")}`;
  })();

  const selectSingle = (value: string) => {
    setMode("value");
    setSelected([value]);
    commit("value", [value], false);
    setOpen(false);
  };

  const toggleMultiValue = (value: string) => {
    let nextSelected = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];
    if (nextSelected.length === 0 && selected[0]) {
      nextSelected = [selected[0]];
    }
    setMode("value");
    setSelected(nextSelected);
    commit("value", nextSelected, true);
  };

  const onMultiToggle = (enabled: boolean) => {
    setMulti(enabled);
    if (!enabled) {
      const nextSelected = selected.slice(0, 1);
      setSelected(nextSelected);
      if (mode === "value") {
        commit("value", nextSelected, false);
      }
      return;
    }
    if (mode === "value") {
      commit("value", selected, true);
    }
  };

  const selectVisible = (action: "all" | "none") => {
    const values = hits.map((hit) => hit.value);
    const nextSelected = applyVisibleMultiSelection(selected, values, action);
    if (nextSelected.length === 0 && selected[0]) {
      return;
    }
    setMulti(true);
    setMode("value");
    setSelected(nextSelected);
    commit("value", nextSelected, true);
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
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      pendingTypeRef.current = event.key;
      setOpen(true);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onKeyDown={onTriggerKeyDown}
          className={clsx(
            "min-w-0 max-w-[58%] inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-left text-xs text-gray-700",
            "hover:bg-gray-50 focus:outline-none focus:ring-0 focus:border-gray-300",
            "focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
          )}
        >
          <span className="truncate flex-1 font-medium">{displayLabel}</span>
          <CaretDownIcon className="w-3 h-3 flex-none text-gray-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-[100] w-[26rem] rounded-md border border-black/10 bg-white shadow-lg overflow-hidden data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <div className="border-b border-black/5 px-2 py-1.5">
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
                className="w-full rounded border border-gray-200 bg-gray-50 pl-7 pr-2 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
              />
            </div>
          </div>

          {mode !== "value" && (
            <div className="px-2.5 py-1.5 text-[11px] text-gray-500 border-b border-black/5 bg-amber-50/70">
              {mode === "isNull"
                ? t("Filtering to blank values. Pick a value to switch.")
                : t("Filtering to any non-blank value. Pick a value to switch.")}
            </div>
          )}

          {error && (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div ref={listRef} className="max-h-96 overflow-y-auto py-1">
            {loading && hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 italic">
                {debouncedQuery ? t("Searching…") : t("Loading organisms…")}
              </p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 italic">
                {t("No matching values")}
              </p>
            ) : (
              hits.map((hit) => {
                const isSelected =
                  mode === "value" && selected.includes(hit.value);
                return (
                  <OrganismHitRow
                    key={hit.value}
                    hit={hit}
                    isSelected={isSelected}
                    multi={multi}
                    photos={photos}
                    listRef={listRef}
                    rowRef={
                      hit.value === scrollTargetValue
                        ? selectedOptionRef
                        : undefined
                    }
                    onVisibleTaxon={onVisibleTaxon}
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

          <div className="border-t border-black/5 px-2 py-1.5 space-y-1.5 bg-gray-50/80">
            {ancestorHits.length > 1 && (
              <button
                type="button"
                onClick={selectAncestorMatches}
                className="w-full rounded px-1.5 py-1 text-[11px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t("Select all matching in this table")}
              </button>
            )}
            <DataTableFilterMultiSelectRow
              multi={multi}
              selected={mode === "value" ? selected : []}
              visibleValues={hits.map((hit) => hit.value)}
              onMultiToggle={onMultiToggle}
              onSelectAll={() => selectVisible("all")}
              onSelectNone={() => selectVisible("none")}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  photos,
  listRef,
  rowRef,
  onVisibleTaxon,
  onClick,
}: {
  hit: OrgQueryHit;
  isSelected: boolean;
  multi: boolean;
  photos: ReturnType<typeof useInaturalistTaxonPhotos>;
  listRef: RefObject<HTMLDivElement>;
  rowRef?: Ref<HTMLDivElement>;
  onVisibleTaxon: (id: number, visible: boolean) => void;
  onClick: () => void;
}) {
  const observeRef = useRef<HTMLDivElement>(null);
  const commonName = hit.commonName;
  const scientificName = hit.scientificName;
  const primary = commonName || scientificName || hit.value;
  const showScientific = Boolean(
    scientificName && scientificName !== primary
  );
  const showValue = Boolean(
    hit.value && hit.value !== primary && hit.value !== scientificName
  );
  const photoStatus = inaturalistTaxonPhotoStatus(hit.inatTaxonId, photos);
  const photoCredit =
    photoStatus.status === "ready"
      ? compactInaturalistAttribution(photoStatus.photo.attribution)
      : "";

  useEffect(() => {
    const node = observeRef.current;
    const root = listRef.current;
    const taxonId = hit.inatTaxonId;
    if (!node || taxonId == null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibleTaxon(taxonId, entry.isIntersecting);
      },
      { root: root ?? undefined, rootMargin: "160px 0px", threshold: 0 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      onVisibleTaxon(taxonId, false);
    };
  }, [hit.inatTaxonId, listRef, onVisibleTaxon]);

  return (
    <div
      ref={(node) => {
        (observeRef as MutableRefObject<HTMLDivElement | null>).current = node;
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
      <OrganismThumb status={photoStatus} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-gray-800">
          {primary}
        </span>
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
          <OrganismPhotoCredit
            attribution={photoCredit}
            licenseCode={
              photoStatus.status === "ready"
                ? photoStatus.photo.licenseCode
                : undefined
            }
          />
        ) : null}
        {hit.description ? <OrganismDescription text={hit.description} /> : null}
      </span>
    </div>
  );
}
