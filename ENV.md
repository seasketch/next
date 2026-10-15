# Configuration Management

Each module in SeaSketch has it's own configuration that needs to be managed. Things like API keys, connection strings for the database, and other secrets that cannot be committed to source code or may be changed for different deployments.

These secrets are managed using environment variables. On production, these env vars are injected into the environment during deployment using a combination of GitHub Actions Secrets and outputs from CDK Stacks. When setting up a development machine this is done primarily through dotenv files (`.env`).

## Setting Env Vars in Development

The api and client modules each use [dotenv](https://github.com/motdotla/dotenv) to load environment variables from a `.env` file at startup. `.env` is gitignored. `.env.template` holds the public defaults. Copy it and fill in the blanks:

```
cp packages/api/.env.template packages/api/.env
cp packages/client/.env.template packages/client/.env
```

Set `TILES_ACL_NAMESPACE` and `REACT_APP_TILES_ACL_NAMESPACE` to the same name, never `prod`. Copy `MAPBOX_ACCESS_TOKEN` and `REACT_APP_MAPBOX_ACCESS_TOKEN` from a teammate, or use your own Mapbox token. Auth0 is not in the repository. Create a tenant and fill in both `.env` files by following [AUTH0.md](AUTH0.md). The issuer, JWKS URL, and audience already written in `packages/api/.env.template` are the seasketch.org production tenant; replace them with yours. Leave every other blank unset. That feature stays unavailable.

`npm run setup` and a non-production API refuse `TILES_ACL_NAMESPACE=prod`. The values they compare against are the `seasketch.org` profile in [packages/api/env-manifest.json](packages/api/env-manifest.json). Production Auth0 identifiers are listed there and are not refused yet.

## Adding new configuration vars

If you have configuration that needs to be added to SeaSketch in order to support new features, make sure to complete the following checklist.

- [] Add the new var with a jsdoc describing what it does to [process-env.d.ts](https://github.com/seasketch/next/blob/master/packages/api/process-env.d.ts) for the api or [react-app-env.d.ts](https://github.com/seasketch/next/blob/master/packages/client/react-app-env.d.ts) for the client.
- [] Add the env var to the `env.template` of the respective package so that other developers know that value needs to be set.
- [] If the variable is part of local setup, add it to [packages/api/env-manifest.json](packages/api/env-manifest.json) with its class. Put a public default in `.env.template`. Leave a shared secret blank for someone to copy by hand.
- [] Add an appropriate value to GitHub Actions Secrets in the production environment
- [] Make sure the appropriate deployment GitHub Actions workflow references the secret and loads it into the environment
- [] If setting an env var for the api package, the [GraphQL Server CDK Stack](https://github.com/seasketch/next/blob/master/packages/infra/lib/GraphQLStack.ts#L113) needs to be updated to inject that variable into the server. It may also be appropriate to add validation code to the top of that stack to assert that the new variable is set to a valid value.
