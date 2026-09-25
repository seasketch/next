import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import { AsyncBuffer, FileMetaData, parquetMetadataAsync } from "hyparquet";
import {
  buildCoverageIndex,
  isDataTableCoverage,
  validateDataTableCoverage,
} from "@seasketch/geostats-types";
import { parseQueryParams, QueryError } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery, resetEngineCaches } from "../../src/dataTables/engine/execute";

function asyncBufferFromFile(path: string): AsyncBuffer {
  const data = fs.readFileSync(path);
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  );
  return {
    byteLength: buffer.byteLength,
    slice: (start: number, end?: number) => buffer.slice(start, end),
  };
}

const SPARSE = "test/dataTables/fixtures/sparse-synthetic.parquet";
const MONTHLY = "test/dataTables/fixtures/monthly-quadrat.parquet";

let fish: AsyncBuffer;
let fishMeta: FileMetaData;
let monthly: AsyncBuffer;
let monthlyMeta: FileMetaData;

beforeAll(async () => {
  fish = asyncBufferFromFile(SPARSE);
  fishMeta = await parquetMetadataAsync(fish);
  monthly = asyncBufferFromFile(MONTHLY);
  monthlyMeta = await parquetMetadataAsync(monthly);
});

async function run(qs: string, coverage?: ReturnType<typeof buildCoverageIndex>, cacheKey?: string) {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(fishMeta, query, fish);
  return executeQuery({ file: fish, metadata: fishMeta, query, plan, coverage, cacheKey });
}

const base =
  "op=mean,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum&subjectColumn=classcode&detailColumns=sex&q.site=GULL";

describe("replicate roster cache", () => {
  it("reuses the registered replicates across a species sweep", async () => {
    resetEngineCaches();
    const first = await run(`${base}&v.classcode=SPUL&v.sex=MALE`, undefined, "fish@1");
    expect(first.rowsScanned).toBeGreaterThan(0);
    const second = await run(`${base}&v.classcode=SPUL&v.sex=FEMALE`, undefined, "fish@1");
    const gullFirst = first.groups!.find((row) => row.site === "GULL")!;
    const gullSecond = second.groups!.find((row) => row.site === "GULL")!;
    expect(gullSecond.replicatesSurveyed).toBe(gullFirst.replicatesSurveyed);
    expect(gullSecond.count).toBe(2);
    expect(gullSecond.mean).toBeCloseTo((2 + 4) / 2, 6);
    const uncached = await run(`${base}&v.classcode=SPUL&v.sex=FEMALE`);
    expect(uncached.groups).toEqual(second.groups);
  });
});

describe("sparse replicates", () => {
  it("rejects v.* on a simple aggregate", () => {
    expect(() =>
      parseQueryParams(new URLSearchParams("op=mean&column=count&v.sex=MALE"))
    ).toThrow(QueryError);
  });

  it("rejects filtering a nothing-seen value", () => {
    expect(() =>
      parseQueryParams(
        new URLSearchParams(
          "op=mean&column=count&replicateBy=zone&within=sum&subjectColumn=classcode&effortMarkers=NO_ORG&v.classcode=NO_ORG"
        )
      )
    ).toThrow(/nothing-seen/);
  });

  it("keeps a female-only transect as zero when sex is a detail filter", async () => {
    const result = await run(
      `${base}&v.classcode=SPUL&v.sex=MALE&effortMarkers=NO_ORG`
    );
    const group = result.groups!.find((row) => row.site === "GULL");
    expect(group).toBeTruthy();
    expect(group!.count).toBe(2);
    expect(group!.replicatesZero).toBe(1);
    expect(group!.mean).toBeCloseTo(1.5, 6);
  });

  it("marks effort rows and non-contributing rows on the raw response", async () => {
    const result = await run(
      "subjectColumn=classcode&detailColumns=sex&effortMarkers=NO_ORG&v.classcode=SPUL&v.sex=MALE&q.site=GULL"
    );
    const rows = result.rows || [];
    const effort = rows.find((row) => row.classcode === "NO_ORG");
    const female = rows.find(
      (row) => row.classcode === "SPUL" && row.sex === "FEMALE" && row.transect === "1"
    );
    const male = rows.find((row) => row.sex === "MALE" && row.site === "GULL");
    expect(effort?._excludedBy).toBe("effort");
    expect(effort?._contributes).toBe(false);
    expect(female?._excludedBy).toBe("detail");
    expect(male?._contributes).toBe(true);
    expect(male?._excludedBy).toBeNull();
  });

  it("leaves a replicate out of a mean of nothing", async () => {
    const result = await run(
      "op=mean,count&column=count&groupBy=site&replicateBy=zone,transect&within=mean&subjectColumn=classcode&detailColumns=sex&q.site=GULL&v.classcode=SPUL&v.sex=MALE"
    );
    const group = result.groups!.find((row) => row.site === "GULL");
    expect(group!.replicatesNoValue).toBe(1);
    expect(group!.count).toBe(1);
  });

  it("explain=1 lists counted and zero replicates for one feature", async () => {
    const result = await run(
      `${base}&v.classcode=SPUL&v.sex=MALE&joinColumn=site&explain=1`
    );
    expect(result.replicates).toHaveLength(2);
    const zero = result.replicates!.find((row) => row.status === "zero");
    const counted = result.replicates!.find((row) => row.status === "counted");
    expect(zero).toMatchObject({ value: 0, contributingRows: 0, rowCount: 2 });
    expect(counted).toMatchObject({ value: 3, contributingRows: 1, rowCount: 2 });
  });

  it("rejects explain without a single join equality", () => {
    expect(() =>
      parseQueryParams(
        new URLSearchParams(
          "op=mean&column=count&replicateBy=zone&within=sum&explain=1&joinColumn=site"
        )
      )
    ).toThrow(/join-column/);
  });

  it("leaves an HSU 2014 subject out when coverage starts in 2016", async () => {
    const coverage = buildCoverageIndex(
      [
        {
          scope: { campus: "HSU" },
          subject: { classcode: "SPUL" },
          start: "2016-01-01",
          end: null,
        },
      ],
      "classcode"
    );
    const result = await run(
      "op=mean,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum&subjectColumn=classcode&coverageMode=coverage_file&q.site=HSU&v.classcode=SPUL&when.start=" +
        Math.floor(Date.UTC(2014, 0, 1) / 1000) +
        "&when.end=" +
        Math.floor(Date.UTC(2015, 0, 1) / 1000),
      coverage
    );
    const group = result.groups!.find((row) => row.site === "HSU");
    expect(group!.replicatesNotSurveyed).toBe(1);
    expect(group!.count).toBe(0);
    expect(group!.mean).toBeNull();
  });
});

describe("coverage file guard", () => {
  it("rejects null, undefined, and non-arrays", () => {
    expect(isDataTableCoverage(null)).toBe(false);
    expect(isDataTableCoverage(undefined)).toBe(false);
    expect(isDataTableCoverage({})).toBe(false);
    expect(
      isDataTableCoverage([
        {
          scope: { campus: "UCSB" },
          subject: { classcode: "SPUL" },
          start: "1999-01-01",
          end: null,
        },
      ])
    ).toBe(true);
  });

  it("reports overlapping periods by record index", () => {
    const result = validateDataTableCoverage(
      [
        {
          scope: { campus: "UCSB" },
          subject: { classcode: "SPUL" },
          start: "1999-01-01",
          end: "2005-01-01",
        },
        {
          scope: { campus: "UCSB" },
          subject: { classcode: "SPUL" },
          start: "2004-01-01",
          end: null,
        },
      ],
      { subjectColumn: "classcode", surveyColumns: ["campus"] }
    );
    expect(result.errors[0].index).toBe(1);
  });
});

describe("monthly replicates stay separate under a yearly step", () => {
  it("averages twelve visits when the slider shows a year", async () => {
    const query = parseQueryParams(
      new URLSearchParams(
        "op=mean,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum&q.site=Q&when.start=" +
          Math.floor(Date.UTC(2024, 0, 1) / 1000) +
          "&when.end=" +
          Math.floor(Date.UTC(2025, 0, 1) / 1000) +
          "&when.step=year"
      )
    );
    const plan = await planQuery(monthlyMeta, query, monthly);
    const result = await executeQuery({
      file: monthly,
      metadata: monthlyMeta,
      query,
      plan,
    });
    const group = result.groups![0];
    expect(group.count).toBe(12);
    expect(group.mean).toBeCloseTo((1 + 12) / 2, 6);
  });
});
