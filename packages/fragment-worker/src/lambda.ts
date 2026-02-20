import { Context } from "aws-lambda";
import { handleCreateFragments } from "./handler";

export const lambdaHandler = async (
  event: any,
  context: Context
): Promise<any> => {
  try {
    return await handleCreateFragments(event);
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || "Unknown error" };
  }
};

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection", reason, promise);
});
