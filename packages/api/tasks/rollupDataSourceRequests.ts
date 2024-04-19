import { Helpers } from "graphile-worker";
/**
 * Compiles 15-minute records for the past 2 days into daily records,
 * and deletes older records.
 */
export default async function rollupDataSourceRequests(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    await client.query("select rollup_data_source_requests()");
    // delete 15 minute records older than 96 hours
    await client.query(
      `
      delete from data_source_requests
      where interval = '15 minutes'
      and timestamp < now() - '96 hours'::interval
    `
    );
    // delete 1 hour records older than 7 days
    await client.query(
      `
      delete from data_source_requests
      where interval = '1 hour'
      and timestamp < now() - '7 days'::interval
    `
    );
  });
}
