/**
 * Mint an overlay-engine access token (and optionally publish to Secrets Manager).
 *
 * Runs the already-built dist script (no tsc). Bastion/prod images ship dist;
 * locally run `npm run build` first if dist is stale.
 *
 * Usage (from packages/api, NODE_ENV=production required):
 *   npm run overlay-engine:token
 *   npm run overlay-engine:token -- --publish
 *   npm run overlay-engine:token -- --publish --secret-id=seasketch/overlay-engine/access-token
 *
 * Local with .env:
 *   dotenv -e .env -- npm run overlay-engine:token -- --publish
 *
 * Bastion: same npm commands; env + AWS creds come from the task role.
 * Prefer ADMIN_DATABASE_URL (bypasses RLS) so signing can read `jwks`.
 */
import { createPool } from "../src/pool";
import {
  mintOverlayEngineAccessToken,
  overlayEngineAccessTokenSecretId,
  publishOverlayEngineAccessToken,
} from "../src/overlayEngine/overlayEngineAccessToken";

async function main() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "overlay-engine:token requires NODE_ENV=production (refusing to mint against a non-production environment)",
    );
  }

  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const secretIdArg = args.find((a) => a.startsWith("--secret-id="));
  const secretIdOverride = secretIdArg
    ? secretIdArg.slice("--secret-id=".length)
    : null;

  const pool = createPool({}, "admin");
  const minted = await mintOverlayEngineAccessToken(pool);
  console.log(
    JSON.stringify(
      {
        kid: minted.kid,
        iat: minted.iat,
        exp: minted.exp,
        expiresAt: new Date(minted.exp * 1000).toISOString(),
        token: minted.token,
      },
      null,
      2,
    ),
  );

  if (publish) {
    const secretId = overlayEngineAccessTokenSecretId(secretIdOverride);
    await publishOverlayEngineAccessToken(secretId, minted);
    console.error(
      `Published to Secrets Manager secretId=${secretId} kid=${minted.kid} exp=${minted.exp}`,
    );
  } else {
    console.error(
      "Minted only (not published). Pass --publish to write to Secrets Manager.",
    );
  }

  // createPool() checks out a client for SET statement_timeout and never
  // releases it, so pool.end() never resolves. Exit immediately.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
