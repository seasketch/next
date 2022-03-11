const region = require("../bin/env.production").region;
const AWS = require("aws-sdk");
var ecs = new AWS.ECS({ region });
var cloudformation = new AWS.CloudFormation({ region });

cloudformation.describeStackResources(
  { StackName: "SeaSketchMaintenanceBastion" },
  function (err, data) {
    console.log(err);
    if (err) {
      console.log("CLUSTER=\nTASK=");
      return;
    }
    const cluster = data.StackResources.find(
      (r) =>
        r.ResourceType === "AWS::ECS::Cluster" &&
        /Maintenance/.test(r.LogicalResourceId)
    );
    if (!cluster) {
      console.log("CLUSTER=\nTASK=");
    }
    ecs.listTasks({ cluster: cluster.PhysicalResourceId }, (err, data) => {
      if (err) throw err;
      if (data.taskArns.length === 0) {
        console.log("CLUSTER=\nTASK=");
      }
      const taskId = data.taskArns[0].split("/").slice(-1)[0];
      console.log(`CLUSTER=${cluster.PhysicalResourceId}\nTASK=${taskId}`);
    });
  }
);
