import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import { CfnInstance, Vpc } from "@aws-cdk/aws-ec2";
import { DockerImageAsset } from "@aws-cdk/aws-ecr-assets";
import * as path from "path";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import { IVpc } from "@aws-cdk/aws-ec2/lib/vpc";
import {
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "@aws-cdk/aws-iam";
import { CfnDBInstance, DatabaseInstance } from "@aws-cdk/aws-rds";
import { CfnService } from "@aws-cdk/aws-ecs";

export class MaintenanceStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & { vpc: IVpc; db: DatabaseInstance }
  ) {
    super(scope, id, props);
    const asset = new DockerImageAsset(this, "MaintenanceImage", {
      directory: path.join(__dirname, "containers/maintenance"),
    });
    const cluster = new ecs.Cluster(this, "MaintenanceCluster", {
      // @ts-ignore ECS refers to something other than the canonical ec2.Vpc...
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
      environment: {
        PGHOST: props.db.instanceEndpoint.hostname,
        PGPORT: "5432",
        PGNAME: "SeaSketch",
        PGUSER: "postgres",
        PGREGION: props.db.env.region,
      },
    });
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

    // const cfnService = ecsService.node.defaultChild as CfnService;
    // doesn't work, see
    // https://github.com/aws/aws-cdk/issues/10666
    const cfnService = ecsService.node.children[0] as CfnService;
    cfnService.addOverride("Properties.EnableExecuteCommand", "True");

    // new ecs_patterns.ApplicationLoadBalancedFargateService(
    //   this,
    //   "SeaSketchMaintenanceService",
    //   {
    //     cluster: cluster,
    //     cpu: 256, // Default is 256
    //     desiredCount: 1, // Default is 1

    //     taskImageOptions: {
    //       image: ecs.ContainerImage.fromRegistry(asset.imageUri),
    //     },

    //     memoryLimitMiB: 512, // Default is 512
    //     taskDefinition,
    //   }
    // );
  }
}
