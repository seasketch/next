#!/usr/bin/env node
// Every Playwright test carries exactly one suite tag: @smoke, @enduser, or
// @admin. Smoke is not also an end-user or admin test. A test with no suite
// tag would run in none of the CI jobs.
//
// Every @enduser test also carries exactly one theme tag, and unit-tests.yml
// has one job for that tag ("End User - Access"). @bundler is additive and
// is not a theme. `--github-output` prints the group list as JSON.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests");
const workflowPath = path.resolve(testsDir, "../../../.github/workflows/unit-tests.yml");
const suiteTags = ["smoke", "enduser", "admin"];
const suiteTagSet = new Set(suiteTags);
const additiveTags = new Set(["bundler"]);
const githubOutput = process.argv.includes("--github-output");

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

function tagsIn(title) {
  return [...title.matchAll(/@([a-z0-9-]+)\b/g)].map((match) => match[1]);
}

function titleFor(tag) {
  return tag
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const failures = [];
const counts = { smoke: 0, enduser: 0, admin: 0 };
const themeCounts = {};
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
      const tags = tagsIn(title);
      const found = tags.filter((tag) => suiteTagSet.has(tag));
      count += 1;
      if (found.length === 1) {
        counts[found[0]] += 1;
      }
      if (found.length !== 1) {
        failures.push(
          `${file}:${index + 1} has ${found.length === 0 ? "no" : found.join(" and ")} suite tag: ${title}`
        );
      }
      if (found.length === 1 && found[0] === "enduser") {
        const themes = tags.filter((tag) => !suiteTagSet.has(tag) && !additiveTags.has(tag));
        if (themes.length !== 1) {
          failures.push(
            `${file}:${index + 1} has ${themes.length === 0 ? "no" : themes.join(" and ")} theme tag: ${title}`
          );
        } else {
          themeCounts[themes[0]] = (themeCounts[themes[0]] || 0) + 1;
        }
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

const groups = Object.keys(themeCounts)
  .sort()
  .map((tag) => ({ tag, title: titleFor(tag) }));
const declared = [
  ...fs.readFileSync(workflowPath, "utf8").matchAll(/^\s*theme:\s*([a-z0-9-]+)\s*$/gm),
].map((match) => match[1]);
const declaredSet = new Set(declared);
if (declared.length !== declaredSet.size) {
  failures.push(`duplicate theme job in ${path.basename(workflowPath)}`);
}
for (const tag of groups.map((group) => group.tag)) {
  if (!declaredSet.has(tag)) {
    failures.push(`@${tag} has no "End User - ${titleFor(tag)}" job in ${path.basename(workflowPath)}`);
  }
}
for (const tag of declared) {
  if (!themeCounts[tag]) {
    failures.push(`theme job @${tag} matches no @enduser test`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

const themeList = groups.map((group) => `${group.title} (${themeCounts[group.tag]})`).join(", ");
const summary = `${count} Playwright tests, each with one suite tag (${counts.smoke} @smoke, ${counts.enduser} @enduser, ${counts.admin} @admin). End-user groups: ${themeList}.`;

if (githubOutput) {
  const line = `groups=${JSON.stringify(groups)}\n`;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  } else {
    process.stdout.write(line);
  }
  console.error(summary);
} else {
  console.log(summary);
}
