"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUpload = void 0;
const handleUpload_1 = __importDefault(require("./src/handleUpload"));
const processUpload = async (event) => {
    const s3LogPath = `s3://${process.env.BUCKET}/${event.taskId}.log.txt`;
    try {
        const outputs = await (0, handleUpload_1.default)(event.taskId, event.objectKey, event.suffix, event.requestingUser, event.skipLoggingProgress);
        return {
            ...outputs,
            log: s3LogPath,
        };
    }
    catch (e) {
        return {
            error: e.message,
            log: s3LogPath,
        };
    }
};
exports.processUpload = processUpload;
//# sourceMappingURL=handler.js.map