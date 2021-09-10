# SeaSketch Next

This project consists of multiple packages in a monorepo configuration.

### [packages/api](./packages/api)

This is the core server package. It include a GraphQL API server based on Postgraphile, and all database migrations. It also includes an exported node api (`@seasketch/api`) that can be used by other services to access and manipulate application data.

![packages/api](https://github.com/seasketch/next/workflows/packages/api/badge.svg)

### [packages/client](./packages/client)

Single-page-app style javascript client built using Create React App.

### [packages/infra](./packages/infra)

CDK App that defines the production hosting infrastructure

### [packages/lambda-db-client](./packages/lambda-db-client)

Provides a reusable method of connecting to the production SeaSketch database from Lambda services.

### [packages/emailStatusHandler](./packages/emailStatusHandler)

Lambda microservice for updating project and survey invite status based on SNS notifications from AWS SES.

#### Development Environment Setup

There are a lot of build scripts and dev servers needed to run the entire stack. If you have Docker installed and use VSCode a lot of this setup can be started for you by simply opening the root of the project in your editor. Run the VSCode command "Manage Automatic Tasks in Folder" and choose allow to run the necessary build tasks and development servers.

![tasks in vscode](https://user-images.githubusercontent.com/511063/93515779-ff207700-f8dd-11ea-8ceb-e9e663161e4f.png)

## Deployments

This project is managed using the [GitHub Flow pattern](https://guides.github.com/introduction/flow/) and GitHub Actions. To make changes...

1. Do work on a feature branch and create a pull request
2. Ensure automated checks pass, including unit and end-to-end tests
3. Checkout the **Deployment Options Summary** to see how changes will impact production.
4. Comment with `/deploy` to the pull request to start an automated deployment and merge the pull request to `master`.

In general, try not to merge directly into `master`, but if you do, make absolutely certain all changes to `master` are deployable.

<img width="500" src="https://user-images.githubusercontent.com/511063/132918530-4e0350f0-19bd-4186-89fb-c8aaf3cbf5b9.png">

<img width="400" src="https://user-images.githubusercontent.com/511063/132918977-66d472a3-b87f-4ed8-8d6a-00f81d05b0ce.png">
