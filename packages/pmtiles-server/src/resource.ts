/**
 * Path/key classification and ACL env helpers for query-param auth.
 *
 * Canonical URLs use `/projects/...` paths. Callers pass `?ns=` (ACL namespace,
 * default `prod`) and `?access_token=` / Authorization for protected data.
 */
const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const PUBLISHED = new RegExp(
  `^projects/([^/]+)/public/(${UUID})(?:$|[./].*)`,
  "i",
);
const SUBDIVIDED = /^projects\/([^/]+)\/subdivided\/(.+)$/i;
const PROJECT = /^projects\/([^/]+)\/(.+)$/i;
const NS_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export type ResourceDescriptor =
  | { kind: "public"; key: string }
  | { kind: "data_library"; key: string; slug: "superuser" }
  | { kind: "published"; key: string; slug: string; uuid: string }
  | { kind: "subdivided"; key: string; slug: string }
  | { kind: "project_other"; key: string; slug: string };

/** Normalize a URL pathname or dataset key into an R2 object key. */
export function normalizeObjectKey(pathOrKey: string): string | null {
  let key = pathOrKey.replace(/^\/+/, "");
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  if (
    !key ||
    key.endsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  // ACL docs live in the same R2 bucket for Worker-side auth, but must never
  // be HTTP-readable — they enumerate layer UUIDs and access rules.
  if (key.split("/")[0].toLowerCase() === "acl") {
    return null;
  }
  return key;
}

/** Classify an R2 key / request path for authorization and routing. */
export function classifyResource(pathOrKey: string): ResourceDescriptor | null {
  const key = normalizeObjectKey(pathOrKey);
  if (!key) return null;

  const published = key.match(PUBLISHED);
  if (published) {
    const slug = published[1];
    if (slug.toLowerCase() === "superuser") {
      return { kind: "data_library", key, slug: "superuser" };
    }
    return {
      kind: "published",
      key,
      slug,
      uuid: published[2].toLowerCase(),
    };
  }

  const subdivided = key.match(SUBDIVIDED);
  if (subdivided) {
    return { kind: "subdivided", key, slug: subdivided[1] };
  }

  const project = key.match(PROJECT);
  if (project) {
    return { kind: "project_other", key, slug: project[1] };
  }

  return { kind: "public", key };
}

/** When false, skip ACL/token checks (capability-URL compatibility). */
export function aclEnabled(env: Env): boolean {
  return String(env.AUTH_ACL_ENABLED).toLowerCase() === "true";
}

/**
 * When true, gate `/projects/{slug}/subdivided/...` with an admin map-access
 * or overlay-engine token. Independent of AUTH_ACL_ENABLED so subdivided
 * outputs can be locked down before published-layer ACL is enabled.
 */
export function subdividedAclEnabled(env: Env): boolean {
  return String(env.AUTH_SUBDIVIDED_ACL_ENABLED).toLowerCase() === "true";
}

/**
 * Whether ACL/token checks apply to this resource. Subdivided outputs use
 * AUTH_SUBDIVIDED_ACL_ENABLED (or AUTH_ACL_ENABLED once general enforcement
 * is on); everything else follows AUTH_ACL_ENABLED only.
 */
export function resourceAclEnabled(
  env: Env,
  resource: ResourceDescriptor,
): boolean {
  if (resource.kind === "subdivided") {
    return subdividedAclEnabled(env) || aclEnabled(env);
  }
  return aclEnabled(env);
}

/**
 * When ACL is enabled and no project ACL doc exists yet: public if true,
 * admins-only if false.
 */
export function missingAclIsPublic(env: Env): boolean {
  const raw = env.AUTH_MISSING_ACL_PUBLIC;
  if (raw === undefined || raw === null || raw === "") return true;
  return String(raw).toLowerCase() !== "false";
}

/**
 * ACL namespace from `?ns=`. Defaults to `prod` when absent or invalid.
 * Used for ACL doc keys and JWT trust policy.
 */
export function aclNamespaceFromRequest(request: Request): string {
  const ns = new URL(request.url).searchParams.get("ns");
  if (ns && NS_PATTERN.test(ns)) return ns;
  return "prod";
}

/** HTML browser preview for a published UUID (no tile/extension suffix). */
export function isPublishedPreviewPath(pathname: string): boolean {
  return new RegExp(
    `^/projects/[^/]+/public/${UUID}/?$`,
    "i",
  ).test(pathname);
}
