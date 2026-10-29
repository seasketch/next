# SeaSketch Next

This project consists of multiple packages in a monorepo configuration.

### [packages/api](./packages/api)

This is the core server package. It include a GraphQL API server based on Postgraphile, and all database migrations. It also includes an exported node api (`@seasketch/api`) that can be used by other services to access and manipulate application data.

### [packages/client](./packages/client)

Single-page-app style javascript client built using Create React App.

### [packages/infra](./packages/infra)

CDK App that defines the production hosting infrastructure

### [packages/lambda-db-client](./packages/lambda-db-client)

Provides a reusable method of connecting to the production SeaSketch database from Lambda services.

### [packages/emailStatusHandler](./packages/emailStatusHandler)

Lambda microservice for updating project and survey invite status based on SNS notifications from AWS SES.

#### Development Environment Setup

Prerequisites: Node from `.nvmrc`, and a Compose-compatible runtime (Docker Desktop, OrbStack, Colima, or Podman with its compose plugin). Nothing starts when you open the folder.

From the repo root:

```sh
npm run bootstrap
npm run build
npm run setup
npm run dev
```

`npm run bootstrap` is `npm install` at the repo root. One lockfile covers the workspace. `npm run build` is `tsc -b` over every workspace package plus the two bundling steps `tsc` cannot run (the `fgb-source` tsup bundle and the overlay-engine worker). `npm run build:api` builds the API and only the packages its tsconfig references; `npm run build:client-libs` builds the packages the client imports.

Workspace packages load from their gitignored `dist/` output, so a fresh install needs `npm run build` before `npm run dev`. `npm run dev` checks for that output and exits with that instruction if a package has not been built. It starts Postgres and Redis, then the API, the client, the watchers, and the data path: local object storage, the two `pmtiles-server` sessions that serve tiles and downloads from it, the spatial-uploads and subdivision containers, the data-tables handler, and an SQS stand-in. With that running you can upload a layer on a project's Data Layers page and see it on the map, served from your machine; the stack's own layers from production keep rendering beside it. Ctrl-C stops the host processes. It does not enable `E2E_TEST_MODE`; a normal development API uses Auth0 login.

`npm run dev -- --profile core` starts only Postgres, Redis, the API, the client, the watchers, and the screenshotter, for work that never touches uploads. The spatial-uploads container is built from a prebuilt runtime image on the GitHub Container Registry; the first `npm run dev` pulls it (about 1.8 GB), after which only the thin application layer is rebuilt when the handler changes. If that pull is refused, log in once with `docker login ghcr.io` using a GitHub token that has `read:packages`. [packages/local-r2](./packages/local-r2) describes the local storage and how to reset it; the design is in [design-docs/dev-environment/local-data-services.md](./design-docs/dev-environment/local-data-services.md).

`npm run logs` follows every service. `npm run logs -- api` follows one. Files are `.logs/<service>.log`, rotated at 20 MB. `npm run status` prints which services are listening. `npm run setup -- --reset` replaces the local database with the golden snapshot and clears the local object storage with it.

`npm run e2e` runs the Playwright suite in `packages/e2e`. It restores the golden snapshot into `seasketch_e2e` and starts its own API, client, and data services on separate ports, so it can run beside `npm run dev`. The upload journeys in that suite go through the same containers and local storage a developer uses. Chromium is a separate download from `npm install`. Once per machine, and again after a Playwright upgrade:

```sh
npm exec --workspace @seasketch/e2e -- playwright install chromium
```

In Cursor or VS Code, Terminal > Run Task > `Dev: core` runs that same command (the full default stack) in one terminal, and opens two more that follow `npm run logs -- client` and `npm run logs -- db-watch`. `Dev: core only` is the `--profile core` opt-out. CI runs `npm run dev -- --ci`, which skips the watchers and runs the API from its build.

Follow [ENV.md](ENV.md) for the variables. Human login needs an Auth0 tenant you control; [AUTH0.md](AUTH0.md) is the setup.

## Deployments

This project is managed using the [GitHub Flow pattern](https://guides.github.com/introduction/flow/) and GitHub Actions. To make changes...

1. Do work on a feature branch and create a pull request
2. Ensure automated checks pass, including unit and end-to-end tests
3. Checkout the **Deployment Options Summary** to see how changes will impact production.
4. Within GitHub, go to Actions / [Create Deployment](https://github.com/seasketch/next/actions/workflows/deploy.yml) and run the workflow on your branch.

<img width="300" src="https://user-images.githubusercontent.com/511063/133169236-e47c1f1f-07ca-4cde-ba21-6066e7307733.png">

In general, try not to merge directly into `master`, but if you do, make absolutely certain all changes are deployable. When using a feature branch, it's easy to roll back a bad deployment. All you need to do is run the [Create Deployment](https://github.com/seasketch/next/actions/workflows/deploy.yml) workflow on `master`, which should be ready to deploy if the rules are followed. Alternatively, you could create a new branch from a previous commit if broken changes are at the HEAD.

#### Deployment Options Summary

<img width="500" src="https://user-images.githubusercontent.com/511063/132918530-4e0350f0-19bd-4186-89fb-c8aaf3cbf5b9.png">

This summary is generated for every commit and will flag what services will be updated.
