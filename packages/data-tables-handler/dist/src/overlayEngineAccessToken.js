"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlayEngineAccessTokenError = void 0;
exports.getOverlayEngineAccessToken = getOverlayEngineAccessToken;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
/**
 * Same Secrets Manager document overlay-worker and fragment-worker already
 * read (`seasketch/overlay-engine/access-token`). Used as Bearer on the
 * pmtiles-server /taxonomy proxy.
 */
class OverlayEngineAccessTokenError extends Error {
    constructor(reason) {
        super(`overlay_engine_access_token_unavailable: ${reason}`);
        this.name = "OverlayEngineAccessTokenError";
    }
}
exports.OverlayEngineAccessTokenError = OverlayEngineAccessTokenError;
const REFRESH_WHEN_REMAINING_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SECRET_NAME = "seasketch/overlay-engine/access-token";
let cache = null;
let inFlight = null;
function secretId() {
    const arn = process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
    if (arn && arn.trim())
        return arn.trim();
    return DEFAULT_SECRET_NAME;
}
function parseSecretString(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new OverlayEngineAccessTokenError("invalid_secret");
    }
    if (!parsed ||
        typeof parsed !== "object" ||
        typeof parsed.token !== "string" ||
        typeof parsed.exp !== "number") {
        throw new OverlayEngineAccessTokenError("invalid_secret");
    }
    const token = parsed.token;
    const exp = parsed.exp;
    if (!token || !Number.isFinite(exp)) {
        throw new OverlayEngineAccessTokenError("invalid_secret");
    }
    return { token, exp };
}
async function fetchFromSecretsManager() {
    const client = new aws_sdk_1.default.SecretsManager({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2",
    });
    let response;
    try {
        response = await client
            .getSecretValue({ SecretId: secretId() })
            .promise();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new OverlayEngineAccessTokenError(`missing:${msg}`);
    }
    if (!response.SecretString) {
        throw new OverlayEngineAccessTokenError("missing");
    }
    return parseSecretString(response.SecretString);
}
function isExpired(cached, skewMs = 0) {
    return cached.exp * 1000 <= Date.now() + skewMs;
}
function needsRefresh(cached) {
    return cached.exp * 1000 - Date.now() < REFRESH_WHEN_REMAINING_MS;
}
async function getOverlayEngineAccessToken() {
    if (cache && !isExpired(cache) && !needsRefresh(cache)) {
        return cache.token;
    }
    if (!inFlight) {
        inFlight = (async () => {
            const fetched = await fetchFromSecretsManager();
            if (isExpired(fetched, 60000)) {
                throw new OverlayEngineAccessTokenError("expired");
            }
            cache = fetched;
            return fetched;
        })().finally(() => {
            inFlight = null;
        });
    }
    const result = await inFlight;
    if (isExpired(result, 60000)) {
        throw new OverlayEngineAccessTokenError("expired");
    }
    return result.token;
}
