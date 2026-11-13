#!/usr/bin/env node
// Blocks numbered graphile-migrate commits unless a person explicitly allows
// them. In-progress SQL stays in packages/api/migrations/current.sql so
// parallel branches do not collide on the next migration number.
//
// Humans, immediately before merging to master:
//   SEASKETCH_ALLOW_MIGRATION_COMMIT=1 npm run db:commit
//
// Agents must not set that variable unless the user's own message told them
// to commit the numbered migration.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const OVERRIDE_ENV = "SEASKETCH_ALLOW_MIGRATION_COMMIT";
const COMMITTED_DIR = "packages/api/migrations/committed";

const AGENT_MESSAGE = [
  "Refused. Schema changes stay in packages/api/migrations/current.sql.",
  "Do not run npm run db:commit or graphile-migrate commit.",
  "Do not create, edit, stage, or commit files under packages/api/migrations/committed/.",
  "Do not retry this command and do not look for a bypass.",
  "A numbered migration is committed only when the user explicitly tells you to do that in their message, immediately before merging to master.",
  "Until then, edit current.sql and commit that file. npm run db:watch and npm run db:migrate are allowed.",
].join(" ");

const USER_MESSAGE = [
  "Blocked a committed graphile-migrate migration.",
  "In-progress SQL belongs in packages/api/migrations/current.sql so parallel branches do not collide on the next migration number.",
  "When you want this committed, immediately before merging to master, tell the agent to prefix the command with SEASKETCH_ALLOW_MIGRATION_COMMIT=1.",
].join(" ");

const REFUSE_COMMIT_MESSAGE = [
  "db:commit was refused. In-progress SQL stays in packages/api/migrations/current.sql.",
  "",
  "To commit the numbered migration immediately before merging to master:",
  "",
  "  SEASKETCH_ALLOW_MIGRATION_COMMIT=1 npm run db:commit",
  "",
  "Agents: do not set that variable and do not re-run this unless the user's own message explicitly told you to commit the numbered migration right before merging to master.",
  "",
].join("\n");

const PRECOMMIT_MESSAGE = [
  "Refusing to commit files under packages/api/migrations/committed/.",
  "In-progress schema changes belong in packages/api/migrations/current.sql.",
  "",
  "Commit a numbered migration only immediately before merging to master:",
  "",
  "  SEASKETCH_ALLOW_MIGRATION_COMMIT=1 git commit",
  "",
  "Agents: do not set that variable unless the user's own message explicitly told you to commit the numbered migration.",
  "",
].join("\n");

const PATH_KEYS = new Set([
  "path",
  "file_path",
  "filePath",
  "target_file",
  "target_notebook",
  "uri",
  "file",
  "notebook_path",
]);

const READ_TOOLS = new Set([
  "Read",
  "Grep",
  "Glob",
  "SemanticSearch",
  "ReadLints",
  "WebSearch",
  "WebFetch",
]);

const WRITE_VALUE_FLAGS = new Set([
  "-m",
  "--message",
  "-F",
  "--file",
  "--author",
  "--date",
  "--cleanup",
  "--template",
  "-t",
  "--reedit-message",
  "-c",
  "-C",
  "--reuse-message",
  "--fixup",
  "--squash",
  "--pathspec-from-file",
]);

export function allow() {
  return { continue: true, permission: "allow" };
}

export function deny(agentMessage = AGENT_MESSAGE, userMessage = USER_MESSAGE) {
  return {
    continue: true,
    permission: "deny",
    agent_message: agentMessage,
    user_message: userMessage,
  };
}

function posix(value) {
  return value.replace(/\\/g, "/");
}

export function isCommittedMigrationPath(value) {
  if (typeof value !== "string" || !value) return false;
  const normalized = posix(value).replace(/^\.\//, "");
  if (
    normalized === COMMITTED_DIR ||
    normalized.startsWith(`${COMMITTED_DIR}/`) ||
    normalized.endsWith(`/${COMMITTED_DIR}`) ||
    normalized.includes(`/${COMMITTED_DIR}/`)
  ) {
    return true;
  }
  return /(?:^|\/)migrations\/committed(?:\/|$)/.test(normalized);
}

export function splitShellSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote) {
      current += char;
      if (char === quote && command[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "\n" || char === ";") {
      segments.push(current);
      current = "";
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||" || char === "|") {
      segments.push(current);
      current = "";
      if (two === "&&" || two === "||") i += 1;
      continue;
    }
    current += char;
  }
  if (current.trim()) segments.push(current);
  return segments.map((segment) => segment.trim()).filter(Boolean);
}

export function tokenize(segment) {
  const tokens = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < segment.length; i += 1) {
    const char = segment[i];
    if (quote) {
      if (char === quote && segment[i - 1] !== "\\") quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function commandTokens(segment) {
  const tokens = tokenize(segment);
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (token === "sudo" || token === "command" || token === "env") {
      index += 1;
      continue;
    }
    break;
  }
  return tokens.slice(index);
}

// Prefix assignment applies to that command only (`VAR=1 npm run db:commit`).
// `export VAR=1` persists for later segments in the same shell command.
// A later dummy segment must not unlock an earlier commit.
function leadingOverride(segment) {
  const tokens = tokenize(segment);
  let active = false;
  let sawExport = false;
  for (const token of tokens) {
    if (token === `${OVERRIDE_ENV}=1`) {
      active = true;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) continue;
    if (token === "sudo" || token === "command" || token === "env") continue;
    if (token === "export") {
      sawExport = true;
      continue;
    }
    return { active, exported: sawExport && active };
  }
  return { active, exported: sawExport && active };
}

function bare(token) {
  return typeof token === "string" ? token.replace(/^[()]+|[()]+$/g, "") : token;
}

function isDbCommit(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    if (bare(tokens[i]) !== "db:commit") continue;
    const prev = bare(tokens[i - 1]);
    if (["run", "--", "npm", "pnpm", "yarn", "bun"].includes(prev)) return true;
    if (prev && prev.startsWith("-")) {
      const window = tokens.slice(Math.max(0, i - 8), i);
      if (window.some((token) => ["npm", "pnpm", "yarn", "bun", "run"].includes(token))) {
        return true;
      }
    }
  }
  return false;
}

function isGraphileMigrateCommit(tokens) {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = bare(tokens[i]);
    const base = token.split(/[/\\]/).pop();
    const isCli =
      base === "graphile-migrate" ||
      (base === "cli.js" && token.includes("graphile-migrate"));
    if (isCli && bare(tokens[i + 1]) === "commit") return true;
  }
  return false;
}

export function isMigrationCommitCommand(segment) {
  const tokens = commandTokens(segment);
  return isDbCommit(tokens) || isGraphileMigrateCommit(tokens);
}

function segmentWritesCommitted(segment) {
  const redirect = /(?:^|[\s;])>{1,2}\s*(['"]?)([^'">\s|&;]+)\1/g;
  let match = redirect.exec(segment);
  while (match) {
    if (isCommittedMigrationPath(match[2])) return true;
    match = redirect.exec(segment);
  }
  const tokens = commandTokens(segment);
  if (tokens.length === 0) return false;
  const base = tokens[0].split(/[/\\]/).pop();
  if (["cp", "mv", "install", "rsync"].includes(base)) {
    const operands = tokens.slice(1).filter((token) => !token.startsWith("-"));
    const dest = operands[operands.length - 1];
    return Boolean(dest && isCommittedMigrationPath(dest));
  }
  if (base === "tee") {
    return tokens.slice(1).some((token) => !token.startsWith("-") && isCommittedMigrationPath(token));
  }
  if (["rm", "rmdir", "mkdir", "touch", "truncate"].includes(base)) {
    return tokens.some((token) => isCommittedMigrationPath(token));
  }
  if (base === "sed" && tokens.some((token) => token === "-i" || token.startsWith("-i"))) {
    return tokens.some((token) => isCommittedMigrationPath(token));
  }
  if (["python", "python3", "node", "ruby", "perl", "php"].includes(base)) {
    return /migrations[/\\]committed(?:[/\\]|$)/.test(segment);
  }
  return false;
}

function parseGit(segment) {
  const tokens = commandTokens(segment);
  if (tokens.length === 0) return null;
  if (tokens[0].split(/[/\\]/).pop() !== "git") return null;
  let index = 1;
  let cwdOverride = null;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "-C" && tokens[index + 1]) {
      cwdOverride = tokens[index + 1];
      index += 2;
      continue;
    }
    if (token.startsWith("-C") && token !== "-C") {
      cwdOverride = token.slice(2);
      index += 1;
      continue;
    }
    if (token === "-c" || token === "--git-dir" || token === "--work-tree" || token === "--namespace") {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    break;
  }
  const sub = tokens[index];
  if (!sub) return null;
  return { sub, rest: tokens.slice(index + 1), cwdOverride };
}

function parseAdd(rest) {
  let all = false;
  let update = false;
  let dry = false;
  let patch = false;
  const pathspecs = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--") {
      pathspecs.push(...rest.slice(i + 1));
      break;
    }
    if (token === "--all" || token === "-A" || token === "--no-ignore-removal") {
      all = true;
      continue;
    }
    if (token === "--update" || token === "-u") {
      update = true;
      continue;
    }
    if (token === "--dry-run" || token === "-n") {
      dry = true;
      continue;
    }
    if (token === "--patch" || token === "-p") {
      patch = true;
      continue;
    }
    if (token === "--chmod" || token === "--pathspec-from-file" || token === "--pathspec-file-nul") {
      i += 1;
      continue;
    }
    if (token.startsWith("-") && !token.startsWith("--")) {
      if (token.includes("A")) all = true;
      if (token.includes("u")) update = true;
      if (token.includes("n")) dry = true;
      if (token.includes("p")) patch = true;
      continue;
    }
    if (token.startsWith("--")) continue;
    pathspecs.push(token);
  }
  return { all, update, dry, patch, pathspecs };
}

function parseCommit(rest) {
  let all = false;
  let dry = false;
  const pathspecs = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--") {
      pathspecs.push(...rest.slice(i + 1));
      break;
    }
    if (token === "--all" || token === "-a") {
      all = true;
      continue;
    }
    if (token === "--dry-run") {
      dry = true;
      continue;
    }
    if (token === "-am" || token === "-ma") {
      all = true;
      i += 1;
      continue;
    }
    if (token.startsWith("--message=") || token.startsWith("--file=") || token.startsWith("--author=")) {
      continue;
    }
    if (WRITE_VALUE_FLAGS.has(token)) {
      i += 1;
      continue;
    }
    if (token.startsWith("-m") && token !== "-m" && !token.startsWith("--")) continue;
    if (token.startsWith("-") && !token.startsWith("--") && token.includes("a")) {
      all = true;
      if (token.includes("m") || token.includes("F")) i += 1;
      continue;
    }
    if (token.startsWith("-")) continue;
    pathspecs.push(token);
  }
  return { all, dry, pathspecs };
}

function resolveRepo(start) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: start,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitZ(repo, args) {
  const out = execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out.split("\0").map((entry) => entry.trim()).filter(Boolean);
}

function loadState(repo) {
  return {
    staged: gitZ(repo, ["diff", "--cached", "--name-only", "-z", "--", COMMITTED_DIR]),
    unstaged: gitZ(repo, ["diff", "--name-only", "-z", "--", COMMITTED_DIR]),
    untracked: gitZ(repo, ["ls-files", "--others", "--exclude-standard", "-z", "--", COMMITTED_DIR]),
  };
}

function cwdPrefix(repo, cwd) {
  const rel = path.relative(repo, cwd || repo);
  if (!rel || rel === ".") return "";
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return posix(rel);
}

function normalizeSpec(spec, repo, cwd) {
  let normalized = posix(spec);
  if (normalized === "." || normalized === "./") return ".";
  if (path.isAbsolute(spec) || normalized.startsWith("/")) {
    const rel = path.relative(repo, spec);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return posix(rel);
  }
  normalized = normalized.replace(/^\.\//, "");
  const prefix = cwdPrefix(repo, cwd);
  if (prefix == null) return normalized;
  if (!prefix) return normalized;
  if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized;
  return `${prefix}/${normalized}`.replace(/\/+/g, "/");
}

function covers(spec, file, repo, cwd) {
  const normalized = normalizeSpec(spec, repo, cwd);
  if (normalized == null) return false;
  const candidate = posix(file);
  if (normalized === ".") {
    const prefix = cwdPrefix(repo, cwd);
    if (prefix == null) return false;
    if (!prefix) return true;
    return candidate === prefix || candidate.startsWith(`${prefix}/`);
  }
  if (normalized.includes("*") || normalized.includes("?")) {
    const rawPrefix = normalized.split(/[*?]/)[0];
    if (!rawPrefix) return true;
    const prefix = rawPrefix.endsWith("/") ? rawPrefix.slice(0, -1) : rawPrefix;
    return candidate === prefix || candidate.startsWith(`${prefix}/`) || candidate.startsWith(rawPrefix);
  }
  const exact = normalized.replace(/\/$/, "");
  return candidate === exact || candidate.startsWith(`${exact}/`);
}

function selected(files, pathspecs, repo, cwd) {
  if (!pathspecs.length) return files;
  return files.filter((file) => pathspecs.some((spec) => covers(spec, file, repo, cwd)));
}

function addWouldStage(state, parsed, repo, cwd) {
  if (parsed.dry) return false;
  if (parsed.patch) {
    return state.staged.length + state.unstaged.length + state.untracked.length > 0;
  }
  let pool = [];
  if (parsed.pathspecs.length === 0 && parsed.all) {
    pool = [...state.unstaged, ...state.untracked];
  } else if (parsed.pathspecs.length === 0 && parsed.update) {
    pool = [...state.unstaged];
  } else if (parsed.pathspecs.length) {
    const source = parsed.update && !parsed.all
      ? state.unstaged
      : [...state.unstaged, ...state.untracked];
    pool = selected(source, parsed.pathspecs, repo, cwd);
  }
  return pool.length > 0;
}

function commitWouldInclude(state, parsed, repo, cwd) {
  if (parsed.dry) return false;
  if (parsed.pathspecs.length) {
    const pool = [...state.staged, ...state.unstaged, ...state.untracked];
    return selected(pool, parsed.pathspecs, repo, cwd).length > 0;
  }
  if (state.staged.length > 0) return true;
  if (parsed.all && state.unstaged.length > 0) return true;
  return false;
}

function gitStart(cwd, cwdOverride) {
  if (!cwdOverride) return cwd || process.cwd();
  return path.resolve(cwd || process.cwd(), cwdOverride);
}

export function evaluateShell({ command, cwd }) {
  if (typeof command !== "string" || !command.trim()) return allow();
  if (process.env[OVERRIDE_ENV] === "1") return allow();
  const startCwd = cwd || process.cwd();
  const states = new Map();
  const stateFor = (repo) => {
    if (!states.has(repo)) states.set(repo, loadState(repo));
    return states.get(repo);
  };

  let stickyOverride = false;
  for (const segment of splitShellSegments(command)) {
    const lead = leadingOverride(segment);
    if (lead.active && lead.exported) stickyOverride = true;
    if (stickyOverride || lead.active) continue;
    if (isMigrationCommitCommand(segment) || segmentWritesCommitted(segment)) return deny();
    const git = parseGit(segment);
    if (!git) continue;
    if (!["add", "commit", "mv", "rm"].includes(git.sub)) continue;
    const start = gitStart(startCwd, git.cwdOverride);
    const repo = resolveRepo(start);
    if (!repo) {
      const literal = [git.sub, ...git.rest].some((token) => isCommittedMigrationPath(token));
      if (literal) return deny();
      continue;
    }
    if (git.sub === "mv" || git.sub === "rm") {
      const hits = git.rest.some((token) => {
        if (token.startsWith("-")) return false;
        return isCommittedMigrationPath(token) || isCommittedMigrationPath(normalizeSpec(token, repo, start) || "");
      });
      if (hits) return deny();
      continue;
    }
    const state = stateFor(repo);
    if (git.sub === "add" && addWouldStage(state, parseAdd(git.rest), repo, start)) return deny();
    if (git.sub === "commit" && commitWouldInclude(state, parseCommit(git.rest), repo, start)) {
      return deny();
    }
  }
  return allow();
}

function collectKeyedStrings(value, keys, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectKeyedStrings(item, keys, out);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key) && typeof child === "string") out.push(child);
    else if (child && typeof child === "object") collectKeyedStrings(child, keys, out);
  }
  return out;
}

function collectAllStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectAllStrings(item, out);
    return out;
  }
  for (const child of Object.values(value)) collectAllStrings(child, out);
  return out;
}

function looksLikeCommittedDiff(text) {
  return /^(?:\+\+\+|---) [ab]\/(?:packages\/api\/)?migrations\/committed\//m.test(text)
    || /^diff --git a\/(?:packages\/api\/)?migrations\/committed\//m.test(text);
}

export function evaluateTool(payload) {
  const toolName = payload.tool_name || "";
  if (READ_TOOLS.has(toolName)) return allow();
  const paths = collectKeyedStrings(payload.tool_input, PATH_KEYS);
  if (paths.some((entry) => isCommittedMigrationPath(entry))) return deny();
  if (toolName === "ApplyPatch" || toolName === "Edit" || toolName === "StrReplace") {
    const blobs = collectAllStrings(payload.tool_input);
    if (blobs.some(looksLikeCommittedDiff)) return deny();
  }
  return allow();
}

export function evaluatePayload(payload) {
  if (!payload || typeof payload !== "object") return allow();
  if (payload.tool_name === "Shell") {
    const command = payload.tool_input && payload.tool_input.command
      ? payload.tool_input.command
      : payload.command;
    if (typeof command === "string") {
      const cwd = payload.cwd || (payload.tool_input && payload.tool_input.working_directory);
      return evaluateShell({ command, cwd });
    }
  }
  if (typeof payload.command === "string" && payload.tool_name == null) {
    return evaluateShell(payload);
  }
  if (payload.tool_name) return evaluateTool(payload);
  return allow();
}

function rawLooksRisky(raw) {
  return raw.includes("migrations/committed")
    || raw.includes("migrations\\committed")
    || raw.includes("db:commit")
    || /graphile-migrate[^]{0,80}\bcommit\b/.test(raw);
}

export function preCommit(repoRoot = process.cwd()) {
  if (process.env[OVERRIDE_ENV] === "1") return 0;
  const repo = resolveRepo(repoRoot);
  if (!repo) return 0;
  const staged = gitZ(repo, ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACDMRTUXB", "--", COMMITTED_DIR]);
  if (staged.length === 0) return 0;
  process.stderr.write(PRECOMMIT_MESSAGE);
  return 1;
}

function refuseCommit() {
  if (process.env[OVERRIDE_ENV] === "1") return 0;
  process.stderr.write(`${REFUSE_COMMIT_MESSAGE}\n`);
  return 1;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function hook() {
  const raw = await readStdin();
  let decision;
  try {
    const payload = raw.trim() ? JSON.parse(raw) : {};
    decision = evaluatePayload(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    decision = rawLooksRisky(raw)
      ? deny(`Migration guard failed closed (${message}). Leave SQL in packages/api/migrations/current.sql.`)
      : allow();
  }
  process.stdout.write(JSON.stringify(decision));
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  const mode = process.argv[2] || "hook";
  if (mode === "pre-commit") process.exit(preCommit());
  if (mode === "refuse-commit") process.exit(refuseCommit());
  if (mode === "hook") {
    await hook();
    return;
  }
  process.stderr.write(`Unknown migration-commit-guard mode: ${mode}\n`);
  process.exit(2);
}

if (isCli()) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
