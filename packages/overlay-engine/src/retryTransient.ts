/**
 * Idempotent byte-range GETs through an undici Pool. Cloudflare (and any
 * other peer) can RST a keep-alive socket in the gap after one response and
 * before the next request is written. Undici 7 still surfaces that as
 * `read ECONNRESET` — idle-socket checks do not close the race. The request
 * has no body and is safe to send again on a new socket.
 *
 * Callers that wrap the failure in `new Error(message)` drop `.code`. The
 * message check covers that shape too.
 *
 * Body and header timeouts are not retried. Those already fail on the
 * caller's 10s budget, and four of them would turn one stall into four.
 */

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const TRANSIENT_MESSAGE =
  /\bECONNRESET\b|\bEPIPE\b|\bETIMEDOUT\b|\bother side closed\b|\bsocket hang up\b/;

/** First retry is immediate. The socket is already dead; waiting does not help. */
const RETRY_DELAYS_MS = [0, 50, 150];

export const TRANSIENT_SOCKET_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

function asRecord(error: unknown): {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  errors?: unknown;
} | null {
  if (error === null || typeof error !== "object") return null;
  return error;
}

function matches(error: unknown): boolean {
  if (typeof error === "string") return TRANSIENT_MESSAGE.test(error);
  const record = asRecord(error);
  if (!record) return false;
  if (typeof record.code === "string" && TRANSIENT_CODES.has(record.code)) {
    return true;
  }
  if (
    typeof record.message === "string" &&
    TRANSIENT_MESSAGE.test(record.message)
  ) {
    return true;
  }
  return false;
}

export function isTransientSocketError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    if (matches(current)) return true;
    const record = asRecord(current);
    if (!record) continue;
    if ("cause" in record) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors);
  }
  return false;
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_SOCKET_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const exhausted = attempt === TRANSIENT_SOCKET_ATTEMPTS - 1;
      if (!isTransientSocketError(error) || exhausted) throw error;
      const delay = RETRY_DELAYS_MS[attempt] ?? 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
