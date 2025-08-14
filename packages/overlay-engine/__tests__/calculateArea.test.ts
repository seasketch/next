import { SourceCache } from "fgb-source";
import { eezUrl, landUrl, territorialSeaUrl } from "./constants";
import { calculateArea, ClippingLayerOption } from "../src/geographies";
import { vi } from "vitest";

const FijiEEZ = [
  {
    cql2Query: null,
    source: landUrl,
    op: "DIFFERENCE",
  },
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8325,
      ],
    },
    source: eezUrl,
    op: "INTERSECT",
  },
] as ClippingLayerOption[];

describe("EEZ Test Cases", () => {
  let sourceCache: SourceCache;

  beforeAll(() => {
    sourceCache = new SourceCache("128mb");
  });

  // set timeout to 5 minutes
  vi.setConfig({ testTimeout: 1000000 });

  it("should calculate the area of the Fiji EEZ", async () => {
    const area = await calculateArea(FijiEEZ, sourceCache);
    expect(area).toBeGreaterThan(0);
  });
});
