const LEGACY_UPLOADS_ORIGIN = "https://uploads.seasketch.org";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * A stored object URL, or a bare key. The API sends URLs. A browser still
 * running the previous client, and a layer that only has vectorObjectKey,
 * sends a key. Those keys stay on the production uploads origin.
 */
export function resolveStorageUrl(value: string): URL {
  if (SCHEME.test(value)) {
    return new URL(value);
  }
  return new URL(`${LEGACY_UPLOADS_ORIGIN}/${value.replace(/^\/+/, "")}`);
}
