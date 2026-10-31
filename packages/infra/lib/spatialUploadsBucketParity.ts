/**
 * Guard against deploying the API and the spatial uploads handler with
 * different staging buckets.
 *
 * The API (SeaSketchGraphQLServer) presigns uploads into
 * SPATIAL_UPLOADS_BUCKET; the handler Lambda (SpatialUploadHandler) fetches
 * from BUCKET. Both come from the SPATIAL_UPLOADS_BUCKET environment variable
 * at synth time, but the two stacks are deployed from different places (CI vs.
 * a developer's shell), so the values can drift. When they do, every upload
 * hangs at "fetching" (see October 2026).
 *
 * This module compares the value about to be deployed with what each stack
 * currently has in CloudFormation. It is invoked from bin/infra.ts.
 */
import {
  CloudFormationClient,
  GetTemplateCommand,
} from "@aws-sdk/client-cloudformation";

export const GRAPHQL_STACK_NAME = "SeaSketchGraphQLServer";
export const UPLOAD_HANDLER_STACK_NAME = "SpatialUploadHandler";
export const SKIP_ENV_VAR = "SKIP_SPATIAL_UPLOADS_BUCKET_CHECK";

type Template = { Resources?: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resourcesOfType(
  template: unknown,
  type: string
): Record<string, unknown>[] {
  if (!isRecord(template) || !isRecord(template.Resources)) {
    return [];
  }
  return Object.values(template.Resources).filter(
    (resource): resource is Record<string, unknown> =>
      isRecord(resource) && resource.Type === type
  );
}

/** Value of an env var in a CloudFormation ECS task definition. */
export function ecsTaskEnvValue(
  template: unknown,
  name: string
): string | undefined {
  for (const taskDef of resourcesOfType(template, "AWS::ECS::TaskDefinition")) {
    const props = isRecord(taskDef.Properties) ? taskDef.Properties : {};
    const containers = Array.isArray(props.ContainerDefinitions)
      ? props.ContainerDefinitions
      : [];
    for (const container of containers) {
      if (!isRecord(container) || !Array.isArray(container.Environment)) {
        continue;
      }
      for (const entry of container.Environment) {
        if (
          isRecord(entry) &&
          entry.Name === name &&
          typeof entry.Value === "string"
        ) {
          return entry.Value;
        }
      }
    }
  }
  return undefined;
}

/** Value of an env var in a CloudFormation Lambda function definition. */
export function lambdaEnvValue(
  template: unknown,
  name: string
): string | undefined {
  for (const fn of resourcesOfType(template, "AWS::Lambda::Function")) {
    const props = isRecord(fn.Properties) ? fn.Properties : {};
    const environment = isRecord(props.Environment) ? props.Environment : {};
    const variables = isRecord(environment.Variables)
      ? environment.Variables
      : {};
    const value = variables[name];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

export interface DeployedBuckets {
  /** SPATIAL_UPLOADS_BUCKET on the deployed GraphQL server, if the stack exists. */
  graphql?: string;
  /** BUCKET on the deployed upload handler Lambda, if the stack exists. */
  uploadHandler?: string;
}

async function fetchTemplate(
  client: CloudFormationClient,
  stackName: string
): Promise<Template | undefined> {
  try {
    const response = await client.send(
      new GetTemplateCommand({
        StackName: stackName,
        TemplateStage: "Original",
      })
    );
    return response.TemplateBody
      ? (JSON.parse(response.TemplateBody) as Template)
      : undefined;
  } catch (e) {
    // A stack that has not been created yet is not a mismatch.
    if (e instanceof Error && /does not exist/i.test(e.message)) {
      return undefined;
    }
    throw e;
  }
}

export async function fetchDeployedBuckets(
  region: string
): Promise<DeployedBuckets> {
  const client = new CloudFormationClient({ region });
  const [graphql, uploadHandler] = await Promise.all([
    fetchTemplate(client, GRAPHQL_STACK_NAME),
    fetchTemplate(client, UPLOAD_HANDLER_STACK_NAME),
  ]);
  return {
    graphql: graphql
      ? ecsTaskEnvValue(graphql, "SPATIAL_UPLOADS_BUCKET")
      : undefined,
    uploadHandler: uploadHandler
      ? lambdaEnvValue(uploadHandler, "BUCKET")
      : undefined,
  };
}

/**
 * Lines describing each deployed stack whose bucket differs from `expected`.
 * Empty when everything agrees.
 */
export function bucketMismatches(
  expected: string,
  deployed: DeployedBuckets
): string[] {
  const mismatches: string[] = [];
  if (deployed.graphql !== undefined && deployed.graphql !== expected) {
    mismatches.push(
      `${GRAPHQL_STACK_NAME} is deployed with SPATIAL_UPLOADS_BUCKET=${deployed.graphql}`
    );
  }
  if (
    deployed.uploadHandler !== undefined &&
    deployed.uploadHandler !== expected
  ) {
    mismatches.push(
      `${UPLOAD_HANDLER_STACK_NAME} is deployed with BUCKET=${deployed.uploadHandler}`
    );
  }
  return mismatches;
}

export function mismatchReport(expected: string, mismatches: string[]): string {
  return [
    "",
    "SPATIAL_UPLOADS_BUCKET does not match what is currently deployed.",
    "",
    `  This synth would deploy: SPATIAL_UPLOADS_BUCKET=${expected}`,
    ...mismatches.map((line) => `  ${line}`),
    "",
    "The API presigns uploads into this bucket and the upload handler Lambda",
    'fetches from it. If they disagree, every upload hangs at "fetching".',
    "",
    "If the value in your environment is wrong, fix packages/infra/.env (or the",
    "exported variable) so it matches the deployed API and try again.",
    "",
    "If you are intentionally changing the bucket, deploy SeaSketchGraphQLServer",
    `and ${UPLOAD_HANDLER_STACK_NAME} with the same value and set ${SKIP_ENV_VAR}=1`,
    "to bypass this check for each of those deploys.",
    "",
  ].join("\n");
}

/**
 * Compare `expected` with the deployed stacks and exit the process with a
 * report when they disagree. Lookup failures (no credentials, no network) are
 * reported as warnings so that offline synths still work.
 */
export async function assertSpatialUploadsBucketParity(options: {
  expected: string | undefined;
  region: string;
}): Promise<void> {
  const { expected, region } = options;
  if (process.env[SKIP_ENV_VAR]) {
    console.warn(
      `${SKIP_ENV_VAR} is set; not checking SPATIAL_UPLOADS_BUCKET against deployed stacks.`
    );
    return;
  }
  if (!expected) {
    // The stacks themselves throw a clearer error for a missing value.
    return;
  }
  let deployed: DeployedBuckets;
  try {
    deployed = await fetchDeployedBuckets(region);
  } catch (e) {
    console.warn(
      `Could not read deployed stacks to verify SPATIAL_UPLOADS_BUCKET (${
        e instanceof Error ? e.message : String(e)
      }). Continuing without the check.`
    );
    return;
  }
  const mismatches = bucketMismatches(expected, deployed);
  if (mismatches.length > 0) {
    console.error(mismatchReport(expected, mismatches));
    process.exit(1);
  }
}
