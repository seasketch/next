import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedScreenshotUrl,
  parseScreenshotRequest,
  tokensMatch,
} from "./validate.js";

const bookmarkData = { style: { version: 8, sources: {}, layers: [] } };

test("tokensMatch rejects a different length without throwing", () => {
  assert.equal(tokensMatch("short", "much-longer-token"), false);
  assert.equal(tokensMatch("", "token"), false);
});

test("tokensMatch accepts only the same token", () => {
  assert.equal(tokensMatch("bookmark-token", "bookmark-token"), true);
  assert.equal(tokensMatch("bookmark-token", "bookmark-tokem"), false);
});

test("allows localhost only when local Chrome is in use", () => {
  assert.equal(
    isAllowedScreenshotUrl("http://127.0.0.1:8791/screenshot.html"),
    false
  );
  assert.equal(
    isAllowedScreenshotUrl("http://127.0.0.1:8791/screenshot.html", {
      allowLocalhost: true,
    }),
    true
  );
  assert.equal(
    isAllowedScreenshotUrl("http://localhost:3000/screenshot.html", {
      allowLocalhost: true,
    }),
    true
  );
  assert.equal(
    isAllowedScreenshotUrl("https://127.0.0.1/screenshot.html", {
      allowLocalhost: true,
    }),
    false
  );
  assert.equal(
    isAllowedScreenshotUrl("http://evil.example/screenshot.html", {
      allowLocalhost: true,
    }),
    false
  );
});

test("allows SeaSketch client hosts over https", () => {
  assert.equal(
    isAllowedScreenshotUrl("https://www.seasketch.org/screenshot.html"),
    true
  );
  assert.equal(
    isAllowedScreenshotUrl("https://maps-dev.seasketch.org/screenshot.html"),
    true
  );
  assert.equal(isAllowedScreenshotUrl("http://www.seasketch.org/screenshot.html"), false);
  assert.equal(isAllowedScreenshotUrl("https://example.com/screenshot.html"), false);
  assert.equal(isAllowedScreenshotUrl("https://seasketch.org.evil.com/"), false);
  assert.equal(isAllowedScreenshotUrl("not a url"), false);
});

test("parses a viewport and optional clip", () => {
  const parsed = parseScreenshotRequest({
    width: 1920.2,
    height: 1080,
    url: "https://www.seasketch.org/screenshot.html?mt=1",
    bookmarkData,
    clip: { x: 0, y: 0, width: 1408, height: 1080 },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.request.clip, {
    x: 0,
    y: 0,
    width: 1408,
    height: 1080,
  });
  assert.equal(parsed.request.width, 1920);
});

test("shrinks a clip that rounding pushed one pixel past the viewport", () => {
  const parsed = parseScreenshotRequest({
    width: 1920.4,
    height: 1080.2,
    url: "https://www.seasketch.org/screenshot.html",
    bookmarkData,
    clip: { x: 512.6, y: 0, width: 1407.8, height: 1080.2 },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.request.width, 1920);
  assert.deepEqual(parsed.request.clip, {
    x: 513,
    y: 0,
    width: 1407,
    height: 1080,
  });
});

test("rejects a clip that leaves the viewport", () => {
  const parsed = parseScreenshotRequest({
    width: 800,
    height: 600,
    url: "https://www.seasketch.org/screenshot.html",
    bookmarkData,
    clip: { x: 100, y: 0, width: 800, height: 600 },
  });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.error, /viewport width/);
});

test("rejects bookmark payloads that are not objects", () => {
  const parsed = parseScreenshotRequest({
    width: 800,
    height: 600,
    url: "https://www.seasketch.org/screenshot.html",
    bookmarkData: null,
  });
  assert.equal(parsed.ok, false);
});
