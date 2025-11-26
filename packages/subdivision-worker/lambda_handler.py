import os
import json
import tempfile
from urllib.parse import urlparse
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import math

import boto3
import requests
import traceback
import time

from subdivide import process_file
from points import process_points
from raster import process_raster
from lines import process_lines
import fiona

# Cached AWS clients (reused across messages and invocations)
_SQS_CLIENTS: Dict[str, Any] = {}


def _get_env(name: str, *, required: bool = False, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value or ""


def _create_r2_client():
    print(f"Creating R2 client with endpoint {_get_env('R2_ENDPOINT', required=True)}")
    print(f"Creating R2 client with access key {_get_env('R2_ACCESS_KEY_ID', required=True)}")
    print(f"Creating R2 client with secret key {_get_env('R2_SECRET_ACCESS_KEY', required=True)}")
    return boto3.client(
        "s3",
        endpoint_url=_get_env("R2_ENDPOINT", required=True),
        aws_access_key_id=_get_env("R2_ACCESS_KEY_ID", required=True),
        aws_secret_access_key=_get_env("R2_SECRET_ACCESS_KEY", required=True),
        region_name=os.getenv("R2_REGION", "auto"),
    )


def _get_sqs_client(region: Optional[str] = None):
    region_name = (
        region
        or os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "us-west-2"
    )
    if region_name not in _SQS_CLIENTS:
        _SQS_CLIENTS[region_name] = boto3.client("sqs", region_name=region_name)
    return _SQS_CLIENTS[region_name]


def _extract_region_from_sqs_url(queue_url: str) -> Optional[str]:
    try:
        host = urlparse(queue_url).hostname or ""
        # Expected: sqs.<region>.amazonaws.com
        parts = host.split(".")
        if len(parts) >= 4 and parts[0] == "sqs" and parts[2] == "amazonaws":
            return parts[1]
    except Exception:
        pass
    return None


def _send_sqs_message(queue_url: str, message: Dict[str, Any]):
    region = _extract_region_from_sqs_url(queue_url)
    sqs = _get_sqs_client(region)
    try:
        sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message))
    except Exception as e:
        print(f"Failed to send SQS message to {queue_url}: {e}")
        raise


class ProgressNotifier:
    def __init__(self, job_key: str, queue_url: str, max_wait_ms: int = 1000):
        self.job_key = job_key
        self.queue_url = queue_url
        self.max_wait_ms = max_wait_ms
        self.progress = 0
        self.last_notified_progress = 0
        self.message_last_sent = int(time.time() * 1000)
        self._eta_estimator: Optional["EtaEstimator"] = None
        self._eta: Optional[datetime] = None
        # Only count ETA samples beyond this baseline (exclude download and scanning phases)
        self._eta_baseline_progress = 15

    def notify(self, progress: float, message: Optional[str] = None, include_in_eta: bool = False):
        now_ms = int(time.time() * 1000)
        send_notification = False

        if now_ms - (self.message_last_sent or 0) > self.max_wait_ms:
            send_notification = True
        if progress > self.last_notified_progress + 5:
            send_notification = True

        # Initialize ETA estimator on first post-download sample
        if (
            include_in_eta
            and self._eta_estimator is None
            and progress > self._eta_baseline_progress
        ):
            # Only measure remaining portion (exclude baseline segment)
            self._eta_estimator = EtaEstimator(
                total_units=100 - self._eta_baseline_progress
            )

        # Update ETA when progress increases and the sample should count
        if include_in_eta and progress > self.progress and self._eta_estimator is not None:
            effective_done = max(0, int(progress) - self._eta_baseline_progress)
            state = self._eta_estimator.update(effective_done)
            self._eta = state["eta"]

        self.progress = progress
        if send_notification:
            self.last_notified_progress = int(self.progress)
            self.message_last_sent = now_ms
            print(f"Sending progress notification for job {self.job_key}: {self.progress}%")
            payload: Dict[str, Any] = {
                "type": "progress",
                "progress": int(self.progress),
                "message": message,
                "jobKey": self.job_key,
                "queueUrl": self.queue_url,
                "origin": "subdivision",
            }
            if self._eta is not None:
                # Serialize ETA as ISO 8601 UTC string (e.g., 2025-01-01T00:00:00.000Z)
                eta_iso = self._eta.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                payload["eta"] = eta_iso
            _send_sqs_message(self.queue_url, payload)

    def begin(self, logfile_url: Optional[str] = None, logs_expires_at: Optional[str] = None):
        _send_sqs_message(
            self.queue_url,
            {
                "type": "begin",
                "logfileUrl": logfile_url,
                "logsExpiresAt": logs_expires_at,
                "jobKey": self.job_key,
                "queueUrl": self.queue_url,
                "origin": "subdivision",
            },
        )

    def error(self, error_message: str):
        _send_sqs_message(
            self.queue_url,
            {
                "type": "error",
                "error": error_message,
                "jobKey": self.job_key,
                "queueUrl": self.queue_url,
                "origin": "subdivision",
            },
        )

    def result(self, result: Dict[str, Any]):
        _send_sqs_message(
            self.queue_url,
            {
                "type": "result",
                "result": result,
                "jobKey": self.job_key,
                "queueUrl": self.queue_url,
                "origin": "subdivision",
            },
        )


class EtaEstimator:
    """
    ETA estimator using an EWMA of per-unit durations with an optional prior.

    Mirrors the behavior of the TypeScript EtaEstimator used in overlay-worker.
    Progress should be provided as cumulative units [0..total_units].
    """

    def __init__(
        self,
        *,
        total_units: int,
        prior_ms_per_unit: Optional[float] = None,
        min_samples_units: int = 20,
        min_samples_ms: int = 2000,
        ewma_half_life_units: int = 100,
        prior_weight_units: int = 100,
    ) -> None:
        if not isinstance(total_units, (int, float)) or total_units <= 0 or not math.isfinite(total_units):
            raise ValueError("total_units must be a positive finite number")
        self.total_units = int(max(1, math.floor(total_units)))

        self.prior_ms_per_unit = prior_ms_per_unit if prior_ms_per_unit is not None else None
        self.min_samples_units = int(min_samples_units)
        self.min_samples_ms = int(min_samples_ms)
        self.ewma_half_life_units = float(ewma_half_life_units)
        self.prior_weight_units = int(prior_weight_units)

        now_ms = int(time.time() * 1000)
        self.start_ms: int = now_ms
        self.last_tick_ms: int = now_ms
        self.last_done: int = 0
        self.ewma_ms_per_unit: Optional[float] = None
        self.seen_units: int = 0

    def update(self, done_units: float) -> Dict[str, Any]:
        now_ms = int(time.time() * 1000)

        # Clamp and enforce monotonicity
        done_units = float(done_units)
        done_units = min(self.total_units, max(0, math.floor(done_units)))
        if done_units < self.last_done:
            return self._current_state(now_ms)

        # Update EWMA if new progress has occurred
        if done_units > self.last_done:
            dt = now_ms - self.last_tick_ms
            dn = int(done_units - self.last_done)
            if dt > 0 and dn > 0:
                inst_ms_per_unit = dt / dn
                alpha = 1 - math.exp(-dn / self.ewma_half_life_units)
                if self.ewma_ms_per_unit is None:
                    self.ewma_ms_per_unit = inst_ms_per_unit
                else:
                    self.ewma_ms_per_unit = (1 - alpha) * self.ewma_ms_per_unit + alpha * inst_ms_per_unit
            self.seen_units = int(done_units)
            self.last_done = int(done_units)
            self.last_tick_ms = now_ms

        return self._current_state(now_ms)

    def _current_state(self, now_ms: int) -> Dict[str, Any]:
        elapsed_ms = now_ms - self.start_ms
        ready = self.seen_units >= self.min_samples_units or elapsed_ms >= self.min_samples_ms

        if not ready or self.ewma_ms_per_unit is None:
            return {
                "eta": None,
                "etaMs": None,
                "msPerUnit": self.ewma_ms_per_unit,
                "samples": self.seen_units,
                "confidence": "low",
            }

        # Blend EWMA with prior if applicable
        ms_per_unit = float(self.ewma_ms_per_unit)
        if self.prior_ms_per_unit is not None:
            w = min(self.prior_weight_units / max(1, self.seen_units), 1)
            ms_per_unit = w * float(self.prior_ms_per_unit) + (1 - w) * ms_per_unit

        remaining_units = max(0, self.total_units - self.seen_units)
        eta_ms = int(max(ms_per_unit, 0) * remaining_units)
        eta_dt = datetime.fromtimestamp((now_ms + eta_ms) / 1000, tz=timezone.utc)

        confidence = (
            "high"
            if self.seen_units > self.min_samples_units * 3
            else ("med" if self.seen_units >= self.min_samples_units else "low")
        )

        return {
            "eta": eta_dt,
            "etaMs": eta_ms,
            "msPerUnit": ms_per_unit,
            "samples": self.seen_units,
            "confidence": confidence,
        }


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


def _upload_to_r2(local_path: str, object_key: str, progress_cb=None) -> Dict[str, Any]:
    bucket = _get_env("R2_BUCKET", required=True)
    print(f"Uploading to {bucket}/{object_key}")
    s3 = _create_r2_client()
    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Upload file not found: {local_path}")
    
    # Get file size for progress tracking
    file_size = os.path.getsize(local_path)
    
    # Upload with progress tracking
    if progress_cb:
        def upload_progress_callback(bytes_transferred):
            progress_cb("upload", bytes_transferred, file_size)
        
        s3.upload_file(
            local_path, 
            bucket, 
            object_key, 
            ExtraArgs={"ContentType": "application/octet-stream"},
            Callback=upload_progress_callback
        )
    else:
        s3.upload_file(local_path, bucket, object_key, ExtraArgs={"ContentType": "application/octet-stream"})
    
    # fetch size for downstream consumers
    head = s3.head_object(Bucket=bucket, Key=object_key)
    size = int(head.get("ContentLength") or 0)
    result: Dict[str, Any] = {
        "bucket": bucket,
        "key": object_key,
        "r2Path": f"r2://{bucket}/{object_key}",
        "size": size,
        "filename": os.path.basename(object_key),
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
            "jobKey": event.get("jobKey"),
            "queueUrl": event.get("queueUrl"),
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
    job_key = q.get("jobKey") or body_obj.get("jobKey")
    queue_url = q.get("queueUrl") or body_obj.get("queueUrl")
    try:
        max_nodes = int(max_nodes) if max_nodes is not None else None
    except Exception:
        max_nodes = None
    return {"url": url, "key": key, "max_nodes": max_nodes, "jobKey": job_key, "queueUrl": queue_url}


def handler(event, context):
    params = _parse_event(event or {})
    print(f"handler called with params: {params}")
    source_url = params.get("url")
    if not source_url:
        err = {"error": "Missing required parameter: url"}
        if isinstance(event, dict) and "queryStringParameters" in event:
            return {"statusCode": 400, "headers": {"content-type": "application/json"}, "body": json.dumps(err)}
        return err
        
    is_raster = source_url.endswith(".tif") or source_url.endswith(".tiff") or source_url.endswith(".TIF") or source_url.endswith(".TIFF")
    max_nodes = params.get("max_nodes") or int(os.getenv("MAX_NODES", "256"))
    provided_key = params.get("key")
    object_key = provided_key if provided_key else None
    job_key = params.get("jobKey")
    queue_url = params.get("queueUrl")

    notifier: Optional[ProgressNotifier] = None
    if job_key and queue_url:
        notifier = ProgressNotifier(job_key, queue_url, 1000)
        try:
            notifier.begin()
        except Exception:
            pass
    last_value = 0.0

    def _overall_progress(phase: str, current: int, total: Optional[int]):
        nonlocal last_value
        
        # Progress allocation: Download 7%, Scanning 8%, Processing 70%, Upload 15%
        if phase == "download":
            if total and total > 0:
                # Download: 0% to 7%
                progress_ratio = min(1.0, float(current) / float(total))
                pct = 7.0 * progress_ratio
            else:
                # Without known total, increase slowly up to 7%
                pct = min(7.0, last_value + 0.5)

        elif phase == "scanning":
            if total and total > 0:
                # Scanning features: 7% to 15% (8% range)
                progress_ratio = min(1.0, float(current) / float(total))
                pct = 7.0 + 8.0 * progress_ratio
            else:
                # Without known total, increase slowly from 7% to 15%
                pct = min(15.0, max(7.0, last_value + 0.5))
                
        elif phase == "processing_start":
            # Processing starts at 15%
            pct = 15.0
            
        elif phase == "processing":
            if total and total > 0:
                # Processing: 15% to 85% (70% range)
                # current is 1-based (i + 1), so convert to 0-based for ratio calculation
                progress_ratio = min(1.0, float(current - 1) / float(total))
                pct = 15.0 + 70.0 * progress_ratio
            else:
                # Without known total, increase slowly from 15% to 85%
                pct = min(85.0, max(15.0, last_value + 0.5))
                
        elif phase == "upload":
            if total and total > 0:
                # Upload: 85% to 100% (15% range)
                progress_ratio = min(1.0, float(current) / float(total))
                pct = 85.0 + 15.0 * progress_ratio
            else:
                # Without known total, increase slowly from 85% to 100%
                pct = min(100.0, max(85.0, last_value + 0.5))
        else:
            pct = last_value
        
        # Debug logging
        print(f"Progress: phase={phase}, current={current}, total={total}, calculated_pct={pct:.2f}")
        
        # Clamp to valid range
        pct = max(0.0, min(100.0, pct))
            
        if notifier is not None:
            try:
                # Include ETA samples only for processing and upload phases (exclude download and scanning)
                include_in_eta = phase in ("processing_start", "processing", "upload")
                notifier.notify(int(pct), None, include_in_eta)
            except Exception:
                pass
        last_value = pct

    upload_result = None
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            if is_raster:
                input_path = os.path.join(tmpdir, "input.tif")
                output_path = os.path.join(tmpdir, "output.tif")
            else:
                input_path = os.path.join(tmpdir, "input.fgb")
                output_path = os.path.join(tmpdir, "output.fgb")

            _download_with_progress(source_url, input_path, _overall_progress)
            
            if is_raster:
                # Route to raster processor for GeoTIFF -> COG conversion
                print("Detected raster file, routing to raster processor")
                process_raster(input_path, output_path, progress_callback=_overall_progress)
            else:
                # Open file to detect geometry type
                with fiona.open(input_path, "r") as src:
                    print(f"Schema: {src.schema}")
                    # Detect geometry type from schema or first feature
                    schema_geom = src.schema.get('geometry', None)
                    geom_type = None
                    
                    # Handle schema geometry - can be string or dict
                    if isinstance(schema_geom, str):
                        geom_type = schema_geom
                    elif isinstance(schema_geom, dict):
                        geom_type = schema_geom.get('type', None)
                    
                    print(f"Schema geometry: {schema_geom}")
                    print(f"Schema geometry type: {geom_type}")
                    # If not found in schema, try reading first feature
                    if not geom_type or geom_type == "Unknown":
                        try:
                            first_feature = next(iter(src))
                            print(f"First feature: {first_feature}")
                            geom_type = first_feature['geometry']['type']
                        except (StopIteration, KeyError, TypeError):
                            print("No first feature found. got exception:", traceback.format_exc())
                            geom_type = None
                    
                    if not geom_type:
                        raise ValueError("Could not determine geometry type from file")
                
                # Route to appropriate processor based on geometry type (processors will open/close file themselves)
                if geom_type in ('Point', 'MultiPoint'):
                    print(f"Detected geometry type: {geom_type}, routing to points processor")
                    process_points(input_path, output_path, progress_callback=_overall_progress)
                elif geom_type in ('Polygon', 'MultiPolygon'):
                    print(f"Detected geometry type: {geom_type}, routing to subdivision processor")
                    process_file(input_path, output_path, max_nodes, progress_callback=_overall_progress)
                elif geom_type in ('LineString', 'MultiLineString'):
                    print(f"Detected geometry type: {geom_type}, routing to line subdivision processor")
                    process_lines(input_path, output_path, max_nodes, progress_callback=_overall_progress)
                else:
                    raise ValueError(
                        f"Unsupported geometry type: {geom_type}. "
                        "Supported types: Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon"
                    )

            if object_key:
                print(f"Uploading to {object_key}")
                upload_result = _upload_to_r2(output_path, object_key, _overall_progress)
                print(f"Uploaded to {upload_result}")
            if notifier is not None and upload_result is not None:
                try:
                    notifier.notify(100, "Complete")
                    if is_raster:
                        upload_result["epsg"] = 6933

                    notifier.result({"object": upload_result})
                except Exception:
                    pass
    except Exception as e:
        print(f"Subdivision worker failed: {e}")
        traceback.print_exc()
        if notifier is not None:
            try:
                notifier.error(str(e))
            except Exception:
                pass
        if isinstance(event, dict) and "queryStringParameters" in event:
            err_obj = {"ok": False, "error": str(e)}
            return {"statusCode": 500, "headers": {"content-type": "application/json"}, "body": json.dumps(err_obj)}
        raise

    response_obj = {"ok": True, "uploaded": bool(object_key), "object": upload_result}
    if isinstance(event, dict) and "queryStringParameters" in event:
        return {"statusCode": 200, "headers": {"content-type": "application/json"}, "body": json.dumps(response_obj)}
    return response_obj


