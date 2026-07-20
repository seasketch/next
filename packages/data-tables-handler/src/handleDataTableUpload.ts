import { dirSync } from "tmp";
import * as path from "path";
import { writeFileSync } from "fs";
import { getClient } from "./lambda-db-client";
import {
  buildR2Remote,
  getStagingObject,
  putObject,
} from "./remotes";
import {
  getGeostatsLayer,
  validateJoinColumnChoice,
} from "./validateJoinColumn";
import {
  computeColumnStatsFromParquet,
  processCsvWithDuckDb,
  readJoinValues,
} from "./processWithDuckDb";
import type {
  DataTableUploadProcessingOptions,
  DataTablesHandlerRequest,
  DataTablesHandlerResponse,
} from "./types";

const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function defaultTableName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function logDebug(message: string, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[data-tables-handler] ${message}${suffix}`);
}

export default async function handleDataTableUpload(
  request: DataTablesHandlerRequest,
): Promise<DataTablesHandlerResponse> {
  const {
    taskId,
    uploadId,
    objectKey,
    slug,
    sourceUuid,
    skipLoggingProgress,
  } = request;
  logDebug("starting upload", {
    taskId,
    uploadId,
    objectKey,
    slug,
    sourceUuid,
    skipLoggingProgress: Boolean(skipLoggingProgress),
  });

  const tmpobj = dirSync({ unsafeCleanup: true, keep: false, prefix: "dt-" });
  const csvPath = path.join(tmpobj.name, "input.csv");
  const parquetPath = path.join(tmpobj.name, "data.parquet");
  const statsPath = path.join(tmpobj.name, "column-stats.json");

  // Established inside try so that connection failures are still reported to
  // the caller; if the DB is unreachable the job fails via timeout instead.
  let pgClient: Awaited<ReturnType<typeof getClient>> | null = null;

  const updateProgress = async (
    state: "running" | "complete" | "failed",
    progressMessage: string,
    progress?: number,
  ) => {
    if (skipLoggingProgress || !pgClient) return;
    logDebug("updateProgress", { taskId, state, progressMessage, progress });
    if (progress !== undefined) {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress = least($2::numeric, 1.0::numeric), progress_message = $3 where id = $4`,
        [state, progress, progressMessage, taskId],
      );
    } else {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress_message = $2 where id = $3`,
        [state, progressMessage, taskId],
      );
    }
  };

  try {
    if (!sourceUuid) {
      throw new Error(
        "sourceUuid is required to store data tables under the parent layer path",
      );
    }
    pgClient = await getClient();
    await updateProgress("running", "downloading", 0.05);

    const uploadQ = await pgClient.query(
      `select filename, processing_options, overlay_geostats, overlay_join_column, replace_overlay_data_table_id
       from overlay_data_table_uploads where id = $1`,
      [uploadId],
    );
    if (!uploadQ.rows[0]) {
      throw new Error("Upload record not found");
    }
    const upload = uploadQ.rows[0];
    const processingOptions = (upload.processing_options ||
      {}) as DataTableUploadProcessingOptions;
    const joinColumn = processingOptions.joinColumn;
    const overlayJoinColumn =
      processingOptions.overlayJoinColumn || upload.overlay_join_column;
    if (!joinColumn || !overlayJoinColumn) {
      throw new Error("Join column and overlay join column are required");
    }

    logDebug("downloading staging object", { objectKey, csvPath });
    await getStagingObject(csvPath, objectKey);
    await updateProgress("running", "processing", 0.2);

    logDebug("processing csv with duckdb", { csvPath, parquetPath });
    const { rowCount, headers } = await processCsvWithDuckDb(
      csvPath,
      parquetPath,
      processingOptions,
    );
    logDebug("csv processed", { rowCount, columnCount: headers.length });

    const joinValues = await readJoinValues(parquetPath, joinColumn);
    const layer = getGeostatsLayer(upload.overlay_geostats);
    const joinValidation = validateJoinColumnChoice(
      headers,
      joinColumn,
      overlayJoinColumn,
      layer,
      joinValues,
    );
    logDebug("join validation complete", {
      joinColumn,
      overlayJoinColumn,
      matchRate: joinValidation.matchRate,
      matchedRows: joinValidation.matchedRows,
      unmatchedRows: joinValidation.unmatchedRows,
    });

    await updateProgress("running", "computing stats", 0.6);

    const tableName =
      processingOptions.name || defaultTableName(upload.filename);
    const columnStats = await computeColumnStatsFromParquet(
      parquetPath,
      tableName,
      {
        column: joinColumn,
        overlayAttribute: overlayJoinColumn,
        matchRate: joinValidation.matchRate,
        matchedRows: joinValidation.matchedRows,
        unmatchedRows: joinValidation.unmatchedRows,
        unmatchedOverlayValues: joinValidation.unmatchedOverlayValues,
      },
    );

    writeFileSync(statsPath, JSON.stringify(columnStats));

    await updateProgress("running", "uploading", 0.8);

    const parquetTarget = buildR2Remote(
      slug,
      sourceUuid,
      uploadId,
      "data.parquet",
    );
    const statsTarget = buildR2Remote(
      slug,
      sourceUuid,
      uploadId,
      "column-stats.json",
    );
    await putObject(parquetPath, parquetTarget.remote, PARQUET_CONTENT_TYPE);
    await putObject(statsPath, statsTarget.remote, JSON_CONTENT_TYPE);

    const result = {
      uploadId,
      name: tableName,
      joinColumn,
      overlayJoinColumn,
      rowCount: Math.trunc(Number(rowCount)),
      parquetRemote: parquetTarget.remote,
      columnStatsRemote: statsTarget.remote,
    };
    logDebug("upload processing complete, enqueueing outputs job", {
      taskId,
      uploadId,
      rowCount: result.rowCount,
      parquetRemote: result.parquetRemote,
    });

    await pgClient.query(
      `SELECT graphile_worker.add_job('processDataTableUploadOutputs', $1::json)`,
      [JSON.stringify({ jobId: taskId, data: result })],
    );

    return { success: result };
  } catch (e) {
    const error = e as Error;
    logDebug("upload failed", {
      taskId,
      uploadId,
      message: error.message,
      stack: error.stack,
    });
    const errorDetails = { message: error.message };
    if (pgClient) {
      try {
        await pgClient.query(
          `select fail_overlay_data_table_upload($1, $2, $3)`,
          [taskId, error.message, JSON.stringify(errorDetails)],
        );
      } catch (failError) {
        logDebug("failed to record job failure", {
          taskId,
          error: (failError as Error).message,
        });
      }
    }
    return { error: error.message, errorDetails };
  } finally {
    tmpobj.removeCallback();
  }
}
