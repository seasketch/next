import { WorkerEntrypoint } from "cloudflare:workers";
import { handleDataTableQuery } from "./dataTablesBackend";

/**
 * Internal query engine. Reachable only via the overlay-data-server
 * service binding after the gateway has authorized and stripped credentials.
 */
export default class extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handleDataTableQuery(request, this.env);
  }
}
