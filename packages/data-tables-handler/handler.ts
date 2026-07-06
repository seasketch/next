import handleDataTableUpload from "./src/handleDataTableUpload";
import type { DataTablesHandlerRequest } from "./src/types";

export type { DataTablesHandlerRequest, DataTablesHandlerResponse } from "./src/types";

export const processDataTableUpload = async (
  event: DataTablesHandlerRequest,
) => {
  try {
    return await handleDataTableUpload(event);
  } catch (e) {
    return { error: (e as Error).message };
  }
};
