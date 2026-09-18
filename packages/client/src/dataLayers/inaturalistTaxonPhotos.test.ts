import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  INATURALIST_TAXA_MAX_IDS,
  INATURALIST_TAXA_MIN_INTERVAL_MS,
  INATURALIST_TAXA_ORIGIN,
  INATURALIST_TAXA_PATH,
  INATURALIST_TAXA_SETTLE_MS,
  clearInaturalistTaxonPhotoCache,
  fetchInaturalistTaxonPhotos,
  compactInaturalistAttribution,
  creativeCommonsIconKeys,
  inaturalistAttributionParts,
  inaturalistLicenseUrl,
  inaturalistPhotoPageUrl,
  inaturalistTaxaFromUnknown,
  inaturalistTaxaShowUrl,
  inaturalistTaxaUrl,
  inaturalistTaxonPhotoStatus,
  pickInaturalistTaxonPhoto,
  prefetchInaturalistTaxonPhotos,
  primeInaturalistTaxonPhotoCache,
  prioritizeInaturalistTaxonPhoto,
  registerInaturalistTaxonPhoto,
  unregisterInaturalistTaxonPhoto,
  uniquePositiveInts,
  uniqueSortedPositiveInts,
} from "./inaturalistTaxonPhotos";

afterEach(() => {
  clearInaturalistTaxonPhotoCache();
  jest.restoreAllMocks();
});

function idsFromTaxaRequest(input: RequestInfo | URL): number[] {
  const url = new URL(String(input));
  const fromQuery = url.searchParams.get("id");
  if (fromQuery) {
    return fromQuery.split(",").map(Number);
  }
  const path = url.pathname.split("/").pop() || "";
  return path.split(",").map(Number).filter((id) => Number.isFinite(id) && id > 0);
}

describe("uniquePositiveInts", () => {
  it("rejects null, undefined, and non-arrays", () => {
    expect(uniquePositiveInts(null)).toEqual([]);
    expect(uniquePositiveInts(undefined)).toEqual([]);
    expect(uniquePositiveInts(42)).toEqual([]);
    expect(uniquePositiveInts("1")).toEqual([]);
  });

  it("dedupes and drops non-positive ids", () => {
    expect(uniquePositiveInts([1, 1, 0, -3, 2.5, 2, "3"])).toEqual([1, 2, 3]);
    expect(uniqueSortedPositiveInts([3, 1, 2, 1])).toEqual([1, 2, 3]);
  });
});

describe("inaturalistTaxaUrl", () => {
  it("sorts ids onto the taxa search route, not the show route", () => {
    expect(inaturalistTaxaUrl([3, 1, 1])).toBe(
      `${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}?id=1%2C3&per_page=${INATURALIST_TAXA_MAX_IDS}`
    );
  });

  it("builds the show route for licensed-photo fallback", () => {
    expect(inaturalistTaxaShowUrl([108547, 1])).toBe(
      `${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}/1,108547`
    );
  });
});

describe("inaturalistTaxaFromUnknown", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(pickInaturalistTaxonPhoto(null)).toBeNull();
    expect(inaturalistTaxaFromUnknown(null, [1])).toEqual({
      photos: new Map(),
      empty: [1],
    });
    expect(inaturalistTaxaFromUnknown(undefined, [1])).toEqual({
      photos: new Map(),
      empty: [1],
    });
    expect(inaturalistTaxaFromUnknown(12, [1])).toEqual({
      photos: new Map(),
      empty: [1],
    });
  });

  it("skips all-rights-reserved defaults and uses a licensed taxon photo", () => {
    expect(
      pickInaturalistTaxonPhoto({
        id: 64481,
        default_photo: {
          license_code: null,
          square_url: "https://static.inaturalist.org/photos/1/square.jpg",
        },
        taxon_photos: [
          {
            photo: {
              license_code: "cc-by-nc",
              medium_url: "https://example.com/ok/medium.jpg",
              attribution:
                "(c) Thomas Menut, some rights reserved (CC BY-NC), uploaded by Thomas Menut",
            },
          },
        ],
      })
    ).toEqual({
      taxonId: 64481,
      squareUrl: "https://example.com/ok/medium.jpg",
      smallUrl: "https://example.com/ok/medium.jpg",
      mediumUrl: "https://example.com/ok/medium.jpg",
      attribution: "Thomas Menut",
      licenseCode: "cc-by-nc",
      photoId: null,
    });
  });

  it("treats requested ids without a licensed photo as empty", () => {
    expect(
      inaturalistTaxaFromUnknown(
        {
          results: [
            {
              id: 64481,
              default_photo: {
                license_code: "cc-by-nc",
                medium_url: "https://example.com/ok/medium.jpg",
                attribution: "(c) someone",
              },
            },
            {
              id: 2,
              default_photo: { license_code: null },
            },
          ],
        },
        [64481, 2]
      )
    ).toEqual({
      photos: new Map([
        [
          64481,
          {
            taxonId: 64481,
            squareUrl: "https://example.com/ok/medium.jpg",
            smallUrl: "https://example.com/ok/medium.jpg",
            mediumUrl: "https://example.com/ok/medium.jpg",
            attribution: "someone",
            licenseCode: "cc-by-nc",
            photoId: null,
          },
        ],
      ]),
      empty: [2],
    });
  });

  it("drops a redundant uploaded-by clause", () => {
    expect(
      compactInaturalistAttribution(
        "(c) Sara Thiebaud, some rights reserved (CC BY-NC), uploaded by Sara Thiebaud"
      )
    ).toBe("Sara Thiebaud");
    expect(
      compactInaturalistAttribution(
        "(c) Ken-ichi Ueda, some rights reserved (CC BY-NC), uploaded by someone else"
      )
    ).toBe("Ken-ichi Ueda, uploaded by someone else");
    expect(
      compactInaturalistAttribution(
        "(c) Jennifer Lentz, Ph.D., some rights reserved (CC BY-NC), uploaded by Jennifer Lentz, Ph.D."
      )
    ).toBe("Jennifer Lentz, Ph.D.");
    expect(compactInaturalistAttribution(null)).toBe("");
  });

  it("maps license codes to Creative Commons deeds", () => {
    expect(inaturalistLicenseUrl("cc-by-nc")).toBe(
      "https://creativecommons.org/licenses/by-nc/4.0/"
    );
    expect(inaturalistLicenseUrl("CC_BY_NC_4.0")).toBe(
      "https://creativecommons.org/licenses/by-nc/4.0/"
    );
    expect(inaturalistLicenseUrl("cc0")).toBe(
      "https://creativecommons.org/publicdomain/zero/1.0/"
    );
    expect(inaturalistLicenseUrl("all-rights-reserved")).toBeNull();
    expect(creativeCommonsIconKeys("cc-by-nc")).toEqual(["cc", "by", "nc"]);
    expect(creativeCommonsIconKeys("cc0")).toEqual(["cc", "zero"]);
    expect(creativeCommonsIconKeys("pd")).toEqual(["pdm"]);
    expect(creativeCommonsIconKeys("all-rights-reserved")).toEqual([]);
    expect(
      inaturalistAttributionParts(
        "(c) Sara Thiebaud, some rights reserved (CC BY-NC)",
        "cc-by-nc"
      )
    ).toEqual({
      text: "Sara Thiebaud",
      photographerUrl: null,
      licenseLabel: "CC BY-NC",
      licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
      rightsKind: "copyrighted",
    });
    expect(
      inaturalistAttributionParts(
        "(c) Jacob, no rights reserved (CC0)",
        "cc0"
      )
    ).toEqual({
      text: "Jacob",
      photographerUrl: null,
      licenseLabel: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      rightsKind: "cc0",
    });
    expect(
      inaturalistAttributionParts(
        "Chad King (SIMoN / MBNMS), no known copyright restrictions (public domain)",
        "pd"
      )
    ).toEqual({
      text: "Chad King (SIMoN / MBNMS)",
      photographerUrl: null,
      licenseLabel: "Public Domain Mark",
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      rightsKind: "public-domain",
    });
    expect(inaturalistPhotoPageUrl(56166638)).toBe(
      "https://www.inaturalist.org/photos/56166638"
    );
    expect(
      inaturalistAttributionParts("© Stefanie", "cc-by-nc", 56166638)
    ).toEqual({
      text: "Stefanie",
      photographerUrl: "https://www.inaturalist.org/photos/56166638",
      licenseLabel: "CC BY-NC",
      licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
      rightsKind: "copyrighted",
    });
  });
});

describe("fetchInaturalistTaxonPhotos", () => {
  it("asks iNaturalist for sorted 30-id batches and memoizes by taxon id", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const ids = idsFromTaxaRequest(input);
      return {
        ok: true,
        json: async () => ({
          results: ids.map((id) => ({
            id,
            default_photo: {
              license_code: "cc-by",
              medium_url: `https://example.com/${id}.jpg`,
              attribution: "someone",
            },
          })),
        }),
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const first = Array.from({ length: INATURALIST_TAXA_MAX_IDS + 2 }, (_, i) => i + 1);
    const photos = await fetchInaturalistTaxonPhotos(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(photos.size).toBe(first.length);
    expect(String(fetchMock.mock.calls[0][0])).toContain(INATURALIST_TAXA_PATH);
    expect(String(fetchMock.mock.calls[0][0])).toContain(INATURALIST_TAXA_ORIGIN);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("uploads.seasketch.org");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("preferred_place_id");

    await fetchInaturalistTaxonPhotos([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the show route when search default_photo is unlicensed", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const isShow = !url.includes("?id=");
      return {
        ok: true,
        json: async () =>
          isShow
            ? {
                results: [
                  {
                    id: 108547,
                    default_photo: { license_code: null },
                    taxon_photos: [
                      {
                        photo: {
                          license_code: "cc-by-nc",
                          square_url: "https://example.com/kelp-sq.jpg",
                          medium_url: "https://example.com/kelp.jpg",
                          attribution: "(c) Kai, some rights reserved (CC BY-NC)",
                        },
                      },
                    ],
                  },
                ],
              }
            : {
                results: [
                  {
                    id: 108547,
                    default_photo: {
                      license_code: null,
                      square_url: "https://example.com/arr.jpg",
                    },
                  },
                ],
              },
      } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const photos = await fetchInaturalistTaxonPhotos([108547]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("?id=");
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/108547$/);
    expect(photos.get(108547)?.mediumUrl).toBe("https://example.com/kelp.jpg");
  });

  it("follows an inactive taxon to the accepted synonym when show has no licensed photo", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("?id=53699") || url.endsWith("/53699")) {
        return {
          ok: true,
          json: async () => ({
            results: url.includes("?id=")
              ? []
              : [
                  {
                    id: 53699,
                    is_active: false,
                    current_synonymous_taxon_ids: [1439813],
                    default_photo: { license_code: null },
                  },
                ],
          }),
        } as Response;
      }
      if (url.includes("1439813")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: 1439813,
                is_active: true,
                default_photo: {
                  license_code: "cc-by-nc",
                  square_url: "https://example.com/sheephead-sq.jpg",
                  medium_url: "https://example.com/sheephead.jpg",
                  attribution: "(c) someone, some rights reserved (CC BY-NC)",
                },
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ results: [] }) } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const photos = await fetchInaturalistTaxonPhotos([53699]);
    expect(photos.get(53699)?.mediumUrl).toBe(
      "https://example.com/sheephead.jpg"
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("?id=53699");
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/53699$/);
    expect(String(fetchMock.mock.calls[2][0])).toContain("1439813");
  });

  it("does not return ids without a licensed photo", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              id: 1439813,
              default_photo: {
                license_code: "cc-by",
                medium_url: "https://example.com/ok.jpg",
                attribution: "someone",
              },
            },
            { id: 2, default_photo: { license_code: null } },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    const photos = await fetchInaturalistTaxonPhotos([1439813, 2]);
    expect(photos.has(1439813)).toBe(true);
    expect(photos.has(2)).toBe(false);
  });

  it("marks remaining ids as failed after one 429 and does not request again", async () => {
    const fetchMock = jest.fn(async () => {
      return { ok: false, status: 429 } as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    const updates: Array<{ failed: number[]; pending: number[] }> = [];
    await fetchInaturalistTaxonPhotos([1, 2, 3], (progress) => {
      updates.push({
        failed: [...progress.failed],
        pending: [...progress.pending],
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates[updates.length - 1]).toEqual({
      failed: [1, 2, 3],
      pending: [],
    });
  });
});

describe("inaturalistTaxonPhotoStatus", () => {
  const photo = {
    taxonId: 64481,
    squareUrl: "https://example.com/ok.jpg",
    smallUrl: "https://example.com/ok.jpg",
    mediumUrl: "https://example.com/ok.jpg",
    attribution: "(c) someone",
    licenseCode: "cc-by-nc",
    photoId: 12,
  };

  it("is empty without a taxon id and loading until resolved", () => {
    const lookup = {
      photos: new Map(),
      empty: new Set<number>(),
      pending: new Set([64481]),
      failed: new Set<number>(),
    };
    expect(inaturalistTaxonPhotoStatus(null, lookup)).toEqual({
      status: "empty",
    });
    expect(inaturalistTaxonPhotoStatus(64481, lookup)).toEqual({
      status: "loading",
    });
  });

  it("distinguishes ready, empty, and error", () => {
    expect(
      inaturalistTaxonPhotoStatus(64481, {
        photos: new Map([[64481, photo]]),
        empty: new Set(),
        pending: new Set(),
        failed: new Set(),
      })
    ).toEqual({ status: "ready", photo });
    expect(
      inaturalistTaxonPhotoStatus(64481, {
        photos: new Map(),
        empty: new Set([64481]),
        pending: new Set(),
        failed: new Set(),
      })
    ).toEqual({ status: "empty" });
    expect(
      inaturalistTaxonPhotoStatus(64481, {
        photos: new Map(),
        empty: new Set(),
        pending: new Set(),
        failed: new Set([64481]),
      })
    ).toEqual({ status: "error" });
  });
});

function mockTaxaFetch() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const ids = idsFromTaxaRequest(input);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        results: ids.map((id) => ({
          id,
          default_photo: {
            license_code: "cc-by",
            square_url: `https://example.com/${id}-sq.jpg`,
            medium_url: `https://example.com/${id}.jpg`,
            attribution: "someone",
          },
        })),
      }),
    } as unknown as Response;
  });
  global.fetch = fetchMock as typeof fetch;
  return fetchMock;
}

function requestedIds(
  fetchMock: ReturnType<typeof mockTaxaFetch>,
  call: number
): number[] {
  return idsFromTaxaRequest(fetchMock.mock.calls[call][0]);
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function advance(ms: number) {
  jest.advanceTimersByTime(ms);
  await flush();
}

describe("registerInaturalistTaxonPhoto scheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("holds 12 ids until settle, then one request", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= 12; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1)
    );
  });

  it("resets settle when more ids register, then fetches the combined set", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= 5; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await advance(INATURALIST_TAXA_SETTLE_MS / 2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    for (let id = 6; id <= 8; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await advance(INATURALIST_TAXA_SETTLE_MS / 2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await advance(INATURALIST_TAXA_SETTLE_MS / 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toEqual(
      Array.from({ length: 8 }, (_, i) => i + 1)
    );
  });

  it("flushes immediately at 30 ids without waiting to settle", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= INATURALIST_TAXA_MAX_IDS; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toHaveLength(INATURALIST_TAXA_MAX_IDS);
  });

  it("sends leftover ids only after the min-interval gap", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= INATURALIST_TAXA_MAX_IDS + 10; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toHaveLength(INATURALIST_TAXA_MAX_IDS);
    await advance(INATURALIST_TAXA_MIN_INTERVAL_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedIds(fetchMock, 1)).toEqual(
      Array.from({ length: 10 }, (_, i) => INATURALIST_TAXA_MAX_IDS + 1 + i)
    );
  });

  it("does not refetch cached ids on re-register", async () => {
    const fetchMock = mockTaxaFetch();
    registerInaturalistTaxonPhoto(7);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unregisterInaturalistTaxonPhoto(7);
    registerInaturalistTaxonPhoto(7);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inaturalistTaxonPhotoStatus(7)).toEqual({
      status: "ready",
      photo: expect.objectContaining({ taxonId: 7 }),
    });
  });

  it("continues remaining ids after a 429", async () => {
    let calls = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "1" },
          json: async () => ({}),
        } as unknown as Response;
      }
      const ids = idsFromTaxaRequest(input);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          results: ids.map((id) => ({
            id,
            default_photo: {
              license_code: "cc-by",
              medium_url: `https://example.com/${id}.jpg`,
              attribution: "someone",
            },
          })),
        }),
      } as unknown as Response;
    });
    global.fetch = fetchMock as typeof fetch;

    for (let id = 1; id <= INATURALIST_TAXA_MAX_IDS + 2; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inaturalistTaxonPhotoStatus(1)).toEqual({ status: "error" });
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedIds(fetchMock, 1)).toEqual([
      INATURALIST_TAXA_MAX_IDS + 1,
      INATURALIST_TAXA_MAX_IDS + 2,
    ]);
  });

  it("treats a licensed miss as empty, not error", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          results: [{ id: 9, default_photo: { license_code: null } }],
        }),
      } as unknown as Response;
    }) as typeof fetch;
    registerInaturalistTaxonPhoto(9);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(inaturalistTaxonPhotoStatus(9)).toEqual({ status: "empty" });
  });

  it("marks a failed HTTP batch as error and still drains later ids", async () => {
    let calls = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 500,
          headers: { get: () => null },
          json: async () => ({}),
        } as unknown as Response;
      }
      const ids = idsFromTaxaRequest(input);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          results: ids.map((id) => ({
            id,
            default_photo: {
              license_code: "cc-by",
              medium_url: `https://example.com/${id}.jpg`,
            },
          })),
        }),
      } as unknown as Response;
    });
    global.fetch = fetchMock as typeof fetch;
    for (let id = 1; id <= INATURALIST_TAXA_MAX_IDS + 1; id++) {
      registerInaturalistTaxonPhoto(id);
    }
    await flush();
    expect(inaturalistTaxonPhotoStatus(1)).toEqual({ status: "error" });
    await advance(INATURALIST_TAXA_MIN_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(inaturalistTaxonPhotoStatus(INATURALIST_TAXA_MAX_IDS + 1).status).toBe(
      "ready"
    );
  });

  it("puts visible ids first and pads the batch with prefetch", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= 8; id++) {
      registerInaturalistTaxonPhoto(id, "visible");
    }
    for (let id = 9; id <= 33; id++) {
      registerInaturalistTaxonPhoto(id, "prefetch");
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toEqual(
      Array.from({ length: INATURALIST_TAXA_MAX_IDS }, (_, i) => i + 1)
    );
    await advance(INATURALIST_TAXA_MIN_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedIds(fetchMock, 1)).toEqual([31, 32, 33]);
  });

  it("fills and then continues downward from a mid-list visible range", async () => {
    const fetchMock = mockTaxaFetch();
    prefetchInaturalistTaxonPhotos(
      Array.from({ length: 70 }, (_, i) => i + 1)
    );
    for (let id = 20; id <= 25; id++) {
      prioritizeInaturalistTaxonPhoto(id, "visible");
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(requestedIds(fetchMock, 0)).toEqual(
      Array.from({ length: INATURALIST_TAXA_MAX_IDS }, (_, i) => i + 20)
    );
    await advance(INATURALIST_TAXA_MIN_INTERVAL_MS);
    expect(requestedIds(fetchMock, 1)).toEqual([
      ...Array.from({ length: 9 }, (_, i) => i + 1),
      ...Array.from({ length: 21 }, (_, i) => i + 50),
    ]);
  });

  it("holds a prefetch-only overflow until settle, then drains at the min interval", async () => {
    const fetchMock = mockTaxaFetch();
    for (let id = 1; id <= INATURALIST_TAXA_MAX_IDS + 10; id++) {
      registerInaturalistTaxonPhoto(id, "prefetch");
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await advance(INATURALIST_TAXA_SETTLE_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedIds(fetchMock, 0)).toHaveLength(INATURALIST_TAXA_MAX_IDS);
    await advance(INATURALIST_TAXA_MIN_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedIds(fetchMock, 1)).toEqual(
      Array.from({ length: 10 }, (_, i) => INATURALIST_TAXA_MAX_IDS + 1 + i)
    );
  });

  it("primes licensed autocomplete payloads without fetching", () => {
    const fetchMock = mockTaxaFetch();
    primeInaturalistTaxonPhotoCache({
      results: [
        {
          id: 44,
          default_photo: {
            license_code: "cc-by",
            square_url: "https://example.com/44.jpg",
            attribution: "x",
          },
        },
      ],
    });
    registerInaturalistTaxonPhoto(44);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(inaturalistTaxonPhotoStatus(44).status).toBe("ready");
  });
});
