"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handleDataTableUpload;
const tmp_1 = require("tmp");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const lambda_db_client_1 = require("./lambda-db-client");
const remotes_1 = require("./remotes");
const validateJoinColumn_1 = require("./validateJoinColumn");
const processWithDuckDb_1 = require("./processWithDuckDb");
function defaultTableName(filename) {
    return filename.replace(/\.[^.]+$/, "");
}
function logDebug(message, details) {
    const suffix = details ? ` ${JSON.stringify(details)}` : "";
    console.log(`[data-tables-handler] ${message}${suffix}`);
}
async function handleDataTableUpload(request) {
    const { taskId, uploadId, objectKey, suffix, skipLoggingProgress } = request;
    logDebug("starting upload", {
        taskId,
        uploadId,
        objectKey,
        suffix,
        skipLoggingProgress: Boolean(skipLoggingProgress),
    });
    const pgClient = await (0, lambda_db_client_1.getClient)();
    const updateProgress = async (state, progressMessage, progress) => {
        if (skipLoggingProgress)
            return;
        logDebug("updateProgress", { taskId, state, progressMessage, progress });
        try {
            if (progress !== undefined) {
                await pgClient.query(`update project_background_jobs set state = $1, progress = least($2::numeric, 1.0::numeric), progress_message = $3 where id = $4`, [state, progress, progressMessage, taskId]);
            }
            else {
                await pgClient.query(`update project_background_jobs set state = $1, progress_message = $2 where id = $3`, [state, progressMessage, taskId]);
            }
        }
        catch (e) {
            logDebug("updateProgress failed", {
                taskId,
                state,
                progressMessage,
                progress,
                error: e.message,
            });
            throw e;
        }
    };
    const tmpobj = (0, tmp_1.dirSync)({ unsafeCleanup: true, keep: false, prefix: "dt-" });
    const csvPath = path.join(tmpobj.name, "input.csv");
    const parquetPath = path.join(tmpobj.name, "data.parquet");
    const statsPath = path.join(tmpobj.name, "column-stats.json");
    try {
        await updateProgress("running", "downloading", 0.05);
        const uploadQ = await pgClient.query(`select filename, processing_options, overlay_geostats, overlay_join_column, replace_overlay_data_table_id
       from overlay_data_table_uploads where id = $1`, [uploadId]);
        if (!uploadQ.rows[0]) {
            throw new Error("Upload record not found");
        }
        const upload = uploadQ.rows[0];
        const processingOptions = (upload.processing_options ||
            {});
        const joinColumn = processingOptions.joinColumn;
        const overlayJoinColumn = processingOptions.overlayJoinColumn || upload.overlay_join_column;
        if (!joinColumn || !overlayJoinColumn) {
            throw new Error("Join column and overlay join column are required");
        }
        logDebug("downloading staging object", { objectKey, csvPath });
        await (0, remotes_1.getStagingObject)(csvPath, objectKey);
        await updateProgress("running", "processing", 0.2);
        logDebug("processing csv with duckdb", { csvPath, parquetPath });
        const { rowCount, headers } = await (0, processWithDuckDb_1.processCsvWithDuckDb)(csvPath, parquetPath, processingOptions);
        logDebug("csv processed", { rowCount, columnCount: headers.length });
        const joinValues = await (0, processWithDuckDb_1.readJoinValues)(parquetPath, joinColumn);
        const layer = (0, validateJoinColumn_1.getGeostatsLayer)(upload.overlay_geostats);
        const joinValidation = (0, validateJoinColumn_1.validateJoinColumnChoice)(headers, joinColumn, overlayJoinColumn, layer, joinValues);
        logDebug("join validation complete", {
            joinColumn,
            overlayJoinColumn,
            matchRate: joinValidation.matchRate,
            matchedRows: joinValidation.matchedRows,
            unmatchedRows: joinValidation.unmatchedRows,
        });
        await updateProgress("running", "computing stats", 0.6);
        const tableName = processingOptions.name || defaultTableName(upload.filename);
        const columnStats = await (0, processWithDuckDb_1.computeColumnStatsFromParquet)(parquetPath, tableName, {
            column: joinColumn,
            overlayAttribute: overlayJoinColumn,
            matchRate: joinValidation.matchRate,
            matchedRows: joinValidation.matchedRows,
            unmatchedRows: joinValidation.unmatchedRows,
            unmatchedOverlayValues: joinValidation.unmatchedOverlayValues,
        });
        (0, fs_1.writeFileSync)(statsPath, JSON.stringify(columnStats));
        await updateProgress("running", "uploading", 0.8);
        const parquetTarget = (0, remotes_1.buildR2Remote)(suffix, uploadId, "data.parquet");
        const statsTarget = (0, remotes_1.buildR2Remote)(suffix, uploadId, "column-stats.json");
        await (0, remotes_1.putObject)(parquetPath, parquetTarget.remote);
        await (0, remotes_1.putObject)(statsPath, statsTarget.remote);
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
        await pgClient.query(`SELECT graphile_worker.add_job('processDataTableUploadOutputs', $1::json)`, [JSON.stringify({ jobId: taskId, data: result })]);
        return { success: result };
    }
    catch (e) {
        const error = e;
        logDebug("upload failed", {
            taskId,
            uploadId,
            message: error.message,
            stack: error.stack,
        });
        const errorDetails = { message: error.message };
        await pgClient.query(`select fail_overlay_data_table_upload($1, $2, $3)`, [
            taskId,
            error.message,
            JSON.stringify(errorDetails),
        ]);
        return { error: error.message, errorDetails };
    }
    finally {
        tmpobj.removeCallback();
    }
}
