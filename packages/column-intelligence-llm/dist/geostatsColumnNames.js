"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geostatsAttributeColumnNames = geostatsAttributeColumnNames;
/**
 * Mirrors Postgres `get_geostats_attribute_column_names(geostats jsonb)` so Lambda
 * prefetch uses the same allowed-attribute list as the generated `data_sources.columns` column.
 */
function geostatsAttributeColumnNames(geostats) {
    if (geostats == null || typeof geostats !== "object") {
        return [];
    }
    const g = geostats;
    const bands = g.bands;
    if (Array.isArray(bands) &&
        bands.length > 0) {
        return [];
    }
    const layers = g.layers;
    if (!Array.isArray(layers) || layers.length === 0) {
        return [];
    }
    const names = new Set();
    for (const layer of layers) {
        if (layer == null || typeof layer !== "object") {
            return [];
        }
        const L = layer;
        const attrs = L.attributes;
        if (!Array.isArray(attrs)) {
            return [];
        }
        for (const elem of attrs) {
            if (elem == null || typeof elem !== "object") {
                continue;
            }
            const a = elem.attribute;
            if (typeof a === "string" && a.length > 0) {
                names.add(a);
            }
        }
    }
    return [...names].sort((x, y) => x.localeCompare(y));
}
//# sourceMappingURL=geostatsColumnNames.js.map