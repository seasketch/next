import math
import os
from typing import Callable, Iterable, List, Optional

import fiona
from pyproj import Geod
from shapely.geometry import (
    GeometryCollection,
    LineString,
    MultiLineString,
    mapping,
    shape,
)
from shapely.ops import split, transform
from tqdm import tqdm


ProgressCallback = Optional[Callable[[str, int, Optional[int]], None]]


def count_line_nodes(geom):
    """Count total nodes in a GeoJSON-like LineString or MultiLineString."""
    if not geom:
        return 0
    gtype = geom.get("type")
    if gtype == "LineString":
        coords = geom.get("coordinates") or []
        return len(coords)
    if gtype == "MultiLineString":
        coords = geom.get("coordinates") or []
        return sum(len(line) for line in coords)
    return 0


def _crosses_antimeridian_coords(coords: Iterable):
    coords = list(coords)
    if not coords:
        return False
    prev_x = coords[0][0]
    for pt in coords[1:]:
        x = pt[0]
        if abs(x - prev_x) > 180:
            return True
        prev_x = x
    return False


def _line_crosses_antimeridian(line: LineString) -> bool:
    return _crosses_antimeridian_coords(list(line.coords))


def _unwrap_line_coords(coords: List):
    if not coords:
        return coords
    unwrapped = [coords[0]]
    prev_x = coords[0][0]
    prev_y = coords[0][1]
    for x, y in coords[1:]:
        dx = x - prev_x
        if dx > 180:
            while x - prev_x > 180:
                x -= 360
        elif dx < -180:
            while x - prev_x < -180:
                x += 360
        unwrapped.append((x, y))
        prev_x, prev_y = x, y
    return unwrapped


def _split_line_antimeridian(line: LineString) -> List[LineString]:
    coords = list(line.coords)
    if len(coords) < 2 or not _line_crosses_antimeridian(line):
        return [line]

    unwrapped = _unwrap_line_coords(coords)
    unwrapped_line = LineString(unwrapped)
    if unwrapped_line.is_empty or len(unwrapped_line.coords) < 2:
        return []

    minx, _, maxx, _ = unwrapped_line.bounds
    dateline_segments: List[LineString] = []
    start = math.floor((minx - 180) / 360) * 360 + 180
    x = start
    while x <= maxx + 1e-9:
        dateline_segments.append(LineString([(x, -90), (x, 90)]))
        x += 360

    pieces = [unwrapped_line]
    if dateline_segments:
        splitter = (
            MultiLineString(dateline_segments)
            if len(dateline_segments) > 1
            else dateline_segments[0]
        )
        try:
            pieces = list(split(unwrapped_line, splitter).geoms)
        except Exception:
            pieces = [unwrapped_line]

    results: List[LineString] = []
    for piece in pieces:
        if piece.is_empty or len(piece.coords) < 2:
            continue
        cx = piece.centroid.x
        shift = -360 * math.floor((cx + 180.0) / 360.0)
        if abs(shift) > 1e-9:
            def _shift_func(x_val, y_val, z_val=None):
                return (x_val + shift, y_val)

            piece = transform(_shift_func, piece)
        results.append(LineString(piece.coords))
    return results or [line]


def _flatten_lines(geometry) -> List[LineString]:
    if geometry.is_empty:
        return []
    if isinstance(geometry, LineString):
        return [geometry]
    if isinstance(geometry, MultiLineString):
        return [LineString(g.coords) for g in geometry.geoms if len(g.coords) >= 2]
    if isinstance(geometry, GeometryCollection):
        parts: List[LineString] = []
        for geom in geometry.geoms:
            parts.extend(_flatten_lines(geom))
        return parts
    raise ValueError(f"Unsupported geometry type for lines: {geometry.geom_type}")


def _subdivide_line_by_nodes(line: LineString, max_nodes: int) -> List[LineString]:
    coords = list(line.coords)
    if len(coords) <= max_nodes:
        return [line]
    mid = max(1, len(coords) // 2)
    first_coords = coords[: mid + 1]
    second_coords = coords[mid:]

    result: List[LineString] = []
    if len(first_coords) >= 2:
        result.extend(_subdivide_line_by_nodes(LineString(first_coords), max_nodes))
    if len(second_coords) >= 2:
        result.extend(_subdivide_line_by_nodes(LineString(second_coords), max_nodes))
    return result


def _geodesic_length_km(line: LineString, geod: Geod) -> float:
    coords = list(line.coords)
    if len(coords) < 2:
        return 0.0
    lons = [pt[0] for pt in coords]
    lats = [pt[1] for pt in coords]
    length_m = geod.line_length(lons, lats)
    return max(length_m, 0.0) / 1000.0


def _ensure_max_nodes(line: LineString, max_nodes: int) -> List[LineString]:
    safe_max = max(2, int(max_nodes))
    return _subdivide_line_by_nodes(line, safe_max)


def _ensure_no_antimeridian_crossing(line: LineString) -> List[LineString]:
    if _line_crosses_antimeridian(line):
        return _split_line_antimeridian(line)
    return [line]


def process_lines(
    input_file: str,
    output_file: str,
    max_nodes: int,
    progress_callback: ProgressCallback = None,
):
    """Process linear features, splitting/exploding as needed and writing FlatGeobuf."""
    geod = Geod(ellps="WGS84")
    batch: List[dict] = []

    with fiona.open(input_file, "r") as src:
        schema = src.schema.copy()
        schema["geometry"] = "LineString"
        if "properties" in schema and isinstance(schema["properties"], dict):
            schema["properties"]["__lengthKm"] = "float"
            schema["properties"]["__oidx"] = "int"
        total_features = len(src)

        total_nodes_in_dataset = 0
        scanned_features = 0
        if progress_callback is not None:
            try:
                progress_callback("scanning", 0, total_features)
            except Exception:
                pass
        for feature in src:
            total_nodes_in_dataset += count_line_nodes(feature.get("geometry"))
            scanned_features += 1
            if progress_callback is not None:
                try:
                    progress_callback("scanning", scanned_features, total_features)
                except Exception:
                    pass

    cumulative_processed_nodes = 0

    with fiona.open(input_file, "r") as src:
        with fiona.open(
            output_file, "w", driver="FlatGeobuf", crs=src.crs, schema=schema
        ) as dst:
            pbar = (
                None
                if progress_callback is not None
                else tqdm(total=len(src), desc="Processing lines")
            )

            if progress_callback is not None:
                try:
                    progress_callback(
                        "processing_start", 0, max(total_nodes_in_dataset, 1)
                    )
                except Exception:
                    pass

            try:
                batch_size = int(os.getenv("SUBDIVIDE_BATCH_SIZE", "10000"))
            except Exception:
                batch_size = 10000

            def flush_batch():
                if batch:
                    dst.writerecords(batch)
                    batch.clear()

            def write_line(line_geom: LineString, props: dict):
                nonlocal cumulative_processed_nodes
                if line_geom.is_empty or len(line_geom.coords) < 2:
                    return
                geom_geojson = mapping(line_geom)
                out_props = dict(props)
                out_props["__lengthKm"] = _geodesic_length_km(line_geom, geod)
                batch.append({"geometry": geom_geojson, "properties": out_props})
                cumulative_processed_nodes += len(line_geom.coords)
                if progress_callback is not None:
                    try:
                        progress_callback(
                            "processing",
                            cumulative_processed_nodes,
                            max(total_nodes_in_dataset, 1),
                        )
                    except Exception:
                        pass
                if len(batch) >= batch_size:
                    flush_batch()

            feature_index = 0
            for feature in src:
                geom = shape(feature["geometry"])
                base_props = dict(feature.get("properties") or {})
                base_props["__oidx"] = feature_index

                line_parts = _flatten_lines(geom)
                for part in line_parts:
                    for safe_part in _ensure_no_antimeridian_crossing(part):
                        for limited_part in _ensure_max_nodes(
                            safe_part, max_nodes
                        ):
                            write_line(limited_part, base_props)

                feature_index += 1
                if pbar is not None:
                    try:
                        pbar.update(1)
                    except Exception:
                        pass

            if pbar is not None:
                try:
                    pbar.close()
                except Exception:
                    pass

            flush_batch()

    print(f"Total features processed: {feature_index}")
    print(f"Total line nodes processed: {cumulative_processed_nodes}")


