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

You will need highly privileged AWS credentials to install the whole application from scratch. You will also need to have a certificate in Amazon Certificate Manager to enable remote connectivity to the database.

## Database Stack

```
cdk deploy SeaSketchProductionDBStack
```

This will create a new stack for the database, but that database will be empty. Afterwards you will need to bootstrap the database schema using the bastion container within the Maintenance Stack.

## The Maintenance Stack

This stack includes a _bastion_ container that can be connected to using AWS' new [ECS exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) function. The bastion is inside the VPC and can be used to perform database migrations and could be used to debug other services otherwise inaccessible.

To access the bastion you will need a cluster name and task id. Then run

```sh
AWS_PROFILE=$YOUR_PROFILE aws ecs execute-command --region $AWS_REGION --cluster $CLUSTER_ID --task $TASK_ID --container Default --command "/bin/sh -l" --interactive
```

Be sure to run `sh` with the `-l` option that will launch startup scripts to bootstrap you shell environment.

### Initializing the database from the Maintenance Stack for the first time

Unfortunately there is no easy way to support IAM authentication "out of the box" through CDK so a manual step must be performed the first time that a database is created to enable IAM authentication on the primary user. Steps are as follows:

1. Get the master password from Secrets Manager by logging into the AWS console and finding the record pertaining to the db
2. Run `psql -c "GRANT rds_iam TO postgres; create graphile user..."`. You should be prompted for the password copied from secrets manager.
3. Now you should be able to verify connecting via the IAM role as documented below and run the first set of migrations.

### Connecting to the database from the Maintenance Stack

The startup script in /etc/profile.d/pg.sh should make it possible to run `psql` without any arguments.

### Checking out the SeaSketch codebase

Deploy keys should be used to checkout the codebase into `/usr/src/app/next`. The startup scripts should detect if these keys are installed properly and if not provide instructions.

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
