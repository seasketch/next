import { describe, expect, it } from "vitest";
import {
  isV2ObjectPath,
  isV2Path,
  isV2PreviewPath,
  parseV2Path,
} from "../src/auth/path";

const UUID = "CB5A5804-D8C7-4098-9F53-4DDCB6BF9FFE";
const LOWER_UUID = UUID.toLowerCase();

describe("v2 path parsing", () => {
  it.each([
    {
      kind: "TileJSON",
      path: `/v2/prod/projects/example/public/${UUID}.json`,
      legacyPath: `/projects/example/public/${UUID}.json`,
    },
    {
      kind: "tile",
      path: `/v2/prod/projects/example/public/${UUID}/4/5/6.mvt`,
      legacyPath: `/projects/example/public/${UUID}/4/5/6.mvt`,
    },
    {
      kind: "preview",
      path: `/v2/prod/projects/example/public/${UUID}`,
      legacyPath: `/projects/example/public/${UUID}`,
    },
    {
      kind: "pmtiles download",
      path: `/v2/prod/projects/example/public/${UUID}.pmtiles`,
      legacyPath: `/projects/example/public/${UUID}.pmtiles`,
    },
    {
      kind: "geojson download",
      path: `/v2/prod/projects/example/public/${UUID}.geojson`,
      legacyPath: `/projects/example/public/${UUID}.geojson`,
    },
    {
      kind: "geojson.json download",
      path: `/v2/prod/projects/example/public/${UUID}.geojson.json`,
      legacyPath: `/projects/example/public/${UUID}.geojson.json`,
    },
    {
      kind: "fgb download",
      path: `/v2/prod/projects/example/public/${UUID}.fgb`,
      legacyPath: `/projects/example/public/${UUID}.fgb`,
    },
    {
      kind: "nested metadata download",
      path: `/v2/prod/projects/example/public/${UUID}/metadata.xml`,
      legacyPath: `/projects/example/public/${UUID}/metadata.xml`,
    },
  ])("parses a $kind URL", ({ path, legacyPath }) => {
    expect(parseV2Path(path)).toEqual({
      ns: "prod",
      slug: "example",
      uuid: LOWER_UUID,
      legacyPath,
    });
  });

  it.each([
    "/projects/example/public/cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe.json",
    "/v2/prod/projects/example/cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe.json",
    "/v2/prod/projects/example/public/not-a-uuid.json",
    "/v2/-invalid/projects/example/public/cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe.json",
    "/v2/prod/projects/example/public/cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe/x/0/0.mvt",
  ])("rejects invalid path %s", (path) => {
    expect(parseV2Path(path)).toBeNull();
  });

  it("distinguishes v2 paths, object downloads, and preview pages", () => {
    const preview = `/v2/dev-user/projects/example/public/${UUID}/`;
    const object = `/v2/dev-user/projects/example/public/${UUID}.pmtiles`;
    const tilejson = `/v2/dev-user/projects/example/public/${UUID}.json`;
    expect(isV2Path(preview)).toBe(true);
    expect(isV2PreviewPath(preview)).toBe(true);
    expect(isV2ObjectPath(preview)).toBe(false);
    expect(isV2PreviewPath(`${preview}0/0/0.mvt`)).toBe(false);
    expect(isV2ObjectPath(object)).toBe(true);
    expect(isV2PreviewPath(object)).toBe(false);
    expect(isV2ObjectPath(tilejson)).toBe(false);
    expect(isV2Path("/anything-else")).toBe(false);
  });
});
