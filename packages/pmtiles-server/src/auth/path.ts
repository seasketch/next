/**
 * Components of a /v2 hosted-tiles URL.
 *
 * Hosted object keys are `projects/{slug}/public/{uuid}.pmtiles` (and other
 * formats under the same UUID), so paths look like
 * `/v2/{ns}/projects/{slug}/public/{uuid}.json`, `…/{z}/{x}/{y}.mvt`,
 * or `…/{uuid}.pmtiles` / `…/{uuid}.geojson` for archive/file downloads.
 */
export type V2PathParts = {
  /** ACL namespace (`prod` in production; per-env otherwise). */
  ns: string;
  /** Storage path slug (often the project slug at upload time). */
  slug: string;
  /** Content-addressed tileset / upload UUID. */
  uuid: string;
  /** Path after stripping /v2/{ns}; always starts with /projects/... */
  legacyPath: string;
};

export type V2SubdividedPathParts = {
  ns: string;
  slug: string;
  legacyPath: string;
};

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const NS_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

// Current hosted format includes the `public` visibility segment.
const V2_TILEJSON = new RegExp(
  `^/v2/([^/]+)/(projects/([^/]+)/public/(${UUID}))\\.json$`
);
const V2_TILE = new RegExp(
  `^/v2/([^/]+)/(projects/([^/]+)/public/(${UUID})/\\d+/\\d+/\\d+\\.\\w+)$`
);
/** Whole-object downloads: `{uuid}.pmtiles`, `{uuid}.geojson.json`, or `{uuid}/meta.xml`. */
const V2_OBJECT = new RegExp(
  `^/v2/([^/]+)/(projects/([^/]+)/public/(${UUID})(?:(?:\\.[a-zA-Z0-9]+)+|/(?:[^/]+)+))$`
);
const V2_PREVIEW = new RegExp(
  `^/v2/([^/]+)/(projects/([^/]+)/public/(${UUID}))/?$`
);

function partsFromMatch(m: RegExpMatchArray): V2PathParts | null {
  const ns = m[1];
  const rest = m[2];
  const slug = m[3];
  const uuid = m[4].toLowerCase();
  if (!NS_PATTERN.test(ns)) return null;
  return { ns, slug, uuid, legacyPath: `/${rest}` };
}

/**
 * Parse a /v2 tile, TileJSON, object-download, or preview pathname into
 * ACL/auth routing parts. Returns null for malformed or unsupported /v2 shapes.
 */
export function parseV2Path(pathname: string): V2PathParts | null {
  let m = pathname.match(V2_TILEJSON);
  if (m) {
    const parsed = partsFromMatch(m);
    if (parsed) {
      // rest group excludes ".json"; restore it for the legacy TileJSON path
      parsed.legacyPath = `/${m[2]}.json`;
      return parsed;
    }
  }

  m = pathname.match(V2_TILE);
  if (m) return partsFromMatch(m);

  // Object downloads must come before preview (preview has no extension).
  // TileJSON (exact `{uuid}.json`) is matched above so it is not treated as a
  // raw R2 object key.
  m = pathname.match(V2_OBJECT);
  if (m) return partsFromMatch(m);

  m = pathname.match(V2_PREVIEW);
  if (m) return partsFromMatch(m);

  return null;
}

export function parseV2SubdividedPath(
  pathname: string,
): V2SubdividedPathParts | null {
  const match = pathname.match(
    /^\/v2\/([^/]+)\/projects\/([^/]+)\/subdivided\/(.+)$/,
  );
  if (!match || !NS_PATTERN.test(match[1]) || !match[3]) return null;
  return {
    ns: match[1],
    slug: match[2],
    legacyPath: `/projects/${match[2]}/subdivided/${match[3]}`,
  };
}

/** True for any path under the /v2 auth gateway prefix. */
export function isV2Path(pathname: string): boolean {
  return pathname === "/v2" || pathname.startsWith("/v2/");
}

/** True for HTML preview URLs: /v2/{ns}/projects/{slug}/public/{uuid}[/] */
export function isV2PreviewPath(pathname: string): boolean {
  return V2_PREVIEW.test(pathname);
}

/**
 * True for whole-object download URLs under /v2 (e.g. `.pmtiles`, `.geojson`).
 * Excludes TileJSON (`{uuid}.json`), tiles, and HTML preview.
 */
export function isV2ObjectPath(pathname: string): boolean {
  if (V2_TILEJSON.test(pathname) || V2_TILE.test(pathname)) return false;
  return V2_OBJECT.test(pathname);
}
