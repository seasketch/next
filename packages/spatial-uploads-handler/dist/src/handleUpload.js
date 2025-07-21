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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_OUTPUT_SIZE = exports.MVT_THRESHOLD = void 0;
exports.default = handleUpload;
const lambda_db_client_1 = require("./lambda-db-client");
const tmp_1 = require("tmp");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const geostats_types_1 = require("@seasketch/geostats-types");
const bytes_1 = __importDefault(require("bytes"));
const sanitize_filename_1 = __importDefault(require("sanitize-filename"));
const client_s3_1 = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const processVectorUpload_1 = require("./processVectorUpload");
const processRasterUpload_1 = require("./processRasterUpload");
const notifySlackChannel_1 = require("./notifySlackChannel");
const remotes_1 = require("./remotes");
const logger_1 = require("./logger");
const DEBUG = process.env.DEBUG === "true";
// Create a tileset if flatgeobuf is > 100kb (~1mb geojson)
exports.MVT_THRESHOLD = 100000;
// Outputs should not exceed 1 GB
exports.MAX_OUTPUT_SIZE = (0, bytes_1.default)("6 GB");
async function handleUpload(
/** project_background_jobs uuid */
jobId, 
/** full s3 object key */
objectKey, 
/** Project identifier */
slug, 
/**
 * For logging purposes only. In the form of "Full Name<email@example.com>"
 */
requestingUser, skipLoggingProgress) {
    if (DEBUG) {
        console.log("DEBUG MODE ENABLED");
    }
    const pgClient = await (0, lambda_db_client_1.getClient)();
    const outputs = [];
    const baseKey = `projects/${slug}/public`;
    /**
     * Updates progress of the upload task
     * @param state
     * @param progress Optional 0.0-1.0 value
     */
    const updateProgress = async (state, progressMessage, progress) => {
        if (skipLoggingProgress) {
            return;
        }
        if (progress !== undefined) {
            await pgClient.query(`update project_background_jobs set state = $1, progress = least($2, 1), progress_message = $3 where id = $4 returning progress`, [state, progress, progressMessage, jobId]);
        }
        else {
            await pgClient.query(`update project_background_jobs set state = $1, progress_message = $2 where id = $3 returning progress`, [state, progressMessage, jobId]);
        }
    };
    // Create a temporary directory that will be cleaned up when the task
    // completes (error or none using try..finally)
    const tmpobj = (0, tmp_1.dirSync)({
        unsafeCleanup: true,
        keep: true,
        prefix: "uploads-",
    });
    // Logger/task executor which tracks all stdout/stderr outputs so they can be
    // saved to a log file
    const logger = new logger_1.Logger(async (progress) => {
        if (skipLoggingProgress) {
            return;
        }
        const { rows } = await pgClient.query(`update project_background_jobs set progress = least($1, 1.0) where id = $2 returning progress`, [progress, jobId]);
    });
    const dist = path.join(tmpobj.name, "dist");
    await logger.exec(["mkdir", [dist]], "Failed to create directory", 0);
    const s3LogPath = `s3://${process.env.BUCKET}/${jobId}.log.txt`;
    let { name, ext, base } = path.parse(objectKey);
    name = (0, sanitize_filename_1.default)(name);
    const originalName = name;
    name = `${jobId}`;
    const isTif = ext === ".tif" || ext === ".tiff";
    // Step 1) Fetch the uploaded file from S3
    const keyParts = objectKey.split("/");
    let workingFilePath = `${path.join(tmpobj.name, keyParts[keyParts.length - 1])}`;
    await updateProgress("running", "fetching", 0.0);
    if (DEBUG) {
        console.log("Fetching", objectKey, "to", workingFilePath);
    }
    await (0, remotes_1.getObject)(workingFilePath, `s3://${path.join(process.env.BUCKET, objectKey)}`, logger, 2 / 30);
    let stats;
    // After the environment is set up, we can start processing the file depending
    // on its type
    try {
        if (isTif || ext === ".nc") {
            stats = await (0, processRasterUpload_1.processRasterUpload)({
                logger,
                path: workingFilePath,
                outputs,
                updateProgress,
                baseKey,
                jobId,
                originalName,
                workingDirectory: dist,
            });
        }
        else {
            stats = await (0, processVectorUpload_1.processVectorUpload)({
                logger,
                path: workingFilePath,
                outputs,
                updateProgress,
                baseKey,
                jobId,
                originalName,
                workingDirectory: dist,
            });
        }
        // Determine bounds for the layer
        let bounds;
        if (Array.isArray(stats) && stats.length > 1) {
            throw new Error("Multiple vector layers in the same file not supported");
        }
        else if (Array.isArray(stats)) {
            bounds = stats[0].bounds;
        }
        else {
            bounds = stats.bands[0].bounds;
        }
        // Ensure that outputs do not exceed file size limits
        await updateProgress("running", "uploading products");
        if (outputs.find((o) => o.size > exports.MAX_OUTPUT_SIZE)) {
            throw new Error(`One or more outputs exceed ${(0, bytes_1.default)(exports.MAX_OUTPUT_SIZE)} limit. Was ${(0, bytes_1.default)(outputs.find((o) => o.size > exports.MAX_OUTPUT_SIZE).size)}`);
        }
        // Upload outputs to cloud storage
        for (const output of outputs) {
            await (0, remotes_1.putObject)(output.local, output.remote, logger, 1 / 30);
        }
        await updateProgress("running", "worker complete", 1);
        // Determine final url that should be assigned to mapbox-gl-style source
        let sourceUrl;
        for (const output of outputs) {
            if (output.type === "PMTiles") {
                sourceUrl = output.url.replace(/\.pmtiles$/, "");
            }
            else if (output.type === "GeoJSON" &&
                !output.isOriginal &&
                !sourceUrl) {
                sourceUrl = output.url;
            }
        }
        if (!sourceUrl) {
            throw new Error("No sourceUrl found");
        }
        // Write logs before returning response
        const logPath = path.join(tmpobj.name, "log.txt");
        (0, fs_1.writeFileSync)(logPath, logger.output);
        await (0, remotes_1.putObject)(logPath, s3LogPath, logger);
        const geostats = Array.isArray(stats) ? stats[0] : stats;
        const response = {
            layers: [
                {
                    filename: originalName + ext,
                    name: "bands" in geostats ? originalName : geostats.layer,
                    geostats,
                    outputs: outputs.map((o) => ({
                        ...o,
                        local: undefined,
                        filename: o.filename,
                    })),
                    bounds: bounds || undefined,
                    url: sourceUrl,
                    isSingleBandRaster: isTif &&
                        stats.presentation ===
                            geostats_types_1.SuggestedRasterPresentation.continuous,
                },
            ],
            logfile: s3LogPath,
        };
        // Trigger the task to process the outputs
        await pgClient.query(`SELECT graphile_worker.add_job('processDataUploadOutputs', $1::json)`, [
            JSON.stringify({
                jobId: jobId,
                data: response,
            }),
        ]);
        return response;
    }
    catch (e) {
        console.error(e);
        const error = e;
        if (!skipLoggingProgress) {
            const q = await pgClient.query(`update project_background_jobs set state = 'failed', error_message = $1, progress_message = 'failed' where id = $2 returning *`, [error.message || error.name, jobId]);
        }
        if (process.env.SLACK_TOKEN &&
            process.env.SLACK_CHANNEL &&
            process.env.NODE_ENV === "production") {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: process.env.BUCKET,
                Key: objectKey,
            });
            const presignedDownloadUrl = await getSignedUrl(process.env.DEBUGGING_AWS_ACCESS_KEY_ID &&
                process.env.DEBUGGING_AWS_SECRET_ACCESS_KEY
                ? new client_s3_1.S3Client({
                    region: process.env.AWS_REGION,
                    credentials: {
                        accessKeyId: process.env.DEBUGGING_AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.DEBUGGING_AWS_SECRET_ACCESS_KEY,
                    },
                })
                : s3Client, command, {
                expiresIn: 172800,
            });
            await (0, notifySlackChannel_1.notifySlackChannel)(originalName + ext, presignedDownloadUrl, logger.output, process.env.BUCKET, objectKey, requestingUser, error.message || error.name);
        }
        throw e;
    }
    finally {
        const logPath = path.join(tmpobj.name, "log.txt");
        (0, fs_1.writeFileSync)(logPath, logger.output);
        await (0, remotes_1.putObject)(logPath, s3LogPath, logger);
        if (DEBUG) {
            console.log("Debugging enabled, not cleaning up tmp directory");
        }
        else {
            tmpobj.removeCallback();
        }
    }
}
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
//# sourceMappingURL=handleUpload.js.map