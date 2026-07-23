"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.putObject = putObject;
exports.getStagingObject = getStagingObject;
exports.buildR2Remote = buildR2Remote;
const fs_1 = require("fs");
const promises_1 = require("stream/promises");
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const bytes_1 = __importDefault(require("bytes"));
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const r2Client = new client_s3_1.S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
async function putObject(filepath, remote, contentType) {
    if (!/r2:/.test(remote) && !/s3:/.test(remote)) {
        throw new Error(`Invalid remote ${remote}`);
    }
    const parts = remote.replace(/\w+:\/\//, "").split("/");
    const client = /r2:/.test(remote) ? r2Client : s3Client;
    const Bucket = parts[0];
    const Key = parts.slice(1).join("/");
    const fileSizeBytes = (0, fs_1.statSync)(filepath).size;
    const fileStream = (0, fs_1.createReadStream)(filepath);
    if (fileSizeBytes > 500 * 1024 * 1024) {
        const upload = new lib_storage_1.Upload({
            client,
            params: { Bucket, Key, Body: fileStream, ContentType: contentType },
        });
        await upload.done();
    }
    else {
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket,
            Key,
            Body: fileStream,
            ContentType: contentType,
        }));
    }
    console.log(`putObject ${filepath} (${(0, bytes_1.default)(fileSizeBytes)}) to ${remote}`);
}
/** Download the user's raw upload from the S3 staging bucket. */
async function getStagingObject(filepath, objectKey) {
    const bucket = process.env.BUCKET;
    const response = await s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const body = response.Body;
    await (0, promises_1.pipeline)(body, (0, fs_1.createWriteStream)(filepath));
}
/**
 * Store data tables under the parent layer's hosted UUID so objects classify
 * as `published` in the tiles ACL gateway and inherit the layer's ACL.
 *
 * `projects/{slug}/public/{sourceUuid}/dataTables/{uploadId}/{filename}`
 */
function buildR2Remote(slug, sourceUuid, uploadId, filename) {
    const bucket = process.env.R2_TILES_BUCKET || process.env.TILES_REMOTE?.replace("r2://", "").split("/")[0];
    if (!bucket) {
        throw new Error("R2_TILES_BUCKET or TILES_REMOTE must be set");
    }
    if (!sourceUuid) {
        throw new Error("sourceUuid is required to store data tables under the parent layer path");
    }
    const key = `projects/${slug}/public/${sourceUuid}/dataTables/${uploadId}/${filename}`;
    return { remote: `r2://${bucket}/${key}`, key, bucket };
}
