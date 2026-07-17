import { describe, expect, it } from "vitest";
import {
  aclEnabled,
  aclNamespaceFromRequest,
  classifyResource,
  missingAclIsPublic,
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

  it("defaults ACL enforcement off and missing ACL docs public", () => {
    expect(aclEnabled({} as Env)).toBe(false);
    expect(aclEnabled({ AUTH_ACL_ENABLED: "true" } as Env)).toBe(true);
    expect(missingAclIsPublic({} as Env)).toBe(true);
    expect(
      missingAclIsPublic({ AUTH_MISSING_ACL_PUBLIC: "false" } as Env),
    ).toBe(false);
  });

  it("reads ACL namespace from ?ns= with prod default", () => {
    expect(
      aclNamespaceFromRequest(
        new Request("https://tiles.example/projects/x/public/y.json?ns=dev-test"),
      ),
    ).toBe("dev-test");
    expect(
      aclNamespaceFromRequest(
        new Request("https://tiles.example/projects/x/public/y.json"),
      ),
    ).toBe("prod");
    expect(
      aclNamespaceFromRequest(
        new Request("https://tiles.example/x?ns=bad/ns"),
      ),
    ).toBe("prod");
  });
});
