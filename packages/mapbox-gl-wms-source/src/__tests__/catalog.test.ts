import { describe, expect, it, vi } from "vitest";
import { fetchCapabilities, validateCORS } from "../catalog";

function makeResponse(
  body: string,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    text: async () => body,
  } as unknown as Response;
}

describe("validateCORS", () => {
  it("returns ok when the request resolves successfully", async () => {
    const fetchFn = vi.fn(async () => makeResponse("<xml/>"));
    const result = await validateCORS(
      "https://example.com/wms",
      fetchFn as unknown as typeof fetch
    );
    expect(result.ok).toBe(true);
    // mode: cors must be requested so the browser surfaces CORS failures.
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.com/wms",
      expect.objectContaining({ mode: "cors" })
    );
  });

  it("reports a CORS/network failure instead of throwing", async () => {
    // A blocked cross-origin fetch rejects with `TypeError: Failed to fetch`.
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await validateCORS(
      "https://no-cors.example.com/wms",
      fetchFn as unknown as typeof fetch
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Failed to fetch/);
  });

  it("reports non-2xx responses (e.g. wrong endpoint path)", async () => {
    const fetchFn = vi.fn(async () =>
      makeResponse("not found", { ok: false, status: 404, statusText: "Not Found" })
    );
    const result = await validateCORS(
      "https://example.com/erddap/wms/missing",
      fetchFn as unknown as typeof fetch
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("404");
  });
});

describe("fetchCapabilities error handling", () => {
  it("throws a clear error when the response is not XML", async () => {
    const fetchFn = vi.fn(async () => makeResponse("Internal Server Error"));
    await expect(
      fetchCapabilities("https://example.com/wms", {
        fetch: fetchFn as unknown as typeof fetch,
      })
    ).rejects.toThrow(/not XML/);
  });

  it("throws when the server returns a non-ok status", async () => {
    const fetchFn = vi.fn(async () =>
      makeResponse("", { ok: false, status: 500, statusText: "Server Error" })
    );
    await expect(
      fetchCapabilities("https://example.com/wms", {
        fetch: fetchFn as unknown as typeof fetch,
      })
    ).rejects.toThrow(/GetCapabilities failed/);
  });
});
