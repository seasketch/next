#!/usr/bin/env node
const changed = require("./changed.json");
const list = require("./list.json");
const child_process = require("child_process");
const fs = require("fs");
const core = require("@actions/core");
const path = require("path");

const AUTO_DEPLOYED_PACKAGES = ["@seasketch/api", "client"];

let output = ``;
const append = (str) => {
  output += str + "\n";
};

append(
  "Approving this pull request will start the production deployment pipeline.\n"
);

append(`
## Updated Packages

| package name | updated version |
|--------------|-----------------|`);

for (const package of changed) {
  const { name, location, version } = package;
  const updated = list.find((p) => p.name === name);
  if (!updated) {
    throw new Error(`Could not find ${name} in list of updated packages`);
  }
  append(
    `| ${name} | ${version} → ${updated.version} ${
      AUTO_DEPLOYED_PACKAGES.indexOf(name) === -1 ? ":safety_vest:" : ""
    }|`
  );
}

append("");

if (
  changed.filter(({ name }) => AUTO_DEPLOYED_PACKAGES.indexOf(name) === -1)
    .length > 0
) {
  append(
    ":safety_vest: Some packages may require manual deployment via CDK.\n"
  );
}

const migrations = fs.readFileSync("./migrations.txt").toString();
const migrationItems = migrations.split("\n");
if (migrations.length > 1) {
  append(`## 🚨 Database migration\n`);
  append(
    `These changes will be applied to the database upon deployment and should be reviewed before proceeding.\n\n`
  );
  for (const migration of migrationItems) {
    const fname = path.basename(migration);
    if (migration.length) {
      append(
        `[${fname}](https://github.com/seasketch/next/blob/master/${migration})`
      );
    }
  }
}

append("\n## Changelog\n");

append(
  `The changelog includes all [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/). Review the [full commit log](https://github.com/seasketch/next/compare/${process.env.PREVIOUS_TAG}...${process.env.BRANCH}) for commits that don't follow this convention.\n`
);

append(
  fs
    .readFileSync("./short_changelog.md")
    .toString()
    .split("\n")
    .slice(2)
    .join("\n")
);

core.setOutput("message", output);

console.log(output);
