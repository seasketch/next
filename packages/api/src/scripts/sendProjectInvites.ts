import * as projectInvites from "../invites/projectInvites";
import { Pool, Client } from "pg";
require("dotenv").config();

const client = new Client(process.env.DATABASE_URL!);

(async function () {
  await projectInvites.sendQueuedInvites(client);
})();
