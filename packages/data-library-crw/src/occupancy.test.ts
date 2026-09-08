import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";
import { loadOccupancy, occupancyPath, saveOccupancy } from "./occupancy";

describe("CRW occupancy", () => {
  it("reads occupancy.json when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "crw-occ-"));
    saveOccupancy(dir, [{ z: 5, x: 29, y: 17 }]);
    assert.deepEqual(loadOccupancy(dir), [{ z: 5, x: 29, y: 17 }]);
  });

  it("falls back to existing MRT tile paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "crw-occ-"));
    const tileDir = join(dir, "5", "29");
    mkdirSync(tileDir, { recursive: true });
    writeFileSync(join(tileDir, "17.mrt"), "x");
    assert.deepEqual(loadOccupancy(dir), [{ z: 5, x: 29, y: 17 }]);
    assert.equal(occupancyPath(dir).endsWith("occupancy.json"), true);
  });
});
