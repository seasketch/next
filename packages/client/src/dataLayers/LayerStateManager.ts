import type { LayerState } from "./MapContextManager";
import { EventEmitter } from "eventemitter3";
import debounce from "lodash.debounce";

/**
 * Minimum time (ms) a layer must be loading before `loading` is exposed as
 * `true` via getState(). If a layer starts and finishes loading within this
 * window, downstream consumers never see a loading flash.
 */
export const LOADING_STATE_MIN_DURATION_MS = 700;

/**
 * Debounce interval (ms) for loading-related state change notifications.
 * Non-loading mutations (visibility, opacity, etc.) are notified immediately.
 */
const LOADING_NOTIFY_DEBOUNCE_MS = 70;

/**
 * Compare two LayerState-like objects for equality. Every enumerable property
 * is compared with strict equality (`===`), which means `error` (an Error
 * object) and any other reference types are compared by identity — not by
 * deep value. This is intentional: Error instances keep the same identity
 * until explicitly replaced.
 */
function layerStateEqual<T extends LayerState>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return true;
}

/**
 * A general-purpose, synchronous layer state store that:
 *
 * 1. Suppresses transient loading states via a `loadingAt` timestamp
 *    threshold. If a layer loads in under `LOADING_STATE_MIN_DURATION_MS`,
 *    `loading` is never exposed as `true` to React.
 * 2. Maintains **referential stability**: `getState()` returns the same
 *    object reference when nothing meaningful has changed, preventing
 *    unnecessary React re-renders.
 *
 * MapContextManager keeps two instances:
 *   - overlays  → `LayerStateManager<LayerState>`   keyed by stableId
 *   - sketches  → `LayerStateManager<SketchLayerState>` keyed by string id
 *
 * **All mutations are immediate and synchronous.** Loading-related state
 * change notifications are debounced (10 ms); all other mutations notify
 * immediately. Subscribe to the `"stateChanged"` event to react to
 * effective state changes.
 */
export class LayerStateManager<TState extends LayerState> extends EventEmitter {
  // ── internal stores ──────────────────────────────────────────────────────

  /** Raw mutable state. `loading` here is the *raw* value from the map. */
  private rawState: { [key: string]: TState } = {};

  /** Timestamp (ms) when a layer first started loading. */
  private loadingStartedAt: { [key: string]: number } = {};

  /** Map from mapbox sourceId → set of tracked layer keys using that source. */
  private sourceToKeys: { [sourceId: string]: Set<string> } = {};

  /**
   * Snapshot returned by the last `getState()` call. Used for referential
   * stability — we compare the freshly-built state against this snapshot
   * and return the same reference when nothing changed.
   *
   * We *never* null this out on mutations so that `getState()` can always
   * run the comparison. The snapshot objects are spread-copies, so they are
   * not affected by subsequent in-place mutations to `rawState`.
   */
  private _lastEmitted: { [key: string]: TState } | null = null;

  /**
   * Snapshot reference at the time we last emitted `"stateChanged"`.
   * Used to avoid duplicate emissions when `getState()` returns the same
   * reference.
   */
  private _lastNotifiedRef: { [key: string]: TState } | null = null;

  private readonly loadingMinMs: number;

  constructor(
    initialState?: { [key: string]: TState },
    loadingMinMs = LOADING_STATE_MIN_DURATION_MS
  ) {
    super();
    this.loadingMinMs = loadingMinMs;
    if (initialState) {
      for (const key of Object.keys(initialState)) {
        // Clone so we own the objects
        this.rawState[key] = { ...initialState[key] };
      }
    }
  }

  // ── state change notification ───────────────────────────────────────────

  /**
   * Check whether the effective public state has changed since the last
   * notification and, if so, emit `"stateChanged"`. Called immediately
   * after non-loading mutations.
   */
  private checkAndNotify = (): void => {
    const state = this.getState();
    if (state !== this._lastNotifiedRef) {
      this._lastNotifiedRef = state;
      this.emit("stateChanged");
    }
  };

  /**
   * Debounced variant of `checkAndNotify`, used exclusively after
   * loading-related mutations. 10 ms trailing-edge debounce prevents a
   * flood of context pushes while map sources are actively loading.
   */
  private debouncedCheckAndNotify = debounce(
    this.checkAndNotify,
    LOADING_NOTIFY_DEBOUNCE_MS,
    {
      leading: false,
      trailing: true,
      maxWait: 100,
    }
  );

  /**
   * Cancel any pending debounced notification and remove all listeners.
   * Call when this manager is no longer needed.
   */
  destroy(): void {
    this.debouncedCheckAndNotify.cancel();
    this.removeAllListeners();
  }

  // ── source-tracking (for event triage) ───────────────────────────────────

  /**
   * Register which mapbox sourceId a layer key maps to.
   * Call when adding/showing a layer so data events can be triaged.
   */
  setSourceForKey(key: string, sourceId: string): void {
    if (!this.sourceToKeys[sourceId]) {
      this.sourceToKeys[sourceId] = new Set();
    }
    this.sourceToKeys[sourceId].add(key);
  }

  removeSourceForKey(key: string, sourceId: string): void {
    this.sourceToKeys[sourceId]?.delete(key);
    if (this.sourceToKeys[sourceId]?.size === 0) {
      delete this.sourceToKeys[sourceId];
    }
  }

  /** Returns `true` if any tracked layer uses the given mapbox source. */
  hasRelevanceToSource(sourceId: string): boolean {
    const set = this.sourceToKeys[sourceId];
    return set !== undefined && set.size > 0;
  }

  // ── mutations (all synchronous, no debouncing) ───────────────────────────

  addLayer(key: string, state: TState): void {
    this.rawState[key] = { ...state };
    if (state.loading) {
      this.loadingStartedAt[key] = Date.now();
    }
    this.checkAndNotify();
  }

  removeLayer(key: string): void {
    delete this.rawState[key];
    delete this.loadingStartedAt[key];
    // Remove from source tracking
    for (const sourceId in this.sourceToKeys) {
      this.sourceToKeys[sourceId].delete(key);
      if (this.sourceToKeys[sourceId].size === 0) {
        delete this.sourceToKeys[sourceId];
      }
    }
    this.checkAndNotify();
  }

  has(key: string): boolean {
    return key in this.rawState;
  }

  keys(): string[] {
    return Object.keys(this.rawState);
  }

  /**
   * Get the **raw** (internal) state for a single layer.
   * Does NOT apply the loading threshold — use `getLayerState()` if you
   * need the effective/public value.
   */
  getRaw(key: string): TState | undefined {
    return this.rawState[key];
  }

  setLoading(key: string, loading: boolean): void {
    const s = this.rawState[key];
    if (!s) return;
    if (loading) {
      if (!(key in this.loadingStartedAt)) {
        this.loadingStartedAt[key] = Date.now();
      }
      s.loading = true;
    } else {
      delete this.loadingStartedAt[key];
      s.loading = false;
    }
    // Loading changes use the debounced path
    this.debouncedCheckAndNotify();
  }

  setVisible(key: string, visible: boolean): void {
    const s = this.rawState[key];
    if (!s) return;
    s.visible = visible;
    this.checkAndNotify();
  }

  setOpacity(key: string, opacity: number | undefined): void {
    const s = this.rawState[key];
    if (!s) return;
    s.opacity = opacity;
    this.checkAndNotify();
  }

  setZOrderOverride(key: string, zOrder: number | undefined): void {
    const s = this.rawState[key];
    if (!s) return;
    s.zOrderOverride = zOrder;
    this.checkAndNotify();
  }

  setHidden(key: string, hidden: boolean): void {
    const s = this.rawState[key];
    if (!s) return;
    s.hidden = hidden;
    this.checkAndNotify();
  }

  setError(key: string, error: Error | undefined): void {
    const s = this.rawState[key];
    if (!s) return;
    s.error = error;
    this.checkAndNotify();
  }

  /**
   * Patch arbitrary properties on a layer's state.
   * Useful for SketchLayerState extras (sketchClassId, filterMvtUrl, etc.).
   */
  patch(key: string, partial: Partial<TState>): void {
    const s = this.rawState[key];
    if (!s) return;
    for (const k of Object.keys(partial) as (keyof TState)[]) {
      (s as any)[k] = partial[k];
    }
    this.checkAndNotify();
  }

  /**
   * Remove all layers whose keys are NOT in the provided set.
   * Returns `true` if any layers were removed.
   */
  retainOnly(keysToKeep: Set<string> | string[]): boolean {
    const keepSet =
      keysToKeep instanceof Set ? keysToKeep : new Set(keysToKeep);
    let changed = false;
    for (const key of Object.keys(this.rawState)) {
      if (!keepSet.has(key)) {
        // removeLayer already calls checkAndNotify for each removal,
        // but that's fine — checkAndNotify is cheap when nothing changed.
        this.removeLayer(key);
        changed = true;
      }
    }
    return changed;
  }

  // ── read — referential stability + loading threshold ─────────────────────

  /**
   * Build the effective public state, applying the loading threshold.
   * Returns the **same reference** as the previous call when every layer's
   * effective state is unchanged.
   */
  getState(): { [key: string]: TState } {
    const now = Date.now();
    const rawKeys = Object.keys(this.rawState);
    const next: { [key: string]: TState } = {};

    for (const key of rawKeys) {
      const raw = this.rawState[key];
      // Compute effective loading: only expose loading=true if raw is
      // loading AND it has been loading for at least loadingMinMs.
      let effectiveLoading = raw.loading;
      if (raw.loading && key in this.loadingStartedAt) {
        effectiveLoading =
          now - this.loadingStartedAt[key] >= this.loadingMinMs;
      }
      // Always create a snapshot copy so _lastEmitted is never affected
      // by later in-place mutations to rawState.
      next[key] = { ...raw, loading: effectiveLoading };
    }

    // Referential stability: if the effective state is identical to the
    // previous snapshot, return the previous reference.
    if (this._lastEmitted !== null) {
      const prevKeys = Object.keys(this._lastEmitted);
      if (prevKeys.length === rawKeys.length) {
        let allEqual = true;
        for (const k of rawKeys) {
          if (
            !(k in this._lastEmitted) ||
            !layerStateEqual(this._lastEmitted[k], next[k])
          ) {
            allEqual = false;
            break;
          }
        }
        if (allEqual) {
          return this._lastEmitted;
        }
      }
    }
    this._lastEmitted = next;
    return next;
  }

  /**
   * Get the effective state for a single layer (loading threshold applied).
   */
  getLayerState(key: string): TState | undefined {
    const raw = this.rawState[key];
    if (!raw) return undefined;
    let effectiveLoading = raw.loading;
    if (raw.loading && key in this.loadingStartedAt) {
      effectiveLoading =
        Date.now() - this.loadingStartedAt[key] >= this.loadingMinMs;
    }
    // Return a snapshot copy
    return { ...raw, loading: effectiveLoading };
  }
}
