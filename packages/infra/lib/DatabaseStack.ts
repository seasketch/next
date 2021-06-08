import * as cdk from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";
import { Connections, ISecurityGroup, SecurityGroup } from "@aws-cdk/aws-ec2";
import { Secret } from "@aws-cdk/aws-ecs";
import { CustomResource } from "@aws-cdk/core";
import * as logs from "@aws-cdk/aws-logs";
import * as cr from "@aws-cdk/custom-resources";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";

/**
 * The DatabaseStack is responsible for creating an RDS Postgres instance and
 * creating a "Custom Resource" lambda which will create initial db users and
 * enable IAM authentication. This is also the stack that creates the initial
 * VPC, so it is exposed as an instance property.
 */
export class DatabaseStack extends cdk.Stack {
  vpc: ec2.Vpc;
  instance: rds.DatabaseInstance;
  defaultSecurityGroup: ISecurityGroup;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "seasketchVPC", {});
    this.vpc = vpc;

    this.defaultSecurityGroup = SecurityGroup.fromSecurityGroupId(
      this,
      "defaultSecurityGroup",
      this.vpc.vpcDefaultSecurityGroup
    );
    // this.vpc.vpcDefaultSecurityGroup.

    const instance = new rds.DatabaseInstance(this, "Instance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("13.2", "13"),
      }),
      // Note that instance size can be changed at any time, at the cost of some
      // downtime
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M6G,
        ec2.InstanceSize.XLARGE
      ),
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(30),
      // New credentials will be automatically generated and stored in SSM
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      vpc,
      vpcSubnets: {
        // This is important!! Security group will not block connections
        subnetType: ec2.SubnetType.PRIVATE,
      },
      securityGroups: [this.defaultSecurityGroup],
      iamAuthentication: true,
      // TODO: change to RETAIN when using in production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      databaseName: "seasketch",
    });

    const cfnInstance = instance.node.defaultChild as rds.CfnDBInstance;

    const role = new iam.Role(this, "InvokeWorkerLambdas", {
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        effect: iam.Effect.ALLOW,
        resources: [
          `arn:aws:lambda:${props!.env!.region!}:${props!.env!
            .account!}:function:SendProjectInvites`,
        ],
      })
    );

    cfnInstance.associatedRoles = [
      { featureName: "Lambda", roleArn: role.roleArn },
    ];

    // Master password will be updated every 30 days.
    instance.addRotationSingleUser({
      automaticallyAfter: cdk.Duration.days(30),
    });

    // Connections are limited to the VPC so we can go ahead and allow
    // connections from any IP address and be protected by the VPC firewall
    instance.connections.allowDefaultPortFromAnyIpv4();

    // TODO: Add monitoring using cloudwatch events. Docs have some good ideas:
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-rds-readme.html#starting-an-instance-database
    this.instance = instance;

    /**
     * This lambda will recieve CREATE/UPDATE/DELETE events from CloudFormation.
     * When a database instance is first created it will create a graphile user
     * for use by the graphql server and enable IAM authentication for both
     * graphile and the postgres user. This lambda is the *only* case of using
     * the master password secret held in SSM. Afterwards everything should be
     * performed through IAM.
     */
    const dockerfile = path.join(__dirname, "../../api/migrations/");
    const onEvent = new lambda.DockerImageFunction(
      this,
      "DBStackEventHandler",
      {
        // Don't forget to compile the typescript code for this lambda manually
        // if it is ever changed
        code: lambda.DockerImageCode.fromImageAsset(dockerfile, {
          cmd: ["migrate.handler"],
          buildArgs: {
            tags: "init-db",
          },
          // entrypoint: ["/lambda-entrypoint.sh"],
        }),
        vpc: this.vpc,
        // allowAllOutbound: true,
        // allowPublicSubnet: true,
        securityGroups: instance.connections.securityGroups,
        // should be more than ample
        timeout: cdk.Duration.seconds(30),
        logRetention: logs.RetentionDays.ONE_DAY,
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
      }
    );

    instance.grantConnect(onEvent);
    // Only resource which has access to this secret
    instance.secret!.grantRead(onEvent);

    const myProvider = new cr.Provider(this, "InitDBProvider", {
      onEventHandler: onEvent,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    const custom = new CustomResource(this, "InitDB", {
      serviceToken: myProvider.serviceToken,
      properties: {
        // lambda need to know how to access the master password
        secret: instance.secret!.secretName,
        region: instance.env.region,
      },
    });
  }
}
