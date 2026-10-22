// Fail before build, database reset, or the dev server if this Playwright
// version's Chromium is not on disk. `npm install` does not download it.
// Headless runs use the headless shell; headed and UI runs use the full browser.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);

const INSTALL_COMMAND =
  "npm exec --workspace @seasketch/e2e -- playwright install chromium";

const BROWSERS = [
  ["chromium", "Chrome for Testing"],
  ["chromium-headless-shell", "Chrome Headless Shell"],
];

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Playwright's browser registry. Same paths `playwright install` and
// browser launch use, including PLAYWRIGHT_BROWSERS_PATH.
function playwrightRegistry() {
  const bundle = require("playwright-core/lib/coreBundle");
  const registry = bundle.registry?.registry;
  if (!registry?.findExecutable) {
    throw new Error(
      "playwright-core/lib/coreBundle did not export a browser registry."
    );
  }
  return registry;
}

export function missingPlaywrightBrowsers() {
  const registry = playwrightRegistry();
  const missing = [];
  for (const [name, title] of BROWSERS) {
    const executable = registry.findExecutable(name);
    const executablePath = executable?.executablePath?.() ?? null;
    if (!executablePath || !isExecutable(executablePath)) {
      missing.push({ title, executablePath });
    }
  }
  return missing;
}

export function assertPlaywrightChromium() {
  const missing = missingPlaywrightBrowsers();
  if (missing.length === 0) {
    return;
  }
  const lines = [
    "Playwright's Chromium is not installed, so the e2e suite cannot launch a browser.",
    "",
  ];
  for (const browser of missing) {
    lines.push(
      browser.executablePath
        ? `Missing ${browser.title}: ${browser.executablePath}`
        : `${browser.title} is not available on this platform.`
    );
  }
  lines.push(
    "",
    "Install it, then run the suite again:",
    "",
    `    ${INSTALL_COMMAND}`,
    ""
  );
  console.error(lines.join("\n"));
  process.exit(1);
}
