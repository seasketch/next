"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OusDemographicsAggregator = void 0;
exports.calculateOusDemographics = calculateOusDemographics;
const containerIndex_1 = require("../utils/containerIndex");
const helpers_1 = require("../utils/helpers");
const metrics_1 = require("./metrics");
function addShapeToAccumulator(accumulator, groupKey, responseId, representedInSector, participants) {
    let respondents = accumulator.get(groupKey);
    if (!respondents) {
        respondents = new Map();
        accumulator.set(groupKey, respondents);
    }
    const existing = respondents.get(responseId);
    if (!existing) {
        respondents.set(responseId, {
            maxRepresentedInSector: representedInSector,
            participants,
        });
    }
    else {
        existing.maxRepresentedInSector = Math.max(existing.maxRepresentedInSector, representedInSector);
        existing.participants = Math.max(existing.participants, participants);
    }
}
/** Clamp a respondent's group value: `min(max represented, participants)`. */
function clampedRepresentedInSector(entry) {
    return Math.min(entry.maxRepresentedInSector, entry.participants);
}
/**
 * Streaming aggregator implementing the OUS demographics methodology. Feed it
 * every feature in the survey dataset (with a flag for whether the shape
 * intersects the subject); it maintains both within-subject respondent maps
 * and dataset-wide totals, applying the participants clamp at finalization.
 *
 * Aggregation is idempotent per shape identity: subdivided parts of the same
 * original feature (or the same feature seen twice) carry identical
 * respondent values and collapse via `Math.max`.
 */
class OusDemographicsAggregator {
    constructor(groupBy = metrics_1.OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY) {
        /** Respondents with >=1 intersecting shape, per group + rollup. */
        this.within = new Map();
        /** All respondents in the dataset, per group + rollup. */
        this.totals = new Map();
        /** Property keys observed across scanned features, for error messages. */
        this.seenPropertyKeys = new Set();
        this.featureCount = 0;
        /** Features missing a usable response_id / participants / represented_in_sector. */
        this.skippedFeatureCount = 0;
        if (groupBy === metrics_1.OUS_DEMOGRAPHICS_ROLLUP_KEY) {
            throw new Error(`"${metrics_1.OUS_DEMOGRAPHICS_ROLLUP_KEY}" is a reserved rollup key and cannot be used as a groupBy column for ous_demographics`);
        }
        this.groupBy = groupBy;
    }
    addFeature(properties, intersectsSubject) {
        this.featureCount++;
        const props = properties || {};
        for (const key of Object.keys(props)) {
            if (!key.startsWith("__")) {
                this.seenPropertyKeys.add(key);
            }
        }
        const responseIdRaw = props.response_id;
        const responseId = responseIdRaw === null || responseIdRaw === undefined
            ? ""
            : String(responseIdRaw).trim();
        const participants = Number(props.participants);
        const representedInSector = Number(props.represented_in_sector);
        if (responseId === "" ||
            !Number.isFinite(participants) ||
            !Number.isFinite(representedInSector)) {
            // Matches the legacy geoprocessing function: shapes missing required
            // values are skipped rather than failing the whole calculation.
            this.skippedFeatureCount++;
            return;
        }
        const groupRaw = props[this.groupBy];
        const groupKey = groupRaw === null || groupRaw === undefined
            ? ""
            : String(groupRaw).trim();
        const accumulators = intersectsSubject
            ? [this.totals, this.within]
            : [this.totals];
        for (const accumulator of accumulators) {
            addShapeToAccumulator(accumulator, metrics_1.OUS_DEMOGRAPHICS_ROLLUP_KEY, responseId, representedInSector, participants);
            if (groupKey !== "") {
                addShapeToAccumulator(accumulator, groupKey, responseId, representedInSector, participants);
            }
        }
    }
    /**
     * Required columns (including the groupBy column) that never appeared on
     * any scanned feature. Non-empty results indicate a misconfigured source.
     */
    missingColumns() {
        const required = [
            "response_id",
            "participants",
            "represented_in_sector",
            this.groupBy,
        ];
        return required.filter((column) => !this.seenPropertyKeys.has(column));
    }
    result() {
        if (this.featureCount > 0) {
            const missing = this.missingColumns();
            if (missing.length > 0) {
                throw new Error(`ous_demographics requires columns response_id, participants, represented_in_sector, and the groupBy column ("${this.groupBy}"). Missing from source: ${missing.join(", ")}`);
            }
            if (this.skippedFeatureCount === this.featureCount) {
                throw new Error(`ous_demographics could not read response_id, participants, and represented_in_sector values from any of the ${this.featureCount} features in the source`);
            }
        }
        const value = { groups: {}, totals: {} };
        for (const [groupKey, respondents] of this.within) {
            const group = {};
            for (const [responseId, entry] of respondents) {
                group[responseId] = {
                    representedInSector: clampedRepresentedInSector(entry),
                    participants: entry.participants,
                };
            }
            value.groups[groupKey] = group;
        }
        for (const [groupKey, respondents] of this.totals) {
            let representedInSector = 0;
            let participants = 0;
            for (const entry of respondents.values()) {
                representedInSector += clampedRepresentedInSector(entry);
                participants += entry.participants;
            }
            value.totals[groupKey] = {
                representedInSector,
                participants,
                respondents: respondents.size,
            };
        }
        return value;
    }
}
exports.OusDemographicsAggregator = OusDemographicsAggregator;
/**
 * Calculates the `ous_demographics` metric for a subject polygon against an
 * Ocean Use Survey FlatGeobuf source.
 *
 * Every feature in the source is scanned exactly once (dataset-wide totals
 * require a full pass regardless of the subject, and survey layers are
 * small), so no bbox-driven fetch plan or clipping worker pool is involved.
 * Intersection is a boolean test via {@link ContainerIndex}: "inside" and
 * "mixed" classifications both intersect the subject (touching counts, same
 * as the legacy geoprocessing function's booleanIntersects).
 */
async function calculateOusDemographics(subjectFeature, source, options) {
    const helpers = (0, helpers_1.guaranteeHelpers)(options?.helpers);
    const groupBy = options?.groupBy || metrics_1.OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY;
    const aggregator = new OusDemographicsAggregator(groupBy);
    const containerIndex = new containerIndex_1.ContainerIndex(subjectFeature);
    helpers.log(`Calculating ous_demographics (groupBy=${groupBy}) with a full scan of the source`);
    for await (const feature of source.getFeaturesAsync(source.bounds)) {
        const classification = containerIndex.classify(feature);
        aggregator.addFeature(feature.properties, classification !== "outside");
    }
    if (aggregator.skippedFeatureCount > 0) {
        helpers.log(`ous_demographics skipped ${aggregator.skippedFeatureCount} of ${aggregator.featureCount} features missing response_id, participants, or represented_in_sector values`);
    }
    helpers.log(`ous_demographics scanned ${aggregator.featureCount} features`);
    return aggregator.result();
}
//# sourceMappingURL=ousDemographics.js.map