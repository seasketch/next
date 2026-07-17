import { lookupAclForAuth } from "./acl";
import { authorizeAccess } from "./authorize";
import {
  extractTokenFromRequest,
  resolveSeaSketchAccessToken,
} from "./jwt";
import type {
  AuthDecision,
  MapAccessClaims,
  SeaSketchAccessClaims,
} from "./types";
import {
  missingAclIsPublic,
  type ResourceDescriptor,
} from "../resource";

export type ResourceAuthResult = {
  decision: AuthDecision;
  claims: SeaSketchAccessClaims | null;
  tokenMode: "jwks" | "dev-trust" | null;
  aclSlug: string | null;
};

const publicDecision = (reason: string): AuthDecision => ({
  allowed: true,
  status: 200,
  reason,
  aclClass: "public",
  hadToken: false,
  role: null,
  groups: [],
  aclVersion: null,
});

/**
 * Authorize a classified overlay resource.
 *
 * @param enforce - When false (`AUTH_ACL_ENABLED=false`), project data is
 *   treated as publicly readable capability-URLs.
 */
export async function authorizeResource(args: {
  request: Request;
  env: Env;
  ns: string;
  resource: ResourceDescriptor;
  enforce: boolean;
}): Promise<ResourceAuthResult> {
  const { request, env, ns, resource, enforce } = args;
  if (resource.kind === "public") {
    return { decision: publicDecision("fixture"), claims: null, tokenMode: null, aclSlug: null };
  }
  if (resource.kind === "data_library") {
    return { decision: publicDecision("data_library"), claims: null, tokenMode: null, aclSlug: "superuser" };
  }
  if (!enforce) {
    return { decision: publicDecision("acl_disabled"), claims: null, tokenMode: null, aclSlug: resource.slug };
  }

  const rawToken = extractTokenFromRequest(request);
  let claims: SeaSketchAccessClaims | null = null;
  let tokenMode: "jwks" | "dev-trust" | null = null;
  let tokenError: string | null = null;
  if (rawToken) {
    try {
      const resolved = await resolveSeaSketchAccessToken(rawToken, env.JWKS_URL, ns);
      claims = resolved.claims;
      tokenMode = resolved.mode;
    } catch (error) {
      tokenError = error instanceof Error ? error.message : "verify_failed";
    }
  }

  if (claims?.type === "overlay-engine") {
    return {
      decision: {
        allowed: true,
        status: 200,
        reason: "overlay_engine",
        aclClass: "admins_only",
        hadToken: true,
        role: "overlay-engine",
        groups: [],
        aclVersion: null,
      },
      claims,
      tokenMode,
      aclSlug: resource.slug,
    };
  }

  const mapClaims = claims?.type === "map-access"
    ? claims as MapAccessClaims
    : null;

  if (resource.kind === "subdivided" || resource.kind === "project_other") {
    const decision = authorizeAccess({
      aclClass: "admins_only",
      aclRules: [],
      claims: mapClaims,
      tokenError,
      aclProjectSlug: resource.slug,
    });
    return { decision, claims, tokenMode, aclSlug: resource.slug };
  }

  const aclSlug = mapClaims?.projectSlug || resource.slug;
  const acl = await lookupAclForAuth(
    env.TILES_BUCKET,
    ns,
    aclSlug,
    resource.uuid,
  );
  // Missing ACL docs: public when AUTH_MISSING_ACL_PUBLIC is not false.
  if (acl.missing && missingAclIsPublic(env)) {
    return {
      decision: publicDecision("missing_acl_public"),
      claims,
      tokenMode,
      aclSlug,
    };
  }
  if (acl.class === "public") tokenError = null;
  const decision = authorizeAccess({
    aclClass: acl.class,
    aclRules: acl.rules,
    claims: mapClaims,
    tokenError,
    aclProjectSlug: acl.doc?.slug || resource.slug,
  });
  decision.aclVersion = acl.doc?.v ?? null;
  return { decision, claims, tokenMode, aclSlug };
}
