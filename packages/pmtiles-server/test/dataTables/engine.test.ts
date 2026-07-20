import { beforeAll, describe, expect, it } from "vitest";
import {
  AsyncBuffer,
  FileMetaData,
  asyncBufferFromFile,
  parquetMetadataAsync,
} from "hyparquet";
import { parseQueryParams, QueryError } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery } from "../../src/dataTables/engine/execute";

/**
 * Engine tests run directly in Node against a real data table produced by
 * the ingestion pipeline (PISCO kelp forest swath surveys, 353,253 rows,
 * 3 row groups). Expected values were computed independently with DuckDB /
 * a full scan of the file.
 */

// vitest runs with cwd at the package root
const FIXTURE = "test/dataTables/fixtures/data.parquet";

let file: AsyncBuffer;
let metadata: FileMetaData;

beforeAll(async () => {
  file = await asyncBufferFromFile(FIXTURE);
  metadata = await parquetMetadataAsync(file);
});

async function run(qs: string, useBloomFilters = true) {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(
    metadata,
    query,
    useBloomFilters ? file : undefined
  );
  const result = await executeQuery({ file, metadata, query, plan });
  return { query, plan, result };
}

describe("example query", () => {
  it("groupBy=site&op=mean,count&column=count&q.year=2018&q.classcode=PYCHEL", async () => {
    const { result } = await run(
      "groupBy=site&op=mean,count&column=count&q.year=2018&q.classcode=PYCHEL"
    );
    expect(result.groups).toHaveLength(3);
    const bySite = Object.fromEntries(
      result.groups!.map((g: any) => [g.site, g])
    );
    expect(Object.keys(bySite).sort()).toEqual([
      "LITTLE_IRISH_CEN",
      "PESCADERO_DC",
      "PINOS",
    ]);
    for (const g of result.groups!) {
      expect(g).toMatchObject({ mean: 1, count: 1 });
    }
    expect(result.rowsMatched).toBe(3);
  });
});

describe("aggregations", () => {
  it("computes global sum/min/max/median/mean without groupBy", async () => {
    const { result } = await run(
      "op=sum,min,max,median,mean,count&column=count&q.year=2018&q.classcode=PYCHEL"
    );
    expect(result.groups).toEqual([
      { sum: 3, min: 1, max: 1, median: 1, mean: 1, count: 3 },
    ]);
  });

  it("count without a column counts matching rows", async () => {
    const { result } = await run("op=count&q.campus=HSU");
    expect(result.groups).toEqual([{ count: 11515 }]);
  });

  it("orders groups by aggregate value and paginates", async () => {
    const { result } = await run(
      "groupBy=campus&op=count&orderBy=count:desc&limit=2"
    );
    expect(result.groups!.map((g: any) => g.campus)).toEqual(["UCSC", "UCSB"]);
    expect(result.groups![0].count).toBe(149754);
  });
});

describe("row group pruning", () => {
  // Fixture row group stats:
  //   rg0: 122,880 rows, year [1999,2020], campus [UCSC,UCSC], site_name_old all null
  //   rg1: 122,880 rows, year [1999,2024], campus [UCSB,UCSC]
  //   rg2: 107,493 rows, year [2004,2024], campus [HSU,VRG]
  it("prunes row groups via string equality statistics", async () => {
    const { plan, result } = await run("op=count&q.campus=HSU");
    expect(plan.rowGroupsTotal).toBe(3);
    expect(plan.rowGroupsScanned).toBe(1);
    expect(result.rowsScanned).toBe(107493);
    expect(result.rowsMatched).toBe(11515);
  });

  it("prunes row groups via numeric comparison statistics", async () => {
    const { plan } = await run("op=count&q.year=lte.2003");
    expect(plan.rowGroupsScanned).toBe(2); // rg2 min year is 2004
  });

  it("prunes all-null row groups for not.null filters", async () => {
    const { plan } = await run("op=count&q.site_name_old=not.null");
    expect(plan.rowGroupsScanned).toBe(2); // rg0 is 100% null
  });

  it("scans everything when statistics cannot exclude (blooms disabled)", async () => {
    const { plan } = await run("op=count&q.classcode=PYCHEL", false);
    expect(plan.rowGroupsScanned).toBe(3);
  });

  // 72 of the fixture's 182 species codes occur in only one row group;
  // min/max statistics can't prune them (codes span the alphabet in every
  // row group) but bloom filters prove absence.
  it("prunes row groups via bloom filters for eq on high-cardinality strings", async () => {
    // SOLSPP only occurs in rg0
    const { plan, result } = await run("op=count&q.classcode=SOLSPP");
    expect(plan.rowGroupsScanned).toBe(1);
    expect(result.rowsScanned).toBe(122880);
    expect(result.groups![0].count).toBeGreaterThan(0);
  });

  it("prunes row groups via bloom filters for in lists", async () => {
    // SOLSPP is rg0-only, MACPYRJUV is rg1-only; rg2 can be skipped
    const { plan } = await run(
      "op=count&q.classcode=in.(SOLSPP,MACPYRJUV)"
    );
    expect(plan.rowGroupsScanned).toBe(2);
  });

  it("merges contiguous surviving row groups into one read span", async () => {
    const { plan } = await run("op=count&q.year=lte.2003");
    expect(plan.spans).toEqual([{ rowStart: 0, rowEnd: 245760 }]);
  });
});

describe("filters", () => {
  it("equality against strings", async () => {
    const { result } = await run("op=count&q.observer=CHAD BURT");
    expect(result.groups).toEqual([{ count: 100 }]);
  });

  it("in lists", async () => {
    const { result } = await run(
      "op=count&q.observer=in.(CHAD BURT,LYALL BELLQUIST)"
    );
    expect(result.groups).toEqual([{ count: 650 }]); // 100 + 550
  });

  it("numeric comparisons", async () => {
    const { result } = await run("q.count=gte.4000");
    expect(result.rowsMatched).toBe(134);
  });

  it("null tests", async () => {
    const { result } = await run("op=count&q.size=is.null");
    expect(result.groups).toEqual([{ count: 217323 }]);
  });

  it("ANDed range filters on the same column", async () => {
    const { result } = await run(
      "op=count&q.year=gte.2010&q.year=lte.2012"
    );
    expect(result.groups).toEqual([{ count: 57005 }]);
  });

  it("only reads the columns a query needs", async () => {
    const { plan } = await run(
      "groupBy=site&op=mean&column=count&q.year=2018"
    );
    expect(plan.neededColumns!.sort()).toEqual(["count", "site", "year"]);
  });
});

describe("decoded column cache", () => {
  it("returns identical results when served from the cache", async () => {
    const query = parseQueryParams(
      new URLSearchParams(
        "groupBy=site&op=count,mean&column=count&q.classcode=PISBRE&q.year=2017"
      )
    );
    const plan = await planQuery(metadata, query, file);
    const cold = await executeQuery({
      file,
      metadata,
      query,
      plan,
      cacheKey: "test-etag",
    });
    const warm = await executeQuery({
      file,
      metadata,
      query,
      plan,
      cacheKey: "test-etag",
    });
    expect(warm).toEqual(cold);
    expect(warm.rowsMatched).toBe(62);
  });
});

describe("raw row output", () => {
  it("returns filtered rows with limit/offset/orderBy", async () => {
    const { result } = await run(
      "q.count=gte.4000&orderBy=count:desc&limit=3"
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows![0].count).toBe(13450); // max count in the table
    const counts = result.rows!.map((r: any) => r.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("serializes values as JSON-safe types (no BigInt)", async () => {
    const { result } = await run("limit=1");
    const row = result.rows![0];
    expect(typeof row.year).toBe("number");
    expect(typeof row.site).toBe("string");
    expect(() => JSON.stringify(row)).not.toThrow();
  });
});

describe("validation", () => {
  it("rejects unknown columns, listing valid ones", async () => {
    await expect(run("q.bogus=1")).rejects.toThrow(QueryError);
    try {
      await run("q.bogus=1");
    } catch (e: any) {
      expect(e.details.validColumns.map((c: any) => c.name)).toContain("site");
    }
  });

  it("rejects comparison operators on string columns", async () => {
    await expect(run("q.site=gte.A")).rejects.toThrow(
      /only supported for numeric/
    );
  });

  it("rejects non-numeric values for numeric columns", async () => {
    await expect(run("q.year=abc")).rejects.toThrow(/Invalid numeric value/);
  });

  it("rejects numeric aggregations of string columns", async () => {
    await expect(
      run("groupBy=site&op=mean&column=observer")
    ).rejects.toThrow(/require a numeric column/);
  });

  it("rejects orderBy keys missing from the output", async () => {
    await expect(
      run("groupBy=site&op=count&orderBy=depth")
    ).rejects.toThrow(/orderBy/);
  });
});
