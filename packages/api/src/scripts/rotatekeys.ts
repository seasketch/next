import * as jwks from "../auth/jwks";
import { Pool, Client } from "pg";
require("dotenv").config();

const client = new Client(process.env.DATABASE_URL!);

(async function () {
  await jwks.rotateKeys(client);
  await client.end();
})();
