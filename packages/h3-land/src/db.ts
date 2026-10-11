import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import {
  cellToChildPos,
  childPosToCell,
  getBaseCellNumber,
  getPentagons,
  getRes0Cells,
  gridDisk,
} from "h3-js";
import type { DatabaseSync, StatementSync } from "node:sqlite";

// Vite's builtin list predates node:sqlite, so a literal import is rewritten
// to a missing package. Load it at runtime instead.
const { DatabaseSync: SqliteDatabase } = createRequire(__filename)(
  "node:" + "sqlite"
) as typeof import("node:sqlite");
import type { GeometryContribution } from "./classify";
import { nextCover } from "./classify";
import {
  BASE_RESOLUTION,
  DEFAULT_COVER_EPSILON,
  GENERATOR_VERSION,
  MIN_COVER_M2,
  STATE_ENTIRE,
  STATE_PARTIAL,
} from "./constants";
import { hexAreaM2 } from "./coverage";
import { cellToInt, intToCell } from "./h3int";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cells (
  h3 INTEGER PRIMARY KEY,
  state INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS partial (
  h3 INTEGER PRIMARY KEY,
  cover_m2 REAL NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS failures (
  feature_index INTEGER PRIMARY KEY,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fine (
  h3 INTEGER PRIMARY KEY,
  state INTEGER NOT NULL
) WITHOUT ROWID;
`;

/** V8 maps stop at 2^24 entries. Partial cells can approach that at resolution 9. */
class ChunkedNumberMap {
  private readonly chunks: Map<bigint, number>[] = [];
  private tail = new Map<bigint, number>();
  size = 0;

  constructor(private readonly chunkSize = 8_000_000) {}

  get(key: bigint): number | undefined {
    const found = this.tail.get(key);
    if (found !== undefined) return found;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const value = this.chunks[i]!.get(key);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  set(key: bigint, value: number): void {
    if (this.tail.has(key)) {
      this.tail.set(key, value);
      return;
    }
    for (const chunk of this.chunks) {
      if (chunk.has(key)) {
        chunk.set(key, value);
        return;
      }
    }
    if (this.tail.size >= this.chunkSize) {
      this.chunks.push(this.tail);
      this.tail = new Map();
    }
    this.tail.set(key, value);
    this.size++;
  }

  delete(key: bigint): boolean {
    if (this.tail.delete(key)) {
      this.size--;
      return true;
    }
    for (const chunk of this.chunks) {
      if (chunk.delete(key)) {
        this.size--;
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.chunks.length = 0;
    this.tail = new Map();
    this.size = 0;
  }

  [Symbol.iterator](): IterableIterator<[bigint, number]> {
    const chunks = this.chunks;
    const tail = this.tail;
    return (function* () {
      for (const chunk of chunks) yield* chunk;
      yield* tail;
    })();
  }
}

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

export class LandStore {
  private readonly db: DatabaseSync;
  private readonly insertEntire: StatementSync;
  private readonly upsertPartial: StatementSync;
  private readonly deletePartial: StatementSync;
  private readonly insertFailure: StatementSync;
  private readonly upsertMeta: StatementSync;
  private readonly partial = new ChunkedNumberMap();
  private readonly dirty = new Set<bigint>();
  private readonly removePartial = new Set<bigint>();
  private entireQueue: bigint[] = [];
  private fineQueue: bigint[] = [];
  private fineStates: number[] = [];
  private pendingEntire = 0;
  private pendingFineEntire = 0;
  private pendingFinePartial = 0;
  private appliedSinceLog = 0;
  private inTransaction = false;
  private readonly insertFine: StatementSync;
  readonly hierarchical: boolean;
  phase: LandPhase;
  private basePrefix: Uint32Array | null = null;
  private baseState: Uint8Array | null = null;
  entireCount: number;
  oversizeCount: number;
  failureCount: number;
  nextFeature: number;
  finalized: boolean;
  readonly params: LandParams;

  private constructor(db: DatabaseSync, params: LandParams, resumed: boolean) {
    this.db = db;
    this.params = params;
    this.insertEntire = db.prepare(
      "INSERT OR IGNORE INTO cells (h3, state) VALUES (?, ?)"
    );
    this.insertFine = db.prepare(
      "INSERT OR IGNORE INTO fine (h3, state) VALUES (?, ?)"
    );
    this.upsertPartial = db.prepare(`
      INSERT INTO partial (h3, cover_m2) VALUES (?, ?)
      ON CONFLICT(h3) DO UPDATE SET cover_m2 = excluded.cover_m2
    `);
    this.deletePartial = db.prepare("DELETE FROM partial WHERE h3 = ?");
    this.insertFailure = db.prepare(
      "INSERT OR REPLACE INTO failures (feature_index, message) VALUES (?, ?)"
    );
    this.upsertMeta = db.prepare(`
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    this.entireCount = resumed ? readCount(db, "entire_count") : 0;
    this.oversizeCount = resumed ? readCount(db, "oversize_count") : 0;
    this.failureCount = resumed ? readCount(db, "failure_count") : 0;
    this.nextFeature = resumed ? readCount(db, "next_feature") : 0;
    this.finalized = resumed && readMeta(db, "finalized") === "1";
    this.hierarchical = params.hierarchical === true;
    const storedPhase = resumed ? readMeta(db, "phase") : null;
    this.phase = isLandPhase(storedPhase)
      ? storedPhase
      : this.hierarchical
        ? "coarse"
        : "flat";
    if (resumed) {
      // Node 22.16 cannot return a full H3 id as a number. Ask SQLite for hex.
      for (const row of db
        .prepare("SELECT printf('%x', h3) AS h3, cover_m2 FROM partial")
        .iterate()) {
        const record = row as { h3: string; cover_m2: number };
        this.partial.set(cellToInt(record.h3), record.cover_m2);
      }
    }
    if (this.hierarchical) this.loadBaseState(resumed);
  }

  static open(path: string, params: LandParams, restart: boolean): LandStore {
    if (restart) {
      rmSync(path, { force: true });
      rmSync(`${path}-wal`, { force: true });
      rmSync(`${path}-shm`, { force: true });
    }
    mkdirSync(dirname(path), { recursive: true });
    const db = new SqliteDatabase(path, { timeout: 10_000 });
    db.prepare("PRAGMA journal_mode = WAL").get();
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA temp_store = MEMORY");
    db.exec("PRAGMA cache_size = -262144");
    db.exec(SCHEMA);
    const existingInput = readMeta(db, "input");
    if (!restart && existingInput != null) {
      assertSameRun(db, params);
      return new LandStore(db, params, true);
    }
    db.exec("DELETE FROM cells");
    db.exec("DELETE FROM partial");
    db.exec("DELETE FROM fine");
    db.exec("DELETE FROM failures");
    db.exec("DELETE FROM meta");
    const store = new LandStore(db, params, false);
    store.writeParams();
    store.commit(0);
    return store;
  }

  apply(contribution: GeometryContribution, epsilon = this.params.epsilon): void {
    for (const h3 of contribution.entire) this.markEntire(h3);
    for (const [h3, area] of contribution.cover) {
      if (contribution.entire.has(h3)) continue;
      this.addCover(h3, area, epsilon);
    }
  }

  /** Resolution-7 cells fully inside one land piece. Their descendants are land. */
  applyCoarse(sealed: Iterable<bigint>, overlap: Iterable<[bigint, number]>): void {
    for (const h3 of sealed) this.seal(h3);
    for (const [h3, area] of overlap) this.noteMixed(h3, area);
  }

  /** Area added to resolution-9 cells under mixed resolution-7 parents. */
  applyRefine(covers: Iterable<[bigint, number]>, epsilon = this.params.epsilon): void {
    for (const [h3, area] of covers) this.addCover(h3, area, epsilon);
  }

  isMixed(h3: bigint): boolean {
    return this.baseRankState(h3) === STATE_PARTIAL;
  }

  isSealed(h3: bigint): boolean {
    return this.baseRankState(h3) === STATE_ENTIRE;
  }

  fail(featureIndex: number, message: string): void {
    this.insertFailure.run(featureIndex, message);
    this.failureCount++;
  }

  /**
   * Persist queued cells and set the resume cursor to `nextFeature`
   * (the first feature not yet finished).
   */
  commit(nextFeature: number): void {
    this.begin();
    try {
      this.flushEntire();
      this.flushFine();
      for (const h3 of this.removePartial) this.deletePartial.run(h3);
      this.removePartial.clear();
      for (const h3 of this.dirty) {
        const cover = this.partial.get(h3);
        if (cover === undefined) continue;
        this.upsertPartial.run(h3, cover);
      }
      this.dirty.clear();
      this.nextFeature = nextFeature;
      const entireCount = this.entireCount + this.pendingEntire;
      const fineEntire = readCount(this.db, "fine_entire") + this.pendingFineEntire;
      const finePartial = readCount(this.db, "fine_partial") + this.pendingFinePartial;
      this.putMeta("next_feature", String(nextFeature));
      this.putMeta("entire_count", String(entireCount));
      this.putMeta("fine_entire", String(fineEntire));
      this.putMeta("fine_partial", String(finePartial));
      this.putMeta("oversize_count", String(this.oversizeCount));
      this.putMeta("failure_count", String(this.failureCount));
      this.putMeta("open_partials", String(this.partial.size));
      this.db.exec("COMMIT");
      this.inTransaction = false;
      this.entireCount = entireCount;
      this.pendingEntire = 0;
      this.pendingFineEntire = 0;
      this.pendingFinePartial = 0;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * Resolution-7 overlapping cells become the refine set. Their coverage is
   * dropped; the refine pass measures children from the polygons again.
   * Sealed cells on the edge of the sealed region join them, because their
   * corner descendants reach into the unsealed neighbor.
   */
  finishCoarse(): void {
    if (this.phase !== "coarse") throw new Error("the coarse pass is not open");
    let mixed = 0;
    this.begin();
    try {
      this.flushEntire();
      for (const h3 of this.removePartial) this.deletePartial.run(h3);
      this.removePartial.clear();
      for (const h3 of this.dirty) {
        const cover = this.partial.get(h3);
        if (cover === undefined) continue;
        this.upsertPartial.run(h3, cover);
      }
      this.dirty.clear();
      const insertMixed = this.db.prepare(
        "INSERT OR IGNORE INTO cells (h3, state) VALUES (?, ?)"
      );
      for (const [h3] of this.partial) {
        if (this.baseRankState(h3) === STATE_ENTIRE) continue;
        insertMixed.run(h3, STATE_PARTIAL);
        mixed++;
      }
      this.db.exec("DELETE FROM partial");
      this.partial.clear();
      const demoted = this.demoteSealedEdge();
      const entireCount = this.entireCount + this.pendingEntire - demoted;
      this.nextFeature = 0;
      this.phase = "refine";
      this.putMeta("phase", "refine");
      this.putMeta("next_feature", "0");
      this.putMeta("entire_count", String(entireCount));
      this.putMeta("mixed_count", String(mixed + demoted));
      this.putMeta("open_partials", "0");
      this.db.exec("COMMIT");
      this.inTransaction = false;
      this.entireCount = entireCount;
      this.pendingEntire = 0;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * Throw away the refine pass and start it again from the sealed and mixed
   * resolution-7 cells. Used after a change to how fine cells are measured.
   */
  resetRefine(): void {
    if (!this.hierarchical) throw new Error("only a two-pass database can redo its refine pass");
    if (this.phase !== "refine" && this.phase !== "done") {
      throw new Error("the coarse pass has not finished, so there is no refine pass to redo");
    }
    this.begin();
    try {
      this.entireQueue = [];
      this.fineQueue = [];
      this.fineStates = [];
      this.partial.clear();
      this.dirty.clear();
      this.removePartial.clear();
      this.db.exec("DELETE FROM fine");
      this.db.exec("DELETE FROM partial");
      this.db.exec("DELETE FROM failures");
      const demoted = this.demoteSealedEdge();
      const entireCount = this.entireCount - demoted;
      this.nextFeature = 0;
      this.phase = "refine";
      this.finalized = false;
      this.failureCount = 0;
      this.oversizeCount = 0;
      this.pendingEntire = 0;
      this.pendingFineEntire = 0;
      this.pendingFinePartial = 0;
      this.putMeta("phase", "refine");
      this.putMeta("next_feature", "0");
      this.putMeta("finalized", "0");
      this.putMeta("entire_count", String(entireCount));
      this.putMeta("mixed_count", String(readCount(this.db, "mixed_count") + demoted));
      this.putMeta("fine_entire", "0");
      this.putMeta("fine_partial", "0");
      this.putMeta("partial_count", "0");
      this.putMeta("oversize_count", "0");
      this.putMeta("failure_count", "0");
      this.putMeta("open_partials", "0");
      this.db.exec("COMMIT");
      this.inTransaction = false;
      this.entireCount = entireCount;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * A sealed resolution-7 cell stands for all of its descendants, but the
   * corner descendants two levels down lie half outside its outline. That is
   * only safe when every neighbor is sealed too. Sealed cells with an
   * unsealed neighbor become mixed, and the refine pass measures them.
   * Runs once per database; the flag keeps a second call from eroding the
   * next ring.
   */
  private demoteSealedEdge(): number {
    if (readMeta(this.db, "sealed_edge_demoted") === "1") return 0;
    const baseState = this.baseState!;
    const prefix = this.basePrefix!;
    const res0 = getRes0Cells().sort(
      (a, b) => getBaseCellNumber(a) - getBaseCellNumber(b)
    );
    const demote: bigint[] = [];
    let scanned = 0;
    const started = Date.now();
    for (let base = 0; base < 122; base++) {
      const start = prefix[base]!;
      const end = prefix[base + 1]!;
      const baseCell = res0[base]!;
      for (let rank = start; rank < end; rank++) {
        if (baseState[rank] !== STATE_ENTIRE) continue;
        const cell = childPosToCell(rank - start, baseCell, BASE_RESOLUTION);
        for (const neighbor of gridDisk(cell, 1)) {
          if (neighbor === cell) continue;
          if (baseState[this.rank7(cellToInt(neighbor))] !== STATE_ENTIRE) {
            demote.push(cellToInt(cell));
            break;
          }
        }
        scanned++;
        if (scanned % 5_000_000 === 0) {
          console.error(
            `  checked ${formatCount(scanned)} sealed cells, ${formatCount(demote.length)} on the edge, ${((Date.now() - started) / 1000).toFixed(0)}s`
          );
        }
      }
    }
    const update = this.db.prepare("UPDATE cells SET state = ? WHERE h3 = ?");
    for (const h3 of demote) {
      baseState[this.rank7(h3)] = STATE_PARTIAL;
      update.run(STATE_PARTIAL, h3);
    }
    this.putMeta("sealed_edge_demoted", "1");
    console.error(
      `  ${formatCount(demote.length)} sealed cells touch an unsealed neighbor and will be refined`
    );
    return demote.length;
  }

  finalize(): { entire: number; partial: number; oversize: number } {
    if (this.phase === "refine") return this.finalizeRefine();
    if (this.phase === "coarse") throw new Error("the coarse pass is not finished");
    let partialCount = 0;
    let promoted = 0;
    this.begin();
    try {
      this.flushEntire();
      for (const h3 of this.removePartial) this.deletePartial.run(h3);
      this.removePartial.clear();
      const exists = this.db.prepare("SELECT 1 AS hit FROM cells WHERE h3 = ?");
      for (const [h3, cover] of this.partial) {
        if (exists.get(h3)) continue;
        const cellArea = hexAreaM2(h3);
        const entire = cover >= cellArea * (1 - this.params.epsilon);
        const info = this.insertEntire.run(
          h3,
          entire ? STATE_ENTIRE : STATE_PARTIAL
        );
        if (Number(info.changes) > 0) {
          if (entire) promoted++;
          else partialCount++;
        }
      }
      this.db.exec("DELETE FROM partial");
      const entireCount = this.entireCount + this.pendingEntire + promoted;
      this.putMeta("partial_count", String(partialCount));
      this.putMeta("finalized", this.failureCount === 0 ? "1" : "0");
      this.putMeta("entire_count", String(entireCount));
      this.putMeta("open_partials", "0");
      this.putMeta("oversize_count", String(this.oversizeCount));
      this.putMeta("failure_count", String(this.failureCount));
      this.putMeta("next_feature", String(this.nextFeature));
      this.db.exec("COMMIT");
      this.inTransaction = false;
      this.entireCount = entireCount;
      this.pendingEntire = 0;
      this.partial.clear();
      this.dirty.clear();
    } catch (error) {
      this.rollback();
      throw error;
    }
    this.finalized = this.failureCount === 0;
    return {
      entire: this.entireCount,
      partial: partialCount,
      oversize: this.oversizeCount,
    };
  }

  setFeaturesCount(count: number): void {
    if (readMeta(this.db, "features_count") === String(count)) return;
    this.putMeta("features_count", String(count));
  }

  get openPartials(): number {
    return this.partial.size;
  }

  close(): void {
    this.rollback();
    this.db.close();
  }

  private markEntire(h3: bigint): void {
    if (this.partial.delete(h3)) this.removePartial.add(h3);
    this.dirty.delete(h3);
    if (this.phase === "refine") {
      this.queueFine(h3, STATE_ENTIRE);
      return;
    }
    this.entireQueue.push(h3);
    this.appliedSinceLog++;
    if (this.entireQueue.length >= 20_000) this.flushEntire();
    this.maybeLogInsert();
  }

  private seal(h3: bigint): void {
    const rank = this.rank7(h3);
    const state = this.baseState![rank] ?? 0;
    if (state === STATE_ENTIRE) return;
    if (state === STATE_PARTIAL) {
      this.partial.delete(h3);
      this.removePartial.add(h3);
      this.dirty.delete(h3);
    }
    this.baseState![rank] = STATE_ENTIRE;
    this.entireQueue.push(h3);
    this.appliedSinceLog++;
    if (this.entireQueue.length >= 20_000) this.flushEntire();
    this.maybeLogInsert();
  }

  private noteMixed(h3: bigint, area: number): void {
    if (!(area > MIN_COVER_M2)) return;
    const rank = this.rank7(h3);
    if ((this.baseState![rank] ?? 0) === STATE_ENTIRE) return;
    this.baseState![rank] = STATE_PARTIAL;
    this.partial.set(h3, (this.partial.get(h3) ?? 0) + area);
    this.dirty.add(h3);
  }

  private queueFine(h3: bigint, state: number): void {
    this.fineQueue.push(h3);
    this.fineStates.push(state);
    if (this.fineQueue.length >= 20_000) this.flushFine();
  }

  private baseRankState(h3: bigint): number {
    if (!this.baseState) return 0;
    return this.baseState[this.rank7(h3)] ?? 0;
  }

  private rank7(h3: bigint): number {
    const cell = intToCell(h3);
    const base = getBaseCellNumber(cell);
    const pos = cellToChildPos(cell, 0);
    return this.basePrefix![base]! + pos;
  }

  private loadBaseState(resumed: boolean): void {
    this.basePrefix = buildBasePrefix(BASE_RESOLUTION);
    this.baseState = new Uint8Array(this.basePrefix[122]!);
    if (!resumed) return;
    const stmt = this.db.prepare("SELECT printf('%x', h3) AS h3, state FROM cells");
    for (const row of stmt.iterate()) {
      const record = row as { h3: string; state: number };
      const rank = this.rank7(cellToInt(record.h3.padStart(15, "0")));
      this.baseState[rank] = record.state;
    }
    if (this.phase !== "coarse") return;
    for (const [h3] of this.partial) {
      const rank = this.rank7(h3);
      if ((this.baseState[rank] ?? 0) !== STATE_ENTIRE) this.baseState[rank] = STATE_PARTIAL;
    }
  }

  private addCover(h3: bigint, area: number, epsilon: number): void {
    const cellArea = hexAreaM2(h3);
    const decision = nextCover(this.partial.get(h3) ?? 0, area, cellArea, epsilon);
    if (decision.kind === "unchanged") return;
    if (decision.kind === "entire") {
      if (decision.cover > cellArea * 1.01) this.oversizeCount++;
      this.markEntire(h3);
      return;
    }
    this.partial.set(h3, decision.cover);
    this.dirty.add(h3);
  }

  private begin(): void {
    if (this.inTransaction) return;
    this.db.exec("BEGIN IMMEDIATE");
    this.inTransaction = true;
  }

  private rollback(): void {
    if (!this.inTransaction) return;
    this.db.exec("ROLLBACK");
    this.inTransaction = false;
  }

  private flushEntire(): void {
    if (this.entireQueue.length === 0) return;
    this.begin();
    for (const h3 of this.entireQueue) {
      const info = this.insertEntire.run(h3, STATE_ENTIRE);
      if (Number(info.changes) > 0) this.pendingEntire++;
    }
    this.entireQueue = [];
  }

  private flushFine(): void {
    if (this.fineQueue.length === 0) return;
    this.begin();
    for (let i = 0; i < this.fineQueue.length; i++) {
      const info = this.insertFine.run(this.fineQueue[i], this.fineStates[i]);
      if (Number(info.changes) === 0) continue;
      if (this.fineStates[i] === STATE_ENTIRE) this.pendingFineEntire++;
      else this.pendingFinePartial++;
    }
    this.fineQueue = [];
    this.fineStates = [];
  }

  private finalizeRefine(): { entire: number; partial: number; oversize: number } {
    let partialCount = 0;
    let promoted = 0;
    this.begin();
    try {
      this.flushFine();
      for (const h3 of this.removePartial) this.deletePartial.run(h3);
      this.removePartial.clear();
      for (const [h3, cover] of this.partial) {
        const cellArea = hexAreaM2(h3);
        const entire = cover >= cellArea * (1 - this.params.epsilon);
        if (entire && cover > cellArea * 1.01) this.oversizeCount++;
        const info = this.insertFine.run(h3, entire ? STATE_ENTIRE : STATE_PARTIAL);
        if (Number(info.changes) === 0) continue;
        if (entire) promoted++;
        else partialCount++;
      }
      this.db.exec("DELETE FROM partial");
      const fineEntire = readCount(this.db, "fine_entire") + this.pendingFineEntire + promoted;
      const finePartial = readCount(this.db, "fine_partial") + this.pendingFinePartial + partialCount;
      this.putMeta("fine_entire", String(fineEntire));
      this.putMeta("fine_partial", String(finePartial));
      this.putMeta("partial_count", String(finePartial));
      this.putMeta("finalized", this.failureCount === 0 ? "1" : "0");
      this.putMeta("phase", "done");
      this.putMeta("open_partials", "0");
      this.putMeta("oversize_count", String(this.oversizeCount));
      this.putMeta("failure_count", String(this.failureCount));
      this.putMeta("next_feature", String(this.nextFeature));
      this.db.exec("COMMIT");
      this.inTransaction = false;
      this.pendingFineEntire = fineEntire;
      this.pendingFinePartial = finePartial;
      this.partial.clear();
      this.dirty.clear();
    } catch (error) {
      this.rollback();
      throw error;
    }
    this.phase = "done";
    this.finalized = this.failureCount === 0;
    return {
      entire: this.entireCount,
      partial: partialCount,
      oversize: this.oversizeCount,
    };
  }

  private maybeLogInsert(): void {
    if (this.appliedSinceLog < 500_000) return;
    this.appliedSinceLog = 0;
    console.error(
      `  writing cells: ${formatCount(this.entireCount + this.pendingEntire + this.entireQueue.length)} entire queued, ${formatCount(this.partial.size)} open boundary`
    );
  }

  private writeParams(): void {
    this.putMeta("generator_version", GENERATOR_VERSION);
    this.putMeta("input", this.params.input);
    this.putMeta("resolution", String(this.params.resolution));
    this.putMeta("epsilon", String(this.params.epsilon));
    this.putMeta("bbox", this.params.bbox);
    this.putMeta("source_path", this.params.sourcePath);
    this.putMeta("absent_state", "none");
    this.putMeta("state_partial", String(STATE_PARTIAL));
    this.putMeta("state_entire", String(STATE_ENTIRE));
    this.putMeta("finalized", "0");
    this.putMeta("phase", this.phase);
    if (this.hierarchical) this.putMeta("base_resolution", String(BASE_RESOLUTION));
  }

  private putMeta(key: string, value: string): void {
    this.upsertMeta.run(key, value);
  }
}

export function readCellState(path: string, h3: bigint): number | null {
  const db = new SqliteDatabase(path, { readOnly: true, timeout: 10_000 });
  try {
    const row = db.prepare("SELECT state FROM cells WHERE h3 = ?").get(h3) as
      | { state: number }
      | undefined;
    return row?.state ?? null;
  } finally {
    db.close();
  }
}

export function readLandSummary(path: string): LandSummary {
  const db = new SqliteDatabase(path, { readOnly: true, timeout: 10_000 });
  try {
    const meta: Record<string, string> = {};
    for (const row of db.prepare("SELECT key, value FROM meta").iterate()) {
      const record = row as { key: string; value: string };
      meta[record.key] = record.value;
    }
    const openPartials = Number(
      (db.prepare("SELECT COUNT(*) AS n FROM partial").get() as { n: number }).n
    );
    const failures = Number(
      (db.prepare("SELECT COUNT(*) AS n FROM failures").get() as { n: number }).n
    );
    return {
      meta,
      finalized: meta.finalized === "1",
      entire: Number(meta.entire_count ?? 0),
      partial: Number(meta.partial_count ?? 0),
      openPartials,
      oversize: Number(meta.oversize_count ?? 0),
      failures,
      nextFeature: Number(meta.next_feature ?? 0),
    };
  } finally {
    db.close();
  }
}

function readMeta(db: InstanceType<typeof SqliteDatabase>, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function readCount(db: InstanceType<typeof SqliteDatabase>, key: string): number {
  const value = readMeta(db, key);
  return value == null ? 0 : Number(value);
}

function assertSameRun(db: DatabaseSync, params: LandParams): void {
  const expected: Array<[string, string]> = [
    ["generator_version", GENERATOR_VERSION],
    ["input", params.input],
    ["resolution", String(params.resolution)],
    ["epsilon", String(params.epsilon)],
    ["bbox", params.bbox],
  ];
  if (params.hierarchical) {
    expected.push(["base_resolution", String(BASE_RESOLUTION)]);
  }
  const mismatches = expected.filter(([key, value]) => readMeta(db, key) !== value);
  if (mismatches.length === 0) return;
  const details = mismatches
    .map(([key, value]) => `${key}: db has ${readMeta(db, key)}, args have ${value}`)
    .join("; ");
  throw new Error(
    `output database was started with different parameters (${details}). Pass --restart to rebuild it.`
  );
}

function isLandPhase(value: string | null): value is LandPhase {
  return value === "flat" || value === "coarse" || value === "refine" || value === "done";
}

function buildBasePrefix(resolution: number): Uint32Array {
  const pentagonBases = new Set<number>(
    getPentagons(0).map((cell) => getBaseCellNumber(cell))
  );
  const starts = new Uint32Array(123);
  for (let base = 0; base < 122; base++) {
    const count = pentagonBases.has(base)
      ? 1 + (5 * (7 ** resolution - 1)) / 6
      : 7 ** resolution;
    starts[base + 1] = starts[base]! + count;
  }
  return starts;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export { DEFAULT_COVER_EPSILON };
