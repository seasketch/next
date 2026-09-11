import { describe, expect, it } from "vitest";
import {
  TAXONOMY_CACHE_TTL_SECONDS,
  handleTaxonomyRequest,
  taxonomyUpstream,
} from "../src/taxonomyBackend";

describe("taxonomyUpstream", () => {
  it("allowlists WoRMS record and match-names, rejects everything else", () => {
    expect(
      taxonomyUpstream("/taxonomy/worms/AphiaRecordByAphiaID/1702292", "GET")
        ?.url
    ).toBe(
      "https://www.marinespecies.org/rest/AphiaRecordByAphiaID/1702292"
    );
    expect(
      taxonomyUpstream("/taxonomy/worms/AphiaRecordsByMatchNames", "POST")
        ?.method
    ).toBe("POST");
    expect(taxonomyUpstream("/taxonomy/inat/v1/taxa", "GET")).toBeNull();
    expect(taxonomyUpstream("/taxonomy/inat/thumbs", "GET")).toBeNull();
    expect(
      taxonomyUpstream("/taxonomy/worms/AphiaRecordByAphiaID/1702292", "POST")
    ).toBeNull();
    expect(taxonomyUpstream("/taxonomy/https://evil.example", "GET")).toBeNull();
  });
});

describe("handleTaxonomyRequest", () => {
  it("caches a successful GET for one hour", async () => {
    let fetches = 0;
    const store = new Map<string, Response>();
    const cache = {
      match: async (request: Request) => store.get(new URL(request.url).href),
      put: async (request: Request, response: Response) => {
        store.set(new URL(request.url).href, response);
      },
    } as unknown as Cache;

    const fetchImpl: typeof fetch = async () => {
      fetches += 1;
      return new Response(JSON.stringify({ results: [{ id: 1 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request(
      "https://uploads.seasketch.org/taxonomy/worms/AphiaRecordByAphiaID/1702292"
    );
    const first = await handleTaxonomyRequest(req, {
      fetch: fetchImpl,
      cache,
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Taxonomy-Cache")).toBe("miss");
    expect(first.headers.get("Cache-Control")).toBe(
      `public, max-age=${TAXONOMY_CACHE_TTL_SECONDS}`
    );
    expect(TAXONOMY_CACHE_TTL_SECONDS).toBe(3600);

    const second = await handleTaxonomyRequest(req.clone(), {
      fetch: fetchImpl,
      cache,
    });
    expect(second.headers.get("X-Taxonomy-Cache")).toBe("hit");
    expect(fetches).toBe(1);
  });

  it("returns 404 for a path that is not allowlisted", async () => {
    const res = await handleTaxonomyRequest(
      new Request("https://uploads.seasketch.org/taxonomy/open-proxy?url=https://evil")
    );
    expect(res.status).toBe(404);
  });
});
