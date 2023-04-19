/**
 * This stack includes several lambdas for sending out project & survey invites,
 * and also monitoring the sns topics that relay information on email delivery
 * status.
 */
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";
import { Vpc } from "@aws-cdk/aws-ec2";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { SnsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { Topic } from "@aws-cdk/aws-sns";

export class MailerLambdaStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      vpc: Vpc;
      db: DatabaseInstance;
      host: string;
      topic: string;
      emailSource: string;
    }
  ) {
    super(scope, id, props);
    const projectInviteStatusUpdaterFunction = new NodejsFunction(
      this,
      "ProjectInviteStatusHandler",
      {
        functionName: "ProjectInviteStatusHandler",
        bundling: {
          minify: false,
          externalModules: ["pg-native", "aws-sdk"],
          target: "es2020",
          sourceMap: true,
          keepNames: true,
        },
        entry: path.join(__dirname, "../../email-status-handler/index.ts"),
        handler: "updateProjectInviteStatusHandler",
        runtime: lambda.Runtime.NODEJS_14_X,
        vpc: props.vpc,
        timeout: cdk.Duration.seconds(5),
        logRetention: logs.RetentionDays.ONE_MONTH,
        environment: {
          PGHOST: props.db.instanceEndpoint.hostname,
          PGPORT: "5432",
          PGDATABASE: "seasketch",
          PGUSER: "admin",
          PGREGION: props.db.env.region,
          SES_EMAIL_SOURCE: props.emailSource,
          HOST: props.host,
          ISSUER: props.host,
        },
        memorySize: 256,
        reservedConcurrentExecutions: 50,
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
          new iam.PolicyStatement({
            actions: [
              "sns:Subscribe",
              "sns:Unsubscribe",
              "sns:GetTopicAttributes",
            ],
            resources: [props.topic],
          }),
        ],
      }
    );

    const notificationTopic = Topic.fromTopicArn(
      this,
      "EmailStatusTopic",
      props.topic
    );

    const eventSource = new SnsEventSource(notificationTopic);
    projectInviteStatusUpdaterFunction.addEventSource(eventSource);
  }
}
