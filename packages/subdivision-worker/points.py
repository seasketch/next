import fiona
from tqdm import tqdm
import os
from typing import Optional, Callable


def process_points(input_file: str, output_file: str, progress_callback: Optional[Callable] = None):
    """
    Process Point and MultiPoint geometries from a fiona source.
    
    - Splits MultiPoints into individual Point features
    - Sets __oidx property to track parent feature index (for MultiPoints) or sequential counter (for Points)
    - Writes output as FlatGeobuf
    
    Args:
        input_file: Path to input file (any format supported by Fiona)
        output_file: Path to output FlatGeobuf file
        progress_callback: Optional callback function(phase, current, total) for progress updates
    """
    batch = []
    
    # Allow overriding batch size via env var
    try:
        BATCH_SIZE = int(os.getenv("SUBDIVIDE_BATCH_SIZE", "10000"))
    except Exception:
        BATCH_SIZE = 10000
    
    # First pass: count features and points
    with fiona.open(input_file, "r") as src:
        schema = src.schema.copy()
        schema['geometry'] = 'Point'
        # Ensure output schema has __oidx property
        if 'properties' in schema and isinstance(schema['properties'], dict):
            schema['properties']['__oidx'] = 'int'
        
        total_features = len(src)
        
        # Report scanning progress
        scanned_features = 0
        if progress_callback is not None:
            try:
                progress_callback('scanning', 0, total_features)
            except Exception:
                pass
        
        # Count total points for progress tracking
        total_points = 0
        for feature in src:
            geom = feature['geometry']
            if geom['type'] == 'MultiPoint':
                total_points += len(geom['coordinates'])
            elif geom['type'] == 'Point':
                total_points += 1
            scanned_features += 1
            if progress_callback is not None:
                try:
                    progress_callback('scanning', scanned_features, total_features)
                except Exception:
                    pass
    
    # Second pass: process and write
    with fiona.open(input_file, "r") as src:
        with fiona.open(output_file, "w", driver="FlatGeobuf", crs=src.crs, schema=schema) as dst:
            def write(feature):
                nonlocal processed_points
                batch.append(feature)
                processed_points += 1
                if progress_callback is not None:
                    try:
                        progress_callback('processing', processed_points, total_points)
                    except Exception:
                        pass
                if len(batch) >= BATCH_SIZE:
                    dst.writerecords(batch)
                    batch.clear()
            
            # Initialize local progress bar only if no external callback is provided
            pbar = None if progress_callback is not None else tqdm(total=total_points, desc="Processing points")
            
            if progress_callback is not None:
                try:
                    progress_callback('processing_start', 0, total_points)
                except Exception:
                    pass
            
            feature_index = 0
            processed_points = 0
            for feature in src:
                geom = feature['geometry']
                props = dict(feature['properties'])
                
                if geom['type'] == 'MultiPoint':
                    # Split MultiPoint into individual Points
                    # All points from the same MultiPoint get the same __oidx (parent feature index)
                    props['__oidx'] = feature_index
                    for coords in geom['coordinates']:
                        point_geom = {'type': 'Point', 'coordinates': coords}
                        write({'geometry': point_geom, 'properties': props})
                        if pbar is not None:
                            pbar.update(1)
                elif geom['type'] == 'Point':
                    # Single Point - use sequential counter as __oidx
                    props['__oidx'] = feature_index
                    write({'geometry': geom, 'properties': props})
                    if pbar is not None:
                        pbar.update(1)
                # Skip other geometry types (shouldn't happen if routing is correct)
                
                feature_index += 1
            
            if pbar is not None:
                try:
                    pbar.close()
                except Exception:
                    pass
            
            # Write any remaining batched features
            if batch:
                dst.writerecords(batch)
                batch.clear()
            
            print(f"Total features processed: {feature_index}")
            print(f"Total points written: {processed_points}")

