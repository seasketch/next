"use strict";
/**
 * Batch AphiaID / scientific-name → iNaturalist taxon id via Wikidata.
 * iNat has no name-batch API; Wikidata P850 (WoRMS) + P3151 (iNat) + P225
 * (taxon name) can resolve hundreds of ids in a few SPARQL requests.
 * When one key has two P3151s, ask iNat `/v1/taxa/{id,id}` for `is_active`
 * and keep the single live taxon (Rock Scallop: 54526 over 187594).
 * A lone inactive P3151 follows `current_synonymous_taxon_ids`
 * (California Sheephead: 53699 → 1439813).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INATURALIST_TAXA_BATCH = exports.INATURALIST_TAXA_URL = exports.WIKIDATA_USER_AGENT = exports.WIKIDATA_CROSSWALK_BATCH = exports.WIKIDATA_SPARQL_URL = void 0;
exports.escapeSparqlString = escapeSparqlString;
exports.buildWikidataAphiaQuery = buildWikidataAphiaQuery;
exports.buildWikidataNameQuery = buildWikidataNameQuery;
exports.buildWikidataLabelQuery = buildWikidataLabelQuery;
exports.parseWikidataInatBindings = parseWikidataInatBindings;
exports.addInatCandidate = addInatCandidate;
exports.pickActiveInatId = pickActiveInatId;
exports.parseInatTaxonShow = parseInatTaxonShow;
exports.parseInatTaxonActivity = parseInatTaxonActivity;
exports.followInactiveInatId = followInactiveInatId;
exports.fetchWikidataInatCrosswalk = fetchWikidataInatCrosswalk;
exports.WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
exports.WIKIDATA_CROSSWALK_BATCH = 50;
exports.WIKIDATA_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
exports.INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
exports.INATURALIST_TAXA_BATCH = 30;
const INATURALIST_MIN_INTERVAL_MS = 1000;
function escapeSparqlString(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function buildWikidataAphiaQuery(aphiaIds) {
    const values = aphiaIds.map((id) => `"${id}"`).join(" ");
    return `SELECT ?aphia ?inat WHERE {
  VALUES ?aphia { ${values} }
  ?item wdt:P850 ?aphia .
  ?item wdt:P3151 ?inat .
}`;
}
function buildWikidataNameQuery(names) {
    // P1843 vernaculars are language-tagged (`"California Sheephead"@en`).
    // A plain VALUES literal does not match. Include @en copies so both
    // P225 (untyped) and P1843 hit with indexed equality — no FILTER scan.
    const values = names
        .flatMap((name) => {
        const escaped = escapeSparqlString(name);
        return [`"${escaped}"`, `"${escaped}"@en`];
    })
        .join(" ");
    // Only indexed properties bound to VALUES. Do not BIND() a language-tagged
    // rdfs:label inside a UNION — WDQS can treat ?label as unbound and return
    // every P3151 row (Node then dies creating a >512MB string).
    return `SELECT ?query ?inat WHERE {
  VALUES ?query { ${values} }
  ?item wdt:P3151 ?inat .
  { ?item wdt:P225 ?query . } UNION { ?item wdt:P1843 ?query . }
}`;
}
function buildWikidataLabelQuery(names) {
    const values = names
        .map((name) => `"${escapeSparqlString(name)}"@en`)
        .join(" ");
    return `SELECT ?query ?inat WHERE {
  VALUES ?label { ${values} }
  ?item rdfs:label ?label .
  ?item wdt:P3151 ?inat .
  BIND(STR(?label) AS ?query)
}`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function bindingLiteral(row, key) {
    const cell = row[key];
    if (!isRecord(cell) || typeof cell.value !== "string")
        return null;
    const text = cell.value.trim();
    return text.length > 0 ? text : null;
}
function parseWikidataInatBindings(json) {
    if (!isRecord(json) || !isRecord(json.results))
        return [];
    const bindings = json.results.bindings;
    if (!Array.isArray(bindings))
        return [];
    const out = [];
    for (const row of bindings) {
        if (!isRecord(row))
            continue;
        const inatText = bindingLiteral(row, "inat");
        if (!inatText || !/^\d+$/.test(inatText))
            continue;
        const inat = parseInt(inatText, 10);
        if (inat <= 0)
            continue;
        out.push({
            aphia: bindingLiteral(row, "aphia"),
            query: bindingLiteral(row, "query"),
            inat,
        });
    }
    return out;
}
function addInatCandidate(map, key, inat) {
    let ids = map.get(key);
    if (!ids) {
        ids = new Set();
        map.set(key, ids);
    }
    ids.add(inat);
}
/**
 * One candidate: keep it. Several: keep the only `is_active` id.
 * Zero or two-plus live taxa: drop. Inactive singles are remapped
 * later via `current_synonymous_taxon_ids`.
 */
function pickActiveInatId(ids, activity) {
    const unique = [];
    const seen = new Set();
    for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0 || seen.has(id))
            continue;
        seen.add(id);
        unique.push(id);
    }
    if (unique.length === 0)
        return null;
    if (unique.length === 1)
        return unique[0];
    const active = unique.filter((id) => activity.get(id) === true);
    return active.length === 1 ? active[0] : null;
}
function positiveIntIds(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
            continue;
        }
        if (seen.has(raw))
            continue;
        seen.add(raw);
        out.push(raw);
    }
    return out;
}
function parseInatTaxonShow(json) {
    const out = new Map();
    if (!isRecord(json) || !Array.isArray(json.results))
        return out;
    for (const row of json.results) {
        if (!isRecord(row))
            continue;
        if (typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0) {
            continue;
        }
        if (typeof row.is_active !== "boolean")
            continue;
        out.set(row.id, {
            isActive: row.is_active,
            synonymIds: positiveIntIds(row.current_synonymous_taxon_ids),
        });
    }
    return out;
}
function parseInatTaxonActivity(json) {
    const out = new Map();
    for (const [id, info] of parseInatTaxonShow(json)) {
        out.set(id, info.isActive);
    }
    return out;
}
/** Prefer a live iNat id. A lone inactive P3151 follows its accepted synonym. */
function followInactiveInatId(id, show) {
    const info = show.get(id);
    if (!info || info.isActive)
        return id;
    for (const synonym of info.synonymIds) {
        const next = show.get(synonym);
        if (next?.isActive)
            return synonym;
    }
    return info.synonymIds[0] || id;
}
function finalizeCandidateMap(candidates, activity) {
    const out = new Map();
    for (const [key, ids] of candidates) {
        const picked = pickActiveInatId(ids, activity);
        if (picked != null)
            out.set(key, picked);
    }
    return out;
}
async function fetchInatTaxonShow(fetchFn, ids) {
    const show = new Map();
    const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
    for (let i = 0; i < unique.length; i += exports.INATURALIST_TAXA_BATCH) {
        if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, INATURALIST_MIN_INTERVAL_MS));
        }
        const batch = unique.slice(i, i + exports.INATURALIST_TAXA_BATCH);
        const url = `${exports.INATURALIST_TAXA_URL}/${batch.join(",")}`;
        try {
            const response = await fetchFn(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "User-Agent": exports.WIKIDATA_USER_AGENT,
                },
            });
            if (!response.ok) {
                // eslint-disable-next-line no-console
                console.log(`[data-tables-handler] taxonomy inat activity ${response.status}`);
                continue;
            }
            const parsed = parseInatTaxonShow(await response.json());
            for (const [id, info] of parsed)
                show.set(id, info);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.log(`[data-tables-handler] taxonomy inat activity failed ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return show;
}
async function runSparql(fetchFn, query) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetchFn(exports.WIKIDATA_SPARQL_URL, {
            method: "POST",
            headers: {
                Accept: "application/sparql-results+json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": exports.WIKIDATA_USER_AGENT,
            },
            body: `query=${encodeURIComponent(query)}`,
        });
        if (response.ok) {
            return response.json();
        }
        lastError = new Error(`wikidata ${response.status}`);
        if (response.status !== 429 && response.status < 500) {
            throw lastError;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
    throw lastError || new Error("wikidata SPARQL failed");
}
async function fetchWikidataInatCrosswalk(fetchFn, options) {
    const uniqueAphia = Array.from(new Set(options.aphiaIds.filter((id) => id > 0)));
    const uniqueNames = [];
    const seenNames = new Set();
    for (const name of options.names) {
        const trimmed = name.trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLowerCase();
        if (seenNames.has(key))
            continue;
        seenNames.add(key);
        uniqueNames.push(trimmed);
    }
    const aphiaBatches = Math.ceil(uniqueAphia.length / exports.WIKIDATA_CROSSWALK_BATCH);
    const nameBatches = Math.ceil(uniqueNames.length / exports.WIKIDATA_CROSSWALK_BATCH);
    const total = Math.max(aphiaBatches + nameBatches * 2, 1);
    let done = 0;
    const report = async () => {
        if (options.onProgress)
            await options.onProgress(done, total);
    };
    const runBatch = async (query, apply) => {
        try {
            apply(await runSparql(fetchFn, query));
        }
        catch (error) {
            // Keep earlier batches. One bad SPARQL must not wipe Aphia hits.
            // eslint-disable-next-line no-console
            console.log(`[data-tables-handler] taxonomy wikidata batch failed ${error instanceof Error ? error.message : String(error)}`);
        }
        done += 1;
        await report();
    };
    const byAphiaKey = new Map();
    for (let i = 0; i < uniqueAphia.length; i += exports.WIKIDATA_CROSSWALK_BATCH) {
        const batch = uniqueAphia.slice(i, i + exports.WIKIDATA_CROSSWALK_BATCH);
        await runBatch(buildWikidataAphiaQuery(batch), (json) => {
            for (const row of parseWikidataInatBindings(json)) {
                if (row.aphia)
                    addInatCandidate(byAphiaKey, row.aphia, row.inat);
            }
        });
    }
    const byNameCandidates = new Map();
    const applyNameHits = (json) => {
        for (const row of parseWikidataInatBindings(json)) {
            if (row.query) {
                addInatCandidate(byNameCandidates, row.query.toLowerCase(), row.inat);
            }
        }
    };
    for (let i = 0; i < uniqueNames.length; i += exports.WIKIDATA_CROSSWALK_BATCH) {
        const batch = uniqueNames.slice(i, i + exports.WIKIDATA_CROSSWALK_BATCH);
        await runBatch(buildWikidataNameQuery(batch), applyNameHits);
        await runBatch(buildWikidataLabelQuery(batch), applyNameHits);
    }
    if (done === 0) {
        done = 1;
        await report();
    }
    const candidateIds = new Set();
    for (const ids of [...byAphiaKey.values(), ...byNameCandidates.values()]) {
        for (const id of ids)
            candidateIds.add(id);
    }
    const show = candidateIds.size > 0
        ? await fetchInatTaxonShow(fetchFn, Array.from(candidateIds))
        : new Map();
    const activity = new Map();
    for (const [id, info] of show)
        activity.set(id, info.isActive);
    const byAphiaPicked = finalizeCandidateMap(byAphiaKey, activity);
    const byNamePicked = finalizeCandidateMap(byNameCandidates, activity);
    const byAphiaId = new Map();
    for (const [key, inat] of byAphiaPicked) {
        const aphia = parseInt(key, 10);
        if (aphia > 0)
            byAphiaId.set(aphia, followInactiveInatId(inat, show));
    }
    const byName = new Map();
    for (const [key, inat] of byNamePicked) {
        byName.set(key, followInactiveInatId(inat, show));
    }
    return { byAphiaId, byName };
}
