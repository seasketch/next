import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bandIds, buildRunbook, formatRunbook, TEMPLATE_ID } from "./runbook";

describe("GMW runbook", () => {
  it("names 41 annual bands from 1985", () => {
    const bands = bandIds();
    assert.equal(bands[0], "1985");
    assert.equal(bands[bands.length - 1], "2025");
    assert.equal(bands.length, 41);
  });

  it("prints public dataLibrary URLs and no SQL", () => {
    const runbook = buildRunbook({ release: "v4.1.2" });
    assert.equal(runbook.templateId, TEMPLATE_ID);
    assert.match(
      runbook.urls.displayTilejson,
      /dataLibrary\/gmw-global\.json$/,
    );
    assert.match(runbook.urls.displayPreview, /dataLibrary\/gmw-global$/);
    const text = formatRunbook(runbook);
    assert.match(text, /register hosted products/);
    assert.doesNotMatch(text, /UPDATE data_sources/i);
    assert.doesNotMatch(text, /replace_data_source\(/);
  });
});
