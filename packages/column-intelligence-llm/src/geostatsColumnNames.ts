/**
 * Mirrors Postgres `get_geostats_attribute_column_names(geostats jsonb)` so Lambda
 * prefetch uses the same allowed-attribute list as the generated `data_sources.columns` column.
 */
export function geostatsAttributeColumnNames(geostats: unknown): string[] {
  if (geostats == null || typeof geostats !== "object") {
    return [];
  }
  const g = geostats as Record<string, unknown>;
  const bands = g.bands;
  if (
    Array.isArray(bands) &&
    bands.length > 0
  ) {
    return [];
  }
  const layers = g.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    return [];
  }
  const names = new Set<string>();
  for (const layer of layers) {
    if (layer == null || typeof layer !== "object") {
      return [];
    }
    const L = layer as Record<string, unknown>;
    const attrs = L.attributes;
    if (!Array.isArray(attrs)) {
      return [];
    }
    for (const elem of attrs) {
      if (elem == null || typeof elem !== "object") {
        continue;
      }
      const a = (elem as Record<string, unknown>).attribute;
      if (typeof a === "string" && a.length > 0) {
        names.add(a);
      }
    }
  }
  return [...names].sort((x, y) => x.localeCompare(y));
}
