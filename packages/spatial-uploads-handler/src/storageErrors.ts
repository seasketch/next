/**
 * Helpers for turning storage (S3/R2 SDK) failures into messages that are
 * useful to the admin who sees them in the Background Jobs panel and to
 * whoever is reading the Slack alert.
 *
 * The AWS SDK's own messages are often just the error name ("NotFound",
 * "UnknownError"), so this spells out which operation failed on which remote,
 * the status code, and a hint for the common misconfigurations.
 */

export type StorageOperation = "fetch" | "upload" | "head";

interface ErrorDetails {
  name?: string;
  message?: string;
  code?: string;
  httpStatusCode?: number;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Pull what we can out of an unknown thrown value without trusting its shape. */
export function extractErrorDetails(error: unknown): ErrorDetails {
  if (error === null || error === undefined) {
    return {};
  }
  if (typeof error !== "object") {
    return { message: String(error) };
  }
  const record = error as Record<string, unknown>;
  const message = readString(record.message);
  const details: ErrorDetails = {
    name: readString(record.name),
    // The SDK fills in "UnknownError" when the service sent no body, which
    // adds nothing next to the error name and status code.
    message: message === "UnknownError" ? undefined : message,
    code: readString(record.code) ?? readString(record.Code),
  };
  const metadata = record.$metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    "httpStatusCode" in metadata &&
    typeof (metadata as Record<string, unknown>).httpStatusCode === "number"
  ) {
    details.httpStatusCode = (
      metadata as { httpStatusCode: number }
    ).httpStatusCode;
  }
  // Network errors from node surface the code on the error itself or on cause.
  if (!details.code && record.cause && typeof record.cause === "object") {
    details.code = readString((record.cause as Record<string, unknown>).code);
  }
  return details;
}

const NOT_FOUND_CODES = new Set(["NotFound", "NoSuchKey", "NoSuchBucket"]);
const AUTH_CODES = new Set([
  "AccessDenied",
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
  "CredentialsProviderError",
  "Forbidden",
]);
const NETWORK_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "TimeoutError",
]);

/** Hint about the likely cause based on the error classification. */
export function storageErrorHint(details: ErrorDetails): string | undefined {
  const codes = [details.code, details.name].filter(
    (value): value is string => !!value
  );
  const status = details.httpStatusCode;
  if (status === 404 || codes.some((code) => NOT_FOUND_CODES.has(code))) {
    return (
      "The bucket or object does not exist. If this happened while fetching a " +
      "just-uploaded file, the handler is probably looking in a different " +
      "bucket than the API wrote to (handler BUCKET vs. API SPATIAL_UPLOADS_BUCKET)."
    );
  }
  if (status === 403 || codes.some((code) => AUTH_CODES.has(code))) {
    return "Storage credentials were rejected. Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY and that they grant access to this bucket.";
  }
  if (codes.some((code) => NETWORK_CODES.has(code))) {
    return "Could not reach the storage endpoint. Check R2_ENDPOINT and network access from the handler.";
  }
  if (status !== undefined && status >= 500) {
    return "The storage service returned a server error. This is usually transient; retry the upload.";
  }
  return undefined;
}

/**
 * Compose a detailed, single-line message describing a failed storage
 * operation.
 *
 * @example
 * describeStorageError("fetch", "r2://bucket/key", err)
 * // => 'Failed to fetch r2://bucket/key: NotFound (HTTP 404). The bucket or object does not exist. ...'
 */
export function describeStorageError(
  operation: StorageOperation,
  remote: string,
  error: unknown
): string {
  const details = extractErrorDetails(error);
  const label =
    details.code && details.code !== details.name ? details.code : details.name;
  let reason: string;
  if (label && details.message && details.message !== label) {
    reason = `${label}: ${details.message}`;
  } else {
    reason = label || details.message || "Unknown error";
  }
  if (details.httpStatusCode !== undefined) {
    reason += ` (HTTP ${details.httpStatusCode})`;
  }
  const verb =
    operation === "fetch"
      ? "fetch"
      : operation === "upload"
      ? "upload to"
      : "read metadata for";
  let message = `Failed to ${verb} ${remote}: ${reason}.`;
  const hint = storageErrorHint(details);
  if (hint) {
    message += ` ${hint}`;
  }
  return message;
}

/** Normalize anything thrown into an Error with a non-empty message. */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    if (!value.message) {
      value.message = value.name || "Unknown error";
    }
    return value;
  }
  return new Error(
    typeof value === "string" && value.length > 0
      ? value
      : `Unknown error: ${JSON.stringify(value)}`
  );
}
