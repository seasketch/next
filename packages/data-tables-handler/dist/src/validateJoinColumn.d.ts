import { GeostatsAttribute, GeostatsAttributeType, GeostatsLayer } from "@seasketch/geostats-types";
export declare function getGeostatsLayer(overlayGeostats: unknown): GeostatsLayer;
export declare function findOverlayAttribute(layer: GeostatsLayer, attributeName: string): GeostatsAttribute;
/**
 * Validates that distinct values in the table's join column exist among the
 * overlay layer's feature identifiers (from geostats). Comparison is an
 * exact string match — join keys must match the overlay attribute exactly,
 * as they would in any other analysis tooling.
 *
 * Geostats attribute `values` histograms are truncated (top ~500 keys), so
 * when the overlay attribute has more distinct values than the histogram
 * holds, unmatched CSV values are reported in the stats but do not fail the
 * upload. With a complete histogram, any unmatched value is an error.
 *
 * Note: despite the names (kept for compatibility with the stored
 * column-stats.json format), matchedRows/unmatchedRows count *distinct join
 * values*, not table rows.
 */
export declare function validateJoinColumnChoice(headers: string[], joinColumn: string, overlayJoinColumn: string, layer: GeostatsLayer, joinValues: Set<string>): {
    overlayAttr: GeostatsAttribute;
    matchRate: number;
    matchedRows: number;
    unmatchedRows: number;
    unmatchedOverlayValues: number;
};
export declare function inferGeostatsType(duckDbType: string): GeostatsAttributeType;
