/**
 * Print SQL that inserts one signing key, matching createNewKeyset in src/auth/jwks.ts.
 * The golden snapshot needs a key so later test-mode tokens can be signed.
 * Run from packages/api so node-rsa resolves.
 */
const crypto = require("crypto");
const { promisify } = require("util");
const NodeRSA = require("node-rsa");

const generateKeyPair = promisify(crypto.generateKeyPair);

function quote(tag, value) {
  if (value.includes(`$${tag}$`)) {
    throw new Error(`Refusing to quote a value that contains $${tag}$`);
  }
  return `$${tag}$${value}$${tag}$`;
}

async function main() {
  const { privateKey } = await generateKeyPair("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const key = new NodeRSA(privateKey, "pkcs8-private-pem");
  const n = key.exportKey("components").n.toString("base64");
  const privatePem = key.exportKey("pkcs1-private-pem");
  const publicPem = key.exportKey("pkcs1-public-pem");

  process.stdout.write(
    `insert into jwks (e, n, private_pem, public_pem)
select 'AQAB', ${quote("n", n)}, ${quote("priv", privatePem)}, ${quote("pub", publicPem)}
where not exists (select 1 from jwks);\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
