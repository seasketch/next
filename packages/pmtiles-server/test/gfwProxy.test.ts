import { describe, expect, it } from "vitest";
import {
  GFW_API_ORIGIN,
  GFW_COVERAGE_START,
  gfwUpstream,
} from "../src/gfwProxy";

const NOW = new Date("2026-11-06T18:00:00.000Z");

describe("gfwUpstream", () => {
  it("pins annual fishing-effort tiles and drops the map token from the cache key", () => {
    const upstream = gfwUpstream(
      new URL(
        "https://tiles.seasketch.org/gfw/tile/4/2/9.mvt?dataset=public-global-fishing-effort&version=v5.0&interval=YEAR&access_token=secret&ns=dev"
      ),
      NOW
    );
    expect(upstream?.url).toBe(
      `${GFW_API_ORIGIN}/v3/4wings/tile/heatmap/4/2/9?datasets=public-global-fishing-effort%3Av5.0&interval=YEAR&temporal-aggregation=false&date-range=${GFW_COVERAGE_START}%2C2026-11-06&format=MVT`
    );
    expect(upstream?.cacheKey).toBe(upstream?.url);
    expect(upstream?.cacheKey.includes("secret")).toBe(false);
    expect(upstream?.cacheTtlSeconds).toBe(6 * 60 * 60);
  });

  it("defaults the dataset when the tile URL has no query", () => {
    const upstream = gfwUpstream(
      new URL("https://tiles.seasketch.org/gfw/tile/0/0/0.mvt"),
      NOW
    );
    expect(upstream?.url.startsWith(`${GFW_API_ORIGIN}/v3/4wings/tile/heatmap/0/0/0?`)).toBe(
      true
    );
  });

  it("rejects other datasets, intervals, zooms, and paths", () => {
    expect(
      gfwUpstream(
        new URL(
          "https://tiles.seasketch.org/gfw/tile/4/2/9.mvt?dataset=public-global-sar-presence&version=v5.0"
        ),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL(
          "https://tiles.seasketch.org/gfw/tile/4/2/9.mvt?version=latest"
        ),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL(
          "https://tiles.seasketch.org/gfw/tile/4/2/9.mvt?interval=MONTH"
        ),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL("https://tiles.seasketch.org/gfw/tile/13/0/0.mvt"),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL("https://tiles.seasketch.org/gfw/tile/2/8/0.mvt"),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL("https://gateway.api.globalfishingwatch.org/v3/4wings/report"),
        NOW
      )
    ).toBeNull();
    expect(
      gfwUpstream(
        new URL("https://tiles.seasketch.org/gfw/tile/1/0/0.mvt?format=JSON"),
        NOW
      )
    ).toBeNull();
  });

  it("proxies zoom-0 bins for the same pinned dataset", () => {
    const upstream = gfwUpstream(
      new URL(
        "https://tiles.seasketch.org/gfw/bins?dataset=public-global-fishing-effort&version=v5.0&access_token=secret"
      ),
      NOW
    );
    expect(upstream?.url).toBe(
      `${GFW_API_ORIGIN}/v3/4wings/bins/0?datasets=public-global-fishing-effort%3Av5.0&interval=YEAR`
    );
    expect(upstream?.cacheKey.includes("secret")).toBe(false);
    expect(upstream?.cacheTtlSeconds).toBe(24 * 60 * 60);
  });
});
