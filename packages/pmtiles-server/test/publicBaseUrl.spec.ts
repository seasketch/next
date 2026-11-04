import { describe, expect, it } from "vitest";
import { publicBaseUrl } from "../src/tilesBackend";

describe("publicBaseUrl", () => {
  const local = new URL("http://localhost:8787/projects/x/public/y.json");
  const prod = new URL("https://tiles.seasketch.org/projects/x/public/y.json");

  it("uses the request origin when PUBLIC_HOSTNAME is unset", () => {
    expect(publicBaseUrl({}, local)).toBe("http://localhost:8787");
    expect(publicBaseUrl({}, prod)).toBe("https://tiles.seasketch.org");
  });

  it("treats a bare PUBLIC_HOSTNAME as an https host", () => {
    expect(publicBaseUrl({ PUBLIC_HOSTNAME: "tiles.seasketch.org" }, local)).toBe(
      "https://tiles.seasketch.org",
    );
  });

  it("accepts a full origin and strips a trailing slash", () => {
    expect(publicBaseUrl({ PUBLIC_HOSTNAME: "http://localhost:8787/" }, prod)).toBe(
      "http://localhost:8787",
    );
  });
});
