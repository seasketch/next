#!/usr/bin/env node
// Every Playwright test carries exactly one suite tag: @smoke, @enduser, or
// @admin. Smoke is not also an end-user or admin test. A test with no suite
// tag would run in none of the CI jobs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests");
const suiteTags = ["smoke", "enduser", "admin"];

function stripStrings(line) {
  return line
    .replace(/`(?:\\.|[^`])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\/\/.*$/, "");
}

function braceDelta(line) {
  const stripped = stripStrings(line);
  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;
  return open - close;
}

function suiteTagsIn(title) {
  return suiteTags.filter((tag) => new RegExp(`@${tag}\\b`).test(title));
}

const failures = [];
const counts = { smoke: 0, enduser: 0, admin: 0 };
let count = 0;

for (const file of fs.readdirSync(testsDir).filter((name) => name.endsWith(".spec.ts"))) {
  const fullPath = path.join(testsDir, file);
  const lines = fs.readFileSync(fullPath, "utf8").split("\n");
  let depth = 0;
  const describes = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const depthBefore = depth;
    const events = [];
    for (const match of line.matchAll(
      /test\.describe(?:\.[a-z]+)?\(\s*["']([^"']+)["']/g
    )) {
      events.push({ kind: "describe", index: match.index, title: match[1] });
    }
    for (const match of line.matchAll(
      /(?<![\w.])test(?:\.(?:only|skip|fixme))?\(\s*["']([^"']+)["']/g
    )) {
      events.push({ kind: "test", index: match.index, title: match[1] });
    }
    events.sort((a, b) => a.index - b.index);

    for (const event of events) {
      if (event.kind === "describe") {
        describes.push({
          title: event.title,
          bodyDepth: depthBefore + 1,
        });
        continue;
      }
      const active = describes.filter((item) => item.bodyDepth <= depthBefore + 1);
      const title = [...active.map((item) => item.title), event.title].join(" ");
      const found = suiteTagsIn(title);
      count += 1;
      if (found.length === 1) {
        counts[found[0]] += 1;
      }
      if (found.length !== 1) {
        failures.push(
          `${file}:${index + 1} has ${found.length === 0 ? "no" : found.join(" and ")} suite tag: ${title}`
        );
      }
    }

    depth += braceDelta(line);
    if (depth < 0) {
      depth = 0;
    }
    while (describes.length > 0 && describes[describes.length - 1].bodyDepth > depth) {
      describes.pop();
    }
  }
}

if (count === 0) {
  console.error("No Playwright tests found.");
  process.exit(1);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(
  `${count} Playwright tests, each with one suite tag (${counts.smoke} @smoke, ${counts.enduser} @enduser, ${counts.admin} @admin).`
);
