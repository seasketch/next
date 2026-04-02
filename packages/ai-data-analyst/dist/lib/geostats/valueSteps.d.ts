/**
 * Matches Postgres `value_steps` on `ai_data_analyst_notes` (and GraphQL `ValueSteps`).
 * Consumers map these to geostats raster `stats` keys (`naturalBreaks`, etc.).
 */
export type RasterValueSteps = "CONTINUOUS" | "EQUAL_INTERVALS" | "NATURAL_BREAKS" | "QUANTILES";
export type ValueSteps = {
    value_steps: RasterValueSteps;
    value_steps_n?: number;
};
export declare function deriveValueSteps(geostats: unknown, preferredColumn?: string): ValueSteps;
//# sourceMappingURL=valueSteps.d.ts.map