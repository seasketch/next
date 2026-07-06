"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDataTableUpload = void 0;
const handleDataTableUpload_1 = __importDefault(require("./src/handleDataTableUpload"));
const processDataTableUpload = async (event) => {
    try {
        return await (0, handleDataTableUpload_1.default)(event);
    }
    catch (e) {
        return { error: e.message };
    }
};
exports.processDataTableUpload = processDataTableUpload;
