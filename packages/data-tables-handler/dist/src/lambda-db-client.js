"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClient = getClient;
const aws_sdk_1 = require("aws-sdk");
const pg_1 = require("pg");
async function getClient() {
    if (!dbClient) {
        if (db.host &&
            (/localhost/.test(db.host) ||
                /127.0.0.1/.test(db.host) ||
                /host.docker.internal/.test(db.host))) {
            dbClient = new Promise(async (resolve, reject) => {
                const client = new pg_1.Client({
                    database: db.database,
                    host: db.host,
                    port: parseInt(db.port.toString()),
                    user: db.user,
                    password: process.env.PGPASSWORD,
                });
                try {
                    await client.connect();
                    client.on("error", () => {
                        dbClient = null;
                    });
                    resolve(client);
                }
                catch (e) {
                    reject(e);
                }
            });
        }
        else {
            dbClient = new Promise((resolve, reject) => {
                signer.getAuthToken({
                    region: db.region,
                    hostname: db.host,
                    port: parseInt(db.port.toString()),
                    username: db.user,
                }, async function (err, token) {
                    if (err) {
                        reject(new Error(`could not get auth token: ${err}`));
                    }
                    else {
                        const client = new pg_1.Client({
                            database: db.database,
                            host: db.host,
                            port: parseInt(db.port.toString()),
                            user: db.user,
                            password: token,
                            ssl: { rejectUnauthorized: false },
                        });
                        try {
                            await client.connect();
                            client.on("error", () => {
                                dbClient = null;
                            });
                            resolve(client);
                        }
                        catch (e) {
                            reject(e);
                        }
                    }
                });
            });
        }
    }
    return dbClient;
}
const signer = new aws_sdk_1.RDS.Signer();
for (const param of ["PGREGION", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) {
    if (!process.env[param]) {
        throw new Error(`Environment variable "${param}" not set`);
    }
}
const db = {
    region: process.env.PGREGION,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT),
    user: process.env.PGUSER,
    database: process.env.PGDATABASE,
};
let dbClient = null;
