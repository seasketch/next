import { DataTablesColumnStats } from "@seasketch/geostats-types";
import {
  addNodataValue,
  parseNodataToken,
  previewFromColumnStats,
  previewResponseError,
  suggestNodataValues,
} from "./dataTableNodataForm";

describe("parseNodataToken", () => {
  test("parses numbers and keeps strings", () => {
    expect(parseNodataToken("  -88 ")).toBe(-88);
    expect(parseNodataToken("NA")).toBe("NA");
    expect(parseNodataToken("")).toBeNull();
    expect(parseNodataToken("  ")).toBeNull();
  });
});

describe("addNodataValue", () => {
  test("dedupes numeric equivalents", () => {
    expect(addNodataValue([-88], "-88")).toEqual([-88]);
    expect(addNodataValue([], "NA")).toEqual(["NA"]);
  });
});

describe("suggestNodataValues", () => {
  test("suggests common sentinels that appear in column stats", () => {
    const suggestions = suggestNodataValues(
      {
        table: "wq",
        rowCount: 3,
        columns: [
          {
            attribute: "airtemp",
            count: 3,
            type: "number",
            values: { "-88": 2, "16.4": 1 },
          },
          {
            attribute: "do_percent",
            count: 3,
            type: "number",
            values: { "-88": 1, "93": 2 },
          },
        ],
        join: {
          column: "siteid",
          overlayAttribute: "siteid",
          matchRate: 1,
          matchedRows: 3,
          unmatchedRows: 0,
          unmatchedOverlayValues: 0,
        },
      } as DataTablesColumnStats,
      []
    );
    expect(suggestions).toContain(-88);
  });
});

describe("previewFromColumnStats", () => {
  test("counts sentinel hits from column histograms", () => {
    const preview = previewFromColumnStats(
      {
        table: "wq",
        rowCount: 3,
        columns: [
          {
            attribute: "airtemp",
            count: 3,
            type: "number",
            values: { "-88": 2, "16.4": 1 },
          },
        ],
        join: {
          column: "siteid",
          overlayAttribute: "siteid",
          matchRate: 1,
          matchedRows: 3,
          unmatchedRows: 0,
          unmatchedOverlayValues: 0,
        },
      } as DataTablesColumnStats,
      [-88],
      "siteid"
    );
    expect(preview?.columns[0].matchCount).toBe(2);
    expect(preview?.totalRows).toBe(3);
  });
});

describe("previewResponseError", () => {
  test("uses JSON error bodies and truncates HTML", async () => {
    const json = await previewResponseError(
      new Response(JSON.stringify({ error: "No data table found." }), {
        status: 404,
      })
    );
    expect(json.message).toBe("No data table found.");

    const html = await previewResponseError(
      new Response("<html><body>Not Found</body></html>", { status: 404 })
    );
    expect(html.message).toBe("Preview request failed (404)");
  });
});
