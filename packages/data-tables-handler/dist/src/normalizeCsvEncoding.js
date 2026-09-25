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
exports.detectCsvEncoding = detectCsvEncoding;
exports.normalizeCsvEncodingIfNeeded = normalizeCsvEncodingIfNeeded;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
/** Scan / convert in 1MB chunks so we never build a JS string of the whole file. */
const SCAN_CHUNK_BYTES = 1024 * 1024;
/**
 * DuckDB's CSV reader requires valid UTF-8. Legacy Excel/R exports are often
 * Windows-1252 (a Latin-1 superset). DuckDB's built-in `encoding='latin-1'`
 * rejects bytes 0x80–0x9F, so non-UTF-8 files are rewritten as UTF-8 using
 * Windows-1252. Conversion is streamed; Node cannot stringify a 1GB+ buffer.
 */
function detectCsvEncoding(csvPath) {
    return isValidUtf8File(csvPath) ? "utf-8" : "windows-1252";
}
async function normalizeCsvEncodingIfNeeded(csvPath, normalizedPath) {
    if (detectCsvEncoding(csvPath) === "utf-8") {
        return { path: csvPath, normalized: false };
    }
    const out = normalizedPath ||
        path.join(path.dirname(csvPath), `${path.basename(csvPath, path.extname(csvPath))}.utf8${path.extname(csvPath) || ".csv"}`);
    await writeWindows1252AsUtf8(csvPath, out);
    return { path: out, normalized: true };
}
function isValidUtf8File(csvPath) {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const fd = (0, fs_1.openSync)(csvPath, "r");
    const buffer = Buffer.alloc(SCAN_CHUNK_BYTES);
    try {
        let bytesRead = 0;
        while ((bytesRead = (0, fs_1.readSync)(fd, buffer, 0, SCAN_CHUNK_BYTES, null)) > 0) {
            decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
        }
        decoder.decode();
        return true;
    }
    catch {
        return false;
    }
    finally {
        (0, fs_1.closeSync)(fd);
    }
}
function writeWindows1252AsUtf8(src, dest) {
    const decoder = new TextDecoder("windows-1252");
    const transform = new stream_1.Transform({
        transform(chunk, _enc, cb) {
            try {
                const text = decoder.decode(chunk, { stream: true });
                cb(null, Buffer.from(text, "utf8"));
            }
            catch (err) {
                cb(err);
            }
        },
        flush(cb) {
            try {
                const tail = decoder.decode();
                cb(null, tail ? Buffer.from(tail, "utf8") : undefined);
            }
            catch (err) {
                cb(err);
            }
        },
    });
    return (0, promises_1.pipeline)((0, fs_1.createReadStream)(src), transform, (0, fs_1.createWriteStream)(dest));
}
