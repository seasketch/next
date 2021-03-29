/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";
import { Vpc } from "@aws-cdk/aws-ec2";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { CfnOutput } from "@aws-cdk/core";

export class DataHostDbUpdaterStack extends cdk.Stack {
  lambdaFunctionNameExport: "DataHostDbUpdaterLambda";
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      vpc: Vpc;
      db: DatabaseInstance;
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
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        PGHOST: props.db.instanceEndpoint.hostname,
        PGPORT: "5432",
        PGDATABASE: "seasketch",
        PGUSER: "cdk",
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
    new CfnOutput(this, this.lambdaFunctionNameExport, {
      value: onEvent.functionName,
      exportName: this.lambdaFunctionNameExport,
    });
  }
}
