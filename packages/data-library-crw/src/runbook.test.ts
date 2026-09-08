import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodsFor, requireProduct, yearsFor } from "./products";
import { buildRunbook, formatRunbook } from "./runbook";

describe("CRW runbook", () => {
  it("prints public dataLibrary URLs and no SQL", () => {
    const product = requireProduct("dhw-max");
    const bands = yearsFor(product, 1986, 2025).map(String);
    const runbook = buildRunbook({ product, bands });
    assert.equal(runbook.productId, "dhw-max");
    assert.match(
      runbook.urls.displayTilejson,
      /dataLibrary\/crw-dhw-max-v1\.json$/,
    );
    assert.match(runbook.urls.displayPreview, /dataLibrary\/crw-dhw-max-v1$/);
    assert.equal(runbook.temporal.coverage.start, "1986");
    assert.equal(runbook.temporal.coverage.end, "2026");
    assert.equal(runbook.temporal.coverage.precision, "year");
    assert.equal(runbook.temporal.mapping.bands[0]?.id, "1986");
    const text = formatRunbook(runbook);
    assert.match(text, /dataLibrary\/crw-dhw-max-v1\.pmtiles/);
    assert.match(text, /register hosted products/);
    assert.doesNotMatch(text, /UPDATE data_sources/i);
    assert.doesNotMatch(text, /replace_data_source\(/);
  });

  it("uses day precision for daily DHW", () => {
    const product = requireProduct("dhw-daily");
    const bands = periodsFor(product, "2026-08-04", "2026-09-03");
    const runbook = buildRunbook({ product, bands });
    assert.equal(runbook.temporal.coverage.start, "2026-08-04");
    assert.equal(runbook.temporal.coverage.end, "2026-09-04");
    assert.equal(runbook.temporal.coverage.precision, "day");
    assert.equal(runbook.temporal.mapping.bands[0]?.id, "2026-08-04");
    assert.match(
      runbook.urls.displayArchive,
      /dataLibrary\/crw-dhw-daily-v1\.pmtiles$/,
    );
  });
});
