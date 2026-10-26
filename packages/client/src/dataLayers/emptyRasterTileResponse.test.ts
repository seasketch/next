import { describe, expect, it } from "@jest/globals";
import {
  emptyImageTileMissStatus,
  imageTileExtension,
  installEmptyRasterTileResponseGuard,
} from "./emptyRasterTileResponse";

describe("empty image tile responses", () => {
  it("reads the extension before the query string", () => {
    expect(
      imageTileExtension("https://tiles.example/1/2/3.png?ssn-tr=true")
    ).toBe("png");
    expect(imageTileExtension("https://tiles.example/1/2/3.PBF")).toBe("pbf");
    expect(imageTileExtension("https://tiles.example/1/2/3")).toBeUndefined();
  });

  it("turns an empty image tile into a missing tile", () => {
    expect(
      emptyImageTileMissStatus({
        status: 204,
        url: "https://tiles.example/a/1/2/3.png",
      })
    ).toBe(404);
    expect(
      emptyImageTileMissStatus({
        status: 204,
        url: "https://tiles.example/a/1/2/3.JPEG?x=1",
      })
    ).toBe(404);
  });

  it("leaves vector 204s, API 204s, and real image responses alone", () => {
    expect(
      emptyImageTileMissStatus({
        status: 204,
        url: "https://tiles.example/a/1/2/3.pbf",
      })
    ).toBeUndefined();
    expect(
      emptyImageTileMissStatus({
        status: 204,
        url: "https://api.example/graphql",
      })
    ).toBeUndefined();
    expect(
      emptyImageTileMissStatus({
        status: 200,
        url: "https://tiles.example/a/1/2/3.png",
      })
    ).toBeUndefined();
    expect(
      emptyImageTileMissStatus({
        status: 500,
        url: "https://tiles.example/a/1/2/3.png",
      })
    ).toBeUndefined();
  });

  it("rewrites only empty image tiles on the fetch wrapper", async () => {
    const seen: Array<string | undefined> = [];
    const scope: {
      fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<{
        status: number;
        url: string;
      }>;
    } = {
      fetch: async (input) => {
        const url = typeof input === "string" ? input : input.toString();
        seen.push(url);
        const status = url.indexOf("miss") === -1 ? 200 : 204;
        return { status, url };
      },
    };

    installEmptyRasterTileResponseGuard(scope);
    installEmptyRasterTileResponseGuard(scope);

    const hit = await scope.fetch!("https://tiles.example/hit.png");
    const miss = await scope.fetch!("https://tiles.example/miss.png");
    const vector = await scope.fetch!("https://tiles.example/miss.pbf");

    expect(hit).toMatchObject({ status: 200 });
    expect(miss.status).toBe(404);
    expect(vector).toMatchObject({ status: 204 });
    expect(seen).toEqual([
      "https://tiles.example/hit.png",
      "https://tiles.example/miss.png",
      "https://tiles.example/miss.pbf",
    ]);
  });

  it("propagates network failures from the original fetch", async () => {
    const scope: {
      fetch?: () => Promise<{ status: number; url: string }>;
    } = {
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    };
    installEmptyRasterTileResponseGuard(scope);
    await expect(scope.fetch!()).rejects.toThrow("Failed to fetch");
  });
});
