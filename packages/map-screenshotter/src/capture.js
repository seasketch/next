import puppeteer from "@cloudflare/puppeteer";

const CAPTURE_BUDGET_MS = 60_000;
const PAINT_SETTLE_MS = 2_000;

/**
 * Open screenshot.html, render the bookmark, and return a PNG.
 * The browser binding must be Cloudflare's default Chromium. Kitesurf does
 * not render WebGL, so Mapbox never paints a map there.
 *
 * @param {import("@cloudflare/puppeteer").BrowserWorker} browserBinding
 * @param {import("./validate.js").ScreenshotRequest} request
 * @returns {Promise<Uint8Array>}
 */
export async function captureMap(browserBinding, request) {
  const browser = await puppeteer.launch(browserBinding, {
    keep_alive: CAPTURE_BUDGET_MS,
  });
  const deadline = Date.now() + CAPTURE_BUDGET_MS;
  const remaining = () => {
    const left = deadline - Date.now();
    if (left <= 0) {
      throw new Error("Screenshot timed out after 60 seconds");
    }
    return left;
  };
  try {
    const page = await browser.newPage();
    const notes = [];
    const pendingNotes = [];
    const note = (message) => {
      notes.push(redact(message));
      if (notes.length > 20) notes.shift();
    };
    page.on("pageerror", (error) => {
      note(error instanceof Error ? error.message : String(error));
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      pendingNotes.push(
        consoleErrorText(msg)
          .then(note)
          .catch(() => note(msg.text()))
      );
    });
    await page.setViewport({
      width: request.width,
      height: request.height,
      deviceScaleFactor: 2,
    });
    await page.goto(request.url, {
      waitUntil: request.skipWaitForLoaded ? "networkidle2" : "load",
      timeout: remaining(),
    });
    // screenshot.html on production may still be Mapbox GL 2.13. Bookmark
    // styles use raster-color, which that build rejects. Upgrade only when
    // the page already loaded an older Mapbox.
    const mapboxVersion = await page.evaluate(
      () => (window.mapboxgl && window.mapboxgl.version) || ""
    );
    if (mapboxVersion && !String(mapboxVersion).startsWith("3.")) {
      await page.addStyleTag({
        url: "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css",
      });
      await page.addScriptTag({
        url: "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js",
      });
    }
    await page.evaluate((bookmarkData) => {
      // Runs in the page, where screenshot.html defines this.
      return window.showBookmark(bookmarkData);
    }, request.bookmarkData);
    try {
      const selectorTimeout = request.skipWaitForLoaded
        ? Math.min(10_000, remaining())
        : remaining();
      await page.waitForSelector(
        request.skipWaitForLoaded ? "#log-messages" : "#loaded",
        { timeout: selectorTimeout }
      );
    } catch (error) {
      await Promise.all(pendingNotes);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}${notes.length ? `; page: ${notes.join(" | ")}` : ""}`
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(PAINT_SETTLE_MS, remaining()))
    );
    const shot = await withTimeout(
      page.screenshot({
        type: "png",
        encoding: "binary",
        captureBeyondViewport: false,
        ...(request.clip ? { clip: request.clip } : {}),
      }),
      remaining(),
      "Screenshot timed out after 60 seconds"
    );
    return toPngBytes(shot);
  } finally {
    await browser.close();
  }
}

/**
 * @param {Uint8Array | string | Buffer} shot
 * @returns {Uint8Array}
 */
function withTimeout(work, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function consoleErrorText(msg) {
  const parts = await Promise.all(
    msg.args().map(async (arg) => {
      try {
        return await arg.evaluate((value) => {
          if (value instanceof Error) return value.stack || value.message;
          if (typeof value === "string") return value;
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        });
      } catch {
        return arg.toString();
      }
    })
  );
  return parts.filter(Boolean).join(" ");
}

function redact(value) {
  return String(value)
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/[\w-]{20,}\.[\w-]{20,}\.[\w-]{10,}/g, "[jwt]")
    .slice(0, 240);
}

function toPngBytes(shot) {
  if (shot instanceof Uint8Array) return shot;
  if (typeof shot === "string") {
    const binary = atob(shot);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  throw new Error("Screenshot was empty");
}
