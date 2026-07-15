import type {
  AclClass,
  AuthDecision,
  MapAccessClaims,
  ProtectedAclEntry,
} from "./types";

/**
 * Decide whether a map-access token (if any) may read a classified tileset UUID.
 *
 * Public UUIDs always allow. Otherwise requires a valid token; project admins
 * and platform superusers bypass group checks. For group-class UUIDs, **every**
 * entry in `aclRules` must pass (AND across inherited TOC ancestors; OR within
 * each rule's group list).
 */
export function authorizeAccess(args: {
  /** Result of classifying the UUID against a ProjectAclDoc. */
  aclClass: AclClass;
  /** Protected rules resolved for this UUID (empty when public). */
  aclRules: ProtectedAclEntry[];
  /** Verified or trusted-decode claims; null when no token was presented. */
  claims: MapAccessClaims | null;
  /** Non-null when a token was present but verification/decode failed. */
  tokenError?: string | null;
  /**
   * Canonical project slug from the ACL document (or the slug used to look it
   * up). Token projectSlug must match unless the caller is a superuser.
   * Storage path slug may differ (renamed projects / copied data_source URLs).
   */
  aclProjectSlug?: string | null;
}): AuthDecision {
  const { aclClass, aclRules, claims, tokenError, aclProjectSlug } = args;
  const hadToken = claims != null;
  const role = claims?.role ?? null;
  const groups = claims?.groups ?? [];
  const base = {
    hadToken,
    role,
    groups,
    aclClass,
  };

  if (aclClass === "public") {
    return {
      ...base,
      allowed: true,
      status: 200,
      reason: "public",
      aclVersion: null,
    };
  }

  if (tokenError) {
    return {
      ...base,
      allowed: false,
      status: 401,
      reason: `invalid_token:${tokenError}`,
      aclVersion: null,
    };
  }

  if (!claims) {
    return {
      ...base,
      allowed: false,
      status: 401,
      reason: "missing_token",
      aclVersion: null,
    };
  }

  if (claims.isSuperuser) {
    return {
      ...base,
      allowed: true,
      status: 200,
      reason: "superuser",
      aclVersion: null,
    };
  }

  if (
    aclProjectSlug &&
    claims.projectSlug &&
    claims.projectSlug !== aclProjectSlug
  ) {
    return {
      ...base,
      allowed: false,
      status: 403,
      reason: "project_mismatch",
      aclVersion: null,
    };
  }

  if (claims.role === "admin") {
    return {
      ...base,
      allowed: true,
      status: 200,
      reason: "admin",
      aclVersion: null,
    };
  }

  if (aclClass === "admins_only") {
    return {
      ...base,
      allowed: false,
      status: 403,
      reason: "admins_only",
      aclVersion: null,
    };
  }

  // Every non-public ACL on the layer and its ancestors must pass. A group
  // ACL passes when the participant belongs to at least one of its groups.
  const passesEveryRule =
    aclRules.length > 0 &&
    aclRules.every(
      (rule) =>
        rule.t === "group" &&
        (rule.g ?? []).some((groupId) => claims.groups.includes(groupId))
    );
  if (passesEveryRule) {
    return {
      ...base,
      allowed: true,
      status: 200,
      reason: "group_member",
      aclVersion: null,
    };
  }

  return {
    ...base,
    allowed: false,
    status: 403,
    reason: "group_mismatch",
    aclVersion: null,
  };
}
