import { describe, expect, it } from "vitest";
import {
  applyCorsHeaders,
  corsPreflightResponse,
  isAllowedOrigin,
} from "../src/auth/cors";

describe("gateway CORS", () => {
  it.each([
    "https://seasketch.org",
    "https://app.seasketch.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    "https://evilseasketch.org",
    "https://seasketch.org.attacker.example",
    "null",
    "not a URL",
  ])("rejects %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });

  it("echoes allowed origins and varies the response", () => {
    const headers = new Headers();
    applyCorsHeaders(
      headers,
      new Request("https://tiles.seasketch.org", {
        headers: { Origin: "https://app.seasketch.org" },
      }),
      { allowAuthorization: true }
    );

    expect(headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.seasketch.org"
    );
    expect(headers.get("Vary")).toBe("Origin");
    expect(headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization"
    );
  });

  it("omits ACAO for disallowed browser origins", () => {
    const headers = new Headers();
    applyCorsHeaders(
      headers,
      new Request("https://tiles.seasketch.org", {
        headers: { Origin: "https://attacker.example" },
      })
    );
    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("allows non-browser clients and handles preflight", () => {
    const response = corsPreflightResponse(
      new Request("https://tiles.seasketch.org", { method: "OPTIONS" })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, HEAD, OPTIONS"
    );
  });
});
