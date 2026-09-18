"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORMS_MIN_INTERVAL_MS = exports.WORMS_MATCH_NAME_BATCH = exports.ORGANISM_USER_AGENT = exports.WORMS_REST_URL = void 0;
exports.createRateLimiter = createRateLimiter;
exports.rewriteTaxonomyUrl = rewriteTaxonomyUrl;
exports.createTaxonomyFetch = createTaxonomyFetch;
exports.fetchWormsRecordByAphiaId = fetchWormsRecordByAphiaId;
exports.fetchWormsMatchNames = fetchWormsMatchNames;
exports.fetchWormsClassification = fetchWormsClassification;
exports.fetchWormsVernaculars = fetchWormsVernaculars;
exports.pickWormsAccepted = pickWormsAccepted;
exports.wormsQueryName = wormsQueryName;
exports.resolveOrganismTaxa = resolveOrganismTaxa;
exports.resolveOrganismTaxon = resolveOrganismTaxon;
const geostats_types_1 = require("@seasketch/geostats-types");
const wikidataCrosswalk_1 = require("./wikidataCrosswalk");
exports.WORMS_REST_URL = "https://www.marinespecies.org/rest";
exports.ORGANISM_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
exports.WORMS_MATCH_NAME_BATCH = 50;
/** Polite floor between WoRMS calls. 429s already back off. */
exports.WORMS_MIN_INTERVAL_MS = 50;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function shortTaxonomyUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}`;
    }
    catch {
        return url;
    }
}
function logTaxonomy(message, details) {
    const suffix = details ? ` ${JSON.stringify(details)}` : "";
    // eslint-disable-next-line no-console
    console.log(`[data-tables-handler] taxonomy ${message}${suffix}`);
}
function createRateLimiter(minIntervalMs) {
    let nextAt = 0;
    return async function waitForSlot() {
        const now = Date.now();
        const wait = Math.max(0, nextAt - now);
        nextAt = Math.max(now, nextAt) + minIntervalMs;
        if (wait > 0) {
            await sleep(wait);
        }
    };
}
/**
 * Rewrite an upstream taxonomy URL through the pmtiles-server /taxonomy proxy.
 * `proxyBase` is `https://uploads.seasketch.org/taxonomy` (no trailing slash).
 */
function rewriteTaxonomyUrl(url, proxyBase) {
    const base = proxyBase.replace(/\/+$/, "");
    if (url.startsWith(exports.WORMS_REST_URL)) {
        return `${base}/worms${url.slice(exports.WORMS_REST_URL.length)}`;
    }
    return url;
}
function createTaxonomyFetch(fetchFn, proxyBase, accessToken) {
    return async (url, init) => {
        const target = proxyBase ? rewriteTaxonomyUrl(url, proxyBase) : url;
        const headers = { ...(init?.headers || {}) };
        if (proxyBase && accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
        const response = await fetchFn(target, {
            method: init?.method,
            headers,
            body: init?.body,
        });
        return {
            ok: response.ok,
            status: response.status,
            json: () => response.json(),
        };
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asInt(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
        const n = parseInt(value, 10);
        return n > 0 ? n : null;
    }
    return null;
}
function flattenWormsClassification(node, names = []) {
    if (!isRecord(node))
        return names;
    if (typeof node.scientificname === "string") {
        names.push(node.scientificname);
    }
    if (node.child) {
        flattenWormsClassification(node.child, names);
    }
    return names;
}
async function fetchJson(clients, provider, url, init) {
    await (clients.waitWorms || (async () => undefined))();
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
        const started = Date.now();
        const response = await clients.fetch(url, {
            method: init?.method,
            headers: {
                Accept: "application/json",
                "User-Agent": exports.ORGANISM_USER_AGENT,
                ...(init?.headers || {}),
            },
            body: init?.body,
        });
        const ms = Date.now() - started;
        const retry = attempt > 0 ? ` retry=${attempt}` : "";
        logTaxonomy(`${provider} ${response.status} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`);
        if (response.ok) {
            return response.json();
        }
        lastError = new Error(`${provider} ${response.status} for ${url}`);
        if (response.status !== 429 && response.status < 500) {
            throw lastError;
        }
        const backoff = 1000 * 2 ** attempt;
        logTaxonomy(`${provider} backing off ${backoff}ms after ${response.status}`);
        await sleep(backoff);
    }
    throw lastError || new Error(`${provider} failed for ${url}`);
}
async function fetchWormsRecordByAphiaId(clients, aphiaId) {
    const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaRecordByAphiaID/${aphiaId}`);
    return isRecord(json) ? json : null;
}
async function fetchWormsMatchNames(clients, names) {
    if (names.length === 0)
        return [];
    const out = [];
    for (let i = 0; i < names.length; i += exports.WORMS_MATCH_NAME_BATCH) {
        const batch = names.slice(i, i + exports.WORMS_MATCH_NAME_BATCH);
        const params = new URLSearchParams();
        for (const name of batch) {
            params.append("scientificnames[]", name);
        }
        const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaRecordsByMatchNames?${params.toString()}`);
        const groups = Array.isArray(json) ? json : batch.map(() => []);
        for (let g = 0; g < batch.length; g++) {
            const group = groups[g];
            out.push(Array.isArray(group) ? group.filter(isRecord) : []);
        }
    }
    return out;
}
async function fetchWormsClassification(clients, aphiaId) {
    const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaClassificationByAphiaID/${aphiaId}`);
    return (0, geostats_types_1.uniqueStrings)(flattenWormsClassification(json));
}
async function fetchWormsVernaculars(clients, aphiaId) {
    const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaVernacularsByAphiaID/${aphiaId}`);
    if (!Array.isArray(json))
        return [];
    return (0, geostats_types_1.uniqueStrings)(json.map((row) => (isRecord(row) ? String(row.vernacular || "") : "")));
}
/** Prefer an accepted record; otherwise an unaccepted row with a valid_name. */
function pickWormsAccepted(records) {
    if (records.length === 0)
        return null;
    const accepted = records.find((row) => row.status === "accepted");
    if (accepted)
        return accepted;
    const unaccepted = records.find((row) => (typeof row.valid_name === "string" && row.valid_name) ||
        asInt(row.valid_AphiaID));
    return unaccepted || records[0];
}
function stubFromInput(input) {
    return {
        scientificName: input.scientificName || null,
        commonName: input.commonName || null,
        commonNames: (0, geostats_types_1.uniqueStrings)([input.commonName, ...(input.extraNames || [])]),
        genus: input.genus || (0, geostats_types_1.genusFromOrganismName)(input.scientificName || input.value),
        family: null,
        ancestorNames: [],
        inatTaxonId: null,
        wormsAphiaId: input.wormsAphiaId || null,
        confidence: "unresolved",
    };
}
function wormsQueryName(input) {
    if (input.scientificName)
        return input.scientificName;
    if (input.genus && input.species)
        return `${input.genus} ${input.species}`;
    if ((0, geostats_types_1.isLumpedOrganismValue)(input.value)) {
        return (0, geostats_types_1.genusFromOrganismName)(input.value);
    }
    return null;
}
function applyWormsRecord(target, worms) {
    const acceptedId = asInt(worms.valid_AphiaID) || asInt(worms.AphiaID);
    const acceptedName = (typeof worms.valid_name === "string" && worms.valid_name) ||
        (typeof worms.scientificname === "string" && worms.scientificname) ||
        null;
    target.wormsAphiaId = acceptedId;
    target.scientificName = acceptedName || target.scientificName;
    if (typeof worms.genus === "string")
        target.genus = worms.genus;
    if (typeof worms.family === "string")
        target.family = worms.family;
}
async function resolveOrganismTaxa(clients, inputs, onProgress) {
    const results = inputs.map(stubFromInput);
    const report = async (update) => {
        logTaxonomy(`${update.phase} ${update.done}/${update.total}`);
        if (!onProgress)
            return;
        const every = update.phase === "wikidata" ? 1 : 5;
        const isLast = update.done >= update.total;
        if (isLast || update.done === 1 || update.done % every === 0) {
            await onProgress(update);
        }
    };
    const wormsNameByIndex = inputs.map((input, i) => results[i].wormsAphiaId ? null : wormsQueryName(input));
    const uniqueAphiaIds = [];
    const seenAphia = new Set();
    for (const row of results) {
        if (row.wormsAphiaId && !seenAphia.has(row.wormsAphiaId)) {
            seenAphia.add(row.wormsAphiaId);
            uniqueAphiaIds.push(row.wormsAphiaId);
        }
    }
    const uniqueMatchNames = [];
    const seenNames = new Set();
    for (const name of wormsNameByIndex) {
        if (!name)
            continue;
        const key = name.toLowerCase();
        if (seenNames.has(key))
            continue;
        seenNames.add(key);
        uniqueMatchNames.push(name);
    }
    logTaxonomy("plan", {
        inputs: inputs.length,
        uniqueAphiaIds: uniqueAphiaIds.length,
        uniqueScientificNames: uniqueMatchNames.length,
        wormsEtaSec: Math.round((uniqueAphiaIds.length +
            Math.ceil(uniqueMatchNames.length / exports.WORMS_MATCH_NAME_BATCH)) *
            (exports.WORMS_MIN_INTERVAL_MS / 1000)),
    });
    const wormsById = new Map();
    for (let i = 0; i < uniqueAphiaIds.length; i++) {
        const id = uniqueAphiaIds[i];
        try {
            const record = await fetchWormsRecordByAphiaId(clients, id);
            if (record)
                wormsById.set(id, record);
        }
        catch (error) {
            logTaxonomy(`worms id ${id} failed`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        await report({
            phase: "worms-ids",
            done: i + 1,
            total: uniqueAphiaIds.length,
        });
    }
    const wormsByName = new Map();
    try {
        const groups = [];
        for (let i = 0; i < uniqueMatchNames.length; i += exports.WORMS_MATCH_NAME_BATCH) {
            const batch = uniqueMatchNames.slice(i, i + exports.WORMS_MATCH_NAME_BATCH);
            const batchGroups = await fetchWormsMatchNames(clients, batch);
            groups.push(...batchGroups);
            await report({
                phase: "worms-names",
                done: Math.min(i + batch.length, uniqueMatchNames.length),
                total: Math.max(uniqueMatchNames.length, 1),
            });
        }
        if (uniqueMatchNames.length === 0) {
            await report({ phase: "worms-names", done: 1, total: 1 });
        }
        for (let i = 0; i < uniqueMatchNames.length; i++) {
            const picked = pickWormsAccepted(groups[i] || []);
            if (picked)
                wormsByName.set(uniqueMatchNames[i].toLowerCase(), picked);
        }
    }
    catch (error) {
        logTaxonomy("worms match-names failed", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    for (let i = 0; i < results.length; i++) {
        const byId = results[i].wormsAphiaId
            ? wormsById.get(results[i].wormsAphiaId)
            : undefined;
        const name = wormsNameByIndex[i];
        const byName = name ? wormsByName.get(name.toLowerCase()) : undefined;
        const worms = byId || byName;
        if (worms)
            applyWormsRecord(results[i], worms);
    }
    const acceptedIds = [];
    const seenAccepted = new Set();
    for (const row of results) {
        if (row.wormsAphiaId && !seenAccepted.has(row.wormsAphiaId)) {
            seenAccepted.add(row.wormsAphiaId);
            acceptedIds.push(row.wormsAphiaId);
        }
    }
    const classificationById = new Map();
    const vernacularsById = new Map();
    logTaxonomy("worms details plan", {
        acceptedAphiaIds: acceptedIds.length,
        wormsDetailsEtaSec: Math.round(acceptedIds.length * 2 * (exports.WORMS_MIN_INTERVAL_MS / 1000)),
    });
    for (let i = 0; i < acceptedIds.length; i++) {
        const id = acceptedIds[i];
        try {
            classificationById.set(id, await fetchWormsClassification(clients, id));
        }
        catch (error) {
            logTaxonomy(`worms classification ${id} failed`, {
                error: error instanceof Error ? error.message : String(error),
            });
            classificationById.set(id, []);
        }
        try {
            vernacularsById.set(id, await fetchWormsVernaculars(clients, id));
        }
        catch (error) {
            logTaxonomy(`worms vernaculars ${id} failed`, {
                error: error instanceof Error ? error.message : String(error),
            });
            vernacularsById.set(id, []);
        }
        await report({
            phase: "worms-details",
            done: i + 1,
            total: Math.max(acceptedIds.length, 1),
        });
    }
    if (acceptedIds.length === 0) {
        await report({ phase: "worms-details", done: 1, total: 1 });
    }
    for (const row of results) {
        if (!row.wormsAphiaId)
            continue;
        row.ancestorNames = (0, geostats_types_1.uniqueStrings)([
            ...row.ancestorNames,
            ...(classificationById.get(row.wormsAphiaId) || []),
        ]);
        row.commonNames = (0, geostats_types_1.uniqueStrings)([
            ...row.commonNames,
            ...(vernacularsById.get(row.wormsAphiaId) || []),
        ]);
        if (row.scientificName) {
            row.confidence = "high";
        }
    }
    const wikiNames = [];
    for (let i = 0; i < results.length; i++) {
        const resultName = results[i].scientificName;
        const inputName = inputs[i].scientificName;
        const inputCommon = inputs[i].commonName;
        if (resultName)
            wikiNames.push(resultName);
        if (inputName)
            wikiNames.push(inputName);
        if (inputCommon)
            wikiNames.push(inputCommon);
    }
    logTaxonomy("wikidata plan", {
        aphiaIds: acceptedIds.length,
        names: wikiNames.length,
    });
    let wikiByAphia = new Map();
    let wikiByName = new Map();
    try {
        const crosswalk = await (0, wikidataCrosswalk_1.fetchWikidataInatCrosswalk)(clients.fetch, {
            aphiaIds: acceptedIds,
            names: wikiNames,
            onProgress: async (done, total) => {
                await report({ phase: "wikidata", done, total });
            },
        });
        wikiByAphia = crosswalk.byAphiaId;
        wikiByName = crosswalk.byName;
    }
    catch (error) {
        logTaxonomy("wikidata crosswalk failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        await report({ phase: "wikidata", done: 1, total: 1 });
    }
    logTaxonomy("wikidata hits", {
        aphia: wikiByAphia.size,
        names: wikiByName.size,
    });
    for (let i = 0; i < results.length; i++) {
        const row = results[i];
        let inatId = null;
        let confidence = "low";
        if (row.wormsAphiaId && wikiByAphia.has(row.wormsAphiaId)) {
            inatId = wikiByAphia.get(row.wormsAphiaId);
            confidence = "high";
        }
        else {
            const scientific = row.scientificName || inputs[i].scientificName;
            if (scientific && wikiByName.has(scientific.toLowerCase())) {
                inatId = wikiByName.get(scientific.toLowerCase());
                confidence = "high";
            }
            else {
                const common = inputs[i].commonName;
                if (common && wikiByName.has(common.toLowerCase())) {
                    inatId = wikiByName.get(common.toLowerCase());
                    confidence = row.wormsAphiaId || scientific ? "high" : "low";
                }
            }
        }
        if (inatId) {
            row.inatTaxonId = inatId;
            row.confidence = row.wormsAphiaId ? "high" : confidence;
        }
        else if (row.wormsAphiaId) {
            row.confidence = "high";
        }
    }
    return results;
}
async function resolveOrganismTaxon(clients, input) {
    const [row] = await resolveOrganismTaxa(clients, [input]);
    return row;
}
