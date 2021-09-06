# SeaSketch Next API Server

![packages/api](https://github.com/seasketch/next/workflows/packages/api/badge.svg)

Core server and database codebase for SeaSketch Next. GraphQL server is implemented using [postgraphile](https://www.graphile.org/postgraphile/). Database migrations are specified using [graphile-migrate](https://github.com/graphile/migrate).

## Using `@seasketch/api`

Other packages in this monorepo may need to access the database, or execute complex proceedures like sending out project or survey invites. In an effort to keep most _business logic_ centralized, this core package exports a number of modules for performing such tasks.

To use the `@seasketch/api` module from a package in the same monorepo, use `lerna add @seasketch/api --scope=mypackage`. There is currently no api documentation page for these modules but your IDE should discover ample documentation on each function.

## Getting started running the server

```bash
cd @seasketch/next/packages/api
# as always, start with
npm install
cp .env.template .env # fill in missing values
```

Before starting the server you will need to start the database and redis servers and run database migrations. Postgres and Redis are both prepared in a docker-compose file (`src/docker-compose.yml`). NPM scripts can start these running in the background and perform data migrations by running:

```bash
npm run db:start
npm run db:watch # or db:migrate
```

If doing any work on the server it is best to run the db:watch command so that changes to `migrations/current.sql` are reflected in the database.

Lastly, as part of setup you need a process to compile Typescript to `dist/`. The server process will not run Typescript dynamically so you will need your IDE to compile changes for you. This is easily accomplished if using VS Code by choosing `Terminal -> Run Build Task ⇧⌘B`.

With these services running, starting the server can be accomplished by running:

```bash
npm run watch
# running on localhost:3857/graphiql
```

## The Database

SeaSketch Next makes extensive use of the PostgreSQL database for application business logic and access control. Most applications use server-code for implementing this functionality and use an ORM to treat the database as a general-purpose object store. The SeaSketch architecture goes in the opposite direction. The application server is a thin layer over the database, using postgraphile to automatically generate a graphql schema based on the structure of the database. To contribute to the SeaSketch API server, it's necessary to study up on stored procedures, database triggers, and postgres' role and row-level security policies.

### Writing database migrations

All changes to the database schema are defined in migrations managed by [graphile-migrate](https://github.com/graphile/migrate). Basic steps are as follows:

1. Add new migrations to current.sql. [They must be idempotent!](https://github.com/graphile/migrate#idempotency)
2. Run `npm run db:watch` to see changes in your development database (make sure `db:start` has been run!)
3. Write jest unit tests in `src/tests/` and ensure they pass
4. When ready to commit to master, merge changes and then run `npm run db:commit` on master. graphile-migrate is [not good at merging committed migrations](https://github.com/graphile/migrate#collaboration), so don't add many commits to a long-running feature branch.

### Data (not schema) migrations

Complex data migrations are not explicitly handled by the framework we are using. These will have to be handled on a case-by-case basis. Simple migrations could be a matter of just including copying and modification of data within a migration commit. Complex cases may consist of interim schema changes to support long-running, manual data munging until a second set of final database migrations and code changes.

### Production migrations

Use the pull request based deployment pipeline.

### Authoring Documentation

High-level documentation on complex systems like project invites or authorization should be provided via the [wiki](https://github.com/seasketch/next/wiki). Documentation on how to use database tables, columns and functions are primarily of interest in the context of the GraphQL API. This documentation is generated from the database and so needs to be provided from the `db` package. GraphQL should work well as a primary documentation source since it can be browsed using graphiql and can also be used within IDE's when developing clients.

##### Database Smart Comments

Comments on database items will be reflected in the GraphQL API using the [graphile database smart comments system](https://www.graphile.org/postgraphile/smart-comments/). This systems enables authors to do things like add a database comment on a table, which then appears in the graphql schema as the documentation for that table's GraphQL Type. This documentation can be browsed in either the production server or locally at the `/graphiql` endpoint.

##### Customizing documentation further

Smart Comments have some limitations, so the SeaSketch [api server](../api) features a custom postgraphile plugin that can be used to add additional documentation to any type or field. It can also be used to set the order of resources in the schema. To customize documentation, edit the [graphqlSchemaModifiers.ts](https://github.com/seasketch/next/blob/master/packages/api/src/graphqlSchemaModifiers.ts) file.

##### Tips for good documentation

- Always document new tables and functions with [Smart Comments](https://www.graphile.org/postgraphile/smart-comments/)
- Document columns if there is any ambiguity in how they might be used
- Use markdown when necessary to format documentation
- Mention related queries or mutations when adding documentation to enhance discoverability
- Always put custom queries or mutations towards the top of the schema and group fields with similar functionality using [graphqlSchemaModifiers.ts](https://github.com/seasketch/next/blob/master/packages/api/src/graphqlSchemaModifiers.ts)

### Role and Row-level access control

A major barrier to embedding application logic in the database in the past has been the limitations of role-based access control. In a multi-tenant application like SeaSketch there are very complex access control rules that rely on the data itself. Row-level security policies introduced in 9.5 changed that. Each new table added to the SeaSketch database will likely need new access control rules enforced in the database (and carried through automatically by Postgraphile). [Read more about authorization in SeaSketch](https://github.com/seasketch/next/wiki/Authentication-and-Authorization).

## GraphQL API Server

The [postgraphile](https://www.graphile.org/postgraphile/)-based server exposes a GraphQL endpoint by introspecting the database schema and user roles. Contributors will need to read the postgraphile documentation thoroughly. Here's a short primer:

- Table visibility is determined by role-based access control rules. By default all tables and functions are hidden, and require statements like `GRANT select on table tbl to anon` in order to show up in the api. Roles include `anon`, `seasketch_user`, and `seasketch_superuser`. Read the [authorization wiki](https://github.com/seasketch/next/wiki/Authentication-and-Authorization) for more information.
- Lots of behavior can be customized by using [smart tags](https://www.graphile.org/postgraphile/smart-tags/) embedded in [database comments](https://www.graphile.org/postgraphile/smart-comments/).
- Custom queries and mutations can be defined using [database functions](https://www.graphile.org/postgraphile/functions/)
- Further customization can be done with application-code using [graphile plugins](https://www.graphile.org/postgraphile/make-extend-schema-plugin/). Examples can be found in `src/plugins`.

## Task Runner

Not all behavior of the system can be encapsulated in database stored procedures and custom resolvers. Some jobs need to be run outside of the request/response cycle, and others may need to run on a cron-like schedule. For this, SeaSketch uses [graphile-worker](https://github.com/graphile/worker). Tasks can be found under the [/tasks directory](https://github.com/seasketch/next/tree/master/packages/api/tasks), and are triggered by jobs held in the `graphile_worker.jobs` table.

For cron-like tasks scheduling, jobs should be added as part of the database migration system. Other jobs may be created in response to data changes by using database triggers, such as in the case of [sending project invites](https://github.com/seasketch/next/tree/master/packages/api/migrations/committed/000055.sql#L42). Care should be taken not to overload the API servers with computationally taxing jobs, which they will run up to the concurrency limit set in `process.env.GRAPHILE_WORKER_CONCURRENCY`. In the case of expensive jobs, the task definition run on the API server should simply invoke a Lambda microservice.

## NPM Scripts

#### `npm test`

Runs unit tests using jest.

#### `npm start`

Starts the API server.

#### `npm run watch`

Runs the API server in watch mode so that it will respond to code updates. Be sure to recompile sources in VSCode using `Terminal -> Run Build Task ⇧⌘B` as only updates to `dist/` will be recognized.

#### `npm run debug`

Runs the API server in watch mode while enabling the node `--inspect` option. Can be used to debug the server with Chrome Developer Tools.

#### `npm build`

Build Typescript sources and emit to `dist/`.

#### `npm run db:start`

Starts the services defined in `docker-compose.yml` in the background. This includes the postgres database and redis.

#### `npm run db:watch`

Runs committed database migrations + runs and watches for changes in `migrations/current.sql`. Use this when editing the database schema.

#### `npm run db:shell`

Shortcut to start a psql shell using the dev database connection string.

#### `npm run db:stop`

Stops docker-compose services.

#### `npm run db:down`

Runs docker-compose down. Data will _not_ be persisted.

#### `npm run db:migrate`

Runs committed database migrations.

#### `npm run db:commit`

Commit changes from current.sql to a migration.

#### `npm run db:uncommit`

Undo most recent db:commit

#### `npm run db:reset`

Empty the database and reset migrations.

#### `npm run db:status`

Prints database migration state from graphile-migrate.

#### `npm run db:shell`

Shortcut to start a psql shell using the dev database connection string.

#### `npm run db:schema`

Writes the current database schema to `schema.sql`.
