import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
  MAX_DISTANCE_TO_FEATURES_KM,
  MAX_WATER_PATH_RESULTS,
  MetricDependency,
  MetricDependencyParameters,
} from "overlay-engine";
import { LabeledDropdown } from "./LabeledDropdown";

type DistanceToPointSearchFieldsProps = {
  metrics: MetricDependency[];
  onUpdateDependencyParameters: (
    updateFn: (dependency: MetricDependency) => MetricDependencyParameters
  ) => void;
  /** Inline metrics always search for the single nearest point. */
  showMaxMatches?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type WaterPathResolution = "low" | "medium" | "high";

function storedResolution(
  parameters: MetricDependencyParameters | undefined
): WaterPathResolution {
  return parameters?.resolution === "low" || parameters?.resolution === "medium"
    ? parameters.resolution
    : "high";
}

function commitWaterPathParameters(
  onUpdateDependencyParameters: DistanceToPointSearchFieldsProps["onUpdateDependencyParameters"],
  patch: {
    maxResults?: number;
    maxDistanceKm?: number;
    resolution?: WaterPathResolution;
  }
) {
  onUpdateDependencyParameters((dependency) => {
    if (dependency.type !== "distance_to_features_over_water") {
      return { ...dependency.parameters };
    }
    return { ...dependency.parameters, ...patch };
  });
}

/**
 * How many nearest points to return, and how far to search. Both are metric
 * parameters, so changing them recalculates the overlay. Call this from the
 * tooltip controls so the legacy-radius rewrite and the single-match pin run
 * while the tooltip is open, even though the inputs live in More.
 */
export function useDistanceToPointSearchDraft({
  metrics,
  onUpdateDependencyParameters,
  showMaxMatches = true,
  active = true,
}: DistanceToPointSearchFieldsProps & { active?: boolean }) {
  const parameters = metrics[0]?.parameters;
  const storedResults =
    parameters?.maxResults ?? DEFAULT_WATER_PATH_MAX_RESULTS;
  // Widgets created before the radius was 300 km stored 200 statute miles.
  const legacyDefaultKm = 200 * 1.609344;
  const storedKm =
    parameters?.maxDistanceKm == null ||
    Math.abs(parameters.maxDistanceKm - legacyDefaultKm) < 1e-3
      ? DEFAULT_WATER_PATH_DISTANCE_KM
      : parameters.maxDistanceKm;
  const [resultsText, setResultsText] = useState(String(storedResults));
  const [kmText, setKmText] = useState(String(storedKm));

  useEffect(() => {
    setResultsText(String(storedResults));
  }, [storedResults]);

  useEffect(() => {
    setKmText(String(storedKm));
  }, [storedKm]);

  const pinnedSingleResult = useRef(false);
  useEffect(() => {
    if (
      !active ||
      showMaxMatches ||
      pinnedSingleResult.current ||
      storedResults === 1
    ) {
      return;
    }
    pinnedSingleResult.current = true;
    commitWaterPathParameters(onUpdateDependencyParameters, { maxResults: 1 });
  }, [active, onUpdateDependencyParameters, showMaxMatches, storedResults]);

  const migratedLegacyKm = useRef(false);
  useEffect(() => {
    if (!active || migratedLegacyKm.current) return;
    if (
      parameters?.maxDistanceKm == null ||
      Math.abs(parameters.maxDistanceKm - legacyDefaultKm) >= 1e-3
    ) {
      return;
    }
    migratedLegacyKm.current = true;
    onUpdateDependencyParameters((dependency) => {
      if (dependency.type !== "distance_to_features_over_water") {
        return { ...dependency.parameters };
      }
      return {
        ...dependency.parameters,
        maxDistanceKm: DEFAULT_WATER_PATH_DISTANCE_KM,
      };
    });
  }, [
    active,
    legacyDefaultKm,
    onUpdateDependencyParameters,
    parameters?.maxDistanceKm,
  ]);

  const commit = (patch: {
    maxResults?: number;
    maxDistanceKm?: number;
  }) => {
    commitWaterPathParameters(onUpdateDependencyParameters, patch);
  };

  return {
    showMaxMatches,
    resultsText,
    setResultsText,
    kmText,
    setKmText,
    storedResults,
    storedKm,
    commit,
  };
}

export function DistanceToPointSearchInputs({
  showMaxMatches,
  resultsText,
  setResultsText,
  kmText,
  setKmText,
  storedResults,
  storedKm,
  commit,
}: ReturnType<typeof useDistanceToPointSearchDraft>) {
  const { t } = useTranslation("admin:reports");
  const numberRowClass = "flex items-center text-sm text-gray-800";
  const numberInputClass =
    "ml-auto h-6 w-16 rounded border border-gray-200 px-1.5 text-right text-sm tabular-nums";
  return (
    <div className="space-y-2">
      {showMaxMatches ? (
        <label className={numberRowClass}>
          <span className="font-light text-gray-400 whitespace-nowrap">
            {t("Max matches")}
          </span>
          <input
            type="number"
            min={1}
            max={MAX_WATER_PATH_RESULTS}
            step={1}
            value={resultsText}
            aria-label={t("Max matches")}
            className={numberInputClass}
            onChange={(event) => setResultsText(event.target.value)}
            onBlur={() => {
              const parsed = Number.parseInt(resultsText, 10);
              if (!Number.isFinite(parsed)) {
                setResultsText(String(storedResults));
                return;
              }
              const next = clamp(parsed, 1, MAX_WATER_PATH_RESULTS);
              setResultsText(String(next));
              if (next !== storedResults) commit({ maxResults: next });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      ) : null}
      <label className={numberRowClass}>
        <span className="font-light text-gray-400 whitespace-nowrap">
          {t("Max km")}
        </span>
        <input
          type="number"
          min={1}
          max={MAX_DISTANCE_TO_FEATURES_KM}
          step={1}
          value={kmText}
          aria-label={t("Max km")}
          className={numberInputClass}
          onChange={(event) => setKmText(event.target.value)}
          onBlur={() => {
            const parsed = Number.parseFloat(kmText);
            if (!Number.isFinite(parsed)) {
              setKmText(String(storedKm));
              return;
            }
            const next = clamp(parsed, 1, MAX_DISTANCE_TO_FEATURES_KM);
            setKmText(String(next));
            if (next !== storedKm) commit({ maxDistanceKm: next });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </label>
    </div>
  );
}

/** Coarser routes recalculate the overlay, so this stays out of the main row. */
export function DistanceToPointResolutionField({
  metrics,
  onUpdateDependencyParameters,
}: DistanceToPointSearchFieldsProps) {
  const { t } = useTranslation("admin:reports");
  const resolution = storedResolution(metrics[0]?.parameters);
  return (
    <LabeledDropdown
      label={t("Search resolution")}
      value={resolution}
      ariaLabel={t("Search resolution")}
      modal={false}
      options={[
        { value: "low", label: t("Low") },
        { value: "medium", label: t("Medium") },
        { value: "high", label: t("High") },
      ]}
      onChange={(value) => {
        const next =
          value === "low" || value === "medium" || value === "high"
            ? value
            : "high";
        if (next !== resolution) {
          commitWaterPathParameters(onUpdateDependencyParameters, {
            resolution: next,
          });
        }
      }}
    />
  );
}
