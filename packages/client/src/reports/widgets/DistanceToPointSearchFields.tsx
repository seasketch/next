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
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How many nearest points to return, and how far to search. Both are metric
 * parameters, so changing them recalculates the overlay.
 */
export function DistanceToPointSearchFields({
  metrics,
  onUpdateDependencyParameters,
}: DistanceToPointSearchFieldsProps) {
  const { t } = useTranslation("admin:reports");
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
  const storedResolution =
    parameters?.resolution === "low" || parameters?.resolution === "medium"
      ? parameters.resolution
      : "high";
  const [resultsText, setResultsText] = useState(String(storedResults));
  const [kmText, setKmText] = useState(String(storedKm));

  useEffect(() => {
    setResultsText(String(storedResults));
  }, [storedResults]);

  useEffect(() => {
    setKmText(String(storedKm));
  }, [storedKm]);

  const migratedLegacyKm = useRef(false);
  useEffect(() => {
    if (migratedLegacyKm.current) return;
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
  }, [legacyDefaultKm, onUpdateDependencyParameters, parameters?.maxDistanceKm]);

  const commit = (patch: {
    maxResults?: number;
    maxDistanceKm?: number;
    resolution?: "low" | "medium" | "high";
  }) => {
    onUpdateDependencyParameters((dependency) => {
      if (dependency.type !== "distance_to_features_over_water") {
        return { ...dependency.parameters };
      }
      return { ...dependency.parameters, ...patch };
    });
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <span className="font-light text-gray-400 whitespace-nowrap">
          {t("Matches")}
        </span>
        <input
          type="number"
          min={1}
          max={MAX_WATER_PATH_RESULTS}
          step={1}
          value={resultsText}
          aria-label={t("Matches")}
          className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-sm"
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
      <label className="flex items-center gap-2 text-sm text-gray-800">
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
          className="w-16 rounded border border-gray-200 px-1.5 py-0.5 text-sm"
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
      <LabeledDropdown
        label={t("Resolution")}
        value={storedResolution}
        ariaLabel={t("Resolution")}
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
          if (next !== storedResolution) commit({ resolution: next });
        }}
      />
    </div>
  );
}
