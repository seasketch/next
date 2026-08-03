/* eslint-disable i18next/no-literal-string */

/**
 * Collect `metadata["s:legend-labels"]` from GL style layers (same source as
 * the compiled legend for categorical rasters).
 */
export function extractRasterLegendLabels(
  mapboxGlStyles: unknown
): Record<string, string> {
  if (!Array.isArray(mapboxGlStyles)) {
    return {};
  }
  const labels: Record<string, string> = {};
  for (const layer of mapboxGlStyles) {
    const next = layer?.metadata?.["s:legend-labels"];
    if (next && typeof next === "object" && !Array.isArray(next)) {
      for (const [key, value] of Object.entries(next)) {
        if (typeof value === "string" && value.length > 0) {
          labels[key] = value;
        }
      }
    }
  }
  return labels;
}

/** Presentation options shared with continuous raster legends. */
export type RasterLabelFormatOptions = {
  roundNumbers?: boolean;
  valueSuffix?: string;
};

/**
 * Read `s:round-numbers` / `s:value-suffix` from GL style metadata (same flags
 * compileLegend uses when formatting continuous stop labels).
 */
export function extractRasterLabelFormatOptions(
  mapboxGlStyles: unknown
): RasterLabelFormatOptions {
  if (!Array.isArray(mapboxGlStyles)) {
    return {};
  }
  let roundNumbers = false;
  let valueSuffix: string | undefined;
  for (const layer of mapboxGlStyles) {
    const metadata = layer?.metadata;
    if (!metadata || typeof metadata !== "object") continue;
    if (metadata["s:round-numbers"]) {
      roundNumbers = true;
    }
    const suffix = metadata["s:value-suffix"];
    if (typeof suffix === "string" && suffix.length > 0 && !valueSuffix) {
      valueSuffix = suffix;
    }
  }
  return { roundNumbers, valueSuffix };
}

/**
 * Format a continuous raster display value the way compileLegend formats
 * gradient/step stop labels after optional scale/offset.
 */
export function formatRasterDisplayValue(
  displayValue: number,
  options: RasterLabelFormatOptions = {}
): string {
  let value = displayValue;
  if (options.roundNumbers) {
    value = Math.round(value);
  }
  let label = value.toLocaleString();
  if (options.valueSuffix) {
    label += options.valueSuffix;
  }
  return label;
}

/**
 * Resolve a categorical legend label from a pre-extracted label map.
 * Falls back to the value string when no override is set (continuous / unlabeled).
 *
 * Prefer {@link rasterInteractionLabel} for tooltips so continuous layers get
 * scale/offset display values, rounding, and suffixes.
 */
export function labelFromRasterLegendLabels(
  labels: Record<string, string>,
  value: number
): string {
  const key = String(value);
  return labels[key] || key;
}

/**
 * Resolve `{{label}}` for a raster pixel sample.
 *
 * - Categorical: `s:legend-labels` keyed by encoded DN (pre-scale).
 * - Continuous / unlabeled: format the post-scale display value like the
 *   legend (`toLocaleString`, optional `s:round-numbers`, `s:value-suffix`).
 */
export function rasterInteractionLabel(
  legendLabels: Record<string, string>,
  encodedValue: number,
  displayValue: number,
  options: RasterLabelFormatOptions = {}
): string {
  const override = legendLabels[String(encodedValue)];
  if (override) {
    return override;
  }
  return formatRasterDisplayValue(displayValue, options);
}

/**
 * Resolve a categorical legend label for a sampled raster value.
 * Prefer caching extractRasterLegendLabels and using labelFromRasterLegendLabels
 * on hot paths (e.g. mousemove).
 */
export function legendLabelForRasterValue(
  mapboxGlStyles: unknown,
  value: number
): string {
  return labelFromRasterLegendLabels(
    extractRasterLegendLabels(mapboxGlStyles),
    value
  );
}
