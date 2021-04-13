# SeaSketch Next

This project consists of multiple packages in a monorepo configuration.

### [packages/api](./packages/api)

This is the core server package. It include a GraphQL API server based on Postgraphile, and all database migrations. It also includes an exported node api (`@seasketch/api`) that can be used by other services to access and manipulate application data.

![packages/api](https://github.com/seasketch/next/workflows/packages/api/badge.svg)

### [packages/client](./packages/client)

Single-page-app style javascript client built using Create React App.

### [packages/infra](./packages/infra)

CDK App that defines the production hosting infrastructure

#### Development Environment Setup

There are a lot of build scripts and dev servers needed to run the entire stack. If you have Docker installed and use VSCode a lot of this setup can be started for you by simply opening the root of the project in your editor. Run the VSCode command "Manage Automatic Tasks in Folder" and choose allow to run the necessary build tasks and development servers.

![tasks in vscode](https://user-images.githubusercontent.com/511063/93515779-ff207700-f8dd-11ea-8ceb-e9e663161e4f.png)

#### Releases

Each package is versioned independently. Run `npm run release` from the top of the repo to assign new versions, create changelogs, tag, and create releases for _all_ packages in the monorepo based on semantic versioning rules. Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) to ensure proper versioning and changelog generation.
