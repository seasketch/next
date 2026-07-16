const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const PUBLISHED = new RegExp(
  `^projects/([^/]+)/public/(${UUID})(?:$|[./].*)`,
  "i",
);
const SUBDIVIDED = /^projects\/([^/]+)\/subdivided\/(.+)$/i;
const PROJECT = /^projects\/([^/]+)\/(.+)$/i;

export type ResourceDescriptor =
  | { kind: "public"; key: string }
  | { kind: "data_library"; key: string; slug: "superuser" }
  | { kind: "published"; key: string; slug: string; uuid: string }
  | { kind: "subdivided"; key: string; slug: string }
  | { kind: "project_other"; key: string; slug: string };

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
  return key;
}

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

export function legacyProjectAuthEnabled(env: Env): boolean {
  return String(env.AUTH_LEGACY_PROJECT_PATHS).toLowerCase() === "true";
}
