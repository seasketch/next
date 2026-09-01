import { dirSync } from "tmp";
import * as path from "path";
import { writeFileSync } from "fs";
import { getClient } from "./lambda-db-client";
import {
  buildR2Remote,
  getR2Object,
  getStagingObject,
  putObject,
} from "./remotes";
import {
  configFromStoredTemporal,
  deriveWhenColumnsOnParquet,
} from "./deriveWhenColumns";
import {
  isDataTableTemporalConfig,
  type DataTableTemporalConfig,
} from "../../geostats-types/lib/temporal";
import {
  assertUnmatchedRecordFractionAllowed,
  getGeostatsLayer,
  validateJoinColumnChoice,
} from "./validateJoinColumn";
import {
  computeColumnStatsFromParquet,
  countParquetJoinMatches,
  filterParquetByJoinValues,
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
      `select filename, processing_options, overlay_geostats, overlay_join_column,
              replace_overlay_data_table_id, reprocess_of_overlay_data_table_id,
              temporal_config
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

    const temporalConfig = isDataTableTemporalConfig(upload.temporal_config)
      ? (upload.temporal_config as DataTableTemporalConfig)
      : null;
    const isReprocess = Boolean(upload.reprocess_of_overlay_data_table_id);

    if (isReprocess) {
      if (!temporalConfig) {
        throw new Error("Reprocess job is missing a valid temporal_config");
      }
      const sourceQ = await pgClient.query(
        `select name, join_column, overlay_join_column, parquet_remote
         from overlay_data_tables where id = $1`,
        [upload.reprocess_of_overlay_data_table_id],
      );
      if (!sourceQ.rows[0]?.parquet_remote) {
        throw new Error("Source data table parquet is missing");
      }
      await updateProgress("running", "downloading parquet", 0.1);
      await getR2Object(sourceQ.rows[0].parquet_remote, parquetPath);
      await updateProgress("running", "deriving temporal columns", 0.35);
      const derived = await deriveWhenColumnsOnParquet(parquetPath, temporalConfig);
      logDebug("temporal columns derived", {
        parseableCount: derived.parseableCount,
        unparseableCount: derived.unparseableCount,
      });
      await updateProgress("running", "computing stats", 0.6);
      const tableName =
        processingOptions.name ||
        sourceQ.rows[0].name ||
        defaultTableName(upload.filename);
      const columnStats = await computeColumnStatsFromParquet(
        parquetPath,
        tableName,
        {
          column: joinColumn,
          overlayAttribute: overlayJoinColumn,
          matchRate: 1,
          matchedRows: derived.rowCount,
          unmatchedRows: 0,
          unmatchedOverlayValues: 0,
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
        rowCount: derived.rowCount,
        parquetRemote: parquetTarget.remote,
        columnStatsRemote: statsTarget.remote,
        temporal: derived.temporal,
      };
      await pgClient.query(
        `SELECT graphile_worker.add_job('processDataTableUploadOutputs', $1::json)`,
        [JSON.stringify({ jobId: taskId, data: result })],
      );
      return { success: result };
    }

    logDebug("downloading staging object", { objectKey, csvPath });
    await getStagingObject(csvPath, objectKey);
    await updateProgress("running", "processing", 0.2);

    logDebug("processing csv with duckdb", { csvPath, parquetPath });
    const { rowCount: importedRowCount, headers } = await processCsvWithDuckDb(
      csvPath,
      parquetPath,
      processingOptions,
    );
    logDebug("csv processed", {
      rowCount: importedRowCount,
      columnCount: headers.length,
    });

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
      histogramComplete: joinValidation.histogramComplete,
    });

    let rowCount = Math.trunc(Number(importedRowCount));
    let droppedJoinValues: string[] = [];
    let droppedRowCount = 0;
    const canDropUnmatched =
      joinValidation.histogramComplete &&
      joinValidation.unmatchedJoinValues.length > 0;
    if (canDropUnmatched) {
      droppedJoinValues = [...joinValidation.unmatchedJoinValues].sort((a, b) =>
        a.localeCompare(b),
      );
      const matchCounts = await countParquetJoinMatches(
        parquetPath,
        joinColumn,
        joinValidation.matchedJoinValues,
      );
      assertUnmatchedRecordFractionAllowed(
        matchCounts.unmatchedRowCount,
        matchCounts.totalRowCount,
        droppedJoinValues,
      );
      await updateProgress("running", "dropping unmatched sites", 0.45);
      const filtered = await filterParquetByJoinValues(
        parquetPath,
        joinColumn,
        joinValidation.matchedJoinValues,
      );
      rowCount = filtered.rowCount;
      droppedRowCount = filtered.droppedRowCount;
      logDebug("dropped unmatched join values", {
        droppedSites: droppedJoinValues.length,
        droppedRowCount,
        remainingRowCount: rowCount,
      });
    }

    let derivedTemporal: unknown = undefined;
    if (upload.replace_overlay_data_table_id) {
      const prevQ = await pgClient.query(
        `select temporal from overlay_data_tables where id = $1`,
        [upload.replace_overlay_data_table_id],
      );
      const prevConfig =
        temporalConfig || configFromStoredTemporal(prevQ.rows[0]?.temporal);
      if (prevConfig) {
        try {
          await updateProgress("running", "deriving temporal columns", 0.55);
          const derived = await deriveWhenColumnsOnParquet(
            parquetPath,
            prevConfig,
          );
          derivedTemporal = derived.temporal;
          logDebug("csv replace re-derived temporal columns", {
            parseableCount: derived.parseableCount,
            unparseableCount: derived.unparseableCount,
          });
        } catch (deriveError) {
          logDebug("csv replace could not re-derive temporal columns", {
            message: (deriveError as Error).message,
          });
        }
      }
    }

    await updateProgress("running", "computing stats", 0.6);

    const tableName =
      processingOptions.name || defaultTableName(upload.filename);
    const DROPPED_VALUES_LIMIT = 500;
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
        ...(droppedJoinValues.length > 0
          ? {
              droppedJoinValues: droppedJoinValues.slice(
                0,
                DROPPED_VALUES_LIMIT,
              ),
              droppedRowCount,
            }
          : {}),
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
      rowCount,
      parquetRemote: parquetTarget.remote,
      columnStatsRemote: statsTarget.remote,
      ...(derivedTemporal ? { temporal: derivedTemporal } : {}),
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
