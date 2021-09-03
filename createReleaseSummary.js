#!/usr/bin/env node
// Must be run from monorepo root
const changed = require("./changed.json");
const list = require("./list.json");
const child_process = require("child_process");
const fs = require("fs");

console.log(
  "Approving this pull request will start the production deployment pipeline.\n"
);

console.log(`
## Updated Packages

| package name | updated version |
|--------------|-----------------|`);

for (const package of changed) {
  const { name, location, version } = package;
  const updated = list.find((p) => p.name === name);
  if (!updated) {
    throw new Error(`Could not find ${name} in list of updated packages`);
  }
  console.log(`| ${name} | ${version} → ${updated.version} |`);
}

console.log("");

const migrations = fs.readFileSync("./migrations.txt").toString();
const migrationItems = migrations.split("\n");
if (migrations.length > 1) {
  console.log(`## 🚨 This change will trigger a database migration\n`);
  for (const migration of migrationItems) {
    if (migration.length) {
      console.log(`  * [${migration}](seasketch.org)`);
    }
  }
}

console.log("\n## Changelog\n");

console.log(
  fs
    .readFileSync("./short_changelog.md")
    .toString()
    .split("\n")
    .slice(3)
    .join("\n")
);
