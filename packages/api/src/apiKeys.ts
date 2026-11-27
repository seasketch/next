import crypto from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { DBClient } from "./dbClient";

const generateKeyPair = promisify(crypto.generateKeyPair);

const API_KEY_ISSUER = "seasketch.org";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function generateKeyPairPem(): Promise<{
  publicPem: string;
  privatePem: string;
}> {
  const { publicKey, privateKey } = await generateKeyPair("rsa", {
    modulusLength: process.env.JEST_WORKER_ID !== undefined ? 2048 : 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return {
    publicPem: publicKey,
    privatePem: privateKey,
  };
}

/**
 * Returns the current active API-key signing key, lazily creating one if
 * none exists yet. Keys are never rotated or expired automatically.
 */
async function getOrCreateSigningKey(
  client: DBClient
): Promise<{ kid: string; privatePem: string }> {
  const existing = await client.query(
    `select kid, private_pem from api_key_signing_keys where private_pem is not null order by created_at desc limit 1`
  );
  if (existing.rows.length > 0) {
    return {
      kid: existing.rows[0].kid,
      privatePem: existing.rows[0].private_pem,
    };
  }

  const { publicPem, privatePem } = await generateKeyPairPem();
  const inserted = await client.query(
    `insert into api_key_signing_keys (public_pem, private_pem)
     values ($1, $2)
     on conflict ((true)) where private_pem is not null do nothing
     returning kid, private_pem`,
    [publicPem, privatePem]
  );
  if (inserted.rows.length > 0) {
    return {
      kid: inserted.rows[0].kid,
      privatePem: inserted.rows[0].private_pem,
    };
  }

  const raced = await client.query(
    `select kid, private_pem from api_key_signing_keys where private_pem is not null order by created_at desc limit 1`
  );
  if (raced.rows.length === 0) {
    throw new Error("Could not find or create API key signing key");
  }
  return {
    kid: raced.rows[0].kid,
    privatePem: raced.rows[0].private_pem,
  };
}

/**
 * Ensures an active API-key signing key exists, creating one if the table has
 * no active key yet. Safe to call on server startup and idempotent thereafter.
 */
export async function ensureSigningKey(client: DBClient): Promise<string> {
  const { kid } = await getOrCreateSigningKey(client);
  return kid;
}

/**
 * Manually rotates the API-key signing key.
 *
 * By default, retires the previous active key by clearing its private key while
 * keeping its public key so previously issued API keys continue to verify.
 * Pass `{ invalidatePreviousKeys: true }` in an emergency (e.g. signing key
 * compromise) to delete prior public keys and immediately reject all previously
 * issued API keys.
 */
export async function rotateSigningKey(
  client: DBClient,
  options?: { invalidatePreviousKeys?: boolean }
): Promise<string> {
  const { publicPem, privatePem } = await generateKeyPairPem();
  if (options?.invalidatePreviousKeys) {
    await client.query(`delete from api_key_signing_keys`);
  } else {
    await client.query(
      `update api_key_signing_keys set private_pem = null, retired_at = now() where private_pem is not null`
    );
  }
  const { rows } = await client.query(
    `insert into api_key_signing_keys (public_pem, private_pem) values ($1, $2) returning kid`,
    [publicPem, privatePem]
  );
  return rows[0].kid as string;
}

/**
 * Creates a JWT API key for a project, storing it in the database.
 * Keys never expire unless an explicit `ttl` (in seconds) is provided.
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
  if (ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    throw new Error("API key TTL must be a positive number of seconds");
  }
  const { rows } = await client.query(
    `select * from create_api_key($1, $2, $3, $4)`,
    [
      projectId,
      label,
      userId,
      ttl !== undefined ? new Date(Date.now() + ttl * 1000) : null,
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
    expires_at: number | null;
  } = rows[0];
  const signingKey = await getOrCreateSigningKey(client);
  return jwt.sign(
    {
      id: apiKey.id,
      projectId: apiKey.project_id,
      createdBy: apiKey.created_by,
    },
    signingKey.privatePem,
    {
      issuer: API_KEY_ISSUER,
      keyid: signingKey.kid,
      algorithm: "RS256",
      ...(ttl !== undefined ? { expiresIn: ttl } : {}),
    }
  );
}

/**
 * Verify that the given token is a valid API key.
 * Keys without an explicit `exp` claim do not expire; they remain valid until
 * revoked (or until their signing key is explicitly deleted).
 */
export async function verify(
  apiKeyToken: string,
  client: DBClient
): Promise<false | { projectId: number; createdBy: number; label: string }> {
  try {
    const decoded = jwt.decode(apiKeyToken, { complete: true });
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.header?.kid !== "string" ||
      !UUID_RE.test(decoded.header.kid)
    ) {
      return false;
    }

    const { rows: keyRows } = await client.query(
      `select public_pem from api_key_signing_keys where kid = $1`,
      [decoded.header.kid]
    );
    if (keyRows.length !== 1) {
      return false;
    }

    const claims = jwt.verify(apiKeyToken, keyRows[0].public_pem, {
      algorithms: ["RS256"],
      issuer: API_KEY_ISSUER,
    });
    if (
      !claims ||
      typeof claims !== "object" ||
      typeof claims.id !== "string" ||
      !UUID_RE.test(claims.id)
    ) {
      return false;
    }

    // Check db to make sure it isn't revoked or past expires_at
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
