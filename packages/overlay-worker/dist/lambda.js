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
exports.lambdaHandler = void 0;
const overlay_worker_1 = __importStar(require("./overlay-worker"));
const messaging_1 = require("./messaging");
const lambdaHandler = async (event, context) => {
    let payload;
    // For direct lambda invocation, the event is the payload directly
    payload = event;
    console.log(`Starting job ${payload.jobKey}`);
    console.log("Payload", payload);
    // Validate the payload
    try {
        (0, overlay_worker_1.validatePayload)(payload);
    }
    catch (e) {
        if (typeof payload === "object" &&
            "jobKey" in payload &&
            "queueUrl" in payload) {
            await (0, messaging_1.sendErrorMessage)(payload.jobKey, e instanceof Error ? e.message : "OverlayWorkerPayloadValidationError", payload.queueUrl);
        }
        console.error(e);
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: e instanceof Error ? e.message : "Validation failed",
                jobKey: payload.jobKey,
            }),
        };
    }
    // Process the overlay calculation
    // Wrap to catch any unexpected errors and report via sendErrorMessage
    try {
        await (0, overlay_worker_1.default)(payload);
        await (0, messaging_1.flushMessages)();
        return;
    }
    catch (e) {
        try {
            if (typeof payload === "object" &&
                payload &&
                "jobKey" in payload &&
                "queueUrl" in payload) {
                await (0, messaging_1.sendErrorMessage)(payload.jobKey, e instanceof Error ? e.message : "Unhandled error", payload.queueUrl);
                await (0, messaging_1.flushMessages)();
            }
        }
        catch (sendErr) {
            console.error("Failed to send error message", sendErr);
        }
        console.error(e);
        return;
    }
    // return {
    //   statusCode: 200,
    //   body: JSON.stringify({
    //     jobKey: payload.jobKey,
    //     message: "Overlay calculation started successfully",
    //   }),
    // };
};
exports.lambdaHandler = lambdaHandler;
//# sourceMappingURL=lambda.js.map