"use strict";
/**
 * Temporal metadata types for SeaSketch layers and Data Tables, per
 * design-docs/temporal-data/temporal-data.md. The same TemporalInfo document
 * describes vector sources (layer- or feature-level time), rasters
 * (layer- or band-level time), remotes (GFW), and Data Tables (row-level
 * time). This module is the shared system of record for the API
 * (validation in the TemporalInfo GraphQL scalar), the client (timeslider,
 * report widgets), and ingest.
 *
 * Rules encoded here:
 * - Instants and intervals are both first-class, with an explicit precision
 *   field (never inferred from string width).
 * - Bounds are half-open: inclusive start, exclusive end.
 * - Calendar values are UTC.
 * - Matching = expanded-interval intersection:
 *   `value.start < clock.end && clock.start < value.end`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemporalIso = parseTemporalIso;
exports.isTemporalIso = isTemporalIso;
exports.expandTemporalIso = expandTemporalIso;
exports.expandTemporalValue = expandTemporalValue;
exports.intervalsIntersect = intervalsIntersect;
exports.temporalValueIntersects = temporalValueIntersects;
exports.expandTemporalClock = expandTemporalClock;
exports.finerPrecision = finerPrecision;
exports.coarserPrecision = coarserPrecision;
exports.unionTemporalCoverage = unionTemporalCoverage;
exports.isTemporalPrecision = isTemporalPrecision;
exports.isTemporalGranularity = isTemporalGranularity;
exports.isTemporalInstant = isTemporalInstant;
exports.isTemporalInterval = isTemporalInterval;
exports.isTemporalValue = isTemporalValue;
exports.isTemporalStep = isTemporalStep;
exports.isTemporalAvailability = isTemporalAvailability;
exports.isTemporalMapping = isTemporalMapping;
exports.isTemporalInfo = isTemporalInfo;
exports.isTemporalClock = isTemporalClock;
exports.createLayerYearTemporalInfo = createLayerYearTemporalInfo;
// ---------------------------------------------------------------------------
// Parsing and expansion
// ---------------------------------------------------------------------------
const PRECISIONS = [
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
];
/**
 * Reduced-precision ISO 8601, UTC only (optional trailing `Z`; non-UTC
 * offsets are rejected — values are converted to UTC on ingest).
 */
const ISO_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?Z?)?)?)?$/;
/**
 * Parses a reduced-precision UTC ISO 8601 string into calendar components.
 * Returns null for anything that is not valid (including non-UTC offsets).
 */
function parseTemporalIso(iso) {
    if (typeof iso !== "string")
        return null;
    const m = ISO_RE.exec(iso);
    if (!m)
        return null;
    const year = parseInt(m[1], 10);
    const month = m[2] !== undefined ? parseInt(m[2], 10) : 1;
    const day = m[3] !== undefined ? parseInt(m[3], 10) : 1;
    const hour = m[4] !== undefined ? parseInt(m[4], 10) : 0;
    const minute = m[5] !== undefined ? parseInt(m[5], 10) : 0;
    const second = m[6] !== undefined ? parseInt(m[6], 10) : 0;
    if (month < 1 || month > 12)
        return null;
    if (day < 1 || day > 31)
        return null;
    if (hour > 23 || minute > 59 || second > 59)
        return null;
    // Reject invalid calendar dates like Feb 30 (Date.UTC rolls them over).
    const ms = Date.UTC(year, month - 1, day, hour, minute, second);
    const d = new Date(ms);
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
        return null;
    return { year, month, day, hour, minute, second };
}
function isTemporalIso(value) {
    return parseTemporalIso(value) !== null;
}
function truncate(c, precision) {
    switch (precision) {
        case "year":
            return Date.UTC(c.year, 0, 1);
        case "month":
            return Date.UTC(c.year, c.month - 1, 1);
        case "day":
            return Date.UTC(c.year, c.month - 1, c.day);
        case "hour":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour);
        case "minute":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
        case "second":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
    }
}
/** Start of the *next* unit after truncation — Date.UTC handles rollover. */
function advance(c, precision, count = 1) {
    switch (precision) {
        case "year":
            return Date.UTC(c.year + count, 0, 1);
        case "month":
            return Date.UTC(c.year, c.month - 1 + count, 1);
        case "day":
            return Date.UTC(c.year, c.month - 1, c.day + count);
        case "hour":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour + count);
        case "minute":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute + count);
        case "second":
            return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second + count);
    }
}
/**
 * Expands one reduced-precision ISO value to the half-open interval covering
 * one unit at `precision` (e.g. `"2018"` @ year → [2018-01-01, 2019-01-01)).
 * Strings more specific than `precision` are truncated first.
 */
function expandTemporalIso(iso, precision) {
    const c = parseTemporalIso(iso);
    if (!c)
        return null;
    return { start: truncate(c, precision), end: advance(c, precision) };
}
/**
 * Expands a TemporalValue to its half-open UTC interval — the only matching
 * rule. Instants cover one unit at their precision. Interval ends are
 * exclusive and expand to the *start* of their unit; a `null` end resolves
 * to `now`. Returns null if the value fails to parse.
 */
function expandTemporalValue(value, now = Date.now()) {
    if (value.kind === "instant") {
        return expandTemporalIso(value.at, value.precision);
    }
    const startC = parseTemporalIso(value.start);
    if (!startC)
        return null;
    const start = truncate(startC, value.precision);
    let end;
    if (value.end === null) {
        end = now;
    }
    else {
        const endC = parseTemporalIso(value.end);
        if (!endC)
            return null;
        end = truncate(endC, value.precision);
    }
    return { start, end };
}
// ---------------------------------------------------------------------------
// Intersection and union
// ---------------------------------------------------------------------------
/** The intersection rule: `a.start < b.end && b.start < a.end`. */
function intervalsIntersect(a, b) {
    return a.start < b.end && b.start < a.end;
}
/**
 * True when a temporal value intersects the clock's half-open interval —
 * how the timeslider decides source/feature/band visibility.
 */
function temporalValueIntersects(value, clock, now = Date.now()) {
    const expanded = expandTemporalValue(value, now);
    if (!expanded)
        return false;
    return intervalsIntersect(expanded, clock);
}
/** Expands a TemporalClock's [start, end) to ms. Null on parse failure. */
function expandTemporalClock(clock) {
    const startC = parseTemporalIso(clock.start);
    const endC = parseTemporalIso(clock.end);
    if (!startC || !endC)
        return null;
    return {
        start: truncate(startC, clock.viewResolution),
        end: truncate(endC, clock.viewResolution),
    };
}
/** Index into the precision order — larger is finer. */
function precisionRank(p) {
    return PRECISIONS.indexOf(p);
}
/** The finer (higher-resolution) of two precisions. */
function finerPrecision(a, b) {
    return precisionRank(a) >= precisionRank(b) ? a : b;
}
/** The coarser (lower-resolution) of two precisions — slider step rule. */
function coarserPrecision(a, b) {
    return precisionRank(a) <= precisionRank(b) ? a : b;
}
/**
 * Union of coverage intervals — the timeslider domain for the currently
 * visible temporal sources. Start/end keep the contributing sources' ISO
 * strings (no re-serialization); an open-ended member makes the union
 * open-ended. Precision is the finest among members. Returns null for an
 * empty or entirely unparseable list.
 */
function unionTemporalCoverage(coverages, now = Date.now()) {
    let result = null;
    let resultExpanded = null;
    for (const coverage of coverages) {
        const expanded = expandTemporalValue(coverage, now);
        if (!expanded)
            continue;
        if (!result || !resultExpanded) {
            result = Object.assign({}, coverage);
            resultExpanded = expanded;
            continue;
        }
        if (expanded.start < resultExpanded.start) {
            result.start = coverage.start;
            resultExpanded.start = expanded.start;
        }
        if (result.end !== null) {
            if (coverage.end === null) {
                result.end = null;
                resultExpanded.end = expanded.end;
            }
            else if (expanded.end > resultExpanded.end) {
                result.end = coverage.end;
                resultExpanded.end = expanded.end;
            }
        }
        result.precision = finerPrecision(result.precision, coverage.precision);
    }
    return result;
}
// ---------------------------------------------------------------------------
// Type guards (all take unknown; defensive per workspace conventions)
// ---------------------------------------------------------------------------
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTemporalPrecision(value) {
    return (typeof value === "string" &&
        PRECISIONS.indexOf(value) !== -1);
}
function isTemporalGranularity(value) {
    return (typeof value === "string" &&
        ["layer", "feature", "band", "row", "remote"].indexOf(value) !== -1);
}
function isTemporalInstant(value) {
    if (!isRecord(value))
        return false;
    return (value.kind === "instant" &&
        isTemporalIso(value.at) &&
        isTemporalPrecision(value.precision));
}
function isTemporalInterval(value) {
    if (!isRecord(value))
        return false;
    if (value.kind !== "interval")
        return false;
    if (!isTemporalIso(value.start))
        return false;
    if (value.end !== null && !isTemporalIso(value.end))
        return false;
    return isTemporalPrecision(value.precision);
}
function isTemporalValue(value) {
    return isTemporalInstant(value) || isTemporalInterval(value);
}
function isTemporalStep(value) {
    if (!isRecord(value))
        return false;
    return (typeof value.count === "number" &&
        Number.isFinite(value.count) &&
        value.count > 0 &&
        isTemporalPrecision(value.unit));
}
function isTemporalAvailability(value) {
    if (!isRecord(value))
        return false;
    if (value.type === "grid") {
        if (!isTemporalIso(value.start))
            return false;
        if (value.end !== null && !isTemporalIso(value.end))
            return false;
        return isTemporalStep(value.step);
    }
    if (value.type === "histogram") {
        if (!isTemporalPrecision(value.resolution))
            return false;
        if (!isTemporalIso(value.start))
            return false;
        if (value.end !== null && !isTemporalIso(value.end))
            return false;
        if (!Array.isArray(value.bins))
            return false;
        return value.bins.every((bin) => isRecord(bin) &&
            isTemporalIso(bin.start) &&
            typeof bin.count === "number" &&
            Number.isFinite(bin.count) &&
            bin.count >= 0);
    }
    return false;
}
function isTemporalMapping(value) {
    if (!isRecord(value))
        return false;
    if (value.type === "feature" || value.type === "row") {
        if (value.startColumn !== "_when_start")
            return false;
        if (value.endColumn !== "_when_end")
            return false;
        if (value.sourceColumns !== undefined) {
            if (!isRecord(value.sourceColumns))
                return false;
            for (const key of ["instant", "start", "end"]) {
                const v = value.sourceColumns[key];
                if (v !== undefined && typeof v !== "string")
                    return false;
            }
        }
        return true;
    }
    if (value.type === "band") {
        if (!Array.isArray(value.bands))
            return false;
        return value.bands.every((band) => isRecord(band) &&
            typeof band.id === "string" &&
            typeof band.index === "number" &&
            Number.isInteger(band.index) &&
            band.index >= 1 &&
            isTemporalValue(band.when));
    }
    if (value.type === "remote") {
        return value.driver === "gfw-4wings";
    }
    return false;
}
/**
 * Validates a complete TemporalInfo document — used by the GraphQL scalar
 * on the API, admin mutations, and anywhere the jsonb column is read.
 */
function isTemporalInfo(value) {
    if (!isRecord(value))
        return false;
    if (value.version !== 1)
        return false;
    if (!isTemporalGranularity(value.granularity))
        return false;
    if (!isTemporalInterval(value.coverage))
        return false;
    if (!isTemporalPrecision(value.nativeResolution))
        return false;
    if (!isTemporalPrecision(value.defaultViewResolution))
        return false;
    if (value.supportedViewResolutions !== undefined) {
        if (!Array.isArray(value.supportedViewResolutions))
            return false;
        if (!value.supportedViewResolutions.every(isTemporalPrecision)) {
            return false;
        }
    }
    if (value.mapping !== undefined && !isTemporalMapping(value.mapping)) {
        return false;
    }
    if (value.availability !== undefined &&
        !isTemporalAvailability(value.availability)) {
        return false;
    }
    if (value.providesSliderStats !== undefined &&
        typeof value.providesSliderStats !== "boolean") {
        return false;
    }
    if (value.authoredBy !== undefined &&
        (typeof value.authoredBy !== "string" ||
            ["ingest", "admin", "heuristic", "library"].indexOf(value.authoredBy) ===
                -1)) {
        return false;
    }
    return true;
}
function isTemporalClock(value) {
    if (!isRecord(value))
        return false;
    return ((value.mode === "instant" ||
        value.mode === "window" ||
        value.mode === "cumulative") &&
        isTemporalIso(value.start) &&
        isTemporalIso(value.end) &&
        isTemporalPrecision(value.viewResolution));
}
// ---------------------------------------------------------------------------
// Convenience builders
// ---------------------------------------------------------------------------
/**
 * The admin-editor v1 document: a layer-granularity year interval, per the
 * worked example in the design doc ("Mangroves 2018").
 */
function createLayerYearTemporalInfo(year) {
    const start = String(year);
    const end = String(year + 1);
    return {
        version: 1,
        granularity: "layer",
        coverage: { kind: "interval", start, end, precision: "year" },
        nativeResolution: "year",
        defaultViewResolution: "year",
        authoredBy: "admin",
    };
}
//# sourceMappingURL=temporal.js.map