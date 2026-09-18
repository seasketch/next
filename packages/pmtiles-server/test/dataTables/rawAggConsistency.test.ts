import { beforeAll, describe, expect, it } from "vitest";
import {
  AsyncBuffer,
  FileMetaData,
  asyncBufferFromFile,
  parquetMetadataAsync,
} from "hyparquet";
import { parquetWriteBuffer } from "hyparquet-writer";
import { parseQueryParams, QueryError } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery } from "../../src/dataTables/engine/execute";
import { stepsOverlappingInterval } from "../../src/dataTables/whenStep";

/**
 * Raw-row vs. aggregate CONSISTENCY suite (see the invariant comment at the
 * top of src/dataTables/engine/execute.ts).
 *
 * The client's "Show rows in calculation" QA/QC modal fetches raw rows with
 * the exact same `q.*` / `when.*` parameters used for map statistics and
 * presents them as "the rows behind this number". These tests guarantee that
 * promise holds: for a matrix of filter and temporal-window combinations,
 * aggregates returned by the engine must equal values recomputed
 * independently from the engine's own raw-row output.
 *
 * If a change to filtering, `when` handling, or null semantics breaks these
 * tests, DO NOT loosen the assertions — the two code paths must be brought
 * back into agreement instead.
 */

const FIXTURE = "test/dataTables/fixtures/data.parquet";

let piscoFile: AsyncBuffer;
let piscoMetadata: FileMetaData;

let temporalFile: AsyncBuffer;
let temporalMetadata: FileMetaData;

function asyncBufferFromArrayBuffer(buffer: ArrayBuffer): AsyncBuffer {
  return {
    byteLength: buffer.byteLength,
    slice: (start: number, end?: number) => buffer.slice(start, end),
  };
}

const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const secBig = (iso: string) => BigInt(sec(iso));

/**
 * Small synthetic monitoring table with derived `_when_*` columns, including
 * a row that spans a year boundary (must appear in two year bins), null
 * measure values, a true zero, and deliberately unsorted temporal order.
 */
function buildTemporalFixture(): ArrayBuffer {
  // site, classcode, count, year, [_when_start, _when_end)
  const rows: [
    string,
    string,
    number | null,
    number,
    string,
    string
  ][] = [
    ["B", "X", 10, 2020, "2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z"],
    ["A", "X", 2, 2018, "2018-01-01T00:00:00Z", "2019-01-01T00:00:00Z"],
    ["A", "X", null, 2019, "2019-01-01T00:00:00Z", "2020-01-01T00:00:00Z"],
    ["B", "Y", 3, 2018, "2018-03-15T00:00:00Z", "2018-03-16T00:00:00Z"],
    // Spans two calendar years: must be counted in both 2018 and 2019 bins.
    ["A", "X", 6, 2018, "2018-07-01T00:00:00Z", "2019-07-01T00:00:00Z"],
    ["A", "Y", 0, 2019, "2019-01-01T00:00:00Z", "2020-01-01T00:00:00Z"],
    ["B", "X", null, 2020, "2020-06-01T00:00:00Z", "2020-06-02T00:00:00Z"],
    ["A", "X", 4, 2018, "2018-06-01T00:00:00Z", "2018-07-01T00:00:00Z"],
    ["B", "X", 8, 2019, "2019-05-01T00:00:00Z", "2019-06-01T00:00:00Z"],
    ["A", "Y", 5, 2020, "2020-02-01T00:00:00Z", "2020-03-01T00:00:00Z"],
  ];
  return parquetWriteBuffer({
    columnData: [
      { name: "site", data: rows.map((r) => r[0]), type: "STRING" },
      { name: "classcode", data: rows.map((r) => r[1]), type: "STRING" },
      { name: "count", data: rows.map((r) => r[2]), type: "DOUBLE" },
      { name: "year", data: rows.map((r) => r[3]), type: "INT32" },
      {
        name: "_when_start",
        data: rows.map((r) => secBig(r[4])),
        type: "INT64",
      },
      {
        name: "_when_end",
        data: rows.map((r) => secBig(r[5])),
        type: "INT64",
      },
    ],
  });
}

beforeAll(async () => {
  piscoFile = await asyncBufferFromFile(FIXTURE);
  piscoMetadata = await parquetMetadataAsync(piscoFile);
  temporalFile = asyncBufferFromArrayBuffer(buildTemporalFixture());
  temporalMetadata = await parquetMetadataAsync(temporalFile);
});

async function run(
  file: AsyncBuffer,
  metadata: FileMetaData,
  qs: string
) {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(metadata, query, file);
  const result = await executeQuery({ file, metadata, query, plan });
  return { query, plan, result };
}

type Row = Record<string, unknown>;

/** Recompute sum/mean/count/min/max exactly like SQL over non-null values. */
function recompute(rows: Row[], column: string) {
  const values = rows
    .map((row) => row[column])
    .filter((value): value is number => typeof value === "number");
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    rowCount: rows.length,
    valueCount: values.length,
    sum,
    mean: values.length ? sum / values.length : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}

describe("raw rows and aggregates select identical row sets (PISCO fixture)", () => {
  const CASES = [
    "q.classcode=PYCHEL&q.year=2018",
    "q.classcode=SOLSPP",
    "q.observer=in.(CHAD BURT,LYALL BELLQUIST)",
    "q.count=gte.4000",
    "q.year=gte.2010&q.year=lte.2012&q.campus=UCSC",
    // Matches zero rows (HSU did not sample 2010-2012): both paths must
    // agree on emptiness as well.
    "q.year=gte.2010&q.year=lte.2012&q.campus=HSU",
    "q.size=is.null&q.classcode=PYCHEL",
  ];

  for (const qs of CASES) {
    it(`agg equals recomputation from raw rows: ${qs}`, async () => {
      const raw = await run(
        piscoFile,
        piscoMetadata,
        `${qs}&limit=100000`
      );
      expect(raw.result.rows).toBeDefined();
      // The page covers every match; otherwise recomputation is meaningless.
      expect(raw.result.rows!.length).toBe(raw.result.rowsMatched);
      const expected = recompute(raw.result.rows as Row[], "count");

      // COUNT(*) with no measure column === number of raw rows.
      const countOnly = await run(piscoFile, piscoMetadata, `op=count&${qs}`);
      expect(countOnly.result.rowsMatched).toBe(raw.result.rowsMatched);

      // Aggregations over a measure column (null-skipping semantics).
      const agg = await run(
        piscoFile,
        piscoMetadata,
        `op=count,sum,mean,min,max&column=count&${qs}`
      );
      if (expected.rowCount === 0) {
        // Nothing matched: both paths must agree on emptiness.
        expect(countOnly.result.groups).toEqual([]);
        expect(agg.result.groups).toEqual([]);
        return;
      }
      expect(countOnly.result.groups![0].count).toBe(expected.rowCount);
      const group = agg.result.groups![0] as Row;
      expect(group.count).toBe(expected.valueCount);
      expect(group.min).toBe(expected.min);
      expect(group.max).toBe(expected.max);
      if (expected.valueCount === 0) {
        expect(group.sum).toBeNull();
        expect(group.mean).toBeNull();
      } else {
        expect(group.sum as number).toBeCloseTo(expected.sum, 6);
        expect(group.mean as number).toBeCloseTo(expected.mean!, 6);
      }
    });
  }

  it("per-group aggregates equal per-group recomputation (groupBy=site)", async () => {
    const qs = "q.classcode=PYCHEL";
    const raw = await run(piscoFile, piscoMetadata, `${qs}&limit=100000`);
    expect(raw.result.rows!.length).toBe(raw.result.rowsMatched);
    const bySite = new Map<string, Row[]>();
    for (const row of raw.result.rows as Row[]) {
      const site = String(row.site);
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site)!.push(row);
    }

    const agg = await run(
      piscoFile,
      piscoMetadata,
      `groupBy=site&op=count,sum,mean&column=count&${qs}`
    );
    expect(agg.result.groups!.length).toBe(bySite.size);
    for (const group of agg.result.groups! as Row[]) {
      const rows = bySite.get(String(group.site));
      expect(rows).toBeDefined();
      const expected = recompute(rows!, "count");
      expect(group.count).toBe(expected.valueCount);
      if (expected.valueCount === 0) {
        expect(group.sum).toBeNull();
        expect(group.mean).toBeNull();
      } else {
        expect(group.sum as number).toBeCloseTo(expected.sum, 6);
        expect(group.mean as number).toBeCloseTo(expected.mean!, 6);
      }
    }
  });
});

describe("temporal (when / when.step) consistency (synthetic fixture)", () => {
  const WINDOW = `when.start=${sec("2018-01-01T00:00:00Z")}&when.end=${sec(
    "2021-01-01T00:00:00Z"
  )}`;

  it("known-value sanity check for a single-year window", async () => {
    // Independent of both engine paths: hand-computed from the fixture rows.
    // Window [2018, 2019) overlaps rows with counts 2, 6, 4 (site A) and 3
    // (site B); everything else starts in 2019 or later.
    const window = `when.start=${sec("2018-01-01T00:00:00Z")}&when.end=${sec(
      "2019-01-01T00:00:00Z"
    )}`;
    const agg = await run(
      temporalFile,
      temporalMetadata,
      `op=count,sum,mean&column=count&${window}`
    );
    expect(agg.result.groups).toEqual([{ count: 4, sum: 15, mean: 3.75 }]);
    const raw = await run(
      temporalFile,
      temporalMetadata,
      `${window}&includeWhen=1&limit=1000`
    );
    expect(raw.result.rowsMatched).toBe(4);
    expect(
      (raw.result.rows as Row[])
        .map((row) => row.count)
        .sort((a, b) => Number(a) - Number(b))
    ).toEqual([2, 3, 4, 6]);
  });

  it("raw rows within a when window match the aggregate count and overlap the window", async () => {
    const raw = await run(
      temporalFile,
      temporalMetadata,
      `${WINDOW}&includeWhen=1&limit=1000`
    );
    const countOnly = await run(
      temporalFile,
      temporalMetadata,
      `op=count&${WINDOW}`
    );
    expect(countOnly.result.groups![0].count).toBe(raw.result.rowsMatched);
    expect(raw.result.rows!.length).toBe(raw.result.rowsMatched);
    const startSec = sec("2018-01-01T00:00:00Z");
    const endSec = sec("2021-01-01T00:00:00Z");
    for (const row of raw.result.rows as Row[]) {
      expect(typeof row._when_start).toBe("number");
      expect(typeof row._when_end).toBe("number");
      expect(Number(row._when_start)).toBeLessThan(endSec);
      expect(Number(row._when_end)).toBeGreaterThan(startSec);
    }
  });

  it("when.step per-site bins equal recomputation from raw rows (year-spanning rows fan out)", async () => {
    const raw = await run(
      temporalFile,
      temporalMetadata,
      `${WINDOW}&includeWhen=1&limit=1000`
    );
    const window = {
      startSec: sec("2018-01-01T00:00:00Z"),
      endSec: sec("2021-01-01T00:00:00Z"),
    };
    // Recompute (site, step) accumulators from raw rows using the same
    // interval-overlap rule (imported, not re-implemented).
    const expected = new Map<
      string,
      { rowCount: number; valueCount: number; sum: number }
    >();
    for (const row of raw.result.rows as Row[]) {
      const steps = stepsOverlappingInterval(
        Number(row._when_start),
        Number(row._when_end),
        window,
        "year"
      );
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        const key = `${step}|${row.site}`;
        const acc = expected.get(key) || {
          rowCount: 0,
          valueCount: 0,
          sum: 0,
        };
        acc.rowCount += 1;
        if (typeof row.count === "number") {
          acc.valueCount += 1;
          acc.sum += row.count;
        }
        expected.set(key, acc);
      }
    }

    const agg = await run(
      temporalFile,
      temporalMetadata,
      `groupBy=site&op=mean,count&column=count&${WINDOW}&when.step=year`
    );
    expect(agg.result.groups!.length).toBe(expected.size);
    for (const group of agg.result.groups! as Row[]) {
      const acc = expected.get(`${group.step}|${group.site}`);
      expect(acc).toBeDefined();
      expect(group.count).toBe(acc!.valueCount);
      if (acc!.valueCount === 0) {
        expect(group.mean).toBeNull();
      } else {
        expect(group.mean as number).toBeCloseTo(
          acc!.sum / acc!.valueCount,
          6
        );
      }
    }

    // series.stepStats row counts must agree with raw-row fan-out too.
    for (const stat of agg.result.series!.stepStats) {
      let rows = 0;
      for (const [key, acc] of expected) {
        if (key.startsWith(`${stat.step}|`)) rows += acc.rowCount;
      }
      expect(stat.rows).toBe(rows);
    }
  });

  it("combines q.* filters with the when window identically in both paths", async () => {
    const qs = `q.classcode=X&${WINDOW}`;
    const raw = await run(
      temporalFile,
      temporalMetadata,
      `${qs}&includeWhen=1&limit=1000`
    );
    const agg = await run(
      temporalFile,
      temporalMetadata,
      `op=count,sum,mean&column=count&${qs}`
    );
    const expected = recompute(raw.result.rows as Row[], "count");
    const group = agg.result.groups![0] as Row;
    expect(agg.result.rowsMatched).toBe(raw.result.rowsMatched);
    expect(group.count).toBe(expected.valueCount);
    expect(group.sum as number).toBeCloseTo(expected.sum, 6);
    for (const row of raw.result.rows as Row[]) {
      expect(row.classcode).toBe("X");
    }
  });
});

describe("raw-row output for the QA/QC rows modal", () => {
  it("orders rows by the derived temporal mapping via orderBy=_when_start", async () => {
    const { result } = await run(
      temporalFile,
      temporalMetadata,
      "orderBy=_when_start:asc&includeWhen=1&limit=1000"
    );
    const starts = (result.rows as Row[]).map((row) => Number(row._when_start));
    expect(starts.length).toBe(10);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("hides _when_* by default and includes them with includeWhen=1", async () => {
    const bare = await run(temporalFile, temporalMetadata, "limit=1");
    expect(bare.result.rows![0]).not.toHaveProperty("_when_start");
    const included = await run(
      temporalFile,
      temporalMetadata,
      "includeWhen=1&limit=1"
    );
    expect(included.result.rows![0]).toHaveProperty("_when_start");
    expect(included.result.rows![0]).toHaveProperty("_when_end");
  });

  it("rejects includeWhen on aggregated queries", () => {
    expect(() =>
      parseQueryParams(new URLSearchParams("op=count&includeWhen=1"))
    ).toThrow(QueryError);
  });
});
