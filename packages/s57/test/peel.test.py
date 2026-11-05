"""The peel keeps a feature until the cell on top of it draws that same layer."""
import json
import subprocess
import tempfile
from pathlib import Path

PEEL = Path(__file__).resolve().parents[1] / "src" / "peel.py"


def run(features, masks):
    with tempfile.TemporaryDirectory() as work:
        root = Path(work)
        features_path = root / "features.geojsonl"
        masks_path = root / "masks.geojson"
        out_path = root / "out.geojsonl"
        spec_path = root / "spec.json"
        features_path.write_text("".join(json.dumps(feature) + "\n" for feature in features))
        masks_path.write_text(json.dumps({"type": "FeatureCollection", "features": masks}))
        spec_path.write_text(json.dumps({"bandMinZoom": {"4": 10, "5": 12}, "maxZoom": 16}))
        subprocess.run(
            ["python3", str(PEEL), str(features_path), str(masks_path), str(out_path), str(spec_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        return [json.loads(line) for line in out_path.read_text().splitlines() if line.strip()]


def square(west, south, east, north):
    return {
        "type": "Polygon",
        "coordinates": [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
    }


def feature(cell, band, layer, minzoom, geom):
    return {
        "type": "Feature",
        "properties": {"cell": cell, "band": band, "cls": layer},
        "geometry": geom,
        "tippecanoe": {"layer": layer, "minzoom": minzoom, "maxzoom": 16},
    }


def mask(cell, band, geom):
    return {"type": "Feature", "properties": {"cell": cell, "band": band}, "geometry": geom}


def test_keeps_contours_until_the_covering_cell_draws_them():
    box = square(-120, 34, -119, 35)
    # Coastal contours want zoom 10. The approach cell on top of them does not
    # draw contours until zoom 12, so the coastal ones have to fill 10 and 11.
    coastal = feature("US3", 3, "depth_contour", 10, box)
    approach = feature("US4", 4, "depth_contour", 12, box)
    out = run([coastal, approach], [mask("US4", 4, box)])
    coastal_out = [item for item in out if item["properties"]["cell"] == "US3"]
    approach_out = [item for item in out if item["properties"]["cell"] == "US4"]
    assert len(coastal_out) == 1, coastal_out
    assert coastal_out[0]["tippecanoe"]["maxzoom"] == 11
    assert approach_out[0]["tippecanoe"]["maxzoom"] == 16


def test_drops_a_feature_once_the_covering_cell_already_draws_that_layer():
    box = square(-120, 34, -119, 35)
    coastal = feature("US3", 3, "depth_contour", 10, box)
    approach = feature("US4", 4, "depth_contour", 10, box)
    out = run([coastal, approach], [mask("US4", 4, box)])
    assert [item["properties"]["cell"] for item in out] == ["US4"]


def test_a_cell_without_the_layer_does_not_erase_it():
    box = square(-120, 34, -119, 35)
    coastal = feature("US3", 3, "depth_contour", 10, box)
    # The approach cell has soundings but no contours.
    approach = feature("US4", 4, "sounding", 12, box)
    out = run([coastal, approach], [mask("US4", 4, box)])
    contours = [item for item in out if item["properties"]["cls"] == "depth_contour"]
    assert len(contours) == 1
    assert contours[0]["tippecanoe"]["maxzoom"] == 16


if __name__ == "__main__":
    test_keeps_contours_until_the_covering_cell_draws_them()
    test_drops_a_feature_once_the_covering_cell_already_draws_that_layer()
    test_a_cell_without_the_layer_does_not_erase_it()
    print("peel ok")
