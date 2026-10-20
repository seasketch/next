/**
 * CustomResource Hook receives events when a DataHostingStack is modified.
 * Makes sure records exist in the SeaSketch database so that a hosting region
 * can be specified by users.
 */
import {
  CloudFormationClient,
  ListExportsCommand,
} from "@aws-sdk/client-cloudformation";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

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
  const cf = new CloudFormationClient({ region: lambdaRegion });
  const exports = await cf.send(new ListExportsCommand({}));
  const functionName = exports.Exports?.find(
    (e) => e.Name === exportName
  )?.Value;
  if (!functionName) {
    console.error(exports);
    throw new Error("Could not find export with name=" + exportName);
  }
  const lambda = new LambdaClient({ region: lambdaRegion });
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event)),
    })
  );
  if (response.FunctionError) {
    throw new Error(response.FunctionError);
  }
  const payload = response.Payload
    ? Buffer.from(response.Payload).toString()
    : "";
  return JSON.parse(payload);
}
