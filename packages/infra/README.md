# infra

SeaSketch hosting infrastructure is defined and maintained as an [AWS CDK App](https://docs.aws.amazon.com/cdk/latest/guide/home.html). See `bin/infra.js` for the details, and the `lib/*Stack.ts` files for each component of the deployment.

**CDK should not be used to do routine deployments!**

Instead, start an [automated deployment](https://github.com/seasketch/next#deployments) using a pull request if it involves simple code changes to the client or api server, or database migrations.

## Deploying and updating stacks

The CDK _App_ that defines the SeaSketch infrastructure consists of multiple _Stacks_. This makes it possible to do deployments of multiple parts of the application in isolation.

For example, the following command could make changes to cache-control settings for client javascript assets without making unnecessary changes to the database.

```
cdk deploy SeaSketchProductionClientStack
```

To list out all the stacks, enter `cdk ls`. To run any updates for the entire stack, run `cdk deploy --all`. To run any of these commands you will need to provide a series of configuration parameters as environment variables. Copy `infra/.env.template` to `.env` and fill out appropriately before running. **Do not check .env into source control!**.

## Doing a clean install

You will need highly privileged AWS credentials to install the whole application from scratch. You will also need to generate github deploy keys. The deploy keys will be stored on the maintenance bastion for later use, and will be temporarily used when building the graphql server.

### generating deploy keys

```
cd packages/infra
# be sure to use an empty passphrase
ssh-keygen -t rsa -f containers/maintenance/github_key
# make duplicates since docker won't bundle outside the Dockerfile directory
cp containers/maintenance/github_key* containers/graphql
cat containers/maintenance/github_key.pub
```

Afterwards you should have `github_key` and `github_key.pub` files. Copy the contents of `github_key.pub` to [the project's deploy keys](https://github.com/seasketch/next/settings/keys). Afterwards it just takes one command to deploy SeaSketch.

```
cdk deploy --all --require-approval never
```

This one command will stand up the database & redis, run db migrations, create the graphile server on ecs and create stacks that host client code and user uploads.

## The Maintenance Stack

This stack includes a _bastion_ container that can be connected to using AWS' new [ECS exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) function. The bastion is inside the VPC and can be used to perform database migrations and could be used to debug other services otherwise inaccessible.

An npm script is provided to connect to the bastion without having to fetch info from cloudformation and run `ecs exec` directly.

```
npm run shell
```

### Connecting to the database from the bastion

The startup script in /etc/profile.d/pg.sh should make it possible to run `psql` without any arguments.

### Checking out the SeaSketch codebase

The source for the application should already reside in `/usr/src/app/next` but may need to be updated using `git pull`. Deploy keys are available on the bastion to support connecting to the private repo but are _read-only_.

### Running database migrations

In order to run database migrations you will need to be on the same VPC as the postgres database. From the Maintenance Bastion running migrations is as simple as:

```
cd next/packages/api
git pull origin master
npm run db:migrate
```

For now these migrations are run manually rather than as part of a continuous deployment system. The Dockerfile in `api/migrations` could be used as a starting point to build such a system.

### Other services

As services are added to the deployment the bastion should be updated with environment variables to facilitate connecting and debugging. For example, `REDIS_HOST` is available so that connecting to the cache is an easy `redis-cli -h $REDIS_HOST`. Run `env` to find out what else is available on the bastion.

## Vector Data Hosting Stack

Harvested and uploaded GeoJSON data can be hosted on SeaSketch through any number of AWS regions. `infra/bin/infra.ts` defines multiple instances of DataHostingStack to stand up infrastructure in the relevant regions. If you want to establish a new region just create a new stack. Records will be automatically added to the associated database to list the new option in the graphql api.

## Deploying a new version of the browser client

For now this operation is handled outside of CDK and done manually. Run `npm run build && npm run deploy` from within `packages/client`.
