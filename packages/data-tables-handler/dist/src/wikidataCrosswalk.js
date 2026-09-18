"use strict";
/**
 * Batch AphiaID / scientific-name → iNaturalist taxon id via Wikidata.
 * iNat has no name-batch API; Wikidata P850 (WoRMS) + P3151 (iNat) + P225
 * (taxon name) can resolve hundreds of ids in a few SPARQL requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIKIDATA_USER_AGENT = exports.WIKIDATA_CROSSWALK_BATCH = exports.WIKIDATA_SPARQL_URL = void 0;
exports.escapeSparqlString = escapeSparqlString;
exports.buildWikidataAphiaQuery = buildWikidataAphiaQuery;
exports.buildWikidataNameQuery = buildWikidataNameQuery;
exports.buildWikidataLabelQuery = buildWikidataLabelQuery;
exports.parseWikidataInatBindings = parseWikidataInatBindings;
exports.assignUniqueInatId = assignUniqueInatId;
exports.fetchWikidataInatCrosswalk = fetchWikidataInatCrosswalk;
exports.WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
exports.WIKIDATA_CROSSWALK_BATCH = 50;
exports.WIKIDATA_USER_AGENT = "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";
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
    const values = names.map((name) => `"${escapeSparqlString(name)}"`).join(" ");
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
/** Keep a key only when every hit agrees on the same iNat id. */
function assignUniqueInatId(map, key, inat) {
    const existing = map.get(key);
    if (existing === undefined) {
        map.set(key, inat);
        return;
    }
    if (existing !== inat) {
        map.delete(key);
        map.set(key, -1);
    }
}
function finalizeUniqueMap(map) {
    for (const [key, value] of map) {
        if (value < 0)
            map.delete(key);
    }
    return map;
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
                    assignUniqueInatId(byAphiaKey, row.aphia, row.inat);
            }
        });
    }
    const byName = new Map();
    const applyNameHits = (json) => {
        for (const row of parseWikidataInatBindings(json)) {
            if (row.query) {
                assignUniqueInatId(byName, row.query.toLowerCase(), row.inat);
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
    finalizeUniqueMap(byAphiaKey);
    finalizeUniqueMap(byName);
    const byAphiaId = new Map();
    for (const [key, inat] of byAphiaKey) {
        const aphia = parseInt(key, 10);
        if (aphia > 0)
            byAphiaId.set(aphia, inat);
    }
    return { byAphiaId, byName };
}
