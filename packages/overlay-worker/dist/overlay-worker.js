"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
exports.validatePayload = validatePayload;
exports.subjectIsFragment = subjectIsFragment;
exports.subjectIsGeography = subjectIsGeography;
const overlay_engine_1 = require("overlay-engine");
const fgb_source_1 = require("fgb-source");
const messaging_1 = require("./messaging");
const ProgressNotifier_1 = require("./ProgressNotifier");
const geobuf_1 = __importDefault(require("geobuf"));
const pbf_1 = __importDefault(require("pbf"));
const sourceCache = new fgb_source_1.SourceCache("128 mb");
async function handler(payload) {
    console.log("Overlay worker received payload", payload);
    const progressNotifier = new ProgressNotifier_1.ProgressNotifier(payload.jobKey, 50, 500);
    await (0, messaging_1.sendBeginMessage)(payload.jobKey, "/test", new Date().toISOString());
    const helpers = {
        progress: (progress, message) => {
            return progressNotifier.notify(progress, message);
        },
        log: (message) => {
            console.log(message);
        },
        time: (message) => {
            console.time(message);
        },
        timeEnd: (message) => {
            console.timeEnd(message);
        },
    };
    try {
        // Example of how to use the discriminated union with switch statements
        switch (payload.type) {
            case "total_area":
                if (subjectIsGeography(payload.subject)) {
                    progressNotifier.notify(0, "Beginning area calculation");
                    const area = await (0, overlay_engine_1.calculateArea)(payload.subject.clippingLayers, sourceCache, helpers);
                    await (0, messaging_1.flushMessages)();
                    await (0, messaging_1.sendResultMessage)(payload.jobKey, area);
                    return;
                }
                else if (subjectIsFragment(payload.subject)) {
                    throw new Error("Total area for fragments not implemented in worker.");
                }
                else {
                    throw new Error("Unknown subject type. Must be geography or fragment.");
                }
                break;
            case "overlay_area":
                if (subjectIsGeography(payload.subject)) {
                    progressNotifier.notify(0, "Beginning area calculation");
                    const area = await (0, overlay_engine_1.calculateGeographyOverlap)(payload.subject.clippingLayers, sourceCache, payload.sourceUrl, payload.sourceType, payload.groupBy, helpers);
                    await (0, messaging_1.flushMessages)();
                    await (0, messaging_1.sendResultMessage)(payload.jobKey, area);
                    return;
                }
                else {
                    if ("geobuf" in payload.subject) {
                        // payload.subject.geobuf is a base64 encoded string
                        const buffer = Buffer.from(payload.subject.geobuf, "base64");
                        let feature = geobuf_1.default.decode(new pbf_1.default(buffer));
                        helpers.log(`decoded geobuf feature. ${buffer.byteLength} bytes`);
                        if (feature.type === "FeatureCollection") {
                            feature = feature.features[0];
                        }
                        if (feature.geometry.type !== "Polygon") {
                            throw new Error("geobuf is not a GeoJSON Polygon.");
                        }
                        progressNotifier.notify(0, "Beginning overlay area calculation");
                        await (0, messaging_1.flushMessages)();
                        const area = await (0, overlay_engine_1.calculateFragmentOverlap)(feature, sourceCache, payload.sourceUrl, payload.sourceType, payload.groupBy, helpers);
                        await (0, messaging_1.flushMessages)();
                        await (0, messaging_1.sendResultMessage)(payload.jobKey, area);
                        return;
                    }
                    else {
                        throw new Error("Geobuf feature was not provided. Fetch-based workflows not suppored yet.");
                    }
                }
                break;
            default:
                throw new Error(`Unknown payload type: ${payload.type}`);
        }
    }
    catch (e) {
        console.error(e);
        await (0, messaging_1.sendErrorMessage)(payload.jobKey, e instanceof Error ? e.message : "Unknown error");
        // throw e;
    }
    finally {
        // Ensure any debounced progress sends and pending SQS sends are flushed
        try {
            progressNotifier.flush();
        }
        catch (_a) { }
        await (0, messaging_1.flushMessages)();
    }
}
function validatePayload(data) {
    // Validate required base properties
    if (!data || typeof data !== "object") {
        throw new Error("Payload must be an object");
    }
    if (!data.jobKey || typeof data.jobKey !== "string") {
        throw new Error("Payload must have a valid jobKey property");
    }
    if (!data.type || typeof data.type !== "string") {
        throw new Error("Payload must have a valid type property");
    }
    if (!data.subject || typeof data.subject !== "object") {
        throw new Error("Payload must have a valid subject property");
    }
    // Validate subject structure
    if ("type" in data.subject) {
        if (data.subject.type !== "geography" ||
            typeof data.subject.id !== "number") {
            throw new Error('Geography subject must have type "geography" and numeric id');
        }
    }
    else {
        if (typeof data.subject.hash !== "string") {
            throw new Error("Fragment subject must have hash id.");
        }
    }
    // Validate overlay-specific properties for metrics that need them
    if (data.type !== "total_area") {
        if (!data.sourceUrl || typeof data.sourceUrl !== "string") {
            throw new Error(`Payload type "${data.type}" must have sourceUrl property`);
        }
        if (!data.sourceType || typeof data.sourceType !== "string") {
            throw new Error(`Payload type "${data.type}" must have sourceType property`);
        }
        if (data.groupBy && typeof data.groupBy !== "string") {
            throw new Error(`Payload type "${data.type}" must have groupBy property`);
        }
    }
    // Ensure no value or count properties exist
    if ("value" in data) {
        throw new Error("Payload must not contain value property");
    }
    if ("count" in data) {
        throw new Error("Payload must not contain count property");
    }
    return data;
}
// Type guard for enhanced fragment subjects
function subjectIsFragment(subject) {
    return "hash" in subject && "fragmentHash" in subject;
}
// Type guard for enhanced geography subjects
function subjectIsGeography(subject) {
    return ("type" in subject &&
        subject.type === "geography" &&
        "clippingLayers" in subject);
}
//# sourceMappingURL=overlay-worker.js.map