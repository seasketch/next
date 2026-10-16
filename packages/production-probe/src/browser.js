import puppeteer from "@cloudflare/puppeteer";

const PAGE_TIMEOUT_MS = 60_000;

/**
 * Open the live React app in one Browser Run session.
 * Screens run one after another so the map page is not competing for the
 * browser. Fiji is ready when the map canvas exists, not after tiles paint.
 * The session is closed before return.
 *
 * @param {import("@cloudflare/puppeteer").BrowserWorker} browserBinding
 * @param {string} siteOrigin
 */
export async function runBrowserChecks(browserBinding, siteOrigin) {
  const origin = siteOrigin.replace(/\/$/, "");
  const started = Date.now();
  const browser = await puppeteer.launch(browserBinding);
  const launchMs = Date.now() - started;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const checks = [
      { name: "browser launch", ok: true, detail: `${launchMs}ms` },
      await visit(page, "homepage rendered", `${origin}/`, async (timeout) => {
        await page.waitForSelector("#nav-projects", { timeout });
        const signIn = await page.evaluate(() =>
          [...document.querySelectorAll("a,button")].some((el) => el.textContent?.trim() === "Sign In")
        );
        if (!signIn) {
          throw new Error("Sign In was not rendered");
        }
      }),
      await visit(page, "fiji map rendered", `${origin}/fiji`, async (timeout) => {
        await page.waitForSelector(".mapboxgl-canvas", { timeout });
      }),
      await visit(page, "blue azores survey rendered", `${origin}/blueazores/surveys/23/0`, async (timeout) => {
        await page.waitForFunction(
          () => {
            const begin = [...document.querySelectorAll("button")].some(
              (el) => el.textContent?.trim() === "Begin"
            );
            return begin && document.body.innerText.includes("Welcome");
          },
          { timeout }
        );
      }),
    ];
    return { checks, durationMs: Date.now() - started };
  } finally {
    await browser.close();
  }
}

function timeLeft(deadline) {
  const left = deadline - Date.now();
  if (left <= 0) {
    throw new Error(`Timed out after ${PAGE_TIMEOUT_MS}ms`);
  }
  return left;
}

async function visit(page, name, url, ready) {
  const started = Date.now();
  const deadline = started + PAGE_TIMEOUT_MS;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeLeft(deadline) });
    await ready(timeLeft(deadline));
    return { name, ok: true, detail: `${Date.now() - started}ms ${url}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: `${Date.now() - started}ms ${message}` };
  }
}
