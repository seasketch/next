export interface ParsedCkanUrl {
  baseUrl: string;
  datasetId: string;
  apiRoot: string;
  locale: string | null;
  datasetPageUrl: string;
}

const DATASET_PATH = /\/(?:dataset|package)\/([^/?#]+)/i;
const API_PACKAGE_SHOW = /\/api\/3\/action\/package_show/i;
const API_ROOT = /\/api\/(?:3\/)?action\/?$/i;
const LOCALE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2,8})?$/i;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function localeFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  for (const segment of segments) {
    if (LOCALE_SEGMENT.test(segment) && segment.length <= 8) {
      return segment.toLowerCase();
    }
  }
  return null;
}

function originAndPrefix(url: URL, stopAt: string): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const stop = segments.findIndex(
    (segment) => segment.toLowerCase() === stopAt.toLowerCase()
  );
  const prefix = stop === -1 ? segments : segments.slice(0, stop);
  return stripTrailingSlash(`${url.origin}/${prefix.join("/")}`);
}

export function parseCkanUrl(input: unknown): ParsedCkanUrl | null {
  if (typeof input !== "string" || input.trim().length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const locale = localeFromPath(url.pathname);

  if (API_PACKAGE_SHOW.test(url.pathname)) {
    const datasetId =
      url.searchParams.get("id") || url.searchParams.get("name");
    if (!datasetId) {
      return null;
    }
    const apiRoot = stripTrailingSlash(
      `${url.origin}${url.pathname.replace(/\/package_show\/?$/i, "")}`
    );
    const baseUrl = originAndPrefix(url, "api");
    return {
      baseUrl,
      datasetId,
      apiRoot,
      locale,
      datasetPageUrl: `${baseUrl}/dataset/${datasetId}`,
    };
  }

  const datasetMatch = url.pathname.match(DATASET_PATH);
  if (datasetMatch) {
    const datasetId = decodeURIComponent(datasetMatch[1]);
    const baseUrl = originAndPrefix(url, "dataset");
    const apiRoot = `${baseUrl}/api/3/action`;
    return {
      baseUrl,
      datasetId,
      apiRoot,
      locale,
      datasetPageUrl: `${baseUrl}/dataset/${datasetId}`,
    };
  }

  if (API_ROOT.test(url.pathname)) {
    return null;
  }

  return null;
}

export function localizedDatasetPageUrl(
  parsed: ParsedCkanUrl,
  requestedLocale?: string | null
): string {
  if (!parsed.locale || !requestedLocale) {
    return parsed.datasetPageUrl;
  }
  const requested = requestedLocale.toLowerCase();
  if (requested === parsed.locale.toLowerCase()) {
    return parsed.datasetPageUrl;
  }
  const pattern = new RegExp(`/${parsed.locale}(?=/|$)`, "i");
  if (pattern.test(parsed.datasetPageUrl)) {
    return parsed.datasetPageUrl.replace(pattern, `/${requested}`);
  }
  return parsed.datasetPageUrl;
}
