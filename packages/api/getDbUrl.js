#!/usr/bin/env node
const AWS = require("aws-sdk");
const https = require("https");
const fs = require("fs");
const { PGUSER, PGREGION, PGHOST, PGPORT, PGDATABASE } = process.env;

(async () => {
  const signer = new AWS.RDS.Signer();
  const certPath = `${__dirname}/rds-global-bundle.pem`;
  const file = fs.createWriteStream(certPath);
  https.get(
    "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem",
    function (response) {
      response.pipe(file);
      file.on("finish", function () {
        file.close(() => {
          signer.getAuthToken(
            {
              // uses the IAM role access keys to create an authentication token
              region: PGREGION,
              hostname: PGHOST,
              port: parseInt(PGPORT || 5432),
              username: PGUSER,
            },
            function (err, token) {
              if (err) {
                throw new Error(`could not get auth token: ${err}`);
              } else {
                const dbUrl = `postgres://${PGUSER}:${encodeURIComponent(
                  token
                )}@${PGHOST}:${PGPORT}/${PGDATABASE}?ssl=1&sslmode=verify-full&sslrootcert=${certPath}`;
                console.log(`DATABASE_URL=${dbUrl}\nPGPASSWORD=${token}`);
              }
            }
          );
        });
      });
    }
  );
})();
