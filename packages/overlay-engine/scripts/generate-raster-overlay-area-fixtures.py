#!/usr/bin/env python3
"""
One-off fixture generator for raster_overlay_area tests.

Independent of overlay-engine JS — uses rasterio + GDAL/OGR to clip rasters
to sketches and convert pixel counts to km².

Usage (from repo root, with the rio/rasterio venv python):
  /Users/cburt/.local/pipx/venvs/rio-cogeo/bin/python \
    packages/overlay-engine/scripts/generate-raster-overlay-area-fixtures.py
"""

from __future__ import annotations

import json
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask
from rasterio.warp import transform as rio_transform
from shapely.geometry import mapping, shape
from shapely.ops import transform as shapely_transform

try:
    from pyproj import Transformer
except ImportError:
    Transformer = None  # type: ignore

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "__tests__/fixtures/raster-overlay-area"
CACHE_DIR = Path("/tmp/raster-overlay-area-fixtures")


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or dest.stat().st_size < 1000:
        subprocess.check_call(["curl", "-sL", "-o", str(dest), url])
    return dest


def load_feature(path: Path) -> dict:
    data = json.loads(path.read_text())
    if data.get("type") == "FeatureCollection":
        return data["features"][0]
    return data


def reproject_geom(geom, src_epsg: int, dst_epsg: int):
    if Transformer is None:
        raise RuntimeError("pyproj required")
    transformer = Transformer.from_crs(src_epsg, dst_epsg, always_xy=True)

    def _xf(x, y, z=None):
        X, Y = transformer.transform(x, y)
        return (X, Y) if z is None else (X, Y, z)

    return shapely_transform(_xf, shape(geom))


def geodesic_pixel_m(transform, crs, lon: float, lat: float) -> tuple[float, float]:
    """Ground pixel dimensions in meters at lon/lat (matches JS groundPixelDimensionsMeters)."""
    from pyproj import Geod

    geod = Geod(ellps="WGS84")
    pw = abs(transform.a)
    ph = abs(transform.e)
    # pixel center in raster CRS
    # Convert lon/lat → raster CRS, then step one pixel east/north and measure.
    xs, ys = rio_transform("EPSG:4326", crs, [lon], [lat])
    cx, cy = xs[0], ys[0]
    e_xs, e_ys = rio_transform(crs, "EPSG:4326", [cx + pw], [cy])
    n_xs, n_ys = rio_transform(crs, "EPSG:4326", [cx], [cy + ph])
    _, _, mX = geod.inv(lon, lat, e_xs[0], e_ys[0])
    _, _, mY = geod.inv(lon, lat, n_xs[0], n_ys[0])
    return abs(mX), abs(mY)


def count_classes(arr: np.ndarray, nodata) -> dict[str, int]:
    valid = arr
    if nodata is not None:
        valid = arr[arr != nodata]
    else:
        valid = arr.ravel()
    # also drop nan
    valid = valid[np.isfinite(valid)]
    counts: dict[str, int] = {"*": int(valid.size)}
    if valid.size == 0:
        return counts
    uniq, cts = np.unique(np.round(valid).astype(np.int64), return_counts=True)
    for u, c in zip(uniq, cts):
        counts[str(int(u))] = int(c)
    return counts


def clip_counts(raster_path: Path, geom_raster_crs) -> tuple[dict[str, int], dict]:
    with rasterio.open(raster_path) as src:
        geoms = [mapping(geom_raster_crs)]
        out_image, out_transform = mask(src, geoms, crop=True, filled=True, nodata=src.nodata)
        band = out_image[0]
        nodata = src.nodata
        counts = count_classes(band, nodata)
        meta = {
            "epsg": src.crs.to_epsg() if src.crs else None,
            "pixelWidth": abs(src.transform.a),
            "pixelHeight": abs(src.transform.e),
            "nodata": nodata,
        }
        return counts, meta


def counts_to_km2_equal_area(counts: dict[str, int], pw: float, ph: float) -> dict[str, float]:
    scale = (pw * ph) / 1e6
    return {k: v * scale for k, v in counts.items()}


def counts_to_km2_geodesic(
    counts: dict[str, int], mX: float, mY: float
) -> dict[str, float]:
    scale = (mX * mY) / 1e6
    return {k: v * scale for k, v in counts.items()}


def centroid_lonlat(feat: dict) -> tuple[float, float]:
    g = shape(feat["geometry"])
    c = g.centroid
    return c.x, c.y


def ogr_buffer_in_meters(in_geojson: Path, out_geojson: Path, meters: float, epsg: int):
    """Buffer using SpatiaLite in a projected CRS (meters)."""
    # Reproject → buffer → write GeoJSON in same CRS, then we'll convert as needed
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        projected = td / "proj.geojson"
        buffered = td / "buf.geojson"
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-t_srs",
                f"EPSG:{epsg}",
                str(projected),
                str(in_geojson),
            ]
        )
        # SpatiaLite ST_Buffer with meters in projected CRS
        sql = f"SELECT ST_Buffer(geometry, {meters}) AS geometry FROM \"{projected.stem}\""
        # ogr2ogr -dialect sqlite needs layer name; use a GPKG intermediate for reliability
        gpkg = td / "tmp.gpkg"
        subprocess.check_call(
            ["ogr2ogr", "-f", "GPKG", str(gpkg), str(projected), "-nln", "src"]
        )
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-dialect",
                "sqlite",
                "-sql",
                f"SELECT ST_Buffer(geom, {meters}) AS geom FROM src",
                str(buffered),
                str(gpkg),
            ]
        )
        # back to WGS84 for storage
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-t_srs",
                "EPSG:4326",
                str(out_geojson),
                str(buffered),
            ]
        )


def ogr_erode_and_collar(in_geojson: Path, buffer_m: float, epsg: int, out_collar: Path):
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        gpkg = td / "tmp.gpkg"
        projected = td / "proj.geojson"
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-t_srs",
                f"EPSG:{epsg}",
                str(projected),
                str(in_geojson),
            ]
        )
        subprocess.check_call(
            ["ogr2ogr", "-f", "GPKG", str(gpkg), str(projected), "-nln", "src"]
        )
        collar = td / "collar.geojson"
        sql = (
            f"SELECT ST_Difference(ST_Buffer(geom, {buffer_m}), "
            f"COALESCE(ST_Buffer(geom, {-buffer_m}), ST_GeomFromText('POLYGON EMPTY'))) "
            f"AS geom FROM src"
        )
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-dialect",
                "sqlite",
                "-sql",
                sql,
                str(collar),
                str(gpkg),
            ]
        )
        subprocess.check_call(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-t_srs",
                "EPSG:4326",
                str(out_collar),
                str(collar),
            ]
        )


def main():
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    mang_tif = download(
        "http://uploads.seasketch.org/testing-mangroves-2020.tif",
        CACHE_DIR / "testing-mangroves-2020.tif",
    )
    sub_tif = download(
        "http://uploads.seasketch.org/testing-substrate-classes.tif",
        CACHE_DIR / "testing-substrate-classes.tif",
    )

    mang_feat_path = FIXTURE_DIR / "Mangrove-bordering-sketch.geojson.json"
    sub_feat_path = FIXTURE_DIR / "Substrate-Test.geojson.json"
    # Normalize to plain Feature GeoJSON for ogr
    mang_feat = load_feature(mang_feat_path)
    sub_feat = load_feature(sub_feat_path)
    mang_geojson = CACHE_DIR / "mangrove-sketch.geojson"
    sub_geojson = CACHE_DIR / "substrate-sketch.geojson"
    mang_geojson.write_text(json.dumps(mang_feat))
    sub_geojson.write_text(json.dumps(sub_feat))

    # --- Mangroves unbuffered ---
    mang_geom_6933 = reproject_geom(mang_feat["geometry"], 4326, 6933)
    mang_counts, mang_meta = clip_counts(mang_tif, mang_geom_6933)
    mang_areas = counts_to_km2_equal_area(
        mang_counts, mang_meta["pixelWidth"], mang_meta["pixelHeight"]
    )
    mang_fixture = {
        "sourceUrl": "http://uploads.seasketch.org/testing-mangroves-2020.tif",
        "sketch": "Mangrove-bordering-sketch.geojson.json",
        "epsg": 6933,
        "vrm": False,
        "groupBy": None,
        "pixelCounts": {"*": mang_counts["*"]},
        "expected": {"areas": {"*": mang_areas["*"]}},
        "toleranceKm2": 0.005,
        "notes": "Equal-area CRS: count × pixelWidth × pixelHeight / 1e6. Screenshot UI ~0.01 km².",
    }
    (FIXTURE_DIR / "mangroves-2020-bordering.json").write_text(
        json.dumps(mang_fixture, indent=2) + "\n"
    )
    print("mangroves unbuffered:", mang_fixture["expected"])

    # --- Mangroves buffered 1 km ---
    buf_wgs = CACHE_DIR / "mangrove-buffered-1km.geojson"
    collar_wgs = CACHE_DIR / "mangrove-collar-1km.geojson"
    ogr_buffer_in_meters(mang_geojson, buf_wgs, 1000, 6933)
    ogr_erode_and_collar(mang_geojson, 1000, 6933, collar_wgs)
    buf_feat = load_feature(buf_wgs)
    collar_feat = load_feature(collar_wgs)
    buf_geom = reproject_geom(buf_feat["geometry"], 4326, 6933)
    collar_geom = reproject_geom(collar_feat["geometry"], 4326, 6933)
    buf_counts, _ = clip_counts(mang_tif, buf_geom)
    collar_counts, _ = clip_counts(mang_tif, collar_geom)
    buf_areas = counts_to_km2_equal_area(
        buf_counts, mang_meta["pixelWidth"], mang_meta["pixelHeight"]
    )
    collar_areas = counts_to_km2_equal_area(
        collar_counts, mang_meta["pixelWidth"], mang_meta["pixelHeight"]
    )
    inner_star = max(0.0, buf_areas["*"] - collar_areas["*"])
    # bbox of buffered in WGS84
    minx, miny, maxx, maxy = shape(buf_feat["geometry"]).bounds
    buffered_fixture = {
        "sourceUrl": "http://uploads.seasketch.org/testing-mangroves-2020.tif",
        "sketch": "Mangrove-bordering-sketch.geojson.json",
        "epsg": 6933,
        "vrm": False,
        "groupBy": None,
        "bufferDistanceKm": 1,
        "expected": {
            "areas": {"*": buf_areas["*"]},
            "collarAreas": {"*": collar_areas["*"]},
            "innerAreas": {"*": inner_star},
            "bbox": [minx, miny, maxx, maxy],
        },
        "toleranceKm2": max(0.01, 0.05 * collar_areas["*"]),
        "notes": "SpatiaLite buffer in EPSG:6933; turf buffer may differ slightly — tolerance sized to collar.",
    }
    (FIXTURE_DIR / "mangroves-2020-bordering-buffered.json").write_text(
        json.dumps(buffered_fixture, indent=2) + "\n"
    )
    print("mangroves buffered:", buffered_fixture["expected"])

    # --- Substrate (EPSG:3857) — geodesic pixel size ---
    lon, lat = centroid_lonlat(sub_feat)
    with rasterio.open(sub_tif) as src:
        mX, mY = geodesic_pixel_m(src.transform, src.crs, lon, lat)
        sub_meta = {
            "epsg": src.crs.to_epsg(),
            "pixelWidth": abs(src.transform.a),
            "pixelHeight": abs(src.transform.e),
            "mX": mX,
            "mY": mY,
        }
    sub_geom = reproject_geom(sub_feat["geometry"], 4326, 3857)
    sub_counts, _ = clip_counts(sub_tif, sub_geom)
    sub_areas = counts_to_km2_geodesic(sub_counts, mX, mY)
    # Keep * and named classes
    expected_areas = {k: v for k, v in sub_areas.items()}
    substrate_fixture = {
        "sourceUrl": "http://uploads.seasketch.org/testing-substrate-classes.tif",
        "sketch": "Substrate-Test.geojson.json",
        "epsg": 3857,
        "vrm": False,
        "groupBy": "value",
        "groundPixelMeters": {"mX": mX, "mY": mY},
        "pixelCounts": sub_counts,
        "expected": {"areas": expected_areas},
        "toleranceKm2": 0.05,
        "notes": "Web Mercator: use geodesic ground-pixel size at sketch centroid (not native res²).",
    }
    (FIXTURE_DIR / "substrate-classes-test.json").write_text(
        json.dumps(substrate_fixture, indent=2) + "\n"
    )
    print("substrate:", {k: round(v, 6) for k, v in expected_areas.items()})
    print("Wrote fixtures to", FIXTURE_DIR)


if __name__ == "__main__":
    main()
