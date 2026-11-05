#!/usr/bin/env python3
"""Stop a smaller-scale chart where a larger-scale cell covers the same place.

Reads GeoJSONSeq features and a mask FeatureCollection. Each mask feature has
integer "band" and string "cell". Writes GeoJSONSeq.

A feature of band B is split against the nearest larger-scale cell that covers
it and that actually draws the same layer (depth contours, soundings, and so
on). The covered part ends at the zoom before that cell's own features of the
layer appear. Ending it at the cell's usage-band zoom instead leaves a gap:
the small-scale contours are gone, and the large-scale contours have not
started, so the coast is blank while the water just outside the cell still
has them. Skin-of-the-earth features already share the band zoom, so their
handoff is unchanged.

Zoom numbers come from each feature's tippecanoe minzoom. The archive max
zoom is in the JSON spec argument.
"""
import json
import sys

from osgeo import ogr


def load_masks(path):
    data = json.load(open(path))
    features = data["features"] if data.get("type") == "FeatureCollection" else data
    masks = []
    for feature in features:
        props = feature.get("properties") or {}
        if "band" not in props or "cell" not in props:
            continue
        geom = ogr.CreateGeometryFromJson(json.dumps(feature["geometry"]))
        if geom is None or geom.IsEmpty():
            continue
        masks.append(
            {"band": int(props["band"]), "cell": str(props["cell"]), "geom": geom}
        )
    return masks


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


def layer_starts(features_path):
    """First zoom at which each cell draws each layer."""
    starts = {}
    for line in open(features_path):
        line = line.strip()
        if not line:
            continue
        feature = json.loads(line)
        props = feature.get("properties") or {}
        cell = props.get("cell")
        layer = props.get("cls")
        tip = feature.get("tippecanoe") or {}
        if not cell or not layer or "minzoom" not in tip:
            continue
        key = (str(cell), str(layer))
        zoom = int(tip["minzoom"])
        if key not in starts or zoom < starts[key]:
            starts[key] = zoom
    return starts


def cut(feature, geom, band, layer, masks, starts, out, family, max_zoom):
    """Write geom, handing each covered part to the nearest larger cell.

    Nearest band first. A harbour sitting inside an approach cell is part of
    the approach cut, and the approach features are what the harbour replaces
    when those features are peeled. A cell that does not draw this layer does
    not erase it.
    """
    remaining = clean(geom)
    if remaining is None:
        return 0
    written = 0
    for higher in range(band + 1, 7):
        covering = [
            mask
            for mask in masks
            if mask["band"] == higher and (mask["cell"], layer) in starts
        ]
        for mask in covering:
            if remaining is None or remaining.IsEmpty():
                return written
            inside = clean(remaining.Intersection(mask["geom"]))
            if inside is not None and not inside.IsEmpty():
                written += emit(
                    feature, inside, starts[(mask["cell"], layer)] - 1, out, family
                )
            remaining = clean(remaining.Difference(mask["geom"]))
    if remaining is not None and not remaining.IsEmpty():
        written += emit(feature, remaining, max_zoom, out, family)
    return written


def main():
    features_path, masks_path, out_path, spec_path = sys.argv[1:5]
    spec = json.load(open(spec_path))
    max_zoom = int(spec["maxZoom"])
    masks = load_masks(masks_path)
    starts = layer_starts(features_path)
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
            props = feature.get("properties") or {}
            band = props.get("band")
            layer = props.get("cls")
            if band is None or not layer:
                written += emit(
                    feature, geom, int(feature["tippecanoe"]["maxzoom"]), out, family
                )
                continue
            try:
                written += cut(
                    feature,
                    geom,
                    int(band),
                    str(layer),
                    masks,
                    starts,
                    out,
                    family,
                    max_zoom,
                )
            except RuntimeError:
                # A broken ring should not drop the whole cell.
                written += emit(feature, geom, max_zoom, out, family)
    print(written)


if __name__ == "__main__":
    main()
