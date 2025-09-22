import os
import json
import tempfile
from urllib.parse import urlparse
from typing import Optional, Dict, Any

import boto3
import requests
from tqdm import tqdm

from subdivide import process_file


def _get_env(name: str, *, required: bool = False, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value or ""


def _create_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=_get_env("R2_ENDPOINT", required=True),
        aws_access_key_id=_get_env("R2_ACCESS_KEY_ID", required=True),
        aws_secret_access_key=_get_env("R2_SECRET_ACCESS_KEY", required=True),
        region_name=os.getenv("R2_REGION", "auto"),
    )


def _infer_object_key(source_url: str, provided_key: Optional[str] = None) -> str:
    if provided_key:
        return provided_key
    path = urlparse(source_url).path
    filename = os.path.basename(path) or "input.fgb"
    if not filename.lower().endswith(".fgb"):
        filename += ".fgb"
    name, _ = os.path.splitext(filename)
    return f"subdivided/{name}.fgb"


def _download_with_progress(url: str, dest_path: str, progress_cb):
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        total = resp.headers.get("Content-Length")
        try:
            total_bytes = int(total) if total is not None else None
        except Exception:
            total_bytes = None
        bytes_read = 0
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                f.write(chunk)
                bytes_read += len(chunk)
                try:
                    progress_cb("download", bytes_read, total_bytes)
                except Exception:
                    pass


def _upload_to_r2(local_path: str, object_key: str) -> Dict[str, Any]:
    bucket = _get_env("R2_BUCKET", required=True)
    s3 = _create_r2_client()
    s3.upload_file(local_path, bucket, object_key, ExtraArgs={"ContentType": "application/octet-stream"})
    result: Dict[str, Any] = {
        "bucket": bucket,
        "key": object_key,
        "r2Path": f"r2://{bucket}/{object_key}",
    }
    public_base = os.getenv("R2_PUBLIC_BASE_URL")
    if public_base:
        result["publicUrl"] = public_base.rstrip("/") + "/" + object_key
    return result


def _parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    # Direct invocation
    if "url" in event:
        return {
            "url": event.get("url"),
            "key": event.get("key"),
            "max_nodes": event.get("max_nodes"),
        }

    # API Gateway / Lambda Function URL
    q = event.get("queryStringParameters") or {}
    body_obj: Dict[str, Any] = {}
    body = event.get("body")
    if body:
        try:
            body_obj = json.loads(body)
        except Exception:
            body_obj = {}
    url = q.get("url") or body_obj.get("url")
    key = q.get("key") or body_obj.get("key")
    max_nodes = q.get("max_nodes") or body_obj.get("max_nodes")
    try:
        max_nodes = int(max_nodes) if max_nodes is not None else None
    except Exception:
        max_nodes = None
    return {"url": url, "key": key, "max_nodes": max_nodes}


def handler(event, context):
    params = _parse_event(event or {})
    source_url = params.get("url")
    if not source_url:
        err = {"error": "Missing required parameter: url"}
        if isinstance(event, dict) and "queryStringParameters" in event:
            return {"statusCode": 400, "headers": {"content-type": "application/json"}, "body": json.dumps(err)}
        return err

    max_nodes = params.get("max_nodes") or int(os.getenv("MAX_NODES", "256"))
    provided_key = params.get("key")
    object_key = _infer_object_key(source_url, provided_key) if provided_key else None

    progress_bar = tqdm(total=100, desc="Overall", unit="%", dynamic_ncols=True)
    last_value = 0.0

    def _overall_progress(phase: str, current: int, total: Optional[int]):
        nonlocal last_value
        if phase == "download":
            if total and total > 0:
                pct = 25.0 * (float(current) / float(total))
            else:
                # Without known total, increase slowly up to 25%
                pct = min(25.0, last_value + 0.5)
        elif phase == "processing_start":
            pct = 25.0
        elif phase == "processing":
            denom = float(total or 1)
            pct = 25.0 + 75.0 * (float(current) / denom)
        else:
            pct = last_value
        pct = max(0.0, min(100.0, pct))
        inc = pct - last_value
        if inc > 0.0:
            try:
                progress_bar.update(inc)
            except Exception:
                pass
            last_value = pct

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, "input.fgb")
            output_path = os.path.join(tmpdir, "output.fgb")

            _download_with_progress(source_url, input_path, _overall_progress)
            process_file(input_path, output_path, max_nodes, progress_callback=_overall_progress)

            upload_result = None
            if object_key:
                upload_result = _upload_to_r2(output_path, object_key)
    finally:
        try:
            progress_bar.close()
        except Exception:
            pass

    response_obj = {"ok": True, "uploaded": bool(object_key), "object": upload_result}
    if isinstance(event, dict) and "queryStringParameters" in event:
        return {"statusCode": 200, "headers": {"content-type": "application/json"}, "body": json.dumps(response_obj)}
    return response_obj


