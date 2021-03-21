# infra

SeaSketch hosting infrastructure is defined and maintained as an [AWS CDK App](https://docs.aws.amazon.com/cdk/latest/guide/home.html). See `bin/infra.js` for the details, and the `lib/*Stack.ts` files for each component of the deployment.

## Deploying stacks

The CDK _App_ that defines the SeaSketch infrastructure consists of multiple _Stacks_. This makes it possible to do deployments of multiple parts of the application in isolation.

For example, the following command could make changes to cache-control settings for client javascript assets without making unnecessary changes to the database.

```
cdk deploy SeaSketchProductionClientStack
```

To list out all the stacks, enter `cdk ls`.

# Doing a clean install

You will need highly privileged AWS credentials to install the whole application from scratch. You will also need to have a certificate in Amazon Certificate Manager to enable remote connectivity to the database. Basic steps are as follows:

```
cdk deploy SeaSketchProductionDBStack SeaSketchMaintenanceStack
# log into the Maintenance Stack bastion and run initial db migration

```

## Database Stack

```
cdk deploy SeaSketchProductionDBStack
```

This will create a new stack for the database, but that database will be empty. Afterwards you will need to bootstrap the database schema using the bastion container within the Maintenance Stack to run migrations.

## The Maintenance Stack

This stack includes a _bastion_ container that can be connected to using AWS' new [ECS exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) function. The bastion is inside the VPC and can be used to perform database migrations and could be used to debug other services otherwise inaccessible.

Connect to the bastion by running

```
npm run shell
```

This script will automatically pull the cluster and task ids from cloudformation and run the ecs exec function.

### Connecting to the database from the bastion

The startup script in /etc/profile.d/pg.sh should make it possible to run `psql` without any arguments.

### Checking out the SeaSketch codebase

Deploy keys should be used to checkout the codebase into `/usr/src/app/next`. The startup scripts should detect if these keys are installed properly and if not provide instructions.

```
cd /usr/src/app
git clone git@github.com:seasketch/next.git
```

## Running database migrations

Once database access is setup and the codebase has been cloned, running migrations is as simple as:

```
cd next/packages/api
git pull origin master
npm run db:migrate
```

## Vector Data Hosting Stack

```

cdk deploy SeaSketchDataOregon SeaSketchDataVirginia SeaSketchDataIreland SeaSketchDataSaoPaulo SeaSketchDataSydney

```

# Deploying a new version of the browser client

TODO: https://stackoverflow.com/questions/22501465/how-to-add-cache-control-in-aws-s3

```

```
