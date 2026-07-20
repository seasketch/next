#!/usr/bin/env tsx
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
const http_1 = require("http");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const PORT = process.env.PORT || 3006;
const server = (0, http_1.createServer)(function (req, res) {
    if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const { processDataTableUpload } = await Promise.resolve().then(() => __importStar(require("./handler")));
                const outputs = await processDataTableUpload(data);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(outputs));
            }
            catch (e) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    }
    else {
        res.writeHead(200);
        res.end("POST to simulate data-tables-handler lambda");
    }
});
server.listen(PORT);
console.log(`Data tables handler dev server on http://localhost:${PORT}`);
console.log(`Set DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:${PORT}`);
