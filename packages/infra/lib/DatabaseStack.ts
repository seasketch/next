import * as cdk from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";
import { Connections } from "@aws-cdk/aws-ec2";
import { Secret } from "@aws-cdk/aws-ecs";

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
  }
}
