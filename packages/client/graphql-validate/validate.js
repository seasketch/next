#!/usr/bin/env node
/**
 * Introspect a live GraphQL endpoint and validate all client operation
 * documents against that schema. Used as a deploy gate so the SPA is not
 * published until production accepts every query/mutation.
 *
 * This file lives in graphql-validate/ so `require("graphql")` resolves from
 * this package's node_modules after `npm ci` (matching CI), not from
 * packages/client/node_modules via a parent bin/ script path.
 *
 * Documents are merged before validation so fragments shared across
 * .graphql files resolve correctly.
 *
 * Usage:
 *   node graphql-validate/validate.js [endpoint]
 *   GRAPHQL_ENDPOINT=https://api.seasket.ch/graphql npm run graphql:validate:live
 */

const fs = require("fs");
const path = require("path");
const {
  buildClientSchema,
  getIntrospectionQuery,
  parse,
  validate,
  specifiedRules,
  NoUnusedFragmentsRule,
  Kind,
  Source,
} = require("graphql");

const DEFAULT_ENDPOINT = "https://api.seasket.ch/graphql";
const DOCUMENTS_ROOT = path.join(__dirname, "..", "src");
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

// Unused fragments are common with shared fragment libraries and do not
// cause GraphQL request validation failures at runtime.
const VALIDATION_RULES = specifiedRules.filter(
  (rule) => rule !== NoUnusedFragmentsRule
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function walkGraphqlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkGraphqlFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.endsWith(".graphql")) {
      acc.push(fullPath);
    }
  }
  return acc;
}

async function introspect(endpoint) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: getIntrospectionQuery() }),
      });
      if (!response.ok) {
        throw new Error(
          `Introspection HTTP ${response.status}: ${response.statusText}`
        );
      }
      const payload = await response.json();
      if (payload.errors?.length) {
        throw new Error(
          `Introspection GraphQL errors: ${JSON.stringify(payload.errors)}`
        );
      }
      if (!payload.data) {
        throw new Error("Introspection response missing data");
      }
      return buildClientSchema(payload.data);
    } catch (error) {
      lastError = error;
      console.error(
        `Introspection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

function loadMergedDocument() {
  const files = walkGraphqlFiles(DOCUMENTS_ROOT).sort();
  if (files.length === 0) {
    throw new Error(`No .graphql documents found under ${DOCUMENTS_ROOT}`);
  }

  const definitions = [];
  const parseErrors = [];

  for (const file of files) {
    const body = fs.readFileSync(file, "utf8");
    try {
      const document = parse(new Source(body, file));
      definitions.push(...document.definitions);
    } catch (error) {
      parseErrors.push(
        `${path.relative(process.cwd(), file)}: parse error: ${error.message}`
      );
    }
  }

  return {
    files: files.length,
    document: { kind: Kind.DOCUMENT, definitions },
    parseErrors,
  };
}

function formatError(error) {
  const loc = error.locations?.[0];
  const where = loc ? `:${loc.line}:${loc.column}` : "";
  const sourceName = error.source?.name
    ? path.relative(process.cwd(), error.source.name)
    : "merged documents";
  return `${sourceName}${where}: ${error.message}`;
}

async function main() {
  const endpoint =
    process.argv[2] || process.env.GRAPHQL_ENDPOINT || DEFAULT_ENDPOINT;
  console.log(`Validating client GraphQL documents against ${endpoint}`);
  console.log(
    `Using graphql from ${require.resolve("graphql")} (${require("graphql/package.json").version})`
  );

  const schema = await introspect(endpoint);
  const { files, document, parseErrors } = loadMergedDocument();

  if (parseErrors.length) {
    console.error(`\n${parseErrors.length} parse error(s):\n`);
    for (const error of parseErrors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const validationErrors = validate(schema, document, VALIDATION_RULES);
  if (validationErrors.length) {
    console.error(
      `\n${validationErrors.length} validation error(s) across ${files} file(s):\n`
    );
    for (const error of validationErrors) {
      console.error(`  - ${formatError(error)}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: ${document.definitions.length} definition(s) in ${files} file(s) are valid against the live schema.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
