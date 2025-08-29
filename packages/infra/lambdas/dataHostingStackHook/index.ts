/**
 * CustomResource Hook receives events when a DataHostingStack is modified.
 * Makes sure records exist in the SeaSketch database so that a hosting region
 * can be specified by users.
 */
import * as AWS from "aws-sdk";

// Type definitions for CDK custom resources
declare namespace AWSCDKAsyncCustomResource {
  interface OnEventRequest {
    RequestType: "Create" | "Update" | "Delete";
    ResourceProperties: any;
  }

  interface OnEventResponse {
    PhysicalResourceId: string;
    Data?: { [key: string]: any };
  }
}

export interface HostingStackResourceProperties {
  region: string;
  coords: [number, number];
  name: string;
  domain: string;
}

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest) {
  const props = (event as any)
    .ResourceProperties as HostingStackResourceProperties;
  const exportName = process.env.LAMBDA_FUNCTION_EXPORT_NAME!;
  const lambdaRegion = process.env.LAMBDA_REGION!;
  const cf = new AWS.CloudFormation({ region: lambdaRegion });
  const exports = await cf.listExports().promise();
  const functionName = exports.Exports?.find(
    (e) => e.Name === exportName
  )?.Value;
  if (!functionName) {
    console.error(exports);
    throw new Error("Could not find export with name=" + exportName);
  }
  const lambda = new AWS.Lambda({
    region: lambdaRegion,
  });
  const response = await lambda
    .invoke({ FunctionName: functionName, Payload: JSON.stringify(event) })
    .promise();
  if (response.FunctionError) {
    throw new Error(response.FunctionError);
  } else {
    return JSON.parse(response.Payload!.toString());
  }
}
