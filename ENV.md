# Configuration Management

Each module in SeaSketch has it's own configuration that needs to be managed. Things like API keys, connection strings for the database, and other secrets that cannot be committed to source code or may be changed for different deployments.

These secrets are managed using environment variables. On production, these env vars are injected into the environment during deployment using a combination of GitHub Actions Secrets and outputs from CDK Stacks. When setting up a development machine this is done primarily through dotenv files (`.env`).

## Setting Env Vars in Development

The api and client modules each use [dotenv](https://github.com/motdotla/dotenv) to load environment variables from a `.env` file at startup. `.env` can't be checked into source control with all our secrets but `.env.template` is a starting point. Just `cp .env.template .env` and fill in the required details for both the api and client packages.

#### Using 1password to populate `.env` files

Instead of manually filling in values, if you have access to the team's 1Password vault it can be used to copy `.env.template` to `.env` with up-to-date
values. To do so, install the [1password cli](https://developer.1password.com/docs/cli/get-started/) and then run the following:

```
npm run env:dev
```

Contact [Chad](mailto:chad@underbluewaters.net) to request access to our 1password vault.

## Adding new configuration vars

If you have configuration that needs to be added to SeaSketch in order to support new features, make sure to complete the following checklist.

- [] Add the new var with a jsdoc describing what it does to [process-env.d.ts](https://github.com/seasketch/next/blob/master/packages/api/process-env.d.ts) for the api or [react-app-env.d.ts](https://github.com/seasketch/next/blob/master/packages/client/react-app-env.d.ts) for the client.
- [] Add the env var to the `env.template` of the respective package so that other developers know that value needs to be set.
- [] Add a default value to the SeaSketch dev 1password value so that it can be easily populated on other dev machines and reference that item in `.env.template`.
- [] Add an appropriate value to GitHub Actions Secrets in the production environment
- [] Make sure the appropriate deployment GitHub Actions workflow references the secret and loads it into the environment
- [] If setting an env var for the api package, the [GraphQL Server CDK Stack](https://github.com/seasketch/next/blob/master/packages/infra/lib/GraphQLStack.ts#L113) needs to be updated to inject that variable into the server. It may also be appropriate to add validation code to the top of that stack to assert that the new variable is set to a valid value.
