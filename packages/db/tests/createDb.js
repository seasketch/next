#!/usr/bin/env node
const { Client } = require("pg");
const { DATABASE_URL } = require("./pool");
const template1 = DATABASE_URL + "template1";
const client = new Client(template1);
const { migrate, reset, watch } = require("graphile-migrate");

module.exports = async () => {
  await client.connect();
  await client.query("DROP DATABASE IF EXISTS test");
  await client.query("CREATE DATABASE test");
  await client.query("DROP DATABASE IF EXISTS testshadow");
  await client.query("CREATE DATABASE testshadow");
  await client.end();
  process.env.ROOT_DATABASE_URL = template1;
  process.env.DATABASE_URL = template1.replace("template1", "test");
  process.env.SHADOW_DATABASE_URL = template1.replace(
    "template1",
    "testshadow"
  );
  const settings = {
    rootConnectionString: process.env.ROOT_DATABASE_URL,
    connectionString: process.env.DATABASE_URL,
    shadowConnectionString: process.env.SHADOW_DATABASE_URL,
  };
  const log = console.log;
  // supress logs from graphile-migrate
  console.log = (msg) => {};
  await reset(settings);
  await watch(settings, true);
  console.log = log;
};
