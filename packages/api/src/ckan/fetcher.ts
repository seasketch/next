import { isIP } from "net";
import { lookup } from "dns/promises";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function isPrivateAddress(address: string): boolean {
  if (address === "127.0.0.1" || address === "::1" || address === "0.0.0.0") {
    return true;
  }
  if (address.startsWith("10.")) {
    return true;
  }
  if (address.startsWith("192.168.")) {
    return true;
  }
  if (address.startsWith("169.254.")) {
    return true;
  }
  const match = address.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80")) {
    return true;
  }
  return false;
}

export async function assertSafeCkanUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid CKAN URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("CKAN URLs must use HTTPS");
  }
  const hostname = url.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("CKAN URL host is not allowed");
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error("CKAN URL host is not allowed");
  }
  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new Error("CKAN URL host is not allowed");
    }
  }
  return url;
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) {
    return;
  }
  const first = cache.keys().next().value;
  if (first) {
    cache.delete(first);
  }
}

export async function fetchCkanJson(url: string): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = inFlight.get(url);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    await assertSafeCkanUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`CKAN request failed: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) {
        throw new Error("CKAN response is too large");
      }
      const parsed = JSON.parse(buffer.toString("utf8"));
      cache.delete(url);
      cache.set(url, { value: parsed, expiresAt: Date.now() + TTL_MS });
      evictIfNeeded();
      return parsed;
    } catch (error) {
      if (cached) {
        return cached.value;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })();

  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}

export function ckanActionUrl(apiRoot: string, action: string, params: Record<string, string>) {
  const url = new URL(`${apiRoot.replace(/\/+$/, "")}/${action}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function fetchCkanAction(
  apiRoot: string,
  action: string,
  params: Record<string, string>
): Promise<unknown> {
  const payload = await fetchCkanJson(ckanActionUrl(apiRoot, action, params));
  if (
    payload &&
    typeof payload === "object" &&
    (payload as { success?: unknown }).success === true
  ) {
    return (payload as { result?: unknown }).result;
  }
  return null;
}
