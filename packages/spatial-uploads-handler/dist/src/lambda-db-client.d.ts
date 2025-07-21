import { Client } from "pg";
/**
 * Provides a reusable method of connecting to the production SeaSketch database
 * from Lambda services. Connections are reused so that calling getClient()
 * multiple times will always point to the same database connection. In the
 * event of an error, that connection will be thrown out and subsequent calls
 * will create a new connection.
 *
 * In order for the AWS.RDS signer to operate from lambda you will need to grant
 * connect privileges using an IAM role. See:
 * https://github.com/seasketch/next/blob/master/packages/infra/lib/DataHostDbUpdaterStack.ts#L43
 *
 * This module will throw an exception on import if the following environment
 * variables are not present:
 *
 *   * PGREGION
 *   * PGHOST
 *   * PGPORT
 *   * PGUSER
 *   * PGDATABASE
 *
 * @returns pg.Client
 * @example
 *
 * export const handler = (event) => {
 *   const client = getClient();
 *   const results = await client.query(
 *     `select * from projects where id = $1`,
 *     [event.id]
 *   );
 * }
 */
export declare function getClient(): Promise<Client>;
//# sourceMappingURL=lambda-db-client.d.ts.map