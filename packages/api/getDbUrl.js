#!/usr/bin/env node
const AWS = require("aws-sdk");
const https = require("https");
const fs = require("fs");
const { PGUSER, PGREGION, PGHOST, PGPORT, PGNAME } = process.env;

(async () => {
  const signer = new AWS.RDS.Signer();
  const certPath = `${__dirname}/rds-ca-2019-root.pem`;
  var file = fs.createWriteStream(`${__dirname}/rds-ca-2019-root.pem`);
  var request = https.get(
    "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem",
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
                )}@${PGHOST}:${PGPORT}/${PGNAME}?ssl=1&sslmode=no-verify&sslrootcert=${certPath}`;
                console.log(dbUrl);
              }
            }
          );
        });
      });
    }
  );
})();
