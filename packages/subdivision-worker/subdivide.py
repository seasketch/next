import argparse
import math
from shapely.geometry import shape, mapping, LineString, GeometryCollection, MultiLineString, Polygon, MultiPolygon
from shapely.ops import split, transform
from shapely import get_num_coordinates, prepare
import fiona
from tqdm import tqdm
import os
import sys
import time
from pyproj import Geod

def count_nodes(geom):
    """Count the number of nodes in a Fiona geometry (geojson-like dict)."""
    if geom['type'] == 'Polygon':
        return len(geom['coordinates'][0])
    elif geom['type'] == 'MultiPolygon':
        return sum([len(p[0]) for p in geom['coordinates']])
    else:
        return 0
    
    
def subdivide_and_write_feature(feature, write, max_nodes):
    """Recursively subdivide a geometry into smaller parts and update stats."""
    geom = shape(feature['geometry'])
    # prepare(geom)
    stack = multipart_to_singlepart(geom)    
    while stack:
      geom = stack.pop()
      # Early exit if already small enough
      num_coords_geom = get_num_coordinates(geom)
      if num_coords_geom <= max_nodes:
          f = fiona.Feature(geometry=fiona.Geometry.from_dict(mapping(geom)), properties=feature['properties'])
          # Pass node count through; caller wrapper may use it for progress
          write(f, num_coords_geom)
          continue

      bounds = geom.bounds
      width = bounds[2] - bounds[0]
      height = bounds[3] - bounds[1]

      if width > height:
          # Split along vertical line (longer x-axis)
          split_line = LineString([(bounds[0] + width / 2, bounds[1]),
                                  (bounds[0] + width / 2, bounds[3])])
      else:
          # Split along horizontal line (longer y-axis)
          split_line = LineString([(bounds[0], bounds[1] + height / 2),
                                  (bounds[2], bounds[1] + height / 2)])
      
      # Perform the split
      split_parts = split(geom, split_line)
      for part in split_parts.geoms:
        num_coords = get_num_coordinates(part)
        if num_coords <= max_nodes:
            f = fiona.Feature(geometry=fiona.Geometry.from_dict(mapping(part)), properties=feature['properties'])
            # Pass node count through; caller wrapper may use it for progress
            write(f, num_coords)
        else:
            # prepare(part)
            stack.append(part)
  


def _unwrap_ring_longitudes(coords):
    unwrapped = []
    if not coords:
        return coords
    prev_x = coords[0][0]
    prev_y = coords[0][1]
    unwrapped.append((prev_x, prev_y))
    for i in range(1, len(coords)):
        x, y = coords[i][0], coords[i][1]
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


def _crosses_antimeridian_coords(coords):
    if not coords:
        return False
    prev_x = coords[0][0]
    for i in range(1, len(coords)):
        x = coords[i][0]
        if abs(x - prev_x) > 180:
            return True
        prev_x = x
    return False


def crosses_antimeridian(geom):
    if geom.geom_type == "Polygon":
        rings = [geom.exterior] + list(geom.interiors)
        return any(_crosses_antimeridian_coords(list(r.coords)) for r in rings)
    elif geom.geom_type == "MultiPolygon":
        return any(crosses_antimeridian(p) for p in geom.geoms)
    return False

def geojson_crosses_antimeridian(geom):
    if geom['type'] == 'Polygon':
        rings = [geom['coordinates'][0]] + geom['coordinates'][1:]
        return any(_crosses_antimeridian_coords(r) for r in rings)
    elif geom['type'] == 'MultiPolygon':
        return any(geojson_crosses_antimeridian({'type':'Polygon','coordinates':coords})
                   for coords in geom['coordinates'])
    return False

def antimeridian_split_to_non_crossing(geom_geojson):
    """Return a GeoJSON geometry with no parts crossing the antimeridian.
    Input is assumed to be EPSG:4326.
    """
    # Fast path: no Shapely if not crossing
    if not geojson_crosses_antimeridian(geom_geojson):
        return geom_geojson
    g = shape(geom_geojson)
    if g.is_empty:
        return geom_geojson

    if not crosses_antimeridian(g):
        return geom_geojson

    def normalize_lon(x):
        while x > 180:
            x -= 360
        while x < -180:
            x += 360
        return x

    def unwrap_polygon(poly: Polygon) -> Polygon:
        ext = _unwrap_ring_longitudes(list(poly.exterior.coords)) if poly.exterior else []
        holes = [
            _unwrap_ring_longitudes(list(r.coords))
            for r in poly.interiors
        ]
        return Polygon(ext, holes)

    parts = []
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    for poly in polys:
        p_unwrap = unwrap_polygon(poly)
        minx, miny, maxx, maxy = p_unwrap.bounds
        lines = []
        start = math.floor((minx - 180) / 360) * 360 + 180
        x = start
        while x <= maxx + 1e-9:
            lines.append(LineString([(x, -90), (x, 90)]))
            x += 360
        splitter = MultiLineString(lines) if len(lines) > 1 else (lines[0] if lines else None)
        split_result = [p_unwrap]
        if splitter is not None:
            try:
                split_result = list(split(p_unwrap, splitter).geoms)
            except Exception:
                split_result = [p_unwrap]
        for piece in split_result:
            # Shift the entire piece by a multiple of 360 so its centroid.x is within [-180, 180]
            cx = piece.centroid.x
            shift = -360 * math.floor((cx + 180.0) / 360.0)
            if abs(shift) > 1e-9:
                def _shift_func(x, y, z=None):
                    return (x + shift, y)
                piece = transform(_shift_func, piece)
            if not piece.is_empty:
                parts.append(piece)

    if not parts:
        return geom_geojson
    result = MultiPolygon(parts) if len(parts) > 1 else parts[0]
    return mapping(result)

def process_file(input_file, output_file, max_nodes, progress_callback=None):
    """Process the input file and write the subdivided output as FlatGeobuf.
    
    Args:
        input_file: Path to input file (any format supported by Fiona)
        output_file: Path to output FlatGeobuf file
        max_nodes: Maximum number of nodes per geometry
        progress_callback: Optional callback function(phase, current, total) for progress updates
    """
    # First, count the number of nodes in all features of the file
    total_nodes = 0
    total_features = 0
    batch = []
    
    # Geodesic calculator (input is always EPSG:4326)
    geod = Geod(ellps="WGS84")
    
    # First pass: get schema and count nodes
    with fiona.open(input_file, "r") as src:
        schema = src.schema.copy()
        schema['geometry'] = 'Polygon'
        # Ensure output schema has an __area property
        if 'properties' in schema and isinstance(schema['properties'], dict):
            schema['properties']['__area'] = 'float'
            schema['properties']['__oidx'] = 'int'
        total_features = len(src)

        total_nodes_in_dataset = int(0)  # Explicit 64-bit integer for large datasets
        # Report scanning progress by number of features read
        scanned_features = 0
        if progress_callback is not None:
          try:
            progress_callback('scanning', 0, total_features)
          except Exception:
            pass
        for feature in src:
          total_nodes_in_dataset += count_nodes(feature['geometry'])
          scanned_features += 1
          if progress_callback is not None:
            try:
              progress_callback('scanning', scanned_features, total_features)
            except Exception:
              pass

    big_poly_indexes = {}
    i = 0
    total_small_nodes_added = 0
    total_node_count = 0
    cumulative_processed_nodes = int(0)

    def geodesic_area_sqkm(geom_geojson):
        """Compute geodesic area in sq km directly from GeoJSON coordinates using pyproj.Geod.
        Supports Polygon and MultiPolygon. Holes are subtracted from the exterior.
        """
        def polygon_area_sq_m(coords):
            if not coords or len(coords) == 0:
                return 0.0
            # Exterior
            ext = coords[0]
            if not ext or len(ext) < 3:
                return 0.0
            lons_ext = [pt[0] for pt in ext]
            lats_ext = [pt[1] for pt in ext]
            area_ext_m2, _ = geod.polygon_area_perimeter(lons_ext, lats_ext)
            area_m2_total = abs(area_ext_m2)
            # Holes
            for hole in coords[1:]:
                if not hole or len(hole) < 3:
                    continue
                lons_h = [pt[0] for pt in hole]
                lats_h = [pt[1] for pt in hole]
                area_h_m2, _ = geod.polygon_area_perimeter(lons_h, lats_h)
                area_m2_total -= abs(area_h_m2)
            return max(area_m2_total, 0.0)

        gtype = geom_geojson.get('type')
        if gtype == 'Polygon':
            return polygon_area_sq_m(geom_geojson.get('coordinates', [])) / 1_000_000.0
        elif gtype == 'MultiPolygon':
            total_m2 = 0.0
            for coords in geom_geojson.get('coordinates', []):
                total_m2 += polygon_area_sq_m(coords)
            return total_m2 / 1_000_000.0
        else:
            return 0.0

    # Second pass: process features
    with fiona.open(input_file, "r") as src:
        with fiona.open(output_file, "w", driver="FlatGeobuf", crs=src.crs, schema=schema) as dst:
          # Initialize local progress bar only if no external callback is provided
          pbar = None if progress_callback is not None else tqdm(total=total_features, desc="Processing features")
          if progress_callback is not None:
            try:
              progress_callback('processing_start', 0, total_nodes_in_dataset)
            except Exception:
              pass
          # batching doesn't seem to help, even though the fiona docs suggest
          # it should. Maybe the flatgeobuf driver doesn't work well with 
          # batching?
          # Allow overriding batch size via env var; default larger than 5000 for throughput
          try:
            BATCH_SIZE = int(os.getenv("SUBDIVIDE_BATCH_SIZE", "10000"))
          except Exception:
            BATCH_SIZE = 10000

          def write(feature, is_split=False):
            # Compute area and add to properties before batching
            geom_geojson = feature['geometry']
            props = dict(feature['properties'])
            if '__area' not in props:
              area_val = geodesic_area_sqkm(geom_geojson)
              props['__area'] = area_val
            batch.append({'geometry': geom_geojson, 'properties': props})
            nonlocal cumulative_processed_nodes
            cumulative_processed_nodes += count_nodes(feature['geometry'])
            if is_split:
              cumulative_processed_nodes -= 1
            if progress_callback is not None:
              try:
                progress_callback('processing', cumulative_processed_nodes, total_nodes_in_dataset)
              except Exception:
                pass
            if len(batch) >= BATCH_SIZE:
              dst.writerecords(batch)
              batch.clear()

          # Process features (file is opened fresh in second pass)
          for feature in src:
            adjusted_geom = antimeridian_split_to_non_crossing(feature['geometry'])

            # Common props for all outputs from this input feature
            base_props = dict(feature['properties'])
            base_props['__oidx'] = i

            # Progress accounting helpers for subdivision
            nodes_processed = 0
            update_total = 0.0

            def writeSubdividedFeature(f, f_node_count):
              nonlocal nodes_processed
              nonlocal update_total
              # Slight adjustment carried over from previous logic
              try:
                f_node_adj = f_node_count - 2
              except Exception:
                f_node_adj = f_node_count
              nodes_processed += f_node_adj
              write(f, True)
              if pbar is not None:
                try:
                  amount = f_node_adj / node_count
                  update_total += amount
                  if update_total < 1.0:
                    pbar.update(amount)
                except Exception:
                  pass

            any_big = False
            if adjusted_geom['type'] == 'MultiPolygon':
              if pbar is not None:
                pbar.set_postfix({"Task": "Analyzing multipolygon parts"})
              for coords in adjusted_geom['coordinates']:
                poly_geom = {'type': 'Polygon', 'coordinates': coords}
                # Count nodes of the exterior ring (consistent with count_nodes for Polygon)
                part_nodes = len(coords[0]) if coords and len(coords) > 0 else 0
                total_node_count += part_nodes
                # Set denominator for progress updates within the wrapper
                node_count = part_nodes
                if part_nodes > max_nodes:
                  any_big = True
                  part_feature = fiona.Feature(
                    geometry=fiona.Geometry.from_dict(poly_geom),
                    properties=base_props
                  )
                  subdivide_and_write_feature(part_feature, writeSubdividedFeature, max_nodes)
                else:
                  props = dict(base_props)
                  write({'geometry': poly_geom, 'properties': props})
              if any_big:
                big_poly_indexes[str(i)] = True
              if pbar is not None:
                pbar.update(1)
            else:
              # Single polygon case
              node_count = count_nodes(adjusted_geom)
              total_node_count += node_count
              if node_count > max_nodes:
                if pbar is not None:
                  pbar.set_postfix({"Task": "Subdividing big features"})
                adj_feature = fiona.Feature(
                  geometry=fiona.Geometry.from_dict(adjusted_geom),
                  properties=base_props
                )
                subdivide_and_write_feature(adj_feature, writeSubdividedFeature, max_nodes)
                big_poly_indexes[str(i)] = True
              else:
                write({'geometry': adjusted_geom, 'properties': base_props})
              if pbar is not None:
                pbar.update(1)

            i += 1
          if pbar is not None:
            try:
              pbar.close()
            except Exception:
              pass
          if batch:
            dst.writerecords(batch)
            batch.clear()

          print(f"Total nodes in input dataset: {total_nodes}")
          print(f"Total features in input dataset: {total_features}")
          print(f"Total small features in input dataset: {total_features - len(big_poly_indexes.keys())}")
          print(f"Total big features in input dataset: {len(big_poly_indexes.keys())}")

        

def multipart_to_singlepart(geometry):
    """
    Convert a MultiPolygon or GeometryCollection geometry to a list of Polygon geometries.

    Parameters:
    geometry (shapely.geometry.base.BaseGeometry): The input geometry, which can be of type MultiPolygon, 
                             GeometryCollection, or Polygon.

    Returns:
    list: A list of shapely.geometry.Polygon objects.

    Raises:
    ValueError: If the input geometry is not of type MultiPolygon, GeometryCollection, or Polygon.
    """
    if geometry.geom_type == "MultiPolygon":
        return list(geometry.geoms)
    elif geometry.geom_type == "GeometryCollection":
        parts = []
        for geom in geometry.geoms:
            if geom.geom_type == "MultiPolygon":
                parts.extend(list(geometry.geoms))
            else:
                parts.append(geom)
        return parts
    elif geometry.geom_type == "Polygon":
        return [geometry]
    else:
        raise ValueError(f"Unsupported geometry type: {geometry.geom_type}")

def main():
    parser = argparse.ArgumentParser(description="Subdivide vector geometries into smaller parts and output as FlatGeobuf.")
    parser.add_argument("input", help="Input vector file (any format supported by Fiona).")
    parser.add_argument("output", help="Output FlatGeobuf file (must have .fgb extension).")
    parser.add_argument("--max-nodes", type=int, default=256,
                        help="Maximum number of nodes per geometry (default: 256).")
    
    args = parser.parse_args()

    # Validate input file
    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist.")
        sys.exit(1)

    # Validate output file extension
    if not args.output.lower().endswith(".fgb"):
        print(f"Error: Output file must have a .fgb extension.")
        sys.exit(1)

    # process_file now accepts file path directly
    process_file(args.input, args.output, args.max_nodes)
    print(f"\nSubdivision complete. Output written to {args.output}.")

if __name__ == "__main__":
    main()

