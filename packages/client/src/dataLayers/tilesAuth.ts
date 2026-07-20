/**
 * ACL namespace for hosted tiles/uploads query-param auth (`?ns=`).
 * Production CRA builds always have NODE_ENV=production → omit `ns` and let
 * the worker default to `prod`. Local/dev uses REACT_APP_TILES_ACL_NAMESPACE.
 */
export function tilesAclNamespace(): string {
  if (process.env.NODE_ENV === "production") {
    return "prod";
  }
  const ns = process.env.REACT_APP_TILES_ACL_NAMESPACE;
  if (!ns || !ns.trim()) {
    return "dev-local";
  }
  return ns.trim();
}

/** True when the client should send `?ns=` (non-production only). */
export function shouldSendTilesAclNamespace(): boolean {
  return process.env.NODE_ENV !== "production";
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

export type HostedAuthParamsOptions = {
  accessToken?: string | null;
};

/**
 * Append auth query params to a hosted tiles/uploads URL without rewriting
 * host or path. Optionally retargets host via REACT_APP_TILES_ORIGIN for local
 * wrangler. Sets `access_token` when provided; sets `ns` only in non-production.
 */
export function withHostedAuthParams(
  url: string,
  options: HostedAuthParamsOptions = {}
): string {
  try {
    const u = new URL(url);
    if (!isHostedDataHost(u.hostname)) {
      return url;
    }

    const originOverride = tilesOriginOverride();
    if (originOverride) {
      const o = new URL(originOverride);
      u.protocol = o.protocol;
      u.host = o.host;
    }

    if (shouldSendTilesAclNamespace()) {
      // eslint-disable-next-line i18next/no-literal-string
      u.searchParams.set("ns", tilesAclNamespace());
    }

    if (options.accessToken) {
      // eslint-disable-next-line i18next/no-literal-string
      u.searchParams.set("access_token", options.accessToken);
    }

    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Append auth params to a hosted download URL (`?download=` preserved).
 * No-op for non-hosted hosts. Always on — extra query params are harmless if
 * an older worker ignores them.
 */
export function withHostedDownloadAuth(
  url: string | null | undefined,
  accessToken?: string | null
): string | null | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!isHostedDataHost(u.hostname)) {
      return url;
    }
    if (!u.pathname.startsWith("/projects/")) {
      return url;
    }
    return withHostedAuthParams(url, { accessToken });
  } catch {
    return url;
  }
}
