import { GeostatsAttribute, GeostatsAttributeType, GeostatsLayer } from "@seasketch/geostats-types";
export declare function getGeostatsLayer(overlayGeostats: unknown): GeostatsLayer;
export declare function findOverlayAttribute(layer: GeostatsLayer, attributeName: string): any;
export declare function validateJoinColumnChoice(headers: string[], joinColumn: string, overlayJoinColumn: string, layer: GeostatsLayer, joinValues: Set<string>): {
    overlayAttr: GeostatsAttribute;
    matchRate: number;
    matchedRows: number;
    unmatchedRows: number;
    unmatchedOverlayValues: number;
};
export declare function inferGeostatsType(duckDbType: string): GeostatsAttributeType;
export declare function sqlStringLiteral(value: string): string;
