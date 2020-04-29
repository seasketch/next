# SeaSketch Next Database

This package contains all database schema migrations and unit tests. Migrations are handled by [graphile-migrate](https://github.com/graphile/migrate).

## Installation for local development

```bash
npm install
# runs a postgres database on port 54321
docker-compose up -d
npm run watch
# or
# npm run migrate, commit, uncommit, status
# npm scripts pull connection details from .env
```

To quickly connect to the local db without typing long connection details, run `npm run psql`.

## Writing database migrations

For more detail refer to the [graphile-migrate](https://github.com/graphile/migrate) documentation. Basic steps are as follows:

  1. Add new migrations to current.sql
  2. Run `npm run watch` to see changes in your development database (make sure to run `docker-compose up -d`)
  3. Write jest unit tests in `tests/` and ensure they pass
  4. When ready to commit to master, merge changes and then run `npm run commit` on master. graphile-migrate is [not good at merging committed migrations](https://github.com/graphile/migrate#collaboration), so don't add many commits to a long-running feature branch.

## Data migrations

Complex data migrations are not explicitly handled by the framework we are using. These will have to be handled on a case-by-case basis. Simple migrations could be a matter of just including copying and modification of data within a migration commit. Complex cases may consist of interim schema changes to support long-running, manual data munging until a second set of final database migrations and code changes.

## Production migrations

TBD workflow will likely involve a GitHub Actions based continuous deployment system that runs migrations automatically when tests on master pass.