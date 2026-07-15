import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  classifyUuid,
  lookupAclForAuth,
  normalizeProjectAclDoc,
  sortedIncludes,
} from "../src/auth/acl";
import type { ProjectAclDoc } from "../src/auth/types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("ACL document handling", () => {
  it("normalizes and sorts untrusted JSON", () => {
    expect(
      normalizeProjectAclDoc(
        {
          v: "bad",
          slug: "",
          public: [C, 123, A, B],
          rules: "bad",
          protected: [],
        },
        "fallback",
      ),
    ).toEqual({
      v: 0,
      slug: "fallback",
      public: [A, B, C],
      rules: [],
      protected: {},
    });
  });

  it.each([
    { values: [] as string[], target: A, expected: false },
    { values: [A], target: A, expected: true },
    { values: [A], target: B, expected: false },
    { values: [A, B, C], target: A, expected: true },
    { values: [A, B, C], target: B, expected: true },
    { values: [A, B, C], target: C, expected: true },
    { values: [A, B, C], target: "00000000", expected: false },
    { values: [A, B, C], target: "ffffffff", expected: false },
  ])("binary-searches sorted public UUIDs", ({ values, target, expected }) => {
    expect(sortedIncludes(values, target)).toBe(expected);
  });

  it("classifies public, group, admins-only, and unlisted UUIDs", () => {
    const doc: ProjectAclDoc = {
      v: 1,
      slug: "example",
      public: [A],
      rules: [{ t: "group", g: [4, 9] }, { t: "admins_only" }],
      protected: {
        [B]: [0],
        [C]: [1],
      },
    };

    expect(classifyUuid(doc, A)).toEqual({ class: "public", rules: [] });
    expect(classifyUuid(doc, B)).toEqual({
      class: "group",
      rules: [{ t: "group", g: [4, 9] }],
    });
    expect(classifyUuid(doc, C)).toEqual({
      class: "admins_only",
      rules: [{ t: "admins_only" }],
    });
    expect(classifyUuid(doc, "not-listed")).toEqual({
      class: "admins_only",
      rules: [{ t: "admins_only" }],
    });
    expect(classifyUuid(null, A)).toEqual({
      class: "admins_only",
      rules: [{ t: "admins_only" }],
    });
  });

  it("resolves all inherited rule references and denies malformed references safely", () => {
    const normalized = normalizeProjectAclDoc(
      {
        v: 1,
        slug: "example",
        public: [],
        rules: [
          { t: "group", g: [9, 4, 9] },
          { t: "group", g: [12] },
        ],
        protected: {
          [A]: [0, 1, 1],
          [B]: [99],
          [C]: [],
        },
      },
      "fallback",
    );

    expect(normalized.rules).toEqual([
      { t: "group", g: [4, 9] },
      { t: "group", g: [12] },
    ]);
    expect(classifyUuid(normalized, A)).toEqual({
      class: "group",
      rules: [
        { t: "group", g: [4, 9] },
        { t: "group", g: [12] },
      ],
    });
    expect(classifyUuid(normalized, B).class).toBe("admins_only");
    expect(classifyUuid(normalized, C).class).toBe("admins_only");
  });

  it("revalidates a cached deny before returning it", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "revalidation";
    const key = `acl/${ns}/projects/${slug}.json`;
    const protectedDoc: ProjectAclDoc = {
      v: 1,
      slug,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [A]: [0] },
    };

    // This binding is Miniflare's isolated local R2 simulation. Tests never
    // read from or write to the remote ssn-tiles bucket.
    await env.TILES_BUCKET.put(key, JSON.stringify(protectedDoc));
    expect(await lookupAclForAuth(env.TILES_BUCKET, ns, slug, A)).toMatchObject(
      { class: "admins_only" },
    );

    await env.TILES_BUCKET.put(
      key,
      JSON.stringify({ ...protectedDoc, v: 2, public: [A], protected: {} }),
    );

    expect(await lookupAclForAuth(env.TILES_BUCKET, ns, slug, A)).toMatchObject(
      { class: "public", doc: { v: 2 } },
    );
  });
});
