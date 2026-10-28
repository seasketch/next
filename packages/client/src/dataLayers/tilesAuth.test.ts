import { describe, expect, it } from "@jest/globals";
import { hostedStyleUrl, withHostedAuthParams } from "./tilesAuth";

const PUBLIC_UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRIVATE_UUID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TOKEN = "map-token";

const publicUrl = `https://tiles.seasketch.org/projects/demo/public/${PUBLIC_UUID}.json`;
const privateUrl = `https://tiles.seasketch.org/projects/demo/public/${PRIVATE_UUID}.json`;

describe("hostedStyleUrl", () => {
  const requiring = new Set([PRIVATE_UUID]);

  it("adds the token only for UUIDs the auth list marks private", () => {
    expect(hostedStyleUrl(privateUrl, TOKEN, requiring)).toBe(
      withHostedAuthParams(privateUrl, { accessToken: TOKEN })
    );
    expect(hostedStyleUrl(publicUrl, TOKEN, requiring)).toBe(publicUrl);
  });

  it("leaves every URL bare until the auth list and token both exist", () => {
    expect(hostedStyleUrl(privateUrl, TOKEN, null)).toBe(privateUrl);
    expect(hostedStyleUrl(privateUrl, null, requiring)).toBe(privateUrl);
  });

  it("does not rewrite non-hosted URLs", () => {
    const mapbox = "mapbox://styles/underbluewaters/example";
    expect(hostedStyleUrl(mapbox, TOKEN, requiring)).toBe(mapbox);
  });
});
