import { Feature, FeatureCollection, GeoJsonGeometryTypes } from "geojson";
export declare type GeostatsAttributeType = "string" | "number" | "boolean" | "null" | "mixed" | "object" | "array";
export interface GeostatsAttribute {
    attribute: string;
    count: number;
    type: GeostatsAttributeType;
    values: (string | number | boolean | null)[];
    min?: number;
    max?: number;
    quantiles?: number[];
}
export interface GeostatsLayer {
    layer: string;
    count: number;
    geometry: GeoJsonGeometryTypes;
    attributeCount: number;
    attributes: GeostatsAttribute[];
}
export default function geostats(json: Feature | FeatureCollection, layerName: string): GeostatsLayer;
