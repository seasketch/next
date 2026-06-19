import { parseCapabilities } from "./capabilities";
import { WMSServiceMetadata, WMSVersion } from "./types";
import { defaultFetch, FetchFn } from "./util";
import { normalizeWMSUrl } from "./urls";

export {
  flattenLayers,
  getLayerBounds,
  getNamedLayers,
  getSupportedWebMercatorCrs,
  parseCapabilities,
} from "./capabilities";
export { normalizeWMSUrl } from "./urls";

export interface FetchCapabilitiesOptions {
  fetch?: FetchFn;
  version?: WMSVersion;
  serviceUrl?: string;
}

export interface FetchCapabilitiesResult {
  raw: string;
  metadata: WMSServiceMetadata;
  getCapabilitiesUrl: string;
}

export async function fetchCapabilities(
  inputUrl: string,
  options: FetchCapabilitiesOptions = {}
): Promise<FetchCapabilitiesResult> {
  const fetchFn = options.fetch || defaultFetch;
  const normalized = normalizeWMSUrl(inputUrl);
  const capUrl = new URL(normalized.getCapabilitiesUrl);
  if (options.version) {
    capUrl.searchParams.set("VERSION", options.version);
  }
  const response = await fetchFn(capUrl.toString(), {
    headers: {
      Accept: "application/xml,text/xml,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(
      `GetCapabilities failed (${response.status} ${response.statusText})`
    );
  }
  const raw = await response.text();
  if (!raw.trim().startsWith("<")) {
    throw new Error("GetCapabilities response was not XML");
  }
  const metadata = parseCapabilities(
    raw,
    options.serviceUrl || normalized.baseUrl
  );
  return {
    raw,
    metadata,
    getCapabilitiesUrl: capUrl.toString(),
  };
}

export async function validateCORS(
  url: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetchFn(url, {
      method: "GET",
      mode: "cors",
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
