import type { DataTablesHandlerRequest } from "./src/types";
export type { DataTablesHandlerRequest, DataTablesHandlerResponse } from "./src/types";
export declare const processDataTableUpload: (event: DataTablesHandlerRequest) => Promise<import("./src/types").DataTablesHandlerResponse>;
