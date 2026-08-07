/** Stable message prefix — surfaces in SQS / spatial_metrics.error_message. */
export declare class OverlayEngineAccessTokenError extends Error {
    constructor(reason: string);
}
/** Drop cached token (e.g. after 401 from uploads). */
export declare function bustOverlayEngineAccessTokenCache(): void;
/**
 * Return a valid overlay-engine JWT for uploads fetches.
 * Loads from Secrets Manager on cold start / first use; refreshes when within
 * 24h of expiry. Throws OverlayEngineAccessTokenError if unavailable.
 */
export declare function getOverlayEngineAccessToken(): Promise<string>;
/** Append access_token for HTTP clients that do not send Authorization (e.g. geoblaze). */
export declare function withAccessTokenQueryParam(url: string, token: string): string;
//# sourceMappingURL=overlayEngineAccessToken.d.ts.map