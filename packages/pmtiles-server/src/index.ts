import { WorkerEntrypoint } from "cloudflare:workers";
import { isV2Path } from "./auth/path";
import { handleGatewayRequest } from "./gateway";
import { TilesBackend } from "./tilesBackend";

export { TilesBackend };

/**
 * Default entrypoint: route /v2/{ns}/... through the auth gateway;
 * everything else goes straight to TilesBackend (legacy, no auth).
 */
export default class extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (isV2Path(url.pathname)) {
      return handleGatewayRequest(request, this.env, {
        fetch: (req, options) =>
          this.ctx.exports.TilesBackend.fetch(req, options),
      });
    }

    return this.ctx.exports.TilesBackend.fetch(request);
  }
}
