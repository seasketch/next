import { describe, expect, it } from "vitest";
import {
  parseNodataPreviewConfig,
} from "../../src/dataTables/nodataPreview";

describe("parseNodataPreviewConfig", () => {
  it("accepts a valid DataTableNodataConfig", () => {
    const config = parseNodataPreviewConfig(
      JSON.stringify({ values: [-88, "NA"] })
    );
    expect(config.values).toEqual([-88, "NA"]);
  });

  it("rejects missing or malformed config", () => {
    expect(() => parseNodataPreviewConfig(null)).toThrow();
    expect(() => parseNodataPreviewConfig("{")).toThrow();
    expect(() =>
      parseNodataPreviewConfig(JSON.stringify({ values: [null] }))
    ).toThrow();
  });
});
