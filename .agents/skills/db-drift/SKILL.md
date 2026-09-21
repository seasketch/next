---
name: db-drift
description: >
  Diagnose and fix SeaSketch GraphQL/database schema drift (`npm run db:drift`,
  CI job "Check for schema and generated code drift"). Use when db:drift fails,
  generated-schema.gql differs from generated-schema-clean.gql, or client
  src/generated/graphql.ts is out of date after a schema change.
---

# SeaSketch `db:drift`

CI compares the committed PostGraphile GraphQL schema to a schema introspected from a **fresh shadow database**. A mismatch fails the `database-drift` job in `.github/workflows/unit-tests.yml`.

Usually what happens when db:drift detects spurious changes in a locally-generated generated-schema.gql is that the local dev database contains schema changes that are not included in the migration files (including `packages/api/committed/*` and `packages/api/migrations/current.sql`). These are undesireable, as the graphql schema being developed against _will not_ match other installs (e.g. production), and local development may reference and rely on these differences in such a way that would otherwise only be discovered in a broken deployment.

This situation can easily happen during development. For example While iterating on `current.sql`, I make the following changes:

```sql

alter table users add column if not exists is_suspended boolean not null default false;

```

Let's say later I decide to not implement that feature, and simply delete that line from `current.sql`. The new column is still on my users table, but it is intentionally not in any migration. The Users.isSuspended flag will still be on my local generated graphql schema though!

## Fixing Problems

In the case of the Users.isSuspended example above, the cleanest solution would be to directly connect to the local database and drop the is_suspended column from the users table. Afterwards, running `npm run db:drift` should have a clean, empty output.

In the general case, the workflow for resolving db drift issues is:

- Run `npm run db:drift` from `packages/api`
- If there are diffs, examine each one, and determine where local dev database schema has diverged from the schema defined in the committed migration files (and current.sql, if any).
- First, identify whether resolving any of these differences would result in deleting substantial and significant local user data. If so, ask for confirmation before proceeding.
- Alter the local dev database directly to resolve these differences. Connect with `npm run db:shell` from `packages/api` (`docker exec -it seasketch_db psql -U postgres seasketch`). For a one-shot statement: `docker exec seasketch_db psql -U postgres seasketch -c '…'`
- Run `npm run db:drift` again, repeating if necessary.

Always keep track of what you changed, and give both a high-level summary of those changes, as well as an explicit list of sql commands run to resolve drift.

## Hard rules

- Put in-progress SQL only in `packages/api/migrations/current.sql`. Never edit `migrations/committed/*` or `schema.sql`.
- Never hand-edit `packages/client/src/generated/*`. Edit `.graphql` operations under `packages/client/src/queries/`, then regenerate.
- Do not `db:reset` or otherwise destroy the local DB.
- Do not commit a `generated-schema.gql` produced from a dirty local dev DB that has objects not in committed migrations + `current.sql`.

**Fast local check** (uses whatever shadow/dev already have):

```bash
cd packages/api
npm run db:drift
```

## Related

- Migration workflow: `AGENTS.md`
- CI: `.github/workflows/unit-tests.yml` job `database-drift`
- Export: `packages/api/src/graphileOptions.ts` (`ignoreRBAC: false`, `exportGqlSchemaPath`)
- Clean generator: `packages/api/src/createCleanGraphqlSchema.ts`
- Migrate hook: `packages/api/.gmrc.js` `afterAllMigrations`
