import { describe, expect, it } from "vitest";
import { authorizeAccess } from "../src/auth/authorize";
import type {
  AclClass,
  MapAccessClaims,
  ProtectedAclEntry,
} from "../src/auth/types";

function claims(
  overrides: Partial<MapAccessClaims> = {}
): MapAccessClaims {
  return {
    type: "map-access",
    projectId: 1,
    projectSlug: "example",
    userId: 2,
    role: "user",
    groups: [],
    ...overrides,
  };
}

function authorize(options: {
  aclClass?: AclClass;
  aclRules?: ProtectedAclEntry[];
  claims?: MapAccessClaims | null;
  tokenError?: string | null;
  aclProjectSlug?: string;
}) {
  return authorizeAccess({
    aclClass: options.aclClass ?? "admins_only",
    aclRules: options.aclRules ?? [{ t: "admins_only" }],
    claims: options.claims ?? null,
    tokenError: options.tokenError,
    aclProjectSlug: options.aclProjectSlug ?? "example",
  });
}

describe("authorizeAccess", () => {
  it("allows public UUIDs without credentials", () => {
    expect(authorize({ aclClass: "public" })).toMatchObject({
      allowed: true,
      status: 200,
      reason: "public",
    });
  });

  it("does not let a bad token block a public UUID", () => {
    expect(
      authorize({ aclClass: "public", tokenError: "bad signature" })
    ).toMatchObject({ allowed: true, reason: "public" });
  });

  it("returns 401 for missing and invalid protected credentials", () => {
    expect(authorize({})).toMatchObject({
      allowed: false,
      status: 401,
      reason: "missing_token",
    });
    expect(authorize({ tokenError: "bad signature" })).toMatchObject({
      allowed: false,
      status: 401,
      reason: "invalid_token:bad signature",
    });
  });

  it("allows superusers and project admins", () => {
    expect(
      authorize({ claims: claims({ isSuperuser: true }) })
    ).toMatchObject({ allowed: true, reason: "superuser" });
    expect(authorize({ claims: claims({ role: "admin" }) })).toMatchObject({
      allowed: true,
      reason: "admin",
    });
  });

  it("checks project scope before granting admin access", () => {
    expect(
      authorize({
        claims: claims({ role: "admin", projectSlug: "other-project" }),
      })
    ).toMatchObject({
      allowed: false,
      status: 403,
      reason: "project_mismatch",
    });
  });

  it("allows group members only when group ids overlap", () => {
    expect(
      authorize({
        aclClass: "group",
        aclRules: [{ t: "group", g: [10, 20] }],
        claims: claims({ groups: [5, 20] }),
      })
    ).toMatchObject({ allowed: true, reason: "group_member" });

    expect(
      authorize({
        aclClass: "group",
        aclRules: [{ t: "group", g: [10, 20] }],
        claims: claims({ groups: [5, 6] }),
      })
    ).toMatchObject({
      allowed: false,
      status: 403,
      reason: "group_mismatch",
    });
  });

  it("requires every inherited group rule to pass", () => {
    const aclRules: ProtectedAclEntry[] = [
      { t: "group", g: [10, 20] },
      { t: "group", g: [30] },
    ];

    expect(
      authorize({
        aclClass: "group",
        aclRules,
        claims: claims({ groups: [20, 30] }),
      })
    ).toMatchObject({ allowed: true, reason: "group_member" });
    expect(
      authorize({
        aclClass: "group",
        aclRules,
        claims: claims({ groups: [20] }),
      })
    ).toMatchObject({
      allowed: false,
      status: 403,
      reason: "group_mismatch",
    });
  });

  it("denies ordinary users on admins-only UUIDs", () => {
    expect(authorize({ claims: claims() })).toMatchObject({
      allowed: false,
      status: 403,
      reason: "admins_only",
    });
  });
});
