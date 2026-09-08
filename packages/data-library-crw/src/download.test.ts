import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { downloadPath } from "./download";
import { requireProduct } from "./products";

describe("CRW download paths", () => {
  it("nests files by product id", () => {
    assert.equal(
      downloadPath("/tmp/crw", requireProduct("dhw-max"), "2024"),
      "/tmp/crw/dhw-max/ct5km_dhw-max_v3.1_2024.nc",
    );
    assert.equal(
      downloadPath("/tmp/crw", requireProduct("dhw-daily"), "2026-09-03"),
      "/tmp/crw/dhw-daily/ct5km_dhw_v3.1_20260903.nc",
    );
    assert.equal(
      downloadPath("/tmp/crw", requireProduct("dhw-weekly-all"), "1986-01-02"),
      "/tmp/crw/dhw-daily/ct5km_dhw_v3.1_19860102.nc",
    );
    assert.equal(
      downloadPath("/tmp/crw", requireProduct("sst-weekly-24"), "2026-09-03"),
      "/tmp/crw/sst-weekly-24/coraltemp_v3.1_20260903.nc",
    );
  });
});
