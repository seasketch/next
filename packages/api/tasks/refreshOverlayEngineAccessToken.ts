import { Helpers } from "graphile-worker";
import {
  mintOverlayEngineAccessToken,
  overlayEngineAccessTokenSecretId,
  publishOverlayEngineAccessToken,
} from "../src/overlayEngine/overlayEngineAccessToken";

/**
 * Mint a 14-day overlay-engine JWT and publish it to Secrets Manager for
 * OverlayWorker. Scheduled daily in production (03:00) and also runnable on
 * demand from the maintenance bastion:
 *
 *   npm run overlay-engine:token        # enqueue this job via psql
 *   npm run overlay-engine:token:show   # read current secret (aws cli)
 */
export default async function refreshOverlayEngineAccessToken(
  _payload: unknown,
  helpers: Helpers,
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "refreshOverlayEngineAccessToken: no-op (NODE_ENV is not production); refusing to mint/publish",
    );
    return;
  }

  await helpers.withPgClient(async (client) => {
    const minted = await mintOverlayEngineAccessToken(client);
    const secretId = overlayEngineAccessTokenSecretId();
    await publishOverlayEngineAccessToken(secretId, minted);
    helpers.logger.info(
      `Published overlay-engine access token kid=${minted.kid} exp=${minted.exp} secret=${secretId}`,
    );
  });
}
