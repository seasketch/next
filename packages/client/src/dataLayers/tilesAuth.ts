/**
 * ACL namespace for /v2/{ns}/... tile URLs.
 * Production CRA builds always have NODE_ENV=production → "prod".
 * Local dev must set REACT_APP_TILES_ACL_NAMESPACE when using TILES_AUTH_V2.
 */
export function tilesAclNamespace(): string {
  if (process.env.NODE_ENV === "production") {
    return "prod";
  }
  const ns = process.env.REACT_APP_TILES_ACL_NAMESPACE;
  if (!ns || !ns.trim()) {
    // Only required when v2 auth is enabled; callers should check tilesAuthV2Enabled first
    return "dev-local";
  }
  return ns.trim();
}

export function tilesAuthV2Enabled(): boolean {
  return process.env.REACT_APP_TILES_AUTH_V2 === "true";
}

/**
 * Optional override so local wrangler (`http://127.0.0.1:8787`) can authorize
 * tokens signed by the local API. Production JWKS cannot verify local keys.
 */
export function tilesOriginOverride(): string | null {
  const origin = process.env.REACT_APP_TILES_ORIGIN;
  if (!origin || !origin.trim()) return null;
  return origin.trim().replace(/\/$/, "");
}

const TILES_HOSTS = new Set([
  "tiles.seasketch.org",
  // wrangler / local worker hosts if used
  "localhost",
  "127.0.0.1",
]);

/** Hosts that serve SeaSketch hosted objects from the shared ssn-tiles R2 bucket. */
const HOSTED_DATA_HOSTS = new Set([
  "tiles.seasketch.org",
  "uploads.seasketch.org",
  "localhost",
  "127.0.0.1",
]);

export function isTilesHost(hostname: string): boolean {
  if (TILES_HOSTS.has(hostname)) return true;
  // Allow preview worker hosts like *.tiles.seasketch.org workers.dev
  if (/tiles\.seasketch\.org$/i.test(hostname)) return true;
  if (/\.workers\.dev$/i.test(hostname)) return true;
  const override = tilesOriginOverride();
  if (override) {
    try {
      if (new URL(override).hostname === hostname) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** True for tiles/uploads hosts that serve the shared ssn-tiles R2 bucket. */
export function isHostedDataHost(hostname: string): boolean {
  if (HOSTED_DATA_HOSTS.has(hostname)) return true;
  if (/tiles\.seasketch\.org$/i.test(hostname)) return true;
  if (/uploads\.seasketch\.org$/i.test(hostname)) return true;
  if (/\.workers\.dev$/i.test(hostname)) return true;
  const override = tilesOriginOverride();
  if (override) {
    try {
      if (new URL(override).hostname === hostname) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

const UUID_RE =
  /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;

export function extractTilesUuidFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isTilesHost(u.hostname) && !/\/projects\//.test(u.pathname)) {
      return null;
    }
    const m = u.pathname.match(UUID_RE);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Rewrite https://tiles.../projects/... → https://tiles.../v2/{ns}/projects/...
 * Idempotent if already under /v2/.
 * When REACT_APP_TILES_ORIGIN is set, also retarget the host for local wrangler.
 */
export function rewriteToV2TilesUrl(url: string, ns: string): string {
  try {
    const u = new URL(url);
    // Retarget production tile host → local wrangler when configured
    const originOverride = tilesOriginOverride();
    if (originOverride && u.hostname === "tiles.seasketch.org") {
      const o = new URL(originOverride);
      u.protocol = o.protocol;
      u.host = o.host;
    }
    if (!isTilesHost(u.hostname)) {
      return url;
    }
    if (u.pathname.startsWith("/v2/")) {
      return u.toString();
    }
    if (!u.pathname.startsWith("/projects/")) {
      return u.toString();
    }
    // eslint-disable-next-line i18next/no-literal-string
    u.pathname = `/v2/${ns}${u.pathname}`;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Rewrite a hosted overlay download URL (uploads or tiles) onto the auth-aware
 * `/v2/{ns}/projects/...` gateway when TILES_AUTH_V2 is enabled.
 *
 * Uploads and tiles share the same R2 bucket; downloads go through pmtiles-server
 * so ACL + map-access tokens apply the same way as tile fetches. Preserves
 * `?download=` and optionally attaches `access_token` for `<a href>` downloads.
 */
export function rewriteHostedDownloadUrl(
  url: string | null | undefined,
  accessToken?: string | null
): string | null | undefined {
  if (!url) return url;
  if (!tilesAuthV2Enabled()) return url;

  try {
    const u = new URL(url);
    if (!isHostedDataHost(u.hostname)) {
      return url;
    }
    if (!u.pathname.startsWith("/projects/") && !u.pathname.startsWith("/v2/")) {
      return url;
    }

    const originOverride = tilesOriginOverride();
    if (originOverride) {
      const o = new URL(originOverride);
      u.protocol = o.protocol;
      u.host = o.host;
    } else if (
      u.hostname === "uploads.seasketch.org" ||
      /uploads\.seasketch\.org$/i.test(u.hostname)
    ) {
      u.protocol = "https:";
      u.host = "tiles.seasketch.org";
    }

    const ns = tilesAclNamespace();
    if (!u.pathname.startsWith("/v2/")) {
      // eslint-disable-next-line i18next/no-literal-string
      u.pathname = `/v2/${ns}${u.pathname}`;
    }

    if (accessToken) {
      u.searchParams.set("access_token", accessToken);
    }

    return u.toString();
  } catch {
    return url;
  }
}
