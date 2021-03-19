import * as cdk from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";
import { Connections } from "@aws-cdk/aws-ec2";
import { Secret } from "@aws-cdk/aws-ecs";
import { CustomResource } from "@aws-cdk/core";
import * as logs from "@aws-cdk/aws-logs";
import * as cr from "@aws-cdk/custom-resources";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";

export class DatabaseStack extends cdk.Stack {
  vpc: ec2.Vpc;
  instance: rds.DatabaseInstance;
  secret: Secret;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "seasketchVPC", {});
    this.vpc = vpc;

    const instance = new rds.DatabaseInstance(this, "Instance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_12_5,
      }),
      // optional, defaults to m5.large
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      vpc,
      vpcSubnets: {
        // This is important!!, because the security group will not block connections
        subnetType: ec2.SubnetType.PRIVATE,
      },
      iamAuthentication: true,
      // TODO: change to RETAIN when using in production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      databaseName: "SeaSketch",
    });

    // @ts-ignore
    this.secret = instance.secret!;

    // Master password will be updated every 7 days.
    instance.addRotationSingleUser({
      automaticallyAfter: cdk.Duration.days(7),
    });

    // Connections are limited to the VPC
    instance.connections.allowDefaultPortFromAnyIpv4();

    // TODO: Add monitoring using cloudwatch events. Docs have some good ideas:
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-rds-readme.html#starting-an-instance-database
    this.instance = instance;

    const onEvent = new lambda.Function(this, "DBStackEventHandler", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambdas/initDbUsers")
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      vpc: this.vpc,
      securityGroups: instance.connections.securityGroups,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    instance.grantConnect(onEvent);
    instance.secret!.grantRead(onEvent);

    const myProvider = new cr.Provider(this, "InitDBUsersProvider", {
      onEventHandler: onEvent,
      logRetention: logs.RetentionDays.ONE_DAY, // default is INFINITE
    });

    const custom = new CustomResource(this, "InitDBUsers", {
      serviceToken: myProvider.serviceToken,
      properties: {
        secret: instance.secret!.secretName,
        region: instance.env.region,
      },
    });
    custom.node.addDependency(instance);
  }
}
