export type ValueSteps = {
    value_steps: "CONTINUOUS" | "NATURAL_BREAKS" | "QUANTILES" | "EQUAL_INTERVALS";
    value_steps_n?: number;
};
export declare function deriveValueSteps(geostats: unknown, preferredColumn?: string): ValueSteps;
//# sourceMappingURL=valueSteps.d.ts.map