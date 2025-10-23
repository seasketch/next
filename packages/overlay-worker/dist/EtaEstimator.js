"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtaEstimator = void 0;
/**
 * ETA estimator using EWMA of per-unit durations with an optional prior.
 *
 * @remarks
 * - **Monotonicity**: `update(doneUnits)` must be called with a cumulative work count
 *   that never decreases. If a regression is detected, it is ignored.
 * - **Timing**: Uses `Date.now()` internally; no external clocks required.
 * - **Units**: Choose units proportional to cost (e.g., vertices) for smoother ETAs.
 */
class EtaEstimator {
    /**
     * Construct a new ETA estimator.
     *
     * @param opts - {@link EtaEstimatorOptions} controlling behavior and priors.
     * @throws {Error} If `totalUnits` is not a positive finite number.
     */
    constructor(opts) {
        var _a;
        // --- Configuration defaults ---
        this.minSamplesUnits = 20;
        this.minSamplesMs = 2000;
        this.ewmaHalfLifeUnits = 100;
        this.priorWeightUnits = 100;
        this.startMs = Date.now();
        this.lastTickMs = this.startMs;
        this.lastDone = 0;
        this.ewmaMsPerUnit = null;
        this.seenUnits = 0;
        if (!Number.isFinite(opts.totalUnits) || opts.totalUnits <= 0) {
            throw new Error("totalUnits must be a positive finite number");
        }
        this.totalUnits = Math.max(1, Math.floor(opts.totalUnits));
        this.priorMsPerUnit = (_a = opts.priorMsPerUnit) !== null && _a !== void 0 ? _a : null;
        if (opts.minSamplesUnits !== undefined)
            this.minSamplesUnits = opts.minSamplesUnits;
        if (opts.minSamplesMs !== undefined)
            this.minSamplesMs = opts.minSamplesMs;
        if (opts.ewmaHalfLifeUnits !== undefined)
            this.ewmaHalfLifeUnits = opts.ewmaHalfLifeUnits;
        if (opts.priorWeightUnits !== undefined)
            this.priorWeightUnits = opts.priorWeightUnits;
    }
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
    update(doneUnits) {
        const nowMs = Date.now();
        // Clamp and enforce monotonicity
        doneUnits = Math.min(this.totalUnits, Math.max(0, Math.floor(doneUnits)));
        if (doneUnits < this.lastDone) {
            return this.currentState(nowMs); // ignore regressions
        }
        // Update EWMA if new progress has occurred
        if (doneUnits > this.lastDone) {
            const dt = nowMs - this.lastTickMs;
            const dn = doneUnits - this.lastDone;
            if (dt > 0) {
                const instMsPerUnit = dt / dn;
                const alpha = 1 - Math.exp(-dn / this.ewmaHalfLifeUnits);
                this.ewmaMsPerUnit =
                    this.ewmaMsPerUnit === null
                        ? instMsPerUnit
                        : (1 - alpha) * this.ewmaMsPerUnit + alpha * instMsPerUnit;
            }
            this.seenUnits = doneUnits;
            this.lastDone = doneUnits;
            this.lastTickMs = nowMs;
        }
        return this.currentState(nowMs);
    }
    /**
     * Get a read-only snapshot of the current state without updating internal timing.
     * Useful for polling UI timers or secondary displays.
     *
     * @returns The current {@link EtaState}.
     */
    getState() {
        return this.currentState(Date.now());
    }
    /**
     * Compute the current ETA state at a given timestamp.
     * @param nowMs - Milliseconds since UNIX epoch (usually `Date.now()`).
     */
    currentState(nowMs) {
        const elapsedMs = nowMs - this.startMs;
        const ready = this.seenUnits >= this.minSamplesUnits || elapsedMs >= this.minSamplesMs;
        if (!ready || this.ewmaMsPerUnit === null) {
            return {
                eta: null,
                etaMs: null,
                msPerUnit: this.ewmaMsPerUnit,
                samples: this.seenUnits,
                confidence: "low",
            };
        }
        // Blend EWMA with prior if applicable
        let msPerUnit = this.ewmaMsPerUnit;
        if (this.priorMsPerUnit !== null) {
            const w = Math.min(this.priorWeightUnits / Math.max(1, this.seenUnits), 1);
            msPerUnit = w * this.priorMsPerUnit + (1 - w) * msPerUnit;
        }
        const remainingUnits = Math.max(0, this.totalUnits - this.seenUnits);
        const etaMs = remainingUnits * Math.max(msPerUnit, 0);
        const eta = new Date(nowMs + etaMs);
        const confidence = this.seenUnits > this.minSamplesUnits * 3
            ? "high"
            : this.seenUnits >= this.minSamplesUnits
                ? "med"
                : "low";
        return { eta, etaMs, msPerUnit, samples: this.seenUnits, confidence };
    }
}
exports.EtaEstimator = EtaEstimator;
//# sourceMappingURL=EtaEstimator.js.map