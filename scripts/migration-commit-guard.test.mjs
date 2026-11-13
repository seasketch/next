import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  OVERRIDE_ENV,
  evaluatePayload,
  evaluateShell,
  evaluateTool,
  isMigrationCommitCommand,
} from "./migration-commit-guard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guardScript = path.join(repoRoot, "scripts/migration-commit-guard.mjs");
const installScript = path.join(repoRoot, "scripts/install-git-hooks.mjs");
const hookScript = path.join(repoRoot, ".cursor/hooks/block-committed-migration.sh");

delete process.env[OVERRIDE_ENV];

function git(repo, args) {
  execFileSync("git", args, { cwd: repo, stdio: "pipe" });
}

function initRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "mig-guard-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "guard@example.com"]);
  git(dir, ["config", "user.name", "Guard"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  const committed = path.join(dir, "packages/api/migrations/committed");
  mkdirSync(committed, { recursive: true });
  writeFileSync(path.join(dir, "packages/api/migrations/current.sql"), "-- wip\n");
  writeFileSync(path.join(committed, "000001.sql"), "-- old\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "init"]);
  return dir;
}

function decision(command, cwd) {
  return evaluateShell({ command, cwd });
}

function assertAllowed(command, cwd) {
  const result = decision(command, cwd);
  assert.equal(result.permission, "allow", command);
}

function assertDenied(command, cwd) {
  const result = decision(command, cwd);
  assert.equal(result.permission, "deny", command);
  assert.equal(result.agent_message.includes(OVERRIDE_ENV), false);
  assert.equal(result.user_message.includes(OVERRIDE_ENV), true);
}

test("db:commit and graphile-migrate commit are refused", () => {
  assert.equal(isMigrationCommitCommand("npm run db:migrate"), false);
  assert.equal(isMigrationCommitCommand("npm run db:watch"), false);
  assert.equal(isMigrationCommitCommand("npm run db:uncommit"), false);
  assert.equal(isMigrationCommitCommand("graphile-migrate uncommit"), false);
  assert.equal(isMigrationCommitCommand("npm run db:commit"), true);
  assert.equal(isMigrationCommitCommand("npm run --silent db:commit"), true);
  assert.equal(isMigrationCommitCommand("npm run db:commit --workspace @seasketch/api"), true);
  assert.equal(isMigrationCommitCommand("yarn db:commit"), true);
  assert.equal(isMigrationCommitCommand("npx graphile-migrate commit"), true);
  assert.equal(
    isMigrationCommitCommand("node node_modules/graphile-migrate/dist/cli.js commit"),
    true
  );
  assertDenied("npm run db:commit");
  assertDenied("npm run db:commit -- --message add-column");
  assertDenied("(cd packages/api && npm run db:commit)");
  assertDenied("graphile-migrate commit");
  assertAllowed("npm run db:migrate");
  assertAllowed("npm run db:watch");
  assertAllowed("npm run db:uncommit");
  assertAllowed("graphile-migrate migrate");
  assertAllowed("graphile-migrate uncommit");
});

test("the override applies only to the command that carries it", () => {
  assertAllowed("SEASKETCH_ALLOW_MIGRATION_COMMIT=1 npm run db:commit");
  assertAllowed("export SEASKETCH_ALLOW_MIGRATION_COMMIT=1 && npm run db:commit");
  assertDenied("npm run db:commit && SEASKETCH_ALLOW_MIGRATION_COMMIT=1 true");
});

test("shell writes into migrations/committed are refused and reads are allowed", () => {
  assertDenied("echo hi > packages/api/migrations/committed/000465.sql");
  assertDenied("cat > packages/api/migrations/committed/000465.sql << 'EOF'\nselect 1;\nEOF");
  assertDenied("cp /tmp/current.sql packages/api/migrations/committed/000465.sql");
  assertDenied("python3 -c \"open('packages/api/migrations/committed/000465.sql','w').write('x')\"");
  assertAllowed("cat packages/api/migrations/committed/000001.sql");
  assertAllowed("cp packages/api/migrations/committed/000001.sql /tmp/000001.sql");
  assertAllowed("git diff -- packages/api/migrations/committed/000001.sql");
  assertAllowed("git status -- packages/api/migrations/committed");
  assertAllowed("git log -1 -- packages/api/migrations/committed/000001.sql");
});

test("file tools cannot write committed migrations", () => {
  const denied = evaluateTool({
    tool_name: "Write",
    tool_input: {
      path: "packages/api/migrations/committed/000465.sql",
      contents: "-- no\n",
    },
  });
  assert.equal(denied.permission, "deny");

  const current = evaluateTool({
    tool_name: "Write",
    tool_input: {
      path: "packages/api/migrations/current.sql",
      contents: "-- see packages/api/migrations/committed for numbered files\n",
    },
  });
  assert.equal(current.permission, "allow");

  const edited = evaluateTool({
    tool_name: "StrReplace",
    tool_input: {
      path: "packages/api/migrations/committed/000001.sql",
      old_string: "-- old",
      new_string: "-- new",
    },
  });
  assert.equal(edited.permission, "deny");

  const read = evaluateTool({
    tool_name: "Read",
    tool_input: { path: "packages/api/migrations/committed/000001.sql" },
  });
  assert.equal(read.permission, "allow");

  const removed = evaluatePayload({
    tool_name: "Delete",
    tool_input: { path: "/work/packages/api/migrations/committed/000001.sql" },
  });
  assert.equal(removed.permission, "deny");
});

test("git commits of current.sql stay allowed when numbered files are left alone", () => {
  const dir = initRepo();
  try {
    writeFileSync(path.join(dir, "packages/api/migrations/current.sql"), "-- next\n");
    assertAllowed(
      'git add packages/api/migrations/current.sql && git commit -m "wip"',
      dir
    );
    assertAllowed('git commit -am "wip"', dir);
    writeFileSync(path.join(dir, "packages/api/migrations/committed/000465.sql"), "-- new\n");
    assertAllowed("git add packages/api/migrations/current.sql", dir);
    assertDenied("git add -A", dir);
    assertDenied("git add packages/api/migrations/committed/000465.sql", dir);
    assertDenied("git add .", dir);
    assertDenied(
      "git add migrations/committed/000465.sql",
      path.join(dir, "packages/api")
    );
    git(dir, ["add", "packages/api/migrations/committed/000465.sql"]);
    assertDenied('git commit -m "add migration"', dir);
    assertDenied('git commit -m "SEASKETCH_ALLOW_MIGRATION_COMMIT=1"', dir);
    assertAllowed(
      'git commit -m "wip only" -- packages/api/migrations/current.sql',
      dir
    );
    assertDenied('git commit -am "fix numbered file"', dir);
    assertAllowed("git commit --dry-run -m \"add migration\"", dir);
    assertDenied(
      "git mv packages/api/migrations/current.sql packages/api/migrations/committed/000466.sql",
      dir
    );
    assertDenied("git rm packages/api/migrations/committed/000001.sql", dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a modified numbered migration cannot be folded into git commit -a", () => {
  const dir = initRepo();
  try {
    writeFileSync(path.join(dir, "packages/api/migrations/committed/000001.sql"), "-- edited\n");
    assertDenied('git commit -am "fix migration"', dir);
    assertDenied("git add -u", dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuse-commit and pre-commit honor the override", () => {
  const dir = initRepo();
  try {
    const refused = spawnSync(process.execPath, [guardScript, "refuse-commit"], {
      encoding: "utf8",
      env: { ...process.env, [OVERRIDE_ENV]: "" },
    });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, new RegExp(OVERRIDE_ENV));

    const allowed = spawnSync(process.execPath, [guardScript, "refuse-commit"], {
      encoding: "utf8",
      env: { ...process.env, [OVERRIDE_ENV]: "1" },
    });
    assert.equal(allowed.status, 0);

    writeFileSync(path.join(dir, "packages/api/migrations/committed/000465.sql"), "-- new\n");
    git(dir, ["add", "packages/api/migrations/committed/000465.sql"]);
    const blocked = spawnSync(process.execPath, [guardScript, "pre-commit"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, [OVERRIDE_ENV]: "" },
    });
    assert.equal(blocked.status, 1);

    const passed = spawnSync(process.execPath, [guardScript, "pre-commit"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, [OVERRIDE_ENV]: "1" },
    });
    assert.equal(passed.status, 0);

    git(dir, ["reset", "HEAD"]);
    writeFileSync(path.join(dir, "packages/api/migrations/current.sql"), "-- still wip\n");
    git(dir, ["add", "packages/api/migrations/current.sql"]);
    const currentOnly = spawnSync(process.execPath, [guardScript, "pre-commit"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, [OVERRIDE_ENV]: "" },
    });
    assert.equal(currentOnly.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Cursor hook returns deny JSON and does not name the override to the agent", () => {
  const result = spawnSync("bash", [hookScript], {
    input: JSON.stringify({ command: "npm run db:commit", cwd: repoRoot }),
    encoding: "utf8",
    cwd: repoRoot,
    env: { ...process.env, [OVERRIDE_ENV]: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.permission, "deny");
  assert.equal(payload.agent_message.includes(OVERRIDE_ENV), false);

  const allowed = spawnSync("bash", [hookScript], {
    input: JSON.stringify({
      command: "SEASKETCH_ALLOW_MIGRATION_COMMIT=1 npm run db:commit",
      cwd: repoRoot,
    }),
    encoding: "utf8",
    cwd: repoRoot,
    env: { ...process.env, [OVERRIDE_ENV]: "" },
  });
  assert.equal(JSON.parse(allowed.stdout).permission, "allow");
});

test("package scripts and hook config keep the guard in front of commit", () => {
  const api = JSON.parse(readFileSync(path.join(repoRoot, "packages/api/package.json"), "utf8"));
  assert.match(api.scripts["db:commit"], /migration-commit-guard\.mjs refuse-commit && graphile-migrate commit/);
  assert.equal(api.scripts["db:migrate"], "graphile-migrate migrate");
  assert.equal(api.scripts["db:uncommit"], "graphile-migrate uncommit");

  const root = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.match(root.scripts.prepare, /install-git-hooks\.mjs/);
  assert.match(root.scripts.prepare, /existsSync\('scripts\/install-git-hooks\.mjs'\)/);

  const hooks = JSON.parse(readFileSync(path.join(repoRoot, ".cursor/hooks.json"), "utf8"));
  const shellHook = hooks.hooks.beforeShellExecution[0];
  const matcher = new RegExp(shellHook.matcher);
  assert.equal(shellHook.failClosed, true);
  assert.equal(matcher.test("npm run db:commit"), true);
  assert.equal(matcher.test("git commit -m hi"), true);
  assert.equal(matcher.test("git -C /tmp/repo commit -m hi"), true);
  assert.equal(matcher.test("git status"), false);
  assert.equal(matcher.test("npm run db:migrate"), false);
});

test("prepare succeeds in a tree that only has package.json", () => {
  const root = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const dir = mkdtempSync(path.join(tmpdir(), "mig-prepare-"));
  try {
    const result = spawnSync("sh", ["-c", root.scripts.prepare], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("install-git-hooks points the clone at .githooks", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mig-hooks-"));
  try {
    git(dir, ["init", "-b", "main"]);
    const result = spawnSync(process.execPath, [installScript], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const hooksPath = execFileSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    assert.equal(hooksPath, ".githooks");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
