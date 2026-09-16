import { useEffect, useMemo, useState } from "react";

export const INATURALIST_TAXA_ORIGIN = "https://api.inaturalist.org";
export const INATURALIST_WWW_ORIGIN = "https://www.inaturalist.org";
export const INATURALIST_TAXA_PATH = "/v1/taxa";
/** iNaturalist returns at most 30 taxa per request. */
export const INATURALIST_TAXA_MAX_IDS = 30;

/** Coalesce one React list commit (~2 frames). Not a scroll debounce. */
export const INATURALIST_TAXA_SETTLE_MS = 32;
export const INATURALIST_TAXA_MIN_INTERVAL_MS = 300;

export type InaturalistTaxonPhotoSize = "square" | "small" | "medium";

export type InaturalistTaxonPhoto = {
  taxonId: number;
  photoId: number | null;
  squareUrl: string;
  smallUrl: string | null;
  mediumUrl: string | null;
  attribution: string;
  licenseCode: string;
};

const photoCache = new Map<number, InaturalistTaxonPhoto | null>();
const failedIds = new Set<number>();
const inFlightIds = new Set<number>();
const waiting: number[] = [];
const waitingSet = new Set<number>();
const visiblePriority = new Set<number>();
const registerCount = new Map<number, number>();

export type InaturalistTaxonPhotoPriority = "visible" | "prefetch";
const listeners = new Map<number, Set<() => void>>();

let settleTimer: ReturnType<typeof setTimeout> | null = null;
let rateTimer: ReturnType<typeof setTimeout> | null = null;
let nextAllowedAt = 0;
let requestInFlight = false;

export function clearInaturalistTaxonPhotoCache() {
  photoCache.clear();
  failedIds.clear();
  inFlightIds.clear();
  waiting.length = 0;
  waitingSet.clear();
  visiblePriority.clear();
  registerCount.clear();
  if (settleTimer != null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  if (rateTimer != null) {
    clearTimeout(rateTimer);
    rateTimer = null;
  }
  nextAllowedAt = 0;
  requestInFlight = false;
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

/**
 * Search-by-id (`/v1/taxa?id=`), not the show route (`/v1/taxa/:id`).
 * Show hydrates Wikipedia, ancestors, children, and every taxon photo.
 */
export function inaturalistTaxaUrl(ids: number[]): string {
  const sorted = uniqueSortedPositiveInts(ids);
  const url = new URL(`${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}`);
  url.searchParams.set("id", sorted.join(","));
  url.searchParams.set("per_page", String(INATURALIST_TAXA_MAX_IDS));
  return url.toString();
}

/** Show route: used only when search has no licensed default_photo. */
export function inaturalistTaxaShowUrl(ids: number[]): string {
  const sorted = uniqueSortedPositiveInts(ids);
  return `${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}/${sorted.join(
    ","
  )}`;
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
/** Drop iNat legal boilerplate; keep the photographer (and a distinct uploader). */
function stripInaturalistBoilerplate(text: string): string {
  return text
    .replace(/^(?:©|\(c\))\s*/i, "")
    .replace(/,\s*(some|all|no) rights reserved/gi, "")
    .replace(/,\s*no known copyright restrictions/gi, "")
    .replace(/\s*\((?:CC[^)]+|public domain(?: mark)?)\)/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function photographerCreditName(value: unknown): string {
  return compactInaturalistAttribution(value).replace(/^(?:©|\(c\))\s*/i, "").trim();
}

export function compactInaturalistAttribution(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const uploaded = trimmed.match(/, uploaded by (.+)$/i);
  if (!uploaded || uploaded.index == null) {
    return stripInaturalistBoilerplate(trimmed);
  }
  const uploader = uploaded[1].trim();
  const withoutUploaded = trimmed.slice(0, uploaded.index).trim();
  const photographer = photographerCreditName(withoutUploaded);
  if (photographer && namesMatch(photographer, uploader)) {
    return stripInaturalistBoilerplate(withoutUploaded);
  }
  return stripInaturalistBoilerplate(trimmed);
}

const INATURALIST_LICENSE_DEEDS: Record<string, string> = {
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  pd: "https://creativecommons.org/publicdomain/mark/1.0/",
  pdm: "https://creativecommons.org/publicdomain/mark/1.0/",
  "public-domain": "https://creativecommons.org/publicdomain/mark/1.0/",
  "cc-by": "https://creativecommons.org/licenses/by/4.0/",
  "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
  "cc-by-nd": "https://creativecommons.org/licenses/by-nd/4.0/",
  "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "cc-by-nc-nd": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
};

export type PhotoRightsKind = "copyrighted" | "cc0" | "public-domain";

export function photoRightsKind(code: unknown): PhotoRightsKind | null {
  const normalized = normalizeInaturalistLicenseCode(code);
  if (!normalized) return null;
  if (normalized === "cc0") return "cc0";
  if (
    normalized === "pd" ||
    normalized === "pdm" ||
    normalized === "public-domain"
  ) {
    return "public-domain";
  }
  if (normalized.startsWith("cc-")) return "copyrighted";
  return null;
}

function inferPhotoRightsKind(attribution: string): PhotoRightsKind | null {
  if (/no known copyright|public domain/i.test(attribution)) {
    return "public-domain";
  }
  if (/no rights reserved/i.test(attribution)) {
    return "cc0";
  }
  if (/some rights reserved/i.test(attribution)) {
    return "copyrighted";
  }
  return null;
}

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

export function inaturalistLicenseLabel(code: unknown): string | null {
  const normalized = normalizeInaturalistLicenseCode(code);
  if (!normalized) return null;
  /* eslint-disable i18next/no-literal-string -- license identifiers, not UI copy */
  if (normalized === "cc0") {
    return "CC0";
  }
  if (
    normalized === "pd" ||
    normalized === "pdm" ||
    normalized === "public-domain"
  ) {
    return "Public Domain Mark";
  }
  if (normalized.startsWith("cc-")) {
    return `CC ${normalized.replace(/^cc-/, "").toUpperCase()}`;
  }
  /* eslint-enable i18next/no-literal-string */
  return null;
}

export type CreativeCommonsIconKey =
  | "cc"
  | "by"
  | "nc"
  | "sa"
  | "nd"
  | "zero"
  | "pdm";

const CC_ICON_KEYS: CreativeCommonsIconKey[] = [
  "cc",
  "by",
  "nc",
  "sa",
  "nd",
  "zero",
  "pdm",
];

function isCreativeCommonsIconKey(
  value: unknown
): value is CreativeCommonsIconKey {
  return (
    typeof value === "string" &&
    CC_ICON_KEYS.some((key) => key === value)
  );
}

/** Official CC marks for a license code, in display order (CC + modules). */
export function creativeCommonsIconKeys(
  code: unknown
): CreativeCommonsIconKey[] {
  const normalized = normalizeInaturalistLicenseCode(code);
  if (!normalized) return [];
  if (normalized === "cc0") {
    return ["cc", "zero"];
  }
  if (
    normalized === "pd" ||
    normalized === "pdm" ||
    normalized === "public-domain"
  ) {
    return ["pdm"];
  }
  if (!normalized.startsWith("cc-")) {
    return [];
  }
  const keys: CreativeCommonsIconKey[] = ["cc"];
  for (const part of normalized.split("-").slice(1)) {
    if (isCreativeCommonsIconKey(part)) {
      keys.push(part);
    }
  }
  return keys.length > 1 ? keys : [];
}

export function inaturalistPhotoPageUrl(photoId: unknown): string | null {
  const id = coercePositiveInt(photoId);
  if (id == null) return null;
  // eslint-disable-next-line i18next/no-literal-string -- URL
  return `${INATURALIST_WWW_ORIGIN}/photos/${id}`;
}

export function inaturalistAttributionParts(
  attribution: string,
  licenseCode?: string | null,
  photoId?: number | null
): {
  text: string;
  photographerUrl: string | null;
  licenseLabel: string | null;
  licenseUrl: string | null;
  rightsKind: PhotoRightsKind | null;
} {
  const kind =
    photoRightsKind(licenseCode) || inferPhotoRightsKind(attribution);
  const name = photographerCreditName(attribution);
  const effectiveCode =
    licenseCode ||
    (kind === "cc0" ? "cc0" : kind === "public-domain" ? "pd" : null);
  return {
    text: name,
    photographerUrl: inaturalistPhotoPageUrl(photoId),
    licenseLabel: inaturalistLicenseLabel(effectiveCode),
    licenseUrl: inaturalistLicenseUrl(effectiveCode),
    rightsKind: kind,
  };
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

function licensedPhoto(
  photo: unknown
): Omit<InaturalistTaxonPhoto, "taxonId"> | null {
  if (!isRecord(photo)) return null;
  const licenseCode = photo.license_code;
  if (typeof licenseCode !== "string" || licenseCode.trim().length === 0) {
    return null;
  }
  const squareUrl = inaturalistPhotoUrlForSize(photo, "square");
  const smallUrl = inaturalistPhotoUrlForSize(photo, "small");
  const mediumUrl = inaturalistPhotoUrlForSize(photo, "medium");
  const url = squareUrl || smallUrl || mediumUrl;
  if (!url) return null;
  return {
    photoId: coercePositiveInt(photo.id),
    squareUrl: squareUrl || url,
    smallUrl,
    mediumUrl,
    attribution: compactInaturalistAttribution(photo.attribution),
    licenseCode: licenseCode.trim(),
  };
}

export function inaturalistTaxonPhotoDisplayUrl(
  photo: InaturalistTaxonPhoto,
  size: InaturalistTaxonPhotoSize = "medium"
): string {
  if (size === "square") {
    return photo.squareUrl;
  }
  if (size === "small") {
    return photo.smallUrl || photo.mediumUrl || photo.squareUrl;
  }
  return photo.mediumUrl || photo.smallUrl || photo.squareUrl;
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
  _size: InaturalistTaxonPhotoSize = "medium"
): InaturalistTaxonPhoto | null {
  if (!isRecord(value)) return null;
  const taxonId = coercePositiveInt(value.id);
  if (taxonId == null) return null;
  for (const candidate of photoCandidates(value)) {
    const thumb = licensedPhoto(candidate);
    if (thumb) {
      return { taxonId, ...thumb };
    }
  }
  return null;
}

export function parseInaturalistTaxonId(value: unknown): number | null {
  return coercePositiveInt(value);
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

const TAXA_ACCEPT = { accept: "application/json" };

async function mergeShowFallback(
  photos: Map<number, InaturalistTaxonPhoto>,
  empty: number[]
): Promise<{ photos: Map<number, InaturalistTaxonPhoto>; empty: number[] }> {
  if (empty.length === 0) {
    return { photos, empty };
  }
  const response = await fetch(inaturalistTaxaShowUrl(empty), {
    headers: TAXA_ACCEPT,
  });
  if (!response.ok) {
    return { photos, empty };
  }
  const fallback = inaturalistTaxaFromUnknown(await response.json(), empty);
  const next = new Map(photos);
  for (const [id, photo] of fallback.photos) {
    next.set(id, photo);
  }
  return {
    photos: next,
    empty: empty.filter((id) => !next.has(id)),
  };
}

async function fetchThumbBatch(
  ids: number[]
): Promise<{ photos: Map<number, InaturalistTaxonPhoto>; empty: number[] }> {
  if (ids.length === 0) {
    return { photos: new Map(), empty: [] };
  }
  const response = await fetch(inaturalistTaxaUrl(ids), {
    headers: TAXA_ACCEPT,
  });
  if (!response.ok) {
    throw new Error(`iNaturalist taxa request failed (${response.status})`);
  }
  const first = inaturalistTaxaFromUnknown(await response.json(), ids);
  return mergeShowFallback(first.photos, first.empty);
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
  lookup?: InaturalistTaxonPhotoLookup
): InaturalistTaxonPhotoStatus {
  const id = coercePositiveInt(taxonId);
  if (id == null) {
    return { status: "empty" };
  }
  if (lookup) {
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
  if (photoCache.has(id)) {
    const cached = photoCache.get(id);
    if (cached) {
      return { status: "ready", photo: cached };
    }
    return { status: "empty" };
  }
  if (failedIds.has(id)) {
    return { status: "error" };
  }
  return { status: "loading" };
}

function notifyTaxonPhoto(id: number) {
  const subs = listeners.get(id);
  if (!subs) return;
  for (const cb of Array.from(subs)) {
    cb();
  }
}

export function subscribeInaturalistTaxonPhoto(
  id: number,
  cb: () => void
): () => void {
  let subs = listeners.get(id);
  if (!subs) {
    subs = new Set();
    listeners.set(id, subs);
  }
  subs.add(cb);
  return () => {
    const current = listeners.get(id);
    if (!current) return;
    current.delete(cb);
    if (current.size === 0) {
      listeners.delete(id);
    }
  };
}

function enqueueWaiting(id: number) {
  if (waitingSet.has(id) || inFlightIds.has(id) || photoCache.has(id)) {
    return false;
  }
  waitingSet.add(id);
  waiting.push(id);
  return true;
}

function removeWaiting(id: number) {
  if (!waitingSet.has(id)) return;
  waitingSet.delete(id);
  const index = waiting.indexOf(id);
  if (index >= 0) {
    waiting.splice(index, 1);
  }
}

function orderPrefetchAroundVisible(
  prefetch: number[],
  visible: number[],
  indexById: Map<number, number>
): number[] {
  if (visible.length === 0) {
    return prefetch;
  }
  const visibleIndexes: number[] = [];
  for (const id of visible) {
    const index = indexById.get(id);
    if (index != null) {
      visibleIndexes.push(index);
    }
  }
  if (visibleIndexes.length === 0) {
    return prefetch;
  }
  const maxP = Math.max(...visibleIndexes);
  const minP = Math.min(...visibleIndexes);
  const after: number[] = [];
  const gaps: number[] = [];
  const above: number[] = [];
  for (const id of prefetch) {
    const index = indexById.get(id);
    if (index == null) continue;
    if (index > maxP) {
      after.push(id);
    } else if (index < minP) {
      above.push(id);
    } else {
      gaps.push(id);
    }
  }
  above.reverse();
  return gaps.concat(after, above);
}

function takeWaitingBatch(limit: number): number[] {
  const visible: number[] = [];
  const prefetch: number[] = [];
  const indexById = new Map<number, number>();
  waiting.forEach((id, index) => {
    indexById.set(id, index);
    if (visiblePriority.has(id)) {
      visible.push(id);
    } else {
      prefetch.push(id);
    }
  });
  const batch = visible
    .concat(orderPrefetchAroundVisible(prefetch, visible, indexById))
    .slice(0, limit);
  const taken = new Set(batch);
  let lastTakenIndex = -1;
  for (const id of batch) {
    const index = indexById.get(id);
    if (index != null && index > lastTakenIndex) {
      lastTakenIndex = index;
    }
  }
  const leftover: number[] = [];
  const wrapped: number[] = [];
  for (let index = 0; index < waiting.length; index++) {
    const id = waiting[index];
    if (taken.has(id)) continue;
    if (index > lastTakenIndex) {
      leftover.push(id);
    } else {
      wrapped.push(id);
    }
  }
  waiting.length = 0;
  waiting.push(...leftover, ...wrapped);
  for (const id of batch) {
    waitingSet.delete(id);
    visiblePriority.delete(id);
  }
  return batch;
}

function clearSettleTimer() {
  if (settleTimer != null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

function clearRateTimer() {
  if (rateTimer != null) {
    clearTimeout(rateTimer);
    rateTimer = null;
  }
}

function visibleWaitingCount() {
  let count = 0;
  for (const id of waiting) {
    if (visiblePriority.has(id)) {
      count += 1;
    }
  }
  return count;
}

function scheduleFlush() {
  if (waiting.length === 0) {
    clearSettleTimer();
    return;
  }
  if (requestInFlight) {
    clearSettleTimer();
    return;
  }
  if (visibleWaitingCount() >= INATURALIST_TAXA_MAX_IDS) {
    clearSettleTimer();
    flushWhenReady();
    return;
  }
  clearSettleTimer();
  settleTimer = setTimeout(() => {
    settleTimer = null;
    flushWhenReady();
  }, INATURALIST_TAXA_SETTLE_MS);
}

function flushWhenReady() {
  if (requestInFlight || waiting.length === 0) {
    return;
  }
  const wait = Math.max(0, nextAllowedAt - Date.now());
  if (wait > 0) {
    clearRateTimer();
    rateTimer = setTimeout(() => {
      rateTimer = null;
      nextAllowedAt = 0;
      void flushWaitingBatch();
    }, wait);
    return;
  }
  void flushWaitingBatch();
}

function parseRetryAfterMs(response: Response): number {
  const raw = response.headers?.get?.("Retry-After");
  if (!raw) {
    return INATURALIST_TAXA_MIN_INTERVAL_MS;
  }
  const seconds = parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return INATURALIST_TAXA_MIN_INTERVAL_MS;
}

async function flushWaitingBatch() {
  if (requestInFlight || waiting.length === 0) {
    return;
  }
  const batch = takeWaitingBatch(INATURALIST_TAXA_MAX_IDS);
  const wasFullBatch = batch.length >= INATURALIST_TAXA_MAX_IDS;
  if (batch.length === 0) {
    return;
  }
  requestInFlight = true;
  nextAllowedAt = Date.now() + INATURALIST_TAXA_MIN_INTERVAL_MS;
  for (const id of batch) {
    inFlightIds.add(id);
  }
  try {
    const response = await fetch(inaturalistTaxaUrl(batch), {
      headers: TAXA_ACCEPT,
    });
    if (response.status === 429) {
      nextAllowedAt = Date.now() + parseRetryAfterMs(response);
      for (const id of batch) {
        failedIds.add(id);
        inFlightIds.delete(id);
        notifyTaxonPhoto(id);
      }
    } else if (!response.ok) {
      for (const id of batch) {
        failedIds.add(id);
        inFlightIds.delete(id);
        notifyTaxonPhoto(id);
      }
    } else {
      const first = inaturalistTaxaFromUnknown(await response.json(), batch);
      const result = await mergeShowFallback(first.photos, first.empty);
      for (const id of batch) {
        const photo = result.photos.get(id) || null;
        photoCache.set(id, photo);
        failedIds.delete(id);
        inFlightIds.delete(id);
        notifyTaxonPhoto(id);
      }
    }
  } catch {
    for (const id of batch) {
      failedIds.add(id);
      inFlightIds.delete(id);
      notifyTaxonPhoto(id);
    }
  } finally {
    requestInFlight = false;
    if (wasFullBatch && waiting.length > 0) {
      const wait = Math.max(
        INATURALIST_TAXA_MIN_INTERVAL_MS,
        nextAllowedAt - Date.now()
      );
      clearRateTimer();
      rateTimer = setTimeout(() => {
        rateTimer = null;
        nextAllowedAt = 0;
        void flushWaitingBatch();
      }, wait);
    } else {
      scheduleFlush();
    }
  }
}

/**
 * Mounted thumbs call this. Cached and in-flight ids are no-ops.
 * `visible` ids go first in the next batch; `prefetch` fills up to 30
 * and drains later at the min interval. Errors retry only after a full unregister.
 */
export function registerInaturalistTaxonPhoto(
  id: number,
  priority: InaturalistTaxonPhotoPriority = "visible"
) {
  const prev = registerCount.get(id) || 0;
  registerCount.set(id, prev + 1);
  if (priority === "visible") {
    visiblePriority.add(id);
  }
  if (photoCache.has(id) || inFlightIds.has(id) || waitingSet.has(id)) {
    notifyTaxonPhoto(id);
    return;
  }
  if (failedIds.has(id) && prev > 0) {
    return;
  }
  if (failedIds.has(id) && prev === 0) {
    failedIds.delete(id);
  }
  if (enqueueWaiting(id)) {
    scheduleFlush();
  }
  notifyTaxonPhoto(id);
}

export function prioritizeInaturalistTaxonPhoto(
  id: number,
  priority: InaturalistTaxonPhotoPriority
) {
  if (priority === "visible") {
    visiblePriority.add(id);
  } else {
    visiblePriority.delete(id);
  }
}

/** Enqueue catalog taxon ids in list order so later batches can walk downward. */
export function prefetchInaturalistTaxonPhotos(ids: unknown) {
  for (const id of uniquePositiveInts(ids)) {
    registerInaturalistTaxonPhoto(id, "prefetch");
  }
}

export function unregisterInaturalistTaxonPhoto(id: number) {
  const prev = registerCount.get(id) || 0;
  if (prev <= 1) {
    registerCount.delete(id);
    visiblePriority.delete(id);
    removeWaiting(id);
    if (waiting.length === 0) {
      clearSettleTimer();
    }
    return;
  }
  registerCount.set(id, prev - 1);
}

export function primeInaturalistTaxonPhotoCache(payload: unknown) {
  const items: unknown[] = [];
  if (Array.isArray(payload)) {
    items.push(...payload);
  } else if (isRecord(payload) && Array.isArray(payload.results)) {
    items.push(...payload.results);
  } else if (isRecord(payload)) {
    items.push(payload);
  }
  for (const item of items) {
    if (!isRecord(item)) continue;
    const id = coercePositiveInt(item.id);
    if (id == null || photoCache.has(id)) continue;
    const picked = pickInaturalistTaxonPhoto(item);
    photoCache.set(id, picked);
    failedIds.delete(id);
    removeWaiting(id);
    notifyTaxonPhoto(id);
  }
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

export function useInaturalistTaxonPhoto(
  sourceId: unknown,
  active: boolean,
  priority: InaturalistTaxonPhotoPriority = "visible"
): InaturalistTaxonPhotoStatus {
  const id = coercePositiveInt(sourceId);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (id == null) return;
    const unsub = subscribeInaturalistTaxonPhoto(id, () => {
      setTick((tick) => tick + 1);
    });
    if (active) {
      registerInaturalistTaxonPhoto(id, priority);
    }
    return () => {
      unsub();
      if (active) {
        unregisterInaturalistTaxonPhoto(id);
      }
    };
    // Register once per id. Priority upgrades go through prioritize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id]);

  useEffect(() => {
    if (id == null || !active) return;
    prioritizeInaturalistTaxonPhoto(id, priority);
  }, [active, id, priority]);

  return inaturalistTaxonPhotoStatus(id);
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
