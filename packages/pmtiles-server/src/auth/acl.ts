import type {
  AclClass,
  AclLookupResult,
  ProjectAclDoc,
  ProtectedAclEntry,
} from "./types";

type CacheEntry = {
  doc: ProjectAclDoc | null;
  etag: string | null;
  fetchedAt: number;
};

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

function aclKey(ns: string, slug: string) {
  return `acl/${ns}/projects/${slug}.json`;
}

function cacheKey(ns: string, slug: string) {
  return `${ns}/${slug}`;
}

function emptyDoc(slug: string): ProjectAclDoc {
  return { v: 0, slug, public: [], rules: [], protected: {} };
}

const ADMINS_ONLY_RULE: ProtectedAclEntry = { t: "admins_only" };

function normalizeRule(value: unknown): ProtectedAclEntry {
  if (!value || typeof value !== "object") return ADMINS_ONLY_RULE;
  const candidate = value as Partial<ProtectedAclEntry>;
  if (candidate.t === "group") {
    const groups = Array.isArray(candidate.g)
      ? [
          ...new Set(
            candidate.g.filter(
              (groupId): groupId is number =>
                Number.isInteger(groupId) && groupId >= 0
            )
          ),
        ].sort((a, b) => a - b)
      : [];
    return { t: "group", g: groups };
  }
  return ADMINS_ONLY_RULE;
}

/**
 * Normalize untrusted JSON from R2. Public UUIDs are sorted so membership can
 * use binary search; malformed fields fall back to deny-safe values.
 */
export function normalizeProjectAclDoc(
  value: unknown,
  fallbackSlug: string
): ProjectAclDoc {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<ProjectAclDoc>)
      : {};
  const rules = Array.isArray(candidate.rules)
    ? candidate.rules.map(normalizeRule)
    : [];
  const rawProtected =
    candidate.protected &&
    typeof candidate.protected === "object" &&
    !Array.isArray(candidate.protected)
      ? candidate.protected
      : {};
  const protectedEntries: Record<string, number[]> = {};
  for (const [uuid, value] of Object.entries(rawProtected)) {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= rules.length
      )
    ) {
      // A sentinel invalid reference resolves to admins-only in classifyUuid.
      protectedEntries[uuid] = [-1];
    } else {
      protectedEntries[uuid] = [
        ...new Set(value as number[]),
      ].sort((a, b) => a - b);
    }
  }

  return {
    v: typeof candidate.v === "number" ? candidate.v : 0,
    slug:
      typeof candidate.slug === "string" && candidate.slug.length > 0
        ? candidate.slug
        : fallbackSlug,
    public: Array.isArray(candidate.public)
      ? candidate.public
          .filter((uuid): uuid is string => typeof uuid === "string")
          .sort()
      : [],
    rules,
    protected: protectedEntries,
  };
}

async function fetchAclFromR2(
  bucket: R2Bucket,
  ns: string,
  slug: string,
  onlyIfEtag?: string | null
): Promise<CacheEntry> {
  const key = aclKey(ns, slug);
  const opts =
    onlyIfEtag != null && onlyIfEtag.length > 0
      ? { onlyIf: { etagDoesNotMatch: onlyIfEtag } }
      : undefined;

  const obj = await bucket.get(key, opts);

  if (!obj) {
    return { doc: emptyDoc(slug), etag: null, fetchedAt: Date.now() };
  }

  // With etagDoesNotMatch, a body-less object means the ETag is unchanged.
  if (typeof (obj as R2ObjectBody).text !== "function") {
    const prev = memoryCache.get(cacheKey(ns, slug));
    if (prev) {
      return { ...prev, fetchedAt: Date.now() };
    }
  }

  const text = await (obj as R2ObjectBody).text();
  let doc: ProjectAclDoc;
  try {
    doc = normalizeProjectAclDoc(JSON.parse(text), slug);
  } catch {
    console.error(
      JSON.stringify({
        msg: "tile-auth-acl-parse-error",
        ns,
        slug,
        key,
      })
    );
    doc = emptyDoc(slug);
  }

  return {
    doc,
    etag: obj.etag ?? null,
    fetchedAt: Date.now(),
  };
}

async function loadAclEntry(
  bucket: R2Bucket,
  ns: string,
  slug: string,
  forceRevalidate: boolean
): Promise<CacheEntry> {
  const ck = cacheKey(ns, slug);
  const cached = memoryCache.get(ck);

  if (cached && !forceRevalidate) {
    return cached;
  }

  const existing = inFlight.get(ck);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const entry = await fetchAclFromR2(
      bucket,
      ns,
      slug,
      forceRevalidate && cached?.etag ? cached.etag : null
    );
    // Prefer newer version if a race updated cache
    const current = memoryCache.get(ck);
    if (
      current &&
      current.doc &&
      entry.doc &&
      current.doc.v > entry.doc.v
    ) {
      return current;
    }
    memoryCache.set(ck, entry);
    return entry;
  })().finally(() => {
    inFlight.delete(ck);
  });

  inFlight.set(ck, promise);
  return promise;
}

/**
 * Exact membership test for a lexicographically sorted string array.
 */
export function sortedIncludes(values: string[], target: string): boolean {
  let low = 0;
  let high = values.length - 1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const value = values[middle];
    if (value === target) return true;
    if (value < target) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return false;
}

/**
 * Classify a tile UUID against an ACL document.
 *
 * Public list wins; missing/malformed protected refs deny as admins_only;
 * any admins_only rule among references makes the class admins_only; otherwise
 * group with the full resolved rule list (caller must AND them).
 */
export function classifyUuid(
  doc: ProjectAclDoc | null,
  uuid: string
): { class: AclClass; rules: ProtectedAclEntry[] } {
  if (!doc) {
    return { class: "admins_only", rules: [ADMINS_ONLY_RULE] };
  }
  if (sortedIncludes(doc.public, uuid)) {
    return { class: "public", rules: [] };
  }
  const refs = doc.protected[uuid];
  if (!Array.isArray(refs) || refs.length === 0) {
    return { class: "admins_only", rules: [ADMINS_ONLY_RULE] };
  }
  const rules = refs.map((index) => doc.rules[index] ?? ADMINS_ONLY_RULE);
  if (rules.some((rule) => rule.t === "admins_only")) {
    return { class: "admins_only", rules };
  }
  return { class: "group", rules };
}

/**
 * Load (or reuse) a project ACL doc and classify `uuid`.
 * Pass `{ revalidate: true }` to force an R2 check (If-None-Match) before
 * treating a cached deny as definitive.
 */
export async function lookupAcl(
  bucket: R2Bucket,
  ns: string,
  slug: string,
  uuid: string,
  options?: { revalidate?: boolean }
): Promise<AclLookupResult> {
  const fromCache = memoryCache.has(cacheKey(ns, slug)) && !options?.revalidate;
  const entry = await loadAclEntry(
    bucket,
    ns,
    slug,
    options?.revalidate === true
  );
  const { class: aclClass, rules } = classifyUuid(entry.doc, uuid);
  return {
    class: aclClass,
    rules,
    doc: entry.doc,
    etag: entry.etag,
    fromCache,
  };
}

/**
 * Deny-path helper: if cached classification is non-public, revalidate against
 * R2 so protected→public transitions are not stuck on stale memory.
 */
export async function lookupAclForAuth(
  bucket: R2Bucket,
  ns: string,
  slug: string,
  uuid: string
): Promise<AclLookupResult> {
  const first = await lookupAcl(bucket, ns, slug, uuid);
  if (first.class === "public") {
    return first;
  }
  // Confirm before deny / requiring token
  return lookupAcl(bucket, ns, slug, uuid, { revalidate: true });
}
