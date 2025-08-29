import { Context } from "aws-lambda";
import handler, { validatePayload } from "./overlay-worker";

export const lambdaHandler = async (
  event: any,
  context: Context
): Promise<any> => {
  let payload: any;

  // For direct lambda invocation, the event is the payload directly
  payload = event;

  console.log(`Starting job ${payload.jobKey}`);

  // Validate the payload
  try {
    validatePayload(payload);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "Validation failed",
        jobKey: payload.jobKey,
      }),
    };
  }

  // Process the overlay calculation asynchronously
  // Note: In a real Lambda environment, you might want to use SQS or other async mechanisms
  // For now, we'll process it synchronously but this could be enhanced
  await handler(payload);
  return;
  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //     jobKey: payload.jobKey,
  //     message: "Overlay calculation started successfully",
  //   }),
  // };
};
