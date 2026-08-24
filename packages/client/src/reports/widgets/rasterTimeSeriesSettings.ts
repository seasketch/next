import { AreaUnit, isAreaUnit } from "../utils/units";

const SHORT_AREA_UNITS: Record<string, AreaUnit> = {
  km: "kilometer",
  mi: "mile",
  acres: "acre",
  ha: "hectare",
};

/** Area unit for the captured-area series. Defaults to square kilometers. */
export function getRasterTimeSeriesAreaUnit(settings: {
  unit?: unknown;
}): AreaUnit {
  const unit = settings.unit;
  if (typeof unit !== "string") {
    return "kilometer";
  }
  if (isAreaUnit(unit)) {
    return unit;
  }
  return SHORT_AREA_UNITS[unit] ?? "kilometer";
}

/**
 * Envelope (min/mean/max) samples need finite stats. Geoblaze returns
 * null min/mean/max when every overlapping pixel is nodata — that is a
 * completed metric, not a missing one, and must not be plotted.
 */
export function isPlottableRasterStatsBand(
  band: unknown
): band is { mean: number; min: number; max: number; sum: number } {
  if (band == null || typeof band !== "object") {
    return false;
  }
  if (
    !("mean" in band) ||
    !("min" in band) ||
    !("max" in band) ||
    !("sum" in band)
  ) {
    return false;
  }
  return (
    typeof band.mean === "number" &&
    Number.isFinite(band.mean) &&
    typeof band.min === "number" &&
    Number.isFinite(band.min) &&
    typeof band.max === "number" &&
    Number.isFinite(band.max) &&
    typeof band.sum === "number" &&
    Number.isFinite(band.sum)
  );
}

function trimmedLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Viewer-facing labels for the Absolute/Area and Percent tabs.
 * `valueLabel` is a fallback for the absolute tab so existing series
 * names still appear there until a dedicated absolute label is set.
 */
export function getRasterTimeSeriesTabLabels(
  settings: {
    absoluteLabel?: unknown;
    percentLabel?: unknown;
    valueLabel?: unknown;
  },
  defaults: { absolute: string; percent: string }
): { absolute: string; percent: string } {
  return {
    absolute:
      trimmedLabel(settings.absoluteLabel) ||
      trimmedLabel(settings.valueLabel) ||
      defaults.absolute,
    percent: trimmedLabel(settings.percentLabel) || defaults.percent,
  };
}

export type RasterTimeSeriesPresentation =
  | "absolute"
  | "percent"
  | "both_absolute"
  | "both_percent";

export function getRasterTimeSeriesPresentation(settings: {
  presentation?: RasterTimeSeriesPresentation;
  defaultPresentation?: "absolute" | "percent";
}): {
  showAbsolute: boolean;
  showPercent: boolean;
  defaultValue: "absolute" | "percent";
} {
  switch (settings.presentation) {
    case "absolute":
      return {
        showAbsolute: true,
        showPercent: false,
        defaultValue: "absolute",
      };
    case "percent":
      return {
        showAbsolute: false,
        showPercent: true,
        defaultValue: "percent",
      };
    case "both_percent":
      return {
        showAbsolute: true,
        showPercent: true,
        defaultValue: "percent",
      };
    case "both_absolute":
      return {
        showAbsolute: true,
        showPercent: true,
        defaultValue: "absolute",
      };
    default:
      return {
        showAbsolute: true,
        showPercent: true,
        defaultValue:
          settings.defaultPresentation === "percent" ? "percent" : "absolute",
      };
  }
}

/** Viewer tab order. The admin's "first" choice is the leading tab. */
export function getRasterTimeSeriesTabOrder(settings: {
  presentation?: RasterTimeSeriesPresentation;
  defaultPresentation?: "absolute" | "percent";
}): Array<"absolute" | "percent"> {
  const { showAbsolute, showPercent, defaultValue } =
    getRasterTimeSeriesPresentation(settings);
  const ordered: Array<"absolute" | "percent"> =
    defaultValue === "percent"
      ? ["percent", "absolute"]
      : ["absolute", "percent"];
  return ordered.filter((tab) =>
    tab === "absolute" ? showAbsolute : showPercent
  );
}

/**
 * Value views to print. When both absolute and percent are enabled and
 * percent can be computed, print both (admin tab order). Otherwise print
 * the single plottable view.
 */
export function getRasterTimeSeriesPrintPresentations(
  settings: {
    presentation?: RasterTimeSeriesPresentation;
    defaultPresentation?: "absolute" | "percent";
  },
  options?: { percentUnavailable?: boolean }
): Array<"absolute" | "percent"> {
  const order = getRasterTimeSeriesTabOrder(settings);
  if (options?.percentUnavailable) {
    return order.filter((tab) => tab !== "percent");
  }
  return order;
}
