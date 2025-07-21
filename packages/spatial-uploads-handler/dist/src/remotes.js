"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.putObject = putObject;
exports.getObject = getObject;
const bytes_1 = __importDefault(require("bytes"));
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = require("fs");
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const r2Client = new client_s3_1.S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
async function putObject(filepath, remote, logger, increment) {
    if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
        throw new Error(`Invalid remote ${remote}`);
    }
    const parts = remote.replace(/\w+:\/\//, "").split("/");
    const client = /r2:/.test(remote) ? r2Client : s3Client;
    const Bucket = parts[0];
    const Key = parts.slice(1).join("/");
    const fileSizeBytes = (0, node_fs_1.statSync)(filepath).size;
    const fileStream = (0, fs_1.createReadStream)(filepath);
    const uploadParams = {
        Bucket,
        Key,
        Body: fileStream,
    };
    let logmsg = `putObject ${filepath} (${(0, bytes_1.default)(fileSizeBytes)}) to ${remote}.`;
    // if file size is larger than 500MB, use multipart upload
    if (fileSizeBytes > 500 * 1024 * 1024) {
        logmsg += " Using multipart upload.";
        await putLargeObject(Bucket, Key, client, fileStream, fileSizeBytes);
    }
    else {
        await client.send(new client_s3_1.PutObjectCommand(uploadParams));
    }
    logger.output += logmsg + "\n";
    if (increment) {
        logger.updateProgress(increment);
    }
}
async function getObject(filepath, remote, logger, finishedProgressValue) {
    const parts = remote.replace("s3://", "").split("/");
    const Bucket = parts[0];
    const Key = parts.slice(1).join("/");
    // get s3 object size using a head request before running GetObject
    const headParams = {
        Bucket,
        Key,
    };
    const headResponse = await s3Client.send(new client_s3_1.HeadObjectCommand(headParams));
    const fileSizeBytes = headResponse.ContentLength;
    logger.output += `getObject ${remote} to ${filepath}\n`;
    const response = await s3Client.send(new client_s3_1.GetObjectCommand({
        Bucket,
        Key,
    }));
    const initialProgress = parseFloat(logger.currentProgress.toString());
    const finishedProgressIncrement = initialProgress <= 0
        ? finishedProgressValue
        : initialProgress - finishedProgressValue;
    let downloadedBytes = 0;
    if (response.Body) {
        return new Promise((resolve, reject) => {
            if (response.Body instanceof node_stream_1.Readable) {
                response.Body.on("data", (chunk) => {
                    downloadedBytes += chunk.length;
                    if (fileSizeBytes) {
                        const progressFraction = downloadedBytes / fileSizeBytes;
                        const chunkIncrement = chunk.length / fileSizeBytes;
                        logger.updateProgress(chunkIncrement * finishedProgressValue);
                    }
                });
                response.Body.pipe((0, fs_1.createWriteStream)(filepath))
                    .on("error", (err) => reject(err))
                    .on("close", () => {
                    logger.updateProgress(finishedProgressValue);
                    return resolve(filepath);
                });
            }
        });
    }
    else {
        throw new Error("Invalid response from s3");
    }
}
async function putLargeObject(Bucket, Key, client, Body, fileSize) {
    const minPartSize = 5 * 1024 * 1024; // 5MB minimum part size
    const maxPartSize = 500 * 1024 * 1024; // 500MB maximum part size
    // Compute optimal part size: aim for parts no larger than 500MB and no smaller than 5MB
    let partSize = Math.ceil(fileSize / Math.ceil(fileSize / maxPartSize));
    if (partSize < minPartSize) {
        partSize = minPartSize; // Ensure parts are at least 5MB
    }
    try {
        const upload = new lib_storage_1.Upload({
            client,
            params: {
                Bucket,
                Key,
                Body,
            },
            partSize, // Enforce part size constraint
            queueSize: 5, // Number of parallel uploads
        });
        upload.on("httpUploadProgress", (progress) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total}`);
        });
        await upload.done();
        console.log("Upload completed successfully!");
    }
    catch (error) {
        console.error("Upload failed:", error);
    }
}
//# sourceMappingURL=remotes.js.map