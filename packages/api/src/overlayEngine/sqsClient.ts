import { SQSClient } from "@aws-sdk/client-sqs";

/**
 * Client for the overlay engine results queue.
 *
 * In production the queue is on AWS and the default region and credential
 * chain apply. Locally `npm run dev` sets SQS_ENDPOINT to the ElasticMQ
 * container. ElasticMQ does not check signatures, but the SDK refuses to
 * sign without a key pair, so a placeholder pair is supplied for that case
 * only. It is not a credential and grants nothing anywhere else.
 */
export function createSqsClient(): SQSClient {
  const endpoint = process.env.SQS_ENDPOINT;
  if (endpoint) {
    return new SQSClient({
      region: process.env.AWS_REGION || "us-west-2",
      endpoint,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    });
  }
  return new SQSClient({
    region: process.env.S3_REGION || "us-east-1",
  });
}
