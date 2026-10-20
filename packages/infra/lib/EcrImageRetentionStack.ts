/**
 * Marks unused images in the CDK bootstrap ECR repository with an `old-` tag
 * so a lifecycle rule can expire them. The rule matches only that tag. A
 * failed or missed run leaves images in place.
 *
 * Deploy workflows do not call this function. EventBridge runs it every 4 hours.
 */
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NODEJS_24_X } from "./nodeRuntime";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cr from "aws-cdk-lib/custom-resources";
import * as path from "path";
import { Construct } from "constructs";
import {
  LIFECYCLE_POLICY,
  RETENTION_DAYS,
  SOURCES_PARAMETER,
} from "../lambdas/ecrImageRetention/plan";

const BOOTSTRAP_QUALIFIER = "hnb659fds";
const NOTIFY_ME_TOPIC_ARN =
  "arn:aws:sns:us-west-2:196230260133:NotifyMe";
const METRIC_NAMESPACE = "SeaSketch/EcrImageRetention";

export class EcrImageRetentionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const account = props.env?.account;
    const region = props.env?.region;
    if (!account || !region) {
      throw new Error("EcrImageRetentionStack requires env.account and env.region");
    }

    const repositoryName = `cdk-${BOOTSTRAP_QUALIFIER}-container-assets-${account}-${region}`;
    const repositoryArn = ecr.Repository.arnForLocalRepository(
      repositoryName,
      this,
      account
    );

    const lifecyclePolicyText = JSON.stringify(LIFECYCLE_POLICY);
    new cr.AwsCustomResource(this, "OldTagLifecyclePolicy", {
      installLatestAwsSdk: false,
      onCreate: {
        service: "ECR",
        action: "putLifecyclePolicy",
        parameters: {
          repositoryName,
          lifecyclePolicyText,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          `${repositoryName}-old-tag-lifecycle`
        ),
      },
      onUpdate: {
        service: "ECR",
        action: "putLifecyclePolicy",
        parameters: {
          repositoryName,
          lifecyclePolicyText,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          `${repositoryName}-old-tag-lifecycle`
        ),
      },
      onDelete: {
        service: "ECR",
        action: "deleteLifecyclePolicy",
        parameters: { repositoryName },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["ecr:PutLifecyclePolicy", "ecr:DeleteLifecyclePolicy"],
          resources: [repositoryArn],
        }),
      ]),
    });

    const fn = new NodejsFunction(this, "EcrImageRetention", {
      functionName: "EcrImageRetention",
      entry: path.join(__dirname, "../lambdas/ecrImageRetention/index.ts"),
      handler: "handler",
      projectRoot: path.join(__dirname, ".."),
      depsLockFilePath: path.join(__dirname, "../package-lock.json"),
      runtime: NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, "EcrImageRetentionLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        REPOSITORY_NAME: repositoryName,
        RETENTION_DAYS: String(RETENTION_DAYS),
      },
      bundling: {
        minify: false,
        target: "node24",
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:BatchDeleteImage",
        ],
        resources: [repositoryArn],
      })
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:ListClusters",
          "ecs:ListServices",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
        ],
        resources: ["*"],
      })
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:ListFunctions", "lambda:GetFunction"],
        resources: ["*"],
      })
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:PutParameter"],
        resources: [
          `arn:aws:ssm:${region}:${account}:parameter${SOURCES_PARAMETER}`,
        ],
      })
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
        conditions: {
          StringEquals: { "cloudwatch:namespace": METRIC_NAMESPACE },
        },
      })
    );

    new events.Rule(this, "EveryFourHours", {
      schedule: events.Schedule.rate(cdk.Duration.hours(4)),
      targets: [new targets.LambdaFunction(fn)],
    });

    const notifyMe = sns.Topic.fromTopicArn(this, "NotifyMe", NOTIFY_ME_TOPIC_ARN);

    // One 4-hour period per scheduled run. Twelve periods is 48 hours. A
    // shorter period would count the hours between runs as missing and alarm
    // while the job is healthy.
    const silence = new cloudwatch.Alarm(this, "SyncSilent", {
      alarmName: "ECR image retention sync is silent",
      alarmDescription:
        "EcrImageRetention has not reported success for 48 hours. Unused images will not be marked old- until it runs again.",
      metric: new cloudwatch.Metric({
        namespace: METRIC_NAMESPACE,
        metricName: "SyncSuccess",
        statistic: "Sum",
        period: cdk.Duration.hours(4),
      }),
      threshold: 1,
      evaluationPeriods: 12,
      datapointsToAlarm: 12,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    silence.addAlarmAction(new cw_actions.SnsAction(notifyMe));
  }
}
