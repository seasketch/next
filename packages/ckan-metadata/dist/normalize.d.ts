import { CkanDisplayConfig, CkanMetadataField, CkanPackage, CkanSchema } from "./types";
export declare const TECHNICAL_FIELD_IDS: Set<string>;
export declare const CORE_RECOMMENDED_FIELD_IDS: Set<string>;
export declare function isCkanPackage(value: unknown): value is CkanPackage;
export declare function isCkanSchema(value: unknown): value is CkanSchema;
export declare function isCkanDisplayConfig(value: unknown): value is CkanDisplayConfig;
export declare function humanize(fieldName: string): string;
export declare function tryParseJsonValue(value: unknown): unknown;
export declare function isSentinelDate(value: string): boolean;
export declare function formatDateValue(value: string): string | undefined;
export interface NormalizeOptions {
    lang?: string;
}
export declare function normalizeCkanPackage(pkgInput: unknown, schemaInput?: unknown, options?: NormalizeOptions): CkanMetadataField[];
//# sourceMappingURL=normalize.d.ts.map