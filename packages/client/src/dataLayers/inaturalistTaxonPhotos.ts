import { useEffect, useMemo, useState } from "react";

export const INATURALIST_TAXA_ORIGIN = "https://api.inaturalist.org";
export const INATURALIST_TAXA_PATH = "/v1/taxa";
/** iNaturalist returns at most 30 taxa per request. */
export const INATURALIST_TAXA_MAX_IDS = 30;

export type InaturalistTaxonPhoto = {
  taxonId: number;
  squareUrl: string;
  attribution: string;
  licenseCode: string;
};

const photoCache = new Map<number, InaturalistTaxonPhoto | null>();

export function clearInaturalistTaxonPhotoCache() {
  photoCache.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coercePositiveInt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function uniquePositiveInts(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of ids) {
    const id = coercePositiveInt(raw);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function uniqueSortedPositiveInts(ids: unknown): number[] {
  return uniquePositiveInts(ids).sort((a, b) => a - b);
}

export function inaturalistTaxaUrl(ids: number[]): string {
  const sorted = uniqueSortedPositiveInts(ids);
  return `${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}/${sorted.join(",")}`;
}

function trimmedHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function namesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * iNat repeats the photographer as "uploaded by" when they are the same
 * person. Keep that clause only when the uploader is someone else.
 */
export function compactInaturalistAttribution(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const uploaded = trimmed.match(/, uploaded by (.+)$/i);
  if (!uploaded || uploaded.index == null) return trimmed;
  const uploader = uploaded[1].trim();
  const withoutUploaded = trimmed.slice(0, uploaded.index).trim();
  const copyright = withoutUploaded.match(/^\(c\)\s*([^,]+)/i);
  if (copyright && namesMatch(copyright[1], uploader)) {
    return withoutUploaded;
  }
  return trimmed;
}

const INATURALIST_LICENSE_DEEDS: Record<string, string> = {
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "cc-by": "https://creativecommons.org/licenses/by/4.0/",
  "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
  "cc-by-nd": "https://creativecommons.org/licenses/by-nd/4.0/",
  "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "cc-by-nc-nd": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
};

export function normalizeInaturalistLicenseCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const parts = code
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (/^\d+(\.\d+)*$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  const normalized = parts.join("-");
  return normalized || null;
}

export function inaturalistLicenseUrl(code: unknown): string | null {
  const normalized = normalizeInaturalistLicenseCode(code);
  if (!normalized) return null;
  return INATURALIST_LICENSE_DEEDS[normalized] || null;
}

export function inaturalistAttributionParts(
  attribution: string,
  licenseCode?: string | null
): { text: string; licenseLabel: string | null; licenseUrl: string | null } {
  const licenseUrl = inaturalistLicenseUrl(licenseCode);
  if (!licenseUrl) {
    return { text: attribution, licenseLabel: null, licenseUrl: null };
  }
  const marked = attribution.match(/^(.*?)(\((CC[^)]+)\))\s*$/i);
  if (marked) {
    return {
      text: marked[1].replace(/[,\s]+$/, ""),
      licenseLabel: marked[2],
      licenseUrl,
    };
  }
  const normalized = normalizeInaturalistLicenseCode(licenseCode);
  /* eslint-disable i18next/no-literal-string -- license identifiers, not UI copy */
  const licenseLabel =
    normalized === "cc0"
      ? "CC0"
      : normalized
        ? `CC ${normalized.replace(/^cc-/, "").toUpperCase()}`
        : null;
  /* eslint-enable i18next/no-literal-string */
  return { text: attribution, licenseLabel, licenseUrl };
}

export function inaturalistPhotoUrlForSize(
  photo: Record<string, unknown>,
  size: "medium" | "small" | "square"
): string | null {
  const keys =
    size === "square"
      ? ["square_url", "small_url", "medium_url"]
      : size === "small"
        ? ["small_url", "medium_url"]
        : ["medium_url", "small_url"];
  for (const key of keys) {
    const url = trimmedHttpUrl(photo[key]);
    if (url) return url;
  }
  const square = trimmedHttpUrl(photo.square_url);
  if (!square) return null;
  if (size === "square") return square;
  return square.replace(/\/square(\.[a-z0-9]+)$/i, `/${size}$1`);
}

function licensedThumb(
  photo: unknown,
  size: "medium" | "small" | "square"
): Omit<InaturalistTaxonPhoto, "taxonId"> | null {
  if (!isRecord(photo)) return null;
  const licenseCode = photo.license_code;
  if (typeof licenseCode !== "string" || licenseCode.trim().length === 0) {
    return null;
  }
  const url = inaturalistPhotoUrlForSize(photo, size);
  if (!url) return null;
  return {
    squareUrl: url,
    attribution: compactInaturalistAttribution(photo.attribution),
    licenseCode: licenseCode.trim(),
  };
}

function photoCandidates(value: Record<string, unknown>): unknown[] {
  const out: unknown[] = [value.default_photo];
  if (Array.isArray(value.taxon_photos)) {
    for (const entry of value.taxon_photos) {
      if (isRecord(entry) && "photo" in entry) {
        out.push(entry.photo);
      } else {
        out.push(entry);
      }
    }
  }
  return out;
}

export function pickInaturalistTaxonPhoto(
  value: unknown,
  size: "medium" | "small" | "square" = "medium"
): InaturalistTaxonPhoto | null {
  if (!isRecord(value)) return null;
  const taxonId = coercePositiveInt(value.id);
  if (taxonId == null) return null;
  for (const candidate of photoCandidates(value)) {
    const thumb = licensedThumb(candidate, size);
    if (thumb) {
      return { taxonId, ...thumb };
    }
  }
  return null;
}

/** Licensed default_photo, else the first licensed taxon_photos entry. */
export function inaturalistTaxaFromUnknown(
  payload: unknown,
  requestedIds: number[]
): { photos: Map<number, InaturalistTaxonPhoto>; empty: number[] } {
  const photos = new Map<number, InaturalistTaxonPhoto>();
  const seen = new Set<number>();
  if (isRecord(payload) && Array.isArray(payload.results)) {
    for (const item of payload.results) {
      const picked = pickInaturalistTaxonPhoto(item, "medium");
      if (!picked) continue;
      photos.set(picked.taxonId, picked);
      seen.add(picked.taxonId);
    }
  }
  const empty = uniqueSortedPositiveInts(requestedIds).filter(
    (id) => !seen.has(id)
  );
  return { photos, empty };
}

async function fetchThumbBatch(
  ids: number[]
): Promise<{ photos: Map<number, InaturalistTaxonPhoto>; empty: number[] }> {
  if (ids.length === 0) {
    return { photos: new Map(), empty: [] };
  }
  const response = await fetch(inaturalistTaxaUrl(ids), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`iNaturalist taxa request failed (${response.status})`);
  }
  return inaturalistTaxaFromUnknown(await response.json(), ids);
}

export type InaturalistTaxonPhotoFetchProgress = {
  photos: Map<number, InaturalistTaxonPhoto>;
  empty: number[];
  pending: number[];
  failed: number[];
  error: string | null;
};

export type InaturalistTaxonPhotoLookup = {
  photos: Map<number, InaturalistTaxonPhoto>;
  empty: ReadonlySet<number>;
  pending: ReadonlySet<number>;
  failed: ReadonlySet<number>;
};

export type InaturalistTaxonPhotoStatus =
  | { status: "loading" }
  | { status: "ready"; photo: InaturalistTaxonPhoto }
  | { status: "empty" }
  | { status: "error" };

export function lookupInaturalistTaxonPhotosFromCache(
  ids: unknown
): InaturalistTaxonPhotoFetchProgress {
  const unique = uniquePositiveInts(ids);
  const photos = new Map<number, InaturalistTaxonPhoto>();
  const empty: number[] = [];
  const pending: number[] = [];
  for (const id of unique) {
    if (!photoCache.has(id)) {
      pending.push(id);
      continue;
    }
    const cached = photoCache.get(id);
    if (cached) {
      photos.set(id, cached);
    } else {
      empty.push(id);
    }
  }
  return { photos, empty, pending, failed: [], error: null };
}

export function inaturalistTaxonPhotoStatus(
  taxonId: unknown,
  lookup: InaturalistTaxonPhotoLookup
): InaturalistTaxonPhotoStatus {
  const id = coercePositiveInt(taxonId);
  if (id == null) {
    return { status: "empty" };
  }
  const photo = lookup.photos.get(id);
  if (photo) {
    return { status: "ready", photo };
  }
  if (lookup.failed.has(id)) {
    return { status: "error" };
  }
  if (lookup.empty.has(id)) {
    return { status: "empty" };
  }
  return { status: "loading" };
}

function progressToLookup(
  progress: InaturalistTaxonPhotoFetchProgress
): InaturalistTaxonPhotoLookup & { error: string | null } {
  return {
    photos: progress.photos,
    empty: new Set(progress.empty),
    pending: new Set(progress.pending),
    failed: new Set(progress.failed),
    error: progress.error,
  };
}

/**
 * Session-memoized thumbs from api.inaturalist.org (browser IP, not the
 * Cloudflare Worker egress). One pass of 30-id chunks; a failed request
 * stops and the rest show as errors.
 */
export async function fetchInaturalistTaxonPhotos(
  ids: unknown,
  onProgress?: (progress: InaturalistTaxonPhotoFetchProgress) => void
): Promise<Map<number, InaturalistTaxonPhoto>> {
  const unique = uniqueSortedPositiveInts(ids);
  const photos = new Map<number, InaturalistTaxonPhoto>();
  const empty: number[] = [];
  const failed: number[] = [];
  const uncached: number[] = [];
  let error: string | null = null;

  for (const id of unique) {
    if (!photoCache.has(id)) {
      uncached.push(id);
      continue;
    }
    const cached = photoCache.get(id);
    if (cached) {
      photos.set(id, cached);
    } else {
      empty.push(id);
    }
  }

  const emit = (pending: number[]) => {
    onProgress?.({
      photos: new Map(photos),
      empty: [...empty],
      pending,
      failed: [...failed],
      error,
    });
  };
  emit(uncached);

  for (let i = 0; i < uncached.length; i += INATURALIST_TAXA_MAX_IDS) {
    const batch = uncached.slice(i, i + INATURALIST_TAXA_MAX_IDS);
    const rest = uncached.slice(i + INATURALIST_TAXA_MAX_IDS);
    try {
      const result = await fetchThumbBatch(batch);
      for (const id of batch) {
        const photo = result.photos.get(id) || null;
        photoCache.set(id, photo);
        if (photo) {
          photos.set(id, photo);
        } else {
          empty.push(id);
        }
      }
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : // eslint-disable-next-line i18next/no-literal-string
            "iNaturalist thumbs request failed";
      failed.push(...batch, ...rest);
      emit([]);
      break;
    }
    emit(rest);
  }
  return photos;
}

export function useInaturalistTaxonPhotos(ids: unknown) {
  const unique = useMemo(() => uniqueSortedPositiveInts(ids), [ids]);
  const idKey = unique.join(",");
  const [lookup, setLookup] = useState(() =>
    progressToLookup(lookupInaturalistTaxonPhotosFromCache(unique))
  );

  useEffect(() => {
    const initial = lookupInaturalistTaxonPhotosFromCache(unique);
    setLookup(progressToLookup(initial));
    if (unique.length === 0 || initial.pending.length === 0) {
      return;
    }
    let cancelled = false;
    fetchInaturalistTaxonPhotos(unique, (progress) => {
      if (!cancelled) {
        setLookup(progressToLookup(progress));
      }
    }).catch((err: Error) => {
      if (!cancelled) {
        setLookup((prev) => ({
          ...prev,
          pending: new Set(),
          failed: new Set(initial.pending),
          error: err.message,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [idKey, unique]);

  return lookup;
}
