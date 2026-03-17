import { Context } from "aws-lambda";
import {
  handleCreateCollectionFragments,
  handleCreateFragments,
  handleWarmCache,
} from "./handler";

export const lambdaHandler = async (
  event: any,
  context: Context
): Promise<any> => {
  try {
    if (event.operation === "warm-cache") {
      return await handleWarmCache(event);
    }
    if (event.operation === "create-collection-fragments") {
      return await handleCreateCollectionFragments(event);
    }
    return await handleCreateFragments(event);
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message || "Unknown error" };
  }
};

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection", reason, promise);
});
