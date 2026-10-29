"""Fetch/cache the overlay-engine JWT from Secrets Manager for uploads downloads.

CDK sets OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN on the deployed function. When
it is unset the worker is running locally against a pmtiles-server with access
control off, and downloads are made without a token.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional

import boto3

REFRESH_WHEN_REMAINING_S = 24 * 60 * 60

_cache: Optional[Dict[str, Any]] = None
_logged_no_secret = False


class OverlayEngineAccessTokenError(RuntimeError):
    def __init__(self, reason: str):
        super().__init__(f"overlay_engine_access_token_unavailable: {reason}")


def _secret_id() -> Optional[str]:
    arn = os.getenv("OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN", "").strip()
    return arn or None


def _parse_secret(raw: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise OverlayEngineAccessTokenError("invalid_secret") from e
    token = parsed.get("token") if isinstance(parsed, dict) else None
    exp = parsed.get("exp") if isinstance(parsed, dict) else None
    if not isinstance(token, str) or not token:
        raise OverlayEngineAccessTokenError("invalid_secret")
    if not isinstance(exp, (int, float)) or not (exp == exp):  # NaN check
        raise OverlayEngineAccessTokenError("invalid_secret")
    return {"token": token, "exp": float(exp)}


def _is_expired(cached: Dict[str, Any], skew_s: float = 0) -> bool:
    return cached["exp"] <= time.time() + skew_s


def _needs_refresh(cached: Dict[str, Any]) -> bool:
    return cached["exp"] - time.time() < REFRESH_WHEN_REMAINING_S


def bust_overlay_engine_access_token_cache() -> None:
    global _cache
    _cache = None


def get_overlay_engine_access_token() -> Optional[str]:
    """Return a non-expired overlay-engine JWT from Secrets Manager (cached).

    Returns None, and logs once, when no secret ARN is configured.
    """
    global _cache, _logged_no_secret
    secret_id = _secret_id()
    if secret_id is None:
        if not _logged_no_secret:
            print(
                "OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN is not set; "
                "downloading hosted data without an access token"
            )
            _logged_no_secret = True
        return None
    if _cache and not _is_expired(_cache) and not _needs_refresh(_cache):
        return _cache["token"]

    region = (
        os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "us-west-2"
    )
    client = boto3.client("secretsmanager", region_name=region)
    try:
        response = client.get_secret_value(SecretId=secret_id)
    except Exception as e:
        raise OverlayEngineAccessTokenError(f"missing:{e}") from e

    secret_string = response.get("SecretString")
    if not secret_string:
        raise OverlayEngineAccessTokenError("missing")

    fetched = _parse_secret(secret_string)
    if _is_expired(fetched, skew_s=60):
        raise OverlayEngineAccessTokenError("expired")

    _cache = fetched
    return fetched["token"]
