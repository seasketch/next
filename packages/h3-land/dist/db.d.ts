import type { GeometryContribution } from "./classify";
import { DEFAULT_COVER_EPSILON } from "./constants";
export type LandPhase = "flat" | "coarse" | "refine" | "done";
export type LandParams = {
    input: string;
    resolution: number;
    epsilon: number;
    /** Empty string when the run is global. */
    bbox: string;
    sourcePath: string;
    /** Resolution 7 first, then finer cells only under mixed parents. */
    hierarchical?: boolean;
};
export type LandSummary = {
    meta: Record<string, string>;
    finalized: boolean;
    entire: number;
    partial: number;
    openPartials: number;
    oversize: number;
    failures: number;
    nextFeature: number;
};
export declare class LandStore {
    private readonly db;
    private readonly insertEntire;
    private readonly upsertPartial;
    private readonly deletePartial;
    private readonly insertFailure;
    private readonly upsertMeta;
    private readonly partial;
    private readonly dirty;
    private readonly removePartial;
    private entireQueue;
    private fineQueue;
    private fineStates;
    private pendingEntire;
    private pendingFineEntire;
    private pendingFinePartial;
    private appliedSinceLog;
    private inTransaction;
    private readonly insertFine;
    readonly hierarchical: boolean;
    phase: LandPhase;
    private basePrefix;
    private baseState;
    entireCount: number;
    oversizeCount: number;
    failureCount: number;
    nextFeature: number;
    finalized: boolean;
    readonly params: LandParams;
    private constructor();
    static open(path: string, params: LandParams, restart: boolean): LandStore;
    apply(contribution: GeometryContribution, epsilon?: number): void;
    /** Resolution-7 cells fully inside one land piece. Their descendants are land. */
    applyCoarse(sealed: Iterable<bigint>, overlap: Iterable<[bigint, number]>): void;
    /** Area added to resolution-9 cells under mixed resolution-7 parents. */
    applyRefine(covers: Iterable<[bigint, number]>, epsilon?: number): void;
    isMixed(h3: bigint): boolean;
    isSealed(h3: bigint): boolean;
    fail(featureIndex: number, message: string): void;
    /**
     * Persist queued cells and set the resume cursor to `nextFeature`
     * (the first feature not yet finished).
     */
    commit(nextFeature: number): void;
    /**
     * Resolution-7 overlapping cells become the refine set. Their coverage is
     * dropped; the refine pass measures children from the polygons again.
     * Sealed cells on the edge of the sealed region join them, because their
     * corner descendants reach into the unsealed neighbor.
     */
    finishCoarse(): void;
    /**
     * Throw away the refine pass and start it again from the sealed and mixed
     * resolution-7 cells. Used after a change to how fine cells are measured.
     */
    resetRefine(): void;
    /**
     * A sealed resolution-7 cell stands for all of its descendants, but the
     * corner descendants two levels down lie half outside its outline. That is
     * only safe when every neighbor is sealed too. Sealed cells with an
     * unsealed neighbor become mixed, and the refine pass measures them.
     * Runs once per database; the flag keeps a second call from eroding the
     * next ring.
     */
    private demoteSealedEdge;
    finalize(): {
        entire: number;
        partial: number;
        oversize: number;
    };
    setFeaturesCount(count: number): void;
    get openPartials(): number;
    close(): void;
    private markEntire;
    private seal;
    private noteMixed;
    private queueFine;
    private baseRankState;
    private rank7;
    private loadBaseState;
    private addCover;
    private begin;
    private rollback;
    private flushEntire;
    private flushFine;
    private finalizeRefine;
    private maybeLogInsert;
    private writeParams;
    private putMeta;
}
export declare function readCellState(path: string, h3: bigint): number | null;
export declare function readLandSummary(path: string): LandSummary;
export declare function formatCount(value: number): string;
export { DEFAULT_COVER_EPSILON };
