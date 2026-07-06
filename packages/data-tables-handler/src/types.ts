export interface DataTableUploadProcessingOptions {
  delimiter?: "," | "\t" | ";" | "|";
  hasHeaderRow?: boolean;
  joinColumn?: string;
  overlayJoinColumn?: string;
  forceNotNull?: string[];
  name?: string;
}

export interface DataTablesHandlerRequest {
  taskId: string;
  uploadId: string;
  objectKey: string;
  suffix: string;
  skipLoggingProgress?: boolean;
}

export interface DataTablesHandlerSuccess {
  uploadId: string;
  name: string;
  joinColumn: string;
  overlayJoinColumn: string;
  rowCount: number;
  parquetRemote: string;
  columnStatsRemote: string;
}

export interface DataTablesHandlerResponse {
  success?: DataTablesHandlerSuccess;
  error?: string;
  errorDetails?: Record<string, unknown>;
}
