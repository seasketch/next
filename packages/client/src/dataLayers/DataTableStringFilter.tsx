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
import { GeostatsAttribute } from "@seasketch/geostats-types";
import {
  DataTableFilter,
  dataTableInFilterValues,
} from "./dataTableQueryApi";
import clsx from "clsx";

type StringFilterMode = "value" | "isNull" | "notNull";

function parseStringFilterState(filters: DataTableFilter[]) {
  if (filters.some((filter) => filter.op === "isNull")) {
    return {
      mode: "isNull" as StringFilterMode,
      selected: [] as string[],
      multi: false,
    };
  }
  if (filters.some((filter) => filter.op === "notNull")) {
    return {
      mode: "notNull" as StringFilterMode,
      selected: [] as string[],
      multi: false,
    };
  }
  const inFilter = filters.find((filter) => filter.op === "in");
  if (inFilter) {
    return {
      mode: "value" as StringFilterMode,
      selected: dataTableInFilterValues(inFilter),
      multi: true,
    };
  }
  const eqFilter = filters.find((filter) => filter.op === "eq");
  if (eqFilter?.value) {
    return {
      mode: "value" as StringFilterMode,
      selected: [eqFilter.value],
      multi: false,
    };
  }
  return {
    mode: "value" as StringFilterMode,
    selected: [] as string[],
    multi: false,
  };
}

function emitStringFilters(
  column: string,
  mode: StringFilterMode,
  selected: string[],
  multi: boolean
): DataTableFilter[] {
  if (mode === "isNull") {
    return [{ column, op: "isNull" }];
  }
  if (mode === "notNull") {
    return [{ column, op: "notNull" }];
  }
  if (selected.length === 0) {
    // Callers should avoid committing an empty value selection.
    return [{ column, op: "eq", value: "" }];
  }
  if (multi || selected.length > 1) {
    return [{ column, op: "in", values: selected }];
  }
  return [{ column, op: "eq", value: selected[0] }];
}

function alphabetize(values: string[]) {
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/**
 * Compact single-line string filter for the data-table legend.
 * Trigger shows the current selection; popover handles search, single/multi
 * equality, and null / has-value modes.
 */
export default function DataTableStringFilter({
  column,
  filters,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const parsed = useMemo(() => parseStringFilterState(filters), [filters]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [multi, setMulti] = useState(parsed.multi);
  const [mode, setMode] = useState<StringFilterMode>(parsed.mode);
  const [selected, setSelected] = useState<string[]>(parsed.selected);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef("");

  const allValues = useMemo(
    () => alphabetize(Object.keys(column.values || {})),
    [column.values]
  );

  const filteredValues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allValues;
    }
    return allValues.filter((value) => value.toLowerCase().includes(q));
  }, [allValues, query]);

  useEffect(() => {
    if (!open) {
      setMulti(parsed.multi);
      setMode(parsed.mode);
      setSelected(parsed.selected);
      setQuery("");
      pendingTypeRef.current = "";
    }
  }, [open, parsed]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      if (pendingTypeRef.current) {
        setQuery(pendingTypeRef.current);
        pendingTypeRef.current = "";
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const commit = (
    nextMode: StringFilterMode,
    nextSelected: string[],
    nextMulti: boolean
  ) => {
    onChange(
      emitStringFilters(column.attribute, nextMode, nextSelected, nextMulti)
    );
  };

  const displayLabel = (() => {
    if (mode === "isNull") {
      return t("Is blank");
    }
    if (mode === "notNull") {
      return t("Has a value");
    }
    if (selected.length === 0) {
      return t("Select a value");
    }
    if (selected.length === 1) {
      return selected[0];
    }
    // eslint-disable-next-line i18next/no-literal-string
    return `${selected.length} ${t("selected")}`;
  })();

  const selectSingle = (value: string) => {
    const nextSelected = [value];
    setMode("value");
    setSelected(nextSelected);
    commit("value", nextSelected, false);
    setOpen(false);
  };

  const toggleMultiValue = (value: string) => {
    let nextSelected = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];
    // Keep at least one value selected in multi mode so we don't fall back
    // to a "has a value" filter.
    if (nextSelected.length === 0 && allValues[0]) {
      nextSelected = [allValues[0]];
    }
    setMode("value");
    setSelected(nextSelected);
    commit("value", nextSelected, true);
  };

  const setNullMode = (nextMode: "isNull" | "notNull") => {
    setMode(nextMode);
    setSelected([]);
    commit(nextMode, [], multi);
    setOpen(false);
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
          className="z-[100] w-64 rounded-md border border-black/10 bg-white shadow-lg overflow-hidden data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade"
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
                placeholder={t("Search...")}
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

          <div className="max-h-48 overflow-y-auto py-1">
            {filteredValues.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 italic">
                {t("No matching values")}
              </p>
            ) : (
              filteredValues.map((value) => {
                const isSelected = mode === "value" && selected.includes(value);
                return (
                  <button
                    key={value}
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
                    <span className="truncate text-gray-800">{value}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-black/5 px-2 py-1.5 space-y-1.5 bg-gray-50/80">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-0 focus-visible:ring-1 focus-visible:ring-primary-500"
                checked={multi}
                onChange={(e) => onMultiToggle(e.target.checked)}
              />
              <span>{t("Select multiple")}</span>
            </label>
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
