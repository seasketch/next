import { Helpers } from "graphile-worker";
import {
  mintOverlayEngineAccessToken,
  overlayEngineAccessTokenSecretId,
  publishOverlayEngineAccessToken,
} from "../src/overlayEngine/overlayEngineAccessToken";

/**
 * Daily production cron: mint a 14-day overlay-engine JWT and publish it to
 * Secrets Manager for OverlayWorker.
 *
 * First deploy / debugging: from the maintenance bastion run
 *   npm run overlay-engine:token -- --publish
 * (see scripts/mintOverlayEngineAccessToken.ts).
 */
export default async function refreshOverlayEngineAccessToken(
  _payload: unknown,
  helpers: Helpers,
) {
  await helpers.withPgClient(async (client) => {
    const minted = await mintOverlayEngineAccessToken(client);
    const secretId = overlayEngineAccessTokenSecretId();
    await publishOverlayEngineAccessToken(secretId, minted);
    helpers.logger.info(
      `Published overlay-engine access token kid=${minted.kid} exp=${minted.exp} secret=${secretId}`,
    );
  });
}
