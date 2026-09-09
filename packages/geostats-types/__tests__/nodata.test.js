/**
 * Tests for data-table no-data sentinels. Build first: `npm run build && npm test`.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isDataTableNodataValue,
  isDataTableNodataConfig,
  normalizeNodataValues,
  nodataValuesEqual,
  nodataValueMatches,
} = require("../dist/lib/nodata.js");

test("isDataTableNodataValue rejects null, empty, and non-finite numbers", () => {
  assert.equal(isDataTableNodataValue(null), false);
  assert.equal(isDataTableNodataValue(undefined), false);
  assert.equal(isDataTableNodataValue(""), false);
  assert.equal(isDataTableNodataValue(Number.NaN), false);
  assert.equal(isDataTableNodataValue(Infinity), false);
  assert.equal(isDataTableNodataValue({}), false);
  assert.equal(isDataTableNodataValue(-88), true);
  assert.equal(isDataTableNodataValue("NA"), true);
});

test("isDataTableNodataConfig requires a values array", () => {
  assert.equal(isDataTableNodataConfig(null), false);
  assert.equal(isDataTableNodataConfig(undefined), false);
  assert.equal(isDataTableNodataConfig([]), false);
  assert.equal(isDataTableNodataConfig({ values: [-88, "NA"] }), true);
  assert.equal(isDataTableNodataConfig({ values: [null] }), false);
});

test("normalizeNodataValues collapses numeric duplicates and ignores junk", () => {
  assert.deepEqual(normalizeNodataValues(null), []);
  assert.deepEqual(normalizeNodataValues(undefined), []);
  assert.deepEqual(
    normalizeNodataValues({ values: [-88, "-88", "NA", "", null] }),
    [-88, "NA"]
  );
  assert.deepEqual(normalizeNodataValues([-99, -99, "x"]), [-99, "x"]);
});

test("nodataValuesEqual is order-insensitive", () => {
  assert.equal(nodataValuesEqual([-88, "NA"], { values: ["NA", -88] }), true);
  assert.equal(nodataValuesEqual([-88], [-99]), false);
});

test("nodataValueMatches numbers, numeric strings, and literals", () => {
  assert.equal(nodataValueMatches(-88, [-88]), true);
  assert.equal(nodataValueMatches("-88", [-88]), true);
  assert.equal(nodataValueMatches(-88.0, [-88]), true);
  assert.equal(nodataValueMatches("NA", ["NA"]), true);
  assert.equal(nodataValueMatches("na", ["NA"]), false);
  assert.equal(nodataValueMatches(null, [-88]), false);
  assert.equal(nodataValueMatches(undefined, [-88]), false);
  assert.equal(nodataValueMatches("", [-88]), false);
  assert.equal(nodataValueMatches("CC-ADLC", [-88]), false);
});
