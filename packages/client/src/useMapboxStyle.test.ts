import {
  MissingMapboxAccessTokenError,
  fetchGlStyle,
  hasMapboxAccessToken,
  isMissingMapboxAccessTokenError,
  mapLoadFailureKind,
  shouldAttemptMapboxStyleFallback,
  styleReferencesMapbox,
} from "./useMapboxStyle";

const originalToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  } else {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = originalToken;
  }
  global.fetch = originalFetch;
});

describe("isMissingMapboxAccessTokenError", () => {
  test("rejects null, undefined, and non-errors", () => {
    expect(isMissingMapboxAccessTokenError(null)).toBe(false);
    expect(isMissingMapboxAccessTokenError(undefined)).toBe(false);
    expect(isMissingMapboxAccessTokenError("Failed to fetch")).toBe(false);
    expect(isMissingMapboxAccessTokenError({ message: "no token" })).toBe(
      false
    );
  });

  test("accepts a missing token and Mapbox GL's own refusal", () => {
    expect(
      isMissingMapboxAccessTokenError(new MissingMapboxAccessTokenError())
    ).toBe(true);
    expect(
      isMissingMapboxAccessTokenError(
        new Error(
          "An API access token is required to use Mapbox GL. See https://docs.mapbox.com"
        )
      )
    ).toBe(true);
    expect(
      isMissingMapboxAccessTokenError(new TypeError("Failed to fetch"))
    ).toBe(false);
  });
});

describe("mapLoadFailureKind", () => {
  test("keeps a missing token distinct from a failed request", () => {
    expect(
      mapLoadFailureKind(new MissingMapboxAccessTokenError())
    ).toBe("missing-token");
    expect(mapLoadFailureKind(new TypeError("Failed to fetch"))).toBe(
      "unavailable"
    );
    expect(
      mapLoadFailureKind(new Error("Failed to initialize WebGL"))
    ).toBe("webgl");
    expect(mapLoadFailureKind(null)).toBe("unavailable");
  });
});

describe("shouldAttemptMapboxStyleFallback", () => {
  test("skips the hosted fallback when no token is configured", () => {
    delete process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    expect(hasMapboxAccessToken()).toBe(false);
    expect(
      shouldAttemptMapboxStyleFallback(new TypeError("Failed to fetch"))
    ).toBe(false);
    expect(
      shouldAttemptMapboxStyleFallback(new MissingMapboxAccessTokenError())
    ).toBe(false);
  });

  test("treats a blank token as missing", () => {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = "   ";
    expect(hasMapboxAccessToken()).toBe(false);
    expect(
      shouldAttemptMapboxStyleFallback(new TypeError("Failed to fetch"))
    ).toBe(false);
  });

  test("falls back after other failures when a token is set", () => {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = "pk.test";
    expect(
      shouldAttemptMapboxStyleFallback(new TypeError("Failed to fetch"))
    ).toBe(true);
    expect(
      shouldAttemptMapboxStyleFallback(new MissingMapboxAccessTokenError())
    ).toBe(false);
  });
});

describe("styleReferencesMapbox", () => {
  test("detects hosted glyphs, sprites, and sources", () => {
    expect(styleReferencesMapbox({ sources: {} })).toBe(false);
    expect(
      styleReferencesMapbox({
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {
          raster: { tiles: ["https://example.com/{z}/{x}/{y}.png"] },
        },
      })
    ).toBe(true);
    expect(
      styleReferencesMapbox({
        sources: {
          composite: { url: "mapbox://mapbox.mapbox-streets-v8" },
        },
      })
    ).toBe(true);
    expect(
      styleReferencesMapbox({
        sources: {
          raster: { tiles: ["https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp"] },
        },
      })
    ).toBe(true);
    expect(styleReferencesMapbox({ sources: null })).toBe(false);
    expect(styleReferencesMapbox({})).toBe(false);
  });
});

describe("fetchGlStyle", () => {
  test("does not request a mapbox style when the token is missing", async () => {
    delete process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await expect(
      fetchGlStyle("mapbox://styles/mapbox/missing-token-style")
    ).rejects.toBeInstanceOf(MissingMapboxAccessTokenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not request a mapbox style when the token is blank", async () => {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = "  ";
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await expect(
      fetchGlStyle("mapbox://styles/mapbox/blank-token-style")
    ).rejects.toBeInstanceOf(MissingMapboxAccessTokenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("requests a mapbox style with the token when one is set", async () => {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = "pk.test";
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ version: 8, sources: {} }),
    });
    global.fetch = fetchMock;
    const style = await fetchGlStyle("mapbox://styles/example/token-style");
    expect(style.version).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested).toContain(
      "https://api.mapbox.com/styles/v1/example/token-style"
    );
    expect(requested).toContain("access_token=pk.test");
    expect(requested).toContain("ssn-tr=true");
  });

  test("still fetches a non-mapbox style when the token is missing", async () => {
    delete process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ version: 8, sources: {} }),
    });
    global.fetch = fetchMock;
    const style = await fetchGlStyle(
      "https://example.com/styles/no-token.json"
    );
    expect(style.version).toBe(8);
    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested).toContain("https://example.com/styles/no-token.json");
    expect(requested).not.toContain("access_token");
  });

  test("rejects a Mapbox response that is not a style", async () => {
    process.env.REACT_APP_MAPBOX_ACCESS_TOKEN = "pk.test";
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ message: "Not Authorized - Invalid Token" }),
    });
    await expect(
      fetchGlStyle("mapbox://styles/example/not-a-style")
    ).rejects.toThrow("does not appear to be a Mapbox GL Style");
  });
});
