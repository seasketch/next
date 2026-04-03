import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

let lambdaClient: LambdaClient | null = null;

function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || "us-west-2",
    });
  }
  return lambdaClient;
}

/**
 * Fire-and-forget async Lambda invocation so the next synchronous classify call
 * is more likely to hit a warm container. No-op if GEOSTATS_PII_CLASSIFIER_ARN
 * is unset.
 */
export function warmGeostatsPiiClassifier(): void {
  const arn = process.env.GEOSTATS_PII_CLASSIFIER_ARN;
  if (!arn) {
    return;
  }
  void getLambdaClient()
    .send(
      new InvokeCommand({
        FunctionName: arn,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({ warm: true })),
      }),
    )
    .catch((e: unknown) => {
      console.error(
        "[geostats-pii-classifier] warm invoke failed:",
        e instanceof Error ? e.message : e,
      );
    });
}
