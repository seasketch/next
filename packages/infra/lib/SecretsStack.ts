/**
 * Application Secrets Manager assets.
 *
 * Deploy independently of SQS / Lambda / ECS. IAM grants to consumers are
 * applied in bin/infra.ts (or on consumer stacks), not here.
 */
import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export const OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_NAME =
  "seasketch/overlay-engine/access-token";

export class SecretsStack extends cdk.Stack {
  /** JWKS-signed overlay-engine JWT published by the API for OverlayWorker. */
  public readonly overlayEngineAccessTokenSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.overlayEngineAccessTokenSecret = new secretsmanager.Secret(
      this,
      "OverlayEngineAccessToken",
      {
        secretName: OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_NAME,
        description:
          "JWKS-signed overlay-engine access token for OverlayWorker (JSON: token, exp, iat, kid)",
      },
    );

    new cdk.CfnOutput(this, "OverlayEngineAccessTokenSecretArn", {
      value: this.overlayEngineAccessTokenSecret.secretArn,
      description: "ARN of seasketch/overlay-engine/access-token",
    });
  }
}
