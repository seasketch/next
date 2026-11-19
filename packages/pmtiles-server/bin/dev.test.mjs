import assert from "node:assert/strict";
import test from "node:test";
import { launchUntilUnlocked } from "./dev.mjs";

test("a locked persistence open is retried, then a later exit is returned", async () => {
  const exits = [
    { code: 1, signal: null, locked: true },
    { code: 1, signal: null, locked: true },
    { code: 0, signal: null, locked: false },
  ];
  const retries = [];
  const outcome = await launchUntilUnlocked({
    attempts: 4,
    pauseMs: 0,
    shouldStop: () => false,
    onRetry: (attempt) => retries.push(attempt),
    spawnChild: async () => exits.shift(),
  });
  assert.deepEqual(outcome, { code: 0, signal: null, locked: false });
  assert.deepEqual(retries, [1, 2]);
});

test("an exit that is not a lock is not retried", async () => {
  let calls = 0;
  const outcome = await launchUntilUnlocked({
    attempts: 4,
    pauseMs: 0,
    shouldStop: () => false,
    onRetry: () => {
      throw new Error("should not retry");
    },
    spawnChild: async () => {
      calls += 1;
      return { code: 1, signal: null, locked: false };
    },
  });
  assert.equal(calls, 1);
  assert.equal(outcome.code, 1);
});

test("a stop request is not retried", async () => {
  let calls = 0;
  const outcome = await launchUntilUnlocked({
    attempts: 4,
    pauseMs: 0,
    shouldStop: () => true,
    onRetry: () => {
      throw new Error("should not retry");
    },
    spawnChild: async () => {
      calls += 1;
      return { code: null, signal: "SIGINT", locked: true };
    },
  });
  assert.equal(calls, 1);
  assert.equal(outcome.signal, "SIGINT");
});
