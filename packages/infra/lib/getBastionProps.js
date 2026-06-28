const region = require("../bin/env.production").region;
const AWS = require("aws-sdk");
const ecs = new AWS.ECS({ region });
const cloudformation = new AWS.CloudFormation({ region });

async function main() {
  try {
    const stackName =
      process.env.MAINTENANCE_STACK_NAME || "SeaSketchMaintenanceBastion";
    const data = await cloudformation
      .describeStackResources({ StackName: stackName })
      .promise();
    const cluster = data.StackResources.find(
      (r) =>
        r.ResourceType === "AWS::ECS::Cluster" &&
        /Maintenance/.test(r.LogicalResourceId)
    );
    if (!cluster) {
      console.log("CLUSTER=\nTASK=");
      return;
    }
    const tasks = await ecs
      .listTasks({
        cluster: cluster.PhysicalResourceId,
        desiredStatus: "RUNNING",
      })
      .promise();
    if (tasks.taskArns.length === 0) {
      console.log("CLUSTER=\nTASK=");
      return;
    }
    console.log(`CLUSTER=${cluster.PhysicalResourceId}\nTASK=${tasks.taskArns[0]}`);
  } catch (err) {
    console.error(err);
    console.log("CLUSTER=\nTASK=");
  }
}

main();
