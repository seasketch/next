import pg from "pg";
const { Client } = pg;
const client = new Client();

client.connect(async (error) => {
  const res = await client.query("SELECT $1::text as message", [
    "Hello world!",
  ]);
  console.log(res.rows[0].message); // Hello world!
  client.end();
});
