import { describe, expect, it } from "vitest";
import { isTilePresentationKey } from "../src/presentationRoutes";

describe("tile presentation keys", () => {
  it("routes published UUID TileJSON and preview", () => {
    expect(
      isTilePresentationKey(
        "projects/example/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.json",
      ),
    ).toBe(true);
    expect(
      isTilePresentationKey(
        "projects/example/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ),
    ).toBe(true);
  });

  it("routes ZXY for vector, image, and MRT tiles including root fixtures", () => {
    expect(isTilePresentationKey("crdss-cells-6/0/0/0.pbf")).toBe(true);
    expect(
      isTilePresentationKey(
        "projects/example/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/8/72/110.mvt",
      ),
    ).toBe(true);
    expect(isTilePresentationKey("dataLibrary/gmw-global/12/4072/2249.mrt")).toBe(
      true,
    );
  });

  it("routes dataLibrary archives without a .mrt filename", () => {
    expect(isTilePresentationKey("dataLibrary/gmw-global")).toBe(true);
    expect(isTilePresentationKey("dataLibrary/gmw-global.json")).toBe(true);
  });

  it("leaves raw object downloads on ObjectBackend", () => {
    expect(isTilePresentationKey("dataLibrary/gmw-global.pmtiles")).toBe(false);
    expect(isTilePresentationKey("router-fixture.fgb")).toBe(false);
    expect(isTilePresentationKey("crdss-cells-6.json")).toBe(false);
    expect(
      isTilePresentationKey(
        "projects/example/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.fgb",
      ),
    ).toBe(false);
  });
});
