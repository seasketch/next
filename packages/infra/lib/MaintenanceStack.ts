import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import { DockerImageAsset } from "@aws-cdk/aws-ecr-assets";
import * as path from "path";
import * as ecs from "@aws-cdk/aws-ecs";
import { IVpc } from "@aws-cdk/aws-ec2/lib/vpc";
import {
  Policy,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
} from "@aws-cdk/aws-iam";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { CfnService } from "@aws-cdk/aws-ecs";
import { CfnCacheCluster } from "@aws-cdk/aws-elasticache";

/**
 * The MaintenanceStack sets up a "bastion" instance in ECS running within the
 * SeaSketch VPC. `ECS exec` can then be used to run an interactive shell for
 * maintenance tasks like running database migrations or debugging services. The
 * bastion container comes pre-loaded with scripts to fetch temporary database
 * access credentials and has a github deploy key for checking out code. In the
 * future it can be given necessary access to s3 buckets and other resources as
 * needed.
 *
 * To use the maintenance bastion, run `npm run shell` from the infra package.
 */
export class MaintenanceStack extends cdk.Stack {
  taskRole: iam.IRole;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      /* VPC used when creating the DB Stack */
      vpc: IVpc;
      /* Database instance is needed to grant connect privileges */
      db: DatabaseInstance;
      redis: CfnCacheCluster;
    }
  ) {
    super(scope, id, props);
    // CDK will build the Dockerfile on deployment, but sometimes changes need
    // to be committed to git to trigger a republishing on ECR.
    const asset = new DockerImageAsset(this, "MaintenanceImage", {
      directory: path.join(__dirname, "../containers/maintenance"),
      buildArgs: {
        tags: "maintenance",
      },
    });
    const cluster = new ecs.Cluster(this, "MaintenanceCluster", {
      vpc: props.vpc,
    });

    const role = new iam.Role(this, "MaintenanceRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      inlinePolicies: {
        dbAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["rds-db:connect"],
              effect: iam.Effect.ALLOW,
              // TODO: This policy might not be necessary.
              // The duplicate one below definitely is
              // TODO: It would be nice to scope this down
              // https://github.com/aws/aws-cdk/issues/11851
              // In practice this shouldn't be a big deal because
              // we won't have RDS instances that shouldn't be
              // accessed in the same VPC
              resources: [`arn:aws:rds-db:*:*:dbuser:*/*`],
            }),
          ],
        }),
      },
    });
    asset.repository.grantPull(role);
    props.db.grantConnect(role);

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "SeaSketchMaintenanceFargateTaskDef",
      {
        cpu: 256,
        executionRole: role,
        memoryLimitMiB: 512,
      }
    );
    taskDefinition.addContainer("Default", {
      image: ecs.ContainerImage.fromRegistry(asset.imageUri),
      memoryLimitMiB: 512,
      linuxParameters: new ecs.LinuxParameters(this, "LinuxParams", {
        initProcessEnabled: true,
      }),
      /**
       * Connection details are passed as environment variables that match what
       * `psql` expects
       */
      environment: {
        PGHOST: props.db.instanceEndpoint.hostname,
        PGPORT: "5432",
        PGDATABASE: "seasketch",
        PGUSER: "admin",
        PGREGION: props.db.env.region,
        REDIS_HOST: props.redis.attrRedisEndpointAddress,
      },
    });
    // Needed to enable ECS exec
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ],
        resources: ["*"],
      })
    );
    asset.repository.grantPull(taskDefinition.taskRole);
    props.db.grantConnect(taskDefinition.taskRole);
    this.taskRole = taskDefinition.taskRole;
    taskDefinition.taskRole.attachInlinePolicy(
      new Policy(this, "DBAccess", {
        document: new PolicyDocument({
          statements: [
            new PolicyStatement({
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
        }),
      })
    );

    const ecsService = new ecs.FargateService(
      this,
      "SeaSketchMaintenanceService",
      {
        cluster,
        taskDefinition,
        desiredCount: 1,
      }
    );

    // At some point CDK will support `ECS exec` directly and this will be a
    // lot easier. For now it requires manually managing CFN properties.
    // const cfnService = ecsService.node.defaultChild as CfnService;
    // doesn't work, see
    // https://github.com/aws/aws-cdk/issues/10666
    const cfnService = ecsService.node.children[0] as CfnService;
    cfnService.addOverride("Properties.EnableExecuteCommand", "True");
  }
}
