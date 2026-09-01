/**
 * Tests for the temporal metadata module (lib/temporal.ts), run against the
 * compiled output. Build first: `npm run build && npm test`.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseTemporalIso,
  isTemporalIso,
  expandTemporalIso,
  expandTemporalValue,
  intervalsIntersect,
  temporalValueIntersects,
  expandTemporalClock,
  finerPrecision,
  coarserPrecision,
  unionTemporalCoverage,
  isTemporalPrecision,
  isTemporalGranularity,
  isTemporalInstant,
  isTemporalInterval,
  isTemporalValue,
  isTemporalStep,
  isTemporalAvailability,
  isTemporalMapping,
  isTemporalInfo,
  isTemporalClock,
  createLayerYearTemporalInfo,
  isTemporalDateFormat,
  isDataTableTemporalSourceColumns,
  isLegacyTemporalSourceColumns,
  isDataTableTemporalConfig,
  toDataTableTemporalSourceColumns,
  deriveWhenIntervalFromRow,
  nativePrecisionFromSourceColumns,
  sourceColumnNames,
  coverageFromDerivedIntervals,
  availabilityFromDerivedIntervals,
  formatTemporalIsoFromMs,
} = require("../dist/lib/temporal.js");

const utc = (...args) => Date.UTC(...args);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("parseTemporalIso accepts all reduced-precision forms", () => {
  assert.deepEqual(parseTemporalIso("2018"), {
    year: 2018,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  });
  assert.deepEqual(parseTemporalIso("2018-06"), {
    year: 2018,
    month: 6,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  });
  assert.deepEqual(parseTemporalIso("2018-06-15"), {
    year: 2018,
    month: 6,
    day: 15,
    hour: 0,
    minute: 0,
    second: 0,
  });
  assert.deepEqual(parseTemporalIso("2018-06-15T14:30:00Z"), {
    year: 2018,
    month: 6,
    day: 15,
    hour: 14,
    minute: 30,
    second: 0,
  });
  // Fractional seconds and missing Z are tolerated (UTC assumed).
  assert.ok(parseTemporalIso("2018-06-15T14:30:00.123Z"));
  assert.ok(parseTemporalIso("2018-06-15T14:30:00"));
});

test("parseTemporalIso rejects invalid input", () => {
  assert.equal(parseTemporalIso(null), null);
  assert.equal(parseTemporalIso(undefined), null);
  assert.equal(parseTemporalIso(2018), null);
  assert.equal(parseTemporalIso({}), null);
  assert.equal(parseTemporalIso(""), null);
  assert.equal(parseTemporalIso("18"), null);
  assert.equal(parseTemporalIso("2018-13"), null); // month out of range
  assert.equal(parseTemporalIso("2018-02-30"), null); // invalid calendar date
  assert.equal(parseTemporalIso("2018-06-15T25:00:00Z"), null);
  // Non-UTC offsets are rejected; values are converted to UTC on ingest.
  assert.equal(parseTemporalIso("2018-06-15T14:30:00+02:00"), null);
  assert.equal(isTemporalIso("2018"), true);
  assert.equal(isTemporalIso("not a date"), false);
});

// ---------------------------------------------------------------------------
// Expansion (the only matching rule)
// ---------------------------------------------------------------------------

test("expansion matches the design doc table", () => {
  // instant 2018 @ year -> [2018-01-01, 2019-01-01)
  assert.deepEqual(
    expandTemporalValue({ kind: "instant", at: "2018", precision: "year" }),
    { start: utc(2018, 0, 1), end: utc(2019, 0, 1) }
  );
  // instant 2018-06-15T14:30:00Z @ second -> [14:30:00, 14:30:01)
  assert.deepEqual(
    expandTemporalValue({
      kind: "instant",
      at: "2018-06-15T14:30:00Z",
      precision: "second",
    }),
    {
      start: utc(2018, 5, 15, 14, 30, 0),
      end: utc(2018, 5, 15, 14, 30, 1),
    }
  );
  // interval 2018 -> 2020 @ year -> [2018-01-01, 2020-01-01)
  assert.deepEqual(
    expandTemporalValue({
      kind: "interval",
      start: "2018",
      end: "2020",
      precision: "year",
    }),
    { start: utc(2018, 0, 1), end: utc(2020, 0, 1) }
  );
  // interval 2018 -> null @ year -> [2018-01-01, now)
  const now = utc(2026, 7, 20);
  assert.deepEqual(
    expandTemporalValue(
      { kind: "interval", start: "2018", end: null, precision: "year" },
      now
    ),
    { start: utc(2018, 0, 1), end: now }
  );
});

test("expansion truncates strings finer than their precision", () => {
  // An hour-precision value written as a full timestamp covers the hour.
  assert.deepEqual(
    expandTemporalIso("2019-03-12T06:14:23Z", "hour"),
    { start: utc(2019, 2, 12, 6), end: utc(2019, 2, 12, 7) }
  );
  // Month rollover: December + 1 month lands in the next year.
  assert.deepEqual(expandTemporalIso("2018-12", "month"), {
    start: utc(2018, 11, 1),
    end: utc(2019, 0, 1),
  });
});

test("expansion returns null for unparseable values", () => {
  assert.equal(
    expandTemporalValue({ kind: "instant", at: "junk", precision: "year" }),
    null
  );
  assert.equal(
    expandTemporalValue({
      kind: "interval",
      start: "2018",
      end: "junk",
      precision: "year",
    }),
    null
  );
});

// ---------------------------------------------------------------------------
// Intersection
// ---------------------------------------------------------------------------

test("intervalsIntersect uses half-open semantics", () => {
  const a = { start: 0, end: 10 };
  assert.equal(intervalsIntersect(a, { start: 5, end: 15 }), true);
  assert.equal(intervalsIntersect(a, { start: 10, end: 20 }), false); // touching
  assert.equal(intervalsIntersect(a, { start: -5, end: 0 }), false); // touching
  assert.equal(intervalsIntersect(a, { start: -5, end: 1 }), true);
  assert.equal(intervalsIntersect(a, { start: 2, end: 3 }), true); // contained
});

test("temporalValueIntersects expands then intersects", () => {
  const clock2018 = { start: utc(2018, 0, 1), end: utc(2019, 0, 1) };
  assert.equal(
    temporalValueIntersects(
      { kind: "interval", start: "2018", end: "2019", precision: "year" },
      clock2018
    ),
    true
  );
  assert.equal(
    temporalValueIntersects(
      { kind: "interval", start: "2019", end: "2020", precision: "year" },
      clock2018
    ),
    false
  );
  // Open-ended interval intersects a current clock.
  assert.equal(
    temporalValueIntersects(
      { kind: "interval", start: "2012", end: null, precision: "day" },
      clock2018,
      utc(2026, 0, 1)
    ),
    true
  );
  assert.equal(
    temporalValueIntersects(
      { kind: "instant", at: "junk", precision: "year" },
      clock2018
    ),
    false
  );
});

test("expandTemporalClock expands [start, end) at viewResolution", () => {
  assert.deepEqual(
    expandTemporalClock({
      mode: "instant",
      start: "2018",
      end: "2019",
      viewResolution: "year",
    }),
    { start: utc(2018, 0, 1), end: utc(2019, 0, 1) }
  );
  assert.equal(
    expandTemporalClock({
      mode: "instant",
      start: "junk",
      end: "2019",
      viewResolution: "year",
    }),
    null
  );
});

// ---------------------------------------------------------------------------
// Precision ordering and coverage union
// ---------------------------------------------------------------------------

test("precision comparisons", () => {
  assert.equal(finerPrecision("year", "day"), "day");
  assert.equal(finerPrecision("second", "hour"), "second");
  assert.equal(coarserPrecision("year", "day"), "year");
  assert.equal(coarserPrecision("minute", "month"), "month");
  assert.equal(coarserPrecision("day", "day"), "day");
});

test("unionTemporalCoverage unions the slider domain", () => {
  const union = unionTemporalCoverage([
    { kind: "interval", start: "2000", end: "2010", precision: "year" },
    { kind: "interval", start: "1996", end: "1997", precision: "year" },
    { kind: "interval", start: "2015-06", end: "2020-01", precision: "month" },
  ]);
  assert.deepEqual(union, {
    kind: "interval",
    start: "1996",
    end: "2020-01",
    precision: "month", // finest among members
  });
});

test("unionTemporalCoverage propagates open ends and skips junk", () => {
  const union = unionTemporalCoverage([
    { kind: "interval", start: "2018", end: "2019", precision: "year" },
    { kind: "interval", start: "2012", end: null, precision: "day" },
    { kind: "interval", start: "junk", end: "2050", precision: "year" },
  ]);
  assert.deepEqual(union, {
    kind: "interval",
    start: "2012",
    end: null,
    precision: "day",
  });
  assert.equal(unionTemporalCoverage([]), null);
  assert.equal(
    unionTemporalCoverage([
      { kind: "interval", start: "junk", end: "junk", precision: "year" },
    ]),
    null
  );
});

test("unionTemporalCoverage does not mutate its inputs", () => {
  const a = { kind: "interval", start: "2000", end: "2010", precision: "year" };
  unionTemporalCoverage([
    a,
    { kind: "interval", start: "1990", end: "2020", precision: "year" },
  ]);
  assert.deepEqual(a, {
    kind: "interval",
    start: "2000",
    end: "2010",
    precision: "year",
  });
});

// ---------------------------------------------------------------------------
// Guards: defensive handling of null / undefined / non-objects
// ---------------------------------------------------------------------------

const GUARDS = [
  isTemporalPrecision,
  isTemporalGranularity,
  isTemporalInstant,
  isTemporalInterval,
  isTemporalValue,
  isTemporalStep,
  isTemporalAvailability,
  isTemporalMapping,
  isTemporalInfo,
  isTemporalClock,
];

test("all guards reject null, undefined, and non-objects", () => {
  for (const guard of GUARDS) {
    for (const junk of [null, undefined, 42, "x", true, [], () => {}]) {
      assert.equal(guard(junk), false, `${guard.name}(${String(junk)})`);
    }
  }
});

test("primitive guards", () => {
  assert.equal(isTemporalPrecision("year"), true);
  assert.equal(isTemporalPrecision("decade"), false);
  assert.equal(isTemporalGranularity("band"), true);
  assert.equal(isTemporalGranularity("pixel"), false);
  assert.equal(isTemporalStep({ count: 1, unit: "year" }), true);
  assert.equal(isTemporalStep({ count: 0, unit: "year" }), false);
  assert.equal(isTemporalStep({ count: 1, unit: "years" }), false);
});

test("value guards", () => {
  assert.equal(
    isTemporalInstant({ kind: "instant", at: "2018", precision: "year" }),
    true
  );
  assert.equal(
    isTemporalInstant({ kind: "instant", at: "junk", precision: "year" }),
    false
  );
  assert.equal(
    isTemporalInterval({
      kind: "interval",
      start: "2018",
      end: null,
      precision: "year",
    }),
    true
  );
  assert.equal(
    isTemporalInterval({
      kind: "interval",
      start: "2018",
      precision: "year",
    }),
    false, // end must be present (null for open-ended)
  );
  assert.equal(
    isTemporalValue({ kind: "interval", start: "2018", end: "2019", precision: "year" }),
    true
  );
  assert.equal(isTemporalValue({ kind: "span" }), false);
});

test("availability guards", () => {
  assert.equal(
    isTemporalAvailability({
      type: "grid",
      start: "1985",
      end: "2026",
      step: { count: 1, unit: "year" },
    }),
    true
  );
  assert.equal(
    isTemporalAvailability({
      type: "grid",
      start: "1985",
      end: "2026",
      step: { count: 1, unit: "fortnight" },
    }),
    false
  );
  assert.equal(
    isTemporalAvailability({
      type: "histogram",
      resolution: "hour",
      start: "2019-03-12T06:00:00Z",
      end: "2019-11-02T19:00:00Z",
      bins: [
        { start: "2019-03-12T06:00:00Z", count: 3 },
        { start: "2019-03-12T07:00:00Z", count: 1 },
      ],
    }),
    true
  );
  assert.equal(
    isTemporalAvailability({
      type: "histogram",
      resolution: "hour",
      start: "2019-03-12T06:00:00Z",
      end: null,
      bins: [{ start: "2019-03-12T06:00:00Z", count: -1 }],
    }),
    false
  );
});

test("mapping guards", () => {
  assert.equal(
    isTemporalMapping({
      type: "feature",
      startColumn: "_when_start",
      endColumn: "_when_end",
      sourceColumns: { instant: "timestamp" },
    }),
    true
  );
  assert.equal(
    isTemporalMapping({
      type: "row",
      startColumn: "when_start", // wrong column name
      endColumn: "_when_end",
    }),
    false
  );
  assert.equal(
    isTemporalMapping({
      type: "band",
      bands: [
        {
          id: "1985",
          index: 1,
          when: {
            kind: "interval",
            start: "1985",
            end: "1986",
            precision: "year",
          },
        },
      ],
    }),
    true
  );
  assert.equal(
    isTemporalMapping({ type: "band", bands: [{ id: "1985", index: 0 }] }),
    false // index is 1-based; `when` missing
  );
  assert.equal(isTemporalMapping({ type: "remote", driver: "gfw-4wings" }), true);
  assert.equal(isTemporalMapping({ type: "remote", driver: "other" }), false);
});

// ---------------------------------------------------------------------------
// isTemporalInfo: one valid document per granularity (worked examples from
// the design doc), plus rejection cases.
// ---------------------------------------------------------------------------

test("isTemporalInfo accepts the layer-granularity worked example", () => {
  assert.equal(
    isTemporalInfo({
      version: 1,
      granularity: "layer",
      coverage: {
        kind: "interval",
        start: "2018",
        end: "2019",
        precision: "year",
      },
      nativeResolution: "year",
      defaultViewResolution: "year",
      authoredBy: "admin",
    }),
    true
  );
});

test("isTemporalInfo accepts the band-granularity worked example (GMW)", () => {
  assert.equal(
    isTemporalInfo({
      version: 1,
      granularity: "band",
      coverage: {
        kind: "interval",
        start: "1985",
        end: "2026",
        precision: "year",
      },
      nativeResolution: "year",
      defaultViewResolution: "year",
      availability: {
        type: "grid",
        start: "1985",
        end: "2026",
        step: { count: 1, unit: "year" },
      },
      mapping: {
        type: "band",
        bands: [
          {
            id: "1985",
            index: 1,
            when: {
              kind: "interval",
              start: "1985",
              end: "1986",
              precision: "year",
            },
          },
        ],
      },
      authoredBy: "ingest",
    }),
    true
  );
});

test("isTemporalInfo accepts the feature-granularity worked example (track)", () => {
  assert.equal(
    isTemporalInfo({
      version: 1,
      granularity: "feature",
      coverage: {
        kind: "interval",
        start: "2019-03-12T06:14:00Z",
        end: "2019-11-02T18:03:01Z",
        precision: "second",
      },
      nativeResolution: "hour",
      defaultViewResolution: "day",
      providesSliderStats: true,
      availability: {
        type: "histogram",
        resolution: "hour",
        start: "2019-03-12T06:00:00Z",
        end: "2019-11-02T19:00:00Z",
        bins: [
          { start: "2019-03-12T06:00:00Z", count: 3 },
          { start: "2019-03-12T07:00:00Z", count: 1 },
        ],
      },
      mapping: {
        type: "feature",
        startColumn: "_when_start",
        endColumn: "_when_end",
        sourceColumns: { instant: "timestamp" },
      },
      authoredBy: "ingest",
    }),
    true
  );
});

test("isTemporalInfo accepts the row-granularity worked example (Data Table)", () => {
  assert.equal(
    isTemporalInfo({
      version: 1,
      granularity: "row",
      coverage: {
        kind: "interval",
        start: "2008",
        end: "2025",
        precision: "year",
      },
      nativeResolution: "day",
      defaultViewResolution: "year",
      supportedViewResolutions: ["day", "month", "year"],
      providesSliderStats: true,
      availability: {
        type: "histogram",
        resolution: "day",
        start: "2008-03-12",
        end: "2024-11-03",
        bins: [
          { start: "2008-03-12", count: 14 },
          { start: "2008-03-13", count: 9 },
        ],
      },
      mapping: {
        type: "row",
        startColumn: "_when_start",
        endColumn: "_when_end",
        sourceColumns: { instant: "DATE" },
      },
      authoredBy: "admin",
    }),
    true
  );
});

test("isTemporalInfo accepts the remote worked example (GFW)", () => {
  assert.equal(
    isTemporalInfo({
      version: 1,
      granularity: "remote",
      coverage: {
        kind: "interval",
        start: "2012-01-01",
        end: null,
        precision: "day",
      },
      nativeResolution: "day",
      defaultViewResolution: "year",
      supportedViewResolutions: ["day", "month", "year"],
      providesSliderStats: true,
      mapping: { type: "remote", driver: "gfw-4wings" },
    }),
    true
  );
});

test("isTemporalInfo rejects malformed documents", () => {
  const valid = createLayerYearTemporalInfo(2018);
  assert.equal(isTemporalInfo(valid), true);
  assert.equal(isTemporalInfo({ ...valid, version: 2 }), false);
  assert.equal(isTemporalInfo({ ...valid, granularity: "pixel" }), false);
  assert.equal(
    isTemporalInfo({
      ...valid,
      coverage: { kind: "instant", at: "2018", precision: "year" },
    }),
    false // coverage must be an interval
  );
  assert.equal(
    isTemporalInfo({
      ...valid,
      coverage: {
        kind: "interval",
        start: "2020",
        end: "2019",
        precision: "year",
      },
    }),
    false
  );
  assert.equal(isTemporalInfo({ ...valid, nativeResolution: "eon" }), false);
  assert.equal(
    isTemporalInfo({ ...valid, supportedViewResolutions: ["year", "eon"] }),
    false
  );
  assert.equal(
    isTemporalInfo({ ...valid, mapping: { type: "unknown" } }),
    false
  );
  assert.equal(
    isTemporalInfo({ ...valid, availability: { type: "grid" } }),
    false
  );
  assert.equal(isTemporalInfo({ ...valid, providesSliderStats: 1 }), false);
  assert.equal(isTemporalInfo({ ...valid, authoredBy: "robot" }), false);
  const { coverage, ...missingCoverage } = valid;
  assert.equal(isTemporalInfo(missingCoverage), false);
});

test("isTemporalInfo requires mapping to match granularity", () => {
  const valid = createLayerYearTemporalInfo(2018);
  const mappings = {
    feature: {
      type: "feature",
      startColumn: "_when_start",
      endColumn: "_when_end",
    },
    band: { type: "band", bands: [] },
    row: {
      type: "row",
      startColumn: "_when_start",
      endColumn: "_when_end",
    },
    remote: { type: "remote", driver: "gfw-4wings" },
  };
  for (const granularity of ["feature", "band", "row", "remote"]) {
    assert.equal(
      isTemporalInfo({
        ...valid,
        granularity,
        mapping: mappings[granularity === "feature" ? "row" : "feature"],
      }),
      false
    );
    assert.equal(
      isTemporalInfo({ ...valid, granularity, mapping: mappings[granularity] }),
      true
    );
  }
  assert.equal(isTemporalInfo({ ...valid, mapping: mappings.band }), false);
});

test("isTemporalClock", () => {
  assert.equal(
    isTemporalClock({
      mode: "instant",
      start: "2018",
      end: "2019",
      viewResolution: "year",
    }),
    true
  );
  assert.equal(
    isTemporalClock({
      mode: "loop",
      start: "2018",
      end: "2019",
      viewResolution: "year",
    }),
    false
  );
});

test("createLayerYearTemporalInfo builds the admin v1 document", () => {
  assert.deepEqual(createLayerYearTemporalInfo(2018), {
    version: 1,
    granularity: "layer",
    coverage: {
      kind: "interval",
      start: "2018",
      end: "2019",
      precision: "year",
    },
    nativeResolution: "year",
    defaultViewResolution: "year",
    authoredBy: "admin",
  });
});

// ---------------------------------------------------------------------------
// Data Table temporal config + row derivation
// ---------------------------------------------------------------------------

test("isDataTableTemporalSourceColumns accepts the three mapping kinds", () => {
  assert.equal(isTemporalDateFormat("mdy"), true);
  assert.equal(isTemporalDateFormat("ymd"), false);
  assert.equal(
    isDataTableTemporalSourceColumns({
      kind: "instant",
      column: "Date",
      format: "mdy",
    }),
    true
  );
  assert.equal(
    isDataTableTemporalSourceColumns({
      kind: "components",
      year: "year",
      month: "month",
      day: "day",
    }),
    true
  );
  assert.equal(
    isDataTableTemporalSourceColumns({ kind: "components", year: "survey_year" }),
    true
  );
  assert.equal(
    isDataTableTemporalSourceColumns({
      kind: "components",
      year: "year",
      day: "day",
    }),
    false
  );
  assert.equal(
    isDataTableTemporalSourceColumns({
      kind: "span",
      start: "from",
      end: "through",
      format: "iso",
    }),
    true
  );
  assert.equal(isDataTableTemporalSourceColumns(null), false);
  assert.equal(isDataTableTemporalSourceColumns(undefined), false);
  assert.equal(isDataTableTemporalSourceColumns({ instant: "DATE" }), false);
});

test("legacy sourceColumns still validate on TemporalInfo", () => {
  assert.equal(
    isLegacyTemporalSourceColumns({ instant: "DATE" }),
    true
  );
  assert.equal(isLegacyTemporalSourceColumns({ kind: "instant" }), false);
  assert.equal(isLegacyTemporalSourceColumns({}), false);
  assert.equal(
    isTemporalMapping({
      type: "row",
      startColumn: "_when_start",
      endColumn: "_when_end",
      sourceColumns: {
        kind: "instant",
        column: "Date",
        format: "mdy",
      },
    }),
    true
  );
  assert.equal(
    isDataTableTemporalConfig({
      sourceColumns: { kind: "instant", column: "Date", format: "mdy" },
      defaultViewResolution: "year",
      supportedViewResolutions: ["day", "month", "year"],
    }),
    true
  );
  assert.equal(
    isDataTableTemporalConfig({
      sourceColumns: { instant: "DATE" },
    }),
    false
  );
  assert.deepEqual(
    toDataTableTemporalSourceColumns({ instant: "DATE" }),
    { kind: "instant", column: "DATE", format: "iso" }
  );
});

test("deriveWhenIntervalFromRow handles year, components, and slash dates", () => {
  const yearOnly = deriveWhenIntervalFromRow(
    { survey_year: 2018 },
    { kind: "instant", column: "survey_year", format: "year" }
  );
  assert.deepEqual(yearOnly, {
    startSec: utc(2018, 0, 1) / 1000,
    endSec: utc(2019, 0, 1) / 1000,
    startIso: "2018",
    endIso: "2019",
    precision: "year",
  });

  const kfm = deriveWhenIntervalFromRow(
    { year: 2018, month: 6, day: 15 },
    { kind: "components", year: "year", month: "month", day: "day" }
  );
  assert.deepEqual(kfm, {
    startSec: utc(2018, 5, 15) / 1000,
    endSec: utc(2018, 5, 16) / 1000,
    startIso: "2018-06-15",
    endIso: "2018-06-16",
    precision: "day",
  });

  const ccfrp = deriveWhenIntervalFromRow(
    { Date: "8/31/2023" },
    { kind: "instant", column: "Date", format: "mdy" }
  );
  assert.deepEqual(ccfrp, {
    startSec: utc(2023, 7, 31) / 1000,
    endSec: utc(2023, 8, 1) / 1000,
    startIso: "2023-08-31",
    endIso: "2023-09-01",
    precision: "day",
  });

  const estuary = deriveWhenIntervalFromRow(
    { samplecollectiondate: "31/08/2023" },
    { kind: "instant", column: "samplecollectiondate", format: "dmy" }
  );
  assert.equal(estuary.startIso, "2023-08-31");

  assert.equal(
    deriveWhenIntervalFromRow(
      { Date: "not-a-date" },
      { kind: "instant", column: "Date", format: "mdy" }
    ),
    null
  );
  assert.equal(
    deriveWhenIntervalFromRow(
      { Date: "13/01/2023" },
      { kind: "instant", column: "Date", format: "mdy" }
    ),
    null
  );
  assert.equal(deriveWhenIntervalFromRow({}, { kind: "instant", column: "Date", format: "mdy" }), null);
});

test("deriveWhenIntervalFromRow expands inclusive span ends", () => {
  const span = deriveWhenIntervalFromRow(
    { from: "2018", through: "2020" },
    { kind: "span", start: "from", end: "through", format: "year" }
  );
  assert.deepEqual(span, {
    startSec: utc(2018, 0, 1) / 1000,
    endSec: utc(2021, 0, 1) / 1000,
    startIso: "2018",
    endIso: "2021",
    precision: "year",
  });
});

test("coverage and availability summarize derived intervals", () => {
  const source = {
    kind: "instant",
    column: "Date",
    format: "mdy",
  };
  const intervals = [
    deriveWhenIntervalFromRow({ Date: "1/1/2018" }, source),
    deriveWhenIntervalFromRow({ Date: "1/1/2018" }, source),
    deriveWhenIntervalFromRow({ Date: "6/15/2020" }, source),
  ].filter(Boolean);
  assert.equal(nativePrecisionFromSourceColumns(source), "day");
  assert.deepEqual(sourceColumnNames(source), ["Date"]);
  const coverage = coverageFromDerivedIntervals(intervals);
  assert.equal(coverage.start, "2018-01-01");
  assert.equal(coverage.end, "2020-06-16");
  const availability = availabilityFromDerivedIntervals(intervals, "year");
  assert.equal(availability.type, "histogram");
  assert.deepEqual(availability.bins, [
    { start: "2018", count: 2 },
    { start: "2020", count: 1 },
  ]);
  assert.equal(formatTemporalIsoFromMs(utc(2018, 5, 15), "month"), "2018-06");
});
