import { Context } from "aws-lambda";
import handler, { validatePayload } from "./overlay-worker";
import { sendErrorMessage, flushMessages } from "./messaging";

export const lambdaHandler = async (
  event: any,
  context: Context
): Promise<any> => {
  let payload: any;

  // For direct lambda invocation, the event is the payload directly
  payload = event;

  console.log(`Starting job ${payload.jobKey}`);

  console.log("Payload", payload);
  // Validate the payload
  try {
    validatePayload(payload);
  } catch (e) {
    if (
      typeof payload === "object" &&
      "jobKey" in payload &&
      "queueUrl" in payload
    ) {
      await sendErrorMessage(
        payload.jobKey,
        e instanceof Error ? e.message : "OverlayWorkerPayloadValidationError",
        payload.queueUrl
      );
    }

    console.error(e);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "Validation failed",
        jobKey: payload.jobKey,
      }),
    };
  }

  // Process the overlay calculation
  // Wrap to catch any unexpected errors and report via sendErrorMessage
  try {
    await handler(payload);
    await flushMessages();
    return;
  } catch (e) {
    try {
      if (
        typeof payload === "object" &&
        payload &&
        "jobKey" in payload &&
        "queueUrl" in payload
      ) {
        console.log("Attempting to send error message", e);
        await sendErrorMessage(
          payload.jobKey,
          e instanceof Error ? e.message : "Unhandled error",
          (payload as any).queueUrl
        );
        await flushMessages();
      }
    } catch (sendErr) {
      console.error("Failed to send error message", sendErr);
    }
    console.log("Final error log");
    console.error(e);
    return;
  }
  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //     jobKey: payload.jobKey,
  //     message: "Overlay calculation started successfully",
  //   }),
  // };
};

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection", reason, promise);
});
