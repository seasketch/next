# `map-screenshotter`

Worker that captures a PNG of a SeaSketch map bookmark. The API calls it when a forum bookmark is created. The Worker opens `screenshot.html` in [Browser Run](https://developers.cloudflare.com/browser-run/) (headless Chromium) and returns the PNG. The API uploads that PNG to Cloudflare Images.

Mapbox GL needs WebGL. Browser Run's default Chromium browser renders it. Kitesurf does not, so the browser binding in `wrangler.jsonc` must stay on Chromium.

The page signals that the map is ready by adding `#loaded`.

## Deploy

From this package, with Wrangler logged into the SeaSketch Cloudflare account:

```bash
npx wrangler secret put SCREENSHOTTER_TOKEN
npm run deploy
```

`SCREENSHOTTER_TOKEN` is a shared bearer token. Generate a long random value and store the same value as the API's `SCREENSHOTTER_TOKEN`. Wrangler prints the workers.dev URL. That URL is the API's `SCREENSHOTTER_URL`.

The GraphQL service reads both variables (see `packages/infra`). Set them as GitHub Actions secrets before the next server deploy:

- `SCREENSHOTTER_URL` — the deployed worker URL
- `SCREENSHOTTER_TOKEN` — the same bearer token

Deploy this Worker before the API, or bookmark jobs fail until both sides match.

## Local development

`npm run dev` from the repo root (`Dev: core`) starts this Worker with `wrangler dev`. The Worker code runs on the machine and launches a local headless Chrome. It listens on `http://127.0.0.1:8791`. The API in that same process is pointed at that URL with the dev token `local-dev-screenshotter`, which replaces `SCREENSHOTTER_URL` and `SCREENSHOTTER_TOKEN` from `packages/api/.env` for that session. `npm run e2e` starts a second copy on port 8792. In test mode the API keeps the PNG and serves it to the client, so the forum journey can show the large image without Cloudflare Images.

Local Chrome may open `http://127.0.0.1` and `http://localhost`. The deployed Worker does not. A remote browser still cannot open your machine, so capturing a local client from the deployed Worker needs a `*.seasketch.org` tunnel.

```bash
npm test
npm run test:integration
```

`test:integration` starts its own `wrangler dev` and checks that a local page comes back as a PNG.
