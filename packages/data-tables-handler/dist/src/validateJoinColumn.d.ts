import { GeostatsAttribute, GeostatsAttributeType, GeostatsLayer } from "@seasketch/geostats-types";
export declare function getGeostatsLayer(overlayGeostats: unknown): GeostatsLayer;
export declare function findOverlayAttribute(layer: GeostatsLayer, attributeName: string): GeostatsAttribute;
/** Fail the upload when this fraction (or more) of table rows cannot join. */
export declare const MAX_UNMATCHED_RECORD_FRACTION = 0.25;
export type JoinColumnValidation = {
    overlayAttr: GeostatsAttribute;
    matchRate: number;
    matchedRows: number;
    unmatchedRows: number;
    unmatchedOverlayValues: number;
    matchedJoinValues: string[];
    unmatchedJoinValues: string[];
    /**
     * True when geostats includes every distinct overlay identifier. Only then
     * can unmatched CSV values be treated as missing from the layer.
     */
    histogramComplete: boolean;
};
/**
 * Validates that distinct values in the table's join column exist among the
 * overlay layer's feature identifiers (from geostats). Comparison is an
 * exact string match — join keys must match the overlay attribute exactly,
 * as they would in any other analysis tooling.
 *
 * Geostats attribute `values` histograms are truncated (top ~500 keys), so
 * when the overlay attribute has more distinct values than the histogram
 * holds, unmatched CSV values are reported in the stats but are not treated
 * as missing. With a complete histogram, unmatched values are returned so
 * the upload can drop those rows instead of failing — unless they make up
 * {@link MAX_UNMATCHED_RECORD_FRACTION} or more of the table rows.
 *
 * The upload still fails if *no* join values match the overlay.
 *
 * Note: despite the names (kept for compatibility with the stored
 * column-stats.json format), matchedRows/unmatchedRows count *distinct join
 * values*, not table rows.
 */
export declare function validateJoinColumnChoice(headers: string[], joinColumn: string, overlayJoinColumn: string, layer: GeostatsLayer, joinValues: Set<string>): JoinColumnValidation;
/**
 * Throws when unmatched rows are too large a share of the table. Below this
 * threshold, those rows can be dropped and the upload can continue.
 */
export declare function assertUnmatchedRecordFractionAllowed(unmatchedRowCount: number, totalRowCount: number, unmatchedJoinValues: string[]): void;
export declare function inferGeostatsType(duckDbType: string): GeostatsAttributeType;
