import { DBClient } from "./dbClient";
import * as jwks from "./auth/jwks";
import { decode } from "jsonwebtoken";

/**
 * Creates a JWT API key for a project, storing it in the database
 * @param label
 * @param projectId
 * @param userId User ID of the user creating the key
 * @param client Database connection. Should be scoped to a user session
 * @param ttl Optional time to live in seconds
 * @returns String json web token
 */
export async function createApiKey(
  label: string,
  projectId: number,
  userId: number,
  client: DBClient,
  ttl?: number
): Promise<string> {
  const { rows } = await client.query(
    `select * from create_api_key($1, $2, $3, $4)`,
    [
      projectId,
      label,
      userId,
      ttl ? new Date(new Date().getTime() + ttl * 1000) : null,
    ]
  );
  const apiKey: {
    id: string;
    label: string;
    project_id: number;
    created_by: number;
    is_revoked: boolean;
    created_at: number;
    last_used_at: number;
    expires_at: number;
  } = rows[0];
  const token = await jwks.sign(
    client,
    {
      id: apiKey.id,
      projectId: apiKey.project_id,
      createdBy: apiKey.created_by,
    },
    ttl,
    `seasketch.org`
  );
  return token;
}

/**
 * Verify that the given token is a valid API key
 * @param apiKeyToken
 * @param client
 * @returns
 */
export async function verify(
  apiKeyToken: string,
  client: DBClient
): Promise<false | { projectId: number; createdBy: number; label: string }> {
  try {
    const verified = await jwks.verify(client, apiKeyToken, `seasketch.org`);
    const claims = decode(apiKeyToken);
    if (verified && claims && typeof claims === "object") {
      if (!claims.id) {
        return false;
      }
      // check db to make sure it isn't revoked
      const { rows } = await client.query(
        `select * from api_keys where id = $1 and is_api_key_in_good_standing($1)`,
        [claims.id]
      );
      if (rows.length === 1) {
        return {
          projectId: rows[0].project_id,
          createdBy: rows[0].created_by,
          label: rows[0].label,
        };
      } else {
        return false;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

export async function revoke(id: string, client: DBClient) {
  await client.query(`select revoke_api_key($1)`, [id]);
  return;
}
