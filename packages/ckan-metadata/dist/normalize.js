"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_RECOMMENDED_FIELD_IDS = exports.TECHNICAL_FIELD_IDS = void 0;
exports.isCkanPackage = isCkanPackage;
exports.isCkanSchema = isCkanSchema;
exports.isCkanDisplayConfig = isCkanDisplayConfig;
exports.humanize = humanize;
exports.tryParseJsonValue = tryParseJsonValue;
exports.isSentinelDate = isSentinelDate;
exports.formatDateValue = formatDateValue;
exports.normalizeCkanPackage = normalizeCkanPackage;
const locale_1 = require("./locale");
exports.TECHNICAL_FIELD_IDS = new Set([
    "id",
    "name",
    "state",
    "private",
    "owner_org",
    "creator_user_id",
    "num_resources",
    "num_tags",
    "relationships_as_subject",
    "relationships_as_object",
    "type",
    "isopen",
    "ready_to_publish",
    "imso_approval",
    "display_flags",
    "file_id",
    "short_key",
    "revision_id",
]);
exports.CORE_RECOMMENDED_FIELD_IDS = new Set([
    "notes",
    "notes_translated",
    "organization",
    "license",
    "license_id",
    "license_title",
    "date_published",
    "date_modified",
    "frequency",
    "temporal_coverage",
    "time_period_coverage_start",
    "time_period_coverage_end",
    "keywords",
]);
const DESCRIPTION_IDS = new Set(["notes", "notes_translated"]);
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
const CORE_PACKAGE_KEYS = new Set([
    "id",
    "name",
    "title",
    "title_translated",
    "notes",
    "notes_translated",
    "author",
    "author_email",
    "maintainer",
    "maintainer_email",
    "license_id",
    "license_title",
    "license_url",
    "url",
    "version",
    "metadata_created",
    "metadata_modified",
    "organization",
    "tags",
    "resources",
    "extras",
    "groups",
]);
const SENTINEL_DATES = new Set(["0001-01-01", "9999-12-31"]);
function isCkanPackage(value) {
    if (value === null || value === undefined || typeof value !== "object") {
        return false;
    }
    const record = value;
    return (typeof record.id === "string" ||
        typeof record.name === "string" ||
        typeof record.title === "string");
}
function isCkanSchema(value) {
    if (value === null || value === undefined || typeof value !== "object") {
        return false;
    }
    const record = value;
    return Array.isArray(record.dataset_fields);
}
function isCkanDisplayConfig(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value !== "object") {
        return false;
    }
    const record = value;
    if (record.fields !== undefined) {
        if (!Array.isArray(record.fields)) {
            return false;
        }
        for (const field of record.fields) {
            if (field === null ||
                typeof field !== "object" ||
                typeof field.id !== "string") {
                return false;
            }
        }
    }
    if (record.includeResources !== undefined &&
        typeof record.includeResources !== "boolean") {
        return false;
    }
    return true;
}
function humanize(fieldName) {
    return fieldName
        .replace(/^extras\./, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
function isEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (typeof value === "object") {
        return Object.keys(value).length === 0;
    }
    return false;
}
function tryParseJsonValue(value) {
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("[")) ||
        trimmed.length < 2) {
        return value;
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
function isSentinelDate(value) {
    const datePart = value.trim().split(/\s+/)[0];
    return SENTINEL_DATES.has(datePart);
}
function formatDateValue(value) {
    const trimmed = value.trim();
    if (isSentinelDate(trimmed)) {
        return undefined;
    }
    const withoutTime = trimmed.replace(/ 00:00:00(?:\.0+)?$/, "");
    return withoutTime.length > 0 ? withoutTime : undefined;
}
function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function looksLikeUrl(value) {
    return /^https?:\/\//i.test(value);
}
function looksLikeDate(value) {
    return /^\d{4}-\d{2}-\d{2}/.test(value);
}
function choiceLabel(value, choices, lang, schema) {
    if (!choices || choices.length === 0) {
        return humanize(value);
    }
    const match = choices.find((choice) => choice.value === value ||
        (Array.isArray(choice.replaces) && choice.replaces.includes(value)));
    if (!match) {
        return humanize(value);
    }
    return (0, locale_1.resolveFluentLabel)(match.label, lang, schema) ?? humanize(value);
}
function schemaFieldByName(schema, name) {
    return schema?.dataset_fields?.find((field) => field.field_name === name);
}
function inferType(id, value, schemaField) {
    if (DESCRIPTION_IDS.has(id) || schemaField?.preset?.includes("notes")) {
        return "markdown";
    }
    if (DATE_IDS.has(id) || schemaField?.preset?.includes("date")) {
        return "date";
    }
    if (id.endsWith("_email") || id === "author_email") {
        return "email";
    }
    if (id.endsWith("_url") || id === "url") {
        return "url";
    }
    if (Array.isArray(value)) {
        if (value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
            return "repeating";
        }
        return "list";
    }
    if (value !== null && typeof value === "object") {
        return "keyvalue";
    }
    if (typeof value === "string") {
        if (looksLikeEmail(value)) {
            return "email";
        }
        if (looksLikeUrl(value)) {
            return "url";
        }
        if (looksLikeDate(value)) {
            return "date";
        }
        if (value.includes("\n") || value.length > 280) {
            return "markdown";
        }
    }
    return "text";
}
function inferGroup(id) {
    if (DESCRIPTION_IDS.has(id) || id === "title" || id === "keywords") {
        return "Overview";
    }
    if (DATE_IDS.has(id) || id === "frequency" || id === "temporal_coverage") {
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
function inferSource(id, schema) {
    if (CORE_PACKAGE_KEYS.has(id) || id === "license" || id === "organization") {
        return "core";
    }
    if (schemaFieldByName(schema, id)) {
        return "schema";
    }
    if (id.startsWith("extras.")) {
        return "extra";
    }
    return schema ? "schema" : "extra";
}
function isRecommended(id, schema) {
    if (exports.CORE_RECOMMENDED_FIELD_IDS.has(id)) {
        return true;
    }
    const sidebar = schema?.sidebar_show_fields ?? [];
    return sidebar.includes(id);
}
function formatScalar(value, id, schemaField, lang, schema) {
    if (isEmpty(value)) {
        return undefined;
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (typeof value === "string") {
        if (looksLikeDate(value)) {
            return formatDateValue(value);
        }
        if (schemaField?.choices) {
            return choiceLabel(value, schemaField.choices, lang, schema);
        }
        return value;
    }
    return undefined;
}
function formatList(value, id, schemaField, lang, schema) {
    const items = [];
    for (const item of value) {
        const resolved = (0, locale_1.resolveFluent)(item, lang, schema);
        const formatted = formatScalar(resolved, id, schemaField, lang, schema);
        if (formatted) {
            items.push(formatted);
        }
    }
    return items;
}
function formatObject(value, lang, schema) {
    const parts = [];
    for (const [key, raw] of Object.entries(value)) {
        const resolved = (0, locale_1.resolveFluent)(tryParseJsonValue(raw), lang, schema);
        if (isEmpty(resolved)) {
            continue;
        }
        if (typeof resolved === "string" || typeof resolved === "number") {
            parts.push(`${humanize(key)}: ${resolved}`);
        }
    }
    return parts.length > 0 ? parts.join("; ") : undefined;
}
function splitBilingualPipe(value, lang) {
    if (!value.includes(" | ")) {
        return value;
    }
    const [left, right] = value.split(" | ");
    const requested = (lang ?? "en").toLowerCase();
    if (requested.startsWith("fr") && right) {
        return right.trim();
    }
    return left.trim();
}
function buildLicenseField(pkg, lang, schema) {
    const title = (typeof pkg.license_title === "string" && pkg.license_title) ||
        (typeof pkg.license_id === "string" && pkg.license_id) ||
        undefined;
    if (!title) {
        return null;
    }
    const url = typeof pkg.license_url === "string" ? pkg.license_url : undefined;
    const schemaField = schemaFieldByName(schema, "license_id");
    const label = (0, locale_1.resolveFluentLabel)(schemaField?.label, lang, schema) ?? "Licence";
    return {
        id: "license",
        label,
        value: { title, url },
        displayValue: title,
        type: url ? "url" : "text",
        group: "Attribution",
        source: "core",
        recommended: true,
        technical: false,
    };
}
function buildOrganizationField(pkg, lang, schema) {
    const org = pkg.organization;
    const rawTitle = org && typeof org === "object" && typeof org.title === "string"
        ? org.title
        : undefined;
    if (!rawTitle) {
        return null;
    }
    const title = splitBilingualPipe(rawTitle, lang);
    const schemaField = schemaFieldByName(schema, "owner_org");
    const label = (0, locale_1.resolveFluentLabel)(schemaField?.label, lang, schema) ?? "Organization";
    return {
        id: "organization",
        label,
        value: { ...org, title },
        displayValue: title,
        type: "text",
        group: "Attribution",
        source: "core",
        recommended: true,
        technical: false,
    };
}
function buildTemporalCoverage(pkg, lang, schema) {
    const startRaw = typeof pkg.time_period_coverage_start === "string"
        ? formatDateValue(pkg.time_period_coverage_start)
        : undefined;
    const endRaw = typeof pkg.time_period_coverage_end === "string"
        ? formatDateValue(pkg.time_period_coverage_end)
        : undefined;
    if (!startRaw && !endRaw) {
        return null;
    }
    const display = startRaw && endRaw
        ? `${startRaw} – ${endRaw}`
        : startRaw
            ? startRaw
            : endRaw;
    return {
        id: "temporal_coverage",
        label: "Temporal coverage",
        value: { start: startRaw, end: endRaw },
        displayValue: display,
        type: "date",
        group: "Dates",
        source: "schema",
        recommended: true,
        technical: false,
    };
}
function skipRawId(id) {
    return (exports.TECHNICAL_FIELD_IDS.has(id) ||
        id === "title" ||
        id === "title_translated" ||
        id === "license_id" ||
        id === "license_title" ||
        id === "license_url" ||
        id === "time_period_coverage_start" ||
        id === "time_period_coverage_end" ||
        id === "organization" ||
        id === "extras" ||
        id === "resources" ||
        id === "groups" ||
        id === "tags");
}
function toField(id, rawValue, lang, schema) {
    if (skipRawId(id)) {
        return null;
    }
    const parsed = tryParseJsonValue(rawValue);
    const resolved = (0, locale_1.resolveFluent)(parsed, lang, schema);
    if (isEmpty(resolved)) {
        return null;
    }
    if (typeof resolved === "string" && looksLikeDate(resolved) && isSentinelDate(resolved)) {
        return null;
    }
    const schemaField = schemaFieldByName(schema, id);
    const label = (0, locale_1.resolveFluentLabel)(schemaField?.label, lang, schema) ?? humanize(id);
    const type = inferType(id, resolved, schemaField);
    const group = inferGroup(id);
    const source = inferSource(id, schema);
    const recommended = isRecommended(id, schema);
    let displayValue;
    if (Array.isArray(resolved)) {
        if (type === "repeating") {
            displayValue = resolved
                .map((item) => item && typeof item === "object"
                ? formatObject(item, lang, schema)
                : formatScalar(item, id, schemaField, lang, schema))
                .filter((item) => Boolean(item));
        }
        else {
            displayValue = formatList(resolved, id, schemaField, lang, schema);
        }
    }
    else if (resolved !== null && typeof resolved === "object") {
        displayValue = formatObject(resolved, lang, schema);
    }
    else {
        displayValue = formatScalar(resolved, id, schemaField, lang, schema);
    }
    if (displayValue === undefined ||
        (Array.isArray(displayValue) && displayValue.length === 0)) {
        if (type !== "markdown") {
            return null;
        }
    }
    return {
        id,
        label,
        value: resolved,
        displayValue,
        type,
        group,
        source,
        recommended,
        technical: false,
    };
}
function normalizeCkanPackage(pkgInput, schemaInput, options = {}) {
    if (!isCkanPackage(pkgInput)) {
        return [];
    }
    const schema = isCkanSchema(schemaInput) ? schemaInput : null;
    const lang = options.lang;
    const fields = [];
    const seen = new Set();
    const push = (field) => {
        if (!field || seen.has(field.id)) {
            return;
        }
        seen.add(field.id);
        fields.push(field);
    };
    const notes = pkgInput.notes_translated !== undefined
        ? toField("notes_translated", pkgInput.notes_translated, lang, schema)
        : toField("notes", pkgInput.notes, lang, schema);
    if (notes) {
        notes.id = "notes";
        if (notes.label === "Notes Translated" || notes.label === "Notes") {
            notes.label =
                (0, locale_1.resolveFluentLabel)(schemaFieldByName(schema, "notes_translated")?.label ??
                    schemaFieldByName(schema, "notes")?.label, lang, schema) ?? "Description";
        }
        push(notes);
    }
    push(buildOrganizationField(pkgInput, lang, schema));
    push(buildLicenseField(pkgInput, lang, schema));
    push(buildTemporalCoverage(pkgInput, lang, schema));
    const keys = new Set([
        ...Object.keys(pkgInput),
        ...(schema?.dataset_fields ?? []).map((field) => field.field_name),
    ]);
    for (const key of keys) {
        if (key === "notes" || key === "notes_translated") {
            continue;
        }
        push(toField(key, pkgInput[key], lang, schema));
    }
    const extras = Array.isArray(pkgInput.extras) ? pkgInput.extras : [];
    for (const extra of extras) {
        if (!extra || typeof extra !== "object") {
            continue;
        }
        const extraKey = extra.key;
        if (typeof extraKey !== "string" || extraKey.length === 0) {
            continue;
        }
        push(toField(`extras.${extraKey}`, extra.value, lang, schema));
    }
    return fields;
}
//# sourceMappingURL=normalize.js.map