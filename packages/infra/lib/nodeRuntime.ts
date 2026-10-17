import * as lambda from "aws-cdk-lib/aws-lambda";

/**
 * aws-cdk-lib 2.212 has no Runtime.NODEJS_24_X. The name is the Lambda
 * runtime id, and the bundling image follows it.
 */
export const NODEJS_24_X = new lambda.Runtime(
  "nodejs24.x",
  lambda.RuntimeFamily.NODEJS,
  { supportsInlineCode: true },
);
