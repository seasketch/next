import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import {
  DataTableFilter,
  dataTableInFilterValues,
} from "./dataTableQueryApi";
import clsx from "clsx";

/** Prefer discrete equality when unique values stay within this bound. */
export const NUMERIC_DISCRETE_VALUE_LIMIT = 40;

type NumericUiMode = "values" | "range" | "isNull" | "notNull";

function numericKeys(column: GeostatsAttribute) {
  return Object.keys(column.values || {})
    .map((value) => ({
      raw: value,
      num: Number(value),
    }))
    .filter((entry) => Number.isFinite(entry.num))
    .sort((a, b) => a.num - b.num);
}

/**
 * Discrete when there are a modest number of unique values (years, survey
 * sites codes, etc.). Continuous/range when the value space is large or
 * poorly enumerated (depth, temperature).
 */
export function prefersDiscreteNumericFilter(column: GeostatsAttribute) {
  const keys = numericKeys(column);
  if (keys.length === 0) {
    return false;
  }
  return keys.length <= NUMERIC_DISCRETE_VALUE_LIMIT;
}

export function defaultNumericFilters(
  column: GeostatsAttribute
): DataTableFilter[] {
  const keys = numericKeys(column);
  if (prefersDiscreteNumericFilter(column)) {
    const highest = keys[Math.max(keys.length - 1, 0)]?.raw;
    if (highest !== undefined) {
      return [{ column: column.attribute, op: "eq", value: highest }];
    }
  }
  const min =
    column.min !== undefined && Number.isFinite(column.min)
      ? String(column.min)
      : keys[0]?.raw;
  const max =
    column.max !== undefined && Number.isFinite(column.max)
      ? String(column.max)
      : keys[Math.max(keys.length - 1, 0)]?.raw;
  const next: DataTableFilter[] = [];
  if (min !== undefined) {
    next.push({ column: column.attribute, op: "gte", value: min });
  }
  if (max !== undefined) {
    next.push({ column: column.attribute, op: "lte", value: max });
  }
  return next.length ? next : [{ column: column.attribute, op: "notNull" }];
}

function parseNumericFilterState(
  filters: DataTableFilter[],
  preferDiscrete: boolean
) {
  if (filters.some((filter) => filter.op === "isNull")) {
    return {
      mode: "isNull" as NumericUiMode,
      selected: [] as string[],
      multi: false,
      min: "",
      max: "",
    };
  }
  if (filters.some((filter) => filter.op === "notNull") && filters.length === 1) {
    return {
      mode: "notNull" as NumericUiMode,
      selected: [] as string[],
      multi: false,
      min: "",
      max: "",
    };
  }
  const inFilter = filters.find((filter) => filter.op === "in");
  if (inFilter) {
    return {
      mode: "values" as NumericUiMode,
      selected: dataTableInFilterValues(inFilter),
      multi: true,
      min: "",
      max: "",
    };
  }
  const eqFilter = filters.find((filter) => filter.op === "eq");
  if (eqFilter?.value !== undefined && eqFilter.value !== "") {
    return {
      mode: "values" as NumericUiMode,
      selected: [eqFilter.value],
      multi: false,
      min: "",
      max: "",
    };
  }
  const min = filters.find((filter) => filter.op === "gte")?.value || "";
  const max = filters.find((filter) => filter.op === "lte")?.value || "";
  if (min !== "" || max !== "") {
    return {
      mode: "range" as NumericUiMode,
      selected: [] as string[],
      multi: false,
      min,
      max,
    };
  }
  return {
    mode: (preferDiscrete ? "values" : "range") as NumericUiMode,
    selected: [] as string[],
    multi: false,
    min: "",
    max: "",
  };
}

function emitNumericFilters(
  column: string,
  mode: NumericUiMode,
  selected: string[],
  multi: boolean,
  min: string,
  max: string
): DataTableFilter[] {
  if (mode === "isNull") {
    return [{ column, op: "isNull" }];
  }
  if (mode === "notNull") {
    return [{ column, op: "notNull" }];
  }
  if (mode === "values") {
    if (selected.length === 0) {
      return [{ column, op: "eq", value: "" }];
    }
    if (multi || selected.length > 1) {
      return [{ column, op: "in", values: selected }];
    }
    return [{ column, op: "eq", value: selected[0] }];
  }
  const next: DataTableFilter[] = [];
  if (min !== "") {
    next.push({ column, op: "gte", value: min });
  }
  if (max !== "") {
    next.push({ column, op: "lte", value: max });
  }
  return next.length ? next : [{ column, op: "notNull" }];
}

function formatNumberLabel(value: string | number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return String(value);
  }
  // Never add thousands separators — years like 1999 must stay "1999",
  // and filter equality values should match the source data exactly.
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 6,
    useGrouping: false,
  });
}

function parseFiniteNumber(value: string, fallback: number) {
  if (value === "") {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function niceStep(min: number, max: number, preferInteger: boolean) {
  const span = Math.abs(max - min);
  if (!Number.isFinite(span) || span === 0) {
    return preferInteger ? 1 : 0.01;
  }
  if (preferInteger || (Number.isInteger(min) && Number.isInteger(max))) {
    return 1;
  }
  // Aim for ~100 steps across the span.
  const rough = span / 100;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

function clampRange(
  nextMin: number,
  nextMax: number,
  boundMin: number,
  boundMax: number
): [number, number] {
  let lo = Math.min(nextMin, nextMax);
  let hi = Math.max(nextMin, nextMax);
  lo = Math.min(Math.max(lo, boundMin), boundMax);
  hi = Math.min(Math.max(hi, boundMin), boundMax);
  if (lo > hi) {
    return [hi, hi];
  }
  return [lo, hi];
}

function serializeBound(value: number, preferInteger: boolean) {
  if (preferInteger) {
    return String(Math.round(value));
  }
  // Avoid long float noise in query params / labels.
  const rounded = Number(value.toPrecision(10));
  return String(rounded);
}

/**
 * Compact single-line numeric filter for the data-table legend.
 * Discrete columns (few unique values) default to equality selection;
 * continuous columns default to a min/max range.
 */
export default function DataTableNumericFilter({
  column,
  filters,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const preferDiscrete = useMemo(
    () => prefersDiscreteNumericFilter(column),
    [column]
  );
  const parsed = useMemo(
    () => parseNumericFilterState(filters, preferDiscrete),
    [filters, preferDiscrete]
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<NumericUiMode>(parsed.mode);
  const [multi, setMulti] = useState(parsed.multi);
  const [selected, setSelected] = useState<string[]>(parsed.selected);
  const [min, setMin] = useState(parsed.min);
  const [max, setMax] = useState(parsed.max);
  const [draftRange, setDraftRange] = useState<[number, number] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const pendingTypeRef = useRef("");

  const allValues = useMemo(
    () =>
      numericKeys(column)
        .map((entry) => entry.raw)
        .reverse(),
    [column]
  );
  const bounds = useMemo(() => {
    const keys = numericKeys(column);
    const boundMin =
      column.min !== undefined && Number.isFinite(column.min)
        ? column.min
        : keys[0]?.num;
    const boundMax =
      column.max !== undefined && Number.isFinite(column.max)
        ? column.max
        : keys[Math.max(keys.length - 1, 0)]?.num;
    const preferInteger =
      (boundMin === undefined || Number.isInteger(boundMin)) &&
      (boundMax === undefined || Number.isInteger(boundMax)) &&
      keys.every((entry) => Number.isInteger(entry.num));
    return {
      min: boundMin,
      max: boundMax,
      minLabel: boundMin === undefined ? "" : String(boundMin),
      maxLabel: boundMax === undefined ? "" : String(boundMax),
      preferInteger,
      step:
        boundMin !== undefined && boundMax !== undefined
          ? niceStep(boundMin, boundMax, preferInteger)
          : preferInteger
          ? 1
          : 0.01,
    };
  }, [column]);

  const filteredValues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allValues;
    }
    return allValues.filter((value) => value.toLowerCase().includes(q));
  }, [allValues, query]);

  /** First selected value in list order — used to scroll into view on open. */
  const scrollTargetValue = useMemo(() => {
    if (mode !== "values" || selected.length === 0) {
      return undefined;
    }
    return filteredValues.find((value) => selected.includes(value));
  }, [filteredValues, mode, selected]);

  const committedRange = useMemo((): [number, number] | null => {
    if (bounds.min === undefined || bounds.max === undefined) {
      return null;
    }
    return clampRange(
      parseFiniteNumber(min, bounds.min),
      parseFiniteNumber(max, bounds.max),
      bounds.min,
      bounds.max
    );
  }, [bounds.max, bounds.min, max, min]);

  const sliderValue = draftRange || committedRange;

  useEffect(() => {
    if (!open) {
      setMode(parsed.mode);
      setMulti(parsed.multi);
      setSelected(parsed.selected);
      setMin(parsed.min);
      setMax(parsed.max);
      setDraftRange(null);
      setQuery("");
      pendingTypeRef.current = "";
    }
  }, [open, parsed]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Wait for the popover list to lay out, then focus search and bring the
    // current selection into view (important for long lists like years).
    const frame = window.requestAnimationFrame(() => {
      if (mode !== "values") {
        return;
      }
      searchRef.current?.focus();
      if (pendingTypeRef.current) {
        setQuery(pendingTypeRef.current);
        pendingTypeRef.current = "";
        return;
      }
      const list = listRef.current;
      const item = selectedOptionRef.current;
      if (list && item) {
        // Scroll only the options list — avoid scrolling the map behind.
        const itemOffset =
          item.getBoundingClientRect().top -
          list.getBoundingClientRect().top +
          list.scrollTop;
        list.scrollTop =
          itemOffset - list.clientHeight / 2 + item.clientHeight / 2;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, mode]);

  const commit = (
    nextMode: NumericUiMode,
    nextSelected: string[],
    nextMulti: boolean,
    nextMin: string,
    nextMax: string
  ) => {
    onChange(
      emitNumericFilters(
        column.attribute,
        nextMode,
        nextSelected,
        nextMulti,
        nextMin,
        nextMax
      )
    );
  };

  const displayLabel = (() => {
    if (mode === "isNull") {
      return t("Is blank");
    }
    if (mode === "notNull") {
      return t("Has a value");
    }
    if (mode === "range") {
      const live = draftRange || committedRange;
      if (live) {
        // eslint-disable-next-line i18next/no-literal-string
        return `${formatNumberLabel(live[0])} – ${formatNumberLabel(live[1])}`;
      }
      if (min !== "" && max !== "") {
        // eslint-disable-next-line i18next/no-literal-string
        return `${formatNumberLabel(min)} – ${formatNumberLabel(max)}`;
      }
      if (min !== "") {
        // eslint-disable-next-line i18next/no-literal-string
        return `≥ ${formatNumberLabel(min)}`;
      }
      if (max !== "") {
        // eslint-disable-next-line i18next/no-literal-string
        return `≤ ${formatNumberLabel(max)}`;
      }
      return t("Any range");
    }
    if (selected.length === 0) {
      return t("Select a value");
    }
    if (selected.length === 1) {
      return formatNumberLabel(selected[0]);
    }
    // eslint-disable-next-line i18next/no-literal-string
    return `${selected.length} ${t("selected")}`;
  })();

  const selectSingle = (value: string) => {
    setMode("values");
    setSelected([value]);
    commit("values", [value], false, min, max);
    setOpen(false);
  };

  const toggleMultiValue = (value: string) => {
    let nextSelected = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];
    if (nextSelected.length === 0 && allValues[0]) {
      nextSelected = [allValues[0]];
    }
    setMode("values");
    setSelected(nextSelected);
    commit("values", nextSelected, true, min, max);
  };

  const switchToValues = () => {
    const nextSelected =
      selected.length > 0
        ? selected
        : allValues[0]
        ? [allValues[0]]
        : [];
    setMode("values");
    setSelected(nextSelected);
    commit("values", nextSelected, multi, min, max);
  };

  const switchToRange = () => {
    if (bounds.min === undefined || bounds.max === undefined) {
      return;
    }
    const [nextMinNum, nextMaxNum] = clampRange(
      parseFiniteNumber(min, bounds.min),
      parseFiniteNumber(max, bounds.max),
      bounds.min,
      bounds.max
    );
    const nextMin = serializeBound(nextMinNum, bounds.preferInteger);
    const nextMax = serializeBound(nextMaxNum, bounds.preferInteger);
    setMode("range");
    setMin(nextMin);
    setMax(nextMax);
    setDraftRange(null);
    commit("range", selected, multi, nextMin, nextMax);
  };

  const setNullMode = (nextMode: "isNull" | "notNull") => {
    setMode(nextMode);
    setSelected([]);
    setDraftRange(null);
    commit(nextMode, [], multi, min, max);
    setOpen(false);
  };

  const onMultiToggle = (enabled: boolean) => {
    setMulti(enabled);
    if (!enabled) {
      const nextSelected = selected.slice(0, 1);
      setSelected(nextSelected);
      if (mode === "values") {
        commit("values", nextSelected, false, min, max);
      }
      return;
    }
    if (mode === "values") {
      commit("values", selected, true, min, max);
    }
  };

  const onRangeChange = (nextMin: string, nextMax: string) => {
    setMode("range");
    setMin(nextMin);
    setMax(nextMax);
    setDraftRange(null);
    commit("range", selected, multi, nextMin, nextMax);
  };

  const onSliderDrag = (values: number[]) => {
    if (bounds.min === undefined || bounds.max === undefined) {
      return;
    }
    const [lo, hi] = clampRange(
      values[0],
      values[1] ?? values[0],
      bounds.min,
      bounds.max
    );
    setMode("range");
    setDraftRange([lo, hi]);
  };

  const onSliderCommit = (values: number[]) => {
    if (bounds.min === undefined || bounds.max === undefined) {
      return;
    }
    const [lo, hi] = clampRange(
      values[0],
      values[1] ?? values[0],
      bounds.min,
      bounds.max
    );
    const nextMin = serializeBound(lo, bounds.preferInteger);
    const nextMax = serializeBound(hi, bounds.preferInteger);
    setDraftRange(null);
    onRangeChange(nextMin, nextMax);
  };

  const onExactMinChange = (raw: string) => {
    if (bounds.min === undefined || bounds.max === undefined) {
      onRangeChange(raw, max);
      return;
    }
    if (raw === "") {
      onRangeChange("", max);
      return;
    }
    const parsedMin = Number(raw);
    if (!Number.isFinite(parsedMin)) {
      setMin(raw);
      return;
    }
    const currentMax = parseFiniteNumber(max, bounds.max);
    const [lo, hi] = clampRange(parsedMin, currentMax, bounds.min, bounds.max);
    onRangeChange(
      serializeBound(lo, bounds.preferInteger),
      serializeBound(hi, bounds.preferInteger)
    );
  };

  const onExactMaxChange = (raw: string) => {
    if (bounds.min === undefined || bounds.max === undefined) {
      onRangeChange(min, raw);
      return;
    }
    if (raw === "") {
      onRangeChange(min, "");
      return;
    }
    const parsedMax = Number(raw);
    if (!Number.isFinite(parsedMax)) {
      setMax(raw);
      return;
    }
    const currentMin = parseFiniteNumber(min, bounds.min);
    const [lo, hi] = clampRange(currentMin, parsedMax, bounds.min, bounds.max);
    onRangeChange(
      serializeBound(lo, bounds.preferInteger),
      serializeBound(hi, bounds.preferInteger)
    );
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      pendingTypeRef.current = event.key;
      if (mode !== "values") {
        setMode("values");
      }
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
          className="z-[100] w-64 rounded-md border border-black/10 bg-white shadow-lg overflow-hidden data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (mode === "values") {
              searchRef.current?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <div className="border-b border-black/5 px-2 py-1.5">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={switchToValues}
                disabled={allValues.length === 0}
                className={clsx(
                  "rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                  mode === "values"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t("Values")}
              </button>
              <button
                type="button"
                onClick={switchToRange}
                disabled={bounds.min === undefined || bounds.max === undefined}
                className={clsx(
                  "rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                  mode === "range"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t("Range")}
              </button>
            </div>
          </div>

          {(mode === "isNull" || mode === "notNull") && (
            <div className="px-2.5 py-1.5 text-[11px] text-gray-500 border-b border-black/5 bg-amber-50/70">
              {mode === "isNull"
                ? t("Filtering to blank values. Pick a value or range to switch.")
                : t(
                    "Filtering to any non-blank value. Pick a value or range to switch."
                  )}
            </div>
          )}

          {mode === "range" ||
          ((mode === "isNull" || mode === "notNull") && !preferDiscrete) ? (
            <div className="px-3 py-3 space-y-3">
              {sliderValue &&
              bounds.min !== undefined &&
              bounds.max !== undefined ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums text-gray-800">
                      {formatNumberLabel(sliderValue[0])}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      {t("to")}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-gray-800">
                      {formatNumberLabel(sliderValue[1])}
                    </span>
                  </div>
                  <Slider.Root
                    className="relative flex w-full touch-none select-none items-center py-2"
                    value={sliderValue}
                    min={bounds.min}
                    max={bounds.max}
                    step={bounds.step}
                    minStepsBetweenThumbs={0}
                    onValueChange={onSliderDrag}
                    onValueCommit={onSliderCommit}
                    onPointerDown={() => {
                      if (mode !== "range") {
                        setMode("range");
                      }
                    }}
                  >
                    <Slider.Track className="relative h-1.5 grow rounded-full bg-gray-200">
                      <Slider.Range className="absolute h-full rounded-full bg-primary-500" />
                    </Slider.Track>
                    <Slider.Thumb
                      aria-label={t("Minimum")}
                      className="block h-4 w-4 rounded-full border border-primary-600 bg-white shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                    />
                    <Slider.Thumb
                      aria-label={t("Maximum")}
                      className="block h-4 w-4 rounded-full border border-primary-600 bg-white shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                    />
                  </Slider.Root>
                  <div className="flex justify-between text-[10px] tabular-nums text-gray-400">
                    <span>{formatNumberLabel(bounds.min)}</span>
                    <span>{formatNumberLabel(bounds.max)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0 space-y-0.5">
                      <span className="block text-[10px] font-medium text-gray-500">
                        {t("Min")}
                      </span>
                      <input
                        type="number"
                        value={
                          draftRange
                            ? serializeBound(
                                draftRange[0],
                                bounds.preferInteger
                              )
                            : min
                        }
                        min={bounds.min}
                        max={bounds.max}
                        step={bounds.step}
                        onChange={(e) => onExactMinChange(e.target.value)}
                        onFocus={() => {
                          if (mode !== "range") {
                            setMode("range");
                          }
                        }}
                        className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-0 focus:border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
                      />
                    </label>
                    <label className="min-w-0 space-y-0.5">
                      <span className="block text-[10px] font-medium text-gray-500">
                        {t("Max")}
                      </span>
                      <input
                        type="number"
                        value={
                          draftRange
                            ? serializeBound(
                                draftRange[1],
                                bounds.preferInteger
                              )
                            : max
                        }
                        min={bounds.min}
                        max={bounds.max}
                        step={bounds.step}
                        onChange={(e) => onExactMaxChange(e.target.value)}
                        onFocus={() => {
                          if (mode !== "range") {
                            setMode("range");
                          }
                        }}
                        className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-0 focus:border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  {t("Range bounds are not available for this column.")}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-black/5 px-2 py-1.5">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Search {{count}} options...", {
                      count: allValues.length,
                    })}
                    className="w-full rounded border border-gray-200 bg-gray-50 pl-7 pr-2 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500"
                  />
                </div>
              </div>
              <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
                {filteredValues.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">
                    {t("No matching values")}
                  </p>
                ) : (
                  filteredValues.map((value) => {
                    const isSelected =
                      mode === "values" && selected.includes(value);
                    return (
                      <button
                        key={value}
                        ref={
                          value === scrollTargetValue
                            ? selectedOptionRef
                            : undefined
                        }
                        type="button"
                        className={clsx(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-gray-50",
                          isSelected && "bg-primary-50/60"
                        )}
                        onClick={() => {
                          if (multi) {
                            toggleMultiValue(value);
                          } else {
                            selectSingle(value);
                          }
                        }}
                      >
                        <span
                          className={clsx(
                            "flex-none w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
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
                        <span className="truncate text-gray-800">
                          {formatNumberLabel(value)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="border-t border-black/5 px-2 py-1.5 space-y-1.5 bg-gray-50/80">
            {mode === "values" && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-0 focus-visible:ring-1 focus-visible:ring-primary-500"
                  checked={multi}
                  onChange={(e) => onMultiToggle(e.target.checked)}
                />
                <span>{t("Select multiple")}</span>
              </label>
            )}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setNullMode("notNull")}
                className={clsx(
                  "flex-1 rounded px-1.5 py-1 text-[11px] border transition-colors",
                  mode === "notNull"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {t("Has a value")}
              </button>
              <button
                type="button"
                onClick={() => setNullMode("isNull")}
                className={clsx(
                  "flex-1 rounded px-1.5 py-1 text-[11px] border transition-colors",
                  mode === "isNull"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {t("Is blank")}
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
