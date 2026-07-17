import { env } from "cloudflare:workers";
import { serialize } from "flatgeobuf/lib/mjs/geojson";
import { beforeAll, describe, expect, it } from "vitest";
import { handlePropertiesRequest } from "../src/propertiesBackend";
import { propertiesFixture } from "./fixtures/properties";

const key = `fixtures/${crypto.randomUUID()}.fgb`;

beforeAll(async () => {
  await env.TILES_BUCKET.put(key, serialize(propertiesFixture));
});

describe("properties backend", () => {
  it("returns property bags with byte metadata", async () => {
    const response = await request("");
    expect(response.status).toBe(200);
    const records = await response.json<Array<Record<string, unknown>>>();
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      name: "Alpha",
      category: "one",
      rank: 1,
    });
    expect(records[0].__offset).toEqual(expect.any(Number));
    expect(records[0].__byteLength).toEqual(expect.any(Number));
  });

  it("supports include, includeProperties, bbox, and trailing slash", async () => {
    const response = await request(
      "includeProperties=name&bbox=true",
      true,
    );
    const records = await response.json<Array<Record<string, unknown>>>();
    expect(records[0]).toHaveProperty("name", "Alpha");
    expect(records[0]).not.toHaveProperty("category");
    expect(records[0].__bbox).toEqual([-190, 0, -170, 10]);
  });

  it("filters using supported CQL2 JSON operators", async () => {
    const cql = JSON.stringify({
      and: [
        { op: ">=", args: [{ property: "rank" }, 2] },
        { op: "ilike", args: [{ property: "name" }, "b%"] },
      ],
    });
    const response = await request(`cql2JSONQuery=${encodeURIComponent(cql)}`);
    const records = await response.json<Array<Record<string, unknown>>>();
    expect(records.map((record) => record.name)).toEqual(["Beta"]);
  });

  it("returns deliberate errors for invalid input and missing datasets", async () => {
    const invalid = await request(
      `cql2JSONQuery=${encodeURIComponent(JSON.stringify({ op: "bogus", args: [] }))}`,
    );
    expect(invalid.status).toBe(400);

    const missing = await handlePropertiesRequest(
      new Request(
        "https://overlay.seasketch.org/properties?dataset=missing.fgb",
      ),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(missing.status).toBe(404);
  });
});

function request(query: string, trailingSlash = false) {
  const separator = query ? `&${query}` : "";
  return handlePropertiesRequest(
    new Request(
      `https://overlay.seasketch.org/properties${trailingSlash ? "/" : ""}?dataset=${encodeURIComponent(key)}${separator}`,
    ),
    { TILES_BUCKET: env.TILES_BUCKET } as Env,
  );
}
