import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  INATURALIST_TAXA_MAX_IDS,
  INATURALIST_TAXA_ORIGIN,
  INATURALIST_TAXA_PATH,
  clearInaturalistTaxonPhotoCache,
  fetchInaturalistTaxonPhotos,
  compactInaturalistAttribution,
  inaturalistAttributionParts,
  inaturalistLicenseUrl,
  inaturalistTaxaFromUnknown,
  inaturalistTaxaUrl,
  inaturalistTaxonPhotoStatus,
  pickInaturalistTaxonPhoto,
  uniquePositiveInts,
  uniqueSortedPositiveInts,
} from "./inaturalistTaxonPhotos";

afterEach(() => {
  clearInaturalistTaxonPhotoCache();
  jest.restoreAllMocks();
});

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
  it("sorts ids onto the public iNaturalist taxa route", () => {
    expect(inaturalistTaxaUrl([3, 1, 1])).toBe(
      `${INATURALIST_TAXA_ORIGIN}${INATURALIST_TAXA_PATH}/1,3`
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
      attribution: "(c) Thomas Menut, some rights reserved (CC BY-NC)",
      licenseCode: "cc-by-nc",
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
            attribution: "(c) someone",
            licenseCode: "cc-by-nc",
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
    ).toBe("(c) Sara Thiebaud, some rights reserved (CC BY-NC)");
    expect(
      compactInaturalistAttribution(
        "(c) Ken-ichi Ueda, some rights reserved (CC BY-NC), uploaded by someone else"
      )
    ).toBe(
      "(c) Ken-ichi Ueda, some rights reserved (CC BY-NC), uploaded by someone else"
    );
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
    expect(
      inaturalistAttributionParts(
        "(c) Sara Thiebaud, some rights reserved (CC BY-NC)",
        "cc-by-nc"
      )
    ).toEqual({
      text: "(c) Sara Thiebaud, some rights reserved",
      licenseLabel: "(CC BY-NC)",
      licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
    });
  });
});

describe("fetchInaturalistTaxonPhotos", () => {
  it("asks iNaturalist for sorted 30-id batches and memoizes by taxon id", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const path = String(input).split("/").pop()!;
      const ids = path.split(",").map(Number);
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
    attribution: "(c) someone",
    licenseCode: "cc-by-nc",
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
