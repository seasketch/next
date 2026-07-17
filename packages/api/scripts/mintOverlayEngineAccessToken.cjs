#!/usr/bin/env node
/**
 * Mint an overlay-engine access token (and optionally publish to Secrets Manager).
 *
 * Plain CJS so bastion/prod can run it after `git pull` without tsc. Uses already-
 * compiled modules under dist/src (pool + jwks signing).
 *
 * Usage (from packages/api, NODE_ENV=production required):
 *   npm run overlay-engine:token
 *   npm run overlay-engine:token -- --publish
 *   npm run overlay-engine:token -- --publish --secret-id=seasketch/overlay-engine/access-token
 */

const AWS = require("aws-sdk");
const { decode } = require("jsonwebtoken");
const { createPool } = require("../dist/src/pool");
const { sign } = require("../dist/src/auth/jwks");

const SECRET_NAME = "seasketch/overlay-engine/access-token";
const TTL = "14 days";
const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

function secretId(override) {
  if (override && String(override).trim()) return String(override).trim();
  const arn = process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
  if (arn && arn.trim()) return arn.trim();
  return SECRET_NAME;
}

async function mint(pool) {
  const token = await sign(
    pool,
    { type: "overlay-engine" },
    TTL,
    ISSUER[0],
  );
  const decoded = decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.payload) {
    throw new Error("Failed to decode minted overlay-engine token");
  }
  const payload = decoded.payload;
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    throw new Error("Minted overlay-engine token missing exp/iat");
  }
  const kid =
    typeof decoded.header?.kid === "string" ? decoded.header.kid : "";
  return { token, exp: payload.exp, iat: payload.iat, kid };
}

async function publish(id, minted) {
  const sm = new AWS.SecretsManager({
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2",
  });
  await sm
    .putSecretValue({
      SecretId: id,
      SecretString: JSON.stringify({
        token: minted.token,
        exp: minted.exp,
        iat: minted.iat,
        kid: minted.kid,
      }),
    })
    .promise();
}

async function main() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "overlay-engine:token requires NODE_ENV=production (refusing to mint against a non-production environment)",
    );
  }

  const args = process.argv.slice(2);
  const doPublish = args.includes("--publish");
  const secretIdArg = args.find((a) => a.startsWith("--secret-id="));
  const secretIdOverride = secretIdArg
    ? secretIdArg.slice("--secret-id=".length)
    : null;

  const pool = createPool({}, "admin");
  const minted = await mint(pool);
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

  if (doPublish) {
    const id = secretId(secretIdOverride);
    await publish(id, minted);
    console.error(
      `Published to Secrets Manager secretId=${id} kid=${minted.kid} exp=${minted.exp}`,
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
