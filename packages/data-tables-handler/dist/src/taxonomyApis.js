"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORMS_FETCH_TIMEOUT_MS = exports.WORMS_MIN_INTERVAL_MS = exports.WORMS_MATCH_NAME_BATCH = exports.ORGANISM_USER_AGENT = exports.WORMS_REST_URL = void 0;
exports.createRateLimiter = createRateLimiter;
exports.rewriteTaxonomyUrl = rewriteTaxonomyUrl;
exports.createTaxonomyFetch = createTaxonomyFetch;
exports.fetchWormsRecordByAphiaId = fetchWormsRecordByAphiaId;
exports.fetchWormsMatchNames = fetchWormsMatchNames;
exports.fetchWormsClassification = fetchWormsClassification;
exports.fetchWormsVernaculars = fetchWormsVernaculars;
exports.pickWormsAccepted = pickWormsAccepted;
exports.singleMappedInatId = singleMappedInatId;
exports.sanitizeWormsQueryName = sanitizeWormsQueryName;
exports.wormsQueryName = wormsQueryName;
exports.ancestorsFromWormsRecord = ancestorsFromWormsRecord;
exports.resolveOrganismTaxa = resolveOrganismTaxa;
exports.resolveOrganismTaxon = resolveOrganismTaxon;
const geostats_types_1 = require("@seasketch/geostats-types");
const duckDb_1 = require("./duckDb");
const wikidataCrosswalk_1 = require("./wikidataCrosswalk");
const wormsParquet_1 = require("./wormsParquet");
/** Live WoRMS REST. Used only when the public parquet snapshot misses. */
exports.WORMS_REST_URL = "https://www.marinespecies.org/rest";
exports.ORGANISM_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
exports.WORMS_MATCH_NAME_BATCH = 50;
/** Polite floor between WoRMS calls. 429s already back off. */
exports.WORMS_MIN_INTERVAL_MS = 50;
/** Taxamatch can 500/hang on lumped survey names; fail the attempt instead. */
exports.WORMS_FETCH_TIMEOUT_MS = 20000;
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
            signal: init?.signal,
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
async function fetchJson(clients, provider, url, init, maxAttempts = 4) {
    await (clients.waitWorms || (async () => undefined))();
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const started = Date.now();
        const retry = attempt > 0 ? ` retry=${attempt}` : "";
        try {
            const response = await clients.fetch(url, {
                method: init?.method,
                headers: {
                    Accept: "application/json",
                    "User-Agent": exports.ORGANISM_USER_AGENT,
                    ...(init?.headers || {}),
                },
                body: init?.body,
                signal: AbortSignal.timeout(exports.WORMS_FETCH_TIMEOUT_MS),
            });
            const ms = Date.now() - started;
            logTaxonomy(`${provider} ${response.status} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`);
            if (response.ok) {
                // WoRMS uses 204 (empty body) for “no vernaculars”, not a redirect.
                if (response.status === 204)
                    return null;
                try {
                    return await response.json();
                }
                catch {
                    return null;
                }
            }
            lastError = new Error(`${provider} ${response.status} for ${url}`);
            if (response.status !== 429 && response.status < 500) {
                throw lastError;
            }
        }
        catch (error) {
            if (error instanceof Error && lastError === error) {
                throw error;
            }
            lastError =
                error instanceof Error ? error : new Error(String(error));
            const ms = Date.now() - started;
            logTaxonomy(`${provider} ${lastError.message} ${ms}ms ${shortTaxonomyUrl(url)}${retry}`);
        }
        if (attempt >= maxAttempts - 1)
            break;
        const backoff = 1000 * 2 ** attempt;
        logTaxonomy(`${provider} backing off ${backoff}ms after ${lastError?.message || "error"}`);
        await sleep(backoff);
    }
    throw lastError || new Error(`${provider} failed for ${url}`);
}
async function fetchWormsRecordByAphiaId(clients, aphiaId) {
    const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaRecordByAphiaID/${aphiaId}`);
    return isRecord(json) ? json : null;
}
async function fetchWormsMatchNameBatch(clients, batch) {
    const params = new URLSearchParams();
    for (const name of batch) {
        params.append("scientificnames[]", name);
    }
    const json = await fetchJson(clients, "worms", `${exports.WORMS_REST_URL}/AphiaRecordsByMatchNames?${params.toString()}`, undefined, batch.length > 1 ? 1 : 4);
    const groups = Array.isArray(json) ? json : batch.map(() => []);
    return batch.map((_, g) => {
        const group = groups[g];
        return Array.isArray(group) ? group.filter(isRecord) : [];
    });
}
async function fetchWormsMatchNames(clients, names) {
    if (names.length === 0)
        return [];
    const out = [];
    for (let i = 0; i < names.length; i += exports.WORMS_MATCH_NAME_BATCH) {
        const batch = names.slice(i, i + exports.WORMS_MATCH_NAME_BATCH);
        try {
            out.push(...(await fetchWormsMatchNameBatch(clients, batch)));
        }
        catch (error) {
            if (batch.length === 1) {
                logTaxonomy("worms match-names name failed", {
                    name: batch[0],
                    error: error instanceof Error ? error.message : String(error),
                });
                out.push([]);
                continue;
            }
            logTaxonomy("worms match-names batch failed; retrying names", {
                batchSize: batch.length,
                error: error instanceof Error ? error.message : String(error),
            });
            for (const name of batch) {
                try {
                    out.push(...(await fetchWormsMatchNameBatch(clients, [name])));
                }
                catch (nameError) {
                    logTaxonomy("worms match-names name failed", {
                        name,
                        error: nameError instanceof Error ? nameError.message : String(nameError),
                    });
                    out.push([]);
                }
            }
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
/** One shared iNat id, or null when the keys disagree or all miss. */
function singleMappedInatId(keys, byKey) {
    let found = null;
    for (const key of keys) {
        const id = byKey.get(key);
        if (!id)
            continue;
        if (found !== null && found !== id)
            return null;
        found = id;
    }
    return found;
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
const WORMS_LIFE_STAGE_SUFFIX = /\s+(eggs?|yoy|young[-\s]of[-\s]year|larvae|larva|juveniles?|adults?|recruits?)$/i;
/** Strip survey life-stage tags and lumped species lists before Taxamatch. */
function sanitizeWormsQueryName(name) {
    let cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned)
        return null;
    cleaned = cleaned.replace(WORMS_LIFE_STAGE_SUFFIX, "").trim();
    if (/[,/]/.test(cleaned)) {
        return (0, geostats_types_1.genusFromOrganismName)(cleaned);
    }
    cleaned = (0, wormsParquet_1.stripWormsAuthorship)(cleaned).replace(/\s+/g, " ").trim();
    return cleaned || null;
}
function wormsQueryName(input) {
    const raw = input.scientificName ||
        (input.genus && input.species ? `${input.genus} ${input.species}` : null) ||
        ((0, geostats_types_1.isLumpedOrganismValue)(input.value)
            ? (0, geostats_types_1.genusFromOrganismName)(input.value)
            : null);
    return raw ? sanitizeWormsQueryName(raw) : null;
}
const WORMS_RECORD_RANKS = [
    "kingdom",
    "phylum",
    "class",
    "order",
    "family",
    "genus",
];
function ancestorsFromWormsRecord(worms) {
    const names = [];
    for (const field of WORMS_RECORD_RANKS) {
        const value = worms[field];
        if (typeof value === "string" && value.trim())
            names.push(value.trim());
    }
    if (typeof worms.scientificname === "string" && worms.scientificname.trim()) {
        names.push(worms.scientificname.trim());
    }
    return (0, geostats_types_1.uniqueStrings)(names);
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
    target.ancestorNames = (0, geostats_types_1.uniqueStrings)([
        ...target.ancestorNames,
        ...ancestorsFromWormsRecord(worms),
    ]);
}
function applyWormsTaxonRow(target, taxon) {
    target.wormsAphiaId = taxon.accepted_aphia_id || taxon.aphia_id;
    if (taxon.scientific_name) {
        target.scientificName =
            (0, wormsParquet_1.stripWormsAuthorship)(taxon.scientific_name) || taxon.scientific_name;
    }
    if (taxon.genus)
        target.genus = taxon.genus;
    if (taxon.family)
        target.family = taxon.family;
    target.ancestorNames = (0, geostats_types_1.uniqueStrings)([
        ...target.ancestorNames,
        ...taxon.ancestor_names,
    ]);
    target.commonNames = (0, geostats_types_1.uniqueStrings)([
        ...target.commonNames,
        ...taxon.vernaculars,
    ]);
    if (!target.commonName && taxon.common_name) {
        target.commonName = taxon.common_name;
    }
    if (target.scientificName) {
        target.confidence = "high";
    }
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
    const parquetFilledIds = new Set();
    let restAphiaIds = uniqueAphiaIds.slice();
    let restMatchNames = uniqueMatchNames.slice();
    if (clients.wormsParquetDir) {
        try {
            const parquet = await (0, duckDb_1.withDuckDb)(async (conn) => {
                const byId = await (0, wormsParquet_1.lookupWormsTaxaByAphiaIds)(conn, clients.wormsParquetDir, uniqueAphiaIds);
                const byName = await (0, wormsParquet_1.lookupWormsTaxaByNames)(conn, clients.wormsParquetDir, uniqueMatchNames);
                return { byId, byName };
            });
            for (let i = 0; i < results.length; i++) {
                const id = results[i].wormsAphiaId;
                const fromId = id ? parquet.byId.get(id) : undefined;
                if (fromId) {
                    applyWormsTaxonRow(results[i], fromId);
                    const filledId = results[i].wormsAphiaId;
                    if (filledId)
                        parquetFilledIds.add(filledId);
                    continue;
                }
                const name = wormsNameByIndex[i];
                const fromName = name
                    ? parquet.byName.get((0, wormsParquet_1.normalizeWormsNameKey)(name))
                    : undefined;
                if (fromName) {
                    applyWormsTaxonRow(results[i], fromName);
                    const filledId = results[i].wormsAphiaId;
                    if (filledId)
                        parquetFilledIds.add(filledId);
                }
            }
            restAphiaIds = uniqueAphiaIds.filter((id) => !parquet.byId.has(id));
            restMatchNames = uniqueMatchNames.filter((name) => !parquet.byName.has((0, wormsParquet_1.normalizeWormsNameKey)(name)));
            logTaxonomy("parquet", {
                hitsById: parquet.byId.size,
                hitsByName: parquet.byName.size,
                missIds: restAphiaIds.length,
                missNames: restMatchNames.length,
            });
        }
        catch (error) {
            logTaxonomy("parquet lookup failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    logTaxonomy("plan", {
        inputs: inputs.length,
        uniqueAphiaIds: uniqueAphiaIds.length,
        uniqueScientificNames: uniqueMatchNames.length,
        restAphiaIds: restAphiaIds.length,
        restScientificNames: restMatchNames.length,
        wormsEtaSec: Math.round((restAphiaIds.length +
            Math.ceil(restMatchNames.length / exports.WORMS_MATCH_NAME_BATCH)) *
            (exports.WORMS_MIN_INTERVAL_MS / 1000)),
    });
    const wormsById = new Map();
    if (restAphiaIds.length === 0) {
        await report({ phase: "worms-ids", done: 1, total: 1 });
    }
    for (let i = 0; i < restAphiaIds.length; i++) {
        const id = restAphiaIds[i];
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
            total: restAphiaIds.length,
        });
    }
    const wormsByName = new Map();
    try {
        const groups = [];
        for (let i = 0; i < restMatchNames.length; i += exports.WORMS_MATCH_NAME_BATCH) {
            const batch = restMatchNames.slice(i, i + exports.WORMS_MATCH_NAME_BATCH);
            await report({
                phase: "worms-names",
                done: Math.min(i + 1, restMatchNames.length),
                total: Math.max(restMatchNames.length, 1),
            });
            const batchGroups = await fetchWormsMatchNames(clients, batch);
            groups.push(...batchGroups);
            await report({
                phase: "worms-names",
                done: Math.min(i + batch.length, restMatchNames.length),
                total: Math.max(restMatchNames.length, 1),
            });
        }
        if (restMatchNames.length === 0) {
            await report({ phase: "worms-names", done: 1, total: 1 });
        }
        for (let i = 0; i < restMatchNames.length; i++) {
            const picked = pickWormsAccepted(groups[i] || []);
            if (picked)
                wormsByName.set(restMatchNames[i].toLowerCase(), picked);
        }
    }
    catch (error) {
        logTaxonomy("worms match-names failed", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    for (let i = 0; i < results.length; i++) {
        const alreadyFilled = results[i].wormsAphiaId;
        if (alreadyFilled && parquetFilledIds.has(alreadyFilled)) {
            continue;
        }
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
    // Taxamatch / synonym REST can land on an AphiaID the snapshot already has.
    if (clients.wormsParquetDir) {
        const pending = acceptedIds.filter((id) => !parquetFilledIds.has(id));
        if (pending.length > 0) {
            try {
                const byId = await (0, duckDb_1.withDuckDb)(async (conn) => (0, wormsParquet_1.lookupWormsTaxaByAphiaIds)(conn, clients.wormsParquetDir, pending));
                for (const row of results) {
                    if (!row.wormsAphiaId || parquetFilledIds.has(row.wormsAphiaId)) {
                        continue;
                    }
                    const taxon = byId.get(row.wormsAphiaId);
                    if (!taxon)
                        continue;
                    applyWormsTaxonRow(row, taxon);
                    parquetFilledIds.add(row.wormsAphiaId);
                }
            }
            catch (error) {
                logTaxonomy("parquet refill failed", {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    const restDetailIds = acceptedIds.filter((id) => !parquetFilledIds.has(id));
    const vernacularsById = new Map();
    logTaxonomy("worms details plan", {
        acceptedAphiaIds: acceptedIds.length,
        restDetailIds: restDetailIds.length,
        wormsDetailsEtaSec: Math.round(restDetailIds.length * (exports.WORMS_MIN_INTERVAL_MS / 1000)),
    });
    for (let i = 0; i < restDetailIds.length; i++) {
        const id = restDetailIds[i];
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
            total: Math.max(restDetailIds.length, 1),
        });
    }
    if (restDetailIds.length === 0) {
        await report({ phase: "worms-details", done: 1, total: 1 });
    }
    for (const row of results) {
        if (!row.wormsAphiaId)
            continue;
        row.commonNames = (0, geostats_types_1.uniqueStrings)([
            ...row.commonNames,
            ...(vernacularsById.get(row.wormsAphiaId) || []),
        ]);
        if (row.scientificName) {
            row.confidence = "high";
        }
    }
    let synonymsByAccepted = new Map();
    if (clients.wormsParquetDir && acceptedIds.length > 0) {
        try {
            synonymsByAccepted = await (0, duckDb_1.withDuckDb)((conn) => (0, wormsParquet_1.lookupWormsSynonymKeys)(conn, clients.wormsParquetDir, acceptedIds));
        }
        catch (error) {
            logTaxonomy("parquet synonyms failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    const wikiAphiaIds = [];
    const seenWikiAphia = new Set();
    const addWikiAphia = (id) => {
        if (!id || id <= 0 || seenWikiAphia.has(id))
            return;
        seenWikiAphia.add(id);
        wikiAphiaIds.push(id);
    };
    for (const row of results) {
        addWikiAphia(row.wormsAphiaId);
        const synonyms = row.wormsAphiaId
            ? synonymsByAccepted.get(row.wormsAphiaId)
            : undefined;
        for (const id of synonyms?.aphiaIds || [])
            addWikiAphia(id);
    }
    for (const input of inputs)
        addWikiAphia(input.wormsAphiaId);
    const wikiNames = [];
    for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const input = inputs[i];
        const synonyms = row.wormsAphiaId
            ? synonymsByAccepted.get(row.wormsAphiaId)
            : undefined;
        for (const name of [
            row.scientificName,
            input.scientificName,
            input.commonName,
            row.commonName,
            ...(input.extraNames || []),
            ...row.commonNames,
            ...(synonyms?.scientificNames || []),
        ]) {
            if (name)
                wikiNames.push(name);
        }
    }
    logTaxonomy("wikidata plan", {
        aphiaIds: wikiAphiaIds.length,
        names: wikiNames.length,
    });
    let wikiByAphia = new Map();
    let wikiByName = new Map();
    try {
        const crosswalk = await (0, wikidataCrosswalk_1.fetchWikidataInatCrosswalk)(clients.fetch, {
            aphiaIds: wikiAphiaIds,
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
        const inputAphia = inputs[i].wormsAphiaId;
        const scientific = row.scientificName || inputs[i].scientificName;
        const synonyms = row.wormsAphiaId
            ? synonymsByAccepted.get(row.wormsAphiaId)
            : undefined;
        if (row.wormsAphiaId && wikiByAphia.has(row.wormsAphiaId)) {
            inatId = wikiByAphia.get(row.wormsAphiaId);
            confidence = "high";
        }
        if (inatId === null) {
            const fromSynonymAphia = singleMappedInatId(synonyms?.aphiaIds || [], wikiByAphia);
            if (fromSynonymAphia) {
                inatId = fromSynonymAphia;
                confidence = "high";
            }
        }
        if (inatId === null && inputAphia && wikiByAphia.has(inputAphia)) {
            inatId = wikiByAphia.get(inputAphia);
            confidence = "high";
        }
        if (inatId === null &&
            scientific &&
            wikiByName.has(scientific.toLowerCase())) {
            inatId = wikiByName.get(scientific.toLowerCase());
            confidence = "high";
        }
        if (inatId === null) {
            const fromSynonymName = singleMappedInatId((synonyms?.scientificNames || []).map((name) => name.toLowerCase()), wikiByName);
            if (fromSynonymName) {
                inatId = fromSynonymName;
                confidence = "high";
            }
        }
        if (inatId === null) {
            const common = inputs[i].commonName;
            if (common && wikiByName.has(common.toLowerCase())) {
                inatId = wikiByName.get(common.toLowerCase());
                confidence = row.wormsAphiaId || scientific ? "high" : "low";
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
