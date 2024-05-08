import { Helpers } from "graphile-worker";
const endpoint = `https://api.cloudflare.com/client/v4/graphql`;

/**
 * All logic is contained in the stored procedure.
 * Checks for archived data sources which have passed their expiration
 * date, as defined by projects.data_hosting_retention_period
 * (which may be null for never expiring)
 */
export default async function deleteExpiredArchivedDataSources(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    await client.query("select delete_expired_archived_data_sources()");
  });
}
