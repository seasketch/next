import { Feature } from "geojson";
export interface FieldDefinition {
    name: string;
    type: "string" | "integer" | "real" | "date" | "time" | "datetime";
    width?: number;
    precision?: number;
}
export declare class DebuggingFgbWriter {
    private writer;
    private layer;
    private fieldDefinitions;
    private fieldIndexMap;
    constructor(path: string, fields: FieldDefinition[], layerName?: string);
    private convertFieldTypeToGdal;
    private convertGeoJsonGeometryToGdal;
    private validateFeatureProperties;
    addFeature(feature: Feature<any>): void;
    close(): Promise<void>;
    /**
     * Get statistics about the written features
     */
    getStats(): {
        featureCount: number;
        fieldCount: number;
    };
}
//# sourceMappingURL=debuggingFgbWriter.d.ts.map