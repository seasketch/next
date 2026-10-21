import { MisconfiguredError } from "../src/env";
import {
  captureBookmarkScreenshot,
  e2eBookmarkImage,
  screenshotterConfig,
} from "../src/screenshotterClient";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function fakeResponse(options: {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}): Response {
  const headers = options.headers ?? {};
  const body = options.body ?? "";
  return {
    ok: options.status >= 200 && options.status < 300,
    status: options.status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    text: async () => (typeof body === "string" ? body : ""),
    arrayBuffer: async () =>
      body instanceof Uint8Array
        ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
        : new ArrayBuffer(0),
    json: async () => JSON.parse(typeof body === "string" ? body : "{}"),
  } as Response;
}

describe("map screenshotter client", () => {
  const keys = [
    "NODE_ENV",
    "SCREENSHOTTER_URL",
    "SCREENSHOTTER_TOKEN",
    "CLOUDFLARE_IMAGES_ACCOUNT",
    "CLOUDFLARE_IMAGES_TOKEN",
    "E2E_TEST_MODE",
    "E2E_TEST_PASSPHRASE",
    "CLIENT_DOMAIN",
  ] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  const fetchImpl = global.fetch;

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = fetchImpl;
  });

  test("stays quiet outside production until a capture is requested", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SCREENSHOTTER_URL;
    delete process.env.SCREENSHOTTER_TOKEN;
    expect(() => screenshotterConfig()).toThrow(
      /SCREENSHOTTER_URL, SCREENSHOTTER_TOKEN are not set/
    );
    expect(() => screenshotterConfig()).not.toThrow(MisconfiguredError);
  });

  test("names the missing settings in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SCREENSHOTTER_URL;
    process.env.SCREENSHOTTER_TOKEN = "token";
    expect(() => screenshotterConfig()).toThrow(MisconfiguredError);
    expect(() => screenshotterConfig()).toThrow(
      "Map screenshotter is misconfigured: SCREENSHOTTER_URL is not set"
    );
  });

  test("uploads the worker PNG and returns the image id", async () => {
    process.env.SCREENSHOTTER_URL = "https://map-screenshotter.example.workers.dev";
    process.env.SCREENSHOTTER_TOKEN = "bookmark-token";
    process.env.CLOUDFLARE_IMAGES_ACCOUNT = "account";
    process.env.CLOUDFLARE_IMAGES_TOKEN = "images-token";
    delete process.env.E2E_TEST_MODE;
    const calls: { url: string; authorization: string | null }[] = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        authorization: headers.Authorization ?? headers.authorization ?? null,
      });
      if (url.includes("workers.dev")) {
        return fakeResponse({
          status: 200,
          headers: { "content-type": "image/png" },
          body: PNG,
        });
      }
      return fakeResponse({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          result: { id: "image-1", variants: [] },
        }),
      });
    }) as typeof fetch;

    const image = await captureBookmarkScreenshot({
      width: 800,
      height: 600,
      url: "https://www.seasketch.org/screenshot.html",
      bookmarkData: { style: {} },
    });

    expect(image).toEqual({ id: "image-1" });
    expect(calls[0].authorization).toBe("Bearer bookmark-token");
    expect(calls[1].authorization).toBe("Bearer images-token");
    expect(calls[1].url).toContain("/accounts/account/images/v1");
  });

  test("keeps the PNG on this API during test mode", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_TEST_PASSPHRASE = "e2e-screenshotter-passphrase-32ch";
    process.env.CLIENT_DOMAIN = "localhost:13000";
    process.env.SCREENSHOTTER_URL = "https://map-screenshotter.example.workers.dev";
    process.env.SCREENSHOTTER_TOKEN = "bookmark-token";
    delete process.env.CLOUDFLARE_IMAGES_ACCOUNT;
    delete process.env.CLOUDFLARE_IMAGES_TOKEN;
    const calls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return fakeResponse({
        status: 200,
        headers: { "content-type": "image/png" },
        body: PNG,
      });
    }) as typeof fetch;

    const image = await captureBookmarkScreenshot({
      width: 800,
      height: 600,
      url: "https://www.seasketch.org/screenshot.html",
      bookmarkData: { style: {} },
    });

    expect(calls).toEqual(["https://map-screenshotter.example.workers.dev"]);
    expect(image.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(e2eBookmarkImage(image.id)).toEqual(PNG);
  });

  test("surfaces the worker error message", async () => {
    process.env.SCREENSHOTTER_URL = "https://map-screenshotter.example.workers.dev";
    process.env.SCREENSHOTTER_TOKEN = "bookmark-token";
    global.fetch = (async () =>
      fakeResponse({
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Waiting for selector #loaded failed",
        }),
      })) as typeof fetch;

    await expect(
      captureBookmarkScreenshot({
        width: 800,
        height: 600,
        url: "https://www.seasketch.org/screenshot.html",
        bookmarkData: {},
      })
    ).rejects.toThrow(/Waiting for selector #loaded failed/);
  });
});
