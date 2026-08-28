"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverCkanFields = discoverCkanFields;
const normalize_1 = require("./normalize");
const locale_1 = require("./locale");
const DATE_IDS = new Set([
    "date_published",
    "date_modified",
    "federated_date_modified",
    "metadata_created",
    "metadata_modified",
    "time_period_coverage_start",
    "time_period_coverage_end",
    "date_created",
    "date_captured",
    "portal_release_date",
    "frequency",
    "temporal_coverage",
]);
const ATTRIBUTION_IDS = new Set([
    "organization",
    "org_title_at_publication",
    "creator",
    "author",
    "author_email",
    "maintainer",
    "maintainer_email",
    "license",
    "license_id",
    "license_title",
    "license_url",
    "contact_information",
    "metadata_contact",
    "distributor",
    "credit",
]);
function groupFor(id) {
    if (id === "notes" ||
        id === "notes_translated" ||
        id === "title" ||
        id === "keywords" ||
        id === "subject" ||
        id === "topic_category") {
        return "Overview";
    }
    if (DATE_IDS.has(id)) {
        return "Dates";
    }
    if (ATTRIBUTION_IDS.has(id)) {
        return "Attribution";
    }
    if (id === "resources") {
        return "Resources";
    }
    return "Other";
}
function recommendedFor(id, schema) {
    if (id === "notes" ||
        id === "notes_translated" ||
        id === "organization" ||
        id === "license" ||
        id === "license_id" ||
        id === "date_published" ||
        id === "date_modified" ||
        id === "frequency" ||
        id === "temporal_coverage" ||
        id === "keywords") {
        return true;
    }
    return Boolean(schema?.sidebar_show_fields?.includes(id));
}
function stubField(id, label, schema) {
    return {
        id,
        label,
        value: undefined,
        type: "text",
        group: groupFor(id),
        source: id === "organization" || id === "license" || id === "notes"
            ? "core"
            : schema
                ? "schema"
                : "extra",
        recommended: recommendedFor(id, schema),
        technical: normalize_1.TECHNICAL_FIELD_IDS.has(id),
    };
}
function discoverCkanFields(schemaInput, sampleRecord, options = {}) {
    const schema = (0, normalize_1.isCkanSchema)(schemaInput) ? schemaInput : null;
    const lang = options.lang;
    const fields = [];
    const seen = new Set();
    const push = (id, label) => {
        if (seen.has(id) || normalize_1.TECHNICAL_FIELD_IDS.has(id)) {
            return;
        }
        if (id === "title" || id === "title_translated") {
            return;
        }
        seen.add(id);
        fields.push(stubField(id, label, schema));
    };
    if (schema?.dataset_fields) {
        for (const field of schema.dataset_fields) {
            if (!field.field_name) {
                continue;
            }
            const label = (0, locale_1.resolveFluentLabel)(field.label, lang, schema) ??
                (0, normalize_1.humanize)(field.field_name);
            if (field.field_name === "notes_translated") {
                push("notes", label);
                continue;
            }
            if (field.field_name === "owner_org") {
                push("organization", label);
                continue;
            }
            if (field.field_name === "license_id") {
                push("license", label);
                continue;
            }
            if (field.field_name === "time_period_coverage_start" ||
                field.field_name === "time_period_coverage_end") {
                push("temporal_coverage", "Temporal coverage");
                continue;
            }
            push(field.field_name, label);
        }
    }
    if ((0, normalize_1.isCkanPackage)(sampleRecord)) {
        for (const key of Object.keys(sampleRecord)) {
            push(key, (0, normalize_1.humanize)(key));
        }
        const extras = Array.isArray(sampleRecord.extras)
            ? sampleRecord.extras
            : [];
        for (const extra of extras) {
            if (extra && typeof extra === "object") {
                const extraKey = extra.key;
                if (typeof extraKey === "string") {
                    push(`extras.${extraKey}`, (0, normalize_1.humanize)(extraKey));
                }
            }
        }
        if (Array.isArray(sampleRecord.resources)) {
            push("resources", "Resources");
        }
    }
    else if (schema) {
        push("resources", "Resources");
    }
    return fields;
}
//# sourceMappingURL=discoverFields.js.map