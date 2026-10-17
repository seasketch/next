import crypto from "crypto";
import { promisify } from "util";
import NodeRSA from "node-rsa";

const generateKeyPair = promisify(crypto.generateKeyPair);

test("node-rsa imports a pkcs8 key from crypto.generateKeyPair", async () => {
  // Node 24's OpenSSL still exposes publicEncrypt. node-rsa then selects its
  // io engine; that require() is what threw "engine is not a function".
  const { privateKey } = await generateKeyPair("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const key = new NodeRSA(privateKey, "pkcs8-private-pem");
  const components = key.exportKey("components") as { n: Buffer };
  expect(Buffer.isBuffer(components.n)).toBe(true);
  expect(components.n.length).toBeGreaterThan(0);
  expect(key.exportKey("pkcs1-private-pem")).toContain("PRIVATE KEY");
});
