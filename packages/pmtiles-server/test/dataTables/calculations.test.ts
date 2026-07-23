import { beforeAll, describe, expect, it } from "vitest";
import {
  AsyncBuffer,
  FileMetaData,
  asyncBufferFromFile,
  parquetMetadataAsync,
} from "hyparquet";
import { parseQueryParams } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery, QueryResult } from "../../src/dataTables/engine/execute";

/**
 * Aggregation-correctness tests for the fixture PISCO kelp-forest swath survey
 * (353,253 rows, 3 row groups). These calculations drive thematic maps and
 * time-series charts used in a contentious public policy process, so every
 * expected value here was computed *independently* with DuckDB against the same
 * data.parquet fixture (see the queries in the comment above each test), not by
 * trusting the engine's own output.
 *
 * The two primary product use cases are exercised heavily:
 *   1. Thematic map    -> groupBy=site, aggregating `count` across surveys.
 *   2. Site time series -> fixed site, groupBy=year, one or more classcodes.
 *
 * Semantics being pinned (verified to match DuckDB / SQL):
 *   - sum/mean/min/max/median ignore NULL `count` values.
 *   - `count` WITH an aggregation column = COUNT(col) (non-null values);
 *     WITHOUT a column = COUNT(*) (matching rows).
 *   - A group whose values are all NULL yields sum/mean/min/max = null and
 *     count(col) = 0, while still reporting rowsMatched > 0.
 *   - count = 0 is a real value (sum stays 0, not null).
 */

const FIXTURE = "test/dataTables/fixtures/data.parquet";

let file: AsyncBuffer;
let metadata: FileMetaData;

beforeAll(async () => {
  file = await asyncBufferFromFile(FIXTURE);
  metadata = await parquetMetadataAsync(file);
});

async function run(qs: string): Promise<QueryResult> {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(metadata, query, file);
  return executeQuery({ file, metadata, query, plan });
}

/** Index aggregated groups by the value of a single groupBy column. */
function byKey(result: QueryResult, key: string): Record<string, any> {
  return Object.fromEntries(result.groups!.map((g: any) => [g[key], g]));
}

const MEAN_PRECISION = 6; // digits after the decimal point for toBeCloseTo

// ---------------------------------------------------------------------------
// Whole-table aggregates (no filters, no groupBy)
// ---------------------------------------------------------------------------
describe("whole-table aggregates", () => {
  // DuckDB: sum=11283244, min=0, max=13450, count(count)=353234, avg=31.9426895…
  it("sum/min/max/mean/count over the entire count column", async () => {
    const r = await run("op=sum,min,max,mean,count&column=count");
    const g = r.groups![0] as any;
    expect(g.sum).toBe(11283244);
    expect(g.min).toBe(0);
    expect(g.max).toBe(13450);
    expect(g.count).toBe(353234); // non-null values (19 rows have null count)
    expect(g.mean).toBeCloseTo(31.942689548571202, MEAN_PRECISION);
    expect(r.rowsScanned).toBe(353253);
    expect(r.rowsMatched).toBe(353253);
  });

  // COUNT(*) counts matching rows; the 19 null-count rows are included.
  it("count without a column is COUNT(*), including null-count rows", async () => {
    const r = await run("op=count");
    expect(r.groups).toEqual([{ count: 353253 }]);
  });
});

// ---------------------------------------------------------------------------
// NULL handling edge cases
// ---------------------------------------------------------------------------
describe("null handling", () => {
  // STRPURAD has 21,014 rows but 10 have a NULL count.
  // DuckDB: count(count)=21004, sum=5403907, min=1, max=13450,
  //         avg=257.2798990668444, median=41.
  it("excludes null values from sum/mean/min/max/median/count(col)", async () => {
    const r = await run(
      "op=sum,min,max,mean,median,count&column=count&q.classcode=STRPURAD"
    );
    const g = r.groups![0] as any;
    expect(r.rowsMatched).toBe(21014); // rows matched includes the 10 nulls
    expect(g.count).toBe(21004); // but count(col) excludes them
    expect(g.sum).toBe(5403907);
    expect(g.min).toBe(1);
    expect(g.max).toBe(13450);
    expect(g.median).toBe(41);
    expect(g.mean).toBeCloseTo(257.2798990668444, MEAN_PRECISION);
  });

  // NO_ORG is a single row with count = 0 (a real zero, not null).
  // DuckDB: count=1, sum=0, min=0, max=0, avg=0.
  it("treats count=0 as a real value, not null", async () => {
    const r = await run(
      "op=sum,min,max,mean,count&column=count&q.classcode=NO_ORG"
    );
    expect(r.rowsMatched).toBe(1);
    expect(r.groups).toEqual([{ sum: 0, min: 0, max: 0, mean: 0, count: 1 }]);
  });

  // STRPURAD at CASPAR_3 in 2015: 6 rows, every count NULL.
  // Aggregates collapse to null; count(col)=0 while rowsMatched=6.
  it("all-null group yields null aggregates but non-zero rowsMatched", async () => {
    const r = await run(
      "op=sum,min,max,mean,count&column=count" +
        "&q.classcode=STRPURAD&q.year=2015&q.site=CASPAR_3"
    );
    expect(r.rowsMatched).toBe(6);
    expect(r.groups).toEqual([
      { sum: null, min: null, max: null, mean: null, count: 0 },
    ]);
  });

  // Same group, COUNT(*) still sees all 6 rows.
  it("COUNT(*) counts rows even when every value is null", async () => {
    const r = await run(
      "op=count&q.classcode=STRPURAD&q.year=2015&q.site=CASPAR_3"
    );
    expect(r.groups).toEqual([{ count: 6 }]);
  });
});

// ---------------------------------------------------------------------------
// Thematic map: groupBy=site (PRIMARY use case)
// ---------------------------------------------------------------------------
describe("thematic map (groupBy=site)", () => {
  // MEGUND in 2004, per site. DuckDB reports 33 sites; spot-checked below.
  it("aggregates count per site for one species/year", async () => {
    const r = await run(
      "groupBy=site&op=sum,mean,min,max,count&column=count" +
        "&q.classcode=MEGUND&q.year=2004"
    );
    expect(r.groups).toHaveLength(33);
    expect(r.rowsMatched).toBe(126);
    const s = byKey(r, "site");

    expect(s["ROCKY_POINT_N"]).toMatchObject({
      sum: 490,
      min: 3,
      max: 105,
      count: 11,
    });
    expect(s["ROCKY_POINT_N"].mean).toBeCloseTo(44.54545454545455, MEAN_PRECISION);

    expect(s["SCI_VALLEY_CEN"]).toMatchObject({ sum: 332, count: 3 });
    expect(s["SCI_VALLEY_CEN"].mean).toBeCloseTo(110.66666666666667, MEAN_PRECISION);

    expect(s["ANACAPA_EAST_ISLE_CEN"]).toMatchObject({
      sum: 51,
      min: 3,
      max: 37,
      mean: 17,
      count: 3,
    });

    // Grand total across all site sums must equal the ungrouped sum (2031).
    const total = r.groups!.reduce((acc: number, g: any) => acc + g.sum, 0);
    expect(total).toBe(2031);
  });

  // STRPURAD in 2015, per site: 115 sites, mixing fully-null, partially-null,
  // and single-row groups. DuckDB: rows=1139, count(count)=1129.
  it("per-site aggregation with null and single-row groups", async () => {
    const r = await run(
      "groupBy=site&op=sum,mean,min,max,count&column=count" +
        "&q.classcode=STRPURAD&q.year=2015"
    );
    expect(r.groups).toHaveLength(115);
    expect(r.rowsMatched).toBe(1139);
    const s = byKey(r, "site");

    // Fully-null site: aggregates null, count(col)=0.
    expect(s["CASPAR_3"]).toEqual({
      site: "CASPAR_3",
      sum: null,
      mean: null,
      min: null,
      max: null,
      count: 0,
    });

    // Partially-null site: 6 rows, 2 non-null counts (510, 643).
    expect(s["TEN_MILE_2"]).toMatchObject({
      sum: 1153,
      min: 510,
      max: 643,
      mean: 576.5,
      count: 2,
    });

    // Single-row site.
    expect(s["PYRAMID_POINT_1"]).toEqual({
      site: "PYRAMID_POINT_1",
      sum: 1,
      mean: 1,
      min: 1,
      max: 1,
      count: 1,
    });

    expect(s["ANACAPA_LIGHTHOUSE_REEF_CEN"]).toMatchObject({
      sum: 6490,
      min: 820,
      max: 3100,
      mean: 1622.5,
      count: 4,
    });

    // count(col) totals across sites should equal DuckDB's 1129 non-null values.
    const nonNull = r.groups!.reduce((acc: number, g: any) => acc + g.count, 0);
    expect(nonNull).toBe(1129);
  });

  // Thematic maps often show the top-N sites. PISGIG across all years,
  // ordered by total count desc. DuckDB top 5 verified below.
  it("orders sites by summed count and paginates (top-N)", async () => {
    const r = await run(
      "groupBy=site&op=sum,count&column=count&q.classcode=PISGIG" +
        "&orderBy=sum:desc&limit=5"
    );
    expect(r.groups!.map((g: any) => [g.site, g.sum])).toEqual([
      ["SMI_HARRIS_PT_RESERVE_E", 1884],
      ["HOPKINS_DC", 1882],
      ["SCI_HAZARDS_CEN", 1454],
      ["SCI_PAINTED_CAVE_E", 1438],
      ["SCI_HAZARDS_W", 1245],
    ]);
  });

  // Top-N by mean (density) rather than total, for the same MEGUND 2004 slice.
  it("orders sites by mean count and paginates", async () => {
    const r = await run(
      "groupBy=site&op=mean,sum,count&column=count" +
        "&q.classcode=MEGUND&q.year=2004&orderBy=mean:desc&limit=3"
    );
    const sites = r.groups!.map((g: any) => g.site);
    expect(sites).toEqual([
      "SCI_VALLEY_CEN",
      "ANACAPA_EAST_ISLE_W",
      "ROCKY_POINT_N",
    ]);
    expect((r.groups![0] as any).mean).toBeCloseTo(
      110.66666666666667,
      MEAN_PRECISION
    );
    expect((r.groups![1] as any).mean).toBeCloseTo(52.5, MEAN_PRECISION);
  });
});

// ---------------------------------------------------------------------------
// Site time series: groupBy=year at a fixed site (SECONDARY use case)
// ---------------------------------------------------------------------------
describe("site time series (groupBy=year)", () => {
  // MACPYRAD (giant kelp) at HOPKINS_UC, every survey year. DuckDB: 26 years.
  it("single-species yearly series at one site", async () => {
    const r = await run(
      "groupBy=year&op=sum,mean,min,max,count&column=count" +
        "&q.classcode=MACPYRAD&q.site=HOPKINS_UC"
    );
    expect(r.groups).toHaveLength(26);
    const y = byKey(r, "year");

    expect(y[1999]).toMatchObject({ sum: 74, min: 1, max: 2, count: 63 });
    expect(y[1999].mean).toBeCloseTo(1.1746031746031746, MEAN_PRECISION);

    // 2004: every observation is 1.
    expect(y[2004]).toMatchObject({ sum: 27, min: 1, max: 1, mean: 1, count: 27 });

    expect(y[2024]).toMatchObject({ sum: 84, min: 1, max: 11, count: 32 });
    expect(y[2024].mean).toBeCloseTo(2.625, MEAN_PRECISION);
  });

  // Multi-species series (in-list): purple urchin adults + recruits at
  // HOPKINS_UC, 2018-2020..2022. Both classcodes fold into each year's totals.
  it("multi-species yearly series at one site", async () => {
    const r = await run(
      "groupBy=year&op=sum,mean,min,max,count&column=count" +
        "&q.classcode=in.(STRPURAD,STRPURREC)&q.site=HOPKINS_UC" +
        "&q.year=gte.2018&q.year=lte.2022"
    );
    expect(r.groups).toHaveLength(5);
    const y = byKey(r, "year");

    expect(y[2018]).toMatchObject({ sum: 2642, min: 1, max: 471, count: 33 });
    expect(y[2018].mean).toBeCloseTo(80.06060606060606, MEAN_PRECISION);

    // 2020 urchin bloom: STRPURAD 6260 + STRPURREC 819 = 7079.
    expect(y[2020]).toMatchObject({ sum: 7079, min: 1, max: 733, count: 52 });
    expect(y[2020].mean).toBeCloseTo(136.1346153846154, MEAN_PRECISION);

    expect(y[2022]).toMatchObject({ sum: 5150, min: 3, max: 617, count: 39 });
    expect(y[2022].mean).toBeCloseTo(132.05128205128204, MEAN_PRECISION);
  });

  // Time series constrained to a temporal window via ANDed range filters.
  it("yearly series within an inclusive temporal range", async () => {
    const r = await run(
      "groupBy=year&op=sum,mean,count&column=count" +
        "&q.classcode=KELKEL&q.year=gte.2010&q.year=lte.2015"
    );
    expect(r.groups).toHaveLength(6);
    const y = byKey(r, "year");
    expect(y[2010]).toMatchObject({ sum: 1709, count: 248 });
    expect(y[2010].mean).toBeCloseTo(6.891129032258065, MEAN_PRECISION);
    expect(y[2011]).toMatchObject({ sum: 1595, count: 290, mean: 5.5 });
    expect(y[2015]).toMatchObject({ sum: 889, count: 172 });
    expect(y[2015].mean).toBeCloseTo(5.1686046511627906, MEAN_PRECISION);
  });
});

// ---------------------------------------------------------------------------
// Filter operators
// ---------------------------------------------------------------------------
describe("filter operators", () => {
  // in-list on the grouped column itself, aggregating per classcode.
  it("in-list species, aggregated per classcode", async () => {
    const r = await run(
      "groupBy=classcode&op=sum,mean,count&column=count" +
        "&q.classcode=in.(PYCHEL,PISGIG,PISBRE)"
    );
    const c = byKey(r, "classcode");
    expect(c["PISBRE"]).toMatchObject({ sum: 13504, count: 2328 });
    expect(c["PISBRE"].mean).toBeCloseTo(5.8006872852233675, MEAN_PRECISION);
    expect(c["PISGIG"]).toMatchObject({ sum: 73413, count: 10623 });
    expect(c["PISGIG"].mean).toBeCloseTo(6.910759672408924, MEAN_PRECISION);
    expect(c["PYCHEL"]).toMatchObject({ sum: 9664, count: 3674 });
    expect(c["PYCHEL"].mean).toBeCloseTo(2.6303756124115405, MEAN_PRECISION);
  });

  // neq excludes both the value and nulls; campus has no nulls here.
  it("neq filter", async () => {
    const r = await run(
      "op=sum,count&column=count&q.classcode=HALRUF&q.campus=neq.UCSC"
    );
    expect(r.groups).toEqual([{ sum: 5284, count: 1317 }]);
    expect(r.rowsMatched).toBe(1317);
  });

  // Exclusive gt/lt bounds: year>2010 & year<2013 selects 2011-2012 only.
  it("exclusive numeric bounds (gt/lt)", async () => {
    const r = await run(
      "op=sum,mean,count&column=count&q.classcode=CRAGIG&q.year=gt.2010&q.year=lt.2013"
    );
    const g = r.groups![0] as any;
    expect(g.sum).toBe(1294);
    expect(g.count).toBe(496);
    expect(g.mean).toBeCloseTo(2.6088709677419355, MEAN_PRECISION);
    expect(r.rowsMatched).toBe(496);
  });

  // Inclusive range rollup (no groupBy) over a temporal window.
  it("inclusive range rollup (gte/lte)", async () => {
    const r = await run(
      "op=sum,mean,min,max,count&column=count" +
        "&q.classcode=KELKEL&q.year=gte.2010&q.year=lte.2015"
    );
    const g = r.groups![0] as any;
    expect(g).toMatchObject({ sum: 7357, min: 1, max: 113, count: 1299 });
    expect(g.mean).toBeCloseTo(5.663587374903772, MEAN_PRECISION);
    expect(r.rowsMatched).toBe(1299);
  });

  // Filter on a floating-point column (depth). Null depths are excluded by
  // the comparison, so rowsMatched already reflects non-null depths.
  it("filters on a double column (depth)", async () => {
    const r = await run(
      "op=sum,mean,count&column=count&q.classcode=PANINT&q.depth=gte.10"
    );
    const g = r.groups![0] as any;
    expect(g.sum).toBe(2688);
    expect(g.count).toBe(1211);
    expect(g.mean).toBeCloseTo(2.2196531791907512, MEAN_PRECISION);
    expect(r.rowsMatched).toBe(1211);
  });
});

// ---------------------------------------------------------------------------
// Median
// ---------------------------------------------------------------------------
describe("median", () => {
  // Even value count -> average of the two middle values. SARMUT n=80 -> 4.5.
  it("interpolates the median for even value counts", async () => {
    const r = await run(
      "op=median,count,sum,mean,min,max&column=count&q.classcode=SARMUT"
    );
    expect(r.groups![0]).toMatchObject({
      median: 4.5,
      count: 80,
      sum: 3466,
      min: 1,
      max: 643,
    });
    expect((r.groups![0] as any).mean).toBeCloseTo(43.325, MEAN_PRECISION);
  });

  // ACTBRA n=16 -> median 22.5.
  it("median for a small even-count group", async () => {
    const r = await run(
      "op=median,count,sum,max&column=count&q.classcode=ACTBRA"
    );
    expect(r.groups![0]).toMatchObject({
      median: 22.5,
      count: 16,
      sum: 686,
      max: 150,
    });
  });

  // Odd value count -> the middle value. PTETES = [1,1,1] -> 1.
  it("median for an odd-count group", async () => {
    const r = await run("op=median,count&column=count&q.classcode=PTETES");
    expect(r.groups![0]).toEqual({ median: 1, count: 3 });
  });

  // Median must ignore null values just like the other aggregates.
  // STRPURAD has 10 nulls; DuckDB median over the 21004 non-null values = 41.
  it("median ignores null values", async () => {
    const r = await run("op=median,count&column=count&q.classcode=STRPURAD");
    expect(r.groups![0]).toEqual({ median: 41, count: 21004 });
  });
});

// ---------------------------------------------------------------------------
// Multi-key grouping and empty results
// ---------------------------------------------------------------------------
describe("multi-key grouping and empty results", () => {
  // Group by two dimensions at once. DuckDB: 14 distinct campus/zone pairs;
  // top 6 by row count verified below.
  it("groups by two columns and orders by count", async () => {
    const r = await run(
      "groupBy=campus,zone&op=count&orderBy=count:desc&limit=6"
    );
    expect(
      r.groups!.map((g: any) => [g.campus, g.zone, g.count])
    ).toEqual([
      ["UCSC", "MID", 55133],
      ["UCSB", "INNER", 52143],
      ["UCSC", "OUTER", 51828],
      ["UCSB", "OUTER", 51353],
      ["UCSC", "INNER", 42793],
      ["UCSB", "MID", 30255],
    ]);
  });

  it("counts all distinct campus/zone pairs", async () => {
    const r = await run("groupBy=campus,zone&op=count");
    expect(r.groups).toHaveLength(14);
  });

  // A species that does not exist matches nothing: no groups, even for a
  // grouped thematic-map query.
  it("returns no groups for a non-existent species (groupBy=site)", async () => {
    const r = await run(
      "groupBy=site&op=sum,mean,count&column=count&q.classcode=NOTREAL"
    );
    expect(r.groups).toEqual([]);
    expect(r.rowsMatched).toBe(0);
  });

  // Same, without groupBy: a global aggregate over zero matches produces no
  // group at all (rather than a row of nulls).
  it("returns no groups for a global aggregate with zero matches", async () => {
    const r = await run("op=sum,mean,count&column=count&q.classcode=NOTREAL");
    expect(r.groups).toEqual([]);
    expect(r.rowsMatched).toBe(0);
  });

  // Impossible temporal window.
  it("returns no groups when a range filter excludes everything", async () => {
    const r = await run(
      "groupBy=year&op=sum,count&column=count&q.classcode=KELKEL&q.year=gt.3000"
    );
    expect(r.groups).toEqual([]);
    expect(r.rowsMatched).toBe(0);
  });
});
