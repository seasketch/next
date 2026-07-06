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
exports.putObject = putObject;
exports.getObject = getObject;
exports.getStagingObject = getStagingObject;
exports.buildR2Remote = buildR2Remote;
const fs_1 = require("fs");
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
async function putObject(filepath, remote) {
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
            params: { Bucket, Key, Body: fileStream },
        });
        await upload.done();
    }
    else {
        await client.send(new client_s3_1.PutObjectCommand({ Bucket, Key, Body: fileStream }));
    }
    console.log(`putObject ${filepath} (${(0, bytes_1.default)(fileSizeBytes)}) to ${remote}`);
}
async function getObject(filepath, remote) {
    const isR2 = /r2:/.test(remote);
    const parts = remote.replace(/\w+:\/\//, "").split("/");
    const client = isR2 ? r2Client : s3Client;
    const Bucket = parts[0];
    const Key = parts.slice(1).join("/");
    const response = await client.send(new client_s3_1.GetObjectCommand({ Bucket, Key }));
    const body = response.Body;
    const { createWriteStream } = await Promise.resolve().then(() => __importStar(require("fs")));
    const { pipeline } = await Promise.resolve().then(() => __importStar(require("stream/promises")));
    await pipeline(body, createWriteStream(filepath));
}
async function getStagingObject(filepath, objectKey) {
    const bucket = process.env.BUCKET;
    const response = await s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const body = response.Body;
    const { createWriteStream } = await Promise.resolve().then(() => __importStar(require("fs")));
    const { pipeline } = await Promise.resolve().then(() => __importStar(require("stream/promises")));
    await pipeline(body, createWriteStream(filepath));
}
function buildR2Remote(slug, uploadId, filename) {
    const bucket = process.env.R2_TILES_BUCKET || process.env.TILES_REMOTE?.replace("r2://", "").split("/")[0];
    if (!bucket) {
        throw new Error("R2_TILES_BUCKET or TILES_REMOTE must be set");
    }
    const key = `projects/${slug}/public/dataTables/${uploadId}/${filename}`;
    return { remote: `r2://${bucket}/${key}`, key, bucket };
}
