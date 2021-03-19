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
        // ecsExec: new PolicyDocument({
        //   statements: [
        //     new PolicyStatement({
        //       effect: iam.Effect.ALLOW,
        //       actions: [
        //         "ssmmessages:CreateControlChannel",
        //         "ssmmessages:CreateDataChannel",
        //         "ssmmessages:OpenControlChannel",
        //         "ssmmessages:OpenDataChannel",
        //       ],
        //       resources: ["*"],
        //     }),
        //   ],
        // }),
      },
    });
    asset.repository.grantPull(role);
    // props.db.grantConnect(role);

    // role.addToPolicy(
    //   new PolicyStatement({
    //     actions: ["sts:AssumeRole"],
    //     effect: iam.Effect.ALLOW,
    //     principals: [new ServicePrincipal("ecs-tasks.amazonaws.com")],
    //   })
    // );
    // props.dbAccessRole.grantPrincipal(new ServicePrincipal('ecs-tasks.amazonaws.com'));

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
