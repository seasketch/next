import { randomUUID } from "crypto";
import { throwIfProductionMisconfigured } from "./env";
import { isE2ETestModeEnabled } from "./e2e/testMode";

const CAPTURE_TIMEOUT_MS = 70_000;

/** PNGs captured during a test-mode run, served by the API instead of Cloudflare Images. */
const e2eImages = new Map<string, Uint8Array>();

export function e2eBookmarkImage(id: string): Uint8Array | undefined {
  return e2eImages.get(id);
}

function captureSignal(ms: number): AbortSignal | undefined {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

export type ScreenshotClip = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenshotRequest = {
  width: number;
  height: number;
  url: string;
  bookmarkData: unknown;
  clip?: ScreenshotClip;
};

type ScreenshotterConfig = {
  url: string;
  token: string;
};

export function screenshotterConfig(): ScreenshotterConfig {
  const url = process.env.SCREENSHOTTER_URL;
  const token = process.env.SCREENSHOTTER_TOKEN;
  if (!url || !token) {
    const missing = [
      url ? null : "SCREENSHOTTER_URL",
      token ? null : "SCREENSHOTTER_TOKEN",
    ].filter((item): item is string => item !== null);
    throwIfProductionMisconfigured("Map screenshotter", missing);
    const verb = missing.length === 1 ? "is" : "are";
    throw new Error(
      `Map screenshotter is not configured: ${missing.join(", ")} ${verb} not set`
    );
  }
  return { url, token };
}

/**
 * Ask the map-screenshotter Worker for a PNG, then store it in Cloudflare Images.
 * The Worker runs Browser Run's Chromium, which can render the WebGL map.
 */
export async function captureBookmarkScreenshot(
  payload: ScreenshotRequest
): Promise<{ id: string }> {
  const { url, token } = screenshotterConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: captureSignal(CAPTURE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Map screenshotter failed: ${await errorMessage(response)}`
    );
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("image/png")) {
    throw new Error("Map screenshotter did not return a PNG");
  }
  const png = new Uint8Array(await response.arrayBuffer());
  if (png.byteLength === 0) {
    throw new Error("Map screenshotter returned an empty image");
  }
  return { id: await uploadPng(png) };
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `status ${response.status}`;
  try {
    const body: unknown = JSON.parse(text);
    if (isRecord(body) && typeof body.error === "string" && body.error) {
      return body.error;
    }
  } catch {
    // Response was not JSON.
  }
  return `status ${response.status}`;
}

async function uploadPng(png: Uint8Array): Promise<string> {
  if (isE2ETestModeEnabled()) {
    const id = randomUUID();
    e2eImages.set(id, png);
    return id;
  }
  const account = process.env.CLOUDFLARE_IMAGES_ACCOUNT;
  const token = process.env.CLOUDFLARE_IMAGES_TOKEN;
  if (!account || !token) {
    throw new Error(
      "Cloudflare Images is not configured: CLOUDFLARE_IMAGES_ACCOUNT and CLOUDFLARE_IMAGES_TOKEN are required"
    );
  }
  const file = pngForm(png, `${randomUUID()}.png`);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/images/v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.contentType,
      },
      body: file.body,
    }
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Cloudflare Images upload failed: status ${response.status}`
    );
  }
  const id = imageId(body);
  if (!response.ok || !id) {
    throw new Error(
      `Cloudflare Images upload failed: ${imagesError(body) || response.status}`
    );
  }
  return id;
}

function imageId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  const id = value.result.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function imagesError(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.errors)) return null;
  const messages = value.errors
    .map((error) => {
      if (!isRecord(error) || typeof error.message !== "string") return null;
      return error.message;
    })
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join("; ") : null;
}

function pngForm(
  png: Uint8Array,
  filename: string
): { body: Buffer; contentType: string } {
  const boundary = `----seasketch${randomUUID().replace(/-/g, "")}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([header, Buffer.from(png), footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
