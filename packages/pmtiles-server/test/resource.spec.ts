import { describe, expect, it } from "vitest";
import {
  classifyResource,
  legacyProjectAuthEnabled,
  normalizeObjectKey,
} from "../src/resource";

describe("overlay resource classification", () => {
  it("classifies fixtures, data-library, published, and subdivided keys", () => {
    expect(classifyResource("/eez-land-joined.fgb")?.kind).toBe("public");
    expect(
      classifyResource(
        "/projects/superuser/public/11111111-1111-1111-1111-111111111111.fgb",
      )?.kind,
    ).toBe("data_library");
    expect(
      classifyResource(
        "/projects/example/public/11111111-1111-1111-1111-111111111111.fgb",
      ),
    ).toMatchObject({ kind: "published", slug: "example" });
    expect(
      classifyResource("/projects/example/subdivided/42-output.fgb"),
    ).toMatchObject({ kind: "subdivided", slug: "example" });
  });

  it("rejects directory and traversal-like keys", () => {
    expect(normalizeObjectKey("/projects/example/")).toBeNull();
    expect(normalizeObjectKey("/projects/../secret")).toBeNull();
    expect(normalizeObjectKey("/projects%2F..%2Fsecret")).toBeNull();
  });

  it("defaults legacy project authentication off", () => {
    expect(legacyProjectAuthEnabled({} as Env)).toBe(false);
    expect(
      legacyProjectAuthEnabled({
        AUTH_LEGACY_PROJECT_PATHS: "true",
      } as Env),
    ).toBe(true);
  });
});
