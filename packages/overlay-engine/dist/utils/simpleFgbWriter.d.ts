import { Feature, Polygon, MultiPolygon } from "geojson";
export interface FieldDefinition {
    name: string;
    type: "string" | "integer" | "real" | "date" | "time" | "datetime";
    width?: number;
    precision?: number;
}
export declare class SimpleFgbWriter {
    private features;
    private fieldDefinitions;
    private outputPath;
    constructor(outputPath: string, fields?: FieldDefinition[]);
    addFeature(feature: Feature<Polygon | MultiPolygon>): void;
    close(): Promise<void>;
    getStats(): {
        featureCount: number;
        fieldCount: number;
    };
}
//# sourceMappingURL=simpleFgbWriter.d.ts.map