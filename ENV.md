# Configuration Management

Each module in SeaSketch has it's own configuration that needs to be managed. Things like API keys, connection strings for the database, and other secrets that cannot be committed to source code or may be changed for different deployments.

These secrets are managed using environment variables. On production, these env vars are injected into the environment during deployment using a combination of GitHub Actions Secrets and outputs from CDK Stacks. When setting up a development machine this is done primarily through dotenv files (`.env`).

## Setting Env Vars in Development

The api and client modules each use [dotenv](https://github.com/motdotla/dotenv) to load environment variables from a `.env` file at startup. `.env` is gitignored. `.env.template` holds the public defaults. Copy it and fill in the blanks:

```
cp packages/api/.env.template packages/api/.env
cp packages/client/.env.template packages/client/.env
```

The templates point at the SeaSketch development Auth0 tenant. Copy `MAPBOX_ACCESS_TOKEN`, `REACT_APP_MAPBOX_ACCESS_TOKEN`, and `AUTH0_CLIENT_SECRET` from a teammate, or leave them blank. The API starts without them. The tile namespace defaults to `local`; change both `TILES_ACL_NAMESPACE` and `REACT_APP_TILES_ACL_NAMESPACE` together if you share the tiles bucket, and never set them to `prod`. Another install replaces the Auth0 values by following [AUTH0.md](AUTH0.md). Leave every other blank unset. That feature stays unavailable.

`npm run setup` and a non-production API refuse the seasketch.org production tile namespace and the production Auth0 issuer, JWKS URL, domain, and audience. The values they compare against are the `seasketch.org` profile in [packages/api/env-manifest.json](packages/api/env-manifest.json).

## Adding new configuration vars

If you have configuration that needs to be added to SeaSketch in order to support new features, make sure to complete the following checklist.

- [] Add the new var with a jsdoc describing what it does to [process-env.d.ts](https://github.com/seasketch/next/blob/master/packages/api/process-env.d.ts) for the api or [react-app-env.d.ts](https://github.com/seasketch/next/blob/master/packages/client/react-app-env.d.ts) for the client.
- [] Add the env var to the `env.template` of the respective package so that other developers know that value needs to be set.
- [] If the variable is part of local setup, add it to [packages/api/env-manifest.json](packages/api/env-manifest.json) with its class. Put a public default in `.env.template`. Leave a shared secret blank for someone to copy by hand.
- [] Add an appropriate value to GitHub Actions Secrets in the production environment
- [] Make sure the appropriate deployment GitHub Actions workflow references the secret and loads it into the environment
- [] If setting an env var for the api package, the [GraphQL Server CDK Stack](https://github.com/seasketch/next/blob/master/packages/infra/lib/GraphQLStack.ts#L113) needs to be updated to inject that variable into the server. It may also be appropriate to add validation code to the top of that stack to assert that the new variable is set to a valid value.
