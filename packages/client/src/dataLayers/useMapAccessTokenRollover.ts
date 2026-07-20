import { useCallback, useEffect, useRef } from "react";
import decode from "jwt-decode";

const REFRESH_AFTER_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 60 * 2 * 1000; // 2 minutes

/**
 * Tracks mapAccessToken age and calls refetch when the token is ≥ 1 hour old
 * (90m TTL → refresh with ~30m remaining).
 */
export default function useMapAccessTokenRollover(
  token: string | null | undefined,
  refetch: () => void
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const check = useCallback(() => {
    if (!token) return;
    try {
      const claims = decode(token) as { iat?: number; exp?: number };
      if (!claims.iat) return;
      const ageMs = Date.now() - claims.iat * 1000;
      if (ageMs >= REFRESH_AFTER_MS) {
        console.warn("map access token is ≥ 1h old; refetching...");
        refetchRef.current();
      }
    } catch {
      // ignore decode errors
    }
  }, [token]);

  useEffect(() => {
    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);
}
