import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MetricDependency } from "overlay-engine";
import { LabeledDropdown } from "./LabeledDropdown";
import {
  TooltipDropdownOption,
  TooltipInfoIcon,
} from "../../editor/TooltipMenu";

export type BufferSettings = {
  /** Buffer distance in kilometers. `undefined` means buffering is off. */
  distanceKm?: number;
  /**
   * When true, geography-scoped dependencies use the same buffer distance as
   * fragments. Defaults to true for new / unbuffered configs.
   */
  bufferGeography: boolean;
};

const NONE_VALUE = "__buffer:none__";
const CUSTOM_VALUE = "__buffer:custom__";
const GEOGRAPHY_TOGGLE_VALUE = "__buffer:geography__";
const PRESET_KM = [0.5, 1] as const;

function isPresetKm(km: number): boolean {
  return PRESET_KM.some((p) => p === km);
}

function formatKmLabel(km: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "kilometer",
      unitDisplay: "short",
      maximumFractionDigits: 2,
    }).format(km);
  } catch {
    // eslint-disable-next-line i18next/no-literal-string
    return `${km} km`;
  }
}

/**
 * Read buffer distance + geography-buffer flag from metric dependencies.
 *
 * - Distance comes from any dependency with a positive `bufferDistanceKm`
 *   (preferring fragment subjects).
 * - `bufferGeography` is true when geography deps share that buffer, or when
 *   there is no active buffer (new default: buffer geography when enabling).
 */
export function getBufferSettingsFromDependencies(
  dependencies: MetricDependency[]
): BufferSettings {
  const positive = (d: MetricDependency) =>
    typeof d.parameters?.bufferDistanceKm === "number" &&
    d.parameters.bufferDistanceKm > 0;

  const fragmentDep = dependencies.find(
    (d) => d.subjectType !== "geographies" && positive(d)
  );
  const anyDep = dependencies.find(positive);
  const distanceKm =
    fragmentDep?.parameters?.bufferDistanceKm ??
    anyDep?.parameters?.bufferDistanceKm;

  const hasGeographyDeps = dependencies.some(
    (d) => d.subjectType === "geographies"
  );
  const geographyBuffered = dependencies.some(
    (d) => d.subjectType === "geographies" && positive(d)
  );

  const resolvedDistance =
    typeof distanceKm === "number" && distanceKm > 0 ? distanceKm : undefined;

  return {
    distanceKm: resolvedDistance,
    bufferGeography:
      resolvedDistance === undefined
        ? true
        : !hasGeographyDeps
          ? true
          : geographyBuffered,
  };
}

/**
 * Apply buffer settings to one dependency's parameters. Geography subjects
 * only receive `bufferDistanceKm` when `bufferGeography` is on.
 */
export function applyBufferSettingsToParameters(
  dependency: MetricDependency,
  settings: BufferSettings
): Record<string, any> {
  const params = { ...(dependency.parameters || {}) };
  const distance =
    settings.distanceKm !== undefined && settings.distanceKm > 0
      ? settings.distanceKm
      : undefined;

  if (dependency.subjectType === "geographies") {
    params.bufferDistanceKm =
      distance !== undefined && settings.bufferGeography ? distance : undefined;
  } else {
    params.bufferDistanceKm = distance;
  }
  return params;
}

type BufferSelectorProps = {
  distanceKm?: number;
  bufferGeography?: boolean;
  onChange: (next: BufferSettings) => void;
  /**
   * When true, show the "buffer geography" footer checkbox. Use for widgets
   * that have (or may have) geography-scoped metric dependencies.
   */
  showBufferGeography?: boolean;
};

/**
 * Shared buffer control for report widget tooltips. Dropdown for distance
 * (None / 0.5 km / 1 km / custom) with an optional "buffer geography" checkbox
 * footer matching UnitSelector's short-labels pattern.
 */
export function BufferSelector({
  distanceKm,
  bufferGeography = true,
  onChange,
  showBufferGeography = false,
}: BufferSelectorProps) {
  const { t, i18n } = useTranslation("admin:reports");
  const locale = i18n.language?.toLowerCase() || "en";

  // Keep checkbox preference while distance is None so enabling a buffer
  // respects an unchecked "buffer geography" choice made beforehand.
  const [geoBuffered, setGeoBuffered] = useState(bufferGeography);
  useEffect(() => {
    setGeoBuffered(bufferGeography);
  }, [bufferGeography]);

  const activeDistance =
    typeof distanceKm === "number" && distanceKm > 0 ? distanceKm : undefined;
  const isCustomActive =
    activeDistance !== undefined && !isPresetKm(activeDistance);

  const dropdownValue =
    activeDistance === undefined
      ? NONE_VALUE
      : isPresetKm(activeDistance)
        ? String(activeDistance)
        : String(activeDistance);

  const options = useMemo((): TooltipDropdownOption[] => {
    const opts: TooltipDropdownOption[] = [
      { value: NONE_VALUE, label: t("None") },
      ...PRESET_KM.map((km) => ({
        value: String(km),
        label: formatKmLabel(km, locale),
      })),
    ];
    if (isCustomActive && activeDistance !== undefined) {
      opts.push({
        value: String(activeDistance),
        label: formatKmLabel(activeDistance, locale),
      });
    }
    opts.push({ value: CUSTOM_VALUE, label: t("Custom distance") });

    if (showBufferGeography) {
      opts.push({
        value: GEOGRAPHY_TOGGLE_VALUE,
        label: (
          <div className="flex items-center gap-2 space-x-2 text-gray-600 text-xs font-semibold border-t border-black/10 pt-1.5">
            <span>{t("buffer geography")}</span>
            <input
              type="checkbox"
              checked={geoBuffered}
              readOnly
              className="h-3 w-3 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
            />
          </div>
        ),
        preventCloseOnSelect: true,
        className:
          "px-2 py-1 text-sm flex items-center gap-2 rounded cursor-pointer hover:bg-transparent focus:bg-transparent",
      });
    }

    return opts;
  }, [
    t,
    locale,
    isCustomActive,
    activeDistance,
    showBufferGeography,
    geoBuffered,
  ]);

  const promptCustomDistance = (previous?: number): number | undefined | null => {
    const currentValue =
      previous !== undefined && previous > 0 ? String(previous) : "";
    const value = window.prompt(
      t("Enter buffer distance in kilometers"),
      currentValue
    );
    if (value === null) {
      return null; // cancelled
    }
    if (value.trim() === "" || value.trim() === "0") {
      return undefined;
    }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0) {
      return null;
    }
    if (numValue === 0) {
      return undefined;
    }
    return numValue;
  };

  const emit = (nextDistance: number | undefined, nextGeo: boolean) => {
    onChange({
      distanceKm: nextDistance,
      bufferGeography: nextGeo,
    });
  };

  return (
    <LabeledDropdown
      label={t("Buffer")}
      value={dropdownValue}
      ariaLabel={t("Buffer")}
      title={
        <div className="flex items-center space-x-2">
          <span>{t("Buffer")}</span>
          <TooltipInfoIcon
            side="right"
            content={
              <div className="space-y-1.5">
                <p>
                  {t(
                    "Expand the sketch outward by a distance before calculating metrics, so the analysis includes nearby area around the drawn shape. Choose None to use the sketch as drawn."
                  )}
                </p>
                {showBufferGeography && (
                  <p>
                    {t(
                      "When buffer geography is checked, the comparison geography is expanded by the same distance so percentages stay consistent."
                    )}
                  </p>
                )}
              </div>
            }
            className="-mr-1"
          />
        </div>
      }
      options={options}
      getDisplayLabel={(selected) => {
        if (!selected || selected.value === NONE_VALUE) {
          return t("None");
        }
        if (selected.value === CUSTOM_VALUE) {
          return t("Custom distance");
        }
        const km = Number(selected.value);
        if (Number.isFinite(km) && km > 0) {
          return formatKmLabel(km, locale);
        }
        return selected.label;
      }}
      onChange={(next) => {
        if (next === GEOGRAPHY_TOGGLE_VALUE) {
          const nextGeo = !geoBuffered;
          setGeoBuffered(nextGeo);
          emit(activeDistance, nextGeo);
          return;
        }
        if (next === NONE_VALUE) {
          emit(undefined, geoBuffered);
          return;
        }
        if (next === CUSTOM_VALUE) {
          const custom = promptCustomDistance(activeDistance);
          if (custom === null) {
            return;
          }
          emit(custom, geoBuffered);
          return;
        }
        const parsed = Number(next);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          emit(undefined, geoBuffered);
          return;
        }
        emit(parsed, geoBuffered);
      }}
    />
  );
}
