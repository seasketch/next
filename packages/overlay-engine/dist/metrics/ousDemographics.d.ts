import { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { OverlayWorkerHelpers } from "../utils/helpers";
import { OusDemographicsMetricValue } from "./metrics";
/**
 * Streaming aggregator implementing the OUS demographics methodology. Feed it
 * every feature in the survey dataset (with a flag for whether the shape
 * intersects the subject); it maintains both within-subject respondent maps
 * and dataset-wide totals, applying the participants clamp at finalization.
 *
 * Aggregation is idempotent per shape identity: subdivided parts of the same
 * original feature (or the same feature seen twice) carry identical
 * respondent values and collapse via `Math.max`.
 */
export declare class OusDemographicsAggregator {
    private groupBy;
    /** Respondents with >=1 intersecting shape, per group + rollup. */
    private within;
    /** All respondents in the dataset, per group + rollup. */
    private totals;
    /** Property keys observed across scanned features, for error messages. */
    private seenPropertyKeys;
    featureCount: number;
    /** Features missing a usable response_id / participants / represented_in_sector. */
    skippedFeatureCount: number;
    constructor(groupBy?: string);
    addFeature(properties: {
        [key: string]: any;
    } | null | undefined, intersectsSubject: boolean): void;
    /**
     * Required columns (including the groupBy column) that never appeared on
     * any scanned feature. Non-empty results indicate a misconfigured source.
     */
    missingColumns(): string[];
    result(): OusDemographicsMetricValue;
}
/**
 * Calculates the `ous_demographics` metric for a subject polygon against an
 * Ocean Use Survey FlatGeobuf source.
 *
 * Every feature in the source is scanned exactly once (dataset-wide totals
 * require a full pass regardless of the subject, and survey layers are
 * small), so no bbox-driven fetch plan or clipping worker pool is involved.
 * Intersection is a boolean test via {@link ContainerIndex}: "inside" and
 * "mixed" classifications both intersect the subject (touching counts, same
 * as the legacy geoprocessing function's booleanIntersects).
 */
export declare function calculateOusDemographics(subjectFeature: Feature<Polygon | MultiPolygon>, source: FlatGeobufSource<Feature<Geometry>>, options?: {
    /** Column to group results by. @default "sector" */
    groupBy?: string;
    helpers?: OverlayWorkerHelpers;
}): Promise<OusDemographicsMetricValue>;
//# sourceMappingURL=ousDemographics.d.ts.map