/**
 * @overview
 * A lightweight ETA estimator for long-running tasks that process work in batches.
 * Uses an EWMA (exponentially weighted moving average) of per-unit durations,
 * blends an optional prior for early stability, and returns a JavaScript `Date`
 * representing the estimated completion time.
 *
 * - **Monotonic input**: Feed *cumulative* completed work that never decreases.
 * - **Weighted progress**: Units can be features, vertices, or any work measure.
 * - **No UI logic**: Formatting and hysteresis are left to the caller.
 *
 * @example
 * ```ts
 * const totalWork = polygons.reduce((s, p) => s + p.vertexCount, 0);
 * const eta = new EtaEstimator({ totalUnits: totalWork, priorMsPerUnit: 0.8 });
 *
 * doneWork += batch.reduce((s, p) => s + p.vertexCount, 0);
 * const state = eta.update(doneWork);
 *
 * if (state.eta) console.log("ETA:", state.eta.toISOString());
 * ```
 */
/**
 * Snapshot of ETA estimation state.
 */
export type EtaState = {
    /** Estimated completion time (wall clock). `null` until ready. */
    eta: Date | null;
    /** Estimated milliseconds remaining, unformatted. `null` until ready. */
    etaMs: number | null;
    /** Smoothed estimate of milliseconds per unit of work. `null` until enough samples. */
    msPerUnit: number | null;
    /** Total work units observed so far (cumulative, monotonic). */
    samples: number;
    /** Heuristic confidence tier based on sample count. */
    confidence: "low" | "med" | "high";
};
/**
 * Configuration options for {@link EtaEstimator}.
 */
export type EtaEstimatorOptions = {
    /**
     * Total work to complete, in arbitrary units (items, vertices, etc.).
     * Must be a positive finite number.
     */
    totalUnits: number;
    /**
     * Optional prior estimate for milliseconds per unit of work.
     * Use median values from similar past runs to stabilize early estimates.
     * @default null (no prior)
     */
    priorMsPerUnit?: number | null;
    /**
     * Minimum number of observed units before the estimator produces an ETA.
     * @default 20
     */
    minSamplesUnits?: number;
    /**
     * Minimum wall-clock time (ms) before producing an ETA,
     * used to avoid highly volatile early estimates.
     * @default 2000
     */
    minSamplesMs?: number;
    /**
     * EWMA half-life measured in work units.
     * Larger values yield smoother, slower-reacting estimates.
     * @default 100
     */
    ewmaHalfLifeUnits?: number;
    /**
     * Strength of the prior, expressed as synthetic work units.
     * The prior fades out as `samples` exceed this count.
     * @default 100
     */
    priorWeightUnits?: number;
};
/**
 * ETA estimator using EWMA of per-unit durations with an optional prior.
 *
 * @remarks
 * - **Monotonicity**: `update(doneUnits)` must be called with a cumulative work count
 *   that never decreases. If a regression is detected, it is ignored.
 * - **Timing**: Uses `Date.now()` internally; no external clocks required.
 * - **Units**: Choose units proportional to cost (e.g., vertices) for smoother ETAs.
 */
export declare class EtaEstimator {
    private minSamplesUnits;
    private minSamplesMs;
    private ewmaHalfLifeUnits;
    private readonly priorMsPerUnit;
    private priorWeightUnits;
    private readonly totalUnits;
    private readonly startMs;
    private lastTickMs;
    private lastDone;
    private ewmaMsPerUnit;
    private seenUnits;
    /**
     * Construct a new ETA estimator.
     *
     * @param opts - {@link EtaEstimatorOptions} controlling behavior and priors.
     * @throws {Error} If `totalUnits` is not a positive finite number.
     */
    constructor(opts: EtaEstimatorOptions);
    /**
     * Update the estimator with the cumulative amount of work completed.
     *
     * @param doneUnits - Cumulative work completed so far (same units as `totalUnits`).
     * Must be monotonic (never less than the previous value). Fractions are floored.
     *
     * @returns The current {@link EtaState}. If insufficient data is available,
     * returns `eta = null` and `etaMs = null`.
     *
     * @example
     * ```ts
     * const state = estimator.update(totalProcessedVertices);
     * if (state.eta) console.log("ETA:", state.eta.toISOString());
     * ```
     */
    update(doneUnits: number): EtaState;
    /**
     * Get a read-only snapshot of the current state without updating internal timing.
     * Useful for polling UI timers or secondary displays.
     *
     * @returns The current {@link EtaState}.
     */
    getState(): EtaState;
    /**
     * Compute the current ETA state at a given timestamp.
     * @param nowMs - Milliseconds since UNIX epoch (usually `Date.now()`).
     */
    private currentState;
}
//# sourceMappingURL=EtaEstimator.d.ts.map