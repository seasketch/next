import { AnyLayer, Expression } from "mapbox-gl";
export { buildGlStyle, type BuildGlStyleInput } from "./buildGlStyle";
export { effectiveReverseNamedPalette } from "ai-data-analyst";
/**
 * Attempts to find a group by column name from a set of Mapbox GL style layers.
 * Useful for determining if the map layer presented to users is categorical,
 * indicating a feature class breakdown that may be useful for reporting.
 * @param mapboxGlStyles
 * @param geometryType
 * @param columnNames
 * @returns
 */
export declare function groupByFromStyle(mapboxGlStyles: AnyLayer[] | null | undefined, geometryType: string, columnNames: Set<string>): string | undefined;
export declare function isExpression(e: any): e is Expression;
export declare function findGetExpression(expression: any, isFilter?: boolean, parent?: Expression): null | {
    type: "legacy" | "get";
    property: string;
};
//# sourceMappingURL=index.d.ts.map