/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as path from "path";
import { Construct } from "constructs";

export class DataHostDbUpdaterStack extends cdk.Stack {
  lambdaFunctionNameExport: "DataHostDbUpdaterLambda";
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      vpc: ec2.Vpc;
      db: rds.DatabaseInstance;
    }
  ) {
    super(scope, id, props);
    const onEvent = new lambda.Function(this, "DataHostDbUpdater", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambdas/dataHostDbUpdater")
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      vpc: props.vpc,
      // should be more than ample
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, "DataHostDbUpdaterLogs", {
        retention: logs.RetentionDays.ONE_DAY,
      }),
      environment: {
        PGHOST: props.db.instanceEndpoint.hostname,
        PGPORT: "5432",
        PGDATABASE: "seasketch",
        PGUSER: "admin",
        PGREGION: props.db.env.region,
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["rds-db:connect"],
          effect: iam.Effect.ALLOW,
          // TODO: It would be nice to scope this down
          // https://github.com/aws/aws-cdk/issues/11851
          // In practice this shouldn't be a big deal because
          // we won't have RDS instances that shouldn't be
          // accessed in the same VPC
          resources: [`arn:aws:rds-db:*:*:dbuser:*/*`],
        }),
      ],
    });
    this.lambdaFunctionNameExport = "DataHostDbUpdaterLambda";
    new cdk.CfnOutput(this, this.lambdaFunctionNameExport, {
      value: onEvent.functionName,
      exportName: this.lambdaFunctionNameExport,
    });
  }
}
