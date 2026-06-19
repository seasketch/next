/**
 * Fail fast in CI when VITE_MAPBOX_TOKEN is missing. Mapbox GL v3 refuses to
 * render without a valid public (pk.*) token, even for an inline empty style.
 */
export default async function globalSetup() {
  if (!process.env.CI) {
    return;
  }
  const token = process.env.VITE_MAPBOX_TOKEN?.trim();
  if (!token) {
    throw new Error(
      [
        "VITE_MAPBOX_TOKEN is required for Playwright E2E tests.",
        "In GitHub Actions, set VITE_MAPBOX_TOKEN from secrets.REACT_APP_MAPBOX_ACCESS_TOKEN",
        "(the public pk.* token used by packages/client — not MAPBOX_ACCESS_TOKEN).",
        "Locally, run `npm run verify:ci` which loads .env automatically.",
      ].join("\n")
    );
  }
}
