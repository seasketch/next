import crypto from "crypto";

test("MD4 still runs for the webpack 4 build", () => {
  // OpenSSL 3, which Node 24 uses, disables MD4 unless the client scripts
  // set NODE_OPTIONS=--openssl-legacy-provider.
  expect(crypto.createHash("md4").update("a").digest("hex")).toBe(
    "bde52cb31de33e46245e05fbdbd6fb24"
  );
});
