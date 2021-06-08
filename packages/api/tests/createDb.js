#!/usr/bin/env node
const { Client } = require("pg");
const { DATABASE_URL } = require("./pool");
const template1 = DATABASE_URL + "template1";
const { migrate, reset, watch } = require("graphile-migrate");
const { runMigrations } = require("graphile-worker");

module.exports = async () => {
  const client = new Client(template1);
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
  await runMigrations({
    connectionString: settings.connectionString,
    taskList: {},
  });
  const client2 = new Client(settings.connectionString);
  await client2.connect();
  await client2.query(
    `
    INSERT into data_sources_buckets (url, name, region, location) values ($1, $2, $3, ST_GeomFromText('POINT(-71.060316 48.432044)', 4326))
  `,
    ["geojson-1.seasketch-data.org", "Oregon, USA", "us-west-2"]
  );
  await client2.end();
  await watch(settings, true);
  console.log = log;
};
