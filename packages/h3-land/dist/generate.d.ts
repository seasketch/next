export type GenerateOptions = {
    input: string;
    output: string;
    resolution: number;
    epsilon: number;
    bbox: [number, number, number, number] | null;
    commitEvery: number;
    /** Stop after this many classified features. The cursor is saved. */
    limit: number | null;
    restart: boolean;
    /** Two-pass only: drop the fine cells and run the refine pass again. */
    redoRefine?: boolean;
};
export declare function generateLandOccupancy(options: GenerateOptions): Promise<void>;
export declare function defaultGenerateOptions(): Pick<GenerateOptions, "resolution" | "epsilon" | "commitEvery">;
