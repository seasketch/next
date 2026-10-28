import { describe, expect, it } from "vitest";
import { resolveStorageUrl } from "../src/storageUrl";

describe("resolveStorageUrl", () => {
  it("keeps an absolute URL", () => {
    expect(
      resolveStorageUrl(
        "https://uploads.example.org/projects/ca/public/layer.fgb",
      ).href,
    ).toBe("https://uploads.example.org/projects/ca/public/layer.fgb");
  });

  it("treats a bare key as a legacy uploads object", () => {
    expect(resolveStorageUrl("projects/ca/public/layer.fgb").href).toBe(
      "https://uploads.seasketch.org/projects/ca/public/layer.fgb",
    );
  });

  it("treats nullish-looking non-urls as keys", () => {
    expect(resolveStorageUrl("/land-big-2.fgb").href).toBe(
      "https://uploads.seasketch.org/land-big-2.fgb",
    );
  });
});
