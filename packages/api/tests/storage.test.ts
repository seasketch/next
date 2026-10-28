import { ownsRemote, remoteBucket } from "../src/storage/client";
import { replaceUrlFileName } from "../src/storage/urls";

describe("ownsRemote", () => {
  const previousTiles = process.env.R2_TILES_BUCKET;
  const previousStaging = process.env.SPATIAL_UPLOADS_BUCKET;

  beforeEach(() => {
    process.env.R2_TILES_BUCKET = "ssn-tiles-local";
    process.env.SPATIAL_UPLOADS_BUCKET = "ssn-spatial-uploads-tmp-local";
  });

  afterEach(() => {
    process.env.R2_TILES_BUCKET = previousTiles;
    process.env.SPATIAL_UPLOADS_BUCKET = previousStaging;
  });

  it("rejects empty and non-remote values", () => {
    expect(remoteBucket("")).toBeNull();
    expect(ownsRemote("")).toBe(false);
    expect(ownsRemote("https://uploads.seasketch.org/layer.fgb")).toBe(false);
  });

  it("accepts only buckets named in the environment", () => {
    expect(ownsRemote("r2://ssn-tiles-local/projects/ca/layer.fgb")).toBe(true);
    expect(
      ownsRemote("r2://ssn-spatial-uploads-tmp-local/job/file.zip"),
    ).toBe(true);
    expect(ownsRemote("r2://ssn-tiles/projects/ca/layer.fgb")).toBe(false);
    expect(ownsRemote("s3://some-other-bucket/file.zip")).toBe(false);
  });
});

describe("storage urls", () => {
  it("replaces the trailing path segment without changing origin", () => {
    expect(
      replaceUrlFileName(
        "https://uploads.example.org/projects/ca/dataTables/u1/data.parquet",
        "query",
      ),
    ).toBe("https://uploads.example.org/projects/ca/dataTables/u1/query");
  });
});
