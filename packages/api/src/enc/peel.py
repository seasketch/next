#!/usr/bin/env python3
"""Stop a smaller-scale chart where a larger-scale cell covers the same place.

Reads GeoJSONSeq features and a mask FeatureCollection whose features have
integer property "band". Writes GeoJSONSeq. A feature of band B is split:

- the part that also lies in a larger-scale cell of band H ends at the zoom
  before H starts
- the rest keeps the archive max zoom

Zoom numbers come from the JSON spec argument so they stay in one place
(packages/api/src/enc/layers.ts).
"""
import json
import sys

from osgeo import ogr


def load_masks(path):
    data = json.load(open(path))
    features = data["features"] if data.get("type") == "FeatureCollection" else data
    geoms = {}
    for feature in features:
        band = int(feature["properties"]["band"])
        geom = ogr.CreateGeometryFromJson(json.dumps(feature["geometry"]))
        if geom is None or geom.IsEmpty():
            continue
        geoms.setdefault(band, []).append(geom)
    unions = {}
    for band, parts in geoms.items():
        union = parts[0]
        for geom in parts[1:]:
            union = union.Union(geom)
        unions[band] = union
    return unions


def clean(geom):
    if geom is None or geom.IsEmpty():
        return None
    if not geom.IsValid():
        geom = geom.MakeValid()
    return geom


def pieces(geom):
    geom = clean(geom)
    if geom is None:
        return []
    if geom.GetGeometryName() == "GEOMETRYCOLLECTION":
        found = []
        for index in range(geom.GetGeometryCount()):
            found.extend(pieces(geom.GetGeometryRef(index).Clone()))
        return found
    return [geom]


def same_family(original_name, part):
    """Drop the lines a polygon intersection leaves on a cell boundary."""
    part_name = part.GetGeometryName()
    if "POINT" in original_name:
        return "POINT" in part_name
    if "LINE" in original_name:
        return "LINE" in part_name
    if "POLY" in original_name:
        return "POLYGON" in part_name
    return True


def emit(feature, geom, maxzoom, out, family):
    minzoom = int(feature["tippecanoe"]["minzoom"])
    if minzoom > maxzoom:
        return 0
    written = 0
    for part in pieces(geom):
        if part.IsEmpty() or not same_family(family, part):
            continue
        clone = {
            "type": "Feature",
            "properties": feature["properties"],
            "geometry": json.loads(part.ExportToJson()),
            "tippecanoe": dict(feature["tippecanoe"], maxzoom=maxzoom),
        }
        out.write(json.dumps(clone) + "\n")
        written += 1
    return written


def main():
    features_path, masks_path, out_path, spec_path = sys.argv[1:5]
    spec = json.load(open(spec_path))
    band_min = {int(band): int(zoom) for band, zoom in spec["bandMinZoom"].items()}
    max_zoom = int(spec["maxZoom"])
    masks = load_masks(masks_path)
    written = 0
    with open(out_path, "w") as out:
        for line in open(features_path):
            line = line.strip()
            if not line:
                continue
            feature = json.loads(line)
            geom = ogr.CreateGeometryFromJson(json.dumps(feature["geometry"]))
            if geom is None:
                continue
            family = geom.GetGeometryName()
            band = feature.get("properties", {}).get("band")
            if band is None:
                written += emit(feature, geom, int(feature["tippecanoe"]["maxzoom"]), out, family)
                continue
            band = int(band)
            remaining = geom
            try:
                # Nearest larger scale first. A harbour cell sits inside an
                # approach cell, and the approach chart is what should hide
                # the coastal chart, not the harbour chart several zooms later.
                for higher in range(band + 1, 7):
                    mask = masks.get(higher)
                    if mask is None or remaining is None or remaining.IsEmpty():
                        continue
                    inside = remaining.Intersection(mask)
                    if inside is not None and not inside.IsEmpty():
                        written += emit(feature, inside, band_min[higher] - 1, out, family)
                    remaining = remaining.Difference(mask)
                if remaining is not None and not remaining.IsEmpty():
                    written += emit(feature, remaining, max_zoom, out, family)
            except RuntimeError:
                # A broken ring should not drop the whole cell.
                written += emit(feature, geom, max_zoom, out, family)
    print(written)


if __name__ == "__main__":
    main()
