import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { restorePackageJsons, snapshotPackageJsons } from "./lerna-bootstrap.mjs";

describe("restorePackageJsons", () => {
  it("puts back a manifest lerna stripped, and leaves an unchanged one alone", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lerna-restore-"));
    const kept = path.join(dir, "kept.json");
    const stripped = path.join(dir, "stripped.json");
    writeFileSync(kept, '{"name":"kept","scripts":{"start":"ok"}}\n');
    writeFileSync(stripped, '{"name":"stripped","scripts":{"build":"ok"}}\n');
    const snapshots = snapshotPackageJsons([kept, stripped]);

    writeFileSync(stripped, '{"name":"stripped"}\n');
    writeFileSync(`${stripped}.lerna_backup`, snapshots.get(stripped));

    const restored = restorePackageJsons(snapshots);

    assert.deepEqual(restored, [stripped]);
    assert.equal(readFileSync(stripped, "utf8"), '{"name":"stripped","scripts":{"build":"ok"}}\n');
    assert.equal(readFileSync(kept, "utf8"), '{"name":"kept","scripts":{"start":"ok"}}\n');
    assert.equal(
      (() => {
        try {
          readFileSync(`${stripped}.lerna_backup`);
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});
