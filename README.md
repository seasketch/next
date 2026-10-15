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
npm run setup
npm run dev
```

`npm run dev` starts Postgres and Redis, then the API, the client, the watchers, and the data-tables, spatial-uploads, and subdivision workers, in the foreground. Those workers recompile and restart when their code changes. Ctrl-C stops the host processes. It does not enable `E2E_TEST_MODE`; a normal development API uses Auth0 login. The smoke suite turns test mode on itself, and it starts the same three workers. The tests do not call them yet. If one of them fails to listen, the job fails.

`npm run logs` follows every service. `npm run logs -- api` follows one. Files are `.logs/<service>.log`, rotated at 20 MB. `npm run status` prints which services are listening. `npm run setup -- --reset` replaces the local database with the golden snapshot.

In Cursor or VS Code, Terminal > Run Task > `Dev: core` runs that same command in one terminal, and opens two more that follow `npm run logs -- client` and `npm run logs -- db-watch`. CI runs `npm run dev -- --ci`, which skips the watchers and runs the API from its build.

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
