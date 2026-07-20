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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCsvEncodingIfNeeded = normalizeCsvEncodingIfNeeded;
const fs_1 = require("fs");
const path = __importStar(require("path"));
function isValidUtf8(buffer) {
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * DuckDB's CSV reader requires valid UTF-8. Many legacy exports (Excel, R, etc.)
 * are Latin-1 / Windows-1252. Reinterpret single-byte encodings as Latin-1 and
 * write UTF-8 so every byte 0x00–0xFF round-trips without parse failures.
 */
function normalizeCsvEncodingIfNeeded(csvPath, normalizedPath) {
    const buffer = (0, fs_1.readFileSync)(csvPath);
    if (isValidUtf8(buffer)) {
        return { path: csvPath, normalized: false };
    }
    const out = normalizedPath ||
        path.join(path.dirname(csvPath), `${path.basename(csvPath, path.extname(csvPath))}.utf8${path.extname(csvPath) || ".csv"}`);
    (0, fs_1.writeFileSync)(out, buffer.toString("latin1"), "utf8");
    return { path: out, normalized: true };
}
