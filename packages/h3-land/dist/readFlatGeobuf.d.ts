import type { Feature, Geometry } from "geojson";
/**
 * Stream features from a local FlatGeobuf file. The packed index is skipped;
 * this is a full sequential read, which is what a global classification needs.
 */
export declare function readFlatGeobuf(path: string, onHeader?: (header: {
    featuresCount: number;
}) => void): AsyncGenerator<Feature<Geometry | null>>;
