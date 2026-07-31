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

/**
 * Resolve a categorical legend label from a pre-extracted label map.
 * Falls back to the value string when no override is set (continuous / unlabeled).
 */
export function labelFromRasterLegendLabels(
  labels: Record<string, string>,
  value: number
): string {
  const key = String(value);
  return labels[key] || key;
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
