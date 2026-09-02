import { beforeAll, describe, expect, it } from "vitest";
import {
  AsyncBuffer,
  FileMetaData,
  asyncBufferFromFile,
  parquetMetadataAsync,
} from "hyparquet";
import { parseQueryParams } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery, rowMatchesWhen } from "../../src/dataTables/engine/execute";
import {
  parseTemporalPreviewConfig,
  previewTemporalMapping,
} from "../../src/dataTables/temporalPreview";

const FIXTURE = "test/dataTables/fixtures/data.parquet";

let file: AsyncBuffer;
let metadata: FileMetaData;

beforeAll(async () => {
  file = await asyncBufferFromFile(FIXTURE);
  metadata = await parquetMetadataAsync(file);
});

describe("parseTemporalPreviewConfig", () => {
  it("accepts a valid DataTableTemporalConfig", () => {
    const config = parseTemporalPreviewConfig(
      JSON.stringify({
        sourceColumns: { kind: "instant", column: "year", format: "year" },
        defaultViewResolution: "year",
      })
    );
    expect(config.sourceColumns).toEqual({
      kind: "instant",
      column: "year",
      format: "year",
    });
  });

  it("rejects missing or malformed config", () => {
    expect(() => parseTemporalPreviewConfig(null)).toThrow();
    expect(() => parseTemporalPreviewConfig("{")).toThrow();
    expect(() =>
      parseTemporalPreviewConfig(JSON.stringify({ sourceColumns: { instant: "year" } }))
    ).toThrow();
  });
});

describe("previewTemporalMapping", () => {
  it("parses PISCO year columns and reports coverage", async () => {
    const result = await previewTemporalMapping({
      file,
      metadata,
      config: {
        sourceColumns: { kind: "instant", column: "year", format: "year" },
        defaultViewResolution: "year",
      },
    });
    expect(result.totalRows).toBe(353253);
    expect(result.parseableCount).toBeGreaterThan(0);
    expect(result.unparseableCount).toBeLessThan(result.totalRows);
    expect(result.coverage?.start).toMatch(/^\d{4}$/);
    expect(result.availability?.type).toBe("histogram");
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.samples[0].parsed?.precision).toBe("year");
  });

  it("parses a year component mapping", async () => {
    const result = await previewTemporalMapping({
      file,
      metadata,
      config: {
        sourceColumns: { kind: "components", year: "year" },
        defaultViewResolution: "year",
      },
    });
    expect(result.parseableCount).toBeGreaterThan(0);
    expect(result.nativeResolution).toBe("year");
  });

  it("rejects unknown source columns", async () => {
    await expect(
      previewTemporalMapping({
        file,
        metadata,
        config: {
          sourceColumns: { kind: "instant", column: "not_a_column", format: "mdy" },
        },
      })
    ).rejects.toThrow(/Unknown column/);
  });
});

describe("when.* params", () => {
  it("are ignored when _when_* columns are absent", async () => {
    const query = parseQueryParams(
      new URLSearchParams("op=count&when.start=0&when.end=2000000000")
    );
    const plan = await planQuery(metadata, query, file);
    expect(plan.when).toBeNull();
    const result = await executeQuery({ file, metadata, query, plan });
    expect(result.groups).toEqual([{ count: 353253 }]);
  });
});

describe("rowMatchesWhen", () => {
  it("uses half-open interval intersection", () => {
    const year2018 = {
      startSec: Date.UTC(2018, 0, 1) / 1000,
      endSec: Date.UTC(2019, 0, 1) / 1000,
    };
    const clock2018 = {
      startSec: Date.UTC(2018, 0, 1) / 1000,
      endSec: Date.UTC(2019, 0, 1) / 1000,
    };
    const clock2019 = {
      startSec: Date.UTC(2019, 0, 1) / 1000,
      endSec: Date.UTC(2020, 0, 1) / 1000,
    };
    expect(rowMatchesWhen(year2018.startSec, year2018.endSec, clock2018)).toBe(
      true
    );
    expect(rowMatchesWhen(year2018.startSec, year2018.endSec, clock2019)).toBe(
      false
    );
    expect(rowMatchesWhen(null, year2018.endSec, clock2018)).toBe(false);
  });
});
