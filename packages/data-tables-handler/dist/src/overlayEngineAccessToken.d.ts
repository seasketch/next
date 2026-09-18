/**
 * Same Secrets Manager document overlay-worker and fragment-worker already
 * read (`seasketch/overlay-engine/access-token`). Used as Bearer on the
 * pmtiles-server /taxonomy proxy.
 */
export declare class OverlayEngineAccessTokenError extends Error {
    constructor(reason: string);
}
export declare function getOverlayEngineAccessToken(): Promise<string>;
