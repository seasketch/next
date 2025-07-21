import NodeRSA from "node-rsa";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { promisify } from "util";
import { DBClient } from "../dbClient";
const generateKeyPair = promisify(crypto.generateKeyPair);

export type JWK = {
  kty: "RSA";
  e: string;
  use: "sig";
  kid: string;
  alg: "RS256";
  n: string;
};

export async function getJWKS(client: DBClient): Promise<JWK[]> {
  return (
    await client.query(
      `select kty, e, use, kid, alg, n from jwks where now() < expires_at order by expires_at asc`
    )
  ).rows;
}

export async function getPrivateKey(
  client: DBClient,
  kid?: string
): Promise<{ pem: string; kid: string }> {
  let key: { pem: string; kid: string } | null = null;
  if (kid) {
    const { rows } = await client.query(
      `select kid, private_pem from jwks where kid = $1 and now() < expires_at`,
      [kid]
    );
    if (rows.length > 0) {
      key = {
        kid: rows[0].kid,
        pem: rows[0].private_pem,
      };
    }
  } else {
    const { rows } = await client.query(
      `select kid, private_pem from jwks where now() < expires_at order by created_at desc limit 1`
    );
    if (rows.length > 0) {
      key = {
        kid: rows[0].kid,
        pem: rows[0].private_pem,
      };
    }
  }
  if (key === null) {
    throw new Error(`Could not find private key in database`);
  } else {
    return key;
  }
}

export async function rotateKeys(client: DBClient): Promise<string> {
  // Create a fresh key if the newest key is stale
  // Invite tokens may last up to 90 days. The database is set to expire private
  // keys after 120 days, considering that a new jwt may be issued towards the
  // end of a private key's life. Ideally, fresh keys are generated before that.
  //
  // With new keys being created every 30 days, it's really only necessary to
  // expire the private keys after 90 days but 120 days gives a little more
  // leeway. Again, private key expiration is set on the default for expires_at in
  // the database schema.

  const { rows } = await client.query(
    `select kid, (created_at <= (now() - interval '30 days')) as stale from jwks order by created_at desc limit 1`
  );
  // delete expired keys
  await client.query(`delete from jwks where expires_at <= now()`);
  if (rows.length === 0 || rows[0].stale === true) {
    const kid = await createNewKeyset(client);
    return kid as string;
  } else {
    return rows[0].kid;
  }
}

export async function createNewKeyset(client: DBClient) {
  const key = await createKey();
  const components = key.exportKey("components");
  const kid = (
    await client.query(
      `insert into jwks (e, n, private_pem, public_pem) values ('AQAB', $1, $2, $3) returning kid`,
      [
        components.n.toString("base64"),
        key.exportKey("pkcs1-private-pem").toString(),
        key.exportKey("pkcs1-public-pem").toString(),
      ]
    )
  ).rows[0].kid;
  return kid;
}

// reuse keys when not in production to speed up unit tests
let __testKey: NodeRSA;
async function createKey() {
  if (process.env.JEST_WORKER_ID !== undefined && __testKey) {
    return __testKey;
  } else {
    const { publicKey, privateKey } = await generateKeyPair("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
    const key = new NodeRSA(privateKey, "pkcs8-private-pem");
    if (process.env.JEST_WORKER_ID !== undefined) {
      __testKey = key;
    }
    return key;
  }
}

export async function sign(
  client: DBClient,
  payload: any,
  expiresIn: string | number | undefined,
  issuer: string
) {
  const privateKey = await getPrivateKey(client);
  return jwt.sign(payload, privateKey.pem, {
    issuer,
    keyid: privateKey.kid,
    algorithm: "RS256",
    header: {
      alg: "RS256",
      jku: `${
        /^http/.test(issuer) ? "" : "https://"
      }${issuer}/.well-known/jwks.json`,
    },
    ...(expiresIn ? { expiresIn } : {}),
  });
}

type JWTClaims = {
  iat: number;
  exp: number;
  iss: string;
  [key: string]: any;
};

export async function getPublicKey(client: DBClient, kid: string) {
  const pem = (await client.query(`select get_public_jwk($1)`, [kid])).rows[0]
    .get_public_jwk;

  return pem as string;
}

export async function verify<Claims>(
  client: DBClient,
  token: string,
  issuer: string | string[]
): Promise<Claims & JWTClaims> {
  const getKey = async (
    header: jwt.JwtHeader,
    callback: (error: Error | null, key: string) => void
  ): Promise<void> => {
    if (header.kid) {
      try {
        const publicKey = await getPublicKey(client, header.kid);
        callback(null, publicKey);
      } catch (e: any) {
        callback(e, "Error retrieving public key");
      }
    } else {
      callback(new Error(`Token must indicate key id (kid)`), "");
    }
  };
  return new Promise((resolve, reject) => {
    const issuerArray = Array.isArray(issuer) ? issuer : [issuer];
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        maxAge: "90 days",
        issuer: issuerArray as [string, ...string[]],
      },
      (err: jwt.VerifyErrors | null, token: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(token as Claims & JWTClaims);
        }
      }
    );
  });
}
