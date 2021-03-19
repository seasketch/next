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

### Initializing the database from the Maintenance Stack for the first time

Unfortunately there is no easy way to support IAM authentication "out of the box" through CDK so a manual step must be performed the first time that a database is created to enable IAM authentication on the primary user. Steps are as follows:

1. Get the master password from Secrets Manager by logging into the AWS console and finding the record pertaining to the db
2. Run `psql -c "GRANT rds_iam TO postgres;"`. You should be prompted for the password copied from secrets manager.
3. Now you should be able to verify connecting via the IAM role as documented below and run the first set of migrations.
4. After running migrations for the first time, you will need to setup IAM for the seasketch application roles:

```
GRANT rds_iam if exists TO anon;
GRANT rds_iam TO seasketch_user;
GRANT rds_iam TO seasketch_superuser;
```

### Connecting to the database from the Maintenance Stack

Rather than use the master password we'll use short-lived IAM tokens for accessing the database after the initial bootstrapping process described above. The PGPASSWORD environment variable will be set using the aws cli. This step is encoded in `/createDBToken.sh`, but you will need to run it as follows to set the password environment variable:

```

source ./createDBToken.sh
psql

```

After doing so a simple call to `psql` without any arguments should connect to the database.

### Checking out the SeaSketch codebase

Deploy keys should be used to checkout the codebase into `/usr/src/app/next`. This will have to be done each time the task is restarted, so don't be alarmed if the `next/` directory disappears. If you have trouble authenticated with github, make sure `/home/root/.ssh/id_rsa.pub` is in the github project's deploy keys.

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
