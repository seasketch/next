import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { TooltipPopoverContent } from "../../editor/TooltipMenu";
import { TooltipBooleanConfigurationOption } from "./reportWidgetShared";
import { LabeledDropdown } from "./LabeledDropdown";
import {
  defaultTravelCostSettings,
  efficiencyUnitLabel,
  isTravelCostSettings,
  listCurrencyChoices,
  parseTravelCostNumber,
  priceUnitLabel,
  TravelCostSettings,
  travelCostNumberText,
  travelCostsUsable,
  withTravelCostPatch,
} from "./travelCost";

function settingsOrDefault(
  value: unknown,
  mapUnit: string | undefined
): TravelCostSettings {
  if (isTravelCostSettings(value)) return value;
  return { ...defaultTravelCostSettings(mapUnit), enabled: false };
}

function StoredNumberField({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string;
  value: number | null;
  suffix: string;
  onCommit: (next: number | null) => void;
}) {
  const [text, setText] = useState(travelCostNumberText(value));
  useEffect(() => {
    setText(travelCostNumberText(value));
  }, [value]);

  return (
    <label className="flex items-center justify-between gap-2 text-sm text-gray-800">
      <span className="font-light text-gray-400 whitespace-nowrap">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={text}
          aria-label={label}
          className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-right text-sm tabular-nums"
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            const trimmed = text.trim();
            if (!trimmed) {
              setText("");
              if (value != null) onCommit(null);
              return;
            }
            const parsed = parseTravelCostNumber(trimmed);
            if (parsed == null) {
              setText(travelCostNumberText(value));
              return;
            }
            setText(String(parsed));
            if (parsed !== value) onCommit(parsed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="whitespace-nowrap text-xs text-gray-500">{suffix}</span>
      </span>
    </label>
  );
}

function CurrencyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { t, i18n } = useTranslation("admin:reports");
  const choices = useMemo(
    () => listCurrencyChoices(i18n.language),
    [i18n.language]
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const selectedCode = value.trim().toUpperCase();
  const selected = choices.find((choice) => choice.code === selectedCode);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return choices;
    return choices.filter(
      (choice) =>
        choice.code.toLowerCase().includes(needle) ||
        choice.name.toLowerCase().includes(needle)
    );
  }, [choices, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex(
      (choice) => choice.code === selectedCode
    );
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, query, filtered, selectedCode]);

  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const choose = (code: string) => {
    onChange(code);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`space-y-1 ${open ? "relative z-20" : ""}`}>
      <span className="block text-sm font-light text-gray-400">
        {t("Currency")}
      </span>
      <button
        type="button"
        aria-label={t("Currency")}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-left text-sm text-gray-900"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">
          {selected
            ? t("{{code}} · {{name}}", {
                code: selected.code,
                name: selected.name,
              })
            : t("Choose a currency")}
        </span>
        {open ? (
          <ChevronUpIcon className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-60 flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <input
            type="search"
            value={query}
            autoFocus
            placeholder={t("Search currencies")}
            aria-label={t("Search currencies")}
            className="shrink-0 border-0 border-b border-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-0"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((current) =>
                  Math.min(current + 1, Math.max(filtered.length - 1, 0))
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter" && filtered[highlight]) {
                event.preventDefault();
                choose(filtered[highlight].code);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <ul ref={listRef} className="min-h-0 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-2 py-1 text-sm text-gray-500">
                {t("No matching currency")}
              </li>
            ) : (
              filtered.map((choice, index) => (
                <li key={choice.code}>
                  <button
                    type="button"
                    role="option"
                    data-index={index}
                    aria-selected={choice.code === selectedCode}
                    className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-sm ${
                      index === highlight ? "bg-gray-100" : "hover:bg-gray-50"
                    } ${choice.code === selectedCode ? "font-medium" : ""}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(choice.code)}
                  >
                    <span className="w-10 shrink-0 tabular-nums">
                      {choice.code}
                    </span>
                    <span className="min-w-0 text-gray-600">{choice.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function TravelCostPopover({
  mapUnit,
  value,
  onChange,
}: {
  mapUnit: string | undefined;
  value: unknown;
  onChange: (next: TravelCostSettings) => void;
}) {
  const { t } = useTranslation("admin:reports");
  const settings = settingsOrDefault(value, mapUnit);
  const canShow = travelCostsUsable(settings);
  const shown = settings.enabled && canShow;

  const commit = (patch: Partial<TravelCostSettings>) => {
    const next = withTravelCostPatch(settings, patch);
    onChange(
      next.enabled && !travelCostsUsable(next)
        ? { ...next, enabled: false }
        : next
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
        >
          {t("Fuel assumptions")}
        </button>
      </Popover.Trigger>
      <TooltipPopoverContent title={t("Fuel assumptions")} align="end">
        <div className="w-80 space-y-2 px-1 pb-1">
          <p className="text-xs leading-snug text-gray-500">
            {t(
              "These are planning assumptions for fuel use and price. They are not a quote."
            )}
          </p>
          <CurrencyField
            value={settings.currency}
            onChange={(currency) => commit({ currency })}
          />
          <LabeledDropdown
            label={t("Volume")}
            value={settings.volume}
            ariaLabel={t("Volume")}
            truncateValue={false}
            modal={false}
            options={[
              { value: "liter", label: t("Liters") },
              { value: "gallon", label: t("US gallons") },
              { value: "imperial-gallon", label: t("Imperial gallons") },
            ]}
            onChange={(next) => {
              if (
                next === "liter" ||
                next === "gallon" ||
                next === "imperial-gallon"
              ) {
                commit({ volume: next });
              }
            }}
          />
          <LabeledDropdown
            label={t("Fuel use")}
            value={settings.efficiencyMode}
            ariaLabel={t("Fuel use")}
            truncateValue={false}
            modal={false}
            options={[
              {
                value: "distance-per-volume",
                label: t("Distance per volume"),
              },
              {
                value: "volume-per-distance",
                label: t("Volume per distance"),
              },
            ]}
            onChange={(next) => {
              if (
                next === "distance-per-volume" ||
                next === "volume-per-distance"
              ) {
                commit({ efficiencyMode: next });
              }
            }}
          />
          <LabeledDropdown
            label={t("Length")}
            value={settings.efficiencyLength}
            ariaLabel={t("Length")}
            truncateValue={false}
            modal={false}
            options={[
              { value: "kilometer", label: t("Kilometers") },
              { value: "nautical-mile", label: t("Nautical miles") },
              { value: "mile", label: t("Miles") },
            ]}
            onChange={(next) => {
              if (
                next === "kilometer" ||
                next === "nautical-mile" ||
                next === "mile"
              ) {
                commit({ efficiencyLength: next });
              }
            }}
          />
          <StoredNumberField
            label={t("Default fuel use")}
            value={settings.defaultEfficiency}
            suffix={efficiencyUnitLabel(settings)}
            onCommit={(next) => commit({ defaultEfficiency: next })}
          />
          <StoredNumberField
            label={t("Default price")}
            value={settings.defaultPrice}
            suffix={priceUnitLabel(settings)}
            onCommit={(next) => commit({ defaultPrice: next })}
          />
          {canShow ? null : (
            <p className="text-xs leading-snug text-gray-500">
              {t(
                "Set a currency, fuel use, and price to show fuel assumptions."
              )}
            </p>
          )}
          <TooltipBooleanConfigurationOption
            label={t("Show fuel assumptions")}
            checked={shown}
            disabled={!canShow}
            checkboxFirst
            onChange={(next) => {
              if (next && !canShow) return;
              commit({ enabled: next });
            }}
          />
        </div>
      </TooltipPopoverContent>
    </Popover.Root>
  );
}
